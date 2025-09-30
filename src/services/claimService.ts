import { SigningStargateClient } from "@cosmjs/stargate";
import { Validator } from "../types";

/**
 * Filters validators that have rewards above the minimum threshold
 */
export function filterValidatorsWithRewards(
  validators: Validator[],
  minRewardAmount: number
): Validator[] {
  return validators.filter((validator) => validator.rewards > minRewardAmount);
}

/**
 * Calculates the total sum of rewards from validators
 */
export function calculateTotalRewards(validators: Validator[]): number {
  return validators.reduce((acc, validator) => acc + validator.rewards, 0);
}

/**
 * Claims rewards from a list of validators with a delay between claims
 */
export async function claimRewards(
  client: SigningStargateClient,
  validators: Validator[],
  delayMs: number = 1000
): Promise<void> {
  await Promise.allSettled(
    validators.map(async (validator) => {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      await client.withdrawRewards(
        validator.delegatorAddress,
        validator.validatorAddress,
        "auto"
      );
    })
  );
}
