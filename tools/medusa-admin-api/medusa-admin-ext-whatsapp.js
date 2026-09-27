/**
 * WHATSAPP del boilerplate: templates y config de Kapso, recorridos del bot
 * (whatsapp-flows), conversaciones (tomar/devolver al bot), sesiones, analítica y
 * el asesor de WhatsApp.
 *
 * Declarativa: ver `lib/extension-resources.js`.
 */

import { createExtensionTool } from '../../lib/extension-resources.js';

export const RESOURCES = {
  whatsapp_templates: {
    path: '/admin/kapso/templates',
    ops: ['list', 'create', 'update', 'delete'],
    opConfig: {
      create: { method: 'POST', impact: 'high', note: 'Crea el template y lo envía a aprobación de Meta.' },
      update: { method: 'PUT', path: '/{id}', impact: 'high', note: 'Edita el template en Meta (id = nombre).' },
      delete: { method: 'DELETE', path: '/{id}', impact: 'high', note: 'Borra el template en Meta (id = nombre).' },
    },
    summary: 'Templates de WhatsApp (Meta) vía Kapso (id = nombre)',
  },
  whatsapp_bindings: {
    path: '/admin/kapso/bindings',
    ops: ['list', 'create', 'delete'],
    summary: 'Qué template usa cada evento/notificación (delete id = key)',
  },
  whatsapp_bot_channels: { path: '/admin/kapso/bot-channels', singleton: true, summary: 'Canales donde responde el bot' },
  whatsapp_bot_switch: {
    path: '/admin/kapso/bot-switch',
    singleton: true,
    opConfig: { update: { method: 'POST', impact: 'high', note: 'Prende/apaga el bot para clientes reales.' } },
    summary: 'Bot encendido/apagado',
  },
  whatsapp_floating_button: {
    path: '/admin/kapso/floating-button',
    singleton: true,
    summary: 'Botón flotante de WhatsApp del storefront',
  },
  whatsapp_flows: {
    path: '/admin/whatsapp-flows',
    ops: ['list', 'create'],
    opConfig: {
      list: { method: 'GET', note: 'query {flow_key}.' },
      create: {
        method: 'POST',
        note: 'Guarda un BORRADOR: body {flow_key?, graph, version_id? (sin él crea uno nuevo), name?, notes?}.',
      },
    },
    summary: 'Recorridos (flows) del bot: borradores y versiones',
    subActions: {
      analytics: { method: 'GET', path: '/analytics', note: 'query {days}.' },
      preview_action: { method: 'POST', path: '/preview-action', mutating: false },
      publish: { method: 'POST', path: '/publish', impact: 'high', note: 'El recorrido pasa a responder a clientes reales.' },
      unpublish: { method: 'POST', path: '/unpublish', impact: 'high', note: 'Saca el recorrido publicado.' },
      seed: { method: 'POST', path: '/seed', note: 'Crea el recorrido base.' },
      get_version: { method: 'GET', path: '/versions/{id}' },
      update_version: { method: 'POST', path: '/versions/{id}' },
      delete_version: { method: 'DELETE', path: '/versions/{id}' },
      restore_version: { method: 'POST', path: '/versions/{id}/restore' },
    },
  },
  whatsapp_conversations: {
    path: '/admin/whatsapp-conversations',
    ops: ['list'],
    summary: 'Conversaciones de WhatsApp',
    subActions: {
      pause_bot: {
        method: 'POST',
        path: '',
        fixedBody: { action: 'pause' },
        note: 'Un humano toma la conversación: body {phone} o {id}.',
      },
      resume_bot: {
        method: 'POST',
        path: '',
        fixedBody: { action: 'resume' },
        note: 'Devuelve la conversación al bot: body {phone} o {id}.',
      },
    },
  },
  whatsapp_sessions: {
    path: '/admin/whatsapp-sessions',
    readOnly: true,
    ops: ['list'],
    summary: 'Sesiones del bot (query days≤90)',
  },
  whatsapp_analytics: {
    path: '/admin/whatsapp-analytics',
    singleton: true,
    readOnly: true,
    summary: 'Analítica de WhatsApp (query days 1-365)',
  },
  whatsapp_advisor: {
    path: '/admin/whatsapp-advisor/config',
    singleton: true,
    summary: 'Asesor de ventas por WhatsApp (config)',
    subActions: { audit: { method: 'GET', path: '/admin/whatsapp-advisor/audit', note: 'Auditoría de respuestas.' } },
  },
};

const tool = createExtensionTool({
  name: 'manage_minimalart_whatsapp',
  intro:
    'WHATSAPP del backoffice (Kapso): templates de Meta, bindings de notificaciones, bot (canales, encendido, botón flotante), recorridos del bot, conversaciones, sesiones, analítica y asesor.',
  resources: RESOURCES,
});

export const extensionResources = tool.resources;

export const apiTool = {
  definition: tool.definition,
  function: tool.function,
};
