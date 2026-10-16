import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  createHeaders,
  hasMedusaCredentials,
  makeBinarySafeRequest,
  makeRequest,
  runWithMedusaAuth,
  WriteNotAllowedError,
} from "../../lib/medusa-client.js";
import { executeToolOptimized } from "../../lib/tools.js";
import { createStreamableHTTPHandler } from "../../server/transports/streamable-http.js";
import { apiTool as adminV2 } from "../../tools/medusa-admin-api/medusa-admin-v2.js";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  globalThis.fetch = ORIGINAL_FETCH;
});

const USER_AUTH = { headers: { Authorization: "Bearer user_jwt" } };

function captureFetch() {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return calls;
}

test("inside runWithMedusaAuth the user credential replaces the env one", () => {
  process.env.MEDUSA_AUTH_TYPE = "api-key";
  process.env.MEDUSA_API_KEY = "sk_service";

  assert.equal(createHeaders().Authorization, "Basic sk_service");
  runWithMedusaAuth(USER_AUTH, () => {
    assert.equal(createHeaders().Authorization, "Bearer user_jwt");
    assert.equal(createHeaders("sk_legacy", { "x-site-id": "s1" })["x-site-id"], "s1");
  });
});

test("credential is available even without env credentials", () => {
  delete process.env.MEDUSA_API_KEY;
  delete process.env.MEDUSA_JWT;
  assert.equal(hasMedusaCredentials(), false);
  runWithMedusaAuth(USER_AUTH, () => assert.equal(hasMedusaCredentials(), true));
});

test("tool or model headers cannot override the credential", async () => {
  const calls = captureFetch();
  await runWithMedusaAuth(USER_AUTH, () =>
    makeRequest("http://localhost:9000/admin/orders", {
      method: "GET",
      headers: { Authorization: "Basic sk_service", cookie: "connect.sid=x", "x-no-compression": "true" },
    }),
  );
  const headers = calls[0].init.headers;
  assert.equal(headers.Authorization, "Bearer user_jwt");
  assert.equal(headers.cookie, undefined);
  assert.equal(headers["x-no-compression"], "true");
});

test("env mode also drops credential headers passed by a tool", async () => {
  process.env.MEDUSA_AUTH_TYPE = "api-key";
  process.env.MEDUSA_API_KEY = "sk_service";
  const calls = captureFetch();
  await makeRequest("http://localhost:9000/admin/orders", { headers: { authorization: "Bearer other" } });
  assert.equal(calls[0].init.headers.Authorization, "Basic sk_service");
  assert.equal(calls[0].init.headers.authorization, undefined);
});

test("canWrite blocks writes but never reads", async () => {
  const calls = captureFetch();
  const auth = { ...USER_AUTH, canWrite: ({ path }) => (path.startsWith("/admin/orders") ? "read-only grant" : true) };

  await runWithMedusaAuth(auth, async () => {
    await makeRequest("http://localhost:9000/admin/orders", { method: "GET" });
    await assert.rejects(
      makeRequest("http://localhost:9000/admin/orders/o_1/cancel", { method: "POST" }),
      (error) => error instanceof WriteNotAllowedError && error.status === 403 && /read-only grant/.test(error.message),
    );
    await assert.rejects(
      makeBinarySafeRequest("http://localhost:9000/admin/orders/o_1", { method: "DELETE" }),
      WriteNotAllowedError,
    );
    await makeRequest("http://localhost:9000/admin/products", { method: "POST", body: "{}" });
  });

  assert.deepEqual(
    calls.map((c) => `${c.init.method} ${new URL(c.url).pathname}`),
    ["GET /admin/orders", "POST /admin/products"],
  );
});

