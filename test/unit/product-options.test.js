import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { apiTool } from "../../tools/medusa-admin-api/medusa-admin-product-options.js";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;
let fetchCalls;

beforeEach(() => {
  fetchCalls = [];
  process.env.MEDUSA_BASE_URL = "https://medusa.example.com";
  process.env.MEDUSA_API_KEY = "secret-key";
  process.env.MEDUSA_AUTH_TYPE = "api-key";

  globalThis.fetch = async (url, options = {}) => {
    fetchCalls.push({ url: String(url), options });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  globalThis.fetch = ORIGINAL_FETCH;
});

test("product option list reads reusable options through the Store API", async () => {
  await apiTool.function({
    action: "list",
    limit: 5,
    fields: "id,title,values.value",
  });

  assert.equal(fetchCalls.length, 1);
  const requestUrl = new URL(fetchCalls[0].url);
  assert.equal(requestUrl.pathname, "/store/product-options");
  assert.equal(requestUrl.searchParams.get("limit"), "5");
  assert.equal(requestUrl.searchParams.get("fields"), "id,title,values.value");
  assert.equal(fetchCalls[0].options.method, "GET");
  assert.equal(fetchCalls[0].options.headers.Authorization, "Basic secret-key");
});

test("product option link_to_product writes through product-scoped Admin batch route", async () => {
  await apiTool.function({
    action: "link_to_product",
    product_id: "prod_123",
    add: [{ id: "opt_color", value_ids: ["optval_red"] }],
    remove: ["opt_size"],
  });

  assert.equal(fetchCalls.length, 1);
  const requestUrl = new URL(fetchCalls[0].url);
  assert.equal(requestUrl.pathname, "/admin/products/prod_123/options/batch");
  assert.equal(fetchCalls[0].options.method, "POST");
  assert.deepEqual(JSON.parse(fetchCalls[0].options.body), {
    add: [{ id: "opt_color", value_ids: ["optval_red"] }],
    remove: ["opt_size"],
  });
});
