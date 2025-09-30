import { z } from "zod";

export const ClaimResultSchema = z.object({
  success: z.boolean(),
  validator: z.string(),
  error: z.string().optional(),
});

// Environment variables schema
export const EnvironmentVariablesSchema = z.object({
  DELEGATOR_ADDRESS: z.string().min(1, "Delegator address is required"),
  DISCORD_WEBHOOK_URL: z
    .string()
    .url("Discord webhook URL must be a valid URL"),
  MNEMONIC: z.string().min(1, "Mnemonic is required"),
});

// Export Validator schemas for reuse
export const CosmosAddressSchema = z
  .string()
  .regex(/^cosmos1[a-zA-Z0-9]{38}$/, "Invalid Cosmos address format");

export const MnemonicSchema = z.string().refine((val) => {
  const words = val.trim().split(/\s+/);
  return words.length === 12 || words.length === 24;
}, "Mnemonic must be 12 or 24 words");

export const GasPriceSchema = z
  .string()
  .regex(/^\d+(\.\d+)?[a-z]+$/, "Invalid gas price format");

export const ChainIdSchema = z
  .string()
  .regex(/^[a-zA-Z0-9-]+$/, "Invalid chain ID format");

export const RestakeConfigSchema = z.object({
  DISCORD_WEBHOOK_URL: z
    .string()
    .regex(
      /^https:\/\/discord\.com\/api\/webhooks\/.*$/,
      "Invalid Discord webhook url"
    ),
  MNEMONIC: MnemonicSchema,
  RPC_URL: z.string().url("RPC URL must be a valid URL"),
  DENOM: z.string().min(1, "Denom is required"),
  RESERVE: z.number().min(0, "Reserve must be greater than 0"),
  MIN_RESTAKE_AMOUNT: z
    .number()
    .min(0, "Min restake amount must be greater than 0"),
  MIN_REWARD_AMOUNT: z
    .number()
    .min(1, "Min reward amount must be greater than 0"),
  GAS_PRICE: GasPriceSchema,
  PREFIX: z.string().min(1, "Prefix is required"),
  REWARD_CACHE_TTL: z
    .number()
    .min(1, "Reward cache TTL must be greater than 0"),
  LCD_ENDPOINTS: z
    .array(z.string().url("LCD endpoint must be a valid URL"))
    .readonly(),
  REQUEST_TIMEOUT: z.number().min(1, "Request timeout must be greater than 0"),
  RETRY_DELAYS: z.array(
    z.number().min(1, "Retry delay must be greater than 0")
  ),
  MAX_RETRIES: z.number().min(1, "Max retries must be greater than 0"),
  TRANSACTION_DELAY: z
    .number()
    .min(1, "Transaction delay must be greater than 0"),
  SEQUENCE_RETRY_DELAY: z
    .number()
    .min(1, "Sequence retry delay must be greater than 0"),
  GAS_ESTIMATE: z.number().min(1, "Gas estimate must be greater than 0"),
  MIN_FACTOR: z.number().min(1, "Min factor must be greater than 0"),
  CHAIN_ID: ChainIdSchema,
  NOTIFICATION_COOLDOWN: z
    .number()
    .min(1, "Notification cooldown must be greater than 0"),
});

// Validation function using Zod
export function validateEnvironmentVariables(): EnvironmentVariables {
  const envVars = {
    DELEGATOR_ADDRESS: process.env["DELEGATOR_ADDRESS"],
    DISCORD_WEBHOOK_URL: process.env["DISCORD_WEBHOOK_URL"],
    MNEMONIC: process.env["MNEMONIC"],
  };

  const result = EnvironmentVariablesSchema.safeParse(envVars);

  if (!result.success) {
    const errors = result.error.errors
      .map((err) => `${err.path.join(".")}: ${err.message}`)
      .join(", ");

    throw new Error(`Environment validation failed: ${errors}`);
  }

  return result.data;
}

// Enhanced validation function for restake configuration
export function validateRestakeConfig(
  config: Record<string, any>
): RestakeConfig {
  const result = RestakeConfigSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.errors
      .map((err) => `${err.path.join(".")}: ${err.message}`)
      .join(", ");

    throw new Error(`Restake configuration validation failed: ${errors}`);
  }

  return result.data;
}

const DelegationSchema = z.object({
  delegatorAddress: z.string(),
  validatorAddress: z.string(),
  shares: z
    .string()
    .regex(/^\d+$/, "Shares must be a number")
    .transform((val) => Number(val)),
});

const BalanceSchema = z.object({
  denom: z.enum(["uatom"]),
  amount: z
    .string()
    .regex(/^\d+$/, "Amount must be a number")
    .transform((val) => Number(val)),
});

export const DelegationResponseSchema = z.object({
  delegation: DelegationSchema,
  balance: BalanceSchema,
});

export type DelegationResponse = z.infer<typeof DelegationResponseSchema>;
export type ClaimResult = z.infer<typeof ClaimResultSchema>;
export type EnvironmentVariables = z.infer<typeof EnvironmentVariablesSchema>;
export type RestakeConfig = z.infer<typeof RestakeConfigSchema>;

// Rewards response schema
const RewardSchema = z.object({
  denom: z.string(),
  amount: z
    .string()
    .regex(/^[\d.]+$/, "Amount must be a number")
    .transform((val) => Number(val)),
});

export const RewardsResponseSchema = z.object({
  rewards: z.array(RewardSchema),
});

export type RewardsResponse = z.infer<typeof RewardsResponseSchema>;

export const ValidatorAddressSchema = z
  .string()
  .regex(/^cosmosvaloper1[a-zA-Z0-9]{38}$/, "Invalid Cosmos address format");
export type ValidatorAddress = z.infer<typeof ValidatorAddressSchema>;

export const ValidatorSchema = z.object({
  validatorAddress: ValidatorAddressSchema,
  delegatorAddress: CosmosAddressSchema,
  stakingAmount: z.number(),
  rewards: z.number(),
  jailed: z.boolean().optional(),
  status: z.string().optional(),
  commission: z.number().optional(),
});
export type Validator = z.infer<typeof ValidatorSchema>;

export const ValidatorsSchema = z.array(ValidatorSchema);
export type Validators = z.infer<typeof ValidatorsSchema>;

// Validator info response from LCD
export const ValidatorInfoSchema = z.object({
  validator: z.object({
    operator_address: z.string(),
    jailed: z.boolean(),
    status: z.string(),
    tokens: z.string(),
    delegator_shares: z.string(),
    description: z.object({
      moniker: z.string(),
    }).passthrough(),
    commission: z.object({
      commission_rates: z.object({
        rate: z.string(),
      }).passthrough(),
    }).passthrough(),
  }).passthrough(),
});
export type ValidatorInfo = z.infer<typeof ValidatorInfoSchema>;
