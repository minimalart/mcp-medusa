import assert from "node:assert/strict";
import { test } from "node:test";
import { createStreamableHTTPHandler } from "../../server/transports/streamable-http.js";
import {
  DEVELOPER_PROMPTS,
  MCP_PROMPTS,
  OPERATOR_PROMPTS,
  renderPrompt,
} from "../../lib/prompts.js";

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

async function call(handler, method, params, headers = {}) {
  const res = createResponse();
  await handler.handleRequest(
    { method: "POST", headers, body: { jsonrpc: "2.0", id: 1, method, params }, on() {} },
    res,
  );
  return res.body;
}

function handlerWith(options = {}) {
  return createStreamableHTTPHandler({
    discoverTools: async () => [],
    transformToolsToMcp: () => [],
    executeToolOptimized: async () => ({}),
    ...options,
  });
}

test("prompts/list publica operador y desarrollador por defecto, con arguments", async () => {
  const body = await call(handlerWith(), "prompts/list");
  const names = body.result.prompts.map((p) => p.name);
  assert.deepEqual(names, MCP_PROMPTS.map((p) => p.name));

  const campania = body.result.prompts.find((p) => p.name === "planificar_campania");
  assert.deepEqual(
    campania.arguments.map((a) => [a.name, a.required]),
    [["objetivo", true], ["fechas", false]],
  );
  // `text` y `default` son internos: no viajan en la lista.
  assert.equal("text" in campania, false);
  assert.equal(campania.arguments.some((a) => "default" in a), false);
  // Sin argumentos, el campo no se emite.
  const promos = body.result.prompts.find((p) => p.name === "revisar_promociones");
  assert.equal("arguments" in promos, false);
});

test("prompts/get interpola argumentos y usa defaults", async () => {
  const handler = handlerWith();
  const conArg = await call(handler, "prompts/get", {
    name: "resumen_ventas",
    arguments: { periodo: "septiembre 2026" },
  });
  assert.match(conArg.result.messages[0].content.text, /resumen de ventas de septiembre 2026/);

  const sinArg = await call(handler, "prompts/get", { name: "resumen_ventas" });
  assert.match(sinArg.result.messages[0].content.text, /los últimos 30 días/);
  assert.doesNotMatch(sinArg.result.messages[0].content.text, /\{\{/);
});

test("prompts/get sin un argumento requerido devuelve -32602", async () => {
  const body = await call(handlerWith(), "prompts/get", {
    name: "planificar_campania",
    arguments: { objetivo: "   " },
  });
  assert.equal(body.error.code, -32602);
  assert.match(body.error.message, /objetivo/);
});

test("quien embebe puede publicar solo los prompts de operación", async () => {
  const handler = handlerWith({ prompts: OPERATOR_PROMPTS });
  const list = await call(handler, "prompts/list");
  const names = list.result.prompts.map((p) => p.name);
  assert.equal(names.includes("medusa_upgrade_project"), false);
  assert.equal(names.includes("resumen_ventas"), true);

  const dev = await call(handler, "prompts/get", { name: DEVELOPER_PROMPTS[0].name });
  assert.equal(dev.error.code, -32602);
});

test("los prompts también se pueden resolver por request", async () => {
  const handler = handlerWith({
    prompts: (req) => (req.headers["x-perfil"] === "dev" ? DEVELOPER_PROMPTS : OPERATOR_PROMPTS),
  });
  const dev = await call(handler, "prompts/list", undefined, { "x-perfil": "dev" });
  assert.deepEqual(dev.result.prompts.map((p) => p.name), DEVELOPER_PROMPTS.map((p) => p.name));
});

test("todo prompt tiene nombre único y solo referencia argumentos declarados", () => {
  const names = new Set();
  for (const prompt of MCP_PROMPTS) {
    assert.equal(names.has(prompt.name), false, `duplicado: ${prompt.name}`);
    names.add(prompt.name);
    const declared = new Set((prompt.arguments || []).map((a) => a.name));
    for (const [, key] of prompt.text.matchAll(/\{\{(\w+)\}\}/g)) {
      assert.ok(declared.has(key), `${prompt.name} usa {{${key}}} sin declararlo`);
    }
    const args = Object.fromEntries((prompt.arguments || []).map((a) => [a.name, "x"]));
    assert.doesNotMatch(renderPrompt(prompt, args), /\{\{/);
  }
});
