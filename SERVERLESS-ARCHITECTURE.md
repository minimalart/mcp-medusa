# Serverless MCP Architecture

## Overview

The Medusa MCP Server has been redesigned with a serverless-native architecture that eliminates connection timeout issues and provides reliable tool access through HTTP endpoints.

## Architecture Changes

### Before: SSE Transport Issues
- **SSE Dependencies**: Required persistent connections incompatible with Vercel functions (10-60s timeout limit)
- **Connection Instability**: SSE connections failed after ~2.7 seconds with HTTP 500 errors
- **Session Management**: Persistent state required for SSE transport, unsuitable for stateless functions

### After: HTTP Transport Solution
- **Pure HTTP**: Request/response pattern suitable for serverless functions
- **Stateless Design**: No persistent connections or session management
- **MCP Protocol Compliance**: Full JSON-RPC over HTTP following MCP specification
- **Optimal Performance**: Cold start optimization for serverless deployment

## API Endpoints

### 1. Main MCP Endpoint
**URL**: `/api/mcp/index.js` or `/api/mcp`
- **Methods**: `GET`, `POST`, `OPTIONS`
- **Purpose**: Unified MCP endpoint supporting all operations
- **GET**: Returns server capabilities and health status
- **POST**: Handles JSON-RPC requests (initialize, tools/list, tools/call)

### 2. Capabilities Endpoint  
**URL**: `/api/mcp/capabilities`
- **Method**: `GET`
- **Purpose**: Server discovery and capability negotiation
- **Response**: Server info, capabilities, protocol version

### 3. Tools Endpoint
**URL**: `/api/mcp/tools` 
- **Method**: `POST`
- **Purpose**: Tool listing and execution
- **Operations**: 
  - `tools/list`: Returns available tools
  - `tools/call`: Executes specific tools

## MCP Protocol Implementation

### JSON-RPC Format
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

### Response Format
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [...]
  }
}
```

### Error Format
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32601,
    "message": "Method not found"
  }
}
```

## Authentication

### Bearer Token Authentication
- **Header**: `Authorization: Bearer <token>`
- **Environment Variable**: `MCP_AUTH_TOKEN`
- **Applied to**: All endpoints
- **Validation**: Required for all non-OPTIONS requests

### Token Generation
```bash
# Generate a secure random token
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Tool Preservation

All 14 Medusa admin tools are preserved with identical functionality:

### Order Management (3 tools)
- `manage_medusa_admin_orders`: Complete order lifecycle management
- `manage_medusa_admin_draft_orders`: Cart-like draft order operations
- Order operations: list, get, create, cancel, complete, archive, transfer, fulfillment

### Product & Catalog (4 tools)
- `manage_medusa_admin_products`: Product & variant CRUD
- `manage_medusa_admin_collections`: Collection management
- `manage_medusa_admin_customers`: Customer & group management
- `manage_medusa_admin_inventory`: Stock management

### Commerce Operations (7 tools)
- `manage_medusa_admin_regions`: Regions & shipping
- `manage_medusa_admin_pricing`: Price lists & promotions
- `manage_medusa_admin_payments`: Payment processing
- `manage_medusa_admin_returns`: Returns & exchanges
- `manage_medusa_admin_gift_cards`: Gift card operations
- `manage_medusa_admin_taxes`: Tax management
- `manage_medusa_admin_sales_channels`: Channel management
- `manage_medusa_admin_users`: User & auth management

## Client Configuration

### Claude Desktop (HTTP Client)
```json
{
  "mcpServers": {
    "medusa-admin": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/client-http", "https://your-deployment.vercel.app/api/mcp"],
      "env": {
        "MCP_AUTH_TOKEN": "your-secure-token"
      }
    }
  }
}
```

### Direct HTTP Client
```javascript
const response = await fetch('https://your-deployment.vercel.app/api/mcp/tools', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-auth-token'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list'
  })
});
```

## Deployment Configuration

### Vercel Function Settings
- **Max Duration**: 10 seconds per function
- **Memory**: Default (128MB)
- **Runtime**: Node.js 20.x
- **Cold Start Optimization**: Minimal dependencies, efficient imports

### Environment Variables
```bash
MEDUSA_BASE_URL=https://your-medusa-backend.com
MEDUSA_API_KEY=sk_your_admin_api_key
MCP_AUTH_TOKEN=your_secure_mcp_token
```

## Testing & Validation

### Test HTTP Transport
```bash
# Set environment variables
export MCP_BASE_URL="https://your-deployment.vercel.app/api/mcp"
export MCP_AUTH_TOKEN="your-auth-token"

# Run transport tests
node test-http-transport.js
```

### Test Individual Endpoints
```bash
# Test capabilities
curl -H "Authorization: Bearer $TOKEN" https://your-deployment.vercel.app/api/mcp/capabilities

# Test tool listing
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  https://your-deployment.vercel.app/api/mcp/tools
```

## Performance Optimizations

### Cold Start Reduction
- **Minimal Dependencies**: Removed express, mcp-handler, zod
- **Efficient Imports**: Dynamic tool loading only when needed
- **Lean Response Format**: Optimized JSON serialization

### Memory Efficiency  
- **Stateless Design**: No persistent state or connection pooling
- **Tool Discovery Caching**: Tools loaded once per request
- **Optimized Headers**: Minimal CORS and content headers

## Migration Benefits

### Reliability
✅ **No Connection Timeouts**: HTTP request/response eliminates persistent connection issues  
✅ **Error Recovery**: Each request is independent, no session state to lose  
✅ **Predictable Performance**: Function execution time is bounded and measurable

### Scalability
✅ **Auto-scaling**: Vercel handles traffic spikes automatically  
✅ **Global Distribution**: Edge network reduces latency  
✅ **Cost Efficiency**: Pay-per-request model, no idle server costs

### Maintainability  
✅ **Simpler Architecture**: Pure HTTP eliminates transport complexity  
✅ **Standard Protocols**: JSON-RPC over HTTP is widely supported  
✅ **Easy Testing**: Standard HTTP tools for debugging and monitoring

## Next Steps

1. **Deploy Updated Version**: Deploy the new HTTP transport to Vercel
2. **Update Client Configuration**: Switch Claude Desktop to HTTP transport
3. **Performance Monitoring**: Monitor function execution times and success rates
4. **Load Testing**: Validate performance under concurrent tool executions
5. **Documentation Updates**: Update main README with new transport information