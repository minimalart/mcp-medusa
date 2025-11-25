#!/usr/bin/env node

/**
 * Performance Benchmarking Tool for MCP Server
 * Tests endpoint performance, cold start times, and memory usage
 */

import { performance } from 'perf_hooks';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const BASE_URL = process.env.VERCEL_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;

if (!AUTH_TOKEN) {
  console.error('MCP_AUTH_TOKEN environment variable is required');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json'
};

/**
 * Measure execution time of a function
 */
function measureTime(label, fn) {
  return async (...args) => {
    const start = performance.now();
    try {
      const result = await fn(...args);
      const end = performance.now();
      const duration = end - start;
      return { result, duration, label };
    } catch (error) {
      const end = performance.now();
      const duration = end - start;
      throw { error, duration, label };
    }
  };
}

/**
 * Test endpoint performance
 */
async function testEndpoint(url, method = 'GET', body = null) {
  const options = {
    method,
    headers,
    ...(body && { body: JSON.stringify(body) })
  };

  const response = await fetch(url, options);
  const responseData = await response.json();
  
  return {
    status: response.status,
    data: responseData,
    headers: Object.fromEntries(response.headers.entries())
  };
}

/**
 * Run performance tests
 */
async function runPerformanceTests() {
  console.log('🚀 Starting MCP Server Performance Tests\n');
  console.log(`Testing against: ${BASE_URL}`);
  console.log('=====================================\n');

  const results = [];

  try {
    // Test 1: Capabilities endpoint (should be fastest)
    console.log('📊 Test 1: Capabilities Endpoint');
    const capabilitiesTest = measureTime('capabilities', testEndpoint);
    const capabilitiesResult = await capabilitiesTest(`${BASE_URL}/api/mcp/capabilities`);
    results.push(capabilitiesResult);
    console.log(`   ✅ Duration: ${capabilitiesResult.duration.toFixed(2)}ms`);
    console.log(`   ✅ Status: ${capabilitiesResult.result.status}`);
    console.log();

    // Test 2: Tools list endpoint
    console.log('📊 Test 2: Tools List Endpoint');
    const toolsListBody = {
      jsonrpc: '2.0',
      id: 'test-1',
      method: 'tools/list'
    };
    const toolsListTest = measureTime('tools/list', testEndpoint);
    const toolsListResult = await toolsListTest(`${BASE_URL}/api/mcp/tools`, 'POST', toolsListBody);
    results.push(toolsListResult);
    console.log(`   ✅ Duration: ${toolsListResult.duration.toFixed(2)}ms`);
    console.log(`   ✅ Status: ${toolsListResult.result.status}`);
    console.log(`   ✅ Tools found: ${toolsListResult.result.data.result?.tools?.length || 0}`);
    console.log();

    // Test 3: Tool execution (if tools are available)
    if (toolsListResult.result.data.result?.tools?.length > 0) {
      const firstTool = toolsListResult.result.data.result.tools[0];
      console.log(`📊 Test 3: Tool Execution (${firstTool.name})`);
      
      const toolExecutionBody = {
        jsonrpc: '2.0',
        id: 'test-2',
        method: 'tools/call',
        params: {
          name: firstTool.name,
          arguments: { action: 'list', limit: 5 } // Safe parameters
        }
      };
      
      const toolExecutionTest = measureTime('tool_execution', testEndpoint);
      try {
        const toolExecutionResult = await toolExecutionTest(`${BASE_URL}/api/mcp/tools`, 'POST', toolExecutionBody);
        results.push(toolExecutionResult);
        console.log(`   ✅ Duration: ${toolExecutionResult.duration.toFixed(2)}ms`);
        console.log(`   ✅ Status: ${toolExecutionResult.result.status}`);
      } catch (toolError) {
        console.log(`   ⚠️  Tool execution failed: ${toolError.error?.message || 'Unknown error'}`);
        console.log(`   ⏱️  Duration: ${toolError.duration.toFixed(2)}ms`);
      }
      console.log();
    }

    // Test 4: Cold start simulation (multiple rapid requests)
    console.log('📊 Test 4: Cold Start Simulation');
    const coldStartTests = [];
    for (let i = 0; i < 5; i++) {
      const coldStartTest = measureTime(`cold_start_${i}`, testEndpoint);
      coldStartTests.push(coldStartTest(`${BASE_URL}/api/mcp/capabilities`));
    }
    
    const coldStartResults = await Promise.all(coldStartTests);
    results.push(...coldStartResults);
    
    const avgColdStart = coldStartResults.reduce((sum, result) => sum + result.duration, 0) / coldStartResults.length;
    console.log(`   ✅ Average duration: ${avgColdStart.toFixed(2)}ms`);
    console.log(`   ✅ Min duration: ${Math.min(...coldStartResults.map(r => r.duration)).toFixed(2)}ms`);
    console.log(`   ✅ Max duration: ${Math.max(...coldStartResults.map(r => r.duration)).toFixed(2)}ms`);
    console.log();

    // Test 5: Memory usage (approximate)
    console.log('📊 Test 5: Memory Usage Analysis');
    const memoryBefore = process.memoryUsage();
    
    // Create some load
    const loadTests = [];
    for (let i = 0; i < 10; i++) {
      loadTests.push(testEndpoint(`${BASE_URL}/api/mcp/capabilities`));
    }
    await Promise.all(loadTests);
    
    const memoryAfter = process.memoryUsage();
    const memoryDelta = {
      rss: (memoryAfter.rss - memoryBefore.rss) / 1024 / 1024,
      heapUsed: (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024,
      heapTotal: (memoryAfter.heapTotal - memoryBefore.heapTotal) / 1024 / 1024
    };
    
    console.log(`   ✅ RSS Delta: ${memoryDelta.rss.toFixed(2)}MB`);
    console.log(`   ✅ Heap Used Delta: ${memoryDelta.heapUsed.toFixed(2)}MB`);
    console.log(`   ✅ Heap Total Delta: ${memoryDelta.heapTotal.toFixed(2)}MB`);
    console.log();

    // Generate performance report
    generatePerformanceReport(results);

  } catch (error) {
    console.error('❌ Performance test failed:', error);
    process.exit(1);
  }
}

/**
 * Generate performance report
 */
function generatePerformanceReport(results) {
  console.log('📋 Performance Report');
  console.log('====================\n');
  
  const sortedResults = results.sort((a, b) => a.duration - b.duration);
  
  console.log('⚡ Fastest Operations:');
  sortedResults.slice(0, 3).forEach((result, index) => {
    console.log(`   ${index + 1}. ${result.label}: ${result.duration.toFixed(2)}ms`);
  });
  
  console.log('\n🐌 Slowest Operations:');
  sortedResults.slice(-3).forEach((result, index) => {
    console.log(`   ${index + 1}. ${result.label}: ${result.duration.toFixed(2)}ms`);
  });
  
  const avgDuration = results.reduce((sum, result) => sum + result.duration, 0) / results.length;
  const medianDuration = sortedResults[Math.floor(sortedResults.length / 2)].duration;
  
  console.log('\n📈 Summary Statistics:');
  console.log(`   Average Response Time: ${avgDuration.toFixed(2)}ms`);
  console.log(`   Median Response Time: ${medianDuration.toFixed(2)}ms`);
  console.log(`   95th Percentile: ${sortedResults[Math.floor(sortedResults.length * 0.95)].duration.toFixed(2)}ms`);
  console.log(`   Total Requests: ${results.length}`);
  
  // Performance recommendations
  console.log('\n💡 Performance Recommendations:');
  if (avgDuration > 1000) {
    console.log('   ⚠️  Average response time > 1s - Consider optimizing slow operations');
  } else if (avgDuration > 500) {
    console.log('   ⚠️  Average response time > 500ms - Monitor for potential optimizations');
  } else {
    console.log('   ✅ Response times are within acceptable range');
  }
  
  const fastestDuration = sortedResults[0].duration;
  const slowestDuration = sortedResults[sortedResults.length - 1].duration;
  const variability = slowestDuration / fastestDuration;
  
  if (variability > 10) {
    console.log('   ⚠️  High variability in response times - Check for performance bottlenecks');
  } else {
    console.log('   ✅ Consistent response times across operations');
  }
}

// Run the performance tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceTests().catch(console.error);
}

export { runPerformanceTests, testEndpoint, measureTime };