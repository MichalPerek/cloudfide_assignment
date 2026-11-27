---
name: repository-tests
description: Writes or updates Vitest tests for Prisma-backed repository classes in the backend, using the repo's Prisma-IO-mock convention. Use after test-strategy-router classifies a changed file as repository-data-layer.
---

# Repository Tests

Follow `backend/tests/repository.test.ts` and `backend/tests/fixture.ts` exactly.

## Required pattern

- Construct the **real** Prisma delegate via `createDatabase(...)` — never a hand-rolled mock object. Mock only its I/O with `vi.spyOn(database.<model>, '<method>')`. This is deliberate: it exercises the real Prisma client shape, with no PostgreSQL needed.
- Use the shared fixtures in `backend/tests/fixture.ts` (`record` = raw DB row, `todo` = mapped domain object) rather than inventing new fixture data, unless the change requires a new shape — then add to `fixture.ts`, don't inline duplicate fixtures.
- Always call `vi.restoreAllMocks()` in `afterEach` (match the existing file-level `afterEach`).

## Required coverage for any new/changed repository method

- The success path, asserting both the mapped return value (`toEqual(todo)`-style, domain shape not raw row) and the exact arguments passed to the Prisma delegate.
- Missing/not-found handling (`mockResolvedValueOnce(null)` or empty-array cases), if applicable.
- Edge cases in input shape the method itself branches on (e.g. optional fields, `due_date` present vs `null` — see the `it.each(['2026-10-15', null])` pattern).
- Error propagation: mock the delegate to reject and assert the repository lets the error through, unless it's documented to handle it.

## Constraints

- Never assert against the raw Prisma delegate call count alone without also checking the returned, mapped value — a test that only checks "was called" without checking "returned the right thing" is not acceptable here.
- Don't duplicate assertions already covered by `backend/src/features/todos/mappers.test.ts` — the mapping-shape itself is that file's job.
