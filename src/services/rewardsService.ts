import { RewardsResponseSchema, Validator } from "../types";
import { fetchWithTimeout, returnFirst } from "../utils";

/**
 * Fetches rewards for a specific validator delegation
 */
export async function fetchRewards(
  lcdEndpoints: readonly string[],
  delegatorAddress: string,
  validatorAddress: string
): Promise<any> {
  const rewardUrls = lcdEndpoints.map(
    (endpoint) =>
      `${endpoint}/cosmos/distribution/v1beta1/delegators/${delegatorAddress}/rewards/${validatorAddress}`
  );

  const rewards = await returnFirst(
    rewardUrls.map(async (url) => {
      const response = await fetchWithTimeout(url, 1000);
      return response.json();
    })
  );

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
        const rewardUrls = lcdEndpoints.map(
          (endpoint) =>
            `${endpoint}/cosmos/distribution/v1beta1/delegators/${validator.delegatorAddress}/rewards/${validator.validatorAddress}`
        );

        const rewards = await returnFirst(
          rewardUrls.map(async (url) => {
            const response = await fetchWithTimeout(url, 1000);
            return response.json();
          })
        );

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
