/**
 * WHATSAPP y CHAT WEB del boilerplate: templates y config de Kapso, recorridos del
 * bot (whatsapp-flows), conversaciones (tomar/devolver al bot), sesiones, analítica,
 * el asesor de WhatsApp y el constructor de bots del chat web (chat-bot-builder):
 * bots, versiones, publicación y bandeja de conversaciones.
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

  // ─── Chat web (extensión chat-bot-builder) ─────────────────────────────────
  chatbot_bots: {
    path: '/admin/chatbot/bots',
    summary: 'Bots del chat web: borrador, versiones y publicación (create exige site_id)',
    notes:
      'create body {name, config?} → nace en borrador con un recorrido en blanco. update (PATCH) sólo nombre y config; estado y versión activa cambian publicando. delete sólo un bot no activo. El recorrido (graph) se guarda con create_version (el borrador es uno por bot; 409 draft_exists si ya hay otro). Publicar/despublicar exige el permiso aparte "Chatbot: publicación".',
    opConfig: { update: { method: 'PATCH', path: '/{id}' } },
    children: {
      versions: {
        path: '/{id}/versions',
        ops: ['list', 'get', 'create'],
        notes: {
          list: 'Historial sin grafo.',
          get: 'child_id = version_id; incluye el grafo.',
          create: 'Guarda el BORRADOR: body {graph, version_id?, name?, notes?}. Se acepta con problemas (los devuelve en issues); un grafo sin pasos es 400.',
        },
      },
    },
    subActions: {
      duplicate: { method: 'POST', path: '/{id}/duplicate', note: 'Copia en borrador, misma tienda, sin activar: body {name?}.' },
      publish: {
        method: 'POST',
        path: '/{id}/publish',
        impact: 'high',
        note: 'El borrador pasa a atender visitantes del chat web: body {version_id?}. 400 con la lista de problemas si no valida; 409 active_bot_conflict si ya hay otro bot activo en la tienda.',
      },
      unpublish: {
        method: 'POST',
        path: '/{id}/unpublish',
        impact: 'high',
        note: 'Desactiva el bot YA (el widget deja de iniciar sesiones); deja una copia en borrador.',
      },
      restore_version: {
        method: 'POST',
        path: '/{id}/versions/{child_id}/restore',
        note: 'child_id = version_id. Copia una versión vieja a un BORRADOR (no publica); 409 draft_exists si ya hay borrador.',
      },
    },
  },
  chatbot_capabilities: {
    path: '/admin/chatbot/capabilities',
    singleton: true,
    readOnly: true,
    summary: 'Qué ofrece el entorno al constructor de bots (agent:false = sin asistente IA)',
  },
  chatbot_conversations: {
    path: '/admin/chatbot/conversations',
    ops: ['list', 'get'],
    summary: 'Bandeja del chat web: tomar, transferir, responder, cerrar o devolver al bot',
    notes:
      'list query {status, channel, assigned_to: me|unassigned|<user_id>, from, to (ISO, última actividad)} + limit (≤100)/offset. get query {after_seq?} = sólo mensajes nuevos. Toda acción lleva body.expected_revision (la de get; 409 si cambió). El actor es siempre el usuario conectado.',
    subActions: {
      assign: {
        method: 'POST',
        path: '/{id}/assign',
        requires: ['body.expected_revision'],
        note: 'Tomarla o transferirla: body {expected_revision, assignee_id?} (sin assignee_id se la queda el usuario).',
      },
      release: { method: 'POST', path: '/{id}/release', requires: ['body.expected_revision'], note: 'Vuelve a la cola de pendientes, sin dueño.' },
      close: { method: 'POST', path: '/{id}/close', requires: ['body.expected_revision'], note: 'Resuelta (terminal): el próximo mensaje abre otra conversación.' },
      return_to_bot: {
        method: 'POST',
        path: '/{id}/return-to-bot',
        requires: ['body.expected_revision'],
        note: 'La devuelve al bot con el recorrido en cero.',
      },
      reply: {
        method: 'POST',
        path: '/{id}/reply',
        impact: 'high',
        requires: ['body.expected_revision', 'body.text'],
        note: 'Envía un mensaje REAL al visitante: body {expected_revision, text}. Desde pendiente la toma; 409 assigned_to_other si es de otro operador.',
      },
    },
  },
};

const GROUPS = [
  {
    title: 'WhatsApp',
    resources: [
      'whatsapp_templates',
      'whatsapp_bindings',
      'whatsapp_bot_channels',
      'whatsapp_bot_switch',
      'whatsapp_floating_button',
      'whatsapp_flows',
      'whatsapp_conversations',
      'whatsapp_sessions',
      'whatsapp_analytics',
      'whatsapp_advisor',
    ],
  },
  { title: 'Chat web (constructor de bots)', resources: ['chatbot_bots', 'chatbot_capabilities', 'chatbot_conversations'] },
];

const tool = createExtensionTool({
  name: 'manage_minimalart_whatsapp',
  intro:
    'WHATSAPP y CHAT WEB del backoffice. WhatsApp (Kapso): templates de Meta, bindings de notificaciones, bot (canales, encendido, botón flotante), recorridos del bot, conversaciones, sesiones, analítica y asesor. Chat web: bots (versiones, publicación) y bandeja de conversaciones.',
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
