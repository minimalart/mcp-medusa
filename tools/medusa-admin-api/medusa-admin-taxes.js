/**
 * Comprehensive Medusa Admin Tax Management Tool
 * Supports tax rates, tax regions, and tax calculations
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

async function handleTaxesOperation(args) {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY;
  
  if (!apiKey) {
    throw new Error('MEDUSA_API_KEY environment variable is required');
  }

  const headers = createHeaders(apiKey);

  switch (args.action) {
    case 'list_tax_rates':
      return await listTaxRates(baseUrl, headers, args);
    case 'get_tax_rate':
      return await getTaxRate(baseUrl, headers, args);
    case 'create_tax_rate':
      return await createTaxRate(baseUrl, headers, args);
    case 'update_tax_rate':
      return await updateTaxRate(baseUrl, headers, args);
    case 'delete_tax_rate':
      return await deleteTaxRate(baseUrl, headers, args);
    case 'list_tax_regions':
      return await listTaxRegions(baseUrl, headers, args);
    case 'get_tax_region':
      return await getTaxRegion(baseUrl, headers, args);
    case 'create_tax_region':
      return await createTaxRegion(baseUrl, headers, args);
    case 'update_tax_region':
      return await updateTaxRegion(baseUrl, headers, args);
    case 'delete_tax_region':
      return await deleteTaxRegion(baseUrl, headers, args);
    default:
      throw new Error(`Unknown action: ${args.action}`);
  }
}

// Tax Rates operations
async function listTaxRates(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());
  if (args.tax_region_id) params.append('tax_region_id', args.tax_region_id);

  const url = `${baseUrl}/admin/tax-rates?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getTaxRate(baseUrl, headers, args) {
  if (!args.id) throw new Error('Tax rate ID is required');
  const url = `${baseUrl}/admin/tax-rates/${args.id}`;
  return await makeRequest(url, { headers });
}

async function createTaxRate(baseUrl, headers, args) {
  if (!args.rate) throw new Error('Tax rate is required');
  if (!args.name) throw new Error('Tax rate name is required');
  
  const taxRateData = {
    rate: args.rate,
    name: args.name
  };
  if (args.tax_region_id) taxRateData.tax_region_id = args.tax_region_id;
  if (args.code) taxRateData.code = args.code;
  if (args.is_default !== undefined) taxRateData.is_default = args.is_default;
  if (args.is_combinable !== undefined) taxRateData.is_combinable = args.is_combinable;
  if (args.metadata) taxRateData.metadata = args.metadata;

  const url = `${baseUrl}/admin/tax-rates`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(taxRateData)
  });
}

async function updateTaxRate(baseUrl, headers, args) {
  if (!args.id) throw new Error('Tax rate ID is required');
  
  const taxRateData = {};
  if (args.rate !== undefined) taxRateData.rate = args.rate;
  if (args.name) taxRateData.name = args.name;
  if (args.code) taxRateData.code = args.code;
  if (args.is_default !== undefined) taxRateData.is_default = args.is_default;
  if (args.is_combinable !== undefined) taxRateData.is_combinable = args.is_combinable;
  if (args.metadata) taxRateData.metadata = args.metadata;

  const url = `${baseUrl}/admin/tax-rates/${args.id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(taxRateData)
  });
}

async function deleteTaxRate(baseUrl, headers, args) {
  if (!args.id) throw new Error('Tax rate ID is required');
  const url = `${baseUrl}/admin/tax-rates/${args.id}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

// Tax Regions operations
async function listTaxRegions(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());

  const url = `${baseUrl}/admin/tax-regions?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getTaxRegion(baseUrl, headers, args) {
  if (!args.tax_region_id) throw new Error('Tax region ID is required');
  const url = `${baseUrl}/admin/tax-regions/${args.tax_region_id}`;
  return await makeRequest(url, { headers });
}

async function createTaxRegion(baseUrl, headers, args) {
  if (!args.country_code) throw new Error('Country code is required');
  
  const taxRegionData = {
    country_code: args.country_code
  };
  if (args.province_code) taxRegionData.province_code = args.province_code;
  if (args.parent_id) taxRegionData.parent_id = args.parent_id;
  if (args.default_tax_rate) taxRegionData.default_tax_rate = args.default_tax_rate;
  if (args.metadata) taxRegionData.metadata = args.metadata;

  const url = `${baseUrl}/admin/tax-regions`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(taxRegionData)
  });
}

async function updateTaxRegion(baseUrl, headers, args) {
  if (!args.tax_region_id) throw new Error('Tax region ID is required');
  
  const taxRegionData = {};
  if (args.country_code) taxRegionData.country_code = args.country_code;
  if (args.province_code) taxRegionData.province_code = args.province_code;
  if (args.parent_id) taxRegionData.parent_id = args.parent_id;
  if (args.default_tax_rate) taxRegionData.default_tax_rate = args.default_tax_rate;
  if (args.metadata) taxRegionData.metadata = args.metadata;

  const url = `${baseUrl}/admin/tax-regions/${args.tax_region_id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(taxRegionData)
  });
}

async function deleteTaxRegion(baseUrl, headers, args) {
  if (!args.tax_region_id) throw new Error('Tax region ID is required');
  const url = `${baseUrl}/admin/tax-regions/${args.tax_region_id}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

export const apiTool = {
  definition: {
    name: 'manage_medusa_admin_taxes',
    description: 'Comprehensive Medusa Admin tax management tool supporting tax rates and tax regions.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'list_tax_rates', 'get_tax_rate', 'create_tax_rate', 'update_tax_rate', 'delete_tax_rate',
            'list_tax_regions', 'get_tax_region', 'create_tax_region', 'update_tax_region', 'delete_tax_region'
          ],
          description: 'The action to perform on taxes.'
        },
        id: { type: 'string', description: 'Tax rate ID.' },
        tax_region_id: { type: 'string', description: 'Tax region ID.' },
        limit: { type: 'number', description: 'Maximum number of items to return.' },
        offset: { type: 'number', description: 'Number of items to skip.' },
        rate: { type: 'number', description: 'Tax rate percentage.' },
        name: { type: 'string', description: 'Tax rate name.' },
        code: { type: 'string', description: 'Tax rate code.' },
        is_default: { type: 'boolean', description: 'Whether this is the default rate.' },
        is_combinable: { type: 'boolean', description: 'Whether rate can be combined with others.' },
        country_code: { type: 'string', description: 'Country code.' },
        province_code: { type: 'string', description: 'Province/state code.' },
        parent_id: { type: 'string', description: 'Parent tax region ID.' },
        default_tax_rate: { type: 'object', description: 'Default tax rate configuration.' },
        metadata: { type: 'object', description: 'Additional metadata.' }
      },
      required: ['action']
    }
  },
  function: handleTaxesOperation
};