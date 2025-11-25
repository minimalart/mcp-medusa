/**
 * Comprehensive Medusa Admin Returns & Exchanges Management Tool
 * Supports returns, swaps, claims, and order edits
 */

import { Buffer } from "buffer";

// Utility function to normalize base URL by removing trailing slashes
function normalizeBaseUrl(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function createHeaders(apiKey) {
  return {
    'Authorization': `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
    'Content-Type': 'application/json'
  };
}

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

async function handleReturnsOperation(args) {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY;
  
  if (!apiKey) {
    throw new Error('MEDUSA_API_KEY environment variable is required');
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
    case 'update_claim':
      return await updateClaim(baseUrl, headers, args);
    case 'cancel_claim':
      return await cancelClaim(baseUrl, headers, args);
    case 'list_order_edits':
      return await listOrderEdits(baseUrl, headers, args);
    case 'get_order_edit':
      return await getOrderEdit(baseUrl, headers, args);
    case 'update_order_edit':
      return await updateOrderEdit(baseUrl, headers, args);
    case 'delete_order_edit':
      return await deleteOrderEdit(baseUrl, headers, args);
    case 'complete_order_edit':
      return await completeOrderEdit(baseUrl, headers, args);
    case 'cancel_order_edit':
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

async function receiveReturn(baseUrl, headers, args) {
  if (!args.id) throw new Error('Return ID is required');
  
  const receiveData = {};
  if (args.items) receiveData.items = args.items;
  if (args.refund) receiveData.refund = args.refund;

  const url = `${baseUrl}/admin/returns/${args.id}/receive`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(receiveData)
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

async function updateClaim(baseUrl, headers, args) {
  if (!args.claim_id) throw new Error('Claim ID is required');
  
  const claimData = {};
  if (args.claim_items) claimData.claim_items = args.claim_items;
  if (args.shipping_methods) claimData.shipping_methods = args.shipping_methods;
  if (args.no_notification !== undefined) claimData.no_notification = args.no_notification;
  if (args.metadata) claimData.metadata = args.metadata;

  const url = `${baseUrl}/admin/claims/${args.claim_id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(claimData)
  });
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

// Order Edits operations
async function listOrderEdits(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());
  if (args.order_id) params.append('order_id', args.order_id);

  const url = `${baseUrl}/admin/order-edits?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getOrderEdit(baseUrl, headers, args) {
  if (!args.order_edit_id) throw new Error('Order edit ID is required');
  const url = `${baseUrl}/admin/order-edits/${args.order_edit_id}`;
  return await makeRequest(url, { headers });
}

async function updateOrderEdit(baseUrl, headers, args) {
  if (!args.order_edit_id) throw new Error('Order edit ID is required');
  
  const editData = {};
  if (args.internal_note) editData.internal_note = args.internal_note;

  const url = `${baseUrl}/admin/order-edits/${args.order_edit_id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(editData)
  });
}

async function deleteOrderEdit(baseUrl, headers, args) {
  if (!args.order_edit_id) throw new Error('Order edit ID is required');
  const url = `${baseUrl}/admin/order-edits/${args.order_edit_id}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

async function completeOrderEdit(baseUrl, headers, args) {
  if (!args.order_edit_id) throw new Error('Order edit ID is required');
  const url = `${baseUrl}/admin/order-edits/${args.order_edit_id}/complete`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });
}

async function cancelOrderEdit(baseUrl, headers, args) {
  if (!args.order_edit_id) throw new Error('Order edit ID is required');
  const url = `${baseUrl}/admin/order-edits/${args.order_edit_id}/cancel`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });
}

export const apiTool = {
  definition: {
    name: 'manage_medusa_admin_returns',
    description: 'Comprehensive Medusa Admin returns and exchanges management tool supporting returns, swaps, claims, and order edits.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'list_returns', 'get_return', 'cancel_return', 'receive_return',
            'list_exchanges', 'get_exchange', 'cancel_exchange',
            'list_claims', 'get_claim', 'update_claim', 'cancel_claim',
            'list_order_edits', 'get_order_edit', 'update_order_edit', 'delete_order_edit', 'complete_order_edit', 'cancel_order_edit'
          ],
          description: 'The action to perform.'
        },
        id: { type: 'string', description: 'Return ID.' },
        exchange_id: { type: 'string', description: 'Exchange ID.' },
        claim_id: { type: 'string', description: 'Claim ID.' },
        order_edit_id: { type: 'string', description: 'Order edit ID.' },
        order_id: { type: 'string', description: 'Order ID for filtering.' },
        limit: { type: 'number', description: 'Maximum number of items to return.' },
        offset: { type: 'number', description: 'Number of items to skip.' },
        items: { type: 'array', description: 'Items to receive/return.' },
        refund: { type: 'number', description: 'Refund amount.' },
        claim_items: { type: 'array', description: 'Claim items.' },
        shipping_methods: { type: 'array', description: 'Shipping methods.' },
        no_notification: { type: 'boolean', description: 'Whether to skip notifications.' },
        internal_note: { type: 'string', description: 'Internal note for order edit.' },
        metadata: { type: 'object', description: 'Additional metadata.' }
      },
      required: ['action']
    }
  },
  function: handleReturnsOperation
};