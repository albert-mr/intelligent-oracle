# AGENTS.md

Guidance for Codex agents working in this repository.

## Project Shape

This repo is a single root Next.js App Router application for creating, deploying, and monitoring GenLayer intelligent oracles.

- `src/app` contains pages and route handlers:
  - `/`
  - `/explorer`
  - `/oracle/[address]`
  - `/api/chat`
  - `/api/bridge/deploy-intelligent-oracle`
- `src/components` contains React UI components for the wizard and explorer.
- `src/lib` contains shared validation, AI message parsing, GenLayer client hooks, transaction normalization, and display helpers.
- `intelligent-contracts/` contains GenLayer Python contracts.
- `scripts/` is a separate npm package for factory deployment. Keep it separate from root app commands unless the user explicitly wants to deploy.
- `test/` contains Python direct-mode contract tests and helpers.

The old `bridge`, `explorer`, and `ui-wizard` app folders were intentionally removed during the Next.js migration. Do not recreate them.

## Commands

Root UI/API verification:

```bash
npm run check
```

Individual root checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Python contract tests:

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r test/requirements.txt
python -m pytest test/ -v
```

GenVM lint:

```bash
genvm-lint check intelligent-contracts/*.py
```

Factory deployment is user-invoked only:

```bash
cd scripts && npm install && cp .env.example .env && npm run deploy
```

## Environment

Server-only env vars:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OPENROUTER_BASE_URL`
- `BRIDGE_PRIVATE_KEY`
- `GENLAYER_RPC_URL`
- `IC_REGISTRY_ADDRESS`

Browser env vars:

- `NEXT_PUBLIC_GENLAYER_RPC_URL`
- `NEXT_PUBLIC_IC_REGISTRY_ADDRESS`

Hosted Studio defaults to `https://studio.genlayer.com/api`. If using local Studio, update both server and browser GenLayer RPC env vars.

## AI And GenLayer Boundaries

- Non-contract chat/assistant AI belongs in the root Next app using Vercel AI SDK and OpenRouter.
- Contract resolution AI stays inside GenLayer contracts through `gl.nondet.exec_prompt` and GenLayer equivalence principles.
- Do not move GenLayer contract AI calls into `/api/chat` or other Next route handlers.

## Contract ABI Caution

The app and deploy script depend on these public contract methods:

- Registry `__init__(intelligent_oracle_code: str)`
- Registry `create_new_prediction_market(...)`
- Registry `get_contract_addresses()`
- Oracle `__init__(prediction_market_id, title, description, potential_outcomes, rules, data_source_domains, resolution_urls, earliest_resolution_date)`
- Oracle `resolve(evidence_url: str = "")`
- Oracle `get_dict()`
- Oracle `get_status()`

If any of these change, update the Next API route, GenLayer hooks, deploy script, and Python tests together.

## Local Guidance

- Prefer existing patterns in `src/lib` and `src/components`.
- Use Zod schemas for user/API boundary validation.
- Keep route handlers in `src/app/api/**/route.ts`.
- Keep UI client behavior in client components.
- Do not run deployment commands as routine verification.
- `.claude/skills/` contains GenLayer-specific workflow notes adapted from `genlayerlabs/skills`; consult them when changing contracts, deployment behavior, or GenLayer testing.
