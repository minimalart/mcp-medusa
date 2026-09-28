/**
 * Medusa v2 Admin API coverage tool.
 * Provides additive access to newer Admin API resources while preserving the
 * legacy domain-specific tools.
 *
 * Rutas verificadas contra @medusajs/medusa 2.17.2 → 2.21.1 y
 * @medusajs/loyalty-plugin 2.17.2 → 2.21.1. Las que requieren una versión más
 * nueva que 2.18 devuelven "Esta acción requiere Medusa >= X" si la tienda
 * responde 404.
 */

import { buildMedusaUrl, makeRequest, normalizeBaseUrl } from "../../lib/medusa-client.js";
import { withMedusaErrorHints, withMinVersion } from "../../lib/medusa-version.js";
import { neverExposeReason } from "../../lib/extension-exclusions.js";

/**
 * Recursos conocidos para list/get. `list`/`get` indican qué rutas GET existen
 * realmente (no todos los recursos tienen ambas).
 */
const RESOURCES = {
  currencies: { path: "/admin/currencies", list: true, get: true },
  feature_flags: { path: "/admin/feature-flags", list: true },
  // No existe GET /admin/index: el estado del Index Module está en /admin/index/details.
  index: { path: "/admin/index/details", list: true },
  locales: { path: "/admin/locales", list: true, get: true },
  // Factores MFA del usuario autenticado (GET /auth/mfa/factors). Reemplaza al viejo recurso `auth`.
  mfa_factors: { path: "/auth/mfa/factors", list: true },
  // Filtros útiles: to (destinatario, 2.18+), channel, template, resource_type, resource_id.
  notifications: { path: "/admin/notifications", list: true, get: true },
  price_preferences: { path: "/admin/price-preferences", list: true, get: true },
  property_labels: { path: "/admin/property-labels", list: true, get: true },
  refund_reasons: { path: "/admin/refund-reasons", list: true, get: true },
  return_reasons: { path: "/admin/return-reasons", list: true, get: true },
  search_indexes: { path: "/admin/search-indexes", list: true, minVersion: "2.20" },
  shipping_option_types: { path: "/admin/shipping-option-types", list: true, get: true },
  stores: { path: "/admin/stores", list: true, get: true },
  // @medusajs/loyalty-plugin
  store_credit_accounts: { path: "/admin/store-credit-accounts", list: true, get: true },
  tax_providers: { path: "/admin/tax-providers", list: true },
  translations: { path: "/admin/translations", list: true },
  // No hay GET /admin/uploads (listado); sólo GET /admin/uploads/{id}.
  uploads: { path: "/admin/uploads", get: true },
  // No existe GET /admin/views: se listan las entidades con vistas configurables.
  views: { path: "/admin/views/entities", list: true },
  workflow_executions: { path: "/admin/workflows-executions", list: true, get: true },
};

const REMOVED_RESOURCES = {
  auth: "The `auth` resource was removed: there is no GET /auth route. Use resource=mfa_factors or action=request with an explicit GET /auth/... path.",
};

/**
 * Rutas que `request` no deja invocar (cualquier método), porque exponen o
 * generan secretos, dan acceso directo a la base o disparan operaciones de
 * mantenimiento/seed que no deben ejecutarse desde un agente.
 */
const BLOCKED_REQUEST_PATHS = [
  { pattern: /^\/admin\/ai-assistant\/keys/, reason: "exposes AI provider API keys (secrets)" },
  { pattern: /^\/admin\/site-credentials/, reason: "exposes site credentials (secrets)" },
  { pattern: /^\/admin\/debug(\/|$)/, reason: "debug endpoints" },
  { pattern: /^\/admin\/maintenance(\/|$)/, reason: "maintenance operations" },
  { pattern: /^\/admin\/database-explorer(\/|$)/, reason: "direct database access" },
  { pattern: /^\/admin\/commerce-dashboard\/seed-orders(\/|$)/, reason: "generates seed/test orders" },
  { pattern: /^\/admin\/users\/[^/]+\/reset-password(\/|$)/, reason: "returns a live password reset token" },
];

/**
 * En /auth* sólo se permiten lecturas (GET, p. ej. /auth/mfa/factors o
 * /auth/user/providers) y el refresh del token actual. Todas las demás
 * escrituras manejan credenciales: crean sesiones (POST /auth/session,
 * /auth/{actor}/{provider}), registran identidades, cambian o resetean
 * contraseñas (/update, /reset-password), enrolan/borran factores MFA,
 * completan challenges o verifican emails, o cierran la sesión que usa el MCP
 * (DELETE /auth/session). Hacer eso con las credenciales compartidas del MCP
 * pondría contraseñas/códigos en los argumentos (y logs) de un tool y podría
 * dejar sin acceso a la cuenta, así que se bloquea y se deja para el panel
 * admin. POST /auth/token/refresh sólo intercambia el token vigente.
 */
