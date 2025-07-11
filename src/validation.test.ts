import { CosmosAddressSchema, RestakeConfigSchema } from "./types";

describe("Schema Validation Tests", () => {
  describe("Basic Validations", () => {
    test("should validate correct Cosmos addresses", () => {
      const validAddress = "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const result = CosmosAddressSchema.parse(validAddress);
      expect(result).toBe(validAddress);
    });

    test("should reject invalid Cosmos addresses", () => {
      const invalidAddress = "invalid-address";
      expect(() => CosmosAddressSchema.parse(invalidAddress)).toThrow();
    });
  });
});

describe("Configuration Validation", () => {
  test("should validate correct configuration", () => {
    const validConfig = {
      RPC_URL: "https://rpc.cosmos.network:26657",
      MNEMONIC:
        "test mnemonic words here bird fall break sommer fall pillow chair carpet",
      DENOM: "uatom",
      RESERVE: 1000000,
      MIN_RESTAKE_AMOUNT: 50000,
      MIN_REWARD_AMOUNT: 10000,
      GAS_PRICE: "0.025uatom",
      PREFIX: "cosmos",
      REWARD_CACHE_TTL: 300000,
      LCD_ENDPOINTS: ["https://lcd.cosmos.network"],
      REQUEST_TIMEOUT: 10000,
      RETRY_DELAYS: [1000, 2000, 5000],
      MAX_RETRIES: 3,
      TRANSACTION_DELAY: 1000,
      SEQUENCE_RETRY_DELAY: 2000,
      GAS_ESTIMATE: 200000,
      MIN_FACTOR: 1.5,
      CHAIN_ID: "cosmoshub-4",
      NOTIFICATION_COOLDOWN: 60000,
      DISCORD_WEBHOOK_URL:
        "https://discord.com/api/webhooks/1234567890/abcdefghijklmnopqrstuvwxyz",
    };
    const result = RestakeConfigSchema.parse(validConfig);
    expect(result).toBeDefined();
    expect(result.RPC_URL).toBe(validConfig.RPC_URL);
    expect(result.DENOM).toBe(validConfig.DENOM);
  });

  test("should reject configuration with invalid RPC URL", () => {
    const invalidConfig = {
      RPC_URL: "not-a-valid-url",
      DENOM: "uatom",
      RESERVE: 1000000,
      MIN_RESTAKE_AMOUNT: 50000,
      MIN_REWARD_AMOUNT: 10000,
      GAS_PRICE: "0.025uatom",
      PREFIX: "cosmos",
      REWARD_CACHE_TTL: 300000,
      LCD_ENDPOINTS: ["https://lcd.cosmos.network"],
      REQUEST_TIMEOUT: 10000,
      RETRY_DELAYS: [1000, 2000, 5000],
      MAX_RETRIES: 3,
      TRANSACTION_DELAY: 1000,
      SEQUENCE_RETRY_DELAY: 2000,
      GAS_ESTIMATE: 200000,
      MIN_FACTOR: 1.5,
      CHAIN_ID: "cosmoshub-4",
      NOTIFICATION_COOLDOWN: 60000,
    };
    expect(() => RestakeConfigSchema.parse(invalidConfig)).toThrow();
  });

  test("should reject configuration with invalid gas price", () => {
    const invalidConfig = {
      MNEMONIC: "test",
      RPC_URL: "https://rpc.cosmos.network:26657",
      DENOM: "uatom",
      RESERVE: 1000000,
      MIN_RESTAKE_AMOUNT: 50000,
      MIN_REWARD_AMOUNT: 10000,
      GAS_PRICE: "invalid-gas-price",
      PREFIX: "cosmos",
      REWARD_CACHE_TTL: 300000,
      LCD_ENDPOINTS: ["https://lcd.cosmos.network"],
      REQUEST_TIMEOUT: 10000,
      RETRY_DELAYS: [1000, 2000, 5000],
      MAX_RETRIES: 3,
      TRANSACTION_DELAY: 1000,
      SEQUENCE_RETRY_DELAY: 2000,
      GAS_ESTIMATE: 200000,
      MIN_FACTOR: 1.5,
      CHAIN_ID: "cosmoshub-4",
      NOTIFICATION_COOLDOWN: 60000,
    };
    // This should throw because GAS_PRICE is a string but should be a number according to Validator
    expect(() => RestakeConfigSchema.parse(invalidConfig)).toThrow();
  });

  test("should reject configuration with missing required fields", () => {
    const incompleteConfig = {
      RPC_URL: "https://rpc.cosmos.network:26657",
      // Missing other required fields
    };
    expect(() => RestakeConfigSchema.parse(incompleteConfig)).toThrow();
  });
});

