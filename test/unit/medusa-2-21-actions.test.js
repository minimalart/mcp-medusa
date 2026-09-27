import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { apiTool as draftOrders } from "../../tools/medusa-admin-api/medusa-admin-draft-orders.js";
import { apiTool as payments } from "../../tools/medusa-admin-api/medusa-admin-payments.js";
import { apiTool as regions } from "../../tools/medusa-admin-api/medusa-admin-regions.js";
import { apiTool as returns } from "../../tools/medusa-admin-api/medusa-admin-returns.js";
import { apiTool as orders } from "../../tools/medusa-admin-api/medusa-admin-orders.js";
import { apiTool as inventory } from "../../tools/medusa-admin-api/medusa-admin-inventory.js";
import { apiTool as pricing } from "../../tools/medusa-admin-api/medusa-admin-pricing.js";
import { apiTool as users } from "../../tools/medusa-admin-api/medusa-admin-users.js";
import { apiTool as giftCards } from "../../tools/medusa-admin-api/medusa-admin-gift-cards.js";

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

/** Queue responses for the next fetch calls (default: 200 { ok: true }). */
function respondWith(...queue) {
  responses.push(...queue);
}

const ROUTE_MISSING = (method, path) => ({
  status: 404,
  body: `<!DOCTYPE html><html><body><pre>Cannot ${method} ${path}</pre></body></html>`,
});
const UNRECOGNIZED = (field) => ({
  status: 400,
  body: { type: "invalid_data", message: `Invalid request: Unrecognized fields: '${field}'` },
});

