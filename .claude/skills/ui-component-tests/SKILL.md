---
name: ui-component-tests
description: Writes or updates Vitest + React Testing Library tests for feature-level React components in the frontend, following this repo's existing component test conventions. Use after test-strategy-router classifies a changed file as ui-component.
---

# UI Component Tests

Follow `frontend/src/features/todos/components/TodoItem.test.tsx` and sibling `*.test.tsx` files exactly.

## Required pattern

- Render with `render` from `@testing-library/react`; drive interaction with `userEvent.setup()`, never `fireEvent` directly, to match the existing suite.
- Query by role/accessible name (`getByRole`, `getByText`) — never by test-id or class name, matching the existing style.
- If the component imports from the design system, mock it with `vi.mock('<path-to-design-system>', () => import('<path-to-design-system>/mocks'))` exactly like `TodoItem.test.tsx` does — the design system has its own dedicated mocks module for this.
- Pass callback props as `vi.fn()` and assert both: the one that should fire did (with the right call count), and the ones that shouldn't fire didn't.

## Required coverage for any new/changed component

- The default rendered state (what's visible, what text/labels appear).
- Each interactive affordance (button/checkbox/input) produces its documented callback, once.
- Conditional rendering branches (e.g. busy/disabled state, empty state) — one case each.

## Constraints

- Don't test `frontend/src/design-system/**` components — that library is out of scope (see `test-strategy-router`'s skip criteria).
- Don't snapshot-test; this repo's existing tests are all behavior-assertion style, not snapshots — stay consistent.
