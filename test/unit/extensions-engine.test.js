import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  createExtensionTool,
  defineResources,
  listResourceEndpoints,
  TOOL_ACTIONS,
} from "../../lib/extension-resources.js";
import { apiTool as legacyTool } from "../../tools/medusa-admin-api/medusa-admin-extensions.js";
import { apiTool as integrationsTool } from "../../tools/medusa-admin-api/medusa-admin-ext-integrations.js";
import { apiTool as commerceTool } from "../../tools/medusa-admin-api/medusa-admin-ext-commerce.js";
import { apiTool as logisticsTool } from "../../tools/medusa-admin-api/medusa-admin-ext-logistics.js";
import { apiTool as whatsappTool } from "../../tools/medusa-admin-api/medusa-admin-ext-whatsapp.js";
import { apiTool as growthTool } from "../../tools/medusa-admin-api/medusa-admin-ext-growth.js";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;
let fetchCalls;
let nextResponse;

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  fetchCalls = [];
  nextResponse = () => jsonResponse({ ok: true });
  process.env.MEDUSA_BASE_URL = "https://medusa.example.com";
  process.env.MEDUSA_API_KEY = "secret-key";
  process.env.MEDUSA_AUTH_TYPE = "api-key";
  globalThis.fetch = async (url, options = {}) => {
    fetchCalls.push({ url: String(url), options });
    return nextResponse(url, options);
  };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  globalThis.fetch = ORIGINAL_FETCH;
});

const lastCall = () => fetchCalls[fetchCalls.length - 1];
const lastUrl = () => new URL(lastCall().url);
const lastBody = () => JSON.parse(lastCall().options.body);

test("ids and child ids are URL-encoded in the path", async () => {
  await legacyTool.function({ action: "get", resource: "brands", id: "br/1 ?x" });
  assert.equal(lastUrl().pathname, "/admin/brands/br%2F1%20%3Fx");

  await legacyTool.function({
    action: "sub_action",
    resource: "companies",
    sub_action: "update_member",
    id: "comp 1",
    child_id: "mem/2",
    body: { role: "buyer" },
  });
  assert.equal(new URL(lastCall().url).pathname, "/admin/companies/comp%201/members/mem%2F2");
  assert.equal(lastCall().options.method, "POST");
});

test("singleton update posts to the resource root", async () => {
  await legacyTool.function({ action: "update", resource: "blog_settings", id: "ignored", body: { title: "Blog" } });
  assert.equal(lastUrl().pathname, "/admin/blog-settings");
  assert.equal(lastCall().options.method, "POST");
  assert.deepEqual(lastBody(), { title: "Blog" });

  await commerceTool.function({ action: "list", resource: "loyalty_dashboard" });
  assert.equal(lastUrl().pathname, "/admin/loyalty/dashboard");
  assert.equal(lastCall().options.method, "GET");
});

test("PUT resources use PUT for create (upsert by id) and update", async () => {
  await integrationsTool.function({
    action: "create",
    resource: "typesense_synonyms",
    id: "shoes",
    body: { synonyms: ["zapatillas", "tenis"] },
  });
  assert.equal(lastCall().options.method, "PUT");
  assert.equal(lastUrl().pathname, "/admin/typesense/synonyms/shoes");

  await integrationsTool.function({ action: "update", resource: "typesense_presets", id: "p1", body: {} });
  assert.equal(lastCall().options.method, "PUT");
  assert.equal(lastUrl().pathname, "/admin/typesense/presets/p1");

  const denied = await integrationsTool.function({ action: "create", resource: "typesense_curations", body: {} });
  assert.match(denied.error, /id is required/);

  await whatsappTool.function({
    action: "update",
    resource: "whatsapp_templates",
    id: "order_ready",
    body: { components: [] },
    confirm: true,
  });
  assert.equal(lastCall().options.method, "PUT");
  assert.equal(lastUrl().pathname, "/admin/kapso/templates/order_ready");
});

