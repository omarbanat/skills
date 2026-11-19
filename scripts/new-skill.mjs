#!/usr/bin/env node
// Scaffolds a new skill from .agents/skill-template.md, updates the README lists
// and plugin.json, and links the skill into ~/.claude/skills when its bucket is linked.
//
//   node scripts/new-skill.mjs <bucket> <name> [--user]
//
//   --user   user-invoked: only runs when you type /<name> (disable-model-invocation: true)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { BUCKETS, NAME_RE, REPO, SKILLS_DIR, TEMPLATE, listSkills } from "./lib.mjs";
import { run as check } from "./check.mjs";

const args = process.argv.slice(2);
const user = args.includes("--user");
const [bucket, name] = args.filter((a) => !a.startsWith("--"));

function fail(message) {
  console.error(`error: ${message}`);
  console.error("usage: node scripts/new-skill.mjs <bucket> <name> [--user]");
  process.exit(1);
}

if (!bucket || !name) fail("bucket and name are required");
if (!BUCKETS.includes(bucket)) fail(`unknown bucket "${bucket}" (expected one of ${BUCKETS.join(", ")})`);
if (!NAME_RE.test(name) || name.length > 64) {
  fail(`"${name}" is not a valid skill name: use lowercase letters, digits and single hyphens, at most 64 characters`);
}
const clash = listSkills().find((s) => s.name === name);
if (clash) fail(`a skill named "${name}" already exists at ${clash.rel}`);

const dir = join(SKILLS_DIR, bucket, name);
if (existsSync(dir)) fail(`${dir} already exists`);

const title = name
  .split("-")
  .map((w) => w[0].toUpperCase() + w.slice(1))
  .join(" ");
const description = user
  ? "TODO one line describing what this does, shown in the slash-command menu."
  : "TODO what this skill does, in one sentence. Use when the user asks to ..., mentions ..., or wants ....";

const body = readFileSync(TEMPLATE, "utf8")
  .replace(/^<!--[\s\S]*?-->\n+/, "") // drop the template's own header comment
  .replaceAll("{{name}}", name)
  .replaceAll("{{title}}", title)
  .replaceAll("{{description}}", description)
  .replaceAll("{{invocation}}", user ? "disable-model-invocation: true\n" : "");

mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "SKILL.md"), body);
console.log(`created skills/${bucket}/${name}/SKILL.md (${user ? "user-invoked" : "model-invoked"})`);

const { errors } = check({ fix: true, validate: false, quiet: true });
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  process.exit(1);
}
console.log("updated README lists and .claude-plugin/plugin.json");

const link = spawnSync(join(REPO, "scripts", "link-skills.sh"), [], { stdio: "inherit" });
if (link.status !== 0) process.exit(link.status ?? 1);

console.log(`\nNext: write the description and body in skills/${bucket}/${name}/SKILL.md (see .agents/writing-skills.md).`);
