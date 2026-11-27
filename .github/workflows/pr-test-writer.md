---
description: |
  Minimal end-to-end slice of the PR test-writing agent pipeline. Confirms
  the gh-aw workflow, Claude engine, skill loading, and safe-outputs comment
  path all work together before the full pipeline is built.

on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: read

network: defaults

tools:
  bash: ["git", "ls", "cat", "wc"]

safe-outputs:
  add-comment:
    max: 1

engine: claude
---

# PR Test Writer — Minimal Slice

Use the `hello-test-check` skill to report how many files changed in this pull
request. Post the result as a single PR comment.

Do not write or modify any files. Do not run any test commands yet — this is
a minimal pipeline check only, to prove the workflow runs end-to-end before
the real test-generation pipeline is built.
