/**
 * Motor declarativo para las tools de EXTENSIONES del boilerplate (rutas custom
 * del Admin API que no son core de Medusa).
 *
 * Cada recurso es DATA: path base, colección o singleton, qué verbos CRUD existen
 * de verdad (no se ofrece `get` si no hay `GET /:id`), método de update (POST o
 * PUT), `subActions` (nombre → método + template de path con `{id}` /
 * `{child_id}`), sub-colecciones (`children`), DELETE con body, parámetros
 * requeridos y acciones de alto impacto (que exigen `confirm: true`).
 *
 * El motor arma el JSON Schema y la descripción de cada tool a partir de esa
 * data, así el `enum` de recursos y la lista de sub-acciones nunca se
 * desincronizan del código que ejecuta. `scripts/verify-extension-routes.js`
 * cruza estas declaraciones contra los `route.ts` reales del boilerplate.
 *
 * Reglas de ejecución:
 * - ids URL-encodeados (`encodeURIComponent`).
 * - singleton: `get`/`list` → GET de la raíz; `update` → POST (o PUT) a la raíz.
 * - `site_id` → header `x-site-id` (scoping multitienda del boilerplate).
 * - respuestas no-JSON (PDF, ZIP, imágenes, CSV) se resumen, nunca se vuelcan.
 */

import {
  appendQueryParam,
  createHeaders,
  hasMedusaCredentials,
  makeBinarySafeRequest,
  missingCredentialsMessage,
  normalizeBaseUrl,
} from './medusa-client.js';
import { authErrorHint } from './medusa-version.js';
import { neverExposeReason } from './extension-exclusions.js';

export const CRUD_ACTIONS = Object.freeze(['list', 'get', 'create', 'update', 'delete']);
export const TOOL_ACTIONS = Object.freeze([...CRUD_ACTIONS, 'sub_action', 'describe']);
export const SITE_ID_HEADER = 'x-site-id';

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const PLACEHOLDERS = new Set(['id', 'child_id']);
const PLACEHOLDER_RE = /\{([a-z_]+)\}/g;
const NAME_RE = /^[a-z][a-z0-9_]*$/;
// Un id de tienda del boilerplate, o "*" (todas). Nada de espacios ni controles:
// va en un header HTTP.
const SITE_ID_RE = /^(\*|[A-Za-z0-9][A-Za-z0-9_.:-]{0,127})$/;
const OP_LETTER = { list: 'L', get: 'G', create: 'C', update: 'U', delete: 'D' };

const DEFAULT_BINARY_NOTE =
  'El archivo no se devuelve por MCP (es binario): descargalo desde el backoffice.';

// ─── Normalización / validación de specs (falla al cargar el módulo) ─────────

function placeholdersOf(template) {
  return [...String(template).matchAll(PLACEHOLDER_RE)].map((m) => m[1]);
}

function resolveTemplate(resourceName, label, base, template) {
  if (template === undefined || template === null || template === '') return base;
  if (typeof template !== 'string') {
    throw new Error(`[extension-resources] ${resourceName}.${label}: path must be a string`);
  }
  if (template.startsWith('/admin/')) return template;
  if (!template.startsWith('/')) {
    throw new Error(
      `[extension-resources] ${resourceName}.${label}: path "${template}" must start with "/" (relative) or "/admin/" (absolute)`,
    );
  }
  return `${base}${template}`;
}

