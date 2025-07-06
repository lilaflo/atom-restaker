import "dotenv/config";
import { DirectSecp256k1HdWallet, AccountData } from "@cosmjs/proto-signing";
import { sendDiscordNotification } from "./notify";
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

// Add Node.js fetch polyfill for older Node versions
import fetch from "node-fetch";

// German number formatting utility
function formatNumberDE(value: number): string {
  return new Intl.NumberFormat("de-DE").format(value);
}

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

const {
  MNEMONIC,
  RPC_URL,
  DELEGATOR_ADDRESS,
  DENOM,
  RESERVE,
  MIN_RESTAKE_AMOUNT,
  MIN_REWARD_AMOUNT,
  GAS_PRICE,
  PREFIX,
} = env;

// LCD endpoints for reward fetching with fallback
const LCD_ENDPOINTS = [
  "https://cosmoshub.lava.build",
  "https://api.cosmos.network",
  "https://lcd-cosmoshub.keplr.app",
  "https://rest.cosmos.directory/cosmoshub",
  "https://cosmos-rest.publicnode.com",
];

class RestakeBot {
  private client: SigningStargateClient | null = null;
  private wallet: DirectSecp256k1HdWallet | null = null;
  private account: AccountData | null = null;

  async initialize(): Promise<boolean> {
    try {
      this.wallet = await DirectSecp256k1HdWallet.fromMnemonic(MNEMONIC, {
        prefix: PREFIX,
      });
      const accounts = await this.wallet.getAccounts();
      this.account = accounts[0] || null;

      const gasPrice = GasPrice.fromString(GAS_PRICE);
      this.client = await SigningStargateClient.connectWithSigner(
        RPC_URL,
        this.wallet,
        { gasPrice }
      );

      if (this.account) {
        sendDiscordNotification(`🚀 Connected to ${this.account.address}`);
      }
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

  private async fetchWithTimeout(
    url: string,
    timeoutMs: number = 10000
  ): Promise<any> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Request timeout")), timeoutMs);
    });

    const fetchPromise = fetch(url, {
      headers: {
        "User-Agent": "RestakeBot/1.0",
        Accept: "application/json",
      },
    });

