# Cosmos Auto-Restaking Bot

An automated HTTP-based restaking bot for Cosmos Hub that claims staking rewards and re-delegates them to balance validator stakes. Built with TypeScript, CosmJS, and Fastify.

## 🌟 Features

- **HTTP-Based Execution**: Trigger restaking via HTTP requests for easy integration with external schedulers
- **Intelligent Reward Collection**: Automatically claims rewards from validators with rewards >= 200,000 uatom
- **Smart Re-delegation**: Re-stakes equally to all active validators to maintain portfolio distribution
- **Multi-Account Support**: Supports HD wallets with multiple accounts
- **Discord Notifications**: Real-time updates sent to Discord webhook
- **Auto-Scaling**: Deployed on Fly.io with automatic start/stop (min 0 machines)
- **Health Monitoring**: Built-in health check endpoint for uptime monitoring
- **Type-Safe**: Full TypeScript implementation with Zod schema validation
- **Battle-Tested**: Comprehensive test suite with 30+ tests

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 10+
- A Cosmos Hub wallet mnemonic
- Discord webhook URL (optional, for notifications)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd restake-bot

# Install dependencies
pnpm install

# Build the project
pnpm build
```

### Configuration

The bot requires two environment variables:

```bash
# Required: Your Cosmos wallet mnemonic (24 words)
export MNEMONIC="word1 word2 word3 ... word24"

# Optional: Discord webhook for notifications
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
```

### Running Locally

```bash
# Run the HTTP server (default port: 8080)
pnpm dev

# Or run a one-time restaking operation
pnpm dev:once
```

Visit `http://localhost:8080` to trigger a restaking operation.

## 📡 API Endpoints

### `GET /`
Triggers the restaking process and returns the result.

**Response (Success):**
```json
{
  "success": true,
  "message": "Restake completed successfully",
  "data": {
    "rewardsClaimed": 500000,
    "amountRestaked": 1200000,
    "validator": "cosmosvaloper1..., cosmosvaloper2...",
    "totalAvailable": 1500000
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Error message here"
}
```

### `GET /health`
Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "ok"
}
```

## ⚙️ Configuration

All configuration is centralized in `src/config.ts`:

| Parameter | Value | Description |
|-----------|-------|-------------|
| `RESERVE` | 300,000 uatom | Reserved balance kept in wallet (0.3 ATOM) |
| `MIN_RESTAKE_AMOUNT` | 800,000 uatom | Minimum amount to trigger re-staking (0.8 ATOM) |
| `MIN_REWARD_AMOUNT` | 200,000 uatom | Minimum reward to claim from a validator (0.2 ATOM) |
| `GAS_PRICE` | 0.025uatom | Gas price for transactions |
| `CHAIN_ID` | cosmoshub-4 | Cosmos Hub mainnet chain ID |
| `DENOM` | uatom | Native token denomination |

### LCD Endpoints

The bot races multiple LCD endpoints for fastest response:
- `https://api.cosmos.network`
- `https://cosmoshub.lava.build`
- `https://rest.cosmos.directory/cosmoshub`
- `https://cosmos-rest.publicnode.com`

### RPC Endpoint

- `https://cosmos-rpc.polkachu.com`

## 🏗️ Architecture

### Core Components

**`src/index.ts`**
- Exports `executeRestake()` function
- Handles wallet creation and client connection
- Orchestrates the restaking flow
- Returns structured result objects

**`src/server.ts`**
- Fastify HTTP server
- Routes for restaking and health checks
- Error handling and response formatting

**`src/config.ts`**
- Centralized configuration object
- Environment variable handling
- Network endpoints and thresholds

**`src/types.ts`**
- Zod schemas for runtime validation
- Type-safe data structures
- Address validation (cosmos and cosmosvaloper prefixes)

**`src/utils.ts`**
- `fetchWithTimeout()`: HTTP requests with timeout
- `fetchWithRetry()`: Exponential backoff retry logic
- `returnFirst()`: Race multiple requests, return first success

**`src/DiscordNotifier.ts`**
- Discord webhook integration
- Message formatting with emoji indicators
- Types: info ℹ️, error ❌, warn ⚠️, success ✅

### Restaking Flow