function normalizeEndpoint(resourceName, label, base, raw = {}, defaults = {}) {
  const method = String(raw.method || defaults.method || '').toUpperCase();
  if (!HTTP_METHODS.has(method)) {
    throw new Error(`[extension-resources] ${resourceName}.${label}: invalid or missing method "${raw.method}"`);
  }
  const path = resolveTemplate(resourceName, label, base, raw.path ?? defaults.path ?? '');
  const params = new Set(placeholdersOf(path));

  let queryTemplate = null;
  if (raw.query) {
    queryTemplate = {};
    for (const [key, value] of Object.entries(raw.query)) {
      queryTemplate[key] = String(value);
      placeholdersOf(value).forEach((p) => params.add(p));
    }
  }
  for (const p of params) {
    if (!PLACEHOLDERS.has(p)) {
      throw new Error(`[extension-resources] ${resourceName}.${label}: unknown placeholder {${p}} in "${path}"`);
    }
  }

  const mutating = raw.mutating ?? method !== 'GET';
  if (raw.impact && raw.impact !== 'high') {
    throw new Error(`[extension-resources] ${resourceName}.${label}: impact must be "high" when set`);
  }

  return Object.freeze({
    label,
    method,
    path,
    params: Object.freeze([...params]),
    mutating: Boolean(mutating),
    impact: raw.impact === 'high' ? 'high' : null,
    note: raw.note || null,
    requires: Object.freeze([...(raw.requires || [])]),
    fixedBody: raw.fixedBody ? Object.freeze({ ...raw.fixedBody }) : null,
    sendBody: method === 'GET' ? false : method === 'DELETE' ? Boolean(raw.sendBody) : true,
    queryTemplate: queryTemplate ? Object.freeze(queryTemplate) : null,
    defaults: raw.defaults ? Object.freeze({ ...raw.defaults }) : null,
    download: raw.download || null,
    handler: typeof raw.handler === 'function' ? raw.handler : null,
    validate: typeof raw.validate === 'function' ? raw.validate : null,
  });
}

const CHILD_VERBS = {
  list: (plural) => `list_${plural}`,
  get: (_plural, singular) => `get_${singular}`,
  create: (_plural, singular) => `create_${singular}`,
  update: (_plural, singular) => `update_${singular}`,
  delete: (_plural, singular) => `delete_${singular}`,
};

function expandChildren(resourceName, children = {}) {
  const out = {};
  for (const [plural, child] of Object.entries(children)) {
    if (!NAME_RE.test(plural)) throw new Error(`[extension-resources] ${resourceName}: bad child name "${plural}"`);
    const singular = child.singular || plural.replace(/s$/, '');
    const ops = child.ops || CRUD_ACTIONS;
    const path = child.path;
    if (typeof path !== 'string' || !path.startsWith('/')) {
      throw new Error(`[extension-resources] ${resourceName}.${plural}: child path is required`);
    }
    const shapes = {
      list: { method: 'GET', path },
      get: { method: 'GET', path: `${path}/{child_id}` },
      create: { method: 'POST', path },
      update: { method: child.updateMethod || 'POST', path: `${path}/{child_id}` },
      delete: { method: 'DELETE', path: `${path}/{child_id}` },
    };
    for (const op of ops) {
      if (!CRUD_ACTIONS.includes(op)) {
        throw new Error(`[extension-resources] ${resourceName}.${plural}: unknown child op "${op}"`);
      }
      const name = CHILD_VERBS[op](plural, singular);
      out[name] = {
        ...shapes[op],
        note: child.notes?.[op] || null,
        impact: child.impact?.[op],
        requires: child.requires?.[op],
      };
    }
  }
  return out;
}

