/**
 * Comprehensive Medusa Admin Returns & Exchanges Management Tool
 * Supports returns, exchanges, claims, and order edits
 *
 * Order edits en Medusa v2 son "order changes" que se identifican por la ORDEN
 * (las rutas /admin/order-edits/{id} reciben el ID de la orden). Todas estas
 * rutas existen desde 2.17.2 (incluida 2.18.0):
 *   POST   /admin/order-edits                                   abrir edición { order_id, ... }
 *   POST   /admin/order-edits/{order_id}/items                  agregar ítems
 *   POST   /admin/order-edits/{order_id}/items/item/{item_id}   cambiar cantidad de un ítem existente
 *   POST|DELETE /admin/order-edits/{order_id}/items/{action_id} editar/quitar ítem agregado en la edición
 *   POST   /admin/order-edits/{order_id}/shipping-method        agregar método de envío
 *   POST|DELETE /admin/order-edits/{order_id}/shipping-method/{action_id}
 *   POST   /admin/order-edits/{order_id}/request                pedir confirmación (no_notification: 2.19+)
 *   POST   /admin/order-edits/{order_id}/confirm                aplicar
 *   DELETE /admin/order-edits/{order_id}                        cancelar la edición activa
 * No existen GET /admin/order-edits, GET|POST /admin/order-edits/{id},
 * /complete ni /cancel: los cambios se listan con GET /admin/orders/{id}/changes.
 */

import { appendQueryParam, createHeaders, hasMedusaCredentials, makeRequest, missingCredentialsMessage, normalizeBaseUrl } from "../../lib/medusa-client.js";
import { withMedusaErrorHints } from "../../lib/medusa-version.js";

const REMOVED_ACTIONS = {
  update_claim:
    'update_claim was removed: Medusa v2 has no POST /admin/claims/{id} route. Claims are edited through their order change: ' +
    'POST /admin/claims/{id}/claim-items, /inbound/items, /outbound/items, /inbound/shipping-method, /outbound/shipping-method, ' +
    'then POST /admin/claims/{id}/request (or DELETE to discard). Use manage_medusa_admin_v2 action=request for those routes.',
  update_order_edit:
    'update_order_edit was removed: Medusa v2 has no route to update an order edit. Use the order edit item/shipping actions ' +
    '(order_edit_add_items, order_edit_update_item, ...) on the active edit, or cancel_order_edit and create_order_edit again.'
};

async function handleReturnsOperation(args) {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY || process.env.MEDUSA_JWT || process.env.MEDUSA_SESSION_COOKIE || process.env.MEDUSA_COOKIE;

  if (REMOVED_ACTIONS[args.action]) {
    return { error: REMOVED_ACTIONS[args.action], removed: true };
  }

  if (!apiKey || !hasMedusaCredentials()) {
    throw new Error(missingCredentialsMessage());
  }

  const headers = createHeaders(apiKey);

  switch (args.action) {
    case 'list_returns':
      return await listReturns(baseUrl, headers, args);
    case 'get_return':
      return await getReturn(baseUrl, headers, args);
    case 'cancel_return':
      return await cancelReturn(baseUrl, headers, args);
    case 'receive_return':
      return await receiveReturn(baseUrl, headers, args);
    case 'list_exchanges':
      return await listExchanges(baseUrl, headers, args);
    case 'get_exchange':
      return await getExchange(baseUrl, headers, args);
    case 'cancel_exchange':
      return await cancelExchange(baseUrl, headers, args);
    case 'list_claims':
      return await listClaims(baseUrl, headers, args);
    case 'get_claim':
      return await getClaim(baseUrl, headers, args);
    case 'cancel_claim':
      return await cancelClaim(baseUrl, headers, args);
    case 'list_order_edits':
      return await listOrderEdits(baseUrl, headers, args);
    case 'get_order_edit':
      return await getOrderEdit(baseUrl, headers, args);
    case 'create_order_edit':
      return await createOrderEdit(baseUrl, headers, args);
    case 'order_edit_add_items':
    case 'order_edit_update_item':
    case 'order_edit_update_added_item':
    case 'order_edit_remove_added_item':
    case 'order_edit_add_shipping_method':
    case 'order_edit_update_shipping_method':
    case 'order_edit_remove_shipping_method':
      return await orderEditChange(baseUrl, headers, args);
    case 'request_order_edit':
      return await requestOrderEdit(baseUrl, headers, args);
    case 'confirm_order_edit':
    case 'complete_order_edit':
      return await confirmOrderEdit(baseUrl, headers, args);
    case 'cancel_order_edit':
    case 'delete_order_edit':
      return await cancelOrderEdit(baseUrl, headers, args);
    default:
      throw new Error(`Unknown action: ${args.action}`);
  }
}

