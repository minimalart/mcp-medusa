#!/usr/bin/env node

/**
 * Load Testing Tool for MCP Server
 * Tests server performance under concurrent load
 */

import { performance } from 'perf_hooks';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import dotenv from 'dotenv';
import os from 'os';

// Load environment variables
dotenv.config();

const BASE_URL = process.env.VERCEL_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;

if (!AUTH_TOKEN) {
  console.error('MCP_AUTH_TOKEN environment variable is required');
  process.exit(1);
}

/**
 * Worker thread function for concurrent requests
 */
if (!isMainThread) {
  const { testConfig, workerIndex } = workerData;
  
  async function runWorkerTest() {
    const results = [];
    const headers = {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json'
    };
    
    for (let i = 0; i < testConfig.requestsPerWorker; i++) {
      const start = performance.now();
      
      try {
        const response = await fetch(`${BASE_URL}/api/mcp/capabilities`, {
          method: 'GET',
          headers
        });
        
        const end = performance.now();
        const duration = end - start;
        
        results.push({
          worker: workerIndex,
          request: i,
          duration,
          status: response.status,
          success: response.ok
        });
        
        // Add small delay to avoid overwhelming the server
        if (testConfig.delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, testConfig.delayMs));
        }
        
      } catch (error) {
        const end = performance.now();
        const duration = end - start;
        
        results.push({
          worker: workerIndex,
          request: i,
          duration,
          status: 0,
          success: false,
          error: error.message
        });
      }
    }
    
    parentPort.postMessage(results);
  }
  
  runWorkerTest().catch(error => {
    parentPort.postMessage({ error: error.message });
  });
}

/**
 * Main load testing function
 */
async function runLoadTest(config = {}) {
  const defaultConfig = {
    concurrentUsers: os.cpus().length,
    requestsPerUser: 10,
    delayMs: 100
  };
  
  const testConfig = { ...defaultConfig, ...config };
  const totalRequests = testConfig.concurrentUsers * testConfig.requestsPerUser;
  
  console.log('🚀 Starting MCP Server Load Test\n');
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`Concurrent Users: ${testConfig.concurrentUsers}`);
  console.log(`Requests per User: ${testConfig.requestsPerUser}`);
  console.log(`Total Requests: ${totalRequests}`);
  console.log(`Delay between requests: ${testConfig.delayMs}ms`);
  console.log('=====================================\n');
  
  const startTime = performance.now();
  const workers = [];
  const allResults = [];
  
  // Create worker threads
  for (let i = 0; i < testConfig.concurrentUsers; i++) {
    const worker = new Worker(import.meta.url, {
      workerData: {
        testConfig: {
          requestsPerWorker: testConfig.requestsPerUser,
          delayMs: testConfig.delayMs
        },
        workerIndex: i
      }
    });
    
    workers.push(new Promise((resolve, reject) => {
      worker.on('message', (results) => {
        if (results.error) {
          reject(new Error(results.error));
        } else {
          allResults.push(...results);
          resolve();
        }
      });
      
      worker.on('error', reject);
    }));
  }
  
  // Wait for all workers to complete
  try {
    await Promise.all(workers);
  } catch (error) {
    console.error('❌ Load test failed:', error.message);
    return;
  }
  
  const endTime = performance.now();
  const totalDuration = endTime - startTime;
  
  // Analyze results
  analyzeLoadTestResults(allResults, totalDuration, testConfig);
}

/**
 * Analyze and display load test results
 */
function analyzeLoadTestResults(results, totalDuration, config) {
  console.log('📋 Load Test Results');
  console.log('===================\n');
  
  const successfulRequests = results.filter(r => r.success);
  const failedRequests = results.filter(r => !r.success);
  const durations = results.map(r => r.duration);
  
  // Basic statistics
  const totalRequests = results.length;
  const successRate = (successfulRequests.length / totalRequests) * 100;
  const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  const sortedDurations = [...durations].sort((a, b) => a - b);
  const medianDuration = sortedDurations[Math.floor(sortedDurations.length / 2)];
  const p95Duration = sortedDurations[Math.floor(sortedDurations.length * 0.95)];
  const p99Duration = sortedDurations[Math.floor(sortedDurations.length * 0.99)];
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);
  
  // Throughput calculations
  const requestsPerSecond = totalRequests / (totalDuration / 1000);
  
  console.log('📈 Performance Metrics:');
  console.log(`   Total Requests: ${totalRequests}`);
  console.log(`   Successful Requests: ${successfulRequests.length}`);
  console.log(`   Failed Requests: ${failedRequests.length}`);
  console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
  console.log(`   Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`   Requests/Second: ${requestsPerSecond.toFixed(2)}`);
  console.log();
  
  console.log('⏱️ Response Time Statistics:');
  console.log(`   Average: ${avgDuration.toFixed(2)}ms`);
  console.log(`   Median: ${medianDuration.toFixed(2)}ms`);
  console.log(`   Min: ${minDuration.toFixed(2)}ms`);
  console.log(`   Max: ${maxDuration.toFixed(2)}ms`);
  console.log(`   95th Percentile: ${p95Duration.toFixed(2)}ms`);
  console.log(`   99th Percentile: ${p99Duration.toFixed(2)}ms`);
  console.log();
  
  // Error analysis
  if (failedRequests.length > 0) {
    console.log('❌ Error Analysis:');
    const errorCounts = {};
    failedRequests.forEach(req => {
      const errorKey = req.error || `Status ${req.status}`;
      errorCounts[errorKey] = (errorCounts[errorKey] || 0) + 1;
    });
    
    Object.entries(errorCounts).forEach(([error, count]) => {
      console.log(`   ${error}: ${count} occurrences`);
    });
    console.log();
  }
  
  // Performance assessment
  console.log('📉 Performance Assessment:');
  
  if (successRate >= 99) {
    console.log('   ✅ Excellent reliability (>99% success rate)');
  } else if (successRate >= 95) {
    console.log('   ⚠️  Good reliability (95-99% success rate)');
  } else {
    console.log('   ❌ Poor reliability (<95% success rate)');
  }
  
  if (p95Duration <= 500) {
    console.log('   ✅ Excellent response times (95th percentile <= 500ms)');
  } else if (p95Duration <= 1000) {
    console.log('   ⚠️  Acceptable response times (95th percentile <= 1s)');
  } else {
    console.log('   ❌ Slow response times (95th percentile > 1s)');
  }
  
  if (requestsPerSecond >= 100) {
    console.log('   ✅ High throughput (>=100 req/s)');
  } else if (requestsPerSecond >= 50) {
    console.log('   ⚠️  Moderate throughput (50-100 req/s)');
  } else {
    console.log('   ❌ Low throughput (<50 req/s)');
  }
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  
  if (failedRequests.length > totalRequests * 0.05) {
    console.log('   - Investigate error causes and improve error handling');
  }
  
  if (p95Duration > 1000) {
    console.log('   - Optimize slow endpoints and consider caching strategies');
  }
  
  if (maxDuration > avgDuration * 10) {
    console.log('   - High response time variability detected - check for performance bottlenecks');
  }
  
  if (requestsPerSecond < 50) {
    console.log('   - Consider increasing server capacity or optimizing code for better throughput');
  }
  
  console.log('\n🏁 Load test completed successfully!');
}

// CLI interface
if (isMainThread && import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const config = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = parseInt(args[i + 1]);
    if (!isNaN(value)) {
      config[key] = value;
    }
  }
  
  runLoadTest(config).catch(console.error);
}

export { runLoadTest };