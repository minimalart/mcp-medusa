# Medusa.js MCP Server

A comprehensive **Model Context Protocol (MCP) server** that provides automated API tools for **Medusa e-commerce backend operations**. This server exposes all major Medusa admin API functionality through MCP-compatible tools for use with AI assistants like Claude Desktop.

## 🏪 About Medusa.js

[Medusa.js](https://medusajs.com/) is a modern, open-source e-commerce platform built for developers. It provides a headless commerce backend with powerful admin APIs for managing products, orders, customers, and all aspects of e-commerce operations.

## 🚀 Features

### Complete Admin API Coverage
This MCP server provides **15 admin tools** covering Medusa's core Admin API plus an additive Medusa v2 coverage tool:

- **🛍️ Products Management** - Products, variants, categories, tags, types
- **📦 Orders Management** - List, get, cancel, complete, archive, transfer, fulfillment
- **📋 Draft Orders** - Cart-like functionality with line item management
- **👥 Customers Management** - Customer CRUD, addresses, customer groups
- **📊 Collections Management** - Collections CRUD, product associations
- **📈 Inventory Management** - Inventory items, stock locations, levels, reservations
- **🌍 Regions & Shipping** - Regions, shipping options, profiles, fulfillment
- **💰 Pricing & Promotions** - Price lists, promotions, campaigns
- **💳 Payments & Refunds** - Payment collections, captures, refunds
- **🔄 Returns & Exchanges** - Returns, swaps, claims, order edits
- **🎁 Gift Cards** - Gift card operations and balance management
- **📈 Tax Management** - Tax rates and tax regions
- **📺 Sales Channels** - Channel operations and product associations
- **👤 Users & Auth** - User management, invites, API keys

### Key Capabilities
- ✅ **200+ API actions** across all Medusa admin endpoints
- ✅ **Full CRUD operations** for all major resources
- ✅ **Advanced e-commerce operations** (fulfillment, order edits, promotions)
- ✅ **MCP-compatible** for seamless AI assistant integration
- ✅ **Zero installation required** - run directly with npx
- ✅ **Comprehensive error handling** and validation

## 🚦 Quick Start

### Prerequisites

- [Node.js v18+ (v20+ recommended)](https://nodejs.org/)
- **Running Medusa.js backend server**
- **Medusa admin API key**

### Usage Modes

MCP Medusa supports **three usage modes**:

| Mode | Transport | Use Case | Best For |
|------|-----------|----------|----------|
| **Local** | STDIO | Direct IDE integration (npx) | Individual developers |
| **Remote HTTP** | Streamable HTTP | Web apps with LLM integration | Production web apps |
| **Remote via mcp-remote** | STDIO → HTTP bridge | IDEs connecting to remote server | Teams sharing one deployment |

---

## Option 1: Local Mode (STDIO)

**Best for:** Individual developers using Claude Desktop, Windsurf, Cursor, or other MCP-compatible IDEs.

Direct integration running locally via npx - no server deployment needed.

### Claude Desktop Configuration

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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

### Windsurf Configuration

**Location**: `~/.codeium/windsurf/mcp_config.json`

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

---

## Option 2: Remote Mode (HTTP) - For Web Apps

**Best for:** Web applications integrated with LLMs that need to access Medusa operations programmatically.

Deploy to Digital Ocean App Platform, then connect from your web application via HTTP.

### Step 1: Deploy to Digital Ocean

```bash
# Install doctl CLI
brew install doctl  # macOS
snap install doctl  # Linux

# Authenticate
doctl auth init

# Create app (requires GitHub connection in DO Dashboard first)
doctl apps create --spec deployment/digitalocean/app.yaml
```

### Step 2: Configure Secrets in DO Dashboard

Go to **Apps > mcp-medusa > Settings > App-Level Environment Variables** and add:

| Variable | Type | Description |
|----------|------|-------------|
| `MEDUSA_BASE_URL` | Secret | Your Medusa backend URL (e.g., `https://api.mystore.com`) |
| `MEDUSA_API_KEY` | Secret | Medusa admin API key |
| `MCP_AUTH_TOKEN` | Secret | Generate with `openssl rand -base64 32` |

### Step 3: Connect from Your Web App

**Initialize session:**
```javascript
const MCP_URL = 'https://your-app.ondigitalocean.app/mcp';
const AUTH_TOKEN = 'your_mcp_auth_token';

// Initialize MCP session
const initResponse = await fetch(MCP_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      clientInfo: { name: 'my-web-app', version: '1.0.0' }
    }
  })
});
```

**List available tools:**
```javascript
const toolsResponse = await fetch(MCP_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list'
  })
});

const { result } = await toolsResponse.json();
console.log('Available tools:', result.tools);
```

**Execute a tool:**
```javascript
const ordersResponse = await fetch(MCP_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AUTH_TOKEN}`
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'manage_medusa_admin_orders',
      arguments: {
        action: 'list',
        limit: 10
      }
    }
  })
});

