/**
 * Comprehensive Medusa Admin Products Management Tool
 * Supports CRUD operations for products, variants, categories, tags, and types
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
 * Main function to handle all product-related operations.
 *
 * @param {Object} args - Arguments object.
 * @param {string} args.action - The action to perform.
 * @param {string} [args.id] - Product ID (required for get, update, delete, variants operations).
 * @param {number} [args.limit=20] - Maximum number of items to return.
 * @param {number} [args.offset=0] - Number of items to skip.
 * @param {string} [args.q] - Search query.
 * @param {Array} [args.collection_id] - Filter by collection IDs.
 * @param {Array} [args.category_id] - Filter by category IDs.
 * @param {Array} [args.tag_id] - Filter by tag IDs.
 * @param {Array} [args.type_id] - Filter by type IDs.
 * @param {string} [args.status] - Filter by status.
 * @param {string} [args.created_at] - Filter by creation date.
 * @param {string} [args.updated_at] - Filter by update date.
 * @param {string} [args.title] - Product title.
 * @param {string} [args.subtitle] - Product subtitle.
 * @param {string} [args.description] - Product description.
 * @param {string} [args.handle] - Product handle.
 * @param {Array} [args.tags] - Product tags.
 * @param {Array} [args.categories] - Product categories.
 * @param {string} [args.type] - Product type.
 * @param {Array} [args.images] - Product images.
 * @param {Object} [args.metadata] - Additional metadata.
 * @param {Array} [args.variants] - Product variants.
 * @param {Array} [args.options] - Product options.
 * @param {string} [args.variant_id] - Variant ID.
 * @param {Object} [args.variant_data] - Variant data for create/update.
 */
async function handleProductsOperation(args) {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY;

  if (!apiKey) {
    throw new Error('MEDUSA_API_KEY environment variable is required');
  }

  const cleanBaseUrl = baseUrl;
  const headers = createHeaders(apiKey);

  switch (args.action) {
    case 'list':
      return await listProducts(cleanBaseUrl, headers, args);
    case 'get':
      return await getProduct(cleanBaseUrl, headers, args);
    case 'create':
      return await createProduct(cleanBaseUrl, headers, args);
    case 'update':
      return await updateProduct(cleanBaseUrl, headers, args);
    case 'delete':
      return await deleteProduct(cleanBaseUrl, headers, args);
    case 'list_variants':
      return await listProductVariants(cleanBaseUrl, headers, args);
    case 'get_variant':
      return await getProductVariant(cleanBaseUrl, headers, args);
    case 'create_variant':
      return await createProductVariant(cleanBaseUrl, headers, args);
    case 'update_variant':
      return await updateProductVariant(cleanBaseUrl, headers, args);
    case 'delete_variant':
      return await deleteProductVariant(cleanBaseUrl, headers, args);
    case 'list_categories':
      return await listProductCategories(cleanBaseUrl, headers, args);
    case 'get_category':
      return await getProductCategory(cleanBaseUrl, headers, args);
    case 'create_category':
      return await createProductCategory(cleanBaseUrl, headers, args);
    case 'update_category':
      return await updateProductCategory(cleanBaseUrl, headers, args);
    case 'delete_category':
      return await deleteProductCategory(cleanBaseUrl, headers, args);
    case 'list_tags':
      return await listProductTags(cleanBaseUrl, headers, args);
    case 'list_types':
      return await listProductTypes(cleanBaseUrl, headers, args);
    default:
      throw new Error(`Unknown action: ${args.action}`);
  }
}

// Products operations
async function listProducts(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());
  if (args.q) params.append('q', args.q);
  if (args.collection_id) args.collection_id.forEach(id => params.append('collection_id[]', id));
  if (args.category_id) args.category_id.forEach(id => params.append('category_id[]', id));
  if (args.tag_id) args.tag_id.forEach(id => params.append('tag_id[]', id));
  if (args.type_id) args.type_id.forEach(id => params.append('type_id[]', id));
  if (args.status) params.append('status', args.status);
  if (args.created_at) params.append('created_at', args.created_at);
  if (args.updated_at) params.append('updated_at', args.updated_at);

  const url = `${baseUrl}/admin/products?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getProduct(baseUrl, headers, args) {
  if (!args.id) throw new Error('Product ID is required');
  const url = `${baseUrl}/admin/products/${args.id}`;
  return await makeRequest(url, { headers });
}

async function createProduct(baseUrl, headers, args) {
  const productData = {};
  if (args.title) productData.title = args.title;
  if (args.subtitle) productData.subtitle = args.subtitle;
  if (args.description) productData.description = args.description;
  if (args.handle) productData.handle = args.handle;
  if (args.tags) productData.tags = args.tags;
  if (args.categories) productData.categories = args.categories;
  if (args.type) productData.type = args.type;
  if (args.images) productData.images = args.images;
  if (args.metadata) productData.metadata = args.metadata;
  if (args.variants) productData.variants = args.variants;
  if (args.options) productData.options = args.options;

  const url = `${baseUrl}/admin/products`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(productData)
  });
}

async function updateProduct(baseUrl, headers, args) {
  if (!args.id) throw new Error('Product ID is required');
  
  const productData = {};
  if (args.title) productData.title = args.title;
  if (args.subtitle) productData.subtitle = args.subtitle;
  if (args.description) productData.description = args.description;
  if (args.handle) productData.handle = args.handle;
  if (args.tags) productData.tags = args.tags;
  if (args.categories) productData.categories = args.categories;
  if (args.type) productData.type = args.type;
  if (args.images) productData.images = args.images;
  if (args.metadata) productData.metadata = args.metadata;
  if (args.status) productData.status = args.status;

  const url = `${baseUrl}/admin/products/${args.id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(productData)
  });
}

