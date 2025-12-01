/**
 * Streamable HTTP Transport for MCP 2025-03-26
 *
 * Implements the new MCP Streamable HTTP transport specification:
 * - POST /mcp: Receive JSON-RPC requests, respond with JSON or SSE stream
 * - GET /mcp: Initiate SSE stream for server-initiated messages (optional)
 * - DELETE /mcp: Terminate session (optional)
 * - Mcp-Session-Id header for session management
 * - Last-Event-ID header for resumability
 */

import { randomUUID } from 'crypto';

/**
 * Session storage (in-memory for simplicity)
 * For production with multiple instances, use Redis
 */
const sessions = new Map();
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * StreamableHTTPHandler - Handles MCP requests over Streamable HTTP
 */
export class StreamableHTTPHandler {
  constructor(options = {}) {
    this.discoverTools = options.discoverTools;
    this.transformToolsToMcp = options.transformToolsToMcp;
    this.executeToolOptimized = options.executeToolOptimized;
    this.serverInfo = options.serverInfo || { name: 'mcp-medusa', version: '1.0.4' };
    this.protocolVersion = options.protocolVersion || '2025-03-26';

    // Cleanup expired sessions periodically
    setInterval(() => this.cleanupSessions(), 5 * 60 * 1000);
  }

  /**
   * Create a new session
   */
  createSession() {
    const sessionId = randomUUID();
    sessions.set(sessionId, {
      createdAt: Date.now(),
      lastActivity: Date.now(),
      initialized: false
    });
    return sessionId;
  }

