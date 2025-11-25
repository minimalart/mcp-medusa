/**
 * Comprehensive Medusa Admin Customers Management Tool
 * Supports CRUD operations for customers, customer groups, and addresses
 */

import { Buffer } from "buffer";

// Utility function to normalize base URL by removing trailing slashes
function normalizeBaseUrl(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

// Utility function to create proper headers for Medusa API
function createHeaders(apiKey) {
  return {
    'Authorization': `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
    'Content-Type': 'application/json'
  };
}

// Utility function to make API requests
async function makeRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers
    }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  
  return await response.json();
}

/**
 * Main function to handle all customer-related operations.
 *
 * @param {Object} args - Arguments object.
 * @param {string} args.action - The action to perform.
 * @param {string} [args.id] - Customer ID (required for get, update, delete operations).
 * @param {string} [args.group_id] - Customer group ID.
 * @param {string} [args.address_id] - Address ID.
 * @param {number} [args.limit=20] - Maximum number of items to return.
 * @param {number} [args.offset=0] - Number of items to skip.
 * @param {string} [args.q] - Search query.
 * @param {string} [args.email] - Customer email.
 * @param {string} [args.first_name] - Customer first name.
 * @param {string} [args.last_name] - Customer last name.
 * @param {string} [args.phone] - Customer phone number.
 * @param {Object} [args.metadata] - Additional metadata.
 * @param {string} [args.created_at] - Filter by creation date.
 * @param {string} [args.updated_at] - Filter by update date.
 * @param {Object} [args.address_data] - Address data for create/update operations.
 * @param {string} [args.group_name] - Customer group name.
 * @param {Object} [args.group_metadata] - Customer group metadata.
 */
async function handleCustomersOperation(args) {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY;

  if (!apiKey) {
    throw new Error('MEDUSA_API_KEY environment variable is required');
  }

  const cleanBaseUrl = baseUrl;
  const headers = createHeaders(apiKey);

  switch (args.action) {
    case 'list':
      return await listCustomers(cleanBaseUrl, headers, args);
    case 'get':
      return await getCustomer(cleanBaseUrl, headers, args);
    case 'create':
      return await createCustomer(cleanBaseUrl, headers, args);
    case 'update':
      return await updateCustomer(cleanBaseUrl, headers, args);
    case 'delete':
      return await deleteCustomer(cleanBaseUrl, headers, args);
    case 'list_addresses':
      return await listCustomerAddresses(cleanBaseUrl, headers, args);
    case 'get_address':
      return await getCustomerAddress(cleanBaseUrl, headers, args);
    case 'create_address':
      return await createCustomerAddress(cleanBaseUrl, headers, args);
    case 'update_address':
      return await updateCustomerAddress(cleanBaseUrl, headers, args);
    case 'delete_address':
      return await deleteCustomerAddress(cleanBaseUrl, headers, args);
    case 'list_groups':
      return await listCustomerGroups(cleanBaseUrl, headers, args);
    case 'get_group':
      return await getCustomerGroup(cleanBaseUrl, headers, args);
    case 'create_group':
      return await createCustomerGroup(cleanBaseUrl, headers, args);
    case 'update_group':
      return await updateCustomerGroup(cleanBaseUrl, headers, args);
    case 'delete_group':
      return await deleteCustomerGroup(cleanBaseUrl, headers, args);
    case 'add_to_group':
      return await addCustomerToGroup(cleanBaseUrl, headers, args);
    case 'remove_from_group':
      return await removeCustomerFromGroup(cleanBaseUrl, headers, args);
    default:
      throw new Error(`Unknown action: ${args.action}`);
  }
}

// Customer operations
async function listCustomers(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());
  if (args.q) params.append('q', args.q);
  if (args.email) params.append('email', args.email);
  if (args.first_name) params.append('first_name', args.first_name);
  if (args.last_name) params.append('last_name', args.last_name);
  if (args.phone) params.append('phone', args.phone);
  if (args.created_at) params.append('created_at', args.created_at);
  if (args.updated_at) params.append('updated_at', args.updated_at);

  const url = `${baseUrl}/admin/customers?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getCustomer(baseUrl, headers, args) {
  if (!args.id) throw new Error('Customer ID is required');
  const url = `${baseUrl}/admin/customers/${args.id}`;
  return await makeRequest(url, { headers });
}

async function createCustomer(baseUrl, headers, args) {
  if (!args.email) throw new Error('Customer email is required');
  
  const customerData = { email: args.email };
  if (args.first_name) customerData.first_name = args.first_name;
  if (args.last_name) customerData.last_name = args.last_name;
  if (args.phone) customerData.phone = args.phone;
  if (args.metadata) customerData.metadata = args.metadata;

  const url = `${baseUrl}/admin/customers`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(customerData)
  });
}

async function updateCustomer(baseUrl, headers, args) {
  if (!args.id) throw new Error('Customer ID is required');
  
  const customerData = {};
  if (args.email) customerData.email = args.email;
  if (args.first_name) customerData.first_name = args.first_name;
  if (args.last_name) customerData.last_name = args.last_name;
  if (args.phone) customerData.phone = args.phone;
  if (args.metadata) customerData.metadata = args.metadata;

  const url = `${baseUrl}/admin/customers/${args.id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(customerData)
  });
}

async function deleteCustomer(baseUrl, headers, args) {
  if (!args.id) throw new Error('Customer ID is required');
  const url = `${baseUrl}/admin/customers/${args.id}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

// Customer address operations
async function listCustomerAddresses(baseUrl, headers, args) {
  if (!args.id) throw new Error('Customer ID is required');
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());

  const url = `${baseUrl}/admin/customers/${args.id}/addresses?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getCustomerAddress(baseUrl, headers, args) {
  if (!args.id) throw new Error('Customer ID is required');
  if (!args.address_id) throw new Error('Address ID is required');
  const url = `${baseUrl}/admin/customers/${args.id}/addresses/${args.address_id}`;
  return await makeRequest(url, { headers });
}

async function createCustomerAddress(baseUrl, headers, args) {
  if (!args.id) throw new Error('Customer ID is required');
  if (!args.address_data) throw new Error('Address data is required');

  const url = `${baseUrl}/admin/customers/${args.id}/addresses`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(args.address_data)
  });
}

async function updateCustomerAddress(baseUrl, headers, args) {
  if (!args.id) throw new Error('Customer ID is required');
  if (!args.address_id) throw new Error('Address ID is required');
  if (!args.address_data) throw new Error('Address data is required');

  const url = `${baseUrl}/admin/customers/${args.id}/addresses/${args.address_id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(args.address_data)
  });
}

