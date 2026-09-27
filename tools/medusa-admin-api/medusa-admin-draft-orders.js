/**
 * Comprehensive Medusa Admin Draft Order Management Tool
 * Supports CRUD operations and cart-like functionality for draft orders using optimized fetch approach.
 *
 * Medusa v2 (2.17 → 2.21.1) no expone rutas `/line-items` para draft orders: los
 * ítems, promociones y métodos de envío se cambian a través de una "edición"
 * (order change) que se abre, se modifica y se confirma:
 *
 *   POST   /admin/draft-orders/{id}/edit                         abrir edición
 *   POST   /admin/draft-orders/{id}/edit/items                   agregar ítems
 *   POST   /admin/draft-orders/{id}/edit/items/item/{item_id}    cambiar ítem existente (quantity 0 = quitar)
 *   DELETE /admin/draft-orders/{id}/edit/items/{action_id}       quitar un ítem agregado en esta edición
 *   POST|DELETE /admin/draft-orders/{id}/edit/promotions         agregar/quitar promo_codes
 *   POST   /admin/draft-orders/{id}/edit/shipping-methods        agregar método de envío
 *   DELETE /admin/draft-orders/{id}/edit/shipping-methods/method/{method_id}  quitar método de envío existente
 *   POST   /admin/draft-orders/{id}/edit/request                 marcar la edición como solicitada
 *   POST   /admin/draft-orders/{id}/edit/confirm                 aplicar la edición
 *   DELETE /admin/draft-orders/{id}/edit                         descartar la edición
 *
 * Todas estas rutas existen desde Medusa 2.17.2 (incluida 2.18.0).
 */

import { appendQueryParam, createHeaders, hasMedusaCredentials, makeRequest, missingCredentialsMessage, normalizeBaseUrl } from "../../lib/medusa-client.js";
import { withMedusaErrorHints } from "../../lib/medusa-version.js";

function getDraftOrderConfig() {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY || process.env.MEDUSA_JWT || process.env.MEDUSA_SESSION_COOKIE || process.env.MEDUSA_COOKIE;

  if (!baseUrl || !apiKey || !hasMedusaCredentials()) {
    return { error: missingCredentialsMessage() };
  }

  return { baseUrl, apiKey };
}

/**
 * Low-level request against /admin/draft-orders/{id}{suffix}. Throws on HTTP errors.
 */
async function draftOrderCall(config, id, suffix, { method = 'POST', body, query } = {}) {
  const url = new URL(`${config.baseUrl}/admin/draft-orders/${encodeURIComponent(id)}${suffix}`);
  Object.entries(query || {}).forEach(([key, value]) => appendQueryParam(url.searchParams, key, value));

  const request = { method, headers: createHeaders(config.apiKey) };
  if (body !== undefined) request.body = JSON.stringify(body);
  return await makeRequest(url.toString(), request);
}

