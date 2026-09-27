import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { apiTool, extensionResources, MEMORY_TYPES } from "../../tools/medusa-admin-api/medusa-admin-store-memory.js";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;
let fetchCalls;
let responder;

const json = (payload, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  fetchCalls = [];
  responder = (url, options) => {
    const { pathname } = new URL(url);
    if (options.method === "POST" && pathname === "/admin/ai-assistant/memory") {
      const body = JSON.parse(options.body);
      return json({ memory: { id: "mem_1", status: "active", ...body } }, 201);
    }
    if (options.method === "POST" && pathname === "/admin/ai-assistant/memory/mem_1") {
      const body = JSON.parse(options.body);
      return json({ memory: { id: "mem_1", title: "t", status: body.status } });
    }
    return json({ ok: true });
  };
  process.env.MEDUSA_BASE_URL = "https://medusa.example.com";
  process.env.MEDUSA_API_KEY = "secret-key";
  process.env.MEDUSA_AUTH_TYPE = "api-key";
  globalThis.fetch = async (url, options = {}) => {
    fetchCalls.push({ url: String(url), method: options.method, body: options.body, headers: options.headers });
    return responder(String(url), options);
  };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  globalThis.fetch = ORIGINAL_FETCH;
});

const paths = () => fetchCalls.map((c) => `${c.method} ${new URL(c.url).pathname}`);

const NEW_MEMORY = {
  memory_type: "business_rule",
  title: "Envío gratis",
  content: "Las compras mayores a $50.000 tienen envío gratis en CABA.",
  tags: ["envios"],
  importance_score: 80,
};

test("create defaults to pending: POST then POST /:id {status:'pending'}", async () => {
  const result = await apiTool.function({ action: "create", resource: "memories", body: NEW_MEMORY });
  assert.deepEqual(paths(), ["POST /admin/ai-assistant/memory", "POST /admin/ai-assistant/memory/mem_1"]);
  assert.deepEqual(JSON.parse(fetchCalls[0].body), NEW_MEMORY);
  assert.deepEqual(JSON.parse(fetchCalls[1].body), { status: "pending" });
  assert.equal(result.memory.status, "pending");
  assert.match(result.note, /PENDIENTE/);
  assert.match(result.note, /Asistente IA → Memoria/);
});

test("explicit body.status 'pending' behaves like the default and is not sent on create", async () => {
  await apiTool.function({ action: "create", resource: "memories", body: { ...NEW_MEMORY, status: "pending" } });
  assert.equal("status" in JSON.parse(fetchCalls[0].body), false);
  assert.deepEqual(JSON.parse(fetchCalls[1].body), { status: "pending" });
});

test("create with body.status 'active' (user asked) skips the pending step", async () => {
  const result = await apiTool.function({ action: "create", resource: "memories", body: { ...NEW_MEMORY, status: "active" } });
  assert.deepEqual(paths(), ["POST /admin/ai-assistant/memory"]);
  assert.equal("status" in JSON.parse(fetchCalls[0].body), false);
  assert.equal(result.memory.status, "active");
  assert.match(result.note, /ACTIVA/);
});

test("if setting pending fails, the memory is deleted instead of staying active", async () => {
  const base = responder;
  responder = (url, options) => {
    const { pathname } = new URL(url);
    if (options.method === "POST" && pathname === "/admin/ai-assistant/memory/mem_1") return json({ message: "boom" }, 500);
    return base(url, options);
  };
  const result = await apiTool.function({ action: "create", resource: "memories", body: NEW_MEMORY });
  assert.deepEqual(paths(), [
    "POST /admin/ai-assistant/memory",
    "POST /admin/ai-assistant/memory/mem_1",
    "DELETE /admin/ai-assistant/memory/mem_1",
  ]);
  assert.match(result.error, /deleted to avoid an unreviewed active memory/);
});

test("if both pending and rollback fail, the error says the memory is ACTIVE", async () => {
  const base = responder;
  responder = (url, options) => {
    const { pathname } = new URL(url);
    if (pathname === "/admin/ai-assistant/memory/mem_1") return json({ message: "down" }, 503);
    return base(url, options);
  };
  const result = await apiTool.function({ action: "create", resource: "memories", body: NEW_MEMORY });
  assert.match(result.error, /created ACTIVE/);
  assert.equal(result.memory.id, "mem_1");
});

test("create validates required fields, memory_type and scores before calling the store", async () => {
  let result = await apiTool.function({ action: "create", resource: "memories", body: { memory_type: "faq", title: "x" } });
  assert.match(result.error, /body\.content is required/);
  result = await apiTool.function({ action: "create", resource: "memories", body: { ...NEW_MEMORY, memory_type: "gossip" } });
  assert.match(result.error, /memory_type must be one of/);
  result = await apiTool.function({ action: "create", resource: "memories", body: { ...NEW_MEMORY, importance_score: 150 } });
  assert.match(result.error, /between 0 and 100/);
  result = await apiTool.function({ action: "create", resource: "memories", body: { ...NEW_MEMORY, status: "archived" } });
  assert.match(result.error, /pending \(default\) or active/);
  assert.equal(fetchCalls.length, 0);
});

