/**
 * Comprehensive Medusa Admin Regions & Shipping Management Tool
 * Supports regions, shipping options, profiles, and fulfillment management
 *
 * Fulfillment sets en Medusa v2 (rutas presentes desde 2.17.2, incluida 2.18.0):
 *   POST   /admin/stock-locations/{location_id}/fulfillment-sets      crear (pertenecen a una stock location)
 *   DELETE /admin/fulfillment-sets/{id}
 *   POST   /admin/fulfillment-sets/{id}/service-zones                 crear service zone
 *   GET|POST|DELETE /admin/fulfillment-sets/{id}/service-zones/{zone_id}
 * No hay GET /admin/fulfillment-sets ni POST /admin/fulfillment-sets[/{id}]: el listado
 * se arma leyendo `fulfillment_sets` desde las stock locations.
 */

import { appendQueryParam, createHeaders, hasMedusaCredentials, makeRequest, missingCredentialsMessage, normalizeBaseUrl } from "../../lib/medusa-client.js";
import { withMedusaErrorHints } from "../../lib/medusa-version.js";

const REMOVED_ACTIONS = {
  update_fulfillment_set:
    'update_fulfillment_set was removed: Medusa v2 has no route to update a fulfillment set. Delete it and create a new one ' +
    '(create_fulfillment_set with location_id), or edit its service zones with update_service_zone.'
};

const FULFILLMENT_SET_FIELDS = [
  'id',
  'name',
  '*fulfillment_sets',
  '*fulfillment_sets.service_zones',
  '*fulfillment_sets.service_zones.geo_zones'
].join(',');

async function handleRegionsOperation(args) {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY || process.env.MEDUSA_JWT || process.env.MEDUSA_SESSION_COOKIE || process.env.MEDUSA_COOKIE;

  if (REMOVED_ACTIONS[args.action]) {
    return { error: REMOVED_ACTIONS[args.action], removed: true };
  }

  if (!apiKey || !hasMedusaCredentials()) {
    throw new Error(missingCredentialsMessage());
  }

  const headers = createHeaders(apiKey);

  switch (args.action) {
    case 'list_regions':
      return await listRegions(baseUrl, headers, args);
    case 'get_region':
      return await getRegion(baseUrl, headers, args);
    case 'create_region':
      return await createRegion(baseUrl, headers, args);
    case 'update_region':
      return await updateRegion(baseUrl, headers, args);
    case 'delete_region':
      return await deleteRegion(baseUrl, headers, args);
    case 'list_shipping_options':
      return await listShippingOptions(baseUrl, headers, args);
    case 'get_shipping_option':
      return await getShippingOption(baseUrl, headers, args);
    case 'create_shipping_option':
      return await createShippingOption(baseUrl, headers, args);
    case 'update_shipping_option':
      return await updateShippingOption(baseUrl, headers, args);
    case 'delete_shipping_option':
      return await deleteShippingOption(baseUrl, headers, args);
    case 'list_shipping_profiles':
      return await listShippingProfiles(baseUrl, headers, args);
    case 'get_shipping_profile':
      return await getShippingProfile(baseUrl, headers, args);
    case 'create_shipping_profile':
      return await createShippingProfile(baseUrl, headers, args);
    case 'update_shipping_profile':
      return await updateShippingProfile(baseUrl, headers, args);
    case 'delete_shipping_profile':
      return await deleteShippingProfile(baseUrl, headers, args);
    case 'list_fulfillment_providers':
      return await listFulfillmentProviders(baseUrl, headers, args);
    case 'list_fulfillment_sets':
      return await listFulfillmentSets(baseUrl, headers, args);
    case 'create_fulfillment_set':
      return await createFulfillmentSet(baseUrl, headers, args);
    case 'delete_fulfillment_set':
      return await deleteFulfillmentSet(baseUrl, headers, args);
    case 'create_service_zone':
      return await createServiceZone(baseUrl, headers, args);
    case 'get_service_zone':
      return await getServiceZone(baseUrl, headers, args);
    case 'update_service_zone':
      return await updateServiceZone(baseUrl, headers, args);
    case 'delete_service_zone':
      return await deleteServiceZone(baseUrl, headers, args);
    default:
      throw new Error(`Unknown action: ${args.action}`);
  }
}

