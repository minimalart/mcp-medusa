/**
 * PAGOS del boilerplate: beneficios de pago (cuotas/descuentos por banco o medio),
 * cuentas de cobro por tienda (MercadoPago, Mobbex, MODO) y links de venta.
 *
 * Las cuentas de cobro usan rutas propias de cada proveedor que NUNCA devuelven un
 * token: sólo el estado y las credenciales enmascaradas (últimos 4). El genérico
 * `/admin/site-credentials` sigue fuera del MCP (`lib/extension-exclusions.js`).
 * Quién puede verlas o cambiarlas lo decide el rol del usuario (recurso RBAC
 * `site_credentials` en el boilerplate).
 *
 * `payment_benefits` vivía en `manage_minimalart_commerce` y `checkout_links` en
 * `manage_minimalart_extensions` (1.9.0 los mueve acá): mismos nombres y rutas.
 *
 * Declarativa: ver `lib/extension-resources.js`.
 */

import { createExtensionTool } from '../../lib/extension-resources.js';

/** Cuenta de cobro de UNA tienda: estado (get), conectar/editar (update) y desconectar (delete). */
function siteAccount(provider, label, body) {
  return {
    path: `/admin/${provider}/site-account`,
    singleton: true,
    ops: ['get', 'update', 'delete'],
    summary: `Cuenta de ${label} de la tienda (estado y credenciales enmascaradas; site_id obligatorio para escribir)`,
    notes:
      `Sin site_id, get devuelve la cuenta global y nada es editable. update/delete exigen una tienda concreta (site_id). ` +
      `update body ${body}: las credenciales viajan por la conversación; si el usuario prefiere, que las cargue en el backoffice.`,
    opConfig: {
      update: { method: 'POST', impact: 'high', note: `Conecta o reemplaza la cuenta de ${label} con la que cobra la tienda.` },
      delete: {
        method: 'DELETE',
        impact: 'high',
        note: `Desconecta la cuenta propia de ${label}: la tienda vuelve a heredar la global si la herencia está prendida.`,
      },
    },
  };
}

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
  mercadopago_account: siteAccount('mercadopago', 'Mercado Pago', '{access_token?, public_key?, webhook_secret?, inherit_global?}'),
  mobbex_account: siteAccount('mobbex', 'Mobbex', '{api_key?, access_token?, test_mode?, inherit_global?}'),
  modo_account: siteAccount('modo', 'MODO', '{username?, password?, processor_code?, merchant_name?, establishment_numbers?, inherit_global?}'),
  checkout_links: { path: '/admin/checkout-links', summary: 'Links de venta / checkout directo' },
};

const GROUPS = [
  { title: 'Beneficios', resources: ['payment_benefits'] },
  { title: 'Cuentas de cobro por tienda', resources: ['mercadopago_account', 'mobbex_account', 'modo_account'] },
  { title: 'Links de venta', resources: ['checkout_links'] },
];

const tool = createExtensionTool({
  name: 'manage_minimalart_payments',
  intro:
    'PAGOS del backoffice: beneficios de pago (cuotas/descuentos por banco o medio), cuentas de cobro de cada tienda (Mercado Pago, Mobbex, MODO; nunca devuelven tokens) y links de venta. Pagos de órdenes (capturas, reembolsos): manage_medusa_admin_payments. Medios de pago del checkout de una tienda: manage_minimalart_stores resource=sites.',
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
