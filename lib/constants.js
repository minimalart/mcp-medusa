// Shared constants for MCP server
// Centralized configuration reduces memory usage and improves consistency

/**
 * MCP Protocol versions
 * - STDIO transport uses 2024-11-05 for compatibility
 * - HTTP transport prefers 2025-11-25 and keeps 2025-03-26 compatibility
 */
export const MCP_VERSION = '2024-11-05';
export const MCP_SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-03-26'];
export const MCP_VERSION_HTTP = MCP_SUPPORTED_PROTOCOL_VERSIONS[0];

/**
 * Server information
 */
export const SERVER_INFO = {
  name: 'medusa-admin-mcp-server',
  title: 'Medusa Admin',
  version: '1.5.0'
};

/**
 * Capacidades opcionales del handler Streamable HTTP. Quien embebe el paquete
 * (p. ej. el backend del boilerplate) las consulta antes de usarlas, así puede
 * convivir con una versión anterior del paquete sin romper `initialize`.
 * - dynamic-server-info: `serverInfo` puede ser una función `(req) => info`.
 * - instructions: opción `instructions` (string o `(req) => string`).
 * - prompts: opción `prompts` (lista o `(req) => lista`), con `arguments`.
 */
export const HTTP_HANDLER_FEATURES = ['dynamic-server-info', 'instructions', 'prompts'];

/**
 * Server capabilities
 */
export const CAPABILITIES = {
  tools: {},
  prompts: {}
};

/**
 * Performance monitoring configuration
 */
export const PERFORMANCE_CONFIG = {
  TOOL_CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  MAX_REQUEST_SIZE: 10 * 1024 * 1024, // 10MB
  REQUEST_TIMEOUT: 30000, // 30 seconds
  MEMORY_WARNING_THRESHOLD: 100 * 1024 * 1024 // 100MB
};

/**
 * HTTP status codes for consistent responses
 */
export const HTTP_STATUS = {
  OK: 200,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL_SERVER_ERROR: 500
};
