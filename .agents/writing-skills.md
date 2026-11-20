# Writing a skill

A good skill is a short, specific note that fires at the right moment and is proven to change what the agent does. Follow this guide when you create a skill and when you edit one.

## How skills load

Skills load in three levels, and almost every rule below follows from that.

1. **Name and description.** Loaded for every installed skill, on every turn. This is all the agent sees when deciding whether to open a skill.
2. **Body.** The rest of `SKILL.md`. Loaded only when the skill fires.
3. **Bundled files.** References, scripts and assets. Read or run only when the body points to them.

The description costs context all the time, the body only when used, and bundled files almost nothing until needed. Keep each level as small as its job allows.

## Decide what you're writing

A skill is the right home only for knowledge the agent needs sometimes, not always. Sort it first.

| What you have | Where it goes | Why |
| --- | --- | --- |
| A fact or convention that applies to most work in a repo | That repo's `CLAUDE.md` or `AGENTS.md` | It's always relevant, so it should always be loaded |
| A multi-step procedure or checklist you keep pasting into chat | A skill | Needed only for some tasks |
| A reusable technique that takes judgment | A skill | Worth loading only when it applies |
| A rule a validator could check (format, naming, lint) | A script or hook | Code enforces it every time; prose doesn't |
| A one-off fix | Nothing | It won't come up again |

Give each skill one job. If it needs two unrelated descriptions to cover what it does, it's two skills.

## Choose who invokes it

- **User-invoked** (`disable-model-invocation: true`). Runs only when you type `/name`, so it costs no context. Its description is a one-line label for a person scanning the slash-command menu. `scripts/new-skill.mjs` creates this kind unless told otherwise.
- **Model-invoked** (no `disable-model-invocation`). Its description stays in context so the agent can fire it on its own, and you can still type `/name`. Choose this only when the agent, or another skill, must reach the skill without you.

A user-invoked skill can tell the agent to run a model-invoked one ("Call the Skill tool with `tdd`"). It can never call another user-invoked skill. If a step depends on one, tell the user to run it.

## Frontmatter

| Field | Required | Notes |
| --- | --- | --- |
| `name` | yes | Lowercase letters, digits and single hyphens, at most 64 characters. Must match the folder name. |
| `description` | yes | At most 1,024 characters. A label for a user-invoked skill, a label plus triggers for a model-invoked one. |
| `disable-model-invocation` | no | `true` makes the skill user-invoked. |
| `argument-hint` | no | Shown after `/name` in the menu, e.g. `"[pr-number] [focus]"`. |
| `allowed-tools` | no | Tools the skill may use without asking for permission. |

`node scripts/check.mjs` enforces what a validator can: the name, the description cap, valid YAML and the 500-line body cap. It warns when a model-invoked description has no "Use when" and when a long reference file has no table of contents.

## Write the description

For a model-invoked skill, the description decides whether it is ever used. Write it as a trigger, not a summary.

- **Start with a short label.** A few words saying what the skill is ("Database migrations for this repo.") help the agent place it. The label also becomes the skill's one-liner in the READMEs.
- **Then the situations.** "Use when…", followed by the tasks, symptoms and words users actually type.
- **One trigger per distinct situation.** Synonyms for the same situation cost context on every turn and add nothing.
- **Never summarize the steps.** Agents follow a workflow summary instead of reading the body. A description that mentioned "code review between tasks" produced one review and skipped the skill's two-stage process.
- **Cover every case where it helps.** Models tend to under-use skills, so include cases where the user won't name it. Be thorough about coverage, not wordy.
- **Stay distinct.** Don't overlap other skills or things the model already does well alone.

```yaml
# Too vague: the agent can't tell when it applies
description: Helps with database stuff

# Summarizes the workflow: the agent may follow this and skip the body
description: Use for migrations - autogenerate, fix renames, run the check script

# A label, then triggers only, one per situation
description: Database migrations for this repo. Use when adding, changing or removing a table, column, index or constraint, or when the user mentions Alembic or a schema change.
```

For a user-invoked skill, write the label and stop. Trigger lists and usage notes belong in the body or in `argument-hint`.

## Write the body

Write for a capable colleague who knows the tools but not your project. Spend words only where the agent would otherwise get it wrong.

- **Open with why the skill exists:** the failure it prevents. An agent that knows why renames are dangerous handles cases you didn't list.
- **Cut no-ops.** Delete any instruction the model follows by default anyway. Don't explain Git, Python or what a pull request is.
- **Keep what can't be looked up.** Unwritten conventions, the reason behind a choice, and gotchas seen in practice that no config file reveals are what make a skill worth loading.
- **Point to the environment.** Don't copy `package.json` scripts, config values or `--help` output into the skill. Copies go stale; the real files don't.
- **End each step with a checkable finish line.** "Every modified model has a migration" works. "Understand the schema" invites the agent to stop early.
- **Say what to do, not only what to avoid.** A bare prohibition can make the forbidden behavior more likely. If you need one, pair it with the behavior you want.
- **Show one real example** of the finished output.
- **One meaning, one place.** Use the same term throughout and don't repeat a rule in two sections.

