/**
 * Medusa v2 Admin API coverage tool.
 * Provides additive access to newer Admin API resources while preserving the
 * legacy domain-specific tools.
 *
 * Rutas verificadas contra @medusajs/medusa 2.17.2 → 2.21.1 y
 * @medusajs/loyalty-plugin 2.17.2 → 2.21.1. Las que requieren una versión más
 * nueva que 2.18 devuelven "Esta acción requiere Medusa >= X" si la tienda
 * responde 404.
 *
 * Acciones dedicadas de settings (1.9). Todas las rutas existen desde 2.17.2
 * (incluida 2.18.0) hasta 2.21.2; las marcadas [ff] sólo se registran con un
 * feature flag activo (translation, view_configurations, index_engine) y sin él
 * devuelven un mensaje que nombra el flag:
 *   POST   /admin/translations/batch                         [ff translation] { create, update, delete }
 *   GET    /admin/translations/entities                      [ff translation] type, id?
 *   GET    /admin/translations/settings                      [ff translation]
 *   POST   /admin/translations/settings/batch                [ff translation]
 *   GET    /admin/translations/statistics                    [ff translation] locales, entity_types
 *   GET    /admin/views/{entity}/columns                     [ff view_configurations]
 *   GET|POST /admin/views/{entity}/configurations            [ff view_configurations]
 *   GET|POST|DELETE /admin/views/{entity}/configurations/{id}  [ff view_configurations]
 *   GET|POST /admin/views/{entity}/configurations/active     [ff view_configurations]
 *   GET    /admin/layouts/configurations
 *   GET|POST|DELETE /admin/layouts/{zone}/configuration
 *   POST   /admin/property-labels                            [ff view_configurations]
 *   POST|DELETE /admin/property-labels/{id}                  [ff view_configurations]
 *   POST   /admin/property-labels/batch                      [ff view_configurations]
 *   POST   /admin/index/sync                                 [ff index_engine] { strategy: full|reset }
 *   POST   /admin/uploads                                    multipart `files`
 *   POST   /admin/uploads/presigned-urls                     { originalname, mime_type, size, access? }
 *   DELETE /admin/uploads/{id}
 *   POST   /admin/stores/{id}
 *   GET    /admin/workflows-executions/{workflow_id}/{transaction_id}
 * Intencionalmente fuera (ver scripts/medusa-openapi-coverage.js): .../subscribe (SSE),
 * workflows-executions/{workflow_id}/run y steps/success|failure (control interno del engine).
 */

import { buildMedusaUrl, buildMultipartBody, filePartFromArgs, makeRequest, normalizeBaseUrl } from "../../lib/medusa-client.js";
import { withFeatureFlag, withMedusaErrorHints, withMinVersion } from "../../lib/medusa-version.js";
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

function segment(value, name) {
  if (!value) {
    throw new Error(`${name} is required for this action.`);
  }
  return encodeURIComponent(value);
}