test("DELETE with body sends the JSON body only when declared", async () => {
  await legacyTool.function({
    action: "sub_action",
    resource: "brands",
    sub_action: "remove_products",
    id: "br_1",
    body: { product_ids: ["prod_1"] },
  });
  assert.equal(lastCall().options.method, "DELETE");
  assert.equal(lastUrl().pathname, "/admin/brands/br_1/products");
  assert.deepEqual(lastBody(), { product_ids: ["prod_1"] });

  await integrationsTool.function({
    action: "sub_action",
    resource: "erp_tinting",
    sub_action: "delete_colors",
    body: { codes: ["A1"] },
  });
  assert.equal(lastCall().options.method, "DELETE");
  assert.equal(lastUrl().pathname, "/admin/erp/tinting/colors");
  assert.deepEqual(lastBody(), { codes: ["A1"] });

  await legacyTool.function({ action: "delete", resource: "banners", id: "ban_1", body: { ignored: true } });
  assert.equal(lastCall().options.method, "DELETE");
  assert.equal(lastCall().options.body, undefined);
});

test("sub-action paths are built from templates, relative and absolute", async () => {
  await legacyTool.function({ action: "sub_action", resource: "banners", sub_action: "publish", id: "ban_1" });
  assert.equal(lastUrl().pathname, "/admin/banners/ban_1/publish");

  await legacyTool.function({ action: "sub_action", resource: "commerce_dashboards", sub_action: "catalogue" });
  assert.equal(lastUrl().pathname, "/admin/commerce-dashboard/catalogue");
  assert.equal(lastCall().options.method, "GET");

  // Acepta el nombre del sub_action directo en `action`.
  await legacyTool.function({ action: "unpublish", resource: "banners", id: "ban_1" });
  assert.equal(lastUrl().pathname, "/admin/banners/ban_1/unpublish");

  // Placeholder en query (pdf_catalogs/file?id=).
  await growthTool.function({ action: "sub_action", resource: "pdf_catalogs", sub_action: "download", id: "cat 1" });
  assert.equal(lastUrl().pathname, "/admin/pdf-catalogs/file");
  assert.equal(lastUrl().searchParams.get("id"), "cat 1");

  // fixedBody pisa lo que mande el caller.
  await whatsappTool.function({
    action: "sub_action",
    resource: "whatsapp_conversations",
    sub_action: "pause_bot",
    body: { phone: "5491100000000", action: "resume" },
  });
  assert.equal(lastUrl().pathname, "/admin/whatsapp-conversations");
  assert.deepEqual(lastBody(), { phone: "5491100000000", action: "pause" });
});

test("site_id is sent as the x-site-id header, and only when provided", async () => {
  await commerceTool.function({ action: "list", resource: "bundles", site_id: "site_01ABC" });
  assert.equal(lastCall().options.headers["x-site-id"], "site_01ABC");
  assert.equal(lastCall().options.headers.Authorization, "Basic secret-key");

  await commerceTool.function({ action: "list", resource: "bundles", site_id: "*" });
  assert.equal(lastCall().options.headers["x-site-id"], "*");

  await commerceTool.function({ action: "list", resource: "bundles" });
  assert.equal("x-site-id" in lastCall().options.headers, false);

  const count = fetchCalls.length;
  const bad = await commerceTool.function({ action: "list", resource: "bundles", site_id: "a b\r\nx: y" });
  assert.match(bad.error, /site_id/);
  assert.equal(fetchCalls.length, count);
});

test("query params: limit/offset/q plus query object (arrays as key[])", async () => {
  await legacyTool.function({
    action: "list",
    resource: "commerce_dashboard",
    limit: 10,
    offset: 5,
    q: "x",
    query: { from: "2026-05-01T00:00:00Z", bucket: "daily", ids: ["a", "b"] },
  });
  const url = lastUrl();
  assert.equal(url.pathname, "/admin/commerce-dashboard");
  assert.equal(url.searchParams.get("limit"), "10");
  assert.equal(url.searchParams.get("offset"), "5");
  assert.equal(url.searchParams.get("q"), "x");
  assert.equal(url.searchParams.get("from"), "2026-05-01T00:00:00Z");
  assert.deepEqual(url.searchParams.getAll("ids[]"), ["a", "b"]);
});

test("binary responses are summarized, never dumped", async () => {
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x00, 0xff, 0x10]);
  nextResponse = () =>
    new Response(pdf, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="etiqueta-123.pdf"',
      },
    });
  const result = await logisticsTool.function({
    action: "sub_action",
    resource: "andreani",
    sub_action: "download_label",
    id: "SHIP-1",
  });
  assert.equal(lastUrl().pathname, "/admin/andreani/labels/SHIP-1");
  assert.equal(result.binary, true);
  assert.equal(result.content_type, "application/pdf");
  assert.equal(result.size_bytes, pdf.byteLength);
  assert.equal(result.filename, "etiqueta-123.pdf");
  assert.match(result.note, /backoffice/);
  assert.equal(JSON.stringify(result).includes("%PDF"), false);
});

