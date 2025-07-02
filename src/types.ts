// Type definitions for the Restake Bot

export interface Config {
  readonly DENOM: string;
  readonly RESERVE: number;
  readonly MIN_RESTAKE_AMOUNT: number;
  readonly MIN_REWARD_AMOUNT: number;
  readonly GAS_PRICE: string;
  readonly PREFIX: string;
}

export interface DelegationResponse {
  delegation: {
    delegatorAddress: string;
    validatorAddress: string;
    shares: string;
  };
  balance: {
    denom: string;
    amount: string;
  };
}

export interface DelegationsResponse {
  delegationResponses: DelegationResponse[];
  pagination?: {
    nextKey?: string;
    total?: string;
  };
}

export interface RewardData {
  rewards: Array<{
    denom: string;
    amount: string;
  }>;
}

export interface ClaimResult {
  success: boolean;
  validator: string;
  error?: string;
}

export interface Balance {
  denom: string;
  amount: string;
}

export interface EnvironmentVariables {
  MNEMONIC: string;
  RPC_URL: string;
  DELEGATOR_ADDRESS: string;
  REST_URL: string;
  DENOM: string;
  RESERVE: number;
  MIN_RESTAKE_AMOUNT: number;
  MIN_REWARD_AMOUNT: number;
  GAS_PRICE: string;
  PREFIX: string;
}

// Type guard for environment variables
export function validateEnvironmentVariables(): EnvironmentVariables {
  const requiredEnvVars = [
    "MNEMONIC",
    "RPC_URL",
    "DELEGATOR_ADDRESS",
    "REST_URL",
    "DENOM",
    "RESERVE",
    "MIN_RESTAKE_AMOUNT",
    "MIN_REWARD_AMOUNT",
    "GAS_PRICE",
    "PREFIX",
  ] as const;
  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`
    );
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
  } = process.env;

  if (
    !MNEMONIC ||
    !RPC_URL ||
    !DELEGATOR_ADDRESS ||
    !REST_URL ||
    !DENOM ||
    !RESERVE ||
    !MIN_RESTAKE_AMOUNT ||
    !MIN_REWARD_AMOUNT ||
    !GAS_PRICE ||
    !PREFIX
  ) {
    throw new Error("Environment variables are not properly set");
  }

  return {
    MNEMONIC,
    RPC_URL,
    REST_URL,
    DELEGATOR_ADDRESS,
    DENOM,
    RESERVE: parseInt(RESERVE, 10),
    MIN_RESTAKE_AMOUNT: parseInt(MIN_RESTAKE_AMOUNT, 10),
    MIN_REWARD_AMOUNT: parseInt(MIN_REWARD_AMOUNT, 10),
    GAS_PRICE,
    PREFIX,
  };
}
