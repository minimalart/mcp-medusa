/**
 * Comprehensive Medusa Admin Payments Management Tool
 * Supports payment collections, payments, captures, refunds, providers and refund reasons.
 *
 * Rutas reales de Medusa v2 (todas existen desde 2.17.2, incluida 2.18.0):
 *   POST   /admin/payment-collections                       crear colección (monto pendiente de una orden)
 *   DELETE /admin/payment-collections/{id}
 *   POST   /admin/payment-collections/{id}/mark-as-paid
 *   POST   /admin/payment-collections/{id}/payment-sessions
 *   GET    /admin/payments, GET /admin/payments/{id}
 *   POST   /admin/payments/{id}/capture, POST /admin/payments/{id}/refund
 *   GET    /admin/payments/payment-providers
 *   GET    /admin/refund-reasons
 * No existen GET /admin/payment-collections[/{id}], POST /admin/payment-collections/{id},
 * POST /admin/payments/{id}/cancel ni /admin/refunds: las colecciones se leen desde la
 * orden y los reembolsos desde el pago.
 */

import { appendQueryParam, createHeaders, hasMedusaCredentials, makeRequest, missingCredentialsMessage, normalizeBaseUrl } from "../../lib/medusa-client.js";
import { withMedusaErrorHints } from "../../lib/medusa-version.js";

const REMOVED_ACTIONS = {
  update_payment_collection:
    'update_payment_collection was removed: Medusa v2 has no POST /admin/payment-collections/{id} route. ' +
    'Payment collections are created with create_payment_collection, settled with mark_payment_collection_as_paid, or deleted with delete_payment_collection.',
  cancel_payment:
    'cancel_payment was removed: Medusa v2 has no POST /admin/payments/{id}/cancel route. Uncaptured payments are canceled ' +
    'when the order is canceled (manage_medusa_admin_orders action=cancel); captured payments are returned with refund_payment.'
};

const ORDER_PAYMENT_FIELDS = [
  'id',
  'display_id',
  'currency_code',
  '*payment_collections',
  '*payment_collections.payments',
  '*payment_collections.payments.refunds',
  '*payment_collections.payments.captures'
].join(',');

function buildUrl(baseUrl, path, query = {}) {
  const url = new URL(`${baseUrl}${path}`);
  Object.entries(query).forEach(([key, value]) => appendQueryParam(url.searchParams, key, value));
  return url.toString();
}

/**
 * Medusa 2.18+ rechaza amount <= 0 en capture/refund (validador `.positive()`).
 * Validamos antes de enviar para no mandar requests que igual van a fallar y,
 * sobre todo, para no tratar 0 como "monto total".
 */