function pickDefined(source, keys) {
  const out = {};
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

const BATCH_FIELDS = ["create", "update", "delete"];
const VIEW_CONFIGURATION_FIELDS = ["name", "is_system_default", "set_active", "configuration"];
const STORE_FIELDS = [
  "name", "supported_currencies", "supported_locales", "default_sales_channel_id",
  "default_region_id", "default_location_id", "metadata",
];

const viewsPath = (args, suffix = "") => `/admin/views/${segment(args.view_entity, "view_entity")}/configurations${suffix}`;

/**
 * Acciones dedicadas (rutas declaradas en el header). Cada una: method, route(args),
 * fields del body (se combinan con `body`), query(args) (se combina con `query`),
 * required (campos del body obligatorios) y flag (feature flag de Medusa).
 */
const SETTINGS_ACTIONS = {
  batch_translations: { method: "POST", route: () => "/admin/translations/batch", fields: BATCH_FIELDS, flag: "translation", batch: true },
  list_translation_entities: {
    method: "GET", route: () => "/admin/translations/entities",
    query: (args) => ({ type: args.type, limit: args.limit, offset: args.offset }),
    requiredQuery: ["type"],
    flag: "translation",
  },
  list_translation_settings: {
    method: "GET", route: () => "/admin/translations/settings",
    query: (args) => ({ entity_type: args.entity_type }),
    flag: "translation",
  },
  batch_translation_settings: { method: "POST", route: () => "/admin/translations/settings/batch", fields: BATCH_FIELDS, flag: "translation", batch: true },
  get_translation_statistics: {
    method: "GET", route: () => "/admin/translations/statistics",
    query: (args) => ({ locales: args.locales, entity_types: args.entity_types }),
    requiredQuery: ["locales", "entity_types"],
    flag: "translation",
  },
  list_view_columns: {
    method: "GET", route: (args) => `/admin/views/${segment(args.view_entity, "view_entity")}/columns`,
    flag: "view_configurations",
  },
  list_view_configurations: {
    method: "GET", route: (args) => viewsPath(args),
    query: (args) => ({ limit: args.limit, offset: args.offset }),
    flag: "view_configurations",
  },
  create_view_configuration: {
    method: "POST", route: (args) => viewsPath(args),
    fields: VIEW_CONFIGURATION_FIELDS,
    required: ["configuration"],
    flag: "view_configurations",
  },
  get_view_configuration: { method: "GET", route: (args) => viewsPath(args, `/${segment(args.id, "id")}`), flag: "view_configurations" },
  update_view_configuration: {
    method: "POST", route: (args) => viewsPath(args, `/${segment(args.id, "id")}`),
    fields: VIEW_CONFIGURATION_FIELDS,
    flag: "view_configurations",
  },
  delete_view_configuration: { method: "DELETE", route: (args) => viewsPath(args, `/${segment(args.id, "id")}`), flag: "view_configurations" },
  get_active_view_configuration: { method: "GET", route: (args) => viewsPath(args, "/active"), flag: "view_configurations" },
  set_active_view_configuration: {
    method: "POST", route: (args) => viewsPath(args, "/active"),
    fields: ["view_configuration_id"],
    required: ["view_configuration_id"],
    flag: "view_configurations",
  },
  list_layout_configurations: {
    method: "GET", route: () => "/admin/layouts/configurations",
    query: (args) => ({ zone: args.zone, limit: args.limit, offset: args.offset }),
  },
  get_layout_configuration: { method: "GET", route: (args) => `/admin/layouts/${segment(args.zone, "zone")}/configuration` },
  set_layout_configuration: {
    method: "POST", route: (args) => `/admin/layouts/${segment(args.zone, "zone")}/configuration`,
    fields: ["is_default", "configuration"],
    required: ["configuration"],
  },
  clear_layout_configuration: { method: "DELETE", route: (args) => `/admin/layouts/${segment(args.zone, "zone")}/configuration` },
  create_property_label: {
    method: "POST", route: () => "/admin/property-labels",
    fields: ["entity", "property", "label", "description"],
    required: ["entity", "property", "label"],
    flag: "view_configurations",
  },
  update_property_label: {
    method: "POST", route: (args) => `/admin/property-labels/${segment(args.id, "id")}`,
    fields: ["label", "description"],
    flag: "view_configurations",
  },
  delete_property_label: { method: "DELETE", route: (args) => `/admin/property-labels/${segment(args.id, "id")}`, flag: "view_configurations" },
  batch_property_labels: { method: "POST", route: () => "/admin/property-labels/batch", fields: BATCH_FIELDS, flag: "view_configurations", batch: true },
  sync_index: {
    method: "POST", route: () => "/admin/index/sync",
    body: (args) => (args.sync_strategy !== undefined ? { strategy: args.sync_strategy } : {}),
    flag: "index_engine",
  },
  create_upload_presigned_url: {
    method: "POST", route: () => "/admin/uploads/presigned-urls",
    fields: ["originalname", "mime_type", "size", "access"],
    required: ["originalname", "mime_type", "size"],
  },
  delete_upload: { method: "DELETE", route: (args) => `/admin/uploads/${segment(args.id, "id")}` },
  update_store: { method: "POST", route: (args) => `/admin/stores/${segment(args.id, "id")}`, fields: STORE_FIELDS },
  get_workflow_execution_transaction: {
    method: "GET", route: (args) =>
      `/admin/workflows-executions/${segment(args.workflow_id, "workflow_id")}/${segment(args.transaction_id, "transaction_id")}`,
  },
};

async function runSettingsAction(action, args, headers) {
  const config = SETTINGS_ACTIONS[action];
  const path = config.route(args);
  const query = { ...(config.query ? config.query(args) : {}), ...(args.query || {}) };
  const missingQuery = (config.requiredQuery || []).filter((key) => query[key] === undefined);
  if (missingQuery.length > 0) {
    return { error: `${missingQuery.join(", ")} is required for ${action}.` };
  }

  const request = { method: config.method, headers };
  if (config.method !== "GET" && config.method !== "DELETE") {
    const body = config.body ? config.body(args) : { ...pickDefined(args, config.fields || []), ...(args.body || {}) };
    const missing = (config.required || []).filter((key) => body[key] === undefined);
    if (missing.length > 0) {
      return { error: `${missing.join(", ")} is required for ${action}.` };
    }
    if (config.batch && !BATCH_FIELDS.some((key) => body[key] !== undefined)) {
      return { error: `At least one of create, update or delete (arrays) is required for ${action}.` };
    }
    request.body = JSON.stringify(body);
  }

  const url = buildMedusaUrl(path, query);
  const run = () => makeRequest(url, request);
  return config.flag ? await withFeatureFlag(config.flag, run) : await run();
}

/** POST /admin/uploads (multipart `files`). Devuelve { files: [{ id, url }] }. */
async function uploadFiles(args, headers) {
  if (!Array.isArray(args.files) || args.files.length === 0) {
    return { error: "files is required: [{ filename, content (text) | content_base64, mime_type? }]." };
  }
  const { body, contentType } = buildMultipartBody(args.files.map((file) => filePartFromArgs(file, "files")));
  const url = buildMedusaUrl("/admin/uploads", args.query || {});
  return await makeRequest(url, {
    method: "POST",
    headers: { ...headers, "Content-Type": contentType },
    body,
  });
}

const SAFE_REQUEST_HEADERS = new Set(["x-no-compression"]);

function safeRequestHeaders(headers) {
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) return {};
  return Object.fromEntries(
    Object.entries(headers).filter(([key]) => SAFE_REQUEST_HEADERS.has(String(key).toLowerCase())),
  );
}

