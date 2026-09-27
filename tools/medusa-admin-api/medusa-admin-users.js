/**
 * Comprehensive Medusa Admin Users & Authentication Management Tool
 * Supports user management, invites, and API keys
 *
 * Medusa v2 no tiene POST /admin/users: los usuarios admin se crean invitándolos
 * (POST /admin/invites) y el invitado acepta con POST /admin/invites/accept usando
 * su propio token + credenciales (eso no se expone acá).
 * La ruta POST /admin/users/{id}/reset-password (2.20+) devuelve un token de reseteo en
 * vivo, así que tampoco se expone (y manage_medusa_admin_v2 lo bloquea).
 */

import { createHeaders, hasMedusaCredentials, makeRequest, missingCredentialsMessage, normalizeBaseUrl } from "../../lib/medusa-client.js";
import { withMedusaErrorHints, withMinVersion } from "../../lib/medusa-version.js";

const REMOVED_ACTIONS = {
  create_user:
    'create_user was removed: Medusa v2 has no POST /admin/users route. Invite the person with create_invite (email, optional roles); ' +
    'they accept the invite themselves and set their own password.'
};

async function handleUsersOperation(args) {
  const rawBaseUrl = process.env.MEDUSA_BASE_URL || 'http://localhost:9000';
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const apiKey = process.env.MEDUSA_API_KEY || process.env.MEDUSA_JWT || process.env.MEDUSA_SESSION_COOKIE || process.env.MEDUSA_COOKIE;

  if (REMOVED_ACTIONS[args.action]) {
    return { error: REMOVED_ACTIONS[args.action], removed: true };
  }

  if (!apiKey || !hasMedusaCredentials()) {
    throw new Error(missingCredentialsMessage());
  }

  const headers = createHeaders(apiKey);

  switch (args.action) {
    case 'list_users':
      return await listUsers(baseUrl, headers, args);
    case 'get_user':
      return await getUser(baseUrl, headers, args);
    case 'get_current_user':
      return await getCurrentUser(baseUrl, headers, args);
    case 'list_auth_providers':
      return await listUserAuthProviders(baseUrl, headers, args);
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

async function getCurrentUser(baseUrl, headers) {
  const url = `${baseUrl}/admin/users/me`;
  return await makeRequest(url, { headers });
}

/**
 * Proveedores de autenticación vinculados a un usuario (p. ej. emailpass, google).
 * GET /admin/users/{id}/auth-providers — Medusa >= 2.20.
 */
async function listUserAuthProviders(baseUrl, headers, args) {
  if (!args.id) throw new Error('User ID is required');
  const url = `${baseUrl}/admin/users/${encodeURIComponent(args.id)}/auth-providers`;
  return await withMinVersion('2.20', () => makeRequest(url, { headers }));
}

async function updateUser(baseUrl, headers, args) {
  if (!args.id) throw new Error('User ID is required');
  if (args.role !== undefined || args.roles !== undefined) {
    // AdminUpdateUser es { first_name, last_name, avatar_url, metadata } (strict): role devolvía 400.
    throw new Error('Roles cannot be changed with update_user in Medusa v2. Use manage_medusa_admin_v2 action=request POST /admin/users/{id}/roles { roles: [...] } (requires RBAC).');
  }

  const userData = {};
  if (args.first_name) userData.first_name = args.first_name;
  if (args.last_name) userData.last_name = args.last_name;
  if (args.avatar_url !== undefined) userData.avatar_url = args.avatar_url;
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

  // Medusa 2.16: POST /admin/invites espera { email, roles?: string[] } y el
  // validador es .strict() → cualquier clave extra (p. ej. `role` en singular)
  // devuelve 400. `roles` es OPCIONAL: una invitación sin roles es válida.
  // Aceptamos `roles` (array) y, por compatibilidad, `role` (string) que se
  // envuelve en array; nunca mandamos el campo `role`.
  const inviteData = { email: args.email };
  const roles = args.roles ?? (args.role ? [args.role] : undefined);
  if (roles !== undefined) {
    inviteData.roles = Array.isArray(roles) ? roles : [roles];
  }

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
    description:
      'Medusa Admin users, invites and API keys (Medusa 2.17.2+, incl. 2.18 and 2.21.1). Users: list_users, get_user, get_current_user (the authenticated admin), update_user (first_name, last_name, avatar_url, metadata), delete_user, ' +
      'list_auth_providers (auth providers linked to a user, e.g. emailpass/google; Medusa >= 2.20). ' +
      'New admins are added with create_invite (email, optional roles): Medusa emits invite.created (the store usually emails the invite link) and the person accepts it and sets their own password; resend_invite re-sends it. create_user was removed (no such route in Medusa v2). ' +
      'API keys: list/get/create (title + type secret|publishable; the secret token is only returned once)/update/delete/revoke.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'list_users', 'get_user', 'get_current_user', 'list_auth_providers', 'update_user', 'delete_user',
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
        avatar_url: { type: 'string', description: 'User avatar URL (update_user).' },
        roles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Invite roles (Medusa 2.16: array de role ids, OPCIONAL). Para create_invite alcanza con `email`; pasá `roles` solo si querés asignar roles existentes.'
        },
        role: { type: 'string', description: 'Deprecado: rol único (string). Usá `roles` (array). Se acepta por compatibilidad y se envuelve en array; nunca se manda como `role`.' },
        title: { type: 'string', description: 'API key title.' },
        type: { type: 'string', description: 'API key type.' },
        metadata: { type: 'object', description: 'Additional metadata.' }
      },
      required: ['action']
    }
  },
  function: withMedusaErrorHints(handleUsersOperation)
};
