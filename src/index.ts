import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { sendMessage } from "./DiscordNotifier";
import { Config } from "./config";
import {
  DelegationResponseSchema,
  RestakeConfigSchema,
  RewardsResponseSchema,
  Validator,
  ValidatorAddress,
  ValidatorInfoSchema,
} from "./types";
import {
  assertIsDeliverTxSuccess,
  DeliverTxResponse,
  GasPrice,
  SigningStargateClient,
} from "@cosmjs/stargate";
import { fetchWithTimeout, returnFirst } from "./utils";

const validatedConfig = RestakeConfigSchema.parse(Config);

/**
 * 1. Claim rewards from delegators with rewards >= MIN_REWARD_AMOUNT
 * 2. If total balance - RESERVE > MIN_RESTAKE_AMOUNT, restake to validator with lowest staking amount
 */
export async function executeRestake() {
  let client: SigningStargateClient | undefined;

  try {
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(
      validatedConfig.MNEMONIC,
      {
        prefix: validatedConfig.PREFIX,
      }
    );
    const accounts = (await wallet.getAccounts()).map(
      (account) => account.address
    );

    if (accounts.length === 0) {
      await sendMessage("No accounts found", "error");
      throw new Error("No accounts found");
    }

    client = await SigningStargateClient.connectWithSigner(
    validatedConfig.RPC_URL,
    wallet,
    {
      gasPrice: GasPrice.fromString(validatedConfig.GAS_PRICE),
    }
  );

  // Get list of validators
  const tmpValidators: Validator[] = [];
  await Promise.all(
    accounts.map((account) => getDelegations(client!, account))
  ).then((delegationsRaw) => {
    delegationsRaw.flat().forEach((delegation) => {
      const { success, data } = DelegationResponseSchema.safeParse(delegation);
      if (success) {
        tmpValidators.push({
          validatorAddress: data.delegation
            .validatorAddress as ValidatorAddress,
          delegatorAddress: data.delegation.delegatorAddress,
          stakingAmount: Number(data.balance.amount),
          rewards: 0,
        });
      }
    });
  });

  // Enrich validators with rewards and metadata
  const validators: Validator[] = await Promise.all(
    tmpValidators.map(async (validator) => {
      // Fetch rewards
      const rewardUrls = validatedConfig.LCD_ENDPOINTS.map(
        (endpoint) =>
          `${endpoint}/cosmos/distribution/v1beta1/delegators/${validator.delegatorAddress}/rewards/${validator.validatorAddress}`
      );
      const rewards = await returnFirst(
        rewardUrls.map(async (url) => {
          const response = await fetchWithTimeout(url, 1000);
          return response.json();
        })
      );
      const validatedRewards = RewardsResponseSchema.parse(rewards);

      // Fetch validator info (status, jailed, commission)
      const validatorInfoUrls = validatedConfig.LCD_ENDPOINTS.map(
        (endpoint) =>
          `${endpoint}/cosmos/staking/v1beta1/validators/${validator.validatorAddress}`
      );

      let jailed = false;
      let status = "UNKNOWN";
      let commission = 0;

      try {
        const validatorInfoResponse = await returnFirst(
          validatorInfoUrls.map(async (url) => {
            const response = await fetchWithTimeout(url, 1000);
            return response.json();
          })
        );
        const validatorInfo = ValidatorInfoSchema.parse(validatorInfoResponse);
        jailed = validatorInfo.validator.jailed;
        status = validatorInfo.validator.status;
        commission = Number(validatorInfo.validator.commission.commission_rates.rate);
      } catch (error) {
        // If we can't fetch validator info, log but continue
        console.warn(`Failed to fetch validator info for ${validator.validatorAddress}:`, error);
      }

      return {
        ...validator,
        rewards: validatedRewards.rewards
          .filter((reward) => reward.denom === validatedConfig.DENOM)
          .reduce((acc, reward) => acc + Number(reward.amount), 0),
        jailed,
        status,
        commission,
      };
    })
  );

  if (validators.length === 0) {
    const msg = "No validators found";
    await sendMessage(msg, "warn");
    throw new Error(msg);
  }

  // Filter out jailed validators and inactive validators (status !== "BOND_STATUS_BONDED")
  const activeValidators = validators.filter((v) => {
    const isActive = !v.jailed && v.status === "BOND_STATUS_BONDED";
    if (!isActive) {
      console.log(
        `Skipping validator ${v.validatorAddress}: jailed=${v.jailed}, status=${v.status}`
      );
    }
    return isActive;
  });

  if (activeValidators.length === 0) {
    const msg = `No active validators found. All ${validators.length} validator(s) are either jailed or inactive.`;
    await sendMessage(msg, "error");
    throw new Error(msg);
  }

  await sendMessage(
    `Found ${activeValidators.length} active validator(s) out of ${validators.length} total delegations`
  );

  // Get the active validator with the lowest staking amount
  const lowestStakingValidator = activeValidators.reduce((min, v) =>
    v.stakingAmount < min.stakingAmount ? v : min
  );

  // Claim all rewards > MIN_REWARD_AMOUNT
  const rewardsToClaim = validators.filter(
    (validator) => validator.rewards > validatedConfig.MIN_REWARD_AMOUNT
  );

  const rewardSum = rewardsToClaim.reduce(
    (acc, validator) => acc + validator.rewards,
    0
  );

  await sendMessage(
    `Rewards to claim: ${formatNumber(rewardSum)} ${
      validatedConfig.DENOM
    } considering min reward amount of ${formatNumber(
      validatedConfig.MIN_REWARD_AMOUNT
    )} ${validatedConfig.DENOM}`,
    rewardSum > 0 ? "success" : "info"
  );

  // Claim rewards
  await Promise.allSettled(
    rewardsToClaim.map(async (validator) => {
      // Wait 1 second
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // const tx =
      await client!.withdrawRewards(
        validator.delegatorAddress,
        validator.validatorAddress,
        "auto"
      );
    })
  );

  // Get total available (not staked) ATOMS - after rewards are claimed
  const balances = await Promise.all(
    accounts.map(async (account) => {
      const balance = await client!.getBalance(account, validatedConfig.DENOM);
      return Number(balance.amount);
    })
  );
  const totalAvailable = balances.reduce((acc, amount) => acc + amount, 0);

  await sendMessage(
    `Total available: ${formatNumber(totalAvailable)} ${
      validatedConfig.DENOM
    }. Reserve: ${formatNumber(validatedConfig.RESERVE)} ${
      validatedConfig.DENOM
    }`
  );

  const thresholdToStake =
    validatedConfig.MIN_RESTAKE_AMOUNT + validatedConfig.RESERVE;

  if (totalAvailable < thresholdToStake) {
    throw new Error(
      `No restaking needed, total available is less than ${formatNumber(
        thresholdToStake
      )} ${validatedConfig.DENOM}`
    );
  }

  const amountToStake = totalAvailable - validatedConfig.RESERVE;
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

function formatNumber(number: number) {
  return number.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}

async function getDelegations(client: SigningStargateClient, account: string) {
  const delegations = await (
    client as any
  ).queryClient.staking.delegatorDelegations(account);
  return delegations.delegationResponses;
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
