/**
 * Authentication middleware for MCP HTTP server
 *
 * Implements Bearer token authentication as specified in MCP spec.
 * Uses MCP_AUTH_TOKEN or OAuth 2.1 access tokens depending on MCP_AUTH_MODE.
 */
import { authenticateRequest, sendAuthFailure } from '../../lib/auth.js';

/**
 * Bearer token authentication middleware
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
export async function authMiddleware(req, res, next) {
  // Skip auth for health check
  if (req.path === '/health' || req.path === '/ready') {
    return next();
  }

  // Skip auth for OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return next();
  }

  const authResult = await authenticateRequest(req);
  if (!authResult.ok) {
    return sendAuthFailure(res, authResult);
  }

  // Token is valid
  next();
}

/**
 * CORS middleware for MCP HTTP server
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
export function corsMiddleware(req, res, next) {
  // Allow all origins (can be restricted in production)
  const origin = req.headers.origin || '*';

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id, MCP-Protocol-Version');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
}

/**
 * Request logging middleware
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
export function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'error' : 'info';

    console[logLevel](`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });

  next();
}
