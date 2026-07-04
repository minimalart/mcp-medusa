import { createLocalJWKSet, createRemoteJWKSet, jwtVerify } from "jose";

let jwksCacheKey = null;
let jwksResolver = null;

export function getBearerToken(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

export function getAuthMode(env = process.env) {
  return (env.MCP_AUTH_MODE || "static").toLowerCase();
}

export function isOAuthMode(env = process.env) {
  return getAuthMode(env) === "oauth";
}

export function getRequestOrigin(req, env = process.env) {
  if (env.MCP_RESOURCE_URL) {
    return env.MCP_RESOURCE_URL.replace(/\/+$/, "");
  }

  const protocol =
    req.headers?.["x-forwarded-proto"] ||
    req.protocol ||
    "https";
  const host =
    req.headers?.["x-forwarded-host"] ||
    req.headers?.host ||
    "localhost";

  return `${protocol}://${host}`.replace(/\/+$/, "");
}

export function getRequiredScopes(env = process.env) {
  return String(env.OAUTH_REQUIRED_SCOPES || "")
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export function getProtectedResourceMetadata(req, env = process.env) {
  const resource = getRequestOrigin(req, env);
  const metadata = {
    resource,
    bearer_methods_supported: ["header"],
  };

  if (env.OAUTH_ISSUER) {
    metadata.authorization_servers = [env.OAUTH_ISSUER];
  }

  const scopes = getRequiredScopes(env);
  if (scopes.length > 0) {
    metadata.scopes_supported = scopes;
  }

  return metadata;
}

export function getAuthorizationServerMetadata(req, env = process.env) {
  const issuer = env.OAUTH_ISSUER || getRequestOrigin(req, env);
  const metadata = {
    issuer,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    client_id_metadata_document_supported: true,
  };

  if (env.OAUTH_AUTHORIZATION_ENDPOINT) {
    metadata.authorization_endpoint = env.OAUTH_AUTHORIZATION_ENDPOINT;
  }
  if (env.OAUTH_TOKEN_ENDPOINT) {
    metadata.token_endpoint = env.OAUTH_TOKEN_ENDPOINT;
  }
  if (env.OAUTH_REGISTRATION_ENDPOINT) {
    metadata.registration_endpoint = env.OAUTH_REGISTRATION_ENDPOINT;
  }
  if (env.OAUTH_JWKS_URI) {
    metadata.jwks_uri = env.OAUTH_JWKS_URI;
  }

  return metadata;
}

function getJwks(env = process.env) {
  const cacheKey = env.OAUTH_JWKS_JSON || env.OAUTH_JWKS_URI;
  if (jwksResolver && cacheKey === jwksCacheKey) {
    return jwksResolver;
  }

  if (env.OAUTH_JWKS_JSON) {
    jwksResolver = createLocalJWKSet(JSON.parse(env.OAUTH_JWKS_JSON));
    jwksCacheKey = cacheKey;
    return jwksResolver;
  }

  if (!env.OAUTH_JWKS_URI) {
    throw new Error("OAUTH_JWKS_URI or OAUTH_JWKS_JSON is required when MCP_AUTH_MODE=oauth");
  }

  jwksResolver = createRemoteJWKSet(new URL(env.OAUTH_JWKS_URI));
  jwksCacheKey = cacheKey;
  return jwksResolver;
}

function validateRequiredClaims(payload, env = process.env) {
  const requiredScopes = getRequiredScopes(env);
  if (requiredScopes.length === 0) {
    return;
  }

  const tokenScopes = new Set(
    String(payload.scope || "")
      .split(/\s+/)
      .map((scope) => scope.trim())
      .filter(Boolean),
  );

  const missingScopes = requiredScopes.filter((scope) => !tokenScopes.has(scope));
  if (missingScopes.length > 0) {
    const error = new Error(`Missing required OAuth scopes: ${missingScopes.join(", ")}`);
    error.status = 403;
    throw error;
  }
}

export async function verifyOAuthRequest(req, env = process.env) {
  const token = getBearerToken(req);
  if (!token) {
    const error = new Error("Missing bearer token");
    error.status = 401;
    throw error;
  }

  const verifyOptions = {};
  if (env.OAUTH_ISSUER) {
    verifyOptions.issuer = env.OAUTH_ISSUER;
  }
  if (env.OAUTH_AUDIENCE) {
    verifyOptions.audience = env.OAUTH_AUDIENCE;
  }

  const result = await jwtVerify(token, getJwks(env), verifyOptions);
  validateRequiredClaims(result.payload, env);
  return result;
}

export function oauthUnauthorizedHeaders(req, env = process.env) {
  const metadataUrl = `${getRequestOrigin(req, env)}/.well-known/oauth-protected-resource`;
  const challenges = [`resource_metadata="${metadataUrl}"`];
  const scopes = getRequiredScopes(env);
  if (scopes.length > 0) {
    challenges.push(`scope="${scopes.join(" ")}"`);
  }

  return {
    "WWW-Authenticate": `Bearer ${challenges.join(", ")}`,
  };
}