function assertPositiveAmount(amount, label) {
  if (amount === undefined || amount === null) return;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${label} amount must be a number greater than 0 (got ${JSON.stringify(amount)}).`);
  }
}

async function handlePaymentsOperation(args) {
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
    case 'list_payment_collections':
      return await listPaymentCollections(baseUrl, headers, args);
    case 'get_payment_collection':
      return await getPaymentCollection(baseUrl, headers, args);
    case 'create_payment_collection':
      return await createPaymentCollection(baseUrl, headers, args);
    case 'mark_payment_collection_as_paid':
      return await markPaymentCollectionAsPaid(baseUrl, headers, args);
    case 'create_payment_session':
      return await createPaymentSession(baseUrl, headers, args);
    case 'delete_payment_collection':
      return await deletePaymentCollection(baseUrl, headers, args);
    case 'list_payments':
      return await listPayments(baseUrl, headers, args);
    case 'get_payment':
      return await getPayment(baseUrl, headers, args);
    case 'capture_payment':
      return await capturePayment(baseUrl, headers, args);
    case 'refund_payment':
      return await refundPayment(baseUrl, headers, args);
    case 'list_refunds':
      return await listRefunds(baseUrl, headers, args);
    case 'get_refund':
      return await getRefund(baseUrl, headers, args);
    case 'list_payment_providers':
      return await listPaymentProviders(baseUrl, headers, args);
    case 'list_refund_reasons':
      return await listRefundReasons(baseUrl, headers, args);
    default:
      throw new Error(`Unknown action: ${args.action}`);
  }
}

async function getOrderPayments(baseUrl, headers, orderId) {
  const url = buildUrl(baseUrl, `/admin/orders/${encodeURIComponent(orderId)}`, { fields: ORDER_PAYMENT_FIELDS });
  const data = await makeRequest(url, { headers });
  return data?.order || {};
}

// Payment Collections operations
async function listPaymentCollections(baseUrl, headers, args) {
  if (!args.order_id) {
    throw new Error('order_id is required: Medusa v2 has no GET /admin/payment-collections route, payment collections are read from their order.');
  }
  const order = await getOrderPayments(baseUrl, headers, args.order_id);
  return {
    order_id: order.id || args.order_id,
    payment_collections: order.payment_collections || []
  };
}

async function getPaymentCollection(baseUrl, headers, args) {
  if (!args.id) throw new Error('Payment collection ID is required');
  if (!args.order_id) {
    throw new Error('order_id is required: Medusa v2 has no GET /admin/payment-collections/{id} route, the collection is read from its order.');
  }
  const order = await getOrderPayments(baseUrl, headers, args.order_id);
  const collection = (order.payment_collections || []).find((entry) => entry.id === args.id);
  if (!collection) {
    return { error: `Payment collection ${args.id} was not found in order ${args.order_id}.` };
  }
  return { payment_collection: collection };
}

async function createPaymentCollection(baseUrl, headers, args) {
  if (!args.order_id) throw new Error('order_id is required');
  if (typeof args.amount !== 'number' || !Number.isFinite(args.amount)) {
    throw new Error('amount (number) is required: the outstanding amount the customer must pay.');
  }

  const url = `${baseUrl}/admin/payment-collections`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ order_id: args.order_id, amount: args.amount })
  });
}

async function markPaymentCollectionAsPaid(baseUrl, headers, args) {
  if (!args.id) throw new Error('Payment collection ID is required');
  if (!args.order_id) throw new Error('order_id is required');

  const body = { order_id: args.order_id };
  if (args.provider_id) body.provider_id = args.provider_id;

  const url = `${baseUrl}/admin/payment-collections/${encodeURIComponent(args.id)}/mark-as-paid`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
}

async function createPaymentSession(baseUrl, headers, args) {
  if (!args.id) throw new Error('Payment collection ID is required');
  if (!args.provider_id) throw new Error('provider_id is required');

  const body = { provider_id: args.provider_id };
  if (args.data) body.data = args.data;

  const url = `${baseUrl}/admin/payment-collections/${encodeURIComponent(args.id)}/payment-sessions`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
}

async function deletePaymentCollection(baseUrl, headers, args) {
  if (!args.id) throw new Error('Payment collection ID is required');
  const url = `${baseUrl}/admin/payment-collections/${encodeURIComponent(args.id)}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

// Payments operations
async function listPayments(baseUrl, headers, args) {
  // GET /admin/payments no acepta payment_collection_id ni order_id (validación estricta):
  // en ese caso leemos los pagos desde la orden.
  if (args.order_id) {
    const order = await getOrderPayments(baseUrl, headers, args.order_id);
    const collections = (order.payment_collections || []).filter(
      (collection) => !args.payment_collection_id || collection.id === args.payment_collection_id
    );
    return {
      order_id: order.id || args.order_id,
      payments: collections.flatMap((collection) =>
        (collection.payments || []).map((payment) => ({ ...payment, payment_collection_id: collection.id }))
      )
    };
  }
  if (args.payment_collection_id) {
    throw new Error('Filtering by payment_collection_id requires order_id (Medusa v2 GET /admin/payments does not support that filter).');
  }

  const url = buildUrl(baseUrl, '/admin/payments', {
    limit: args.limit,
    offset: args.offset,
    q: args.q,
    payment_session_id: args.payment_session_id,
    created_at: args.created_at,
    updated_at: args.updated_at,
    fields: args.fields,
    order: args.order
  });
  return await makeRequest(url, { headers });
}

async function getPayment(baseUrl, headers, args) {
  if (!args.payment_id) throw new Error('Payment ID is required');
  const url = buildUrl(baseUrl, `/admin/payments/${encodeURIComponent(args.payment_id)}`, { fields: args.fields });
  return await makeRequest(url, { headers });
}

async function capturePayment(baseUrl, headers, args) {
  if (!args.payment_id) throw new Error('Payment ID is required');
  assertPositiveAmount(args.amount, 'Capture');

  const captureData = {};
  if (args.amount !== undefined && args.amount !== null) captureData.amount = args.amount;

  const url = `${baseUrl}/admin/payments/${encodeURIComponent(args.payment_id)}/capture`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(captureData)
  });
}