async function deleteProduct(baseUrl, headers, args) {
  if (!args.id) throw new Error('Product ID is required');
  const url = `${baseUrl}/admin/products/${args.id}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

// Product variants operations
async function listProductVariants(baseUrl, headers, args) {
  if (!args.id) throw new Error('Product ID is required');
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());

  const url = `${baseUrl}/admin/products/${args.id}/variants?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getProductVariant(baseUrl, headers, args) {
  if (!args.id) throw new Error('Product ID is required');
  if (!args.variant_id) throw new Error('Variant ID is required');
  const url = `${baseUrl}/admin/products/${args.id}/variants/${args.variant_id}`;
  return await makeRequest(url, { headers });
}

async function createProductVariant(baseUrl, headers, args) {
  if (!args.id) throw new Error('Product ID is required');
  if (!args.variant_data) throw new Error('Variant data is required');

  const url = `${baseUrl}/admin/products/${args.id}/variants`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(args.variant_data)
  });
}

async function updateProductVariant(baseUrl, headers, args) {
  if (!args.id) throw new Error('Product ID is required');
  if (!args.variant_id) throw new Error('Variant ID is required');
  if (!args.variant_data) throw new Error('Variant data is required');

  const url = `${baseUrl}/admin/products/${args.id}/variants/${args.variant_id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(args.variant_data)
  });
}

async function deleteProductVariant(baseUrl, headers, args) {
  if (!args.id) throw new Error('Product ID is required');
  if (!args.variant_id) throw new Error('Variant ID is required');
  const url = `${baseUrl}/admin/products/${args.id}/variants/${args.variant_id}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

// Product categories operations
async function listProductCategories(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());
  if (args.q) params.append('q', args.q);

  const url = `${baseUrl}/admin/product-categories?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getProductCategory(baseUrl, headers, args) {
  if (!args.id) throw new Error('Category ID is required');
  const url = `${baseUrl}/admin/product-categories/${args.id}`;
  return await makeRequest(url, { headers });
}

async function createProductCategory(baseUrl, headers, args) {
  if (!args.title) throw new Error('Category title is required');
  
  const categoryData = { name: args.title };
  if (args.description) categoryData.description = args.description;
  if (args.handle) categoryData.handle = args.handle;
  if (args.metadata) categoryData.metadata = args.metadata;

  const url = `${baseUrl}/admin/product-categories`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(categoryData)
  });
}

async function updateProductCategory(baseUrl, headers, args) {
  if (!args.id) throw new Error('Category ID is required');
  
  const categoryData = {};
  if (args.title) categoryData.name = args.title;
  if (args.description) categoryData.description = args.description;
  if (args.handle) categoryData.handle = args.handle;
  if (args.metadata) categoryData.metadata = args.metadata;

  const url = `${baseUrl}/admin/product-categories/${args.id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(categoryData)
  });
}

async function deleteProductCategory(baseUrl, headers, args) {
  if (!args.id) throw new Error('Category ID is required');
  const url = `${baseUrl}/admin/product-categories/${args.id}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

// Product tags operations
async function listProductTags(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());
  if (args.q) params.append('q', args.q);

  const url = `${baseUrl}/admin/product-tags?${params.toString()}`;
  return await makeRequest(url, { headers });
}

// Product types operations
async function listProductTypes(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());
  if (args.q) params.append('q', args.q);

  const url = `${baseUrl}/admin/product-types?${params.toString()}`;
  return await makeRequest(url, { headers });
}

export const apiTool = {
  definition: {
    name: 'manage_medusa_admin_products',
    description: 'Comprehensive Medusa Admin products management tool supporting product operations (list, get, create, update, delete), variant management, and category operations.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'list', 'get', 'create', 'update', 'delete',
            'list_variants', 'get_variant', 'create_variant', 'update_variant', 'delete_variant',
            'list_categories', 'get_category', 'create_category', 'update_category', 'delete_category',
            'list_tags', 'list_types'
          ],
          description: 'The action to perform on products.'
        },
        id: {
          type: 'string',
          description: 'Product/Category ID (required for get, update, delete, variants operations).'
        },
        variant_id: {
          type: 'string',
          description: 'Product variant ID (required for variant-specific operations).'
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
        collection_id: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by collection IDs.'
        },
        category_id: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by category IDs.'
        },
        tag_id: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tag IDs.'
        },
        type_id: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by type IDs.'
        },
        status: {
          type: 'string',
          description: 'Filter by product status.'
        },
        created_at: {
          type: 'string',
          description: 'Filter by creation date.'
        },
        updated_at: {
          type: 'string',
          description: 'Filter by update date.'
        },
        title: {
          type: 'string',
          description: 'Product title.'
        },
        subtitle: {
          type: 'string',
          description: 'Product subtitle.'
        },
        description: {
          type: 'string',
          description: 'Product description.'
        },
        handle: {
          type: 'string',
          description: 'Product handle/slug.'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Product tags.'
        },
        categories: {
          type: 'array',
          items: { type: 'string' },
          description: 'Product categories.'
        },
        type: {
          type: 'string',
          description: 'Product type.'
        },
        images: {
          type: 'array',
          items: { type: 'object' },
          description: 'Product images.'
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata.'
        },
        variants: {
          type: 'array',
          items: { type: 'object' },
          description: 'Product variants.'
        },
        options: {
          type: 'array',
          items: { type: 'object' },
          description: 'Product options.'
        },
        variant_data: {
          type: 'object',
          description: 'Variant data for create/update operations.'
        }
      },
      required: ['action']
    }
  },
  function: handleProductsOperation
};