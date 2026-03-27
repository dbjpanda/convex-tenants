/**
 * Replaces local file: references to @djpanda/convex-authz with the
 * published npm version. Used in CI where the monorepo workspace
 * (../authz) is not available.
 */
import { readFileSync, writeFileSync } from "fs";

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

fix("package.json", "devDependencies");
fix("example/package.json", "dependencies");
