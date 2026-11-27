---
name: test-verification-and-reporting
description: Formats the final PR comment summarizing what the test-writing agent did, grouped by the router's change-groups, with a top-level HTML marker that is always exactly one of three fixed values (SUCCEEDED, FAILED, SKIPPED). Use once, at the end of a run, after the real test suite has actually executed.
---

# Test Verification and Reporting

The real test run (`npm test` / `npm run test:coverage` in the relevant package) is the only thing allowed to determine pass/fail. Never report success based on the generator's or validator's opinion alone.

## Structure: one TLDR, then one section per change-group

Render the group structure `test-strategy-router` produced — don't flatten it back into one table. Each group becomes its own section with its own status badge; mixed outcomes across groups are shown as mixed, not papered over.

```
<!-- gh-aw-test-writer: <TOP-LEVEL VALUE — see rule below> -->
<!-- gh-aw-test-categories: <JSON array of category names used, see below> -->
**Test Coverage Agent — summary**

TLDR: <one or two sentences covering every group at a glance>

### <status emoji> <group name> (<change-type tag(s)>)

<one-line group TLDR>

| File | Role | Test file | Result |
|---|---|---|---|
| <source file> | <category or role within the group> | <test file, or "—" if skipped> | pass / fail / skipped — <reason if skipped> |

Validator feedback: <one line per generated file, or "no issues on first pass">

### <status emoji> <next group name> (<change-type tag(s)>)
...
```

Status emoji per group: ✅ every file in the group that needed a test got one and it passed; ❌ at least one file in the group was attempted and failed validation or the real run; ⏭ nothing in the group needed a test (all skipped, with reasons).

For "independent / ungrouped" files, use two trailing sections titled "Other backend changes" and "Other frontend changes" (omit either if empty) instead of a feature name, same table format.

## The top-level HTML marker — still exactly one of three values, now derived from the worst group outcome

- **FAILED** — any group contains a ❌.
- **SUCCEEDED** — no ❌, and at least one group has a ✅ (something was actually attempted and passed).
- **SKIPPED** — every group is ⏭ (nothing in the whole PR warranted a test).

```
<!-- gh-aw-test-writer: FAILED -->
<!-- gh-aw-test-writer: SUCCEEDED -->
<!-- gh-aw-test-writer: SKIPPED -->
```

## A second machine-readable marker for category validation

Immediately below the `gh-aw-test-writer` marker, emit one more HTML comment containing a JSON array of every category name actually used across all groups (the exact `name` values from `.github/aw/test-categories.json`, deduplicated, excluding `not-code`):

```
<!-- gh-aw-test-categories: ["api-contract","ui-component"] -->
```

This exists solely so a downstream script can deterministically validate category names without parsing the rendered tables — never invent a name here that isn't in that file.

## Constraints

- The HTML comment marker must be present, exactly one of the three values above, and must reflect the worst group outcome — never paraphrase it, and never report SUCCEEDED at the top level while a group section shows ❌.
- Within a group, never mix outcomes in a way that hides a failure — a group with one pass and one fail is marked ❌ for the whole group, with both rows shown plainly.
- This skill does not retry anything. If validation rejected a test once, that file's row shows `fail` as-is — gh-aw has no supported mechanism for a bounded in-job retry loop (confirmed: one engine invocation per agent job), so the honest behavior is a single attempt, clearly reported, not a silent swallow.
- A wrong or forced grouping is worse than no grouping — if `test-strategy-router` couldn't bind files together, report them as independent rather than inventing a feature name to tidy up the output.
