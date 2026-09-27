import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { apiTool } from "../../tools/medusa-admin-api/medusa-admin-v2.js";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;
let fetchCalls;
let responses;

beforeEach(() => {
  fetchCalls = [];
  responses = [];
  process.env.MEDUSA_BASE_URL = "https://medusa.example.com";
  process.env.MEDUSA_API_KEY = "sk_test";
  process.env.MEDUSA_AUTH_TYPE = "api-key";

  globalThis.fetch = async (url, options = {}) => {
    fetchCalls.push({ url: String(url), options });
    const next = responses.shift() || { status: 200, body: { ok: true } };
    const isText = typeof next.body === "string";
    return new Response(isText ? next.body : JSON.stringify(next.body), {
      status: next.status,
      headers: { "content-type": isText ? "text/html" : "application/json" },
    });
  };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  globalThis.fetch = ORIGINAL_FETCH;
});

function lastCall() {
  const entry = fetchCalls.at(-1);
  const url = new URL(entry.url);
  return {
    method: entry.options.method,
    path: url.pathname,
    query: url.searchParams,
    body: entry.options.body === undefined ? undefined : JSON.parse(entry.options.body),
  };
}

describe("request action", () => {
  test("supports PUT with a JSON body", async () => {
    await apiTool.function({ action: "request", method: "put", path: "/admin/custom/thing", body: { a: 1 } });
    assert.equal(lastCall().method, "PUT");
    assert.equal(lastCall().path, "/admin/custom/thing");
    assert.deepEqual(lastCall().body, { a: 1 });
  });

  test("sends a JSON body on DELETE but never on GET", async () => {
    await apiTool.function({ action: "request", method: "DELETE", path: "/admin/draft-orders/d1/edit/promotions", body: { promo_codes: ["X"] } });
    assert.deepEqual(lastCall().body, { promo_codes: ["X"] });

    await apiTool.function({ action: "request", method: "GET", path: "/admin/products", body: { ignored: true } });
    assert.equal(lastCall().body, undefined);
  });

  test("rejects unknown methods and non admin/auth paths", async () => {
    const result = await apiTool.function({ action: "request", method: "TRACE", path: "/admin/products" });
    assert.match(result.error, /Unsupported method/);
    await assert.rejects(() => apiTool.function({ action: "request", path: "/store/products" }), /restricted to \/admin/);
    await assert.rejects(() => apiTool.function({ action: "request", path: "/admin/../store/products" }), /restricted to \/admin/);
    assert.equal(fetchCalls.length, 0);
  });

  const blockedPaths = [
    ["GET", "/admin/ai-assistant/keys"],
    ["DELETE", "/admin/ai-assistant/keys/key_1"],
    ["GET", "/admin/site-credentials"],
    ["GET", "/admin/site-credentials/cred_1"],
    ["POST", "/admin/debug/run"],
    ["POST", "/admin/maintenance/reindex"],
    ["POST", "/admin/database-explorer/query"],
    ["POST", "/admin/commerce-dashboard/seed-orders"],
    ["POST", "/admin/users/user_1/reset-password"],
    // bypass attempts: case, dot segments, encoding, duplicated slashes, trailing slash
    ["GET", "/admin/AI-Assistant/Keys"],
    ["POST", "/admin/products/../debug/run"],
    ["POST", "/admin/%64ebug/run"],
    ["POST", "/admin//maintenance//x"],
    ["POST", "/admin/users/user_1/reset-password/"],
  ];

  for (const [method, path] of blockedPaths) {
    test(`blocks ${method} ${path}`, async () => {
      const result = await apiTool.function({ action: "request", method, path, body: {} });
      assert.equal(result.blocked, true, JSON.stringify(result));
      assert.match(result.error, /Blocked/);
      assert.equal(fetchCalls.length, 0);
    });
  }

  test("only allows GET and token refresh on /auth*", async () => {
    const login = await apiTool.function({ action: "request", method: "POST", path: "/auth/user/emailpass", body: { email: "a@b.co", password: "x" } });
    assert.equal(login.blocked, true);
    const logout = await apiTool.function({ action: "request", method: "DELETE", path: "/auth/session" });
    assert.equal(logout.blocked, true);
    const mfa = await apiTool.function({ action: "request", method: "POST", path: "/auth/mfa/factors", body: {} });
    assert.equal(mfa.blocked, true);
    assert.equal(fetchCalls.length, 0);

    await apiTool.function({ action: "request", method: "POST", path: "/auth/token/refresh" });
    assert.equal(lastCall().path, "/auth/token/refresh");
    await apiTool.function({ action: "request", method: "GET", path: "/auth/mfa/factors" });
    assert.equal(lastCall().method, "GET");
    assert.equal(fetchCalls.length, 2);
  });
});