  /**
   * Get or create session
   */
  getOrCreateSession(sessionId) {
    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId);
      session.lastActivity = Date.now();
      return { sessionId, session, isNew: false };
    }
    const newSessionId = this.createSession();
    return { sessionId: newSessionId, session: sessions.get(newSessionId), isNew: true };
  }

  /**
   * Cleanup expired sessions
   */
  cleanupSessions() {
    const now = Date.now();
    for (const [id, session] of sessions.entries()) {
      if (now - session.lastActivity > SESSION_TTL) {
        sessions.delete(id);
      }
    }
  }

  /**
   * Handle incoming HTTP request
   */
  async handleRequest(req, res) {
    const requestSessionId = req.headers['mcp-session-id'];

    try {
      switch (req.method) {
        case 'POST':
          return await this.handlePost(req, res, requestSessionId);
        case 'GET':
          return await this.handleGet(req, res, requestSessionId);
        case 'DELETE':
          return await this.handleDelete(req, res, requestSessionId);
        case 'OPTIONS':
          return this.handleOptions(req, res);
        default:
          return this.sendError(res, 405, 'Method not allowed');
      }
    } catch (error) {
      console.error('StreamableHTTP error:', error);
      return this.sendJsonRpcError(res, null, -32603, 'Internal error', error.message);
    }
  }

  /**
   * Handle POST request - Main JSON-RPC endpoint
   */
  async handlePost(req, res, requestSessionId) {
    const { sessionId, session, isNew } = this.getOrCreateSession(requestSessionId);

    // Set session header
    res.setHeader('Mcp-Session-Id', sessionId);

    // Parse JSON-RPC request
    const body = req.body;

    if (!body || typeof body !== 'object') {
      return this.sendJsonRpcError(res, null, -32700, 'Parse error', 'Invalid JSON');
    }

    // Handle batch requests
    if (Array.isArray(body)) {
      const results = await Promise.all(
        body.map(request => this.processJsonRpcRequest(request, session))
      );
      return this.sendJsonResponse(res, results.filter(r => r !== null));
    }

    // Handle single request
    const result = await this.processJsonRpcRequest(body, session);

    // Check if client accepts SSE for streaming response
    const acceptsSSE = req.headers.accept?.includes('text/event-stream');

    if (acceptsSSE && this.shouldStream(body.method)) {
      return this.sendSSEResponse(res, sessionId, result, body.id);
    }

    if (result === null) {
      // Notification - no response needed
      res.status(204).end();
      return;
    }

    return this.sendJsonResponse(res, result);
  }

  /**
   * Handle GET request - SSE stream for server-initiated messages
   */
  async handleGet(req, res, requestSessionId) {
    if (!requestSessionId || !sessions.has(requestSessionId)) {
      return this.sendError(res, 400, 'Missing or invalid Mcp-Session-Id header');
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Mcp-Session-Id', requestSessionId);

    // Handle Last-Event-ID for resumability
    const lastEventId = req.headers['last-event-id'];
    if (lastEventId) {
      // Could implement event replay here if needed
      console.log(`Client resuming from event: ${lastEventId}`);
    }

    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30000);

    req.on('close', () => {
      clearInterval(keepAlive);
    });

    // Send initial connection confirmation
    res.write(`event: connected\ndata: {"sessionId":"${requestSessionId}"}\n\n`);
  }

  /**
   * Handle DELETE request - Terminate session
   */
  async handleDelete(req, res, requestSessionId) {
    if (!requestSessionId) {
      return this.sendError(res, 400, 'Missing Mcp-Session-Id header');
    }

    if (sessions.has(requestSessionId)) {
      sessions.delete(requestSessionId);
      res.status(204).end();
    } else {
      this.sendError(res, 404, 'Session not found');
    }
  }

  /**
   * Handle OPTIONS request - CORS preflight
   */
  handleOptions(req, res) {
    res.status(204).end();
  }

  /**
   * Process a single JSON-RPC request
   */
  async processJsonRpcRequest(request, session) {
    const { jsonrpc, id, method, params } = request;

    // Validate JSON-RPC version
    if (jsonrpc !== '2.0') {
      return this.createJsonRpcError(id, -32600, 'Invalid Request', 'jsonrpc must be "2.0"');
    }

    // Notifications have no id
    const isNotification = id === undefined;

    try {
      const result = await this.executeMethod(method, params || {}, session);

      if (isNotification) {
        return null; // No response for notifications
      }

      return {
        jsonrpc: '2.0',
        id,
        result
      };
    } catch (error) {
      if (isNotification) {
        console.error(`Notification error for ${method}:`, error);
        return null;
      }
      return this.createJsonRpcError(id, error.code || -32603, error.message, error.data);
    }
  }

  /**
   * Execute MCP method
   */
  async executeMethod(method, params, session) {
    switch (method) {
      case 'initialize':
        return this.handleInitialize(params, session);

      case 'notifications/initialized':
        // Client notification that it's initialized - no response needed
        session.initialized = true;
        return { acknowledged: true };

      case 'tools/list':
        return this.handleToolsList(params);

      case 'tools/call':
        return this.handleToolsCall(params);

      case 'ping':
        return { pong: true };

      default:
        const error = new Error(`Method not found: ${method}`);
        error.code = -32601;
        throw error;
    }
  }

  /**
   * Handle initialize method
   */
  async handleInitialize(params, session) {
    session.initialized = true;
    session.clientInfo = params.clientInfo;

    return {
      protocolVersion: this.protocolVersion,
      serverInfo: this.serverInfo,
      capabilities: {
        tools: {}
      }
    };
  }

  /**
   * Handle tools/list method
   */
  async handleToolsList(params) {
    const tools = await this.discoverTools();
    const mcpTools = this.transformToolsToMcp(tools);

    return {
      tools: mcpTools
    };
  }

  /**
   * Handle tools/call method
   */
  async handleToolsCall(params) {
    const { name, arguments: args } = params;

    if (!name) {
      const error = new Error('Missing tool name');
      error.code = -32602;
      throw error;
    }

    const tools = await this.discoverTools();
    const result = await this.executeToolOptimized(tools, name, args || {});

    return result;
  }

  /**
   * Determine if response should be streamed
   */
  shouldStream(method) {
    // For now, no methods require streaming
    // Could be extended for long-running tool calls
    return false;
  }

  /**
   * Send JSON response
   */
  sendJsonResponse(res, data) {
    res.setHeader('Content-Type', 'application/json');
    res.json(data);
  }

  /**
   * Send SSE response
   */
  sendSSEResponse(res, sessionId, result, requestId) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Mcp-Session-Id', sessionId);

    const eventId = randomUUID();
    const data = JSON.stringify({
      jsonrpc: '2.0',
      id: requestId,
      result
    });

    res.write(`id: ${eventId}\n`);
    res.write(`data: ${data}\n\n`);
    res.end();
  }

  /**
   * Send error response
   */
  sendError(res, status, message) {
    res.status(status).json({ error: message });
  }

  /**
   * Send JSON-RPC error response
   */
  sendJsonRpcError(res, id, code, message, data) {
    res.setHeader('Content-Type', 'application/json');
    res.json({
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        ...(data && { data })
      }
    });
  }

  /**
   * Create JSON-RPC error object
   */
  createJsonRpcError(id, code, message, data) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        ...(data && { data })
      }
    };
  }
}

/**
 * Create Streamable HTTP handler
 */
export function createStreamableHTTPHandler(options) {
  return new StreamableHTTPHandler(options);
}
