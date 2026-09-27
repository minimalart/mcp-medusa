/**
 * Comprehensive Medusa Admin Inventory Management Tool
 * Supports inventory items, stock locations, and reservation management
 *
 * Versiones:
 *   - unit_of_measure y cantidades fraccionarias: Medusa >= 2.20 (en 2.18 el
 *     validador estricto rechaza unit_of_measure, por eso sólo se envía si viene).
 *   - POST /admin/inventory-items/export: Medusa >= 2.19.
 */

import { appendQueryParam, createHeaders, hasMedusaCredentials, makeRequest, missingCredentialsMessage, normalizeBaseUrl } from "../../lib/medusa-client.js";
import { sentGatedFields, withGatedFields, withMedusaErrorHints, withMinVersion } from "../../lib/medusa-version.js";

// Campos de inventory item que sólo existen desde cierta versión de Medusa.
const INVENTORY_ITEM_GATED_FIELDS = { unit_of_measure: '2.20' };

/**
 * Campos adicionales de inventory item (presentes en el validador desde 2.17.2,
 * salvo unit_of_measure). Sólo se envían si el caller los pasa.
 */
function applyOptionalItemFields(itemData, args, { allowLocationLevels = false } = {}) {
  for (const key of ['title', 'description', 'thumbnail', 'unit_of_measure']) {
    if (args[key] !== undefined) itemData[key] = args[key];
  }
  if (args.requires_shipping !== undefined) itemData.requires_shipping = args.requires_shipping;
  if (allowLocationLevels && Array.isArray(args.location_levels)) itemData.location_levels = args.location_levels;
  return itemData;
}

/**
 * Main function to handle all inventory-related operations.
 */
async function handleInventoryOperation(args) {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY || process.env.MEDUSA_JWT || process.env.MEDUSA_SESSION_COOKIE || process.env.MEDUSA_COOKIE;
  
  if (!apiKey || !hasMedusaCredentials()) {
    throw new Error(missingCredentialsMessage());
  }

  const headers = createHeaders(apiKey);

  switch (args.action) {
    case 'list_items':
      return await listInventoryItems(baseUrl, headers, args);
    case 'get_item':
      return await getInventoryItem(baseUrl, headers, args);
    case 'create_item':
      return await createInventoryItem(baseUrl, headers, args);
    case 'update_item':
      return await updateInventoryItem(baseUrl, headers, args);
    case 'delete_item':
      return await deleteInventoryItem(baseUrl, headers, args);
    case 'export_items':
      return await exportInventoryItems(baseUrl, headers, args);
    case 'list_locations':
      return await listStockLocations(baseUrl, headers, args);
    case 'get_location':
      return await getStockLocation(baseUrl, headers, args);
    case 'create_location':
      return await createStockLocation(baseUrl, headers, args);
    case 'update_location':
      return await updateStockLocation(baseUrl, headers, args);
    case 'delete_location':
      return await deleteStockLocation(baseUrl, headers, args);
    case 'list_levels':
      return await listInventoryLevels(baseUrl, headers, args);
    case 'update_level':
      return await updateInventoryLevel(baseUrl, headers, args);
    case 'list_reservations':
      return await listReservations(baseUrl, headers, args);
    case 'create_reservation':
      return await createReservation(baseUrl, headers, args);
    case 'update_reservation':
      return await updateReservation(baseUrl, headers, args);
    case 'delete_reservation':
      return await deleteReservation(baseUrl, headers, args);
    default:
      throw new Error(`Unknown action: ${args.action}`);
  }
}

