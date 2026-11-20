import assert from "node:assert/strict";
import test from "node:test";
import { analyzeWatcherLogTail } from "../src/watcher-health";

test("watcher log health points privileged repair failures to terminal repair", () => {
  const check = analyzeWatcherLogTail(`
✗ codex-plusplus failed
Cannot write to /Applications/Codex.app/Contents/Info.plist.

macOS App Management or file ownership is blocking modification of /Applications/Codex.app/Contents/Info.plist.
Fix:
  Open Terminal and run: codexplusplus repair
`);

  assert.equal(check.name, "watcher log");
  assert.equal(check.status, "warn");
  assert.equal(check.detail, "auto-repair needs app permissions; run `codexplusplus repair` from Terminal");
});