// Region operations
async function listRegions(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());
  if (args.q) params.append('q', args.q);

  const url = `${baseUrl}/admin/regions?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getRegion(baseUrl, headers, args) {
  if (!args.id) throw new Error('Region ID is required');
  const url = `${baseUrl}/admin/regions/${args.id}`;
  return await makeRequest(url, { headers });
}

async function createRegion(baseUrl, headers, args) {
  if (!args.name) throw new Error('Region name is required');
  if (!args.currency_code) throw new Error('Currency code is required');
  
  const regionData = {
    name: args.name,
    currency_code: args.currency_code
  };
  if (args.countries) regionData.countries = args.countries;
  if (args.payment_providers) regionData.payment_providers = args.payment_providers;
  if (args.fulfillment_providers) regionData.fulfillment_providers = args.fulfillment_providers;
  if (args.tax_rate) regionData.tax_rate = args.tax_rate;
  if (args.tax_code) regionData.tax_code = args.tax_code;
  if (args.includes_tax) regionData.includes_tax = args.includes_tax;
  if (args.metadata) regionData.metadata = args.metadata;

  const url = `${baseUrl}/admin/regions`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(regionData)
  });
}

async function updateRegion(baseUrl, headers, args) {
  if (!args.id) throw new Error('Region ID is required');
  
  const regionData = {};
  if (args.name) regionData.name = args.name;
  if (args.currency_code) regionData.currency_code = args.currency_code;
  if (args.countries) regionData.countries = args.countries;
  if (args.payment_providers) regionData.payment_providers = args.payment_providers;
  if (args.fulfillment_providers) regionData.fulfillment_providers = args.fulfillment_providers;
  if (args.tax_rate) regionData.tax_rate = args.tax_rate;
  if (args.tax_code) regionData.tax_code = args.tax_code;
  if (args.includes_tax !== undefined) regionData.includes_tax = args.includes_tax;
  if (args.metadata) regionData.metadata = args.metadata;

  const url = `${baseUrl}/admin/regions/${args.id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(regionData)
  });
}

async function deleteRegion(baseUrl, headers, args) {
  if (!args.id) throw new Error('Region ID is required');
  const url = `${baseUrl}/admin/regions/${args.id}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

// Shipping Options operations
async function listShippingOptions(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());
  if (args.region_id) params.append('region_id', args.region_id);
  if (args.is_return) params.append('is_return', args.is_return.toString());

  const url = `${baseUrl}/admin/shipping-options?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getShippingOption(baseUrl, headers, args) {
  if (!args.shipping_option_id) throw new Error('Shipping option ID is required');
  const url = `${baseUrl}/admin/shipping-options/${args.shipping_option_id}`;
  return await makeRequest(url, { headers });
}

async function createShippingOption(baseUrl, headers, args) {
  if (!args.name) throw new Error('Shipping option name is required');
  if (!args.service_zone_id) throw new Error('service_zone_id is required for shipping options in Medusa v2');
  if (!args.profile_id) throw new Error('Shipping profile ID is required');
  if (!args.provider_id) throw new Error('Provider ID is required');
  if (args.amount === undefined) throw new Error('Amount is required');
  if (!args.currency_code) throw new Error('Currency code is required');
  
  const optionData = {
    name: args.name,
    service_zone_id: args.service_zone_id,
    shipping_profile_id: args.profile_id,
    provider_id: args.provider_id,
    price_type: args.price_type || 'flat',
    prices: [{ currency_code: args.currency_code, amount: args.amount }]
  };
  if (args.is_return !== undefined) optionData.is_return = args.is_return;
  if (args.admin_only !== undefined) optionData.admin_only = args.admin_only;
  if (args.data) optionData.data = args.data;
  if (args.metadata) optionData.metadata = args.metadata;

  const url = `${baseUrl}/admin/shipping-options`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(optionData)
  });
}

async function updateShippingOption(baseUrl, headers, args) {
  if (!args.shipping_option_id) throw new Error('Shipping option ID is required');
  
  const optionData = {};
  if (args.name) optionData.name = args.name;
  if (args.profile_id) optionData.shipping_profile_id = args.profile_id;
  if (args.provider_id) optionData.provider_id = args.provider_id;
  if (args.price_type) optionData.price_type = args.price_type;
  if (args.amount !== undefined && args.currency_code) {
    optionData.prices = [{ currency_code: args.currency_code, amount: args.amount }];
  }
  if (args.is_return !== undefined) optionData.is_return = args.is_return;
  if (args.admin_only !== undefined) optionData.admin_only = args.admin_only;
  if (args.data) optionData.data = args.data;
  if (args.metadata) optionData.metadata = args.metadata;

  const url = `${baseUrl}/admin/shipping-options/${args.shipping_option_id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(optionData)
  });
}

async function deleteShippingOption(baseUrl, headers, args) {
  if (!args.shipping_option_id) throw new Error('Shipping option ID is required');
  const url = `${baseUrl}/admin/shipping-options/${args.shipping_option_id}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

// Shipping Profiles operations
async function listShippingProfiles(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());

  const url = `${baseUrl}/admin/shipping-profiles?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getShippingProfile(baseUrl, headers, args) {
  if (!args.profile_id) throw new Error('Shipping profile ID is required');
  const url = `${baseUrl}/admin/shipping-profiles/${args.profile_id}`;
  return await makeRequest(url, { headers });
}

async function createShippingProfile(baseUrl, headers, args) {
  if (!args.name) throw new Error('Shipping profile name is required');
  if (!args.type) throw new Error('Shipping profile type is required');
  
  const profileData = {
    name: args.name,
    type: args.type
  };
  if (args.metadata) profileData.metadata = args.metadata;

  const url = `${baseUrl}/admin/shipping-profiles`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(profileData)
  });
}

async function updateShippingProfile(baseUrl, headers, args) {
  if (!args.profile_id) throw new Error('Shipping profile ID is required');
  
  const profileData = {};
  if (args.name) profileData.name = args.name;
  if (args.metadata) profileData.metadata = args.metadata;

  const url = `${baseUrl}/admin/shipping-profiles/${args.profile_id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(profileData)
  });
}

