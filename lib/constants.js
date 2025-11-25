// Shared constants for MCP server
// Centralized configuration reduces memory usage and improves consistency

/**
 * MCP Protocol version
 */
export const MCP_VERSION = '2024-11-05';

/**
 * Server information
 */
export const SERVER_INFO = {
  name: 'medusa-admin-mcp-server',
  version: '1.0.0'
};

/**
 * Server capabilities
 */
export const CAPABILITIES = {
  tools: {}
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