// Returns operations
async function listReturns(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());
  if (args.order_id) params.append('order_id', args.order_id);

  const url = `${baseUrl}/admin/returns?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getReturn(baseUrl, headers, args) {
  if (!args.id) throw new Error('Return ID is required');
  const url = `${baseUrl}/admin/returns/${args.id}`;
  return await makeRequest(url, { headers });
}

async function cancelReturn(baseUrl, headers, args) {
  if (!args.id) throw new Error('Return ID is required');
  const url = `${baseUrl}/admin/returns/${args.id}/cancel`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });
}

/**
 * Medusa v2 recibe una devolución en tres pasos:
 *   POST /admin/returns/{id}/receive          abre la recepción { internal_note?, description?, metadata? }
 *   POST /admin/returns/{id}/receive-items    { items: [{ id, quantity, internal_note? }] }
 *   POST /admin/returns/{id}/receive/confirm  aplica (repone stock) { no_notification? }
 * Sin `items` se mantiene el comportamiento anterior (sólo abre la recepción).
 */
async function receiveReturn(baseUrl, headers, args) {
  if (!args.id) throw new Error('Return ID is required');
  if (args.refund !== undefined) {
    throw new Error('refund is not a Medusa v2 field for receiving returns. Receive the items here and refund with manage_medusa_admin_payments action=refund_payment.');
  }

  const receiveData = {};
  if (args.internal_note) receiveData.internal_note = args.internal_note;
  if (args.description) receiveData.description = args.description;
  if (args.metadata) receiveData.metadata = args.metadata;

  const url = `${baseUrl}/admin/returns/${args.id}/receive`;
  const started = await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(receiveData)
  });

  if (!Array.isArray(args.items) || args.items.length === 0) {
    return started;
  }

  try {
    await makeRequest(`${baseUrl}/admin/returns/${args.id}/receive-items`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ items: args.items })
    });
  } catch (error) {
    try {
      await makeRequest(`${baseUrl}/admin/returns/${args.id}/receive`, { method: 'DELETE', headers });
    } catch {
      // best effort: dejamos el error original
    }
    throw error;
  }

  const confirmData = {};
  if (args.no_notification !== undefined) confirmData.no_notification = args.no_notification;
  return await makeRequest(`${baseUrl}/admin/returns/${args.id}/receive/confirm`, {
    method: 'POST',
    headers,
    body: JSON.stringify(confirmData)
  });
}

// Exchanges operations
async function listExchanges(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());
  if (args.order_id) params.append('order_id', args.order_id);

  const url = `${baseUrl}/admin/exchanges?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getExchange(baseUrl, headers, args) {
  if (!args.exchange_id) throw new Error('Exchange ID is required');
  const url = `${baseUrl}/admin/exchanges/${args.exchange_id}`;
  return await makeRequest(url, { headers });
}

async function cancelExchange(baseUrl, headers, args) {
  if (!args.exchange_id) throw new Error('Exchange ID is required');
  const url = `${baseUrl}/admin/exchanges/${args.exchange_id}/cancel`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });
}

