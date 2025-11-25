#!/usr/bin/env node

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { discoverTools } from './lib/tools.js';
import { Buffer } from "buffer";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, ".env") });

// Test results tracking
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  details: []
};

function logTest(testName, status, message = '', details = null) {
  testResults.total++;
  const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  
  console.log(`${statusIcon} ${testName}: ${message}`);
  
  if (details) {
    console.log(`   ${JSON.stringify(details, null, 2).split('\n').join('\n   ')}`);
  }
  
  testResults.details.push({ test: testName, status, message, details });
  
  if (status === 'PASS') testResults.passed++;
  else if (status === 'FAIL') testResults.failed++;
  else testResults.skipped++;
}

async function testOrdersManagementTool(tool) {
  console.log('\n🧪 Testing Medusa Admin Orders Tool...\n');
  
  // Test 1: List orders
  try {
    const listResult = await tool.function({ 
      action: 'list',
      limit: 5,
      offset: 0
    });
    
    if (listResult.error) {
      logTest('Orders List', 'FAIL', 'API returned error', listResult.error);
    } else {
      logTest('Orders List', 'PASS', `Found ${listResult.orders?.length || 0} orders`);
    }
  } catch (error) {
    logTest('Orders List', 'FAIL', 'Exception thrown', error.message);
  }

  // Test 2: Get specific order (if orders exist)
  try {
    const listResult = await tool.function({ action: 'list', limit: 1 });
    
    if (!listResult.error && listResult.orders && listResult.orders.length > 0) {
      const orderId = listResult.orders[0].id;
      const getResult = await tool.function({ 
        action: 'get',
        id: orderId
      });
      
      if (getResult.error) {
        logTest('Get Order by ID', 'FAIL', 'API returned error', getResult.error);
      } else {
        logTest('Get Order by ID', 'PASS', `Retrieved order ${orderId}`);
      }
    } else {
      logTest('Get Order by ID', 'SKIP', 'No orders available to test');
    }
  } catch (error) {
    logTest('Get Order by ID', 'FAIL', 'Exception thrown', error.message);
  }

  // Test 3: List fulfillments (if orders exist)
  try {
    const listResult = await tool.function({ action: 'list', limit: 1 });
    
    if (!listResult.error && listResult.orders && listResult.orders.length > 0) {
      const orderId = listResult.orders[0].id;
      const fulfillmentsResult = await tool.function({ 
        action: 'list_fulfillments',
        id: orderId
      });
      
      if (fulfillmentsResult.error) {
        logTest('List Order Fulfillments', 'FAIL', 'API returned error', fulfillmentsResult.error);
      } else {
        logTest('List Order Fulfillments', 'PASS', `Listed fulfillments for order ${orderId}`);
      }
    } else {
      logTest('List Order Fulfillments', 'SKIP', 'No orders available to test');
    }
  } catch (error) {
    logTest('List Order Fulfillments', 'FAIL', 'Exception thrown', error.message);
  }

  // Test 4: Test invalid action
  try {
    const invalidResult = await tool.function({ 
      action: 'invalid_action'
    });
    
    if (invalidResult.error && invalidResult.error.includes('Invalid action')) {
      logTest('Invalid Action Handling', 'PASS', 'Correctly rejected invalid action');
    } else {
      logTest('Invalid Action Handling', 'FAIL', 'Should have rejected invalid action');
    }
  } catch (error) {
    logTest('Invalid Action Handling', 'FAIL', 'Exception thrown', error.message);
  }

  // Test 5: Test missing required parameter
  try {
    const missingParamResult = await tool.function({ 
      action: 'get'
      // Missing required 'id' parameter
    });
    
    if (missingParamResult.error && missingParamResult.error.includes('required')) {
      logTest('Missing Parameter Validation', 'PASS', 'Correctly validated missing parameter');
    } else {
      logTest('Missing Parameter Validation', 'FAIL', 'Should have validated missing parameter');
    }
  } catch (error) {
    logTest('Missing Parameter Validation', 'FAIL', 'Exception thrown', error.message);
  }
}