test("CSV responses return a truncated preview", async () => {
  const rows = ["brand,product", ...Array.from({ length: 50 }, (_, i) => `b${i},p${i}`)].join("\n");
  nextResponse = () =>
    new Response(`﻿${rows}`, {
      status: 200,
      headers: { "content-type": "text/csv", "content-disposition": 'attachment; filename="brand_associations.csv"' },
    });
  const result = await legacyTool.function({ action: "sub_action", resource: "brands", sub_action: "export" });
  assert.equal(result.format, "csv");
  assert.equal(result.total_rows, 50);
  assert.equal(result.truncated, true);
  assert.equal(result.filename, "brand_associations.csv");
  assert.ok(result.preview.startsWith("brand,product\nb0,p0"));
  assert.equal(result.preview.split("\n").length, 21);
  assert.match(result.note, /Marcas/);
});

test("read-only resources reject writes without calling the store", async () => {
  const result = await legacyTool.function({ action: "create", resource: "commerce_dashboard", body: {} });
  assert.match(result.error, /not available/);
  assert.match(result.error, /read-only/);
  const ro = await integrationsTool.function({ action: "delete", resource: "typesense_collections", id: "c1" });
  assert.match(ro.error, /not available/);
  assert.equal(fetchCalls.length, 0);

  assert.throws(
    () =>
      defineResources({
        broken: {
          path: "/admin/broken",
          summary: "x",
          readOnly: true,
          subActions: { purge: { method: "POST", path: "/purge" } },
        },
      }),
    /read-only resource cannot declare mutating sub_action/,
  );
  assert.throws(
    () => defineResources({ broken: { path: "/admin/broken", summary: "x", readOnly: true, ops: ["create"] } }),
    /read-only resource cannot declare/,
  );
});

test("unknown sub-action, action or resource returns an actionable error", async () => {
  const unknownSub = await legacyTool.function({ action: "sub_action", resource: "banners", sub_action: "explode", id: "1" });
  assert.match(unknownSub.error, /Unknown sub_action 'explode'/);
  assert.match(unknownSub.error, /publish, unpublish, archive/);

  const missingSub = await legacyTool.function({ action: "sub_action", resource: "banners" });
  assert.match(missingSub.error, /sub_action is required/);

  const unknownAction = await legacyTool.function({ action: "frobnicate", resource: "banners" });
  assert.match(unknownAction.error, /Unknown action: frobnicate/);

  const unknownResource = await legacyTool.function({ action: "list", resource: "nope" });
  assert.match(unknownResource.error, /Unknown resource: nope/);

  // Claves del prototipo no se confunden con recursos/acciones declarados.
  assert.match((await legacyTool.function({ action: "list", resource: "constructor" })).error, /Unknown resource/);
  assert.match((await legacyTool.function({ action: "toString", resource: "banners" })).error, /Unknown action/);
  assert.match(
    (await legacyTool.function({ action: "sub_action", sub_action: "__proto__", resource: "banners" })).error,
    /Unknown sub_action/,
  );
  assert.equal(fetchCalls.length, 0);
});

test("high-impact actions require confirm: true", async () => {
  const blocked = await legacyTool.function({ action: "sub_action", resource: "email_templates", sub_action: "test_send", id: "tpl_1" });
  assert.equal(blocked.requires_confirmation, true);
  assert.match(blocked.error, /confirm: true/);
  assert.equal(fetchCalls.length, 0);

  await legacyTool.function({
    action: "sub_action",
    resource: "email_templates",
    sub_action: "test_send",
    id: "tpl_1",
    confirm: true,
    body: { to: "ops@example.com" },
  });
  assert.equal(lastUrl().pathname, "/admin/email-templates/tpl_1/test-send");
});