test("contexts do not leak between concurrent calls", async () => {
  const seen = [];
  globalThis.fetch = async (_url, init) => {
    await new Promise((r) => setTimeout(r, 5));
    seen.push(init.headers.Authorization);
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  };
  await Promise.all([
    runWithMedusaAuth({ headers: { Authorization: "Bearer a" } }, () => makeRequest("http://x/admin/a")),
    runWithMedusaAuth({ headers: { Authorization: "Bearer b" } }, () => makeRequest("http://x/admin/b")),
  ]);
  assert.deepEqual(seen.sort(), ["Bearer a", "Bearer b"]);
});

test("runWithMedusaAuth refuses an empty credential", () => {
  assert.throws(() => runWithMedusaAuth({ headers: {} }, () => null), /credential headers/);
});

test("manage_medusa_admin_v2 keeps only safe model headers", async () => {
  process.env.MEDUSA_BASE_URL = "http://localhost:9000";
  const calls = captureFetch();
  await runWithMedusaAuth(USER_AUTH, () =>
    adminV2.function({
      action: "request",
      method: "GET",
      path: "/admin/orders",
      headers: { Authorization: "Basic sk_service", "x-no-compression": "true" },
    }),
  );
  assert.equal(calls[0].init.headers.Authorization, "Bearer user_jwt");
  assert.equal(calls[0].init.headers["x-no-compression"], "true");
});

test("executeToolOptimized runs in-process tools with the given credential", async () => {
  const tools = [
    {
      definition: { name: "probe", parameters: { type: "object", properties: {} } },
      function: async () => createHeaders().Authorization,
    },
  ];
  const result = await executeToolOptimized(tools, "probe", {}, { medusaAuth: USER_AUTH });
  assert.equal(result.content[0].text, "Bearer user_jwt");
});

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    },
  };
}

async function rpc(handler, method, params, req = {}) {
  const res = createResponse();
  await handler.handleRequest(
    { method: "POST", headers: {}, body: { jsonrpc: "2.0", id: 1, method, params }, on() {}, ...req },
    res,
  );
  return res.body;
}

function userAuthHandler(overrides = {}) {
  const tools = [
    { definition: { name: "allowed_tool" }, function: async () => createHeaders().Authorization },
    { definition: { name: "hidden_tool" }, function: async () => "should not run" },
  ];
  return createStreamableHTTPHandler({
    discoverTools: async () => tools,
    transformToolsToMcp: (list) => list.map((t) => ({ name: t.definition.name, inputSchema: {} })),
    executeToolOptimized,
    filterTools: async (req, mcpTools) => mcpTools.filter((t) => req.user.tools.includes(t.name)),
    authorizeToolCall: async (req, { name }) =>
      req.user.tools.includes(name)
        ? { allowed: true, medusaAuth: { headers: { Authorization: `Bearer ${req.user.jwt}` } } }
        : { allowed: false, reason: `Tu rol no incluye ${name}.` },
    ...overrides,
  });
}

test("tools/list shows only what filterTools returns", async () => {
  const handler = userAuthHandler();
  const body = await rpc(handler, "tools/list", {}, { user: { tools: ["allowed_tool"] } });
  assert.deepEqual(body.result.tools.map((t) => t.name), ["allowed_tool"]);
});

test("tools/call runs with the user credential or returns the denial", async () => {
  const handler = userAuthHandler();
  const req = { user: { tools: ["allowed_tool"], jwt: "user_jwt" } };

  const ok = await rpc(handler, "tools/call", { name: "allowed_tool", arguments: {} }, req);
  assert.equal(ok.result.content[0].text, "Bearer user_jwt");

  const denied = await rpc(handler, "tools/call", { name: "hidden_tool", arguments: {} }, req);
  assert.equal(denied.result.isError, true);
  assert.match(denied.result.content[0].text, /no incluye hidden_tool/);
});

test("a failing hook fails the request instead of allowing everything", async () => {
  const handler = userAuthHandler({
    filterTools: async () => {
      throw new Error("permissions unavailable");
    },
  });
  const body = await rpc(handler, "tools/list", {}, { user: { tools: [] } });
  assert.match(body.error.message, /permissions unavailable/);
});
