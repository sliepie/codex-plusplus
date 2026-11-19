import assert from "node:assert/strict";
import test from "node:test";
import { buildManagedMcpBlock, mcpServerNameFromTweakId } from "../src/mcp-sync";

test("mcpServerNameFromTweakId matches Bennett tweak names", () => {
  assert.equal(mcpServerNameFromTweakId("co.bennett.native-widgets"), "native-widgets");
  assert.equal(mcpServerNameFromTweakId("co.bennett.project-home"), "project-home");
  assert.equal(mcpServerNameFromTweakId("com.example.my-widget"), "com-example-my-widget");
});

test("buildManagedMcpBlock skips user-managed server names", () => {
  const built = buildManagedMcpBlock(
    [
      {
        dir: "/tweaks/co.bennett.project-home",
        manifest: {
          id: "co.bennett.project-home",
          mcp: { command: "node", args: ["server.js"] },
        },
      },
    ],
    `[mcp_servers.project-home]\ncommand = "node"\n`,
  );

  assert.equal(built.block, "");
  assert.deepEqual(built.serverNames, []);
  assert.deepEqual(built.skippedServerNames, ["project-home"]);
});
