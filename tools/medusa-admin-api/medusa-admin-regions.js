/**
 * Comprehensive Medusa Admin Regions & Shipping Management Tool
 * Supports regions, shipping options, profiles, and fulfillment management
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

async function handleRegionsOperation(args) {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY;
  
  if (!apiKey) {
    throw new Error('MEDUSA_API_KEY environment variable is required');
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
    case 'update_fulfillment_set':
      return await updateFulfillmentSet(baseUrl, headers, args);
    case 'delete_fulfillment_set':
      return await deleteFulfillmentSet(baseUrl, headers, args);
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
  if (!args.region_id) throw new Error('Region ID is required');
  if (!args.provider_id) throw new Error('Provider ID is required');
  if (!args.price_type) throw new Error('Price type is required');
  
  const optionData = {
    name: args.name,
    region_id: args.region_id,
    provider_id: args.provider_id,
    price_type: args.price_type
  };
  if (args.amount) optionData.amount = args.amount;
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
  if (args.amount) optionData.amount = args.amount;
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
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());

  const url = `${baseUrl}/admin/fulfillment-sets?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function createFulfillmentSet(baseUrl, headers, args) {
  if (!args.name) throw new Error('Fulfillment set name is required');
  if (!args.type) throw new Error('Fulfillment set type is required');
  
  const setData = {
    name: args.name,
    type: args.type
  };
  if (args.metadata) setData.metadata = args.metadata;

  const url = `${baseUrl}/admin/fulfillment-sets`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(setData)
  });
}

async function updateFulfillmentSet(baseUrl, headers, args) {
  if (!args.fulfillment_set_id) throw new Error('Fulfillment set ID is required');
  
  const setData = {};
  if (args.name) setData.name = args.name;
  if (args.metadata) setData.metadata = args.metadata;

  const url = `${baseUrl}/admin/fulfillment-sets/${args.fulfillment_set_id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(setData)
  });
}

async function deleteFulfillmentSet(baseUrl, headers, args) {
  if (!args.fulfillment_set_id) throw new Error('Fulfillment set ID is required');
  const url = `${baseUrl}/admin/fulfillment-sets/${args.fulfillment_set_id}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

export const apiTool = {
  definition: {
    name: 'manage_medusa_admin_regions',
    description: 'Comprehensive Medusa Admin regions and shipping management tool supporting regions, shipping options, profiles, and fulfillment operations.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'list_regions', 'get_region', 'create_region', 'update_region', 'delete_region',
            'list_shipping_options', 'get_shipping_option', 'create_shipping_option', 'update_shipping_option', 'delete_shipping_option',
            'list_shipping_profiles', 'get_shipping_profile', 'create_shipping_profile', 'update_shipping_profile', 'delete_shipping_profile',
            'list_fulfillment_providers', 'list_fulfillment_sets', 'create_fulfillment_set', 'update_fulfillment_set', 'delete_fulfillment_set'
          ],
          description: 'The action to perform.'
        },
        id: { type: 'string', description: 'Region ID.' },
        shipping_option_id: { type: 'string', description: 'Shipping option ID.' },
        profile_id: { type: 'string', description: 'Shipping profile ID.' },
        fulfillment_set_id: { type: 'string', description: 'Fulfillment set ID.' },
        limit: { type: 'number', description: 'Maximum number of items to return.' },
        offset: { type: 'number', description: 'Number of items to skip.' },
        q: { type: 'string', description: 'Search query.' },
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
        price_type: { type: 'string', description: 'Price type (flat_rate, calculated).' },
        amount: { type: 'number', description: 'Price amount.' },
        is_return: { type: 'boolean', description: 'Whether this is a return option.' },
        admin_only: { type: 'boolean', description: 'Whether option is admin only.' },
        type: { type: 'string', description: 'Profile/set type.' },
        data: { type: 'object', description: 'Additional data.' },
        metadata: { type: 'object', description: 'Additional metadata.' }
      },
      required: ['action']
    }
  },
  function: handleRegionsOperation
};