# Remote Setup Guide - MCP Medusa

This guide covers deploying MCP Medusa as a remote server for access from web applications and remote IDE clients.

## Overview

MCP Medusa supports two transport modes:

| Mode | Transport | Use Case |
|------|-----------|----------|
| **Local** | STDIO | Direct IDE integration (Windsurf, Claude Desktop) |
| **Remote** | Streamable HTTP | Web apps, remote IDE clients via mcp-remote |

## Prerequisites

- Node.js 20+
- Digital Ocean account (or other cloud provider)
- Medusa backend running and accessible
- `doctl` CLI (for Digital Ocean deployment)

## Quick Start

### 1. Deploy to Digital Ocean App Platform

```bash
# Install doctl CLI
brew install doctl

# Authenticate
doctl auth init

# Create app from spec
doctl apps create --spec deployment/digitalocean/app.yaml
```

### 2. Configure Secrets

In Digital Ocean Dashboard or via CLI, set these secrets:

```bash
# Get your app ID
doctl apps list

# Set secrets
doctl apps update <app-id> \
  --env "MEDUSA_BASE_URL=https://your-medusa-backend.com" \
  --env "MEDUSA_API_KEY=sk_your_admin_key" \
  --env "MCP_AUTH_TOKEN=your_secure_random_token"
```

**Generate a secure token:**
```bash
openssl rand -base64 32
```

### 3. Verify Deployment

```bash
# Health check
curl https://mcp-medusa-xxxxx.ondigitalocean.app/health

# Readiness check
curl https://mcp-medusa-xxxxx.ondigitalocean.app/ready
```

## Usage Scenarios

### Scenario 1: Web Application Integration

Use the HTTP endpoint directly from your web application:

```javascript
const MCP_URL = 'https://mcp-medusa-xxxxx.ondigitalocean.app/mcp';
const MCP_TOKEN = process.env.MCP_AUTH_TOKEN;

// Initialize connection
async function initMCP() {
  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MCP_TOKEN}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        clientInfo: {
          name: 'my-web-app',
          version: '1.0.0'
        }
      }
    })
  });

  return response.json();
}

// List available tools
async function listTools() {
  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MCP_TOKEN}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    })
  });

  return response.json();
}

// Execute a tool
async function callTool(name, args) {
  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MCP_TOKEN}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name, arguments: args }
    })
  });

  return response.json();
}

// Example: List orders
const orders = await callTool('manage_medusa_admin_orders', {
  action: 'list',
  limit: 10
});
```

### Scenario 2: Claude Desktop via mcp-remote

Connect Claude Desktop to the remote server using `mcp-remote`:

**File:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "medusa-remote": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp-medusa-xxxxx.ondigitalocean.app/sse",
        "--header",
        "Authorization:Bearer ${MCP_AUTH_TOKEN}"
      ],
      "env": {
        "MCP_AUTH_TOKEN": "your_secure_token_here"
      }
    }
  }
}
```

**Note:** Use the `/sse` endpoint for mcp-remote compatibility.

### Scenario 3: Windsurf/Cursor via mcp-remote

Similar configuration for other IDEs:

```json
{
  "mcpServers": {
    "medusa-remote": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp-medusa-xxxxx.ondigitalocean.app/sse",
        "--header",
        "Authorization:Bearer ${MCP_AUTH_TOKEN}"
      ],
      "env": {
        "MCP_AUTH_TOKEN": "your_secure_token_here"
      }
    }
  }
}
```

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Health check |
| `/ready` | GET | No | Readiness check (verifies tools load) |
| `/mcp` | POST | Bearer | Main MCP JSON-RPC endpoint |
| `/mcp` | GET | Bearer | SSE stream (optional) |
| `/mcp` | DELETE | Bearer | Terminate session |
| `/sse` | GET | Bearer | Legacy SSE for mcp-remote |
| `/message` | POST | Bearer | Legacy message for mcp-remote |

## MCP Methods

### initialize

Initialize the MCP session.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "clientInfo": {
      "name": "your-app",
      "version": "1.0.0"
    }
  }
}
```

### tools/list

List all available Medusa admin tools.

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

### tools/call

Execute a tool.

```json
{
  "jsonrpc": "2.0",
  "id": 3,
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

## Security Best Practices

### 1. Generate Strong Tokens

```bash
# Generate a 256-bit token
openssl rand -base64 32
```

### 2. Rotate Tokens Regularly

Update `MCP_AUTH_TOKEN` in Digital Ocean secrets periodically.

### 3. Use HTTPS Only

Digital Ocean App Platform provides HTTPS by default. Never expose HTTP.

### 4. Restrict CORS (Production)

Modify `server/middleware/auth.js` to restrict origins:

```javascript
const allowedOrigins = [
  'https://your-app.com',
  'https://admin.your-app.com'
];
```

### 5. Monitor Access

Check Digital Ocean App Platform logs for unusual activity:

```bash
doctl apps logs <app-id> --type=run
```

## Troubleshooting

### Connection Refused

1. Verify app is running: `doctl apps list`
2. Check health endpoint: `curl https://your-app.ondigitalocean.app/health`
3. View logs: `doctl apps logs <app-id>`

### Authentication Failed

1. Verify `MCP_AUTH_TOKEN` is set correctly
2. Check token matches in client configuration
3. Ensure "Bearer " prefix in Authorization header

### Tools Not Loading

1. Check `/ready` endpoint for tool count
2. Verify `MEDUSA_BASE_URL` and `MEDUSA_API_KEY` are set
3. Ensure Medusa backend is accessible from DO network

### mcp-remote Connection Issues

1. Use `/sse` endpoint (not `/mcp`) for mcp-remote
2. Enable debug mode: add `--debug` to mcp-remote args
3. Check `~/.mcp-auth/` for stored credentials

## Scaling

### Horizontal Scaling

Increase instance count in `app.yaml`:

```yaml
instance_count: 3
```

### Vertical Scaling

Upgrade instance size:

```yaml
instance_size_slug: basic-s  # 1GB RAM
# or
instance_size_slug: basic-m  # 2GB RAM
```

### Auto-scaling (Pro plan)

```yaml
instance_count: 1
instance_size_slug: professional-xs
autoscaling:
  min_instance_count: 1
  max_instance_count: 5
  metrics:
    - metric_type: CPU
      threshold: 80
```

## Cost Estimation

| Configuration | Monthly Cost |
|--------------|--------------|
| Basic XS (512MB, 1 vCPU) | $5 |
| Basic S (1GB, 1 vCPU) | $12 |
| Basic M (2GB, 1 vCPU) | $24 |
| Professional XS (dedicated) | $25 |

For 1K-10K requests/day, Basic XS or S is typically sufficient.
