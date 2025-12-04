# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Medusa.js MCP (Model Context Protocol) server that provides automated API tools for Medusa e-commerce backend operations. It focuses on admin API functionality including order management, cart operations, and fulfillment processing.

**Version:** 1.0.4
**Supports:** Local STDIO (npx) and Remote Streamable HTTP (Digital Ocean)

## Architecture

### Transport Modes

| Mode | Entry Point | Protocol | Use Case |
|------|-------------|----------|----------|
| STDIO | `mcpServer.js` | MCP 2024-11-05 | Local IDEs (npx) |
| HTTP | `server/index.js` | MCP 2025-03-26 (Streamable HTTP) | Remote/Web apps |
| Vercel | `api/mcp/index.js` | JSON-RPC over HTTP | Serverless |

### Core Components

- **mcpServer.js**: STDIO transport for local IDE integration
  - Uses `@modelcontextprotocol/sdk` StdioServerTransport
  - Entry point for `npx mcp-medusa`

- **server/index.js**: HTTP transport for remote access
  - Implements Streamable HTTP (MCP 2025-03-26)
  - Supports mcp-remote clients
  - Bearer token authentication

- **lib/tools.js**: Tool discovery system that dynamically loads tools from the `tools/` directory
- **tools/paths.js**: Configuration file listing all available tool paths
- **commands/tools.js**: CLI command for listing available tools with descriptions
- **index.js**: CLI entry point using Commander.js

### Tool Structure

Tools are organized by functionality:
```
tools/
  medusa-admin-api/
    medusa-admin-orders.js       # Order management & fulfillment
    medusa-admin-draft-orders.js # Cart-like draft order operations
    medusa-admin-products.js     # Product & variant management
    medusa-admin-customers.js    # Customer & group management
    medusa-admin-collections.js  # Collections management
    medusa-admin-inventory.js    # Inventory & stock management
    medusa-admin-regions.js      # Regions & shipping management
    medusa-admin-pricing.js      # Pricing & promotions
    medusa-admin-payments.js     # Payment operations
    medusa-admin-returns.js      # Returns & exchanges
    medusa-admin-gift-cards.js   # Gift card management
    medusa-admin-taxes.js        # Tax management
    medusa-admin-sales-channels.js # Sales channels management
    medusa-admin-users.js        # User & auth management
```

Each tool exports an `apiTool` object with:
- `definition`: Tool metadata (name, description, parameters schema)
- `function`: Implementation function that takes args and returns results

### Authentication

Medusa Admin Tools use Bearer token authentication:
- `MEDUSA_BASE_URL`: Base URL for the Medusa backend
- `MEDUSA_API_KEY`: Admin API key or JWT token

## Development Commands

### Running the Server

**STDIO Mode (local IDE integration):**
```bash
npm run dev
# or
node mcpServer.js
```

**HTTP Mode (remote/web apps):**
```bash
npm run dev:http
# or
node server/index.js
```

**Vercel (serverless):**
```bash
npm run dev:vercel
# or
vercel --prod
```

### Tool Management

**List all available tools:**
```bash
npm run list-tools
# or
node index.js tools
```

### Environment Setup

Copy `env.example` to `.env` and configure:
```bash
cp env.example .env
```

**Required variables:**
- `MEDUSA_BASE_URL` - Medusa backend URL
- `MEDUSA_API_KEY` - Admin API key
- `MCP_AUTH_TOKEN` - Bearer token for HTTP auth (remote only)

### Testing

Test Medusa tools:
```bash
node test-mcp-tools.js
node test-medusa-tools.js
```

Test HTTP server:
```bash
curl http://localhost:3000/health
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Adding New Tools

1. Create new tool file in appropriate workspace/collection directory
2. Export `apiTool` object with proper structure
3. Add tool path to `tools/paths.js`
4. Tool will be automatically discovered by the server

## Docker Deployment

**Build image:**
```bash
docker build -t medusa-mcp .
```

**Run with environment file:**
```bash
docker run -i --rm --env-file=.env medusa-mcp
```

## MCP Client Integration

### Option 1: Local STDIO (via npx)

Add to Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "medusa-admin": {
      "command": "npx",
      "args": ["-y", "mcp-medusa"],
      "env": {
        "MEDUSA_BASE_URL": "http://localhost:9000",
        "MEDUSA_API_KEY": "your_admin_api_key"
      }
    }
  }
}
```

### Option 2: Remote via mcp-remote

Connect local IDE to remote server:
```json
{
  "mcpServers": {
    "medusa-remote": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://your-app.ondigitalocean.app/sse",
        "--header", "Authorization:Bearer ${MCP_AUTH_TOKEN}"
      ],
      "env": {
        "MCP_AUTH_TOKEN": "your_token"
      }
    }
  }
}
```

### Option 3: HTTP Direct (Web Apps)

```javascript
const response = await fetch('https://your-app.ondigitalocean.app/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list'
  })
});
```

### Requirements

- Node.js v20+ (for fetch API support)
- Medusa backend server running
- Admin API key or valid JWT token
- Appropriate admin permissions for all e-commerce operations

## Available Tools

### Medusa Admin Tools (14 comprehensive tools covering 200+ API actions)
- **manage_medusa_admin_orders**: Order management with cancel, complete, archive, transfer, and fulfillment operations
- **manage_medusa_admin_draft_orders**: Cart-like functionality with line item management and order conversion
- **manage_medusa_admin_products**: Product CRUD, variants, categories, tags, and types management
- **manage_medusa_admin_customers**: Customer CRUD, addresses, and customer groups management
- **manage_medusa_admin_collections**: Collections CRUD and product associations
- **manage_medusa_admin_inventory**: Inventory items, stock locations, levels, and reservations
- **manage_medusa_admin_regions**: Regions, shipping options, profiles, and fulfillment management
- **manage_medusa_admin_pricing**: Price lists, promotions, and campaigns management
- **manage_medusa_admin_payments**: Payment collections, captures, cancellations, and refunds
- **manage_medusa_admin_returns**: Returns, swaps, claims, and order edits
- **manage_medusa_admin_gift_cards**: Gift card operations and balance management
- **manage_medusa_admin_taxes**: Tax rates and tax regions management
- **manage_medusa_admin_sales_channels**: Sales channels and product associations
- **manage_medusa_admin_users**: User management, invites, and API key operations

## Security Notes

- Never commit `.env` files or expose credentials
- Use HTTPS for production Medusa API endpoints
- Validate all user inputs in tool functions  
- Environment variables are used for all sensitive configuration
- Admin tools require proper authentication and admin-level permissions