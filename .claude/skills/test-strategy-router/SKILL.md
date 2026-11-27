---
name: test-strategy-router
description: Groups a pull request's changed files into logical change-groups (fullstack feature, backend-only, frontend-only) and classifies each file into a test category, deciding whether a test is warranted at all, before any test-generation skill runs. Use this first, for every PR-triggered test-writing run, before loading any category generator skill.
---

# Test Strategy Router

Two passes over the PR's changed files, in order: (1) group them into logical change-groups, (2) classify each file within its group into a test category and decide whether a test is warranted.

## Pass 1: group changes into logical units

Don't report a flat list of unrelated-looking files when they're actually one feature. Read the diff as a whole first and look for real coupling signals before grouping — a shared identifier (a new field, route path, or exported name that appears on both sides), a backend change whose only consumer in this PR is a specific frontend file, or a commit/PR description that names one feature. Grouping on vibes alone (two files just happen to be in the same PR) is wrong — require an actual traceable link.

- **Fullstack feature group** — a backend change and a frontend change that are genuinely coupled this way (e.g. a new endpoint/field the frontend's new hook or component consumes in the same diff). Name the group after the feature, not the files (e.g. "Clear completed todos", not "router.ts + useX.ts").
- **Backend-only group** — backend files that change together for one reason, with no frontend counterpart in this diff.
- **Frontend-only group** — same, for frontend-only changes.
- **Independent / ungrouped** — anything that doesn't bind to anything else. Don't force a file into a group for the sake of tidiness — list it on its own, bucketed as backend or frontend. A wrong grouping is worse than no grouping, because it misrepresents what actually changed.

Tag every group (fullstack feature groups especially) with a change-type label describing what kind of change it is, for the reporting skill to show: `UI change`, `API integration change`, `hook change`, `backend logic change`, `manual test update`, `infra change`, or a combination when a group spans more than one (e.g. a fullstack group is typically `API integration change + hook change + UI change`).

## Pass 2: classify each file within its group

For every file, decide two things: (1) which category it belongs to, (2) whether writing or updating a test is warranted at all.

## Categories

The categories below are a human-readable mirror of `.github/aw/test-categories.json`, which is the authoritative, machine-checked list. If this list and that file ever disagree, `.github/aw/test-categories.json` wins — use its `name` values verbatim when classifying files and when handing category names to the reporting skill, and flag the mismatch rather than silently picking one.

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
2. Group them per Pass 1, with a name and change-type tag for each group (or "independent", bucketed backend/frontend).
3. Within each group, classify each file using the categories above (Pass 2).
4. For each non-skipped file, note which generator skill will handle it.
5. Hand off to the matching generator skill(s), one file at a time. Do not batch unrelated files into one test file — grouping is for reporting, not for merging multiple files' tests into one.
6. Pass the full group structure (name, change-type tag, member files, per-file category/skip decision) to `test-verification-and-reporting` once results are in — it renders the report by group, not as one flat table.
