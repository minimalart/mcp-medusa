/**
 * Comprehensive Medusa Admin Pricing & Promotions Management Tool
 * Supports price lists, promotions, campaigns management
 */

import { Buffer } from "buffer";

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

async function handlePricingOperation(args) {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY;

  if (!apiKey) {
    throw new Error('MEDUSA_API_KEY environment variable is required');
  }

  const headers = createHeaders(apiKey);

  switch (args.action) {
    case 'list_price_lists':
      return await listPriceLists(baseUrl, headers, args);
    case 'get_price_list':
      return await getPriceList(baseUrl, headers, args);
    case 'create_price_list':
      return await createPriceList(baseUrl, headers, args);
    case 'update_price_list':
      return await updatePriceList(baseUrl, headers, args);
    case 'delete_price_list':
      return await deletePriceList(baseUrl, headers, args);
    case 'list_promotions':
      return await listPromotions(baseUrl, headers, args);
    case 'get_promotion':
      return await getPromotion(baseUrl, headers, args);
    case 'create_promotion':
      return await createPromotion(baseUrl, headers, args);
    case 'update_promotion':
      return await updatePromotion(baseUrl, headers, args);
    case 'delete_promotion':
      return await deletePromotion(baseUrl, headers, args);
    case 'list_campaigns':
      return await listCampaigns(baseUrl, headers, args);
    case 'get_campaign':
      return await getCampaign(baseUrl, headers, args);
    case 'create_campaign':
      return await createCampaign(baseUrl, headers, args);
    case 'update_campaign':
      return await updateCampaign(baseUrl, headers, args);
    case 'delete_campaign':
      return await deleteCampaign(baseUrl, headers, args);
    default:
      throw new Error(`Unknown action: ${args.action}`);
  }
}

// Price Lists operations
async function listPriceLists(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());
  if (args.q) params.append('q', args.q);

  const url = `${baseUrl}/admin/price-lists?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getPriceList(baseUrl, headers, args) {
  if (!args.id) throw new Error('Price list ID is required');
  const url = `${baseUrl}/admin/price-lists/${args.id}`;
  return await makeRequest(url, { headers });
}

async function createPriceList(baseUrl, headers, args) {
  if (!args.name) throw new Error('Price list name is required');
  if (!args.type) throw new Error('Price list type is required');
  
  const priceListData = {
    name: args.name,
    type: args.type
  };
  if (args.description) priceListData.description = args.description;
  if (args.starts_at) priceListData.starts_at = args.starts_at;
  if (args.ends_at) priceListData.ends_at = args.ends_at;
  if (args.status) priceListData.status = args.status;
  if (args.prices) priceListData.prices = args.prices;
  if (args.customer_groups) priceListData.customer_groups = args.customer_groups;

  const url = `${baseUrl}/admin/price-lists`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(priceListData)
  });
}

async function updatePriceList(baseUrl, headers, args) {
  if (!args.id) throw new Error('Price list ID is required');
  
  const priceListData = {};
  if (args.name) priceListData.name = args.name;
  if (args.description) priceListData.description = args.description;
  if (args.starts_at) priceListData.starts_at = args.starts_at;
  if (args.ends_at) priceListData.ends_at = args.ends_at;
  if (args.status) priceListData.status = args.status;
  if (args.prices) priceListData.prices = args.prices;
  if (args.customer_groups) priceListData.customer_groups = args.customer_groups;

  const url = `${baseUrl}/admin/price-lists/${args.id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(priceListData)
  });
}

