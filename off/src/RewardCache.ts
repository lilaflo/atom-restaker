import { CONFIG } from "./config";

// Cache for reward amounts to avoid redundant API calls
export class RewardCache {
  private cache = new Map<string, { amount: number; timestamp: number }>();
  private readonly TTL = CONFIG.REWARD_CACHE_TTL;

  get(validatorAddress: string): number | null {
    const cached = this.cache.get(validatorAddress);
    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.amount;
    }
    return null;
  }

  set(validatorAddress: string, amount: number): void {
    this.cache.set(validatorAddress, { amount, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}
