/**
 * Comprehensive Medusa Admin Payments Management Tool
 * Supports payment collections, payments, refunds, and captures
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

async function handlePaymentsOperation(args) {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY;
  
  if (!apiKey) {
    throw new Error('MEDUSA_API_KEY environment variable is required');
  }

  const headers = createHeaders(apiKey);

  switch (args.action) {
    case 'list_payment_collections':
      return await listPaymentCollections(baseUrl, headers, args);
    case 'get_payment_collection':
      return await getPaymentCollection(baseUrl, headers, args);
    case 'update_payment_collection':
      return await updatePaymentCollection(baseUrl, headers, args);
    case 'delete_payment_collection':
      return await deletePaymentCollection(baseUrl, headers, args);
    case 'list_payments':
      return await listPayments(baseUrl, headers, args);
    case 'get_payment':
      return await getPayment(baseUrl, headers, args);
    case 'capture_payment':
      return await capturePayment(baseUrl, headers, args);
    case 'cancel_payment':
      return await cancelPayment(baseUrl, headers, args);
    case 'refund_payment':
      return await refundPayment(baseUrl, headers, args);
    case 'list_refunds':
      return await listRefunds(baseUrl, headers, args);
    case 'get_refund':
      return await getRefund(baseUrl, headers, args);
    default:
      throw new Error(`Unknown action: ${args.action}`);
  }
}

// Payment Collections operations
async function listPaymentCollections(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());

  const url = `${baseUrl}/admin/payment-collections?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getPaymentCollection(baseUrl, headers, args) {
  if (!args.id) throw new Error('Payment collection ID is required');
  const url = `${baseUrl}/admin/payment-collections/${args.id}`;
  return await makeRequest(url, { headers });
}

async function updatePaymentCollection(baseUrl, headers, args) {
  if (!args.id) throw new Error('Payment collection ID is required');
  
  const collectionData = {};
  if (args.description) collectionData.description = args.description;
  if (args.metadata) collectionData.metadata = args.metadata;

  const url = `${baseUrl}/admin/payment-collections/${args.id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(collectionData)
  });
}

async function deletePaymentCollection(baseUrl, headers, args) {
  if (!args.id) throw new Error('Payment collection ID is required');
  const url = `${baseUrl}/admin/payment-collections/${args.id}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

// Payments operations
async function listPayments(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());
  if (args.payment_collection_id) params.append('payment_collection_id', args.payment_collection_id);

  const url = `${baseUrl}/admin/payments?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getPayment(baseUrl, headers, args) {
  if (!args.payment_id) throw new Error('Payment ID is required');
  const url = `${baseUrl}/admin/payments/${args.payment_id}`;
  return await makeRequest(url, { headers });
}

async function capturePayment(baseUrl, headers, args) {
  if (!args.payment_id) throw new Error('Payment ID is required');
  
  const captureData = {};
  if (args.amount) captureData.amount = args.amount;

  const url = `${baseUrl}/admin/payments/${args.payment_id}/capture`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(captureData)
  });
}

async function cancelPayment(baseUrl, headers, args) {
  if (!args.payment_id) throw new Error('Payment ID is required');
  
  const url = `${baseUrl}/admin/payments/${args.payment_id}/cancel`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });
}

async function refundPayment(baseUrl, headers, args) {
  if (!args.payment_id) throw new Error('Payment ID is required');
  if (!args.amount) throw new Error('Refund amount is required');
  
  const refundData = {
    amount: args.amount
  };
  if (args.reason) refundData.reason = args.reason;
  if (args.note) refundData.note = args.note;

  const url = `${baseUrl}/admin/payments/${args.payment_id}/refund`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(refundData)
  });
}

// Refunds operations
async function listRefunds(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());
  if (args.payment_id) params.append('payment_id', args.payment_id);

  const url = `${baseUrl}/admin/refunds?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getRefund(baseUrl, headers, args) {
  if (!args.refund_id) throw new Error('Refund ID is required');
  const url = `${baseUrl}/admin/refunds/${args.refund_id}`;
  return await makeRequest(url, { headers });
}

export const apiTool = {
  definition: {
    name: 'manage_medusa_admin_payments',
    description: 'Comprehensive Medusa Admin payments management tool supporting payment collections, payments, captures, cancellations, and refunds.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'list_payment_collections', 'get_payment_collection', 'update_payment_collection', 'delete_payment_collection',
            'list_payments', 'get_payment', 'capture_payment', 'cancel_payment', 'refund_payment',
            'list_refunds', 'get_refund'
          ],
          description: 'The action to perform on payments.'
        },
        id: { type: 'string', description: 'Payment collection ID.' },
        payment_id: { type: 'string', description: 'Payment ID.' },
        refund_id: { type: 'string', description: 'Refund ID.' },
        payment_collection_id: { type: 'string', description: 'Payment collection ID for filtering.' },
        limit: { type: 'number', description: 'Maximum number of items to return.' },
        offset: { type: 'number', description: 'Number of items to skip.' },
        amount: { type: 'number', description: 'Amount for capture/refund.' },
        reason: { type: 'string', description: 'Refund reason.' },
        note: { type: 'string', description: 'Refund note.' },
        description: { type: 'string', description: 'Payment collection description.' },
        metadata: { type: 'object', description: 'Additional metadata.' }
      },
      required: ['action']
    }
  },
  function: handlePaymentsOperation
};