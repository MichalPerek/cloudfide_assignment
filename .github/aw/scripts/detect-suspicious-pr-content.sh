#!/usr/bin/env bash
# detect-suspicious-pr-content.sh
#
# Early-abort tripwire for the pr-test-writer gh-aw workflow.
#
# Runs as a `pre-agent-steps` entry, i.e. AFTER the repository/PR branch is
# checked out but BEFORE the Claude engine step executes. Scans the PR title,
# body, and diff (against the base ref) for known indirect-prompt-injection
# and malicious-intent signals. On a high-confidence match it prints a clear
# audit trail to the Actions log and exits non-zero, which fails the job and
# aborts every step after it (including the LLM step) — so the agent never
# reads the content and no API cost is spent on it.
#
# This is a heuristic/regex tripwire, not a complete defense. See the report
# that ships alongside this script for the honest limitations writeup.
#
# Inputs (env vars set by the calling workflow step):
#   PR_TITLE        - github.event.pull_request.title
#   PR_BODY         - github.event.pull_request.body
#   GITHUB_BASE_REF - set automatically by GitHub Actions for pull_request
#                     events (base branch name, e.g. "main").
#
# Exit codes:
#   0 - no high-confidence match found (or nothing to scan); job continues.
#   1 - at least one high-confidence match found; job (and the whole
#       workflow run, since nothing after this step can run) is aborted.
#
# Security note on how PR_TITLE/PR_BODY must be wired in the workflow YAML:
# they MUST be passed via `env:`, never interpolated directly into the
# `run:` script body as `${{ github.event.pull_request.title }}`. Actions
# performs textual substitution of `${{ }}` expressions before the shell
# ever runs, so interpolating attacker-controlled PR text directly into a
# script is itself a shell-injection vector. Reading it back out of
# `$PR_TITLE`/`$PR_BODY` here is safe because the shell treats it as plain
# data, never as script text.

set -euo pipefail

SCAN_DIR="$(mktemp -d)"
trap 'rm -rf "$SCAN_DIR"' EXIT

TITLE_FILE="$SCAN_DIR/title.txt"
BODY_FILE="$SCAN_DIR/body.txt"
DIFF_FILE="$SCAN_DIR/diff.txt"

printf '%s' "${PR_TITLE:-}" > "$TITLE_FILE"
printf '%s' "${PR_BODY:-}" > "$BODY_FILE"
: > "$DIFF_FILE"

echo "::group::detect-suspicious-pr-content: computing PR diff"
if [ -n "${GITHUB_BASE_REF:-}" ]; then
  # Same convention already used elsewhere in this repo for diffing a PR
  # against its base (see .claude/skills/hello-test-check/SKILL.md).
  if git diff "origin/${GITHUB_BASE_REF}...HEAD" > "$DIFF_FILE" 2>/dev/null; then
    echo "Diff computed against origin/${GITHUB_BASE_REF}...HEAD ($(wc -l < "$DIFF_FILE" | tr -d ' ') lines)."
  else
    echo "WARNING: 'git diff origin/${GITHUB_BASE_REF}...HEAD' failed (e.g. ref not fetched deep enough)." >&2
    echo "Continuing with title/body scan only; diff content will NOT be checked." >&2
  fi
else
  echo "WARNING: GITHUB_BASE_REF is not set. Continuing with title/body scan only." >&2
fi
echo "::endgroup::"

FOUND=0

# label::pattern pairs (Perl-compatible regex, matched with `perl`, not
# `grep -P`: BSD/macOS grep has no -P support at all, and even where -P is
# available its behavior varies across grep implementations, whereas perl
# ships by default on GitHub Actions' ubuntu-latest runners and gives
# consistent PCRE semantics, including \x{...} unicode escapes, everywhere
# this script runs. Kept as parallel arrays for bash 3.2 compatibility
# (no associative arrays, no mapfile).
LABELS=()
PATTERNS=()

add_pattern() {
  LABELS+=("$1")
  PATTERNS+=("$2")
}

# --- Classic prompt-injection phrasing -------------------------------------
add_pattern "prompt-injection" '(?i)ignore\s+(all\s+|any\s+)?(the\s+)?(previous|above|prior)\s+instructions'
add_pattern "prompt-injection" '(?i)disregard\s+(all\s+|any\s+)?(the\s+)?(above|previous|prior)'
add_pattern "prompt-injection" '(?i)\byou\s+are\s+now\s+(a|an|the)\b'
add_pattern "prompt-injection" '(?i)\bnew\s+instructions\s*:'
add_pattern "prompt-injection" '(?i)\bsystem\s+prompt\b'
add_pattern "prompt-injection" '(?i)reveal\s+(your|the)\s+(system\s+)?(instructions|prompt)'
add_pattern "prompt-injection" '(?i)\bforget\s+(everything|all)\b.{0,30}\b(told|instructed|said)\b'
add_pattern "prompt-injection" '(?i)\bact\s+as\s+(if\s+you\s+(are|were)|an?\s+unrestricted)\b'
add_pattern "prompt-injection" '(?i)\boverride\s+(your|the)\s+(instructions|rules|guidelines|safety)\b'
add_pattern "prompt-injection" '(?i)\bdo\s+anything\s+now\b'
add_pattern "prompt-injection" '(?i)\bjailbreak\b'