async function deleteShippingProfile(baseUrl, headers, args) {
  if (!args.profile_id) throw new Error('Shipping profile ID is required');
  const url = `${baseUrl}/admin/shipping-profiles/${args.profile_id}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

// Fulfillment operations
async function listFulfillmentProviders(baseUrl, headers, args) {
  const url = `${baseUrl}/admin/fulfillment-providers`;
  return await makeRequest(url, { headers });
}

async function listFulfillmentSets(baseUrl, headers, args) {
  // No existe GET /admin/fulfillment-sets: los fulfillment sets se leen desde las stock locations.
  if (args.location_id) {
    const url = new URL(`${baseUrl}/admin/stock-locations/${encodeURIComponent(args.location_id)}`);
    appendQueryParam(url.searchParams, 'fields', FULFILLMENT_SET_FIELDS);
    const data = await makeRequest(url.toString(), { headers });
    const location = data?.stock_location || {};
    return {
      location_id: location.id || args.location_id,
      location_name: location.name,
      fulfillment_sets: location.fulfillment_sets || []
    };
  }

  const url = new URL(`${baseUrl}/admin/stock-locations`);
  appendQueryParam(url.searchParams, 'fields', FULFILLMENT_SET_FIELDS);
  appendQueryParam(url.searchParams, 'limit', args.limit);
  appendQueryParam(url.searchParams, 'offset', args.offset);
  const data = await makeRequest(url.toString(), { headers });
  const fulfillmentSets = (data?.stock_locations || []).flatMap((location) =>
    (location.fulfillment_sets || []).map((set) => ({
      ...set,
      location_id: location.id,
      location_name: location.name
    }))
  );
  return {
    fulfillment_sets: fulfillmentSets,
    stock_locations_count: data?.count,
    offset: data?.offset,
    limit: data?.limit
  };
}

async function createFulfillmentSet(baseUrl, headers, args) {
  if (!args.location_id) throw new Error('location_id is required: fulfillment sets are created on a stock location in Medusa v2');
  if (!args.name) throw new Error('Fulfillment set name is required');
  if (!args.type) throw new Error('Fulfillment set type is required (e.g. shipping or pickup)');

  // El validador es estricto: sólo acepta { name, type } (metadata no está soportado).
  const setData = {
    name: args.name,
    type: args.type
  };

  const url = `${baseUrl}/admin/stock-locations/${encodeURIComponent(args.location_id)}/fulfillment-sets`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(setData)
  });
}

async function deleteFulfillmentSet(baseUrl, headers, args) {
  if (!args.fulfillment_set_id) throw new Error('Fulfillment set ID is required');
  const url = `${baseUrl}/admin/fulfillment-sets/${encodeURIComponent(args.fulfillment_set_id)}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

// Service zones operations
function serviceZonePath(baseUrl, args, withZone) {
  if (!args.fulfillment_set_id) throw new Error('fulfillment_set_id is required');
  const base = `${baseUrl}/admin/fulfillment-sets/${encodeURIComponent(args.fulfillment_set_id)}/service-zones`;
  if (!withZone) return base;
  if (!args.service_zone_id) throw new Error('service_zone_id is required');
  return `${base}/${encodeURIComponent(args.service_zone_id)}`;
}

async function createServiceZone(baseUrl, headers, args) {
  const url = serviceZonePath(baseUrl, args, false);
  if (!args.name) throw new Error('Service zone name is required');

  const zoneData = { name: args.name };
  if (args.geo_zones) zoneData.geo_zones = args.geo_zones;

  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(zoneData)
  });
}

