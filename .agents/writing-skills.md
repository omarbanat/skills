# Writing a skill

## Frontmatter

```yaml
---
name: my-skill
description: What it does, in one sentence. Use when the user asks to ..., mentions ..., or wants ....
---
```

| Field | Required | Notes |
| --- | --- | --- |
| `name` | yes | Lowercase letters, digits and single hyphens, at most 64 characters. Must match the folder name. |
| `description` | yes | At most 1024 characters. Before the skill loads, this is the only part of it Claude sees. |
| `disable-model-invocation` | no | `true` makes the skill user-invoked (see below). |
| `argument-hint` | no | Shown after `/name` in the menu, e.g. `"[pr-number] [focus]"`. |
| `allowed-tools` | no | Tools the skill may use without asking for permission. |

## Invocation

Every skill is one of two kinds:

- **Model-invoked** (the default). Claude loads it on its own when a request matches the description, and you can also type `/name`. Its description is written for Claude: what the skill does, then the situations and phrasings that should trigger it ("Use when the user asks to..., mentions..., or wants..."). Ask whether Claude could usefully reach for the skill without being told to. If it could, keep it model-invoked.
- **User-invoked** (`disable-model-invocation: true`). Runs only when you type `/name`. Use this for workflows with side effects, or ones you want to start deliberately. Its description is one line for a person scanning the slash-command menu, so leave out trigger lists.

A user-invoked skill can tell Claude to run a model-invoked one ("Call the Skill tool with `tdd`"). It can never call another user-invoked skill. If a step depends on one, tell the user to run it.

## Body

- Open with what the skill produces and the failure it exists to prevent. Claude follows a rule better when it knows the reason.
- Write steps as instructions ("Run the tests", not "The tests should be run").
- Keep `SKILL.md` short, ideally under about 300 lines. Move long material into sibling files such as `references/flutter.md`, and say in `SKILL.md` when to read each one. Claude reads those files only when it needs them.
- Put repeatable, deterministic work in `scripts/` inside the skill folder, and tell Claude how to run each script.
- Refer to bundled files by their path inside the skill (`scripts/report.sh`, `<skill-dir>/scripts/report.sh`). Never hard-code `~/.claude/skills/<name>/`. Plugin installs live somewhere else, so those paths break.
- Add a **Gotchas** section for mistakes seen in practice. It is often the most valuable part of a skill.

## Trying it

1. Create the skill in `in-progress/`. `scripts/link-skills.sh` links it into `~/.claude/skills`.
2. In Claude Code, type `/name` (start a new session if it isn't listed yet). For a model-invoked skill, also make a plain request that should trigger it, and check that it does.
3. When it works, move the folder to `engineering/` or `productivity/`, then run `node scripts/check.mjs --fix` and `scripts/link-skills.sh`.

The `skill-creator` skill can help draft a skill, sharpen its description and run evals.
