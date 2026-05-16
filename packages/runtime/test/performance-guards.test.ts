import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const mainSource = readFileSync(resolve(repoRoot, "packages/runtime/src/main.ts"), "utf8");
const bundledMainSource = readFileSync(
  resolve(repoRoot, "packages/installer/assets/runtime/main.js"),
  "utf8",
);
const bundledPreloadSource = readFileSync(
  resolve(repoRoot, "packages/installer/assets/runtime/preload.js"),
  "utf8",
);
const settingsInjectorSource = readFileSync(
  resolve(repoRoot, "packages/runtime/src/preload/settings-injector.ts"),
  "utf8",
);
const preloadSource = readFileSync(
  resolve(repoRoot, "packages/runtime/src/preload/index.ts"),
  "utf8",
);
const tweakHostSource = readFileSync(
  resolve(repoRoot, "packages/runtime/src/preload/tweak-host.ts"),
  "utf8",
);
const repairSource = readFileSync(
  resolve(repoRoot, "packages/installer/src/commands/repair.ts"),
  "utf8",
);
const installerSource = readFileSync(
  resolve(repoRoot, "packages/installer/src/commands/install.ts"),
  "utf8",
);
const selfUpdateSource = readFileSync(
  resolve(repoRoot, "packages/installer/src/commands/self-update.ts"),
  "utf8",
);
const watcherSource = readFileSync(resolve(repoRoot, "packages/installer/src/watcher.ts"), "utf8");
const installScript = readFileSync(resolve(repoRoot, "install.ps1"), "utf8");

test("list-tweaks returns local metadata without awaiting release checks", () => {
  const body = extractHandlerBody(mainSource, "codexpp:list-tweaks");

  assert.match(body, /scheduleTweakUpdateChecks\(tweakState\.discovered\)/);
  assert.match(body, /const state = readState\(\)/);
  assert.match(body, /isTweakEnabledFromState\(t\.manifest\.id,\s*state\)/);
  assert.doesNotMatch(body, /await\s+Promise\.all/);
});

