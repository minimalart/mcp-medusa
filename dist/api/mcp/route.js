import { createMcpHandler } from 'mcp-handler';
import { getAllToolHandlers } from '../../lib/medusa-tools.js';
import { ToolSchemas } from '../../lib/tool-schemas.js';
import dotenv from 'dotenv';
// Load environment variables
dotenv.config();
// Cache for tool handlers
let toolHandlersCache = null;
async function getToolHandlers() {
    if (!toolHandlersCache) {
        toolHandlersCache = await getAllToolHandlers();
    }
    return toolHandlersCache;
}
const handler = createMcpHandler(async (server) => {
    // Get all tool handlers
    const toolHandlers = await getToolHandlers();
    // Register each Medusa tool
    for (const [toolName, toolHandler] of toolHandlers.entries()) {
        const schema = ToolSchemas[toolName];
        const toolDescription = getToolDescription(toolName);
        server.tool(toolName, toolDescription, schema.shape, async (args) => {
            try {
                const result = await toolHandler(args);
                return {
                    content: [
                        {
                            type: 'text',
                            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                        }
                    ]
                };
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error executing ${toolName}: ${errorMessage}`
                        }
                    ],
                    isError: true
                };
            }
        });
    }
}, {
    // Handler options
    basePath: '/api'
});
function getToolDescription(toolName) {
    const descriptions = {
        'manage_medusa_admin_orders': 'Comprehensive Medusa Admin order management tool supporting order operations (list, get, cancel, complete, archive, transfer, and fulfillment management).',
        'manage_medusa_admin_draft_orders': 'Comprehensive Medusa Admin draft order management tool supporting cart-like functionality (create, list, get, delete, convert to order, and line item management).',
        'manage_medusa_admin_products': 'Comprehensive Medusa Admin products management tool supporting product operations (list, get, create, update, delete), variant management, and category operations.',
        'manage_medusa_admin_customers': 'Comprehensive Medusa Admin customers management tool supporting customer operations (list, get, create, update, delete), address management, and customer group operations.',
        'manage_medusa_admin_collections': 'Comprehensive Medusa Admin collections management tool supporting collection operations (list, get, create, update, delete) and product association management.',
        'manage_medusa_admin_inventory': 'Comprehensive Medusa Admin inventory management tool supporting inventory items, stock locations, levels, and reservations.',
        'manage_medusa_admin_regions': 'Comprehensive Medusa Admin regions and shipping management tool supporting regions, shipping options, profiles, and fulfillment operations.',
        'manage_medusa_admin_pricing': 'Comprehensive Medusa Admin pricing and promotions management tool supporting price lists, promotions, and campaigns.',
        'manage_medusa_admin_payments': 'Comprehensive Medusa Admin payments management tool supporting payment collections, payments, captures, cancellations, and refunds.',
        'manage_medusa_admin_returns': 'Comprehensive Medusa Admin returns and exchanges management tool supporting returns, swaps, claims, and order edits.',
        'manage_medusa_admin_gift_cards': 'Comprehensive Medusa Admin gift cards management tool supporting gift card operations (list, get, create, update, delete).',
        'manage_medusa_admin_taxes': 'Comprehensive Medusa Admin tax management tool supporting tax rates and tax regions.',
        'manage_medusa_admin_sales_channels': 'Comprehensive Medusa Admin sales channels management tool supporting channel operations and product associations.',
        'manage_medusa_admin_users': 'Comprehensive Medusa Admin users and authentication management tool supporting user operations, invites, and API key management.'
    };
    return descriptions[toolName] || `Medusa Admin tool: ${toolName}`;
}
export { handler as GET, handler as POST, handler as DELETE };
