import assert from "node:assert/strict";
import test from "node:test";
import { buildWindowsManagedCleanupScript } from "../src/windows-cleanup";

function cleanupPaths(script: string): string[] {
  const block = /\$cleanupPaths = @\(\n([\s\S]*?)\n\)/.exec(script)?.[1] ?? "";
  return block.split("\n").map((line) => {
    const match = /^  '((?:[^']|'')*)'$/.exec(line);
    assert.ok(match, `cleanup path is not one single-quoted literal: ${line}`);
    return match[1].replace(/''/g, "'");
  });
}

test("Windows cleanup removes only Codex++ managed paths", () => {
  const paths = cleanupPaths(buildWindowsManagedCleanupScript({
    localAppData: "C:\\Users\\Admin\\AppData\\Local",
    appData: "C:\\Users\\Admin\\AppData\\Roaming",
    home: "C:\\Users\\Admin",
  }));

  assert.equal(paths.length, 4);
  for (const path of paths) {
    assert.match(path, /codex-plusplus|Codex\+\+/);
  }
});

test("Windows cleanup keeps user-controlled paths inside quoted literals", () => {
  const home = "C:\\Users\\O'Brien'; Remove-Item C:\\ -Recurse; '";
  const paths = cleanupPaths(buildWindowsManagedCleanupScript({ home }));

  assert.equal(paths.length, 1);
  assert.ok(paths[0].startsWith(home));
});
