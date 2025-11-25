import { toolPaths } from "../tools/paths.js";
import { ToolSchemas, type ToolName } from "./tool-schemas.js";
import type { z } from "zod";

// Type definition for a tool function
export type ToolFunction = (args: any) => Promise<any>;

// Type definition for a tool definition
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

// Type definition for an API tool
export interface ApiTool {
  definition: ToolDefinition;
  function: ToolFunction;
  path?: string;
}

// Type definition for a Medusa tool with Zod validation
export interface MedusaTool {
  name: ToolName;
  description: string;
  schema: z.ZodType<any>;
  handler: ToolFunction;
}

/**
 * Discovers and loads all available Medusa tools from the tools directory
 * @returns {Promise<ApiTool[]>} Array of tool objects
 */
export async function discoverTools(): Promise<ApiTool[]> {
  const toolPromises = toolPaths.map(async (file: string) => {
    const module = await import(`../tools/${file}`);
    return {
      ...module.apiTool,
      path: file,
    };
  });
  return Promise.all(toolPromises);
}

/**
 * Loads all Medusa tools with TypeScript types and Zod validation
 * @returns {Promise<MedusaTool[]>} Array of typed Medusa tools
 */
export async function loadMedusaTools(): Promise<MedusaTool[]> {
  const tools = await discoverTools();
  
  return tools.map((tool): MedusaTool => {
    const toolName = tool.definition.name as ToolName;
    const schema = ToolSchemas[toolName];
    
    if (!schema) {
      throw new Error(`No schema found for tool: ${toolName}`);
    }
    
    return {
      name: toolName,
      description: tool.definition.description,
      schema,
      handler: tool.function,
    };
  });
}

/**
 * Creates a validated tool handler that wraps the original function with Zod validation
 * @param tool - The MedusaTool to create a handler for
 * @returns A function that validates input before calling the original handler
 */
export function createValidatedHandler(tool: MedusaTool): ToolFunction {
  return async (args: any) => {
    try {
      // Validate the input arguments using the Zod schema
      const validatedArgs = tool.schema.parse(args);
      
      // Call the original handler with validated arguments
      return await tool.handler(validatedArgs);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Validation error for ${tool.name}: ${error.message}`);
      }
      throw error;
    }
  };
}

/**
 * Tool information for MCP registration
 */
export interface McpToolInfo {
  name: string;
  description: string;
  inputSchema: any; // Will be converted to MCP format
}

/**
 * Converts Zod schema to JSON Schema format for MCP
 * This is a simplified conversion - for production use, consider using a proper Zod to JSON Schema library
 */
function zodToJsonSchema(zodSchema: z.ZodType<any>): any {
  // This is a basic implementation - for more complex schemas, 
  // you might want to use a library like zod-to-json-schema
  return {
    type: "object",
    properties: {},
    additionalProperties: true
  };
}

/**
 * Prepares tool information for MCP registration
 * @returns {Promise<McpToolInfo[]>} Array of tool info objects
 */
export async function getMcpToolsInfo(): Promise<McpToolInfo[]> {
  const tools = await loadMedusaTools();
  
  return tools.map((tool): McpToolInfo => ({
    name: tool.name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.schema)
  }));
}

/**
 * Gets a tool handler by name
 * @param toolName - Name of the tool
 * @returns The validated tool handler function
 */
export async function getToolHandler(toolName: ToolName): Promise<ToolFunction | null> {
  const tools = await loadMedusaTools();
  const tool = tools.find(t => t.name === toolName);
  
  if (!tool) {
    return null;
  }
  
  return createValidatedHandler(tool);
}

/**
 * Gets all tool handlers as a map
 * @returns Map of tool names to their handler functions
 */
export async function getAllToolHandlers(): Promise<Map<ToolName, ToolFunction>> {
  const tools = await loadMedusaTools();
  const handlerMap = new Map<ToolName, ToolFunction>();
  
  for (const tool of tools) {
    handlerMap.set(tool.name, createValidatedHandler(tool));
  }
  
  return handlerMap;
}

// Export types and utility functions
export type { ToolName } from './tool-schemas.js';
export { ToolSchemas } from './tool-schemas.js';