async function deleteCustomerAddress(baseUrl, headers, args) {
  if (!args.id) throw new Error('Customer ID is required');
  if (!args.address_id) throw new Error('Address ID is required');
  const url = `${baseUrl}/admin/customers/${args.id}/addresses/${args.address_id}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

// Customer group operations
async function listCustomerGroups(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());
  if (args.q) params.append('q', args.q);

  const url = `${baseUrl}/admin/customer-groups?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getCustomerGroup(baseUrl, headers, args) {
  if (!args.group_id) throw new Error('Customer group ID is required');
  const url = `${baseUrl}/admin/customer-groups/${args.group_id}`;
  return await makeRequest(url, { headers });
}

async function createCustomerGroup(baseUrl, headers, args) {
  if (!args.group_name) throw new Error('Customer group name is required');
  
  const groupData = { name: args.group_name };
  if (args.group_metadata) groupData.metadata = args.group_metadata;

  const url = `${baseUrl}/admin/customer-groups`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(groupData)
  });
}

async function updateCustomerGroup(baseUrl, headers, args) {
  if (!args.group_id) throw new Error('Customer group ID is required');
  
  const groupData = {};
  if (args.group_name) groupData.name = args.group_name;
  if (args.group_metadata) groupData.metadata = args.group_metadata;

  const url = `${baseUrl}/admin/customer-groups/${args.group_id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(groupData)
  });
}

async function deleteCustomerGroup(baseUrl, headers, args) {
  if (!args.group_id) throw new Error('Customer group ID is required');
  const url = `${baseUrl}/admin/customer-groups/${args.group_id}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

async function addCustomerToGroup(baseUrl, headers, args) {
  if (!args.id) throw new Error('Customer ID is required');
  if (!args.group_id) throw new Error('Customer group ID is required');
  
  const url = `${baseUrl}/admin/customer-groups/${args.group_id}/customers`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ customer_ids: [args.id] })
  });
}

async function removeCustomerFromGroup(baseUrl, headers, args) {
  if (!args.id) throw new Error('Customer ID is required');
  if (!args.group_id) throw new Error('Customer group ID is required');
  
  const url = `${baseUrl}/admin/customer-groups/${args.group_id}/customers`;
  return await makeRequest(url, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ customer_ids: [args.id] })
  });
}

export const apiTool = {
  definition: {
    name: 'manage_medusa_admin_customers',
    description: 'Comprehensive Medusa Admin customers management tool supporting customer operations (list, get, create, update, delete), address management, and customer group operations.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'list', 'get', 'create', 'update', 'delete',
            'list_addresses', 'get_address', 'create_address', 'update_address', 'delete_address',
            'list_groups', 'get_group', 'create_group', 'update_group', 'delete_group',
            'add_to_group', 'remove_from_group'
          ],
          description: 'The action to perform on customers.'
        },
        id: {
          type: 'string',
          description: 'Customer ID (required for get, update, delete, address operations).'
        },
        group_id: {
          type: 'string',
          description: 'Customer group ID (required for group operations).'
        },
        address_id: {
          type: 'string',
          description: 'Address ID (required for address-specific operations).'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of items to return (default: 20).'
        },
        offset: {
          type: 'number',
          description: 'Number of items to skip (default: 0).'
        },
        q: {
          type: 'string',
          description: 'Search query string.'
        },
        email: {
          type: 'string',
          description: 'Customer email address.'
        },
        first_name: {
          type: 'string',
          description: 'Customer first name.'
        },
        last_name: {
          type: 'string',
          description: 'Customer last name.'
        },
        phone: {
          type: 'string',
          description: 'Customer phone number.'
        },
        metadata: {
          type: 'object',
          description: 'Additional customer metadata.'
        },
        created_at: {
          type: 'string',
          description: 'Filter by creation date.'
        },
        updated_at: {
          type: 'string',
          description: 'Filter by update date.'
        },
        address_data: {
          type: 'object',
          description: 'Address data for create/update operations.'
        },
        group_name: {
          type: 'string',
          description: 'Customer group name.'
        },
        group_metadata: {
          type: 'object',
          description: 'Customer group metadata.'
        }
      },
      required: ['action']
    }
  },
  function: handleCustomersOperation
};