const { result } = await ordersResponse.json();
console.log('Orders:', JSON.parse(result.content[0].text));
```

### HTTP Endpoints Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Liveness check |
| `/ready` | GET | No | Readiness check (shows tools count) |
| `/mcp` | POST | Bearer | Main MCP JSON-RPC endpoint (Streamable HTTP) |

---

## Option 3: Remote via mcp-remote (IDEs to Remote Server)

**Best for:** Teams where multiple developers need to share a single MCP server deployment, or when you want IDE access to a remote Medusa instance.

This uses the `mcp-remote` package to bridge local STDIO-based IDEs to a remote HTTP server using Streamable HTTP transport.

### Prerequisites

1. MCP Medusa deployed to Digital Ocean (see Option 2)
2. `MCP_AUTH_TOKEN` configured in the deployment

### Claude Desktop Configuration

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "medusa-remote": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://your-app.ondigitalocean.app/mcp",
        "--header", "Authorization:Bearer ${MCP_AUTH_TOKEN}"
      ],
      "env": {
        "MCP_AUTH_TOKEN": "your_secure_token_here"
      }
    }
  }
}
```

### Windsurf Configuration

**Location**: `~/.codeium/windsurf/mcp_config.json`

```json
{
  "mcpServers": {
    "medusa-remote": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://your-app.ondigitalocean.app/mcp",
        "--header", "Authorization:Bearer ${MCP_AUTH_TOKEN}"
      ],
      "env": {
        "MCP_AUTH_TOKEN": "your_secure_token_here"
      }
    }
  }
}
```

### Cursor Configuration

**Location**: Cursor Settings > MCP Servers

```json
{
  "mcpServers": {
    "medusa-remote": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://your-app.ondigitalocean.app/mcp",
        "--header", "Authorization:Bearer ${MCP_AUTH_TOKEN}"
      ],
      "env": {
        "MCP_AUTH_TOKEN": "your_secure_token_here"
      }
    }
  }
}
```

### How mcp-remote Works

```
┌─────────────────┐     STDIO      ┌─────────────────┐     HTTPS     ┌─────────────────┐
│  Claude Desktop │ ◄────────────► │   mcp-remote    │ ◄───────────► │  MCP Medusa     │
│  Windsurf       │                │   (npx bridge)  │               │  (Digital Ocean)│
│  Cursor         │                └─────────────────┘               └────────┬────────┘
└─────────────────┘                                                           │
                                                                     ┌────────▼────────┐
                                                                     │  Medusa Backend │
                                                                     └─────────────────┘
```

1. Your IDE spawns `mcp-remote` as a local process
2. `mcp-remote` connects to the remote MCP server via Streamable HTTP
3. Commands from the IDE are forwarded to the remote server
4. Responses are returned back through the bridge

### Advantages of mcp-remote

- **Shared deployment**: Multiple team members use the same MCP server
- **Centralized Medusa access**: One secure connection to your Medusa backend
- **No local credentials**: API keys stay on the server, only auth token needed locally
- **Works with any MCP-compatible IDE**: Claude Desktop, Windsurf, Cursor, etc.

