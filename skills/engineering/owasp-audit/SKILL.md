---
name: owasp-audit
description: Audit a branch against the OWASP Top 10:2025 on Claude Mythos, validate every finding and suggest fixes.
argument-hint: "[branch] [full] [focus]"
disable-model-invocation: true
---

# OWASP audit

Without this skill, a security review skims. It looks for a few injection patterns and skips access control and configuration, and it reports guesses as vulnerabilities. It also runs on whatever model the session happens to use. This skill hands the audit to the strongest security model available. It walks all ten OWASP categories in order and keeps confirmed findings apart from suspected ones.

The audit only reads code and runs the project's existing local tests. It never starts the app, sends requests to a server, installs packages or edits files. Fixes come afterwards, and only the ones the user picks.

## 1. Scope

Read the arguments:

- **Branch.** If the first word resolves with `git rev-parse --verify --quiet <word>`, it is the target branch. Otherwise the target is the current branch.
- **`full`** audits the whole repo instead of the branch's changes.
- **Anything else** is the focus, e.g. "auth only" or "the payments API".

Find the base branch with `git symbolic-ref --short refs/remotes/origin/HEAD` and drop the `origin/` prefix. If that fails, use `main` or `master`, whichever exists.

| Situation | Mode |
| --- | --- |
| `full` given, or the target is the base branch | whole repo |
| otherwise | branch changes: the files in `git diff --name-only <base>...<target>`, plus the code they call and the code that calls them |

If the target is the current branch, audit the working tree, including uncommitted changes. If it is a different branch, check it out into a scratch worktree without touching the user's checkout: `git worktree add --detach <scratchpad>/owasp-<branch> <branch>`. Run no tests there, because its dependencies aren't installed.

**Done when** you can state the target, base, mode, the root directory to audit, whether tests may run, and the changed-file list (or "whole repo").

## 2. Run the auditor on Mythos

Spawn the `owasp-auditor` subagent with the Agent tool. When the skill is installed from the plugin, the agent type is `omarbanat-skills:owasp-auditor`. Its definition is in `agents/owasp-auditor.md`, and it pins `model: claude-mythos-5-2`. Pass it:

- the scope from step 1 (target, base, mode, root directory, changed files, focus, whether tests may run)
- the absolute paths of `<skill-dir>/references/owasp-top10-2025.md` and `<skill-dir>/scripts/deps-audit.sh`, where `<skill-dir>` is the base directory shown when this skill loads

**Fallback.** Spawn the auditor again with the Agent tool's `model: "fable"` in either case:

- the spawn fails because the model is unavailable or not allowed
- the report's first line names a model other than Mythos

Anthropic documents Mythos 5.2 as the same model as Fable 5.2, offered only to verified organizations, so Fable is the closest substitute. If the `owasp-auditor` agent type doesn't exist (it isn't linked, or the session started before it was), spawn `general-purpose` with `model: "fable"`. Tell it to read `<skill-dir>/agents/owasp-auditor.md` and follow its body as its instructions.

**Done when** you have the auditor's full report and know which model produced it.

## 3. Check the report

The auditor's report is a claim, not a result. For every Critical and High finding, open the cited lines yourself and check that the code there does what the report says. Check the input path too: untrusted input must actually reach the cited code. Downgrade or drop findings that don't hold, and say which ones you changed and why.

**Done when** every Critical and High finding has been opened and either kept, downgraded or dropped.

## 4. Report

Print the report in chat in the format below. Sort findings by severity, then by OWASP rank. Then ask whether to save it to a file.

````markdown
# OWASP audit: feature/checkout vs main
Model: claude-mythos-5-2 · Mode: branch changes (14 files) · Tests: ran · 2026-11-24

**3 findings:** 1 Critical · 1 High · 1 Medium. Confirmed: 2, Likely: 1.

| ID | Severity | OWASP | Where | Issue | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | Critical | A01 | api/orders.ts:42 | GET /orders/:id returns any user's order | Confirmed |
| F2 | High | A05 | db/search.py:18 | Search term interpolated into SQL | Confirmed |
| F3 | Medium | A10 | api/upload.ts:77 | Parser error leaks stack trace to client | Likely |

### F1 · Critical · A01 Broken Access Control
**Where:** api/orders.ts:42
**Path:** `req.params.id` (api/orders.ts:40) → `Order.findById(id)` (api/orders.ts:42) → response. No owner check on the way.
**Attack:** a logged-in user requests /orders/<another user's id> and reads their order and address.
**Evidence:** confirmed by reading the code; no test covers it.
**Fix:**
```diff
- const order = await Order.findById(req.params.id);
+ const order = await Order.findOne({ _id: req.params.id, userId: req.user.id });
+ if (!order) return res.sendStatus(404);
```

## Coverage
| OWASP | Result | Checked |
| --- | --- | --- |
| A01 Broken Access Control | 1 finding | 6 routes, ownership on every id lookup |
| A02 Security Misconfiguration | clean | CORS, headers, debug flags, .env.example |
| A03 Software Supply Chain Failures | not applicable | no manifest changed in this branch |
| ... | | |
````

**Done when** every finding has an ID, severity, OWASP category, file:line, path, attack, evidence, status and a fix. The coverage table must list all ten categories.

## 5. Fix on request

Ask which finding IDs to fix. Apply only those, and only on the current branch. If the audit ran on another branch, tell the user to check it out first. After fixing, run the tests that cover the changed files. Remove any scratch worktree from step 1 with `git worktree remove`.

**Done when** the chosen fixes are applied and their tests pass, or the user picked none. Either way, no scratch worktree is left.
