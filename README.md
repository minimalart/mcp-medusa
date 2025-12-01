# Medusa.js MCP Server

A comprehensive **Model Context Protocol (MCP) server** that provides automated API tools for **Medusa e-commerce backend operations**. This server exposes all major Medusa admin API functionality through MCP-compatible tools for use with AI assistants like Claude Desktop.

## 🏪 About Medusa.js

[Medusa.js](https://medusajs.com/) is a modern, open-source e-commerce platform built for developers. It provides a headless commerce backend with powerful admin APIs for managing products, orders, customers, and all aspects of e-commerce operations.

## 🚀 Features

### Complete Admin API Coverage
This MCP server provides **14 comprehensive admin tools** covering all major Medusa.js operations:

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

MCP Medusa supports **two transport modes**:

| Mode | Transport | Use Case |
|------|-----------|----------|
| **Local** | STDIO | Direct IDE integration (npx) |
| **Remote** | Streamable HTTP | Web apps, remote clients |

---

### Option 1: Local Mode (STDIO) - Recommended for IDEs

Direct integration with Claude Desktop, Windsurf, Cursor, etc.

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

---

### Option 2: Remote Mode (HTTP) - For Web Apps

Deploy to Digital Ocean, then connect from your web application.

**1. Deploy to Digital Ocean:**
```bash
doctl apps create --spec deployment/digitalocean/app.yaml
```

**2. Configure secrets in DO Dashboard:**
- `MEDUSA_BASE_URL` - Your Medusa backend URL
- `MEDUSA_API_KEY` - Admin API key
- `MCP_AUTH_TOKEN` - Secure token for authentication

**3. Connect from your web app:**
```javascript
const response = await fetch('https://your-app.ondigitalocean.app/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_MCP_AUTH_TOKEN'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list'
  })
});
```

See [docs/REMOTE-SETUP.md](docs/REMOTE-SETUP.md) for complete remote setup guide.

---

### Option 3: Remote via mcp-remote (IDEs to Remote Server)

Connect local IDEs to a remote MCP server using `mcp-remote`:

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
        "MCP_AUTH_TOKEN": "your_secure_token"
      }
    }
  }
}
```

---

### Configuration Options

| Variable | Description | Example |
|----------|-------------|---------|
| `MEDUSA_BASE_URL` | Your Medusa backend URL | `http://localhost:9000` |
| `MEDUSA_API_KEY` | Admin API key or JWT token | `sk_admin_...` |
| `MCP_AUTH_TOKEN` | Token for HTTP authentication (remote only) | `openssl rand -base64 32` |

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
| `manage_medusa_admin_orders` | Order management & fulfillment | `list`, `get`, `cancel`, `complete`, `archive`, `transfer` |
| `manage_medusa_admin_draft_orders` | Cart-like draft order operations | `create`, `list`, `get`, `delete`, `convert_to_order` |
| `manage_medusa_admin_products` | Product & variant management | `list`, `get`, `create`, `update`, `delete`, `list_variants` |
| `manage_medusa_admin_customers` | Customer & group management | `list`, `get`, `create`, `update`, `delete`, `list_groups` |
| `manage_medusa_admin_collections` | Collection management | `list`, `get`, `create`, `update`, `delete`, `add_products` |
| `manage_medusa_admin_inventory` | Inventory & stock management | `list_items`, `list_locations`, `list_levels`, `create_reservation` |
| `manage_medusa_admin_regions` | Regions & shipping | `list_regions`, `list_shipping_options`, `create_region` |
| `manage_medusa_admin_pricing` | Pricing & promotions | `list_price_lists`, `list_promotions`, `list_campaigns` |
| `manage_medusa_admin_payments` | Payment operations | `list_payments`, `capture_payment`, `refund_payment` |
| `manage_medusa_admin_returns` | Returns & exchanges | `list_returns`, `list_exchanges`, `list_claims` |
| `manage_medusa_admin_gift_cards` | Gift card management | `list`, `get`, `create`, `update`, `delete` |
| `manage_medusa_admin_taxes` | Tax management | `list_tax_rates`, `list_tax_regions`, `create_tax_rate` |
| `manage_medusa_admin_sales_channels` | Sales channel management | `list`, `get`, `create`, `add_products` |
| `manage_medusa_admin_users` | User & auth management | `list_users`, `list_invites`, `list_api_keys` |

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