---

## Configuration Reference

| Variable | Required | Mode | Description | Example |
|----------|----------|------|-------------|---------|
| `MEDUSA_BASE_URL` | Yes | All | Your Medusa backend URL | `http://localhost:9000` |
| `MEDUSA_AUTH_TYPE` | No | All | `api-key`, `jwt`, or `session` | `api-key` |
| `MEDUSA_API_KEY` | Auth-dependent | All | Admin API key, or JWT token when `MEDUSA_AUTH_TYPE=jwt` | `sk_admin_...` |
| `MEDUSA_API_KEY_BASE64` | No | API key | Set `true` for legacy base64 Basic auth encoding | `false` |
| `MEDUSA_JWT` | Auth-dependent | JWT | JWT token for bearer auth | `eyJ...` |
| `MEDUSA_SESSION_COOKIE` | Auth-dependent | Session | Admin session cookie | `connect.sid=...` |
| `MCP_AUTH_MODE` | No | HTTP | `static` for `MCP_AUTH_TOKEN`, or `oauth` for OAuth 2.1 JWT validation | `static` |
| `MCP_AUTH_TOKEN` | Remote only | HTTP | Token for client authentication | `openssl rand -base64 32` |
| `MCP_RESOURCE_URL` | OAuth | HTTP | Public MCP server URL used in OAuth protected resource metadata | `https://mcp.example.com` |
| `OAUTH_ISSUER` | OAuth | HTTP | Expected JWT issuer and authorization server URL | `https://issuer.example.com` |
| `OAUTH_AUDIENCE` | OAuth | HTTP | Expected JWT audience | `https://mcp.example.com` |
| `OAUTH_JWKS_URI` | OAuth | HTTP | JWKS URL used to verify access tokens | `https://issuer.example.com/.well-known/jwks.json` |
| `OAUTH_REQUIRED_SCOPES` | OAuth | HTTP | Space or comma separated scopes required on access tokens | `mcp:access` |

### OAuth 2.1 for Remote MCP

Set `MCP_AUTH_MODE=oauth` to protect the HTTP MCP endpoints with OAuth 2.1 bearer tokens instead of a shared static token. The server validates JWT access tokens against `OAUTH_JWKS_URI`, checks optional `OAUTH_ISSUER`, `OAUTH_AUDIENCE`, and `OAUTH_REQUIRED_SCOPES`, and exposes discovery metadata at:

- `/.well-known/oauth-protected-resource`
- `/.well-known/oauth-authorization-server`

### Getting Your Medusa API Key

1. Access your Medusa Admin dashboard
2. Go to **Settings** → **API Keys**
3. Create a new API key with admin permissions
4. Copy the key and add it to your configuration

### Verify Installation

After configuring Claude Desktop:
1. Restart Claude Desktop completely
2. Look for the MCP server indicator (hammer icon) in the chat interface
3. The server should show a green status indicator when connected

## 🔧 Tool Examples

### Orders Management
```javascript
// List orders with filtering
{
  "action": "list",
  "limit": 10,
  "status": "pending"
}

// Get specific order
{
  "action": "get",
  "id": "order_01234567890"
}

// Complete an order
{
  "action": "complete",
  "id": "order_01234567890"
}
```

### Products Management
```javascript
// List products
{
  "action": "list",
  "limit": 20,
  "status": "published"
}

// Create new product
{
  "action": "create",
  "title": "New Product",
  "description": "Product description",
  "handle": "new-product"
}
```

### Customers Management
```javascript
// List customers
{
  "action": "list",
  "limit": 50
}

// Create customer
{
  "action": "create",
  "email": "customer@example.com",
  "first_name": "John",
  "last_name": "Doe"
}
```

## 📊 Available Tools Reference

