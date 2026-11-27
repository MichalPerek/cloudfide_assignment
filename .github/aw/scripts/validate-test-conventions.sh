#!/usr/bin/env bash
set -euo pipefail

# validate-test-conventions.sh
#
# Deterministic check that changed/added React component test files follow
# this repo's stated convention (ui-component-tests/SKILL.md): drive
# interaction with userEvent, never fireEvent directly; query by role/text,
# never by test-id; no snapshot testing. Prose in the skill is not
# enforcement on its own, this script is.
#
# Scope: only *.test.tsx files added or modified in this PR. Pre-existing
# test files the PR doesn't touch are never re-checked, so this can't fail
# on legacy code outside the PR's own diff.

BASE_REF="${GITHUB_BASE_REF:-main}"

CHANGED_TEST_FILES=$(git diff --name-only --diff-filter=ACM "origin/${BASE_REF}...HEAD" -- '*.test.tsx' || true)

if [ -z "$CHANGED_TEST_FILES" ]; then
  echo "validate-test-conventions: no changed *.test.tsx files in this PR, nothing to check."
  exit 0
fi

FAIL=0

while IFS= read -r FILE; do
  [ -z "$FILE" ] && continue
  [ -f "$FILE" ] || continue

  HITS=$(grep -nE '\bfireEvent\b' "$FILE" || true)
  if [ -n "$HITS" ]; then
    echo "::error file=$FILE::validate-test-conventions: uses fireEvent directly; convention requires userEvent.setup() (see ui-component-tests/SKILL.md)."
    echo "$HITS"
    FAIL=1
  fi

  HITS=$(grep -nE '(getByTestId|queryByTestId|getAllByTestId|queryAllByTestId|findByTestId|data-testid)' "$FILE" || true)
  if [ -n "$HITS" ]; then
    echo "::error file=$FILE::validate-test-conventions: queries or sets a test-id; convention requires querying by role/accessible text, not test-id."
    echo "$HITS"
    FAIL=1
  fi

  HITS=$(grep -nE '\btoMatchSnapshot\b' "$FILE" || true)
  if [ -n "$HITS" ]; then
    echo "::error file=$FILE::validate-test-conventions: uses snapshot testing; this repo's convention is behavior-assertion tests only, not snapshots."
    echo "$HITS"
    FAIL=1
  fi
done <<< "$CHANGED_TEST_FILES"

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi

echo "validate-test-conventions: OK, all changed *.test.tsx files follow convention."
exit 0