function normalizeResource(name, spec) {
  if (!NAME_RE.test(name)) throw new Error(`[extension-resources] invalid resource name "${name}"`);
  if (!spec || typeof spec.path !== 'string' || !spec.path.startsWith('/admin/')) {
    throw new Error(`[extension-resources] ${name}: path must start with /admin/`);
  }
  if (!spec.summary) throw new Error(`[extension-resources] ${name}: summary is required`);

  const singleton = Boolean(spec.singleton);
  const readOnly = Boolean(spec.readOnly);
  const defaultOps = singleton
    ? readOnly ? ['get'] : ['get', 'update']
    : readOnly ? ['list', 'get'] : [...CRUD_ACTIONS];
  const opList = spec.ops ?? defaultOps;

  const opShapes = {
    list: { method: 'GET', path: '' },
    get: { method: 'GET', path: singleton ? '' : '/{id}' },
    create: { method: 'POST', path: '' },
    update: { method: 'POST', path: singleton ? '' : '/{id}' },
    delete: { method: 'DELETE', path: singleton ? '' : '/{id}' },
  };

  const ops = {};
  for (const op of opList) {
    if (!CRUD_ACTIONS.includes(op)) throw new Error(`[extension-resources] ${name}: unknown op "${op}"`);
    if (readOnly && op !== 'list' && op !== 'get') {
      throw new Error(`[extension-resources] ${name}: read-only resource cannot declare "${op}"`);
    }
    ops[op] = normalizeEndpoint(name, op, spec.path, spec.opConfig?.[op] || {}, opShapes[op]);
  }

  const rawSubs = { ...(spec.subActions || {}) };
  const childSubs = expandChildren(name, spec.children);
  for (const key of Object.keys(childSubs)) {
    if (rawSubs[key]) throw new Error(`[extension-resources] ${name}: duplicated sub_action "${key}"`);
  }
  Object.assign(rawSubs, childSubs);

  const subActions = {};
  for (const [subName, raw] of Object.entries(rawSubs)) {
    if (!NAME_RE.test(subName)) throw new Error(`[extension-resources] ${name}: bad sub_action name "${subName}"`);
    if (CRUD_ACTIONS.includes(subName) || TOOL_ACTIONS.includes(subName)) {
      throw new Error(`[extension-resources] ${name}: sub_action "${subName}" collides with an action name`);
    }
    if (!raw || !raw.method) throw new Error(`[extension-resources] ${name}.${subName}: method is required`);
    const endpoint = normalizeEndpoint(name, subName, spec.path, raw, {});
    if (readOnly && endpoint.mutating) {
      throw new Error(`[extension-resources] ${name}: read-only resource cannot declare mutating sub_action "${subName}"`);
    }
    subActions[subName] = endpoint;
  }

  return Object.freeze({
    name,
    path: spec.path,
    summary: spec.summary,
    notes: spec.notes || null,
    singleton,
    readOnly,
    ops: Object.freeze(ops),
    subActions: Object.freeze(subActions),
    forbiddenQuery: Object.freeze([...(spec.forbiddenQuery || [])]),
  });
}

/**
 * Normaliza y congela un mapa `{ nombre: spec }`. Tira en el import si una spec
 * es inválida (método desconocido, placeholder raro, read-only que muta...).
 */
export function defineResources(specs) {
  const out = {};
  for (const [name, spec] of Object.entries(specs)) out[name] = normalizeResource(name, spec);
  return Object.freeze(out);
}

/**
 * Todas las llamadas HTTP que declara un mapa de recursos (para el script de
 * verificación y los tests). `path` usa `{id}` / `{child_id}`.
 */
export function listResourceEndpoints(resources) {
  const out = [];
  for (const resource of Object.values(resources)) {
    for (const [action, ep] of Object.entries(resource.ops)) {
      out.push({ resource: resource.name, action, sub_action: null, method: ep.method, path: ep.path });
    }
    for (const [sub, ep] of Object.entries(resource.subActions)) {
      out.push({ resource: resource.name, action: 'sub_action', sub_action: sub, method: ep.method, path: ep.path });
    }
  }
  return out;
}

// ─── Descripción y schema ─────────────────────────────────────────────────────

function opsSignature(resource) {
  const letters = CRUD_ACTIONS.filter((op) => resource.ops[op])
    .map((op) => `${OP_LETTER[op]}${resource.ops[op].impact ? '!' : ''}`)
    .join('');
  return letters || '-';
}

function subActionSignature(resource) {
  return Object.entries(resource.subActions)
    .map(([name, ep]) => `${name}${ep.impact ? '!' : ''}`)
    .join(', ');
}

export const DESCRIPTION_LEGEND =
  'Uso: resource + action (list|get|create|update|delete; sub_action con sub_action=<nombre>; describe = rutas, params y notas sin llamar a la tienda). ' +
  '[LGCUD] = CRUD disponible (singleton: G/U sin id); tras "·" los sub_action. ' +
  '"!" = efecto real (emails/WhatsApp a clientes, envíos, cobros, publicación externa, ejecución masiva): confirmá con el usuario y mandá confirm:true. ' +
  'site_id → header x-site-id (sin él: todas las tiendas).';

/**
 * Arma la descripción de la tool: intro + leyenda + una línea por recurso.
 * @param {{ intro: string, resources: object, groups?: Array<{ title: string, resources: string[] }>, footer?: string }} input
 */