async function testDraftOrdersManagementTool(tool) {
  console.log('\n🧪 Testing Medusa Admin Draft Orders Tool...\n');
  
  let createdDraftOrderId = null;

  // Test 1: List draft orders
  try {
    const listResult = await tool.function({ 
      action: 'list',
      limit: 5,
      offset: 0
    });
    
    if (listResult.error) {
      logTest('Draft Orders List', 'FAIL', 'API returned error', listResult.error);
    } else {
      logTest('Draft Orders List', 'PASS', `Found ${listResult.draft_orders?.length || 0} draft orders`);
    }
  } catch (error) {
    logTest('Draft Orders List', 'FAIL', 'Exception thrown', error.message);
  }

  // Test 2: Create draft order
  try {
    const createResult = await tool.function({ 
      action: 'create',
      email: 'test@example.com',
      region_id: 'reg_test',
      items: [
        {
          variant_id: 'variant_test',
          quantity: 1
        }
      ]
    });
    
    if (createResult.error) {
      logTest('Create Draft Order', 'FAIL', 'API returned error', createResult.error);
    } else if (createResult.success && createResult.draft_order) {
      createdDraftOrderId = createResult.draft_order.id;
      logTest('Create Draft Order', 'PASS', `Created draft order ${createdDraftOrderId}`);
    } else {
      logTest('Create Draft Order', 'FAIL', 'Unexpected response format');
    }
  } catch (error) {
    logTest('Create Draft Order', 'FAIL', 'Exception thrown', error.message);
  }

  // Test 3: Get specific draft order
  if (createdDraftOrderId) {
    try {
      const getResult = await tool.function({ 
        action: 'get',
        id: createdDraftOrderId
      });
      
      if (getResult.error) {
        logTest('Get Draft Order by ID', 'FAIL', 'API returned error', getResult.error);
      } else {
        logTest('Get Draft Order by ID', 'PASS', `Retrieved draft order ${createdDraftOrderId}`);
      }
    } catch (error) {
      logTest('Get Draft Order by ID', 'FAIL', 'Exception thrown', error.message);
    }
  } else {
    // Try with existing draft order if any
    try {
      const listResult = await tool.function({ action: 'list', limit: 1 });
      
      if (!listResult.error && listResult.draft_orders && listResult.draft_orders.length > 0) {
        const draftOrderId = listResult.draft_orders[0].id;
        const getResult = await tool.function({ 
          action: 'get',
          id: draftOrderId
        });
        
        if (getResult.error) {
          logTest('Get Draft Order by ID', 'FAIL', 'API returned error', getResult.error);
        } else {
          logTest('Get Draft Order by ID', 'PASS', `Retrieved existing draft order ${draftOrderId}`);
        }
      } else {
        logTest('Get Draft Order by ID', 'SKIP', 'No draft orders available to test');
      }
    } catch (error) {
      logTest('Get Draft Order by ID', 'FAIL', 'Exception thrown', error.message);
    }
  }

  // Test 4: Add line item (if we have a draft order)
  if (createdDraftOrderId) {
    try {
      const addItemResult = await tool.function({ 
        action: 'add_line_item',
        id: createdDraftOrderId,
        variant_id: 'variant_test_2',
        quantity: 2
      });
      
      if (addItemResult.error) {
        logTest('Add Line Item', 'FAIL', 'API returned error', addItemResult.error);
      } else if (addItemResult.success) {
        logTest('Add Line Item', 'PASS', `Added line item to draft order ${createdDraftOrderId}`);
      } else {
        logTest('Add Line Item', 'FAIL', 'Unexpected response format');
      }
    } catch (error) {
      logTest('Add Line Item', 'FAIL', 'Exception thrown', error.message);
    }
  } else {
    logTest('Add Line Item', 'SKIP', 'No draft order created to test with');
  }

  // Test 5: Delete draft order (cleanup)
  if (createdDraftOrderId) {
    try {
      const deleteResult = await tool.function({ 
        action: 'delete',
        id: createdDraftOrderId
      });
      
      if (deleteResult.error) {
        logTest('Delete Draft Order', 'FAIL', 'API returned error', deleteResult.error);
      } else if (deleteResult.success) {
        logTest('Delete Draft Order', 'PASS', `Deleted draft order ${createdDraftOrderId}`);
      } else {
        logTest('Delete Draft Order', 'FAIL', 'Unexpected response format');
      }
    } catch (error) {
      logTest('Delete Draft Order', 'FAIL', 'Exception thrown', error.message);
    }
  } else {
    logTest('Delete Draft Order', 'SKIP', 'No draft order created to delete');
  }

  // Test 6: Test invalid action
  try {
    const invalidResult = await tool.function({ 
      action: 'invalid_action'
    });
    
    if (invalidResult.error && invalidResult.error.includes('Invalid action')) {
      logTest('Draft Orders Invalid Action', 'PASS', 'Correctly rejected invalid action');
    } else {
      logTest('Draft Orders Invalid Action', 'FAIL', 'Should have rejected invalid action');
    }
  } catch (error) {
    logTest('Draft Orders Invalid Action', 'FAIL', 'Exception thrown', error.message);
  }
}

