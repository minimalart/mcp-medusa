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
import { discoverTools } from "./lib/tools.js";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

const SERVER_NAME = "medusa-admin-mcp-server";

async function transformTools(tools) {
  return tools
    .map((tool) => {
      const definition = tool.definition;
      if (!definition) return;
      return {
        name: definition.name,
        description: definition.description,
        inputSchema: definition.parameters,
      };
    })
    .filter(Boolean);
}

async function setupServerHandlers(server, tools) {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: await transformTools(tools),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const tool = tools.find((t) => t.definition.name === toolName);
    if (!tool) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
    }
    const args = request.params.arguments;
    const requiredParameters =
      tool.definition?.parameters?.required || [];
    for (const requiredParameter of requiredParameters) {
      if (!(requiredParameter in args)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Missing required parameter: ${requiredParameter}`
        );
      }
    }
    try {
      const result = await tool.function(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error("[Error] Failed to fetch data:", error);
      throw new McpError(
        ErrorCode.InternalError,
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
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
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
