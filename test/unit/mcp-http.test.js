import assert from "node:assert/strict";
import { test } from "node:test";
import { createStreamableHTTPHandler } from "../../server/transports/streamable-http.js";

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    ended: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      this.ended = true;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

function createPost(body, headers = {}) {
  return {
    method: "POST",
    headers,
    body,
    on() {},
  };
}

function createHandler() {
  return createStreamableHTTPHandler({
    discoverTools: async () => [],
    transformToolsToMcp: () => [],
    executeToolOptimized: async () => ({ ok: true }),
    serverInfo: { name: "mcp-medusa-test", version: "1.3.0" },
  });
}

test("initialize negotiates the latest supported HTTP protocol and exposes prompts", async () => {
  const handler = createHandler();
  const res = createResponse();

  await handler.handleRequest(
    createPost(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          clientInfo: { name: "unit-test" },
        },
      },
      { "mcp-protocol-version": "2025-11-25" },
    ),
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.result.protocolVersion, "2025-11-25");
  assert.deepEqual(res.body.result.capabilities, { tools: {}, prompts: {} });
  assert.equal(res.body.result.serverInfo.version, "1.3.0");
});

test("unsupported MCP-Protocol-Version header returns a JSON-RPC error", async () => {
  const handler = createHandler();
  const res = createResponse();

  await handler.handleRequest(
    createPost(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-11-25" },
      },
      { "mcp-protocol-version": "2024-01-01" },
    ),
    res,
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, -32000);
  assert.match(res.body.error.message, /MCP-Protocol-Version not supported/);
});

test("prompts/list and prompts/get expose Medusa workflow prompts", async () => {
  const handler = createHandler();
  const listRes = createResponse();

  await handler.handleRequest(
    createPost({ jsonrpc: "2.0", id: 2, method: "prompts/list" }),
    listRes,
  );

  const names = listRes.body.result.prompts.map((prompt) => prompt.name);
  assert.ok(names.includes("medusa_upgrade_project"));
  assert.ok(names.includes("medusa_global_product_options"));

  const getRes = createResponse();
  await handler.handleRequest(
    createPost({
      jsonrpc: "2.0",
      id: 3,
      method: "prompts/get",
      params: { name: "medusa_global_product_options" },
    }),
    getRes,
  );

  assert.equal(getRes.body.result.messages[0].role, "user");
  assert.match(getRes.body.result.messages[0].content.text, /product option tools/i);
});