async function deletePriceList(baseUrl, headers, args) {
  if (!args.id) throw new Error('Price list ID is required');
  const url = `${baseUrl}/admin/price-lists/${args.id}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

// Promotions operations
async function listPromotions(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());
  if (args.q) params.append('q', args.q);

  const url = `${baseUrl}/admin/promotions?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getPromotion(baseUrl, headers, args) {
  if (!args.promotion_id) throw new Error('Promotion ID is required');
  const url = `${baseUrl}/admin/promotions/${args.promotion_id}`;
  return await makeRequest(url, { headers });
}

async function createPromotion(baseUrl, headers, args) {
  if (!args.code) throw new Error('Promotion code is required');
  if (!args.type) throw new Error('Promotion type is required (standard or buyget)');
  if (!args.application_method) throw new Error('application_method is required for creating promotions');

  // Validate type enum (Medusa v2 API)
  const validTypes = ['standard', 'buyget'];
  if (!validTypes.includes(args.type)) {
    throw new Error(`Invalid promotion type: ${args.type}. Must be one of: ${validTypes.join(', ')}`);
  }

  // Validate application_method structure (Medusa v2 API requirements)
  if (!args.application_method.type) {
    throw new Error('application_method.type is required (fixed or percentage)');
  }
  if (!['fixed', 'percentage'].includes(args.application_method.type)) {
    throw new Error('application_method.type must be "fixed" or "percentage"');
  }
  if (!args.application_method.target_type) {
    throw new Error('application_method.target_type is required (items, shipping, or order)');
  }
  if (!['items', 'shipping', 'order'].includes(args.application_method.target_type)) {
    throw new Error('application_method.target_type must be "items", "shipping", or "order"');
  }
  if (args.application_method.value === undefined) {
    throw new Error('application_method.value is required');
  }

  // Validate rules if provided (Medusa v2 requires operator and attribute)
  if (args.rules && Array.isArray(args.rules)) {
    args.rules.forEach((rule, index) => {
      if (!rule.attribute) {
        throw new Error(`rules[${index}].attribute is required`);
      }
      if (!rule.operator) {
        throw new Error(`rules[${index}].operator is required (eq, in, ne, gt, gte, lt, lte)`);
      }
      if (!['eq', 'in', 'ne', 'gt', 'gte', 'lt', 'lte'].includes(rule.operator)) {
        throw new Error(`rules[${index}].operator must be one of: eq, in, ne, gt, gte, lt, lte`);
      }
      if (rule.values === undefined) {
        throw new Error(`rules[${index}].values is required`);
      }
    });
  }

  const promotionData = {
    code: args.code,
    type: args.type,
    application_method: args.application_method
  };

  if (args.is_automatic !== undefined) promotionData.is_automatic = args.is_automatic;
  if (args.is_tax_inclusive !== undefined) promotionData.is_tax_inclusive = args.is_tax_inclusive;
  if (args.status) promotionData.status = args.status;
  if (args.campaign_id) promotionData.campaign_id = args.campaign_id;
  if (args.rules) promotionData.rules = args.rules;

  const url = `${baseUrl}/admin/promotions`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(promotionData)
  });
}

