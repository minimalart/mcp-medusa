/**
 * MEMORIA del Asistente IA de la tienda: memorias (reglas de negocio, decisiones,
 * preferencias, aprendizajes...), documentos de contexto por agente, propuestas
 * y corridas. Es la misma memoria que usan los agentes del backoffice.
 *
 * La memoria es de la INSTANCIA (tenant "default"), no por tienda: `site_id` no
 * la acota.
 *
 * Regla clave: lo que se crea por MCP queda `pending` (lo aprueba un admin en el
 * backoffice → Asistente IA → Memoria) salvo que el usuario haya pedido
 * explícitamente activarla (`body.status: "active"`). El backend siempre crea
 * `active`, así que el create hace POST y después POST /:id {status:"pending"};
 * si ese segundo paso falla, la memoria se borra para no dejarla activa sin
 * revisión.
 *
 * Declarativa: ver `lib/extension-resources.js`.
 */

import { createExtensionTool } from '../../lib/extension-resources.js';

export const MEMORY_TYPES = Object.freeze([
  'business_rule',
  'decision',
  'preference',
  'campaign_learning',
  'product_context',
  'customer_segment_context',
  'brand_guideline',
  'operational_policy',
  'conversation_learning',
  'proposal_feedback',
  'document_chunk',
  'faq',
  'system_note',
]);

const MEMORY_PATH = '/admin/ai-assistant/memory';
const DOCUMENT_MIME_TYPES = Object.freeze(['application/pdf', 'text/plain', 'text/markdown']);
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const PENDING_NOTE =
  'Guardada como PENDIENTE: un admin la revisa y aprueba en el backoffice (Asistente IA → Memoria). Hasta entonces los agentes no la usan ni aparece en search.';
const ACTIVE_NOTE = 'Guardada ACTIVA (pedido explícito del usuario): los agentes ya pueden usarla.';

const isInt0to100 = (v) => v === undefined || (Number.isInteger(v) && v >= 0 && v <= 100);

function validateMemoryFields(body, { creating }) {
  if (creating) {
    for (const field of ['memory_type', 'title', 'content']) {
      if (typeof body[field] !== 'string' || body[field].trim() === '') {
        return `body.${field} is required to create a memory.`;
      }
    }
  }
  if (body.memory_type !== undefined && !MEMORY_TYPES.includes(body.memory_type)) {
    return `body.memory_type must be one of: ${MEMORY_TYPES.join(', ')}.`;
  }
  if (!isInt0to100(body.importance_score) || !isInt0to100(body.confidence_score)) {
    return 'importance_score and confidence_score must be integers between 0 and 100.';
  }
  if (body.tags !== undefined && body.tags !== null && !(Array.isArray(body.tags) && body.tags.every((t) => typeof t === 'string'))) {
    return 'body.tags must be an array of strings.';
  }
  if (body.status !== undefined && !['pending', 'active', 'archived'].includes(body.status)) {
    return 'body.status must be pending, active or archived.';
  }
  return null;
}

async function createMemory({ body, request }) {
  const { status: requested, ...payload } = body;
  if (requested === 'archived') {
    return { error: 'A new memory can only be created as pending (default) or active.' };
  }
  const created = await request('POST', MEMORY_PATH, { body: payload });
  const memory = created?.memory;
  if (!memory?.id) return created;

  if (requested === 'active') return { ...created, note: ACTIVE_NOTE };

  const idPath = `${MEMORY_PATH}/${encodeURIComponent(memory.id)}`;
  try {
    const updated = await request('POST', idPath, { body: { status: 'pending' } });
    return { memory: updated?.memory ?? { ...memory, status: 'pending' }, note: PENDING_NOTE };
  } catch (error) {
    // No dejar una memoria activa sin revisión: se borra (soft-delete) y se avisa.
    try {
      await request('DELETE', idPath);
      return {
        error: `The memory was created but could not be set to pending (${error.message}); it was deleted to avoid an unreviewed active memory. Retry.`,
      };
    } catch (rollbackError) {
      return {
        error: `The memory ${memory.id} was created ACTIVE and could not be set to pending (${error.message}) nor deleted (${rollbackError.message}). Ask an admin to review it in Asistente IA → Memoria.`,
        memory,
      };
    }
  }
}

function validateDocumentUpload(args) {
  const body = args.body || {};
  for (const field of ['filename', 'mimeType', 'content']) {
    if (typeof body[field] !== 'string' || body[field].trim() === '') {
      return `body.${field} is required to upload a document.`;
    }
  }
  if (!DOCUMENT_MIME_TYPES.includes(body.mimeType)) {
    return `body.mimeType must be one of: ${DOCUMENT_MIME_TYPES.join(', ')}.`;
  }
  const raw = body.content.includes(',') ? body.content.slice(body.content.indexOf(',') + 1) : body.content;
  const approxBytes = Math.floor((raw.replace(/\s/g, '').length * 3) / 4);
  if (approxBytes > MAX_DOCUMENT_BYTES) return 'The document exceeds 8MB.';
  return null;
}

