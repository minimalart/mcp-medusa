/**
 * INTEGRACIONES del boilerplate: ERP, Typesense (búsqueda), GA4, Clarity, Google
 * Merchant, newsletter y MercadoLibre (plugin marketplaces).
 *
 * Declarativa: ver `lib/extension-resources.js`.
 */

import { createExtensionTool } from '../../lib/extension-resources.js';

// Typesense synonyms/curations/stopwords/presets: create y update son PUT /:id (upsert).
const typesenseRule = (path, summary) => ({
  path,
  summary,
  opConfig: {
    create: { method: 'PUT', path: '/{id}', note: 'Upsert: id = identificador de la regla.' },
    update: { method: 'PUT', path: '/{id}' },
  },
});

export const RESOURCES = {
  // ─── ERP ────────────────────────────────────────────────────────────────────
  erp_config: {
    path: '/admin/erp/config',
    singleton: true,
    summary: 'Configuración del ERP (proveedor, mapeos)',
    subActions: {
      lookups: { method: 'GET', path: '/lookups', note: 'Listas auxiliares (depósitos, listas de precio...).' },
      reset_image_failures: { method: 'POST', path: '/reset-image-failures' },
      validate_connection: {
        method: 'POST',
        path: '/admin/erp/validate-connection',
        mutating: false,
        note: 'Prueba credenciales/conexión.',
      },
    },
  },
  erp: {
    path: '/admin/erp',
    ops: [],
    summary: 'Operaciones ERP: syncs, órdenes, comprobantes',
    subActions: {
      run_catalog_sync: {
        method: 'POST',
        path: '/catalog-sync/run',
        impact: 'high',
        note: 'Sincroniza catálogo desde el ERP (202). query {dry_run, full_sweep, categories_backfill}.',
      },
      run_stock_sync: { method: 'POST', path: '/stock-sync/run', impact: 'high', note: 'Pisa stock con el del ERP (202).' },
      price_lists: { method: 'GET', path: '/price-lists' },
      unregistered_orders: { method: 'GET', path: '/unregistered-orders', note: 'Órdenes no registradas en el ERP.' },
      get_order: { method: 'GET', path: '/orders/{id}', note: 'Estado ERP de una orden (id = order_id).' },
      order_stock_by_location: { method: 'GET', path: '/orders/{id}/stock-by-location' },
      set_order_billing_deposito: {
        method: 'POST',
        path: '/orders/{id}/billing-deposito',
        note: 'Depósito de facturación de la orden: body {deposito: string|null}.',
      },
      download_invoice: {
        method: 'GET',
        path: '/invoices/{id}/download',
        note: 'Comprobante PDF (solo metadata).',
        download: 'Comprobante: backoffice → ERP → órdenes → Descargar comprobante.',
      },
    },
  },
  erp_sync_logs: {
    path: '/admin/erp/sync-logs',
    readOnly: true,
    summary: 'Logs de sincronización ERP (query type, status)',
    subActions: { list_items: { method: 'GET', path: '/{id}/items' } },
  },
  erp_outbox_events: {
    path: '/admin/erp/outbox-events',
    ops: ['list'],
    summary: 'Eventos pendientes/enviados al ERP (query status)',
    subActions: {
      preview: { method: 'GET', path: '/{id}/preview', note: 'Payload que se enviaría.' },
      retry: { method: 'POST', path: '/{id}/retry', impact: 'high', note: 'Reenvía el evento al ERP (puede emitir comprobantes).' },
      resync: { method: 'POST', path: '/resync', impact: 'high', note: 'Reencola eventos al ERP.' },
    },
  },
  erp_tinting: {
    path: '/admin/erp/tinting',
    singleton: true,
    ops: ['get'],
    summary: 'Tintometría (bases, colores, fórmulas) del ERP',
    subActions: {
      detect_bases: { method: 'POST', path: '/bases/detect', mutating: false },
      confirm_bases: { method: 'POST', path: '/bases/confirm' },
      sync_base_products: { method: 'POST', path: '/bases/sync-products' },
      update_base_products: { method: 'PATCH', path: '/bases/sync-products' },
      import: { method: 'POST', path: '/import', note: 'Importa colores/fórmulas.' },
      price_probe: { method: 'POST', path: '/price-probe', mutating: false },
      delete_colors: { method: 'DELETE', path: '/colors', sendBody: true, note: 'DELETE con body (selección de colores).' },
      delete_formulas: { method: 'DELETE', path: '/formulas', sendBody: true, note: 'DELETE con body (selección de fórmulas).' },
    },
  },

  // ─── Typesense (búsqueda) ───────────────────────────────────────────────────
  typesense: {
    path: '/admin/typesense',
    ops: [],
    summary: 'Buscador Typesense: estado, reindexado, prueba, analítica',
    subActions: {
      config: { method: 'GET', path: '/config' },
      test: { method: 'GET', path: '/test', note: 'Prueba la conexión.' },
      last_sync: { method: 'GET', path: '/last-sync' },
      sync_status: { method: 'GET', path: '/sync' },
      sync: { method: 'POST', path: '/sync', note: 'Reindexa el catálogo (202).' },
      search: { method: 'POST', path: '/search', mutating: false, note: 'Búsqueda de prueba: body {searchOptions:{q, ...SearchParams}, collectionName?}.' },
      analytics: { method: 'GET', path: '/analytics', note: 'query {queriesLimit, productsLimit}.' },
      init_analytics: { method: 'POST', path: '/analytics/init' },
      reset_analytics: { method: 'POST', path: '/analytics/reset', impact: 'high', note: 'BORRA la analítica de búsquedas.' },
    },
  },
  typesense_collections: {
    path: '/admin/typesense/collections',
    readOnly: true,
    summary: 'Colecciones del índice',
    subActions: { get_default: { method: 'GET', path: '/default' } },
  },
  typesense_sync_logs: {
    path: '/admin/typesense/sync-logs',
    readOnly: true,
    summary: 'Logs de reindexado (query mode, status)',
    subActions: { list_items: { method: 'GET', path: '/{id}/items' } },
  },
  typesense_synonyms: typesenseRule('/admin/typesense/synonyms', 'Sinónimos (create/update = PUT /:id upsert)'),
  typesense_curations: typesenseRule('/admin/typesense/curations', 'Curaciones/pins de resultados (PUT upsert)'),
  typesense_stopwords: typesenseRule('/admin/typesense/stopwords', 'Stopwords (PUT upsert)'),
  typesense_presets: typesenseRule('/admin/typesense/presets', 'Presets de búsqueda (PUT upsert)'),

  // ─── Analítica / marketing ──────────────────────────────────────────────────
  ga4_config: {
    path: '/admin/ga4-config',
    singleton: true,
    summary: 'Google Analytics 4 (measurement id, estado)',
    subActions: { test: { method: 'POST', path: '/test', mutating: false, note: 'Envía un evento de prueba a GA4.' } },
  },
  ga4_mappings: {
    path: '/admin/ga4-mappings',
    summary: 'Mapeos de eventos a GA4 (q + paginado)',
    subActions: { events: { method: 'GET', path: '/events', note: 'Eventos disponibles.' } },
  },
  ga4_builtins: {
    path: '/admin/ga4-builtins',
    ops: ['list', 'update'],
    summary: 'Eventos GA4 integrados (update id = key)',
  },
  clarity: {
    path: '/admin/marketing-privacy/clarity',
    singleton: true,
    readOnly: true,
    summary: 'Microsoft Clarity (estado; 409 si no está configurado)',
  },
  google_merchant: {
    path: '/admin/marketing-privacy/merchant',
    singleton: true,
    readOnly: true,
    summary: 'Google Merchant Center (estado del feed)',
  },
  newsletter_subscriptions: {
    path: '/admin/newsletter-subscriptions',
    ops: ['list'],
    summary: 'Suscriptores al newsletter (limit≤100, query sync_status)',
    subActions: { retry: { method: 'POST', path: '/{id}/retry', note: 'Reintenta la sync con el proveedor.' } },
  },

  // ─── MercadoLibre (plugin marketplaces) ─────────────────────────────────────
  ml_settings: {
    path: '/admin/marketplaces/settings',
    singleton: true,
    summary: 'Módulo MercadoLibre de la tienda (update body {enabled})',
  },
  marketplaces: {
    path: '/admin/marketplaces',
    ops: [],
    summary: 'MercadoLibre: catálogo publicable, opciones, capacidades, primeras publicaciones, registros',
    subActions: {
      catalog: { method: 'GET', path: '/catalog', note: 'Productos de la tienda publicables.' },
      options: { method: 'GET', path: '/options', note: 'Depósitos, regiones, listas, categorías de la tienda.' },
      listing_context: {
        method: 'GET',
        path: '/listing-context',
        requires: ['query.account_id', 'query.product_id'],
        note: 'query {account_id, product_id, q?} → categorías ML sugeridas.',
      },
      listing_capabilities: {
        method: 'POST',
        path: '/listing-capabilities',
        mutating: false,
        note: 'body {account_id, category_id "MLA…", condition, attributes[]}.',
      },
      first_listing: {
        method: 'POST',
        path: '/first-listings',
        note: 'Encola la validación de una primera publicación (202; publica recién al confirmar el job).',
      },
      list_products: { method: 'GET', path: '/products' },
      get_product: { method: 'GET', path: '/products/{id}' },
      list_events: { method: 'GET', path: '/events' },
      get_event: { method: 'GET', path: '/events/{id}' },
      list_audit: { method: 'GET', path: '/audit' },
    },
  },
  ml_accounts: {
    path: '/admin/marketplaces/accounts',
    ops: ['list', 'get', 'create', 'update'],
    summary: 'Cuentas MercadoLibre conectadas',
    subActions: {
      connect: { method: 'POST', path: '/{id}/connect', note: 'Devuelve la URL de OAuth para que el usuario la abra.' },
      disconnect: { method: 'POST', path: '/{id}/disconnect', impact: 'high', note: 'Desconecta la cuenta y borra credenciales.' },
      import: { method: 'POST', path: '/{id}/import', note: 'Importa publicaciones existentes (202).' },
      sync: { method: 'POST', path: '/{id}/sync', impact: 'high', note: 'Sincroniza precios/stock con MercadoLibre (202).' },
    },
  },
  ml_offers: {
    path: '/admin/marketplaces/offers',
    ops: ['list', 'get'],
    summary: 'Publicaciones ML (query account_id, product_id, status, q)',
    subActions: {
      link: { method: 'POST', path: '/{id}/link', note: 'Vincula variantes: body {bindings[], ignored?}.' },
      policy: { method: 'POST', path: '/{id}/policy', note: 'body {sync_price, sync_stock}.' },
      capabilities: { method: 'POST', path: '/{id}/capabilities', mutating: false },
      status: {
        method: 'POST',
        path: '/{id}/status',
        impact: 'high',
        requires: ['body.status'],
        note: 'Pausa/activa la publicación EN MercadoLibre: body {status:"active"|"paused"}.',
      },
      preview_resolution: { method: 'POST', path: '/{id}/preview-resolution', note: 'Arma una propuesta de cambios (no publica).' },
      resolve: {
        method: 'POST',
        path: '/{id}/resolve',
        impact: 'high',
        note: 'Aplica la propuesta EN MercadoLibre: body {proposal_id, validation_hash}.',
      },
      drift: { method: 'POST', path: '/{id}/drift', impact: 'high', note: 'Resuelve diferencias tienda↔ML.' },
    },
  },
  ml_templates: {
    path: '/admin/marketplaces/templates',
    ops: ['list', 'get', 'create', 'update'],
    summary: 'Plantillas de publicación ML',
  },
  ml_proposals: {
    path: '/admin/marketplaces/proposals',
    ops: ['list', 'get', 'create'],
    summary: 'Propuestas de publicación (create encola validación, 202)',
  },
  ml_jobs: {
    path: '/admin/marketplaces/jobs',
    ops: ['list', 'get'],
    summary: 'Jobs ML (query status, kind, q)',
    subActions: {
      confirm: { method: 'POST', path: '/{id}/confirm', impact: 'high', note: 'PUBLICA/actualiza en MercadoLibre lo validado.' },
      cancel: { method: 'POST', path: '/{id}/cancel' },
      retry: { method: 'POST', path: '/{id}/retry' },
    },
  },
  ml_movements: {
    path: '/admin/marketplaces/movements',
    ops: ['list', 'get'],
    summary: 'Movimientos de stock por ventas ML',
    subActions: {
      resolve: { method: 'POST', path: '/{id}/resolve', requires: ['body.applied'], note: 'body {applied: boolean}.' },
    },
  },
};

