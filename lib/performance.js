// Performance monitoring and optimization utilities

/**
 * High-resolution timer for performance measurements
 */
export class PerformanceTimer {
  constructor(label = 'Operation') {
    this.label = label;
    this.startTime = process.hrtime.bigint();
  }
  
  /**
   * End timer and get duration in milliseconds
   * @returns {number} Duration in milliseconds
   */
  end() {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - this.startTime) / 1_000_000; // Convert to milliseconds
    return duration;
  }
  
  /**
   * End timer and log the result
   * @param {boolean} [logResult=false] - Whether to log the result
   * @returns {number} Duration in milliseconds
   */
  endAndLog(logResult = false) {
    const duration = this.end();
    if (logResult) {
      console.log(`${this.label}: ${duration.toFixed(2)}ms`);
    }
    return duration;
  }
}

/**
 * Memory usage monitoring
 * @returns {Object} Memory usage statistics
 */
export function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024), // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
    external: Math.round(usage.external / 1024 / 1024), // MB
    arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024) // MB
  };
}

/**
 * Request performance middleware
 * @param {string} endpoint - Endpoint name
 * @param {Function} handler - Request handler function
 * @returns {Function} Wrapped handler with performance monitoring
 */
export function withPerformanceMonitoring(endpoint, handler) {
  return async (req, res) => {
    const timer = new PerformanceTimer(`${endpoint} ${req.method}`);
    const startMemory = getMemoryUsage();
    
    try {
      const result = await handler(req, res);
      const duration = timer.end();
      const endMemory = getMemoryUsage();
      
      // Log performance metrics for slow requests
      if (duration > 1000) { // Log requests taking more than 1 second
        console.log(`Slow request detected:`, {
          endpoint,
          method: req.method,
          duration: `${duration.toFixed(2)}ms`,
          memoryDelta: `${endMemory.heapUsed - startMemory.heapUsed}MB`
        });
      }
      
      return result;
    } catch (error) {
      const duration = timer.end();
      console.error(`Request error:`, {
        endpoint,
        method: req.method,
        duration: `${duration.toFixed(2)}ms`,
        error: error.message
      });
      throw error;
    }
  };
}

/**
 * Function execution performance wrapper
 * @param {string} functionName - Function name for logging
 * @param {Function} fn - Function to wrap
 * @returns {Function} Wrapped function
 */
export function withTimingLog(functionName, fn) {
  return async (...args) => {
    const timer = new PerformanceTimer(functionName);
    try {
      const result = await fn(...args);
      const duration = timer.end();
      
      // Log slow operations
      if (duration > 100) {
        console.log(`Slow operation: ${functionName} took ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      timer.end();
      throw error;
    }
  };
}