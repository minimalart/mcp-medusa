/**
 * Comprehensive Medusa Admin Users & Authentication Management Tool
 * Supports user management, invites, and API keys
 */

import { Buffer } from "buffer";

// Utility function to normalize base URL by removing trailing slashes
function normalizeBaseUrl(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function createHeaders(apiKey) {
  return {
    'Authorization': `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
    'Content-Type': 'application/json'
  };
}

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

async function handleUsersOperation(args) {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY;
  
  if (!apiKey) {
    throw new Error('MEDUSA_API_KEY environment variable is required');
  }

  const headers = createHeaders(apiKey);

  switch (args.action) {
    case 'list_users':
      return await listUsers(baseUrl, headers, args);
    case 'get_user':
      return await getUser(baseUrl, headers, args);
    case 'create_user':
      return await createUser(baseUrl, headers, args);
    case 'update_user':
      return await updateUser(baseUrl, headers, args);
    case 'delete_user':
      return await deleteUser(baseUrl, headers, args);
    case 'list_invites':
      return await listInvites(baseUrl, headers, args);
    case 'get_invite':
      return await getInvite(baseUrl, headers, args);
    case 'create_invite':
      return await createInvite(baseUrl, headers, args);
    case 'delete_invite':
      return await deleteInvite(baseUrl, headers, args);
    case 'resend_invite':
      return await resendInvite(baseUrl, headers, args);
    case 'list_api_keys':
      return await listApiKeys(baseUrl, headers, args);
    case 'get_api_key':
      return await getApiKey(baseUrl, headers, args);
    case 'create_api_key':
      return await createApiKey(baseUrl, headers, args);
    case 'update_api_key':
      return await updateApiKey(baseUrl, headers, args);
    case 'delete_api_key':
      return await deleteApiKey(baseUrl, headers, args);
    case 'revoke_api_key':
      return await revokeApiKey(baseUrl, headers, args);
    default:
      throw new Error(`Unknown action: ${args.action}`);
  }
}

// Users operations
async function listUsers(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());
  if (args.q) params.append('q', args.q);

  const url = `${baseUrl}/admin/users?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getUser(baseUrl, headers, args) {
  if (!args.id) throw new Error('User ID is required');
  const url = `${baseUrl}/admin/users/${args.id}`;
  return await makeRequest(url, { headers });
}

async function createUser(baseUrl, headers, args) {
  if (!args.email) throw new Error('User email is required');
  
  const userData = { email: args.email };
  if (args.first_name) userData.first_name = args.first_name;
  if (args.last_name) userData.last_name = args.last_name;
  if (args.role) userData.role = args.role;
  if (args.metadata) userData.metadata = args.metadata;

  const url = `${baseUrl}/admin/users`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(userData)
  });
}

async function updateUser(baseUrl, headers, args) {
  if (!args.id) throw new Error('User ID is required');
  
  const userData = {};
  if (args.first_name) userData.first_name = args.first_name;
  if (args.last_name) userData.last_name = args.last_name;
  if (args.role) userData.role = args.role;
  if (args.metadata) userData.metadata = args.metadata;

  const url = `${baseUrl}/admin/users/${args.id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(userData)
  });
}

async function deleteUser(baseUrl, headers, args) {
  if (!args.id) throw new Error('User ID is required');
  const url = `${baseUrl}/admin/users/${args.id}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

// Invites operations
async function listInvites(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());

  const url = `${baseUrl}/admin/invites?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getInvite(baseUrl, headers, args) {
  if (!args.invite_id) throw new Error('Invite ID is required');
  const url = `${baseUrl}/admin/invites/${args.invite_id}`;
  return await makeRequest(url, { headers });
}

async function createInvite(baseUrl, headers, args) {
  if (!args.email) throw new Error('Email is required');
  if (!args.role) throw new Error('Role is required');
  
  const inviteData = {
    email: args.email,
    role: args.role
  };

  const url = `${baseUrl}/admin/invites`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(inviteData)
  });
}

async function deleteInvite(baseUrl, headers, args) {
  if (!args.invite_id) throw new Error('Invite ID is required');
  const url = `${baseUrl}/admin/invites/${args.invite_id}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

async function resendInvite(baseUrl, headers, args) {
  if (!args.invite_id) throw new Error('Invite ID is required');
  const url = `${baseUrl}/admin/invites/${args.invite_id}/resend`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });
}

// API Keys operations
async function listApiKeys(baseUrl, headers, args) {
  const params = new URLSearchParams();
  if (args.limit) params.append('limit', args.limit.toString());
  if (args.offset) params.append('offset', args.offset.toString());

  const url = `${baseUrl}/admin/api-keys?${params.toString()}`;
  return await makeRequest(url, { headers });
}

async function getApiKey(baseUrl, headers, args) {
  if (!args.api_key_id) throw new Error('API key ID is required');
  const url = `${baseUrl}/admin/api-keys/${args.api_key_id}`;
  return await makeRequest(url, { headers });
}

async function createApiKey(baseUrl, headers, args) {
  if (!args.title) throw new Error('API key title is required');
  if (!args.type) throw new Error('API key type is required');
  
  const apiKeyData = {
    title: args.title,
    type: args.type
  };

  const url = `${baseUrl}/admin/api-keys`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(apiKeyData)
  });
}

async function updateApiKey(baseUrl, headers, args) {
  if (!args.api_key_id) throw new Error('API key ID is required');
  
  const apiKeyData = {};
  if (args.title) apiKeyData.title = args.title;

  const url = `${baseUrl}/admin/api-keys/${args.api_key_id}`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(apiKeyData)
  });
}

async function deleteApiKey(baseUrl, headers, args) {
  if (!args.api_key_id) throw new Error('API key ID is required');
  const url = `${baseUrl}/admin/api-keys/${args.api_key_id}`;
  return await makeRequest(url, { method: 'DELETE', headers });
}

async function revokeApiKey(baseUrl, headers, args) {
  if (!args.api_key_id) throw new Error('API key ID is required');
  const url = `${baseUrl}/admin/api-keys/${args.api_key_id}/revoke`;
  return await makeRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });
}

export const apiTool = {
  definition: {
    name: 'manage_medusa_admin_users',
    description: 'Comprehensive Medusa Admin users and authentication management tool supporting user operations, invites, and API key management.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'list_users', 'get_user', 'create_user', 'update_user', 'delete_user',
            'list_invites', 'get_invite', 'create_invite', 'delete_invite', 'resend_invite',
            'list_api_keys', 'get_api_key', 'create_api_key', 'update_api_key', 'delete_api_key', 'revoke_api_key'
          ],
          description: 'The action to perform.'
        },
        id: { type: 'string', description: 'User ID.' },
        invite_id: { type: 'string', description: 'Invite ID.' },
        api_key_id: { type: 'string', description: 'API key ID.' },
        limit: { type: 'number', description: 'Maximum number of items to return.' },
        offset: { type: 'number', description: 'Number of items to skip.' },
        q: { type: 'string', description: 'Search query.' },
        email: { type: 'string', description: 'User/invite email.' },
        first_name: { type: 'string', description: 'User first name.' },
        last_name: { type: 'string', description: 'User last name.' },
        role: { type: 'string', description: 'User/invite role.' },
        title: { type: 'string', description: 'API key title.' },
        type: { type: 'string', description: 'API key type.' },
        metadata: { type: 'object', description: 'Additional metadata.' }
      },
      required: ['action']
    }
  },
  function: handleUsersOperation
};