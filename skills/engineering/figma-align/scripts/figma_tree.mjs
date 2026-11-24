#!/usr/bin/env node
// Makes a Figma `get_metadata` dump readable.
//
// `get_metadata` output for a page or a large frame is too big to read inline
// (a frame is ~100K chars, page 0:1 is ~5M), so Claude Code saves it to a
// tool-results file: a JSON array of {"type": "text", "text": ...} parts whose
// joined text is XML-like (<frame id=.. name=.. x=.. y=.. width=.. height=..>),
// with plain-text notes from the MCP mixed in, which is why XML parsers choke
// on it. This script reads that file (or raw text) and prints what you need.

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

const USAGE = `Usage:
  figma_tree.mjs FILE                       tree, depth 3, from the top
  figma_tree.mjs FILE --root 2391:20462     subtree of one node (also accepts 2391-20462)
  figma_tree.mjs FILE --depth 5             deeper
  figma_tree.mjs FILE --text                every text layer under root, in order (copy inventory)
  figma_tree.mjs FILE --find "Analyse"      nodes whose name contains the string, with their path
  figma_tree.mjs FILE --top                 top-level frames of a page, row by row, with section labels
  figma_tree.mjs FILE --top --min-y=16000   only frames below some banner (e.g. a "V2" area)

FILE is a saved get_metadata tool-results file, a raw text file, or - for stdin.
Vector, clip-path and anonymous "Group"/"Vector" layers are hidden unless --all.
Write a negative --min-y with "=" (--min-y=-3000).`;

const TAG = /<(\/?)(\w+)((?:\s+\w+="[^"]*")*)\s*(\/?)>/g;
const ATTR = /(\w+)="([^"]*)"/g;
const NOISE_TYPES = new Set(["vector", "boolean-operation", "line", "ellipse", "star", "regular-polygon"]);
const NOISE_NAMES = /^(Group|Vector|Clip path group|SVGID_.*|Mask group|Union|Subtract)$/;
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function loadText(path) {
  const raw = readFileSync(path === "-" ? 0 : path, "utf8");
  if (raw.trimStart().startsWith("[")) {
    try {
      return JSON.parse(raw)
        .map((p) => p?.text ?? "")
        .join("");
    } catch {
      // Not JSON after all: treat it as raw text.
    }
  }
  return raw;
}

function unescape(s) {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (m, e) => {
    if (e[0] !== "#") return ENTITIES[e] ?? m;
    const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
  });
}

// Every tag with an id becomes a node: {id, type, name, x, y, w, h, depth, parent}.
function parse(text) {
  const nodes = [];
  const stack = [];
  for (const [, closing, type, attrs, selfClose] of text.matchAll(TAG)) {
    if (closing) {
      stack.pop();
      continue;
    }
    const a = Object.fromEntries([...attrs.matchAll(ATTR)].map((m) => [m[1], m[2]]));
    if (!("id" in a)) continue;
    nodes.push({
      id: a.id,
      type,
      name: unescape(a.name ?? ""),
      x: Number(a.x ?? 0),
      y: Number(a.y ?? 0),
      w: Number(a.width ?? 0),
      h: Number(a.height ?? 0),
      depth: stack.length,
      parent: stack.length ? stack[stack.length - 1] : null,
    });
    if (!selfClose) stack.push(nodes.length - 1);
  }
  return nodes;
}

const isNoise = (n) => NOISE_TYPES.has(n.type) || NOISE_NAMES.test(n.name);

function subtree(nodes, rootIdx) {
  const base = nodes[rootIdx].depth;
  const out = [rootIdx];
  for (let i = rootIdx + 1; i < nodes.length && nodes[i].depth > base; i++) out.push(i);
  return out;
}

function pathOf(nodes, i) {
  const names = [];
  for (; i !== null; i = nodes[i].parent) names.push(nodes[i].name || nodes[i].id);
  return names.reverse().join(" > ");
}

const r = Math.round;
const fmt = (n, baseDepth) =>
  `${"  ".repeat(n.depth - baseDepth)}${n.id.padEnd(14)} ${n.type.padEnd(9)} ` +
  `${JSON.stringify(n.name.slice(0, 60)).padEnd(64)} ${r(n.w)}x${r(n.h)} @${r(n.x)},${r(n.y)}`;

function number(name, value) {
  const n = Number(value);
  if (value === "" || Number.isNaN(n)) fail(`--${name} needs a number, got "${value}"\n\n${USAGE}`, 2);
  return n;
}

let args;
try {
  args = parseArgs({
    allowPositionals: true,
    options: {
      root: { type: "string" },
      depth: { type: "string", default: "3" },
      text: { type: "boolean" },
      find: { type: "string" },
      top: { type: "boolean" },
      "min-y": { type: "string" },
      all: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
} catch (e) {
  fail(`${e.message}\n\n${USAGE}`, 2);
}
const opts = args.values;
const file = args.positionals[0];
if (opts.help) {
  console.log(USAGE);
  process.exit(0);
}
if (!file) fail(USAGE, 2);
const depth = number("depth", opts.depth);
const minY = opts["min-y"] === undefined ? null : number("min-y", opts["min-y"]);

const nodes = parse(loadText(file));
if (!nodes.length) fail("No nodes found. Is this a get_metadata output?");

let idxs = nodes.map((_, i) => i);
if (opts.root) {
  const rid = opts.root.replaceAll("-", ":");
  const hit = nodes.findIndex((n) => n.id === rid);
  if (hit === -1) {
    fail(`Node ${rid} not in this dump. The designer may have deleted or re-created it; re-pull metadata of its parent.`);
  }
  idxs = subtree(nodes, hit);
}
const base = nodes[idxs[0]].depth;
const lines = [];

if (opts.top) {
  let top = idxs.filter((i) => nodes[i].depth === base + 1);
  if (minY !== null) top = top.filter((i) => nodes[i].y > minY);
  top.sort((i, j) => nodes[i].y - nodes[j].y || nodes[i].x - nodes[j].x);
  for (const i of top) {
    const n = nodes[i];
    let line = fmt(n, base + 1);
    // Anonymous groups and sections usually carry a row label ("Analytique", "Logout"...)
    if (n.type === "section" || /^(Group|Frame|Section) \d+$/.test(n.name) || n.name === "Note" || n.name === "Banner") {
      const texts = subtree(nodes, i)
        .slice(1)
        .filter((j) => nodes[j].type === "text")
        .map((j) => nodes[j].name);
      if (texts.length) line += `   [${texts.join(" / ").slice(0, 120)}]`;
    }
    lines.push(line);
  }
} else if (opts.find) {
  const q = opts.find.toLowerCase();
  for (const i of idxs) {
    const n = nodes[i];
    if (n.name.toLowerCase().includes(q)) {
      lines.push(`${n.id.padEnd(14)} ${n.type.padEnd(9)} ${r(n.w)}x${r(n.h)}  ${pathOf(nodes, i).slice(0, 160)}`);
    }
  }
} else if (opts.text) {
  for (const i of idxs) {
    if (nodes[i].type === "text") lines.push(`${nodes[i].id.padEnd(14)} ${nodes[i].name}`);
  }
} else {
  for (const i of idxs) {
    const n = nodes[i];
    if (n.depth - base > depth) continue;
    if (!opts.all && i !== idxs[0] && isNoise(n)) continue;
    lines.push(fmt(n, base));
  }
}

// Output is often piped to `head`; exit quietly when the pipe closes early.
process.stdout.on("error", (e) => (e.code === "EPIPE" ? process.exit(0) : fail(e.message)));
if (lines.length) process.stdout.write(lines.join("\n") + "\n");
