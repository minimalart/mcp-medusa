import assert from "node:assert/strict";
import { test } from "node:test";
import { toolPaths } from "../../tools/paths.js";
import { discoverTools, transformToolsToMcp } from "../../lib/tools.js";
import { TOOL_ACTIONS, listResourceEndpoints } from "../../lib/extension-resources.js";

const JSON_SCHEMA_TYPES = new Set(["string", "number", "integer", "boolean", "object", "array", "null"]);

async function loadExtensionTools() {
  const out = [];
  for (const rel of toolPaths) {
    const mod = await import(`../../tools/${rel}`);
    if (mod.extensionResources) out.push({ rel, apiTool: mod.apiTool, resources: mod.extensionResources });
  }
  return out;
}

function assertValidSchema(schema, where) {
  assert.equal(schema.type, "object", `${where}: parameters.type must be object`);
  assert.ok(schema.properties && typeof schema.properties === "object", `${where}: properties`);
  for (const [name, prop] of Object.entries(schema.properties)) {
    assert.ok(JSON_SCHEMA_TYPES.has(prop.type), `${where}.${name}: invalid type ${prop.type}`);
    assert.equal(typeof prop.description, "string", `${where}.${name}: description`);
    assert.ok(prop.description.length > 0, `${where}.${name}: empty description`);
    if (prop.enum) {
      assert.ok(Array.isArray(prop.enum) && prop.enum.length > 0, `${where}.${name}: enum`);
      assert.equal(new Set(prop.enum).size, prop.enum.length, `${where}.${name}: duplicated enum values`);
      prop.enum.forEach((v) => assert.equal(typeof v, prop.type, `${where}.${name}: enum value type`));
    }
  }
  for (const req of schema.required || []) {
    assert.ok(schema.properties[req], `${where}: required ${req} is not a property`);
  }
  // Serializable as-is (what tools/list sends).
  assert.deepEqual(JSON.parse(JSON.stringify(schema)), schema);
}

test("every extension tool is registered, loads and exposes a valid JSON schema", async () => {
  const tools = await loadExtensionTools();
  const names = tools.map((t) => t.apiTool.definition.name).sort();
  assert.deepEqual(names, [
    "manage_minimalart_ai_assistant",
    "manage_minimalart_commerce",
    "manage_minimalart_extensions",
    "manage_minimalart_growth",
    "manage_minimalart_integrations",
    "manage_minimalart_logistics",
    "manage_minimalart_stores",
    "manage_minimalart_whatsapp",
    "manage_store_memory",
  ]);

  for (const { apiTool, resources, rel } of tools) {
    const { definition } = apiTool;
    assert.match(definition.name, /^[a-z0-9_]{1,64}$/, rel);
    assert.equal(typeof apiTool.function, "function");
    assertValidSchema(definition.parameters, definition.name);

    const props = definition.parameters.properties;
    assert.deepEqual(props.action.enum, [...TOOL_ACTIONS], `${definition.name}: action enum`);
    assert.deepEqual(props.resource.enum, Object.keys(resources), `${definition.name}: resource enum = declared resources`);
    assert.deepEqual(definition.parameters.required, ["action", "resource"]);
    for (const prop of ["sub_action", "id", "child_id", "query", "body", "site_id", "confirm"]) {
      assert.ok(props[prop], `${definition.name}: missing ${prop}`);
    }

    assert.ok(Object.keys(resources).length <= 30, `${definition.name}: more than 30 resources`);
    for (const name of Object.keys(resources)) {
      assert.ok(definition.description.includes(`- ${name} [`), `${definition.name}: description misses ${name}`);
    }
    for (const resource of Object.values(resources)) {
      for (const sub of Object.keys(resource.subActions)) {
        assert.ok(definition.description.includes(sub), `${definition.name}: description misses sub_action ${sub}`);
      }
      for (const [sub, ep] of Object.entries(resource.subActions)) {
        if (ep.impact) assert.ok(definition.description.includes(`${sub}!`), `${definition.name}: ${sub} not flagged`);
      }
    }
    assert.ok(definition.description.length < 4000, `${definition.name}: description too long (${definition.description.length})`);
  }
});

test("declared calls use only /admin paths, known methods and no never-expose routes", async () => {
  const NEVER = [
    /\/admin\/ai-assistant\/keys/,
    /\/admin\/site-credentials/,
    /\/admin\/checkout-links\/config/,
    /\/secure-link/,
    /\/admin\/debug/,
    /\/admin\/maintenance/,
    /\/admin\/database-explorer/,
    /\/seed-orders/,
    /\/messages\/stream/,
    /\/oauth\//,
    /\/admin\/media-library\/proxy/,
    /\/admin\/kapso\/inbox-embed/,
  ];
  for (const { apiTool, resources } of await loadExtensionTools()) {
    for (const ep of listResourceEndpoints(resources)) {
      assert.match(ep.path, /^\/admin\//, `${apiTool.definition.name} ${ep.path}`);
      assert.ok(["GET", "POST", "PUT", "PATCH", "DELETE"].includes(ep.method));
      for (const pattern of NEVER) {
        assert.equal(pattern.test(ep.path), false, `${apiTool.definition.name} exposes ${ep.path}`);
      }
    }
  }
});

test("tool names are unique across the server and MCP transform keeps the schema", async () => {
  const tools = await discoverTools(true);
  const mcp = transformToolsToMcp(tools);
  const names = mcp.map((t) => t.name);
  assert.equal(new Set(names).size, names.length, "duplicated tool names");
  for (const name of ["manage_minimalart_extensions", "manage_store_memory", "manage_minimalart_commerce"]) {
    const tool = mcp.find((t) => t.name === name);
    assert.ok(tool, `${name} not discovered`);
    assert.ok(tool.inputSchema.properties.context, "context property injected");
    assert.equal(tool.annotations, undefined, "mutating tools must not be flagged read-only");
  }
});
