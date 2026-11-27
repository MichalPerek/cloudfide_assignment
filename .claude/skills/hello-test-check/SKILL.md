---
name: hello-test-check
description: Reports how many files changed in the current pull request. Minimal end-to-end check that the agentic workflow pipeline (engine, skill loading, safe-outputs comment path) actually works, before the real test-writing pipeline is built on top of it.
---

# Hello Test Check

Count the files changed in this pull request's diff and report that number.

## Process

1. Run `git diff --name-only origin/main...HEAD` to list changed files.
2. Count them.
3. Report: "Minimal pipeline check: N file(s) changed in this PR: <list>."

## Constraints

- Do not modify any files.
- Do not run any test commands.
- This skill exists only to prove the workflow, engine, and safe-outputs comment path work end-to-end. It is not part of the real test-writing pipeline.
