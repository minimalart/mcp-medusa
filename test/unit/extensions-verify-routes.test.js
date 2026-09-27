import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { EXCLUDED_ROUTES, matchRoute, scanRoutes } from "../../scripts/verify-extension-routes.js";

// Boilerplate mínimo en un tmpdir: app + una extensión + un plugin.
const root = fs.mkdtempSync(path.join(os.tmpdir(), "verify-ext-routes-"));
after(() => fs.rmSync(root, { recursive: true, force: true }));

function writeRoute(rel, source) {
  const file = path.join(root, rel, "route.ts");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source);
}

writeRoute("apps/backend/src/api/admin/brands", "export const GET = async () => {};\nexport async function POST() {}");
writeRoute("apps/backend/src/api/admin/brands/[brand_id]", "export const GET = 1; export const DELETE = 1;");
writeRoute("apps/backend/src/api/admin/brands/export", "export async function GET() {}");
writeRoute(
  "packages/extensions/typesense/payload/apps/backend/src/api/admin/typesense/synonyms/[id]",
  "export { handler as PUT, GET } from './x'",
);
writeRoute("packages/plugins/plugin-x/src/api/admin/market/[resource]/[id]/[action]", "export { get as GET, post as POST } from '../h'");
fs.mkdirSync(path.join(root, "apps/backend/src/api/admin/node_modules/ignored"), { recursive: true });
fs.writeFileSync(path.join(root, "apps/backend/src/api/admin/node_modules/ignored/route.ts"), "export const GET = 1");

test("scanRoutes finds route.ts in app, extension payloads and plugins with their methods", () => {
  const routes = scanRoutes(root);
  assert.deepEqual([...routes.keys()].sort(), [
    "/admin/brands",
    "/admin/brands/:brand_id",
    "/admin/brands/export",
    "/admin/market/:resource/:id/:action",
    "/admin/typesense/synonyms/:id",
  ]);
  assert.deepEqual([...routes.get("/admin/brands").methods].sort(), ["GET", "POST"]);
  assert.deepEqual([...routes.get("/admin/typesense/synonyms/:id").methods].sort(), ["GET", "PUT"]);
  assert.deepEqual([...routes.get("/admin/market/:resource/:id/:action").methods].sort(), ["GET", "POST"]);
});

test("matchRoute prefers static segments and only lets {placeholders} match :params", () => {
  const routes = scanRoutes(root);
  assert.equal(matchRoute(routes, "/admin/brands/export").route, "/admin/brands/export");
  assert.equal(matchRoute(routes, "/admin/brands/{id}").route, "/admin/brands/:brand_id");
  assert.equal(matchRoute(routes, "/admin/market/jobs/{id}/confirm").route, "/admin/market/:resource/:id/:action");
  assert.equal(matchRoute(routes, "/admin/brands/{id}/images"), null);
  assert.equal(matchRoute(routes, "/admin/nope"), null);
});

test("never-expose routes are in the exclusion list", () => {
  const excluded = (route) => EXCLUDED_ROUTES.some((rule) => rule.pattern.test(route));
  for (const route of [
    "/admin/ai-assistant/keys",
    "/admin/ai-assistant/keys/:id",
    "/admin/site-credentials",
    "/admin/checkout-links/config",
    "/admin/gift-card-experience/deliveries/:id/secure-link",
    "/admin/debug/heap-snapshot",
    "/admin/maintenance/carrefour-backfill",
    "/admin/database-explorer/tables",
    "/admin/commerce-dashboard/seed-orders",
    "/admin/ai-assistant/threads/:id/messages/stream",
  ]) {
    assert.ok(excluded(route), `${route} should be excluded`);
  }
  assert.equal(excluded("/admin/brands"), false);
});