**When to use firm rules.** "You MUST… No exceptions." is for discipline skills: rules that must hold under pressure, such as test-first development. Use that register only there. Everywhere else, explain. In the most-starred skill repos, all-caps directives appear less than once per 1,000 words.

## Structure it for progressive disclosure

Keep `SKILL.md` to what every run needs, and move the rest behind pointers.

- **Stay under 500 lines** and about 5,000 tokens. Most good skills are far shorter: in the most-starred repos the median body runs from 56 to 300 lines.
- **Split by branch.** Inline what every case needs. Move what only some cases need into its own file.
- **Give every pointer a condition.** "When the deploy fails, read `references/errors.md`" tells the agent when to load it. "See references/" doesn't.
- **Script the deterministic parts.** Validation, parsing and formatting belong in `scripts/`. A tested script is more reliable than logic the model rewrites each run.
- **Split variants into separate files.** For example `references/aws.md` and `references/gcp.md`, so the agent loads only the one it needs.
- **Add a table of contents** to any reference file over about 300 lines.

```
my-skill/
├── SKILL.md       # frontmatter + core workflow (required)
├── references/    # read on demand; SKILL.md says when to read each
├── scripts/       # run, not read: validation, parsing, setup
└── assets/        # templates and files used in the output
```

Refer to bundled files by their path inside the skill (`scripts/report.sh`, `<skill-dir>/scripts/report.sh`). A path under `~/.claude/skills/<name>/` breaks for plugin installs, which live somewhere else.

## Test before and after

A skill isn't done until you've watched it change what the agent does. Treat it like test-driven development: see the failure first, then fix it.

1. **Run a baseline.** Give the agent 2–3 realistic tasks without the skill. Record exactly where it goes wrong. If it doesn't go wrong, you don't need the skill.
2. **Write the smallest skill that fixes those failures.** Leave out anything for hypothetical cases.
3. **Rerun with the skill.** Check two things: did it fire, and did the agent follow it?
4. **Test firing separately** (model-invoked skills). Use prompts worded the way you'd really ask, not copied from the description. Add near-misses that should not fire it.
5. **Repeat each variant 5+ times.** Single runs mislead. If the runs diverge, the wording isn't binding: tighten it before adding more.
6. **Loop on every edit.** Fix what broke and rerun. Edits to existing skills need the same test as new ones.

Use substantive tasks. Agents often skip skills for trivial one-step requests, so a "read this file" prompt says little about whether the description works. `SKILL.md` edits apply in the current session without restarting, which keeps the loop fast.

The `skill-creator` skill can run the baseline and with-skill comparisons and the firing tests for you.

## Examples

**A model-invoked skill.** The description is a label plus triggers. The body opens with why the skill exists, gives steps with a finish line, and points to a reference file with a condition.

```markdown
---
name: db-migration
description: Database migrations for this repo. Use when adding, changing or
  removing a table, column, index or constraint, or when the user mentions
  Alembic or a schema change.
---

# Database migrations

Migrations run against production data on deploy. One that works on an empty
dev database can still fail or lose data there.

## Steps
1. Generate: `alembic revision --autogenerate -m "<short description>"`.
2. Review the file. Autogenerate writes a rename as drop + add, which deletes
   the column's data. Rewrite renames as
   `op.alter_column(..., new_column_name=...)`.
3. Run `scripts/check_migration.sh`. Done when it applies and downgrades
   with no errors.

## Conventions
New columns on tables with existing rows are nullable or have a server
default, so the migration succeeds on populated tables.

For backfills over about 1M rows, read `references/backfills.md` first.
```

**A user-invoked skill.** It runs only when you type `/pre-mortem`, so the description is just a label and costs no context.

```markdown
---
name: pre-mortem
description: Imagine this plan failed and work back to why.
disable-model-invocation: true
---

Assume the plan in this conversation shipped and failed six months later.
List the three most likely causes, most likely first. For each, name the
earliest warning sign and one change to the plan that would prevent it.
Ask before revising the plan itself.
```

## In this repo

1. **Create** the skill with `node scripts/new-skill.mjs in-progress <name>`, adding `--model` for a model-invoked one. The script links it into `~/.claude/skills`.
2. **Try it.** Type `/name`, starting a new session if a new skill isn't listed yet. Then run the test loop above.
3. **Promote it** once it passes: move the folder to `engineering/` or `productivity/`, then run `node scripts/check.mjs --fix` and `scripts/link-skills.sh`.

## Checklist before you ship

- [ ] It belongs in a skill: a procedure or technique, not an always-true fact or a checkable rule
- [ ] It does one job
- [ ] It's user-invoked unless the agent or another skill must find it alone
- [ ] The description lists triggers, one per situation, with no workflow steps (model-invoked), or is a one-line label (user-invoked)
- [ ] The body is under 500 lines, with no instructions the model follows anyway
- [ ] Every step ends with a checkable finish line
- [ ] Rules say what to do and why; firm "MUST" language appears only for discipline rules
- [ ] Every pointer to a bundled file says when to read it
- [ ] You saw the agent fail without the skill
- [ ] It fires on realistic prompts and stays quiet on near-misses
- [ ] Five or more runs per variant give consistent results