// Inventory Items operations
async function listInventoryItems(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());
  if (args.q) params.append('q', args.q);
  if (args.sku) params.append('sku', args.sku);
  if (args.origin_country) params.append('origin_country', args.origin_country);

  const url = `${baseUrl}/admin/inventory-items?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getInventoryItem(baseUrl, headers, args) {
  if (!args.id) throw new Error('Inventory item ID is required');
  const url = `${baseUrl}/admin/inventory-items/${args.id}`;
  return await makeRequest(url, { headers });
}

async function createInventoryItem(baseUrl, headers, args) {
  const itemData = {};
  if (args.sku) itemData.sku = args.sku;
  if (args.origin_country) itemData.origin_country = args.origin_country;
  if (args.hs_code) itemData.hs_code = args.hs_code;
  if (args.mid_code) itemData.mid_code = args.mid_code;
  if (args.material) itemData.material = args.material;
  if (args.weight) itemData.weight = args.weight;
  if (args.length) itemData.length = args.length;
  if (args.height) itemData.height = args.height;
  if (args.width) itemData.width = args.width;
  if (args.metadata) itemData.metadata = args.metadata;
  applyOptionalItemFields(itemData, args, { allowLocationLevels: true });

  const url = `${baseUrl}/admin/inventory-items`;
  return await withGatedFields(sentGatedFields(itemData, INVENTORY_ITEM_GATED_FIELDS), () => makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(itemData)
  }));
}

async function updateInventoryItem(baseUrl, headers, args) {
  if (!args.id) throw new Error('Inventory item ID is required');
  
  const itemData = {};
  if (args.sku) itemData.sku = args.sku;
  if (args.origin_country) itemData.origin_country = args.origin_country;
  if (args.hs_code) itemData.hs_code = args.hs_code;
  if (args.mid_code) itemData.mid_code = args.mid_code;
  if (args.material) itemData.material = args.material;
  if (args.weight) itemData.weight = args.weight;
  if (args.length) itemData.length = args.length;
  if (args.height) itemData.height = args.height;
  if (args.width) itemData.width = args.width;
  if (args.metadata) itemData.metadata = args.metadata;
  applyOptionalItemFields(itemData, args);

  const url = `${baseUrl}/admin/inventory-items/${args.id}`;
  return await withGatedFields(sentGatedFields(itemData, INVENTORY_ITEM_GATED_FIELDS), () => makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(itemData)
  }));
}

/**
 * Exporta inventory items a CSV de forma asíncrona (Medusa >= 2.19).
 * POST /admin/inventory-items/export → 202 { transaction_id }. Los filtros van por
 * query string (mismos que list_items); el archivo se entrega como notificación
 * en el admin cuando el workflow termina.
 */
async function exportInventoryItems(baseUrl, headers, args) {
  const url = new URL(`${baseUrl}/admin/inventory-items/export`);
  const filters = { q: args.q, sku: args.sku, origin_country: args.origin_country, ...(args.query || {}) };
  Object.entries(filters).forEach(([key, value]) => appendQueryParam(url.searchParams, key, value));
  return await withMinVersion('2.19', () => makeRequest(url.toString(), {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  }));
}

async function deleteInventoryItem(baseUrl, headers, args) {
  if (!args.id) throw new Error('Inventory item ID is required');
  const url = `${baseUrl}/admin/inventory-items/${args.id}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

// Stock Locations operations
async function listStockLocations(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());
  if (args.q) params.append('q', args.q);
  if (args.name) params.append('name', args.name);

  const url = `${baseUrl}/admin/stock-locations?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getStockLocation(baseUrl, headers, args) {
  if (!args.location_id) throw new Error('Stock location ID is required');
  const url = `${baseUrl}/admin/stock-locations/${args.location_id}`;
  return await makeRequest(url, { headers });
}

async function createStockLocation(baseUrl, headers, args) {
  if (!args.name) throw new Error('Stock location name is required');
  
  const locationData = { name: args.name };
  if (args.address) locationData.address = args.address;
  if (args.metadata) locationData.metadata = args.metadata;

  const url = `${baseUrl}/admin/stock-locations`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(locationData)
  });
}

async function updateStockLocation(baseUrl, headers, args) {
  if (!args.location_id) throw new Error('Stock location ID is required');
  
  const locationData = {};
  if (args.name) locationData.name = args.name;
  if (args.address) locationData.address = args.address;
  if (args.metadata) locationData.metadata = args.metadata;

  const url = `${baseUrl}/admin/stock-locations/${args.location_id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(locationData)
  });
}

async function deleteStockLocation(baseUrl, headers, args) {
  if (!args.location_id) throw new Error('Stock location ID is required');
  const url = `${baseUrl}/admin/stock-locations/${args.location_id}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

// Inventory Levels operations
async function listInventoryLevels(baseUrl, headers, args) {
  if (!args.inventory_item_id) {
    throw new Error('inventory_item_id is required for list_levels in Medusa v2.');
  }

  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());
  if (args.location_id) params.append('location_id', args.location_id);

  const url = `${baseUrl}/admin/inventory-items/${args.inventory_item_id}/location-levels?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function updateInventoryLevel(baseUrl, headers, args) {
  if (!args.inventory_item_id) throw new Error('Inventory item ID is required');
  if (!args.location_id) throw new Error('Location ID is required');
  
  const levelData = {};
  if (args.stocked_quantity !== undefined) levelData.stocked_quantity = args.stocked_quantity;
  if (args.incoming_quantity !== undefined) levelData.incoming_quantity = args.incoming_quantity;

  const url = `${baseUrl}/admin/inventory-items/${args.inventory_item_id}/location-levels/${args.location_id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(levelData)
  });
}

// Reservations operations
async function listReservations(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());
  if (args.inventory_item_id) params.append('inventory_item_id', args.inventory_item_id);
  if (args.location_id) params.append('location_id', args.location_id);
  if (args.line_item_id) params.append('line_item_id', args.line_item_id);

  const url = `${baseUrl}/admin/reservations?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function createReservation(baseUrl, headers, args) {
  if (!args.inventory_item_id) throw new Error('Inventory item ID is required');
  if (!args.location_id) throw new Error('Location ID is required');
  if (!args.quantity) throw new Error('Quantity is required');
  
  const reservationData = {
    inventory_item_id: args.inventory_item_id,
    location_id: args.location_id,
    quantity: args.quantity
  };
  if (args.line_item_id) reservationData.line_item_id = args.line_item_id;
  if (args.description) reservationData.description = args.description;
  if (args.metadata) reservationData.metadata = args.metadata;

  const url = `${baseUrl}/admin/reservations`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(reservationData)
  });
}

