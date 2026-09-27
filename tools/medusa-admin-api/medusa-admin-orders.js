/**
 * Comprehensive Medusa Admin Order Management Tool
 * Supports CRUD operations and special actions for orders using optimized fetch approach
 */

import { appendQueryParam, createHeaders, hasMedusaCredentials, makeRequest, missingCredentialsMessage, normalizeBaseUrl } from "../../lib/medusa-client.js";
import { sentGatedFields, withGatedFields, withMedusaErrorHints, withMinVersion } from "../../lib/medusa-version.js";

/**
 * Function to list orders with filtering and pagination.
 *
 * @param {Object} args - Arguments for listing orders.
 * @param {number} [args.limit=20] - Maximum number of orders to return.
 * @param {number} [args.offset=0] - Number of orders to skip.
 * @param {string} [args.status] - Filter by order status.
 * @param {string} [args.fulfillment_status] - Filter by fulfillment status.
 * @param {string} [args.payment_status] - Filter by payment status.
 * @param {string} [args.display_id] - Filter by display ID.
 * @param {string} [args.cart_id] - Filter by cart ID.
 * @param {string} [args.customer_id] - Filter by customer ID.
 * @param {string} [args.email] - Filter by customer email.
 * @param {string} [args.region_id] - Filter by region ID.
 * @param {string} [args.currency_code] - Filter by currency code.
 * @param {string} [args.tax_rate] - Filter by tax rate.
 * @param {string} [args.created_at] - Filter by creation date.
 * @param {string} [args.updated_at] - Filter by update date.
 * @returns {Promise<Object>} - The result of the orders listing.
 */
const listOrders = async (args = {}) => {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY || process.env.MEDUSA_JWT || process.env.MEDUSA_SESSION_COOKIE || process.env.MEDUSA_COOKIE;

  if (!baseUrl || !apiKey || !hasMedusaCredentials()) {
    return { error: missingCredentialsMessage() };
  }
  //console.log(`base url: ${baseUrl}`)
  //console.log(`api key: ${apiKey}`)
  try {
    const url = new URL(`${baseUrl}/admin/orders`);
    
    // Add query parameters
    Object.entries(args).forEach(([key, value]) => {
      appendQueryParam(url.searchParams, key, value);
    });

    const data = await makeRequest(url.toString(), {
      method: 'GET',
      headers: createHeaders(apiKey)
    });
    
    return data;
  } catch (error) {
    console.error('Error listing orders:', error);
    return { error: `An error occurred while listing orders: ${error.message}` };
  }
};

/**
 * Function to get a specific order by ID.
 *
 * @param {Object} args - Arguments for retrieving an order.
 * @param {string} args.id - Order ID (required).
 * @returns {Promise<Object>} - The result of the order retrieval.
 */
const getOrder = async (args) => {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY || process.env.MEDUSA_JWT || process.env.MEDUSA_SESSION_COOKIE || process.env.MEDUSA_COOKIE;

  if (!baseUrl || !apiKey || !hasMedusaCredentials()) {
    return { error: missingCredentialsMessage() };
  }

  if (!args.id) {
    return { error: 'Order ID is required.' };
  }

  try {
    const url = new URL(`${baseUrl}/admin/orders/${args.id}`);
    if (args.fields) appendQueryParam(url.searchParams, 'fields', args.fields);

    const data = await makeRequest(url.toString(), {
      method: 'GET',
      headers: createHeaders(apiKey)
    });
    
    return data;
  } catch (error) {
    console.error('Error retrieving order:', error);
    return { error: `An error occurred while retrieving the order: ${error.message}` };
  }
};

/**
 * Function to cancel an order.
 *
 * @param {Object} args - Arguments for canceling an order.
 * @param {string} args.id - Order ID (required).
 * @returns {Promise<Object>} - The result of the order cancellation.
 */
