// Optimized Serverless MCP Transport Implementation for Vercel
// High-performance MCP over HTTP with comprehensive optimizations

import { discoverTools, transformToolsToMcp, executeToolOptimized } from '../../lib/tools.js';
import { authenticateRequest, corsHeaders } from '../../lib/auth.js';
import { createJsonRpcResponse, createJsonRpcError, parseJsonRpcRequest, JSON_RPC_ERRORS } from '../../lib/jsonrpc.js';
import { MCP_VERSION, SERVER_INFO, CAPABILITIES, HTTP_STATUS } from '../../lib/constants.js';
import { withPerformanceMonitoring, PerformanceTimer } from '../../lib/performance.js';
import dotenv from 'dotenv';

// Initialize environment once
dotenv.config();

// Pre-compute responses for better performance
const HEALTH_CHECK_RESPONSE = {
  server: SERVER_INFO,
  capabilities: CAPABILITIES,
  protocolVersion: MCP_VERSION,
  transport: 'http',
};

const INITIALIZE_RESPONSE = {
  protocolVersion: MCP_VERSION,
  capabilities: CAPABILITIES,
  serverInfo: SERVER_INFO
};

// Freeze objects for V8 optimizations
Object.freeze(HEALTH_CHECK_RESPONSE);
Object.freeze(INITIALIZE_RESPONSE);
Object.freeze(SERVER_INFO);
Object.freeze(CAPABILITIES);

// Optimized method handlers with caching
const methodHandlers = {
  'initialize': async (id, params) => {
    return createJsonRpcResponse(id, INITIALIZE_RESPONSE);
  },
  
  'tools/list': async (id, params, tools) => {
    const timer = new PerformanceTimer('tools/list');
    const mcpTools = transformToolsToMcp(tools);
    timer.endAndLog(false);
    return createJsonRpcResponse(id, { tools: mcpTools });
  },
  
  'tools/call': async (id, params, tools) => {
    const { name, arguments: args = {} } = params;
    
    if (!name) {
      return createJsonRpcError(id, JSON_RPC_ERRORS.INVALID_PARAMS, 'Missing tool name');
    }
    
    const timer = new PerformanceTimer(`Tool: ${name}`);
    try {
      const result = await executeToolOptimized(tools, name, args);
      const duration = timer.end();
      
      if (duration > 3000) {
        console.log(`Slow tool: ${name} took ${duration.toFixed(2)}ms`);
      }
      
      return createJsonRpcResponse(id, result);
    } catch (error) {
      timer.end();
      throw error;
    }
  }
};

// Optimized JSON-RPC request handler
const handleMcpRequest = async (req) => {
  const timer = new PerformanceTimer('MCP Request Processing');
  
  try {
    // Parse JSON-RPC request
    const { id, method, params = {} } = parseJsonRpcRequest(req);
    
    // Check if method is supported
    const handler = methodHandlers[method];
    if (!handler) {
      return createJsonRpcError(id, JSON_RPC_ERRORS.METHOD_NOT_FOUND, `Method not found: ${method}`);
    }
    
    // Discover tools only if needed
    let tools = null;
    if (method === 'tools/list' || method === 'tools/call') {
      const toolTimer = new PerformanceTimer('Tool Discovery');
      tools = await discoverTools();
      toolTimer.endAndLog(false);
    }
    
    // Execute method handler
    const result = await handler(id, params, tools);
    const duration = timer.end();
    
    if (duration > 1000) {
      console.log(`Slow MCP request: ${method} took ${duration.toFixed(2)}ms`);
    }
    
    return result;
    
  } catch (error) {
    timer.end();
    console.error('MCP request processing error:', {
      method: req.method,
      error: error.message,
      stack: error.stack
    });
    return createJsonRpcError(
      null,
      JSON_RPC_ERRORS.INTERNAL_ERROR,
      'Internal error',
      { message: error.message }
    );
  }
};

// Optimized main handler
const handler = async (req, res) => {
  const requestTimer = new PerformanceTimer('Total Request');
  
  try {
    // Handle preflight OPTIONS requests first
    if (req.method === 'OPTIONS') {
      const duration = requestTimer.end();
      return new Response(null, {
        status: HTTP_STATUS.NO_CONTENT,
        headers: corsHeaders,
      });
    }

    // Fast authentication check
    if (!authenticateRequest(req)) {
      const duration = requestTimer.end();
      return new Response(
        JSON.stringify(createJsonRpcError(null, JSON_RPC_ERRORS.INVALID_REQUEST, 'Unauthorized')),
        {
          status: HTTP_STATUS.UNAUTHORIZED,
          headers: corsHeaders,
        }
      );
    }

    // Handle GET request for health check
    if (req.method === 'GET') {
      const duration = requestTimer.end();
      return new Response(
        JSON.stringify(HEALTH_CHECK_RESPONSE),
        {
          status: HTTP_STATUS.OK,
          headers: corsHeaders,
        }
      );
    }

    // Handle POST request for JSON-RPC
    if (req.method === 'POST') {
      const response = await handleMcpRequest(req);
      const duration = requestTimer.end();
      
      return new Response(JSON.stringify(response), {
        status: HTTP_STATUS.OK,
        headers: corsHeaders,
      });
    }

    // Method not allowed
    const duration = requestTimer.end();
    return new Response(
      JSON.stringify(createJsonRpcError(null, JSON_RPC_ERRORS.INVALID_REQUEST, 'Method not allowed')),
      {
        status: HTTP_STATUS.METHOD_NOT_ALLOWED,
        headers: corsHeaders,
      }
    );
    
  } catch (error) {
    const duration = requestTimer.end();
    console.error('Handler error:', {
      method: req.method,
      duration: `${duration.toFixed(2)}ms`,
      error: error.message,
      stack: error.stack
    });
    
    return new Response(
      JSON.stringify(
        createJsonRpcError(null, JSON_RPC_ERRORS.INTERNAL_ERROR, 'Internal server error', {
          message: error.message,
        })
      ),
      {
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        headers: corsHeaders,
      }
    );
  }
};

// Export optimized handlers with performance monitoring
const optimizedHandler = withPerformanceMonitoring('mcp-main', handler);
export { optimizedHandler as GET, optimizedHandler as POST, optimizedHandler as OPTIONS };