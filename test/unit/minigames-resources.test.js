import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { apiTool as growthTool } from "../../tools/medusa-admin-api/medusa-admin-ext-growth.js";

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
const run = (args) => growthTool.function({ site_id: "site_brick", ...args });

const wheel = {
  name: "Ruleta de prueba",
  public_title: "¡Girá y ganá!",
  game_type: "wheel",
  starts_at: null,
  ends_at: null,
  site_ids: ["site_brick"],
  participation_rules: { mode: "visitor" },
  game_config: { button_text: "Girar" },
  outcomes: [
    { key: "a", label: "10% OFF", weight: 25, promotion_id: "promo_1", local_limit: null },
    { key: "b", label: "Seguí participando", weight: 75, promotion_id: null, local_limit: null },
  ],
};

test("growth lists the minigames resources with their signatures", () => {
  const { description, parameters } = growthTool.definition;
  assert.match(description, /minigame_campaigns \[LGCU\]: .* · publish!, pause, end, duplicate, stats/);
  assert.match(description, /minigame_settings \[GU\]/);
  assert.match(description, /minigames \[-\]: .* · sites, eligible_promotions, catalog_assets/);
  for (const name of ["minigame_campaigns", "minigame_settings", "minigames"]) {
    assert.ok(parameters.properties.resource.enum.includes(name), name);
  }
});

test("campaign create/get/list hit the plugin routes with x-site-id", async () => {
  await run({ action: "create", resource: "minigame_campaigns", body: wheel });
  assert.equal(lastCall().options.method, "POST");
  assert.equal(lastUrl().pathname, "/admin/minigames/campaigns");
  assert.equal(lastCall().options.headers["x-site-id"], "site_brick");
  assert.deepEqual(JSON.parse(lastCall().options.body), wheel);

  await run({ action: "get", resource: "minigame_campaigns", id: "mgcmp_1" });
  assert.equal(lastCall().options.method, "GET");
  assert.equal(lastUrl().pathname, "/admin/minigames/campaigns/mgcmp_1");

  await run({ action: "list", resource: "minigame_campaigns", q: "ruleta", limit: 5 });
  assert.equal(lastUrl().pathname, "/admin/minigames/campaigns");
  assert.equal(lastUrl().searchParams.get("q"), "ruleta");
});

test("campaign update is a PATCH and there is no delete", async () => {
  await run({ action: "update", resource: "minigame_campaigns", id: "mgcmp_1", body: wheel });
  assert.equal(lastCall().options.method, "PATCH");
  assert.equal(lastUrl().pathname, "/admin/minigames/campaigns/mgcmp_1");

  const count = fetchCalls.length;
  const del = await run({ action: "delete", resource: "minigame_campaigns", id: "mgcmp_1" });
  assert.match(del.error, /not available/);
  assert.equal(fetchCalls.length, count);
});

test("fields echoed by get are rejected before calling the strict API", async () => {
  const echoed = {
    ...wheel,
    id: "mgcmp_1",
    status: "draft",
    outcomes: [{ ...wheel.outcomes[0], id: "mgr_1", awarded_count: 0 }, wheel.outcomes[1]],
  };
  const res = await run({ action: "update", resource: "minigame_campaigns", id: "mgcmp_1", body: echoed });
  assert.match(res.error, /id, status, outcomes\[0\]\.id, outcomes\[0\]\.awarded_count/);

  const settings = await run({ action: "update", resource: "minigame_settings", body: { id: "mgset_1", retention_days: 90 } });
  assert.match(settings.error, /unknown fields: id/);
  assert.equal(fetchCalls.length, 0);
});

test("publish needs confirm; pause, end, duplicate and stats do not", async () => {
  const blocked = await run({ action: "sub_action", resource: "minigame_campaigns", sub_action: "publish", id: "mgcmp_1" });
  assert.equal(blocked.requires_confirmation, true);
  assert.equal(fetchCalls.length, 0);

  await run({ action: "sub_action", resource: "minigame_campaigns", sub_action: "publish", id: "mgcmp_1", confirm: true });
  assert.equal(lastCall().options.method, "POST");
  assert.equal(lastUrl().pathname, "/admin/minigames/campaigns/mgcmp_1/publish");

  for (const sub of ["pause", "end", "duplicate"]) {
    await run({ action: "sub_action", resource: "minigame_campaigns", sub_action: sub, id: "mgcmp_1" });
    assert.equal(lastCall().options.method, "POST");
    assert.equal(lastUrl().pathname, `/admin/minigames/campaigns/mgcmp_1/${sub}`);
  }
  await run({ action: "sub_action", resource: "minigame_campaigns", sub_action: "stats", id: "mgcmp_1" });
  assert.equal(lastCall().options.method, "GET");
  assert.equal(lastUrl().pathname, "/admin/minigames/campaigns/mgcmp_1/stats");
});

test("settings is a singleton updated with PATCH on the root", async () => {
  await run({ action: "get", resource: "minigame_settings" });
  assert.equal(lastUrl().pathname, "/admin/minigames/settings");

  await run({ action: "update", resource: "minigame_settings", body: { retention_days: 90, launcher_config: { text: "Jugá" } } });
  assert.equal(lastCall().options.method, "PATCH");
  assert.equal(lastUrl().pathname, "/admin/minigames/settings");
});

test("helper sub-actions: sites, eligible promotions and catalog assets", async () => {
  await growthTool.function({ action: "sub_action", resource: "minigames", sub_action: "sites" });
  assert.equal(lastUrl().pathname, "/admin/minigames/sites");

  await run({ action: "sub_action", resource: "minigames", sub_action: "eligible_promotions", query: { q: "JUEGO" } });
  assert.equal(lastUrl().pathname, "/admin/minigames/promotions/eligible");
  assert.equal(lastUrl().searchParams.get("q"), "JUEGO");

  const count = fetchCalls.length;
  const missing = await run({ action: "sub_action", resource: "minigames", sub_action: "catalog_assets", query: { type: "category" } });
  assert.match(missing.error, /query\.id, query\.pairs/);
  assert.equal(fetchCalls.length, count);

  await run({ action: "sub_action", resource: "minigames", sub_action: "catalog_assets", query: { type: "category", id: "pcat_1", pairs: 6 } });
  assert.equal(lastUrl().pathname, "/admin/minigames/catalog-assets");
  assert.equal(lastUrl().searchParams.get("pairs"), "6");
});

test("describe documents games, lifecycle and the full body", async () => {
  const described = await growthTool.function({ action: "describe", resource: "minigame_campaigns" });
  assert.deepEqual(Object.keys(described.notes.games), ["wheel", "slots", "memory", "treasure"]);
  assert.match(described.notes.lifecycle, /store_has_active_game/);
  assert.equal(described.actions.update.call, "PATCH /admin/minigames/campaigns/{id}");
  assert.equal(described.sub_actions.publish.high_impact, true);
  assert.equal(fetchCalls.length, 0);
});
