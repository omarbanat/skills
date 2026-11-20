#!/usr/bin/env node
// Checks this repo's invariants (see AGENTS.md) and exits 1 on any error.
//
//   node scripts/check.mjs                 check everything
//   node scripts/check.mjs --fix           also regenerate the derived parts:
//                                          plugin.json's `skills` array and the
//                                          skill lists between <!-- skills:... --> markers
//   node scripts/check.mjs --no-validate   skip `claude plugin validate`
//
// `claude plugin validate` runs without --strict: its warnings (CLAUDE.md at the
// plugin root, no LICENSE or icon) are expected for a private repo and do not fail.
//
// The skill folders and their SKILL.md frontmatter are the source of truth.
// Regenerating keeps the order and hand-written one-liners of entries that are
// already listed, and appends new ones using the first sentence of the description.
//
// It also enforces the checkable rules from .agents/writing-skills.md: the name
// format, the description and body caps (errors), a "Use when" trigger in
// model-invoked descriptions and a table of contents in long reference files (warnings).

import { existsSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { BUCKETS, NAME_RE, PLUGIN_JSON, PROMOTED, REPO, listSkills, summaryOf } from "./lib.mjs";

const MAX_DESCRIPTION = 1024;
const MAX_BODY_LINES = 500;
const TOC_ABOVE_LINES = 300;

const fix = process.argv.includes("--fix");
const validate = !process.argv.includes("--no-validate");

export function run({ fix = false, validate = true, quiet = false } = {}) {
  const errors = [];
  const warnings = [];
  const fixed = [];
  const skills = listSkills(errors);

  checkFrontmatter(skills, errors, warnings);
  const before = errors.length;
  syncPluginJson(skills, fix, errors, fixed);
  syncReadmes(skills, fix, errors, fixed);
  const fixable = errors.slice(before).some((e) => e.includes("out of date"));
  // Validate after --fix has written plugin.json, so it sees the final manifest.
  if (validate) validatePlugin(errors);

  if (!quiet) {
    for (const f of fixed) console.log(`fixed: ${f}`);
    for (const w of warnings) console.log(`warning: ${w}`);
    for (const e of errors) console.error(`error: ${e}`);
    if (errors.length === 0) {
      console.log(`ok: ${skills.length} skill${skills.length === 1 ? "" : "s"} checked`);
    } else if (fixable) {
      console.error("\nRun `node scripts/check.mjs --fix` to regenerate plugin.json and the README lists.");
    }
  }
  return { errors, warnings, fixed };
}

function checkFrontmatter(skills, errors, warnings) {
  const seen = new Map();
  for (const s of skills) {
    const where = `${s.rel}/SKILL.md`;
    if (seen.has(s.name)) {
      errors.push(`${where}: skill name "${s.name}" is also used by ${seen.get(s.name)}`);
    }
    seen.set(s.name, s.rel);

    const fm = s.frontmatter;
    if (!fm) {
      errors.push(`${where}: missing YAML frontmatter (--- name/description ---)`);
      continue;
    }
    for (const key of fm.unsafe) {
      errors.push(`${where}: \`${key}\` is not valid YAML unquoted (it contains ": ", " #" or starts with a special character). Wrap it in double quotes or use a \`>\` block.`);
    }
    if (!fm.name) errors.push(`${where}: frontmatter has no \`name\``);
    else if (fm.name !== s.name) errors.push(`${where}: \`name: ${fm.name}\` does not match its folder "${s.name}"`);
    if (!NAME_RE.test(s.name) || s.name.length > 64) {
      errors.push(`${where}: name must be lowercase letters, digits and single hyphens, at most 64 characters`);
    }
    if (!fm.description) errors.push(`${where}: frontmatter has no \`description\``);
    else if (fm.description.length > MAX_DESCRIPTION) {
      errors.push(`${where}: description is ${fm.description.length} characters (max ${MAX_DESCRIPTION})`);
    } else if (/\bTODO\b/.test(fm.description)) {
      warnings.push(`${where}: description still contains TODO`);
    } else if (!s.userInvoked && !/\buse when\b/i.test(fm.description)) {
      warnings.push(`${where}: model-invoked description has no "Use when ..." trigger. Add one, or set disable-model-invocation: true.`);
    }
    const dmi = fm["disable-model-invocation"];
    if (dmi !== undefined && dmi !== "true" && dmi !== "false") {
      errors.push(`${where}: disable-model-invocation must be true or false`);
    }
    if (s.bodyLines > MAX_BODY_LINES) {
      errors.push(`${where}: body is ${s.bodyLines} lines (max ${MAX_BODY_LINES}). Move what only some runs need into references/.`);
    }
    checkReferences(s, warnings);
  }
}

// A long reference file needs a table of contents so the agent can jump to the part it needs.
function checkReferences(skill, warnings) {
  const refs = join(skill.dir, "references");
  if (!existsSync(refs)) return;
  for (const entry of readdirSync(refs, { recursive: true }).sort()) {
    if (!entry.endsWith(".md")) continue;
    const text = readFileSync(join(refs, entry), "utf8");
    const lines = text.trimEnd().split(/\r?\n/).length;
    if (lines > TOC_ABOVE_LINES && !/^(#{1,6} +|\*\*)(table of )?contents\b/im.test(text)) {
      warnings.push(`${skill.rel}/references/${entry}: ${lines} lines with no table of contents. Add a "## Contents" list near the top.`);
    }
  }
}

// plugin.json ships exactly the skills in the promoted buckets.
function syncPluginJson(skills, fix, errors, fixed) {
  if (!existsSync(PLUGIN_JSON)) {
    errors.push(".claude-plugin/plugin.json is missing");
    return;
  }
  const plugin = JSON.parse(readFileSync(PLUGIN_JSON, "utf8"));
  const current = (plugin.skills ?? []).map((p) => p.replace(/\/+$/, ""));
  const wanted = skills.filter((s) => PROMOTED.includes(s.bucket)).map((s) => `./${s.rel}`);
  const next = [...current.filter((p) => wanted.includes(p)), ...wanted.filter((p) => !current.includes(p))];

  const missing = wanted.filter((p) => !current.includes(p));
  const extra = current.filter((p) => !wanted.includes(p));
  if (missing.length === 0 && extra.length === 0) return;

  if (fix) {
    plugin.skills = next;
    writeFileSync(PLUGIN_JSON, JSON.stringify(plugin, null, 2) + "\n");
    fixed.push(`.claude-plugin/plugin.json skills (${describeDiff(missing, extra)})`);
  } else {
    errors.push(`.claude-plugin/plugin.json skills out of date (${describeDiff(missing, extra)})`);
  }
}

const ENTRY_RE = /^- \*\*\[([a-z0-9-]+)\]\(([^)]+)\)\*\*: (.*)$/;
const EMPTY = "_None yet._";

// Each README region lists the skills that belong to it, between
// <!-- key --> and <!-- /key --> markers.
function regionsFor(skills) {
  const byInvocation = (bucket, user) => skills.filter((s) => s.bucket === bucket && s.userInvoked === user);
  const regions = [];
  for (const bucket of PROMOTED) {
    for (const [inv, user] of [["user", true], ["model", false]]) {
      regions.push({ file: "README.md", key: `skills:${bucket}:${inv}`, prefix: `./skills/${bucket}/`, skills: byInvocation(bucket, user) });
      regions.push({ file: `skills/${bucket}/README.md`, key: `skills:${inv}`, prefix: "./", skills: byInvocation(bucket, user) });
    }
  }
  for (const bucket of BUCKETS.filter((b) => !PROMOTED.includes(b))) {
    regions.push({ file: `skills/${bucket}/README.md`, key: "skills", prefix: "./", skills: skills.filter((s) => s.bucket === bucket) });
  }
  return regions;
}

function syncReadmes(skills, fix, errors, fixed) {
  const regions = regionsFor(skills);
  const files = new Map();
  const summaries = new Map();

  // Read every region first so a skill moving between lists keeps its one-liner.
  for (const r of regions) {
    const path = join(REPO, r.file);
    if (!existsSync(path)) {
      errors.push(`${r.file} is missing`);
      r.broken = true;
      continue;
    }
    if (!files.has(r.file)) files.set(r.file, readFileSync(path, "utf8"));
    const m = files.get(r.file).match(regionRe(r.key));
    if (!m) {
      errors.push(`${r.file}: missing the <!-- ${r.key} --> ... <!-- /${r.key} --> markers`);
      r.broken = true;
      continue;
    }
    r.entries = [];
    for (const line of m[1].split("\n").map((l) => l.trim()).filter(Boolean)) {
      if (line === EMPTY) continue;
      const e = line.match(ENTRY_RE);
      if (!e) {
        errors.push(`${r.file}: unrecognized line in <!-- ${r.key} --> (expected "- **[name](path)**: summary"): ${line}`);
        r.broken = true;
        break;
      }
      r.entries.push({ name: e[1], summary: e[3] });
      if (!summaries.has(e[1])) summaries.set(e[1], e[3]);
    }
  }

  for (const r of regions) {
    if (r.broken) continue;
    const wanted = r.skills.map((s) => s.name);
    const have = r.entries.map((e) => e.name);
    const names = [...have.filter((n) => wanted.includes(n)), ...wanted.filter((n) => !have.includes(n))];
    const lines = names.map((name) => {
      const s = r.skills.find((x) => x.name === name);
      const summary = r.entries.find((e) => e.name === name)?.summary ?? summaries.get(name) ?? summaryOf(s.frontmatter?.description);
      return `- **[${name}](${r.prefix}${name}/SKILL.md)**: ${summary}`;
    });
    const block = `<!-- ${r.key} -->\n\n${lines.length ? lines.join("\n") : EMPTY}\n\n<!-- /${r.key} -->`;
    const text = files.get(r.file);
    const updated = text.replace(regionRe(r.key), () => block);
    if (updated === text) continue;

    const missing = wanted.filter((n) => !have.includes(n));
    const extra = have.filter((n) => !wanted.includes(n));
    const detail = missing.length || extra.length ? describeDiff(missing, extra) : "formatting or links";
    if (fix) {
      files.set(r.file, updated);
      fixed.push(`${r.file} <!-- ${r.key} --> (${detail})`);
    } else {
      errors.push(`${r.file}: list <!-- ${r.key} --> out of date (${detail})`);
    }
  }

  if (fix) {
    for (const [file, text] of files) {
      const path = join(REPO, file);
      if (readFileSync(path, "utf8") !== text) writeFileSync(path, text);
    }
  }
}

function validatePlugin(errors) {
  const result = spawnSync("claude", ["plugin", "validate", "."], { cwd: REPO, encoding: "utf8" });
  if (result.error?.code === "ENOENT") return; // Claude Code CLI not installed: skip.
  if (result.status !== 0) {
    errors.push(`claude plugin validate . failed:\n${(result.stdout + result.stderr).trim()}`);
  }
}

function regionRe(key) {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<!-- ${k} -->\\n([\\s\\S]*?)<!-- /${k} -->`);
}

function describeDiff(missing, extra) {
  const parts = [];
  if (missing.length) parts.push(`add ${missing.join(", ")}`);
  if (extra.length) parts.push(`remove ${extra.join(", ")}`);
  return parts.join("; ");
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const { errors } = run({ fix, validate });
  process.exit(errors.length ? 1 : 0);
}