```
1. Create HD wallet from mnemonic
2. Connect to Cosmos RPC with SigningStargateClient
3. Query all delegations across accounts
4. Race multiple LCD endpoints to fetch rewards for each validator
5. Fetch validator metadata (jailed status, bonding status, commission rate)
6. Filter out inactive/jailed validators
   └─ Skip validators where jailed=true OR status!="BOND_STATUS_BONDED"
7. Claim rewards from validators with rewards >= MIN_REWARD_AMOUNT
   └─ 1 second delay between claims to avoid sequence conflicts
8. Check total available balance
9. If balance - RESERVE > MIN_RESTAKE_AMOUNT:
   └─ Delegate equal amounts to all ACTIVE validators
10. Return structured result
11. Disconnect client
```

### Validator Safety Features

The bot automatically filters validators to ensure restaking safety:

**Jailed Validators**: Validators that are jailed (penalized for misbehavior) are skipped
- Jailed validators cannot participate in consensus
- Delegating to jailed validators provides no rewards
- The bot checks `validator.jailed === false`

**Inactive Validators**: Only bonded (active) validators are considered
- Checks `validator.status === "BOND_STATUS_BONDED"`
- Skips validators with status "BOND_STATUS_UNBONDING" or "BOND_STATUS_UNBONDED"
- Ensures your stake earns rewards

**Validator Metadata**: The bot fetches and logs commission rates for monitoring
- Commission rate is fetched but not currently used for filtering
- You can monitor which validators you're delegating to via Discord notifications

**Error Handling**: If validator metadata cannot be fetched
- The validator is marked with `jailed=false` and `status=UNKNOWN`
- It will be included in restaking (fail-open approach)
- Warnings are logged to console

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage
pnpm test:coverage

# Run specific test suites
pnpm test:performance
pnpm test:validation
```

The test suite includes:
- Performance tests for endpoint racing
- Validation tests for Zod schemas
- Utility function tests
- 30+ test cases with 100% pass rate

## 🐳 Docker

### Build and Run Locally

```bash
# Using Docker Compose
docker compose up --build

# Or manually
docker build -t restake-bot .
docker run -e MNEMONIC="..." -e DISCORD_WEBHOOK_URL="..." -p 8080:8080 restake-bot
```

### Dockerfile Structure

**Multi-stage build:**
1. **`base`**: Node.js 22 slim + pnpm
2. **`installer`**: Install deps, run tests, build TypeScript
3. **`runner`**: Production runtime with only compiled code

## ☁️ Deployment (Fly.io)

### Initial Setup

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login to Fly
fly auth login

# Set secrets
fly secrets set MNEMONIC="word1 word2 ... word24"
fly secrets set DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
```

### Deploy

```bash
# Deploy to Fly.io
fly deploy

# Check status
fly status

# View logs
fly logs

# Scale to 0 machines (cost-saving)
fly scale count 0
```

### Auto-Scaling Configuration

The bot is configured to auto-scale based on HTTP traffic:

```toml
[http_service]
  auto_stop_machines = 'stop'
  auto_start_machines = true
  min_machines_running = 0
```

- **Min machines**: 0 (no cost when idle)
- **Auto-start**: Machines start automatically on HTTP request
- **Auto-stop**: Machines stop after handling request
- **Health checks**: Every 30 seconds on `/health`

### Monitoring

Access your deployed bot:
- **App URL**: `https://restake-bot.fly.dev/`
- **Dashboard**: `https://fly.io/apps/restake-bot/monitoring`

## 📅 Scheduling Options

Since the bot is HTTP-based, you can trigger it with any scheduler:

### 1. External Cron Service (Recommended)

