/**
 * Comprehensive Medusa Admin Order Management Tool
 * Supports CRUD operations and special actions for orders using optimized fetch approach
 */

import { Buffer } from "buffer";

// Utility function to normalize base URL by removing trailing slashes
function normalizeBaseUrl(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

// Utility function to create proper headers for Medusa API
function createHeaders(apiKey) {
  
  return {
    
      Authorization: `Basic ${
        Buffer.from(`${apiKey}:`).toString("base64")
      }`,
  
    'Content-Type': 'application/json'
  };
}

// Utility function to make API requests
async function makeRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers
    }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  
  return await response.json();
}

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
  const apiKey = process.env.MEDUSA_API_KEY;

  if (!baseUrl || !apiKey) {
    return { error: 'Medusa credentials not configured. Please set MEDUSA_BASE_URL and MEDUSA_API_KEY environment variables.' };
  }
  //console.log(`base url: ${baseUrl}`)
  //console.log(`api key: ${apiKey}`)
  try {
    const url = new URL(`${baseUrl}/admin/orders`);
    
    // Add query parameters
    Object.keys(args).forEach(key => {
      if (args[key] !== undefined && args[key] !== null) {
        url.searchParams.append(key, args[key]);
      }
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
  const apiKey = process.env.MEDUSA_API_KEY;

  if (!baseUrl || !apiKey) {
    return { error: 'Medusa credentials not configured. Please set MEDUSA_BASE_URL and MEDUSA_API_KEY environment variables.' };
  }

  if (!args.id) {
    return { error: 'Order ID is required.' };
  }

  try {
    const url = `${baseUrl}/admin/orders/${args.id}`;

    const data = await makeRequest(url, {
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
  const apiKey = process.env.MEDUSA_API_KEY;

  if (!baseUrl || !apiKey) {
    return { error: 'Medusa credentials not configured. Please set MEDUSA_BASE_URL and MEDUSA_API_KEY environment variables.' };
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
  const apiKey = process.env.MEDUSA_API_KEY;

  if (!baseUrl || !apiKey) {
    return { error: 'Medusa credentials not configured. Please set MEDUSA_BASE_URL and MEDUSA_API_KEY environment variables.' };
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
  const apiKey = process.env.MEDUSA_API_KEY;

  if (!baseUrl || !apiKey) {
    return { error: 'Medusa credentials not configured. Please set MEDUSA_BASE_URL and MEDUSA_API_KEY environment variables.' };
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
  const apiKey = process.env.MEDUSA_API_KEY;

  if (!baseUrl || !apiKey) {
    return { error: 'Medusa credentials not configured. Please set MEDUSA_BASE_URL and MEDUSA_API_KEY environment variables.' };
  }

  if (!args.id) {
    return { error: 'Order ID is required.' };
  }

  if (!args.customer_id) {
    return { error: 'Customer ID is required for order transfer.' };
  }

  try {
    const url = `${baseUrl}/admin/orders/${args.id}/transfer`;

    const data = await makeRequest(url, {
      method: 'POST',
      headers: createHeaders(apiKey),
      body: JSON.stringify({ customer_id: args.customer_id })
    });
    
    return { success: true, message: 'Order transferred successfully', order: data };
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
  const apiKey = process.env.MEDUSA_API_KEY;

  if (!baseUrl || !apiKey) {
    return { error: 'Medusa credentials not configured. Please set MEDUSA_BASE_URL and MEDUSA_API_KEY environment variables.' };
  }

  if (!args.id) {
    return { error: 'Order ID is required.' };
  }

  try {
    const url = `${baseUrl}/admin/orders/${args.id}?expand=fulfillments`;

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
  const apiKey = process.env.MEDUSA_API_KEY;

  if (!baseUrl || !apiKey) {
    return { error: 'Medusa credentials not configured. Please set MEDUSA_BASE_URL and MEDUSA_API_KEY environment variables.' };
  }

  if (!args.id) {
    return { error: 'Order ID is required.' };
  }

  if (!args.fulfillment_id) {
    return { error: 'Fulfillment ID is required.' };
  }

  try {
    const url = `${baseUrl}/admin/orders/${args.id}/fulfillments/${args.fulfillment_id}/cancel`;

    const data = await makeRequest(url, {
      method: 'POST',
      headers: createHeaders(apiKey)
    });
    
    return { success: true, message: 'Fulfillment canceled successfully', fulfillment: data };
  } catch (error) {
    console.error('Error canceling fulfillment:', error);
    return { error: `An error occurred while canceling the fulfillment: ${error.message}` };
  }
};

/**
 * Master function that routes to appropriate order operation based on action.
 *
 * @param {Object} args - Arguments for the order operation.
 * @param {string} args.action - The action to perform (list, get, cancel, complete, archive, transfer, list_fulfillments, cancel_fulfillment).
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
    case 'cancel_fulfillment':
      return await cancelFulfillment(operationArgs);
    default:
      return { error: `Invalid action: ${action}. Valid actions are: list, get, cancel, complete, archive, transfer, list_fulfillments, cancel_fulfillment` };
  }
};

/**
 * Tool configuration for comprehensive Medusa Admin order management.
 * @type {Object}
 */
const apiTool = {
  definition: {
    name: 'manage_medusa_admin_orders',
    description: 'Comprehensive Medusa Admin order management tool supporting order operations (list, get, cancel, complete, archive, transfer, and fulfillment management).',
    parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list', 'get', 'cancel', 'complete', 'archive', 'transfer', 'list_fulfillments', 'cancel_fulfillment'],
            description: 'The action to perform on orders.'
          },
          // Common parameters
          id: {
            type: 'string',
            description: 'Order ID (required for get, cancel, complete, archive, transfer, list_fulfillments, cancel_fulfillment actions).'
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
            description: 'Filter by customer email.'
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
            type: 'string',
            description: 'Filter by creation date.'
          },
          updated_at: {
            type: 'string',
            description: 'Filter by update date.'
          },
          // Fulfillment parameters
          fulfillment_id: {
            type: 'string',
            description: 'Fulfillment ID (required for cancel_fulfillment action).'
          }
        },
        required: ['action']
      }
  },
  function: executeFunction
};

export { apiTool };