async function refundPayment(baseUrl, headers, args) {
  if (!args.payment_id) throw new Error('Payment ID is required');
  if (args.amount === undefined || args.amount === null) throw new Error('Refund amount is required');
  assertPositiveAmount(args.amount, 'Refund');

  // Medusa v2 acepta { amount, refund_reason_id, note } (strict). `reason` (texto
  // libre de la API v1) no existe: si parece un ID de refund reason lo usamos
  // como tal, si no, lo agregamos a la nota.
  const refundData = {
    amount: args.amount
  };
  const reason = typeof args.reason === 'string' ? args.reason.trim() : '';
  const refundReasonId = args.refund_reason_id || (reason.startsWith('refr_') ? reason : undefined);
  if (refundReasonId) refundData.refund_reason_id = refundReasonId;
  const noteParts = [args.note, reason && !reason.startsWith('refr_') ? `Reason: ${reason}` : undefined].filter(Boolean);
  if (noteParts.length > 0) refundData.note = noteParts.join(' | ');

  const url = `${baseUrl}/admin/payments/${encodeURIComponent(args.payment_id)}/refund`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(refundData)
  });
}

// Refunds operations (no /admin/refunds route in Medusa v2: refunds live on the payment)
async function listRefunds(baseUrl, headers, args) {
  if (args.payment_id) {
    const url = buildUrl(baseUrl, `/admin/payments/${encodeURIComponent(args.payment_id)}`, { fields: 'id,amount,currency_code,*refunds' });
    const data = await makeRequest(url, { headers });
    return { payment_id: args.payment_id, refunds: data?.payment?.refunds || [] };
  }
  if (args.order_id) {
    const order = await getOrderPayments(baseUrl, headers, args.order_id);
    const refunds = (order.payment_collections || []).flatMap((collection) =>
      (collection.payments || []).flatMap((payment) =>
        (payment.refunds || []).map((refund) => ({ ...refund, payment_id: payment.id }))
      )
    );
    return { order_id: order.id || args.order_id, refunds };
  }
  throw new Error('payment_id or order_id is required: Medusa v2 has no /admin/refunds route, refunds are read from the payment or the order.');
}

async function getRefund(baseUrl, headers, args) {
  if (!args.refund_id) throw new Error('Refund ID is required');
  if (!args.payment_id && !args.order_id) {
    throw new Error('payment_id or order_id is required: Medusa v2 has no /admin/refunds/{id} route, the refund is read from its payment.');
  }
  const { refunds } = await listRefunds(baseUrl, headers, args);
  const refund = refunds.find((entry) => entry.id === args.refund_id);
  if (!refund) {
    return { error: `Refund ${args.refund_id} was not found.` };
  }
  return { refund };
}

async function listPaymentProviders(baseUrl, headers, args) {
  const url = buildUrl(baseUrl, '/admin/payments/payment-providers', {
    limit: args.limit,
    offset: args.offset,
    id: args.provider_id,
    is_enabled: args.is_enabled,
    fields: args.fields
  });
  return await makeRequest(url, { headers });
}

