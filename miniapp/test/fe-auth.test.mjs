import test from "node:test";
import assert from "node:assert/strict";

import { safeStorage } from "../src/services/storage.ts";
import { STORAGE_KEY_AUTH_TOKEN } from "../src/constants/index.ts";
import { authService, isZaloEnvironment } from "../src/services/auth.ts";

test("FE Auth: isZaloEnvironment returns boolean without throwing in non-Zalo environment", () => {
  const isZalo = isZaloEnvironment();
  assert.equal(typeof isZalo, "boolean");
});

test("FE Auth: authService manages token storage lifecycle cleanly", () => {
  safeStorage.clearMemory();
  assert.equal(authService.getToken(), null);

  authService.setToken("mock_session_token_xyz_12345");
  assert.equal(authService.getToken(), "mock_session_token_xyz_12345");
  assert.equal(safeStorage.getItem(STORAGE_KEY_AUTH_TOKEN), "mock_session_token_xyz_12345");

  authService.clearToken();
  assert.equal(authService.getToken(), null);
  assert.equal(safeStorage.getItem(STORAGE_KEY_AUTH_TOKEN), null);
});

test("FE Auth: getCurrentUser returns null gracefully when no token is stored", async () => {
  safeStorage.clearMemory();
  const user = await authService.getCurrentUser();
  assert.equal(user, null);
});

test("FE Auth: Anonymous app access is preserved when unauthenticated", () => {
  safeStorage.clearMemory();
  assert.equal(authService.getToken(), null);
  // Verify storage for personalization profile remains independent
  safeStorage.setItem("vna.daksong.personalization.v1", JSON.stringify({
    displayName: "Du khách tự do",
    addressAs: "ban",
    ageGroup: null,
    allowAIContext: true,
  }));

  const rawProfile = safeStorage.getItem("vna.daksong.personalization.v1");
  assert.ok(rawProfile);
  const parsed = JSON.parse(rawProfile);
  assert.equal(parsed.displayName, "Du khách tự do");
});
