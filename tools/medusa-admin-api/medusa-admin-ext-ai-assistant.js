/**
 * CONFIGURACIÓN del Asistente IA del backoffice: agentes, skills, workflows y sus
 * corridas, políticas de tools, servidores MCP conectados e hilos de chat.
 *
 * La MEMORIA, documentos de contexto, propuestas y logs de corridas del
 * asistente están en `manage_store_memory` (medusa-admin-store-memory.js).
 * Nunca se exponen: API keys de proveedores (`ai-assistant/keys`), el OAuth
 * interactivo de servidores MCP ni el streaming SSE de mensajes.
 *
 * Declarativa: ver `lib/extension-resources.js`.
 */

import { createExtensionTool } from '../../lib/extension-resources.js';

export const RESOURCES = {
  ai_agents: {
    path: '/admin/ai-assistant/agents',
    summary: 'Agentes del asistente (instrucciones, modelo, tools permitidas)',
    subActions: {
      draft: {
        method: 'POST',
        path: '/admin/ai-assistant/draft-agent',
        mutating: false,
        requires: ['body.prompt'],
        note: 'Genera un borrador de agente con IA (no guarda): body {prompt}.',
      },
    },
  },
  ai_skills: { path: '/admin/ai-assistant/skills', summary: 'Skills (instrucciones reutilizables)' },
  ai_workflows: { path: '/admin/ai-assistant/workflows', summary: 'Workflows multi-agente' },
  ai_workflow_runs: {
    path: '/admin/ai-assistant/workflows/runs',
    ops: ['list', 'get'],
    summary: 'Corridas de workflows (query status, workflow_key, thread_id, take≤100)',
    subActions: {
      resume: { method: 'POST', path: '/{id}/resume', impact: 'high', note: 'Reanuda la corrida: los agentes siguen ejecutando.' },
    },
  },
  ai_tool_policies: {
    path: '/admin/ai-assistant/tools',
    singleton: true,
    opConfig: {
      update: {
        method: 'POST',
        impact: 'high',
        requires: ['body.tools'],
        note: 'Cambia qué puede ejecutar el asistente sin preguntar: body {tools:[{tool_name, action, resource?, mode:"auto"|"ask"|"prohibited"}]}.',
      },
    },
    summary: 'Políticas de tools del asistente (auto/ask/prohibited)',
  },
  ai_mcp_servers: {
    path: '/admin/ai-assistant/mcp-servers',
    opConfig: {
      create: { method: 'POST', impact: 'high', note: 'Conecta herramientas externas al asistente (secret solo de entrada).' },
      update: { method: 'POST', path: '/{id}', impact: 'high', note: 'secret vacío = no se pisa.' },
    },
    summary: 'Servidores MCP externos conectados al asistente',
    subActions: { refresh: { method: 'POST', path: '/{id}/refresh', note: 'Relee las tools del servidor.' } },
  },
  ai_threads: {
    path: '/admin/ai-assistant/threads',
    ops: ['list', 'get', 'create', 'delete'],
    summary: 'Hilos de chat con el asistente (solo los del usuario de la API key)',
    subActions: {
      get_campaign: { method: 'GET', path: '/{id}/campaign' },
      update_campaign: { method: 'POST', path: '/{id}/campaign' },
      send_message: {
        method: 'POST',
        path: '/{id}/messages',
        impact: 'high',
        requires: ['body.text'],
        note: 'Corre un turno del asistente (puede usar tools): body {text, agent_key?, skill?, period?, model?}.',
      },
      confirm_tools: {
        method: 'POST',
        path: '/{id}/confirm',
        impact: 'high',
        requires: ['body.decisions'],
        note: 'EJECUTA las acciones pendientes que propuso el asistente: body {decisions}.',
      },
    },
  },
};

const tool = createExtensionTool({
  name: 'manage_minimalart_ai_assistant',
  intro:
    'CONFIGURACIÓN del Asistente IA del backoffice: agentes, skills, workflows, políticas de tools, servidores MCP e hilos. Memoria, documentos, propuestas y logs: manage_store_memory.',
  resources: RESOURCES,
});

export const extensionResources = tool.resources;

export const apiTool = {
  definition: tool.definition,
  function: tool.function,
};
