---
name: test-strategy-router
description: Classifies each file changed in a pull request into a test category and decides whether a test is warranted at all, before any test-generation skill runs. Use this first, for every PR-triggered test-writing run, before loading any category generator skill.
---

# Test Strategy Router

For every file changed in the current PR's diff, decide two things: (1) which category it belongs to, (2) whether writing or updating a test is warranted at all.

## Categories

- **api-contract** — Express routers/controllers under `backend/src/**/router.ts` or similar HTTP-boundary files. → `api-contract-tests` skill.
- **repository-data-layer** — Prisma-backed data access under `backend/src/**/repository.ts`. → `repository-tests` skill.
- **pure-function** — Validators, mappers, and other side-effect-free functions (`backend/src/**/validators.ts`, `mappers.ts`, `frontend/src/**/utils/*.ts`). → `pure-function-tests` skill.
- **react-hook** — Custom hooks under `frontend/src/**/hooks/*.ts` or `use*.ts` files anywhere. → `react-hook-tests` skill.
- **ui-component** — React components (`.tsx`, excluding `frontend/src/design-system/**`, which is a separate, already-stable library). → `ui-component-tests` skill.
- **infra-bootstrap** — App wiring, process lifecycle, shared clients, configuration: `backend/src/factory.ts`, `backend/src/main.ts`, `backend/src/core/{config,database,lifespan}.ts`, `frontend/src/lib/http.ts`, `frontend/src/lib/queryClient.ts`. → `infra-smoke-tests` skill. **Exception**: `factory.ts` specifically wires the whole Express app and is realistically testable the same way `router.ts` is (supertest against `createApp()` with a stubbed database) — treat it as `api-contract`-adjacent, not skip-by-default, unless the change is trivial.
- **not-code** — types-only files (`types.ts`), generated code (`src/generated/**`), Storybook stories, design-system internals, config/build files. Never generate tests for these.

## Skip criteria (emit `noop`, do not call a generator)

Skip a file, with a one-line reason, when:
- It's `not-code`.
- It already has adequate test coverage for the actual lines changed (check the existing `*.test.ts(x)` sibling, don't assume absence means no test).
- The change is a pure rename/formatting/comment change with no behavior difference.
- It's a hooks/components file inside `frontend/src/design-system/**` — that library has its own stable test/story surface and is out of scope for this agent.

If every changed file is skipped, the whole run is a `noop` — call the `noop` safe-output directly with a reason, do not proceed further.

## Process

1. List the PR's changed files (`git diff --name-only` against the base ref).
2. Classify each one using the categories above.
3. For each non-skipped file, note which generator skill will handle it.
4. Hand off to the matching generator skill(s), one file at a time. Do not batch unrelated files into one test file.
