// Type definitions for the Restake Bot

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

export interface ClaimResult {
  success: boolean;
  validator: string;
  error?: string;
}

export interface EnvironmentVariables {
  MNEMONIC: string;
  RPC_URL: string;
  DELEGATOR_ADDRESS: string;
  DENOM: string;
  RESERVE: string;
  MIN_RESTAKE_AMOUNT: string;
  MIN_REWARD_AMOUNT: string;
  GAS_PRICE: string;
  PREFIX: string;
}

// Type guard for environment variables
export function validateEnvironmentVariables(): EnvironmentVariables {
  const requiredEnvVars = [
    "MNEMONIC",
    "RPC_URL",
    "DELEGATOR_ADDRESS",
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
    DENOM,
    RESERVE,
    MIN_RESTAKE_AMOUNT,
    MIN_REWARD_AMOUNT,
    GAS_PRICE,
    PREFIX,
  } = process.env;

  // TypeScript already ensures these are not null due to the filter above
  return {
    MNEMONIC: MNEMONIC!,
    RPC_URL: RPC_URL!,
    DELEGATOR_ADDRESS: DELEGATOR_ADDRESS!,
    DENOM: DENOM!,
    RESERVE: RESERVE!,
    MIN_RESTAKE_AMOUNT: MIN_RESTAKE_AMOUNT!,
    MIN_REWARD_AMOUNT: MIN_REWARD_AMOUNT!,
    GAS_PRICE: GAS_PRICE!,
    PREFIX: PREFIX!,
  };
}
