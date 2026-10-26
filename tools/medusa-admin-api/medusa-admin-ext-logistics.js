/**
 * Extensiones de LOGÍSTICA del boilerplate: Andreani, Correo Argentino, envia, delivery
 * propio (choferes, vehículos, zonas, reglas, rutas, ejecuciones), tipos de
 * retiro en sucursal y datos de checkout de una orden.
 *
 * Declarativa: ver `lib/extension-resources.js`.
 */

import { createExtensionTool } from '../../lib/extension-resources.js';

const LABEL_DOWNLOAD = 'Etiqueta: backoffice → Andreani / Correo Argentino → envío → Descargar etiqueta.';

function carrierActions(label) {
  return {
    tracking: { method: 'GET', path: '/tracking/{id}', note: 'id = número de seguimiento.' },
    create_ticket: {
      method: 'POST',
      path: '/orders/{id}/tickets',
      impact: 'high',
      note: `Crea un envío REAL en ${label} para la orden (id = order_id).`,
    },
    bulk_tickets: {
      method: 'POST',
      path: '/tickets/bulk',
      impact: 'high',
      note: `Crea envíos REALES en ${label} para varias órdenes.`,
    },
    download_label: {
      method: 'GET',
      path: '/labels/{id}',
      note: 'Etiqueta PDF (solo metadata). id = shipment_id / número de envío.',
      download: LABEL_DOWNLOAD,
    },
    download_labels: {
      method: 'POST',
      path: '/labels',
      mutating: false,
      note: 'Etiqueta(s) por body (ej. {tracking_numbers[], label_format?}); PDF, solo metadata.',
      download: LABEL_DOWNLOAD,
    },
    bulk_labels: {
      method: 'POST',
      path: '/labels/bulk',
      mutating: false,
      note: 'ZIP de etiquetas (solo metadata + headers total/truncated).',
      download: LABEL_DOWNLOAD,
    },
  };
}

