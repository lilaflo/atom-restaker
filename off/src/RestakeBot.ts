import { DirectSecp256k1HdWallet, AccountData } from "@cosmjs/proto-signing";
import { sendDiscordNotification, sendCriticalNotification } from "./notify";
import {
  assertIsDeliverTxSuccess,
  SigningStargateClient,
  DeliverTxResponse,
} from "@cosmjs/stargate";
import { GasPrice } from "@cosmjs/stargate";
import {
  DelegationResponse,
  DelegationsResponse,
  ClaimResult,
  validateEnvironmentVariables,
} from "./types";
import { PerformanceMonitor } from "./PerformanceMonitor";
import { ErrorHandler } from "./ErrorHandler";
import { Validator } from "./Validator";
import { formatNumberDE, logMemoryUsage } from "./utils";
import { CONFIG } from "./config";
import { RewardCache } from "./RewardCache";

// Add Node.js fetch polyfill for older Node versions
import fetch from "node-fetch";

// Environment variable validation
const env = (() => {
  try {
    return validateEnvironmentVariables();
  } catch (error) {
    sendDiscordNotification(
      "❌ Configuration error: " +
        (error instanceof Error ? error.message : String(error))
    );
    process.exit(1);
  }
})();

const { MNEMONIC, DELEGATOR_ADDRESS } = env;

export class RestakeBot {
  private client: SigningStargateClient | null = null;
  private wallet: DirectSecp256k1HdWallet | null = null;
  private account: AccountData | null = null;
  private rewardCache = new RewardCache();
  private isInitialized = false;

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      this.wallet = await DirectSecp256k1HdWallet.fromMnemonic(MNEMONIC, {
        prefix: CONFIG.PREFIX,
      });
      const accounts = await this.wallet.getAccounts();
      this.account = accounts[0] || null;

      const gasPrice = GasPrice.fromString(CONFIG.GAS_PRICE);
      this.client = await SigningStargateClient.connectWithSigner(
        CONFIG.RPC_URL,
        this.wallet,
        { gasPrice }
      );

