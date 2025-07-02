import "dotenv/config";
import { DirectSecp256k1HdWallet, AccountData } from "@cosmjs/proto-signing";
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

// Environment variable validation
let env: ReturnType<typeof validateEnvironmentVariables>;
try {
  env = validateEnvironmentVariables();
} catch (error) {
  console.error("❌", error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const {
  MNEMONIC,
  RPC_URL,
  DELEGATOR_ADDRESS,
  REST_URL,
  DENOM,
  RESERVE,
  MIN_RESTAKE_AMOUNT,
  MIN_REWARD_AMOUNT,
  GAS_PRICE,
  PREFIX,
} = env;

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
        console.log(`🚀 Connected to ${this.account.address}`);
      }
      return true;
    } catch (error) {
      console.error(
        "❌ Failed to initialize client:",
        error instanceof Error ? error.message : String(error)
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
      console.error(
        "❌ Failed to fetch delegations:",
        error instanceof Error ? error.message : String(error)
      );
      return [];
    }
  }

  async getRewardAmount(validatorAddress: string): Promise<number> {
    // Multiple fallback LCD endpoints to avoid rate limiting
    const lcdEndpoints = [
      REST_URL,
      "https://cosmoshub.lava.build",
      "https://api.cosmos.network",
      "https://lcd-cosmoshub.keplr.app",
      "https://rest.cosmos.directory/cosmoshub",
      "https://cosmos-rest.publicnode.com",
    ];

    for (let i = 0; i < lcdEndpoints.length; i++) {
      const baseUrl = lcdEndpoints[i]!;
      const url = `${baseUrl.replace(
        /\/$/,
        ""
      )}/cosmos/distribution/v1beta1/delegators/${DELEGATOR_ADDRESS}/rewards/${validatorAddress}`;

      try {
        console.log(`🔍 Trying to get rewards from: ${baseUrl}`);

        // Use a simple timeout approach compatible with node-fetch v2
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Request timeout")), 10000);
        });

        const fetchPromise = fetch(url, {
          headers: {
            "User-Agent": "RestakeBot/1.0",
            Accept: "application/json",
          },
        });

        const response = (await Promise.race([
          fetchPromise,
          timeoutPromise,
        ])) as any;

        if (response.status === 403) {
          console.log(
            `⚠️ 403 Forbidden from ${baseUrl}, trying next endpoint...`
          );
          // Add exponential backoff delay before trying the next endpoint
          if (i < lcdEndpoints.length - 1) {
            const delay = Math.min(1000 * Math.pow(2, i), 5000); // Max 5 seconds
            console.log(`⏳ Waiting ${delay}ms before next attempt...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
          continue;
        }

        if (!response.ok) {
          console.log(
            `⚠️ HTTP ${response.status} from ${baseUrl}, trying next endpoint...`
          );
          // Add exponential backoff delay before trying the next endpoint
          if (i < lcdEndpoints.length - 1) {
            const delay = Math.min(1000 * Math.pow(2, i), 5000); // Max 5 seconds
            console.log(`⏳ Waiting ${delay}ms before next attempt...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
          continue;
        }

        const data = (await response.json()) as {
          rewards?: { denom: string; amount: string }[];
        };

        if (!data || !data.rewards) {
          console.log(`ℹ️ No rewards data from ${baseUrl}`);
          continue;
        }

        const atomReward = parseInt(
          data.rewards.find((r) => r.denom === DENOM)?.amount || "0",
          10
        );

        const reward = isNaN(atomReward) ? 0 : atomReward;
        console.log(
          `✅ Successfully got rewards from ${baseUrl}: ${reward} uatom`
        );
        return reward;
      } catch (error) {
        if (error instanceof Error && error.message === "Request timeout") {
          console.log(`⏰ Timeout from ${baseUrl}, trying next endpoint...`);
        } else {
          console.log(
            `⚠️ Error from ${baseUrl}:`,
            error instanceof Error ? error.message : String(error)
          );
        }
        // Add exponential backoff delay before trying the next endpoint
        if (i < lcdEndpoints.length - 1) {
          const delay = Math.min(1000 * Math.pow(2, i), 5000); // Max 5 seconds
          console.log(`⏳ Waiting ${delay}ms before next attempt...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        continue;
      }
    }

    // If all endpoints fail, try using the RPC client as fallback
    console.log("🔄 All LCD endpoints failed, trying RPC client fallback...");
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

      if (validatorReward && validatorReward.reward) {
        const atomReward = parseInt(
          validatorReward.reward.find((r: any) => r.denom === DENOM)?.amount ||
            "0",
          10
        );
        const reward = isNaN(atomReward) ? 0 : atomReward;
        console.log(`✅ Successfully got rewards via RPC: ${reward} uatom`);
        return reward;
      }
    } catch (rpcError) {
      console.log(
        "⚠️ RPC fallback also failed:",
        rpcError instanceof Error ? rpcError.message : String(rpcError)
      );
    }

    console.error(
      `❌ Failed to get rewards for ${validatorAddress} from all endpoints`
    );
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
    console.log("📥 Claiming rewards sequentially...");

    const results: ClaimResult[] = [];
    for (const delegation of delegations) {
      const validator = delegation.delegation.validatorAddress;
      const rewardAmount = await this.getRewardAmount(validator);

      if (rewardAmount < MIN_REWARD_AMOUNT) {
        console.log(
          `⏩ Skipping ${validator}: Reward (${rewardAmount} uatom) < 0.5 ATOM`
        );
        continue;
      }

      console.log(
        `🔄 Claiming rewards from ${validator} (${rewardAmount} uatom)...`
      );

      // Add a small delay between transactions to avoid sequence conflicts
      if (results.length > 0) {
        console.log("⏳ Waiting 2 seconds before next transaction...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      const result = await this.claimReward(validator);
      if (result.success) {
        console.log(`✅ Successfully claimed rewards from ${validator}`);
      } else {
        console.error(`⚠️ Error claiming from ${validator}:`, result.error);
        // If we get a sequence mismatch, wait longer and try to refresh the client
        if (result.error?.includes("account sequence mismatch")) {
          console.log("🔄 Sequence mismatch detected, refreshing client...");
          await this.disconnect();
          await new Promise((resolve) => setTimeout(resolve, 5000));
          if (!(await this.initialize())) {
            console.error(
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
    console.log(
      `📊 Rewards claiming completed: ${successful} successful, ${failed} failed`
    );

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
      console.error(
        "❌ Failed to get balance:",
        error instanceof Error ? error.message : String(error)
      );
      return 0;
    }
  }

  findMinDelegation(
    delegations: DelegationResponse[]
  ): DelegationResponse | null {
    if (delegations.length === 0) return null;

    return delegations.reduce(
      (
        min: DelegationResponse,
        current: DelegationResponse
      ): DelegationResponse => {
        return BigInt(current.balance.amount) < BigInt(min.balance.amount)
          ? current
          : min;
      }
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
      console.error(
        "❌ Failed to delegate tokens:",
        error instanceof Error ? error.message : String(error)
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
      // Initialize connection
      if (!(await this.initialize())) {
        return;
      }

      // Get delegations
      const delegations = await this.getDelegations();
      if (delegations.length === 0) {
        console.log("❌ No delegations found.");
        return;
      }

      // Claim rewards
      await this.claimAllRewards(delegations);

      // Check balance for restaking
      const atomBalance = await this.getBalance();
      const stakeAmount = atomBalance - RESERVE;

      if (stakeAmount <= 0) {
        console.log("❌ Not enough ATOM available for restaking.");
        return;
      }

      if (stakeAmount < MIN_RESTAKE_AMOUNT) {
        console.log(
          `⏸️ Stake amount ${stakeAmount} uatom is less than 0.5 ATOM. Operation cancelled.`
        );
        return;
      }

      // Find validator with minimum delegation
      const minDelegation = this.findMinDelegation(delegations);
      if (!minDelegation) {
        console.log("❌ No valid delegation found for restaking.");
        return;
      }

      const targetValidator = minDelegation.delegation.validatorAddress;
      console.log(
        `📤 Delegating ${stakeAmount} uatom to validator ${targetValidator}`
      );

      // Delegate tokens
      const success = await this.delegateTokens(targetValidator, stakeAmount);
      if (success) {
        console.log("✅ Successfully restaked.");
      } else {
        console.log("❌ Failed to restake.");
      }
    } catch (error) {
      console.error(
        "❌ Error in main execution:",
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      await this.disconnect();
    }
  }
}

// Main execution - only runs when called directly (not by supercronic)
async function main(): Promise<void> {
  console.log("🚀 Starting restake bot execution...");
  const bot = new RestakeBot();
  await bot.run();
  console.log("✅ Restake bot execution completed");
  process.exit(0);
}

// Separate function for running the restake bot (called by supercronic)
export async function runRestakeBot(): Promise<void> {
  console.log("🚀 Starting restake bot execution...");
  const bot = new RestakeBot();
  await bot.run();
  console.log("✅ Restake bot execution completed");
}

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 Received SIGINT, shutting down gracefully...");
  process.exit(0);
});

// Handle unhandled promise rejections
process.on(
  "unhandledRejection",
  (reason: unknown, promise: Promise<unknown>) => {
    console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
    process.exit(1);
  }
);

// Handle uncaught exceptions
process.on("uncaughtException", (error: Error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

// Only run main if this file is executed directly (not imported)
if (require.main === module) {
  main().catch((e: unknown) => {
    console.error(
      "❌ Fatal error:",
      e instanceof Error ? e.message : String(e)
    );
    process.exit(1);
  });
}