const cancelOrder = async (args) => {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY || process.env.MEDUSA_JWT || process.env.MEDUSA_SESSION_COOKIE || process.env.MEDUSA_COOKIE;

  if (!baseUrl || !apiKey || !hasMedusaCredentials()) {
    return { error: missingCredentialsMessage() };
  }

  if (!args.id) {
    return { error: 'Order ID is required.' };
  }

  try {
    const url = `${baseUrl}/admin/orders/${args.id}/cancel`;

    const data = await makeRequest(url, {
      method: 'POST',
      headers: createHeaders(apiKey)
    });
    
    return { success: true, message: 'Order canceled successfully', order: data };
  } catch (error) {
    console.error('Error canceling order:', error);
    return { error: `An error occurred while canceling the order: ${error.message}` };
  }
};

/**
 * Function to complete an order.
 *
 * @param {Object} args - Arguments for completing an order.
 * @param {string} args.id - Order ID (required).
 * @returns {Promise<Object>} - The result of the order completion.
 */
const completeOrder = async (args) => {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY || process.env.MEDUSA_JWT || process.env.MEDUSA_SESSION_COOKIE || process.env.MEDUSA_COOKIE;

  if (!baseUrl || !apiKey || !hasMedusaCredentials()) {
    return { error: missingCredentialsMessage() };
  }

  if (!args.id) {
    return { error: 'Order ID is required.' };
  }

  try {
    const url = `${baseUrl}/admin/orders/${args.id}/complete`;

    const data = await makeRequest(url, {
      method: 'POST',
      headers: createHeaders(apiKey)
    });
    
    return { success: true, message: 'Order completed successfully', order: data };
  } catch (error) {
    console.error('Error completing order:', error);
    return { error: `An error occurred while completing the order: ${error.message}` };
  }
};

/**
 * Function to archive an order.
 *
 * @param {Object} args - Arguments for archiving an order.
 * @param {string} args.id - Order ID (required).
 * @returns {Promise<Object>} - The result of the order archival.
 */
const archiveOrder = async (args) => {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY || process.env.MEDUSA_JWT || process.env.MEDUSA_SESSION_COOKIE || process.env.MEDUSA_COOKIE;

  if (!baseUrl || !apiKey || !hasMedusaCredentials()) {
    return { error: missingCredentialsMessage() };
  }

  if (!args.id) {
    return { error: 'Order ID is required.' };
  }

  try {
    const url = `${baseUrl}/admin/orders/${args.id}/archive`;

    const data = await makeRequest(url, {
      method: 'POST',
      headers: createHeaders(apiKey)
    });
    
    return { success: true, message: 'Order archived successfully', order: data };
  } catch (error) {
    console.error('Error archiving order:', error);
    return { error: `An error occurred while archiving the order: ${error.message}` };
  }
};

/**
 * Function to transfer an order.
 *
 * @param {Object} args - Arguments for transferring an order.
 * @param {string} args.id - Order ID (required).
 * @param {string} args.customer_id - Customer ID to transfer to (required).
 * @returns {Promise<Object>} - The result of the order transfer.
 */
const transferOrder = async (args) => {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY || process.env.MEDUSA_JWT || process.env.MEDUSA_SESSION_COOKIE || process.env.MEDUSA_COOKIE;

  if (!baseUrl || !apiKey || !hasMedusaCredentials()) {
    return { error: missingCredentialsMessage() };
  }

  if (!args.id) {
    return { error: 'Order ID is required.' };
  }

  if (!args.customer_id) {
    return { error: 'Customer ID is required for order transfer.' };
  }

  try {
    const url = `${baseUrl}/admin/orders/${args.id}/transfer`;

    const transferData = { customer_id: args.customer_id };
    if (args.description !== undefined) transferData.description = args.description;
    if (args.internal_note !== undefined) transferData.internal_note = args.internal_note;
    if (args.update_order_email !== undefined) transferData.update_order_email = args.update_order_email;

    const data = await makeRequest(url, {
      method: 'POST',
      headers: createHeaders(apiKey),
      body: JSON.stringify(transferData)
    });

    return { success: true, message: 'Order transfer requested successfully (the customer must accept it)', order: data };
  } catch (error) {
    console.error('Error transferring order:', error);
    return { error: `An error occurred while transferring the order: ${error.message}` };
  }
};

