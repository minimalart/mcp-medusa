import { Buffer } from "buffer";

const DEFAULT_MEDUSA_BASE_URL = "http://localhost:9000";

export class MedusaClientError extends Error {
  constructor(message, { status, body, url } = {}) {
    super(message);
    this.name = "MedusaClientError";
    this.status = status;
    this.body = body;
    this.url = url;
  }
}

export function normalizeBaseUrl(url = DEFAULT_MEDUSA_BASE_URL) {
  return String(url || DEFAULT_MEDUSA_BASE_URL).replace(/\/+$/, "");
}

export function getMedusaAuthConfig(env = process.env) {
  const authType = (env.MEDUSA_AUTH_TYPE || "api-key").toLowerCase();
  const apiKey = env.MEDUSA_API_KEY;
  const jwt = env.MEDUSA_JWT || env.MEDUSA_API_KEY;
  const sessionCookie = env.MEDUSA_SESSION_COOKIE || env.MEDUSA_COOKIE;

  return {
    authType,
    apiKey,
    jwt,
    sessionCookie,
    encodeApiKey: String(env.MEDUSA_API_KEY_BASE64 || "").toLowerCase() === "true",
  };
}

export function createHeaders(_legacyApiKey, extraHeaders = {}) {
  const config = getMedusaAuthConfig();
  const headers = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  if (config.authType === "jwt") {
    if (!config.jwt) {
      throw new Error("MEDUSA_JWT or MEDUSA_API_KEY is required when MEDUSA_AUTH_TYPE=jwt");
    }
    headers.Authorization = `Bearer ${config.jwt.replace(/^Bearer\s+/i, "")}`;
    return headers;
  }

  if (config.authType === "session") {
    if (!config.sessionCookie) {
      throw new Error("MEDUSA_SESSION_COOKIE is required when MEDUSA_AUTH_TYPE=session");
    }
    headers.Cookie = config.sessionCookie;
    return headers;
  }

  if (config.authType !== "api-key") {
    throw new Error("MEDUSA_AUTH_TYPE must be one of: api-key, jwt, session");
  }

  if (!config.apiKey) {
    throw new Error("MEDUSA_API_KEY is required when MEDUSA_AUTH_TYPE=api-key");
  }

  const token = config.encodeApiKey
    ? Buffer.from(`${config.apiKey}:`).toString("base64")
    : config.apiKey;
  headers.Authorization = `Basic ${token.replace(/^Basic\s+/i, "")}`;
  return headers;
}

export function appendQueryParam(params, key, value) {
  if (value === undefined || value === null || value === "") return;

  if (Array.isArray(value)) {
    value.forEach((entry) => appendQueryParam(params, `${key}[]`, entry));
    return;
  }

  if (value instanceof Date) {
    params.append(key, value.toISOString());
    return;
  }

  if (typeof value === "object") {
    Object.entries(value).forEach(([childKey, childValue]) => {
      appendQueryParam(params, `${key}[${childKey}]`, childValue);
    });
    return;
  }

  params.append(key, String(value));
}

export function createQueryParams(query = {}, { exclude = [] } = {}) {
  const params = new URLSearchParams();
  const excluded = new Set(exclude);

  Object.entries(query).forEach(([key, value]) => {
    if (!excluded.has(key)) {
      appendQueryParam(params, key, value);
    }
  });

  return params;
}

