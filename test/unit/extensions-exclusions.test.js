import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { EXCLUDED_ROUTES, neverExposeReason } from "../../lib/extension-exclusions.js";
import { createExtensionTool } from "../../lib/extension-resources.js";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;
let fetchCalls;

beforeEach(() => {
  fetchCalls = [];
  process.env.MEDUSA_BASE_URL = "https://medusa.example.com";
  process.env.MEDUSA_API_KEY = "secret-key";
  process.env.MEDUSA_AUTH_TYPE = "api-key";
  globalThis.fetch = async (url) => {
    fetchCalls.push(String(url));
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  globalThis.fetch = ORIGINAL_FETCH;
});

test("neverExposeReason blocks concrete paths, templates and route patterns", () => {
  for (const path of [
    "/admin/ai-assistant/keys",
    "/admin/ai-assistant/keys/key_1",
    "/admin/site-credentials?site=1",
    "/admin/checkout-links/config",
    "/admin/gift-card-experience/deliveries/gcd_1/secure-link",
    "/admin/gift-card-experience/deliveries/{id}/secure-link",
    "/admin/gift-card-experience/deliveries/:id/secure-link",
    "/admin/debug/heap-snapshot",
    "/admin/maintenance/carrefour-backfill",
    "/admin/database-explorer/tables/order/rows",
    "/admin/commerce-dashboard/seed-orders",
    "/admin/kapso/inbox-embed/",
  ]) {
    assert.ok(neverExposeReason(path), `${path} should be blocked`);
  }
  assert.equal(neverExposeReason("/admin/brands"), null);
  assert.equal(neverExposeReason("/admin/gift-card-experience/deliveries/gcd_1"), null);
});

test("order checkout is allowed only without ?documents", () => {
  assert.equal(neverExposeReason("/admin/orders/order_1/checkout"), null);
  assert.ok(neverExposeReason("/admin/orders/order_1/checkout?documents=1"));
  assert.ok(neverExposeReason("/admin/orders/order_1/checkout", { query: { documents: "0" } }));
  assert.ok(neverExposeReason("/admin/orders/order_1/checkout?documents[]=1"));
});

test("every exclusion rule has a reason", () => {
  for (const rule of EXCLUDED_ROUTES) {
    assert.ok(rule.pattern instanceof RegExp);
    assert.ok(rule.reason && rule.reason.length > 5);
  }
});

test("the engine refuses to call a never-expose route even if a spec declares it", async () => {
  const tool = createExtensionTool({
    name: "manage_bad_ext",
    intro: "Bad.",
    resources: {
      keys: { path: "/admin/ai-assistant/keys", summary: "should never go out" },
      checkout: { path: "/admin/orders", readOnly: true, ops: ["get"], opConfig: { get: { method: "GET", path: "/{id}/checkout" } }, summary: "x" },
    },
  });
  const result = await tool.function({ action: "list", resource: "keys" });
  assert.match(result.error, /never exposed through MCP/);

  const docs = await tool.function({ action: "get", resource: "checkout", id: "o1", query: { documents: "1" } });
  assert.match(docs.error, /never exposed through MCP/);
  assert.equal(fetchCalls.length, 0);
});