describe("Batch Validation", () => {
  test("should validate multiple addresses correctly", () => {
    const addresses = [
      "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "cosmos1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "cosmos1cccccccccccccccccccccccccccccccccccccc",
      "invalid-address-1",
      "not-a-cosmos-address",
    ];

    const results = addresses
      .map((address) => {
        try {
          return CosmosAddressSchema.parse(address);
        } catch {
          return false;
        }
      })
      .filter((result) => result !== false);

    expect(results).toHaveLength(3);
    expect(results).toContain("cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(results).toContain("cosmos1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    expect(results).toContain("cosmos1cccccccccccccccccccccccccccccccccccccc");
  });
});

describe("Direct Zod Schema Usage", () => {
  test("should validate addresses using Zod schema directly", () => {
    const validAddress = "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const invalidAddress = "invalid-address";

    const validResult = CosmosAddressSchema.safeParse(validAddress);
    const invalidResult = CosmosAddressSchema.safeParse(invalidAddress);

    expect(validResult.success).toBe(true);
    expect(invalidResult.success).toBe(false);
  });
});

describe("Error Handling", () => {
  test("should provide detailed error messages for configuration", () => {
    const configWithErrors = {
      RPC_URL: "not-a-valid-url",
      DENOM: "", // empty
      RESERVE: -1000, // negative
      MIN_RESTAKE_AMOUNT: -50, // negative
      MIN_REWARD_AMOUNT: 0, // zero
      GAS_PRICE: "invalid-gas-price",
      PREFIX: "", // empty
    };

    const { error } = RestakeConfigSchema.safeParse(configWithErrors);

    expect(error).toBeDefined();
    expect(error?.errors.length).toBeGreaterThan(0);

    // Check that errors contain meaningful messages
    const errorMessages = error?.errors.map((error) => error.message);
    expect(errorMessages).toContain("RPC URL must be a valid URL");
    expect(errorMessages).toContain("Denom is required");
    // expect(errorMessages).toContain("RESERVE");
    // expect(errorMessages).toContain("MIN_RESTAKE_AMOUNT");
    // expect(errorMessages).toContain("MIN_REWARD_AMOUNT");
    // expect(errorMessages).toContain("GAS_PRICE");
    // expect(errorMessages).toContain("PREFIX");
  });
});

describe("Address Validation", () => {
  test("should validate correct Cosmos address format", () => {
    const validAddresses = [
      "cosmos1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "cosmos1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    ];

    validAddresses.forEach((address) => {
      expect(() => CosmosAddressSchema.parse(address)).not.toThrow();
    });
  });

  test("should reject invalid address formats", () => {
    const invalidAddresses = [
      "invalid-address",
      "cosmos",
      "cosmos1",
      "cosmos1invalid",
      "",
      "not-a-cosmos-address",
    ];

    invalidAddresses.forEach((address) => {
      expect(() => CosmosAddressSchema.parse(address)).toThrow();
    });
  });
});

//   describe("Amount Validation", () => {
//     test("should validate positive amounts", () => {
//       const validAmounts = ["1000", "50000", "0", "999999", "123456789"];

//       validAmounts.forEach((amount) => {
//         expect(() => Validator.parseAmount(amount)).not.toThrow();
//       });
//     });

//     test("should reject invalid amounts", () => {
//       const invalidAmounts = ["-100", "not-a-number", "abc123", ""];

//       invalidAmounts.forEach((amount) => {
//         expect(() => Validator.parseAmount(amount)).toThrow();
//       });
//     });
//   });
// });
