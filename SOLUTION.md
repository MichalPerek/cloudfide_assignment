# Solution

Repo: [MichalPerek/cloudfide_assignment](https://github.com/MichalPerek/cloudfide_assignment). Base: `cf-recruitment/taskly-app-node`.

## What this is

A Node/Express/Prisma + React todo app needed an agent that watches pull requests, writes or updates unit tests for whatever code changed, runs those tests for real, and reports the result on the PR — for both the backend and the frontend, without a human kicking it off.

## Why gh-aw

I picked [GitHub Agentic Workflows](https://github.com/github/gh-aw) (`gh aw`) over writing a plain GitHub Actions workflow that calls the Claude Code Action directly. Not because the job posting says "Agentic Workflows" — because of what it actually gives you for free:

- It compiles a markdown + YAML file into a real Actions workflow, and splits it into two jobs automatically: one that reads the PR and has no write access, and a separate one that's the only thing allowed to post a comment or push a commit. I didn't have to design that split myself and hope I got it right — I checked the compiled output and it's really there (`permissions: {}` at the top level, `agent` job gets only `contents: read` + `pull-requests: read`, `safe_outputs` job gets `contents: write` / `pull-requests: write` separately, in `.github/workflows/pr-test-writer.lock.yml`).
- It runs the agent through an actual network firewall (a squid proxy container), not just a documented intention. The allowed domains are a real list in the compiled YAML.
- It runs a threat-detection pass on the agent's own output by default, with zero config from me (`"threat_detection":{"mode":"enabled"}` shows up in the compiled manifest even though I never asked for it).
- It understands "skills" and "sub-agents" as first-class things a Claude Code agent can load, which maps directly onto what the assignment asks for.

The trade-off is real: a reviewer who doesn't know gh-aw has to either trust the compiled file or learn the tool. That's why this document quotes actual line numbers and actual test commands instead of describing the design in the abstract — you shouldn't have to take gh-aw's word for any of this, and you shouldn't have to take mine either.

## How it's put together

**The agent** is `.github/workflows/pr-test-writer.md`. It's a markdown file: YAML frontmatter at the top (trigger, permissions, tools, the two outputs it's allowed to produce), then a plain-English prompt below describing the job. `gh aw compile` turns it into `.github/workflows/pr-test-writer.lock.yml`, which is the thing GitHub Actions actually runs. If you want to change what the agent does, you edit the `.md` file and recompile — never the `.lock.yml` directly, it says so at the top of the file.

**The skills** live under `.claude/skills/*/SKILL.md`. Each one is a short, focused set of instructions the agent loads when it needs it:

| Skill | Job |
|---|---|
| `test-strategy-router` | Looks at every changed file, groups related changes together, decides which test category each file belongs to, and decides if a test is even needed. |
| `api-contract-tests` | Writes Express router tests (supertest + stubbed repository). |
| `repository-tests` | Writes Prisma repository tests (real Prisma client, mocked I/O — the pattern this repo already uses). |
| `pure-function-tests` | Writes tests for plain functions — validators, mappers, utilities. No mocking. |
| `react-hook-tests` | Writes hook tests, including TanStack Query hooks wrapped in a real `QueryClientProvider`. |
| `ui-component-tests` | Writes component tests with RTL and `userEvent`. |
| `infra-smoke-tests` | Decides, file by file, whether bootstrap/wiring code gets skipped, a minimal smoke test, or (for `factory.ts` specifically) a full request-level test. |
| `test-verification-and-reporting` | Writes the final PR comment. |

**The validator** is different on purpose: `.claude/agents/independent-test-validator.md` is a gh-aw *sub-agent*, not a skill. A skill loads into the same conversation the generator is already having with itself — if the validator were a skill, it would see the generator's own justification for why its test is good, which defeats the point. A sub-agent gets a fresh context with nothing in it except what's explicitly handed over: the category, the diff, and the proposed test. No transcript, no reasoning, no chance to be talked into agreeing. It outputs exactly ACCEPT or REJECT with specific reasons — "could be better" isn't an acceptable reason, it has to name the actual bad assertion.

There's no retry loop. I looked into whether gh-aw could re-run the generator against the validator's feedback, and it can't — one engine invocation per job, no matrix/strategy loops. Rather than fake a retry that nothing enforces, the agent gets one attempt per file: generate, validate, and if it's rejected, say so plainly instead of trying again silently.

## Watching changes and reporting on them

The first thing the agent does is group the PR's changed files, not just list them. If a backend change and a frontend change are genuinely linked — a new endpoint and the hook that calls it, say — they get reported as one feature, not two unrelated rows. If nothing links them, they stay separate, bucketed as backend or frontend. This matters for readability: a PR comment that says "Clear completed todos: backend + hook + UI, all passing" is something you can read in two seconds. A table of four files with no context between them is not.

Each group gets a status badge (pass / fail / nothing needed) and the whole comment ends with one of exactly three fixed outcomes, marked with an HTML comment so it's machine-checkable: `SUCCEEDED`, `FAILED`, or `SKIPPED`. The agent can't write anything in between — a half-pass is reported as `FAILED` for that group, never smoothed over.

**The category list is enforced in code, not just prose.** Early on, the six test categories (api-contract, repository-data-layer, pure-function, react-hook, ui-component, infra-bootstrap) only existed as a bullet list in `test-strategy-router/SKILL.md`. Nothing stopped the agent from inventing a seventh one, or misspelling an existing one, and nobody would notice until a human happened to read the PR comment closely. That's now backed by `.github/aw/test-categories.json` — the real list — and a small Node script, `.github/aw/scripts/validate-test-categories.mjs`, that runs in its own job after the agent posts its comment, reads the category names out of a machine-readable marker in that comment, and fails loudly if any name isn't in the manifest. I tested it against a comment with an invented category (`ui-compoment`, `service-layer`) and it correctly fails with the exact bad names listed, not a vague warning.

## Safety

This is a public repo. Anyone can open a PR against it, and that PR's title, description, code, and even code comments are all attacker-controlled text that an LLM reads as part of its job. I didn't try to make the agent perfectly resistant to being tricked — that's not really possible with current models — I tried to make sure a trick doesn't matter.

**What actually stops damage, not just prompt wording:**

- The job that reads the PR has no write access to anything on GitHub. Not a little — none. `permissions: {}` at the top of the compiled workflow, and the `agent` job only adds back `contents: read` and `pull-requests: read`. Even a fully-fooled agent can't push a branch, can't open an issue, can't touch a setting.
- It has one secret: `ANTHROPIC_API_KEY`, the LLM's own API key. Nothing GitHub-credential-shaped is anywhere near it.
- Its network access goes through a real firewall (gh-aw's squid-proxy container), not a note in a README. It can reach the LLM API and the npm registry. Nothing else.
- `npm ci --ignore-scripts` on every install, for both packages, before anything else runs. A malicious `package.json` can't run code at install time. Prisma's client is generated with its own explicit command afterward, not a trusted postinstall hook.
- Runners are GitHub-hosted and thrown away after each run. Nothing persists between PRs.
- If a PR comes from a fork, GitHub's own token rules mean the agent literally cannot push a commit back to it — that's not a setting I turned on, it's how `GITHUB_TOKEN` works. So the default output is always a comment with a suggested patch; pushing a commit directly only happens for same-repo PRs, which is the only case where it's even possible.
- The one place the agent *can* write — `push_to_pull_request_branch`, for same-repo PRs — is restricted to test files in the prompt, and separately, gh-aw itself refuses to touch `.github/**`, lockfiles, or a short list of other sensitive files on that path (`protect_top_level_dot_folders`, confirmed in the compiled config). Two independent reasons it can't rewrite its own instructions, not one.
- The workflow's own instructions, skills, and sub-agent are read from `main`, never from the PR branch. I found this out the hard way — a brand-new workflow file failed with a file-not-found error until I merged it to `main` first. It turns out that's deliberate: a malicious PR cannot rewrite what the agent is told to do, because the agent never reads the PR's copy of its own instructions.

**What I added on top, as a cheap extra layer, not the main defense:** a script, `.github/aw/scripts/detect-suspicious-pr-content.sh`, runs before the LLM is ever invoked. It scans the PR title and description for known attack phrasing ("ignore previous instructions," "reveal your system prompt," shell commands piped into `bash`, hidden zero-width unicode) and checks the diff too, more narrowly. If it finds something, it exits with an error and the whole job stops right there — the LLM never sees the content and no API call is spent on it. I tested it both ways: a fake PR body with an actual injection attempt gets caught and logged; a normal PR touching `backend/src/core/config.ts` (which has several real `process.env` references) does not get flagged. That second test mattered — my first draft of this script scanned the diff for `process.env`/`curl`/`eval(` too, and would have aborted the workflow on completely ordinary code. I caught that before it shipped.

**What none of this does — stated plainly, not buried:** it doesn't make the agent immune to prompt injection. The regex tripwire only catches phrasing that's already known. A sufficiently new or obfuscated attempt gets past it, reads the PR content, and might try to act on fake instructions hidden there. The reason that's an acceptable risk, and not a gap I'm pretending doesn't exist, is everything above: even if the agent is fully fooled, it still has no write access, no useful secret, and no way out through the network. A successful injection has nothing to steal and nowhere to send it.

**What I did not verify, and you should check yourself before relying on it:** the repo-level GitHub settings (branch protection on `main`, whether Actions default to read-only permissions, secret scanning, "require approval for first-time contributor workflow runs"). I wasn't able to query these from this session. Run these yourself:

```sh
gh api repos/MichalPerek/cloudfide_assignment/actions/permissions/workflow
gh api repos/MichalPerek/cloudfide_assignment/branches/main/protection
gh api repos/MichalPerek/cloudfide_assignment --jq '{visibility, security_and_analysis}'
gh secret list
```

## Running it

Needs `ANTHROPIC_API_KEY` as a repo secret (already set). Fires automatically on `pull_request` (opened or pushed to), but only when the diff touches `backend/**` or `frontend/**` — it used to run on every PR including ones that only changed the workflow file itself, which wasted a real API call for nothing testable; that's fixed with a `paths` filter now. You can't trigger a run yourself without that secret, which is also why the next section links to real runs instead of asking you to reproduce one.

To change the agent: edit `.github/workflows/pr-test-writer.md`, run `gh aw compile`, commit both the `.md` and the generated `.lock.yml`, and merge to `main` before opening a PR that depends on the change (see the base-branch note above).

## Example run

PR [#9, "Add clear-completed-todos feature"](https://github.com/MichalPerek/cloudfide_assignment/pull/9): a real feature, backend and frontend, opened with no tests on purpose.

It took two runs to get right, and both are useful evidence.

**First run** ([46054108277](https://github.com/MichalPerek/cloudfide_assignment/actions/runs/46054108277)): the agent classified all 6 changed files correctly and wrote tests for them, and the validator accepted every one. But the actual `npm test` command was blocked — a bug in how I'd written the allowed bash commands meant only a bare `npm` with zero arguments was permitted, not `npm test`. Rather than claim success anyway, the agent reported `FAILED`, named exactly what it tried and what got denied, and pushed nothing. That's the point of making the real test run the only thing allowed to say pass or fail — when the tooling itself breaks, the agent doesn't paper over it.

**Fix**: the bash allowlist needed `:*` wildcards (`npm test:*`, not `npm test`). Merged in PR #10.

**Second run** ([46056607817](https://github.com/MichalPerek/cloudfide_assignment/actions/runs/46056607817)): clean pass.

| File | Test added | What it checks |
|---|---|---|
| `backend/.../repository.ts` | `repository.test.ts` | The returned count and the exact Prisma call args, for both a real and a zero result. |
| `backend/.../router.ts` | `router.test.ts` | The route's happy path and the zero-cleared case, via supertest. |
| `frontend/.../TodosHeader.tsx` | `TodosHeader.test.tsx` | The button is hidden when there's nothing to clear, fires once on click, and is disabled correctly. |
| `frontend/.../useClearCompletedMutation.ts` | `useClearCompletedMutation.test.ts` (new) | The mutation resolves with the right value and invalidates the task list afterward. |
| `frontend/.../api/todos.ts` | — skipped | One-line delegation to `request()`. The agent said plainly that no category fit it rather than forcing a bad test. |
| `frontend/.../TodosPage.tsx` orchestration | — skipped | Same pattern as an existing, already-untested handler in the same file; its actual pieces are covered by the two tests above. |

All 4 generated tests were accepted by the validator on the first try. Both real suites passed — backend 51/51, frontend 21/21 — and the agent pushed a real commit, `ff447e4`, straight to the PR branch.

Separately, before any of this ran against a real PR, I fed the validator a deliberately bad test by hand (a tautological `expect(true).toBe(true)`-style assertion) and it rejected it with specific, itemized reasons — including flagging something it suspected might be a real bug in the surrounding code, while explicitly saying it couldn't confirm that without running it. That's the behavior the isolation is there to produce: it judges what's in front of it and says what it doesn't know.

## Assumptions

- A public repo was the right call here for boring reasons, not dramatic ones: unlimited free Actions minutes, and a reviewer who can read Actions logs without being added as a collaborator.
- A reviewer checks this by reading the linked runs and PRs, not by re-running anything — they don't have the API key, and shouldn't need it.
- New tests are held to "passes, and the validator judges it as exercising real behavior," not to the backend's existing 100% coverage gate — that gate only applies to the two files it was written for (`validators.ts`, `mappers.ts`); applying it everywhere would push the agent toward hitting lines instead of writing useful assertions.

## Limitations, and what I'd change for a real production version

- **No retry loop.** One attempt per file, by design, because gh-aw doesn't support looping an engine call within a job. A production version would need a real multi-job retry (separate workflow invocations passing state through job outputs), which is enough extra orchestration that it didn't make sense to fake here.
- **The category list will keep needing new entries.** `frontend/.../api/todos.ts` genuinely didn't fit any of the six categories in the real run above — not a bug, just a taxonomy that's six items wide and a codebase that's bigger than that. Expect to add to `test-categories.json` as new kinds of files show up.
- **The injection tripwire is regex, which means it's always a step behind.** It catches known phrasing, not novel ones. Worth pairing with gh-aw's own built-in threat-detection job (which already runs, with no setup from me) rather than relying on either alone.
- **No coverage number in the report.** The agent knows whether tests pass, but doesn't currently compute or show a coverage delta. Wiring in the existing `test:coverage` scripts and reporting the before/after would be a small, real improvement.
- **No flakiness check.** A test that passes once isn't necessarily a test that passes reliably. A production version should run newly-added tests a few times, ideally with test order randomized (Vitest supports shuffling), before trusting them enough to push to a branch.
- **One comment per run, no way to follow up.** Right now if a flagged test looks wrong, or a skip reason doesn't make sense, there's nowhere to ask about it except reading the Actions log yourself. The next thing I'd build is a second, small gh-aw workflow that reacts to replies on the agent's own comment — something like replying "explain `repository.test.ts`" and getting a direct answer, or reacting to dismiss a specific flagged item instead of it coming back next run. It's a comment-trigger workflow, which gh-aw supports; I didn't build it here because the core pipeline and its safety properties were the higher-value use of the time, but the mechanism is straightforward.
- **No enforced test *style*, only test *category*.** The category manifest stops the agent from inventing a category name. It doesn't stop a generated test from drifting in style within a category over time. A harness that actually lints generated tests against the conventions described in each skill (not just trusts the agent to follow them) would close that gap properly.
