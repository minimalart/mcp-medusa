# MCP Medusa Architecture

## Overview

MCP Medusa is a Model Context Protocol server that provides AI assistants with access to Medusa e-commerce backend operations. It supports two transport modes for maximum flexibility.

## Transport Modes

### STDIO Transport (Local)

Used for direct IDE integration via `npx`.

```
┌─────────────────┐     STDIO      ┌─────────────────┐
│  Claude Desktop │ ◄────────────► │  mcpServer.js   │
│  Windsurf       │                │  (Node.js)      │
│  Cursor         │                └────────┬────────┘
└─────────────────┘                         │
                                            │
                                   ┌────────▼────────┐
                                   │  Medusa Backend │
                                   │  (HTTP API)     │
                                   └─────────────────┘
```

**Entry Point:** `mcpServer.js`
**Protocol Version:** 2024-11-05
**Authentication:** Environment variables (MEDUSA_API_KEY)

### HTTP Transport (Remote)

Used for web applications and remote IDE connections via mcp-remote.

```
┌─────────────────┐     HTTPS      ┌─────────────────┐
│  Web App        │ ◄────────────► │  server/        │
│  mcp-remote     │                │  index.js       │
│  API Client     │                └────────┬────────┘
└─────────────────┘                         │
        │                                   │
        │ Bearer Token            ┌────────▼────────┐
        └─────────────────────────│  Medusa Backend │
                                  │  (HTTP API)     │
                                  └─────────────────┘
```

**Entry Point:** `server/index.js`
**Protocol Version:** 2025-03-26 (Streamable HTTP)
**Authentication:** Bearer token (MCP_AUTH_TOKEN)

## Directory Structure

```
mcp-medusa/
├── mcpServer.js                 # STDIO transport entry point
├── server/
│   ├── index.js                 # HTTP transport entry point
│   ├── transports/
│   │   └── streamable-http.js   # Streamable HTTP implementation
│   └── middleware/
│       └── auth.js              # Authentication & CORS
├── lib/
│   ├── tools.js                 # Tool discovery & execution
│   ├── constants.js             # Shared configuration
│   ├── auth.js                  # Legacy auth (Vercel)
│   ├── jsonrpc.js               # JSON-RPC utilities
│   ├── performance.js           # Performance monitoring
│   └── monitoring.js            # Metrics collection
├── tools/
│   ├── paths.js                 # Tool registry
│   └── medusa-admin-api/        # 14 Medusa admin tools
│       ├── medusa-admin-orders.js
│       ├── medusa-admin-products.js
│       ├── medusa-admin-customers.js
│       ├── medusa-admin-collections.js
│       ├── medusa-admin-inventory.js
│       ├── medusa-admin-regions.js
│       ├── medusa-admin-pricing.js
│       ├── medusa-admin-payments.js
│       ├── medusa-admin-returns.js
│       ├── medusa-admin-gift-cards.js
│       ├── medusa-admin-taxes.js
│       ├── medusa-admin-sales-channels.js
│       ├── medusa-admin-users.js
│       └── medusa-admin-draft-orders.js
├── api/                         # Vercel serverless (legacy)
│   └── mcp/
├── deployment/
│   └── digitalocean/
│       └── app.yaml             # DO App Platform config
├── docs/
│   ├── ARCHITECTURE.md          # This file
│   ├── REMOTE-SETUP.md          # Remote deployment guide
│   └── API-REFERENCE.md         # API documentation
├── benchmark/                   # Performance tests
├── package.json
├── CLAUDE.md                    # AI assistant instructions
└── README.md                    # User documentation
```

## Component Details

### Tool Discovery System (`lib/tools.js`)

The tool discovery system dynamically loads tools from the `tools/` directory:

1. **Discovery**: Reads tool paths from `tools/paths.js`
2. **Loading**: Imports each tool module asynchronously
3. **Caching**: Caches tools for 5 minutes to reduce load time
4. **Transformation**: Converts tools to MCP format

```javascript
// Tool structure
export const apiTool = {
  definition: {
    name: 'tool_name',
    description: 'Tool description',
    parameters: { /* JSON Schema */ }
  },
  function: async (args) => { /* Implementation */ }
};
```

### Streamable HTTP Transport (`server/transports/streamable-http.js`)

Implements MCP specification 2025-03-26:

