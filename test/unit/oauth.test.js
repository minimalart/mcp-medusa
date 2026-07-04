import assert from "node:assert/strict";
import { afterEach, before, test } from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { authenticateRequest } from "../../lib/auth.js";
import {
  getAuthorizationServerMetadata,
  getProtectedResourceMetadata,
  verifyOAuthRequest,
} from "../../lib/oauth.js";

const ORIGINAL_ENV = { ...process.env };
let privateKey;
let publicJwks;

before(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const publicJwk = await exportJWK(pair.publicKey);
  publicJwk.kid = "test-key";
  publicJwks = { keys: [publicJwk] };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

async function signToken(claims = {}) {
  return await new SignJWT({
    scope: "mcp:access tools:read",
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer("https://issuer.example.com")
    .setAudience("https://mcp.example.com")
    .setSubject("user_123")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

function configureOAuthEnv() {
  process.env.MCP_AUTH_MODE = "oauth";
  process.env.MCP_RESOURCE_URL = "https://mcp.example.com";
  process.env.OAUTH_ISSUER = "https://issuer.example.com";
  process.env.OAUTH_AUDIENCE = "https://mcp.example.com";
  process.env.OAUTH_JWKS_JSON = JSON.stringify(publicJwks);
  process.env.OAUTH_REQUIRED_SCOPES = "mcp:access";
}

test("protected resource metadata includes resource, authorization server, and scopes", () => {
  configureOAuthEnv();

  assert.deepEqual(getProtectedResourceMetadata({ headers: {} }), {
    resource: "https://mcp.example.com",
    authorization_servers: ["https://issuer.example.com"],
    bearer_methods_supported: ["header"],
    scopes_supported: ["mcp:access"],
  });
});

test("authorization server metadata reflects configured endpoints", () => {
  configureOAuthEnv();
  process.env.OAUTH_AUTHORIZATION_ENDPOINT = "https://issuer.example.com/oauth/authorize";
  process.env.OAUTH_TOKEN_ENDPOINT = "https://issuer.example.com/oauth/token";
  process.env.OAUTH_REGISTRATION_ENDPOINT = "https://issuer.example.com/oauth/register";
  process.env.OAUTH_JWKS_URI = "https://issuer.example.com/.well-known/jwks.json";

  assert.equal(
    getAuthorizationServerMetadata({ headers: {} }).authorization_endpoint,
    "https://issuer.example.com/oauth/authorize",
  );
  assert.equal(
    getAuthorizationServerMetadata({ headers: {} }).token_endpoint,
    "https://issuer.example.com/oauth/token",
  );
  assert.equal(
    getAuthorizationServerMetadata({ headers: {} }).registration_endpoint,
    "https://issuer.example.com/oauth/register",
  );
  assert.equal(
    getAuthorizationServerMetadata({ headers: {} }).client_id_metadata_document_supported,
    true,
  );
});

test("verifyOAuthRequest accepts a valid JWT with required scope", async () => {
  configureOAuthEnv();
  const token = await signToken();

  const result = await verifyOAuthRequest({
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(result.payload.sub, "user_123");
});

test("verifyOAuthRequest rejects missing required scopes", async () => {
  configureOAuthEnv();
  const token = await signToken({ scope: "tools:read" });

  await assert.rejects(
    () => verifyOAuthRequest({ headers: { authorization: `Bearer ${token}` } }),
    /Missing required OAuth scopes: mcp:access/,
  );
});

test("authenticateRequest returns OAuth WWW-Authenticate metadata on missing token", async () => {
  configureOAuthEnv();

  const result = await authenticateRequest({
    headers: { host: "mcp.example.com", "x-forwarded-proto": "https" },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.equal(
    result.headers["WWW-Authenticate"],
    'Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource", scope="mcp:access"',
  );
});