// Claims operations
async function listClaims(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());
  if (args.order_id) params.append('order_id', args.order_id);

  const url = `${baseUrl}/admin/claims?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getClaim(baseUrl, headers, args) {
  if (!args.claim_id) throw new Error('Claim ID is required');
  const url = `${baseUrl}/admin/claims/${args.claim_id}`;
  return await makeRequest(url, { headers });
}

async function cancelClaim(baseUrl, headers, args) {
  if (!args.claim_id) throw new Error('Claim ID is required');
  const url = `${baseUrl}/admin/claims/${args.claim_id}/cancel`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });
}

// Order Edits operations (identified by order_id in Medusa v2)
function orderEditOrderId(args) {
  if (args.order_id) return args.order_id;
  // Compatibilidad: algunos callers pasaban el ID de la orden en order_edit_id.
  if (typeof args.order_edit_id === 'string' && args.order_edit_id.startsWith('order_')) {
    return args.order_edit_id;
  }
  throw new Error('order_id is required: Medusa v2 order edits are addressed by the order ID (/admin/order-edits/{order_id}).');
}

function pickDefined(source, keys) {
  const out = {};
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

async function listOrderEdits(baseUrl, headers, args) {
  const orderId = orderEditOrderId(args);
  const url = new URL(`${baseUrl}/admin/orders/${encodeURIComponent(orderId)}/changes`);
  appendQueryParam(url.searchParams, 'change_type', 'edit');
  appendQueryParam(url.searchParams, 'status', args.status);
  appendQueryParam(url.searchParams, 'fields', args.fields);
  return await makeRequest(url.toString(), { headers });
}

async function getOrderEdit(baseUrl, headers, args) {
  const orderId = orderEditOrderId(args);
  const url = new URL(`${baseUrl}/admin/orders/${encodeURIComponent(orderId)}/preview`);
  appendQueryParam(url.searchParams, 'fields', args.fields);
  return await makeRequest(url.toString(), { headers });
}

async function createOrderEdit(baseUrl, headers, args) {
  const orderId = orderEditOrderId(args);
  const body = { order_id: orderId, ...pickDefined(args, ['description', 'internal_note', 'metadata']) };
  return await makeRequest(`${baseUrl}/admin/order-edits`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
}

function orderEditChangeRequest(args) {
  const itemFields = ['quantity', 'unit_price', 'compare_at_unit_price', 'internal_note'];
  switch (args.action) {
    case 'order_edit_add_items': {
      const items = Array.isArray(args.items) && args.items.length > 0
        ? args.items
        : (args.variant_id ? [pickDefined(args, ['variant_id', 'quantity', 'unit_price', 'compare_at_unit_price', 'internal_note', 'allow_backorder', 'metadata'])] : null);
      if (!items) throw new Error('items (array of { variant_id, quantity }) or variant_id + quantity are required');
      return { suffix: '/items', method: 'POST', body: { items } };
    }
    case 'order_edit_update_item': {
      if (!args.item_id) throw new Error('item_id (existing order line item ID) is required');
      if (args.quantity === undefined) throw new Error('quantity is required (0 removes the item)');
      return {
        suffix: `/items/item/${encodeURIComponent(args.item_id)}`,
        method: 'POST',
        body: pickDefined(args, [...itemFields, 'metadata'])
      };
    }
    case 'order_edit_update_added_item':
      if (!args.action_id) throw new Error('action_id is required');
      return { suffix: `/items/${encodeURIComponent(args.action_id)}`, method: 'POST', body: pickDefined(args, itemFields) };
    case 'order_edit_remove_added_item':
      if (!args.action_id) throw new Error('action_id is required');
      return { suffix: `/items/${encodeURIComponent(args.action_id)}`, method: 'DELETE' };
    case 'order_edit_add_shipping_method':
      if (!args.shipping_option_id) throw new Error('shipping_option_id is required');
      return {
        suffix: '/shipping-method',
        method: 'POST',
        body: pickDefined(args, ['shipping_option_id', 'custom_amount', 'description', 'internal_note', 'metadata'])
      };
    case 'order_edit_update_shipping_method':
      if (!args.action_id) throw new Error('action_id is required');
      return {
        suffix: `/shipping-method/${encodeURIComponent(args.action_id)}`,
        method: 'POST',
        body: pickDefined(args, ['custom_amount', 'internal_note', 'metadata'])
      };
    case 'order_edit_remove_shipping_method':
      if (!args.action_id) throw new Error('action_id is required');
      return { suffix: `/shipping-method/${encodeURIComponent(args.action_id)}`, method: 'DELETE' };
    default:
      throw new Error(`Unknown order edit action: ${args.action}`);
  }
}

async function orderEditChange(baseUrl, headers, args) {
  const orderId = orderEditOrderId(args);
  const change = orderEditChangeRequest(args);
  const request = { method: change.method, headers };
  if (change.body !== undefined) request.body = JSON.stringify(change.body);
  return await makeRequest(`${baseUrl}/admin/order-edits/${encodeURIComponent(orderId)}${change.suffix}`, request);
}

async function requestOrderEdit(baseUrl, headers, args) {
  const orderId = orderEditOrderId(args);
  // no_notification sólo se envía si el caller lo pasa (Medusa 2.19+; en 2.18 la ruta no valida body y lo ignora).
  const body = {};
  if (args.no_notification !== undefined) body.no_notification = args.no_notification;
  return await makeRequest(`${baseUrl}/admin/order-edits/${encodeURIComponent(orderId)}/request`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
}

async function confirmOrderEdit(baseUrl, headers, args) {
  const orderId = orderEditOrderId(args);
  return await makeRequest(`${baseUrl}/admin/order-edits/${encodeURIComponent(orderId)}/confirm`, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });
}

async function cancelOrderEdit(baseUrl, headers, args) {
  const orderId = orderEditOrderId(args);
  return await makeRequest(`${baseUrl}/admin/order-edits/${encodeURIComponent(orderId)}`, {
    method: 'DELETE',
    headers
  });
}

const ACTIONS = [
  'list_returns', 'get_return', 'cancel_return', 'receive_return',
  'list_exchanges', 'get_exchange', 'cancel_exchange',
  'list_claims', 'get_claim', 'cancel_claim',
  'list_order_edits', 'get_order_edit', 'create_order_edit',
  'order_edit_add_items', 'order_edit_update_item', 'order_edit_update_added_item', 'order_edit_remove_added_item',
  'order_edit_add_shipping_method', 'order_edit_update_shipping_method', 'order_edit_remove_shipping_method',
  'request_order_edit', 'confirm_order_edit', 'complete_order_edit', 'cancel_order_edit', 'delete_order_edit'
];

export const apiTool = {
  definition: {
    name: 'manage_medusa_admin_returns',
    description:
      'Medusa Admin returns, exchanges, claims and order edits (Medusa 2.17.2+, incl. 2.18 and 2.21.1). ' +
      'receive_return: without items only opens the receipt (previous behavior); with items [{id, quantity}] it opens, receives and confirms in one call (restocks inventory; customer may be notified unless no_notification). ' +
      'Order edits are addressed by order_id: create_order_edit → order_edit_add_items / order_edit_update_item (quantity 0 removes) / order_edit_*_added_item / order_edit_*_shipping_method → request_order_edit (asks the customer to confirm and may email them; no_notification needs Medusa >= 2.19, ignored on 2.18) → confirm_order_edit (alias complete_order_edit, applies the changes) or cancel_order_edit (alias delete_order_edit). ' +
      'list_order_edits returns the order changes of type edit; get_order_edit returns the order preview with pending changes. ' +
      'Removed (no such routes in Medusa v2): update_claim, update_order_edit.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ACTIONS,
          description: 'The action to perform.'
        },
        id: { type: 'string', description: 'Return ID.' },
        exchange_id: { type: 'string', description: 'Exchange ID.' },
        claim_id: { type: 'string', description: 'Claim ID.' },
        order_id: { type: 'string', description: 'Order ID. Filter for list_returns/list_exchanges/list_claims; required for every order edit action.' },
        order_edit_id: { type: 'string', description: 'Deprecated: order edits are addressed by order_id in Medusa v2 (an order_... ID passed here is accepted).' },
        item_id: { type: 'string', description: 'Existing order line item ID (order_edit_update_item).' },
        action_id: { type: 'string', description: 'Order change action ID of an item or shipping method added in the active edit.' },
        variant_id: { type: 'string', description: 'Variant ID for order_edit_add_items (single item shortcut).' },
        quantity: { type: 'number', description: 'Quantity for order edit item actions.' },
        unit_price: { type: 'number', description: 'Custom unit price for order edit item actions.' },
        compare_at_unit_price: { type: 'number', description: 'Compare-at unit price for order edit item actions.' },
        allow_backorder: { type: 'boolean', description: 'Allow backorder for added items.' },
        shipping_option_id: { type: 'string', description: 'Shipping option ID (order_edit_add_shipping_method).' },
        custom_amount: { type: 'number', description: 'Custom shipping amount for order edit shipping actions.' },
        description: { type: 'string', description: 'Description (create_order_edit, receive_return, shipping method).' },
        status: { type: 'string', description: 'Order change status filter for list_order_edits (pending, requested, confirmed, declined, canceled).' },
        fields: { type: 'string', description: 'Fields selector for list_order_edits/get_order_edit.' },
        limit: { type: 'number', description: 'Maximum number of items to return.' },
        offset: { type: 'number', description: 'Number of items to skip.' },
        items: { type: 'array', items: { type: 'object' }, description: 'receive_return: [{ id: return item id, quantity }]. order_edit_add_items: [{ variant_id, quantity, unit_price? }].' },
        refund: { type: 'number', description: 'Deprecated/unsupported: refunds are made with manage_medusa_admin_payments refund_payment.' },
        no_notification: { type: 'boolean', description: 'Skip customer notifications (receive_return confirm; request_order_edit on Medusa >= 2.19).' },
        internal_note: { type: 'string', description: 'Internal note (create_order_edit, receive_return, item/shipping edits).' },
        metadata: { type: 'object', description: 'Additional metadata.' }
      },
      required: ['action']
    }
  },
  function: withMedusaErrorHints(handleReturnsOperation)
};
