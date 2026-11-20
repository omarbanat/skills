#!/usr/bin/env bash
# Symlinks this repo's skills into ~/.claude/skills (and ~/.agents/skills when that
# folder exists), so edits here apply in the current session with no install step.
#
#   scripts/link-skills.sh            link engineering/, productivity/ and in-progress/ skills
#   scripts/link-skills.sh --unlink   remove every link that points into this repo
#
# misc/ and deprecated/ are never linked. Links whose skill was renamed, deleted or
# moved to an unlinked bucket are removed. A real folder that already has a skill's
# name is left alone and reported: move it into the repo first, then re-run.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
LINKED_BUCKETS="engineering productivity in-progress" # keep in sync with scripts/lib.mjs
UNLINK=0
[ "${1:-}" = "--unlink" ] && UNLINK=1

DESTS=("$HOME/.claude/skills")
[ -d "$HOME/.agents/skills" ] && DESTS+=("$HOME/.agents/skills")

# Collect the skills to link, and refuse duplicate names (the second would shadow the first).
names=()
srcs=()
for bucket in $LINKED_BUCKETS; do
  [ "$UNLINK" = 1 ] && break
  for skill_md in "$REPO/skills/$bucket"/*/SKILL.md; do
    [ -e "$skill_md" ] || continue
    src="$(dirname "$skill_md")"
    name="$(basename "$src")"
    for existing in ${names[@]+"${names[@]}"}; do
      if [ "$existing" = "$name" ]; then
        echo "error: two skills are named \"$name\". Run node scripts/check.mjs." >&2
        exit 1
      fi
    done
    names+=("$name")
    srcs+=("$src")
  done
done

is_wanted() {
  local path="$1" s
  for s in ${srcs[@]+"${srcs[@]}"}; do
    [ "$s" = "$path" ] && return 0
  done
  return 1
}

for DEST in "${DESTS[@]}"; do
  # A destination that is itself a link into the repo would make us write links into skills/.
  if [ -L "$DEST" ]; then
    case "$(cd "$DEST" && pwd -P)" in
      "$REPO" | "$REPO"/*)
        echo "error: $DEST is a symlink into this repo. Remove it and re-run." >&2
        exit 1
        ;;
    esac
  fi
  mkdir -p "$DEST"

  # Remove links into this repo that no longer point at a skill we link.
  for entry in "$DEST"/* "$DEST"/.[!.]*; do
    [ -L "$entry" ] || continue
    target="$(readlink "$entry")"
    case "$target" in
      "$REPO"/skills/*)
        if ! is_wanted "$target"; then
          rm "$entry"
          echo "unlinked $(basename "$entry") ($DEST)"
        fi
        ;;
    esac
  done

  for i in ${names[@]+"${!names[@]}"}; do
    name="${names[$i]}"
    src="${srcs[$i]}"
    target="$DEST/$name"
    if [ -L "$target" ]; then
      current="$(readlink "$target")"
      [ "$current" = "$src" ] && continue
      case "$current" in
        "$REPO"/*) ;; # an old link into this repo: replace it
        *)
          echo "skipped $name: $target already links to $current" >&2
          continue
          ;;
      esac
    elif [ -e "$target" ]; then
      echo "skipped $name: $target is a real folder. Move it into this repo, then re-run." >&2
      continue
    fi
    ln -sfn "$src" "$target"
    echo "linked $name -> ${src#"$REPO"/} ($DEST)"
  done
done