const AUTH_ALLOWED_WRITES = new Set(["POST /auth/token/refresh"]);

const ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function getResource(resource) {
  if (REMOVED_RESOURCES[resource]) {
    throw new Error(REMOVED_RESOURCES[resource]);
  }
  const config = RESOURCES[resource];
  if (!config) {
    throw new Error(`Unsupported resource: ${resource}. Supported: ${Object.keys(RESOURCES).join(", ")}`);
  }
  return config;
}

function basePathname() {
  try {
    return new URL(normalizeBaseUrl(process.env.MEDUSA_BASE_URL)).pathname.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function decodeFully(value) {
  let current = value;
  for (let i = 0; i < 5; i += 1) {
    const next = decodeURIComponent(current);
    if (next === current) return current;
    current = next;
  }
  return current;
}

/**
 * Normaliza el path que realmente va a pedir fetch (después de que URL resuelva
 * `.`/`..`, barras invertidas, etc.) para aplicar las restricciones sobre el
 * destino real y no sobre el texto que mandó el caller.
 */
function resolveRequestTarget(path, query) {
  const url = buildMedusaUrl(path, query);
  const target = new URL(url);
  const base = new URL(normalizeBaseUrl(process.env.MEDUSA_BASE_URL));
  if (target.origin !== base.origin) {
    throw new Error("Custom requests must target the configured Medusa backend.");
  }

  let pathname;
  try {
    pathname = decodeFully(target.pathname);
  } catch {
    throw new Error("Invalid percent-encoding in request path.");
  }
  pathname = pathname.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  const prefix = basePathname();
  if (prefix && pathname.toLowerCase().startsWith(prefix.toLowerCase())) {
    pathname = pathname.slice(prefix.length) || "/";
  }
  if (/(^|\/)\.{1,2}(\/|$)/.test(pathname)) {
    throw new Error("Relative path segments are not allowed in custom requests.");
  }
  const normalized = pathname.toLowerCase().replace(/\/+$/, "") || "/";
  return { url, normalized };
}

function assertRequestAllowed(method, normalizedPath, search = "") {
  const isAdmin = normalizedPath.startsWith("/admin/");
  const isAuth = normalizedPath === "/auth" || normalizedPath.startsWith("/auth/");
  if (!isAdmin && !isAuth) {
    throw new Error("Custom requests are restricted to /admin/* and /auth* paths");
  }

  const blocked = BLOCKED_REQUEST_PATHS.find(({ pattern }) => pattern.test(normalizedPath));
  if (blocked) {
    return {
      error: `Blocked path: ${normalizedPath} is not available through manage_medusa_admin_v2 (${blocked.reason}). Use the Medusa admin dashboard for this operation.`,
      blocked: true,
    };
  }

  // Misma lista que las tools de extensiones (`lib/extension-exclusions.js`): sin
  // esto, `request` era la puerta trasera a todo lo que ellas no declaran.
  const excluded = neverExposeReason(`${normalizedPath}${search}`, { method });
  if (excluded) {
    return {
      error: `Blocked path: ${normalizedPath} is never exposed through MCP (${excluded}). Use the admin dashboard for this operation.`,
      blocked: true,
    };
  }

  if (isAuth && method !== "GET" && !AUTH_ALLOWED_WRITES.has(`${method} ${normalizedPath}`)) {
    return {
      error:
        `Blocked: ${method} ${normalizedPath}. Only GET requests and POST /auth/token/refresh are allowed on /auth* ` +
        "(logins, registrations, password changes/resets, MFA enrollment and verification handle credentials and must be done in the admin dashboard).",
      blocked: true,
    };
  }

  return null;
}

function requireId(id, action) {
  if (!id) {
    throw new Error(`id is required for ${action} actions.`);
  }
  return encodeURIComponent(id);
}

function assertPositiveAmount(amount) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new Error(`amount must be a number greater than 0 (got ${JSON.stringify(amount)}).`);
  }
}

const LOYALTY = "@medusajs/loyalty-plugin";

