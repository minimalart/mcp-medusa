/**
 * Comprehensive Medusa Admin Products Management Tool
 * Supports CRUD operations for products, variants, categories, tags, and types
 *
 * Rutas agregadas en 1.9 (todas presentes desde Medusa 2.17.2, incluida 2.18.0, hasta 2.21.2):
 *   GET|POST /admin/product-tags                                     listar / crear
 *   GET|POST|DELETE /admin/product-tags/{id}
 *   GET|POST /admin/product-types                                    listar / crear
 *   GET|POST|DELETE /admin/product-types/{id}
 *   GET    /admin/product-variants                                    variantes de todos los productos
 *   POST   /admin/products/batch                                      { create, update, delete }
 *   POST   /admin/products/{id}/variants/batch                        { create, update, delete }
 *   POST   /admin/products/{id}/variants/{variant_id}/images/batch    { add, remove } (image IDs)
 *   POST   /admin/products/{id}/images/{image_id}/variants/batch      { add, remove } (variant IDs)
 *   POST   /admin/products/{id}/variants/{variant_id}/inventory-items  { inventory_item_id, required_quantity }
 *   POST|DELETE /admin/products/{id}/variants/{variant_id}/inventory-items/{inventory_item_id}
 *   POST   /admin/products/{id}/variants/inventory-items/batch        { create, update, delete }
 *   POST   /admin/product-categories/{id}/products                    { add, remove } (product IDs)
 *   POST   /admin/products/export                                     CSV asíncrono (filtros en query)
 *   POST   /admin/products/import                                     multipart `file` (deprecado, sigue vigente)
 *   POST   /admin/products/import/{transaction_id}/confirm            confirma el import anterior
 *   POST   /admin/products/imports                                    { file_key, originalname, extension, size, mime_type }
 *   POST   /admin/products/imports/{transaction_id}/confirm           confirma el import anterior
 */

