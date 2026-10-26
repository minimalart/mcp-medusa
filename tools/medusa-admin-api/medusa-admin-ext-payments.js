/**
 * PAGOS del boilerplate: las secciones Beneficios de pago (cuotas/descuentos por
 * banco o medio) y Links de pago del backoffice. Las cuentas de cobro de cada tienda
 * (Configuración → Integraciones) están en `manage_minimalart_integrations`.
 *
 * `payment_benefits` vivía en `manage_minimalart_commerce` y `checkout_links` en
 * `manage_minimalart_extensions` (1.9.0 los mueve acá): mismos nombres y rutas.
 *
 * Declarativa: ver `lib/extension-resources.js`.
 */

import { createExtensionTool } from '../../lib/extension-resources.js';

export const RESOURCES = {
  payment_benefits: {
    path: '/admin/payment-benefits',
    summary: 'Beneficios de pago: cuotas/descuentos por banco o medio (query provider, status, type, source)',
    subActions: {
      catalog: { method: 'GET', path: '/catalog' },
      dashboard: { method: 'GET', path: '/dashboard' },
      sync: {
        method: 'POST',
        path: '/sync/{id}',
        note: 'id = código del proveedor. Sincroniza el catálogo global: ejecutar sin site_id o desde la tienda principal.',
      },
      sync_all: {
        method: 'POST',
        path: '/sync',
        note: 'Sincroniza TODOS los medios que ofrece el checkout (Mercado Pago, Mobbex, MODO) de la tienda activa o, sin site_id, de la instancia y cada tienda. 200 aunque falle un proveedor: ver stores[].outcomes.',
      },
    },
  },
  checkout_links: { path: '/admin/checkout-links', summary: 'Links de venta / checkout directo' },
};

const GROUPS = [
  { title: 'Beneficios', resources: ['payment_benefits'] },
  { title: 'Links de venta', resources: ['checkout_links'] },
];

const tool = createExtensionTool({
  name: 'manage_minimalart_payments',
  intro:
    'PAGOS del backoffice (secciones Beneficios de pago y Links de pago). Pagos de órdenes (capturas, reembolsos): manage_medusa_admin_payments. Cuentas de cobro de cada tienda (Mercado Pago, Mobbex, MODO): manage_minimalart_integrations. Medios de pago del checkout de una tienda: manage_minimalart_stores resource=sites.',
  resources: RESOURCES,
  groups: GROUPS,
  // Compat con manage_minimalart_extensions (checkout_links venía de ahí).
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