test("list passes memory filters as query params", async () => {
  await apiTool.function({
    action: "list",
    resource: "memories",
    limit: 50,
    q: "envío",
    query: { status: "pending", agent_key: "null", memory_type: "business_rule", tag: "envios" },
  });
  const url = new URL(fetchCalls[0].url);
  assert.equal(url.pathname, "/admin/ai-assistant/memory");
  assert.equal(url.searchParams.get("status"), "pending");
  assert.equal(url.searchParams.get("agent_key"), "null");
  assert.equal(url.searchParams.get("q"), "envío");
});

test("search, feedback, archive, update and delete hit the documented routes", async () => {
  await apiTool.function({ action: "sub_action", resource: "memories", sub_action: "search", body: { query: "envíos", limit: 5 } });
  await apiTool.function({ action: "sub_action", resource: "memories", sub_action: "feedback", id: "mem_1", body: { useful: false } });
  await apiTool.function({ action: "sub_action", resource: "memories", sub_action: "archive", id: "mem_1", body: { status: "active" } });
  await apiTool.function({ action: "update", resource: "memories", id: "mem_1", body: { title: "Nuevo" } });
  await apiTool.function({ action: "delete", resource: "memories", id: "mem_1" });
  assert.deepEqual(paths(), [
    "POST /admin/ai-assistant/memory/search",
    "POST /admin/ai-assistant/memory/mem_1/feedback",
    "POST /admin/ai-assistant/memory/mem_1",
    "POST /admin/ai-assistant/memory/mem_1",
    "DELETE /admin/ai-assistant/memory/mem_1",
  ]);
  assert.deepEqual(JSON.parse(fetchCalls[0].body), { query: "envíos", limit: 5 });
  assert.deepEqual(JSON.parse(fetchCalls[2].body), { status: "archived" });

  const noQuery = await apiTool.function({ action: "sub_action", resource: "memories", sub_action: "search", body: {} });
  assert.match(noQuery.error, /body\.query/);
  const noUseful = await apiTool.function({ action: "sub_action", resource: "memories", sub_action: "feedback", id: "m", body: {} });
  assert.match(noUseful.error, /body\.useful/);
  const badUpdate = await apiTool.function({ action: "update", resource: "memories", id: "m", body: { status: "deleted" } });
  assert.match(badUpdate.error, /status must be/);
});

test("documents: list defaults to global, upload needs confirm and a supported file", async () => {
  await apiTool.function({ action: "list", resource: "documents" });
  assert.equal(new URL(fetchCalls[0].url).pathname, "/admin/ai-assistant/agents/global/documents");

  await apiTool.function({ action: "list", resource: "documents", id: "agent_1" });
  assert.equal(new URL(fetchCalls[1].url).pathname, "/admin/ai-assistant/agents/agent_1/documents");

  const upload = { filename: "politicas.md", mimeType: "text/markdown", content: Buffer.from("# Envíos").toString("base64") };
  const unconfirmed = await apiTool.function({ action: "create", resource: "documents", id: "global", body: upload });
  assert.equal(unconfirmed.requires_confirmation, true);

  const badMime = await apiTool.function({
    action: "create",
    resource: "documents",
    id: "global",
    confirm: true,
    body: { ...upload, mimeType: "image/png" },
  });
  assert.match(badMime.error, /mimeType must be one of/);
  assert.equal(fetchCalls.length, 2);

  await apiTool.function({ action: "create", resource: "documents", id: "global", confirm: true, body: upload });
  assert.equal(new URL(fetchCalls[2].url).pathname, "/admin/ai-assistant/agents/global/documents");
  assert.deepEqual(JSON.parse(fetchCalls[2].body), upload);

  await apiTool.function({ action: "delete", resource: "documents", id: "doc_1" });
  assert.equal(new URL(fetchCalls[3].url).pathname, "/admin/ai-assistant/documents/doc_1");
});

test("proposals approve executes actions, so it requires confirm; agents and runs are read-only", async () => {
  const blocked = await apiTool.function({ action: "sub_action", resource: "proposals", sub_action: "approve", id: "prop_1" });
  assert.equal(blocked.requires_confirmation, true);
  assert.equal(fetchCalls.length, 0);

  await apiTool.function({ action: "sub_action", resource: "proposals", sub_action: "approve", id: "prop_1", confirm: true });
  assert.deepEqual(paths(), ["POST /admin/ai-assistant/proposals/prop_1/approve"]);

  for (const resource of ["agents", "runs"]) {
    const denied = await apiTool.function({ action: "create", resource, body: {} });
    assert.match(denied.error, /read-only/);
  }
  assert.equal(extensionResources.agents.readOnly, true);
  assert.equal(extensionResources.runs.readOnly, true);
});

test("tool description explains pending review, active-only search and the memory types", () => {
  const { description, parameters } = apiTool.definition;
  assert.equal(apiTool.definition.name, "manage_store_memory");
  assert.match(description, /PENDIENTE/);
  assert.match(description, /solo devuelve ACTIVAS/);
  assert.match(description, /no por tienda/);
  for (const type of MEMORY_TYPES) assert.ok(description.includes(type), `missing ${type}`);
  assert.deepEqual(parameters.properties.resource.enum, ["memories", "documents", "agents", "proposals", "runs"]);
});
