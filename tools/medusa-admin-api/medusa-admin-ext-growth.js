/**
 * GROWTH / merchandising del boilerplate: SEO-GEO (auditorías, visibilidad en
 * IA), motor de recomendaciones, catalogador IA, comentarios de productos,
 * catálogos PDF, shop-by-looks, space designer y minijuegos.
 *
 * Declarativa: ver `lib/extension-resources.js`.
 */

import { createExtensionTool } from '../../lib/extension-resources.js';

// Los schemas de minijuegos son estrictos (zod strictObject): un campo que
// devuelve el `get` (id, status, sites, outcomes[].id…) rompe el update con 400.
const CAMPAIGN_FIELDS = [
  'name',
  'public_title',
  'description',
  'game_type',
  'starts_at',
  'ends_at',
  'site_ids',
  'participation_rules',
  'game_config',
  'store_channels',
  'store_visual_overrides',
  'visual_config',
  'outcomes',
];
const OUTCOME_FIELDS = ['key', 'label', 'weight', 'promotion_id', 'local_limit', 'symbols', 'color'];
const SETTINGS_FIELDS = ['enabled', 'retention_days', 'launcher_config', 'drawer_config', 'consent_config'];

function unknownKeys(body, fields, outcomeFields) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const extra = Object.keys(body).filter((key) => !fields.includes(key));
  if (outcomeFields && Array.isArray(body.outcomes)) {
    body.outcomes.forEach((outcome, i) => {
      if (outcome && typeof outcome === 'object') {
        Object.keys(outcome)
          .filter((key) => !outcomeFields.includes(key))
          .forEach((key) => extra.push(`outcomes[${i}].${key}`));
      }
    });
  }
  return extra.length
    ? `The minigames API rejects unknown fields: ${extra.join(', ')}. Send only: ${fields.join(', ')}${outcomeFields ? ` (outcomes: ${outcomeFields.join(', ')})` : ''}.`
    : null;
}