    return Promise.race([fetchPromise, timeoutPromise]);
  }

  async getRewardAmount(validatorAddress: string): Promise<number> {
    const url = `/cosmos/distribution/v1beta1/delegators/${DELEGATOR_ADDRESS}/rewards/${validatorAddress}`;

    // Try LCD endpoints first
    for (let i = 0; i < LCD_ENDPOINTS.length; i++) {
      const baseUrl = LCD_ENDPOINTS[i]!;
      const fullUrl = `${baseUrl.replace(/\/$/, "")}${url}`;

      try {
        const response = await this.fetchWithTimeout(fullUrl);

        if (response.status === 403) {
          sendDiscordNotification(
            `⚠️ 403 Forbidden from ${baseUrl}, trying next endpoint...`
          );
          continue; // Try next endpoint silently
        }

        if (!response.ok) {
          sendDiscordNotification(
            `⚠️ ${response.status} from ${baseUrl}, trying next endpoint...`
          );
          continue; // Try next endpoint silently
        }

        const data = (await response.json()) as {
          rewards?: { denom: string; amount: string }[];
        };

        if (!data?.rewards) {
          sendDiscordNotification(
            `⚠️ No rewards data from ${baseUrl}, trying next endpoint...`
          );
          continue;
        }

        const atomReward = parseInt(
          data.rewards.find((r) => r.denom === DENOM)?.amount || "0",
          10
        );

        return isNaN(atomReward) ? 0 : atomReward;
      } catch (error) {
        // Add exponential backoff delay before trying the next endpoint
        if (i < LCD_ENDPOINTS.length - 1) {
          const delay = Math.min(1000 * Math.pow(2, i), 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        sendDiscordNotification(
          `⚠️ Error from ${baseUrl}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
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
          validatorReward.reward.find((r: any) => r.denom === DENOM)?.amount ||
            "0",
          10
        );
        return isNaN(atomReward) ? 0 : atomReward;
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

  async claimAllRewards(
    delegations: DelegationResponse[]
  ): Promise<ClaimResult[]> {
    // Calculate total rewards first
    let totalReward = 0;
    for (const delegation of delegations) {
      const rewardAmount = await this.getRewardAmount(
        delegation.delegation.validatorAddress
      );
      totalReward += rewardAmount;
    }

    if (totalReward < parseInt(MIN_RESTAKE_AMOUNT, 10)) {
      sendDiscordNotification(
        `⏸️ Total rewards (${formatNumberDE(
          totalReward
        )} uatom) below minimum threshold. Skipping claims.`
      );
      return [];
    }

    sendDiscordNotification(
      `📥 Claiming ${formatNumberDE(totalReward)} uatom in rewards...`
    );

    const results: ClaimResult[] = [];

    for (const delegation of delegations) {
      const validator = delegation.delegation.validatorAddress;
      const rewardAmount = await this.getRewardAmount(validator);

      if (rewardAmount < parseInt(MIN_REWARD_AMOUNT, 10)) {
        sendDiscordNotification(
          `⏩ Skipping ${validator}: Individual reward ${formatNumberDE(
            rewardAmount
          )} uatom is below threshold (${formatNumberDE(
            parseInt(MIN_REWARD_AMOUNT, 10)
          )} uatom)`
        );
        continue; // Skip claiming this validator
      }

      // Add delay between transactions to avoid sequence conflicts
      if (results.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
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
          await new Promise((resolve) => setTimeout(resolve, 5000));
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
        balances.find((b) => b.denom === DENOM)?.amount || "0",
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
        { denom: DENOM, amount: amount.toString() },
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
  }

  async run(): Promise<void> {
    try {
      if (!(await this.initialize())) return;

      const delegations = await this.getDelegations();
      if (delegations.length === 0) {
        sendDiscordNotification("❌ No delegations found.");
        return;
      }

      const atomBalance = await this.getBalance();
      sendDiscordNotification(
        `Available ATOM: ${formatNumberDE(atomBalance)} uatom`
      );

      // Calculate total rewards
      let totalRewards = 0;
      for (const delegation of delegations) {
        const reward = await this.getRewardAmount(
          delegation.delegation.validatorAddress
        );
        totalRewards += reward;
      }
      sendDiscordNotification(
        `📦 Total rewards: ${formatNumberDE(totalRewards)} uatom`
      );

      const totalAvailable = atomBalance + totalRewards;
      sendDiscordNotification(
        `🔍 Total available (balance + rewards): ${formatNumberDE(
          totalAvailable
        )} uatom`
      );

      if (totalAvailable <= parseInt(RESERVE, 10)) {
        sendDiscordNotification(
          `⏸️ Total available (${formatNumberDE(
            totalAvailable
          )} uatom) ≤ reserve (${formatNumberDE(
            parseInt(RESERVE, 10)
          )} uatom). Nothing to restake.`
        );
        return;
      }

      // Claim rewards
      await this.claimAllRewards(delegations);

      // Get updated balance and rewards after claiming
      const updatedBalance = await this.getBalance();
      const updatedRewards = await this.getTotalRewards(delegations);
      const totalAfterClaim = updatedBalance + updatedRewards;
      sendDiscordNotification(`💰 Post-claim total (balance + rewards): ${formatNumberDE(totalAfterClaim)} uatom`);

      const stakeable = totalAfterClaim - parseInt(RESERVE, 10);

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
        sendDiscordNotification("❌ No validator found for restaking.");
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
    } catch (error) {
      sendDiscordNotification(
        "❌ Error in main execution:" +
          (error instanceof Error ? error.message : String(error))
      );
    } finally {
      await this.disconnect();
    }
  }

  private async getTotalRewards(delegations: DelegationResponse[]): Promise<number> {
    let total = 0;
    for (const delegation of delegations) {
      const reward = await this.getRewardAmount(delegation.delegation.validatorAddress);
      total += reward;
    }
    return total;
  }
}

// Main execution function
async function main(): Promise<void> {
  sendDiscordNotification("🚀 Starting restake bot execution...");
  const bot = new RestakeBot();
  await bot.run();
  sendDiscordNotification("✅ Restake bot execution completed");
  process.exit(0);
}

// Export function for external use (e.g., by supercronic)
export async function runRestakeBot(): Promise<void> {
  sendDiscordNotification("🚀 Starting restake bot execution...");
  const bot = new RestakeBot();
  await bot.run();
  sendDiscordNotification("✅ Restake bot execution completed");
}

// Graceful shutdown handlers
process.on("SIGTERM", () => {
  sendDiscordNotification("🛑 Received SIGTERM, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  sendDiscordNotification("🛑 Received SIGINT, shutting down gracefully...");
  process.exit(0);
});

// Error handlers
process.on(
  "unhandledRejection",
  (reason: unknown, promise: Promise<unknown>) => {
    console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
    process.exit(1);
  }
);

process.on("uncaughtException", (error: Error) => {
  sendDiscordNotification(`❌ Uncaught Exception: ${error.message}`);
  process.exit(1);
});

// Only run main if this file is executed directly
if (require.main === module) {
  main().catch((e: unknown) => {
    sendDiscordNotification(
      "❌ Fatal error:" + (e instanceof Error ? e.message : String(e))
    );
    process.exit(1);
  });
}
