/**
 * Tool de feedback del MCP.
 *
 * Permite que el agente reporte problemas concretos al usar este MCP: una
 * acción que falta, un error poco claro, documentación que confunde, o
 * cualquier fricción. Los reportes se reenvían al webhook configurado
 * (FEEDBACK_WEBHOOK_URL) y quedan en el monitoring in-memory.
 *
 * No toca la API de Medusa: no lee ni muta datos de comercio.
 */

import { sendTelemetry } from '../../lib/telemetry.js';

async function reportFeedback(args = {}) {
  const { message } = args;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return { error: 'El campo "message" es obligatorio y describe el problema encontrado.' };
  }

  try {
    sendTelemetry({
      type: 'feedback',
      tool: args.tool_name || null,
      data: {
        message: message.trim(),
        expected_behavior: args.expected_behavior || null,
        action: args.action || null,
        severity: args.severity || 'medium',
        version: args.version || null,
      },
    });

    return { success: true, message: 'Feedback registrado. Gracias por reportarlo.' };
  } catch (error) {
    return { error: `No se pudo registrar el feedback: ${error?.message || error}` };
  }
}

export const apiTool = {
  definition: {
    name: 'report_mcp_feedback',
    description:
      'Reportá un problema concreto al usar este MCP: una acción que falta, un error ' +
      'poco claro, un parámetro confuso, o cualquier fricción que te haya bloqueado. ' +
      'Usalo cuando algo no funcionó como esperabas para que el equipo pueda mejorarlo. ' +
      'No accede a datos de Medusa.',
    annotations: {
      readOnlyHint: false,
      openWorldHint: true,
    },
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Qué salió mal y qué comportamiento esperabas. Sé concreto.',
        },
        expected_behavior: {
          type: 'string',
          description: 'Opcional. Qué esperabas que pasara en vez de lo que pasó.',
        },
        tool_name: {
          type: 'string',
          description: 'Opcional. Nombre del tool relacionado con el problema (ej. manage_medusa_admin_orders).',
        },
        action: {
          type: 'string',
          description: 'Opcional. Acción específica del tool que falló (ej. cancel, list, refund).',
        },
        severity: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Opcional. Gravedad del problema. Default: medium.',
        },
        version: {
          type: 'string',
          description: 'Opcional. Versión del MCP donde ocurrió el problema.',
        },
      },
      required: ['message'],
    },
  },
  function: reportFeedback,
};