function call(index = 0) {
  const entry = fetchCalls[index];
  assert.ok(entry, `expected fetch call #${index}`);
  const url = new URL(entry.url);
  return {
    method: entry.options.method || "GET",
    path: url.pathname,
    query: url.searchParams,
    body: entry.options.body === undefined ? undefined : JSON.parse(entry.options.body),
  };
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

describe("draft orders (edit flow)", () => {
  test("convert_to_order uses POST /convert-to-order", async () => {
    const result = await draftOrders.function({ action: "convert_to_order", id: "order_draft" });
    assert.equal(result.success, true);
    assert.equal(fetchCalls.length, 1);
    assert.equal(call().method, "POST");
    assert.equal(call().path, "/admin/draft-orders/order_draft/convert-to-order");
  });

  test("add_line_item opens an edit, adds items and confirms", async () => {
    const result = await draftOrders.function({ action: "add_line_item", id: "d1", variant_id: "variant_1", quantity: 2 });
    assert.equal(result.success, true);
    assert.deepEqual(
      fetchCalls.map((_, index) => `${call(index).method} ${call(index).path}`),
      [
        "POST /admin/draft-orders/d1/edit",
        "POST /admin/draft-orders/d1/edit/items",
        "POST /admin/draft-orders/d1/edit/confirm",
      ],
    );
    assert.deepEqual(call(1).body, { items: [{ variant_id: "variant_1", quantity: 2 }] });
  });

  test("add_line_item cancels the edit when adding fails", async () => {
    respondWith({ status: 200, body: {} }, { status: 400, body: { message: "Variant not found" } });
    const result = await draftOrders.function({ action: "add_line_item", id: "d1", variant_id: "bad", quantity: 1 });
    assert.match(result.error, /Variant not found/);
    assert.match(result.error, /edit was canceled/);
    assert.equal(call(2).method, "DELETE");
    assert.equal(call(2).path, "/admin/draft-orders/d1/edit");
    assert.equal(fetchCalls.length, 3);
  });

  test("remove_line_item sets quantity 0 on the existing item", async () => {
    await draftOrders.function({ action: "remove_line_item", id: "d1", line_id: "ordli_1" });
    assert.equal(call(1).method, "POST");
    assert.equal(call(1).path, "/admin/draft-orders/d1/edit/items/item/ordli_1");
    assert.deepEqual(call(1).body, { quantity: 0 });
    assert.equal(call(2).path, "/admin/draft-orders/d1/edit/confirm");
  });

  test("update_line_item without quantity keeps the current quantity", async () => {
    respondWith({ status: 200, body: { draft_order: { id: "d1", items: [{ id: "ordli_1", quantity: 3 }] } } });
    await draftOrders.function({ action: "update_line_item", id: "d1", line_id: "ordli_1", metadata: { gift: true } });
    assert.equal(call(0).method, "GET");
    assert.equal(call(0).path, "/admin/draft-orders/d1");
    assert.equal(call(2).path, "/admin/draft-orders/d1/edit/items/item/ordli_1");
    assert.deepEqual(call(2).body, { quantity: 3, metadata: { gift: true } });
  });

  test("create sends only known fields and maps discounts to promo_codes", async () => {
    await draftOrders.function({
      action: "create",
      region_id: "reg_1",
      email: "a@b.co",
      discounts: ["SAVE10"],
      limit: 10,
    });
    assert.equal(call().path, "/admin/draft-orders");
    assert.deepEqual(call().body, { region_id: "reg_1", email: "a@b.co", promo_codes: ["SAVE10"] });
  });

  test("granular edit actions hit the edit sub-routes", async () => {
    await draftOrders.function({ action: "begin_edit", id: "d1" });
    await draftOrders.function({ action: "edit_remove_promotions", id: "d1", promo_codes: ["X"] });
    await draftOrders.function({ action: "edit_remove_added_item", id: "d1", action_id: "ordchact_1" });
    await draftOrders.function({ action: "edit_add_shipping_method", id: "d1", shipping_option_id: "so_1" });
    await draftOrders.function({ action: "request_edit", id: "d1" });
    await draftOrders.function({ action: "confirm_edit", id: "d1" });
    await draftOrders.function({ action: "cancel_edit", id: "d1" });
    assert.deepEqual(
      fetchCalls.map((_, index) => `${call(index).method} ${call(index).path}`),
      [
        "POST /admin/draft-orders/d1/edit",
        "DELETE /admin/draft-orders/d1/edit/promotions",
        "DELETE /admin/draft-orders/d1/edit/items/ordchact_1",
        "POST /admin/draft-orders/d1/edit/shipping-methods",
        "POST /admin/draft-orders/d1/edit/request",
        "POST /admin/draft-orders/d1/edit/confirm",
        "DELETE /admin/draft-orders/d1/edit",
      ],
    );
    assert.deepEqual(call(1).body, { promo_codes: ["X"] });
  });
});

describe("payments", () => {
  test("capture and refund reject amount <= 0 before sending", async () => {
    await assert.rejects(() => payments.function({ action: "capture_payment", payment_id: "pay_1", amount: 0 }), /greater than 0/);
    await assert.rejects(() => payments.function({ action: "refund_payment", payment_id: "pay_1", amount: -5 }), /greater than 0/);
    assert.equal(fetchCalls.length, 0);
  });

  test("capture without amount captures the full authorized amount", async () => {
    await payments.function({ action: "capture_payment", payment_id: "pay_1" });
    assert.equal(call().method, "POST");
    assert.equal(call().path, "/admin/payments/pay_1/capture");
    assert.deepEqual(call().body, {});
  });

  test("refund sends refund_reason_id/note (never the v1 `reason` field)", async () => {
    await payments.function({ action: "refund_payment", payment_id: "pay_1", amount: 500, reason: "damaged", note: "ok" });
    assert.equal(call(0).path, "/admin/payments/pay_1/refund");
    assert.deepEqual(call(0).body, { amount: 500, note: "ok | Reason: damaged" });

    await payments.function({ action: "refund_payment", payment_id: "pay_1", amount: 5, reason: "refr_123" });
    assert.deepEqual(call(1).body, { amount: 5, refund_reason_id: "refr_123" });
  });

  test("payment collections are read from the order", async () => {
    respondWith({ status: 200, body: { order: { id: "order_1", payment_collections: [{ id: "pay_col_1" }] } } });
    const result = await payments.function({ action: "list_payment_collections", order_id: "order_1" });
    assert.equal(call().method, "GET");
    assert.equal(call().path, "/admin/orders/order_1");
    assert.match(call().query.get("fields"), /\*payment_collections/);
    assert.deepEqual(result.payment_collections, [{ id: "pay_col_1" }]);

    await assert.rejects(() => payments.function({ action: "list_payment_collections" }), /order_id is required/);
  });

  test("mark_payment_collection_as_paid, create collection and payment session use real routes", async () => {
    await payments.function({ action: "mark_payment_collection_as_paid", id: "pay_col_1", order_id: "order_1" });
    await payments.function({ action: "create_payment_collection", order_id: "order_1", amount: 1000 });
    await payments.function({ action: "create_payment_session", id: "pay_col_1", provider_id: "pp_system_default" });
    await payments.function({ action: "list_payment_providers", is_enabled: true });
    await payments.function({ action: "list_refund_reasons" });
    assert.deepEqual(
      fetchCalls.map((_, index) => `${call(index).method} ${call(index).path}`),
      [
        "POST /admin/payment-collections/pay_col_1/mark-as-paid",
        "POST /admin/payment-collections",
        "POST /admin/payment-collections/pay_col_1/payment-sessions",
        "GET /admin/payments/payment-providers",
        "GET /admin/refund-reasons",
      ],
    );
    assert.deepEqual(call(0).body, { order_id: "order_1" });
    assert.deepEqual(call(1).body, { order_id: "order_1", amount: 1000 });
  });

  test("list_refunds reads refunds from the payment", async () => {
    respondWith({ status: 200, body: { payment: { id: "pay_1", refunds: [{ id: "ref_1" }] } } });
    const result = await payments.function({ action: "list_refunds", payment_id: "pay_1" });
    assert.equal(call().path, "/admin/payments/pay_1");
    assert.match(call().query.get("fields"), /\*refunds/);
    assert.deepEqual(result.refunds, [{ id: "ref_1" }]);
  });

  test("removed actions explain the alternative without calling the store", async () => {
    const cancel = await payments.function({ action: "cancel_payment", payment_id: "pay_1" });
    const update = await payments.function({ action: "update_payment_collection", id: "pay_col_1" });
    assert.equal(cancel.removed, true);
    assert.match(cancel.error, /no POST \/admin\/payments\/\{id\}\/cancel/);
    assert.equal(update.removed, true);
    assert.equal(fetchCalls.length, 0);
  });
});

describe("regions (fulfillment sets & service zones)", () => {
  test("create_fulfillment_set posts to the stock location", async () => {
    await regions.function({ action: "create_fulfillment_set", location_id: "sloc_1", name: "Envíos", type: "shipping", metadata: { a: 1 } });
    assert.equal(call().method, "POST");
    assert.equal(call().path, "/admin/stock-locations/sloc_1/fulfillment-sets");
    assert.deepEqual(call().body, { name: "Envíos", type: "shipping" });
  });

  test("list_fulfillment_sets reads them from stock locations", async () => {
    respondWith({
      status: 200,
      body: { stock_locations: [{ id: "sloc_1", name: "Depósito", fulfillment_sets: [{ id: "fuset_1" }] }], count: 1 },
    });
    const result = await regions.function({ action: "list_fulfillment_sets" });
    assert.equal(call().path, "/admin/stock-locations");
    assert.match(call().query.get("fields"), /\*fulfillment_sets/);
    assert.deepEqual(result.fulfillment_sets, [{ id: "fuset_1", location_id: "sloc_1", location_name: "Depósito" }]);
  });

  test("service zone and delete actions use /admin/fulfillment-sets/{id} routes", async () => {
    await regions.function({ action: "create_service_zone", fulfillment_set_id: "fuset_1", name: "AR", geo_zones: [{ type: "country", country_code: "ar" }] });
    await regions.function({ action: "update_service_zone", fulfillment_set_id: "fuset_1", service_zone_id: "serzo_1", name: "AR-BA" });
    await regions.function({ action: "delete_service_zone", fulfillment_set_id: "fuset_1", service_zone_id: "serzo_1" });
    await regions.function({ action: "delete_fulfillment_set", fulfillment_set_id: "fuset_1" });
    assert.deepEqual(
      fetchCalls.map((_, index) => `${call(index).method} ${call(index).path}`),
      [
        "POST /admin/fulfillment-sets/fuset_1/service-zones",
        "POST /admin/fulfillment-sets/fuset_1/service-zones/serzo_1",
        "DELETE /admin/fulfillment-sets/fuset_1/service-zones/serzo_1",
        "DELETE /admin/fulfillment-sets/fuset_1",
      ],
    );
  });

  test("update_fulfillment_set is removed", async () => {
    const result = await regions.function({ action: "update_fulfillment_set", fulfillment_set_id: "fuset_1" });
    assert.equal(result.removed, true);
    assert.equal(fetchCalls.length, 0);
  });
});

describe("returns (order edits, claims, receive)", () => {
  test("order edit lifecycle uses /admin/order-edits addressed by order_id", async () => {
    await returns.function({ action: "create_order_edit", order_id: "order_1", internal_note: "fix" });
    await returns.function({ action: "order_edit_add_items", order_id: "order_1", items: [{ variant_id: "variant_1", quantity: 1 }] });
    await returns.function({ action: "order_edit_update_item", order_id: "order_1", item_id: "ordli_1", quantity: 0 });
    await returns.function({ action: "order_edit_add_shipping_method", order_id: "order_1", shipping_option_id: "so_1" });
    await returns.function({ action: "request_order_edit", order_id: "order_1" });
    await returns.function({ action: "complete_order_edit", order_id: "order_1" });
    await returns.function({ action: "delete_order_edit", order_id: "order_1" });
    assert.deepEqual(
      fetchCalls.map((_, index) => `${call(index).method} ${call(index).path}`),
      [
        "POST /admin/order-edits",
        "POST /admin/order-edits/order_1/items",
        "POST /admin/order-edits/order_1/items/item/ordli_1",
        "POST /admin/order-edits/order_1/shipping-method",
        "POST /admin/order-edits/order_1/request",
        "POST /admin/order-edits/order_1/confirm",
        "DELETE /admin/order-edits/order_1",
      ],
    );
    assert.deepEqual(call(0).body, { order_id: "order_1", internal_note: "fix" });
    assert.deepEqual(call(2).body, { quantity: 0 });
    assert.deepEqual(call(4).body, {});
  });

  test("request_order_edit only sends no_notification when provided (2.19+)", async () => {
    await returns.function({ action: "request_order_edit", order_id: "order_1", no_notification: true });
    assert.deepEqual(call().body, { no_notification: true });
  });

  test("list_order_edits reads order changes of type edit", async () => {
    await returns.function({ action: "list_order_edits", order_id: "order_1" });
    assert.equal(call().path, "/admin/orders/order_1/changes");
    assert.equal(call().query.get("change_type"), "edit");
  });

  test("order edit actions require an order id", async () => {
    await assert.rejects(() => returns.function({ action: "confirm_order_edit", order_edit_id: "ordch_1" }), /order_id is required/);
    assert.equal(fetchCalls.length, 0);
  });

  test("update_claim and update_order_edit are removed", async () => {
    assert.equal((await returns.function({ action: "update_claim", claim_id: "claim_1" })).removed, true);
    assert.equal((await returns.function({ action: "update_order_edit", order_id: "order_1" })).removed, true);
    assert.equal(fetchCalls.length, 0);
  });

  test("receive_return with items runs receive → receive-items → confirm", async () => {
    await returns.function({ action: "receive_return", id: "ret_1", items: [{ id: "retitem_1", quantity: 1 }] });
    assert.deepEqual(
      fetchCalls.map((_, index) => `${call(index).method} ${call(index).path}`),
      [
        "POST /admin/returns/ret_1/receive",
        "POST /admin/returns/ret_1/receive-items",
        "POST /admin/returns/ret_1/receive/confirm",
      ],
    );
    assert.deepEqual(call(0).body, {});
    assert.deepEqual(call(1).body, { items: [{ id: "retitem_1", quantity: 1 }] });
  });

  test("receive_return without items keeps the previous single call", async () => {
    await returns.function({ action: "receive_return", id: "ret_1" });
    assert.equal(fetchCalls.length, 1);
    assert.equal(call().path, "/admin/returns/ret_1/receive");
  });
});

describe("orders (transfers & fulfillments)", () => {
  test("transfer_to_guest posts to /transfer/guest", async () => {
    const result = await orders.function({ action: "transfer_to_guest", id: "order_1", email: "guest@example.com" });
    assert.equal(result.success, true);
    assert.equal(call().method, "POST");
    assert.equal(call().path, "/admin/orders/order_1/transfer/guest");
    assert.deepEqual(call().body, { email: "guest@example.com" });
  });

  test("transfer_to_guest reports the minimum version when the route is missing", async () => {
    respondWith(ROUTE_MISSING("POST", "/admin/orders/order_1/transfer/guest"));
    const result = await orders.function({ action: "transfer_to_guest", id: "order_1", email: "guest@example.com" });
    assert.equal(result.unsupported, true);
    assert.equal(result.error, "Esta acción requiere Medusa >= 2.18 (la tienda devolvió 404).");
  });

  test("create_fulfillment sends items and optional fields only when provided", async () => {
    await orders.function({
      action: "create_fulfillment",
      id: "order_1",
      items: [{ id: "ordli_1", quantity: 1 }],
      location_id: "sloc_1",
      no_notification: true,
    });
    assert.equal(call().path, "/admin/orders/order_1/fulfillments");
    assert.deepEqual(call().body, { items: [{ id: "ordli_1", quantity: 1 }], location_id: "sloc_1", no_notification: true });
  });

  test("create_fulfillment with delivery_address on an old store explains the version", async () => {
    respondWith(UNRECOGNIZED("delivery_address"));
    const result = await orders.function({
      action: "create_fulfillment",
      id: "order_1",
      items: [{ id: "ordli_1", quantity: 1 }],
      delivery_address: { city: "CABA" },
    });
    assert.equal(result.unsupported, true);
    assert.match(result.error, /`delivery_address` requiere Medusa >= 2\.19 \(la tienda devolvió 400\)/);
  });

  test("shipment, delivery and transfer cancel routes", async () => {
    await orders.function({ action: "create_shipment", id: "order_1", fulfillment_id: "ful_1", items: [{ id: "ordli_1", quantity: 1 }], labels: [{ tracking_number: "1", tracking_url: "https://t.example/1", label_url: "https://l.example/1" }] });
    await orders.function({ action: "mark_as_delivered", id: "order_1", fulfillment_id: "ful_1" });
    await orders.function({ action: "cancel_transfer", id: "order_1" });
    await orders.function({ action: "cancel_fulfillment", id: "order_1", fulfillment_id: "ful_1" });
    assert.deepEqual(
      fetchCalls.map((_, index) => `${call(index).method} ${call(index).path}`),
      [
        "POST /admin/orders/order_1/fulfillments/ful_1/shipments",
        "POST /admin/orders/order_1/fulfillments/ful_1/mark-as-delivered",
        "POST /admin/orders/order_1/transfer/cancel",
        "POST /admin/orders/order_1/fulfillments/ful_1/cancel",
      ],
    );
    assert.equal(call(3).body, undefined);
  });

  test("create_fulfillment validates items", async () => {
    const result = await orders.function({ action: "create_fulfillment", id: "order_1", items: [] });
    assert.match(result.error, /items is required/);
    assert.equal(fetchCalls.length, 0);
  });
});

describe("inventory (unit_of_measure, export)", () => {
  test("create_item omits unit_of_measure unless provided", async () => {
    await inventory.function({ action: "create_item", sku: "SKU-1" });
    assert.deepEqual(call(0).body, { sku: "SKU-1" });

    await inventory.function({ action: "update_item", id: "iitem_1", unit_of_measure: "kg", title: "Harina" });
    assert.equal(call(1).path, "/admin/inventory-items/iitem_1");
    assert.deepEqual(call(1).body, { title: "Harina", unit_of_measure: "kg" });
  });

  test("unit_of_measure rejected by an old store returns a version message", async () => {
    respondWith(UNRECOGNIZED("unit_of_measure"));
    const result = await inventory.function({ action: "create_item", sku: "SKU-1", unit_of_measure: "kg" });
    assert.equal(result.unsupported, true);
    assert.match(result.error, /requiere Medusa >= 2\.20/);
  });

  test("export_items posts to /inventory-items/export and gates on 2.19", async () => {
    respondWith({ status: 202, body: { transaction_id: "tx_1" } });
    const ok = await inventory.function({ action: "export_items", sku: "SKU-1" });
    assert.equal(call().method, "POST");
    assert.equal(call().path, "/admin/inventory-items/export");
    assert.equal(call().query.get("sku"), "SKU-1");
    assert.deepEqual(ok, { transaction_id: "tx_1" });

    respondWith(ROUTE_MISSING("POST", "/admin/inventory-items/export"));
    const old = await inventory.function({ action: "export_items" });
    assert.equal(old.error, "Esta acción requiere Medusa >= 2.19 (la tienda devolvió 404).");
  });
});

describe("pricing (promotion metadata)", () => {
  test("promotion metadata is only sent when provided and gated on 2.21", async () => {
    await pricing.function({ action: "update_promotion", promotion_id: "promo_1", code: "X" });
    assert.deepEqual(call(0).body, { code: "X" });

    await pricing.function({ action: "update_promotion", promotion_id: "promo_1", metadata: { source: "mcp" } });
    assert.deepEqual(call(1).body, { metadata: { source: "mcp" } });

    respondWith(UNRECOGNIZED("metadata"));
    const result = await pricing.function({ action: "update_promotion", promotion_id: "promo_1", metadata: { source: "mcp" } });
    assert.match(result.error, /`metadata` requiere Medusa >= 2\.21/);
  });
});

describe("users & gift cards", () => {
  test("create_user is removed in favor of invites", async () => {
    const result = await users.function({ action: "create_user", email: "a@b.co" });
    assert.equal(result.removed, true);
    assert.match(result.error, /create_invite/);
    assert.equal(fetchCalls.length, 0);
  });

  test("list_auth_providers uses GET /admin/users/{id}/auth-providers and gates on 2.20", async () => {
    await users.function({ action: "list_auth_providers", id: "user_1" });
    assert.equal(call().method, "GET");
    assert.equal(call().path, "/admin/users/user_1/auth-providers");

    respondWith(ROUTE_MISSING("GET", "/admin/users/user_1/auth-providers"));
    const result = await users.function({ action: "list_auth_providers", id: "user_1" });
    assert.equal(result.error, "Esta acción requiere Medusa >= 2.20 (la tienda devolvió 404).");
  });

  test("update_user never sends role", async () => {
    await assert.rejects(() => users.function({ action: "update_user", id: "user_1", role: "admin" }), /Roles cannot be changed/);
    await users.function({ action: "update_user", id: "user_1", first_name: "Ana" });
    assert.deepEqual(call().body, { first_name: "Ana" });
  });

  test("gift card delete is removed and list_orders is available", async () => {
    const removed = await giftCards.function({ action: "delete", id: "gc_1" });
    assert.equal(removed.removed, true);
    await giftCards.function({ action: "list_orders", id: "gc_1" });
    assert.equal(fetchCalls.length, 1);
    assert.equal(call().path, "/admin/gift-cards/gc_1/orders");
  });
});

describe("MFA errors", () => {
  test("thrown 401 MFA errors carry an actionable hint", async () => {
    respondWith({ status: 401, body: { message: "MFA verification is required to complete this request" } });
    await assert.rejects(
      () => payments.function({ action: "get_payment", payment_id: "pay_1" }),
      (error) => {
        assert.match(error.message, /MFA verification is required/);
        assert.match(error.message, /MEDUSA_AUTH_TYPE=api-key/);
        return true;
      },
    );
  });

  test("returned MFA errors get a hint property", async () => {
    respondWith({ status: 401, body: { message: "MFA verification is required to complete this request" } });
    const result = await orders.function({ action: "get", id: "order_1" });
    assert.match(result.error, /MFA verification is required/);
    assert.match(result.hint, /Medusa >= 2\.20/);
  });
});
