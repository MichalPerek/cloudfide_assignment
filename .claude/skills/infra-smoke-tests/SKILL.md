---
name: infra-smoke-tests
description: Writes minimal smoke tests, or explicitly decides to skip, for infrastructure/bootstrap code (app wiring, config, database/process lifecycle, shared HTTP clients) that doesn't fit the feature-test categories. Use after test-strategy-router classifies a changed file as infra-bootstrap.
---

# Infra Smoke Tests

This category exists because files like `backend/src/core/{config,database,lifespan}.ts`, `backend/src/main.ts`, and `frontend/src/lib/{http,queryClient}.ts` don't cleanly fit a feature-test category — they're composition/bootstrap code, not business logic. Don't force them through `api-contract-tests` or `pure-function-tests`.

## Decision rule

For each file, pick exactly one:

1. **Skip, with a stated reason** — appropriate when the file's only job is process wiring with no meaningfully-testable branch (e.g. `main.ts`'s `app.listen(...)` call, `lifespan.ts`'s signal-handler registration). State the reason in the skip output; don't silently drop it.
2. **Minimal smoke test** — appropriate when the file has at least one decision point worth catching regressions on: does it throw on bad input, does it return the expected shape, does it wire the pieces it claims to. Example: `frontend/src/lib/http.ts`'s `request` wrapper — test that it builds the right URL/headers and surfaces a non-2xx response as a thrown error, without needing a real server (mock the global `fetch` directly here — this is the one category where mocking `fetch` globally is appropriate, since `http.ts` is the thing that wraps it).
3. **Treat as `api-contract`** — `backend/src/factory.ts` specifically: it wires the whole Express app (`createApp`), and is realistically testable the same way `router.ts` is. Use `api-contract-tests`' pattern (`supertest` against `createApp(database)` with a stubbed database) rather than skipping it or writing a trivial smoke test — a change to `factory.ts` (route wiring, error-handler behavior, 404 fallback) is exactly the kind of regression a real request-level test catches.

## Constraints

- Never fabricate a test just to produce a file — a smoke test with no real assertion (e.g. `expect(true).toBe(true)`, or `expect(fn).not.toThrow()` with no other check) is worse than skipping, because the independent validator will reject it anyway and it wastes the single generation attempt.
