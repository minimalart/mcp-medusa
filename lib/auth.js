// Shared authentication module for performance optimization
// Reduces code duplication and improves maintainability

/**
 * Optimized authentication middleware with caching
 * @param {Object} req - Request object
 * @returns {boolean} Authentication result
 */
export function authenticateRequest(req) {
  // Extract authorization header efficiently
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const expectedToken = process.env.MCP_AUTH_TOKEN;
  
  // Fast path for missing configuration
  if (!expectedToken) {
    console.error('MCP_AUTH_TOKEN environment variable not configured');
    return false;
  }
  
  // Fast path for missing or malformed header
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  // Extract and compare token
  const token = authHeader.slice(7); // Remove "Bearer " prefix
  return token === expectedToken;
}

/**
 * CORS headers configuration
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

/**
 * Handle CORS preflight requests efficiently
 * @param {Object} res - Response object
 */
export function handleCorsOptions(res) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  return res.status(204).end();
}

/**
 * Apply CORS headers to response
 * @param {Object} res - Response object
 */
export function applyCorsHeaders(res) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}