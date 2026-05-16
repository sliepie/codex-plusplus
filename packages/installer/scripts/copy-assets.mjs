// Copies the loader stub + bundled runtime/manager into installer/assets/
// so the published npm package can extract them at install time.
import { cpSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..", "..");
const out = resolve(here, "..", "assets");

mkdirSync(out, { recursive: true });
rmSync(resolve(out, "runtime"), { recursive: true, force: true });

const copies = [
  ["packages/loader/loader.cjs", "loader.cjs"],
  ["packages/runtime/dist/main.js", "runtime/main.js"],
  ["packages/runtime/dist/preload.js", "runtime/preload.js"],
];

for (const [from, to] of copies) {
  const src = resolve(root, from);
  if (!existsSync(src)) {
    console.warn(`[copy-assets] skip (missing): ${from}`);
    continue;
  }
  cpSync(src, resolve(out, to), { recursive: true });
  console.log(`[copy-assets] ${from} -> assets/${to}`);
}