async function getServiceZone(baseUrl, headers, args) {
  const url = new URL(serviceZonePath(baseUrl, args, true));
  appendQueryParam(url.searchParams, 'fields', args.fields);
  return await makeRequest(url.toString(), { headers });
}

async function updateServiceZone(baseUrl, headers, args) {
  const url = serviceZonePath(baseUrl, args, true);

  const zoneData = {};
  if (args.name) zoneData.name = args.name;
  if (args.geo_zones) zoneData.geo_zones = args.geo_zones;

  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(zoneData)
  });
}

async function deleteServiceZone(baseUrl, headers, args) {
  const url = serviceZonePath(baseUrl, args, true);
  return await makeRequest(url, { method: 'DELETE', headers });
}

export const apiTool = {
  definition: {
    name: 'manage_medusa_admin_regions',
    description:
      'Medusa Admin regions and shipping (Medusa 2.17.2+, incl. 2.18 and 2.21.1): regions, shipping options, shipping profiles, fulfillment providers, fulfillment sets and service zones. ' +
      'Fulfillment sets belong to a stock location: list_fulfillment_sets (optional location_id) reads them from stock locations, create_fulfillment_set needs location_id + name + type, delete_fulfillment_set needs fulfillment_set_id. ' +
      'Service zones: create_service_zone (fulfillment_set_id + name, optional geo_zones), get/update/delete_service_zone (fulfillment_set_id + service_zone_id). ' +
      'update_fulfillment_set was removed (Medusa v2 has no such route).',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'list_regions', 'get_region', 'create_region', 'update_region', 'delete_region',
            'list_shipping_options', 'get_shipping_option', 'create_shipping_option', 'update_shipping_option', 'delete_shipping_option',
            'list_shipping_profiles', 'get_shipping_profile', 'create_shipping_profile', 'update_shipping_profile', 'delete_shipping_profile',
            'list_fulfillment_providers', 'list_fulfillment_sets', 'create_fulfillment_set', 'delete_fulfillment_set',
            'create_service_zone', 'get_service_zone', 'update_service_zone', 'delete_service_zone'
          ],
          description: 'The action to perform.'
        },
        id: { type: 'string', description: 'Region ID.' },
        shipping_option_id: { type: 'string', description: 'Shipping option ID.' },
        profile_id: { type: 'string', description: 'Shipping profile ID.' },
        fulfillment_set_id: { type: 'string', description: 'Fulfillment set ID (delete_fulfillment_set and service zone actions).' },
        location_id: { type: 'string', description: 'Stock location ID (required for create_fulfillment_set; optional filter for list_fulfillment_sets).' },
        service_zone_id: { type: 'string', description: 'Service zone ID. Required for get/update/delete_service_zone and for create_shipping_option.' },
        geo_zones: {
          type: 'array',
          items: { type: 'object' },
          description: 'Service zone geo zones, e.g. [{"type":"country","country_code":"ar"}] or [{"type":"province","country_code":"ar","province_code":"ar-b"}]. On update, include id to keep existing zones.'
        },
        limit: { type: 'number', description: 'Maximum number of items to return.' },
        offset: { type: 'number', description: 'Number of items to skip.' },
        q: { type: 'string', description: 'Search query.' },
        fields: { type: 'string', description: 'Fields selector (get_service_zone).' },
        name: { type: 'string', description: 'Name.' },
        currency_code: { type: 'string', description: 'Currency code.' },
        countries: { type: 'array', items: { type: 'string' }, description: 'Country codes.' },
        payment_providers: { type: 'array', items: { type: 'string' }, description: 'Payment provider IDs.' },
        fulfillment_providers: { type: 'array', items: { type: 'string' }, description: 'Fulfillment provider IDs.' },
        tax_rate: { type: 'number', description: 'Tax rate.' },
        tax_code: { type: 'string', description: 'Tax code.' },
        includes_tax: { type: 'boolean', description: 'Whether prices include tax.' },
        region_id: { type: 'string', description: 'Region ID for shipping options.' },
        provider_id: { type: 'string', description: 'Provider ID.' },
        price_type: { type: 'string', description: 'Price type (flat, calculated).' },
        amount: { type: 'number', description: 'Price amount.' },
        is_return: { type: 'boolean', description: 'Whether this is a return option.' },
        admin_only: { type: 'boolean', description: 'Whether option is admin only.' },
        type: { type: 'string', description: 'Shipping profile type, or fulfillment set type (e.g. shipping, pickup).' },
        data: { type: 'object', description: 'Additional data.' },
        metadata: { type: 'object', description: 'Additional metadata (regions, shipping options, shipping profiles).' }
      },
      required: ['action']
    }
  },
  function: withMedusaErrorHints(handleRegionsOperation)
};
