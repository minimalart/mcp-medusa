import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { apiTool as returns } from "../../tools/medusa-admin-api/medusa-admin-returns.js";
import { apiTool as orders } from "../../tools/medusa-admin-api/medusa-admin-orders.js";
import { apiTool as draftOrders } from "../../tools/medusa-admin-api/medusa-admin-draft-orders.js";
import { apiTool as products } from "../../tools/medusa-admin-api/medusa-admin-products.js";
import { apiTool as pricing } from "../../tools/medusa-admin-api/medusa-admin-pricing.js";
import { apiTool as payments } from "../../tools/medusa-admin-api/medusa-admin-payments.js";
import { apiTool as regions } from "../../tools/medusa-admin-api/medusa-admin-regions.js";
import { apiTool as inventory } from "../../tools/medusa-admin-api/medusa-admin-inventory.js";
import { apiTool as taxes } from "../../tools/medusa-admin-api/medusa-admin-taxes.js";
import { apiTool as users } from "../../tools/medusa-admin-api/medusa-admin-users.js";
import { apiTool as collections } from "../../tools/medusa-admin-api/medusa-admin-collections.js";
import { apiTool as customers } from "../../tools/medusa-admin-api/medusa-admin-customers.js";
import { apiTool as v2 } from "../../tools/medusa-admin-api/medusa-admin-v2.js";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;
let fetchCalls;
let responses;

function jsonResponse(status, body) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": typeof body === "string" ? "text/html" : "application/json" },
  });
}

function respondWith(...queue) {
  responses.push(...queue);
}

function call(index = 0) {
  const entry = fetchCalls[index];
  assert.ok(entry, `expected fetch call #${index}`);
  const url = new URL(entry.url);
  const raw = entry.options.body;
  let body;
  if (typeof raw === "string") body = JSON.parse(raw);
  else if (raw !== undefined) body = Buffer.from(raw).toString("utf8");
  return {
    method: entry.options.method || "GET",
    path: url.pathname,
    query: url.searchParams,
    body,
    headers: entry.options.headers,
  };
}

/** "METHOD /path" of every fetch call so far. */
function routes() {
  return fetchCalls.map((_, index) => `${call(index).method} ${call(index).path}`);
}

