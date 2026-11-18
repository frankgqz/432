// The two-platform self-heal (2026-11-18): this repo's node_modules lives on
// a disk shared between Frank's Windows machine and the Linux container, and
// npm keeps only ONE platform's native packages at a time (foreign-platform
// installs are refused with EBADPLATFORM, and any install prunes the other
// side). So every build checks for its own natives and heals them quietly.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const PLATFORMS = {
  win32: { css: "win32-x64-msvc", ts: "win32-x64" },
  linux: { css: "linux-x64-gnu", ts: "linux-x64" },
};

const plat = PLATFORMS[process.platform];
if (!plat) process.exit(0); // other platforms: npm's own optionalDeps suffice

const WANTED = [
  `@typescript/typescript-${plat.ts}@7.0.2`,
  `@rolldown/binding-${plat.css}@1.2.19`,
  `lightningcss-${plat.css}@1.33.0`,
];

const pkgPath = (w) => "node_modules/" + w.slice(0, w.lastIndexOf("@"));
const missing = WANTED.filter((w) => !existsSync(pkgPath(w)));

if (missing.length > 0) {
  console.log("[natives] healing:", missing.map((m) => m.slice(0, m.lastIndexOf("@"))).join(", "));
  execSync(`npm install --no-save --ignore-scripts ${missing.join(" ")} --no-audit --no-fund`, {
    stdio: "inherit",
  });
}