export const RESOURCES = {
  // ─── SEO / GEO ──────────────────────────────────────────────────────────────
  seo_geo_config: { path: '/admin/seo-geo/config', singleton: true, summary: 'Configuración SEO/GEO' },
  seo_geo_audits: {
    path: '/admin/seo-geo/audits',
    ops: ['list', 'get', 'create'],
    opConfig: {
      create: { method: 'POST', note: 'Inicia una auditoría (crawl del storefront).' },
      get: { method: 'GET', path: '/{id}', note: 'query {finding_limit}.' },
    },
    summary: 'Auditorías SEO (query status)',
    subActions: {
      cancel: { method: 'POST', path: '/{id}/cancel' },
      pause: { method: 'POST', path: '/{id}/pause' },
      resume: { method: 'POST', path: '/{id}/resume' },
    },
  },
  seo_geo_findings: {
    path: '/admin/seo-geo/findings',
    readOnly: true,
    ops: ['list'],
    summary: 'Hallazgos de auditoría (query audit_id)',
  },
  seo_geo: {
    path: '/admin/seo-geo',
    ops: [],
    summary: 'SEO/GEO: dashboard, visibilidad en IA, keywords, correcciones con IA',
    subActions: {
      dashboard: { method: 'GET', path: '/dashboard' },
      ai_visibility: { method: 'GET', path: '/ai-visibility', note: 'query {sales_channel_id}.' },
      keywords: { method: 'GET', path: '/keywords' },
      corrections: {
        method: 'POST',
        path: '/corrections',
        mutating: false,
        note: 'Propuestas con IA para cerrar gaps GEO (no guarda): body {product_id, gaps}.',
      },
      apply_corrections: {
        method: 'POST',
        path: '/corrections/apply',
        impact: 'high',
        note: 'Escribe los campos SEO en los productos/páginas.',
      },
      simulator: { method: 'POST', path: '/simulator', mutating: false, note: 'Simula cómo respondería una IA.' },
    },
  },

  // ─── Recomendaciones ───────────────────────────────────────────────────────
  recommendation_config: {
    path: '/admin/recommendations/config',
    singleton: true,
    summary: 'Configuración del motor de recomendaciones',
  },
  recommendation_strategies: {
    path: '/admin/recommendations/strategies',
    ops: ['list', 'get', 'update', 'delete'],
    summary: 'Estrategias (update POST /:id)',
  },
  recommendation_placements: {
    path: '/admin/recommendations/placements',
    ops: ['list', 'get', 'update'],
    summary: 'Ubicaciones en el storefront',
  },
  recommendation_relations: {
    path: '/admin/recommendations/relations',
    ops: ['list', 'create', 'update', 'delete'],
    summary: 'Relaciones manuales producto↔producto',
    subActions: { bulk: { method: 'POST', path: '/bulk', note: 'Alta/baja masiva.' } },
  },
  recommendations: {
    path: '/admin/recommendations',
    ops: [],
    summary: 'Recomendaciones: performance, versiones, preview, rebuild',
    subActions: {
      performance: { method: 'GET', path: '/performance', note: 'query {from, to, bucket}.' },
      versions: { method: 'GET', path: '/versions' },
      products: { method: 'GET', path: '/products' },
      preview: { method: 'POST', path: '/preview', mutating: false },
      rebuild: { method: 'POST', path: '/rebuild', note: 'Recalcula recomendaciones (202).' },
      aggregate: { method: 'POST', path: '/aggregate', note: 'Agrega métricas (202).' },
      seed: { method: 'POST', path: '/seed' },
    },
  },

  // ─── Catalogador IA ────────────────────────────────────────────────────────
  catalogador_config: { path: '/admin/catalogador/config', singleton: true, summary: 'Configuración del catalogador IA' },
  catalogador_executions: {
    path: '/admin/catalogador/executions',
    summary: 'Ejecuciones del catalogador (enriquecimiento de productos con IA)',
    subActions: {
      generate: { method: 'POST', path: '/{id}/generate', note: 'Genera contenido con IA (consume créditos).' },
      apply: { method: 'POST', path: '/{id}/apply', impact: 'high', note: 'Escribe lo generado en los productos REALES.' },
      cancel: { method: 'POST', path: '/{id}/cancel' },
      duplicate: { method: 'POST', path: '/{id}/duplicate' },
      refloat: { method: 'POST', path: '/{id}/refloat' },
      restore: { method: 'POST', path: '/{id}/restore' },
      undelete: { method: 'POST', path: '/{id}/undelete' },
      update_product: { method: 'POST', path: '/{id}/products/{child_id}', note: 'child_id = product id.' },
      update_asset: { method: 'POST', path: '/{id}/assets/{child_id}', note: 'child_id = asset id.' },
      update_asset_composition: { method: 'PATCH', path: '/{id}/assets/{child_id}/composition' },
      preview_selection: { method: 'POST', path: '/admin/catalogador/selection/preview', mutating: false },
    },
  },

  // ─── Contenido de catálogo ─────────────────────────────────────────────────
  comments: {
    path: '/admin/comments',
    ops: ['list', 'get', 'delete'],
    summary: 'Comentarios/reseñas de productos (filtros por query)',
    subActions: {
      approve: { method: 'POST', path: '/{id}/approve', note: 'Visible en la tienda.' },
      hide: { method: 'POST', path: '/{id}/hide' },
    },
  },
  comment_settings: { path: '/admin/comments/settings', singleton: true, summary: 'Moderación de comentarios' },
  pdf_catalogs: {
    path: '/admin/pdf-catalogs',
    summary: 'Catálogos PDF',
    subActions: {
      download: {
        method: 'GET',
        path: '/file',
        query: { id: '{id}' },
        note: 'PDF (solo metadata).',
        download: 'PDF: backoffice → Catálogos PDF → Descargar.',
      },
    },
  },
  shop_by_looks: { path: '/admin/shop-by-looks', summary: 'Looks comprables' },
  space_designer_configurators: { path: '/admin/space-designer/configurators', summary: 'Configuradores de ambientes' },
  space_designer_quotes: {
    path: '/admin/space-designer/quotes',
    ops: ['list', 'get', 'update', 'delete'],
    summary: 'Cotizaciones del space designer',
  },
  space_designer: {
    path: '/admin/space-designer',
    ops: [],
    summary: 'Space designer: diseños y productos',
    subActions: {
      list_designs: { method: 'GET', path: '/designs' },
      list_products: { method: 'GET', path: '/products' },
    },
  },

  // ─── Minijuegos ────────────────────────────────────────────────────────────
  minigame_campaigns: {
    path: '/admin/minigames/campaigns',
    ops: ['list', 'get', 'create', 'update'],
    opConfig: {
      list: { method: 'GET', note: 'Campañas de la tienda (site_id) con participants/awards/orders; q filtra por nombre.' },
      create: {
        method: 'POST',
        note: 'Crea en status draft. Body completo (ver notes.body); site_ids debe incluir la tienda del site_id.',
        validate: (args) => unknownKeys(args.body, CAMPAIGN_FIELDS, OUTCOME_FIELDS),
      },
      update: {
        method: 'PATCH',
        note: 'REEMPLAZO completo, no parcial: get → armar el body sólo con los campos de notes.body → update. Sólo draft/paused y sin partidas jugadas (si no, duplicate). Vuelve a draft.',
        validate: (args) => unknownKeys(args.body, CAMPAIGN_FIELDS, OUTCOME_FIELDS),
      },
    },
    summary: 'Campañas de minijuegos (ruleta, tragamonedas, memoria, búsqueda del tesoro); sin delete: usar end',
    notes: {
      site_id:
        'OBLIGATORIO en multitienda (sin él responde 400 select_a_store; "*" no sirve). Ids: manage_minimalart_growth resource=minigames sub_action=sites.',
      lifecycle:
        'draft → publish → scheduled (starts_at futuro) o active → pause (paused, editable) → publish de nuevo, o end (ended, definitivo). Una sola campaña publicada por tienda a la vez: publicar con otra vigente responde 409 store_has_active_game (pausá/terminá la otra). Al publicar se validan promociones, productos y ubicaciones.',
      body: {
        name: 'string 1-120 (interno)',
        public_title: 'string 1-120 (lo ve el cliente)',
        description: 'string ≤1000 (default "")',
        game_type: 'wheel | slots | memory | treasure',
        starts_at: 'ISO con offset o null (obligatorio, null = ya)',
        ends_at: 'ISO con offset o null (obligatorio, null = sin fin)',
        site_ids: '["<site_id>"] (≥1; debe incluir el site_id del header)',
        participation_rules:
          '{mode: unlimited|visitor|customer|email|daily, max_attempts (int|null, default 1), max_sessions (int|null), require_auth, require_email, require_purchase (bool), min_cart_total (number|null)}',
        game_config: 'según game_type (ver games)',
        visual_config:
          '{inherit_store (true = colores de la tienda), mood: store|hotsale|valentine|christmas, primary/secondary/accent/highlight (#RRGGBB), backdrop: lights|flat|rays, logo (https), result_message ≤400}',
        outcomes:
          '[{key ([a-zA-Z0-9_-]), label, weight 0-100 (los pesos suman 100, hasta 2 decimales), promotion_id (string|null; null = sin premio), local_limit (int|null), symbols? (slots: 3 keys), color? (#RRGGBB o primary|secondary|accent|highlight)}] 1-32',
        store_channels: 'opcional {site_id: [sales_channel_id]} (default: todos los canales de la tienda)',
        store_visual_overrides: 'opcional {site_id: visual_config}',
      },
      games: {
        wheel:
          'Ruleta: 4-12 outcomes. game_config {duration_ms? 0-10000, button_text?, sound?}.',
        slots:
          'Tragamonedas: cada outcome lleva symbols [3 keys] y no puede repetir combinación. game_config {symbols?: [{key, label, image?}] 3-8 (si está, los symbols de los outcomes deben usar esas keys), duration_ms?, button_text?, sound?}.',
        memory:
          'Memoria: game_config {cards: [{key, label, image?, product_id?}] 3, 6 o 10 pares (minigames sub_action=catalog_assets los arma desde una categoría/colección), card_back?: logo|pattern, max_seconds? 1-3600, max_attempts? 1-1000, tiers: [{key (= key de un outcome), min_seconds, max_seconds|null, max_attempts|null}] sin solaparse}.',
        treasure:
          'Búsqueda del tesoro: exactamente 1 outcome (el premio final). game_config {objectives: [{key, label, image?, location_type: product|category|collection|page, location_id, href ("/..." sin ?#), clue}] 2-10, sequential?, max_seconds? 1-604800}. page sólo admite "/" o "/store".',
      },
      prizes:
        'promotion_id sale de minigames sub_action=eligible_promotions (promos con código, activas, no automáticas y limitadas por regla a los canales de la tienda).',
    },
    subActions: {
      publish: {
        method: 'POST',
        path: '/{id}/publish',
        impact: 'high',
        note: 'Publica el juego en la tienda: lo ven y lo juegan los clientes y entrega cupones reales.',
      },
      pause: { method: 'POST', path: '/{id}/pause', note: 'Oculta el juego (paused); se puede editar y volver a publicar.' },
      end: { method: 'POST', path: '/{id}/end', note: 'Termina la campaña (ended): no se puede volver a publicar.' },
      duplicate: { method: 'POST', path: '/{id}/duplicate', note: 'Copia en draft, sin fechas: para cambiar una campaña ya jugada.' },
      stats: { method: 'GET', path: '/{id}/stats', note: 'Participantes, premios, completion_rate, órdenes y ventas asociadas.' },
    },
  },
  minigame_settings: {
    path: '/admin/minigames/settings',
    singleton: true,
    opConfig: {
      update: {
        method: 'PATCH',
        note: 'Body {retention_days 30-730, launcher_config {text, position 10-85, mode: text|icon|both, background, foreground, animate, hidden_paths}, drawer_config {title, description}, consent_config {version, marketing_text}}. Los bloques omitidos vuelven a {}: mandá todo lo que quieras conservar. No mandes id/site_id/active_campaign_id.',
        validate: (args) => unknownKeys(args.body, SETTINGS_FIELDS),
      },
    },
    summary: 'Ajustes de minijuegos por tienda (botón flotante, drawer, consentimiento); site_id obligatorio',
  },
  minigames: {
    path: '/admin/minigames',
    ops: [],
    summary: 'Minijuegos: tiendas, promociones elegibles como premio, cartas desde el catálogo',
    subActions: {
      sites: { method: 'GET', path: '/sites', note: 'Tiendas donde se puede crear una campaña (id = site_id) con sus canales y colores.' },
      eligible_promotions: {
        method: 'GET',
        path: '/promotions/eligible',
        note: 'Promociones de la tienda (site_id) usables como premio; query {q: código}. unavailable = cuántas se descartaron.',
      },
      catalog_assets: {
        method: 'GET',
        path: '/catalog-assets',
        requires: ['query.type', 'query.id', 'query.pairs'],
        note: 'Cartas de memoria desde productos publicados: query {type: category|collection, id, pairs: 3|6|10}. 409 not_enough_catalog_products si no alcanzan.',
      },
    },
  },
};

