/**
 * CONTENIDO del storefront: banners, blog, landings, páginas y header/footer de
 * cada tienda (multistore), biblioteca de medios, videos (Vimeo) y plantillas de
 * email.
 *
 * Banners, blog, landings, medios, videos, Vimeo y plantillas de email vivían en
 * `manage_minimalart_extensions` (1.9.0 los mueve acá): mismos nombres de
 * recurso, acciones y rutas.
 *
 * Declarativa: ver `lib/extension-resources.js`.
 */

import { createExtensionTool } from '../../lib/extension-resources.js';

const PRODUCTS_BODY = 'body {product_ids: string[]}';

export const RESOURCES = {
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
  banner_settings: {
    path: '/admin/banners/settings',
    singleton: true,
    summary: 'Ajustes de banners de la tienda (update body {carousel_interval_ms: 1000-60000|null})',
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
      list_tags: { method: 'GET', path: '/tags', note: 'Etiquetas en uso con su cantidad de imágenes.' },
      update_tags: {
        method: 'POST',
        path: '/tags',
        requires: ['body.asset_ids'],
        note: 'Agrega/quita etiquetas a varias imágenes: body {asset_ids: string[], add?: string[], remove?: string[]}.',
      },
      backfill: { method: 'POST', path: '/backfill', note: 'Indexa medios existentes.' },
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

  // ─── Páginas y header/footer de cada tienda (multistore) ───────────────────
  site_pages: {
    path: '/admin/sites',
    ops: [],
    summary: 'Páginas institucionales de una tienda (id = site_id, child_id = page_id)',
    notes:
      'create_page body {title, slug?, draft?, seo?} (sin slug se genera del título; nace en borrador). update_page edita título, slug, borrador o SEO: en una publicada sólo cambia el borrador hasta republicar; cambiar el slug de una publicada deja un redirect. get_page devuelve también dónde está enlazada (menú/footer).',
    children: {
      pages: { path: '/{id}/pages', ops: ['list', 'get', 'create', 'update'] },
    },
    subActions: {
      set_page_status: {
        method: 'POST',
        path: '/{id}/pages/{child_id}/status',
        impact: 'high',
        requires: ['body.action'],
        note: 'body {action: publish|unpublish|archive|restore}: cambia lo que ve el público. La respuesta trae dónde estaba enlazada.',
      },
    },
  },
  site_chrome: {
    path: '/admin/sites',
    ops: [],
    summary: 'Header y footer de una tienda: borrador, preview y publicación (id = site_id)',
    notes:
      'Flujo: save_draft → (preview) → publish. El borrador nunca cambia el sitio público. base_revision = chrome_revision actual del sitio (409 si es vieja). Lo publicado se ve en la tienda en ≤60 s.',
    subActions: {
      save_draft: {
        method: 'POST',
        path: '/{id}/chrome-draft',
        requires: ['body.part', 'body.draft', 'body.base_revision'],
        note: 'body {part: header|footer, draft: {...}, base_revision}.',
      },
      discard_draft: {
        method: 'DELETE',
        path: '/{id}/chrome-draft',
        requires: ['query.part'],
        note: 'query {part: header|footer}.',
      },
      get_preview: { method: 'GET', path: '/{id}/chrome-preview' },
      preview: {
        method: 'POST',
        path: '/{id}/chrome-preview',
        mutating: false,
        note: 'Preview con un override sin guardar: devuelve un token corto para el iframe del admin (no publica).',
      },
      publish: {
        method: 'POST',
        path: '/{id}/chrome-publish',
        impact: 'high',
        requires: ['body.part', 'body.base_revision'],
        note: 'Publica el borrador de UNA parte en la tienda pública: body {part: header|footer, base_revision}.',
      },
    },
  },
};

const GROUPS = [
  { title: 'Banners', resources: ['banners', 'banner_settings'] },
  { title: 'Blog', resources: ['blog_categories', 'blog_posts', 'blog_settings'] },
  { title: 'Landings y páginas', resources: ['landing_pages', 'site_pages', 'site_chrome'] },
  { title: 'Medios y video', resources: ['media_library', 'videos', 'vimeo'] },
  { title: 'Emails', resources: ['email_templates'] },
];

const tool = createExtensionTool({
  name: 'manage_minimalart_content',
  intro:
    'CONTENIDO del storefront: banners, blog, landings, páginas y header/footer de cada tienda, biblioteca de medios, videos (Vimeo) y plantillas de email. Ids de tienda: manage_minimalart_stores resource=sites.',
  resources: RESOURCES,
  groups: GROUPS,
  // Compat con manage_minimalart_extensions (de donde vienen estos recursos):
  // `get` sin id en una colección lista.
  legacyGetFallback: true,
});

export const extensionResources = tool.resources;

export const apiTool = {
  definition: tool.definition,
  function: tool.function,
  // Rutas declaradas por resource: quien embebe el handler deriva de acá qué
  // permiso pide cada resource (filtro de tools por usuario).
  resources: tool.resources,
};
