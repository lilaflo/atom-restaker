import { RestakeConfig } from "./types";

export const Config: RestakeConfig = {
  MNEMONIC: process.env["MNEMONIC"]!,
  DISCORD_WEBHOOK_URL: process.env["DISCORD_WEBHOOK_URL"]!,
  LCD_ENDPOINTS: [
    "https://api.cosmos.network",
    "https://cosmoshub.lava.build",
    "https://rest.cosmos.directory/cosmoshub",
    "https://cosmos-rest.publicnode.com",
  ],
  RPC_URL: "https://cosmos-rpc.polkachu.com",
  REQUEST_TIMEOUT: 10_000,
  RETRY_DELAYS: [1_000, 2_000, 4_000, 8_000],
  MAX_RETRIES: 3,
  TRANSACTION_DELAY: 2_000,
  SEQUENCE_RETRY_DELAY: 5_000,
  GAS_ESTIMATE: 5_000,
  MIN_FACTOR: 5,
  CHAIN_ID: "cosmoshub-4",
  DENOM: "uatom",
  RESERVE: 1_000_000,
  MIN_RESTAKE_AMOUNT: 800_000,
  MIN_REWARD_AMOUNT: 200_000,
  GAS_PRICE: "0.025uatom",
  PREFIX: "cosmos",
  REWARD_CACHE_TTL: 30_000,
  NOTIFICATION_COOLDOWN: 30_000,
};
