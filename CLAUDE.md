# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project Overview

GenLayer Intelligent Oracle system — a single Next.js application for creating, deploying, and monitoring prediction-market oracles powered by GenLayer intelligent contracts. The app targets hosted GenLayer Studio (`studionet` — `https://studio.genlayer.com/api`) by default and can be pointed at localnet or testnets via env vars.

## Module Structure

- `src/app` — Next.js App Router UI and route handlers.
- `src/components` — React UI components for the assistant wizard and explorer.
- `src/lib` — shared validation, AI message parsing, GenLayer hooks, and display helpers.
- `intelligent-contracts/` — GenLayer Python contracts using `gl.Contract`, `gl.eq_principle.prompt_comparative`, `gl.nondet.web.get`, and `gl.nondet.exec_prompt`.
- `scripts/` — separate npm package for factory deployment using `genlayer-js` 1.x. Keep it outside root app commands unless the user explicitly wants to deploy.
- `test/` — Python E2E tests and seed helpers.

## Build & Run

```bash
npm install
cp .env.example .env
npm run dev

npm run lint
npm run typecheck
npm run test
npm run build

# Or run the standard root verification sequence:
npm run check
```

Deploy contracts with:

```bash
cd scripts && npm install && cp .env.example .env && npm run deploy
```

## Claude Skills

Project-specific skills live in `.claude/skills/`. The GenLayer development skills were adapted from `genlayerlabs/skills` for this repo's layout:

- `write-contract` — edit `intelligent-contracts/` safely and keep the app/deploy ABI aligned.
- `genvm-lint` — run GenVM lint/schema/type checks against `intelligent-contracts/*.py`.
- `direct-tests` — run and extend direct-mode pytest coverage under `test/`.
- `integration-tests` — plan intentional live Studio/testnet checks without treating them as routine verification.
- `genlayer-cli` — inspect networks, accounts, receipts, schemas, and deployed contracts.
- `deploy` — user-invoked factory deployment through the separate `scripts/` package.
- `verify` — standard root verification plus optional Python contract tests.

## Environment

- Server-only: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_BASE_URL`, `BRIDGE_PRIVATE_KEY`, `GENLAYER_RPC_URL`, `IC_REGISTRY_ADDRESS`.
- Browser: `NEXT_PUBLIC_GENLAYER_RPC_URL`, `NEXT_PUBLIC_IC_REGISTRY_ADDRESS`.
- Default RPC points at hosted Studio. Override both GenLayer RPC env vars for localnet or testnets.

## Tech Stack

- Frontend/runtime: Next.js 16 App Router, React 19, Tailwind v4.
- AI: Vercel AI SDK v6, `@ai-sdk/react`, `@openrouter/ai-sdk-provider`.
- GenLayer: `genlayer-js` 1.x plus Python GenVM contracts.
- Tests: Vitest for shared TypeScript helpers, pytest for contract E2E.

## Git Conventions

Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
