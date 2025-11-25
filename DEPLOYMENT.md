# Vercel Deployment Guide

This guide explains how to deploy your Medusa MCP server to Vercel.

## Overview

The MCP server has been refactored to support both local STDIO mode and Vercel serverless deployment:

- **Local Mode**: Uses the original `mcpServer.js` for Claude Desktop integration
- **Vercel Mode**: Uses `api/mcp/route.js` as a serverless function

## Files Added/Modified

### New Files
- `api/mcp/route.js` - Vercel API route for MCP server
- `lib/tool-schemas.ts` - Zod validation schemas for all tools
- `lib/medusa-tools.ts` - TypeScript tool wrapper with validation
- `tsconfig.json` - TypeScript configuration
- `vercel.json` - Vercel deployment configuration
- `DEPLOYMENT.md` - This deployment guide

### Modified Files
- `package.json` - Added new dependencies and scripts

## Local Development

### STDIO Mode (Claude Desktop)
```bash
npm run dev
# or
node mcpServer.js
```

### Vercel Local Testing
```bash
npm run dev:vercel
# or
npx vercel dev
```

## Deployment to Vercel

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Configure Environment Variables
Set these environment variables in your Vercel project:

- `MEDUSA_BASE_URL` - Your Medusa backend URL (e.g., `https://your-medusa-store.com`)
- `MEDUSA_API_KEY` - Your Medusa admin API key

You can set them via the Vercel dashboard or CLI:
```bash
vercel env add MEDUSA_BASE_URL
vercel env add MEDUSA_API_KEY
```

### 4. Deploy
```bash
vercel
```

For production deployment:
```bash
vercel --prod
```

## MCP Client Integration

### Claude Desktop (Local STDIO)
Add to Claude Desktop configuration:
```json
{
  "mcpServers": {
    "medusa-admin": {
      "command": "node",
      "args": ["/absolute/path/to/mcpServer.js"]
    }
  }
}
```

### Claude Code/Web Clients (Vercel)
Use your deployed Vercel URL:
```
https://your-project.vercel.app/api/mcp
```

## Available Endpoints

### GET /api/mcp
Returns server information and available tools.

### POST /api/mcp
Execute MCP tool calls. Send requests in the format:
```json
{
  "method": "tools/call",
  "params": {
    "name": "manage_medusa_admin_orders",
    "arguments": {
      "action": "list",
      "limit": 10
    }
  }
}
```

### DELETE /api/mcp
Session cleanup endpoint.

## Tool Validation

The Vercel deployment includes Zod validation for all tool parameters. Invalid parameters will return validation errors.

## Available Tools

All 14 Medusa admin tools are available:

1. `manage_medusa_admin_orders` - Order management
2. `manage_medusa_admin_draft_orders` - Draft order management
3. `manage_medusa_admin_products` - Product management
4. `manage_medusa_admin_customers` - Customer management
5. `manage_medusa_admin_collections` - Collection management
6. `manage_medusa_admin_inventory` - Inventory management
7. `manage_medusa_admin_regions` - Region and shipping management
8. `manage_medusa_admin_pricing` - Pricing and promotions
9. `manage_medusa_admin_payments` - Payment management
10. `manage_medusa_admin_returns` - Returns and exchanges
11. `manage_medusa_admin_gift_cards` - Gift card management
12. `manage_medusa_admin_taxes` - Tax management
13. `manage_medusa_admin_sales_channels` - Sales channel management
14. `manage_medusa_admin_users` - User and authentication management

## Testing

### Local Testing
```bash
# Test tool listing
npm run list-tools

# Test STDIO mode
npm run dev
```

### MCP Inspector

For testing the STDIO mode (local):
```bash
# IMPORTANT: Use direct node command, not npm scripts
npx @modelcontextprotocol/inspector@latest node mcpServer.js
```

For testing Vercel dev mode (local):
```bash
# Terminal 1: Start Vercel dev server
npm run dev:vercel
# or
npx vercel dev --yes

# Terminal 2: Connect MCP Inspector (after Vercel dev is running)
npx @modelcontextprotocol/inspector@latest http://localhost:3000/api/mcp
```

For testing the Vercel deployment (production):
```bash
npx @modelcontextprotocol/inspector@latest https://your-project.vercel.app/api/mcp
```

**⚠️ Critical**: When testing STDIO mode, always use `node mcpServer.js` directly. Do not use `npm run dev` or any npm scripts, as they output additional text (`> mcp-medusa@1.0.0 dev`) that interferes with JSON-RPC communication and causes "Unexpected token" errors.

## Troubleshooting

### Common Issues

1. **Environment Variables**: Ensure `MEDUSA_BASE_URL` and `MEDUSA_API_KEY` are properly set in Vercel
2. **CORS**: If testing from a browser, you may need to add CORS headers
3. **Memory Limits**: Large responses may hit Vercel's memory limits (currently set to 512MB)

### Logs
Check Vercel function logs:
```bash
vercel logs
```

## Performance Considerations

- Cold starts: ~500ms for initial function execution
- Warm execution: <100ms per tool call
- Memory usage: Configured for 512MB (adjustable in vercel.json)
- Timeout: Default Vercel function timeout (10s for Hobby, 60s for Pro)

## Security

- API key authentication is handled via environment variables
- All tool parameters are validated using Zod schemas
- No sensitive data is logged or exposed in responses