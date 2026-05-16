import { readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = join(root, "packages");

for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  rmSync(join(packagesDir, entry.name, "dist"), { recursive: true, force: true });
}

rmSync(join(root, "packages", "installer", "assets", "runtime"), {
  recursive: true,
  force: true,
});
