import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { listResourceEndpoints } from "../../lib/extension-resources.js";
import * as content from "../../tools/medusa-admin-api/medusa-admin-ext-content.js";
import * as payments from "../../tools/medusa-admin-api/medusa-admin-ext-payments.js";
import * as chatbot from "../../tools/medusa-admin-api/medusa-admin-ext-chatbot.js";
import * as stores from "../../tools/medusa-admin-api/medusa-admin-ext-stores.js";
import * as integrations from "../../tools/medusa-admin-api/medusa-admin-ext-integrations.js";
import * as commerce from "../../tools/medusa-admin-api/medusa-admin-ext-commerce.js";
import * as logistics from "../../tools/medusa-admin-api/medusa-admin-ext-logistics.js";
import * as growth from "../../tools/medusa-admin-api/medusa-admin-ext-growth.js";

// Familias que 1.9.0 hace alcanzables (gaps de verify-extension-routes contra el
// boilerplate): rutas, métodos y riesgos declarados.

const callsOf = (mod) =>
  new Map(
    listResourceEndpoints(mod.extensionResources).map((c) => [`${c.resource}.${c.sub_action ?? c.action}`, `${c.method} ${c.path}`]),
  );
const endpoint = (mod, resource, name) => {
  const r = mod.extensionResources[resource];
  return r.ops[name] ?? r.subActions[name];
};

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;
let fetchCalls;

