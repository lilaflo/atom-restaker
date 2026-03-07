import { RewardsResponseSchema, Validator } from "../types";
import { queryLcd } from "../utils";

/**
 * Fetches rewards for a specific validator delegation
 */
export async function fetchRewards(
  lcdEndpoints: readonly string[],
  delegatorAddress: string,
  validatorAddress: string
): Promise<any> {
  const path = `/cosmos/distribution/v1beta1/delegators/${delegatorAddress}/rewards/${validatorAddress}`;
  const rewards = await queryLcd(lcdEndpoints, path);

  return RewardsResponseSchema.parse(rewards);
}

/**
 * Calculates total reward amount for a specific denomination
 */
export function calculateRewardAmount(
  rewardsResponse: any,
  denom: string
): number {
  const validatedRewards = RewardsResponseSchema.parse(rewardsResponse);
  return validatedRewards.rewards
    .filter((reward) => reward.denom === denom)
    .reduce((acc, reward) => acc + Number(reward.amount), 0);
}

/**
 * Enriches validators with reward information
 */
export async function enrichValidatorsWithRewards(
  validators: Validator[],
  lcdEndpoints: readonly string[],
  denom: string
): Promise<Validator[]> {
  return Promise.all(
    validators.map(async (validator) => {
      try {
        const path = `/cosmos/distribution/v1beta1/delegators/${validator.delegatorAddress}/rewards/${validator.validatorAddress}`;
        const rewards = await queryLcd(lcdEndpoints, path);
        const rewardAmount = calculateRewardAmount(rewards, denom);

        return {
          ...validator,
          rewards: rewardAmount,
        };
      } catch (error) {
        console.warn(
          `Failed to fetch rewards for ${validator.validatorAddress}:`,
          error
        );
        return validator;
      }
    })
  );
}
