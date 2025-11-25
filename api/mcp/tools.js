// Optimized MCP Tools Endpoint - POST /api/mcp/tools
// Handles tool listing and tool execution with performance optimizations

import { discoverTools, transformToolsToMcp, executeToolOptimized } from '../../lib/tools.js';
import { authenticateRequest, applyCorsHeaders, handleCorsOptions } from '../../lib/auth.js';
import { createJsonRpcResponse, createJsonRpcError, parseJsonRpcRequest, JSON_RPC_ERRORS } from '../../lib/jsonrpc.js';
import { HTTP_STATUS } from '../../lib/constants.js';
import { withPerformanceMonitoring, PerformanceTimer } from '../../lib/performance.js';
import dotenv from 'dotenv';

// Initialize environment once
dotenv.config();

// Method handlers for better code organization and performance
const methodHandlers = {
  'tools/list': async (id, params, tools) => {
    const timer = new PerformanceTimer('tools/list transformation');
    const mcpTools = transformToolsToMcp(tools);
    timer.endAndLog(false); // Only log if slow
    return createJsonRpcResponse(id, { tools: mcpTools });
  },
  
  'tools/call': async (id, params, tools) => {
    const { name, arguments: args = {} } = params;
    
    if (!name) {
      return createJsonRpcError(id, JSON_RPC_ERRORS.INVALID_PARAMS, 'Missing tool name');
    }
    
    const timer = new PerformanceTimer(`Tool execution: ${name}`);
    try {
      const result = await executeToolOptimized(tools, name, args);
      const duration = timer.end();
      
      // Log slow tool executions
      if (duration > 2000) {
        console.log(`Slow tool execution: ${name} took ${duration.toFixed(2)}ms`);
      }
      
      return createJsonRpcResponse(id, result);
    } catch (error) {
      timer.end();
      throw error;
    }
  }
};

async function toolsHandler(req, res) {
  // Apply CORS headers efficiently
  applyCorsHeaders(res);
  
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsOptions(res);
  }
  
  // Fast path for non-POST methods
  if (req.method !== 'POST') {
    return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED)
      .json(createJsonRpcError(null, JSON_RPC_ERRORS.INVALID_REQUEST, 'Method not allowed'));
  }
  
  // Authenticate request
  if (!authenticateRequest(req)) {
    return res.status(HTTP_STATUS.UNAUTHORIZED)
      .json(createJsonRpcError(null, JSON_RPC_ERRORS.INVALID_REQUEST, 'Unauthorized'));
  }
  
  try {
    // Parse JSON-RPC request
    const { id, method, params = {} } = parseJsonRpcRequest(req);

    if (!method) {
      return res.status(HTTP_STATUS.BAD_REQUEST)
        .json(createJsonRpcError(id, JSON_RPC_ERRORS.INVALID_REQUEST, 'Missing method'));
    }

    // Check if method is supported
    const handler = methodHandlers[method];
    if (!handler) {
      return res.status(HTTP_STATUS.BAD_REQUEST)
        .json(createJsonRpcError(id, JSON_RPC_ERRORS.METHOD_NOT_FOUND, `Method not found: ${method}`));
    }

    // Discover tools once for the request
    const toolsTimer = new PerformanceTimer('Tool discovery');
    const tools = await discoverTools();
    toolsTimer.endAndLog(tools.length === 0); // Log if no tools found

    // Execute method handler
    const response = await handler(id, params, tools);
    return res.status(HTTP_STATUS.OK).json(response);
    
  } catch (error) {
    console.error('Tools endpoint error:', {
      method: req.method,
      error: error.message,
      stack: error.stack
    });
    
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
      .json(createJsonRpcError(
        null,
        JSON_RPC_ERRORS.INTERNAL_ERROR,
        'Internal error',
        { message: error.message }
      ));
  }
}

// Export handler with performance monitoring
export default withPerformanceMonitoring('tools', toolsHandler);