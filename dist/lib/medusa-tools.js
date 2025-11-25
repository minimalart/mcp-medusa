import { toolPaths } from "../tools/paths.js";
import { ToolSchemas } from "./tool-schemas.js";
/**
 * Discovers and loads all available Medusa tools from the tools directory
 * @returns {Promise<ApiTool[]>} Array of tool objects
 */
export async function discoverTools() {
    const toolPromises = toolPaths.map(async (file) => {
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
export async function loadMedusaTools() {
    const tools = await discoverTools();
    return tools.map((tool) => {
        const toolName = tool.definition.name;
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
export function createValidatedHandler(tool) {
    return async (args) => {
        try {
            // Validate the input arguments using the Zod schema
            const validatedArgs = tool.schema.parse(args);
            // Call the original handler with validated arguments
            return await tool.handler(validatedArgs);
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Validation error for ${tool.name}: ${error.message}`);
            }
            throw error;
        }
    };
}
/**
 * Converts Zod schema to JSON Schema format for MCP
 * This is a simplified conversion - for production use, consider using a proper Zod to JSON Schema library
 */
function zodToJsonSchema(zodSchema) {
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
export async function getMcpToolsInfo() {
    const tools = await loadMedusaTools();
    return tools.map((tool) => ({
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
export async function getToolHandler(toolName) {
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
export async function getAllToolHandlers() {
    const tools = await loadMedusaTools();
    const handlerMap = new Map();
    for (const tool of tools) {
        handlerMap.set(tool.name, createValidatedHandler(tool));
    }
    return handlerMap;
}
export { ToolSchemas } from './tool-schemas.js';