/**
 * Function to list order fulfillments.
 *
 * @param {Object} args - Arguments for listing order fulfillments.
 * @param {string} args.id - Order ID (required).
 * @returns {Promise<Object>} - The result of the fulfillments listing.
 */
const listOrderFulfillments = async (args) => {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY || process.env.MEDUSA_JWT || process.env.MEDUSA_SESSION_COOKIE || process.env.MEDUSA_COOKIE;

  if (!baseUrl || !apiKey || !hasMedusaCredentials()) {
    return { error: missingCredentialsMessage() };
  }

  if (!args.id) {
    return { error: 'Order ID is required.' };
  }

  try {
    const url = `${baseUrl}/admin/orders/${args.id}?fields=*fulfillments`;

    const data = await makeRequest(url, {
      method: 'GET',
      headers: createHeaders(apiKey)
    });
    
    return { fulfillments: data.order?.fulfillments || [] };
  } catch (error) {
    console.error('Error listing order fulfillments:', error);
    return { error: `An error occurred while listing order fulfillments: ${error.message}` };
  }
};

/**
 * Function to cancel a fulfillment.
 *
 * @param {Object} args - Arguments for canceling a fulfillment.
 * @param {string} args.id - Order ID (required).
 * @param {string} args.fulfillment_id - Fulfillment ID (required).
 * @returns {Promise<Object>} - The result of the fulfillment cancellation.
 */
const cancelFulfillment = async (args) => {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY || process.env.MEDUSA_JWT || process.env.MEDUSA_SESSION_COOKIE || process.env.MEDUSA_COOKIE;

  if (!baseUrl || !apiKey || !hasMedusaCredentials()) {
    return { error: missingCredentialsMessage() };
  }

  if (!args.id) {
    return { error: 'Order ID is required.' };
  }

  if (!args.fulfillment_id) {
    return { error: 'Fulfillment ID is required.' };
  }

  try {
    const url = `${baseUrl}/admin/orders/${args.id}/fulfillments/${args.fulfillment_id}/cancel`;

    const request = {
      method: 'POST',
      headers: createHeaders(apiKey)
    };
    if (args.no_notification !== undefined) {
      request.body = JSON.stringify({ no_notification: args.no_notification });
    }

    const data = await makeRequest(url, request);

    return { success: true, message: 'Fulfillment canceled successfully', fulfillment: data };
  } catch (error) {
    console.error('Error canceling fulfillment:', error);
    return { error: `An error occurred while canceling the fulfillment: ${error.message}` };
  }
};

// ---------------------------------------------------------------------------
// Fulfillment / shipment / transfer actions (Medusa v2)
// ---------------------------------------------------------------------------

function getOrdersConfig() {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY || process.env.MEDUSA_JWT || process.env.MEDUSA_SESSION_COOKIE || process.env.MEDUSA_COOKIE;

  if (!baseUrl || !apiKey || !hasMedusaCredentials()) {
    return { error: missingCredentialsMessage() };
  }
  return { baseUrl, apiKey };
}

function pickDefined(source, keys) {
  const out = {};
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'items is required: [{ id: order line item ID, quantity }].';
  }
  const invalid = items.find((item) => !item || typeof item.id !== 'string' || typeof item.quantity !== 'number');
  if (invalid) {
    return 'Every item needs { id: order line item ID (string), quantity (number) }.';
  }
  return null;
}

async function postOrderAction(config, path, body, query) {
  const url = new URL(`${config.baseUrl}${path}`);
  Object.entries(query || {}).forEach(([key, value]) => appendQueryParam(url.searchParams, key, value));
  return await makeRequest(url.toString(), {
    method: 'POST',
    headers: createHeaders(config.apiKey),
    body: JSON.stringify(body || {})
  });
}

/**
 * Create a fulfillment for an order.
 * POST /admin/orders/{id}/fulfillments (Medusa 2.x; delivery_address since 2.19).
 */