# --- Secret / environment exfiltration attempts ----------------------------
add_pattern "secret-exfil" 'ANTHROPIC_API_KEY'
add_pattern "secret-exfil" 'process\.env'
add_pattern "secret-exfil" '\bsecrets\.[A-Za-z_][A-Za-z0-9_]*'
add_pattern "secret-exfil" '\$\{?GITHUB_TOKEN\}?\b'
add_pattern "secret-exfil" '(?i)\bgh_token\b'
add_pattern "secret-exfil" '(?i)\bprintenv\b'
add_pattern "secret-exfil" '(?i)\benv\s*\|\s*curl\b'

# --- Suspicious shell / network / exec patterns -----------------------------
add_pattern "suspicious-exec" '(?i)\bcurl\s+'
add_pattern "suspicious-exec" '(?i)\bwget\s+'
add_pattern "suspicious-exec" '(?i)base64\s+-d.{0,40}\|\s*(sh|bash|zsh)\b'
add_pattern "suspicious-exec" '(?i)\|\s*(sh|bash|zsh)\s*$'
add_pattern "suspicious-exec" 'eval\s*\('
add_pattern "suspicious-exec" '/dev/tcp/'
add_pattern "suspicious-exec" '(?i)\bnc\s+-e\b'
add_pattern "suspicious-exec" '(?i)\bbash\s+-i\s+>&'

# --- Invisible / zero-width unicode used to hide text -----------------------
# Zero-width space, ZWNJ, ZWJ, word joiner, BOM.
add_pattern "invisible-unicode" '[\x{200B}\x{200C}\x{200D}\x{2060}\x{FEFF}]'
# Unicode "Tags" block (U+E0000-U+E007F) used in ASCII-smuggling attacks to
# hide instructions inside otherwise-invisible characters.
add_pattern "invisible-unicode" '[\x{E0000}-\x{E007F}]'

MAX_SNIPPET_LEN=200

# Run one pattern against one file with perl, printing "<lineno>:<text>" per
# matching line (same shape as `grep -n`). perl is used instead of `grep -P`
# because BSD/macOS grep has no -P support at all, and GNU grep's -P support
# is a compile-time option, so `grep -P` is not reliably portable across the
# environments this script might run or be tested in; perl ships by default
# on GitHub Actions' ubuntu-latest runners and gives consistent PCRE
# semantics, including \x{...} unicode escapes, everywhere.
run_pattern() {
  local pat="$1" file="$2"
  PATTERN="$pat" perl -CSD -ne 'print "$.:$_" if /$ENV{PATTERN}/' "$file" 2>/dev/null || true
}

scan_source_labeled() {
  local source_name="$1" file="$2"
  shift 2
  local allowed_labels=("$@")
  local idx label pattern hits lineno snippet allow found_allowed

  for idx in "${!LABELS[@]}"; do
    label="${LABELS[$idx]}"
    found_allowed=0
    for allow in "${allowed_labels[@]}"; do
      [ "$label" = "$allow" ] && found_allowed=1 && break
    done
    [ "$found_allowed" -eq 0 ] && continue
    pattern="${PATTERNS[$idx]}"

    hits="$(run_pattern "$pattern" "$file")"
    [ -z "$hits" ] && continue

    while IFS= read -r line; do
      [ -z "$line" ] && continue
      FOUND=1
      lineno="${line%%:*}"
      snippet="${line#*:}"
      if [ "${#snippet}" -gt "$MAX_SNIPPET_LEN" ]; then
        snippet="${snippet:0:$MAX_SNIPPET_LEN}...<truncated>"
      fi
      printf '[MATCH] category=%s source=%s line=%s\n    pattern: %s\n    snippet: %s\n' \
        "$label" "$source_name" "$lineno" "$pattern" "$snippet"
    done <<EOF
$hits
EOF
  done
}

echo "::group::detect-suspicious-pr-content: scanning"
# TITLE/BODY are free text: a legitimate PR title/description essentially
# never contains raw shell commands or literal secret-reference syntax, so
# all pattern categories apply there.
scan_source_labeled "TITLE" "$TITLE_FILE" "prompt-injection" "secret-exfil" "suspicious-exec" "invisible-unicode"
scan_source_labeled "BODY" "$BODY_FILE" "prompt-injection" "secret-exfil" "suspicious-exec" "invisible-unicode"
# DIFF is literal source code. Ordinary, legitimate code constantly contains
# `process.env`, `curl`, `eval(`, etc. (confirmed: this repo's own
# backend/src/core/config.ts has 7 real process.env references) - scanning
# the diff with the secret-exfil/suspicious-exec patterns would false-positive
# on routine PRs and abort the pipeline for no reason. Only scan the diff for
# patterns that are legitimately rare in real code: hidden instructions
# phrased as prompt-injection, and invisible/zero-width unicode used to smuggle
# text past a human reviewer.
scan_source_labeled "DIFF" "$DIFF_FILE" "prompt-injection" "invisible-unicode"
echo "::endgroup::"

if [ "$FOUND" -eq 1 ]; then
  echo "::error::Suspicious content detected in this pull request (prompt-injection and/or malicious-intent signals). Aborting before the Claude engine runs. See the matches logged above for exactly what matched and where (TITLE/BODY/DIFF)."
  exit 1
fi

echo "No high-confidence prompt-injection or malicious-intent signals found in PR title, body, or diff."
exit 0
