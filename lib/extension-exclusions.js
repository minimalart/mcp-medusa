/**
 * Rutas admin del boilerplate que el MCP NO expone, con el motivo.
 *
 * Los patrones matchean tanto la ruta con parámetros (`/admin/x/:id/y`, como la
 * lista `scripts/verify-extension-routes.js`) como un path concreto
 * (`/admin/x/abc/y`) o un template de tool (`/admin/x/{id}/y`): los segmentos
 * dinámicos son `[^/]+`.
 *
 * - NEVER_EXPOSE_ROUTES: seguridad/privacidad. Ninguna tool debe alcanzarlas;
 *   una tool genérica (p. ej. `manage_medusa_admin_v2` action=request) puede usar
 *   `neverExposeReason()` para bloquearlas.
 * - NOT_EXPOSED_ROUTES: no aplican por MCP (flujos de navegador, streaming, bytes
 *   crudos, handshakes server-to-server, alias).
 */

export const NEVER_EXPOSE_ROUTES = Object.freeze([
  { pattern: /^\/admin\/ai-assistant\/keys(\/|$)/, reason: 'API keys de proveedores de IA (secretos)' },
  { pattern: /^\/admin\/site-credentials(\/|$)/, reason: 'credenciales por tienda (secretos)' },
  { pattern: /^\/admin\/checkout-links\/config$/, reason: 'devuelve la API key de Google Maps' },
  {
    pattern: /^\/admin\/gift-card-experience\/deliveries\/[^/]+\/secure-link$/,
    reason: 'link seguro de canje de gift card',
  },
  { pattern: /^\/admin\/debug(\/|$)/, reason: 'debug interno (heap snapshots)' },
  { pattern: /^\/admin\/maintenance(\/|$)/, reason: 'mantenimiento/backfills internos' },
  { pattern: /^\/admin\/database-explorer(\/|$)/, reason: 'acceso crudo a la base de datos' },
  { pattern: /^\/admin\/commerce-dashboard\/seed-orders$/, reason: 'siembra órdenes falsas' },
  {
    pattern: /^\/admin\/kapso\/inbox-embed$/,
    reason: 'URL de embed del inbox de Kapso (puede llevar token de acceso)',
  },
]);

export const NOT_EXPOSED_ROUTES = Object.freeze([
  {
    pattern: /^\/admin\/ai-assistant\/threads\/[^/]+\/messages\/stream$/,
    reason: 'SSE (streaming) no soportado por MCP',
  },
  { pattern: /^\/admin\/ai-assistant\/mcp-servers\/[^/]+\/oauth\/start$/, reason: 'OAuth interactivo en navegador' },
  { pattern: /^\/admin\/vimeo\/oauth\//, reason: 'OAuth interactivo en navegador' },
  { pattern: /^\/admin\/media-library\/proxy$/, reason: 'proxy de bytes de imágenes (binario)' },
  {
    pattern: /^\/admin\/sites\/checkout-context$/,
    reason: 'handshake server-to-server del checkout con access_token',
  },
  { pattern: /^\/admin\/marketplaces$/, reason: 'raíz del router dinámico: GET = /settings, POST sin handler' },
  {
    pattern: /^\/admin\/marketplaces\/[^/]+\/[^/]+\/[^/]+$/,
    methods: ['GET'],
    reason: 'GET con :action es alias de GET /:resource/:id (el handler ignora :action)',
  },
]);

export const EXCLUDED_ROUTES = Object.freeze([...NEVER_EXPOSE_ROUTES, ...NOT_EXPOSED_ROUTES]);

/** `GET /admin/orders/:id/checkout?documents=1` revela documentos personales. */
const ORDER_CHECKOUT_RE = /^\/admin\/orders\/[^/]+\/checkout$/;

/**
 * Motivo por el que una llamada no debe hacerse por MCP (seguridad/privacidad),
 * o null. Acepta el path con o sin query string, o `query` aparte.
 *
 * @param {string} rawPath
 * @param {{ method?: string, query?: Record<string, unknown> }} [options]
 * @returns {string | null}
 */
export function neverExposeReason(rawPath, { method, query } = {}) {
  const [pathOnly, search = ''] = String(rawPath || '').split('?');
  const path = pathOnly.replace(/\/+$/, '') || '/';
  const hit = NEVER_EXPOSE_ROUTES.find(
    (rule) => rule.pattern.test(path) && (!rule.methods || !method || rule.methods.includes(String(method).toUpperCase())),
  );
  if (hit) return hit.reason;
  if (ORDER_CHECKOUT_RE.test(path)) {
    const params = new URLSearchParams(search);
    const keys = [...params.keys(), ...Object.keys(query || {})].map((k) => k.replace(/\[.*$/, ''));
    if (keys.includes('documents')) return 'documentos personales del checkout (?documents)';
  }
  return null;
}