beforeEach(() => {
  fetchCalls = [];
  process.env.MEDUSA_BASE_URL = "https://medusa.example.com";
  process.env.MEDUSA_API_KEY = "secret-key";
  process.env.MEDUSA_AUTH_TYPE = "api-key";
  globalThis.fetch = async (url, options = {}) => {
    fetchCalls.push({ url: new URL(String(url)), options });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  globalThis.fetch = ORIGINAL_FETCH;
});

test("chatbot: bots (PATCH update), versiones, publicación con confirm y bandeja", async () => {
  const calls = callsOf(chatbot);
  assert.equal(calls.get("chatbot_bots.list"), "GET /admin/chatbot/bots");
  assert.equal(calls.get("chatbot_bots.update"), "PATCH /admin/chatbot/bots/{id}");
  assert.equal(calls.get("chatbot_bots.delete"), "DELETE /admin/chatbot/bots/{id}");
  assert.equal(calls.get("chatbot_bots.duplicate"), "POST /admin/chatbot/bots/{id}/duplicate");
  assert.equal(calls.get("chatbot_bots.list_versions"), "GET /admin/chatbot/bots/{id}/versions");
  assert.equal(calls.get("chatbot_bots.get_version"), "GET /admin/chatbot/bots/{id}/versions/{child_id}");
  assert.equal(calls.get("chatbot_bots.create_version"), "POST /admin/chatbot/bots/{id}/versions");
  assert.equal(calls.get("chatbot_bots.restore_version"), "POST /admin/chatbot/bots/{id}/versions/{child_id}/restore");
  assert.equal(calls.get("chatbot_capabilities.get"), "GET /admin/chatbot/capabilities");
  for (const sub of ["assign", "release", "close", "reply"]) {
    assert.equal(calls.get(`chatbot_conversations.${sub}`), `POST /admin/chatbot/conversations/{id}/${sub}`);
  }
  assert.equal(calls.get("chatbot_conversations.return_to_bot"), "POST /admin/chatbot/conversations/{id}/return-to-bot");

  assert.equal(endpoint(chatbot, "chatbot_bots", "publish").impact, "high");
  assert.equal(endpoint(chatbot, "chatbot_bots", "unpublish").impact, "high");
  assert.equal(endpoint(chatbot, "chatbot_conversations", "reply").impact, "high", "le escribe a un cliente");
  assert.equal(endpoint(chatbot, "chatbot_conversations", "close").impact, null);

  const blocked = await chatbot.apiTool.function({ action: "sub_action", resource: "chatbot_bots", sub_action: "publish", id: "bot_1" });
  assert.equal(blocked.requires_confirmation, true);
  assert.equal(fetchCalls.length, 0);

  const missing = await chatbot.apiTool.function({
    action: "sub_action",
    resource: "chatbot_conversations",
    sub_action: "reply",
    id: "cv_1",
    body: { expected_revision: 3 },
    confirm: true,
  });
  assert.match(missing.error, /body\.text/);

  await chatbot.apiTool.function({ action: "update", resource: "chatbot_bots", id: "bot_1", body: { name: "Bot" }, site_id: "site_a" });
  assert.equal(fetchCalls[0].options.method, "PATCH");
  assert.equal(fetchCalls[0].url.pathname, "/admin/chatbot/bots/bot_1");
  assert.equal(fetchCalls[0].options.headers["x-site-id"], "site_a");
});

test("páginas y header/footer se editan desde Tiendas: viven en stores; publicar pide confirm", async () => {
  const calls = callsOf(stores);
  assert.equal(calls.get("site_pages.list_pages"), "GET /admin/sites/{id}/pages");
  assert.equal(calls.get("site_pages.create_page"), "POST /admin/sites/{id}/pages");
  assert.equal(calls.get("site_pages.get_page"), "GET /admin/sites/{id}/pages/{child_id}");
  assert.equal(calls.get("site_pages.update_page"), "POST /admin/sites/{id}/pages/{child_id}");
  assert.equal(calls.get("site_pages.set_page_status"), "POST /admin/sites/{id}/pages/{child_id}/status");
  assert.equal(calls.get("site_chrome.save_draft"), "POST /admin/sites/{id}/chrome-draft");
  assert.equal(calls.get("site_chrome.discard_draft"), "DELETE /admin/sites/{id}/chrome-draft");
  assert.equal(calls.get("site_chrome.get_preview"), "GET /admin/sites/{id}/chrome-preview");
  assert.equal(calls.get("site_chrome.preview"), "POST /admin/sites/{id}/chrome-preview");
  assert.equal(calls.get("site_chrome.publish"), "POST /admin/sites/{id}/chrome-publish");
  assert.equal(calls.has("site_pages.delete_page"), false, "no hay DELETE de páginas");

  assert.equal(endpoint(stores, "site_chrome", "preview").mutating, false);
  assert.equal(endpoint(stores, "site_chrome", "publish").impact, "high");
  assert.equal(endpoint(stores, "site_pages", "set_page_status").impact, "high");

  await stores.apiTool.function({
    action: "sub_action",
    resource: "site_chrome",
    sub_action: "discard_draft",
    id: "site_1",
    query: { part: "header" },
  });
  assert.equal(fetchCalls[0].options.method, "DELETE");
  assert.equal(fetchCalls[0].url.pathname, "/admin/sites/site_1/chrome-draft");
  assert.equal(fetchCalls[0].url.searchParams.get("part"), "header");
});

test("banners settings y etiquetas de medios (content); plantillas de email siguen en extensions", () => {
  const calls = callsOf(content);
  assert.equal(calls.get("banner_settings.get"), "GET /admin/banners/settings");
  assert.equal(calls.get("banner_settings.update"), "POST /admin/banners/settings");
  assert.equal(calls.get("media_library.list_tags"), "GET /admin/media-library/tags");
  assert.equal(calls.get("media_library.update_tags"), "POST /admin/media-library/tags");
  assert.equal(content.extensionResources.email_templates, undefined);
  assert.equal(content.extensionResources.site_pages, undefined);
});

test("sites: dominio propio, medio de pago del checkout y preview del directorio; store_commerce ya no existe", () => {
  const calls = callsOf(stores);
  assert.equal(calls.get("sites.verify_custom_domain"), "POST /admin/sites/{id}/custom-domain/verify");
  assert.equal(calls.get("sites.link_checkout_provider"), "POST /admin/sites/{id}/checkout/link-provider");
  assert.equal(calls.get("sites.get_directory_preview"), "GET /admin/sites/directory/preview");
  assert.equal(calls.get("sites.directory_preview"), "POST /admin/sites/directory/preview");
  assert.equal(endpoint(stores, "sites", "directory_preview").mutating, false);
  assert.equal(endpoint(stores, "sites", "verify_custom_domain").impact, "high");
  assert.equal(endpoint(stores, "sites", "link_checkout_provider").impact, "high");
  assert.equal(stores.extensionResources.store_commerce, undefined, "rutas borradas en store-config 1.22/1.25");
});

test("integraciones: orden de tienda en Typesense, ERP (drift, sale preview, borrar config), Meta y GA4", () => {
  const calls = callsOf(integrations);
  assert.equal(calls.get("typesense_store_order.get"), "GET /admin/typesense/store-order");
  assert.equal(calls.get("typesense_store_order.update"), "PUT /admin/typesense/store-order");
  assert.equal(calls.get("typesense_store_order.options"), "GET /admin/typesense/store-order/options");
  assert.equal(calls.get("typesense_store_order.products"), "GET /admin/typesense/store-order/products");
  assert.equal(calls.get("typesense_store_order.preview"), "POST /admin/typesense/store-order/preview");
  assert.equal(endpoint(integrations, "typesense_store_order", "preview").mutating, false);
  assert.equal(endpoint(integrations, "typesense_store_order", "update").impact, "high", "publica en la tienda");

  assert.equal(calls.get("erp.drift"), "GET /admin/erp/drift");
  assert.equal(calls.get("erp.set_drift_owner"), "POST /admin/erp/drift/owner");
  assert.equal(calls.get("erp.sale_preview"), "GET /admin/erp/orders/{id}/sale-preview");
  assert.equal(calls.get("erp_config.delete"), "DELETE /admin/erp/config");
  assert.equal(endpoint(integrations, "erp_config", "delete").impact, "high");

  assert.equal(calls.get("meta_catalog.get"), "GET /admin/marketing-privacy/meta");
  assert.equal(integrations.extensionResources.meta_catalog.readOnly, true);

  assert.equal(calls.get("ga4_config.test"), "POST /admin/ga4-config/test-connection");
  assert.equal(endpoint(integrations, "ga4_config", "test").mutating, false);
});

test("agent commerce (sólo lectura), envia y buscador de SEO-GEO", () => {
  let calls = callsOf(commerce);
  assert.equal(calls.get("agent_commerce.get"), "GET /admin/agent-commerce/summary");
  assert.equal(calls.get("agent_commerce.channels"), "GET /admin/agent-commerce/channels");
  assert.equal(calls.get("agent_commerce.events"), "GET /admin/agent-commerce/events");
  assert.equal(commerce.extensionResources.agent_commerce.readOnly, true);
  assert.equal(commerce.extensionResources.payment_benefits, undefined, "se movió a manage_minimalart_payments");

  calls = callsOf(logistics);
  assert.equal(calls.get("envia.carriers"), "GET /admin/envia/carriers");
  assert.equal(calls.get("envia.get_default_carrier"), "GET /admin/envia/locations/{id}/default-carrier");
  assert.equal(calls.get("envia.set_default_carrier"), "POST /admin/envia/locations/{id}/default-carrier");
  assert.equal(calls.get("envia.quote_test"), "POST /admin/envia/quote-test");
  assert.equal(endpoint(logistics, "envia", "quote_test").mutating, false);

  assert.equal(callsOf(growth).get("seo_geo.search_products"), "GET /admin/seo-geo/products");
});

test("pagos: beneficios (sync de todos) y links de pago; las cuentas de cobro están en integraciones", async () => {
  const calls = callsOf(payments);
  assert.equal(calls.get("payment_benefits.sync_all"), "POST /admin/payment-benefits/sync");
  assert.equal(calls.get("payment_benefits.sync"), "POST /admin/payment-benefits/sync/{id}");
  assert.equal(calls.get("checkout_links.list"), "GET /admin/checkout-links");
  const accounts = callsOf(integrations);
  for (const provider of ["mercadopago", "mobbex", "modo"]) {
    assert.equal(accounts.get(`payment_accounts.get_${provider}`), `GET /admin/${provider}/site-account`);
    assert.equal(accounts.get(`payment_accounts.update_${provider}`), `POST /admin/${provider}/site-account`);
    assert.equal(accounts.get(`payment_accounts.disconnect_${provider}`), `DELETE /admin/${provider}/site-account`);
    assert.equal(endpoint(integrations, "payment_accounts", `update_${provider}`).impact, "high");
    assert.equal(endpoint(integrations, "payment_accounts", `disconnect_${provider}`).impact, "high");
    assert.equal(endpoint(integrations, "payment_accounts", `get_${provider}`).impact, null);
  }
  assert.equal(Object.keys(integrations.extensionResources.payment_accounts.ops).length, 0, "el genérico site-credentials no se expone");

  const blocked = await integrations.apiTool.function({
    action: "sub_action",
    resource: "payment_accounts",
    sub_action: "disconnect_modo",
    site_id: "site_a",
  });
  assert.equal(blocked.requires_confirmation, true);
  assert.equal(fetchCalls.length, 0);

  await integrations.apiTool.function({ action: "sub_action", resource: "payment_accounts", sub_action: "get_mercadopago", site_id: "site_a" });
  assert.equal(fetchCalls[0].url.pathname, "/admin/mercadopago/site-account");
  assert.equal(fetchCalls[0].options.headers["x-site-id"], "site_a");
});