async function executeFunction(args = {}) {
  const {
    action,
    resource,
    id,
    method = "GET",
    path,
    query = {},
    body,
    headers = {},
  } = args;

  switch (action) {
    case "list": {
      const config = getResource(resource);
      if (!config.list) {
        return { error: `Resource ${resource} has no list route in Medusa. ${config.get ? "Use action=get with an id." : ""}`.trim() };
      }
      const url = buildMedusaUrl(config.path, query);
      const run = () => makeRequest(url, { method: "GET", headers });
      return config.minVersion ? await withMinVersion(config.minVersion, run) : await run();
    }
    case "get": {
      if (!id) {
        return { error: "id is required for get actions." };
      }
      const config = getResource(resource);
      if (!config.get) {
        return { error: `Resource ${resource} has no get-by-id route in Medusa. Use action=list.` };
      }
      const url = buildMedusaUrl(`${config.path}/${encodeURIComponent(id)}`, query);
      return await makeRequest(url, { method: "GET", headers });
    }
    case "request": {
      if (!path) {
        return { error: "path is required for request actions." };
      }
      const requestMethod = String(method).toUpperCase();
      if (!ALLOWED_METHODS.includes(requestMethod)) {
        return { error: `Unsupported method: ${method}. Allowed: ${ALLOWED_METHODS.join(", ")}` };
      }
      const { url, normalized } = resolveRequestTarget(path, query);
      const blocked = assertRequestAllowed(requestMethod, normalized, new URL(url).search);
      if (blocked) return blocked;

      const request = {
        method: requestMethod,
        headers,
      };
      // El body JSON se envía en POST, PUT, PATCH y DELETE (nunca en GET).
      if (body !== undefined && requestMethod !== "GET") {
        request.body = JSON.stringify(body);
      }
      return await makeRequest(url, request);
    }
    // Búsqueda global del admin (Medusa >= 2.19).
    case "search": {
      const url = buildMedusaUrl("/admin/search", {
        q: args.q,
        entity: args.entity,
        limit: args.limit,
        offset: args.offset,
        ...query,
      });
      return await withMinVersion("2.19", () => makeRequest(url, { method: "GET", headers }));
    }
    case "list_search_indexes": {
      const url = buildMedusaUrl("/admin/search-indexes", query);
      return await withMinVersion("2.20", () => makeRequest(url, { method: "GET", headers }));
    }
    case "reindex_search_index": {
      const indexId = requireId(id, action);
      // since/filters/strategy existen desde 2.21.0 (en 2.20 la ruta no valida body y los ignora).
      const reindexBody = {};
      if (args.since !== undefined) reindexBody.since = args.since;
      if (args.filters !== undefined) reindexBody.filters = args.filters;
      if (args.strategy !== undefined) reindexBody.strategy = args.strategy;
      const url = buildMedusaUrl(`/admin/search-indexes/${indexId}/reindex`, query);
      return await withMinVersion("2.20", () =>
        makeRequest(url, { method: "POST", headers, body: JSON.stringify(reindexBody) })
      );
    }
    case "delete_search_index": {
      const indexId = requireId(id, action);
      const url = buildMedusaUrl(`/admin/search-indexes/${indexId}`, query);
      return await withMinVersion("2.21.1", () => makeRequest(url, { method: "DELETE", headers }));
    }
    // Store credit (@medusajs/loyalty-plugin).
    case "create_store_credit_account": {
      if (!args.currency_code) {
        return { error: "currency_code is required for create_store_credit_account." };
      }
      const accountBody = { currency_code: args.currency_code };
      if (args.customer_id) accountBody.customer_id = args.customer_id;
      if (args.metadata !== undefined) accountBody.metadata = args.metadata;
      const url = buildMedusaUrl("/admin/store-credit-accounts", query);
      return await makeRequest(url, { method: "POST", headers, body: JSON.stringify(accountBody) });
    }
    case "credit_store_credit_account":
    case "debit_store_credit_account": {
      const accountId = requireId(id, action);
      assertPositiveAmount(args.amount);
      const movement = action === "credit_store_credit_account" ? "credit" : "debit";
      const movementBody = { amount: args.amount };
      if (args.note !== undefined) movementBody.note = args.note;
      const url = buildMedusaUrl(
        movement === "credit"
          ? `/admin/store-credit-accounts/${accountId}/credit`
          : `/admin/store-credit-accounts/${accountId}/debit`,
        query
      );
      const run = () => makeRequest(url, { method: "POST", headers, body: JSON.stringify(movementBody) });
      if (movement === "debit") {
        return await withMinVersion("2.21.1", run, { component: LOYALTY });
      }
      return await run();
    }
    case "list_store_credit_transactions": {
      const accountId = requireId(id, action);
      const url = buildMedusaUrl(`/admin/store-credit-accounts/${accountId}/transactions`, {
        limit: args.limit,
        offset: args.offset,
        ...query,
      });
      return await makeRequest(url, { method: "GET", headers });
    }
    default:
      return { error: `Invalid action: ${action}. Valid actions are: ${ACTIONS.join(", ")}` };
  }
}

const ACTIONS = [
  "list",
  "get",
  "request",
  "search",
  "list_search_indexes",
  "reindex_search_index",
  "delete_search_index",
  "create_store_credit_account",
  "credit_store_credit_account",
  "debit_store_credit_account",
  "list_store_credit_transactions",
];

