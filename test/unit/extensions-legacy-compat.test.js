import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { apiTool, extensionResources } from "../../tools/medusa-admin-api/medusa-admin-extensions.js";

// Backward compatibility of `manage_minimalart_extensions`: every resource and
// action the original tool offered keeps its name, method and path.

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;
let fetchCalls;

beforeEach(() => {
  fetchCalls = [];
  process.env.MEDUSA_BASE_URL = "https://medusa.example.com/";
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

// Recursos y paths de la tool original (antes del motor declarativo).
const ORIGINAL_RESOURCES = {
  commerce_dashboard: "/admin/commerce-dashboard",
  banners: "/admin/banners",
  blog_categories: "/admin/blog-categories",
  blog_posts: "/admin/blog-posts",
  blog_settings: "/admin/blog-settings",
  brands: "/admin/brands",
  checkout_links: "/admin/checkout-links",
  companies: "/admin/companies",
  contact_submissions: "/admin/contact-submissions",
  corporates: "/admin/corporates",
  dynamic_groups: "/admin/dynamic-groups",
  email_templates: "/admin/email-templates",
  landing_pages: "/admin/landing-pages",
  media_library: "/admin/media-library",
  sales_channels_b2c: "/admin/sales-channels-b2c",
  store_locations: "/admin/store-locations",
  videos: "/admin/videos",
};
const ORIGINAL_READ_ONLY = new Set(["commerce_dashboard", "contact_submissions", "sales_channels_b2c"]);
const ORIGINAL_SINGLETON = new Set(["commerce_dashboard", "blog_settings"]);
// Recursos que la tool original declaraba mal (rutas inexistentes) y se corrigieron.
const FIXED = new Set(["blog_settings", "contact_submissions", "sales_channels_b2c"]);

async function call(args) {
  fetchCalls = [];
  const result = await apiTool.function(args);
  return { result, calls: fetchCalls };
}

function onlyCall(calls) {
  assert.equal(calls.length, 1, "expected exactly one request");
  const url = new URL(calls[0].url);
  return { method: calls[0].options.method, path: url.pathname, url, body: calls[0].options.body };
}

test("the tool keeps its name, required params and every original resource", () => {
  const { definition } = apiTool;
  assert.equal(definition.name, "manage_minimalart_extensions");
  assert.deepEqual(definition.parameters.required, ["action", "resource"]);
  const resourceEnum = definition.parameters.properties.resource.enum;
  for (const name of Object.keys(ORIGINAL_RESOURCES)) {
    assert.ok(resourceEnum.includes(name), `missing resource ${name}`);
    assert.equal(extensionResources[name].path, ORIGINAL_RESOURCES[name]);
  }
  for (const action of ["list", "get", "create", "update", "delete"]) {
    assert.ok(definition.parameters.properties.action.enum.includes(action));
  }
  for (const prop of ["id", "limit", "offset", "q", "query", "body"]) {
    assert.ok(definition.parameters.properties[prop], `missing property ${prop}`);
  }
  assert.match(definition.description, /commerce_dashboard/);
});

for (const [resource, path] of Object.entries(ORIGINAL_RESOURCES)) {
  test(`${resource}: list → GET ${path} with query params`, async () => {
    const { calls } = await call({ action: "list", resource, limit: 20, offset: 40, q: "abc", query: { status: "x" } });
    const req = onlyCall(calls);
    assert.equal(req.method, "GET");
    assert.equal(req.path, path);
    assert.equal(req.url.searchParams.get("limit"), "20");
    assert.equal(req.url.searchParams.get("offset"), "40");
    assert.equal(req.url.searchParams.get("q"), "abc");
    assert.equal(req.url.searchParams.get("status"), "x");
    assert.equal(calls[0].options.headers.Authorization, "Basic secret-key");
  });

  test(`${resource}: get without id → GET ${path}`, async () => {
    const { calls } = await call({ action: "get", resource });
    const req = onlyCall(calls);
    assert.equal(req.method, "GET");
    assert.equal(req.path, path);
  });

  if (!FIXED.has(resource)) {
    test(`${resource}: get with id → GET ${ORIGINAL_SINGLETON.has(resource) ? path : `${path}/:id`}`, async () => {
      const { calls } = await call({ action: "get", resource, id: "id_1", query: { fields: "*x" } });
      const req = onlyCall(calls);
      assert.equal(req.method, "GET");
      assert.equal(req.path, ORIGINAL_SINGLETON.has(resource) ? path : `${path}/id_1`);
      assert.equal(req.url.searchParams.get("fields"), "*x");
    });
  }

  if (ORIGINAL_READ_ONLY.has(resource) && resource !== "contact_submissions") {
    test(`${resource}: create/update/delete stay rejected`, async () => {
      for (const action of ["create", "update", "delete"]) {
        const { result, calls } = await call({ action, resource, id: "id_1", body: {} });
        assert.equal(calls.length, 0);
        assert.ok(result.error, `${action} should fail`);
      }
    });
  } else if (!ORIGINAL_READ_ONLY.has(resource) && !FIXED.has(resource)) {
    test(`${resource}: create → POST, update → POST /:id, delete → DELETE /:id`, async () => {
      let req = onlyCall((await call({ action: "create", resource, body: { name: "n" } })).calls);
      assert.equal(req.method, "POST");
      assert.equal(req.path, path);
      assert.deepEqual(JSON.parse(req.body), { name: "n" });

      req = onlyCall((await call({ action: "update", resource, id: "id_1", body: { name: "m" } })).calls);
      assert.equal(req.method, "POST");
      assert.equal(req.path, `${path}/id_1`);
      assert.deepEqual(JSON.parse(req.body), { name: "m" });

      req = onlyCall((await call({ action: "delete", resource, id: "id_1" })).calls);
      assert.equal(req.method, "DELETE");
      assert.equal(req.path, `${path}/id_1`);

      const noId = await call({ action: "update", resource, body: {} });
      assert.equal(noId.calls.length, 0);
      assert.match(noId.result.error, /id is required/);

      const noIdDelete = await call({ action: "delete", resource });
      assert.equal(noIdDelete.calls.length, 0);
      assert.match(noIdDelete.result.error, /id is required/);
    });
  }
}

test("create without body sends an empty JSON object (as before)", async () => {
  const req = onlyCall((await call({ action: "create", resource: "banners" })).calls);
  assert.equal(req.body, "{}");
});

test("fix: blog_settings update posts the singleton root (no /:id route)", async () => {
  const req = onlyCall((await call({ action: "update", resource: "blog_settings", body: { enabled: true } })).calls);
  assert.equal(req.method, "POST");
  assert.equal(req.path, "/admin/blog-settings");
  assert.deepEqual(JSON.parse(req.body), { enabled: true });

  const withId = onlyCall((await call({ action: "update", resource: "blog_settings", id: "bs_1", body: {} })).calls);
  assert.equal(withId.path, "/admin/blog-settings");

  // create seguía funcionando (POST a la raíz) y se mantiene.
  const create = onlyCall((await call({ action: "create", resource: "blog_settings", body: { enabled: false } })).calls);
  assert.equal(create.method, "POST");
  assert.equal(create.path, "/admin/blog-settings");

  // DELETE /admin/blog-settings/:id nunca existió.
  const del = await call({ action: "delete", resource: "blog_settings", id: "bs_1" });
  assert.equal(del.calls.length, 0);
  assert.ok(del.result.error);
});

test("fix: contact_submissions has no GET /:id; update/delete use the real /:id routes", async () => {
  const get = await call({ action: "get", resource: "contact_submissions", id: "cs_1" });
  assert.equal(get.calls.length, 0);
  assert.match(get.result.error, /no GET \/admin\/contact-submissions\/:id; use list/);

  let req = onlyCall((await call({ action: "update", resource: "contact_submissions", id: "cs_1", body: { status: "read" } })).calls);
  assert.equal(req.method, "POST");
  assert.equal(req.path, "/admin/contact-submissions/cs_1");

  req = onlyCall((await call({ action: "delete", resource: "contact_submissions", id: "cs_1" })).calls);
  assert.equal(req.method, "DELETE");
  assert.equal(req.path, "/admin/contact-submissions/cs_1");

  const create = await call({ action: "create", resource: "contact_submissions", body: {} });
  assert.equal(create.calls.length, 0);
  assert.ok(create.result.error);
});

test("fix: sales_channels_b2c has no GET /:id", async () => {
  const get = await call({ action: "get", resource: "sales_channels_b2c", id: "sc_1" });
  assert.equal(get.calls.length, 0);
  assert.match(get.result.error, /no GET \/admin\/sales-channels-b2c\/:id/);
});

test("commerce_dashboard keeps list/get with metric query on the singleton root", async () => {
  const req = onlyCall(
    (
      await call({
        action: "list",
        resource: "commerce_dashboard",
        query: { from: "2026-05-01T00:00:00Z", to: "2026-05-31T23:59:59Z", bucket: "daily" },
      })
    ).calls,
  );
  assert.equal(req.path, "/admin/commerce-dashboard");
  assert.equal(req.url.searchParams.get("bucket"), "daily");
});

test("the base URL trailing slash is normalized", async () => {
  const req = onlyCall((await call({ action: "list", resource: "brands" })).calls);
  assert.equal(req.url.origin, "https://medusa.example.com");
  assert.equal(req.path, "/admin/brands");
});
