#!/usr/bin/env node
// validate-test-categories.mjs
//
// Deterministic, code-level enforcement that the pr-test-writer gh-aw agent
// only ever reports test categories that exist in the canonical manifest
// (.github/aw/test-categories.json). Closes the gap where the category
// taxonomy lived only as prose in test-strategy-router/SKILL.md, with
// nothing stopping the agent from inventing or drifting a category name.
//
// Primary signal: a machine-readable HTML comment marker the
// test-verification-and-reporting skill is expected to emit alongside the
// existing `gh-aw-test-writer` status marker, e.g.:
//
//   <!-- gh-aw-test-categories: ["api-contract","ui-component"] -->
//
// Fallback (best-effort, used only if that marker is missing): scrape the
// "Role"/"Category" column of the rendered markdown tables. This is strictly
// a fallback — it's heuristic and fragile against formatting drift, which is
// exactly why the structured marker is the preferred mechanism.
//
// Usage:
//   node validate-test-categories.mjs --comment-file <path>
//   node validate-test-categories.mjs --comment "<markdown string>"
//   cat comment.md | node validate-test-categories.mjs
//   node validate-test-categories.mjs --pr <number> --repo owner/repo   # fetches via `gh`
//
// Options:
//   --manifest <path>   Override path to test-categories.json
//                        (default: .github/aw/test-categories.json next to this script's repo root)
//   --json               Emit machine-readable JSON result instead of plain text
//
// Exit code: 0 if every category name found is in the manifest's allow-list,
// 1 on any invented/misspelled/unknown category name (or on a usage error).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execFileSync } from "node:child_process";

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--comment-file") args.commentFile = argv[++i];
    else if (a === "--comment") args.comment = argv[++i];
    else if (a === "--manifest") args.manifest = argv[++i];
    else if (a === "--pr") args.pr = argv[++i];
    else if (a === "--repo") args.repo = argv[++i];
    else if (a === "--json") args.json = true;
    else args._.push(a);
  }
  return args;
}

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function loadManifest(manifestPath) {
  let raw;
  try {
    raw = readFileSync(manifestPath, "utf8");
  } catch (err) {
    throw new Error(`Could not read manifest at ${manifestPath}: ${err.message}`);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Manifest at ${manifestPath} is not valid JSON: ${err.message}`);
  }
  if (!Array.isArray(data.categories)) {
    throw new Error(`Manifest at ${manifestPath} is missing a "categories" array.`);
  }
  const categoryNames = data.categories.map((c) => c.name);
  const nonCategoryNames = Array.isArray(data.non_category_names) ? data.non_category_names : [];
  return {
    allowed: new Set([...categoryNames, ...nonCategoryNames]),
    categoryNames,
    nonCategoryNames,
  };
}

// Extract the structured marker: <!-- gh-aw-test-categories: [...] -->
function extractStructuredMarker(commentBody) {
  const re = /<!--\s*gh-aw-test-categories:\s*(\[[^\]]*\])\s*-->/;
  const match = commentBody.match(re);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (!Array.isArray(parsed)) return null;
    return parsed.map(String);
  } catch {
    return null;
  }
}

// Fallback: scrape markdown table rows for a Role/Category column value.
// Table shape (per test-verification-and-reporting/SKILL.md):
//   | File | Role | Test file | Result |
// We take the 2nd column of any row in a table whose header row contains
// "Role" or "Category", skipping header and separator rows.
function scrapeTableCategories(commentBody) {
  const lines = commentBody.split("\n");
  const found = new Set();
  let inRelevantTable = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) {
      inRelevantTable = false;
      continue;
    }
    const cells = trimmed
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    const isSeparatorRow = cells.every((c) => /^:?-+:?$/.test(c));
    if (isSeparatorRow) continue;
    const looksLikeHeader = cells.some((c) => /^(role|category)$/i.test(c));
    if (looksLikeHeader) {
      inRelevantTable = true;
      continue;
    }
    if (inRelevantTable && cells.length >= 2) {
      const roleCell = cells[1];
      // Only keep tokens that look like a category slug (lowercase, hyphenated),
      // ignore free text like "skipped" reasons.
      const slug = roleCell.toLowerCase().trim();
      if (/^[a-z][a-z0-9-]*$/.test(slug)) {
        found.add(slug);
      }
    }
  }
  return [...found];
}

function fetchPrCommentViaGh(pr, repo) {
  // Select on gh-aw-workflow-call-id, not gh-aw-test-writer: the latter is a
  // marker the reporting SKILL is supposed to emit (content-level, can be
  // missing if the agent didn't follow its template), while the former is
  // injected by gh-aw's own add-comment safe-output itself (framework-level,
  // always present on the real report comment). Selecting on content that
  // can be absent means a comment that's missing its own status marker also
  // can't be found at all, compounding one failure into two.
  const args = [
    "api",
    `repos/${repo}/issues/${pr}/comments`,
    "--jq",
    "[.[] | select(.body | contains(\"gh-aw-workflow-call-id\"))] | sort_by(.created_at) | last | .body // \"\"",
  ];
  const out = execFileSync("gh", args, { encoding: "utf8" });
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const defaultManifest = path.resolve(scriptDir, "..", "test-categories.json");
  const manifestPath = args.manifest ? path.resolve(args.manifest) : defaultManifest;

  let commentBody;
  if (args.comment) {
    commentBody = args.comment;
  } else if (args.commentFile) {
    commentBody = readFileSync(args.commentFile, "utf8");
  } else if (args.pr && args.repo) {
    commentBody = fetchPrCommentViaGh(args.pr, args.repo);
  } else if (!process.stdin.isTTY) {
    commentBody = readStdin();
  } else {
    console.error(
      "Usage: validate-test-categories.mjs (--comment-file <path> | --comment <string> | --pr <n> --repo <owner/repo> | via stdin) [--manifest <path>] [--json]"
    );
    process.exit(1);
    return;
  }

  if (!commentBody || !commentBody.trim()) {
    console.error("::error::validate-test-categories: empty PR comment body — nothing to validate.");
    process.exit(1);
    return;
  }

  let manifest;
  try {
    manifest = loadManifest(manifestPath);
  } catch (err) {
    console.error(`::error::validate-test-categories: ${err.message}`);
    process.exit(1);
    return;
  }

  let used = extractStructuredMarker(commentBody);
  let source = "structured-marker";
  if (used === null) {
    used = scrapeTableCategories(commentBody);
    source = "table-scrape-fallback";
    console.error(
      "::warning::validate-test-categories: no <!-- gh-aw-test-categories: [...] --> marker found; falling back to heuristic markdown-table scraping, which is less reliable."
    );
  }

  const unknown = used.filter((name) => !manifest.allowed.has(name));
  const ok = unknown.length === 0;

  const result = {
    ok,
    source,
    usedCategories: used,
    unknownCategories: unknown,
    allowedCategories: [...manifest.allowed],
    manifestPath,
  };

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (ok) {
    console.log(
      `validate-test-categories: OK (${source}) — all ${used.length} category name(s) found are in the canonical manifest: ${used.join(", ") || "(none used)"}`
    );
  } else {
    console.error(
      `::error::validate-test-categories: PR comment uses ${unknown.length} category name(s) NOT present in the canonical manifest (${manifestPath}): ${unknown.join(", ")}. Allowed categories: ${manifest.categoryNames.join(", ")} (plus non-category: ${manifest.nonCategoryNames.join(", ")}).`
    );
    console.error(
      "::error::This means test-strategy-router (or its generator skills) used an invented or drifted category name that does not match .github/aw/test-categories.json. Fix the skill's category classification, or add the category to the manifest if it is intentionally new, and keep SKILL.md's prose in sync."
    );
  }

  process.exit(ok ? 0 : 1);
}

main();
