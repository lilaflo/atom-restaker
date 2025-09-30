import { sendMessage } from "./DiscordNotifier";
import { Config } from "./config";
import { RestakeConfigSchema } from "./types";
import {
  assertIsDeliverTxSuccess,
  DeliverTxResponse,
  SigningStargateClient,
} from "@cosmjs/stargate";
import { formatNumber } from "./utils/formatting";
import { createWallet, getAccounts, connectWithSigner } from "./services/walletService";
import { getAllDelegations } from "./services/delegationService";
import { enrichValidatorsWithRewards } from "./services/rewardsService";
import { enrichValidatorsWithMetadata, filterActiveValidators, findLowestStakingValidator } from "./services/validatorService";
import { filterValidatorsWithRewards, calculateTotalRewards, claimRewards } from "./services/claimService";
import { getTotalAvailableBalance, shouldRestake, calculateStakingAmount } from "./services/balanceService";

const validatedConfig = RestakeConfigSchema.parse(Config);

/**
 * 1. Claim rewards from delegators with rewards >= MIN_REWARD_AMOUNT
 * 2. If total balance - RESERVE > MIN_RESTAKE_AMOUNT, restake to validator with lowest staking amount
 */
export async function executeRestake() {
  let client: SigningStargateClient | undefined;

  try {
    // Create wallet and get accounts
    const wallet = await createWallet(
      validatedConfig.MNEMONIC,
      validatedConfig.PREFIX
    );
    const accounts = await getAccounts(wallet);

    if (accounts.length === 0) {
      await sendMessage("No accounts found", "error");
      throw new Error("No accounts found");
    }

    // Connect to Cosmos chain
    client = await connectWithSigner(
      validatedConfig.RPC_URL,
      wallet,
      validatedConfig.GAS_PRICE
    );

    // Get all delegations
    const tmpValidators = await getAllDelegations(client, accounts);

    // Enrich validators with rewards
    let validators = await enrichValidatorsWithRewards(
      tmpValidators,
      validatedConfig.LCD_ENDPOINTS,
      validatedConfig.DENOM
    );

    // Enrich validators with metadata
    validators = await enrichValidatorsWithMetadata(
      validators,
      validatedConfig.LCD_ENDPOINTS
    );

    if (validators.length === 0) {
      const msg = "No validators found";
      await sendMessage(msg, "warn");
      throw new Error(msg);
    }

    // Filter active validators
    const activeValidators = filterActiveValidators(validators);

    if (activeValidators.length === 0) {
      const msg = `No active validators found. All ${validators.length} validator(s) are either jailed or inactive.`;
      await sendMessage(msg, "error");
      throw new Error(msg);
    }

    await sendMessage(
      `Found ${activeValidators.length} active validator(s) out of ${validators.length} total delegations`
    );

    // Get the active validator with the lowest staking amount
    const lowestStakingValidator = findLowestStakingValidator(activeValidators);

    // Filter validators with claimable rewards
    const rewardsToClaim = filterValidatorsWithRewards(
      validators,
      validatedConfig.MIN_REWARD_AMOUNT
    );

    const rewardSum = calculateTotalRewards(rewardsToClaim);

    await sendMessage(
      `Rewards to claim: ${formatNumber(rewardSum)} ${
        validatedConfig.DENOM
      } considering min reward amount of ${formatNumber(
        validatedConfig.MIN_REWARD_AMOUNT
      )} ${validatedConfig.DENOM}`,
      rewardSum > 0 ? "success" : "info"
    );

    // Claim rewards
    await claimRewards(client, rewardsToClaim, 1000);

    // Get total available balance
    const totalAvailable = await getTotalAvailableBalance(
      client,
      accounts,
      validatedConfig.DENOM
    );

    await sendMessage(
      `Total available: ${formatNumber(totalAvailable)} ${
        validatedConfig.DENOM
      }. Reserve: ${formatNumber(validatedConfig.RESERVE)} ${
        validatedConfig.DENOM
      }`
    );

    // Check if restaking is needed
    if (
      !shouldRestake(
        totalAvailable,
        validatedConfig.MIN_RESTAKE_AMOUNT,
        validatedConfig.RESERVE
      )
    ) {
      const thresholdToStake =
        validatedConfig.MIN_RESTAKE_AMOUNT + validatedConfig.RESERVE;
      throw new Error(
        `No restaking needed, total available is less than ${formatNumber(
          thresholdToStake
        )} ${validatedConfig.DENOM}`
      );
    }

    const amountToStake = calculateStakingAmount(
      totalAvailable,
      validatedConfig.RESERVE
    );

    await sendMessage(
      `Restaking ${formatNumber(amountToStake)} ${validatedConfig.DENOM} to ${
        lowestStakingValidator.validatorAddress
      }`,
      "success"
    );

    const delegateTx: DeliverTxResponse = await client.delegateTokens(
      lowestStakingValidator.delegatorAddress,
      lowestStakingValidator.validatorAddress,
      { amount: amountToStake.toString(), denom: validatedConfig.DENOM },
      "auto"
    );

    assertIsDeliverTxSuccess(delegateTx);

    return {
      success: true,
      rewardsClaimed: rewardSum,
      amountRestaked: amountToStake,
      validator: lowestStakingValidator.validatorAddress,
      totalAvailable,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sendMessage(message, "error").catch(console.error);
    return {
      success: false,
      error: message,
    };
  } finally {
    if (client) {
      client.disconnect();
    }
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  executeRestake()
    .then((result) => {
      if (result.success) {
        console.log("Restake bot completed successfully");
        process.exit(0);
      } else {
        console.error("Restake bot failed:", result.error);
        process.exit(1);
      }
    })
    .catch(async (error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Restake bot failed:", message);
      process.exit(1);
    });
}
