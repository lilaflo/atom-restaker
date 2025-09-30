# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Cosmos blockchain auto-restaking bot that automatically claims staking rewards and re-delegates them to validators. It runs as an HTTP service on Fly.io and sends Discord notifications for monitoring.

**Core Flow:**
1. Queries all delegations across configured accounts
2. Fetches rewards for each validator delegation
3. Fetches validator metadata (jailed status, bonding status, commission)
4. Filters out jailed and inactive validators
5. Claims rewards from validators with rewards >= MIN_REWARD_AMOUNT
6. If total available balance exceeds MIN_RESTAKE_AMOUNT + RESERVE, delegates to the **active** validator with the lowest staking amount

## Development Commands

**Build & Run:**
- `pnpm build` - Compile TypeScript to dist/
- `pnpm start` - Run HTTP server (dist/server.js)
- `pnpm start:once` - Run restaking once and exit (dist/index.js)
- `pnpm dev` - Run HTTP server in development mode
- `pnpm dev:once` - Run restaking once in development mode

**Type Checking:**
- `pnpm type-check` - Run TypeScript type checking without emitting files

**Testing:**
- `pnpm test` - Run all Jest tests
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:coverage` - Run tests with coverage report
- `pnpm test:performance` - Run performance tests only
- `pnpm test:validation` - Run validation tests only

**Docker:**
- `docker compose up --build` - Build and run bot locally in Docker
- Dockerfile uses multi-stage build: `installer` stage runs tests, `runner` stage for production

**Deployment:**
- Deployed to Fly.io as HTTP service with auto-scaling
- `fly deploy` - Deploy to Fly.io
- `fly secrets set MNEMONIC=... DISCORD_WEBHOOK_URL=...` - Set secrets
- Accessed via HTTP: `https://restake-bot.fly.dev/`
- Auto-scales to 0 machines when idle (cost optimization)
- Trigger restaking by visiting `/` endpoint
- Health check available at `/health`

## Architecture

**Entry Point (src/index.ts):**
- Exports `executeRestake()` function that can be called programmatically
- Creates HD wallet from MNEMONIC
- Connects to Cosmos RPC using SigningStargateClient
- Fetches delegations → enriches with rewards and validator metadata → filters inactive/jailed → claims → restakes
- Returns structured result object with success/failure status
- All operations use the CosmJS Stargate client

**HTTP Server (src/server.ts):**
- Fastify HTTP server listening on port 8080
- `GET /` - Triggers restaking and returns JSON result
- `GET /health` - Health check endpoint for monitoring
- Handles errors and formats responses

**Configuration (src/config.ts):**
- Centralized config object with LCD endpoints, RPC URL, gas settings, thresholds
- Environment variables: MNEMONIC, DISCORD_WEBHOOK_URL (required)
- Key thresholds: RESERVE (300K uatom = 0.3 ATOM), MIN_RESTAKE_AMOUNT (800K), MIN_REWARD_AMOUNT (200K)

**Type Safety (src/types.ts):**
- All schemas defined with Zod for runtime validation
- DelegationResponseSchema, RewardsResponseSchema, RestakeConfigSchema, ValidatorInfoSchema
- ValidatorSchema includes metadata fields: jailed, status, commission
- Custom address validation: CosmosAddressSchema, ValidatorAddressSchema
- Type inference using `z.infer<>`

**Utilities (src/utils.ts):**
- `fetchWithTimeout()` - Fetch with timeout for LCD endpoint requests
- `fetchWithRetry()` - Exponential backoff retry logic
- `returnFirst()` - Race multiple endpoints, return first successful response

**Notifications (src/DiscordNotifier.ts):**
- `sendMessage(message, type)` - Sends formatted Discord webhook messages
- Types: info ℹ️, error ❌, warn ⚠️, success ✅

**Reward Fetching Strategy:**
- Races multiple LCD endpoints (cosmos.network, lava.build, publicnode.com, etc.)
- Uses `returnFirst()` to get fastest successful response
- 1 second timeout per endpoint

**Re-staking Strategy:**
- Fetches validator metadata for all delegations (jailed status, bonding status, commission)
- Filters out jailed validators (jailed=true)
- Filters out inactive validators (status != "BOND_STATUS_BONDED")
- Only considers active, bonded validators for restaking
- Delegates to **active** validator with LOWEST current staking amount
- This balances stake distribution across **safe** validators
- 1 second delay between reward claims to avoid sequence conflicts
- Logs and sends Discord notifications about filtered validators

## Important Notes

- TypeScript strict mode enabled with extensive compiler checks (noUncheckedIndexedAccess, exactOptionalPropertyTypes, etc.)
- Gas price: 0.025uatom with "auto" gas estimation
- Chain: cosmoshub-4 (Cosmos Hub mainnet)
- Denom: uatom (micro-ATOM, 1 ATOM = 1,000,000 uatom)
- Tests run during Docker build - build fails if tests fail