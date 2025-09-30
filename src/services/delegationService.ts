import { SigningStargateClient } from "@cosmjs/stargate";
import { DelegationResponseSchema, Validator, ValidatorAddress } from "../types";

/**
 * Fetches all delegations for a given account
 */
export async function getDelegations(
  client: SigningStargateClient,
  account: string
): Promise<any[]> {
  const delegations = await (
    client as any
  ).queryClient.staking.delegatorDelegations(account);
  return delegations.delegationResponses;
}

/**
 * Parses raw delegation responses into Validator objects
 */
export function parseDelegations(
  delegationsRaw: any[]
): Validator[] {
  const validators: Validator[] = [];

  delegationsRaw.forEach((delegation) => {
    const { success, data } = DelegationResponseSchema.safeParse(delegation);
    if (success) {
      validators.push({
        validatorAddress: data.delegation
          .validatorAddress as ValidatorAddress,
        delegatorAddress: data.delegation.delegatorAddress,
        stakingAmount: Number(data.balance.amount),
        rewards: 0,
      });
    }
  });

  return validators;
}

/**
 * Fetches all delegations for multiple accounts and parses them
 */
export async function getAllDelegations(
  client: SigningStargateClient,
  accounts: string[]
): Promise<Validator[]> {
  const allDelegations = await Promise.all(
    accounts.map((account) => getDelegations(client, account))
  );

  const validators: Validator[] = [];
  allDelegations.forEach((delegations) => {
    delegations.forEach((delegation) => {
      const { success, data } = DelegationResponseSchema.safeParse(delegation);
      if (success) {
        validators.push({
          validatorAddress: data.delegation
            .validatorAddress as ValidatorAddress,
          delegatorAddress: data.delegation.delegatorAddress,
          stakingAmount: Number(data.balance.amount),
          rewards: 0,
        });
      }
    });
  });

  return validators;
}
