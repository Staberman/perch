#!/usr/bin/env node
// npm installs only the optional dependency that matches this Mac; run the `perch` binary it holds.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { platformPackage } from "../lib/platform.js";

const name = platformPackage(process.platform, process.arch);
if (!name) {
  console.error(`perch runs on macOS only (this is ${process.platform}-${process.arch}).`);
  process.exit(1);
}

let binary;
try {
  binary = join(dirname(createRequire(import.meta.url).resolve(`${name}/package.json`)), "bin", "perch");
} catch {
  console.error(`perch: ${name} is not installed. Install again without --omit=optional.`);
  process.exit(1);
}

const result = spawnSync(binary, process.argv.slice(2), { stdio: "inherit" });
if (result.error) {
  console.error(`perch: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