async function updatePromotion(baseUrl, headers, args) {
  if (!args.promotion_id) throw new Error('Promotion ID is required');

  // Validate application_method structure if provided (Medusa v2 API)
  if (args.application_method) {
    if (args.application_method.type && !['fixed', 'percentage'].includes(args.application_method.type)) {
      throw new Error('application_method.type must be "fixed" or "percentage"');
    }
    if (args.application_method.target_type && !['items', 'shipping', 'order'].includes(args.application_method.target_type)) {
      throw new Error('application_method.target_type must be "items", "shipping", or "order"');
    }
  }

  // Validate rules if provided (Medusa v2 requires operator and attribute)
  if (args.rules && Array.isArray(args.rules)) {
    args.rules.forEach((rule, index) => {
      if (!rule.attribute) {
        throw new Error(`rules[${index}].attribute is required`);
      }
      if (!rule.operator) {
        throw new Error(`rules[${index}].operator is required (eq, in, ne, gt, gte, lt, lte)`);
      }
      if (!['eq', 'in', 'ne', 'gt', 'gte', 'lt', 'lte'].includes(rule.operator)) {
        throw new Error(`rules[${index}].operator must be one of: eq, in, ne, gt, gte, lt, lte`);
      }
      if (rule.values === undefined) {
        throw new Error(`rules[${index}].values is required`);
      }
    });
  }

  const promotionData = {};
  if (args.code) promotionData.code = args.code;
  if (args.is_automatic !== undefined) promotionData.is_automatic = args.is_automatic;
  if (args.is_tax_inclusive !== undefined) promotionData.is_tax_inclusive = args.is_tax_inclusive;
  if (args.campaign_id) promotionData.campaign_id = args.campaign_id;
  if (args.application_method) promotionData.application_method = args.application_method;
  if (args.rules) promotionData.rules = args.rules;
  if (args.status) promotionData.status = args.status;

  const url = `${baseUrl}/admin/promotions/${args.promotion_id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(promotionData)
  });
}

async function deletePromotion(baseUrl, headers, args) {
  if (!args.promotion_id) throw new Error('Promotion ID is required');
  const url = `${baseUrl}/admin/promotions/${args.promotion_id}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

// Campaigns operations
async function listCampaigns(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());
  if (args.q) params.append('q', args.q);

  const url = `${baseUrl}/admin/campaigns?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getCampaign(baseUrl, headers, args) {
  if (!args.campaign_id) throw new Error('Campaign ID is required');
  const url = `${baseUrl}/admin/campaigns/${args.campaign_id}`;
  return await makeRequest(url, { headers });
}

async function createCampaign(baseUrl, headers, args) {
  if (!args.name) throw new Error('Campaign name is required');
  if (!args.campaign_identifier) throw new Error('Campaign identifier is required');
  
  const campaignData = {
    name: args.name,
    campaign_identifier: args.campaign_identifier
  };
  if (args.description) campaignData.description = args.description;
  if (args.starts_at) campaignData.starts_at = args.starts_at;
  if (args.ends_at) campaignData.ends_at = args.ends_at;
  if (args.budget) campaignData.budget = args.budget;

  const url = `${baseUrl}/admin/campaigns`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(campaignData)
  });
}

async function updateCampaign(baseUrl, headers, args) {
  if (!args.campaign_id) throw new Error('Campaign ID is required');
  
  const campaignData = {};
  if (args.name) campaignData.name = args.name;
  if (args.campaign_identifier) campaignData.campaign_identifier = args.campaign_identifier;
  if (args.description) campaignData.description = args.description;
  if (args.starts_at) campaignData.starts_at = args.starts_at;
  if (args.ends_at) campaignData.ends_at = args.ends_at;
  if (args.budget) campaignData.budget = args.budget;

  const url = `${baseUrl}/admin/campaigns/${args.campaign_id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(campaignData)
  });
}

