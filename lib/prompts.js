// Prompts MCP (`prompts/list` / `prompts/get`). Los clientes los muestran como
// comandos (en claude.ai / Claude Desktop, el menú "/"), con un formulario para
// los `arguments`. Son el equivalente a una "skill" que viaja con el MCP.
//
// Dos juegos:
// - OPERATOR_PROMPTS: tareas de quien OPERA la tienda (ventas, catálogo,
//   clientes, órdenes, promociones, campañas, memoria). Portados de las skills
//   del Asistente IA del backoffice (`SKILL_PROMPTS` en
//   `apps/backend/src/modules/ai-assistant/ai/prompt.ts` del boilerplate).
// - DEVELOPER_PROMPTS: tareas de quien DESARROLLA sobre Medusa. Útiles en
//   Claude Code, ruido para un operador en claude.ai.
//
// `MCP_PROMPTS` (los dos) es el default del paquete. Quien embebe el handler
// puede publicar solo uno de los juegos (opción `prompts`).

/** Nombre de la tool de memoria de la tienda (la declara `tools/`). */
export const STORE_MEMORY_TOOL = 'manage_store_memory';
/** Cómo se busca en ella, para citarlo en textos que lee el modelo. */
export const STORE_MEMORY_SEARCH = `\`${STORE_MEMORY_TOOL}\` (resource \`memories\`, sub_action \`search\`)`;

export const OPERATOR_PROMPTS = [
  {
    name: 'resumen_ventas',
    title: 'Resumen de ventas',
    description: 'Ventas, órdenes y ticket promedio de un período, comparado con el anterior.',
    arguments: [
      {
        name: 'periodo',
        description: 'Período a analizar, p. ej. "últimos 30 días", "septiembre 2026", "esta semana".',
        required: false,
        default: 'los últimos 30 días',
      },
    ],
    text:
      'Armá un resumen de ventas de {{periodo}}, comparado con el período anterior de igual duración. ' +
      'Para los totales usá las métricas agregadas (`manage_minimalart_extensions`, resource `commerce_dashboard`); ' +
      'si no están disponibles, listá TODAS las órdenes del rango sin filtrar por estado y sumá vos. ' +
      'Incluí: ventas, cantidad de órdenes, ticket promedio, pagadas vs. pendientes, y los productos más vendidos. ' +
      'Cerrá con 2 o 3 lecturas accionables fundamentadas en las cifras. No modifiques nada.',
  },
  {
    name: 'salud_catalogo',
    title: 'Salud del catálogo',
    description: 'Productos sin stock, sin imagen, sin precio o en borrador.',
    arguments: [
      {
        name: 'alcance',
        description: 'Colección, categoría o marca a revisar. Vacío = todo el catálogo.',
        required: false,
        default: 'todo el catálogo',
      },
    ],
    text:
      'Revisá la salud de {{alcance}}. Buscá productos publicados sin stock disponible, sin imagen, sin precio ' +
      'en la región principal, variantes sin SKU, y productos en borrador que parezcan listos para publicar. ' +
      'Paginá con `limit`/`offset`; no pidas el catálogo entero de una vez. ' +
      'Devolvé una lista priorizada (qué arreglar primero y por qué) con el ID de cada producto. No modifiques nada: ' +
      'si el usuario quiere corregir algo, proponé el cambio concreto y esperá su confirmación.',
  },
  {
    name: 'clientes_clave',
    title: 'Clientes clave y en riesgo',
    description: 'Mejores clientes, recompra y clientes que dejaron de comprar.',
    arguments: [
      {
        name: 'periodo',
        description: 'Ventana para medir actividad, p. ej. "últimos 90 días".',
        required: false,
        default: 'los últimos 90 días',
      },
    ],
    text:
      'Analizá los clientes en {{periodo}}: los de mayor facturación, la tasa de recompra, clientes nuevos, ' +
      'y los que compraban seguido y dejaron de hacerlo. Si hay grupos de clientes, desglosá por grupo. ' +
      'Proponé una acción de retención concreta por segmento (sin crear nada). ' +
      'No muestres datos personales que no hagan falta para la decisión.',
  },
  {
    name: 'ordenes_pendientes',
    title: 'Órdenes que requieren atención',
    description: 'Pagos pendientes, envíos demorados, devoluciones y cancelaciones recientes.',
    arguments: [
      {
        name: 'dias',
        description: 'Antigüedad mínima en días para considerar una orden demorada.',
        required: false,
        default: '3',
      },
    ],
    text:
      'Listá las órdenes que requieren atención: pago pendiente, sin despachar hace más de {{dias}} días, ' +
      'con devoluciones o reclamos abiertos, y cancelaciones recientes. Traé las órdenes recientes ordenadas por ' +
      'fecha y clasificalas vos por estado (no inventes valores de estado para filtrar). ' +
      'Agrupá por tipo de problema, con el número de orden y la acción sugerida. No ejecutes cambios.',
  },
  {
    name: 'revisar_promociones',
    title: 'Revisar promociones',
    description: 'Promociones y campañas activas, su uso e impacto.',
    arguments: [],
    text:
      'Revisá las promociones y campañas activas o programadas: tipo, alcance, vigencia, límites de uso y cuánto ' +
      'se usaron. Marcá las que están por vencer, las que no se usan y las que se superponen. ' +
      'Si recomendás un cambio, indicá objetivo, límite, segmento, duración y métrica de control, y esperá la ' +
      'confirmación del usuario antes de modificar nada.',
  },
  {
    name: 'planificar_campania',
    title: 'Planificar una campaña comercial',
    description: 'Arma una propuesta de campaña (promoción, productos, banner, nota) para aprobar.',
    arguments: [
      {
        name: 'objetivo',
        description: 'Qué se quiere lograr, p. ej. "liquidar stock de invierno", "Día de la Madre".',
        required: true,
      },
      {
        name: 'fechas',
        description: 'Vigencia deseada, p. ej. "del 10 al 20 de octubre".',
        required: false,
        default: 'a definir',
      },
    ],
    text:
      'Planificá una campaña comercial. Objetivo: {{objetivo}}. Fechas: {{fechas}}. ' +
      'Antes de proponer, buscá en la memoria de la tienda (' + STORE_MEMORY_SEARCH + ') reglas ' +
      'de negocio, guías de marca y aprendizajes de campañas anteriores, y revisá ventas y stock de los productos ' +
      'candidatos. Proponé: productos, tipo y monto de promoción, público, piezas (banner, nota de blog, landing) y ' +
      'cómo medir el resultado. Presentá la propuesta completa y NO crees nada hasta que el usuario la apruebe; ' +
      'después creá cada pieza verificando el resultado.',
  },
  {
    name: 'recordar_en_la_tienda',
    title: 'Guardar en la memoria de la tienda',
    description: 'Guarda una regla, decisión o preferencia para que el asistente la tenga en cuenta.',
    arguments: [
      {
        name: 'contenido',
        description: 'Qué hay que recordar, p. ej. "Nunca hacer descuentos mayores al 30% en pinturas".',
        required: true,
      },
    ],
    text:
      'Guardá esto en la memoria de la tienda: "{{contenido}}". Primero buscá con ' + STORE_MEMORY_SEARCH + ' ' +
      'si ya existe algo equivalente o contradictorio; si existe, mostráselo al usuario y preguntá si ' +
      'actualizarlo. Elegí el `memory_type` que corresponda (business_rule, brand_guideline, operational_policy, ' +
      'preference, decision, faq…), un título corto y una importancia acorde, y guardalo (resource `memories`, ' +
      'action `create`). Queda en estado pendiente hasta que ' +
      'un administrador lo apruebe en el backoffice: decíselo al usuario.',
  },
];

