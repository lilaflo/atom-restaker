import { Validator, ValidatorInfoSchema } from "../types";
import { fetchWithTimeout, returnFirst } from "../utils";

/**
 * Fetches validator metadata (jailed status, bonding status, commission)
 */
export async function fetchValidatorInfo(
  lcdEndpoints: readonly string[],
  validatorAddress: string
): Promise<{
  jailed: boolean;
  status: string;
  commission: number;
}> {
  const validatorInfoUrls = lcdEndpoints.map(
    (endpoint) =>
      `${endpoint}/cosmos/staking/v1beta1/validators/${validatorAddress}`
  );

  try {
    const validatorInfoResponse = await returnFirst(
      validatorInfoUrls.map(async (url) => {
        const response = await fetchWithTimeout(url, 1000);
        return response.json();
      })
    );

    const validatorInfo = ValidatorInfoSchema.parse(validatorInfoResponse);
    return {
      jailed: validatorInfo.validator.jailed,
      status: validatorInfo.validator.status,
      commission: Number(validatorInfo.validator.commission.commission_rates.rate),
    };
  } catch (error) {
    console.warn(`Failed to fetch validator info for ${validatorAddress}:`, error);
    return {
      jailed: false,
      status: "UNKNOWN",
      commission: 0,
    };
  }
}

/**
 * Enriches validators with metadata (jailed, status, commission)
 */
export async function enrichValidatorsWithMetadata(
  validators: Validator[],
  lcdEndpoints: readonly string[]
): Promise<Validator[]> {
  return Promise.all(
    validators.map(async (validator) => {
      const info = await fetchValidatorInfo(lcdEndpoints, validator.validatorAddress);
      return {
        ...validator,
        jailed: info.jailed,
        status: info.status,
        commission: info.commission,
      };
    })
  );
}

/**
 * Filters out jailed and inactive validators
 */
export function filterActiveValidators(validators: Validator[]): Validator[] {
  return validators.filter((v) => {
    const isActive = !v.jailed && v.status === "BOND_STATUS_BONDED";
    if (!isActive) {
      console.log(
        `Skipping validator ${v.validatorAddress}: jailed=${v.jailed}, status=${v.status}`
      );
    }
    return isActive;
  });
}

/**
 * Finds the validator with the lowest staking amount
 */
export function findLowestStakingValidator(validators: Validator[]): Validator {
  if (validators.length === 0) {
    throw new Error("No validators provided");
  }

  return validators.reduce((min, v) =>
    v.stakingAmount < min.stakingAmount ? v : min
  );
}
