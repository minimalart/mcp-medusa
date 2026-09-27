import assert from "node:assert/strict";
import { test } from "node:test";
import { MedusaClientError } from "../../lib/medusa-client.js";
import {
  authErrorHint,
  compareVersions,
  isMissingRouteError,
  requiresVersionMessage,
  unrecognizedFields,
  withGatedFields,
  withMedusaErrorHints,
  withMinVersion,
} from "../../lib/medusa-version.js";

const missingRoute = new MedusaClientError("HTTP 404: Cannot POST /admin/x", {
  status: 404,
  body: "<pre>Cannot POST /admin/x</pre>",
});
const notFoundEntity = new MedusaClientError("HTTP 404", {
  status: 404,
  body: JSON.stringify({ type: "not_found", message: "Order with id: order_1 was not found" }),
});

test("isMissingRouteError distinguishes missing routes from missing entities", () => {
  assert.equal(isMissingRouteError(missingRoute), true);
  assert.equal(isMissingRouteError(notFoundEntity), false);
  assert.equal(isMissingRouteError(new MedusaClientError("HTTP 500", { status: 500, body: "" })), false);
});

test("requiresVersionMessage uses the standard wording", () => {
  assert.equal(requiresVersionMessage("2.20"), "Esta acción requiere Medusa >= 2.20 (la tienda devolvió 404).");
  assert.equal(
    requiresVersionMessage("2.21.1", { component: "@medusajs/loyalty-plugin" }),
    "Esta acción requiere @medusajs/loyalty-plugin >= 2.21.1 (la tienda devolvió 404).",
  );
});

test("withMinVersion maps only missing routes", async () => {
  const result = await withMinVersion("2.20", async () => {
    throw missingRoute;
  });
  assert.deepEqual(result, {
    error: "Esta acción requiere Medusa >= 2.20 (la tienda devolvió 404).",
    unsupported: true,
    min_version: "Medusa 2.20",
  });
  await assert.rejects(() => withMinVersion("2.20", async () => { throw notFoundEntity; }), /HTTP 404/);
  assert.deepEqual(await withMinVersion("2.20", async () => ({ ok: true })), { ok: true });
});

test("unrecognizedFields parses Medusa strict-validation errors", () => {
  const error = new MedusaClientError("HTTP 400", {
    status: 400,
    body: JSON.stringify({ type: "invalid_data", message: "Invalid request: Unrecognized fields: 'metadata, foo'" }),
  });
  assert.deepEqual(unrecognizedFields(error), ["metadata", "foo"]);
  assert.deepEqual(unrecognizedFields(missingRoute), []);
});

test("withGatedFields reports the highest minimum version among rejected fields", async () => {
  const error = new MedusaClientError("HTTP 400", {
    status: 400,
    body: "Invalid request: Unrecognized fields: 'unit_of_measure, metadata'",
  });
  const result = await withGatedFields({ unit_of_measure: "2.20", metadata: "2.21" }, async () => {
    throw error;
  });
  assert.equal(result.unsupported, true);
  assert.match(result.error, /requiere Medusa >= 2\.21 \(la tienda devolvió 400\)/);
  // Unrelated 400s are rethrown untouched.
  await assert.rejects(() => withGatedFields({ metadata: "2.21" }, async () => {
    throw new MedusaClientError("HTTP 400: other", { status: 400, body: "Invalid request: Unrecognized fields: 'foo'" });
  }), /other/);
});

test("compareVersions orders semver-like strings", () => {
  assert.ok(compareVersions("2.21.1", "2.21") > 0);
  assert.ok(compareVersions("2.19", "2.20") < 0);
  assert.equal(compareVersions("2.20.0", "2.20"), 0);
});

test("authErrorHint recognises MFA and bearer secret-key errors", () => {
  assert.match(authErrorHint("HTTP 401: {\"message\":\"MFA verification is required to complete this request\"}"), /MFA/);
  assert.match(authErrorHint("MFA was verified too long ago to complete this request"), /MFA/);
  assert.match(authErrorHint("A secret API key was passed as a Bearer token."), /MEDUSA_AUTH_TYPE=api-key/);
  assert.equal(authErrorHint("HTTP 401: Unauthorized"), null);
});

test("withMedusaErrorHints leaves other results and errors untouched", async () => {
  const passthrough = withMedusaErrorHints(async (args) => ({ echoed: args.value }));
  assert.deepEqual(await passthrough({ value: 1 }), { echoed: 1 });

  const failing = withMedusaErrorHints(async () => {
    throw new Error("HTTP 500: boom");
  });
  await assert.rejects(() => failing({}), (error) => error.message === "HTTP 500: boom");
});
