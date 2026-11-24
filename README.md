# Skills

My agent skills for Claude Code. Each skill is a folder with a `SKILL.md` and whatever references or scripts it needs, filed in a bucket under [`skills/`](./skills).

## Install

Use one route per machine. With both, every skill shows up twice.

**Symlinks (for working on the skills).** Edits apply in the current session, with no reinstall.

```bash
git clone https://github.com/omarbanat/skills.git
cd skills
scripts/link-skills.sh
git config core.hooksPath .githooks   # run the checks before each commit
```

This links every skill in `engineering/`, `productivity/` and `in-progress/` into `~/.claude/skills`, and any subagent a skill keeps in its own `agents/` folder into `~/.claude/agents`. It never replaces a real folder or file that has the same name. Run `scripts/link-skills.sh --unlink` to remove the links.

**Plugin (for using them without editing).** You need read access to this private repo.

```
/plugin marketplace add omarbanat/skills
/plugin install omarbanat-skills@omarbanat
```

The plugin ships only `engineering/` and `productivity/`, plus the subagents those skills keep in `agents/` (listed by hand under `agents` in `plugin.json`). Its skills and agents appear as `omarbanat-skills:<name>`, and installed copies update when `version` in [`.claude-plugin/plugin.json`](./.claude-plugin/plugin.json) is bumped.

## Layout

| Bucket | What goes there | In the plugin | Linked locally |
| --- | --- | --- | --- |
| [`engineering/`](./skills/engineering) | daily code work | yes | yes |
| [`productivity/`](./skills/productivity) | daily work that is not code | yes | yes |
| [`in-progress/`](./skills/in-progress) | drafts being tried out | no | yes |
| [`misc/`](./skills/misc) | kept, rarely used | no | no |
| [`deprecated/`](./skills/deprecated) | retired | no | no |

## Add a skill

```bash
node scripts/new-skill.mjs in-progress my-skill           # runs only when you type /my-skill
node scripts/new-skill.mjs in-progress my-skill --model   # Claude can also pick it up on its own
```

Skills start user-invoked, which costs no context. Pass `--model` only when Claude, or another skill, must reach the skill without you.

This creates `skills/in-progress/my-skill/SKILL.md` from [the template](./.agents/skill-template.md), adds it to the lists below and to `plugin.json`, and links it. Then write and test the skill, following [writing-skills.md](./.agents/writing-skills.md).

To bring in a skill that already lives in `~/.claude/skills`:

```bash
mv ~/.claude/skills/my-skill skills/engineering/
node scripts/check.mjs --fix && scripts/link-skills.sh
```

When a skill graduates, renames or retires, move its folder and run the same two commands.

## Checks

`node scripts/check.mjs` checks that:

- each folder name matches its `name:`, names are unique, and descriptions are present and at most 1024 characters
- each `SKILL.md` body is at most 500 lines
- `plugin.json` lists exactly the `engineering/` and `productivity/` skills
- the skill lists in this README and in each bucket README are up to date
- `claude plugin validate .` passes (its warnings about CLAUDE.md, LICENSE and icon are expected and ignored)

It warns, without failing, when a model-invoked description has no "Use when" trigger, when a reference file over 300 lines has no table of contents, and when a description still contains TODO.

`--fix` regenerates `plugin.json` and the lists. It keeps one-liners you have edited by hand.

## Skills

**User-invoked** skills run only when you type `/name`. **Model-invoked** skills also run when Claude decides a task matches their description.

### Engineering

**User-invoked**

<!-- skills:engineering:user -->

- **[figma-align](./skills/engineering/figma-align/SKILL.md)**: Make a page, modal, drawer or component in the current repo match its Figma design, then check the result in the browser at desktop and mobile width.
- **[owasp-audit](./skills/engineering/owasp-audit/SKILL.md)**: Audit a branch against the OWASP Top 10:2025 on Claude Mythos, validate every finding and suggest fixes.

<!-- /skills:engineering:user -->

**Model-invoked**

<!-- skills:engineering:model -->

_None yet._

<!-- /skills:engineering:model -->

### Productivity

**User-invoked**

<!-- skills:productivity:user -->

_None yet._

<!-- /skills:productivity:user -->

**Model-invoked**

<!-- skills:productivity:model -->

_None yet._

<!-- /skills:productivity:model -->