async function executeFunction(args = {}) {
  const {
    action,
    resource,
    id,
    method = "GET",
    path,
    query = {},
    body,
    headers: requestedHeaders,
  } = args;
  // El modelo sólo puede pedir headers inocuos: la credencial (Authorization,
  // Cookie…) la pone el cliente y no se puede reemplazar desde una tool.
  const headers = safeRequestHeaders(requestedHeaders);

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
    case "upload_files":
      return await uploadFiles(args, headers);
    default:
      if (SETTINGS_ACTIONS[action]) {
        return await runSettingsAction(action, args, headers);
      }
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
  "upload_files",
  ...Object.keys(SETTINGS_ACTIONS),
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
      "Store: update_store (id; name, supported_currencies, supported_locales, default_sales_channel_id/region_id/location_id, metadata: changes checkout currencies/defaults immediately). " +
      "Translations [flag translation]: batch_translations ({create: [{reference, reference_id, locale_code, translations}], update, delete}), list_translation_entities (type), list_translation_settings, batch_translation_settings, get_translation_statistics (locales + entity_types). " +
      "Admin views [flag view_configurations] (view_entity e.g. orders): list_view_columns, list/create/get/update/delete_view_configuration (configuration {visible_columns, column_order, ...}), get/set_active_view_configuration (view_configuration_id). " +
      "Property labels [flag view_configurations]: create_property_label (entity, property, label), update/delete_property_label (id), batch_property_labels. " +
      "Dashboard layouts (zone): list_layout_configurations, get/set/clear_layout_configuration. " +
      "Files: upload_files (files [{filename, content | content_base64, mime_type}] → [{id, url}]; files become publicly reachable), create_upload_presigned_url (originalname, mime_type, size), delete_upload (id). " +
      "sync_index [flag index_engine] (sync_strategy full|reset). get_workflow_execution_transaction (workflow_id + transaction_id). " +
      "Dedicated actions accept extra body/query fields through body and query. A store without the feature flag answers with a message naming it. " +
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
          description: "Resource ID for get, search index ID for reindex/delete_search_index, store credit account ID for credit/debit/transactions, store ID (update_store), view configuration / property label / upload ID for their actions.",
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
          description: "JSON request body for POST, PUT, PATCH, and DELETE request actions; extra body fields for the dedicated POST actions.",
        },
        view_entity: { type: "string", description: "Admin view entity for view actions (e.g. orders, products, customers)." },
        zone: { type: "string", description: "Dashboard layout zone for layout actions." },
        workflow_id: { type: "string", description: "Workflow ID (get_workflow_execution_transaction)." },
        transaction_id: { type: "string", description: "Transaction ID (get_workflow_execution_transaction)." },
        view_configuration_id: { type: "string", description: "set_active_view_configuration: configuration to activate (send body { view_configuration_id: null } to reset to the default)." },
        configuration: { type: "object", description: "View configuration (create/update_view_configuration) or layout configuration {widgets} (set_layout_configuration)." },
        name: { type: "string", description: "Name (view configurations, update_store)." },
        is_system_default: { type: "boolean", description: "View configuration: make it the default for every admin." },
        set_active: { type: "boolean", description: "View configuration: activate it for the current admin." },
        is_default: { type: "boolean", description: "set_layout_configuration: save as the default layout for everyone." },
        create: { type: "array", items: { type: "object" }, description: "batch_translations / batch_translation_settings / batch_property_labels: records to create." },
        update: { type: "array", items: { type: "object" }, description: "batch actions: records to update (each with id)." },
        delete: { type: "array", items: { type: "string" }, description: "batch actions: IDs to delete." },
        type: { type: "string", description: "list_translation_entities: translatable entity type (e.g. product)." },
        entity_type: { type: "string", description: "list_translation_settings filter." },
        locales: { type: "array", items: { type: "string" }, description: "get_translation_statistics: locale codes." },
        entity_types: { type: "array", items: { type: "string" }, description: "get_translation_statistics: entity types." },
        property: { type: "string", description: "create_property_label: property name." },
        label: { type: "string", description: "create/update_property_label: label shown in the admin." },
        description: { type: "string", description: "create/update_property_label: description." },
        sync_strategy: { type: "string", enum: ["full", "reset"], description: "sync_index: full (re-sync) or reset (drop and rebuild)." },
        files: {
          type: "array",
          items: { type: "object" },
          description: "upload_files: [{ filename, content (text) | content_base64, mime_type? }].",
        },
        originalname: { type: "string", description: "create_upload_presigned_url: file name." },
        mime_type: { type: "string", description: "create_upload_presigned_url: MIME type." },
        size: { type: "number", description: "create_upload_presigned_url: size in bytes." },
        access: { type: "string", enum: ["public", "private"], description: "create_upload_presigned_url: file access." },
        supported_currencies: { type: "array", items: { type: "object" }, description: "update_store: [{ currency_code, is_default?, is_tax_inclusive? }] (replaces the list)." },
        supported_locales: { type: "array", items: { type: "object" }, description: "update_store: [{ locale_code }] (replaces the list)." },
        default_sales_channel_id: { type: "string", description: "update_store." },
        default_region_id: { type: "string", description: "update_store." },
        default_location_id: { type: "string", description: "update_store." },
        headers: {
          type: "object",
          description: "Optional x-no-compression header. Credentials cannot be passed: every call runs as the connected user.",
        },
        q: {
          type: "string",
          description: "Search text for action=search.",
        },
        entity: {
          type: "string",
          description:
            `Entities for action=search: one name or a comma-separated list (an array is also accepted). Medusa 2.21+: ${SEARCH_ENTITIES_2_21.join(", ")}. ` +
            "Medusa 2.19/2.20 used short names: order, product, category, collection, customer, inventory, promotion, campaign, user, region, location. " +
            "create_property_label: the entity the label belongs to (e.g. order).",
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
          description: "Metadata for create_store_credit_account and update_store.",
        },
      },
      required: ["action"],
    },
  },
  function: withMedusaErrorHints(executeFunction),
};

export { apiTool, RESOURCES };
