# Intelligent Oracle System

A reference app for creating, deploying, and monitoring AI-powered oracles on GenLayer. The UI and API runtime are a single Next.js App Router application backed by GenLayer intelligent contracts.

## Prerequisites

1. Node.js 20.9+ and npm 10+
2. Python 3.12+ for contract tests
3. GenLayer CLI:
   ```bash
   npm install -g genlayer
   genlayer network set studionet
   ```

The hosted Studio network (`https://studio.genlayer.com/api`) is the default. For local development with a validator network, run `genlayer init` and set the GenLayer RPC env vars to `http://localhost:4000/api`.

## Components

- `src/app` — Next.js App Router UI and route handlers
  - `/` — assistant-driven oracle configuration wizard
  - `/explorer` — oracle registry explorer
  - `/oracle/[address]` — oracle detail, transaction inspection, and resolution
  - `/api/chat` — OpenRouter-backed AI SDK streaming chat
  - `/api/bridge/deploy-intelligent-oracle` — GenLayer factory deployment bridge
- `intelligent-contracts/` — GenLayer Python contracts
- `scripts/` — separate npm package for factory deployment scripts; kept outside the root app because it has deployment-specific env and side effects
- `test/` — Python E2E tests and seed helpers

## Environment

Copy `.env.example` to `.env` and fill in:

```bash
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openai/gpt-5-mini
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

BRIDGE_PRIVATE_KEY=0x...
GENLAYER_RPC_URL=https://studio.genlayer.com/api
IC_REGISTRY_ADDRESS=0x...

NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api
NEXT_PUBLIC_IC_REGISTRY_ADDRESS=0x...
```

`OPENROUTER_*`, `BRIDGE_PRIVATE_KEY`, `GENLAYER_RPC_URL`, and `IC_REGISTRY_ADDRESS` are server-only. `NEXT_PUBLIC_*` values are used by the browser explorer.

## Development

```bash
npm install
npm run dev

# Deploy the factory
cd scripts && npm install && cp .env.example .env && npm run deploy

# Contract linting
genvm-lint check intelligent-contracts/IntelligentOracle.py
genvm-lint check intelligent-contracts/IntelligentOracleFactory.py

# Tests
npm run check

python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r test/requirements.txt
python -m pytest test/
```

`npm run check` runs lint, TypeScript, unit tests, and the production Next.js build for the root UI/API app. The `scripts/` package is installed and run separately only when intentionally deploying contracts.

## Tech Stack

- Next.js 16 App Router, React 19, TypeScript
- Tailwind CSS v4
- Vercel AI SDK v6 with `@ai-sdk/react` and `@openrouter/ai-sdk-provider`
- `genlayer-js` 1.x
- GenVM Python intelligent contracts

## License

MIT
