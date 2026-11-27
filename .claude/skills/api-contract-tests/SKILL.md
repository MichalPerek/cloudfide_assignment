---
name: api-contract-tests
description: Writes or updates Vitest + Supertest tests for Express routers/controllers in the backend, following this repo's existing router test conventions. Use after test-strategy-router classifies a changed file as api-contract.
---

# API Contract Tests

Follow the conventions in `backend/tests/router.test.ts` exactly — don't invent a different style.

## Required pattern

- Build the router with a **stubbed repository**: a plain object with `vi.fn()` for each method the router calls, pre-seeded with `mockResolvedValue(...)` where needed. Never use a real database or the real repository in these tests.
- Mount the router on a fresh `express()` app with `express.json()`, exactly like the existing `setup()` helper.
- Drive requests with `supertest`.
- Assert three things per case: HTTP status code, response body shape, and that the stubbed repository method was called with the expected arguments (or not called at all, for rejected input).

## Required coverage for any new/changed endpoint

- The happy path (valid input, correct status + body).
- Each distinct validation failure the route can produce, as `it.each` cases, each asserting a 4xx status **and** that the repository was never called.
- Not-found / empty-result handling if the route can produce it.
- Exactly one assertion style per response check — don't mix `toMatchObject` and `toEqual` within the same test file without reason.

## Constraints

- Never add a real network call, a real Prisma client, or a real Express error-handling bypass.
- Don't test framework behavior (Express routing itself) — only this route's own logic.
- If the file is `backend/src/factory.ts` (testing the whole app, not a single router), still use supertest + a stubbed database, following `backend/tests/router.test.ts` for request/assertion style, but construct via `createApp(database)` instead of mounting a bare router.
