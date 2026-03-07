import { SigningStargateClient } from "@cosmjs/stargate";

/**
 * Fetches the balance of a specific denomination for an account
 */
export async function getBalance(
  client: SigningStargateClient,
  account: string,
  denom: string
): Promise<number> {
  const balance = await client.getBalance(account, denom);
  return Number(balance.amount);
}

/**
 * Calculates the amount available for staking after reserve
 */
export function calculateStakingAmount(
  totalAvailable: number,
  reserve: number
): number {
  return totalAvailable - reserve;
}

/**
 * Checks if there is enough balance to stake
 */
export function shouldRestake(
  totalAvailable: number,
  minRestakeAmount: number,
  reserve: number
): boolean {
  return totalAvailable >= minRestakeAmount + reserve;
}