export const RESOURCES = {
  memories: {
    path: MEMORY_PATH,
    summary:
      'Memorias del asistente (list query: status, agent_key ("null" = globales), memory_type, entity_type, entity_id, from, to, tag, q texto; limit≤200)',
    opConfig: {
      create: {
        method: 'POST',
        note: 'Queda PENDING salvo body.status:"active" (solo si el usuario lo pidió).',
        validate: (args) => validateMemoryFields(args.body || {}, { creating: true }),
        handler: createMemory,
      },
      update: {
        method: 'POST',
        path: '/{id}',
        validate: (args) => validateMemoryFields(args.body || {}, { creating: false }),
        note: 'body {title?, content?, summary?, memory_type?, agent_key?, tags?, importance_score?, confidence_score?, status?}. Re-embebe si cambia el contenido.',
      },
      delete: { method: 'DELETE', path: '/{id}', note: 'Soft-delete.' },
    },
    subActions: {
      search: {
        method: 'POST',
        path: '/search',
        mutating: false,
        requires: ['body.query'],
        note: 'Semántica, solo ACTIVAS con embedding: body {query, agent_key?, memory_types?[], limit≤20}.',
      },
      feedback: {
        method: 'POST',
        path: '/{id}/feedback',
        requires: ['body.useful'],
        note: 'body {useful: boolean}: sube/baja confianza (muy baja → archiva).',
      },
      archive: { method: 'POST', path: '/{id}', fixedBody: { status: 'archived' }, note: 'Archiva (reversible con update).' },
    },
  },
  documents: {
    path: '/admin/ai-assistant/documents',
    ops: ['list', 'create', 'delete'],
    opConfig: {
      list: {
        method: 'GET',
        path: '/admin/ai-assistant/agents/{id}/documents',
        defaults: { id: 'global' },
        note: 'id = agent id o "global" (default).',
      },
      create: {
        method: 'POST',
        path: '/admin/ai-assistant/agents/{id}/documents',
        impact: 'high',
        validate: validateDocumentUpload,
        note: 'id = agent id o "global". body {filename, mimeType: pdf|text/plain|text/markdown, content base64/data URL ≤8MB, title?}. Los agentes lo usan de inmediato.',
      },
      delete: { method: 'DELETE', path: '/{id}', note: 'Borra el documento y sus fragmentos.' },
    },
    summary: 'Documentos de contexto por agente o globales (list/create id = agent id | "global")',
  },
  agents: {
    path: '/admin/ai-assistant/agents',
    readOnly: true,
    summary: 'Agentes (lectura; su key es el agent_key de memorias). Edición: manage_minimalart_ai_assistant',
  },
  proposals: {
    path: '/admin/ai-assistant/proposals',
    ops: ['list', 'get'],
    summary: 'Propuestas de acción de los agentes (query status)',
    subActions: {
      approve: {
        method: 'POST',
        path: '/{id}/approve',
        impact: 'high',
        note: 'EJECUTA las acciones de la propuesta en la tienda.',
      },
      reject: { method: 'POST', path: '/{id}/reject', note: 'body {reason?}.' },
      generate: {
        method: 'POST',
        path: '/generate',
        note: 'Los agentes generan propuestas nuevas (pendientes): body {agent_key?, limit≤10}.',
      },
    },
  },
  runs: {
    path: '/admin/ai-assistant/runs',
    readOnly: true,
    summary: 'Corridas/logs de agentes (query kind)',
  },
};

const tool = createExtensionTool({
  name: 'manage_store_memory',
  intro:
    'MEMORIA del Asistente IA de la tienda (compartida por los agentes del backoffice; es de la instancia, no por tienda). ' +
    'Buscá antes de responder sobre reglas, preferencias o decisiones del negocio (memories sub_action=search; solo devuelve ACTIVAS). ' +
    `Lo que guardes queda PENDIENTE hasta que un admin lo apruebe en el backoffice (Asistente IA → Memoria); body.status:"active" solo si el usuario lo pidió explícitamente. memory_type: ${MEMORY_TYPES.join(', ')}.`,
  resources: RESOURCES,
  propertyDescriptions: {
    id: 'ID de la memoria/propuesta/corrida/agente. documents list/create: agent id o "global".',
    body: 'JSON de escritura. memories create: {memory_type, title, content, summary?, agent_key?, entity_type?, entity_id?, tags?[], importance_score?, confidence_score? (0-100), status? ("active" solo si el usuario lo pidió)}.',
    site_id: 'Header x-site-id (uniformidad con las otras tools). La memoria es de la instancia: no la acota por tienda.',
  },
});

export const extensionResources = tool.resources;

export const apiTool = {
  definition: tool.definition,
  function: tool.function,
};
