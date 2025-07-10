import { z } from "zod";

/**
 * Validation utilities for address and amount validation using Zod
 */
export class Validator {
  // Zod schemas for validation
  private static readonly cosmosAddressSchema = z
    .string()
    .regex(/^cosmos1[a-zA-Z0-9]{38}$/, "Invalid Cosmos address format");

  private static readonly amountStringSchema = z.string().refine((val) => {
    const num = parseInt(val, 10);
    return !isNaN(num) && num >= 0;
  }, "Amount must be a valid non-negative integer");

  private static readonly positiveNumberSchema = z
    .number()
    .nonnegative("Amount must be non-negative")
    .int("Amount must be an integer");

  private static readonly mnemonicSchema = z.string().refine((val) => {
    const words = val.trim().split(/\s+/);
    return words.length === 12 || words.length === 24;
  }, "Mnemonic must be 12 or 24 words");

  private static readonly gasPriceSchema = z
    .string()
    .regex(/^\d+(\.\d+)?[a-z]+$/, "Invalid gas price format");

  private static readonly chainIdSchema = z
    .string()
    .regex(/^[a-zA-Z0-9-]+$/, "Invalid chain ID format");

  private static readonly configSchema = z.object({
    MNEMONIC: z.string().min(1, "Mnemonic is required"),
    RPC_URL: z.string().url("RPC URL must be a valid URL"),
    DELEGATOR_ADDRESS: z.string().min(1, "Delegator address is required"),
    DENOM: z.string().min(1, "Denom is required"),
    RESERVE: z.number().min(1, "Reserve is required"),
    MIN_RESTAKE_AMOUNT: z.number().min(1, "Min restake amount is required"),
    MIN_REWARD_AMOUNT: z.number().min(1, "Min reward amount is required"),
    GAS_PRICE: z.number().min(1, "Gas price is required"),
    PREFIX: z.string().min(1, "Prefix is required"),
  });

  /**
   * Validate a Cosmos address format
   * @param address - The address to validate
   * @returns true if the address is valid
   */
  static isValidAddress(address: string): boolean {
    const result = this.cosmosAddressSchema.safeParse(address);
    return result.success;
  }

  /**
   * Validate an amount string
   * @param amount - The amount string to validate
   * @returns true if the amount is valid
   */
  static isValidAmount(amount: string): boolean {
    const result = this.amountStringSchema.safeParse(amount);
    return result.success;
  }

  /**
   * Sanitize an amount to ensure it's a valid positive integer
   * @param amount - The amount to sanitize
   * @returns Sanitized amount
   */
  static sanitizeAmount(amount: number): number {
    const result = this.positiveNumberSchema.safeParse(amount);
    if (result.success) {
      return result.data;
    }
    return Math.max(0, Math.floor(amount));
  }

  /**
   * Validate a mnemonic phrase
   * @param mnemonic - The mnemonic to validate
   * @returns true if the mnemonic is valid
   */
  static isValidMnemonic(mnemonic: string): boolean {
    const result = this.mnemonicSchema.safeParse(mnemonic);
    return result.success;
  }

  /**
   * Validate a configuration object
   * @param config - The configuration object to validate
   * @returns true if the configuration is valid
   */
  static isValidConfig(config: Record<string, any>): boolean {
    const result = this.configSchema.safeParse(config);
    return result.success;
  }

  /**
   * Get missing required fields from a configuration object
   * @param config - The configuration object to check
   * @returns Array of missing field names
   */
  static getMissingFields(config: Record<string, any>): string[] {
    const result = this.configSchema.safeParse(config);
    if (result.success) {
      return [];
    }

    const missingFields: string[] = [];
    const requiredFields = [
      "MNEMONIC",
      "RPC_URL",
      "DELEGATOR_ADDRESS",
      "DENOM",
      "RESERVE",
      "MIN_RESTAKE_AMOUNT",
      "MIN_REWARD_AMOUNT",
      "GAS_PRICE",
      "PREFIX",
    ];

    for (const field of requiredFields) {
      if (!config[field]) {
        missingFields.push(field);
      }
    }

    return missingFields;
  }

  /**
   * Validate a gas price string
   * @param gasPrice - The gas price string to validate
   * @returns true if the gas price is valid
   */
  static isValidGasPrice(gasPrice: string): boolean {
    const result = this.gasPriceSchema.safeParse(gasPrice);
    return result.success;
  }

  /**
   * Validate a chain ID
   * @param chainId - The chain ID to validate
   * @returns true if the chain ID is valid
   */
  static isValidChainId(chainId: string): boolean {
    const result = this.chainIdSchema.safeParse(chainId);
    return result.success;
  }

  /**
   * Validate and parse a Cosmos address with detailed error information
   * @param address - The address to validate
   * @returns Parsed address or throws error with details
   */
  static parseAddress(address: string): string {
    return this.cosmosAddressSchema.parse(address);
  }

  /**
   * Validate and parse an amount string with detailed error information
   * @param amount - The amount string to validate
   * @returns Parsed amount or throws error with details
   */
  static parseAmount(amount: string): string {
    return this.amountStringSchema.parse(amount);
  }

  /**
   * Validate and parse a mnemonic with detailed error information
   * @param mnemonic - The mnemonic to validate
   * @returns Parsed mnemonic or throws error with details
   */
  static parseMnemonic(mnemonic: string): string {
    return this.mnemonicSchema.parse(mnemonic);
  }

  /**
   * Validate and parse a configuration object with detailed error information
   * @param config - The configuration object to validate
   * @returns Parsed configuration or throws error with details
   */
  static parseConfig(
    config: Record<string, any>
  ): z.infer<typeof Validator.configSchema> {
    return this.configSchema.parse(config);
  }

  /**
   * Get validation errors for a configuration object
   * @param config - The configuration object to validate
   * @returns Array of validation error messages
   */
  static getConfigErrors(config: Record<string, any>): string[] {
    const result = this.configSchema.safeParse(config);
    if (result.success) {
      return [];
    }
    return result.error.errors.map(
      (err) => `${err.path.join(".")}: ${err.message}`
    );
  }

  /**
   * Validate multiple addresses at once
   * @param addresses - Array of addresses to validate
   * @returns Object with valid and invalid addresses
   */
  static validateAddresses(addresses: string[]): {
    valid: string[];
    invalid: string[];
  } {
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const address of addresses) {
      if (this.isValidAddress(address)) {
        valid.push(address);
      } else {
        invalid.push(address);
      }
    }

    return { valid, invalid };
  }

  /**
   * Validate multiple amounts at once
   * @param amounts - Array of amount strings to validate
   * @returns Object with valid and invalid amounts
   */
  static validateAmounts(amounts: string[]): {
    valid: string[];
    invalid: string[];
  } {
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const amount of amounts) {
      if (this.isValidAmount(amount)) {
        valid.push(amount);
      } else {
        invalid.push(amount);
      }
    }

    return { valid, invalid };
  }
}
