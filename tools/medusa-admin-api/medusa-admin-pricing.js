/**
 * Comprehensive Medusa Admin Pricing & Promotions Management Tool
 * Supports price lists, promotions, campaigns management
 *
 * Rutas agregadas en 1.9 (todas presentes desde Medusa 2.17.2, incluida 2.18.0, hasta 2.21.2):
 *   GET    /admin/price-lists/{id}/prices
 *   POST   /admin/price-lists/{id}/prices/batch                       { create, update, delete }
 *   POST   /admin/price-lists/{id}/products                           { remove: product IDs } (quita sus precios)
 *   GET    /admin/promotions/{id}/{rule_type}                         rules | target-rules | buy-rules
 *   POST   /admin/promotions/{id}/rules/batch                         { create, update, delete }
 *   POST   /admin/promotions/{id}/target-rules/batch
 *   POST   /admin/promotions/{id}/buy-rules/batch
 *   GET    /admin/promotions/rule-attribute-options/{rule_type}
 *   GET    /admin/promotions/rule-value-options/{rule_type}/{rule_attribute_id}
 *   POST   /admin/campaigns/{id}/promotions                           { add, remove } (promotion IDs)
 *   GET|POST /admin/price-preferences
 *   GET|POST|DELETE /admin/price-preferences/{id}
 */

import { appendQueryParam, createHeaders, hasMedusaCredentials, makeRequest, missingCredentialsMessage, normalizeBaseUrl } from "../../lib/medusa-client.js";
import { sentGatedFields, withGatedFields, withMedusaErrorHints } from "../../lib/medusa-version.js";

// metadata en promociones existe desde Medusa 2.21 (en 2.18 el validador estricto lo rechaza):
// sólo se envía si el caller lo pasa y un 400 "Unrecognized fields" se traduce a mensaje de versión.
const PROMOTION_GATED_FIELDS = { metadata: '2.21' };

async function handlePricingOperation(args) {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY || process.env.MEDUSA_JWT || process.env.MEDUSA_SESSION_COOKIE || process.env.MEDUSA_COOKIE;

  if (!hasMedusaCredentials()) {
    throw new Error(missingCredentialsMessage());
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
    case 'update_campaign_promotions':
      return await updateCampaignPromotions(baseUrl, headers, args);
    case 'list_price_list_prices':
      return await listPriceListPrices(baseUrl, headers, args);
    case 'batch_price_list_prices':
      return await batchPriceListPrices(baseUrl, headers, args);
    case 'remove_price_list_products':
      return await removePriceListProducts(baseUrl, headers, args);
    case 'list_promotion_rules':
      return await listPromotionRules(baseUrl, headers, args);
    case 'batch_promotion_rules':
      return await batchPromotionRules(baseUrl, headers, args);
    case 'list_rule_attribute_options':
      return await listRuleAttributeOptions(baseUrl, headers, args);
    case 'list_rule_value_options':
      return await listRuleValueOptions(baseUrl, headers, args);
    case 'list_price_preferences':
    case 'get_price_preference':
    case 'create_price_preference':
    case 'update_price_preference':
    case 'delete_price_preference':
      return await pricePreferenceOperation(baseUrl, headers, args);
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
  const title = args.title || args.name;
  if (!title) throw new Error('Price list title is required');
  if (!args.type) throw new Error('Price list type is required');
  
  const priceListData = {
    title,
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
  if (args.title || args.name) priceListData.title = args.title || args.name;
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
  if (args.metadata !== undefined) promotionData.metadata = args.metadata;

  const url = `${baseUrl}/admin/promotions`;
  return await withGatedFields(sentGatedFields(promotionData, PROMOTION_GATED_FIELDS), () => makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(promotionData)
  }));
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
  if (args.metadata !== undefined) promotionData.metadata = args.metadata;

  const url = `${baseUrl}/admin/promotions/${args.promotion_id}`;
  return await withGatedFields(sentGatedFields(promotionData, PROMOTION_GATED_FIELDS), () => makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(promotionData)
  }));
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

// ---------------------------------------------------------------------------
// Price list prices, promotion rules, campaign promotions, price preferences
// ---------------------------------------------------------------------------

const RULE_TYPES = ['rules', 'target-rules', 'buy-rules'];
const PROMOTIONS_PATH = '/admin/promotions';

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

function batchBody(args) {
  const body = pickDefined(args, ['create', 'update', 'delete']);
  if (Object.keys(body).length === 0) {
    throw new Error('At least one of create, update or delete (arrays) is required for batch actions.');
  }
  return body;
}

function ruleType(args) {
  // Acepta target_rules / buy_rules (como en el body de promociones) además del formato de la URL.
  const value = String(args.rule_type || '').replace(/_/g, '-');
  if (!RULE_TYPES.includes(value)) {
    throw new Error(`rule_type is required: one of ${RULE_TYPES.join(', ')}`);
  }
  return value;
}

