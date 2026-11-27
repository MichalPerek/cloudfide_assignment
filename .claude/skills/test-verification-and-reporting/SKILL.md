---
name: test-verification-and-reporting
description: Formats the final PR comment summarizing what the test-writing agent did, using exactly one of three fixed templates (SUCCEEDED, FAILED, SKIPPED). Use once, at the end of a run, after the real test suite has actually executed.
---

# Test Verification and Reporting

The real test run (`npm test` / `npm run test:coverage` in the relevant package) is the only thing allowed to determine pass/fail. Never report success based on the generator's or validator's opinion alone.

## The three templates — use exactly one, verbatim structure

**SUCCEEDED** — the real test run passed for every file touched this run.

```
<!-- gh-aw-test-writer: SUCCEEDED -->
**Test Coverage Agent — tests added/updated and passing**

| File | Category | Test file | Result |
|---|---|---|---|
| <source file> | <category> | <test file> | pass |

Validator feedback: <one line per file, or "no issues on first pass">
```

**FAILED** — at least one attempted file's test did not pass after the single generate-then-validate pass (no retry loop — see constraints).

```
<!-- gh-aw-test-writer: FAILED -->
**Test Coverage Agent — could not produce a passing test**

| File | Category | Issue |
|---|---|---|
| <source file> | <category> | <validator rejection reason, or test failure output, whichever applies> |

No changes were committed or suggested for these files.
```

**SKIPPED** — the router determined no file in this PR warranted a new/updated test.

```
<!-- gh-aw-test-writer: SKIPPED -->
**Test Coverage Agent — no test changes needed**

<one line per changed file, with the router's skip reason>
```

## Constraints

- The HTML comment marker (`<!-- gh-aw-test-writer: ... -->`) must be present and exactly match one of the three values — it's the only machine-parseable signal distinguishing these outcomes in the PR comment log. Don't paraphrase it.
- Never mix outcomes in one comment (e.g. some files succeeded, one failed) without using the FAILED template for the whole comment — partial success still needs explicit, visible accounting of what didn't work, not a happy-sounding summary that omits it.
- This skill does not retry anything. If validation rejected a test once, that file goes in the FAILED table as-is — gh-aw has no supported mechanism for a bounded in-job retry loop (confirmed: one engine invocation per agent job), so the honest behavior is a single attempt, clearly reported, not a silent swallow.