Use a service like [cron-job.org](https://cron-job.org):
- **URL**: `https://restake-bot.fly.dev/`
- **Schedule**: Every 12 hours
- **Method**: GET

### 2. GitHub Actions

```yaml
name: Trigger Restaking
on:
  schedule:
    - cron: '0 */12 * * *'  # Every 12 hours
  workflow_dispatch:  # Manual trigger

jobs:
  restake:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Restaking
        run: curl -X GET https://restake-bot.fly.dev/
```

### 3. Uptime Monitoring Services

Services like UptimeRobot, Pingdom, or Better Uptime can hit your endpoint regularly while also monitoring availability.

## 📊 Example Output

### Discord Notifications

The bot sends real-time updates to Discord:

```
ℹ️ Rewards to claim: 1,250,000 uatom considering min reward amount of 200,000 uatom

ℹ️ Total available: 2,100,000 uatom. Reserve: 300,000 uatom

✅ Restaking 1,800,000 uatom to cosmosvaloper1abcd1234...
```

### HTTP Response

```json
{
  "success": true,
  "message": "Restake completed successfully",
  "data": {
    "rewardsClaimed": 1250000,
    "amountRestaked": 1800000,
    "validator": "cosmosvaloper1abcd1234...",
    "totalAvailable": 2100000
  }
}
```

## 🔧 Development

### Project Structure

```
restake-bot/
├── src/
│   ├── index.ts              # Core restaking logic
│   ├── server.ts             # Fastify HTTP server
│   ├── config.ts             # Configuration
│   ├── types.ts              # Zod schemas & types
│   ├── utils.ts              # Utility functions
│   ├── utils.spec.ts         # Utils tests
│   ├── DiscordNotifier.ts    # Discord integration
│   └── validation.test.ts    # Validation tests
├── dist/                     # Compiled JavaScript
├── Dockerfile                # Docker configuration
├── fly.toml                  # Fly.io configuration
├── package.json              # Dependencies & scripts
├── tsconfig.json             # TypeScript config
├── jest.config.js            # Jest config
└── README.md                 # This file
```

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm build` | Compile TypeScript to dist/ |
| `pnpm start` | Run HTTP server (production) |
| `pnpm start:once` | Run restaking once and exit |
| `pnpm dev` | Run HTTP server (development) |
| `pnpm dev:once` | Run restaking once (development) |
| `pnpm type-check` | Run TypeScript type checking |
| `pnpm test` | Run all tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Run tests with coverage |

### TypeScript Configuration

Strict mode enabled with extensive compiler checks:
- `strict: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
- `noImplicitReturns: true`
- `noFallthroughCasesInSwitch: true`

## 🔒 Security

### Best Practices

1. **Never commit secrets**: Use environment variables for `MNEMONIC` and `DISCORD_WEBHOOK_URL`
2. **Fly.io secrets**: Store sensitive data with `fly secrets set`
3. **HTTPS only**: Fly.io forces HTTPS for all requests
4. **Private repository**: Keep your bot code private
5. **Read-only wallet**: Consider using a dedicated wallet for restaking

### Wallet Safety

- The bot only performs delegation operations (claim rewards, delegate)
- No transfer, send, or withdrawal operations
- Maintains a reserve balance for gas fees
- All transactions use `"auto"` gas estimation

## 🐛 Troubleshooting

### Common Issues

**"No accounts found"**
- Check that `MNEMONIC` is set correctly (24 words)
- Verify mnemonic is valid for Cosmos Hub

**"No validators found"**
- Ensure you have active delegations
- Check that wallet has staked ATOM

**"No restaking needed"**
- Total available balance must exceed `MIN_RESTAKE_AMOUNT + RESERVE` (1.1 ATOM)
- Check your wallet balance

**TypeScript errors**
- Run `pnpm type-check` to see all type errors
- Ensure all dependencies are installed with `pnpm install`

**Tests failing**
- Verify Node.js version is 20+
- Run `pnpm install` to ensure dependencies are current

### Logs

**Local development:**
```bash
# Server logs to console
pnpm dev
```

**Fly.io production:**
```bash
# View real-time logs
fly logs

# View last 100 lines
fly logs --count 100
```

## 📈 Performance

### Endpoint Racing

The bot uses a race condition strategy for LCD endpoints:
- Sends requests to all endpoints simultaneously
- Returns first successful response (typically < 1 second)
- Falls back to other endpoints if first fails
- 1 second timeout per endpoint

### Gas Optimization

- Uses `"auto"` gas estimation for all transactions
- Gas price: 0.025 uatom (standard Cosmos Hub rate)
- Transactions typically cost < 10,000 uatom (< $0.001)

## 🤝 Contributing

This is a personal project, but improvements are welcome:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

ISC

## 🙏 Acknowledgments

- **CosmJS**: Cosmos blockchain JavaScript library
- **Fastify**: Fast and low overhead web framework
- **Fly.io**: Application deployment platform
- **Zod**: TypeScript-first schema validation

## 📞 Support

For issues and questions:
1. Check the [Troubleshooting](#-troubleshooting) section
2. Review [Cosmos documentation](https://docs.cosmos.network)
3. Open an issue in the repository

---

**Built with ❤️ for the Cosmos community**

🤖 *This README was generated with [Claude Code](https://claude.com/claude-code)*
