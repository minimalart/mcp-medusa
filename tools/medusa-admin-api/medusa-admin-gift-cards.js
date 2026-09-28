/**
 * Comprehensive Medusa Admin Gift Cards Management Tool
 * Supports gift cards creation, update, balance management
 *
 * Las rutas de gift cards vienen del plugin @medusajs/loyalty-plugin (2.17.2 → 2.21.1):
 *   GET|POST /admin/gift-cards, GET|POST /admin/gift-cards/{id}, GET /admin/gift-cards/{id}/orders
 * No existe DELETE /admin/gift-cards/{id}.
 */

import { appendQueryParam, createHeaders, hasMedusaCredentials, makeRequest, missingCredentialsMessage, normalizeBaseUrl } from "../../lib/medusa-client.js";
import { withMedusaErrorHints } from "../../lib/medusa-version.js";

const REMOVED_ACTIONS = {
  delete:
    'delete was removed: the loyalty plugin has no DELETE /admin/gift-cards/{id} route. ' +
    'To stop a gift card from being used, update it (e.g. set expires_at to a past date or add a note).'
};

async function handleGiftCardsOperation(args) {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY || process.env.MEDUSA_JWT || process.env.MEDUSA_SESSION_COOKIE || process.env.MEDUSA_COOKIE;

  if (REMOVED_ACTIONS[args.action]) {
    return { error: REMOVED_ACTIONS[args.action], removed: true };
  }

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
    case 'list_orders':
      return await listGiftCardOrders(cleanBaseUrl, headers, args);
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
  if (args.status !== undefined) giftCardData.status = args.status;
  if (args.note !== undefined) giftCardData.note = args.note;

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
  if (args.status !== undefined) giftCardData.status = args.status;
  if (args.note !== undefined) giftCardData.note = args.note;

  const url = `${baseUrl}/admin/gift-cards/${args.id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(giftCardData)
  });
}

async function listGiftCardOrders(baseUrl, headers, args) {
  if (!args.id) throw new Error('Gift card ID is required');
  const url = new URL(`${baseUrl}/admin/gift-cards/${encodeURIComponent(args.id)}/orders`);
  appendQueryParam(url.searchParams, 'fields', args.fields);
  return await makeRequest(url.toString(), { headers });
}

export const apiTool = {
  definition: {
    name: 'manage_medusa_admin_gift_cards',
    description:
      'Medusa Admin gift cards from @medusajs/loyalty-plugin (2.17.2+, incl. 2.18 and 2.21.1): list, get, create (currency_code + value >= 1, optional code, expires_at, status pending|redeemed, note, metadata), ' +
      'update (expires_at, status, note, metadata), list_orders (orders where the gift card was used). delete was removed (the plugin has no delete route).',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'get', 'create', 'update', 'list_orders'],
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
        status: { type: 'string', enum: ['pending', 'redeemed'], description: 'Gift card status (create/update).' },
        note: { type: 'string', description: 'Internal note (create/update).' },
        fields: { type: 'string', description: 'Fields selector for list_orders.' },
        metadata: { type: 'object', description: 'Additional metadata.' }
      },
      required: ['action']
    }
  },
  function: withMedusaErrorHints(handleGiftCardsOperation)
};
