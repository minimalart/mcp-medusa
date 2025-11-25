#!/usr/bin/env node

/**
 * Test script for the new HTTP-based MCP transport
 * Tests capabilities, tool listing, and tool execution
 */

import dotenv from 'dotenv';
dotenv.config();

const MCP_BASE_URL = process.env.MCP_BASE_URL || 'http://localhost:3000/api/mcp';
const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;

if (!MCP_AUTH_TOKEN) {
  console.error('❌ MCP_AUTH_TOKEN environment variable is required');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${MCP_AUTH_TOKEN}`
};

// Test capabilities endpoint
async function testCapabilities() {
  console.log('\n🔍 Testing capabilities endpoint...');
  try {
    const response = await fetch(`${MCP_BASE_URL}/capabilities`, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ Capabilities:', JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Capabilities test failed:', error.message);
    return false;
  }
}

// Test tool listing
async function testToolListing() {
  console.log('\n🔍 Testing tool listing...');
  try {
    const response = await fetch(`${MCP_BASE_URL}/tools`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ Tool listing response:', JSON.stringify(data, null, 2));
    
    if (data.result && data.result.tools && data.result.tools.length > 0) {
      console.log(`✅ Found ${data.result.tools.length} tools`);
      return data.result.tools;
    } else {
      throw new Error('No tools found in response');
    }
  } catch (error) {
    console.error('❌ Tool listing test failed:', error.message);
    return null;
  }
}

// Test tool execution
async function testToolExecution(tools) {
  console.log('\n🔍 Testing tool execution...');
  
  // Find a simple tool to test (like list_regions)
  const testTool = tools.find(tool => 
    tool.name === 'manage_medusa_admin_regions' || 
    tool.name === 'list_regions' ||
    tool.name.includes('list')
  );
  
  if (!testTool) {
    console.log('⚠️ No suitable test tool found for execution test');
    return false;
  }
  
  console.log(`🔍 Testing tool: ${testTool.name}`);
  
  try {
    const response = await fetch(`${MCP_BASE_URL}/tools`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: testTool.name,
          arguments: { action: 'list_regions', limit: 5 }
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ Tool execution response:', JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Tool execution test failed:', error.message);
    return false;
  }
}

// Test main MCP endpoint (unified)
async function testMainEndpoint() {
  console.log('\n🔍 Testing main MCP endpoint...');
  try {
    // Test initialize
    const initResponse = await fetch(MCP_BASE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'initialize',
        params: {}
      })
    });
    
    if (!initResponse.ok) {
      throw new Error(`HTTP ${initResponse.status}: ${initResponse.statusText}`);
    }
    
    const initData = await initResponse.json();
    console.log('✅ Initialize response:', JSON.stringify(initData, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Main endpoint test failed:', error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting MCP HTTP Transport Tests');
  console.log(`🎯 Target URL: ${MCP_BASE_URL}`);
  
  const results = {
    capabilities: await testCapabilities(),
    mainEndpoint: await testMainEndpoint(),
    toolListing: null,
    toolExecution: false
  };
  
  const tools = await testToolListing();
  results.toolListing = tools !== null;
  
  if (tools) {
    results.toolExecution = await testToolExecution(tools);
  }
  
  console.log('\n📊 Test Results Summary:');
  console.log(`Capabilities: ${results.capabilities ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Main Endpoint: ${results.mainEndpoint ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Tool Listing: ${results.toolListing ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Tool Execution: ${results.toolExecution ? '✅ PASS' : '❌ FAIL'}`);
  
  const passCount = Object.values(results).filter(r => r === true).length;
  const totalTests = Object.values(results).length;
  
  console.log(`\n🎯 Overall: ${passCount}/${totalTests} tests passed`);
  
  if (passCount === totalTests) {
    console.log('🎉 All tests passed! HTTP transport is working correctly.');
    process.exit(0);
  } else {
    console.log('⚠️ Some tests failed. Check the logs above for details.');
    process.exit(1);
  }
}

runTests().catch(console.error);