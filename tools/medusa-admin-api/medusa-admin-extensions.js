/**
 * Tool para las EXTENSIONES propias del backoffice (no-core de Medusa).
 * Cubre los endpoints custom de la tienda: métricas de commerce, marcas,
 * banners, blog, sucursales, landings, biblioteca de medios, corporativos,
 * grupos dinámicos, plantillas de email, links de venta, videos, contactos.
 *
 * Sigue el mismo patrón que las demás tools (lee credenciales de env, usa
 * makeRequest/createHeaders/appendQueryParam). Las acciones list/get son de
 * lectura; create/update/delete mutan (la política del asistente las gatea).
 */

import {
  appendQueryParam,
  createHeaders,
  hasMedusaCredentials,
  makeRequest,
  missingCredentialsMessage,
  normalizeBaseUrl,
} from '../../lib/medusa-client.js';

// resource -> path del Admin API custom.
const RESOURCE_PATHS = {
  commerce_dashboard: '/admin/commerce-dashboard',
  banners: '/admin/banners',
  blog_categories: '/admin/blog-categories',
  blog_posts: '/admin/blog-posts',
  blog_settings: '/admin/blog-settings',
  brands: '/admin/brands',
  checkout_links: '/admin/checkout-links',
  companies: '/admin/companies',
  contact_submissions: '/admin/contact-submissions',
  corporates: '/admin/corporates',
  dynamic_groups: '/admin/dynamic-groups',
  email_templates: '/admin/email-templates',
  landing_pages: '/admin/landing-pages',
  media_library: '/admin/media-library',
  sales_channels_b2c: '/admin/sales-channels-b2c',
  store_locations: '/admin/store-locations',
  videos: '/admin/videos',
};

// Recursos que solo exponen lectura (GET).
const READ_ONLY = new Set(['commerce_dashboard', 'contact_submissions', 'sales_channels_b2c']);
// Recursos "singleton": el GET no lleva :id (devuelven un objeto, no una lista).
const SINGLETON = new Set(['commerce_dashboard', 'blog_settings']);

function buildQuery(args) {
  const params = new URLSearchParams();
  appendQueryParam(params, 'limit', args.limit);
  appendQueryParam(params, 'offset', args.offset);
  appendQueryParam(params, 'q', args.q);
  if (args.query && typeof args.query === 'object') {
    Object.entries(args.query).forEach(([key, value]) => appendQueryParam(params, key, value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function handleExtensionsOperation(args = {}) {
  const baseUrl = normalizeBaseUrl(process.env.MEDUSA_BASE_URL || 'http://localhost:9000');
  const apiKey =
    process.env.MEDUSA_API_KEY ||
    process.env.MEDUSA_JWT ||
    process.env.MEDUSA_SESSION_COOKIE ||
    process.env.MEDUSA_COOKIE;
  if (!apiKey || !hasMedusaCredentials()) {
    return { error: missingCredentialsMessage() };
  }
  const headers = createHeaders(apiKey);

  const { action, resource, id } = args;
  const path = RESOURCE_PATHS[resource];
  if (!path) {
    return {
      error: `Unknown resource: ${resource}. Allowed: ${Object.keys(RESOURCE_PATHS).join(', ')}`,
    };
  }

  try {
    const qs = buildQuery(args);
    switch (action) {
      case 'list':
        return await makeRequest(`${baseUrl}${path}${qs}`, { method: 'GET', headers });
      case 'get': {
        const url =
          id && !SINGLETON.has(resource)
            ? `${baseUrl}${path}/${id}${qs}`
            : `${baseUrl}${path}${qs}`;
        return await makeRequest(url, { method: 'GET', headers });
      }
      case 'create':
        if (READ_ONLY.has(resource)) return { error: `Resource ${resource} is read-only.` };
        return await makeRequest(`${baseUrl}${path}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(args.body ?? {}),
        });
      case 'update':
        if (READ_ONLY.has(resource)) return { error: `Resource ${resource} is read-only.` };
        if (!id) return { error: 'id is required for update.' };
        return await makeRequest(`${baseUrl}${path}/${id}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(args.body ?? {}),
        });
      case 'delete':
        if (READ_ONLY.has(resource)) return { error: `Resource ${resource} is read-only.` };
        if (!id) return { error: 'id is required for delete.' };
        return await makeRequest(`${baseUrl}${path}/${id}`, { method: 'DELETE', headers });
      default:
        return { error: `Unknown action: ${action}` };
    }
  } catch (error) {
    return { error: `An error occurred on ${resource}/${action}: ${error.message}` };
  }
}

export const apiTool = {
  definition: {
    name: 'manage_minimalart_extensions',
    description:
      'Acceso a las EXTENSIONES propias del backoffice (no-core de Medusa). Útil para datos del negocio que no están en las tools admin estándar. Destacado: resource="commerce_dashboard" devuelve MÉTRICAS AGREGADAS de ventas/órdenes (usar action="list" con query {from,to en ISO 8601, bucket:"daily"|"hourly"}). Otros recursos: brands, banners, blog_posts/blog_categories/blog_settings, store_locations, landing_pages, media_library, companies, corporates, dynamic_groups, email_templates, checkout_links, videos, contact_submissions, sales_channels_b2c.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'get', 'create', 'update', 'delete'],
          description:
            'Acción: list/get (lectura), create/update/delete (mutan, pueden requerir confirmación).',
        },
        resource: {
          type: 'string',
          enum: Object.keys(RESOURCE_PATHS),
          description:
            'Recurso de extensión. commerce_dashboard = métricas de ventas (singleton, GET con query); contact_submissions y sales_channels_b2c son solo lectura.',
        },
        id: {
          type: 'string',
          description: 'ID del recurso (para get/update/delete; no aplica a singletons).',
        },
        limit: { type: 'number', description: 'Máximo de items a devolver en listados.' },
        offset: { type: 'number', description: 'Items a saltear (paginación).' },
        q: { type: 'string', description: 'Búsqueda de texto donde el recurso la soporte.' },
        query: {
          type: 'object',
          description:
            'Parámetros de query extra. Para commerce_dashboard: {"from":"2026-05-01T00:00:00Z","to":"2026-05-31T23:59:59Z","bucket":"daily","sales_channel_id":"...","country_code":"ar","currency_code":"ars"}.',
        },
        body: { type: 'object', description: 'Cuerpo JSON para create/update.' },
      },
      required: ['action', 'resource'],
    },
  },
  function: handleExtensionsOperation,
};