export const DEVELOPER_PROMPTS = [
  {
    name: 'medusa_upgrade_project',
    title: 'Upgrade a Medusa Project',
    description:
      'Plan and execute a Medusa version upgrade with dependency, migration, and MCP compatibility checks.',
    arguments: [],
    text:
      'Audit this Medusa project upgrade. Check package versions, API changes, migrations, admin customizations, MCP tool coverage, auth, and validation commands. Return a concise risk-ranked plan before changing code.',
  },
  {
    name: 'medusa_global_product_options',
    title: 'Manage Product Options',
    description: 'Work with Medusa 2.16+ reusable product options and product option linking.',
    arguments: [],
    text:
      'Use the product option tools to inspect reusable options, link them to products, and create or update product options. Prefer read actions first. For writes, state the product_id, option_id, title, values, and is_exclusive behavior before executing.',
  },
  {
    name: 'medusa_integrate_payment_provider',
    title: 'Integrate Payment Provider',
    description: 'Guide implementation of a Medusa payment provider integration.',
    arguments: [],
    text:
      'Help integrate a Medusa payment provider. Inspect existing payment modules, region configuration, environment variables, webhook needs, and test strategy. Produce implementation steps and verification commands.',
  },
  {
    name: 'medusa_integrate_fulfillment_provider',
    title: 'Integrate Fulfillment Provider',
    description: 'Guide implementation of a Medusa fulfillment provider integration.',
    arguments: [],
    text:
      'Help integrate a Medusa fulfillment provider. Inspect fulfillment modules, stock locations, shipping options, environment variables, and operational constraints. Produce implementation steps and verification commands.',
  },
];

export const MCP_PROMPTS = [...OPERATOR_PROMPTS, ...DEVELOPER_PROMPTS];

export function getMcpPrompt(name, prompts = MCP_PROMPTS) {
  return prompts.find((prompt) => prompt.name === name);
}

/** Forma pública de un prompt para `prompts/list` (sin `text` ni `default`). */
export function describePrompt({ name, title, description, arguments: args = [] }) {
  return {
    name,
    title,
    description,
    ...(args.length > 0
      ? {
          arguments: args.map(({ name: argName, description: argDescription, required }) => ({
            name: argName,
            description: argDescription,
            required: Boolean(required),
          })),
        }
      : {}),
  };
}

/**
 * Texto final de un prompt con sus argumentos. Un argumento requerido que falta es
 * un error de parámetros (-32602); uno opcional vacío toma su `default`.
 */
export function renderPrompt(prompt, provided = {}) {
  const values = {};
  for (const arg of prompt.arguments || []) {
    const raw = provided?.[arg.name];
    const value = typeof raw === 'string' ? raw.trim() : raw == null ? '' : String(raw);
    if (!value && arg.required) {
      const error = new Error(`Missing required prompt argument: ${arg.name}`);
      error.code = -32602;
      throw error;
    }
    values[arg.name] = value || arg.default || '';
  }
  return prompt.text.replace(/\{\{(\w+)\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match,
  );
}
