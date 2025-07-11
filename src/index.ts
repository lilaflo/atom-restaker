import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { Config } from "./config";
import {
  DelegationResponseSchema,
  RestakeConfigSchema,
  RewardsResponseSchema,
  Validator,
  ValidatorAddress,
} from "./types";
import { GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import { fetchWithTimeout, returnFirst } from "./utils";

const validatedConfig = RestakeConfigSchema.parse(Config);
let client: SigningStargateClient;

if (!validatedConfig) {
  throw new Error("Invalid config");
}

/**
 * 1. Claim rewards from delegators with rewards >= MIN_REWARD_AMOUNT
 * 2. If total balance - RESERVE > MIN_RESTAKE_AMOUNT, restake to validator with lowest staking amount
 */
async function main() {
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
    accounts.map(async (account) => await getDelegations(client, account))
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

  // Enrich validators with rewards
  const validators: Validator[] = await Promise.all(
    tmpValidators.map(async (validator) => {
      const rewardUrls = validatedConfig.LCD_ENDPOINTS.map(
        (endpoint) =>
          `${endpoint}/cosmos/distribution/v1beta1/delegators/${validator.delegatorAddress}/rewards/${validator.validatorAddress}`
      );
      // Make a race condition with all rewardUrls. Reject non json responses.
      const rewards = await returnFirst(
        rewardUrls.map(async (url) => {
          const response = await fetchWithTimeout(url, 1000);
          return response.json();
        })
      );

      const validatedRewards = RewardsResponseSchema.parse(rewards);

      return {
        ...validator,
        rewards: validatedRewards.rewards
          .filter((reward) => reward.denom === validatedConfig.DENOM)
          .reduce((acc, reward) => acc + Number(reward.amount), 0),
      };
    })
  );

  if (validators.length === 0) {
    throw new Error("No validators found");
  }

  console.debug(`Found ${validators.length} validators`);

  // Get the validator with the lowest staking amount
  const lowestStakingValidator = validators.sort(
    (a, b) => a.stakingAmount - b.stakingAmount
  )[0];

  if (!lowestStakingValidator) {
    throw new Error("No validators found");
  }

  // Claim all rewards > MIN_REWARD_AMOUNT
  const rewardsToClaim = validators.filter(
    (validator) => validator.rewards > validatedConfig.MIN_REWARD_AMOUNT
  );

  console.debug(
    `Rewards to claim: ${formatNumber(
      rewardsToClaim.reduce((acc, validator) => acc + validator.rewards, 0)
    )} ${validatedConfig.DENOM} considering min reward amount of ${formatNumber(
      validatedConfig.MIN_REWARD_AMOUNT
    )} ${validatedConfig.DENOM}`
  );

  // Claim rewards
  await Promise.allSettled(
    rewardsToClaim.map(async (validator) => {
      // Wait 1 second
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const tx = await client.withdrawRewards(
        validator.delegatorAddress,
        validator.validatorAddress,
        "auto"
      );
      console.debug(`Claiming ${validator.delegatorAddress}`, tx);
    })
  );

  // Get total available (not staked) ATOMS - after rewards are claimed
  const totalAvailable = await Promise.all(
    accounts.map(async (account) => {
      const balance = await client.getBalance(account, validatedConfig.DENOM);
      return Number(balance.amount);
    })
  ).then((balances) => {
    return balances.reduce((acc, amount) => acc + amount, 0);
  });

  console.debug(
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
  console.debug(
    `Restaking ${formatNumber(amountToStake)} ${validatedConfig.DENOM} to ${
      lowestStakingValidator.validatorAddress
    }`
  );
  // TODO: Restake to lowest staking validator

  client.disconnect();
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

main()
  .catch((message) => console.debug(message))
  .finally(() => client && client.disconnect());