function checkEnvironmentConfiguration() {
  console.log('\n🔧 Environment Configuration Check...\n');
  
  const requiredEnvVars = ['MEDUSA_BASE_URL', 'MEDUSA_API_KEY'];
  let allConfigured = true;
  
  requiredEnvVars.forEach(varName => {
    if (process.env[varName]) {
      logTest(`Environment: ${varName}`, 'PASS', 'configured');
    } else {
      logTest(`Environment: ${varName}`, 'FAIL', 'missing or empty');
      allConfigured = false;
    }
  });
  
  // Check URL format and provide helpful info
  if (process.env.MEDUSA_BASE_URL) {
    try {
      const url = new URL(process.env.MEDUSA_BASE_URL);
      logTest('Environment: URL Format', 'PASS', `valid URL format (${url.origin})`);
      
      // Check for common issues
      if (process.env.MEDUSA_BASE_URL.endsWith('/')) {
        console.log('   ℹ️  Note: Base URL has trailing slash - this is handled automatically');
      }
      
      // Show what the API endpoint will look like
      const cleanBaseUrl = process.env.MEDUSA_BASE_URL.replace(/\/+$/, '');
      console.log(`   🔗 API Endpoint Example: ${cleanBaseUrl}/admin/orders`);
      
    } catch {
      logTest('Environment: URL Format', 'FAIL', 'invalid URL format');
      console.log('   💡 URL should include protocol (https://your-medusa-backend.com)');
      allConfigured = false;
    }
  }
  
  // Check API key format
  if (process.env.MEDUSA_API_KEY) {
    const apiKey = process.env.MEDUSA_API_KEY;
    if (apiKey.startsWith('pk_') || apiKey.startsWith('Bearer ') || apiKey.length > 20) {
      logTest('Environment: API Key Format', 'PASS', 'appears to be valid format');
    } else {
      logTest('Environment: API Key Format', 'WARN', 'unusual format - ensure it\'s correct');
    }
  }
  
  return allConfigured;
}

