// CI lint gate — Etapa 0 (rede de segurança).
//
// Runs ESLint once over the project, prints the error/warning/any counts, and
// FAILS the build (exit 1) if either:
//   1. the total number of ESLint errors is greater than the committed baseline
//      (ci/lint-baseline.json -> maxErrors), or
//   2. the number of "@typescript-eslint/no-explicit-any" violations is greater
//      than the baseline (ci/lint-baseline.json -> maxAny) — this freezes the
//      "no new `any`" rule even if some other error was removed to compensate.
//
// The baseline may only go DOWN: when you fix legacy lint debt, lower the
// numbers in ci/lint-baseline.json within the same change.
//
// This is the authoritative "lint" step in CI. `npm run lint` (plain `eslint .`)
// still exists for local, human-readable output.

import { ESLint } from "eslint";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ANY_RULE = "@typescript-eslint/no-explicit-any";

const baseline = JSON.parse(
  readFileSync(join(root, "ci", "lint-baseline.json"), "utf8"),
);

const eslint = new ESLint({ cwd: root });
const results = await eslint.lintFiles(["."]);

let errors = 0;
let warnings = 0;
let anyCount = 0;
const filesWithErrors = [];

for (const result of results) {
  errors += result.errorCount;
  warnings += result.warningCount;
  for (const message of result.messages) {
    if (message.ruleId === ANY_RULE && message.severity === 2) anyCount += 1;
  }
  if (result.errorCount > 0) {
    filesWithErrors.push({
      file: relative(root, result.filePath),
      count: result.errorCount,
    });
  }
}

console.log("── Lint gate ─────────────────────────────────");
console.log(`  errors:          ${errors}  (baseline max ${baseline.maxErrors})`);
console.log(`  warnings:        ${warnings}  (not gated)`);
console.log(`  no-explicit-any: ${anyCount}  (baseline max ${baseline.maxAny})`);
console.log("──────────────────────────────────────────────");

let failed = false;

if (errors > baseline.maxErrors) {
  failed = true;
  console.error(
    `\n✗ ESLint errors regressed: ${errors} > baseline ${baseline.maxErrors}.`,
  );
  filesWithErrors.sort((a, b) => b.count - a.count);
  for (const f of filesWithErrors) {
    console.error(`    ${String(f.count).padStart(3)}  ${f.file}`);
  }
}

if (anyCount > baseline.maxAny) {
  failed = true;
  console.error(
    `\n✗ New \`any\` introduced: ${anyCount} > baseline ${baseline.maxAny}.` +
      ` Remove the explicit \`any\` (prefer \`unknown\` + narrowing, or a proper type).`,
  );
}

if (failed) {
  console.error(
    "\nThe lint baseline may only go DOWN. Fix the new issues above, or — if you" +
      " intentionally reduced the count — lower ci/lint-baseline.json in this change.",
  );
  process.exit(1);
}

console.log("\n✓ Lint gate passed — no regression vs baseline.");
