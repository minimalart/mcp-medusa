/**
 * Comprehensive Medusa Admin Collections Management Tool
 * Supports CRUD operations for product collections
 */

import { appendQueryParam, createHeaders, hasMedusaCredentials, makeRequest, missingCredentialsMessage, normalizeBaseUrl } from "../../lib/medusa-client.js";

/**
 * Main function to handle all collection-related operations.
 *
 * @param {Object} args - Arguments object.
 * @param {string} args.action - The action to perform.
 * @param {string} [args.id] - Collection ID (required for get, update, delete operations).
 * @param {number} [args.limit=20] - Maximum number of items to return.
 * @param {number} [args.offset=0] - Number of items to skip.
 * @param {string} [args.q] - Search query.
 * @param {string} [args.title] - Collection title.
 * @param {string} [args.handle] - Collection handle/slug.
 * @param {Object} [args.metadata] - Additional metadata.
 * @param {string} [args.created_at] - Filter by creation date.
 * @param {string} [args.updated_at] - Filter by update date.
 * @param {Array} [args.product_ids] - Product IDs to add/remove from collection.
 */
async function handleCollectionsOperation(args) {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY || process.env.MEDUSA_JWT || process.env.MEDUSA_SESSION_COOKIE || process.env.MEDUSA_COOKIE;

  if (!apiKey || !hasMedusaCredentials()) {
    throw new Error(missingCredentialsMessage());
  }

  const cleanBaseUrl = baseUrl;
  const headers = createHeaders(apiKey);

  switch (args.action) {
    case 'list':
      return await listCollections(cleanBaseUrl, headers, args);
    case 'get':
      return await getCollection(cleanBaseUrl, headers, args);
    case 'create':
      return await createCollection(cleanBaseUrl, headers, args);
    case 'update':
      return await updateCollection(cleanBaseUrl, headers, args);
    case 'delete':
      return await deleteCollection(cleanBaseUrl, headers, args);
    case 'add_products':
      return await addProductsToCollection(cleanBaseUrl, headers, args);
    case 'remove_products':
      return await removeProductsFromCollection(cleanBaseUrl, headers, args);
    case 'list_products':
      return await listCollectionProducts(cleanBaseUrl, headers, args);
    default:
      throw new Error(`Unknown action: ${args.action}`);
  }
}

// Collection operations
async function listCollections(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());
  if (args.q) params.append('q', args.q);
  if (args.title) params.append('title', args.title);
  if (args.handle) params.append('handle', args.handle);
  appendQueryParam(params, 'created_at', args.created_at);
  appendQueryParam(params, 'updated_at', args.updated_at);

  const url = `${baseUrl}/admin/collections?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getCollection(baseUrl, headers, args) {
  if (!args.id) throw new Error('Collection ID is required');
  const url = `${baseUrl}/admin/collections/${args.id}`;
  return await makeRequest(url, { headers });
}

async function createCollection(baseUrl, headers, args) {
  if (!args.title) throw new Error('Collection title is required');
  
  const collectionData = { title: args.title };
  if (args.handle) collectionData.handle = args.handle;
  if (args.metadata) collectionData.metadata = args.metadata;

  const url = `${baseUrl}/admin/collections`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(collectionData)
  });
}

async function updateCollection(baseUrl, headers, args) {
  if (!args.id) throw new Error('Collection ID is required');
  
  const collectionData = {};
  if (args.title) collectionData.title = args.title;
  if (args.handle) collectionData.handle = args.handle;
  if (args.metadata) collectionData.metadata = args.metadata;

  const url = `${baseUrl}/admin/collections/${args.id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(collectionData)
  });
}

async function deleteCollection(baseUrl, headers, args) {
  if (!args.id) throw new Error('Collection ID is required');
  const url = `${baseUrl}/admin/collections/${args.id}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

async function addProductsToCollection(baseUrl, headers, args) {
  if (!args.id) throw new Error('Collection ID is required');
  if (!args.product_ids || !Array.isArray(args.product_ids)) {
    throw new Error('Product IDs array is required');
  }

  const products = [];
  for (const productId of args.product_ids) {
    products.push(await makeRequest(`${baseUrl}/admin/products/${productId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ collection_id: args.id })
    }));
  }
  return { collection_id: args.id, product_ids: args.product_ids, products };
}

async function removeProductsFromCollection(baseUrl, headers, args) {
  if (!args.id) throw new Error('Collection ID is required');
  if (!args.product_ids || !Array.isArray(args.product_ids)) {
    throw new Error('Product IDs array is required');
  }

  const products = [];
  for (const productId of args.product_ids) {
    products.push(await makeRequest(`${baseUrl}/admin/products/${productId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ collection_id: null })
    }));
  }
  return { collection_id: args.id, product_ids: args.product_ids, products };
}

async function listCollectionProducts(baseUrl, headers, args) {
  if (!args.id) throw new Error('Collection ID is required');
  
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());

  params.append('collection_id[]', args.id);

  const url = `${baseUrl}/admin/products?${params.toString()}`;
  return await makeRequest(url, { headers });
}

export const apiTool = {
  definition: {
    name: 'manage_medusa_admin_collections',
    description: 'Comprehensive Medusa Admin collections management tool supporting collection operations (list, get, create, update, delete) and product association management.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'list', 'get', 'create', 'update', 'delete',
            'add_products', 'remove_products', 'list_products'
          ],
          description: 'The action to perform on collections.'
        },
        id: {
          type: 'string',
          description: 'Collection ID (required for get, update, delete, product operations).'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of items to return (default: 20).'
        },
        offset: {
          type: 'number',
          description: 'Number of items to skip (default: 0).'
        },
        q: {
          type: 'string',
          description: 'Search query string.'
        },
        title: {
          type: 'string',
          description: 'Collection title.'
        },
        handle: {
          type: 'string',
          description: 'Collection handle/slug.'
        },
        metadata: {
          type: 'object',
          description: 'Additional collection metadata.'
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
        product_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Product IDs to add/remove from collection.'
        }
      },
      required: ['action']
    }
  },
  function: handleCollectionsOperation
};