const GROUPS = [
  { title: 'ERP', resources: ['erp_config', 'erp', 'erp_sync_logs', 'erp_outbox_events', 'erp_tinting'] },
  {
    title: 'Typesense (búsqueda)',
    resources: [
      'typesense',
      'typesense_collections',
      'typesense_sync_logs',
      'typesense_synonyms',
      'typesense_curations',
      'typesense_stopwords',
      'typesense_presets',
    ],
  },
  {
    title: 'Analítica y marketing',
    resources: ['ga4_config', 'ga4_mappings', 'ga4_builtins', 'clarity', 'google_merchant', 'newsletter_subscriptions'],
  },
  {
    title: 'MercadoLibre',
    resources: ['ml_settings', 'marketplaces', 'ml_accounts', 'ml_offers', 'ml_templates', 'ml_proposals', 'ml_jobs', 'ml_movements'],
  },
];

const tool = createExtensionTool({
  name: 'manage_minimalart_integrations',
  intro:
    'INTEGRACIONES del backoffice: ERP, buscador Typesense, GA4, Clarity, Google Merchant, newsletter y MercadoLibre. WhatsApp: manage_minimalart_whatsapp.',
  resources: RESOURCES,
  groups: GROUPS,
});

export const extensionResources = tool.resources;

export const apiTool = {
  definition: tool.definition,
  function: tool.function,
};
