// Shared helpers for check.mjs and new-skill.mjs.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SKILLS_DIR = join(REPO, "skills");
export const PLUGIN_JSON = join(REPO, ".claude-plugin", "plugin.json");
export const TEMPLATE = join(REPO, ".agents", "skill-template.md");

// Keep in sync with LINKED_BUCKETS in link-skills.sh and the table in AGENTS.md.
export const BUCKETS = ["engineering", "productivity", "in-progress", "misc", "deprecated"];
export const PROMOTED = ["engineering", "productivity"];

export const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Every skills/<bucket>/<name>/SKILL.md. Problems with the folder layout go into `errors`.
export function listSkills(errors = []) {
  const skills = [];
  if (!existsSync(SKILLS_DIR)) return skills;
  for (const bucket of readdirSync(SKILLS_DIR).sort()) {
    const bucketDir = join(SKILLS_DIR, bucket);
    if (!statSync(bucketDir).isDirectory()) continue;
    if (!BUCKETS.includes(bucket)) {
      errors.push(`skills/${bucket}/: unknown bucket (expected one of ${BUCKETS.join(", ")})`);
      continue;
    }
    for (const name of readdirSync(bucketDir).sort()) {
      const dir = join(bucketDir, name);
      if (!statSync(dir).isDirectory()) continue;
      const file = join(dir, "SKILL.md");
      if (!existsSync(file)) {
        errors.push(`skills/${bucket}/${name}/: folder has no SKILL.md`);
        continue;
      }
      const text = readFileSync(file, "utf8");
      const frontmatter = parseFrontmatter(text);
      skills.push({
        bucket,
        name,
        dir,
        rel: `skills/${bucket}/${name}`,
        frontmatter,
        bodyLines: bodyLineCount(text),
        userInvoked: frontmatter?.["disable-model-invocation"] === "true",
      });
    }
  }
  return skills;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\s*(\r?\n|$)/;

// Lines of SKILL.md after the frontmatter, not counting blank lines at either end.
export function bodyLineCount(text) {
  const body = text.replace(FRONTMATTER_RE, "").trim();
  return body ? body.split(/\r?\n/).length : 0;
}

// Minimal YAML frontmatter reader: top-level `key: value` pairs, quoted strings,
// and `>` / `|` block scalars. Enough for SKILL.md headers; returns null when absent.
export function parseFrontmatter(text) {
  const match = text.match(FRONTMATTER_RE);
  if (!match) return null;
  const lines = match[1].split(/\r?\n/);
  const data = {};
  const unsafe = [];
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, raw] = kv;
    let value = raw.trim();
    if (/^[>|][+-]?$/.test(value)) {
      const block = [];
      while (i + 1 < lines.length && (/^\s+\S/.test(lines[i + 1]) || lines[i + 1].trim() === "")) {
        block.push(lines[++i].trim());
      }
      value = value.startsWith(">") ? block.filter(Boolean).join(" ") : block.join("\n").trim();
    } else if (/^".*"$/.test(value)) {
      value = value.slice(1, -1).replace(/\\"/g, '"');
    } else if (/^'.*'$/.test(value)) {
      value = value.slice(1, -1).replace(/''/g, "'");
    } else if (/: |:$| #|^[[\]{}&*!%@`'"]/.test(value)) {
      // A real YAML parser rejects or misreads this unquoted value.
      unsafe.push(key);
    }
    data[key] = value;
  }
  Object.defineProperty(data, "unsafe", { value: unsafe }); // non-enumerable
  return data;
}

// First sentence of a description, used as the default README one-liner.
export function summaryOf(description = "") {
  const first = description.match(/^(.+?[.!?])(\s|$)/);
  return (first ? first[1] : description).trim();
}