export function buildToolDescription({ intro, resources, groups, footer }) {
  const line = (resource) => {
    const subs = subActionSignature(resource);
    return `- ${resource.name} [${opsSignature(resource)}]: ${resource.summary}${subs ? ` · ${subs}` : ''}`;
  };
  const parts = [intro.trim(), DESCRIPTION_LEGEND];
  if (groups?.length) {
    const seen = new Set();
    for (const group of groups) {
      parts.push(`${group.title}:`);
      for (const name of group.resources) {
        if (!resources[name]) throw new Error(`[extension-resources] group "${group.title}" lists unknown resource ${name}`);
        seen.add(name);
        parts.push(line(resources[name]));
      }
    }
    const missing = Object.keys(resources).filter((name) => !seen.has(name));
    if (missing.length) throw new Error(`[extension-resources] resources missing from groups: ${missing.join(', ')}`);
  } else {
    parts.push('Recursos:');
    Object.values(resources).forEach((resource) => parts.push(line(resource)));
  }
  if (footer) parts.push(footer.trim());
  return parts.join('\n');
}

const BASE_PROPERTY_DESCRIPTIONS = {
  action: 'CRUD; sub_action (nombre en sub_action); describe = detalle del recurso sin llamar a la tienda.',
  resource: 'Recurso (ver descripción).',
  sub_action: 'Nombre del sub_action (tras "·" en la descripción).',
  id: 'ID del recurso ({id}); no aplica a singletons.',
  child_id: 'ID del sub-recurso ({child_id}: miembro, regla, ciclo, imagen...).',
  limit: 'Máximo de items.',
  offset: 'Items a saltear.',
  q: 'Búsqueda de texto.',
  query: 'Query extra (filtros, fechas, flags); arrays → key[]=v.',
  body: 'JSON de escritura (también para DELETE con body).',
  site_id: 'Tienda (multistore) → header x-site-id. Omitido o "*" = todas; id inexistente → error (tienda no encontrada). IDs: manage_minimalart_stores resource=sites.',
  confirm: 'true solo si el usuario confirmó una acción marcada "!".',
};

export function buildToolParameters(resources, overrides = {}) {
  const d = { ...BASE_PROPERTY_DESCRIPTIONS, ...overrides };
  return {
    type: 'object',
    properties: {
      action: { type: 'string', enum: [...TOOL_ACTIONS], description: d.action },
      resource: { type: 'string', enum: Object.keys(resources), description: d.resource },
      sub_action: { type: 'string', description: d.sub_action },
      id: { type: 'string', description: d.id },
      child_id: { type: 'string', description: d.child_id },
      limit: { type: 'number', description: d.limit },
      offset: { type: 'number', description: d.offset },
      q: { type: 'string', description: d.q },
      query: { type: 'object', description: d.query },
      body: { type: 'object', description: d.body },
      site_id: { type: 'string', description: d.site_id },
      confirm: { type: 'boolean', description: d.confirm },
    },
    required: ['action', 'resource'],
  };
}

// ─── describe ─────────────────────────────────────────────────────────────────

function describeEndpoint(ep) {
  const out = { call: `${ep.method} ${ep.path}` };
  if (ep.queryTemplate) out.fixed_query = ep.queryTemplate;
  if (ep.fixedBody) out.fixed_body = ep.fixedBody;
  if (ep.method === 'DELETE' && ep.sendBody) out.body = 'required (DELETE with body)';
  if (ep.params.length) out.needs = [...ep.params];
  if (ep.requires.length) out.requires = [...ep.requires];
  if (ep.defaults) out.defaults = ep.defaults;
  out.mutating = ep.mutating;
  if (ep.impact) out.high_impact = true;
  if (ep.note) out.note = ep.note;
  return out;
}

