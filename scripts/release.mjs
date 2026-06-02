#!/usr/bin/env node
/**
 * release.mjs — Create a versioned git tag for a module and push it.
 *
 * Usage (from inside a module directory via npm scripts):
 *   node ../../scripts/release.mjs <module> <bump>
 *
 *   module  — name used in the tag prefix (e.g. "music", "shell")
 *   bump    — patch | minor | major
 *
 * What it does:
 *   1. Reads current version from package.json
 *   2. Bumps it according to <bump>
 *   3. Writes the new version back to package.json
 *   4. git add package.json && git commit -m "chore(<module>): bump to vX.Y.Z"
 *   5. git tag <module>/vX.Y.Z
 *   6. git push && git push --tags
 *
 * The pushed tag triggers the corresponding GitHub Actions release workflow.
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const [, , module, bump = "patch"] = process.argv;

if (!module) {
  console.error("Usage: node release.mjs <module> <patch|minor|major>");
  process.exit(1);
}

if (!["patch", "minor", "major"].includes(bump)) {
  console.error(`Invalid bump type: "${bump}". Use patch, minor, or major.`);
  process.exit(1);
}

// package.json is in cwd (the module directory)
const pkgPath = resolve(process.cwd(), "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

// Bump version
const [major, minor, patch] = pkg.version.split(".").map(Number);
let newVersion;
if (bump === "major") newVersion = `${major + 1}.0.0`;
else if (bump === "minor") newVersion = `${major}.${minor + 1}.0`;
else newVersion = `${major}.${minor}.${patch + 1}`;

const tag = `${module}/v${newVersion}`;

console.log(`\n  Module  : ${module}`);
console.log(`  Version : ${pkg.version} → ${newVersion}`);
console.log(`  Tag     : ${tag}\n`);

// Update package.json
pkg.version = newVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
console.log("✓ package.json updated");

// Git commit
run(`git add package.json`);
run(`git commit -m "chore(${module}): bump version to v${newVersion}"`);
console.log("✓ Version commit created");

// Git tag
run(`git tag ${tag}`);
console.log(`✓ Tag created: ${tag}`);

// Push
run(`git push`);
run(`git push origin ${tag}`);
console.log(`✓ Pushed — GitHub Actions will build and publish the release.\n`);
console.log(`  → https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]//;s/\\.git$//')/releases\n`);

function run(cmd) {
  try {
    execSync(cmd, { stdio: "inherit" });
  } catch (e) {
    console.error(`\n✗ Command failed: ${cmd}`);
    process.exit(1);
  }
}
