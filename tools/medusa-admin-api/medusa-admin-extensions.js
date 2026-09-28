/**
 * Tool para las EXTENSIONES de contenido/marketing del backoffice (no-core de
 * Medusa): métricas de commerce, marcas, banners, blog, sucursales, landings,
 * biblioteca de medios, empresas/corporativos B2B, grupos dinámicos, plantillas
 * de email, links de venta, videos, contactos.
 *
 * Declarativa: los recursos son data y los ejecuta `lib/extension-resources.js`.
 * Compatibilidad: mismos nombres de recurso y acciones que la versión original
 * (list/get/create/update/delete). Arreglos respecto de la original:
 * - blog_settings update → POST /admin/blog-settings (singleton, no /:id).
 * - contact_submissions no tiene GET /:id (sí update de estado y delete).
 * - sales_channels_b2c no tiene GET /:id.
 * - ids URL-encodeados, `site_id` → x-site-id, descargas resumidas.
 */

import { createExtensionTool } from '../../lib/extension-resources.js';

const PRODUCTS_BODY = 'body {product_ids: string[]}';

export const RESOURCES = {
  commerce_dashboard: {
    path: '/admin/commerce-dashboard',
    singleton: true,
    readOnly: true,
    ops: ['list', 'get'],
    summary:
      'MÉTRICAS AGREGADAS de ventas/órdenes (query {from,to ISO 8601, bucket:"daily"|"hourly", sales_channel_id, country_code, currency_code})',
    notes: 'Sin from/to devuelve los últimos 30 días. Con site_id de una tienda inexistente responde 404.',
  },
  commerce_dashboards: {
    path: '/admin/commerce-dashboard/dashboards',
    summary: 'Tableros custom del dashboard de commerce (widgets)',
    subActions: {
      duplicate: { method: 'POST', path: '/{id}/duplicate' },
      catalogue: { method: 'GET', path: '/admin/commerce-dashboard/catalogue', note: 'Datasets/métricas disponibles para widgets.' },
      query: {
        method: 'POST',
        path: '/admin/commerce-dashboard/query',
        mutating: false,
        requires: ['body.dashboardId'],
        note: 'Ejecuta un widget: body {dashboardId, widgetId, preview?, query?, context?}.',
      },
      options: {
        method: 'POST',
        path: '/admin/commerce-dashboard/options',
        mutating: false,
        requires: ['body.dashboardId', 'body.field'],
        note: 'Valores posibles de un filtro: body {dashboardId, widgetId|preview+query, field, context}.',
      },
      set_default: {
        method: 'POST',
        path: '/admin/commerce-dashboard/preferences',
        note: 'Tablero por defecto del usuario: body {dashboardId|null}.',
      },
      aggregate: {
        method: 'POST',
        path: '/admin/commerce-dashboard/aggregate',
        note: 'Recalcula los snapshots agregados (202, asíncrono).',
      },
    },
  },
  banners: {
    path: '/admin/banners',
    summary: 'Banners del storefront',
    subActions: {
      publish: { method: 'POST', path: '/{id}/publish', note: 'Visible en la tienda.' },
      unpublish: { method: 'POST', path: '/{id}/unpublish' },
      archive: { method: 'POST', path: '/{id}/archive' },
      ai_generate: {
        method: 'POST',
        path: '/ai-generate',
        mutating: false,
        requires: ['body.brief'],
        note: 'Genera copy con IA (no guarda): body {brief, tone?, goal?, audience?, locale?, placement?}.',
      },
      ai_compose: { method: 'POST', path: '/ai-compose', mutating: false, note: 'Compone un banner con IA (no guarda).' },
      ai_image: { method: 'POST', path: '/ai-image', note: 'Genera una imagen con IA.' },
    },
  },
  blog_categories: { path: '/admin/blog-categories', summary: 'Categorías del blog' },
  blog_posts: {
    path: '/admin/blog-posts',
    summary: 'Posts del blog',
    subActions: {
      duplicate: { method: 'POST', path: '/{id}/duplicate' },
      publish: { method: 'POST', path: '/{id}/publish', note: 'Visible en la tienda.' },
      unpublish: { method: 'POST', path: '/{id}/unpublish' },
      list_products: { method: 'GET', path: '/{id}/products' },
      set_products: { method: 'POST', path: '/{id}/products', note: 'Productos relacionados del post.' },
    },
  },
  blog_settings: {
    path: '/admin/blog-settings',
    singleton: true,
    // `create` se mantiene por compatibilidad: la tool original lo mandaba a la raíz.
    ops: ['get', 'create', 'update'],
    summary: 'Configuración del blog (singleton; create/update = POST a la raíz)',
  },
  brands: {
    path: '/admin/brands',
    summary: 'Marcas',
    subActions: {
      list_images: { method: 'GET', path: '/{id}/images' },
      add_image: { method: 'POST', path: '/{id}/images' },
      delete_image: { method: 'DELETE', path: '/{id}/images/{child_id}', note: 'child_id = image_id.' },
      list_products: { method: 'GET', path: '/{id}/products' },
      add_products: { method: 'POST', path: '/{id}/products', requires: ['body.product_ids'], note: PRODUCTS_BODY },
      remove_products: {
        method: 'DELETE',
        path: '/{id}/products',
        sendBody: true,
        requires: ['body.product_ids'],
        note: `DELETE con ${PRODUCTS_BODY}.`,
      },
      bulk: { method: 'POST', path: '/bulk', requires: ['body.items'], note: 'Asignación masiva marca↔productos: body {items:[...]}.' },
      export: {
        method: 'GET',
        path: '/export',
        note: 'CSV marca↔producto (se devuelve una vista previa).',
        download: 'CSV completo: backoffice → Marcas → Exportar.',
      },
    },
  },
  checkout_links: { path: '/admin/checkout-links', summary: 'Links de venta / checkout directo' },
  companies: {
    path: '/admin/companies',
    summary: 'Empresas B2B (cuentas corriente, crédito, miembros)',
    subActions: {
      get_commercial: { method: 'GET', path: '/{id}/commercial', note: 'Condiciones comerciales.' },
      update_commercial: { method: 'POST', path: '/{id}/commercial' },
      get_credit: { method: 'GET', path: '/{id}/credit' },
      update_credit: { method: 'POST', path: '/{id}/credit', note: 'Límite/estado de crédito.' },
      update_credit_conditions: { method: 'POST', path: '/{id}/credit/conditions' },
      list_credit_transactions: {
        method: 'GET',
        path: '/{id}/credit/transactions',
        note: 'query {type, from, to} + limit/offset.',
      },
      create_credit_transaction: {
        method: 'POST',
        path: '/{id}/credit/transactions',
        impact: 'high',
        note: 'Registra un movimiento de dinero en la cuenta corriente.',
      },
      set_customer_group: { method: 'POST', path: '/{id}/customer-group' },
    },
    children: {
      members: { path: '/{id}/members', ops: ['list', 'create', 'update', 'delete'], notes: { update: 'child_id = memberId.' } },
    },
  },
  contact_submissions: {
    path: '/admin/contact-submissions',
    ops: ['list', 'update', 'delete'],
    summary: 'Formularios de contacto recibidos (update = body {status:"new"|"read"|"archived"}; no hay get por id)',
  },
  corporates: {
    path: '/admin/corporates',
    summary: 'Clientes corporativos (miembros, reglas, estado)',
    subActions: {
      activity: { method: 'GET', path: '/{id}/activity' },
      set_customer_group: { method: 'POST', path: '/{id}/customer-group' },
      set_status: { method: 'POST', path: '/{id}/status' },
    },
    children: {
      members: { path: '/{id}/members', ops: ['list', 'create', 'update', 'delete'] },
      rules: { path: '/{id}/rules', ops: ['list', 'create', 'update', 'delete'] },
    },
  },
  dynamic_groups: {
    path: '/admin/dynamic-groups',
    summary: 'Grupos dinámicos de clientes (reglas → customer group)',
    subActions: {
      logs: { method: 'GET', path: '/{id}/logs' },
      recalculate: { method: 'POST', path: '/{id}/recalculate' },
      get_settings: { method: 'GET', path: '/settings' },
      update_settings: { method: 'POST', path: '/settings' },
    },
  },
  email_templates: {
    path: '/admin/email-templates',
    summary: 'Plantillas de email transaccional',
    subActions: {
      preview: { method: 'POST', path: '/{id}/preview', mutating: false, note: 'Render de prueba (no envía).' },
      publish: { method: 'POST', path: '/{id}/publish', note: 'La plantilla pasa a usarse en los envíos reales.' },
      unpublish: { method: 'POST', path: '/{id}/unpublish' },
      test_send: { method: 'POST', path: '/{id}/test-send', impact: 'high', note: 'Envía un email REAL de prueba.' },
      list_sends: { method: 'GET', path: '/{id}/sends', note: 'Historial de envíos (limit).' },
    },
  },
  landing_pages: {
    path: '/admin/landing-pages',
    summary: 'Landing pages',
    subActions: {
      ai_generate: { method: 'POST', path: '/{id}/ai-generate', note: 'Genera contenido con IA.' },
      ai_image: { method: 'POST', path: '/{id}/ai-image' },
      ai_improve_copy: { method: 'POST', path: '/{id}/ai-improve-copy' },
      ai_seo: { method: 'POST', path: '/{id}/ai-seo' },
      ai_translate: { method: 'POST', path: '/{id}/ai-translate' },
      duplicate: { method: 'POST', path: '/{id}/duplicate' },
      publish: { method: 'POST', path: '/{id}/publish', note: 'Visible en la tienda.' },
      unpublish: { method: 'POST', path: '/{id}/unpublish' },
      get_preview: { method: 'GET', path: '/{id}/preview' },
      preview: { method: 'POST', path: '/{id}/preview', mutating: false },
    },
  },
  media_library: {
    path: '/admin/media-library',
    summary: 'Biblioteca de medios',
    subActions: {
      attach: { method: 'POST', path: '/attach', note: 'Asocia un medio a una entidad.' },
      backfill: { method: 'POST', path: '/backfill', note: 'Indexa medios existentes.' },
    },
  },
  sales_channels_b2c: {
    path: '/admin/sales-channels-b2c',
    readOnly: true,
    ops: ['list'],
    summary: 'Canales de venta B2C (solo list)',
  },
  store_locations: {
    path: '/admin/store-locations',
    summary: 'Sucursales (config de sucursal, cobertura, delivery)',
    subActions: {
      get_branch_config: { method: 'GET', path: '/{id}/branch-config' },
      update_branch_config: { method: 'POST', path: '/{id}/branch-config' },
      get_delivery: { method: 'GET', path: '/{id}/delivery' },
      update_delivery: { method: 'POST', path: '/{id}/delivery' },
    },
    children: {
      coverage: { path: '/{id}/coverage', singular: 'coverage', ops: ['list', 'create', 'update', 'delete'] },
    },
  },
  videos: {
    path: '/admin/videos',
    summary: 'Videos (Vimeo) y sus productos',
    subActions: {
      list_products: { method: 'GET', path: '/{id}/products' },
      add_products: { method: 'POST', path: '/{id}/products', requires: ['body.product_ids'], note: PRODUCTS_BODY },
      remove_products: {
        method: 'DELETE',
        path: '/{id}/products',
        sendBody: true,
        requires: ['body.product_ids'],
        note: `DELETE con ${PRODUCTS_BODY}.`,
      },
      sync: { method: 'POST', path: '/{id}/sync', note: 'Re-sincroniza metadata desde Vimeo.' },
    },
  },
  vimeo: {
    path: '/admin/vimeo',
    ops: [],
    summary: 'Cuenta Vimeo conectada',
    subActions: {
      status: { method: 'GET', path: '/status' },
      list_videos: { method: 'GET', path: '/videos', note: 'query {query, page, per_page}.' },
      upload: {
        method: 'POST',
        path: '/upload',
        requires: ['body.title', 'body.file_size'],
        note: 'Crea un upload en Vimeo: body {title, description?, file_size} → devuelve el link de subida.',
      },
    },
  },
};

const tool = createExtensionTool({
  name: 'manage_minimalart_extensions',
  intro:
    'EXTENSIONES de contenido y marketing del backoffice (no-core de Medusa). Para MÉTRICAS AGREGADAS de ventas usá resource="commerce_dashboard" action="list" con query {from,to ISO 8601, bucket}. Otros dominios: manage_minimalart_commerce (loyalty, suscripciones, B2B), _logistics, _integrations, _whatsapp, _growth, _stores, _ai_assistant y manage_store_memory.',
  resources: RESOURCES,
  legacyGetFallback: true,
  propertyDescriptions: {
    query:
      'Parámetros de query extra. Para commerce_dashboard: {"from":"2026-05-01T00:00:00Z","to":"2026-05-31T23:59:59Z","bucket":"daily","sales_channel_id":"...","country_code":"ar","currency_code":"ars"}.',
  },
});

export const extensionResources = tool.resources;

export const apiTool = {
  definition: tool.definition,
  function: tool.function,
};