test("required query/body fields and forbidden query params are enforced", async () => {
  const analytics = await logisticsTool.function({ action: "sub_action", resource: "delivery", sub_action: "analytics" });
  assert.match(analytics.error, /query\.from, query\.to/);

  await logisticsTool.function({
    action: "sub_action",
    resource: "delivery",
    sub_action: "analytics",
    query: { from: "2026-05-01", to: "2026-05-31" },
  });
  assert.equal(lastUrl().pathname, "/admin/delivery/analytics");

  const fiscal = await commerceTool.function({ action: "list", resource: "fiscal_documents", query: { owner_type: "company" } });
  assert.match(fiscal.error, /query\.owner_id/);

  const reject = await commerceTool.function({
    action: "sub_action",
    resource: "b2b_draft_orders",
    sub_action: "reject",
    id: "dr_1",
    confirm: true,
  });
  assert.match(reject.error, /body\.note/);

  const documents = await logisticsTool.function({ action: "get", resource: "order_checkout", id: "order_1", query: { documents: "1" } });
  assert.match(documents.error, /not exposed/);
  assert.equal(fetchCalls.length, 1);

  await logisticsTool.function({ action: "get", resource: "order_checkout", id: "order_1" });
  assert.equal(lastUrl().pathname, "/admin/orders/order_1/checkout");
  assert.equal(lastUrl().searchParams.has("documents"), false);
});

test("describe returns routes and notes without calling the store", async () => {
  const described = await commerceTool.function({ action: "describe", resource: "recurring_orders" });
  assert.equal(described.resource, "recurring_orders");
  assert.equal(described.actions.get.call, "GET /admin/recurring-orders/{id}");
  assert.equal(described.sub_actions.force_cycle.call, "POST /admin/recurring-orders/{id}/cycles/{child_id}/force");
  assert.equal(described.sub_actions.force_cycle.high_impact, true);
  assert.deepEqual(described.sub_actions.force_cycle.needs, ["id", "child_id"]);
  assert.equal(fetchCalls.length, 0);
});

test("HTTP errors come back as { error, status }", async () => {
  nextResponse = () => jsonResponse({ message: "Store not found" }, 404);
  const result = await legacyTool.function({ action: "list", resource: "commerce_dashboard", site_id: "site_x" });
  assert.equal(result.status, 404);
  assert.match(result.error, /commerce_dashboard\/list: HTTP 404/);
});

test("missing credentials short-circuit before any request", async () => {
  delete process.env.MEDUSA_API_KEY;
  delete process.env.MEDUSA_JWT;
  delete process.env.MEDUSA_SESSION_COOKIE;
  delete process.env.MEDUSA_COOKIE;
  const result = await legacyTool.function({ action: "list", resource: "brands" });
  assert.match(result.error, /credentials not configured/);
  assert.equal(fetchCalls.length, 0);
});

test("spec validation rejects bad declarations at load time", () => {
  assert.throws(() => defineResources({ x: { path: "/store/x", summary: "x" } }), /must start with \/admin\//);
  assert.throws(
    () => defineResources({ x: { path: "/admin/x", summary: "x", subActions: { go: { method: "FETCH", path: "/go" } } } }),
    /invalid or missing method/,
  );
  assert.throws(
    () => defineResources({ x: { path: "/admin/x", summary: "x", subActions: { go: { method: "GET", path: "/{slug}" } } } }),
    /unknown placeholder/,
  );
  assert.throws(
    () => defineResources({ x: { path: "/admin/x", summary: "x", subActions: { list: { method: "GET", path: "/a" } } } }),
    /collides/,
  );
});

test("children expand into list/get/create/update/delete sub-actions", () => {
  const resources = defineResources({
    parents: {
      path: "/admin/parents",
      summary: "p",
      children: { members: { path: "/{id}/members", updateMethod: "PUT" } },
    },
  });
  const endpoints = listResourceEndpoints(resources)
    .filter((e) => e.sub_action)
    .map((e) => `${e.sub_action} ${e.method} ${e.path}`);
  assert.deepEqual(endpoints, [
    "list_members GET /admin/parents/{id}/members",
    "get_member GET /admin/parents/{id}/members/{child_id}",
    "create_member POST /admin/parents/{id}/members",
    "update_member PUT /admin/parents/{id}/members/{child_id}",
    "delete_member DELETE /admin/parents/{id}/members/{child_id}",
  ]);
});

test("custom tools built with the engine expose the shared schema", () => {
  const tool = createExtensionTool({
    name: "manage_test_ext",
    intro: "Test.",
    resources: { things: { path: "/admin/things", summary: "Things" } },
  });
  assert.deepEqual(tool.definition.parameters.properties.action.enum, [...TOOL_ACTIONS]);
  assert.deepEqual(tool.definition.parameters.properties.resource.enum, ["things"]);
  assert.match(tool.definition.description, /- things \[LGCUD\]: Things/);
});
