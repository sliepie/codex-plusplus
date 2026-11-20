import assert from "node:assert/strict";
import test from "node:test";
import { buildCliFailureIssueUrl, buildPatchFailureIssueUrl, isMacAppManagementError } from "../src/alerts";
import {
  formatCommandFailure,
  releaseVersionFromTag,
  shouldDownloadSelfUpdate,
} from "../src/commands/self-update";
import {
  CODEX_WINDOW_SERVICES_KEY,
  patchCodexWindowServicesSource,
} from "../src/codex-window-services";
import { describeInstallationSource } from "../src/source-root";
import { watcherShellScript } from "../src/watcher";

test("window services patch separates the exposed service from the next setup call", () => {
  const source =
    "let M=FM({buildFlavor:a,allowDevtools:p,globalState:j.globalState,getGlobalStateForHost:j.getGlobalStateForHost,desktopRoot:j.desktopRoot,preloadPath:j.preloadPath,repoRoot:j.repoRoot,disposables:k}),N=e=>M.isTrustedIpcSender(e.sender);wD({buildFlavor:a,isTrustedIpcEvent:N}),n.ipcMain.on(Li,e=>{})";

  const patched = patchCodexWindowServicesSource(source);

  assert.ok(patched);
  assert.equal(patched.changed, true);
  assert.equal(patched.strategy, "service-factory-fingerprint");
  assert.match(
    patched.source,
    /;globalThis\.__codexpp_window_services__=M;wD\(\{buildFlavor:a/,
  );
  assert.doesNotMatch(patched.source, /__codexpp_window_services__=MwD/);
});

test("window services patch repairs the missing-separator state from Codex 26.429", () => {
  const source =
    "let M=FM({buildFlavor:a,allowDevtools:p,globalState:j.globalState,getGlobalStateForHost:j.getGlobalStateForHost,desktopRoot:j.desktopRoot,preloadPath:j.preloadPath,repoRoot:j.repoRoot,disposables:k}),N=e=>M.isTrustedIpcSender(e.sender);;globalThis.__codexpp_window_services__=MwD({buildFlavor:a,isTrustedIpcEvent:N}),n.ipcMain.on(Li,e=>{})";

  const patched = patchCodexWindowServicesSource(source);

  assert.ok(patched);
  assert.equal(patched.changed, true);
  assert.equal(patched.strategy, "repair-missing-separator");
  assert.match(
    patched.source,
    /;globalThis\.__codexpp_window_services__=M;wD\(\{buildFlavor:a/,
  );
  assert.doesNotMatch(patched.source, /__codexpp_window_services__=MwD/);
});

test("window services patch does not depend on Codex minified function names", () => {
  const source =
    "let services=Qa({buildFlavor:a,allowDevtools:p,allowDebugMenu:h,globalState:j.globalState,getGlobalStateForHost:j.getGlobalStateForHost,desktopRoot:j.desktopRoot,preloadPath:j.preloadPath,repoRoot:j.repoRoot,canHideLastLocalWindowToTray:()=>O,disposables:k}),trusted=e=>services.isTrustedIpcSender(e.sender);Zd({buildFlavor:a,isTrustedIpcEvent:trusted})";

  const patched = patchCodexWindowServicesSource(source);

  assert.ok(patched);
  assert.equal(patched.serviceVar, "services");
  assert.match(
    patched.source,
    /;globalThis\.__codexpp_window_services__=services;Zd\(\{buildFlavor:a/,
  );
});

test("window services patch handles reordered factory object properties", () => {
  const source =
    "let M=FM({allowDevtools:p,allowDebugMenu:h,globalState:j.globalState,getGlobalStateForHost:j.getGlobalStateForHost,desktopRoot:j.desktopRoot,preloadPath:j.preloadPath,repoRoot:j.repoRoot,disposables:k,buildFlavor:a}),N=e=>M.isTrustedIpcSender(e.sender);wD({buildFlavor:a,isTrustedIpcEvent:N})";

  const patched = patchCodexWindowServicesSource(source);

  assert.ok(patched);
  assert.equal(patched.serviceVar, "M");
  assert.match(
    patched.source,
    /;globalThis\.__codexpp_window_services__=M;wD\(\{buildFlavor:a/,
  );
});

test("window services patch handles quoted factory object properties", () => {
  const source =
    "let M=FM({'buildFlavor':a,'allowDevtools':p,'allowDebugMenu':h,'globalState':j.globalState,'getGlobalStateForHost':j.getGlobalStateForHost,'desktopRoot':j.desktopRoot,'preloadPath':j.preloadPath,'repoRoot':j.repoRoot,'disposables':k});next()";

  const patched = patchCodexWindowServicesSource(source);

  assert.ok(patched);
  assert.equal(patched.serviceVar, "M");
  assert.match(patched.source, /;globalThis\.__codexpp_window_services__=M;next\(\)/);
});

test("window services patch is idempotent when the marker is already present", () => {
  const source = `let M=FM({buildFlavor:a,allowDevtools:p,globalState:j.globalState,getGlobalStateForHost:j.getGlobalStateForHost,desktopRoot:j.desktopRoot,preloadPath:j.preloadPath,repoRoot:j.repoRoot,disposables:k});globalThis.${CODEX_WINDOW_SERVICES_KEY}=M;wD({buildFlavor:a})`;

  const patched = patchCodexWindowServicesSource(source);

  assert.ok(patched);
  assert.equal(patched.changed, false);
  assert.equal(patched.source, source);
});

test("window services patch falls back to lifecycle registration fingerprint", () => {
  const source = [
    "let M=oG({theme:a,featureFlags:b});",
    "_B({isWindows:E,quitState:ee,windows:M,applicationMenuManager:oe.applicationMenuManager,ensureHostWindow:M.ensureHostWindow,hotkeyWindowLifecycleManager:M.hotkeyWindowLifecycleManager,globalDictationLifecycleManager:M.globalDictationLifecycleManager,globalStatesByHostId:j.globalStatesByHostId,flushAndDisposeContexts:I.flushAndDisposeContexts,disposables:k,appEvent:F.appEvent,errorReporter:g});",
  ].join("");

  const patched = patchCodexWindowServicesSource(source);

  assert.ok(patched);
  assert.equal(patched.changed, true);
  assert.equal(patched.strategy, "lifecycle-registration-fingerprint");
  assert.equal(patched.serviceVar, "M");
  assert.match(patched.source, /;globalThis\.__codexpp_window_services__=M;$/);
});

test("window services patch ignores unrelated buildFlavor factories", () => {
  const source = "let x=Fn({buildFlavor:a,foo:b,bar:c});Other({buildFlavor:a})";

  assert.equal(patchCodexWindowServicesSource(source), null);
});

test("patch failure report URL includes a prefilled GitHub issue", () => {
  const url = new URL(buildPatchFailureIssueUrl("Codex window services hook point not found"));

  assert.equal(url.origin + url.pathname, "https://github.com/b-nnett/codex-plusplus/issues/new");
  assert.equal(url.searchParams.get("title"), "Codex++ failed to patch Codex after update");
  assert.match(url.searchParams.get("body") ?? "", /Codex window services hook point not found/);
  assert.match(url.searchParams.get("body") ?? "", /Platform:/);
});

test("CLI failure report URL includes command and environment details", () => {
  const url = new URL(buildCliFailureIssueUrl("install", "codesign not installed"));

  assert.equal(url.origin + url.pathname, "https://github.com/b-nnett/codex-plusplus/issues/new");
  assert.equal(url.searchParams.get("title"), "Codex++ install failed");
  assert.match(url.searchParams.get("body") ?? "", /codexplusplus install/);
  assert.match(url.searchParams.get("body") ?? "", /codesign not installed/);
  assert.match(url.searchParams.get("body") ?? "", /Codex\+\+:/);
  assert.match(url.searchParams.get("body") ?? "", /Node:/);
});

test("App Management failures use the dedicated repair alert path", () => {
  assert.equal(
    isMacAppManagementError("macOS App Management is blocking modification of /Applications/Codex.app."),
    true,
  );
  assert.equal(isMacAppManagementError("Codex window services hook point not found"), false);
});

test("self-update release tags only download newer semver releases", () => {
  assert.equal(releaseVersionFromTag("v0.1.3"), "0.1.3");
  assert.equal(releaseVersionFromTag("0.1.3"), "0.1.3");
  assert.equal(releaseVersionFromTag("main"), null);
  assert.equal(shouldDownloadSelfUpdate("0.1.2", "v0.1.3"), true);
  assert.equal(shouldDownloadSelfUpdate("0.1.2", "v0.1.2"), false);
  assert.equal(shouldDownloadSelfUpdate("0.1.2", "v0.1.1"), false);
  assert.equal(shouldDownloadSelfUpdate("0.1.2", "main"), true);
  assert.equal(shouldDownloadSelfUpdate("0.1.2", "v0.1.2", true), true);
});

test("watcher runs self-update and app repair as separate steps", () => {
  const script = watcherShellScript();

  assert.match(script, /update --watcher --quiet --no-repair/);
  assert.match(script, /repair --watcher --quiet/);
  assert.match(script, /update[\s\S]+\|\| true;[\s\S]+repair/);
});

test("launchd watcher script clears stale log entries before each run", () => {
  const script = watcherShellScript("/tmp/codex plusplus/watch'er.log");

  assert.match(script, /^: > '\/tmp\/codex plusplus\/watch'\\''er\.log'; sleep 3; /);
  assert.match(script, /update --watcher --quiet --no-repair/);
  assert.match(script, /repair --watcher --quiet/);
});

test("self-update command failures include a bounded output tail", () => {
  const message = formatCommandFailure("/usr/bin/node", ["/tmp/codex plusplus/cli.js", "repair"], {
    status: 1,
    signal: null,
    stdout: "stdout detail",
    stderr: "nested repair error",
  });

  assert.match(message, /'\/tmp\/codex plusplus\/cli\.js' repair failed with exit code 1/);
  assert.match(message, /stderr:\nnested repair error/);
  assert.match(message, /stdout:\nstdout detail/);
});

test("self-update command failures keep only the end of long output", () => {
  const stderr = `FIRST-LINE\n${"x".repeat(50_000)}\nLAST-LINE`;
  const message = formatCommandFailure("/usr/bin/node", ["cli.js", "repair"], {
    status: 1,
    signal: null,
    stdout: "",
    stderr,
  });

  assert.ok(message.length < stderr.length / 2);
  assert.doesNotMatch(message, /FIRST-LINE/);
  assert.match(message, /LAST-LINE$/);
});

test("installation source labels Homebrew installs", () => {
  assert.equal(
    describeInstallationSource("/opt/homebrew/Cellar/codexplusplus/0.1.4").kind,
    "homebrew",
  );
});