async function listRefundReasons(baseUrl, headers, args) {
  const url = buildUrl(baseUrl, '/admin/refund-reasons', {
    limit: args.limit,
    offset: args.offset,
    q: args.q,
    fields: args.fields
  });
  return await makeRequest(url, { headers });
}

const ACTIONS = [
  'list_payment_collections', 'get_payment_collection', 'create_payment_collection', 'mark_payment_collection_as_paid',
  'create_payment_session', 'delete_payment_collection',
  'list_payments', 'get_payment', 'capture_payment', 'refund_payment',
  'list_refunds', 'get_refund', 'list_payment_providers', 'list_refund_reasons'
];

export const apiTool = {
  definition: {
    name: 'manage_medusa_admin_payments',
    description:
      'Medusa Admin payments (Medusa 2.17.2+, incl. 2.18 and 2.21.1). Payment collections are read from their order: list_payment_collections / get_payment_collection need order_id. ' +
      'create_payment_collection (order_id + amount, for an outstanding balance), mark_payment_collection_as_paid (id + order_id, records a manual payment), create_payment_session (id + provider_id), delete_payment_collection. ' +
      'list_payments / get_payment, capture_payment (payment_id, optional amount > 0; omit amount to capture the full authorized amount), refund_payment (payment_id + amount > 0, optional refund_reason_id and note; money is returned to the customer through the provider). ' +
      'list_refunds / get_refund read refunds from a payment_id or order_id. list_payment_providers and list_refund_reasons help pick provider_id / refund_reason_id. ' +
      'Removed (no such routes in Medusa v2): update_payment_collection, cancel_payment (cancel the order instead).',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ACTIONS,
          description: 'The action to perform on payments.'
        },
        id: { type: 'string', description: 'Payment collection ID (get_payment_collection, mark_payment_collection_as_paid, create_payment_session, delete_payment_collection).' },
        order_id: { type: 'string', description: 'Order ID. Required for list_payment_collections, get_payment_collection, create_payment_collection and mark_payment_collection_as_paid; optional filter for list_payments/list_refunds.' },
        payment_id: { type: 'string', description: 'Payment ID (get_payment, capture_payment, refund_payment, list_refunds, get_refund).' },
        refund_id: { type: 'string', description: 'Refund ID (get_refund; requires payment_id or order_id).' },
        payment_collection_id: { type: 'string', description: 'Payment collection filter for list_payments (requires order_id).' },
        payment_session_id: { type: 'string', description: 'Payment session filter for list_payments.' },
        provider_id: { type: 'string', description: 'Payment provider ID (mark_payment_collection_as_paid optional, create_payment_session required, list_payment_providers filter).' },
        is_enabled: { type: 'boolean', description: 'Filter payment providers by enabled state.' },
        data: { type: 'object', description: 'Provider data for create_payment_session.' },
        limit: { type: 'number', description: 'Maximum number of items to return.' },
        offset: { type: 'number', description: 'Number of items to skip.' },
        q: { type: 'string', description: 'Search query (list_payments, list_refund_reasons).' },
        fields: { type: 'string', description: 'Fields selector for list/get actions.' },
        order: { type: 'string', description: 'Sort order for list_payments, e.g. -created_at.' },
        created_at: { type: 'object', description: 'Date filter for list_payments with operators ($gte/$lte/$gt/$lt).' },
        updated_at: { type: 'object', description: 'Date filter for list_payments with operators ($gte/$lte/$gt/$lt).' },
        amount: { type: 'number', description: 'Amount: must be > 0 for capture_payment/refund_payment (required for refund_payment); required for create_payment_collection.' },
        refund_reason_id: { type: 'string', description: 'Refund reason ID for refund_payment (see list_refund_reasons).' },
        reason: { type: 'string', description: 'Deprecated: free-text refund reason. A refund reason ID (refr_...) is sent as refund_reason_id; any other text is appended to note.' },
        note: { type: 'string', description: 'Refund note.' }
      },
      required: ['action']
    }
  },
  function: withMedusaErrorHints(handlePaymentsOperation)
};
