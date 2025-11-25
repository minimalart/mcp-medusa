/**
 * Comprehensive Medusa Admin Draft Order Management Tool
 * Supports CRUD operations and cart-like functionality for draft orders using optimized fetch approach
 */

import { Buffer } from "buffer";

// Utility function to normalize base URL by removing trailing slashes
function normalizeBaseUrl(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

// Utility function to create proper headers for Medusa API
function createHeaders(apiKey) {
  return {
    'Authorization': `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
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
 * Function to create a new draft order.
 *
 * @param {Object} args - Arguments for creating a draft order.
 * @param {string} [args.status] - Draft order status.
 * @param {string} [args.email] - Customer email.
 * @param {string} [args.customer_id] - Customer ID.
 * @param {string} [args.region_id] - Region ID.
 * @param {string} [args.currency_code] - Currency code.
 * @param {Array} [args.items] - Array of line items.
 * @param {Object} [args.shipping_address] - Shipping address object.
 * @param {Object} [args.billing_address] - Billing address object.
 * @param {Array} [args.discounts] - Array of discount codes.
 * @param {Object} [args.metadata] - Additional metadata.
 * @returns {Promise<Object>} - The result of the draft order creation.
 */
const createDraftOrder = async (args) => {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY;

  if (!baseUrl || !apiKey) {
    return { error: 'Medusa credentials not configured. Please set MEDUSA_BASE_URL and MEDUSA_API_KEY environment variables.' };
  }

  try {
    const url = `${baseUrl}/admin/draft-orders`;
    
    // Remove undefined values
    const draftOrderData = { ...args };
    Object.keys(draftOrderData).forEach(key => 
      draftOrderData[key] === undefined && delete draftOrderData[key]
    );

    const data = await makeRequest(url, {
      method: 'POST',
      headers: createHeaders(apiKey),
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
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY;

  if (!baseUrl || !apiKey) {
    return { error: 'Medusa credentials not configured. Please set MEDUSA_BASE_URL and MEDUSA_API_KEY environment variables.' };
  }

  try {
    const url = new URL(`${baseUrl}/admin/draft-orders`);
    
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
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY;

  if (!baseUrl || !apiKey) {
    return { error: 'Medusa credentials not configured. Please set MEDUSA_BASE_URL and MEDUSA_API_KEY environment variables.' };
  }

  if (!args.id) {
    return { error: 'Draft order ID is required.' };
  }

  try {
    const url = `${baseUrl}/admin/draft-orders/${args.id}`;

    const data = await makeRequest(url, {
      method: 'GET',
      headers: createHeaders(apiKey)
    });
    
    return data;
  } catch (error) {
    console.error('Error retrieving draft order:', error);
    return { error: `An error occurred while retrieving the draft order: ${error.message}` };
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
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY;

  if (!baseUrl || !apiKey) {
    return { error: 'Medusa credentials not configured. Please set MEDUSA_BASE_URL and MEDUSA_API_KEY environment variables.' };
  }

  if (!args.id) {
    return { error: 'Draft order ID is required.' };
  }

  try {
    const url = `${baseUrl}/admin/draft-orders/${args.id}`;

    const data = await makeRequest(url, {
      method: 'DELETE',
      headers: createHeaders(apiKey)
    });
    
    return { success: true, message: 'Draft order deleted successfully', draft_order: data };
  } catch (error) {
    console.error('Error deleting draft order:', error);
    return { error: `An error occurred while deleting the draft order: ${error.message}` };
  }
};

/**
 * Function to convert a draft order to a regular order.
 *
 * @param {Object} args - Arguments for converting a draft order.
 * @param {string} args.id - Draft order ID (required).
 * @returns {Promise<Object>} - The result of the draft order conversion.
 */
const convertDraftOrderToOrder = async (args) => {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY;

  if (!baseUrl || !apiKey) {
    return { error: 'Medusa credentials not configured. Please set MEDUSA_BASE_URL and MEDUSA_API_KEY environment variables.' };
  }

  if (!args.id) {
    return { error: 'Draft order ID is required.' };
  }

  try {
    const url = `${baseUrl}/admin/draft-orders/${args.id}/complete`;

    const data = await makeRequest(url, {
      method: 'POST',
      headers: createHeaders(apiKey)
    });
    
    return { success: true, message: 'Draft order converted to order successfully', order: data };
  } catch (error) {
    console.error('Error converting draft order:', error);
    return { error: `An error occurred while converting the draft order: ${error.message}` };
  }
};

/**
 * Function to add a line item to a draft order.
 *
 * @param {Object} args - Arguments for adding a line item.
 * @param {string} args.id - Draft order ID (required).
 * @param {string} args.variant_id - Product variant ID (required).
 * @param {number} args.quantity - Quantity (required).
 * @param {Object} [args.metadata] - Item metadata.
 * @returns {Promise<Object>} - The result of adding the line item.
 */
const addLineItem = async (args) => {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY;

  if (!baseUrl || !apiKey) {
    return { error: 'Medusa credentials not configured. Please set MEDUSA_BASE_URL and MEDUSA_API_KEY environment variables.' };
  }

  if (!args.id) {
    return { error: 'Draft order ID is required.' };
  }

  if (!args.variant_id) {
    return { error: 'Product variant ID is required.' };
  }

  if (!args.quantity) {
    return { error: 'Quantity is required.' };
  }

  try {
    const url = `${baseUrl}/admin/draft-orders/${args.id}/line-items`;
    
    const itemData = {
      variant_id: args.variant_id,
      quantity: args.quantity,
      ...(args.metadata && { metadata: args.metadata })
    };

    const data = await makeRequest(url, {
      method: 'POST',
      headers: createHeaders(apiKey),
      body: JSON.stringify(itemData)
    });
    
    return { success: true, message: 'Line item added successfully', draft_order: data };
  } catch (error) {
    console.error('Error adding line item:', error);
    return { error: `An error occurred while adding the line item: ${error.message}` };
  }
};

/**
 * Function to update a line item in a draft order.
 *
 * @param {Object} args - Arguments for updating a line item.
 * @param {string} args.id - Draft order ID (required).
 * @param {string} args.line_id - Line item ID (required).
 * @param {number} [args.quantity] - New quantity.
 * @param {Object} [args.metadata] - Item metadata.
 * @returns {Promise<Object>} - The result of updating the line item.
 */
const updateLineItem = async (args) => {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY;

  if (!baseUrl || !apiKey) {
    return { error: 'Medusa credentials not configured. Please set MEDUSA_BASE_URL and MEDUSA_API_KEY environment variables.' };
  }

  if (!args.id) {
    return { error: 'Draft order ID is required.' };
  }

  if (!args.line_id) {
    return { error: 'Line item ID is required.' };
  }

  try {
    const url = `${baseUrl}/admin/draft-orders/${args.id}/line-items/${args.line_id}`;
    
    const updateData = {};
    if (args.quantity !== undefined) updateData.quantity = args.quantity;
    if (args.metadata !== undefined) updateData.metadata = args.metadata;

    const data = await makeRequest(url, {
      method: 'POST',
      headers: createHeaders(apiKey),
      body: JSON.stringify(updateData)
    });
    
    return { success: true, message: 'Line item updated successfully', draft_order: data };
  } catch (error) {
    console.error('Error updating line item:', error);
    return { error: `An error occurred while updating the line item: ${error.message}` };
  }
};

/**
 * Function to remove a line item from a draft order.
 *
 * @param {Object} args - Arguments for removing a line item.
 * @param {string} args.id - Draft order ID (required).
 * @param {string} args.line_id - Line item ID (required).
 * @returns {Promise<Object>} - The result of removing the line item.
 */
const removeLineItem = async (args) => {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY;

  if (!baseUrl || !apiKey) {
    return { error: 'Medusa credentials not configured. Please set MEDUSA_BASE_URL and MEDUSA_API_KEY environment variables.' };
  }

  if (!args.id) {
    return { error: 'Draft order ID is required.' };
  }

  if (!args.line_id) {
    return { error: 'Line item ID is required.' };
  }

  try {
    const url = `${baseUrl}/admin/draft-orders/${args.id}/line-items/${args.line_id}`;

    const data = await makeRequest(url, {
      method: 'DELETE',
      headers: createHeaders(apiKey)
    });
    
    return { success: true, message: 'Line item removed successfully', draft_order: data };
  } catch (error) {
    console.error('Error removing line item:', error);
    return { error: `An error occurred while removing the line item: ${error.message}` };
  }
};

/**
 * Master function that routes to appropriate draft order operation based on action.
 *
 * @param {Object} args - Arguments for the draft order operation.
 * @param {string} args.action - The action to perform (create, list, get, delete, convert_to_order, add_line_item, update_line_item, remove_line_item).
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
      return { error: `Invalid action: ${action}. Valid actions are: create, list, get, delete, convert_to_order, add_line_item, update_line_item, remove_line_item` };
  }
};

/**
 * Tool configuration for comprehensive Medusa Admin draft order management.
 * @type {Object}
 */
const apiTool = {
  definition: {
    name: 'manage_medusa_admin_draft_orders',
    description: 'Comprehensive Medusa Admin draft order management tool supporting cart-like functionality (create, list, get, delete, convert to order, and line item management).',
    parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create', 'list', 'get', 'delete', 'convert_to_order', 'add_line_item', 'update_line_item', 'remove_line_item'],
            description: 'The action to perform on draft orders.'
          },
          // Common parameters
          id: {
            type: 'string',
            description: 'Draft order ID (required for get, delete, convert_to_order, add_line_item, update_line_item, remove_line_item actions).'
          },
          // Creation parameters
          status: {
            type: 'string',
            description: 'Draft order status.'
          },
          email: {
            type: 'string',
            description: 'Customer email.'
          },
          customer_id: {
            type: 'string',
            description: 'Customer ID.'
          },
          region_id: {
            type: 'string',
            description: 'Region ID.'
          },
          currency_code: {
            type: 'string',
            description: 'Currency code.'
          },
          items: {
            type: 'array',
            description: 'Array of line items for draft order creation.',
            items: {
              type: 'object',
              properties: {
                variant_id: { type: 'string' },
                quantity: { type: 'number' }
              }
            }
          },
          shipping_address: {
            type: 'object',
            description: 'Shipping address object.'
          },
          billing_address: {
            type: 'object',
            description: 'Billing address object.'
          },
          discounts: {
            type: 'array',
            description: 'Array of discount codes.',
            items: { type: 'string' }
          },
          metadata: {
            type: 'object',
            description: 'Additional metadata.'
          },
          // List parameters
          limit: {
            type: 'number',
            description: 'Maximum number of draft orders to return (default: 20).'
          },
          offset: {
            type: 'number',
            description: 'Number of draft orders to skip (default: 0).'
          },
          q: {
            type: 'string',
            description: 'Query string for search.'
          },
          // Line item parameters
          variant_id: {
            type: 'string',
            description: 'Product variant ID (required for add_line_item action).'
          },
          quantity: {
            type: 'number',
            description: 'Quantity (required for add_line_item action, optional for update_line_item).'
          },
          line_id: {
            type: 'string',
            description: 'Line item ID (required for update_line_item and remove_line_item actions).'
          }
        },
        required: ['action']
      }
  },
  function: executeFunction
};

export { apiTool };