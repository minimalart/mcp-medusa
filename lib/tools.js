import { toolPaths } from "../tools/paths.js";

// Performance optimization: Cache tools to avoid repeated imports
let toolsCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

// Pre-compute MCP tool definitions for faster responses
let mcpToolsCache = null;

/**
 * Discovers and loads available tools from the tools directory with caching
 * @param {boolean} forceRefresh - Force refresh the cache
 * @returns {Promise<Array>} Array of tool objects
 */
export async function discoverTools(forceRefresh = false) {
  const now = Date.now();
  
  // Return cached tools if cache is valid and not forced refresh
  if (!forceRefresh && toolsCache && (now - cacheTimestamp) < CACHE_TTL) {
    return toolsCache;
  }
  
  // Parallel import optimization with error handling
  const toolPromises = toolPaths.map(async (file) => {
    try {
      const module = await import(`../tools/${file}`);
      if (!module.apiTool) {
        console.warn(`Tool ${file} missing apiTool export`);
        return null;
      }
      return {
        ...module.apiTool,
        path: file,
      };
    } catch (error) {
      console.error(`Failed to load tool ${file}:`, error);
      return null;
    }
  });
  
  const tools = (await Promise.all(toolPromises)).filter(Boolean);
  
  // Update cache
  toolsCache = tools;
  mcpToolsCache = null; // Reset MCP cache when tools change
  cacheTimestamp = now;
  
  return tools;
}

/**
 * Transform tools to MCP format with caching
 * @param {Array} tools - Array of tool objects
 * @returns {Array} MCP formatted tools
 */
export function transformToolsToMcp(tools) {
  // Use cached MCP tools if available
  if (mcpToolsCache && toolsCache === tools) {
    return mcpToolsCache;
  }
  
  const mcpTools = tools
    .map((tool) => {
      const definition = tool.definition;
      if (!definition) return null;
      return {
        name: definition.name,
        description: definition.description,
        inputSchema: definition.parameters,
      };
    })
    .filter(Boolean);
  
  // Cache the transformed tools
  mcpToolsCache = mcpTools;
  return mcpTools;
}

/**
 * Find and execute a tool by name with optimized lookup
 * @param {Array} tools - Array of tool objects
 * @param {string} toolName - Name of the tool to execute
 * @param {Object} args - Arguments to pass to the tool
 * @returns {Promise<Object>} Tool execution result
 */
export async function executeToolOptimized(tools, toolName, args) {
  // Fast lookup using find (tools array is small, so O(n) is acceptable)
  const tool = tools.find((t) => t.definition?.name === toolName);
  if (!tool) {
    throw new Error(`Tool not found: ${toolName}`);
  }

  // Validate required parameters efficiently
  const requiredParams = tool.definition?.parameters?.required;
  if (requiredParams?.length > 0) {
    for (const param of requiredParams) {
      if (!(param in args)) {
        throw new Error(`Missing required parameter: ${param}`);
      }
    }
  }

  // Execute tool with error handling
  try {
    const result = await tool.function(args);
    
    // Optimize result formatting
    return {
      content: [{
        type: 'text',
        text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
      }]
    };
  } catch (error) {
    console.error(`Tool execution error for ${toolName}:`, error);
    throw error;
  }
}

/**
 * Get cached tools count for monitoring
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
  return {
    toolsCount: toolsCache?.length || 0,
    mcpToolsCount: mcpToolsCache?.length || 0,
    cacheAge: toolsCache ? Date.now() - cacheTimestamp : 0,
    isCacheValid: toolsCache && (Date.now() - cacheTimestamp) < CACHE_TTL
  };
}