import { appendQueryParam, buildMultipartBody, createHeaders, filePartFromArgs, hasMedusaCredentials, makeRequest, missingCredentialsMessage, normalizeBaseUrl } from "../../lib/medusa-client.js";
import { withMedusaErrorHints } from "../../lib/medusa-version.js";

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
  const apiKey = process.env.MEDUSA_API_KEY || process.env.MEDUSA_JWT || process.env.MEDUSA_SESSION_COOKIE || process.env.MEDUSA_COOKIE;

  if (!hasMedusaCredentials()) {
    throw new Error(missingCredentialsMessage());
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
    case 'get_tag':
    case 'create_tag':
    case 'update_tag':
    case 'delete_tag':
    case 'get_type':
    case 'create_type':
    case 'update_type':
    case 'delete_type':
      return await tagOrTypeOperation(cleanBaseUrl, headers, args);
    case 'list_all_variants':
      return await listAllVariants(cleanBaseUrl, headers, args);
    case 'batch':
      return await batchProducts(cleanBaseUrl, headers, args);
    case 'batch_variants':
      return await batchVariants(cleanBaseUrl, headers, args);
    case 'batch_variant_images':
    case 'batch_image_variants':
    case 'update_category_products':
      return await linkOperation(cleanBaseUrl, headers, args);
    case 'link_variant_inventory_item':
    case 'update_variant_inventory_item':
    case 'unlink_variant_inventory_item':
      return await variantInventoryItemOperation(cleanBaseUrl, headers, args);
    case 'batch_variant_inventory_items':
      return await batchVariantInventoryItems(cleanBaseUrl, headers, args);
    case 'export':
      return await exportProducts(cleanBaseUrl, headers, args);
    case 'import_csv':
      return await importProductsCsv(cleanBaseUrl, headers, args);
    case 'create_import':
      return await createProductImport(cleanBaseUrl, headers, args);
    case 'confirm_import':
    case 'confirm_csv_import':
      return await confirmProductImport(cleanBaseUrl, headers, args);
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
  if (args.status) {
    const statuses = Array.isArray(args.status) ? args.status : [args.status];
    statuses.forEach(status => params.append('status[]', status));
  }
  appendQueryParam(params, 'created_at', args.created_at);
  appendQueryParam(params, 'updated_at', args.updated_at);

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

// ---------------------------------------------------------------------------
// Tags, types, batch, variant links, import/export (rutas en el header)
// ---------------------------------------------------------------------------

function pickDefined(source, keys) {
  const out = {};
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

function withQuery(url, query = {}) {
  const target = new URL(url);
  Object.entries(query).forEach(([key, value]) => appendQueryParam(target.searchParams, key, value));
  return target.toString();
}

function postJson(url, headers, body) {
  return makeRequest(url, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}

function batchBody(args) {
  const body = pickDefined(args, ['create', 'update', 'delete']);
  if (Object.keys(body).length === 0) {
    throw new Error('At least one of create, update or delete (arrays) is required for batch actions.');
  }
  return body;
}

function linkBody(args) {
  const body = pickDefined(args, ['add', 'remove']);
  if (!Array.isArray(body.add) && !Array.isArray(body.remove)) {
    throw new Error('add and/or remove (arrays of IDs) are required for this action.');
  }
  return body;
}

const TAG_TYPE_CONFIG = {
  tag: { path: '/admin/product-tags', label: 'Product tag' },
  type: { path: '/admin/product-types', label: 'Product type' }
};

async function tagOrTypeOperation(baseUrl, headers, args) {
  const [verb, kind] = args.action.split('_');
  const config = TAG_TYPE_CONFIG[kind];
  const body = pickDefined(args, ['value', 'external_id', 'metadata']);

  if (verb === 'create') {
    if (!args.value) throw new Error(`value is required for create_${kind}`);
    return await postJson(`${baseUrl}${config.path}`, headers, body);
  }

  if (!args.id) throw new Error(`${config.label} ID (id) is required`);
  const url = `${baseUrl}${config.path}/${encodeURIComponent(args.id)}`;
  if (verb === 'get') return await makeRequest(withQuery(url, { fields: args.fields }), { method: 'GET', headers });
  if (verb === 'update') return await postJson(url, headers, body);
  return await makeRequest(url, { method: 'DELETE', headers });
}

/** Variantes de todos los productos (búsqueda por SKU/EAN/barcode). */
async function listAllVariants(baseUrl, headers, args) {
  const url = withQuery(`${baseUrl}/admin/product-variants`, {
    limit: args.limit,
    offset: args.offset,
    q: args.q,
    sku: args.sku,
    fields: args.fields,
    ...(args.query || {})
  });
  return await makeRequest(url, { method: 'GET', headers });
}

async function batchProducts(baseUrl, headers, args) {
  return await postJson(`${baseUrl}/admin/products/batch`, headers, batchBody(args));
}

async function batchVariants(baseUrl, headers, args) {
  if (!args.id) throw new Error('Product ID is required');
  return await postJson(`${baseUrl}/admin/products/${encodeURIComponent(args.id)}/variants/batch`, headers, batchBody(args));
}

async function linkOperation(baseUrl, headers, args) {
  if (!args.id) throw new Error(args.action === 'update_category_products' ? 'Category ID is required' : 'Product ID is required');
  const id = encodeURIComponent(args.id);
  let path;
  if (args.action === 'batch_variant_images') {
    if (!args.variant_id) throw new Error('Variant ID is required');
    path = `/admin/products/${id}/variants/${encodeURIComponent(args.variant_id)}/images/batch`;
  } else if (args.action === 'batch_image_variants') {
    if (!args.image_id) throw new Error('image_id is required');
    path = `/admin/products/${id}/images/${encodeURIComponent(args.image_id)}/variants/batch`;
  } else {
    path = `/admin/product-categories/${id}/products`;
  }
  return await postJson(`${baseUrl}${path}`, headers, linkBody(args));
}

async function variantInventoryItemOperation(baseUrl, headers, args) {
  if (!args.id) throw new Error('Product ID is required');
  if (!args.variant_id) throw new Error('Variant ID is required');
  if (!args.inventory_item_id) throw new Error('inventory_item_id is required');
  const base = `${baseUrl}/admin/products/${encodeURIComponent(args.id)}/variants/${encodeURIComponent(args.variant_id)}/inventory-items`;

  if (args.action === 'link_variant_inventory_item') {
    if (typeof args.required_quantity !== 'number') throw new Error('required_quantity (number) is required');
    return await postJson(base, headers, { inventory_item_id: args.inventory_item_id, required_quantity: args.required_quantity });
  }
  const url = `${base}/${encodeURIComponent(args.inventory_item_id)}`;
  if (args.action === 'update_variant_inventory_item') {
    if (typeof args.required_quantity !== 'number') throw new Error('required_quantity (number) is required');
    return await postJson(url, headers, { required_quantity: args.required_quantity });
  }
  return await makeRequest(url, { method: 'DELETE', headers });
}

async function batchVariantInventoryItems(baseUrl, headers, args) {
  if (!args.id) throw new Error('Product ID is required');
  return await postJson(
    `${baseUrl}/admin/products/${encodeURIComponent(args.id)}/variants/inventory-items/batch`,
    headers,
    batchBody(args)
  );
}

/**
 * Export asíncrono a CSV: los filtros van por query string (mismos que list) y el
 * archivo llega como notificación del admin cuando termina el workflow.
 */
async function exportProducts(baseUrl, headers, args) {
  const url = withQuery(`${baseUrl}/admin/products/export`, {
    q: args.q,
    collection_id: args.collection_id,
    category_id: args.category_id,
    tag_id: args.tag_id,
    type_id: args.type_id,
    status: args.status === undefined || Array.isArray(args.status) ? args.status : [args.status],
    created_at: args.created_at,
    updated_at: args.updated_at,
    fields: args.fields,
    ...(args.query || {})
  });
  return await postJson(url, headers, {});
}

/** POST /admin/products/import (multipart `file`, CSV de Medusa). Devuelve transaction_id + summary. */
async function importProductsCsv(baseUrl, headers, args) {
  if (!args.file) throw new Error('file is required: { filename, content (CSV text) | content_base64, mime_type? }');
  const part = filePartFromArgs({ mime_type: 'text/csv', ...args.file }, 'file');
  const { body, contentType } = buildMultipartBody([part]);
  return await makeRequest(`${baseUrl}/admin/products/import`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': contentType },
    body
  });
}

/** POST /admin/products/imports con un archivo ya subido (file_key). */
async function createProductImport(baseUrl, headers, args) {
  const body = pickDefined(args, ['file_key', 'originalname', 'extension', 'size', 'mime_type']);
  const missing = ['file_key', 'originalname', 'extension', 'size', 'mime_type'].filter((key) => body[key] === undefined);
  if (missing.length > 0) throw new Error(`create_import requires ${missing.join(', ')}`);
  return await postJson(`${baseUrl}/admin/products/imports`, headers, body);
}

async function confirmProductImport(baseUrl, headers, args) {
  if (!args.transaction_id) throw new Error('transaction_id (returned by import_csv / create_import) is required');
  const transactionId = encodeURIComponent(args.transaction_id);
  const url = args.action === 'confirm_csv_import'
    ? `${baseUrl}/admin/products/import/${transactionId}/confirm`
    : `${baseUrl}/admin/products/imports/${transactionId}/confirm`;
  return await postJson(url, headers, {});
}

const ACTIONS = [
  'list', 'get', 'create', 'update', 'delete', 'batch', 'export',
  'import_csv', 'confirm_csv_import', 'create_import', 'confirm_import',
  'list_variants', 'get_variant', 'create_variant', 'update_variant', 'delete_variant', 'batch_variants', 'list_all_variants',
  'batch_variant_images', 'batch_image_variants',
  'link_variant_inventory_item', 'update_variant_inventory_item', 'unlink_variant_inventory_item', 'batch_variant_inventory_items',
  'list_categories', 'get_category', 'create_category', 'update_category', 'delete_category', 'update_category_products',
  'list_tags', 'get_tag', 'create_tag', 'update_tag', 'delete_tag',
  'list_types', 'get_type', 'create_type', 'update_type', 'delete_type'
];

export const apiTool = {
  definition: {
    name: 'manage_medusa_admin_products',
    description:
      'Medusa Admin products (Medusa 2.17.2+, incl. 2.18 and 2.21.1): products (list, get, create, update, delete), variants, categories, tags and types. ' +
      'Tags/types: list_tags/list_types, get/create/update/delete_tag and _type (id; value, external_id, metadata). list_all_variants searches variants of every product (q, sku). ' +
      'Bulk: batch ({create, update, delete} products), batch_variants (id + {create, update, delete}), batch_variant_images (id + variant_id + {add, remove} image IDs), batch_image_variants (id + image_id + {add, remove} variant IDs), update_category_products (category id + {add, remove} product IDs). ' +
      'Variant inventory: link_variant_inventory_item (id, variant_id, inventory_item_id, required_quantity), update_variant_inventory_item, unlink_variant_inventory_item, batch_variant_inventory_items (id + {create, update, delete} of {variant_id, inventory_item_id, required_quantity}). ' +
      'export: asynchronous CSV export of the products matching the list filters (returns transaction_id; the file arrives as an admin notification). ' +
      'Import (bulk-creates/updates the catalog): import_csv (file {filename, content CSV text or content_base64}) or create_import (file_key of a file uploaded with manage_medusa_admin_v2 + originalname, extension, size, mime_type) returns a transaction_id and a summary; NOTHING is written until confirm_csv_import / confirm_import (transaction_id) is called, so show the summary to the user and confirm first.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ACTIONS,
          description: 'The action to perform on products.'
        },
        id: {
          type: 'string',
          description: 'Product ID, or Category / Tag / Type ID for category, tag and type actions.'
        },
        variant_id: {
          type: 'string',
          description: 'Product variant ID (required for variant-specific operations).'
        },
        image_id: {
          type: 'string',
          description: 'Product image ID (batch_image_variants).'
        },
        inventory_item_id: {
          type: 'string',
          description: 'Inventory item ID (variant inventory actions).'
        },
        required_quantity: {
          type: 'number',
          description: 'Units of the inventory item consumed per variant unit (link/update_variant_inventory_item).'
        },
        value: {
          type: 'string',
          description: 'Tag or type value (create/update_tag, create/update_type).'
        },
        external_id: {
          type: 'string',
          description: 'External ID for tags/types.'
        },
        create: {
          type: 'array',
          items: { type: 'object' },
          description: 'batch actions: records to create.'
        },
        update: {
          type: 'array',
          items: { type: 'object' },
          description: 'batch actions: records to update (each with id, or variant_id + inventory_item_id).'
        },
        delete: {
          type: 'array',
          items: {},
          description: 'batch actions: IDs to delete (batch_variant_inventory_items: [{ variant_id, inventory_item_id }]).'
        },
        add: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs to link (batch_variant_images, batch_image_variants, update_category_products).'
        },
        remove: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs to unlink (batch_variant_images, batch_image_variants, update_category_products).'
        },
        sku: {
          type: 'string',
          description: 'SKU filter for list_all_variants.'
        },
        fields: {
          type: 'string',
          description: 'Fields selector (list_all_variants, get_tag, get_type, export).'
        },
        query: {
          type: 'object',
          description: 'Extra query filters (list_all_variants, export).'
        },
        file: {
          type: 'object',
          description: 'import_csv: { filename, content (CSV text) | content_base64, mime_type? } in the Medusa product import CSV format.'
        },
        file_key: { type: 'string', description: 'create_import: key of the uploaded file (id returned by manage_medusa_admin_v2 upload_files, or filename returned by create_upload_presigned_url).' },
        originalname: { type: 'string', description: 'create_import: original file name.' },
        extension: { type: 'string', description: 'create_import: file extension, e.g. csv.' },
        size: { type: 'number', description: 'create_import: file size in bytes.' },
        mime_type: { type: 'string', description: 'create_import: file MIME type, e.g. text/csv.' },
        transaction_id: {
          type: 'string',
          description: 'Import transaction ID (confirm_import, confirm_csv_import).'
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
          oneOf: [
            { type: 'string' },
            { type: 'array', items: { type: 'string' } }
          ],
          description: 'Filter by product status. Medusa v2 expects this as an array; a string is accepted and normalized.'
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
  function: withMedusaErrorHints(handleProductsOperation)
};
