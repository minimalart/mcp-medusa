import { type ToolName } from "./tool-schemas.js";
import type { z } from "zod";
export type ToolFunction = (args: any) => Promise<any>;
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: Record<string, any>;
        required: string[];
    };
}
export interface ApiTool {
    definition: ToolDefinition;
    function: ToolFunction;
    path?: string;
}
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
export declare function discoverTools(): Promise<ApiTool[]>;
/**
 * Loads all Medusa tools with TypeScript types and Zod validation
 * @returns {Promise<MedusaTool[]>} Array of typed Medusa tools
 */
export declare function loadMedusaTools(): Promise<MedusaTool[]>;
/**
 * Creates a validated tool handler that wraps the original function with Zod validation
 * @param tool - The MedusaTool to create a handler for
 * @returns A function that validates input before calling the original handler
 */
export declare function createValidatedHandler(tool: MedusaTool): ToolFunction;
/**
 * Tool information for MCP registration
 */
export interface McpToolInfo {
    name: string;
    description: string;
    inputSchema: any;
}
/**
 * Prepares tool information for MCP registration
 * @returns {Promise<McpToolInfo[]>} Array of tool info objects
 */
export declare function getMcpToolsInfo(): Promise<McpToolInfo[]>;
/**
 * Gets a tool handler by name
 * @param toolName - Name of the tool
 * @returns The validated tool handler function
 */
export declare function getToolHandler(toolName: ToolName): Promise<ToolFunction | null>;
/**
 * Gets all tool handlers as a map
 * @returns Map of tool names to their handler functions
 */
export declare function getAllToolHandlers(): Promise<Map<ToolName, ToolFunction>>;
export type { ToolName } from './tool-schemas.js';
export { ToolSchemas } from './tool-schemas.js';
