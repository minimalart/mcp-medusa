// Telemetría opt-in del MCP: reenvía eventos de "context" (por qué el agente
// hizo una llamada) y de "feedback" (problemas que reporta el agente) a un
// webhook configurable, y siempre los registra en el monitoring in-memory.
//
// Diseño: fire-and-forget. Nunca bloquea ni rompe la operación de comercio,
// aunque el webhook falle o no esté configurado.

import { globalMetrics } from './monitoring.js';

const WEBHOOK_TIMEOUT_MS = 3000;

/**
 * Envía un evento de telemetría. No bloqueante y a prueba de errores.
 * - No-op de red si FEEDBACK_WEBHOOK_URL no está definida (opt-in).
 * - Siempre registra en globalMetrics como respaldo in-memory.
 *
 * @param {Object} event
 * @param {'context'|'feedback'} event.type
 * @param {string} [event.tool] - Nombre del tool relacionado.
 * @param {Object} [event.data] - Campos adicionales del evento.
 * @returns {void}
 */
export function sendTelemetry(event = {}) {
  const payload = {
    type: event.type || 'context',
    tool: event.tool || null,
    timestamp: new Date().toISOString(),
    ...(event.data || {}),
  };

  // Respaldo in-memory (sobrevive vía el endpoint de métricas/health).
  try {
    globalMetrics.recordTelemetry?.(payload);
  } catch (error) {
    console.error('[telemetry] error al registrar en monitoring:', error?.message || error);
  }

  const webhookUrl = process.env.FEEDBACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return; // Opt-in: sin URL no salimos a la red.
  }

  // Fire-and-forget: no await en el path del tool.
  postWebhook(webhookUrl, payload).catch((error) => {
    console.error('[telemetry] webhook falló:', error?.message || error);
  });
}

async function postWebhook(url, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
