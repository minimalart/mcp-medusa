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
- ✅ **Comprehensive error handling** and validation
- ✅ **Environment-based configuration**
- ✅ **Docker deployment ready**

## 🚦 Getting Started

### ⚙️ Prerequisites

- [Node.js v18+ (v20+ recommended)](https://nodejs.org/)
- [npm](https://www.npmjs.com/) (included with Node)
- **Running Medusa.js backend server**
- **Medusa admin API key or JWT token**

### 📥 Download & Local Setup

**1. Clone or Download the Repository**

```bash
# Clone from GitHub
git clone https://github.com/your-username/mcp_medusa.git
cd mcp_medusa

# OR download and extract ZIP file
wget https://github.com/your-username/mcp_medusa/archive/main.zip
unzip main.zip
cd mcp_medusa-main
```

**2. Install dependencies**

```bash
npm install
```

**3. Configure environment variables**

Copy the example environment file and configure your Medusa settings:

```bash
cp env.example .env
```

Update `.env` with your Medusa configuration:

```env
MEDUSA_BASE_URL=http://localhost:9000
MEDUSA_API_KEY=your_admin_api_key_or_jwt_token
```


### 🏃‍♂️ Running the Server Locally

#### Quick Start - Local Execution

**1. Verify your setup:**
```bash
# Check if environment is configured
cat .env

# List available tools to verify installation
npm run list-tools
```

**2. Start the MCP server:**

**STDIO Mode (recommended for Claude Desktop):**
```bash
# Using npm script
npm run dev

# OR using node directly
node mcpServer.js
```

**SSE Mode (for web-based clients):**
```bash
node mcpServer.js --sse
```

**3. Test the server:**
```bash
# Test connectivity to your Medusa backend
node test-medusa-tools.js

# Test MCP tools functionality
node test-mcp-tools.js
```

**4. Verify server is running:**
- **STDIO Mode**: Server will wait for JSON-RPC messages on stdin
- **SSE Mode**: Server will show "MCP Server running on http://localhost:3000"

#### Advanced Local Development

**Vercel Local Development (with serverless functions):**
```bash
npm run dev:vercel
# Server available at: http://localhost:3000/api/mcp
```

#### 🔧 Local Execution Troubleshooting

**Common Issues:**

1. **Missing environment variables:**
   ```bash
   # Error: MEDUSA_BASE_URL or MEDUSA_API_KEY not set
   cp env.example .env
   # Edit .env with your Medusa configuration
   ```

2. **Connection refused to Medusa backend:**
   ```bash
   # Verify Medusa server is running
   curl http://localhost:9000/admin/auth
   
   # Check your MEDUSA_BASE_URL in .env
   echo $MEDUSA_BASE_URL
   ```

3. **Permission denied errors:**
   ```bash
   # Verify API key has admin permissions
   curl -H "Authorization: Bearer $MEDUSA_API_KEY" \
        http://localhost:9000/admin/users/me
   ```

4. **Port conflicts:**
   ```bash
   # If port 3000 is in use (for SSE mode)
   node mcpServer.js --sse --port 3001
   ```

#### ☁️ Vercel Deployment

Deploy your MCP server to Vercel for serverless hosting:

```bash
# Deploy to Vercel
vercel

# Deploy to production
vercel --prod
```

**Set environment variables in Vercel:**
- `MEDUSA_BASE_URL` - Your Medusa backend URL  
- `MEDUSA_API_KEY` - Your Medusa admin API key

After deployment, your MCP server will be available at:
```
https://your-project.vercel.app/api/mcp
```

📖 **See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed Vercel deployment instructions.**

## 🛠️ CLI Commands

### List Available Tools
View all available tools and their descriptions:

```bash
npm run list-tools
# or
node index.js tools
```

### Test Tools
Run comprehensive tests on your Medusa tools:

```bash
node test-medusa-tools.js
```

## 🧪 Testing

### MCP Inspector

Test your MCP server using the official MCP Inspector:

```bash
# For local STDIO mode (IMPORTANT: Use direct node command, not npm scripts)
npx @modelcontextprotocol/inspector@latest node mcpServer.js

# For Vercel dev mode - requires 2 terminals:
# Terminal 1: Start Vercel dev server
npm run dev:vercel

# Terminal 2: Connect MCP Inspector (after Vercel dev is running)
npx @modelcontextprotocol/inspector@latest http://localhost:3000/api/mcp

# For Vercel deployment (production)
npx @modelcontextprotocol/inspector@latest https://your-project.vercel.app/api/mcp
```

**⚠️ Important**: When testing STDIO mode, always use `node mcpServer.js` directly, not `npm run dev`. npm scripts output additional text that interferes with JSON-RPC communication.

## 🔧 Tool Examples

### Orders Management
```javascript
// List orders with filtering
{
  "action": "list",
  "limit": 10,
  "status": "pending",
  "payment_status": "authorized"
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

// Manage product variants
{
  "action": "list_variants",
  "id": "prod_01234567890"
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

// Manage customer groups
{
  "action": "list_groups"
}
```

## 🤖 Claude Desktop Integration

### Step 1: Get Absolute Paths
```bash
# Get node path
which node

# Get server path
realpath mcpServer.js
```

### Step 2: Configure Claude Desktop
Open Claude Desktop → **Settings** → **Developers** → **Edit Config**:

**Basic Configuration:**
```json
{
  "mcpServers": {
    "medusa-admin": {
      "command": "/usr/local/bin/node",
      "args": ["/absolute/path/to/your/mcpServer.js"]
    }
  }
}
```

**With Environment Variables (recommended):**
```json
{
  "mcpServers": {
    "medusa-admin": {
      "command": "/usr/local/bin/node",
      "args": ["/absolute/path/to/your/mcpServer.js"],
      "env": {
        "MEDUSA_BASE_URL": "http://localhost:9000",
        "MEDUSA_API_KEY": "your_admin_api_key_here"
      }
    }
  }
}
```

**Using .env file (most secure):**
```json
{
  "mcpServers": {
    "medusa-admin": {
      "command": "/usr/local/bin/node",
      "args": ["/absolute/path/to/your/mcpServer.js"],
      "cwd": "/absolute/path/to/your/project/directory"
    }
  }
}
```

### Step 3: Restart Claude Desktop
Restart Claude Desktop and verify the MCP server shows a green status indicator.

## 🐳 Docker Deployment

### Build Image
```bash
docker build -t medusa-mcp .
```

### Run with Environment File
```bash
docker run -i --rm --env-file=.env medusa-mcp
```

### Claude Desktop Docker Configuration

**Using .env file (recommended):**
```json
{
  "mcpServers": {
    "medusa-admin": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "--env-file=.env", "medusa-mcp"]
    }
  }
}
```

**Using direct environment variables:**
```json
{
  "mcpServers": {
    "medusa-admin": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "MEDUSA_BASE_URL=http://localhost:9000",
        "-e", "MEDUSA_API_KEY=your_admin_api_key_here",
        "medusa-mcp"
      ]
    }
  }
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

## 🔒 Security Best Practices

- **Never commit `.env` files** - Add to `.gitignore`
- **Use HTTPS in production** - Configure `MEDUSA_BASE_URL` with HTTPS
- **Rotate API keys regularly** - Generate new admin API keys periodically
- **Limit API key permissions** - Use admin users with appropriate role restrictions
- **Monitor API usage** - Track API calls and rate limits

## 🧪 Testing

### Test Individual Tools
```bash
# Test connectivity and basic operations
node test-medusa-tools.js

# Test specific MCP tools
node test-mcp-tools.js
```

### Test with Claude
1. Ask Claude to list your orders: *"Show me the latest orders from my Medusa store"*
2. Create a new product: *"Create a new product called 'Test Product' with a price of $29.99"*
3. Manage customers: *"List the most recent customers and their details"*

## 🛠️ Development

### Adding Custom Tools
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

### Tool Structure
Each tool follows a consistent pattern:
- **Authentication** - Bearer token using `MEDUSA_API_KEY`
- **Error handling** - Comprehensive error catching and reporting
- **Parameter validation** - Required parameter checking
- **Action routing** - Switch statement for different operations
- **Response formatting** - Consistent JSON responses

## 📚 Resources

- **[Medusa.js Documentation](https://docs.medusajs.com/)** - Official Medusa documentation
- **[Medusa Admin API Reference](https://docs.medusajs.com/api/admin)** - Complete API reference
- **[Model Context Protocol](https://modelcontextprotocol.io/)** - MCP specification
- **[Claude Desktop](https://claude.ai/desktop)** - AI assistant with MCP support

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-tool`
3. Implement your changes
4. Test thoroughly: `npm run list-tools && node test-medusa-tools.js`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 💬 Support

- **Issues**: Open an issue on GitHub for bugs or feature requests
- **Documentation**: Check the Medusa.js documentation for API details
- **Community**: Join the Medusa Discord community for general support

---

**Built for the Medusa.js ecosystem** 🏪 **Powered by Model Context Protocol** 🤖