async function testBasicConnectivity() {
  console.log('\n🌐 Testing Basic API Connectivity...\n');
  
  const baseUrl = process.env.MEDUSA_BASE_URL;
  const apiKey = process.env.MEDUSA_API_KEY;
  
  if (!baseUrl || !apiKey) {
    logTest('Basic Connectivity', 'SKIP', 'Missing credentials');
    return false;
  }
  
  try {
    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const testUrl = `${cleanBaseUrl}/admin/orders`;
    
    console.log(`   🔗 Testing endpoint: ${testUrl}`);
    console.log(`apiKey: ${apiKey}`)
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${
          Buffer.from(`${apiKey}:`).toString("base64")
        }`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   📡 Response Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      logTest('Basic Connectivity', 'PASS', `Successfully connected to Medusa API (${response.status})`);
      return true;
    } else if (response.status === 401) {
      logTest('Basic Connectivity', 'FAIL', 'Authentication failed - check your API key');
      return false;
    } else if (response.status === 404) {
      logTest('Basic Connectivity', 'FAIL', 'API endpoint not found - check your base URL');
      const responseText = await response.text();
      console.log(`   📝 Response: ${responseText.substring(0, 200)}...`);
      return false;
    } else {
      logTest('Basic Connectivity', 'FAIL', `HTTP ${response.status}: ${response.statusText}`);
      return false;
    }
    
  } catch (error) {
    logTest('Basic Connectivity', 'FAIL', `Connection error: ${error.message}`);
    console.log('   💡 Common issues:');
    console.log('      • Check if the Medusa backend is running');
    console.log('      • Verify the base URL is correct');
    console.log('      • Ensure network connectivity');
    return false;
  }
}

function printTestSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`⚠️  Skipped: ${testResults.skipped}`);
  console.log(`Success Rate: ${testResults.total > 0 ? ((testResults.passed / testResults.total) * 100).toFixed(1) : 0}%`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.details
      .filter(detail => detail.status === 'FAIL')
      .forEach(detail => {
        console.log(`   • ${detail.test}: ${detail.message}`);
      });
  }
  
  if (testResults.skipped > 0) {
    console.log('\n⚠️  Skipped Tests:');
    testResults.details
      .filter(detail => detail.status === 'SKIP')
      .forEach(detail => {
        console.log(`   • ${detail.test}: ${detail.message}`);
      });
  }
  
  console.log('\n' + '='.repeat(60));
}

async function testMedusaTools() {
  console.log('🔍 Testing Medusa MCP Server Tools...\n');
  console.log('='.repeat(60));
  
  try {
    // Check environment first
    const envConfigured = checkEnvironmentConfiguration();
    
    if (!envConfigured) {
      console.log('\n💡 Configuration Help:');
      console.log('   1. Copy env.example to .env');
      console.log('   2. Fill in your Medusa backend URL and API key');
      console.log('   3. Run this test again');
      console.log('\n⚠️  Some tests may fail without proper configuration.');
    }
    
    // Test basic connectivity before running tool tests
    const connectivityOk = await testBasicConnectivity();
    
    if (!connectivityOk && envConfigured) {
      console.log('\n⚠️  API connectivity failed - tool tests may not work properly.');
    }
    
    // Discover all tools
    const tools = await discoverTools();
    console.log(`\n✅ Discovered ${tools.length} tools:`);
    tools.forEach((tool, index) => {
      console.log(`  ${index + 1}. ${tool.definition.name}`);
      console.log(`     ${tool.definition.description}`);
    });
    
    // Test Orders Management Tool
    const ordersTool = tools.find(t => t.definition.name === 'manage_medusa_admin_orders');
    if (ordersTool) {
      await testOrdersManagementTool(ordersTool);
    } else {
      logTest('Orders Tool Discovery', 'FAIL', 'manage_medusa_admin_orders tool not found');
    }
    
    // Test Draft Orders Management Tool
    const draftOrdersTool = tools.find(t => t.definition.function.name === 'manage_medusa_admin_draft_orders');
    if (draftOrdersTool) {
      await testDraftOrdersManagementTool(draftOrdersTool);
    } else {
      logTest('Draft Orders Tool Discovery', 'FAIL', 'manage_medusa_admin_draft_orders tool not found');
    }
    
  } catch (error) {
    console.error('❌ Critical Error:', error.message);
    logTest('Tool Discovery', 'FAIL', 'Failed to discover tools', error.message);
  }
  
  // Print final summary
  printTestSummary();
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run the tests
testMedusaTools();