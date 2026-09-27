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

function request(index = 0) {
  const entry = fetchCalls[index];
  const url = new URL(entry.url);
  return {
    method: entry.options.method,
    path: url.pathname,
    query: url.searchParams,
    body: entry.options.body === undefined ? undefined : JSON.parse(entry.options.body),
    headers: entry.options.headers,
  };
}

test("product option list reads reusable options through the Admin API", async () => {
  await apiTool.function({
    action: "list",
    limit: 5,
    fields: "id,title,values.value",
  });

  assert.equal(fetchCalls.length, 1);
  const { path, query, method, headers } = request();
  assert.equal(path, "/admin/product-options");
  assert.equal(query.get("limit"), "5");
  assert.equal(query.get("fields"), "id,title,values.value");
  assert.equal(method, "GET");
  assert.equal(headers.Authorization, "Basic secret-key");
});

test("product option list with product_id reads the product's options", async () => {
  await apiTool.function({ action: "list", product_id: "prod_123" });
  assert.equal(request().path, "/admin/products/prod_123/options");
});

test("product option get/update/delete use /admin/product-options/{id}", async () => {
  await apiTool.function({ action: "get", option_id: "opt_color" });
  await apiTool.function({ action: "update", option_id: "opt_color", title: "Color", values: ["Rojo"] });
  await apiTool.function({ action: "delete", option_id: "opt_color" });

  assert.deepEqual(
    fetchCalls.map((_, index) => `${request(index).method} ${request(index).path}`),
    [
      "GET /admin/product-options/opt_color",
      "POST /admin/product-options/opt_color",
      "DELETE /admin/product-options/opt_color",
    ],
  );
  assert.deepEqual(request(1).body, { title: "Color", values: ["Rojo"] });
});

test("product option create is global, or creates and links when product_id is given", async () => {
  await apiTool.function({ action: "create", title: "Talle", values: ["S", "M"], is_exclusive: false });
  assert.equal(request(0).method, "POST");
  assert.equal(request(0).path, "/admin/product-options");
  assert.deepEqual(request(0).body, { title: "Talle", values: ["S", "M"], is_exclusive: false });

  await apiTool.function({ action: "create", product_id: "prod_123", title: "Talle", values: ["S"] });
  assert.equal(request(1).path, "/admin/products/prod_123/options/batch");
  assert.deepEqual(request(1).body, { add: [{ title: "Talle", values: ["S"] }] });
});

test("product option delete with product_id only unlinks it from the product", async () => {
  await apiTool.function({ action: "delete", product_id: "prod_123", option_id: "opt_size" });
  assert.equal(request().method, "POST");
  assert.equal(request().path, "/admin/products/prod_123/options/batch");
  assert.deepEqual(request().body, { remove: ["opt_size"] });
});

test("product option value actions use /values/{value_id}", async () => {
  await apiTool.function({ action: "list_values", option_id: "opt_color" });
  await apiTool.function({ action: "update_value", option_id: "opt_color", value_id: "optval_red", value: "Rojo" });
  await apiTool.function({ action: "delete_value", option_id: "opt_color", value_id: "optval_red" });
  assert.deepEqual(
    fetchCalls.map((_, index) => `${request(index).method} ${request(index).path}`),
    [
      "GET /admin/product-options/opt_color/values",
      "POST /admin/product-options/opt_color/values/optval_red",
      "DELETE /admin/product-options/opt_color/values/optval_red",
    ],
  );
  assert.deepEqual(request(1).body, { value: "Rojo" });
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
