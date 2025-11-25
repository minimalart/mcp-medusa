// Optimized MCP Capabilities Endpoint - GET /api/mcp/capabilities
// Returns server capabilities and information with performance optimizations

import dotenv from 'dotenv';
import { authenticateRequest, applyCorsHeaders, handleCorsOptions } from '../../lib/auth.js';
import { SERVER_INFO, CAPABILITIES, MCP_VERSION, HTTP_STATUS } from '../../lib/constants.js';
import { withPerformanceMonitoring } from '../../lib/performance.js';

// Initialize environment once
dotenv.config();

// Pre-compute the capabilities response to avoid repeated object creation
const CAPABILITIES_RESPONSE = {
  server: SERVER_INFO,
  capabilities: CAPABILITIES,
  protocolVersion: MCP_VERSION,
  transport: 'http'
};

// Freeze the response object to prevent mutations and enable V8 optimizations
Object.freeze(CAPABILITIES_RESPONSE);
Object.freeze(CAPABILITIES_RESPONSE.server);
Object.freeze(CAPABILITIES_RESPONSE.capabilities);

async function capabilitiesHandler(req, res) {
  // Apply CORS headers efficiently
  applyCorsHeaders(res);
  
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsOptions(res);
  }
  
  // Fast path for non-GET methods
  if (req.method !== 'GET') {
    return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({ error: 'Method not allowed' });
  }
  
  // Authenticate request
  if (!authenticateRequest(req)) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Unauthorized' });
  }
  
  // Return pre-computed capabilities response
  return res.status(HTTP_STATUS.OK).json(CAPABILITIES_RESPONSE);
}

// Export handler with performance monitoring
export default withPerformanceMonitoring('capabilities', capabilitiesHandler);