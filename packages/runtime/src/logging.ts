import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";

export const MAX_LOG_BYTES = 10 * 1024 * 1024;
const TRIM_TARGET_RATIO = 0.75;

export function appendCappedLog(path: string, line: string, maxBytes = MAX_LOG_BYTES): void {
  const incoming = Buffer.from(line);
  if (incoming.byteLength >= maxBytes) {
    writeFileSync(path, incoming.subarray(incoming.byteLength - maxBytes));
    return;
  }

  try {
    if (existsSync(path)) {
      const size = statSync(path).size;
      const allowedExisting = maxBytes - incoming.byteLength;
      if (size > allowedExisting) {
        const existing = readFileSync(path);
        const targetExisting = Math.max(
          0,
          Math.floor(maxBytes * TRIM_TARGET_RATIO) - incoming.byteLength,
        );
        writeFileSync(path, existing.subarray(Math.max(0, existing.byteLength - targetExisting)));
      }
    }
  } catch {
    // If trimming fails, still try to append below; logging must be best-effort.
  }

  appendFileSync(path, incoming);
}
