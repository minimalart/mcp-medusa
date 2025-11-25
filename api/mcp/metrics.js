// Performance Metrics Endpoint - GET /api/mcp/metrics
// Provides real-time performance monitoring and health status

import { globalMetrics } from '../../lib/monitoring.js';
import { authenticateRequest, applyCorsHeaders, handleCorsOptions } from '../../lib/auth.js';
import { HTTP_STATUS } from '../../lib/constants.js';
import { withPerformanceMonitoring } from '../../lib/performance.js';
import dotenv from 'dotenv';

// Initialize environment once
dotenv.config();

async function metricsHandler(req, res) {
  // Apply CORS headers efficiently
  applyCorsHeaders(res);
  
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsOptions(res);
  }
  
  // Fast path for non-GET methods
  if (req.method !== 'GET') {
    return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({ error: 'Method not allowed' });
  }
  
  // Authenticate request
  if (!authenticateRequest(req)) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Unauthorized' });
  }
  
  try {
    const { format = 'json', type = 'summary' } = req.query;
    
    let response;
    
    switch (type) {
      case 'health':
        response = globalMetrics.getHealthStatus();
        break;
      case 'full':
        response = globalMetrics.getMetrics();
        break;
      case 'report':
        response = globalMetrics.generateReport();
        break;
      case 'summary':
      default:
        const metrics = globalMetrics.getMetrics();
        response = {
          uptime: metrics.uptime,
          requests: {
            total: metrics.requests.total,
            successRate: metrics.requests.successRate,
            requestsPerSecond: metrics.requests.requestsPerSecond
          },
          responseTime: {
            average: metrics.responseTime.average,
            p95: metrics.responseTime.p95,
            p99: metrics.responseTime.p99
          },
          memory: {
            current: metrics.memory.current,
            peak: metrics.memory.peak
          },
          tools: {
            executions: metrics.tools.executions
          },
          errors: {
            total: metrics.errors.total
          },
          health: globalMetrics.getHealthStatus().status
        };
        break;
    }
    
    // Format response based on query parameter
    if (format === 'prometheus') {
      // Convert to Prometheus format
      const prometheus = convertToPrometheusFormat(response);
      res.setHeader('Content-Type', 'text/plain');
      return res.status(HTTP_STATUS.OK).send(prometheus);
    }
    
    return res.status(HTTP_STATUS.OK).json(response);
    
  } catch (error) {
    console.error('Metrics endpoint error:', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

/**
 * Convert metrics to Prometheus format
 */
function convertToPrometheusFormat(metrics) {
  const lines = [];
  
  // Helper function to add metric
  const addMetric = (name, value, labels = {}, help = '') => {
    if (help) {
      lines.push(`# HELP ${name} ${help}`);
      lines.push(`# TYPE ${name} gauge`);
    }
    
    const labelStr = Object.entries(labels)
      .map(([key, val]) => `${key}="${val}"`)
      .join(',');
    
    const labelPart = labelStr ? `{${labelStr}}` : '';
    lines.push(`${name}${labelPart} ${value}`);
  };
  
  if (metrics.requests) {
    addMetric('mcp_requests_total', metrics.requests.total || 0, {}, 'Total number of requests');
    addMetric('mcp_requests_success_rate', (metrics.requests.successRate || 0) / 100, {}, 'Success rate of requests');
    addMetric('mcp_requests_per_second', metrics.requests.requestsPerSecond || 0, {}, 'Requests per second');
  }
  
  if (metrics.responseTime) {
    addMetric('mcp_response_time_average_ms', metrics.responseTime.average || 0, {}, 'Average response time in milliseconds');
    addMetric('mcp_response_time_p95_ms', metrics.responseTime.p95 || 0, {}, '95th percentile response time in milliseconds');
    addMetric('mcp_response_time_p99_ms', metrics.responseTime.p99 || 0, {}, '99th percentile response time in milliseconds');
  }
  
  if (metrics.memory) {
    addMetric('mcp_memory_usage_mb', metrics.memory.current || 0, {}, 'Current memory usage in MB');
    addMetric('mcp_memory_peak_mb', metrics.memory.peak || 0, {}, 'Peak memory usage in MB');
  }
  
  if (metrics.tools) {
    addMetric('mcp_tool_executions_total', metrics.tools.executions || 0, {}, 'Total number of tool executions');
  }
  
  if (metrics.errors) {
    addMetric('mcp_errors_total', metrics.errors.total || 0, {}, 'Total number of errors');
  }
  
  addMetric('mcp_uptime_seconds', (metrics.uptime || 0) / 1000, {}, 'Uptime in seconds');
  
  return lines.join('\n') + '\n';
}

// Export handler with performance monitoring
export default withPerformanceMonitoring('metrics', metricsHandler);