- **POST /mcp**: JSON-RPC requests with optional SSE response
- **GET /mcp**: SSE stream for server-initiated messages
- **DELETE /mcp**: Session termination
- **Mcp-Session-Id**: Session management header
- **Last-Event-ID**: Stream resumability

### Authentication Flow

```
Client Request
      │
      ▼
┌─────────────────┐
│ Extract Bearer  │
│ Token from      │
│ Authorization   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Validate against│
│ MCP_AUTH_TOKEN  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
   Valid    Invalid
    │         │
    ▼         ▼
  Allow     401
  Request   Unauthorized
```

## Data Flow

### STDIO Mode

```
1. IDE spawns: npx mcp-medusa
2. mcpServer.js initializes StdioServerTransport
3. IDE sends JSON-RPC via stdin
4. Server processes request
5. Server responds via stdout
6. Repeat until connection closes
```

### HTTP Mode

```
1. Client POSTs to /mcp
2. Auth middleware validates Bearer token
3. StreamableHTTPHandler processes JSON-RPC
4. Handler routes to appropriate method:
   - initialize → Return capabilities
   - tools/list → Return tool definitions
   - tools/call → Execute tool function
5. Response sent as JSON or SSE stream
```

## Environment Variables

| Variable | Required | Mode | Description |
|----------|----------|------|-------------|
| `MEDUSA_BASE_URL` | Yes | Both | Medusa backend URL |
| `MEDUSA_API_KEY` | Yes | Both | Medusa admin API key |
| `MCP_AUTH_TOKEN` | HTTP only | HTTP | Bearer token for auth |
| `PORT` | No | HTTP | Server port (default: 3000) |
| `NODE_ENV` | No | Both | Environment (development/production) |

## Tool Categories

| Category | Tool Name | Actions |
|----------|-----------|---------|
| Orders | `manage_medusa_admin_orders` | list, get, cancel, complete, archive, transfer |
| Products | `manage_medusa_admin_products` | CRUD, variants, categories, tags |
| Customers | `manage_medusa_admin_customers` | CRUD, addresses, groups |
| Inventory | `manage_medusa_admin_inventory` | items, locations, levels, reservations |
| Regions | `manage_medusa_admin_regions` | regions, shipping, fulfillment |
| Pricing | `manage_medusa_admin_pricing` | price lists, promotions, campaigns |
| Payments | `manage_medusa_admin_payments` | collections, captures, refunds |
| Returns | `manage_medusa_admin_returns` | returns, exchanges, claims, edits |
| Gift Cards | `manage_medusa_admin_gift_cards` | CRUD operations |
| Taxes | `manage_medusa_admin_taxes` | rates, regions |
| Sales Channels | `manage_medusa_admin_sales_channels` | CRUD, product associations |
| Users | `manage_medusa_admin_users` | users, invites, API keys |
| Draft Orders | `manage_medusa_admin_draft_orders` | cart-like operations |
| Collections | `manage_medusa_admin_collections` | CRUD, product associations |

## Performance Considerations

### Caching

- Tool definitions cached for 5 minutes
- MCP-transformed tools cached alongside raw tools
- Cache invalidated on force refresh

### Timeouts

- HTTP request timeout: 30 seconds (configurable in DO)
- Tool execution timeout: 30 seconds
- SSE keepalive: 30 seconds

### Memory

- Target: < 512MB for basic instance
- Tool cache: ~1MB for 14 tools
- Session storage: In-memory (consider Redis for multi-instance)

## Security Model

### STDIO Mode

- No network exposure
- Credentials via environment variables
- Process isolation by IDE

### HTTP Mode

- HTTPS required (enforced by DO App Platform)
- Bearer token authentication
- CORS headers for web clients
- No credential logging
- Session isolation

## Deployment Options

### Local Development

```bash
# STDIO
npm run dev

# HTTP
npm run dev:http
```

### Production

| Platform | Command | Notes |
|----------|---------|-------|
| Digital Ocean App Platform | `doctl apps create --spec deployment/digitalocean/app.yaml` | Recommended |
| Vercel | `vercel --prod` | Limited to 30s timeout |
| Docker | `docker build -t mcp-medusa . && docker run ...` | Self-hosted |
| npm (STDIO only) | `npx mcp-medusa` | Local use |

## Version History

| Version | Changes |
|---------|---------|
| 1.0.0 | Initial release with STDIO transport |
| 1.0.3 | Added Vercel HTTP support |
| 1.0.4 | Added Streamable HTTP, Digital Ocean support, mcp-remote compatibility |