const SEARCH_ENTITIES_2_21 = [
  "order", "product", "product_variant", "product_category", "product_collection", "customer", "customer_group",
  "inventory_item", "promotion", "campaign", "price_list", "user", "region", "tax_region", "return_reason",
  "sales_channel", "product_type", "product_tag", "stock_location", "shipping_profile", "publishable_api_key",
  "secret_api_key",
];

const apiTool = {
  definition: {
    name: "manage_medusa_admin_v2",
    description:
      "Additive Medusa v2 Admin API tool (verified against Medusa 2.17.2 → 2.21.1; baseline store 2.18). " +
      "list/get known resources (currencies, feature_flags, index, locales, mfa_factors, notifications (filter by to, channel, template...), price_preferences, property_labels, refund_reasons, return_reasons, search_indexes, shipping_option_types, stores, store_credit_accounts, tax_providers, translations, uploads (get only), views, workflow_executions). " +
      "search: global admin search GET /admin/search (Medusa >= 2.19; q, entity, limit, offset). " +
      "Search indexes: list_search_indexes and reindex_search_index (Medusa >= 2.20; since/filters/strategy need >= 2.21), delete_search_index (Medusa >= 2.21.1). " +
      "Store credit (@medusajs/loyalty-plugin): create_store_credit_account, credit_store_credit_account, list_store_credit_transactions, debit_store_credit_account (plugin >= 2.21.1). " +
      "request: explicit GET/POST/PUT/PATCH/DELETE to /admin/* or /auth* (JSON body allowed on POST/PUT/PATCH/DELETE). Secret-bearing and maintenance paths (AI assistant keys, site credentials, debug, maintenance, database explorer, seed orders, user reset-password) are blocked, and on /auth* only GET and POST /auth/token/refresh are allowed. " +
      "Actions that need a newer store answer \"requiere Medusa >= X\" when the store returns 404.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ACTIONS,
          description: "Use list/get for known v2 resources, the dedicated actions for search/search indexes/store credit, or request for an explicit /admin/* or /auth* endpoint.",
        },
        resource: {
          type: "string",
          enum: Object.keys(RESOURCES),
          description: "Known Medusa v2 Admin API resource for list/get actions.",
        },
        id: {
          type: "string",
          description: "Resource ID for get, search index ID for reindex/delete_search_index, store credit account ID for credit/debit/transactions.",
        },
        method: {
          type: "string",
          enum: ALLOWED_METHODS,
          description: "HTTP method for request actions. Defaults to GET.",
        },
        path: {
          type: "string",
          description: "Explicit path for request actions. Restricted to /admin/* and /auth* (sensitive paths are blocked).",
        },
        query: {
          type: "object",
          description: "Query parameters. Arrays and objects are serialized using Medusa v2 conventions (e.g. notifications list: { to: \"customer@example.com\" }).",
        },
        body: {
          type: "object",
          description: "JSON request body for POST, PUT, PATCH, and DELETE request actions.",
        },
        headers: {
          type: "object",
          description: "Additional request headers, such as x-no-compression.",
        },
        q: {
          type: "string",
          description: "Search text for action=search.",
        },
        entity: {
          type: "string",
          description:
            `Entities for action=search: one name or a comma-separated list (an array is also accepted). Medusa 2.21+: ${SEARCH_ENTITIES_2_21.join(", ")}. ` +
            "Medusa 2.19/2.20 used short names: order, product, category, collection, customer, inventory, promotion, campaign, user, region, location.",
        },
        limit: {
          type: "number",
          description: "Page size for search (max 100) and list_store_credit_transactions.",
        },
        offset: {
          type: "number",
          description: "Offset for search and list_store_credit_transactions.",
        },
        since: {
          type: "string",
          description: "reindex_search_index: only reindex records changed since this ISO 8601 datetime (Medusa >= 2.21).",
        },
        filters: {
          type: "object",
          description: "reindex_search_index: filters limiting the records to reindex (Medusa >= 2.21).",
        },
        strategy: {
          type: "string",
          enum: ["swap", "in_place"],
          description: "reindex_search_index: rebuild strategy (Medusa >= 2.21).",
        },
        amount: {
          type: "number",
          description: "Amount (> 0) for credit_store_credit_account / debit_store_credit_account.",
        },
        note: {
          type: "string",
          description: "Optional note for store credit credit/debit.",
        },
        currency_code: {
          type: "string",
          description: "Currency for create_store_credit_account.",
        },
        customer_id: {
          type: "string",
          description: "Customer for create_store_credit_account.",
        },
        metadata: {
          type: "object",
          description: "Metadata for create_store_credit_account.",
        },
      },
      required: ["action"],
    },
  },
  function: withMedusaErrorHints(executeFunction),
};

export { apiTool, RESOURCES };
