import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Credencial de Medusa por request.
 *
 * Sin contexto, las tools usan la credencial del entorno (`MEDUSA_API_KEY`,
 * `MEDUSA_JWT`…): es el modo STDIO/standalone. Quien embebe el handler HTTP (el
 * backend del boilerplate) corre cada `tools/call` dentro de `runWithMedusaAuth`
 * con la credencial del USUARIO que llama, así la Admin API aplica sus permisos
 * igual que en la web. Dentro del contexto el entorno no se lee nunca.
 *
 * - `headers`: headers de credencial (p. ej. `{ Authorization: "Bearer <jwt>" }`).
 *   Pisan a cualquier header que arme una tool o que mande el modelo.
 * - `canWrite({ method, url, path })`: se consulta antes de cada request que no sea
 *   GET/HEAD. Devuelve `true` para dejarla salir o un string con el motivo del
 *   rechazo (scope de solo lectura, escrituras apagadas para la tool…).
 */

const storage = new AsyncLocalStorage();

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export class WriteNotAllowedError extends Error {
  constructor(message, { method, path } = {}) {
    super(message);
    this.name = "WriteNotAllowedError";
    this.status = 403;
    this.method = method;
    this.path = path;
  }
}

/**
 * Corre `fn` con la credencial `auth`. Si `auth` es null/undefined corre sin
 * contexto (credencial del entorno).
 * @template T
 * @param {{ headers: Record<string, string>, canWrite?: (req: { method: string, url: string, path: string }) => true | string } | null | undefined} auth
 * @param {() => T} fn
 * @returns {T}
 */
export function runWithMedusaAuth(auth, fn) {
  if (!auth) return fn();
  if (!auth.headers || typeof auth.headers !== "object" || Object.keys(auth.headers).length === 0) {
    throw new Error("runWithMedusaAuth requires credential headers");
  }
  return storage.run(Object.freeze({ ...auth, headers: Object.freeze({ ...auth.headers }) }), fn);
}

/** Credencial del request en curso, o `undefined` fuera de `runWithMedusaAuth`. */
export function currentMedusaAuth() {
  return storage.getStore();
}

/** Lanza `WriteNotAllowedError` si el contexto no deja salir esta escritura. */
export function assertWriteAllowed(method, url) {
  const auth = storage.getStore();
  const verb = String(method || "GET").toUpperCase();
  if (!auth?.canWrite || READ_METHODS.has(verb)) return;
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    // url relativa: se usa tal cual
  }
  const verdict = auth.canWrite({ method: verb, url, path });
  if (verdict === true) return;
  const reason = typeof verdict === "string" && verdict ? verdict : "Write not allowed for this request.";
  throw new WriteNotAllowedError(`${verb} ${path} blocked: ${reason}`, { method: verb, path });
}
