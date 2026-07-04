/**
 * Comprehensive Medusa Admin Gift Cards Management Tool
 * Supports gift cards creation, update, balance management
 */

import { createHeaders, hasMedusaCredentials, makeRequest, missingCredentialsMessage, normalizeBaseUrl } from "../../lib/medusa-client.js";

async function handleGiftCardsOperation(args) {
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
      return await listGiftCards(cleanBaseUrl, headers, args);
    case 'get':
      return await getGiftCard(cleanBaseUrl, headers, args);
    case 'create':
      return await createGiftCard(cleanBaseUrl, headers, args);
    case 'update':
      return await updateGiftCard(cleanBaseUrl, headers, args);
    case 'delete':
      return await deleteGiftCard(cleanBaseUrl, headers, args);
    default:
      throw new Error(`Unknown action: ${args.action}`);
  }
}

async function listGiftCards(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());
  if (args.q) params.append('q', args.q);

  const url = `${baseUrl}/admin/gift-cards?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getGiftCard(baseUrl, headers, args) {
  if (!args.id) throw new Error('Gift card ID is required');
  const url = `${baseUrl}/admin/gift-cards/${args.id}`;
  return await makeRequest(url, { headers });
}

async function createGiftCard(baseUrl, headers, args) {
  const giftCardData = {};
  if (args.code) giftCardData.code = args.code;
  if (args.value) giftCardData.value = args.value;
  if (args.currency_code) giftCardData.currency_code = args.currency_code;
  if (args.expires_at || args.ends_at) giftCardData.expires_at = args.expires_at || args.ends_at;
  if (args.metadata) giftCardData.metadata = args.metadata;

  const url = `${baseUrl}/admin/gift-cards`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(giftCardData)
  });
}

async function updateGiftCard(baseUrl, headers, args) {
  if (!args.id) throw new Error('Gift card ID is required');
  
  const giftCardData = {};
  if (args.is_disabled !== undefined) {
    return {
      error: 'is_disabled is not supported by this Medusa gift card endpoint.',
      unsupported: true
    };
  }
  if (args.expires_at || args.ends_at) giftCardData.expires_at = args.expires_at || args.ends_at;
  if (args.metadata) giftCardData.metadata = args.metadata;

  const url = `${baseUrl}/admin/gift-cards/${args.id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(giftCardData)
  });
}

async function deleteGiftCard(baseUrl, headers, args) {
  if (!args.id) throw new Error('Gift card ID is required');
  const url = `${baseUrl}/admin/gift-cards/${args.id}`;
  try {
    return await makeRequest(url, { method: 'DELETE', headers });
  } catch (error) {
    if (error?.status === 404) {
      return {
        error: 'Gift card delete is not exposed by this Medusa backend.',
        unsupported: true,
        id: args.id
      };
    }
    throw error;
  }
}

export const apiTool = {
  definition: {
    name: 'manage_medusa_admin_gift_cards',
    description: 'Comprehensive Medusa Admin gift cards management tool supporting gift card operations (list, get, create, update, delete).',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'get', 'create', 'update', 'delete'],
          description: 'The action to perform on gift cards.'
        },
        id: { type: 'string', description: 'Gift card ID.' },
        code: { type: 'string', description: 'Gift card code.' },
        limit: { type: 'number', description: 'Maximum number of items to return.' },
        offset: { type: 'number', description: 'Number of items to skip.' },
        q: { type: 'string', description: 'Search query.' },
        type: { type: 'string', description: 'Gift card type.' },
        value: { type: 'number', description: 'Gift card value.' },
        currency_code: { type: 'string', description: 'Gift card currency code.' },
        balance: { type: 'number', description: 'Gift card balance.' },
        region_id: { type: 'string', description: 'Region ID.' },
        is_disabled: { type: 'boolean', description: 'Whether gift card is disabled.' },
        ends_at: { type: 'string', description: 'Expiration date alias. Prefer expires_at.' },
        expires_at: { type: 'string', description: 'Expiration date.' },
        metadata: { type: 'object', description: 'Additional metadata.' }
      },
      required: ['action']
    }
  },
  function: handleGiftCardsOperation
};
