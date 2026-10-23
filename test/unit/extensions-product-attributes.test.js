import assert from "node:assert/strict";
import { test } from "node:test";
import { extensionResources } from "../../tools/medusa-admin-api/medusa-admin-extensions.js";
import { listResourceEndpoints } from "../../lib/extension-resources.js";

// Ficha técnica (plugin product-attributes del boilerplate): rutas y riesgos declarados.
const calls = new Map(
  listResourceEndpoints(extensionResources)
    .filter((c) => c.resource.startsWith("attribute") || c.resource === "product_attributes")
    .map((c) => [`${c.resource}.${c.sub_action ?? c.action}`, `${c.method} ${c.path}`]),
);

test("la ficha de un producto se lee y guarda en /admin/products/{id}/attributes", () => {
  assert.equal(calls.get("product_attributes.get"), "GET /admin/products/{id}/attributes");
  assert.equal(calls.get("product_attributes.update"), "POST /admin/products/{id}/attributes");
  assert.equal(calls.has("product_attributes.list"), false, "no hay listado de fichas");
  assert.equal(calls.has("product_attributes.delete"), false);
});

test("diccionario, conjuntos y presets con sus sub-acciones reales", () => {
  assert.equal(calls.get("attributes.update_usage"), "POST /admin/attributes/{id}/usage");
  assert.equal(calls.get("attributes.update_option"), "POST /admin/attributes/{id}/options/{child_id}");
  assert.equal(calls.get("attribute_sets.enable_in_store"), "POST /admin/attribute-sets/{id}/enable");
  assert.equal(calls.get("attribute_presets.install"), "POST /admin/attribute-presets/{id}/install");
  assert.equal(calls.get("attribute_exports.template"), "GET /admin/attribute-exports/template");
});

test("carga masiva: validar no escribe; confirmar es de alto impacto", () => {
  const imports = extensionResources.attribute_imports;
  assert.equal(imports.subActions.preview.mutating, false);
  assert.equal(imports.subActions.confirm.impact, "high");
  assert.equal(imports.ops.delete, undefined, "un lote no se borra por MCP");
  assert.equal(extensionResources.attribute_exports.readOnly, true);
});
