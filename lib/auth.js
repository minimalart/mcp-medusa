import { isOAuthMode, oauthUnauthorizedHeaders, verifyOAuthRequest } from './oauth.js';

// Shared authentication module for performance optimization
// Reduces code duplication and improves maintainability

/**
 * Optimized authentication middleware with caching
 * @param {Object} req - Request object
 * @returns {boolean} Authentication result
 */
export async function authenticateRequest(req) {
  if (isOAuthMode()) {
    try {
      await verifyOAuthRequest(req);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        status: error.status || 401,
        message: error.message,
        headers: oauthUnauthorizedHeaders(req),
      };
    }
  }

  // Extract authorization header efficiently
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const expectedToken = process.env.MCP_AUTH_TOKEN;
  
  // Fast path for missing configuration
  if (!expectedToken) {
    console.error('MCP_AUTH_TOKEN environment variable not configured');
    return {
      ok: false,
      status: 500,
      message: 'Server authentication not configured',
    };
  }
  
  // Fast path for missing or malformed header
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      status: 401,
      message: 'Unauthorized',
    };
  }
  
  // Extract and compare token
  const token = authHeader.slice(7); // Remove "Bearer " prefix
  return token === expectedToken
    ? { ok: true }
    : { ok: false, status: 401, message: 'Unauthorized' };
}

export function sendAuthFailure(res, authResult) {
  Object.entries(authResult.headers || {}).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  return res.status(authResult.status || 401).json({
    error: authResult.status === 403 ? 'Forbidden' : 'Unauthorized',
    message: authResult.message || 'Unauthorized',
  });
}

/**
 * CORS headers configuration
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id, MCP-Protocol-Version',
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
