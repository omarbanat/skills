#!/usr/bin/env bash
# Runs whichever dependency auditors fit the project and are already installed.
# Installs nothing. Auditors send package names and versions to their advisory
# database; no project code leaves the machine.
#
#   deps-audit.sh <root>
#
# Prints one section per manifest found, then lists auditors that would apply
# but aren't installed. Exits 0 even when advisories are found.
set -uo pipefail

ROOT="${1:-.}"
cd "$ROOT" || { echo "error: cannot cd to $ROOT" >&2; exit 1; }

missing=()
ran=0
have() { command -v "$1" >/dev/null 2>&1; }

section() {
  echo
  echo "=== $1 ==="
}

run() { # run <label> <cmd...>
  section "$1"
  ran=1
  "${@:2}" 2>&1 | head -n 300
  return 0
}

try() { # try <tool> <label> <cmd...>: run it if the tool is installed, else note it
  if have "$1"; then run "${@:2}"; else missing+=("$1"); fi
}

# Search only the root and one level down, skipping vendored folders.
found() { [ -n "$(find . -maxdepth 2 -name "$1" -not -path '*/node_modules/*' -not -path '*/.venv/*' -not -path '*/vendor/*' -print -quit)" ]; }

if found package-lock.json; then
  try npm "npm audit" npm audit --omit=dev
elif found pnpm-lock.yaml; then
  try pnpm "pnpm audit" pnpm audit --prod
elif found yarn.lock; then
  try yarn "yarn audit" yarn audit --groups dependencies
elif found bun.lock || found bun.lockb; then
  try bun "bun audit" bun audit
elif found package.json; then
  section "node"
  echo "package.json has no lockfile: installed versions are not pinned (A03 finding)."
fi

if found requirements.txt || found pyproject.toml || found poetry.lock || found uv.lock; then
  if [ -f requirements.txt ]; then try pip-audit "pip-audit" pip-audit -r requirements.txt
  else try pip-audit "pip-audit" pip-audit .; fi
fi

if found go.mod; then try govulncheck "govulncheck" govulncheck ./...; fi
if found Cargo.lock; then try cargo-audit "cargo audit" cargo audit; fi
if found Gemfile.lock; then try bundle-audit "bundle-audit" bundle-audit check --update; fi
if found composer.lock; then try composer "composer audit" composer audit; fi

# osv-scanner covers most ecosystems; run it as a second opinion when present.
if have osv-scanner; then
  run "osv-scanner" osv-scanner scan source -r .
fi

echo
if [ "$ran" = 0 ]; then
  echo "No auditor ran."
fi
if [ "${#missing[@]}" -gt 0 ]; then
  echo "Not installed but would apply: ${missing[*]}. Treat A03 as partly unchecked and say so in the coverage table."
fi
exit 0