describe("resources", () => {
  test("index and views map to real list routes", async () => {
    await apiTool.function({ action: "list", resource: "index" });
    assert.equal(lastCall().path, "/admin/index/details");
    await apiTool.function({ action: "list", resource: "views" });
    assert.equal(lastCall().path, "/admin/views/entities");
  });

  test("list-only and get-only resources explain what is available", async () => {
    const getFlag = await apiTool.function({ action: "get", resource: "feature_flags", id: "x" });
    assert.match(getFlag.error, /no get-by-id route/);
    const listUploads = await apiTool.function({ action: "list", resource: "uploads" });
    assert.match(listUploads.error, /no list route/);
    await assert.rejects(() => apiTool.function({ action: "list", resource: "auth" }), /removed/);
    assert.equal(fetchCalls.length, 0);

    await apiTool.function({ action: "get", resource: "uploads", id: "file_1" });
    assert.equal(lastCall().path, "/admin/uploads/file_1");
  });

  test("notifications can be filtered by recipient (to)", async () => {
    await apiTool.function({ action: "list", resource: "notifications", query: { to: "customer@example.com" } });
    assert.equal(lastCall().path, "/admin/notifications");
    assert.equal(lastCall().query.get("to"), "customer@example.com");
  });
});

describe("search, search indexes and store credit", () => {
  test("search uses GET /admin/search and reports 2.19 on missing route", async () => {
    await apiTool.function({ action: "search", q: "remera", entity: "product,customer", limit: 5 });
    assert.equal(lastCall().method, "GET");
    assert.equal(lastCall().path, "/admin/search");
    assert.equal(lastCall().query.get("q"), "remera");
    assert.equal(lastCall().query.get("entity"), "product,customer");

    responses.push({ status: 404, body: "<pre>Cannot GET /admin/search</pre>" });
    const result = await apiTool.function({ action: "search", q: "remera" });
    assert.equal(result.error, "Esta acción requiere Medusa >= 2.19 (la tienda devolvió 404).");
    assert.equal(result.unsupported, true);
  });

  test("search index actions use the right routes and versions", async () => {
    await apiTool.function({ action: "list_search_indexes" });
    assert.equal(lastCall().path, "/admin/search-indexes");
    await apiTool.function({ action: "reindex_search_index", id: "product", strategy: "swap" });
    assert.equal(lastCall().method, "POST");
    assert.equal(lastCall().path, "/admin/search-indexes/product/reindex");
    assert.deepEqual(lastCall().body, { strategy: "swap" });
    await apiTool.function({ action: "delete_search_index", id: "product" });
    assert.equal(lastCall().method, "DELETE");
    assert.equal(lastCall().path, "/admin/search-indexes/product");

    responses.push({ status: 404, body: "<pre>Cannot DELETE /admin/search-indexes/product</pre>" });
    const old = await apiTool.function({ action: "delete_search_index", id: "product" });
    assert.equal(old.error, "Esta acción requiere Medusa >= 2.21.1 (la tienda devolvió 404).");
  });

  test("a Medusa not_found 404 is not mistaken for a missing route", async () => {
    responses.push({ status: 404, body: { type: "not_found", message: "The Search Module is not enabled" } });
    await assert.rejects(
      () => apiTool.function({ action: "reindex_search_index", id: "product" }),
      /Search Module is not enabled/,
    );
  });

  test("store credit credit/debit/transactions", async () => {
    await apiTool.function({ action: "credit_store_credit_account", id: "sca_1", amount: 1000, note: "gift" });
    assert.equal(lastCall().path, "/admin/store-credit-accounts/sca_1/credit");
    assert.deepEqual(lastCall().body, { amount: 1000, note: "gift" });

    await apiTool.function({ action: "debit_store_credit_account", id: "sca_1", amount: 200 });
    assert.equal(lastCall().path, "/admin/store-credit-accounts/sca_1/debit");

    await apiTool.function({ action: "list_store_credit_transactions", id: "sca_1", limit: 10 });
    assert.equal(lastCall().method, "GET");
    assert.equal(lastCall().path, "/admin/store-credit-accounts/sca_1/transactions");

    responses.push({ status: 404, body: "<pre>Cannot POST /admin/store-credit-accounts/sca_1/debit</pre>" });
    const old = await apiTool.function({ action: "debit_store_credit_account", id: "sca_1", amount: 200 });
    assert.equal(old.error, "Esta acción requiere @medusajs/loyalty-plugin >= 2.21.1 (la tienda devolvió 404).");

    await assert.rejects(() => apiTool.function({ action: "debit_store_credit_account", id: "sca_1", amount: 0 }), /greater than 0/);
  });
});