async function deleteCampaign(baseUrl, headers, args) {
  if (!args.campaign_id) throw new Error('Campaign ID is required');
  const url = `${baseUrl}/admin/campaigns/${args.campaign_id}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

export const apiTool = {
  definition: {
    name: 'manage_medusa_admin_pricing',
    description: 'Comprehensive Medusa Admin pricing and promotions management tool supporting price lists, promotions, and campaigns. For Medusa v2 API.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'list_price_lists', 'get_price_list', 'create_price_list', 'update_price_list', 'delete_price_list',
            'list_promotions', 'get_promotion', 'create_promotion', 'update_promotion', 'delete_promotion',
            'list_campaigns', 'get_campaign', 'create_campaign', 'update_campaign', 'delete_campaign'
          ],
          description: 'The action to perform.'
        },
        id: { type: 'string', description: 'Price list ID.' },
        promotion_id: { type: 'string', description: 'Promotion ID.' },
        campaign_id: { type: 'string', description: 'Campaign ID.' },
        limit: { type: 'number', description: 'Maximum number of items to return.' },
        offset: { type: 'number', description: 'Number of items to skip.' },
        q: { type: 'string', description: 'Search query.' },
        name: { type: 'string', description: 'Name.' },
        type: {
          type: 'string',
          enum: ['standard', 'buyget', 'sale', 'override'],
          description: 'For promotions: "standard" (regular promotion) or "buyget" (buy X get Y). For price lists: "sale" or "override".'
        },
        description: { type: 'string', description: 'Description.' },
        starts_at: { type: 'string', description: 'Start date (ISO 8601 format).' },
        ends_at: { type: 'string', description: 'End date (ISO 8601 format).' },
        status: {
          type: 'string',
          enum: ['draft', 'active', 'inactive'],
          description: 'Promotion or price list status.'
        },
        prices: { type: 'array', description: 'Price list prices.' },
        customer_groups: { type: 'array', description: 'Customer groups.' },
        code: { type: 'string', description: 'Promotion code (unique identifier).' },
        is_automatic: { type: 'boolean', description: 'Whether promotion is automatically applied without code.' },
        is_tax_inclusive: { type: 'boolean', description: 'Whether promotion value includes tax.' },
        application_method: {
          type: 'object',
          description: 'REQUIRED for create_promotion. Defines how the promotion discount is applied. Must include: type (fixed/percentage), target_type (items/shipping/order), value (discount amount). Optional: allocation (each/across), currency_code, max_quantity, buy_rules_min_quantity, apply_to_quantity, target_rules, buy_rules.',
          properties: {
            type: {
              type: 'string',
              enum: ['fixed', 'percentage'],
              description: 'REQUIRED. Discount type: "fixed" for fixed amount off, "percentage" for percentage off.'
            },
            target_type: {
              type: 'string',
              enum: ['items', 'shipping', 'order'],
              description: 'REQUIRED. What the promotion applies to: "items" (cart items), "shipping" (shipping methods), or "order" (entire order).'
            },
            allocation: {
              type: 'string',
              enum: ['each', 'across'],
              description: 'How discount is distributed: "each" (per qualifying item) or "across" (split between items).'
            },
            value: {
              type: 'number',
              description: 'REQUIRED. The discount value. For "fixed": amount in cents. For "percentage": percentage value (e.g., 10 for 10%).'
            },
            currency_code: {
              type: 'string',
              description: 'Currency code for fixed discounts (e.g., "usd", "eur"). Required when type is "fixed".'
            },
            max_quantity: {
              type: 'number',
              description: 'Maximum number of items the promotion can be applied to.'
            },
            buy_rules_min_quantity: {
              type: 'number',
              description: 'For buyget promotions: minimum quantity customer must buy before promotion applies.'
            },
            apply_to_quantity: {
              type: 'number',
              description: 'For buyget promotions: quantity of items to apply the discount to.'
            },
            target_rules: {
              type: 'array',
              description: 'Rules to restrict which items/shipping methods receive the discount.',
              items: {
                type: 'object',
                properties: {
                  attribute: { type: 'string', description: 'Property to check (e.g., "product.id", "product.collection_id", "sku").' },
                  operator: { type: 'string', enum: ['eq', 'in', 'ne', 'gt', 'gte', 'lt', 'lte'], description: 'REQUIRED. Comparison operator.' },
                  values: { type: 'array', items: { type: 'string' }, description: 'Values to match against.' }
                },
                required: ['attribute', 'operator', 'values']
              }
            },
            buy_rules: {
              type: 'array',
              description: 'For buyget promotions: rules defining the "buy X" condition.',
              items: {
                type: 'object',
                properties: {
                  attribute: { type: 'string', description: 'Property to check (e.g., "product.id", "sku").' },
                  operator: { type: 'string', enum: ['eq', 'in', 'ne', 'gt', 'gte', 'lt', 'lte'], description: 'REQUIRED. Comparison operator.' },
                  values: { type: 'array', items: { type: 'string' }, description: 'Values to match against.' }
                },
                required: ['attribute', 'operator', 'values']
              }
            }
          },
          required: ['type', 'target_type', 'value']
        },
        rules: {
          type: 'array',
          description: 'Promotion eligibility rules (conditions for when promotion can be used). Each rule requires: attribute, operator, values.',
          items: {
            type: 'object',
            properties: {
              attribute: {
                type: 'string',
                description: 'REQUIRED. Property to check (e.g., "customer_id", "customer.group.id", "currency_code", "region_id").'
              },
              operator: {
                type: 'string',
                enum: ['eq', 'in', 'ne', 'gt', 'gte', 'lt', 'lte'],
                description: 'REQUIRED. Comparison operator: eq (equals), in (in array), ne (not equals), gt/gte/lt/lte (comparisons).'
              },
              values: {
                type: 'array',
                items: { type: 'string' },
                description: 'REQUIRED. Values to match against.'
              }
            },
            required: ['attribute', 'operator', 'values']
          }
        },
        campaign_identifier: { type: 'string', description: 'Campaign identifier.' },
        budget: { type: 'object', description: 'Campaign budget.' }
      },
      required: ['action']
    }
  },
  function: handlePricingOperation
};