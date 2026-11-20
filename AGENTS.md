# Skills repo

Omar Banat's agent skills. A skill is a folder `skills/<bucket>/<name>/` holding a `SKILL.md` plus any references and scripts it needs. The buckets:

| Bucket | What goes there | In the plugin | Linked into `~/.claude/skills` |
| --- | --- | --- | --- |
| `engineering/` | daily code work | yes | yes |
| `productivity/` | daily work that is not code | yes | yes |
| `in-progress/` | drafts being tried out | no | yes |
| `misc/` | kept, rarely used | no | no |
| `deprecated/` | retired | no | no |

The bucket list lives in three places that must agree: this table, `BUCKETS`/`PROMOTED` in `scripts/lib.mjs`, and `LINKED_BUCKETS` in `scripts/link-skills.sh`.

## Rules

- Create a skill with `node scripts/new-skill.mjs <bucket> <name> [--model]`. Don't hand-create the folder; the script also updates the lists and links the skill.
- A new skill is user-invoked. Pass `--model` only when the agent, or another skill, must reach it without the user typing `/name`.
- Write and edit skills by following [.agents/writing-skills.md](./.agents/writing-skills.md). It covers what belongs in a skill, invocation, descriptions, the body, file layout and testing.
- The folder name and the `name:` in frontmatter must match.
- New skills start in `in-progress/` unless the user names another bucket.
- The skill folders are the source of truth. These parts are derived from them by `node scripts/check.mjs --fix`, so never add or remove their entries by hand:
  - the `skills` array in `.claude-plugin/plugin.json`
  - the lists between `<!-- skills... -->` and `<!-- /skills... -->` markers in `README.md` and each `skills/<bucket>/README.md`

  Editing the one-line summary of an entry is fine. `--fix` keeps it.
- After moving, renaming or deleting a skill, or changing its description or `disable-model-invocation`, run `node scripts/check.mjs --fix` and then `scripts/link-skills.sh`.
- Run `node scripts/check.mjs` before committing. The pre-commit hook in `.githooks/` runs it too.
- When a change to an `engineering/` or `productivity/` skill should reach people who installed the plugin, bump `version` in `.claude-plugin/plugin.json` (semver). Symlinked installs don't need a bump.
- Never put credentials, tokens or customer data in a skill. Skills are plain text, and the plugin copies them to other machines.
