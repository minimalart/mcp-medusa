/**
 * TIENDAS y configuración del boilerplate: multistore (sites, plantillas,
 * importación de catálogo, modos de venta), configuración de la tienda
 * (store-config), app-settings, extensiones de la plataforma Mercatto y manifest.
 *
 * Declarativa: ver `lib/extension-resources.js`.
 */

import { createExtensionTool } from '../../lib/extension-resources.js';

export const RESOURCES = {
  // ─── Multistore ────────────────────────────────────────────────────────────
  sites: {
    path: '/admin/sites',
    summary: 'Tiendas del multistore (el id es el site_id de las demás tools)',
    opConfig: {
      create: { method: 'POST', impact: 'high', note: 'PROVISIONA una tienda nueva (canal, región, catálogo...).' },
      delete: { method: 'DELETE', path: '/{id}', impact: 'high', note: 'Elimina la tienda.' },
    },
    subActions: {
      slug_availability: {
        method: 'GET',
        path: '/slug-availability',
        requires: ['query.slug'],
        note: 'query {slug} obligatorio.',
      },
      get_checkout: { method: 'GET', path: '/{id}/checkout', note: 'Política de checkout + version.' },
      update_checkout: {
        method: 'POST',
        path: '/{id}/checkout',
        requires: ['body.expected_version'],
        note: 'body {expected_version, policy} (version de get_checkout).',
      },
      get_home_preview: { method: 'GET', path: '/{id}/home-preview' },
      update_home_preview: { method: 'POST', path: '/{id}/home-preview' },
      import_job: { method: 'GET', path: '/{id}/import-job', note: 'Estado del provisioning/importación.' },
      create_promotions: { method: 'POST', path: '/{id}/promotions' },
      retry: { method: 'POST', path: '/{id}/retry', note: 'Reintenta el provisioning.' },
    },
  },
  site_templates: {
    path: '/admin/site-templates',
    readOnly: true,
    ops: ['list'],
    summary: 'Plantillas de tienda (query kind=b2b|b2c)',
  },
  catalog_imports: {
    path: '/admin/catalog-imports',
    ops: ['list', 'create', 'update'],
    summary: 'Importaciones de catálogo a la tienda',
    subActions: {
      preview: { method: 'POST', path: '/{id}/preview', mutating: false },
      execute: { method: 'POST', path: '/{id}/execute', impact: 'high', note: 'Crea/actualiza productos REALES (202).' },
      cancel: { method: 'POST', path: '/jobs/{id}', fixedBody: { action: 'cancel' } },
      retry: { method: 'POST', path: '/jobs/{id}', fixedBody: { action: 'retry' } },
      update_variant: {
        method: 'POST',
        path: '/variants/{child_id}',
        note: 'child_id = variant_id: body {listAmount?, presentation?, purchasePolicy?, restore?[]}.',
      },
    },
  },
  product_sales_modes: {
    path: '/admin/product-sales-modes',
    ops: ['list', 'create'],
    summary: 'Modo de venta por producto y tienda (list query {site_id, product_id[]}; create = upsert body {site_id, product_id, sales_mode})',
  },

  // ─── Configuración de la tienda ────────────────────────────────────────────
  store_settings: { path: '/admin/store-config/settings', singleton: true, summary: 'Ajustes generales de la tienda' },
  store_ai_config: { path: '/admin/store-config/ai-config', singleton: true, summary: 'Modelos y límites de IA de la tienda' },
  store_email_branding: { path: '/admin/store-config/email-branding', singleton: true, summary: 'Branding de emails' },
  store_legal_pages: { path: '/admin/store-config/legal-pages', singleton: true, summary: 'Páginas legales' },
  store_site_gate: { path: '/admin/store-config/site-gate', singleton: true, summary: 'Acceso restringido/contraseña del storefront' },
  storefront_url: {
    path: '/admin/store-config/storefront-url',
    singleton: true,
    readOnly: true,
    summary: 'URL pública del storefront',
  },
  store_commerce: {
    path: '/admin/store-config/commerce',
    ops: [],
    summary: 'País/moneda/idioma: contexto, plan y aplicación',
    subActions: {
      context: { method: 'GET', path: '/context' },
      plan: {
        method: 'POST',
        path: '/plan',
        mutating: false,
        note: 'Calcula operaciones sin aplicar: body {country_code, currency_code, locale}.',
      },
      apply: { method: 'POST', path: '/apply', impact: 'high', note: 'Crea región / agrega moneda (usar el plan antes).' },
    },
  },
  app_settings: {
    path: '/admin/app-settings',
    singleton: true,
    opConfig: {
      update: {
        method: 'POST',
        requires: ['body.namespace'],
        note: 'body {namespace, values?, unset?[]}; con site_id escribe el ajuste de esa tienda (todo o nada).',
      },
    },
    summary: 'Ajustes declarados por las extensiones (get query namespace; update body {namespace, values, unset?})',
  },

  // ─── Plataforma ────────────────────────────────────────────────────────────
  platform_extensions: {
    path: '/admin/platform/extensions',
    readOnly: true,
    ops: ['list'],
    summary: 'Extensiones instaladas',
  },
  platform_catalog: {
    path: '/admin/platform/catalog',
    readOnly: true,
    ops: ['list'],
    summary: 'Catálogo de extensiones de Mercatto',
  },
  platform_change_requests: {
    path: '/admin/platform/change-requests',
    ops: ['list', 'create'],
    opConfig: {
      create: {
        method: 'POST',
        impact: 'high',
        note: 'Pide a Mercatto instalar/actualizar/cambiar plantilla: body {action, component_id, target_version?}.',
      },
    },
    summary: 'Pedidos de cambio a la plataforma Mercatto',
  },
  multistore_manifest: {
    path: '/admin/multistore/manifest',
    singleton: true,
    readOnly: true,
    summary: 'Manifest multitienda (qué extensiones son por tienda)',
  },
};

const GROUPS = [
  { title: 'Multistore', resources: ['sites', 'site_templates', 'catalog_imports', 'product_sales_modes'] },
  {
    title: 'Configuración de la tienda',
    resources: [
      'store_settings',
      'store_ai_config',
      'store_email_branding',
      'store_legal_pages',
      'store_site_gate',
      'storefront_url',
      'store_commerce',
      'app_settings',
    ],
  },
  { title: 'Plataforma', resources: ['platform_extensions', 'platform_catalog', 'platform_change_requests', 'multistore_manifest'] },
];

const tool = createExtensionTool({
  name: 'manage_minimalart_stores',
  intro:
    'TIENDAS y configuración del backoffice: multistore (sites → site_id para todas las tools), plantillas, importación de catálogo, configuración de la tienda, app-settings y plataforma Mercatto.',
  resources: RESOURCES,
  groups: GROUPS,
});

export const extensionResources = tool.resources;

export const apiTool = {
  definition: tool.definition,
  function: tool.function,
};
