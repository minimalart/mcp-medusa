# Deployment Guide

This guide explains how to deploy MCP Medusa for different use cases.

## Overview

MCP Medusa supports multiple deployment options:

| Deployment | Transport | Use Case | Cost |
|------------|-----------|----------|------|
| npm (npx) | STDIO | Local IDEs (Claude Desktop, Windsurf) | Free |
| Digital Ocean App Platform | Streamable HTTP | Remote HTTP for web apps | $5-25/mo |
| Vercel | HTTP (Serverless) | Serverless HTTP (30s timeout) | Free-$20/mo |
| Docker | HTTP | Self-hosted | Varies |

## Quick Reference

| Mode | Command | Entry Point |
|------|---------|-------------|
| Local STDIO | `npx mcp-medusa` | `mcpServer.js` |
| Local HTTP | `npm run dev:http` | `server/index.js` |
| Vercel | `vercel --prod` | `api/mcp/index.js` |
| Digital Ocean | `doctl apps create` | `server/index.js` |

---

## Digital Ocean App Platform (Recommended for Remote)

Best for: Production remote access, web app integration, mcp-remote clients.

### Prerequisites

1. [Digital Ocean account](https://www.digitalocean.com/)
2. [doctl CLI](https://docs.digitalocean.com/reference/doctl/how-to/install/)
3. GitHub repository

### Quick Deploy

```bash
# 1. Install doctl
brew install doctl  # macOS
snap install doctl  # Linux

# 2. Authenticate
doctl auth init

# 3. Create app from spec
doctl apps create --spec deployment/digitalocean/app.yaml
```

### Configure Secrets

**Via Dashboard:**
1. Go to Apps > mcp-medusa > Settings > App-Level Environment Variables
2. Add as secrets:
   - `MEDUSA_BASE_URL` - Your Medusa backend URL
   - `MEDUSA_API_KEY` - Admin API key
   - `MCP_AUTH_TOKEN` - Auth token for clients (generate with `openssl rand -base64 32`)

**Via CLI:**
```bash
# Generate secure token
TOKEN=$(openssl rand -base64 32)
echo "Your MCP_AUTH_TOKEN: $TOKEN"

# Get app ID
doctl apps list

# Note: Use Dashboard for secrets (CLI doesn't support SECRET type well)
```

### App Spec

The configuration is in `deployment/digitalocean/app.yaml`:

```yaml
name: mcp-medusa
region: nyc

services:
  - name: mcp-server
    github:
      repo: your-org/mcp-medusa
      branch: main
      deploy_on_push: true
    build_command: npm ci
    run_command: node server/index.js
    http_port: 3000
    instance_count: 1
    instance_size_slug: basic-xs  # $5/mo
    health_check:
      http_path: /health
      initial_delay_seconds: 10
      period_seconds: 30
```

### Scaling Options

```yaml
# Vertical scaling
instance_size_slug: basic-xs   # $5/mo,  512MB RAM
instance_size_slug: basic-s    # $12/mo, 1GB RAM
instance_size_slug: basic-m    # $24/mo, 2GB RAM

# Horizontal scaling
instance_count: 3
```

### Monitoring

```bash
# View logs
doctl apps logs <app-id> --type=run

# List deployments
doctl apps list-deployments <app-id>

# Trigger new deployment
doctl apps create-deployment <app-id>
```

### Endpoints (Digital Ocean)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Liveness check |
| `/ready` | GET | No | Readiness check |
| `/mcp` | POST | Bearer | MCP JSON-RPC |
| `/sse` | GET | Bearer | Legacy SSE for mcp-remote |
| `/message` | POST | Bearer | Legacy message for mcp-remote |

---

## Vercel (Alternative)

Best for: Quick deployment, serverless, existing Vercel infrastructure.

### Limitations

- 30 second function timeout (may affect long operations)
- No persistent connections for true SSE
- Serverless cold starts (~500ms)

### Deploy

```bash
# Install CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### Environment Variables

Set in Vercel Dashboard or CLI:
```bash
vercel env add MEDUSA_BASE_URL
vercel env add MEDUSA_API_KEY
vercel env add MCP_AUTH_TOKEN
```

### Endpoints (Vercel)

| Endpoint | Description |
|----------|-------------|
| `/api/mcp/` | Main MCP endpoint |
| `/api/mcp/capabilities` | Server capabilities |
| `/api/mcp/metrics` | Performance metrics |

---

## npm / npx (Local STDIO)

Best for: Development, direct IDE integration, team members using Windsurf/Claude Desktop.

### Usage

```bash
# No installation needed
npx mcp-medusa
```

### Claude Desktop Configuration

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

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

## mcp-remote (Remote via Local IDE)

Best for: Using local IDE (Claude Desktop, Windsurf) with a remote MCP server.

### Configuration

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

## Docker

Best for: Self-hosted deployments, container orchestration.

### Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "server/index.js"]
```

### Build & Run

```bash
# Build
docker build -t mcp-medusa .

# Run with env file
docker run -d \
  --name mcp-medusa \
  -p 3000:3000 \
  --env-file .env \
  mcp-medusa

# Run with inline env
docker run -d \
  --name mcp-medusa \
  -p 3000:3000 \
  -e MEDUSA_BASE_URL=https://your-medusa.com \
  -e MEDUSA_API_KEY=sk_... \
  -e MCP_AUTH_TOKEN=your-token \
  mcp-medusa
```

### Docker Compose

```yaml
version: '3.8'

services:
  mcp-medusa:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MEDUSA_BASE_URL=${MEDUSA_BASE_URL}
      - MEDUSA_API_KEY=${MEDUSA_API_KEY}
      - MCP_AUTH_TOKEN=${MCP_AUTH_TOKEN}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

## Testing

### MCP Inspector

```bash
# Test STDIO mode
npx @modelcontextprotocol/inspector@latest node mcpServer.js

# Test HTTP mode (local)
npm run dev:http &
npx @modelcontextprotocol/inspector@latest http://localhost:3000/mcp

# Test Vercel (local)
npm run dev:vercel &
npx @modelcontextprotocol/inspector@latest http://localhost:3000/api/mcp
```

### cURL Tests

```bash
# Health check
curl http://localhost:3000/health

# Initialize (with auth)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'

# List tools
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

---

## Security Checklist

- [ ] Use HTTPS in production (automatic on DO/Vercel)
- [ ] Generate strong MCP_AUTH_TOKEN: `openssl rand -base64 32`
- [ ] Rotate tokens periodically
- [ ] Never commit secrets to git
- [ ] Monitor access logs for anomalies
- [ ] Set up deployment alerts

---

## Troubleshooting

### Common Issues

**App won't start:**
```bash
# Check logs
doctl apps logs <app-id> --type=run

# Verify env vars are set
curl https://your-app.ondigitalocean.app/ready
```

**Authentication failing:**
```bash
# Test token
curl -X POST https://your-app.ondigitalocean.app/mcp \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"ping"}'

# Should return: {"jsonrpc":"2.0","id":1,"result":{"pong":true}}
```

**Tools not loading:**
```bash
# Check readiness
curl https://your-app.ondigitalocean.app/ready
# Expected: {"status":"ready","toolsCount":14,...}
```

**MCP Inspector errors:**
- Use `node mcpServer.js` directly, not `npm run dev`
- npm scripts add output that breaks JSON-RPC

---

## Cost Comparison

| Provider | Plan | Monthly | Best For |
|----------|------|---------|----------|
| Digital Ocean | Basic XS | $5 | Production, 1K-10K req/day |
| Digital Ocean | Basic S | $12 | Higher traffic |
| Digital Ocean | Basic M | $24 | Heavy usage |
| Vercel | Hobby | Free | Testing, low traffic |
| Vercel | Pro | $20 | Production serverless |
| Self-hosted | VPS | $5-20 | Full control |

**Recommendation:** Digital Ocean Basic XS ($5/mo) for most production use cases.