export const RESOURCES = {
  // ─── Carriers ───────────────────────────────────────────────────────────────
  andreani: {
    path: '/admin/andreani',
    ops: [],
    summary: 'Envíos Andreani',
    subActions: carrierActions('Andreani'),
  },
  andreani_fulfillments: {
    path: '/admin/andreani/fulfillments',
    readOnly: true,
    ops: ['list'],
    summary: 'Envíos Andreani (query search, status, date_from, date_to)',
  },
  andreani_boxes: {
    path: '/admin/andreani/boxes',
    ops: ['list', 'create', 'update', 'delete'],
    summary: 'Cajas/medidas para cotizar Andreani',
  },
  correo_argentino: {
    path: '/admin/correo-argentino',
    ops: [],
    summary: 'Envíos Correo Argentino',
    subActions: {
      health: { method: 'GET', path: '/health', note: 'query {probe:true} prueba la conexión real.' },
      ...carrierActions('Correo Argentino'),
    },
  },
  correo_argentino_fulfillments: {
    path: '/admin/correo-argentino/fulfillments',
    readOnly: true,
    ops: ['list'],
    summary: 'Envíos Correo Argentino (query search, status, fechas)',
  },

  // ─── Delivery propio ───────────────────────────────────────────────────────
  delivery: {
    path: '/admin/delivery',
    ops: [],
    summary: 'Delivery propio: analítica y cobertura',
    subActions: {
      analytics: {
        method: 'GET',
        path: '/analytics',
        requires: ['query.from', 'query.to'],
        note: 'query {from, to} obligatorios; opcional store_location_id, provider_type.',
      },
      coverages_overview: { method: 'GET', path: '/coverages-overview' },
    },
  },
  delivery_drivers: {
    path: '/admin/delivery/drivers',
    summary: 'Choferes',
    children: {
      shifts: { path: '/{id}/shifts', ops: ['list', 'create', 'delete'], notes: { delete: 'child_id = shiftId.' } },
    },
  },
  delivery_vehicles: { path: '/admin/delivery/vehicles', summary: 'Vehículos' },
  delivery_zones: {
    path: '/admin/delivery/zones',
    summary: 'Zonas de entrega',
    subActions: { conflicts: { method: 'GET', path: '/conflicts', note: 'Zonas superpuestas.' } },
    children: {
      resources: {
        path: '/{id}/resources',
        singular: 'resource',
        ops: ['list', 'create', 'delete'],
        notes: { create: 'Asigna chofer/vehículo a la zona.' },
      },
    },
  },
  delivery_rules: { path: '/admin/delivery/rules', summary: 'Reglas de delivery (costos, ventanas)' },
  delivery_routes: {
    path: '/admin/delivery/routes',
    summary: 'Hojas de ruta',
    subActions: {
      dispatch: { method: 'POST', path: '/{id}/dispatch', impact: 'high', note: 'Despacha la ruta a los choferes.' },
      optimize: { method: 'POST', path: '/{id}/optimize' },
      add_stops: { method: 'POST', path: '/{id}/stops' },
      replace_stops: { method: 'PUT', path: '/{id}/stops', note: 'Reemplaza/reordena todas las paradas.' },
      auto_build: { method: 'POST', path: '/auto-build', note: 'Arma rutas automáticamente.' },
    },
  },
  delivery_executions: {
    path: '/admin/delivery/executions',
    ops: ['list', 'get'],
    summary: 'Entregas en curso',
    subActions: {
      assign: { method: 'POST', path: '/{id}/assign' },
      auto_assign: { method: 'POST', path: '/{id}/auto-assign' },
      eligible_resources: { method: 'GET', path: '/{id}/eligible-resources' },
      events: { method: 'GET', path: '/{id}/events' },
      proofs: { method: 'GET', path: '/{id}/proofs', note: 'Pruebas de entrega.' },
    },
  },

  // ─── Sucursales y órdenes ───────────────────────────────────────────────────
  order_pickup: {
    path: '/admin/orders',
    ops: ['get'],
    opConfig: { get: { method: 'GET', path: '/{id}/ready-for-pickup' } },
    summary: 'Retiro en sucursal de una orden (id = order_id)',
    subActions: {
      mark_ready: {
        method: 'POST',
        path: '/{id}/ready-for-pickup',
        impact: 'high',
        note: 'Marca lista para retirar y ENVÍA email al comprador (repetir → 409).',
      },
    },
  },
  order_checkout: {
    path: '/admin/orders',
    readOnly: true,
    ops: ['get'],
    opConfig: { get: { method: 'GET', path: '/{id}/checkout' } },
    forbiddenQuery: ['documents'],
    summary: 'Datos del checkout de una orden (personas/unidades enmascaradas; id = order_id)',
  },

  // ─── envia (cotizador multi-carrier) ─────────────────────────────────────────
  envia: {
    path: '/admin/envia',
    ops: [],
    summary: 'envia: carriers de la cuenta, carrier por depósito y cotización de prueba',
    subActions: {
      carriers: {
        method: 'GET',
        path: '/carriers',
        note: 'Carriers y servicios habilitados en la cuenta de envia de la tienda: query {country: AR}. 400 sin credenciales.',
      },
      get_default_carrier: {
        method: 'GET',
        path: '/locations/{id}/default-carrier',
        note: 'id = stock_location_id.',
      },
      set_default_carrier: {
        method: 'POST',
        path: '/locations/{id}/default-carrier',
        note: 'id = stock_location_id. body {carrier|null, service?}: exige el proveedor envia habilitado en el depósito; null limpia.',
      },
      quote_test: {
        method: 'POST',
        path: '/quote-test',
        mutating: false,
        requires: ['body.location_id', 'body.postal_code'],
        note: 'La MISMA cotización del checkout con un paquete sintético (sólo cotiza en envia): body {location_id, postal_code, province?, city?, country_code?, weight_kg, length_cm, width_cm, height_cm, declared_value}.',
      },
    },
  },
};

const GROUPS = [
  {
    title: 'Carriers',
    resources: ['andreani', 'andreani_fulfillments', 'andreani_boxes', 'correo_argentino', 'correo_argentino_fulfillments', 'envia'],
  },
  {
    title: 'Delivery propio',
    resources: [
      'delivery',
      'delivery_drivers',
      'delivery_vehicles',
      'delivery_zones',
      'delivery_rules',
      'delivery_routes',
      'delivery_executions',
    ],
  },
  { title: 'Órdenes', resources: ['order_pickup', 'order_checkout'] },
];

const tool = createExtensionTool({
  name: 'manage_minimalart_logistics',
  intro:
    'Extensiones de LOGÍSTICA del backoffice: Andreani, Correo Argentino, envia, delivery propio, retiro en sucursal y checkout de una orden. Sucursales (cobertura, config, tipos): manage_minimalart_extensions.',
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