export function describeResource(resource, toolName) {
  const actions = {};
  for (const [op, ep] of Object.entries(resource.ops)) actions[op] = describeEndpoint(ep);
  if (resource.singleton && resource.ops.get && !resource.ops.list) actions.list = 'alias de get (singleton)';
  const subActions = {};
  for (const [name, ep] of Object.entries(resource.subActions)) subActions[name] = describeEndpoint(ep);
  return {
    ...(toolName ? { tool: toolName } : {}),
    resource: resource.name,
    summary: resource.summary,
    kind: resource.singleton ? 'singleton' : 'collection',
    read_only: resource.readOnly,
    actions,
    sub_actions: subActions,
    ...(resource.notes ? { notes: resource.notes } : {}),
    ...(resource.forbiddenQuery.length ? { forbidden_query: [...resource.forbiddenQuery] } : {}),
    usage: 'Llamá con action=<acción> o action="sub_action" + sub_action=<nombre>; {id}→id, {child_id}→child_id; "requires" = campos obligatorios (body.x / query.x).',
  };
}

// ─── Ejecución ────────────────────────────────────────────────────────────────

const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const baseQueryKey = (key) => String(key).replace(/\[.*$/, '');
// Lookup seguro: nunca devuelve miembros del prototipo (`toString`, `constructor`...).
const own = (obj, key) => (typeof key === 'string' && Object.hasOwn(obj, key) ? obj[key] : undefined);

function listNames(obj) {
  const names = Object.keys(obj);
  return names.length ? names.join(', ') : '(none)';
}

function availabilityHint(resource) {
  const ops = Object.keys(resource.ops);
  if (resource.singleton && resource.ops.get && !ops.includes('list')) ops.push('list (alias of get)');
  return `Available actions: ${ops.length ? ops.join(', ') : '(none)'}; sub_actions: ${listNames(resource.subActions)}.`;
}

function fillTemplate(template, values, { encode }) {
  return template.replace(PLACEHOLDER_RE, (_m, key) => {
    const raw = String(values[key]).trim();
    return encode ? encodeURIComponent(raw) : raw;
  });
}

function checkRequirement(req, args) {
  const [scope, ...rest] = req.split('.');
  const key = rest.join('.');
  if (scope === 'body') {
    const value = isPlainObject(args.body) ? args.body[key] : undefined;
    return value !== undefined && value !== null && value !== '';
  }
  if (scope === 'query') {
    if (['limit', 'offset', 'q'].includes(key) && !isBlank(args[key])) return true;
    const value = isPlainObject(args.query) ? args.query[key] : undefined;
    return value !== undefined && value !== null && value !== '';
  }
  return !isBlank(args[req]);
}

function buildQueryString(args, endpoint, values) {
  const params = new URLSearchParams();
  appendQueryParam(params, 'limit', args.limit);
  appendQueryParam(params, 'offset', args.offset);
  appendQueryParam(params, 'q', args.q);
  if (endpoint.queryTemplate) {
    for (const [key, template] of Object.entries(endpoint.queryTemplate)) {
      appendQueryParam(params, key, fillTemplate(template, values, { encode: false }));
    }
  }
  if (isPlainObject(args.query)) {
    Object.entries(args.query).forEach(([key, value]) => appendQueryParam(params, key, value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function decorateResult(result, endpoint) {
  if (!isPlainObject(result)) return result;
  if (result.binary === true) {
    return { ...result, note: endpoint.download || DEFAULT_BINARY_NOTE };
  }
  if (result.format === 'csv') {
    return {
      ...result,
      note: `${result.truncated ? 'Vista previa recortada del CSV. ' : ''}${endpoint.download || 'El archivo completo se descarga desde el backoffice.'}`,
    };
  }
  return result;
}

function resolveCredentials() {
  const apiKey =
    process.env.MEDUSA_API_KEY ||
    process.env.MEDUSA_JWT ||
    process.env.MEDUSA_SESSION_COOKIE ||
    process.env.MEDUSA_COOKIE;
  if (!apiKey || !hasMedusaCredentials()) return { error: missingCredentialsMessage() };
  return { apiKey };
}

/**
 * Resuelve `resource` + `action` (+ `sub_action`) a un endpoint declarado.
 * @returns {{ endpoint?: object, label?: string, error?: string }}
 */
function resolveEndpoint(resource, args, { legacyGetFallback }) {
  const { action } = args;
  const isSubAction =
    action === 'sub_action' ||
    (typeof action === 'string' && !CRUD_ACTIONS.includes(action) && Boolean(own(resource.subActions, action)));

  if (isSubAction) {
    const subName = action === 'sub_action' ? args.sub_action : action;
    if (isBlank(subName)) {
      return {
        error: `sub_action is required when action="sub_action". Valid sub_actions for ${resource.name}: ${listNames(resource.subActions)}.`,
      };
    }
    const endpoint = own(resource.subActions, subName);
    if (!endpoint) {
      return {
        error: `Unknown sub_action '${subName}' for resource '${resource.name}'. Valid sub_actions: ${listNames(resource.subActions)}.`,
      };
    }
    return { endpoint, label: subName };
  }

  if (!CRUD_ACTIONS.includes(action)) {
    return {
      error: `Unknown action: ${action}. Use one of: ${TOOL_ACTIONS.join(', ')} (sub_actions of ${resource.name}: ${listNames(resource.subActions)}).`,
    };
  }

  let endpoint = own(resource.ops, action);
  if (!endpoint && resource.singleton && action === 'list') endpoint = resource.ops.get;
  // Compat con la tool original: `get` sin id en una colección listaba.
  if (action === 'get' && legacyGetFallback && !resource.singleton && isBlank(args.id) && resource.ops.list) {
    endpoint = resource.ops.list;
  }
  if (!endpoint) {
    let why = resource.readOnly ? ' (read-only)' : '';
    if (action === 'get' && !resource.singleton && resource.ops.list) {
      why = ` (the backend has no GET ${resource.path}/:id; use list with filters)`;
    }
    return {
      error: `Action '${action}' is not available for resource '${resource.name}'${why}. ${availabilityHint(resource)}`,
    };
  }
  return { endpoint, label: action };
}

function validateInputs(resource, endpoint, label, args) {
  for (const param of endpoint.params) {
    if (isBlank(args[param])) {
      return `${param} is required for ${label} on ${resource.name} (${endpoint.method} ${endpoint.path}).`;
    }
  }
  if (args.body !== undefined && args.body !== null && !isPlainObject(args.body)) {
    return 'body must be a JSON object.';
  }
  if (args.query !== undefined && args.query !== null && !isPlainObject(args.query)) {
    return 'query must be a JSON object.';
  }
  const missing = endpoint.requires.filter((req) => !checkRequirement(req, args));
  if (missing.length) {
    return `Missing required ${missing.join(', ')} for ${label} on ${resource.name}.${endpoint.note ? ` ${endpoint.note}` : ''}`;
  }
  if (resource.forbiddenQuery.length && isPlainObject(args.query)) {
    const blocked = Object.keys(args.query).filter((key) => resource.forbiddenQuery.includes(baseQueryKey(key)));
    if (blocked.length) {
      return `Query param(s) ${blocked.join(', ')} are not exposed through MCP for ${resource.name}.`;
    }
  }
  if (!isBlank(args.site_id) && !SITE_ID_RE.test(String(args.site_id).trim())) {
    return 'site_id must be a store id (letters, digits, "_", "-", ".", ":") or "*".';
  }
  return null;
}

/**
 * Crea una tool MCP a partir de specs de recursos.
 *
 * @param {object} config
 * @param {string} config.name - nombre de la tool (manage_minimalart_*)
 * @param {string} config.intro - primera(s) línea(s) de la descripción
 * @param {object} config.resources - `{ nombre: spec }` (sin normalizar)
 * @param {Array} [config.groups] - agrupación de recursos para la descripción
 * @param {string} [config.footer]
 * @param {string} [config.title]
 * @param {boolean} [config.legacyGetFallback] - `get` sin id en colección → list
 * @param {object} [config.propertyDescriptions] - overrides de descripciones del schema
 * @param {string} [config.description] - descripción completa (reemplaza la generada)
 */
export function createExtensionTool(config) {
  const resources = defineResources(config.resources);
  const toolName = config.name;
  const legacyGetFallback = Boolean(config.legacyGetFallback);

  const description =
    config.description ||
    buildToolDescription({ intro: config.intro, resources, groups: config.groups, footer: config.footer });

  const definition = {
    name: toolName,
    ...(config.title ? { title: config.title } : {}),
    description,
    parameters: buildToolParameters(resources, config.propertyDescriptions),
  };

  async function run(rawArgs = {}) {
    const input = isPlainObject(rawArgs) ? rawArgs : {};
    const resource = own(resources, input.resource);
    if (!resource) {
      return { error: `Unknown resource: ${input.resource}. Allowed: ${Object.keys(resources).join(', ')}` };
    }
    if (input.action === 'describe') return describeResource(resource, toolName);

    const resolved = resolveEndpoint(resource, input, { legacyGetFallback });
    if (resolved.error) return { error: resolved.error };
    const { endpoint, label } = resolved;

    const args = { ...input };
    if (endpoint.defaults) {
      for (const [key, value] of Object.entries(endpoint.defaults)) {
        if (isBlank(args[key])) args[key] = value;
      }
    }

    const invalid = validateInputs(resource, endpoint, label, args);
    if (invalid) return { error: invalid };
    if (endpoint.validate) {
      const custom = endpoint.validate(args);
      if (custom) return { error: custom };
    }
    if (endpoint.impact === 'high' && args.confirm !== true) {
      return {
        error: `${resource.name}/${label} has real side effects${endpoint.note ? ` (${endpoint.note})` : ''}. Summarize it to the user, get explicit confirmation, then retry with confirm: true.`,
        requires_confirmation: true,
      };
    }

    const credentials = resolveCredentials();
    if (credentials.error) return { error: credentials.error };

    const siteId = isBlank(args.site_id) ? null : String(args.site_id).trim();

    try {
      const baseUrl = normalizeBaseUrl(process.env.MEDUSA_BASE_URL || 'http://localhost:9000');
      const headers = createHeaders(credentials.apiKey, siteId ? { [SITE_ID_HEADER]: siteId } : {});

      // Defensa en profundidad: aunque una spec (o un handler) arme un path de la
      // lista de nunca-exponer, la llamada no sale.
      const send = (method, pathWithQuery, options) => {
        const blocked = neverExposeReason(pathWithQuery, { method });
        if (blocked) throw new Error(`${method} ${pathWithQuery.split('?')[0]} is never exposed through MCP (${blocked}).`);
        return makeBinarySafeRequest(`${baseUrl}${pathWithQuery}`, options);
      };

      const request = async (method, path, { body, query } = {}) => {
        const params = new URLSearchParams();
        if (isPlainObject(query)) Object.entries(query).forEach(([k, v]) => appendQueryParam(params, k, v));
        const qs = params.toString();
        const options = { method, headers };
        if (body !== undefined && method !== 'GET') options.body = JSON.stringify(body);
        return send(method, `${path}${qs ? `?${qs}` : ''}`, options);
      };

      const path = fillTemplate(endpoint.path, args, { encode: true });
      const body = endpoint.sendBody
        ? { ...(isPlainObject(args.body) ? args.body : {}), ...(endpoint.fixedBody || {}) }
        : undefined;

      if (endpoint.handler) {
        const result = await endpoint.handler({ args, resource, endpoint, path, body, request });
        return decorateResult(result, endpoint);
      }

      const options = { method: endpoint.method, headers };
      if (body !== undefined) options.body = JSON.stringify(body);
      const result = await send(endpoint.method, `${path}${buildQueryString(args, endpoint, args)}`, options);
      return decorateResult(result, endpoint);
    } catch (error) {
      const authHint = authErrorHint(error.message);
      return {
        error: `An error occurred on ${resource.name}/${label}: ${error.message}`,
        ...(error.status ? { status: error.status } : {}),
        ...(authHint ? { hint: authHint } : {}),
        // Cada tienda instala sólo algunas extensiones y puede correr una versión
        // más vieja del boilerplate: un 404 casi nunca es "el ID no existe".
        ...(error.status === 404
          ? {
              hint:
                'La tienda respondió 404: probablemente esta extensión no está instalada en esta tienda ' +
                'o su backend es anterior a esta ruta. Si pasaste un id, verificá también que exista.',
            }
          : {}),
      };
    }
  }

  return { definition, function: run, resources };
}
