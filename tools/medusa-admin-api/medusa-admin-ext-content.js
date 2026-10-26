/**
 * CONTENIDO del storefront: las secciones Banners, Blog, Landing pages, Biblioteca
 * de medios y Videos del backoffice (grupo "Contenido" de permisos).
 *
 * Vivían en `manage_minimalart_extensions` (1.9.0 los mueve acá): mismos nombres
 * de recurso, acciones y rutas.
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

};

const GROUPS = [
  { title: 'Banners', resources: ['banners', 'banner_settings'] },
  { title: 'Blog', resources: ['blog_categories', 'blog_posts', 'blog_settings'] },
  { title: 'Landings', resources: ['landing_pages'] },
  { title: 'Medios y video', resources: ['media_library', 'videos', 'vimeo'] },
];

const tool = createExtensionTool({
  name: 'manage_minimalart_content',
  intro:
    'CONTENIDO del storefront (secciones Banners, Blog, Landing pages, Biblioteca de medios y Videos). Páginas y header/footer de cada tienda: manage_minimalart_stores. Plantillas de email: manage_minimalart_extensions.',
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
