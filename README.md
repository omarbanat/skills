# Skills

My agent skills for Claude Code. Each skill is a folder with a `SKILL.md` and whatever references or scripts it needs, filed in a bucket under [`skills/`](./skills).

## Install

Use one route per machine. With both, every skill shows up twice.

**Symlinks (for working on the skills).** Edits take effect in your next session, with no reinstall.

```bash
git clone https://github.com/omarbanat/skills.git
cd skills
scripts/link-skills.sh
git config core.hooksPath .githooks   # run the checks before each commit
```

This links every skill in `engineering/`, `productivity/` and `in-progress/` into `~/.claude/skills`. It never replaces a real folder that has the same name. Run `scripts/link-skills.sh --unlink` to remove the links.

**Plugin (for using them without editing).** You need read access to this private repo.

```
/plugin marketplace add omarbanat/skills
/plugin install omarbanat-skills@omarbanat
```

The plugin ships only `engineering/` and `productivity/`. Its skills appear as `omarbanat-skills:<name>`, and installed copies update when `version` in [`.claude-plugin/plugin.json`](./.claude-plugin/plugin.json) is bumped.

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
node scripts/new-skill.mjs in-progress my-skill          # Claude can pick it up on its own
node scripts/new-skill.mjs in-progress my-skill --user   # runs only when you type /my-skill
```

This creates `skills/in-progress/my-skill/SKILL.md` from [the template](./.agents/skill-template.md), adds it to the lists below and to `plugin.json`, and links it. Then write the skill, following [writing-skills.md](./.agents/writing-skills.md).

To bring in a skill that already lives in `~/.claude/skills`:

```bash
mv ~/.claude/skills/my-skill skills/engineering/
node scripts/check.mjs --fix && scripts/link-skills.sh
```

When a skill graduates, renames or retires, move its folder and run the same two commands.

## Checks

`node scripts/check.mjs` checks that:

- each folder name matches its `name:`, names are unique, and descriptions are present and at most 1024 characters
- `plugin.json` lists exactly the `engineering/` and `productivity/` skills
- the skill lists in this README and in each bucket README are up to date
- `claude plugin validate .` passes (its warnings about CLAUDE.md, LICENSE and icon are expected and ignored)

`--fix` regenerates `plugin.json` and the lists. It keeps one-liners you have edited by hand.

## Skills

**User-invoked** skills run only when you type `/name`. **Model-invoked** skills also run when Claude decides a task matches their description.

### Engineering

**User-invoked**

<!-- skills:engineering:user -->

_None yet._

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