      if (this.account) {
        sendDiscordNotification(
          `🚀 Connected to ${this.account.address.slice(0, 10)}...`
        );
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      sendDiscordNotification(
        "❌ Failed to initialize client: " +
          (error instanceof Error ? error.message : String(error))
      );
      return false;
    }
  }

  async getDelegations(): Promise<DelegationResponse[]> {
    if (!this.client) {
      throw new Error("Client not initialized");
    }

    try {
      const delegations = await (
        this.client as any
      ).queryClient.staking.delegatorDelegations(DELEGATOR_ADDRESS);
      return (delegations as DelegationsResponse).delegationResponses || [];
    } catch (error) {
      sendDiscordNotification(
        "❌ Failed to fetch delegations:" +
          (error instanceof Error ? error.message : String(error))
      );
      return [];
    }
  }





  async getRewardAmount(validatorAddress: string): Promise<number> {
    // Check cache first
    const cached = this.rewardCache.get(validatorAddress);
    if (cached !== null) {
      return cached;
    }

    const url = `/cosmos/distribution/v1beta1/delegators/${DELEGATOR_ADDRESS}/rewards/${validatorAddress}`;

    // Try LCD endpoints with retry logic
    for (let i = 0; i < CONFIG.LCD_ENDPOINTS.length; i++) {
      const baseUrl = CONFIG.LCD_ENDPOINTS[i]!;
      const fullUrl = `${baseUrl.replace(/\/$/, "")}${url}`;

      try {
        const response = await this.fetchWithRetry(() =>
          this.fetchWithTimeout(fullUrl)
        );

        if (response.status === 403) {
          continue; // Try next endpoint silently
        }

        if (!response.ok) {
          continue; // Try next endpoint silently
        }

        const data = (await response.json()) as {
          rewards?: { denom: string; amount: string }[];
        };

        if (!data?.rewards) {
          continue;
        }

        const atomReward = parseInt(
          data.rewards.find((r) => r.denom === CONFIG.DENOM)?.amount || "0",
          10
        );

        const result = isNaN(atomReward) ? 0 : atomReward;
        this.rewardCache.set(validatorAddress, result);
        return result;
      } catch {
        if (i < CONFIG.LCD_ENDPOINTS.length - 1) {
          const delay = Math.min(1000 * Math.pow(2, i), 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        continue;
      }
    }

    // Fallback to RPC client
    try {
      if (!this.client) {
        throw new Error("Client not initialized");
      }

      const rewards = await (
        this.client as any
      ).queryClient.distribution.delegationTotalRewards(DELEGATOR_ADDRESS);

      const validatorReward = rewards.rewards?.find(
        (r: any) => r.validatorAddress === validatorAddress
      );

      if (validatorReward?.reward) {
        const atomReward = parseInt(
          validatorReward.reward.find((r: any) => r.denom === CONFIG.DENOM)
            ?.amount || "0",
          10
        );
        const result = isNaN(atomReward) ? 0 : atomReward;
        this.rewardCache.set(validatorAddress, result);
        return result;
      }
    } catch (rpcError) {
      sendDiscordNotification(
        "⚠️ All reward fetching methods failed: " +
          (rpcError instanceof Error ? rpcError.message : String(rpcError))
      );
    }

    return 0;
  }

  async claimReward(validatorAddress: string): Promise<ClaimResult> {
    if (!this.client) {
      throw new Error("Client not initialized");
    }

    try {
      const tx: DeliverTxResponse = await this.client.withdrawRewards(
        DELEGATOR_ADDRESS,
        validatorAddress,
        "auto",
        "auto"
      );
      assertIsDeliverTxSuccess(tx);
      return { success: true, validator: validatorAddress };
    } catch (error) {
      return {
        success: false,
        validator: validatorAddress,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async getRewardsForValidators(
    delegations: DelegationResponse[]
  ): Promise<{ validator: string; rewardAmount: number }[]> {
    // Process rewards in parallel for better performance
    const rewardPromises = delegations.map(async (delegation) => {
      const validator = delegation.delegation.validatorAddress;
      const rewardAmount = await this.getRewardAmount(validator);
      return { validator, rewardAmount };
    });

    return await Promise.all(rewardPromises);
  }

  async claimAllRewards(
    delegations: DelegationResponse[]
  ): Promise<ClaimResult[]> {
    const rewards = await this.getRewardsForValidators(delegations);

    // Filter eligible validators
    const eligibleValidators = rewards.filter(
      ({ rewardAmount }) => rewardAmount >= CONFIG.MIN_REWARD_AMOUNT
    );

    const totalEligibleReward = eligibleValidators.reduce(
      (sum, { rewardAmount }) => sum + rewardAmount,
      0
    );

    // Log skipped validators
    const skippedValidators = rewards.filter(
      ({ rewardAmount }) => rewardAmount < CONFIG.MIN_REWARD_AMOUNT
    );

    for (const { validator, rewardAmount } of skippedValidators) {
      sendDiscordNotification(
        `⏩ Skipping ${validator}: Reward ${formatNumberDE(
          rewardAmount
        )} uatom is below threshold (${formatNumberDE(
          CONFIG.MIN_REWARD_AMOUNT
        )} uatom)`
      );
    }

    // Check claim threshold
    const claimThreshold = CONFIG.GAS_ESTIMATE * CONFIG.MIN_FACTOR;

    if (totalEligibleReward < claimThreshold) {
      sendDiscordNotification(
        `⏸️ Skipping claim: total reward (${formatNumberDE(
          totalEligibleReward
        )} uatom) < ${formatNumberDE(claimThreshold)} uatom threshold (gas * ${
          CONFIG.MIN_FACTOR
        })`
      );
      return [];
    }

    // Check restake threshold
    if (totalEligibleReward < CONFIG.MIN_RESTAKE_AMOUNT) {
      sendDiscordNotification(
        `⏸️ Total eligible rewards (${formatNumberDE(
          totalEligibleReward
        )} uatom) below minimum restake threshold (${formatNumberDE(
          CONFIG.MIN_RESTAKE_AMOUNT
        )} uatom).`
      );
      return [];
    }

    sendDiscordNotification(
      `📥 Claiming ${formatNumberDE(totalEligibleReward)} uatom in rewards...`
    );

    const results: ClaimResult[] = [];
    for (const { validator, rewardAmount } of eligibleValidators) {
      // Add delay between transactions to avoid sequence conflicts
      if (results.length > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, CONFIG.TRANSACTION_DELAY)
        );
      }

      // Send notification before claiming
      sendDiscordNotification(`⏳ Claiming reward from ${validator}...`);
      const result = await this.claimReward(validator);

      // Always send claim result (raw)
      sendDiscordNotification(
        `🧾 Claim result from ${validator}: ${JSON.stringify(result)}`
      );

      if (result.success) {
        sendDiscordNotification(
          `✅ Claimed ${formatNumberDE(rewardAmount)} uatom from ${validator}`
        );
      } else {
        sendDiscordNotification(
          `⚠️ Failed to claim from ${validator}: ${result.error}`
        );

        // Handle sequence mismatch
        if (result.error?.includes("account sequence mismatch")) {
          sendDiscordNotification(
            "🔄 Sequence mismatch detected, refreshing client..."
          );
          await this.disconnect();
          await new Promise((resolve) =>
            setTimeout(resolve, CONFIG.SEQUENCE_RETRY_DELAY)
          );
          if (!(await this.initialize())) {
            sendDiscordNotification(
              "❌ Failed to reinitialize client after sequence mismatch"
            );
            break;
          }
        }
      }

      results.push(result);
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    if (failed > 0) {
      sendDiscordNotification(
        `📊 Claims completed: ${formatNumberDE(
          successful
        )} successful, ${formatNumberDE(failed)} failed`
      );
    }

    return results;
  }

  async getBalance(): Promise<number> {
    if (!this.client) {
      throw new Error("Client not initialized");
    }

    try {
      const balances = await this.client.getAllBalances(DELEGATOR_ADDRESS);
      const atomBalance = parseInt(
        balances.find((b) => b.denom === CONFIG.DENOM)?.amount || "0",
        10
      );
      return isNaN(atomBalance) ? 0 : atomBalance;
    } catch (error) {
      sendDiscordNotification(
        "❌ Failed to get balance:" +
          (error instanceof Error ? error.message : String(error))
      );
      return 0;
    }
  }

  private findMinDelegation(
    delegations: DelegationResponse[]
  ): DelegationResponse | null {
    if (delegations.length === 0) return null;

    return delegations.reduce((min, current) =>
      BigInt(current.balance.amount) < BigInt(min.balance.amount)
        ? current
        : min
    );
  }

  async delegateTokens(
    validatorAddress: string,
    amount: number
  ): Promise<boolean> {
    if (!this.client) {
      throw new Error("Client not initialized");
    }

    try {
      const delegateTx: DeliverTxResponse = await this.client.delegateTokens(
        DELEGATOR_ADDRESS,
        validatorAddress,
        { denom: CONFIG.DENOM, amount: amount.toString() },
        "auto",
        "auto"
      );
      assertIsDeliverTxSuccess(delegateTx);
      return true;
    } catch (error) {
      sendDiscordNotification(
        "❌ Failed to delegate tokens:" +
          (error instanceof Error ? error.message : String(error))
      );
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.disconnect();
    }
    this.isInitialized = false;
    this.rewardCache.clear();
  }

  private async getTotalRewards(
    delegations: DelegationResponse[]
  ): Promise<number> {
    const rewards = await this.getRewardsForValidators(delegations);
    return rewards.reduce((sum, { rewardAmount }) => sum + rewardAmount, 0);
  }

  async run(): Promise<void> {
    const monitor = new PerformanceMonitor();
    monitor.start();

    try {
      // Validate configuration
      if (!Validator.isValidAddress(DELEGATOR_ADDRESS)) {
        throw new Error("Invalid delegator address format");
      }

      if (!(await this.initialize())) return;
      monitor.checkpoint("initialization");

      const delegations = await this.getDelegations();
      if (delegations.length === 0) {
        sendCriticalNotification("❌ No delegations found.");
        return;
      }
      monitor.checkpoint("delegations_fetch");

      const atomBalance = await this.getBalance();
      sendDiscordNotification(
        `Available ATOM: ${formatNumberDE(atomBalance)} uatom`
      );

      // Calculate total rewards
      const totalRewards = await this.getTotalRewards(delegations);
      sendDiscordNotification(
        `📦 Total rewards: ${formatNumberDE(totalRewards)} uatom`
      );
      monitor.checkpoint("rewards_calculation");

      const totalAvailable = atomBalance + totalRewards;
      sendDiscordNotification(
        `🔍 Total available (balance + rewards): ${formatNumberDE(
          totalAvailable
        )} uatom`
      );

      if (totalAvailable <= CONFIG.RESERVE) {
        sendDiscordNotification(
          `⏸️ Total available (${formatNumberDE(
            totalAvailable
          )} uatom) ≤ reserve (${formatNumberDE(
            CONFIG.RESERVE
          )} uatom). Nothing to restake.`
        );
        return;
      }

      // Claim rewards with retry logic
      await ErrorHandler.withRetry(
        () => this.claimAllRewards(delegations),
        3,
        2000
      );
      monitor.checkpoint("rewards_claim");

      // Get updated balance and rewards after claiming
      const updatedBalance = await this.getBalance();
      const updatedRewards = await this.getTotalRewards(delegations);
      const totalAfterClaim = updatedBalance + updatedRewards;
      sendDiscordNotification(
        `💰 Post-claim total (balance + rewards): ${formatNumberDE(
          totalAfterClaim
        )} uatom`
      );

      const stakeable = Validator.sanitizeAmount(
        totalAfterClaim - CONFIG.RESERVE
      );

      if (stakeable <= 0) {
        sendDiscordNotification(
          `⏸️ Insufficient balance for restaking after claims (${formatNumberDE(
            updatedBalance
          )} uatom).`
        );
        return;
      }

      // Find validator with minimum delegation
      const minDelegation = this.findMinDelegation(delegations);
      if (!minDelegation) {
        sendCriticalNotification("❌ No validator found for restaking.");
        return;
      }

      const targetValidator = minDelegation.delegation.validatorAddress;
      sendDiscordNotification(
        `📤 Delegating ${formatNumberDE(stakeable)} uatom to ${targetValidator}`
      );

      const success = await this.delegateTokens(targetValidator, stakeable);
      sendDiscordNotification(
        success ? "✅ Restake successful" : "❌ Restake failed"
      );
      monitor.checkpoint("delegation");

      // Log performance metrics
      monitor.logPerformance();
      logMemoryUsage();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      sendCriticalNotification(`❌ Error in main execution: ${errorMessage}`);

      // Log error details for debugging
      console.error("Detailed error:", error);
    } finally {
      await this.disconnect();
    }
  }
}