const GROUPS = [
  { title: 'SEO / GEO', resources: ['seo_geo_config', 'seo_geo_audits', 'seo_geo_findings', 'seo_geo'] },
  {
    title: 'Recomendaciones',
    resources: [
      'recommendation_config',
      'recommendation_strategies',
      'recommendation_placements',
      'recommendation_relations',
      'recommendations',
    ],
  },
  { title: 'Catalogador IA', resources: ['catalogador_config', 'catalogador_executions'] },
  {
    title: 'Contenido de catálogo',
    resources: [
      'comments',
      'comment_settings',
      'pdf_catalogs',
      'shop_by_looks',
      'space_designer_configurators',
      'space_designer_quotes',
      'space_designer',
    ],
  },
  { title: 'Minijuegos', resources: ['minigame_campaigns', 'minigame_settings', 'minigames'] },
];

const tool = createExtensionTool({
  name: 'manage_minimalart_growth',
  intro:
    'GROWTH y merchandising del backoffice: SEO/GEO, motor de recomendaciones, catalogador IA, comentarios de productos, catálogos PDF, shop-by-looks, space designer y minijuegos.',
  resources: RESOURCES,
  groups: GROUPS,
});

export const extensionResources = tool.resources;

export const apiTool = {
  definition: tool.definition,
  function: tool.function,
  // Rutas declaradas por resource: quien embebe el handler deriva de acá qué
  // permiso pide cada resource (filtro de tools por usuario).
  resources: tool.resources,
};
