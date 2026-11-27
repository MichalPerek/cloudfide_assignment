---
name: pure-function-tests
description: Writes or updates Vitest tests for pure, side-effect-free functions (validators, mappers, utilities) in either the backend or frontend. Use after test-strategy-router classifies a changed file as pure-function.
---

# Pure Function Tests

These files (`backend/src/features/todos/{validators,mappers}.ts`, `frontend/src/features/todos/utils/todos.ts`, similar) are gated at **100% per-file coverage** in `backend/vitest.config.ts` for the backend pair, and should be held to the same bar in spirit everywhere else, because they're small, deterministic, and cheap to cover completely.

## Required pattern

- One `it`/`it.each` per logically distinct input class, not per line. Prefer `it.each` for a function that branches on a small enumerable set of cases (see `router.test.ts`'s invalid-input table for the style).
- No mocking — these functions take plain values and return plain values. If a "pure" function needs a mock to test, it's probably not pure; flag that instead of forcing a test.
- Assert the actual return value, not just "did not throw."

## Required coverage for any new/changed pure function

- Every branch (if/else, ternary, early return) at least once.
- Boundary values for anything with a numeric/length constraint (e.g. a 120-char title limit: test 120, 121, and a normal length — not just "valid" and "invalid").
- At least one case for each distinct error/throw path, asserting the exact error via `.toThrow('message')`, matching the existing style.

## Constraints

- Don't test indirectly through the router or repository — that's `api-contract-tests`'/`repository-tests`' job. Test the function directly, imported and called on its own.
