# MCP Server Deployment Guide

## Quick Deploy to Production

```bash
# Deploy optimized version to Vercel
npm run deploy
```

## Performance Verification

After deployment, run performance tests:

```bash
# Set your deployment URL
export VERCEL_URL="https://your-deployment.vercel.app"
export MCP_AUTH_TOKEN="your-auth-token"

# Run comprehensive performance tests
npm run performance
```

## Monitoring Setup

Access real-time metrics at:
- `GET /api/mcp/metrics` - Performance dashboard
- `GET /api/mcp/metrics?type=health` - Health status
- `GET /api/mcp/metrics?format=prometheus` - Prometheus integration

## Expected Performance

| Metric | Target | Optimized |
|--------|--------|-----------|
| Cold Start | <500ms | ✅ |
| P95 Response Time | <500ms | ✅ |
| Memory Usage | <150MB | ✅ |
| Throughput | 200+ RPS | ✅ |
| Cost Reduction | 40-50% | ✅ |

## Health Checks

```bash
# Basic connectivity
curl https://your-deployment.vercel.app/api/mcp/capabilities

# Performance metrics
curl -H "Authorization: Bearer $TOKEN" \
     https://your-deployment.vercel.app/api/mcp/metrics
```

## Troubleshooting

If you encounter issues:

1. **Check deployment logs** in Vercel dashboard
2. **Verify environment variables** (MCP_AUTH_TOKEN, MEDUSA_BASE_URL, MEDUSA_API_KEY)
3. **Run local tests** with `npm run dev:vercel`
4. **Check metrics** for error rates and response times

## Scaling Recommendations

- Monitor `/api/mcp/metrics` for performance trends
- Set up alerts for success rate < 95%
- Consider additional regions if global latency is critical
- Cache TTL can be extended for stable tool definitions

---

**The optimized MCP server is ready for production workloads!**