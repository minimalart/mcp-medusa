/**
 * CHAT Y BOTS del boilerplate (sección "Chat y bots", extensión chat-bot-builder):
 * bots del chat web del storefront (borrador, versiones, publicación) y la bandeja de
 * conversaciones atendidas por operadores. WhatsApp: `manage_minimalart_whatsapp`.
 *
 * Declarativa: ver `lib/extension-resources.js`.
 */

import { createExtensionTool } from '../../lib/extension-resources.js';

export const RESOURCES = {
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

const tool = createExtensionTool({
  name: 'manage_minimalart_chatbot',
  intro:
    'CHAT Y BOTS del backoffice: bots del chat web del storefront (borrador, versiones, publicación) y bandeja de conversaciones (tomar, transferir, responder, cerrar, devolver al bot). WhatsApp: manage_minimalart_whatsapp.',
  resources: RESOURCES,
});

export const extensionResources = tool.resources;

export const apiTool = {
  definition: tool.definition,
  function: tool.function,
  // Rutas declaradas por resource: quien embebe el handler deriva de acá qué
  // permiso pide cada resource (filtro de tools por usuario).
  resources: tool.resources,
};
