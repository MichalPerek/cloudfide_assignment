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
# Scope: only lines a PR actually ADDS to a *.test.tsx file are checked, not
# a touched file's full pre-existing content. An earlier version grepped the
# whole file whenever it appeared in the changed-files list, so touching a
# single unrelated line in an old test file (e.g. adding a new mock import)
# re-flagged that file's pre-existing, untouched violations as if this PR
# had introduced them - a real false positive, caught live on PR #39.

BASE_REF="${GITHUB_BASE_REF:-main}"

CHANGED_TEST_FILES=$(git diff --name-only --diff-filter=ACM "origin/${BASE_REF}...HEAD" -- '*.test.tsx' || true)

if [ -z "$CHANGED_TEST_FILES" ]; then
  echo "validate-test-conventions: no changed *.test.tsx files in this PR, nothing to check."
  exit 0
fi

FAIL=0

check_pattern() {
  local file="$1" pattern="$2" message="$3"
  local hits="" new_line=0 content

  while IFS= read -r diff_line; do
    if [[ "$diff_line" =~ ^@@\ -[0-9]+(,[0-9]+)?\ \+([0-9]+) ]]; then
      new_line="${BASH_REMATCH[2]}"
      continue
    fi
    [[ "$diff_line" == "+++"* || "$diff_line" == "---"* ]] && continue
    if [[ "$diff_line" == +* ]]; then
      content="${diff_line#+}"
      if [[ "$content" =~ $pattern ]]; then
        hits+="$new_line: $content"$'\n'
      fi
      new_line=$((new_line + 1))
    fi
    # removed ('-') lines don't consume a new-file line number
  done < <(git diff -U0 "origin/${BASE_REF}...HEAD" -- "$file")

  if [ -n "$hits" ]; then
    echo "::error file=$file::validate-test-conventions: $message"
    printf '%s' "$hits"
    return 1
  fi
  return 0
}

while IFS= read -r FILE; do
  [ -z "$FILE" ] && continue
  [ -f "$FILE" ] || continue

  check_pattern "$FILE" '\bfireEvent\b' \
    "uses fireEvent directly; convention requires userEvent.setup() (see ui-component-tests/SKILL.md)." || FAIL=1

  check_pattern "$FILE" '(getByTestId|queryByTestId|getAllByTestId|queryAllByTestId|findByTestId|data-testid)' \
    "queries or sets a test-id; convention requires querying by role/accessible text, not test-id." || FAIL=1

  check_pattern "$FILE" '\btoMatchSnapshot\b' \
    "uses snapshot testing; this repo's convention is behavior-assertion tests only, not snapshots." || FAIL=1
done <<< "$CHANGED_TEST_FILES"

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi

echo "validate-test-conventions: OK, all added *.test.tsx lines follow convention."
exit 0
