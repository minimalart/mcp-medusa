#!/usr/bin/env node

import dotenv from "dotenv";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { discoverTools, executeToolOptimized, transformToolsToMcp } from "./lib/tools.js";
import { SERVER_INFO } from "./lib/constants.js";
import { DEFAULT_SERVER_INSTRUCTIONS } from "./lib/instructions.js";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

const SERVER_NAME = SERVER_INFO.name;

async function setupServerHandlers(server, tools) {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: transformToolsToMcp(tools),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    if (!tools.some((tool) => tool.definition?.name === toolName)) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
    }
    try {
      return await executeToolOptimized(tools, toolName, request.params.arguments || {});
    } catch (error) {
      console.error("[Error] Failed to fetch data:", error);
      throw new McpError(
        error.message?.startsWith("Missing required parameter")
          ? ErrorCode.InvalidParams
          : ErrorCode.InternalError,
        `API error: ${error.message}`
      );
    }
  });
}

async function run() {
  console.log(`[${SERVER_NAME}] Starting MCP server (STDIO mode only)`);
  console.log("[Info] For HTTP transport, use the Vercel API endpoints at /api/mcp/");
  
  const tools = await discoverTools();
  
  // STDIO mode: single server instance for local development/testing
  const server = new Server(
    {
      name: SERVER_NAME,
      title: SERVER_INFO.title,
      version: SERVER_INFO.version,
    },
    {
      capabilities: {
        tools: {},
      },
      instructions: DEFAULT_SERVER_INSTRUCTIONS,
    }
  );
  
  server.onerror = (error) => console.error("[Error]", error);
  await setupServerHandlers(server, tools);

  process.on("SIGINT", async () => {
    console.log("[Info] Shutting down server...");
    await server.close();
    process.exit(0);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log(`[${SERVER_NAME}] Connected via STDIO transport`);
}

run().catch(console.error);
