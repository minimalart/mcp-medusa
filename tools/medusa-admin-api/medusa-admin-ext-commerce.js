/**
 * Extensiones de COMERCIO del boilerplate: loyalty, gift cards (experiencia),
 * suscripciones (recurring orders), carritos abandonados, beneficios de pago,
 * bundles, entornos de precios, presupuestos B2B, compras mínimas, documentos
 * fiscales y perfiles de facturación.
 *
 * Declarativa: ver `lib/extension-resources.js`.
 */

import { createExtensionTool } from '../../lib/extension-resources.js';

export const RESOURCES = {
  // ─── Loyalty ────────────────────────────────────────────────────────────────
  loyalty_programs: { path: '/admin/loyalty/programs', summary: 'Programas de puntos' },
  loyalty_rules: {
    path: '/admin/loyalty/rules',
    summary: 'Reglas de acumulación (query program_id, event)',
  },
  loyalty_rewards: { path: '/admin/loyalty/rewards', summary: 'Recompensas canjeables' },
  loyalty_tiers: { path: '/admin/loyalty/tiers', ops: ['list', 'create', 'update', 'delete'], summary: 'Niveles del programa' },
  loyalty_campaigns: {
    path: '/admin/loyalty/campaigns',
    ops: ['list', 'create', 'update', 'delete'],
    summary: 'Campañas de puntos extra',
  },
  loyalty_grants: {
    path: '/admin/loyalty/grants',
    readOnly: true,
    ops: ['list'],
    summary: 'Puntos otorgados (query status, customer_id)',
  },
  loyalty_movements: { path: '/admin/loyalty/movements', readOnly: true, ops: ['list'], summary: 'Movimientos de puntos' },
  loyalty_customers: {
    path: '/admin/loyalty/customers',
    readOnly: true,
    ops: ['get'],
    summary: 'Saldo y actividad loyalty de un cliente (id = customer_id)',
  },
  loyalty_dashboard: { path: '/admin/loyalty/dashboard', singleton: true, readOnly: true, summary: 'KPIs del programa' },

  // ─── Gift cards (experiencia de regalo) ─────────────────────────────────────
  gift_card_deliveries: {
    path: '/admin/gift-card-experience/deliveries',
    ops: ['list', 'get', 'update'],
    summary: 'Envíos de gift cards (query delivery_status; update = body {recipient_email} antes del envío)',
    subActions: {
      cancel: { method: 'POST', path: '/{id}/cancel' },
      retry: { method: 'POST', path: '/{id}/retry', impact: 'high', note: 'Reenvía la gift card por email al destinatario.' },
    },
  },
  gift_card_designs: {
    path: '/admin/gift-card-experience/designs',
    ops: ['list', 'create', 'update', 'delete'],
    summary: 'Diseños de gift card',
  },
  gift_card_settings: {
    path: '/admin/gift-card-experience/settings',
    singleton: true,
    summary: 'Configuración de gift cards',
    subActions: {
      analytics: { method: 'GET', path: '/admin/gift-card-experience/analytics' },
      permissions: { method: 'GET', path: '/admin/gift-card-experience/permissions' },
    },
  },

  // ─── Suscripciones ──────────────────────────────────────────────────────────
  recurring_orders: {
    path: '/admin/recurring-orders',
    ops: ['list', 'get'],
    summary: 'Suscripciones de clientes (query status)',
    subActions: {
      pause: { method: 'POST', path: '/{id}/pause' },
      resume: { method: 'POST', path: '/{id}/resume' },
      cancel: { method: 'POST', path: '/{id}/cancel', impact: 'high', note: 'Cancela la suscripción del cliente.' },
      reconcile: { method: 'POST', path: '/{id}/reconcile' },
      force_cycle: {
        method: 'POST',
        path: '/{id}/cycles/{child_id}/force',
        impact: 'high',
        note: 'Fuerza el ciclo (genera la orden/cobro). child_id = cycle_id.',
      },
      retry_cycle_payment: {
        method: 'POST',
        path: '/{id}/cycles/{child_id}/retry-payment',
        impact: 'high',
        note: 'Reintenta el COBRO del ciclo. child_id = cycle_id.',
      },
      list_cycles: { method: 'GET', path: '/cycles' },
      forecast: { method: 'GET', path: '/forecast' },
      export: {
        method: 'GET',
        path: '/export',
        note: 'CSV (vista previa). query {status, q, sales_channel_id}.',
        download: 'CSV completo: backoffice → Suscripciones → Exportar.',
      },
    },
  },
  recurring_order_plans: {
    path: '/admin/recurring-orders/plans',
    summary: 'Planes de suscripción (delete = archiva)',
    subActions: {
      duplicate: { method: 'POST', path: '/{id}/duplicate' },
      publish: { method: 'POST', path: '/{id}/publish', note: 'El plan queda ofrecido en la tienda.' },
    },
  },
  recurring_order_offers: {
    path: '/admin/recurring-orders/offers',
    ops: ['list', 'create', 'delete'],
    summary: 'Ofertas de retención',
  },
  recurring_order_cancellation_reasons: {
    path: '/admin/recurring-orders/cancellation-reasons',
    ops: ['list', 'create', 'update', 'delete'],
    summary: 'Motivos de cancelación',
  },
  recurring_order_alerts: {
    path: '/admin/recurring-orders/alerts',
    ops: ['list'],
    summary: 'Alertas operativas de suscripciones',
    subActions: { resolve: { method: 'POST', path: '/{id}/resolve' } },
  },
  recurring_order_settings: {
    path: '/admin/recurring-orders/settings',
    singleton: true,
    summary: 'Configuración de suscripciones (query sales_channel_id)',
  },
  recurring_order_analytics: {
    path: '/admin/recurring-orders/analytics',
    singleton: true,
    ops: ['get'],
    summary: 'Analítica de suscripciones (query from,to YYYY-MM-DD)',
    subActions: { rebuild: { method: 'POST', path: '/rebuild', note: 'Recalcula la analítica.' } },
  },

  // ─── Carritos / pagos / precios ─────────────────────────────────────────────
  abandoned_carts: {
    path: '/admin/abandoned-carts',
    ops: ['list'],
    summary: 'Carritos abandonados + métricas',
    subActions: {
      resend: { method: 'POST', path: '/{id}/resend', impact: 'high', note: 'Envía un email de recordatorio REAL al cliente.' },
    },
  },
  payment_benefits: {
    path: '/admin/payment-benefits',
    summary: 'Beneficios de pago: cuotas/descuentos por banco o medio (query provider, status, type, source)',
    subActions: {
      catalog: { method: 'GET', path: '/catalog' },
      dashboard: { method: 'GET', path: '/dashboard' },
      sync: {
        method: 'POST',
        path: '/sync/{id}',
        note: 'id = código del proveedor. Sincroniza el catálogo global: ejecutar sin site_id o desde la tienda principal.',
      },
    },
  },
  bundles: {
    path: '/admin/bundles',
    summary: 'Bundles/combos (query q, status, store_id)',
    subActions: {
      publish: {
        method: 'POST',
        path: '/{id}/publish',
        note: 'Publica en la tienda. query {dry_run:1} solo valida (422 lista los problemas).',
      },
      unpublish: { method: 'POST', path: '/{id}/unpublish' },
      set_stores: { method: 'POST', path: '/{id}/stores', note: 'Tiendas donde se ofrece.' },
    },
    children: {
      items: { path: '/{id}/items', ops: ['create', 'update', 'delete'], notes: { update: 'child_id = itemId.' } },
    },
  },
  pricing_environments: {
    path: '/admin/pricing-environments',
    ops: ['list', 'get'],
    summary: 'Entornos de precios (query state)',
    subActions: { set_scope: { method: 'POST', path: '/{id}/scope' } },
  },
  price_list_sales_channel_rules: {
    path: '/admin/price-lists',
    ops: ['get', 'update', 'delete'],
    opConfig: {
      get: { method: 'GET', path: '/{id}/sales-channel-rule' },
      update: { method: 'POST', path: '/{id}/sales-channel-rule', requires: ['body.sales_channel_ids'] },
      delete: { method: 'DELETE', path: '/{id}/sales-channel-rule' },
    },
    summary: 'Regla de canales de una price list (id = price_list_id; update body {sales_channel_ids})',
  },
  minimum_purchases: {
    path: '/admin/store-config/minimum-purchase',
    ops: ['list', 'create', 'update', 'delete'],
    summary: 'Montos mínimos de compra',
  },

  // ─── B2B ────────────────────────────────────────────────────────────────────
  b2b_draft_orders: {
    path: '/admin/b2b/draft-orders',
    ops: ['list', 'get'],
    summary: 'Presupuestos/pedidos B2B a aprobar (limit≤100, query status → {draft_orders,count,open_count})',
    subActions: {
      approve: {
        method: 'POST',
        path: '/{id}/approve',
        impact: 'high',
        note: 'Aprueba el pedido del cliente B2B. body {note?}.',
      },
      reject: {
        method: 'POST',
        path: '/{id}/reject',
        impact: 'high',
        requires: ['body.note'],
        note: 'Rechaza; el cliente VE body.note (3-2000 chars).',
      },
      request_changes: {
        method: 'POST',
        path: '/{id}/request-changes',
        impact: 'high',
        requires: ['body.note'],
        note: 'Pide cambios; el cliente VE body.note.',
      },
      register_payment: {
        method: 'POST',
        path: '/{id}/payment',
        impact: 'high',
        requires: ['body.amount'],
        note: 'Registra un pago: body {amount>0, reference?, note?}.',
      },
    },
  },
  customer_billing_profiles: {
    path: '/admin/customers',
    readOnly: true,
    ops: ['get'],
    opConfig: { get: { method: 'GET', path: '/{id}/billing-profiles' } },
    summary: 'Perfiles de facturación de un cliente (id = customer_id)',
  },
  fiscal_documents: {
    path: '/admin/fiscal-documents',
    ops: ['list', 'get', 'create', 'delete'],
    opConfig: {
      list: {
        method: 'GET',
        requires: ['query.owner_type', 'query.owner_id'],
        note: 'query {owner_type:"corporate"|"company", owner_id} obligatorios.',
      },
    },
    summary: 'Constancias fiscales de empresas/corporativos (list requiere query owner_type + owner_id)',
    subActions: {
      diff: { method: 'GET', path: '/{id}/diff', note: 'query {against}.' },
      download: {
        method: 'GET',
        path: '/{id}/download',
        note: 'PDF (se devuelve solo metadata).',
        download: 'PDF: backoffice → Empresas/Corporativos → Documentación fiscal.',
      },
      get_config: { method: 'GET', path: '/config' },
      update_config: { method: 'POST', path: '/config' },
    },
  },
};

