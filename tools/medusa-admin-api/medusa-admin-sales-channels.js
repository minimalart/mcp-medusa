/**
 * Comprehensive Medusa Admin Sales Channels Management Tool
 * Supports sales channels operations and product associations
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

async function handleSalesChannelsOperation(args) {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY;
  
  if (!apiKey) {
    throw new Error('MEDUSA_API_KEY environment variable is required');
  }

  const headers = createHeaders(apiKey);

  switch (args.action) {
    case 'list':
      return await listSalesChannels(baseUrl, headers, args);
    case 'get':
      return await getSalesChannel(baseUrl, headers, args);
    case 'create':
      return await createSalesChannel(baseUrl, headers, args);
    case 'update':
      return await updateSalesChannel(baseUrl, headers, args);
    case 'delete':
      return await deleteSalesChannel(baseUrl, headers, args);
    case 'add_products':
      return await addProductsToChannel(baseUrl, headers, args);
    case 'remove_products':
      return await removeProductsFromChannel(baseUrl, headers, args);
    case 'list_products':
      return await listChannelProducts(baseUrl, headers, args);
    default:
      throw new Error(`Unknown action: ${args.action}`);
  }
}

async function listSalesChannels(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());
  if (args.q) params.append('q', args.q);

  const url = `${baseUrl}/admin/sales-channels?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getSalesChannel(baseUrl, headers, args) {
  if (!args.id) throw new Error('Sales channel ID is required');
  const url = `${baseUrl}/admin/sales-channels/${args.id}`;
  return await makeRequest(url, { headers });
}

async function createSalesChannel(baseUrl, headers, args) {
  if (!args.name) throw new Error('Sales channel name is required');
  
  const channelData = { name: args.name };
  if (args.description) channelData.description = args.description;
  if (args.is_disabled !== undefined) channelData.is_disabled = args.is_disabled;
  if (args.metadata) channelData.metadata = args.metadata;

  const url = `${baseUrl}/admin/sales-channels`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(channelData)
  });
}

async function updateSalesChannel(baseUrl, headers, args) {
  if (!args.id) throw new Error('Sales channel ID is required');
  
  const channelData = {};
  if (args.name) channelData.name = args.name;
  if (args.description) channelData.description = args.description;
  if (args.is_disabled !== undefined) channelData.is_disabled = args.is_disabled;
  if (args.metadata) channelData.metadata = args.metadata;

  const url = `${baseUrl}/admin/sales-channels/${args.id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(channelData)
  });
}

async function deleteSalesChannel(baseUrl, headers, args) {
  if (!args.id) throw new Error('Sales channel ID is required');
  const url = `${baseUrl}/admin/sales-channels/${args.id}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

async function addProductsToChannel(baseUrl, headers, args) {
  if (!args.id) throw new Error('Sales channel ID is required');
  if (!args.product_ids || !Array.isArray(args.product_ids)) {
    throw new Error('Product IDs array is required');
  }

  const url = `${baseUrl}/admin/sales-channels/${args.id}/products`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ product_ids: args.product_ids })
  });
}

async function removeProductsFromChannel(baseUrl, headers, args) {
  if (!args.id) throw new Error('Sales channel ID is required');
  if (!args.product_ids || !Array.isArray(args.product_ids)) {
    throw new Error('Product IDs array is required');
  }

  const url = `${baseUrl}/admin/sales-channels/${args.id}/products`;
  return await makeRequest(url, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ product_ids: args.product_ids })
  });
}

async function listChannelProducts(baseUrl, headers, args) {
  if (!args.id) throw new Error('Sales channel ID is required');
  
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());

  const url = `${baseUrl}/admin/sales-channels/${args.id}/products?${params.toString()}`;
  return await makeRequest(url, { headers });
}

export const apiTool = {
  definition: {
    name: 'manage_medusa_admin_sales_channels',
    description: 'Comprehensive Medusa Admin sales channels management tool supporting channel operations and product associations.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'list', 'get', 'create', 'update', 'delete',
            'add_products', 'remove_products', 'list_products'
          ],
          description: 'The action to perform on sales channels.'
        },
        id: { type: 'string', description: 'Sales channel ID.' },
        limit: { type: 'number', description: 'Maximum number of items to return.' },
        offset: { type: 'number', description: 'Number of items to skip.' },
        q: { type: 'string', description: 'Search query.' },
        name: { type: 'string', description: 'Sales channel name.' },
        description: { type: 'string', description: 'Sales channel description.' },
        is_disabled: { type: 'boolean', description: 'Whether channel is disabled.' },
        product_ids: { type: 'array', items: { type: 'string' }, description: 'Product IDs to add/remove.' },
        metadata: { type: 'object', description: 'Additional metadata.' }
      },
      required: ['action']
    }
  },
  function: handleSalesChannelsOperation
};