test("settings injector coalesces mutation probes and gates DOM dumps", () => {
  assert.match(settingsInjectorSource, /new MutationObserver\(\(mutations\) => scheduleInjectionProbe\(mutations\)\)/);
  assert.match(settingsInjectorSource, /requestAnimationFrame\(\(\) =>/);
  assert.doesNotMatch(settingsInjectorSource, /setInterval/);

  const body = extractFunctionBody(settingsInjectorSource, "maybeDumpDom");
  assert.match(body, /if \(!isDomProbeDebugEnabled\(\)\) return/);

  const logBody = extractFunctionBody(settingsInjectorSource, "plog");
  assert.match(logBody, /if \(!isDomProbeDebugEnabled\(\)\) return/);

  const injectBody = extractFunctionBody(settingsInjectorSource, "tryInject");
  assert.match(injectBody, /const itemsGroup = getSidebarItemsGroup\(\)/);
  assert.match(settingsInjectorSource, /cached\?\.isConnected && isSettingsSidebarCandidate\(cached\)/);
});

test("preload startup writes info logs only when debug logging is enabled", () => {
  const body = extractFunctionBody(preloadSource, "fileLog");

  assert.match(body, /level === "info" && !isPreloadDebugEnabled\(\)/);
  assert.match(body, /ipcRenderer\.send\("codexpp:preload-log", level, msg\)/);
  assert.match(preloadSource, /fileLog\("boot FAILED",[\s\S]*"error"\)/);

  assert.match(tweakHostSource, /function shouldMirrorPreloadLog/);
  assert.match(tweakHostSource, /level === "warn" \|\| level === "error" \|\| isPreloadDebugEnabled\(\)/);
  assert.doesNotMatch(tweakHostSource, /ipcRenderer\.send\(\s*"codexpp:preload-log",\s*"info"/);

  const logBody = extractNestedFunctionBody(tweakHostSource, "const log =");
  assertCallOrder(logBody, ["shouldMirrorPreloadLog", "consoleFn"]);
});

test("preload reuses startup metadata instead of duplicating tweak-list IPC", () => {
  assert.match(tweakHostSource, /Promise<TweakHostStartupSnapshot>/);
  assert.match(preloadSource, /const snapshot = await startTweakHost\(\)/);
  assert.match(preloadSource, /await mountManager\(snapshot\)/);
  assert.doesNotMatch(preloadSource, /await mountManager\(\)/);
});

test("main runtime info logs are debug-only", () => {
  const body = extractFunctionBody(mainSource, "log");

  assert.match(body, /level === "info" && !isRuntimeDebugLoggingEnabled\(\)/);
  assert.match(mainSource, /process\.env\.CODEXPP_DEBUG_LOGS === "1"/);
});

test("runtime does not run a tweak filesystem watcher", () => {
  assert.doesNotMatch(mainSource, /from "chokidar"/);
  assert.doesNotMatch(mainSource, /chokidar\.watch/);
  assert.doesNotMatch(mainSource, /watcher\.on\("all"/);
  assert.doesNotMatch(bundledMainSource, /chokidar/);
});

test("bundled runtime assets do not carry inline source maps", () => {
  assert.doesNotMatch(bundledMainSource, /sourceMappingURL=data:/);
  assert.doesNotMatch(bundledPreloadSource, /sourceMappingURL=data:/);
});

test("store tweak install avoids synchronous archive and copy work", () => {
  assert.doesNotMatch(mainSource, /spawnSync\("tar"/);
  assert.doesNotMatch(mainSource, /cpSync\(stagedTarget/);
  assert.match(mainSource, /await extractTarArchive\(archive,\s*extractDir\)/);
  assert.match(mainSource, /await cpAsync\(stagedTarget,\s*target/);
});

test("renderer waitForElement disconnects even when the DOM goes quiet", () => {
  const body = extractMethodBody(tweakHostSource, "waitForElement");

  assert.match(body, /window\.setTimeout/);
  assert.match(body, /obs\.disconnect\(\)/);
  assert.match(body, /window\.clearTimeout\(timeout\)/);
});

test("Windows repairs clean up only legacy scheduled-task installs", () => {
  const body = extractFunctionBody(repairSource, "refreshWatcherForRepair");

  assert.match(body, /if \(process\.platform === "win32"\)/);
  assert.match(body, /if \(previous !== "scheduled-task"\) return "none"/);
  assert.match(body, /uninstallWatcher\(\)/);
});

test("Windows source finalization repairs workspace links without a second npm install", () => {
  const finalization = installScript.slice(installScript.indexOf("Finalizing workspace links"));
  assert.match(finalization, /Repair-WorkspaceLinks \$InstallDir/);
  assert.doesNotMatch(finalization, /npm\.cmd install/);

  const refreshBody = extractFunctionBody(selfUpdateSource, "refreshMovedWorkspaceLinks");
  assert.match(refreshBody, /repairWorkspaceLinks\(sourceRoot\)/);
  assert.doesNotMatch(refreshBody, /installDependencies/);
});

test("Windows installs do not touch Task Scheduler unless legacy state says to clean up", () => {
  assert.match(watcherSource, /case "win32":[\s\S]*return "none"/);
  assert.match(installerSource, /previousState\?\.watcher === "scheduled-task"/);
  assert.doesNotMatch(watcherSource, /\binstallScheduledTask\(/);
  assert.doesNotMatch(watcherSource, /"\/Create"/);
});

function extractHandlerBody(source: string, channel: string): string {
  const marker = JSON.stringify(channel);
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, "missing IPC handler marker: " + channel);

  const arrowIndex = source.indexOf("=>", markerIndex);
  assert.notEqual(arrowIndex, -1, "missing IPC handler arrow: " + channel);

  return extractBlockStartingAt(source, source.indexOf("{", arrowIndex));
}

function extractFunctionBody(source: string, name: string): string {
  const marker = "function " + name;
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, "missing function: " + name);

  return extractBlockStartingAt(source, source.indexOf("{", markerIndex));
}

function extractMethodBody(source: string, name: string): string {
  const marker = name + ":";
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, "missing method: " + name);

  return extractBlockStartingAt(source, source.indexOf("{", markerIndex));
}

function extractBlockStartingAt(source: string, startBrace: number): string {
  assert.notEqual(startBrace, -1, "missing opening brace");

  let depth = 0;
  for (let i = startBrace; i < source.length; i++) {
    const char = source[i];
    if (char === "{") depth++;
    if (char === "}") depth--;
    if (depth === 0) return source.slice(startBrace + 1, i);
  }

  assert.fail("missing closing brace");
}

function extractNestedFunctionBody(source: string, marker: string): string {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, "missing nested function: " + marker);

  return extractBlockStartingAt(source, source.indexOf("{", markerIndex));
}

function assertCallOrder(body: string, calls: string[]): void {
  let previous = -1;
  for (const call of calls) {
    const current = body.indexOf(call);
    assert.notEqual(current, -1, "missing call: " + call);
    assert.ok(current > previous, call + " is out of order");
    previous = current;
  }
}
