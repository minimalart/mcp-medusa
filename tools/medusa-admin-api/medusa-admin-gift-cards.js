/**
 * Comprehensive Medusa Admin Gift Cards Management Tool
 * Supports gift cards creation, update, balance management
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

async function handleGiftCardsOperation(args) {
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
  if (args.type) giftCardData.type = args.type;
  if (args.value) giftCardData.value = args.value;
  if (args.balance) giftCardData.balance = args.balance;
  if (args.region_id) giftCardData.region_id = args.region_id;
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
  if (args.balance !== undefined) giftCardData.balance = args.balance;
  if (args.is_disabled !== undefined) giftCardData.is_disabled = args.is_disabled;
  if (args.ends_at) giftCardData.ends_at = args.ends_at;
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
  return await makeRequest(url, { method: 'DELETE', headers });
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
        limit: { type: 'number', description: 'Maximum number of items to return.' },
        offset: { type: 'number', description: 'Number of items to skip.' },
        q: { type: 'string', description: 'Search query.' },
        type: { type: 'string', description: 'Gift card type.' },
        value: { type: 'number', description: 'Gift card value.' },
        balance: { type: 'number', description: 'Gift card balance.' },
        region_id: { type: 'string', description: 'Region ID.' },
        is_disabled: { type: 'boolean', description: 'Whether gift card is disabled.' },
        ends_at: { type: 'string', description: 'Expiration date.' },
        metadata: { type: 'object', description: 'Additional metadata.' }
      },
      required: ['action']
    }
  },
  function: handleGiftCardsOperation
};