export function buildMedusaUrl(path, query = {}, options = {}) {
  const baseUrl = normalizeBaseUrl(process.env.MEDUSA_BASE_URL);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`);
  const params = createQueryParams(query, options);

  for (const [key, value] of params.entries()) {
    url.searchParams.append(key, value);
  }

  return url.toString();
}

export async function makeRequest(url, options = {}) {
  const headers = {
    ...createHeaders(),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const bodyText = await response.text();

  if (!response.ok) {
    throw new MedusaClientError(`HTTP ${response.status}: ${bodyText}`, {
      status: response.status,
      body: bodyText,
      url,
    });
  }

  if (!bodyText || response.status === 204) {
    return {};
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return JSON.parse(bodyText);
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    return bodyText;
  }
}

// ─── Respuestas no-JSON (binarios, CSV, texto) ────────────────────────────────
//
// `makeRequest` devuelve el cuerpo crudo como string cuando no es JSON. Para PDFs,
// ZIPs o imágenes eso vuelca bytes ilegibles al modelo (y miles de tokens). Las
// funciones de abajo son ADITIVAS: `makeRequest` no cambia; las tools que pueden
// recibir descargas usan `makeBinarySafeRequest`, que resume lo no-JSON.

const JSON_CONTENT_TYPE_RE = /^application\/([\w.+-]*\+)?json\b/i;
const CSV_CONTENT_TYPE_RE = /^(text\/csv|application\/csv|text\/tab-separated-values)\b/i;
const TEXT_CONTENT_TYPE_RE = /^(text\/|application\/(xml|[\w.+-]*\+xml|javascript|x-ndjson)\b)/i;
const EVENT_STREAM_RE = /^text\/event-stream\b/i;
const SAFE_META_HEADER_RE = /^x-[\w-]*(total|truncated|count|matched)[\w-]*$/i;

export const DEFAULT_RESPONSE_LIMITS = Object.freeze({
  maxTextChars: 4000,
  csvPreviewRows: 20,
  maxErrorChars: 4000,
});

/**
 * Extrae el filename de un header Content-Disposition (RFC 6266, con o sin
 * `filename*=UTF-8''...`). Devuelve null si no hay.
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
export function parseContentDispositionFilename(value) {
  if (!value || typeof value !== "string") return null;
  const star = value.match(/filename\*\s*=\s*(?:UTF-8|utf-8)?''([^;]+)/);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      return star[1].trim();
    }
  }
  const plain = value.match(/filename\s*=\s*("([^"]*)"|[^;]+)/i);
  if (!plain) return null;
  return (plain[2] ?? plain[1]).trim() || null;
}

function metaHeadersOf(headers) {
  const out = {};
  if (!headers || typeof headers.forEach !== "function") return out;
  headers.forEach((value, key) => {
    if (SAFE_META_HEADER_RE.test(key)) out[key.toLowerCase()] = value;
  });
  return out;
}

function truncateText(text, max) {
  if (typeof text !== "string") return { text: "", truncated: false };
  if (text.length <= max) return { text, truncated: false };
  return { text: text.slice(0, max), truncated: true };
}

/**
 * Resume un cuerpo no-JSON para que el modelo reciba metadatos útiles en vez de
 * bytes: binarios → tipo/tamaño/filename; CSV → primeras filas; texto → recortado.
 * Si el texto resulta ser JSON válido (servers que no mandan content-type), se
 * parsea igual que en `makeRequest`.
 *
 * @param {{ contentType?: string, buffer: Uint8Array | ArrayBuffer, headers?: Headers, status?: number }} input
 * @param {{ maxTextChars?: number, csvPreviewRows?: number }} [limits]
 * @returns {unknown}
 */
export function summarizeResponseBody(input, limits = {}) {
  const { maxTextChars, csvPreviewRows } = { ...DEFAULT_RESPONSE_LIMITS, ...limits };
  const contentType = String(input?.contentType || "").trim();
  const bytes = input?.buffer instanceof Uint8Array ? input.buffer : new Uint8Array(input?.buffer || new ArrayBuffer(0));
  const size = bytes.byteLength;
  const filename = parseContentDispositionFilename(input?.headers?.get?.("content-disposition"));
  const meta = metaHeadersOf(input?.headers);
  const base = {
    content_type: contentType || null,
    size_bytes: size,
    ...(filename ? { filename } : {}),
    ...(Object.keys(meta).length ? { headers: meta } : {}),
  };

  if (size === 0) return {};

  if (EVENT_STREAM_RE.test(contentType)) {
    return { ...base, streaming: true, note: "Streaming (SSE) responses are not supported through MCP." };
  }

  const isCsv = CSV_CONTENT_TYPE_RE.test(contentType);
  const isJson = JSON_CONTENT_TYPE_RE.test(contentType);
  const isText = isCsv || isJson || TEXT_CONTENT_TYPE_RE.test(contentType) || contentType === "";

  if (!isText) {
    return { ...base, binary: true };
  }

  let text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  if (!isCsv) {
    try {
      return JSON.parse(text);
    } catch {
      // No es JSON: se trata como texto (o binario si no tenía content-type y no se lee).
    }
    // Sin content-type y con bytes de control → binario sin declarar.
    // eslint-disable-next-line no-control-regex
    if (contentType === "" && /[\u0000-\u0008\u000e-\u001f]/.test(text.slice(0, 512))) {
      return { ...base, binary: true };
    }
    const { text: preview, truncated } = truncateText(text, maxTextChars);
    return { ...base, text: preview, truncated };
  }

  const rows = text.split(/\r?\n/);
  while (rows.length && rows[rows.length - 1] === "") rows.pop();
  const previewRows = rows.slice(0, Math.max(1, csvPreviewRows + 1)); // encabezado + N filas
  const joined = previewRows.join("\n");
  const { text: preview, truncated: charTruncated } = truncateText(joined, maxTextChars);
  return {
    ...base,
    format: "csv",
    total_rows: Math.max(0, rows.length - 1),
    preview,
    truncated: charTruncated || rows.length > previewRows.length,
  };
}

/**
 * Igual que `makeRequest` (mismos headers, mismo `MedusaClientError` en HTTP no-2xx
 * y mismo resultado para JSON), pero seguro para descargas: los cuerpos no-JSON
 * se resumen con `summarizeResponseBody` en vez de devolverse crudos.
 *
 * @param {string} url
 * @param {RequestInit} [options]
 * @param {{ maxTextChars?: number, csvPreviewRows?: number, maxErrorChars?: number }} [limits]
 */
export async function makeBinarySafeRequest(url, options = {}, limits = {}) {
  const { maxErrorChars } = { ...DEFAULT_RESPONSE_LIMITS, ...limits };
  const headers = {
    ...createHeaders(),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const buffer = new Uint8Array(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    const bodyText = raw.length > maxErrorChars ? `${raw.slice(0, maxErrorChars)}…` : raw;
    throw new MedusaClientError(`HTTP ${response.status}: ${bodyText}`, {
      status: response.status,
      body: bodyText,
      url,
    });
  }

  if (buffer.byteLength === 0 || response.status === 204) {
    return {};
  }

  return summarizeResponseBody({ contentType, buffer, headers: response.headers, status: response.status }, limits);
}

export function hasMedusaCredentials(env = process.env) {
  const { authType, apiKey, jwt, sessionCookie } = getMedusaAuthConfig(env);
  if (authType === "jwt") return Boolean(jwt);
  if (authType === "session") return Boolean(sessionCookie);
  return Boolean(apiKey);
}

export function missingCredentialsMessage(env = process.env) {
  const { authType } = getMedusaAuthConfig(env);
  if (authType === "jwt") {
    return "Medusa credentials not configured. Please set MEDUSA_AUTH_TYPE=jwt and MEDUSA_JWT or MEDUSA_API_KEY.";
  }
  if (authType === "session") {
    return "Medusa credentials not configured. Please set MEDUSA_AUTH_TYPE=session and MEDUSA_SESSION_COOKIE.";
  }
  return "Medusa credentials not configured. Please set MEDUSA_BASE_URL and MEDUSA_API_KEY environment variables.";
}
