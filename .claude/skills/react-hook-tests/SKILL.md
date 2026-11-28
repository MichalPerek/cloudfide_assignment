---
name: react-hook-tests
description: Writes or updates Vitest + React Testing Library tests for custom React hooks in the frontend, including TanStack Query hooks. Use after test-strategy-router classifies a changed file as react-hook.
---

# React Hook Tests

Follow `frontend/src/hooks/useNotice.test.ts` for plain hooks. For hooks built on `@tanstack/react-query` (`useTodosQuery`, `useCreateTodoMutation`, `useDeleteTodoMutation`, `useUpdateTodoMutation`, `useTodosBusy`, `useTodoFilters` — currently untested), the convention needs one addition the existing test suite doesn't show yet, since none of these hooks have tests: wrap `renderHook` with a `QueryClientProvider` using a fresh `new QueryClient()` per test (disable retries so failures don't hang the test), and mock the underlying API module the same way `frontend/src/features/todos/api/todos.test.ts` mocks `lib/http`'s `request` — never mock `@tanstack/react-query` itself.

**File extension**: the wrapper you pass to `renderHook`'s `wrapper` option renders `<QueryClientProvider>`, which is JSX — name the test file `*.test.tsx`, never `*.test.ts`, even though the hook itself lives in a `.ts` file. If the wrapper's `children` prop needs a type annotation, import it explicitly (`import type { ReactNode } from 'react'`) rather than writing the bare `React.ReactNode` namespace reference — this repo's JSX runtime doesn't give you an implicit `React` import, so an unimported `React.ReactNode` fails typecheck with `TS2503: Cannot find name 'React'`.

## Required pattern

- Use `renderHook` from `@testing-library/react`.
- For query hooks: assert the hook reaches a loaded/error state via `waitFor`, and that it called the underlying API function with the expected arguments — mirror how `todos.test.ts` asserts `request` was called with the right path/body, one layer up.
- For mutation hooks: call the returned `mutate`/`mutateAsync`, assert the API call shape, and assert any query-invalidation side effect only if the hook's own source declares one — don't invent behavior the hook doesn't have.
- For plain hooks (no React Query): assert the initial state and that returned callbacks are functions / produce the expected state transition, matching `useNotice.test.ts`'s minimalism.

## Constraints

- Never hit a real network endpoint — always mock the API module, not `fetch` globally, to stay consistent with the existing `todos.test.ts` convention.
- Don't test TanStack Query's own caching/retry machinery — only this hook's usage of it.
