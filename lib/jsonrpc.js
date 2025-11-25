// JSON-RPC utilities optimized for performance
// Centralized JSON-RPC handling with minimal overhead

/**
 * Create JSON-RPC response efficiently
 * @param {string|number} id - Request ID
 * @param {*} result - Response result
 * @returns {Object} JSON-RPC response
 */
export function createJsonRpcResponse(id, result) {
  return {
    jsonrpc: '2.0',
    id,
    result
  };
}

/**
 * Create JSON-RPC error response efficiently
 * @param {string|number} id - Request ID
 * @param {number} code - Error code
 * @param {string} message - Error message
 * @param {*} [data] - Additional error data
 * @returns {Object} JSON-RPC error response
 */
export function createJsonRpcError(id, code, message, data = null) {
  const error = { code, message };
  if (data !== null) {
    error.data = data;
  }
  return {
    jsonrpc: '2.0',
    id,
    error
  };
}

/**
 * Parse JSON-RPC request with validation
 * @param {Object} req - Request object
 * @returns {Object} Parsed JSON-RPC request
 */
export function parseJsonRpcRequest(req) {
  const body = req.body;
  
  // Handle different body formats efficiently
  const parsedBody = typeof body === 'string' ? JSON.parse(body) : body;
  
  if (!parsedBody.jsonrpc || parsedBody.jsonrpc !== '2.0') {
    throw new Error('Invalid JSON-RPC version');
  }
  
  return parsedBody;
}

/**
 * Common JSON-RPC error codes for consistency
 */
export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603
};

/**
 * Standard error messages
 */
export const ERROR_MESSAGES = {
  PARSE_ERROR: 'Parse error',
  INVALID_REQUEST: 'Invalid Request',
  METHOD_NOT_FOUND: 'Method not found',
  INVALID_PARAMS: 'Invalid params',
  INTERNAL_ERROR: 'Internal error',
  UNAUTHORIZED: 'Unauthorized',
  METHOD_NOT_ALLOWED: 'Method not allowed'
};