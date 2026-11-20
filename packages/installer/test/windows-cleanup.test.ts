import assert from "node:assert/strict";
import test from "node:test";
import { buildWindowsManagedCleanupScript } from "../src/windows-cleanup";

function quotedList(script: string, name: string): string[] {
  const block = new RegExp(`\\$${name} = @\\(\\n([\\s\\S]*?)\\n\\)`).exec(script)?.[1];
  assert.ok(block, `missing $${name} list`);
  return block.split("\n").map((line) => {
    const match = /^  '((?:[^']|'')*)'$/.exec(line);
    assert.ok(match, `$${name} entry is not one single-quoted literal: ${line}`);
    return match[1].replace(/''/g, "'");
  });
}

test("Windows cleanup targets exactly the Codex++ managed files", () => {
  const script = buildWindowsManagedCleanupScript({
    localAppData: "C:\\Users\\Admin\\AppData\\Local",
    appData: "C:\\Users\\Admin\\AppData\\Roaming",
    home: "C:\\Users\\Admin",
  });

  assert.deepEqual(quotedList(script, "cleanupPaths").sort(), [
    "C:\\Users\\Admin/Desktop/Codex++.lnk",
    "C:\\Users\\Admin\\AppData\\Local/Microsoft/WindowsApps/codex-plusplus-codex.cmd",
    "C:\\Users\\Admin\\AppData\\Local/codex-plusplus/store-apps",
    "C:\\Users\\Admin\\AppData\\Roaming/Microsoft/Windows/Start Menu/Programs/Codex++.lnk",
  ].sort());
});

test("Windows cleanup checks only the Open in Codex context menu keys", () => {
  const keys = quotedList(buildWindowsManagedCleanupScript({ home: "C:\\Users\\Admin" }), "contextKeys");

  assert.equal(keys.length, 2);
  for (const key of keys) {
    assert.match(key, /^HKCU:\\Software\\Classes\\.*\\shell\\OpenProjectInCodex$/);
  }
});

test("Windows cleanup keeps user-controlled paths inside quoted literals", () => {
  const home = "C:\\Users\\O'Brien'; Remove-Item C:\\ -Recurse; '";
  const paths = quotedList(buildWindowsManagedCleanupScript({ home }), "cleanupPaths");

  assert.equal(paths.length, 1);
  assert.ok(paths[0].startsWith(home));
});
