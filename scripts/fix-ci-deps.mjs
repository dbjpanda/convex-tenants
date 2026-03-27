/* eslint-disable no-undef */
/**
 * Replaces local file: references to @djpanda/convex-authz with the
 * published npm version. Used in CI where the monorepo workspace
 * (../authz) is not available.
 *
 * Also removes package-lock.json files that may have cached file: paths.
 */
import { readFileSync, writeFileSync, unlinkSync } from "fs";

const NPM_VERSION = "^2.1.1";

function fix(file, key) {
  try {
    const p = JSON.parse(readFileSync(file, "utf8"));
    const dep = p[key]?.["@djpanda/convex-authz"];
    if (dep && dep.startsWith("file:")) {
      p[key]["@djpanda/convex-authz"] = NPM_VERSION;
      writeFileSync(file, JSON.stringify(p, null, 2) + "\n");
      console.log(`Fixed ${file} ${key}: ${dep} → ${NPM_VERSION}`);
    }
  } catch {
    // File doesn't exist, skip
  }
}

function removeLockFile(file) {
  try {
    unlinkSync(file);
    console.log(`Removed ${file} (contained stale file: refs)`);
  } catch {
    // Doesn't exist, fine
  }
}

fix("package.json", "devDependencies");
fix("example/package.json", "dependencies");

// Lock files cache the file:../authz resolution — must regenerate
removeLockFile("package-lock.json");
removeLockFile("example/package-lock.json");