beforeEach(() => {
  fetchCalls = [];
  responses = [];
  process.env.MEDUSA_BASE_URL = "https://medusa.example.com";
  process.env.MEDUSA_API_KEY = "sk_test";
  process.env.MEDUSA_AUTH_TYPE = "api-key";

  globalThis.fetch = async (url, options = {}) => {
    fetchCalls.push({ url: String(url), options });
    const next = responses.shift() || { status: 200, body: { ok: true } };
    return jsonResponse(next.status, next.body);
  };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("returns tool: claims", () => {
  test("claim lifecycle hits the claim order-change routes", async () => {
    await returns.function({ action: "create_claim", type: "replace", order_id: "order_1", reason_id: "rr_1", limit: 5 });
    await returns.function({ action: "claim_add_items", claim_id: "claim_1", items: [{ id: "ordli_1", quantity: 1 }] });
    await returns.function({ action: "claim_update_item", claim_id: "claim_1", action_id: "act_1", quantity: 2, bogus: true });
    await returns.function({ action: "claim_remove_item", claim_id: "claim_1", action_id: "act_1" });
    await returns.function({ action: "claim_add_inbound_items", claim_id: "claim_1", items: [{ id: "ordli_1", quantity: 1 }], location_id: "sloc_1" });
    await returns.function({ action: "claim_update_inbound_item", claim_id: "claim_1", action_id: "act_2", quantity: 1 });
    await returns.function({ action: "claim_remove_inbound_item", claim_id: "claim_1", action_id: "act_2" });
    await returns.function({ action: "claim_add_inbound_shipping_method", claim_id: "claim_1", shipping_option_id: "so_1" });
    await returns.function({ action: "claim_update_inbound_shipping_method", claim_id: "claim_1", action_id: "act_3", custom_amount: 0 });
    await returns.function({ action: "claim_remove_inbound_shipping_method", claim_id: "claim_1", action_id: "act_3" });
    await returns.function({ action: "claim_add_outbound_items", claim_id: "claim_1", items: [{ variant_id: "variant_1", quantity: 1 }] });
    await returns.function({ action: "claim_update_outbound_item", claim_id: "claim_1", action_id: "act_4", quantity: 3 });
    await returns.function({ action: "claim_remove_outbound_item", claim_id: "claim_1", action_id: "act_4" });
    await returns.function({ action: "claim_add_outbound_shipping_method", claim_id: "claim_1", shipping_option_id: "so_2" });
    await returns.function({ action: "claim_update_outbound_shipping_method", claim_id: "claim_1", action_id: "act_5", custom_amount: 10 });
    await returns.function({ action: "claim_remove_outbound_shipping_method", claim_id: "claim_1", action_id: "act_5" });
    await returns.function({ action: "confirm_claim_request", claim_id: "claim_1", no_notification: true });
    await returns.function({ action: "cancel_claim_request", claim_id: "claim_1" });

    assert.deepEqual(routes(), [
      "POST /admin/claims",
      "POST /admin/claims/claim_1/claim-items",
      "POST /admin/claims/claim_1/claim-items/act_1",
      "DELETE /admin/claims/claim_1/claim-items/act_1",
      "POST /admin/claims/claim_1/inbound/items",
      "POST /admin/claims/claim_1/inbound/items/act_2",
      "DELETE /admin/claims/claim_1/inbound/items/act_2",
      "POST /admin/claims/claim_1/inbound/shipping-method",
      "POST /admin/claims/claim_1/inbound/shipping-method/act_3",
      "DELETE /admin/claims/claim_1/inbound/shipping-method/act_3",
      "POST /admin/claims/claim_1/outbound/items",
      "POST /admin/claims/claim_1/outbound/items/act_4",
      "DELETE /admin/claims/claim_1/outbound/items/act_4",
      "POST /admin/claims/claim_1/outbound/shipping-method",
      "POST /admin/claims/claim_1/outbound/shipping-method/act_5",
      "DELETE /admin/claims/claim_1/outbound/shipping-method/act_5",
      "POST /admin/claims/claim_1/request",
      "DELETE /admin/claims/claim_1/request",
    ]);
    assert.deepEqual(call(0).body, { type: "replace", order_id: "order_1", reason_id: "rr_1" });
    assert.deepEqual(call(2).body, { quantity: 2 }, "only the fields the strict validator accepts");
    assert.deepEqual(call(4).body, { items: [{ id: "ordli_1", quantity: 1 }], location_id: "sloc_1" });
    assert.deepEqual(call(8).body, { custom_amount: 0 });
    assert.equal(call(3).body, undefined, "DELETE sends no body");
    assert.deepEqual(call(16).body, { no_notification: true });
  });

  test("claim steps validate ids, items and required fields before calling the store", async () => {
    await assert.rejects(() => returns.function({ action: "create_claim", order_id: "order_1" }), /type is required/);
    await assert.rejects(() => returns.function({ action: "claim_add_items", items: [{ id: "x", quantity: 1 }] }), /claim_id/);
    await assert.rejects(() => returns.function({ action: "claim_add_items", claim_id: "claim_1" }), /items/);
    await assert.rejects(() => returns.function({ action: "claim_update_item", claim_id: "claim_1" }), /action_id/);
    await assert.rejects(
      () => returns.function({ action: "claim_add_outbound_shipping_method", claim_id: "claim_1" }),
      /shipping_option_id is required/
    );
    assert.equal(fetchCalls.length, 0);
  });

  test("update_claim stays removed and points to the new actions", async () => {
    const result = await returns.function({ action: "update_claim", claim_id: "claim_1" });
    assert.equal(result.removed, true);
    assert.match(result.error, /claim_add_items/);
    assert.equal(fetchCalls.length, 0);
  });
});

describe("returns tool: exchanges", () => {
  test("exchange lifecycle hits the exchange routes (no claim-items)", async () => {
    await returns.function({ action: "create_exchange", order_id: "order_1", description: "size swap" });
    await returns.function({ action: "exchange_add_inbound_items", exchange_id: "exc_1", items: [{ id: "ordli_1", quantity: 1 }] });
    await returns.function({ action: "exchange_update_inbound_item", exchange_id: "exc_1", action_id: "a1", quantity: 1, reason_id: "rr_1" });
    await returns.function({ action: "exchange_remove_inbound_item", exchange_id: "exc_1", action_id: "a1" });
    await returns.function({ action: "exchange_add_inbound_shipping_method", exchange_id: "exc_1", shipping_option_id: "so_1" });
    await returns.function({ action: "exchange_update_inbound_shipping_method", exchange_id: "exc_1", action_id: "a2" });
    await returns.function({ action: "exchange_remove_inbound_shipping_method", exchange_id: "exc_1", action_id: "a2" });
    await returns.function({ action: "exchange_add_outbound_items", exchange_id: "exc_1", items: [{ variant_id: "v_2", quantity: 1 }] });
    await returns.function({ action: "exchange_update_outbound_item", exchange_id: "exc_1", action_id: "a3", quantity: 2, reason_id: "dropped" });
    await returns.function({ action: "exchange_remove_outbound_item", exchange_id: "exc_1", action_id: "a3" });
    await returns.function({ action: "exchange_add_outbound_shipping_method", exchange_id: "exc_1", shipping_option_id: "so_2" });
    await returns.function({ action: "exchange_update_outbound_shipping_method", exchange_id: "exc_1", action_id: "a4", custom_amount: 5 });
    await returns.function({ action: "exchange_remove_outbound_shipping_method", exchange_id: "exc_1", action_id: "a4" });
    await returns.function({ action: "confirm_exchange_request", exchange_id: "exc_1" });
    await returns.function({ action: "cancel_exchange_request", exchange_id: "exc_1" });

    assert.deepEqual(routes(), [
      "POST /admin/exchanges",
      "POST /admin/exchanges/exc_1/inbound/items",
      "POST /admin/exchanges/exc_1/inbound/items/a1",
      "DELETE /admin/exchanges/exc_1/inbound/items/a1",
      "POST /admin/exchanges/exc_1/inbound/shipping-method",
      "POST /admin/exchanges/exc_1/inbound/shipping-method/a2",
      "DELETE /admin/exchanges/exc_1/inbound/shipping-method/a2",
      "POST /admin/exchanges/exc_1/outbound/items",
      "POST /admin/exchanges/exc_1/outbound/items/a3",
      "DELETE /admin/exchanges/exc_1/outbound/items/a3",
      "POST /admin/exchanges/exc_1/outbound/shipping-method",
      "POST /admin/exchanges/exc_1/outbound/shipping-method/a4",
      "DELETE /admin/exchanges/exc_1/outbound/shipping-method/a4",
      "POST /admin/exchanges/exc_1/request",
      "DELETE /admin/exchanges/exc_1/request",
    ]);
    assert.deepEqual(call(0).body, { order_id: "order_1", description: "size swap" });
    assert.deepEqual(call(2).body, { quantity: 1, reason_id: "rr_1" });
    assert.deepEqual(call(8).body, { quantity: 2 }, "outbound item updates only accept quantity/internal_note");
    assert.equal(returns.definition.parameters.properties.action.enum.includes("exchange_add_items"), false);
  });
});

describe("returns tool: returns, order changes and return reasons", () => {
  test("return request flow and received/dismissed item actions", async () => {
    await returns.function({ action: "create_return", order_id: "order_1", location_id: "sloc_1", no_notification: false });
    await returns.function({ action: "update_return", id: "ret_1", location_id: "sloc_2" });
    await returns.function({ action: "return_request_items", id: "ret_1", items: [{ id: "ordli_1", quantity: 1, reason_id: "rr_1" }] });
    await returns.function({ action: "return_update_request_item", id: "ret_1", action_id: "a1", quantity: 2 });
    await returns.function({ action: "return_remove_request_item", id: "ret_1", action_id: "a1" });
    await returns.function({ action: "return_add_shipping_method", id: "ret_1", shipping_option_id: "so_1" });
    await returns.function({ action: "return_update_shipping_method", id: "ret_1", action_id: "a2", custom_amount: 0 });
    await returns.function({ action: "return_remove_shipping_method", id: "ret_1", action_id: "a2" });
    await returns.function({ action: "confirm_return_request", id: "ret_1", no_notification: true });
    await returns.function({ action: "cancel_return_request", id: "ret_1" });
    await returns.function({ action: "return_update_received_item", id: "ret_1", action_id: "a3", quantity: 1 });
    await returns.function({ action: "return_remove_received_item", id: "ret_1", action_id: "a3" });
    await returns.function({ action: "return_dismiss_items", id: "ret_1", items: [{ id: "retitem_1", quantity: 1 }] });
    await returns.function({ action: "return_update_dismissed_item", id: "ret_1", action_id: "a4", quantity: 1 });
    await returns.function({ action: "return_remove_dismissed_item", id: "ret_1", action_id: "a4" });

    assert.deepEqual(routes(), [
      "POST /admin/returns",
      "POST /admin/returns/ret_1",
      "POST /admin/returns/ret_1/request-items",
      "POST /admin/returns/ret_1/request-items/a1",
      "DELETE /admin/returns/ret_1/request-items/a1",
      "POST /admin/returns/ret_1/shipping-method",
      "POST /admin/returns/ret_1/shipping-method/a2",
      "DELETE /admin/returns/ret_1/shipping-method/a2",
      "POST /admin/returns/ret_1/request",
      "DELETE /admin/returns/ret_1/request",
      "POST /admin/returns/ret_1/receive-items/a3",
      "DELETE /admin/returns/ret_1/receive-items/a3",
      "POST /admin/returns/ret_1/dismiss-items",
      "POST /admin/returns/ret_1/dismiss-items/a4",
      "DELETE /admin/returns/ret_1/dismiss-items/a4",
    ]);
    assert.deepEqual(call(0).body, { order_id: "order_1", location_id: "sloc_1", no_notification: false });
    assert.deepEqual(call(8).body, { no_notification: true });
  });

  test("order edit added-item routes keep working (POST/DELETE items/{action_id})", async () => {
    await returns.function({ action: "order_edit_update_added_item", order_id: "order_1", action_id: "a1", quantity: 2 });
    await returns.function({ action: "order_edit_remove_added_item", order_id: "order_1", action_id: "a1" });
    assert.deepEqual(routes(), ["POST /admin/order-edits/order_1/items/a1", "DELETE /admin/order-edits/order_1/items/a1"]);
  });

  test("update_order_change posts to /admin/order-changes/{id}", async () => {
    await returns.function({ action: "update_order_change", order_change_id: "ordch_1", carry_over_promotions: true, quantity: 3 });
    assert.equal(call().method, "POST");
    assert.equal(call().path, "/admin/order-changes/ordch_1");
    assert.deepEqual(call().body, { carry_over_promotions: true });
  });

  test("return reasons CRUD; update fills the required value/label from the current reason", async () => {
    await returns.function({ action: "list_return_reasons", q: "talle", limit: 10 });
    await returns.function({ action: "get_return_reason", return_reason_id: "rr_1" });
    await returns.function({ action: "create_return_reason", value: "wrong_size", label: "Talle incorrecto" });
    respondWith({ status: 200, body: { return_reason: { id: "rr_1", value: "wrong_size", label: "Talle" } } });
    await returns.function({ action: "update_return_reason", return_reason_id: "rr_1", label: "Talle incorrecto" });
    await returns.function({ action: "delete_return_reason", return_reason_id: "rr_1" });

    assert.deepEqual(routes(), [
      "GET /admin/return-reasons",
      "GET /admin/return-reasons/rr_1",
      "POST /admin/return-reasons",
      "GET /admin/return-reasons/rr_1",
      "POST /admin/return-reasons/rr_1",
      "DELETE /admin/return-reasons/rr_1",
    ]);
    assert.equal(call(0).query.get("q"), "talle");
    assert.deepEqual(call(4).body, { label: "Talle incorrecto", value: "wrong_size" });
  });
});

describe("orders tool: new order routes", () => {
  test("update, credit lines, line items, shipping options, payment session, export", async () => {
    const updated = await orders.function({ action: "update", id: "order_1", email: "new@example.com", status: "x" });
    assert.equal(updated.success, true);
    await orders.function({ action: "add_credit_line", id: "order_1", amount: 500, reference: "refund", reference_id: "ref_1" });
    await orders.function({ action: "list_line_items", id: "order_1", fields: "id,title" });
    await orders.function({ action: "list_shipping_options", id: "order_1" });
    await orders.function({ action: "authorize_payment_session", id: "order_1", payment_session_id: "payses_1" });
    const exported = await orders.function({ action: "export", status: ["pending"], created_at: { $gte: "2026-01-01" } });
    assert.equal(exported.success, true);

    assert.deepEqual(routes(), [
      "POST /admin/orders/order_1",
      "POST /admin/orders/order_1/credit-lines",
      "GET /admin/orders/order_1/line-items",
      "GET /admin/orders/order_1/shipping-options",
      "POST /admin/orders/order_1/payment-sessions/authorize",
      "POST /admin/orders/export",
    ]);
    assert.deepEqual(call(0).body, { email: "new@example.com" });
    assert.deepEqual(call(1).body, { amount: 500, reference: "refund", reference_id: "ref_1" });
    assert.equal(call(2).query.get("fields"), "id,title");
    assert.deepEqual(call(4).body, { payment_session_id: "payses_1" });
    assert.equal(call(5).query.get("status[]"), "pending");
    assert.equal(call(5).query.get("created_at[$gte]"), "2026-01-01");
  });

  test("new order actions validate before calling the store", async () => {
    assert.match((await orders.function({ action: "update", id: "order_1" })).error, /Nothing to update/);
    assert.match((await orders.function({ action: "add_credit_line", id: "order_1", amount: 1 })).error, /reference/);
    assert.match((await orders.function({ action: "authorize_payment_session", id: "order_1" })).error, /payment_session_id/);
    assert.equal(fetchCalls.length, 0);
  });

  test("standalone fulfillment module routes", async () => {
    const created = await orders.function({
      action: "create_standalone_fulfillment",
      location_id: "sloc_1",
      provider_id: "manual_manual",
      delivery_address: { address_1: "Calle 1" },
      items: [{ title: "Remera", sku: "R1", quantity: 1, barcode: "123" }],
      labels: [],
      order_id: "order_1",
    });
    assert.equal(created.success, true);
    await orders.function({ action: "cancel_standalone_fulfillment", fulfillment_id: "ful_1" });
    await orders.function({ action: "create_standalone_shipment", fulfillment_id: "ful_1", labels: [{ tracking_number: "T1", tracking_url: "https://t.example/1", label_url: "https://t.example/l" }] });
    assert.deepEqual(routes(), [
      "POST /admin/fulfillments",
      "POST /admin/fulfillments/ful_1/cancel",
      "POST /admin/fulfillments/ful_1/shipment",
    ]);
    assert.equal(call(0).body.data, null);
    assert.equal(call(0).body.metadata, null);
    const missing = await orders.function({ action: "create_standalone_fulfillment", order_id: "order_1" });
    assert.match(missing.error, /location_id/);
  });
});

describe("draft orders: added items and shipping methods", () => {
  test("edit_update_added_item and shipping method edit routes", async () => {
    await draftOrders.function({ action: "edit_update_added_item", id: "d1", action_id: "a1", quantity: 2, metadata: { x: 1 } });
    await draftOrders.function({ action: "edit_update_shipping_method", id: "d1", method_id: "sm_1", custom_amount: 0 });
    await draftOrders.function({ action: "edit_update_added_shipping_method", id: "d1", action_id: "a2", shipping_option_id: "so_1" });
    await draftOrders.function({ action: "edit_remove_added_shipping_method", id: "d1", action_id: "a2" });
    assert.deepEqual(routes(), [
      "POST /admin/draft-orders/d1/edit/items/a1",
      "POST /admin/draft-orders/d1/edit/shipping-methods/method/sm_1",
      "POST /admin/draft-orders/d1/edit/shipping-methods/a2",
      "DELETE /admin/draft-orders/d1/edit/shipping-methods/a2",
    ]);
    assert.deepEqual(call(0).body, { quantity: 2 }, "metadata is not accepted on added-item updates");
    assert.deepEqual(call(1).body, { custom_amount: 0 });
  });
});

describe("products tool: tags, types, batch, variants, import/export", () => {
  test("tags and types CRUD", async () => {
    await products.function({ action: "get_tag", id: "ptag_1" });
    await products.function({ action: "create_tag", value: "verano" });
    await products.function({ action: "update_tag", id: "ptag_1", value: "invierno" });
    await products.function({ action: "delete_tag", id: "ptag_1" });
    await products.function({ action: "get_type", id: "ptyp_1" });
    await products.function({ action: "create_type", value: "remera", metadata: { a: 1 } });
    await products.function({ action: "update_type", id: "ptyp_1", value: "buzo" });
    await products.function({ action: "delete_type", id: "ptyp_1" });
    assert.deepEqual(routes(), [
      "GET /admin/product-tags/ptag_1",
      "POST /admin/product-tags",
      "POST /admin/product-tags/ptag_1",
      "DELETE /admin/product-tags/ptag_1",
      "GET /admin/product-types/ptyp_1",
      "POST /admin/product-types",
      "POST /admin/product-types/ptyp_1",
      "DELETE /admin/product-types/ptyp_1",
    ]);
    assert.deepEqual(call(5).body, { value: "remera", metadata: { a: 1 } });
    await assert.rejects(() => products.function({ action: "create_tag" }), /value is required/);
  });

  test("batch, variant links and variant inventory items", async () => {
    await products.function({ action: "list_all_variants", sku: "R1", limit: 5 });
    await products.function({ action: "batch", update: [{ id: "prod_1", status: "published" }] });
    await products.function({ action: "batch_variants", id: "prod_1", delete: ["variant_9"] });
    await products.function({ action: "batch_variant_images", id: "prod_1", variant_id: "variant_1", add: ["img_1"] });
    await products.function({ action: "batch_image_variants", id: "prod_1", image_id: "img_1", remove: ["variant_1"] });
    await products.function({ action: "update_category_products", id: "pcat_1", add: ["prod_1"] });
    await products.function({ action: "link_variant_inventory_item", id: "prod_1", variant_id: "variant_1", inventory_item_id: "iitem_1", required_quantity: 2 });
    await products.function({ action: "update_variant_inventory_item", id: "prod_1", variant_id: "variant_1", inventory_item_id: "iitem_1", required_quantity: 3 });
    await products.function({ action: "unlink_variant_inventory_item", id: "prod_1", variant_id: "variant_1", inventory_item_id: "iitem_1" });
    await products.function({ action: "batch_variant_inventory_items", id: "prod_1", create: [{ variant_id: "variant_1", inventory_item_id: "iitem_2", required_quantity: 1 }] });
    assert.deepEqual(routes(), [
      "GET /admin/product-variants",
      "POST /admin/products/batch",
      "POST /admin/products/prod_1/variants/batch",
      "POST /admin/products/prod_1/variants/variant_1/images/batch",
      "POST /admin/products/prod_1/images/img_1/variants/batch",
      "POST /admin/product-categories/pcat_1/products",
      "POST /admin/products/prod_1/variants/variant_1/inventory-items",
      "POST /admin/products/prod_1/variants/variant_1/inventory-items/iitem_1",
      "DELETE /admin/products/prod_1/variants/variant_1/inventory-items/iitem_1",
      "POST /admin/products/prod_1/variants/inventory-items/batch",
    ]);
    assert.equal(call(0).query.get("sku"), "R1");
    assert.deepEqual(call(1).body, { update: [{ id: "prod_1", status: "published" }] });
    assert.deepEqual(call(3).body, { add: ["img_1"] });
    assert.deepEqual(call(6).body, { inventory_item_id: "iitem_1", required_quantity: 2 });
    await assert.rejects(() => products.function({ action: "batch" }), /create, update or delete/);
    await assert.rejects(() => products.function({ action: "update_category_products", id: "pcat_1" }), /add and\/or remove/);
  });

  test("export, multipart import_csv, create_import and both confirms", async () => {
    await products.function({ action: "export", status: "published", q: "remera" });
    await products.function({ action: "import_csv", file: { filename: "products.csv", content: "Product Handle\nremera\n" } });
    await products.function({ action: "create_import", file_key: "key_1", originalname: "p.csv", extension: "csv", size: 120, mime_type: "text/csv" });
    await products.function({ action: "confirm_csv_import", transaction_id: "tx_1" });
    await products.function({ action: "confirm_import", transaction_id: "tx_2" });
    assert.deepEqual(routes(), [
      "POST /admin/products/export",
      "POST /admin/products/import",
      "POST /admin/products/imports",
      "POST /admin/products/import/tx_1/confirm",
      "POST /admin/products/imports/tx_2/confirm",
    ]);
    assert.equal(call(0).query.get("status[]"), "published");
    const upload = call(1);
    assert.match(upload.headers["Content-Type"], /^multipart\/form-data; boundary=/);
    assert.equal(upload.headers.Authorization, "Basic sk_test");
    assert.match(upload.body, /name="file"; filename="products.csv"/);
    assert.match(upload.body, /Content-Type: text\/csv/);
    assert.match(upload.body, /Product Handle\nremera/);
    assert.deepEqual(call(2).body, { file_key: "key_1", originalname: "p.csv", extension: "csv", size: 120, mime_type: "text/csv" });
    await assert.rejects(() => products.function({ action: "create_import", file_key: "k" }), /originalname/);
    await assert.rejects(() => products.function({ action: "confirm_import" }), /transaction_id/);
  });
});

describe("pricing tool: price lists, promotion rules, campaigns, price preferences", () => {
  test("price list prices and products", async () => {
    await pricing.function({ action: "list_price_list_prices", id: "plist_1", limit: 50 });
    await pricing.function({ action: "batch_price_list_prices", id: "plist_1", create: [{ variant_id: "v1", currency_code: "ars", amount: 100 }] });
    await pricing.function({ action: "remove_price_list_products", id: "plist_1", remove: ["prod_1"] });
    assert.deepEqual(routes(), [
      "GET /admin/price-lists/plist_1/prices",
      "POST /admin/price-lists/plist_1/prices/batch",
      "POST /admin/price-lists/plist_1/products",
    ]);
    assert.deepEqual(call(2).body, { remove: ["prod_1"] });
  });

  test("promotion rules for every rule type and rule option lookups", async () => {
    await pricing.function({ action: "list_promotion_rules", promotion_id: "promo_1", rule_type: "rules" });
    await pricing.function({ action: "batch_promotion_rules", promotion_id: "promo_1", rule_type: "rules", delete: ["prule_1"] });
    await pricing.function({ action: "batch_promotion_rules", promotion_id: "promo_1", rule_type: "target-rules", create: [{ attribute: "product.id", operator: "in", values: ["prod_1"] }] });
    await pricing.function({ action: "batch_promotion_rules", promotion_id: "promo_1", rule_type: "buy_rules", update: [{ id: "prule_2", values: ["x"] }] });
    await pricing.function({ action: "list_rule_attribute_options", rule_type: "rules", promotion_type: "standard" });
    await pricing.function({ action: "list_rule_value_options", rule_type: "target-rules", rule_attribute_id: "product", q: "rem" });
    assert.deepEqual(routes(), [
      "GET /admin/promotions/promo_1/rules",
      "POST /admin/promotions/promo_1/rules/batch",
      "POST /admin/promotions/promo_1/target-rules/batch",
      "POST /admin/promotions/promo_1/buy-rules/batch",
      "GET /admin/promotions/rule-attribute-options/rules",
      "GET /admin/promotions/rule-value-options/target-rules/product",
    ]);
    assert.equal(call(4).query.get("promotion_type"), "standard");
    await assert.rejects(() => pricing.function({ action: "list_promotion_rules", promotion_id: "promo_1", rule_type: "bogus" }), /rule_type/);
  });

  test("campaign promotions and price preferences", async () => {
    await pricing.function({ action: "update_campaign_promotions", campaign_id: "camp_1", add: ["promo_1"] });
    await pricing.function({ action: "list_price_preferences", attribute: "currency_code" });
    await pricing.function({ action: "get_price_preference", price_preference_id: "prpref_1" });
    await pricing.function({ action: "create_price_preference", attribute: "currency_code", value: "ars", is_tax_inclusive: true });
    await pricing.function({ action: "update_price_preference", price_preference_id: "prpref_1", is_tax_inclusive: false });
    await pricing.function({ action: "delete_price_preference", price_preference_id: "prpref_1" });
    assert.deepEqual(routes(), [
      "POST /admin/campaigns/camp_1/promotions",
      "GET /admin/price-preferences",
      "GET /admin/price-preferences/prpref_1",
      "POST /admin/price-preferences",
      "POST /admin/price-preferences/prpref_1",
      "DELETE /admin/price-preferences/prpref_1",
    ]);
    assert.deepEqual(call(3).body, { attribute: "currency_code", value: "ars", is_tax_inclusive: true });
    assert.deepEqual(call(4).body, { is_tax_inclusive: false });
  });
});

describe("payments tool: refund reasons", () => {
  test("refund reason CRUD sends only label/code/description", async () => {
    await payments.function({ action: "get_refund_reason", refund_reason_id: "refr_1" });
    await payments.function({ action: "create_refund_reason", label: "Producto dañado", code: "damaged", metadata: { x: 1 } });
    await payments.function({ action: "update_refund_reason", refund_reason_id: "refr_1", description: "Llegó roto" });
    await payments.function({ action: "delete_refund_reason", refund_reason_id: "refr_1" });
    assert.deepEqual(routes(), [
      "GET /admin/refund-reasons/refr_1",
      "POST /admin/refund-reasons",
      "POST /admin/refund-reasons/refr_1",
      "DELETE /admin/refund-reasons/refr_1",
    ]);
    assert.deepEqual(call(1).body, { label: "Producto dañado", code: "damaged" });
    await assert.rejects(() => payments.function({ action: "create_refund_reason", label: "x" }), /label and code/);
  });
});

describe("regions tool: shipping option types, provider options, rules", () => {
  test("routes", async () => {
    await regions.function({ action: "list_shipping_option_types", limit: 10 });
    await regions.function({ action: "get_shipping_option_type", shipping_option_type_id: "sotype_1" });
    await regions.function({ action: "create_shipping_option_type", label: "Express", code: "express" });
    await regions.function({ action: "update_shipping_option_type", shipping_option_type_id: "sotype_1", description: "24 hs" });
    await regions.function({ action: "delete_shipping_option_type", shipping_option_type_id: "sotype_1" });
    await regions.function({ action: "list_fulfillment_provider_options", provider_id: "manual_manual" });
    await regions.function({ action: "batch_shipping_option_rules", shipping_option_id: "so_1", create: [{ attribute: "enabled_in_store", operator: "eq", value: "true" }] });
    assert.deepEqual(routes(), [
      "GET /admin/shipping-option-types",
      "GET /admin/shipping-option-types/sotype_1",
      "POST /admin/shipping-option-types",
      "POST /admin/shipping-option-types/sotype_1",
      "DELETE /admin/shipping-option-types/sotype_1",
      "GET /admin/fulfillment-providers/manual_manual/options",
      "POST /admin/shipping-options/so_1/rules/batch",
    ]);
    assert.deepEqual(call(2).body, { label: "Express", code: "express" });
  });
});

describe("inventory tool: location levels, reservation, stock location links", () => {
  test("routes", async () => {
    await inventory.function({ action: "create_level", inventory_item_id: "iitem_1", location_id: "sloc_1", stocked_quantity: 5 });
    await inventory.function({ action: "delete_level", inventory_item_id: "iitem_1", location_id: "sloc_1" });
    await inventory.function({ action: "batch_item_levels", inventory_item_id: "iitem_1", update: [{ location_id: "sloc_1", stocked_quantity: 3 }] });
    await inventory.function({ action: "batch_levels", create: [{ inventory_item_id: "iitem_1", location_id: "sloc_2" }], force: true });
    await inventory.function({ action: "get_reservation", reservation_id: "resitem_1" });
    await inventory.function({ action: "update_location_sales_channels", location_id: "sloc_1", add: ["sc_1"] });
    await inventory.function({ action: "update_location_fulfillment_providers", location_id: "sloc_1", remove: ["manual_manual"] });
    assert.deepEqual(routes(), [
      "POST /admin/inventory-items/iitem_1/location-levels",
      "DELETE /admin/inventory-items/iitem_1/location-levels/sloc_1",
      "POST /admin/inventory-items/iitem_1/location-levels/batch",
      "POST /admin/inventory-items/location-levels/batch",
      "GET /admin/reservations/resitem_1",
      "POST /admin/stock-locations/sloc_1/sales-channels",
      "POST /admin/stock-locations/sloc_1/fulfillment-providers",
    ]);
    assert.deepEqual(call(0).body, { location_id: "sloc_1", stocked_quantity: 5 });
    assert.deepEqual(call(3).body, { create: [{ inventory_item_id: "iitem_1", location_id: "sloc_2" }], force: true });
    assert.deepEqual(call(6).body, { remove: ["manual_manual"] });
  });
});

describe("taxes, users, collections, customers: link routes", () => {
  test("routes", async () => {
    await taxes.function({ action: "create_tax_rate_rule", id: "txr_1", reference: "product_type", reference_id: "ptyp_1" });
    await taxes.function({ action: "delete_tax_rate_rule", id: "txr_1", rule_id: "txrule_1" });
    await users.function({ action: "update_api_key_sales_channels", api_key_id: "apk_1", add: ["sc_1"] });
    await collections.function({ action: "update_products", id: "pcol_1", add: ["prod_1"], remove: ["prod_2"] });
    await customers.function({ action: "update_customer_groups", id: "cus_1", add: ["cusgroup_1"] });
    assert.deepEqual(routes(), [
      "POST /admin/tax-rates/txr_1/rules",
      "DELETE /admin/tax-rates/txr_1/rules/txrule_1",
      "POST /admin/api-keys/apk_1/sales-channels",
      "POST /admin/collections/pcol_1/products",
      "POST /admin/customers/cus_1/customer-groups",
    ]);
    assert.deepEqual(call(0).body, { reference: "product_type", reference_id: "ptyp_1" });
    assert.deepEqual(call(3).body, { add: ["prod_1"], remove: ["prod_2"] });
  });
});

describe("v2 tool: settings actions", () => {
  test("translations", async () => {
    await v2.function({ action: "batch_translations", create: [{ reference: "product", reference_id: "prod_1", locale_code: "en-US", translations: { title: "Shirt" } }] });
    await v2.function({ action: "list_translation_entities", type: "product" });
    await v2.function({ action: "list_translation_settings" });
    await v2.function({ action: "batch_translation_settings", update: [{ id: "trset_1", is_active: true }] });
    await v2.function({ action: "get_translation_statistics", locales: ["en-US"], entity_types: ["product"] });
    assert.deepEqual(routes(), [
      "POST /admin/translations/batch",
      "GET /admin/translations/entities",
      "GET /admin/translations/settings",
      "POST /admin/translations/settings/batch",
      "GET /admin/translations/statistics",
    ]);
    assert.equal(call(1).query.get("type"), "product");
    assert.equal(call(4).query.get("locales[]"), "en-US");
    assert.match((await v2.function({ action: "list_translation_entities" })).error, /type is required/);
    assert.match((await v2.function({ action: "batch_translations" })).error, /create, update or delete/);
  });

  test("a store without the feature flag gets a message naming it", async () => {
    respondWith({ status: 404, body: "<pre>Cannot POST /admin/translations/batch</pre>" });
    const result = await v2.function({ action: "batch_translations", delete: ["tr_1"] });
    assert.equal(result.unsupported, true);
    assert.equal(result.feature_flag, "translation");
    assert.match(result.error, /MEDUSA_FF_TRANSLATION/);
  });

  test("views, layouts and property labels", async () => {
    await v2.function({ action: "list_view_columns", view_entity: "orders" });
    await v2.function({ action: "list_view_configurations", view_entity: "orders" });
    await v2.function({ action: "create_view_configuration", view_entity: "orders", name: "Pendientes", configuration: { visible_columns: ["id"], column_order: ["id"] } });
    await v2.function({ action: "get_view_configuration", view_entity: "orders", id: "vc_1" });
    await v2.function({ action: "update_view_configuration", view_entity: "orders", id: "vc_1", name: "Otro" });
    await v2.function({ action: "delete_view_configuration", view_entity: "orders", id: "vc_1" });
    await v2.function({ action: "get_active_view_configuration", view_entity: "orders" });
    await v2.function({ action: "set_active_view_configuration", view_entity: "orders", view_configuration_id: "vc_2" });
    await v2.function({ action: "list_layout_configurations" });
    await v2.function({ action: "get_layout_configuration", zone: "order.details" });
    await v2.function({ action: "set_layout_configuration", zone: "order.details", configuration: { widgets: {} } });
    await v2.function({ action: "clear_layout_configuration", zone: "order.details" });
    await v2.function({ action: "create_property_label", entity: "order", property: "display_id", label: "Nro" });
    await v2.function({ action: "update_property_label", id: "plbl_1", label: "Número" });
    await v2.function({ action: "delete_property_label", id: "plbl_1" });
    await v2.function({ action: "batch_property_labels", delete: ["plbl_2"] });
    assert.deepEqual(routes(), [
      "GET /admin/views/orders/columns",
      "GET /admin/views/orders/configurations",
      "POST /admin/views/orders/configurations",
      "GET /admin/views/orders/configurations/vc_1",
      "POST /admin/views/orders/configurations/vc_1",
      "DELETE /admin/views/orders/configurations/vc_1",
      "GET /admin/views/orders/configurations/active",
      "POST /admin/views/orders/configurations/active",
      "GET /admin/layouts/configurations",
      "GET /admin/layouts/order.details/configuration",
      "POST /admin/layouts/order.details/configuration",
      "DELETE /admin/layouts/order.details/configuration",
      "POST /admin/property-labels",
      "POST /admin/property-labels/plbl_1",
      "DELETE /admin/property-labels/plbl_1",
      "POST /admin/property-labels/batch",
    ]);
    assert.deepEqual(call(2).body, { name: "Pendientes", configuration: { visible_columns: ["id"], column_order: ["id"] } });
    assert.deepEqual(call(7).body, { view_configuration_id: "vc_2" });
    assert.deepEqual(call(12).body, { entity: "order", property: "display_id", label: "Nro" });
    await assert.rejects(() => v2.function({ action: "list_view_columns" }), /view_entity is required/);
    assert.match((await v2.function({ action: "set_layout_configuration", zone: "z" })).error, /configuration is required/);
  });

  test("index sync, uploads, store update and workflow transaction", async () => {
    await v2.function({ action: "sync_index", sync_strategy: "full" });
    await v2.function({ action: "upload_files", files: [{ filename: "logo.png", content_base64: Buffer.from("PNGDATA").toString("base64"), mime_type: "image/png" }] });
    await v2.function({ action: "create_upload_presigned_url", originalname: "p.csv", mime_type: "text/csv", size: 10 });
    await v2.function({ action: "delete_upload", id: "file_1" });
    await v2.function({ action: "update_store", id: "store_1", name: "Mi tienda", default_region_id: "reg_1" });
    await v2.function({ action: "get_workflow_execution_transaction", workflow_id: "wf_1", transaction_id: "tx_1" });
    assert.deepEqual(routes(), [
      "POST /admin/index/sync",
      "POST /admin/uploads",
      "POST /admin/uploads/presigned-urls",
      "DELETE /admin/uploads/file_1",
      "POST /admin/stores/store_1",
      "GET /admin/workflows-executions/wf_1/tx_1",
    ]);
    assert.deepEqual(call(0).body, { strategy: "full" });
    assert.match(call(1).headers["Content-Type"], /^multipart\/form-data; boundary=/);
    assert.match(call(1).body, /name="files"; filename="logo.png"/);
    assert.match(call(1).body, /PNGDATA/);
    assert.deepEqual(call(4).body, { name: "Mi tienda", default_region_id: "reg_1" });
    assert.match((await v2.function({ action: "upload_files" })).error, /files is required/);
  });
});