const createFulfillment = async (args) => {
  const config = getOrdersConfig();
  if (config.error) return config;

  if (!args.id) {
    return { error: 'Order ID is required.' };
  }
  const itemsError = validateItems(args.items);
  if (itemsError) return { error: itemsError };

  const body = {
    items: args.items.map((item) => ({ id: item.id, quantity: item.quantity })),
    ...pickDefined(args, ['location_id', 'shipping_option_id', 'no_notification', 'metadata', 'additional_data'])
  };
  // delivery_address sólo existe desde Medusa 2.19 (validación estricta en 2.18): sólo se manda si viene.
  if (args.delivery_address !== undefined) body.delivery_address = args.delivery_address;

  try {
    const data = await withGatedFields(
      sentGatedFields(body, { delivery_address: '2.19' }),
      () => postOrderAction(config, `/admin/orders/${encodeURIComponent(args.id)}/fulfillments`, body, { fields: args.fields })
    );
    if (data?.unsupported) return data;
    return { success: true, message: 'Fulfillment created successfully', order: data };
  } catch (error) {
    console.error('Error creating fulfillment:', error);
    return { error: `An error occurred while creating the fulfillment: ${error.message}` };
  }
};

/**
 * Create a shipment for a fulfillment.
 * POST /admin/orders/{id}/fulfillments/{fulfillment_id}/shipments
 */
const createShipment = async (args) => {
  const config = getOrdersConfig();
  if (config.error) return config;

  if (!args.id) {
    return { error: 'Order ID is required.' };
  }
  if (!args.fulfillment_id) {
    return { error: 'Fulfillment ID is required.' };
  }
  const itemsError = validateItems(args.items);
  if (itemsError) return { error: itemsError };

  const body = {
    items: args.items.map((item) => ({ id: item.id, quantity: item.quantity })),
    ...pickDefined(args, ['labels', 'no_notification', 'metadata', 'additional_data'])
  };

  try {
    const data = await postOrderAction(
      config,
      `/admin/orders/${encodeURIComponent(args.id)}/fulfillments/${encodeURIComponent(args.fulfillment_id)}/shipments`,
      body,
      { fields: args.fields }
    );
    return { success: true, message: 'Shipment created successfully', order: data };
  } catch (error) {
    console.error('Error creating shipment:', error);
    return { error: `An error occurred while creating the shipment: ${error.message}` };
  }
};

/**
 * Mark a fulfillment as delivered.
 * POST /admin/orders/{id}/fulfillments/{fulfillment_id}/mark-as-delivered
 */
const markFulfillmentAsDelivered = async (args) => {
  const config = getOrdersConfig();
  if (config.error) return config;

  if (!args.id) {
    return { error: 'Order ID is required.' };
  }
  if (!args.fulfillment_id) {
    return { error: 'Fulfillment ID is required.' };
  }

  try {
    const data = await postOrderAction(
      config,
      `/admin/orders/${encodeURIComponent(args.id)}/fulfillments/${encodeURIComponent(args.fulfillment_id)}/mark-as-delivered`,
      pickDefined(args, ['no_notification']),
      { fields: args.fields }
    );
    return { success: true, message: 'Fulfillment marked as delivered', order: data };
  } catch (error) {
    console.error('Error marking fulfillment as delivered:', error);
    return { error: `An error occurred while marking the fulfillment as delivered: ${error.message}` };
  }
};

/**
 * Transfer an order to a guest customer identified by email.
 * POST /admin/orders/{id}/transfer/guest (Medusa 2.18+).
 */
const transferOrderToGuest = async (args) => {
  const config = getOrdersConfig();
  if (config.error) return config;

  if (!args.id) {
    return { error: 'Order ID is required.' };
  }
  if (!args.email) {
    return { error: 'email is required: the guest customer email the order is transferred to.' };
  }

  try {
    const data = await withMinVersion('2.18', () =>
      postOrderAction(
        config,
        `/admin/orders/${encodeURIComponent(args.id)}/transfer/guest`,
        { email: args.email, ...pickDefined(args, ['description', 'internal_note']) },
        { fields: args.fields }
      )
    );
    if (data?.unsupported) return data;
    return { success: true, message: 'Order transferred to guest customer successfully', order: data };
  } catch (error) {
    console.error('Error transferring order to guest:', error);
    return { error: `An error occurred while transferring the order to a guest customer: ${error.message}` };
  }
};

