import { RestakeBot } from "../src/RestakeBot";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { SigningStargateClient, GasPrice } from "@cosmjs/stargate";
import {
  sendDiscordNotification,
  sendCriticalNotification,
} from "../src/notify";
import { CONFIG } from "../src/config";
import { RewardCache } from "../src/RewardCache";

// Mock dependencies
jest.mock("@cosmjs/proto-signing");
jest.mock("@cosmjs/stargate");
jest.mock("../src/notify");
jest.mock("../src/config");
jest.mock("../src/RewardCache");

// Mock environment validation to prevent process.exit
jest.mock("../src/types", () => ({
  validateEnvironmentVariables: jest.fn().mockReturnValue({
    MNEMONIC: "test mnemonic phrase",
    DELEGATOR_ADDRESS: "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  }),
  DelegationResponse: jest.fn(),
  DelegationsResponse: jest.fn(),
  ClaimResult: jest.fn(),
}));

// Mock node-fetch
jest.mock("node-fetch");
const mockFetch = require("node-fetch");

// Mock environment variables
const mockEnv = {
  MNEMONIC: "test mnemonic phrase",
  DELEGATOR_ADDRESS: "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
};

describe("RestakeBot", () => {
  let restakeBot: RestakeBot;
  let mockWallet: jest.Mocked<DirectSecp256k1HdWallet>;
  let mockClient: jest.Mocked<SigningStargateClient>;
  let mockRewardCache: jest.Mocked<RewardCache>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock wallet
    mockWallet = {
      getAccounts: jest
        .fn()
        .mockResolvedValue([
          { address: "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
        ]),
    } as any;

    (DirectSecp256k1HdWallet.fromMnemonic as jest.Mock).mockResolvedValue(
      mockWallet
    );

    // Mock client
    mockClient = {
      getAllBalances: jest.fn(),
      delegateTokens: jest.fn(),
      withdrawRewards: jest.fn(),
      disconnect: jest.fn(),
    } as any;

    // Mock query methods directly on client
    (mockClient as any).queryClient = {
      staking: {
        delegatorDelegations: jest.fn(),
      },
      distribution: {
        delegationTotalRewards: jest.fn(),
      },
    };

    (SigningStargateClient.connectWithSigner as jest.Mock).mockResolvedValue(
      mockClient
    );

    // Mock GasPrice
    (GasPrice.fromString as jest.Mock).mockReturnValue("0.025uatom");

    // Mock CONFIG
    (CONFIG as any) = {
      PREFIX: "cosmos",
      GAS_PRICE: "0.025uatom",
      RPC_URL: "https://rpc.test.com",
      DENOM: "uatom",
      MIN_REWARD_AMOUNT: 1000,
      GAS_ESTIMATE: 200000,
      MIN_FACTOR: 1.5,
      MIN_RESTAKE_AMOUNT: 50000,
      RESERVE: 1000000,
      LCD_ENDPOINTS: ["https://lcd.test.com"],
      REQUEST_TIMEOUT: 10000,
      MAX_RETRIES: 3,
      RETRY_DELAYS: [1000, 2000, 5000],
      TRANSACTION_DELAY: 1000,
      SEQUENCE_RETRY_DELAY: 2000,
    };

    // Mock RewardCache
    mockRewardCache = {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
    } as any;

    (RewardCache as jest.Mock).mockImplementation(() => mockRewardCache);

    restakeBot = new RestakeBot();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("initialize", () => {
    test("should initialize successfully with valid configuration", async () => {
      const result = await restakeBot.initialize();

      expect(result).toBe(true);
      expect(DirectSecp256k1HdWallet.fromMnemonic).toHaveBeenCalledWith(
        mockEnv.MNEMONIC,
        { prefix: CONFIG.PREFIX }
      );
      expect(SigningStargateClient.connectWithSigner).toHaveBeenCalledWith(
        CONFIG.RPC_URL,
        mockWallet,
        { gasPrice: "0.025uatom" }
      );
      expect(sendDiscordNotification).toHaveBeenCalledWith(
        expect.stringContaining("🚀 Connected to cosmos1aaaaaaaa...")
      );
    });

    test("should handle initialization failure", async () => {
      const error = new Error("Connection failed");
      (SigningStargateClient.connectWithSigner as jest.Mock).mockRejectedValue(
        error
      );

      const result = await restakeBot.initialize();

      expect(result).toBe(false);
      expect(sendDiscordNotification).toHaveBeenCalledWith(
        expect.stringContaining(
          "❌ Failed to initialize client: Connection failed"
        )
      );
    });

    test("should return true if already initialized", async () => {
      await restakeBot.initialize();

      const result = await restakeBot.initialize();

      expect(result).toBe(true);
      expect(DirectSecp256k1HdWallet.fromMnemonic).toHaveBeenCalledTimes(1);
    });
  });

  describe("getDelegations", () => {
    test("should return delegations successfully", async () => {
      // Initialize the client first
      await restakeBot.initialize();

      const mockDelegations = {
        delegationResponses: [
          {
            delegation: {
              delegatorAddress: "cosmos1delegator",
              validatorAddress: "cosmos1validator1",
              shares: "1000000",
            },
            balance: { denom: "uatom", amount: "1000000" },
          },
          {
            delegation: {
              delegatorAddress: "cosmos1delegator",
              validatorAddress: "cosmos1validator2",
              shares: "2000000",
            },
            balance: { denom: "uatom", amount: "2000000" },
          },
        ],
      };

      (
        mockClient as any
      ).queryClient.staking.delegatorDelegations.mockResolvedValue(
        mockDelegations
      );

      const result = await restakeBot.getDelegations();

      expect(result).toEqual(mockDelegations.delegationResponses);
      expect(
        (mockClient as any).queryClient.staking.delegatorDelegations
      ).toHaveBeenCalledWith(mockEnv.DELEGATOR_ADDRESS);
    });

    test("should handle delegation fetch error", async () => {
      // Initialize the client first
      await restakeBot.initialize();

      const error = new Error("Network error");
      (
        mockClient as any
      ).queryClient.staking.delegatorDelegations.mockRejectedValue(error);

      const result = await restakeBot.getDelegations();

      expect(result).toEqual([]);
      expect(sendDiscordNotification).toHaveBeenCalledWith(
        expect.stringContaining("❌ Failed to fetch delegations:Network error")
      );
    });

    test("should throw error if client not initialized", async () => {
      await expect(restakeBot.getDelegations()).rejects.toThrow(
        "Client not initialized"
      );
    });
  });

  describe("getRewardAmount", () => {
    beforeEach(() => {
      // Mock successful fetch response
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          rewards: [{ denom: "uatom", amount: "5000" }],
        }),
      });
    });

    test("should return cached reward if available", async () => {
      mockRewardCache.get.mockReturnValue(5000);

      const result = await restakeBot.getRewardAmount("cosmos1validator1");

      expect(result).toBe(5000);
      expect(mockRewardCache.get).toHaveBeenCalledWith("cosmos1validator1");
    });

    test("should fetch reward from LCD endpoint successfully", async () => {
      mockRewardCache.get.mockReturnValue(null);

      const result = await restakeBot.getRewardAmount("cosmos1validator1");

      expect(result).toBe(5000);
      expect(mockRewardCache.set).toHaveBeenCalledWith(
        "cosmos1validator1",
        5000
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/cosmos/distribution/v1beta1/delegators/"),
        expect.any(Object)
      );
    });

    test("should handle LCD endpoint failure and fallback to RPC", async () => {
      // Initialize the client first
      await restakeBot.initialize();

      mockRewardCache.get.mockReturnValue(null);
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const mockRpcRewards = {
        rewards: [
          {
            validatorAddress: "cosmos1validator1",
            reward: [{ denom: "uatom", amount: "3000" }],
          },
        ],
      };
      (
        mockClient as any
      ).queryClient.distribution.delegationTotalRewards.mockResolvedValue(
        mockRpcRewards
      );

      const result = await restakeBot.getRewardAmount("cosmos1validator1");

      expect(result).toBe(3000);
      expect(
        (mockClient as any).queryClient.distribution.delegationTotalRewards
      ).toHaveBeenCalledWith(mockEnv.DELEGATOR_ADDRESS);
    });

    test("should return 0 if all methods fail", async () => {
      mockRewardCache.get.mockReturnValue(null);
      mockFetch.mockRejectedValue(new Error("Network error"));
      (
        mockClient as any
      ).queryClient.distribution.delegationTotalRewards.mockRejectedValue(
        new Error("RPC error")
      );

      const result = await restakeBot.getRewardAmount("cosmos1validator1");

      expect(result).toBe(0);
      expect(sendDiscordNotification).toHaveBeenCalledWith(
        expect.stringContaining("⚠️ All reward fetching methods failed")
      );
    });
  });

  describe("claimReward", () => {
    test("should claim reward successfully", async () => {
      // Initialize the client first
      await restakeBot.initialize();

      const mockTxResponse = {
        code: 0,
        height: 12345,
        transactionHash: "test-hash",
        txIndex: 0,
        events: [],
        msgResponses: [],
        gasUsed: BigInt(100000),
        gasWanted: BigInt(100000),
      };
      mockClient.withdrawRewards.mockResolvedValue(mockTxResponse);

      const result = await restakeBot.claimReward("cosmos1validator1");

      expect(result).toEqual({
        success: true,
        validator: "cosmos1validator1",
      });
      expect(mockClient.withdrawRewards).toHaveBeenCalledWith(
        mockEnv.DELEGATOR_ADDRESS,
        "cosmos1validator1",
        "auto",
        "auto"
      );
    });

    test("should handle claim failure", async () => {
      // Initialize the client first
      await restakeBot.initialize();

      const error = new Error("Insufficient funds");
      mockClient.withdrawRewards.mockRejectedValue(error);

      const result = await restakeBot.claimReward("cosmos1validator1");

      expect(result).toEqual({
        success: false,
        validator: "cosmos1validator1",
        error: "Insufficient funds",
      });
    });

    test("should throw error if client not initialized", async () => {
      await expect(restakeBot.claimReward("cosmos1validator1")).rejects.toThrow(
        "Client not initialized"
      );
    });
  });

  describe("claimAllRewards", () => {
    const mockDelegations = [
      {
        delegation: {
          delegatorAddress: "cosmos1delegator",
          validatorAddress: "cosmos1validator1",
          shares: "1000000",
        },
        balance: { denom: "uatom", amount: "1000000" },
      },
      {
        delegation: {
          delegatorAddress: "cosmos1delegator",
          validatorAddress: "cosmos1validator2",
          shares: "2000000",
        },
        balance: { denom: "uatom", amount: "2000000" },
      },
    ];

    beforeEach(() => {
      // Mock reward amounts
      mockRewardCache.get.mockReturnValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          rewards: [{ denom: "uatom", amount: "400000" }], // Above claim threshold
        }),
      });
    });

    test("should claim rewards for eligible validators", async () => {
      // Initialize the client first
      await restakeBot.initialize();

      const mockTxResponse = {
        code: 0,
        height: 12345,
        transactionHash: "test-hash",
        txIndex: 0,
        events: [],
        msgResponses: [],
        gasUsed: BigInt(100000),
        gasWanted: BigInt(100000),
      };
      mockClient.withdrawRewards.mockResolvedValue(mockTxResponse);

      const result = await restakeBot.claimAllRewards(mockDelegations);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        success: true,
        validator: "cosmos1validator1",
      });
      expect(sendDiscordNotification).toHaveBeenCalledWith(
        expect.stringContaining("📥 Claiming 10,000 uatom in rewards...")
      );
    });

    test("should skip validators below minimum reward threshold", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          rewards: [{ denom: "uatom", amount: "500" }], // Below threshold
        }),
      });

      const result = await restakeBot.claimAllRewards(mockDelegations);

      expect(result).toEqual([]);
      expect(sendDiscordNotification).toHaveBeenCalledWith(
        expect.stringContaining(
          "⏩ Skipping cosmos1validator1: Reward 500 uatom is below threshold"
        )
      );
    });

    test("should skip if total reward below claim threshold", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          rewards: [{ denom: "uatom", amount: "100000" }], // Below gas * min_factor
        }),
      });

      const result = await restakeBot.claimAllRewards(mockDelegations);

      expect(result).toEqual([]);
      expect(sendDiscordNotification).toHaveBeenCalledWith(
        expect.stringContaining("⏸️ Skipping claim: total reward")
      );
    });

    test("should handle sequence mismatch error", async () => {
      // Initialize the client first
      await restakeBot.initialize();

      // Set reward above claim threshold for this test as well
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          rewards: [{ denom: "uatom", amount: "400000" }], // Above claim threshold
        }),
      });

      const mockTxResponse = {
        code: 0,
        height: 12345,
        transactionHash: "test-hash",
        txIndex: 0,
        events: [],
        msgResponses: [],
        gasUsed: BigInt(100000),
        gasWanted: BigInt(100000),
      };
      mockClient.withdrawRewards
        .mockRejectedValueOnce(new Error("account sequence mismatch"))
        .mockResolvedValueOnce(mockTxResponse);

      const result = await restakeBot.claimAllRewards(mockDelegations);

      expect(result).toHaveLength(2);
      expect(sendDiscordNotification).toHaveBeenCalledWith(
        expect.stringContaining(
          "🔄 Sequence mismatch detected, refreshing client..."
        )
      );
    });
  });

  describe("getBalance", () => {
    test("should return balance successfully", async () => {
      // Initialize the client first
      await restakeBot.initialize();

      const mockBalances = [
        { denom: "uatom", amount: "5000000" },
        { denom: "other", amount: "1000" },
      ];
      mockClient.getAllBalances.mockResolvedValue(mockBalances);

      const result = await restakeBot.getBalance();

      expect(result).toBe(5000000);
      expect(mockClient.getAllBalances).toHaveBeenCalledWith(
        mockEnv.DELEGATOR_ADDRESS
      );
    });

    test("should return 0 if no atom balance", async () => {
      // Initialize the client first
      await restakeBot.initialize();

      const mockBalances = [{ denom: "other", amount: "1000" }];
      mockClient.getAllBalances.mockResolvedValue(mockBalances);

      const result = await restakeBot.getBalance();

      expect(result).toBe(0);
    });

    test("should handle balance fetch error", async () => {
      // Initialize the client first
      await restakeBot.initialize();

      const error = new Error("Network error");
      mockClient.getAllBalances.mockRejectedValue(error);

      const result = await restakeBot.getBalance();

      expect(result).toBe(0);
      expect(sendDiscordNotification).toHaveBeenCalledWith(
        expect.stringContaining("❌ Failed to get balance:Network error")
      );
    });

    test("should throw error if client not initialized", async () => {
      await expect(restakeBot.getBalance()).rejects.toThrow(
        "Client not initialized"
      );
    });
  });

  describe("delegateTokens", () => {
    test("should delegate tokens successfully", async () => {
      // Initialize the client first
      await restakeBot.initialize();

      const mockTxResponse = {
        code: 0,
        height: 12345,
        transactionHash: "test-hash",
        txIndex: 0,
        events: [],
        msgResponses: [],
        gasUsed: BigInt(100000),
        gasWanted: BigInt(100000),
      };
      mockClient.delegateTokens.mockResolvedValue(mockTxResponse);

      const result = await restakeBot.delegateTokens(
        "cosmos1validator1",
        1000000
      );

      expect(result).toBe(true);
      expect(mockClient.delegateTokens).toHaveBeenCalledWith(
        mockEnv.DELEGATOR_ADDRESS,
        "cosmos1validator1",
        { denom: "uatom", amount: "1000000" },
        "auto",
        "auto"
      );
    });

    test("should handle delegation failure", async () => {
      // Initialize the client first
      await restakeBot.initialize();

      const error = new Error("Insufficient balance");
      mockClient.delegateTokens.mockRejectedValue(error);

      const result = await restakeBot.delegateTokens(
        "cosmos1validator1",
        1000000
      );

      expect(result).toBe(false);
      expect(sendDiscordNotification).toHaveBeenCalledWith(
        expect.stringContaining(
          "❌ Failed to delegate tokens:Insufficient balance"
        )
      );
    });

    test("should throw error if client not initialized", async () => {
      await expect(
        restakeBot.delegateTokens("cosmos1validator1", 1000000)
      ).rejects.toThrow("Client not initialized");
    });
  });

  describe("disconnect", () => {
    test("should disconnect client and clear cache", async () => {
      // Initialize the client first
      await restakeBot.initialize();

      await restakeBot.disconnect();

      expect(mockClient.disconnect).toHaveBeenCalled();
      expect(mockRewardCache.clear).toHaveBeenCalled();
    });
  });

  describe("run", () => {
    const mockDelegations = [
      {
        delegation: {
          delegatorAddress: "cosmos1delegator",
          validatorAddress: "cosmos1validator1",
          shares: "1000000",
        },
        balance: { denom: "uatom", amount: "1000000" },
      },
    ];

    beforeEach(() => {
      // Mock successful initialization
      jest.spyOn(restakeBot, "initialize").mockResolvedValue(true);
      jest
        .spyOn(restakeBot, "getDelegations")
        .mockResolvedValue(mockDelegations);
      jest.spyOn(restakeBot, "getBalance").mockResolvedValue(5000000);
      jest.spyOn(restakeBot, "claimAllRewards").mockResolvedValue([]);
      jest.spyOn(restakeBot, "delegateTokens").mockResolvedValue(true);
      jest.spyOn(restakeBot, "disconnect").mockResolvedValue();

      // Mock reward calculation
      mockRewardCache.get.mockReturnValue(null);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          rewards: [{ denom: "uatom", amount: "100000" }],
        }),
      });
    });

    test("should run successfully with valid delegations", async () => {
      await restakeBot.run();

      expect(restakeBot.initialize).toHaveBeenCalled();
      expect(restakeBot.getDelegations).toHaveBeenCalled();
      expect(restakeBot.getBalance).toHaveBeenCalled();
      expect(sendDiscordNotification).toHaveBeenCalledWith(
        expect.stringContaining("Available ATOM: 5.000.000 uatom")
      );
    });

    test("should handle no delegations found", async () => {
      jest.spyOn(restakeBot, "getDelegations").mockResolvedValue([]);

      await restakeBot.run();

      expect(sendCriticalNotification).toHaveBeenCalledWith(
        "❌ No delegations found."
      );
    });

    test("should handle insufficient balance for restaking", async () => {
      jest.spyOn(restakeBot, "getBalance").mockResolvedValue(500000); // Below reserve

      await restakeBot.run();

      expect(sendDiscordNotification).toHaveBeenCalledWith(
        expect.stringContaining("⏸️ Total available (600.000 uatom) ≤ reserve")
      );
    });

    test("should handle initialization failure", async () => {
      jest.spyOn(restakeBot, "initialize").mockResolvedValue(false);

      await restakeBot.run();

      expect(restakeBot.getDelegations).not.toHaveBeenCalled();
    });

    test("should handle errors during execution", async () => {
      const error = new Error("Test error");
      jest.spyOn(restakeBot, "getDelegations").mockRejectedValue(error);

      await restakeBot.run();

      expect(sendCriticalNotification).toHaveBeenCalledWith(
        expect.stringContaining("❌ Error in main execution: Test error")
      );
      expect(restakeBot.disconnect).toHaveBeenCalled();
    });

    test("should always disconnect in finally block", async () => {
      const error = new Error("Test error");
      jest.spyOn(restakeBot, "getDelegations").mockRejectedValue(error);

      await restakeBot.run();

      expect(restakeBot.disconnect).toHaveBeenCalled();
    });
  });

  describe("private methods", () => {
    test("findMinDelegation should return delegation with minimum balance", () => {
      const delegations = [
        {
          delegation: { validatorAddress: "val1" },
          balance: { amount: "2000000" },
        },
        {
          delegation: { validatorAddress: "val2" },
          balance: { amount: "1000000" },
        },
        {
          delegation: { validatorAddress: "val3" },
          balance: { amount: "3000000" },
        },
      ];

      // Access private method through reflection or expose it for testing
      const result = (restakeBot as any).findMinDelegation(delegations);

      expect(result).toEqual(delegations[1]);
    });

    test("findMinDelegation should return null for empty delegations", () => {
      const result = (restakeBot as any).findMinDelegation([]);

      expect(result).toBeNull();
    });
  });
});