async function updateCampaignPromotions(baseUrl, headers, args) {
  if (!args.campaign_id) throw new Error('Campaign ID is required');
  const body = pickDefined(args, ['add', 'remove']);
  if (!Array.isArray(body.add) && !Array.isArray(body.remove)) {
    throw new Error('add and/or remove (arrays of promotion IDs) are required');
  }
  return await makeRequest(`${baseUrl}/admin/campaigns/${encodeURIComponent(args.campaign_id)}/promotions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
}

async function listPriceListPrices(baseUrl, headers, args) {
  if (!args.id) throw new Error('Price list ID is required');
  const url = withQuery(`${baseUrl}/admin/price-lists/${encodeURIComponent(args.id)}/prices`, {
    limit: args.limit,
    offset: args.offset,
    fields: args.fields
  });
  return await makeRequest(url, { method: 'GET', headers });
}

async function batchPriceListPrices(baseUrl, headers, args) {
  if (!args.id) throw new Error('Price list ID is required');
  return await makeRequest(`${baseUrl}/admin/price-lists/${encodeURIComponent(args.id)}/prices/batch`, {
    method: 'POST',
    headers,
    body: JSON.stringify(batchBody(args))
  });
}

async function removePriceListProducts(baseUrl, headers, args) {
  if (!args.id) throw new Error('Price list ID is required');
  if (!Array.isArray(args.remove) || args.remove.length === 0) {
    throw new Error('remove (array of product IDs) is required');
  }
  return await makeRequest(`${baseUrl}/admin/price-lists/${encodeURIComponent(args.id)}/products`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ remove: args.remove })
  });
}

async function listPromotionRules(baseUrl, headers, args) {
  if (!args.promotion_id) throw new Error('Promotion ID is required');
  const url = withQuery(`${baseUrl}/admin/promotions/${encodeURIComponent(args.promotion_id)}/${ruleType(args)}`, {
    fields: args.fields
  });
  return await makeRequest(url, { method: 'GET', headers });
}

async function batchPromotionRules(baseUrl, headers, args) {
  if (!args.promotion_id) throw new Error('Promotion ID is required');
  // Las tres rutas .../{rule_type}/batch están declaradas en el header.
  const path = [PROMOTIONS_PATH, encodeURIComponent(args.promotion_id), ruleType(args), 'batch'].join('/');
  return await makeRequest(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(batchBody(args))
  });
}

const RULE_OPTION_QUERY = ['promotion_type', 'application_method_type', 'application_method_target_type'];

async function listRuleAttributeOptions(baseUrl, headers, args) {
  const url = withQuery(`${baseUrl}/admin/promotions/rule-attribute-options/${ruleType(args)}`, {
    ...pickDefined(args, RULE_OPTION_QUERY),
    fields: args.fields
  });
  return await makeRequest(url, { method: 'GET', headers });
}

async function listRuleValueOptions(baseUrl, headers, args) {
  if (!args.rule_attribute_id) throw new Error('rule_attribute_id is required (see list_rule_attribute_options)');
  const url = withQuery(
    `${baseUrl}/admin/promotions/rule-value-options/${ruleType(args)}/${encodeURIComponent(args.rule_attribute_id)}`,
    {
      q: args.q,
      value: args.value,
      limit: args.limit,
      offset: args.offset,
      application_method_target_type: args.application_method_target_type
    }
  );
  return await makeRequest(url, { method: 'GET', headers });
}

async function pricePreferenceOperation(baseUrl, headers, args) {
  const body = pickDefined(args, ['attribute', 'value', 'is_tax_inclusive']);
  switch (args.action) {
    case 'list_price_preferences': {
      const url = withQuery(`${baseUrl}/admin/price-preferences`, {
        limit: args.limit,
        offset: args.offset,
        q: args.q,
        attribute: args.attribute,
        value: args.value,
        fields: args.fields
      });
      return await makeRequest(url, { method: 'GET', headers });
    }
    case 'create_price_preference':
      if (!body.attribute || !body.value) throw new Error('attribute (currency_code or region_id) and value are required');
      return await makeRequest(`${baseUrl}/admin/price-preferences`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
    default: {
      if (!args.price_preference_id) throw new Error('price_preference_id is required');
      const url = `${baseUrl}/admin/price-preferences/${encodeURIComponent(args.price_preference_id)}`;
      if (args.action === 'get_price_preference') {
        return await makeRequest(withQuery(url, { fields: args.fields }), { method: 'GET', headers });
      }
      if (args.action === 'update_price_preference') {
        return await makeRequest(url, { method: 'POST', headers, body: JSON.stringify(body) });
      }
      return await makeRequest(url, { method: 'DELETE', headers });
    }
  }
}

const ACTIONS = [
  'list_price_lists', 'get_price_list', 'create_price_list', 'update_price_list', 'delete_price_list',
  'list_price_list_prices', 'batch_price_list_prices', 'remove_price_list_products',
  'list_promotions', 'get_promotion', 'create_promotion', 'update_promotion', 'delete_promotion',
  'list_promotion_rules', 'batch_promotion_rules', 'list_rule_attribute_options', 'list_rule_value_options',
  'list_campaigns', 'get_campaign', 'create_campaign', 'update_campaign', 'delete_campaign', 'update_campaign_promotions',
  'list_price_preferences', 'get_price_preference', 'create_price_preference', 'update_price_preference', 'delete_price_preference'
];

export const apiTool = {
  definition: {
    name: 'manage_medusa_admin_pricing',
    description:
      'Comprehensive Medusa Admin pricing and promotions management tool supporting price lists, promotions, and campaigns (Medusa 2.17.2+, incl. 2.18 and 2.21.1). Promotion metadata on create_promotion/update_promotion requires Medusa >= 2.21 and is only sent when provided. ' +
      'Price list prices (id = price list): list_price_list_prices, batch_price_list_prices ({create: [{variant_id, currency_code, amount, min_quantity?, max_quantity?, rules?}], update: [{id, variant_id, ...}], delete: [price IDs]}), remove_price_list_products (remove: product IDs; drops their prices from the list). ' +
      'Promotion rules (promotion_id + rule_type rules|target-rules|buy-rules): list_promotion_rules, batch_promotion_rules ({create: [{attribute, operator, values}], update: [{id, ...}], delete: [rule IDs]}); list_rule_attribute_options (rule_type) and list_rule_value_options (rule_type + rule_attribute_id) list valid attributes/values. ' +
      'update_campaign_promotions (campaign_id + add/remove promotion IDs). ' +
      'Price preferences (whether prices of a currency_code/region_id include tax): list/get/create/update/delete_price_preference (price_preference_id; attribute, value, is_tax_inclusive). ' +
      'Price, promotion and tax-inclusiveness changes apply immediately to the storefront.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ACTIONS,
          description: 'The action to perform.'
        },
        price_preference_id: { type: 'string', description: 'Price preference ID (get/update/delete_price_preference).' },
        attribute: { type: 'string', description: 'Price preference attribute: currency_code or region_id.' },
        value: { type: 'string', description: 'Price preference value (e.g. "usd" or a region ID), or rule value filter for list_rule_value_options.' },
        rule_type: { type: 'string', enum: ['rules', 'target-rules', 'buy-rules'], description: 'Promotion rule set (list/batch_promotion_rules, rule option actions).' },
        rule_attribute_id: { type: 'string', description: 'Rule attribute ID for list_rule_value_options (e.g. customer_group, product).' },
        promotion_type: { type: 'string', description: 'Filter for list_rule_attribute_options (standard, buyget).' },
        application_method_type: { type: 'string', description: 'Filter for list_rule_attribute_options (fixed, percentage).' },
        application_method_target_type: { type: 'string', description: 'Filter for rule option actions (items, shipping_methods, order).' },
        create: { type: 'array', items: { type: 'object' }, description: 'batch actions: records to create.' },
        update: { type: 'array', items: { type: 'object' }, description: 'batch actions: records to update (each with id).' },
        delete: { type: 'array', items: { type: 'string' }, description: 'batch actions: IDs to delete.' },
        add: { type: 'array', items: { type: 'string' }, description: 'update_campaign_promotions: promotion IDs to add.' },
        remove: { type: 'array', items: { type: 'string' }, description: 'update_campaign_promotions: promotion IDs to remove; remove_price_list_products: product IDs.' },
        fields: { type: 'string', description: 'Fields selector for the new list/get actions.' },
        id: { type: 'string', description: 'Price list ID.' },
        promotion_id: { type: 'string', description: 'Promotion ID.' },
        campaign_id: { type: 'string', description: 'Campaign ID.' },
        limit: { type: 'number', description: 'Maximum number of items to return.' },
        offset: { type: 'number', description: 'Number of items to skip.' },
        q: { type: 'string', description: 'Search query.' },
        name: { type: 'string', description: 'Name. For price lists this is accepted as an alias for title.' },
        title: { type: 'string', description: 'Price list title. Preferred over name for price list actions.' },
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
        budget: { type: 'object', description: 'Campaign budget.' },
        metadata: {
          type: 'object',
          description: 'Promotion metadata for create_promotion/update_promotion. Requires Medusa >= 2.21 (older stores reject it); only sent when provided.'
        }
      },
      required: ['action']
    }
  },
  function: withMedusaErrorHints(handlePricingOperation)
};
