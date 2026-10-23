/**
 * Tool para las EXTENSIONES de catálogo y clientes del backoffice (no-core de
 * Medusa): métricas de commerce, atributos de producto (ficha técnica), marcas,
 * sucursales, empresas/corporativos B2B, grupos dinámicos, contactos y canales B2C.
 *
 * 1.9.0 movió el contenido (banners, blog, landings, medios, videos, Vimeo,
 * plantillas de email) a `manage_minimalart_content` y los links de venta a
 * `manage_minimalart_payments`, con los mismos nombres de recurso y rutas.
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
  // ─── Atributos de producto (plugin product-attributes): ficha técnica ────────
  attributes: {
    path: '/admin/attributes',
    summary: 'Atributos de producto (ficha técnica): diccionario y uso por tienda',
    notes:
      'El diccionario es compartido por todas las tiendas; el USO (habilitado, ficha, filtro, búsqueda) es por tienda: mandá site_id. list devuelve el uso en la tienda activa. create body {label_es, type: text|long_text|number|boolean|select|multi_select, code?, unit?, visibility?: public|internal, options?: [{label_es, code?, aliases?}], usage?}. update no cambia código; tipo/unidad se bloquean si hay valores. delete = archivar (los valores se conservan).',
    subActions: {
      update_usage: {
        method: 'POST',
        path: '/{id}/usage',
        note: 'Uso en la tienda activa (site_id obligatorio): body {enabled?, show_in_spec?, filterable?, searchable?, sortable?, label_es?, label_en?, group_code?, rank?}. Prender filtro o búsqueda dispara un sync completo de Typesense: el filtro aparece en la tienda cuando termina.',
      },
      create_option: {
        method: 'POST',
        path: '/{id}/options',
        requires: ['body.label_es'],
        note: 'Opción de una selección: body {label_es, code?, label_en?, aliases?: string[]}. El código queda fijo.',
      },
      update_option: {
        method: 'POST',
        path: '/{id}/options/{child_id}',
        note: 'child_id = option_id. body {label_es?, label_en?, aliases?, rank?, status?: active|archived}. Archivar no borra valores existentes.',
      },
    },
  },
  attribute_sets: {
    path: '/admin/attribute-sets',
    summary: 'Conjuntos de atributos (p. ej. Bicicletas) y su estado por tienda',
    notes:
      'El conjunto es del diccionario (compartido); `store_usage` dice si está habilitado en la tienda activa (o en cuáles, sin site_id). create/update body {name_es, name_en?, disclaimer_es?, spec_order?: alphabetical|manual, items?: [{code|definition_id, group_code?, required_for_completeness?}]} (el orden del array es el orden manual). delete = archivar.',
    subActions: {
      enable_in_store: {
        method: 'POST',
        path: '/{id}/enable',
        note: 'Habilita en la tienda activa (site_id obligatorio) todos los atributos del conjunto y los muestra en la ficha. Filtro y búsqueda se prenden aparte (attributes update_usage).',
      },
    },
  },
  attribute_presets: {
    path: '/admin/attribute-presets',
    ops: ['list'],
    summary: 'Presets de conjuntos (Bicicletas, Herramientas)',
    notes: '`in_dictionary` = ya existe su conjunto; `store_usage` = cuánto está habilitado en la tienda activa.',
    subActions: {
      install: {
        method: 'POST',
        path: '/{id}/install',
        note: 'id = código del preset (bicicletas, herramientas). Crea lo que falta en el diccionario (reutiliza atributos con el mismo código) y lo habilita sólo en la tienda activa (site_id obligatorio).',
      },
    },
  },
  product_attributes: {
    path: '/admin/products',
    ops: ['get', 'update'],
    opConfig: { get: { path: '/{id}/attributes' }, update: { path: '/{id}/attributes' } },
    summary: 'Ficha técnica de un producto: valores del producto (heredados) y propios por variante',
    notes:
      'id = product_id. get devuelve revision, set, attributes (habilitados en la tienda activa), product.values (heredados por todas las variantes) y variants[] con values (propios) y effective (lo que muestra). update body {expected_revision (de get), set_id?: string|null, product?: {set: [{code, value, unit?}], unset: [code]}, variants?: [{variant_id, set, unset}]}: cargá en `product` lo que es igual para todas y en `variants` sólo lo que cambia; `unset` en una variante la vuelve a heredar. Todo o nada; 409 si otro cambio se guardó (volvé a leer). Selecciones por código, etiqueta o alias.',
  },
  attribute_imports: {
    path: '/admin/attribute-imports',
    ops: ['list', 'get', 'create'],
    summary: 'Carga masiva de atributos (CSV/XLSX): subir, validar, confirmar',
    notes:
      'create body {kind: values|definitions, file_name, content_base64, delimiter?}. Valores: una fila con sólo product_id carga el producto (lo heredan las variantes); sku o variant_id, valores propios de una variante; columnas attr.<código>, unit.<código>, attribute_set, clear_attributes (array JSON). Celda vacía = no se toca. Flujo: create → sub_action preview → items → confirm.',
    subActions: {
      preview: {
        method: 'POST',
        path: '/{id}/preview',
        mutating: false,
        note: 'Valida y arma el diff SIN escribir productos: body {mapping? (el sugerido por create), mode?: fill_empty|replace, decimal?: dot|comma, sheet?}.',
      },
      items: { method: 'GET', path: '/{id}/items', note: 'Diff por producto: query {status: ready|unchanged|invalid|applied|failed|conflict}.' },
      confirm: {
        method: 'POST',
        path: '/{id}/confirm',
        impact: 'high',
        note: 'Aplica el lote en segundo plano (escritura masiva): body {apply?: all|valid_only, confirm_clears?: boolean, enable_in_store?: boolean}.',
      },
      cancel: { method: 'POST', path: '/{id}/cancel', note: 'Cancela lo no iniciado; lo guardado queda.' },
      retry: { method: 'POST', path: '/{id}/retry', note: 'Reintenta los productos fallidos o en conflicto (los revalida).' },
      errors: {
        method: 'GET',
        path: '/{id}/errors',
        note: 'CSV de errores por fila/columna (vista previa).',
        download: 'CSV completo: backoffice → Atributos → Carga masiva.',
      },
    },
  },
  attribute_exports: {
    path: '/admin/attribute-exports',
    readOnly: true,
    ops: ['list'],
    summary: 'Exportación de atributos a CSV y plantillas',
    notes:
      'list query {kind: values|definitions|sets, set_code?, products?: with_values|all}. Valores: una fila del producto y una por variante con sus valores propios; se reimporta sin cambios. Se devuelve una vista previa del CSV.',
    subActions: {
      template: {
        method: 'GET',
        path: '/template',
        note: 'Plantilla en blanco: query {kind: values|definitions|sets, set_code?}.',
        download: 'Plantilla completa: backoffice → Atributos → Carga masiva → Plantillas y exportación.',
      },
    },
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
};

const tool = createExtensionTool({
  name: 'manage_minimalart_extensions',
  intro:
    'EXTENSIONES de catálogo y clientes del backoffice (no-core de Medusa). Ficha técnica: product_attributes y attribute*. Para MÉTRICAS AGREGADAS de ventas usá resource="commerce_dashboard" action="list" con query {from,to ISO 8601, bucket}. Otros dominios: manage_minimalart_content (banners, blog, landings, páginas, medios, emails), _payments (beneficios, cuentas de cobro, links de venta), _commerce (loyalty, suscripciones, B2B), _logistics, _integrations, _whatsapp (y chatbot web), _growth, _stores, _ai_assistant y manage_store_memory.',
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
  // Rutas declaradas por resource: quien embebe el handler deriva de acá qué
  // permiso pide cada resource (filtro de tools por usuario).
  resources: tool.resources,
};