function pickDefined(source, keys) {
  const out = {};
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

const CREATE_FIELDS = [
  'status', 'sales_channel_id', 'email', 'customer_id', 'billing_address', 'shipping_address', 'items',
  'region_id', 'promo_codes', 'currency_code', 'no_notification_order', 'shipping_methods', 'locale', 'metadata',
  'additional_data'
];

/**
 * Function to create a new draft order.
 *
 * @param {Object} args - Arguments for creating a draft order.
 * @param {string} args.region_id - Region ID (required by Medusa).
 * @param {string} [args.email] - Customer email (email or customer_id required on Medusa <= 2.18).
 * @param {string} [args.customer_id] - Customer ID.
 * @param {Array} [args.items] - Array of line items.
 * @param {Array<string>} [args.promo_codes] - Promotion codes. `discounts` is accepted as a deprecated alias.
 * @returns {Promise<Object>} - The result of the draft order creation.
 */
const createDraftOrder = async (args) => {
  const config = getDraftOrderConfig();
  if (config.error) return config;

  try {
    const url = `${config.baseUrl}/admin/draft-orders`;

    // Medusa valida el body con .strict(): sólo mandamos campos conocidos.
    // `discounts` (API v1) se traduce a `promo_codes`.
    const draftOrderData = pickDefined(args, CREATE_FIELDS);
    if (draftOrderData.promo_codes === undefined && Array.isArray(args.discounts)) {
      draftOrderData.promo_codes = args.discounts;
    }

    const data = await makeRequest(url, {
      method: 'POST',
      headers: createHeaders(config.apiKey),
      body: JSON.stringify(draftOrderData)
    });

    return { success: true, draft_order: data };
  } catch (error) {
    console.error('Error creating draft order:', error);
    return { error: `An error occurred while creating the draft order: ${error.message}` };
  }
};

/**
 * Function to list draft orders with filtering and pagination.
 *
 * @param {Object} args - Arguments for listing draft orders.
 * @param {number} [args.limit=20] - Maximum number of draft orders to return.
 * @param {number} [args.offset=0] - Number of draft orders to skip.
 * @param {string} [args.q] - Query string for search.
 * @returns {Promise<Object>} - The result of the draft orders listing.
 */
const listDraftOrders = async (args = {}) => {
  const config = getDraftOrderConfig();
  if (config.error) return config;

  try {
    const url = new URL(`${config.baseUrl}/admin/draft-orders`);

    // Add query parameters
    Object.entries(args).forEach(([key, value]) => {
      appendQueryParam(url.searchParams, key, value);
    });

    const data = await makeRequest(url.toString(), {
      method: 'GET',
      headers: createHeaders(config.apiKey)
    });

    return data;
  } catch (error) {
    console.error('Error listing draft orders:', error);
    return { error: `An error occurred while listing draft orders: ${error.message}` };
  }
};

/**
 * Function to get a specific draft order by ID.
 *
 * @param {Object} args - Arguments for retrieving a draft order.
 * @param {string} args.id - Draft order ID (required).
 * @returns {Promise<Object>} - The result of the draft order retrieval.
 */
const getDraftOrder = async (args) => {
  const config = getDraftOrderConfig();
  if (config.error) return config;

  if (!args.id) {
    return { error: 'Draft order ID is required.' };
  }

  try {
    const url = new URL(`${config.baseUrl}/admin/draft-orders/${args.id}`);
    if (args.fields) appendQueryParam(url.searchParams, 'fields', args.fields);

    const data = await makeRequest(url.toString(), {
      method: 'GET',
      headers: createHeaders(config.apiKey)
    });

    return data;
  } catch (error) {
    console.error('Error retrieving draft order:', error);
    return { error: `An error occurred while retrieving the draft order: ${error.message}` };
  }
};

/**
 * Function to update draft order header data (email, customer, addresses, metadata).
 * POST /admin/draft-orders/{id}
 */
const updateDraftOrder = async (args) => {
  const config = getDraftOrderConfig();
  if (config.error) return config;

  if (!args.id) {
    return { error: 'Draft order ID is required.' };
  }

  const updateData = pickDefined(args, [
    'email', 'customer_id', 'sales_channel_id', 'shipping_address', 'billing_address', 'metadata', 'locale'
  ]);
  if (Object.keys(updateData).length === 0) {
    return { error: 'Nothing to update. Pass at least one of: email, customer_id, sales_channel_id, shipping_address, billing_address, metadata, locale. Items/promotions/shipping methods are changed through the edit actions.' };
  }

  try {
    const data = await draftOrderCall(config, args.id, '', { method: 'POST', body: updateData });
    return { success: true, message: 'Draft order updated successfully', draft_order: data };
  } catch (error) {
    console.error('Error updating draft order:', error);
    return { error: `An error occurred while updating the draft order: ${error.message}` };
  }
};

/**
 * Function to delete a draft order.
 *
 * @param {Object} args - Arguments for deleting a draft order.
 * @param {string} args.id - Draft order ID (required).
 * @returns {Promise<Object>} - The result of the draft order deletion.
 */
const deleteDraftOrder = async (args) => {
  const config = getDraftOrderConfig();
  if (config.error) return config;

  if (!args.id) {
    return { error: 'Draft order ID is required.' };
  }

  try {
    const url = `${config.baseUrl}/admin/draft-orders/${args.id}`;

    const data = await makeRequest(url, {
      method: 'DELETE',
      headers: createHeaders(config.apiKey)
    });

    return { success: true, message: 'Draft order deleted successfully', draft_order: data };
  } catch (error) {
    console.error('Error deleting draft order:', error);
    return { error: `An error occurred while deleting the draft order: ${error.message}` };
  }
};

/**
 * Function to convert a draft order to a regular order.
 * POST /admin/draft-orders/{id}/convert-to-order
 *
 * @param {Object} args - Arguments for converting a draft order.
 * @param {string} args.id - Draft order ID (required).
 * @returns {Promise<Object>} - The result of the draft order conversion.
 */
const convertDraftOrderToOrder = async (args) => {
  const config = getDraftOrderConfig();
  if (config.error) return config;

  if (!args.id) {
    return { error: 'Draft order ID is required.' };
  }

  try {
    const data = await draftOrderCall(config, args.id, '/convert-to-order', {
      method: 'POST',
      query: args.fields ? { fields: args.fields } : undefined
    });

    return { success: true, message: 'Draft order converted to order successfully', order: data };
  } catch (error) {
    console.error('Error converting draft order:', error);
    return { error: `An error occurred while converting the draft order: ${error.message}` };
  }
};

// ---------------------------------------------------------------------------
// Edit flow (granular actions)
// ---------------------------------------------------------------------------

function itemIdFrom(args) {
  return args.item_id || args.line_id;
}

function buildAddItems(args) {
  if (Array.isArray(args.items) && args.items.length > 0) return args.items;
  if (args.variant_id || args.title) {
    return [{
      ...pickDefined(args, ['variant_id', 'title', 'quantity', 'unit_price', 'compare_at_unit_price', 'internal_note', 'allow_backorder', 'metadata'])
    }];
  }
  return null;
}

function buildItemUpdate(args) {
  return pickDefined(args, ['quantity', 'unit_price', 'compare_at_unit_price', 'internal_note', 'metadata']);
}

const EDIT_STEPS = {
  begin_edit: {
    label: 'opening the draft order edit',
    build: () => ({ suffix: '/edit', method: 'POST' })
  },
  edit_add_items: {
    label: 'adding items to the draft order edit',
    build: (args) => {
      const items = buildAddItems(args);
      if (!items) return { error: 'items (array) or variant_id/title + quantity are required.' };
      if (items.some((item) => item.quantity === undefined)) return { error: 'Every item needs a quantity.' };
      return { suffix: '/edit/items', method: 'POST', body: { items } };
    }
  },
  edit_update_item: {
    label: 'updating an item in the draft order edit',
    build: (args) => {
      const itemId = itemIdFrom(args);
      if (!itemId) return { error: 'line_id (or item_id) is required.' };
      if (args.quantity === undefined) return { error: 'quantity is required (Medusa requires it on item updates; use 0 to remove the item).' };
      return { suffix: `/edit/items/item/${encodeURIComponent(itemId)}`, method: 'POST', body: buildItemUpdate(args) };
    }
  },
  edit_remove_item: {
    label: 'removing an item in the draft order edit',
    build: (args) => {
      const itemId = itemIdFrom(args);
      if (!itemId) return { error: 'line_id (or item_id) is required.' };
      return { suffix: `/edit/items/item/${encodeURIComponent(itemId)}`, method: 'POST', body: { quantity: 0 } };
    }
  },
  edit_remove_added_item: {
    label: 'removing an item added in the current draft order edit',
    build: (args) => {
      if (!args.action_id) return { error: 'action_id is required (the ITEM_ADD action id returned in the edit preview).' };
      return { suffix: `/edit/items/${encodeURIComponent(args.action_id)}`, method: 'DELETE' };
    }
  },
  edit_add_promotions: {
    label: 'adding promotions to the draft order edit',
    build: (args) => {
      if (!Array.isArray(args.promo_codes) || args.promo_codes.length === 0) return { error: 'promo_codes (array) is required.' };
      return { suffix: '/edit/promotions', method: 'POST', body: { promo_codes: args.promo_codes } };
    }
  },
  edit_remove_promotions: {
    label: 'removing promotions from the draft order edit',
    build: (args) => {
      if (!Array.isArray(args.promo_codes) || args.promo_codes.length === 0) return { error: 'promo_codes (array) is required.' };
      return { suffix: '/edit/promotions', method: 'DELETE', body: { promo_codes: args.promo_codes } };
    }
  },
  edit_add_shipping_method: {
    label: 'adding a shipping method to the draft order edit',
    build: (args) => {
      if (!args.shipping_option_id) return { error: 'shipping_option_id is required.' };
      return {
        suffix: '/edit/shipping-methods',
        method: 'POST',
        body: pickDefined(args, ['shipping_option_id', 'custom_amount', 'description', 'internal_note', 'metadata'])
      };
    }
  },
  edit_remove_shipping_method: {
    label: 'removing a shipping method from the draft order edit',
    build: (args) => {
      if (!args.method_id) return { error: 'method_id (existing shipping method id) is required.' };
      return { suffix: `/edit/shipping-methods/method/${encodeURIComponent(args.method_id)}`, method: 'DELETE' };
    }
  },
  request_edit: {
    label: 'requesting the draft order edit',
    build: () => ({ suffix: '/edit/request', method: 'POST' })
  },
  confirm_edit: {
    label: 'confirming the draft order edit',
    build: () => ({ suffix: '/edit/confirm', method: 'POST' })
  },
  cancel_edit: {
    label: 'canceling the draft order edit',
    build: () => ({ suffix: '/edit', method: 'DELETE' })
  }
};

const runEditStep = async (action, args) => {
  const config = getDraftOrderConfig();
  if (config.error) return config;

  if (!args.id) {
    return { error: 'Draft order ID is required.' };
  }

  const step = EDIT_STEPS[action];
  const request = step.build(args);
  if (request.error) return { error: request.error };

  try {
    const data = await draftOrderCall(config, args.id, request.suffix, request);
    return { success: true, action, ...data };
  } catch (error) {
    console.error(`Error ${step.label}:`, error);
    return { error: `An error occurred while ${step.label}: ${error.message}` };
  }
};

/**
 * One-shot edit used by the legacy line item actions: open edit → apply
 * change → confirm. If the change fails, the edit is canceled so the draft
 * order is not left with a dangling order change.
 */
const runOneShotEdit = async (config, args, label, applyChange) => {
  try {
    await draftOrderCall(config, args.id, '/edit', { method: 'POST' });
  } catch (error) {
    console.error('Error opening draft order edit:', error);
    return {
      error: `Could not open an edit on draft order ${args.id}: ${error.message}. If an edit is already open, ` +
        'use edit_add_items / edit_update_item / edit_remove_item and then confirm_edit, or discard it with cancel_edit.'
    };
  }

  try {
    await applyChange();
  } catch (error) {
    console.error(`Error ${label}:`, error);
    let rollback = 'the edit was canceled, nothing changed';
    try {
      await draftOrderCall(config, args.id, '/edit', { method: 'DELETE' });
    } catch (cancelError) {
      rollback = `the edit could not be canceled (${cancelError.message}); run cancel_edit`;
    }
    return { error: `An error occurred while ${label}: ${error.message} (${rollback}).` };
  }

  try {
    return await draftOrderCall(config, args.id, '/edit/confirm', { method: 'POST' });
  } catch (error) {
    console.error('Error confirming draft order edit:', error);
    return {
      error: `The change was staged but confirming the edit failed: ${error.message}. The edit is still open: ` +
        'retry with confirm_edit or discard it with cancel_edit.'
    };
  }
};

/**
 * Function to add a line item to a draft order (one-shot edit).
 *
 * @param {Object} args - Arguments for adding a line item.
 * @param {string} args.id - Draft order ID (required).
 * @param {string} args.variant_id - Product variant ID (required unless `title` is given for a custom item).
 * @param {number} args.quantity - Quantity (required).
 * @param {Object} [args.metadata] - Item metadata.
 * @returns {Promise<Object>} - The result of adding the line item.
 */
const addLineItem = async (args) => {
  const config = getDraftOrderConfig();
  if (config.error) return config;

  if (!args.id) {
    return { error: 'Draft order ID is required.' };
  }

  if (!args.variant_id && !args.title) {
    return { error: 'Product variant ID is required.' };
  }

  if (!args.quantity) {
    return { error: 'Quantity is required.' };
  }

  const items = buildAddItems(args);
  const result = await runOneShotEdit(config, args, 'adding the line item', () =>
    draftOrderCall(config, args.id, '/edit/items', { method: 'POST', body: { items } })
  );
  if (result.error) return result;
  return { success: true, message: 'Line item added successfully', draft_order: result };
};

async function currentItemQuantity(config, draftOrderId, itemId) {
  const data = await draftOrderCall(config, draftOrderId, '', {
    method: 'GET',
    query: { fields: 'id,items.id,items.quantity' }
  });
  const item = (data?.draft_order?.items || []).find((entry) => entry.id === itemId);
  return item ? item.quantity : undefined;
}

/**
 * Function to update a line item in a draft order (one-shot edit).
 *
 * @param {Object} args - Arguments for updating a line item.
 * @param {string} args.id - Draft order ID (required).
 * @param {string} args.line_id - Line item ID (required).
 * @param {number} [args.quantity] - New quantity (if omitted, the current quantity is kept).
 * @param {Object} [args.metadata] - Item metadata.
 * @returns {Promise<Object>} - The result of updating the line item.
 */
const updateLineItem = async (args) => {
  const config = getDraftOrderConfig();
  if (config.error) return config;

  if (!args.id) {
    return { error: 'Draft order ID is required.' };
  }

  const itemId = itemIdFrom(args);
  if (!itemId) {
    return { error: 'Line item ID is required.' };
  }

  const updateData = buildItemUpdate(args);
  if (Object.keys(updateData).length === 0) {
    return { error: 'Nothing to update. Pass quantity, unit_price, compare_at_unit_price, internal_note or metadata.' };
  }

  // Medusa exige `quantity` en la actualización: si no vino, conservamos la actual.
  if (updateData.quantity === undefined) {
    try {
      const quantity = await currentItemQuantity(config, args.id, itemId);
      if (quantity === undefined) {
        return { error: `Line item ${itemId} was not found in draft order ${args.id}.` };
      }
      updateData.quantity = quantity;
    } catch (error) {
      console.error('Error reading draft order item:', error);
      return { error: `An error occurred while reading the current item quantity: ${error.message}` };
    }
  }

  const result = await runOneShotEdit(config, args, 'updating the line item', () =>
    draftOrderCall(config, args.id, `/edit/items/item/${encodeURIComponent(itemId)}`, { method: 'POST', body: updateData })
  );
  if (result.error) return result;
  return { success: true, message: 'Line item updated successfully', draft_order: result };
};

/**
 * Function to remove a line item from a draft order (one-shot edit: sets quantity to 0).
 *
 * @param {Object} args - Arguments for removing a line item.
 * @param {string} args.id - Draft order ID (required).
 * @param {string} args.line_id - Line item ID (required).
 * @returns {Promise<Object>} - The result of removing the line item.
 */
const removeLineItem = async (args) => {
  const config = getDraftOrderConfig();
  if (config.error) return config;

  if (!args.id) {
    return { error: 'Draft order ID is required.' };
  }

  const itemId = itemIdFrom(args);
  if (!itemId) {
    return { error: 'Line item ID is required.' };
  }

  const result = await runOneShotEdit(config, args, 'removing the line item', () =>
    draftOrderCall(config, args.id, `/edit/items/item/${encodeURIComponent(itemId)}`, { method: 'POST', body: { quantity: 0 } })
  );
  if (result.error) return result;
  return { success: true, message: 'Line item removed successfully', draft_order: result };
};

const ACTIONS = [
  'create', 'list', 'get', 'update', 'delete', 'convert_to_order',
  'add_line_item', 'update_line_item', 'remove_line_item',
  ...Object.keys(EDIT_STEPS)
];

/**
 * Master function that routes to appropriate draft order operation based on action.
 *
 * @param {Object} args - Arguments for the draft order operation.
 * @param {string} args.action - The action to perform.
 * @returns {Promise<Object>} - The result of the draft order operation.
 */
const executeFunction = async (args) => {
  const { action, ...operationArgs } = args;

  switch (action) {
    case 'create':
      return await createDraftOrder(operationArgs);
    case 'list':
      return await listDraftOrders(operationArgs);
    case 'get':
      return await getDraftOrder(operationArgs);
    case 'update':
      return await updateDraftOrder(operationArgs);
    case 'delete':
      return await deleteDraftOrder(operationArgs);
    case 'convert_to_order':
      return await convertDraftOrderToOrder(operationArgs);
    case 'add_line_item':
      return await addLineItem(operationArgs);
    case 'update_line_item':
      return await updateLineItem(operationArgs);
    case 'remove_line_item':
      return await removeLineItem(operationArgs);
    default:
      if (EDIT_STEPS[action]) {
        return await runEditStep(action, operationArgs);
      }
      return { error: `Invalid action: ${action}. Valid actions are: ${ACTIONS.join(', ')}` };
  }
};

const itemSchema = {
  type: 'object',
  properties: {
    variant_id: { type: 'string', description: 'Product variant ID.' },
    title: { type: 'string', description: 'Title for a custom item without variant (edit_add_items).' },
    quantity: { type: 'number', description: 'Quantity.' },
    unit_price: { type: 'number', description: 'Custom unit price (optional).' },
    compare_at_unit_price: { type: 'number', description: 'Compare-at unit price (optional, edit actions).' },
    internal_note: { type: 'string', description: 'Internal note (optional, edit actions).' },
    allow_backorder: { type: 'boolean', description: 'Allow backorder for this item (optional, edit actions).' },
    metadata: { type: 'object', description: 'Item metadata.' }
  }
};

/**
 * Tool configuration for comprehensive Medusa Admin draft order management.
 * @type {Object}
 */
const apiTool = {
  definition: {
    name: 'manage_medusa_admin_draft_orders',
    description:
      'Medusa Admin draft orders (Medusa 2.17.2+, incl. 2.18 and 2.21.1). Basic: create (region_id + email or customer_id; optional items, promo_codes, addresses, shipping_methods), list, get, update (email/customer/addresses/metadata), delete, convert_to_order (POST /convert-to-order: turns the draft into a real order; order notifications/subscribers may fire). ' +
      'Items, promotions and shipping methods change through an EDIT: begin_edit → edit_add_items / edit_update_item / edit_remove_item / edit_remove_added_item / edit_add_promotions / edit_remove_promotions / edit_add_shipping_method / edit_remove_shipping_method → confirm_edit (applies) or cancel_edit (discards); request_edit marks it as requested. ' +
      'Shortcuts add_line_item, update_line_item and remove_line_item run a full edit in one call (open → change → confirm; the edit is canceled if the change fails) and fail if another edit is already open.',
    parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ACTIONS,
            description: 'The action to perform on draft orders.'
          },
          // Common parameters
          id: {
            type: 'string',
            description: 'Draft order ID (required for every action except create and list).'
          },
          // Creation / update parameters
          status: {
            type: 'string',
            description: 'Draft order status on create (Medusa only accepts "completed").'
          },
          email: {
            type: 'string',
            description: 'Customer email (create/update). On create, email or customer_id is required.'
          },
          customer_id: {
            type: 'string',
            description: 'Customer ID (create/update).'
          },
          region_id: {
            type: 'string',
            description: 'Region ID (required for create).'
          },
          sales_channel_id: {
            type: 'string',
            description: 'Sales channel ID (create/update).'
          },
          currency_code: {
            type: 'string',
            description: 'Currency code (create).'
          },
          locale: {
            type: 'string',
            description: 'Locale (create/update).'
          },
          items: {
            type: 'array',
            description: 'Line items for create or edit_add_items: [{ variant_id (or title for custom items), quantity, unit_price?, metadata? }].',
            items: itemSchema
          },
          shipping_address: {
            type: 'object',
            description: 'Shipping address object (create/update).'
          },
          billing_address: {
            type: 'object',
            description: 'Billing address object (create/update).'
          },
          shipping_methods: {
            type: 'array',
            description: 'Shipping methods on create: [{ shipping_option_id, name, amount, data? }].',
            items: { type: 'object' }
          },
          promo_codes: {
            type: 'array',
            description: 'Promotion codes (create, edit_add_promotions, edit_remove_promotions).',
            items: { type: 'string' }
          },
          discounts: {
            type: 'array',
            description: 'Deprecated alias of promo_codes (create).',
            items: { type: 'string' }
          },
          no_notification_order: {
            type: 'boolean',
            description: 'Create: do not notify the customer about the resulting order.'
          },
          metadata: {
            type: 'object',
            description: 'Draft order metadata (create/update) or item metadata (line item/edit actions).'
          },
          fields: {
            type: 'string',
            description: 'Fields selector for get/list/convert_to_order.'
          },
          // List parameters
          limit: {
            type: 'number',
            description: 'Maximum number of draft orders to return (default: 50).'
          },
          offset: {
            type: 'number',
            description: 'Number of draft orders to skip (default: 0).'
          },
          q: {
            type: 'string',
            description: 'Query string for search.'
          },
          // Line item / edit parameters
          variant_id: {
            type: 'string',
            description: 'Product variant ID (add_line_item / edit_add_items shortcut).'
          },
          title: {
            type: 'string',
            description: 'Custom item title when adding an item without variant.'
          },
          quantity: {
            type: 'number',
            description: 'Quantity (add_line_item, update_line_item, edit_add_items, edit_update_item). 0 removes an existing item.'
          },
          unit_price: {
            type: 'number',
            description: 'Custom unit price for added/updated items.'
          },
          compare_at_unit_price: {
            type: 'number',
            description: 'Compare-at unit price for edited items.'
          },
          internal_note: {
            type: 'string',
            description: 'Internal note for edited items or shipping methods.'
          },
          allow_backorder: {
            type: 'boolean',
            description: 'Allow backorder for added items.'
          },
          line_id: {
            type: 'string',
            description: 'Existing draft order line item ID (update_line_item, remove_line_item, edit_update_item, edit_remove_item).'
          },
          item_id: {
            type: 'string',
            description: 'Alias of line_id.'
          },
          action_id: {
            type: 'string',
            description: 'Order change action ID of an item added in the current edit (edit_remove_added_item).'
          },
          shipping_option_id: {
            type: 'string',
            description: 'Shipping option ID (edit_add_shipping_method).'
          },
          custom_amount: {
            type: 'number',
            description: 'Custom shipping amount (edit_add_shipping_method).'
          },
          description: {
            type: 'string',
            description: 'Shipping method description (edit_add_shipping_method).'
          },
          method_id: {
            type: 'string',
            description: 'Existing shipping method ID (edit_remove_shipping_method).'
          }
        },
        required: ['action']
      }
  },
  function: withMedusaErrorHints(executeFunction)
};

export { apiTool };