| Tool | Description | Key Actions |
|------|-------------|-------------|
| `manage_medusa_admin_orders` | Order management & fulfillment | `list`, `get`, `cancel`, `complete`, `archive`, `transfer`, `transfer_to_guest`, `create_fulfillment`, `create_shipment`, `mark_as_delivered` |
| `manage_medusa_admin_draft_orders` | Draft orders (line items via Medusa's edit flow) | `create`, `list`, `get`, `update`, `delete`, `begin_edit`, `confirm_edit`, `convert_to_order` |
| `manage_medusa_admin_products` | Product & variant management | `list`, `get`, `create`, `update`, `delete`, `list_variants` |
| `manage_medusa_admin_customers` | Customer & group management | `list`, `get`, `create`, `update`, `delete`, `list_groups` |
| `manage_medusa_admin_collections` | Collection management | `list`, `get`, `create`, `update`, `delete`, `add_products` |
| `manage_medusa_admin_inventory` | Inventory & stock management | `list_items`, `list_locations`, `list_levels`, `create_reservation` |
| `manage_medusa_admin_regions` | Regions & shipping | `list_regions`, `list_shipping_options`, `create_region` |
| `manage_medusa_admin_pricing` | Pricing & promotions | `list_price_lists`, `list_promotions`, `list_campaigns` |
| `manage_medusa_admin_payments` | Payment operations | `list_payments`, `capture_payment`, `refund_payment`, `mark_payment_collection_as_paid` |
| `manage_medusa_admin_returns` | Returns, exchanges, claims & order edits | `list_returns`, `receive_return`, `list_claims`, `create_order_edit`, `request_order_edit` |
| `manage_medusa_admin_gift_cards` | Gift card management | `list`, `get`, `create`, `update`, `list_orders` |
| `manage_medusa_admin_taxes` | Tax management | `list_tax_rates`, `list_tax_regions`, `create_tax_rate` |
| `manage_medusa_admin_sales_channels` | Sales channel management | `list`, `get`, `create`, `add_products` |
| `manage_medusa_admin_users` | User & auth management | `list_users`, `list_invites`, `list_api_keys` |
| `manage_medusa_admin_v2` | Newer v2 resources (search, search indexes, store credit…) + generic request | `list`, `get`, `search`, `request` |
| `manage_minimalart_extensions` | Boilerplate content extras (banners, blog, brands, landings, media, videos, dashboards) | `list`, `get`, `create`, `update`, `delete`, `sub_action`, `describe` |
| `manage_minimalart_commerce` | Loyalty, gift-card experience, recurring orders, abandoned carts, bundles, B2B | same engine |
| `manage_minimalart_logistics` | Andreani, Correo Argentino, own delivery, pickup | same engine |
| `manage_minimalart_integrations` | ERP, Typesense, GA4, Clarity, Merchant, newsletter, MercadoLibre | same engine |
| `manage_minimalart_whatsapp` | Kapso templates, bot, flows, conversations | same engine |
| `manage_minimalart_growth` | SEO/GEO, recommendations, catalogador, comments, PDF catalogs | same engine |
| `manage_minimalart_stores` | Multistore sites, store config, catalog imports, app settings | same engine |
| `manage_minimalart_ai_assistant` | Backoffice AI agents, skills, workflows, MCP servers | same engine |
| `manage_store_memory` | Store AI memory (search, save as pending), documents, proposals | same engine |
| `report_mcp_feedback` | Report problems with the MCP itself (does not touch store data) | `message`, `tool_name`, `severity` |

## 🧪 Testing with Claude

Once configured, try these prompts with Claude:

1. *"Show me the latest orders from my Medusa store"*
2. *"Create a new product called 'Test Product' with a price of $29.99"*
3. *"List the most recent customers and their details"*
4. *"Check the inventory levels for all products"*
5. *"Create a new customer group called 'VIP'"*

## 🔒 Security Best Practices

- **Never share your API keys** - Keep them secure and private
- **Use HTTPS in production** - Configure `MEDUSA_BASE_URL` with HTTPS
- **Rotate API keys regularly** - Generate new admin API keys periodically
- **Limit API key permissions** - Use admin users with appropriate role restrictions

---

# Development & Contributing

The following sections are for developers who want to contribute to this project or run it locally for development purposes.

## 📥 Local Development Setup

**1. Clone the repository**

```bash
git clone https://github.com/minimalart/mcp-medusa.git
cd mcp-medusa
```

**2. Install dependencies**

```bash
npm install
```

**3. Configure environment variables**

```bash
cp env.example .env
```

Update `.env` with your Medusa configuration:

```env
MEDUSA_BASE_URL=http://localhost:9000
MEDUSA_API_KEY=your_admin_api_key_or_jwt_token
```

## 🏃‍♂️ Running Locally

**STDIO Mode (for Claude Desktop testing):**
```bash
npm run dev
# or
node mcpServer.js
```

**HTTP Mode (for web apps and mcp-remote):**
```bash
npm run dev:http
# or
node server/index.js
```

**Vercel Local Development:**
```bash
npm run dev:vercel
```

## 🛠️ CLI Commands

**List available tools:**
```bash
npm run list-tools
```

**Test Medusa connectivity:**
```bash
node test-medusa-tools.js
```

**Test MCP tools:**
```bash
node test-mcp-tools.js
```

## 🧪 Testing with MCP Inspector

```bash
# STDIO mode
npx @modelcontextprotocol/inspector@latest node mcpServer.js

# Vercel dev mode (requires Vercel dev running)
npx @modelcontextprotocol/inspector@latest http://localhost:3000/api/mcp
```

## 🐳 Docker

**Build image:**
```bash
docker build -t medusa-mcp .
```

**Run with environment file:**
```bash
docker run -i --rm --env-file=.env medusa-mcp
```

## ☁️ Vercel Deployment

```bash
# Deploy to production
vercel --prod
```

Set environment variables in Vercel dashboard:
- `MEDUSA_BASE_URL`
- `MEDUSA_API_KEY`

## 📂 Project Structure

```
mcp-medusa/
├── mcpServer.js              # STDIO transport (local IDEs)
├── server/
│   ├── index.js              # HTTP transport (remote/web)
│   ├── transports/
│   │   └── streamable-http.js # Streamable HTTP implementation
│   └── middleware/
│       └── auth.js           # Bearer token authentication
├── lib/
│   ├── tools.js              # Tool discovery system
│   └── constants.js          # Shared configuration
├── tools/
│   └── medusa-admin-api/     # All Medusa admin tools
│       ├── medusa-admin-orders.js
│       ├── medusa-admin-products.js
│       ├── medusa-admin-customers.js
│       └── ...
├── deployment/
│   └── digitalocean/
│       └── app.yaml          # DO App Platform config
├── docs/
│   └── REMOTE-SETUP.md       # Remote deployment guide
├── index.js                  # CLI entry point
└── commands/tools.js         # CLI tool listing command
```

## 🛠️ Adding New Tools

1. Create new tool file in `tools/medusa-admin-api/`
2. Follow the existing tool pattern:
   ```javascript
   export const apiTool = {
     definition: {
       name: 'your_tool_name',
       description: 'Tool description',
       parameters: { /* parameter schema */ }
     },
     function: yourToolFunction
   };
   ```
3. Add tool path to `tools/paths.js`
4. Test with `npm run list-tools`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-tool`
3. Implement your changes
4. Test thoroughly: `npm run list-tools && node test-medusa-tools.js`
5. Submit a pull request

## 📚 Resources

- **[Medusa.js Documentation](https://docs.medusajs.com/)** - Official Medusa documentation
- **[Medusa Admin API Reference](https://docs.medusajs.com/api/admin)** - Complete API reference
- **[Model Context Protocol](https://modelcontextprotocol.io/)** - MCP specification
- **[Claude Desktop](https://claude.ai/desktop)** - AI assistant with MCP support

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 💬 Support

- **Issues**: [Open an issue on GitHub](https://github.com/minimalart/mcp-medusa/issues)
- **Documentation**: Check the Medusa.js documentation for API details
- **Community**: Join the Medusa Discord community for general support

---

**Built for the Medusa.js ecosystem** 🏪 **Powered by Model Context Protocol** 🤖
