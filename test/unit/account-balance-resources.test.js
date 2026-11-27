import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { apiTool as extensionsTool } from "../../tools/medusa-admin-api/medusa-admin-extensions.js";
import { apiTool as integrationsTool } from "../../tools/medusa-admin-api/medusa-admin-ext-integrations.js";
import { apiTool as whatsappTool } from "../../tools/medusa-admin-api/medusa-admin-ext-whatsapp.js";

// Cuentas corrientes B2B (Brick Work #376): empresas sincronizadas del ERP, sus
// usuarios y permisos, carga por lote y avisos automáticos de saldo.

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;
let fetchCalls;

beforeEach(() => {
  fetchCalls = [];
  process.env.MEDUSA_BASE_URL = "https://medusa.example.com";
  process.env.MEDUSA_API_KEY = "secret-key";
  process.env.MEDUSA_AUTH_TYPE = "api-key";
  globalThis.fetch = async (url, options = {}) => {
    fetchCalls.push({ url: String(url), options });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  globalThis.fetch = ORIGINAL_FETCH;
});

const lastCall = () => fetchCalls[fetchCalls.length - 1];
const lastUrl = () => new URL(lastCall().url);
const lastBody = () => JSON.parse(lastCall().options.body);
const withSite = (tool) => (args) => tool.function({ site_id: "site_brick", ...args });
const extensions = withSite(extensionsTool);
const whatsapp = withSite(whatsappTool);
const integrations = withSite(integrationsTool);

const rows = [{ erp_customer_id: "1001", first_name: "Ana", whatsapp: "294 412-3456", can_receive_notifications: true }];
const automation = {
  name: "Aviso puntual",
  enabled: true,
  condition: { type: "positive" },
  schedule: { type: "once", date: "2026-12-01", hour: 9, minute: 30 },
  recipients: { type: "companies", company_ids: ["comp_1", "comp_2"] },
  timezone: "America/Argentina/Buenos_Aires",
};

test("the tools list the account balance resources with their signatures", () => {
  assert.match(
    extensionsTool.definition.description,
    /companies \[LGCUD\]: .* · .*member_events, import_members_preview, import_members!, list_members, create_member, update_member, delete_member/,
  );
  assert.match(whatsappTool.definition.description, /whatsapp_automations \[LGC!U!D!\]: .* · readiness, sends, recipients_preview/);
  assert.ok(whatsappTool.definition.parameters.properties.resource.enum.includes("whatsapp_automations"));
  assert.match(integrationsTool.definition.description, /customer_balances, run_customer_balance_sync!/);
});

test("companies can be searched by their ERP customer id", async () => {
  await extensions({ action: "list", resource: "companies", query: { erp_customer_id: "1001", erp_linked: true }, limit: 20 });
  assert.equal(lastCall().options.method, "GET");
  assert.equal(lastUrl().pathname, "/admin/companies");
  assert.equal(lastUrl().searchParams.get("erp_customer_id"), "1001");
  assert.equal(lastUrl().searchParams.get("erp_linked"), "true");
  assert.equal(lastCall().options.headers["x-site-id"], "site_brick");
});

test("company users: permissions are updated on the member and their history is readable", async () => {
  await extensions({
    action: "sub_action",
    resource: "companies",
    sub_action: "update_member",
    id: "comp_1",
    child_id: "mem_1",
    body: { can_view_balance: true, can_receive_notifications: false },
  });
  assert.equal(lastCall().options.method, "POST");
  assert.equal(lastUrl().pathname, "/admin/companies/comp_1/members/mem_1");
  assert.deepEqual(lastBody(), { can_view_balance: true, can_receive_notifications: false });

  await extensions({ action: "sub_action", resource: "companies", sub_action: "member_events", id: "comp_1", child_id: "mem_1" });
  assert.equal(lastCall().options.method, "GET");
  assert.equal(lastUrl().pathname, "/admin/companies/comp_1/members/mem_1/events");
});

test("a batch of users is previewed without confirmation and loaded only with it", async () => {
  await extensions({ action: "sub_action", resource: "companies", sub_action: "import_members_preview", body: { rows } });
  assert.equal(lastCall().options.method, "POST");
  assert.equal(lastUrl().pathname, "/admin/b2b/member-imports/preview");
  assert.deepEqual(lastBody(), { rows });

  const before = fetchCalls.length;
  const refused = await extensions({ action: "sub_action", resource: "companies", sub_action: "import_members", body: { rows } });
  assert.equal(refused.requires_confirmation, true);
  assert.equal(fetchCalls.length, before);

  await extensions({ action: "sub_action", resource: "companies", sub_action: "import_members", body: { rows }, confirm: true });
  assert.equal(lastUrl().pathname, "/admin/b2b/member-imports/apply");
  assert.deepEqual(lastBody(), { rows });

  const missing = await extensions({ action: "sub_action", resource: "companies", sub_action: "import_members_preview", body: {} });
  assert.match(String(missing.error), /body\.rows/);
});

test("balance automations: read freely, preview recipients, create only with confirmation", async () => {
  await whatsapp({ action: "list", resource: "whatsapp_automations" });
  assert.equal(lastCall().options.method, "GET");
  assert.equal(lastUrl().pathname, "/admin/whatsapp-automations");

  await whatsapp({
    action: "sub_action",
    resource: "whatsapp_automations",
    sub_action: "recipients_preview",
    body: { recipients: automation.recipients, condition: automation.condition },
  });
  assert.equal(lastCall().options.method, "POST");
  assert.equal(lastUrl().pathname, "/admin/whatsapp-automations/recipients-preview");

  await whatsapp({ action: "sub_action", resource: "whatsapp_automations", sub_action: "sends", query: { automation_id: "waa_1" } });
  assert.equal(lastUrl().pathname, "/admin/whatsapp-automations/sends");
  assert.equal(lastUrl().searchParams.get("automation_id"), "waa_1");

  const before = fetchCalls.length;
  for (const args of [
    { action: "create", resource: "whatsapp_automations", body: automation },
    { action: "update", resource: "whatsapp_automations", id: "waa_1", body: { enabled: true } },
    { action: "delete", resource: "whatsapp_automations", id: "waa_1" },
  ]) {
    const refused = await whatsapp(args);
    assert.equal(refused.requires_confirmation, true, args.action);
  }
  assert.equal(fetchCalls.length, before);

  await whatsapp({ action: "create", resource: "whatsapp_automations", body: automation, confirm: true });
  assert.equal(lastCall().options.method, "POST");
  assert.equal(lastUrl().pathname, "/admin/whatsapp-automations");
  assert.deepEqual(lastBody(), automation);

  await whatsapp({ action: "update", resource: "whatsapp_automations", id: "waa_1", body: { enabled: false }, confirm: true });
  assert.equal(lastUrl().pathname, "/admin/whatsapp-automations/waa_1");
});

test("ERP customer balances are readable and the sync needs confirmation", async () => {
  await integrations({ action: "sub_action", resource: "erp", sub_action: "customer_balances", query: { q: "1001", only_debt: true } });
  assert.equal(lastCall().options.method, "GET");
  assert.equal(lastUrl().pathname, "/admin/erp/customer-balances");
  assert.equal(lastUrl().searchParams.get("q"), "1001");

  const before = fetchCalls.length;
  const refused = await integrations({ action: "sub_action", resource: "erp", sub_action: "run_customer_balance_sync" });
  assert.equal(refused.requires_confirmation, true);
  assert.equal(fetchCalls.length, before);
});

test("describe explains the new actions without calling the backend", async () => {
  const described = await whatsapp({ action: "describe", resource: "whatsapp_automations" });
  assert.equal(fetchCalls.length, 0);
  assert.equal(described.actions.create.high_impact, true);
  assert.equal(described.sub_actions.recipients_preview.mutating, false);
  assert.match(String(described.notes), /recipients/);

  const companies = await extensions({ action: "describe", resource: "companies" });
  assert.equal(fetchCalls.length, 0);
  assert.equal(companies.sub_actions.import_members.high_impact, true);
  assert.equal(companies.sub_actions.import_members_preview.mutating, false);
  assert.match(companies.sub_actions.update_member.note, /can_receive_notifications/);
});
