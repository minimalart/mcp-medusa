/**
 * Authentication middleware for MCP HTTP server
 *
 * Implements Bearer token authentication as specified in MCP spec.
 * Uses MCP_AUTH_TOKEN environment variable for validation.
 */

/**
 * Bearer token authentication middleware
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
export function authMiddleware(req, res, next) {
  // Skip auth for health check
  if (req.path === '/health' || req.path === '/ready') {
    return next();
  }

  // Skip auth for OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing Authorization header'
    });
  }

  // Extract Bearer token
  const [scheme, token] = authHeader.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid Authorization header format. Expected: Bearer <token>'
    });
  }

  // Validate token against environment variable
  const expectedToken = process.env.MCP_AUTH_TOKEN;

  if (!expectedToken) {
    console.error('MCP_AUTH_TOKEN environment variable not set');
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Server authentication not configured'
    });
  }

  if (token !== expectedToken) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token'
    });
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, Last-Event-ID');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
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