async function updateReservation(baseUrl, headers, args) {
  if (!args.reservation_id) throw new Error('Reservation ID is required');
  
  const reservationData = {};
  if (args.quantity !== undefined) reservationData.quantity = args.quantity;
  if (args.description) reservationData.description = args.description;
  if (args.metadata) reservationData.metadata = args.metadata;

  const url = `${baseUrl}/admin/reservations/${args.reservation_id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(reservationData)
  });
}

async function deleteReservation(baseUrl, headers, args) {
  if (!args.reservation_id) throw new Error('Reservation ID is required');
  const url = `${baseUrl}/admin/reservations/${args.reservation_id}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

export const apiTool = {
  definition: {
    name: 'manage_medusa_admin_inventory',
    description:
      'Medusa Admin inventory (Medusa 2.17.2+, incl. 2.18 and 2.21.1): inventory items, stock locations, location levels and reservations. ' +
      'create_item/update_item accept sku, title, description, thumbnail, requires_shipping, dimensions, codes, metadata, location_levels (create) and unit_of_measure (Medusa >= 2.20, only sent when provided). ' +
      'Quantities (stocked_quantity, incoming_quantity, reservation quantity) can be fractional on Medusa >= 2.20 (e.g. 1.5 kg with unit_of_measure "kg"); use integers on older stores. ' +
      'export_items (Medusa >= 2.19) starts an asynchronous CSV export (returns transaction_id; the file arrives as an admin notification).',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'list_items', 'get_item', 'create_item', 'update_item', 'delete_item', 'export_items',
            'list_locations', 'get_location', 'create_location', 'update_location', 'delete_location',
            'list_levels', 'update_level',
            'list_reservations', 'create_reservation', 'update_reservation', 'delete_reservation'
          ],
          description: 'The action to perform on inventory.'
        },
        id: {
          type: 'string',
          description: 'Inventory item ID.'
        },
        location_id: {
          type: 'string',
          description: 'Stock location ID.'
        },
        reservation_id: {
          type: 'string',
          description: 'Reservation ID.'
        },
        inventory_item_id: {
          type: 'string',
          description: 'Inventory item ID for levels/reservations.'
        },
        line_item_id: {
          type: 'string',
          description: 'Line item ID for reservations.'
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
        sku: {
          type: 'string',
          description: 'Inventory item SKU.'
        },
        name: {
          type: 'string',
          description: 'Stock location name.'
        },
        origin_country: {
          type: 'string',
          description: 'Origin country code.'
        },
        hs_code: {
          type: 'string',
          description: 'Harmonized System code.'
        },
        mid_code: {
          type: 'string',
          description: 'MID code.'
        },
        material: {
          type: 'string',
          description: 'Item material.'
        },
        weight: {
          type: 'number',
          description: 'Item weight.'
        },
        length: {
          type: 'number',
          description: 'Item length.'
        },
        height: {
          type: 'number',
          description: 'Item height.'
        },
        width: {
          type: 'number',
          description: 'Item width.'
        },
        address: {
          type: 'object',
          description: 'Location address.'
        },
        stocked_quantity: {
          type: 'number',
          description: 'Stocked quantity (fractional values need Medusa >= 2.20).'
        },
        incoming_quantity: {
          type: 'number',
          description: 'Incoming quantity (fractional values need Medusa >= 2.20).'
        },
        quantity: {
          type: 'number',
          description: 'Reservation quantity (fractional values need Medusa >= 2.20).'
        },
        description: {
          type: 'string',
          description: 'Reservation description, or inventory item description (create_item/update_item).'
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata.'
        },
        title: {
          type: 'string',
          description: 'Inventory item title (create_item/update_item).'
        },
        thumbnail: {
          type: 'string',
          description: 'Inventory item thumbnail URL (create_item/update_item).'
        },
        requires_shipping: {
          type: 'boolean',
          description: 'Whether the inventory item requires shipping (create_item/update_item).'
        },
        unit_of_measure: {
          type: 'string',
          description: 'Unit of measure, e.g. "kg", "m", "l" (create_item/update_item). Requires Medusa >= 2.20; only sent when provided.'
        },
        location_levels: {
          type: 'array',
          items: { type: 'object' },
          description: 'create_item: initial stock per location, [{ location_id, stocked_quantity?, incoming_quantity? }].'
        },
        query: {
          type: 'object',
          description: 'export_items: additional inventory list filters sent as query params (e.g. { "location_levels": { "location_id": "sloc_..." } }).'
        }
      },
      required: ['action']
    }
  },
  function: withMedusaErrorHints(handleInventoryOperation)
};