/**
 * Cancel a pending order transfer request.
 * POST /admin/orders/{id}/transfer/cancel
 */
const cancelOrderTransfer = async (args) => {
  const config = getOrdersConfig();
  if (config.error) return config;

  if (!args.id) {
    return { error: 'Order ID is required.' };
  }

  try {
    const data = await postOrderAction(config, `/admin/orders/${encodeURIComponent(args.id)}/transfer/cancel`, {}, { fields: args.fields });
    return { success: true, message: 'Order transfer request canceled', order: data };
  } catch (error) {
    console.error('Error canceling order transfer:', error);
    return { error: `An error occurred while canceling the order transfer: ${error.message}` };
  }
};

const ACTIONS = [
  'list', 'get', 'cancel', 'complete', 'archive',
  'transfer', 'transfer_to_guest', 'cancel_transfer',
  'list_fulfillments', 'create_fulfillment', 'create_shipment', 'mark_as_delivered', 'cancel_fulfillment'
];

/**
 * Master function that routes to appropriate order operation based on action.
 *
 * @param {Object} args - Arguments for the order operation.
 * @param {string} args.action - The action to perform (see ACTIONS).
 * @returns {Promise<Object>} - The result of the order operation.
 */
const executeFunction = async (args) => {
  const { action, ...operationArgs } = args;

  switch (action) {
    case 'list':
      return await listOrders(operationArgs);
    case 'get':
      return await getOrder(operationArgs);
    case 'cancel':
      return await cancelOrder(operationArgs);
    case 'complete':
      return await completeOrder(operationArgs);
    case 'archive':
      return await archiveOrder(operationArgs);
    case 'transfer':
      return await transferOrder(operationArgs);
    case 'list_fulfillments':
      return await listOrderFulfillments(operationArgs);
    case 'transfer_to_guest':
      return await transferOrderToGuest(operationArgs);
    case 'cancel_transfer':
      return await cancelOrderTransfer(operationArgs);
    case 'create_fulfillment':
      return await createFulfillment(operationArgs);
    case 'create_shipment':
      return await createShipment(operationArgs);
    case 'mark_as_delivered':
      return await markFulfillmentAsDelivered(operationArgs);
    case 'cancel_fulfillment':
      return await cancelFulfillment(operationArgs);
    default:
      return { error: `Invalid action: ${action}. Valid actions are: ${ACTIONS.join(', ')}` };
  }
};

/**
 * Tool configuration for comprehensive Medusa Admin order management.
 * @type {Object}
 */
