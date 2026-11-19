import assert from "node:assert/strict";
import test from "node:test";
import { isUpdateModeFresh, UPDATE_MODE_MAX_AGE_MS } from "../src/update-mode";

test("update mode is fresh until the updater grace window expires", () => {
  const now = Date.parse("2026-05-01T12:00:00.000Z");
  assert.equal(
    isUpdateModeFresh(
      {
        enabledAt: new Date(now - UPDATE_MODE_MAX_AGE_MS + 1_000).toISOString(),
        appRoot: "/Applications/Codex.app",
        codexVersion: "26.422.62136",
      },
      now,
    ),
    true,
  );
  assert.equal(
    isUpdateModeFresh(
      {
        enabledAt: new Date(now - UPDATE_MODE_MAX_AGE_MS).toISOString(),
        appRoot: "/Applications/Codex.app",
        codexVersion: "26.422.62136",
      },
      now,
    ),
    false,
  );
});
