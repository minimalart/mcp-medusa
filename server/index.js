#!/usr/bin/env node
/**
 * MCP Medusa HTTP Server
 *
 * Implements MCP over Streamable HTTP transport (MCP 2025-03-26)
 * for remote access from web applications and mcp-remote clients.
 *
 * Usage:
 *   npm run start:http
 *   node server/index.js
 *
 * Environment Variables:
 *   PORT - Server port (default: 3000)
 *   MCP_AUTH_TOKEN - Bearer token for authentication (required)
 *   MEDUSA_BASE_URL - Medusa backend URL (required)
 *   MEDUSA_API_KEY - Medusa API key (required)
 */

import express from 'express';
import { config } from 'dotenv';
import { createStreamableHTTPHandler } from './transports/streamable-http.js';
import { authMiddleware, corsMiddleware, requestLogger } from './middleware/auth.js';
import { discoverTools, transformToolsToMcp, executeToolOptimized } from '../lib/tools.js';
import { SERVER_INFO } from '../lib/constants.js';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3000;

// Validate required environment variables
const requiredEnvVars = ['MEDUSA_BASE_URL', 'MEDUSA_API_KEY'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('Please set these variables in your .env file or environment');
  process.exit(1);
}

// Warn if MCP_AUTH_TOKEN is not set
if (!process.env.MCP_AUTH_TOKEN) {
  console.warn('WARNING: MCP_AUTH_TOKEN not set. Authentication will fail for all requests.');
  console.warn('Set MCP_AUTH_TOKEN in your environment to enable authenticated access.');
}

// Create Streamable HTTP handler
const mcpHandler = createStreamableHTTPHandler({
  discoverTools,
  transformToolsToMcp,
  executeToolOptimized,
  serverInfo: {
    name: SERVER_INFO.name,
    version: '1.0.5'
  },
  protocolVersion: '2025-03-26'
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(corsMiddleware);
app.use(requestLogger);

// Health check endpoints (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.5',
    transport: 'streamable-http',
    protocolVersion: '2025-03-26'
  });
});

app.get('/ready', async (req, res) => {
  try {
    // Verify tools can be loaded
    const tools = await discoverTools();
    res.json({
      status: 'ready',
      toolsCount: tools.length,
      medusaUrl: process.env.MEDUSA_BASE_URL ? 'configured' : 'missing'
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: error.message
    });
  }
});

// MCP endpoint with authentication (Streamable HTTP - main endpoint)
app.all('/mcp', authMiddleware, async (req, res) => {
  await mcpHandler.handleRequest(req, res);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.method} ${req.path} not found`,
    availableEndpoints: {
      'GET /health': 'Health check',
      'GET /ready': 'Readiness check',
      'POST /mcp': 'MCP JSON-RPC endpoint (Streamable HTTP)',
      'GET /mcp': 'MCP SSE stream (optional)',
      'DELETE /mcp': 'Terminate MCP session'
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    MCP MEDUSA HTTP SERVER                        ║
╠══════════════════════════════════════════════════════════════════╣
║  Transport:     Streamable HTTP (MCP 2025-03-26)                 ║
║  Port:          ${String(PORT).padEnd(46)}║
║  Auth:          Bearer Token                                     ║
╠══════════════════════════════════════════════════════════════════╣
║  Endpoints:                                                      ║
║    GET  /health    - Health check                                ║
║    GET  /ready     - Readiness check                             ║
║    POST /mcp       - MCP JSON-RPC (main endpoint)                ║
╠══════════════════════════════════════════════════════════════════╣
║  Environment:                                                    ║
║    MEDUSA_BASE_URL: ${process.env.MEDUSA_BASE_URL ? 'configured' : 'MISSING'}                                    ║
║    MEDUSA_API_KEY:  ${process.env.MEDUSA_API_KEY ? 'configured' : 'MISSING'}                                    ║
║    MCP_AUTH_TOKEN:  ${process.env.MCP_AUTH_TOKEN ? 'configured' : 'NOT SET (auth will fail)'}                  ║
╚══════════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});
