// Advanced performance monitoring and metrics collection
// Provides real-time insights into MCP server performance

import { performance } from 'perf_hooks';
import { getCacheStats } from './tools.js';

/**
 * Metrics collector for performance monitoring
 */
class MetricsCollector {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        byEndpoint: {}
      },
      responseTime: {
        total: 0,
        count: 0,
        min: Infinity,
        max: 0,
        p95: 0,
        p99: 0,
        history: []
      },
      memory: {
        peak: 0,
        current: 0,
        samples: []
      },
      tools: {
        executions: 0,
        totalTime: 0,
        byTool: {}
      },
      errors: {
        total: 0,
        byType: {},
        recent: []
      }
    };
    
    this.startTime = Date.now();
    
    // Start periodic memory sampling
    this.startMemoryMonitoring();
  }
  
  /**
   * Record a request
   */
  recordRequest(endpoint, duration, success = true, error = null) {
    this.metrics.requests.total++;
    
    if (success) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
      this.recordError(error || 'Unknown error', endpoint);
    }
    
    // Track by endpoint
    if (!this.metrics.requests.byEndpoint[endpoint]) {
      this.metrics.requests.byEndpoint[endpoint] = {
        total: 0,
        successful: 0,
        failed: 0,
        avgDuration: 0,
        totalDuration: 0
      };
    }
    
    const endpointMetrics = this.metrics.requests.byEndpoint[endpoint];
    endpointMetrics.total++;
    endpointMetrics.totalDuration += duration;
    endpointMetrics.avgDuration = endpointMetrics.totalDuration / endpointMetrics.total;
    
    if (success) {
      endpointMetrics.successful++;
    } else {
      endpointMetrics.failed++;
    }
    
    this.recordResponseTime(duration);
  }
  
  /**
   * Record response time
   */
  recordResponseTime(duration) {
    this.metrics.responseTime.total += duration;
    this.metrics.responseTime.count++;
    this.metrics.responseTime.min = Math.min(this.metrics.responseTime.min, duration);
    this.metrics.responseTime.max = Math.max(this.metrics.responseTime.max, duration);
    
    // Keep history for percentile calculations
    this.metrics.responseTime.history.push(duration);
    
    // Limit history size to prevent memory leaks
    if (this.metrics.responseTime.history.length > 1000) {
      this.metrics.responseTime.history = this.metrics.responseTime.history.slice(-1000);
    }
    
    // Calculate percentiles
    const sorted = [...this.metrics.responseTime.history].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);
    
    this.metrics.responseTime.p95 = sorted[p95Index] || 0;
    this.metrics.responseTime.p99 = sorted[p99Index] || 0;
  }
  
  /**
   * Record tool execution
   */
  recordToolExecution(toolName, duration, success = true) {
    this.metrics.tools.executions++;
    this.metrics.tools.totalTime += duration;
    
    if (!this.metrics.tools.byTool[toolName]) {
      this.metrics.tools.byTool[toolName] = {
        executions: 0,
        totalTime: 0,
        avgTime: 0,
        successful: 0,
        failed: 0
      };
    }
    
    const toolMetrics = this.metrics.tools.byTool[toolName];
    toolMetrics.executions++;
    toolMetrics.totalTime += duration;
    toolMetrics.avgTime = toolMetrics.totalTime / toolMetrics.executions;
    
    if (success) {
      toolMetrics.successful++;
    } else {
      toolMetrics.failed++;
    }
  }
  
  /**
   * Record an error
   */
  recordError(error, context = null) {
    this.metrics.errors.total++;
    
    const errorType = typeof error === 'string' ? error : error.message || 'Unknown';
    this.metrics.errors.byType[errorType] = (this.metrics.errors.byType[errorType] || 0) + 1;
    
    // Keep recent errors for debugging
    this.metrics.errors.recent.push({
      error: errorType,
      context,
      timestamp: Date.now()
    });
    
    // Limit recent errors
    if (this.metrics.errors.recent.length > 100) {
      this.metrics.errors.recent = this.metrics.errors.recent.slice(-100);
    }
  }
  
  /**
   * Start memory monitoring
   */
  startMemoryMonitoring() {
    setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsed = Math.round(usage.heapUsed / 1024 / 1024); // MB
      
      this.metrics.memory.current = heapUsed;
      this.metrics.memory.peak = Math.max(this.metrics.memory.peak, heapUsed);
      
      this.metrics.memory.samples.push({
        timestamp: Date.now(),
        heapUsed,
        rss: Math.round(usage.rss / 1024 / 1024)
      });
      
      // Limit samples
      if (this.metrics.memory.samples.length > 100) {
        this.metrics.memory.samples = this.metrics.memory.samples.slice(-100);
      }
    }, 30000); // Sample every 30 seconds
  }
  
  /**
   * Get current metrics
   */
  getMetrics() {
    const uptime = Date.now() - this.startTime;
    const avgResponseTime = this.metrics.responseTime.count > 0 ? 
      this.metrics.responseTime.total / this.metrics.responseTime.count : 0;
    const requestsPerSecond = this.metrics.requests.total / (uptime / 1000);
    const successRate = this.metrics.requests.total > 0 ? 
      (this.metrics.requests.successful / this.metrics.requests.total) * 100 : 0;
    
    return {
      uptime,
      requests: {
        ...this.metrics.requests,
        successRate,
        requestsPerSecond
      },
      responseTime: {
        ...this.metrics.responseTime,
        average: avgResponseTime
      },
      memory: this.metrics.memory,
      tools: this.metrics.tools,
      errors: this.metrics.errors,
      cache: getCacheStats(),
      timestamp: Date.now()
    };
  }
  
  /**
   * Get health status
   */
  getHealthStatus() {
    const metrics = this.getMetrics();
    const health = {
      status: 'healthy',
      checks: {},
      warnings: [],
      errors: []
    };
    
    // Check success rate
    if (metrics.requests.successRate < 95 && metrics.requests.total > 10) {
      health.status = 'unhealthy';
      health.errors.push(`Low success rate: ${metrics.requests.successRate.toFixed(1)}%`);
    } else if (metrics.requests.successRate < 99 && metrics.requests.total > 10) {
      health.warnings.push(`Success rate below optimal: ${metrics.requests.successRate.toFixed(1)}%`);
    }
    health.checks.successRate = metrics.requests.successRate;
    
    // Check response times
    if (metrics.responseTime.p95 > 2000) {
      health.status = 'unhealthy';
      health.errors.push(`High 95th percentile response time: ${metrics.responseTime.p95.toFixed(0)}ms`);
    } else if (metrics.responseTime.p95 > 1000) {
      health.warnings.push(`95th percentile response time: ${metrics.responseTime.p95.toFixed(0)}ms`);
    }
    health.checks.responseTimeP95 = metrics.responseTime.p95;
    
    // Check memory usage
    if (metrics.memory.current > 500) {
      health.status = 'unhealthy';
      health.errors.push(`High memory usage: ${metrics.memory.current}MB`);
    } else if (metrics.memory.current > 250) {
      health.warnings.push(`Memory usage: ${metrics.memory.current}MB`);
    }
    health.checks.memoryUsage = metrics.memory.current;
    
    // Check error rate
    const errorRate = metrics.requests.total > 0 ? 
      (metrics.errors.total / metrics.requests.total) * 100 : 0;
    if (errorRate > 5) {
      health.status = 'unhealthy';
      health.errors.push(`High error rate: ${errorRate.toFixed(1)}%`);
    } else if (errorRate > 1) {
      health.warnings.push(`Error rate: ${errorRate.toFixed(1)}%`);
    }
    health.checks.errorRate = errorRate;
    
    return health;
  }
  
  /**
   * Generate performance report
   */
  generateReport() {
    const metrics = this.getMetrics();
    const health = this.getHealthStatus();
    const uptime = Math.round(metrics.uptime / 1000);
    
    return {
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`,
      health,
      performance: {
        requestsPerSecond: metrics.requests.requestsPerSecond.toFixed(2),
        avgResponseTime: `${metrics.responseTime.average.toFixed(2)}ms`,
        p95ResponseTime: `${metrics.responseTime.p95.toFixed(2)}ms`,
        p99ResponseTime: `${metrics.responseTime.p99.toFixed(2)}ms`,
        successRate: `${metrics.requests.successRate.toFixed(2)}%`,
        memoryUsage: `${metrics.memory.current}MB (peak: ${metrics.memory.peak}MB)`
      },
      requests: {
        total: metrics.requests.total,
        successful: metrics.requests.successful,
        failed: metrics.requests.failed,
        byEndpoint: metrics.requests.byEndpoint
      },
      tools: {
        totalExecutions: metrics.tools.executions,
        avgExecutionTime: metrics.tools.executions > 0 ? 
          `${(metrics.tools.totalTime / metrics.tools.executions).toFixed(2)}ms` : '0ms',
        byTool: metrics.tools.byTool
      },
      errors: {
        total: metrics.errors.total,
        byType: metrics.errors.byType,
        recent: metrics.errors.recent.slice(-10) // Last 10 errors
      },
      cache: metrics.cache
    };
  }
  
  /**
   * Reset metrics
   */
  reset() {
    this.metrics = {
      requests: { total: 0, successful: 0, failed: 0, byEndpoint: {} },
      responseTime: { total: 0, count: 0, min: Infinity, max: 0, p95: 0, p99: 0, history: [] },
      memory: { peak: 0, current: 0, samples: [] },
      tools: { executions: 0, totalTime: 0, byTool: {} },
      errors: { total: 0, byType: {}, recent: [] }
    };
    this.startTime = Date.now();
  }
}

// Global metrics collector instance
const globalMetrics = new MetricsCollector();

/**
 * Performance monitoring middleware
 */
export function createMonitoringMiddleware(endpointName) {
  return (originalHandler) => {
    return async (req, res) => {
      const start = performance.now();
      let success = true;
      let error = null;
      
      try {
        const result = await originalHandler(req, res);
        return result;
      } catch (err) {
        success = false;
        error = err;
        throw err;
      } finally {
        const duration = performance.now() - start;
        globalMetrics.recordRequest(endpointName, duration, success, error);
      }
    };
  };
}

/**
 * Tool execution monitoring
 */
export function monitorToolExecution(toolName, executionFn) {
  return async (...args) => {
    const start = performance.now();
    let success = true;
    
    try {
      const result = await executionFn(...args);
      return result;
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const duration = performance.now() - start;
      globalMetrics.recordToolExecution(toolName, duration, success);
    }
  };
}

export {
  globalMetrics,
  MetricsCollector
};