const apiTool = {
  definition: {
    name: 'manage_medusa_admin_orders',
    description:
      'Medusa Admin orders (Medusa 2.17.2+, incl. 2.18 and 2.21.1): list, get, cancel, complete, archive. ' +
      'transfer (customer_id: sends the customer a transfer request they must accept; optional description, internal_note, update_order_email), ' +
      'transfer_to_guest (email: moves the order to a guest customer with that email, e.g. to fix a mistyped email; Medusa >= 2.18), cancel_transfer (cancels a pending transfer request). ' +
      'Fulfillment flow: list_fulfillments → create_fulfillment (items [{id: order line item ID, quantity}], optional location_id, shipping_option_id, no_notification, metadata, delivery_address (Medusa >= 2.19)) → ' +
      'create_shipment (fulfillment_id + items, optional labels [{tracking_number, tracking_url, label_url}]) → mark_as_delivered (fulfillment_id); cancel_fulfillment (fulfillment_id, only if not shipped). ' +
      'Fulfillment, shipment and delivery actions notify the customer unless no_notification is true.',
    parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ACTIONS,
            description: 'The action to perform on orders.'
          },
          // Common parameters
          id: {
            type: 'string',
            description: 'Order ID (required for every action except list).'
          },
          // List parameters
          limit: {
            type: 'number',
            description: 'Maximum number of orders to return (default: 20).'
          },
          offset: {
            type: 'number',
            description: 'Number of orders to skip (default: 0).'
          },
          status: {
            type: 'string',
            description: 'Filter by order status.'
          },
          fulfillment_status: {
            type: 'string',
            description: 'Filter by fulfillment status.'
          },
          payment_status: {
            type: 'string',
            description: 'Filter by payment status.'
          },
          display_id: {
            type: 'string',
            description: 'Filter by display ID.'
          },
          cart_id: {
            type: 'string',
            description: 'Filter by cart ID.'
          },
          customer_id: {
            type: 'string',
            description: 'Filter by customer ID or customer ID to transfer to (for transfer action).'
          },
          email: {
            type: 'string',
            description: 'Filter by customer email, or the guest email for transfer_to_guest.'
          },
          region_id: {
            type: 'string',
            description: 'Filter by region ID.'
          },
          currency_code: {
            type: 'string',
            description: 'Filter by currency code.'
          },
          tax_rate: {
            type: 'string',
            description: 'Filter by tax rate.'
          },
          created_at: {
            type: 'object',
            description: 'Filtro por fecha de creación con operadores de rango Medusa ($gte/$lte/$gt/$lt), fechas ISO 8601. Ej: {"$gte":"2026-05-01T00:00:00Z","$lte":"2026-05-31T23:59:59Z"}.',
            properties: {
              $gte: { type: 'string', description: 'Mayor o igual (ISO 8601).' },
              $lte: { type: 'string', description: 'Menor o igual (ISO 8601).' },
              $gt: { type: 'string', description: 'Mayor (ISO 8601).' },
              $lt: { type: 'string', description: 'Menor (ISO 8601).' }
            }
          },
          updated_at: {
            type: 'object',
            description: 'Filtro por fecha de actualización con operadores de rango Medusa ($gte/$lte/$gt/$lt), ISO 8601.',
            properties: {
              $gte: { type: 'string', description: 'Mayor o igual (ISO 8601).' },
              $lte: { type: 'string', description: 'Menor o igual (ISO 8601).' },
              $gt: { type: 'string', description: 'Mayor (ISO 8601).' },
              $lt: { type: 'string', description: 'Menor (ISO 8601).' }
            }
          },
          fields: {
            type: 'string',
            description: 'Fields selector for list/get and for the order returned by write actions.'
          },
          // Transfer parameters
          description: {
            type: 'string',
            description: 'Transfer description shown to the customer (transfer, transfer_to_guest).'
          },
          internal_note: {
            type: 'string',
            description: 'Internal note visible only to admins (transfer, transfer_to_guest).'
          },
          update_order_email: {
            type: 'boolean',
            description: "transfer: also update the order email to the new customer's email."
          },
          // Fulfillment parameters
          fulfillment_id: {
            type: 'string',
            description: 'Fulfillment ID (required for create_shipment, mark_as_delivered and cancel_fulfillment).'
          },
          items: {
            type: 'array',
            description: 'create_fulfillment / create_shipment: order line items and quantities, [{ id, quantity }].',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Order line item ID.' },
                quantity: { type: 'number', description: 'Quantity to fulfill/ship.' }
              },
              required: ['id', 'quantity']
            }
          },
          location_id: {
            type: 'string',
            description: 'create_fulfillment: stock location to fulfill from (defaults to the shipping option location).'
          },
          shipping_option_id: {
            type: 'string',
            description: 'create_fulfillment: shipping option to use.'
          },
          delivery_address: {
            type: 'object',
            description: 'create_fulfillment: address to deliver to (Medusa >= 2.19; only sent when provided). Fields: first_name, last_name, phone, company, address_1, address_2, city, country_code, province, postal_code, metadata.'
          },
          labels: {
            type: 'array',
            description: 'create_shipment: shipping labels [{ tracking_number, tracking_url, label_url }].',
            items: { type: 'object' }
          },
          no_notification: {
            type: 'boolean',
            description: 'Do not notify the customer (create_fulfillment, create_shipment, mark_as_delivered, cancel_fulfillment).'
          },
          metadata: {
            type: 'object',
            description: 'Fulfillment/shipment metadata.'
          },
          additional_data: {
            type: 'object',
            description: 'Additional data passed to workflow hooks (create_fulfillment, create_shipment).'
          }
        },
        required: ['action']
      }
  },
  function: withMedusaErrorHints(executeFunction)
};

export { apiTool };