const GROUPS = [
  {
    title: 'Loyalty',
    resources: [
      'loyalty_programs',
      'loyalty_rules',
      'loyalty_rewards',
      'loyalty_tiers',
      'loyalty_campaigns',
      'loyalty_grants',
      'loyalty_movements',
      'loyalty_customers',
      'loyalty_dashboard',
    ],
  },
  { title: 'Gift cards', resources: ['gift_card_deliveries', 'gift_card_designs', 'gift_card_settings'] },
  {
    title: 'Suscripciones',
    resources: [
      'recurring_orders',
      'recurring_order_plans',
      'recurring_order_offers',
      'recurring_order_cancellation_reasons',
      'recurring_order_alerts',
      'recurring_order_settings',
      'recurring_order_analytics',
    ],
  },
  {
    title: 'Carritos, pagos y precios',
    resources: [
      'abandoned_carts',
      'payment_benefits',
      'bundles',
      'pricing_environments',
      'price_list_sales_channel_rules',
      'minimum_purchases',
    ],
  },
  { title: 'B2B', resources: ['b2b_draft_orders', 'customer_billing_profiles', 'fiscal_documents'] },
];

const tool = createExtensionTool({
  name: 'manage_minimalart_commerce',
  intro:
    'Extensiones de COMERCIO del backoffice: loyalty, gift cards, suscripciones, carritos abandonados, beneficios de pago, bundles, precios, compras mínimas y B2B (presupuestos, constancias fiscales). Empresas/corporativos y sus miembros/crédito: manage_minimalart_extensions.',
  resources: RESOURCES,
  groups: GROUPS,
});

export const extensionResources = tool.resources;

export const apiTool = {
  definition: tool.definition,
  function: tool.function,
};
