/**
 * Helpers de compatibilidad entre versiones de Medusa.
 *
 * El MCP apunta a Medusa 2.21.1 pero tiene que seguir funcionando contra
 * backends más viejos (el boilerplate corre 2.18.0). Las acciones que usan
 * rutas o campos nuevos se envuelven con estos helpers para que, si la tienda
 * no los soporta, el caller reciba un mensaje claro ("requiere Medusa >= X")
 * en lugar de un 404/400 crudo.
 *
 * - Ruta inexistente: Express responde 404 con "Cannot POST /admin/..." (HTML).
 *   Un 404 de Medusa con `type: "not_found"` significa "el recurso no existe"
 *   (p. ej. un ID inválido) y NO se traduce a mensaje de versión.
 * - Campo inexistente: Medusa valida los bodies con zod `.strict()`, así que un
 *   campo que la versión no conoce devuelve 400 "Unrecognized fields: 'x'".
 */

export const MEDUSA_TARGET_VERSION = "2.21.1";
export const MEDUSA_BASELINE_VERSION = "2.18.0";

function bodyText(error) {
  if (!error) return "";
  if (typeof error.body === "string") return error.body;
  if (error.body && typeof error.body === "object") {
    try {
      return JSON.stringify(error.body);
    } catch {
      return "";
    }
  }
  return "";
}

function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * true cuando el 404 corresponde a una ruta que la tienda no expone (y no a un
 * recurso inexistente).
 */
export function isMissingRouteError(error) {
  if (!error || error.status !== 404) return false;
  const text = bodyText(error);
  if (/Cannot (GET|POST|PUT|PATCH|DELETE) \//i.test(text)) return true;
  const parsed = parseJson(text);
  if (parsed && typeof parsed === "object" && parsed.type === "not_found") {
    return false;
  }
  return true;
}

/**
 * Mensaje estándar para rutas/campos que requieren una versión más nueva.
 * @param {string} minVersion - p. ej. "2.20"
 * @param {Object} [options]
 * @param {string} [options.component="Medusa"] - "Medusa" o el plugin (p. ej. "@medusajs/loyalty-plugin").
 * @param {number} [options.status=404] - status HTTP devuelto por la tienda.
 * @param {string} [options.feature] - campo o feature concreto (para campos gateados).
 */
export function requiresVersionMessage(minVersion, { component = "Medusa", status = 404, feature } = {}) {
  const subject = feature ? `El campo/feature \`${feature}\`` : "Esta acción";
  return `${subject} requiere ${component} >= ${minVersion} (la tienda devolvió ${status}).`;
}

export function unsupportedVersionResult(minVersion, options = {}) {
  const { component = "Medusa", detail } = options;
  return {
    error: requiresVersionMessage(minVersion, options),
    unsupported: true,
    min_version: `${component} ${minVersion}`,
    ...(detail ? { detail } : {}),
  };
}

/**
 * Ejecuta `request` y traduce un 404 de ruta inexistente a un resultado
 * `{ error: "Esta acción requiere Medusa >= X ...", unsupported: true }`.
 * Cualquier otro error se relanza sin cambios.
 */
export async function withMinVersion(minVersion, request, options = {}) {
  try {
    return await request();
  } catch (error) {
    if (isMissingRouteError(error)) {
      return unsupportedVersionResult(minVersion, { ...options, status: 404 });
    }
    throw error;
  }
}

/** Campos que Medusa rechazó por no conocerlos (400 "Unrecognized fields"). */
export function unrecognizedFields(error) {
  if (!error || error.status !== 400) return [];
  const text = `${bodyText(error)} ${error.message || ""}`;
  const fields = new Set();
  for (const match of text.matchAll(/Unrecognized (?:fields|keys?)\s*:?\s*'([^']+)'/gi)) {
    match[1]
      .split(",")
      .map((field) => field.trim())
      .filter(Boolean)
      .forEach((field) => fields.add(field));
  }
  return [...fields];
}

/**
 * Filtra el mapa de campos gateados a los que efectivamente se enviaron.
 * @param {Object} payload - body enviado
 * @param {Object<string,string>} gatedFields - { campo: versionMinima }
 */
export function sentGatedFields(payload, gatedFields) {
  const sent = {};
  if (!payload || typeof payload !== "object") return sent;
  for (const [field, minVersion] of Object.entries(gatedFields || {})) {
    if (payload[field] !== undefined) sent[field] = minVersion;
  }
  return sent;
}

/**
 * Ejecuta `request` y, si la tienda rechaza con 400 alguno de los campos
 * gateados que se enviaron, devuelve un mensaje de versión mínima.
 * @param {Object<string,string>} gatedFields - { campo: versionMinima } (sólo los enviados)
 */
export async function withGatedFields(gatedFields, request, options = {}) {
  try {
    return await request();
  } catch (error) {
    const rejected = unrecognizedFields(error);
    const gated = rejected.filter((field) => gatedFields && gatedFields[field]);
    if (gated.length > 0) {
      const minVersion = gated
        .map((field) => gatedFields[field])
        .sort((a, b) => compareVersions(b, a))[0];
      return unsupportedVersionResult(minVersion, {
        ...options,
        status: 400,
        feature: gated.join(", "),
        detail: `Quitá ${gated.map((field) => `\`${field}\``).join(", ")} del request o actualizá la tienda.`,
      });
    }
    throw error;
  }
}

export function compareVersions(a, b) {
  const pa = String(a).split(".").map((part) => Number.parseInt(part, 10) || 0);
  const pb = String(b).split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

const MFA_RE = /MFA verification is required|MFA was verified too long ago/i;
const BEARER_SECRET_KEY_RE = /secret API key was passed as a Bearer token/i;

/**
 * Pista legible para errores de autenticación conocidos de Medusa.
 * - 2.20+: un JWT/sesión de un usuario con MFA activo sin challenge completo
 *   devuelve 401 "MFA verification is required to complete this request".
 */
export function authErrorHint(text) {
  const value = String(text || "");
  if (MFA_RE.test(value)) {
    return (
      "La tienda exige MFA para este usuario (Medusa >= 2.20 rechaza JWT/sesiones de usuarios con MFA activo " +
      "que no completaron el challenge). Completá el challenge (POST /auth/mfa/challenges/{id}/verify) y usá el " +
      "token resultante, o configurá el MCP con una secret API key (MEDUSA_AUTH_TYPE=api-key), que no pasa por MFA."
    );
  }
  if (BEARER_SECRET_KEY_RE.test(value)) {
    return "La secret API key se envió como Bearer. Configurá MEDUSA_AUTH_TYPE=api-key para mandarla como HTTP Basic.";
  }
  return null;
}

/**
 * Envuelve la función de un tool para agregar pistas a errores de auth
 * conocidos (MFA, API key como Bearer), tanto si el tool devuelve
 * `{ error }` como si lanza. No cambia el comportamiento en ningún otro caso.
 */
export function withMedusaErrorHints(fn) {
  return async function medusaToolWithHints(args) {
    try {
      const result = await fn(args);
      if (result && typeof result === "object" && typeof result.error === "string" && !result.hint) {
        const hint = authErrorHint(result.error);
        if (hint) return { ...result, hint };
      }
      return result;
    } catch (error) {
      const hint = authErrorHint(`${error?.message || ""} ${bodyText(error)}`);
      if (hint && error && typeof error === "object" && !String(error.message || "").includes(hint)) {
        try {
          error.message = `${error.message}\n${hint}`;
          error.hint = hint;
        } catch {
          // mensaje no escribible: relanzar tal cual
        }
      }
      throw error;
    }
  };
}
