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
import { getBalance, shouldRestake, calculateStakingAmount } from "./services/balanceService";

const validatedConfig = RestakeConfigSchema.parse(Config);

/**
 * 1. Claim rewards from delegators with rewards >= MIN_REWARD_AMOUNT
 * 2. If total balance - RESERVE > MIN_RESTAKE_AMOUNT, restake to the validator with the lowest stake
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

    // Process restaking for each account independently
    let totalRestaked = 0;
    const restakedValidators: string[] = [];
    let totalAvailableBalance = 0;

    // Group active validators by delegator address to ensure we only restake available funds
    const delegators = [...new Set(activeValidators.map(v => v.delegatorAddress))];

    for (const delegatorAddress of delegators) {
      const delegatorValidators = activeValidators.filter(v => v.delegatorAddress === delegatorAddress);
      
      if (delegatorValidators.length === 0) continue;

      // Get available balance for this specific delegator
      const availableBalance = await getBalance(
        client,
        delegatorAddress,
        validatedConfig.DENOM
      );
      
      totalAvailableBalance += availableBalance;

      // Check if restaking is needed for this delegator
      if (
        !shouldRestake(
          availableBalance,
          validatedConfig.MIN_RESTAKE_AMOUNT,
          validatedConfig.RESERVE
        )
      ) {
        continue;
      }

      const amountToStake = calculateStakingAmount(
        availableBalance,
        validatedConfig.RESERVE
      );

      // Check if amount to stake is positive (redundant with shouldRestake but good for safety)
      if (amountToStake <= 0) continue;

      // Find the validator with the lowest stake among the delegator's active validators
      const lowestStakingValidator = findLowestStakingValidator(delegatorValidators);

      await sendMessage(
        `Restaking ${formatNumber(amountToStake)} ${validatedConfig.DENOM} from ${delegatorAddress} to ${lowestStakingValidator.validatorAddress} (lowest stake)`,
        "success"
      );

      // Delegate to the lowest staking validator
      const delegateTx: DeliverTxResponse = await client.delegateTokens(
        lowestStakingValidator.delegatorAddress,
        lowestStakingValidator.validatorAddress,
        { amount: amountToStake.toString(), denom: validatedConfig.DENOM },
        "auto"
      );

      assertIsDeliverTxSuccess(delegateTx);
      
      totalRestaked += amountToStake;
      restakedValidators.push(lowestStakingValidator.validatorAddress);
    }

    if (totalRestaked === 0) {
       const thresholdToStake = validatedConfig.MIN_RESTAKE_AMOUNT + validatedConfig.RESERVE;
       await sendMessage(
        `No restaking performed. Total available across ${delegators.length} account(s): ${formatNumber(totalAvailableBalance)} ${validatedConfig.DENOM}. Threshold per account: ${formatNumber(thresholdToStake)}`,
        "info"
       );
    }

    return {
      success: true,
      rewardsClaimed: rewardSum,
      amountRestaked: totalRestaked,
      validator: restakedValidators.join(", "), // Return comma-separated list if multiple
      totalAvailable: totalAvailableBalance,
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
