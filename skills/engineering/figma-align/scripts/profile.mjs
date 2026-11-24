#!/usr/bin/env node
// Finds the figma-align profile for the repository you're working in.
//
// Profiles live in <skill-dir>/projects/<key>/, where <key> is the GitHub
// `owner__repo` taken from the `origin` remote, so every clone and worktree of
// the same repo shares one profile. Without a remote, the key is the repo
// folder name.
//
//   node profile.mjs [PATH]    PATH defaults to the current directory
//
// Prints the repo root, the key, the profile directory, and whether the profile
// exists (with its files). If PATH isn't inside a git repo but has git repos one
// level down (a multi-repo ticket folder with backend/ and backoffice/, say), it
// lists them so you can pick the frontend one and rerun.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const PROFILE_FILES = ["frames.md", "design.md", "run.md"];

function git(args, cwd) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function keyFor(root) {
  const remote = git(["remote", "get-url", "origin"], root);
  const m = remote.match(/[:/]([^/:]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (m) return [`${m[1]}__${m[2]}`, remote];
  return [basename(root), remote || "(no origin remote)"];
}

const path = resolve(process.argv[2] ?? process.cwd());
const root = git(["rev-parse", "--show-toplevel"], path);

if (!root) {
  const repos = readdirSync(path)
    .sort()
    .map((d) => join(path, d))
    .filter((d) => existsSync(join(d, ".git"))); // a folder (clone) or a file (worktree)
  if (repos.length) {
    console.log(`${path} is not a git repo. Repos inside it:`);
    for (const r of repos) console.log(`  ${r}`);
    console.log("Rerun with the frontend repo's path.");
  } else {
    console.log(`${path} is not inside a git repo.`);
  }
  process.exit(2);
}

const [key, remote] = keyFor(root);
const pdir = join(SKILL_DIR, "projects", key);
const present = PROFILE_FILES.filter((f) => existsSync(join(pdir, f)));

console.log(`repo_root:   ${root}`);
console.log(`remote:      ${remote}`);
console.log(`key:         ${key}`);
console.log(`profile_dir: ${pdir}`);
if (present.length === PROFILE_FILES.length) {
  console.log(`status:      READY (${present.join(", ")})`);
} else if (present.length) {
  const missing = PROFILE_FILES.filter((f) => !present.includes(f));
  console.log(`status:      PARTIAL (has ${present.join(", ")}; missing ${missing.join(", ")})`);
} else {
  console.log("status:      NONE (first run in this project: follow references/setup.md)");
}
