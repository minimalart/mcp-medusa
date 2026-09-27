// Instrucciones de servidor (campo `instructions` del resultado de `initialize`,
// MCP >= 2025-03-26). Los clientes que las soportan (claude.ai, Claude Desktop,
// Claude Code, etc.) las inyectan en el system prompt del modelo: son la "skill"
// que viaja con el MCP, sin que el usuario tenga que instalar nada.
//
// Son las reglas de acceso a datos que el Asistente IA del backoffice aprendió a
// los golpes (`apps/backend/src/modules/ai-assistant/ai/prompt.ts` del
// boilerplate), SIN lo específico de su interfaz (OpenUI, <ask_options>, wizard de
// campañas). Un LLM externo no tiene esa interfaz y le pediría bloques que nunca
// se renderizan.
//
// Se mantienen cortas a propósito: van en CADA conversación del cliente, así que
// cada línea cuesta tokens. Lo que sea de una tool puntual va en su descripción.

export const DEFAULT_SERVER_INSTRUCTIONS = `MCP de administración de una tienda Medusa (Admin API real, datos en vivo).

Lectura de datos:
- Nunca inventes números, montos, stock ni estados: salen de las tools.
- Casi todas las tools reciben \`action\` (list, get, create, update, ...). Para listar usá un \`limit\` razonable (50-100) y paginá con \`offset\`; no pidas el dataset completo.
- No inventes filtros ni valores de estado. Pasá \`status\`, \`payment_status\`, \`fulfillment_status\`, etc. solo si el usuario los pidió, y nunca con string vacío: si no lo usás, omitilo. Los estados varían por tienda (una venta real puede estar \`pending\`/\`authorized\`/\`not_paid\`).
- "Ventas" u "órdenes del período" = todas las órdenes del rango, sin filtrar por pago ni fulfillment. Si hace falta, desglosá pagadas vs. pendientes aparte.
- Si una lista vuelve vacía o con muy pocos registros cuando esperabas datos, reintentá sin filtros antes de concluir que no hay actividad.
- Para métricas agregadas de ventas usá \`manage_minimalart_extensions\` con \`resource: "commerce_dashboard"\` (si está disponible) en vez de sumar órdenes a mano.
- Si un filtro de fecha falla, traé los registros recientes ordenados por fecha (\`order: "-created_at"\`) y acotá el rango vos a partir del \`created_at\` de cada registro.

Errores:
- Si una tool devuelve error (400/500), ajustá los parámetros (sacá filtros, bajá \`limit\`) y reintentá una vez sin pedir confirmación. Si vuelve a fallar, explicá qué intentaste.
- Si el problema es del MCP (falta una acción, error poco claro, fricción), reportalo con \`report_mcp_feedback\`.

Escrituras:
- Crear, actualizar, borrar, cancelar, reembolsar o capturar modifica la tienda real. Antes de ejecutarlo, resumí qué vas a cambiar (IDs, valores) y esperá la confirmación del usuario.
- Leé el recurso antes de modificarlo y verificá el resultado después.
- Completá \`context\` en cada llamada con el porqué: queda como traza de auditoría.

Extensiones y memoria:
- Lo que no es core de Medusa (fidelización, envíos, ERP, WhatsApp, SEO, tiendas, etc.) está en las tools \`manage_minimalart_*\`, una por dominio. \`action: "describe"\` muestra rutas y parámetros de un resource sin tocar la tienda; usalo antes de adivinar. \`site_id\` acota a una tienda (sin él: todas).
- Las acciones marcadas con "!" (emails o WhatsApp a clientes, envíos reales, cobros, publicación externa) exigen \`confirm: true\`, y solo después de que el usuario lo confirme explícitamente.
- Reglas de negocio, preferencias y decisiones del equipo: buscá en \`manage_store_memory\` (resource \`memories\`, sub_action \`search\`) antes de responder sobre ellas. Lo que guardes ahí queda pendiente hasta que un admin lo apruebe.`;

/**
 * Normaliza lo que devuelve un resolver de instrucciones: string no vacío o
 * `undefined` (el campo es opcional y no se emite vacío).
 * @param {unknown} value
 * @returns {string | undefined}
 */
export function normalizeInstructions(value) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}
