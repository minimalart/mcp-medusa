/**
 * GROWTH / merchandising del boilerplate: SEO-GEO (auditorías, visibilidad en
 * IA), motor de recomendaciones, catalogador IA, comentarios de productos,
 * catálogos PDF, shop-by-looks y space designer.
 *
 * Declarativa: ver `lib/extension-resources.js`.
 */

import { createExtensionTool } from '../../lib/extension-resources.js';

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
];

const tool = createExtensionTool({
  name: 'manage_minimalart_growth',
  intro:
    'GROWTH y merchandising del backoffice: SEO/GEO, motor de recomendaciones, catalogador IA, comentarios de productos, catálogos PDF, shop-by-looks y space designer.',
  resources: RESOURCES,
  groups: GROUPS,
});

export const extensionResources = tool.resources;

export const apiTool = {
  definition: tool.definition,
  function: tool.function,
};
