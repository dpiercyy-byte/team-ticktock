#!/usr/bin/env node
/**
 * Style contract check.
 *
 * Clockwise and Ledger share one visual language driven by semantic tokens
 * (`.cw-scope` / `.ledger-scope` in src/styles.css). Literal color utilities
 * bypass that system and silently break theming, so they're banned in app UI.
 *
 * Existing violations live in `scripts/style-contract-allowlist.json`. The
 * allowlist is a ratchet: it may shrink, never grow. Run with `--update` after
 * a deliberate cleanup to re-record it.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const DIRS = ["src/components", "src/routes"];
const ALLOWLIST = "scripts/style-contract-allowlist.json";
const UPDATE = process.argv.includes("--update");

const RULES = [
  { id: "gray-scale-bg", re: /\b(?:bg|text|border)-(?:gray|slate|zinc|neutral|stone)-\d{2,3}\b/g },
  { id: "absolute-bw", re: /\b(?:bg|text|border)-(?:white|black)(?:\/\d{1,3})?\b/g },
  { id: "arbitrary-hex", re: /\b(?:bg|text|border|fill|stroke)-\[#[0-9a-fA-F]{3,8}\]/g },
  { id: "inline-hex-style", re: /(?:color|background(?:Color)?)\s*:\s*["'`]#[0-9a-fA-F]{3,8}/g },
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

const findings = [];
for (const dir of DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    // shadcn primitives are vendored and intentionally token-free in places.
    if (rel.startsWith("src/components/ui/")) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const rule of RULES) {
        rule.re.lastIndex = 0;
        for (const m of line.matchAll(rule.re)) {
          findings.push({ file: rel, line: i + 1, rule: rule.id, match: m[0] });
        }
      }
    });
  }
}

const key = (f) => `${f.file}:${f.line}:${f.match}`;

if (UPDATE) {
  writeFileSync(
    join(ROOT, ALLOWLIST),
    JSON.stringify({ generatedAt: new Date().toISOString(), allowed: findings.map(key).sort() }, null, 2) + "\n",
  );
  console.log(`Recorded ${findings.length} known violations in ${ALLOWLIST}`);
  process.exit(0);
}

let allowed = new Set();
try {
  allowed = new Set(JSON.parse(readFileSync(join(ROOT, ALLOWLIST), "utf8")).allowed);
} catch {
  console.error(`Missing ${ALLOWLIST}. Run: npm run lint:style -- --update`);
  process.exit(1);
}

const newOnes = findings.filter((f) => !allowed.has(key(f)));
const fixed = [...allowed].filter((k) => !findings.some((f) => key(f) === k));

if (newOnes.length) {
  console.error(`\nStyle contract: ${newOnes.length} new hardcoded color(s).\n`);
  for (const f of newOnes) console.error(`  ${f.file}:${f.line}  ${f.rule}  ->  ${f.match}`);
  console.error(`\nUse semantic tokens (bg-card, text-muted-foreground, .cw-card, .cw-input, …) instead.\n`);
  process.exit(1);
}

console.log(
  `Style contract OK — ${findings.length} known violation(s) remaining` +
    (fixed.length ? `, ${fixed.length} cleaned up since last snapshot (run with --update to ratchet).` : "."),
);
