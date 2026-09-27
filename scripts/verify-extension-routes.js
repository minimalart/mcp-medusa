#!/usr/bin/env node
/**
 * Cruza las rutas declaradas por las tools de extensiones (lib/extension-resources.js)
 * contra los `route.ts` reales del boilerplate Medusa, y lista las familias de
 * rutas admin que ninguna tool declara.
 *
 * Uso:
 *   node scripts/verify-extension-routes.js <ruta-al-boilerplate> [--json] [--strict]
 *   BOILERPLATE_PATH=<ruta> node scripts/verify-extension-routes.js
 *
 * Escanea (sin tocar node_modules):
 *   apps/backend/src/api/admin/**                        (app + payloads instalados)
 *   packages/extensions/* /payload/apps/backend/src/api/admin/**
 *   packages/plugins/* /src/api/admin/**
 *
 * Mismatch = una llamada declarada (método + path) sin route.ts que la atienda, o
 * cuyo route.ts no exporta ese método. Gap = (ruta, método) real que ninguna tool
 * declara y que no está en la lista de exclusiones intencionales.
 *
 * Sale con código 1 si hay mismatches (o gaps con --strict).
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { EXCLUDED_ROUTES } from '../lib/extension-exclusions.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Rutas que NO se exponen a propósito (lib/extension-exclusions.js). `pattern`
 * se compara contra el path de la ruta (con `:param`) y `methods` limita la
 * exclusión (omitido = todos).
 */
export { EXCLUDED_ROUTES };

function parseArgs(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const positional = argv.filter((a) => !a.startsWith('--'));
  return {
    root: positional[0] || process.env.BOILERPLATE_PATH || process.env.MEDUSA_BOILERPLATE_PATH,
    json: flags.has('--json'),
    strict: flags.has('--strict'),
  };
}

function adminRoots(root) {
  const roots = [];
  const app = path.join(root, 'apps', 'backend', 'src', 'api', 'admin');
  if (fs.existsSync(app)) roots.push({ dir: app, owner: 'app' });
  for (const kind of ['extensions', 'plugins']) {
    const base = path.join(root, 'packages', kind);
    if (!fs.existsSync(base)) continue;
    for (const name of fs.readdirSync(base)) {
      const dir =
        kind === 'extensions'
          ? path.join(base, name, 'payload', 'apps', 'backend', 'src', 'api', 'admin')
          : path.join(base, name, 'src', 'api', 'admin');
      if (fs.existsSync(dir)) roots.push({ dir, owner: `${kind}/${name}` });
    }
  }
  return roots;
}

function exportedMethods(source) {
  const methods = new Set();
  const direct = /export\s+(?:const|let|var|async\s+function|function)\s+(GET|POST|PUT|PATCH|DELETE)\b/g;
  for (const m of source.matchAll(direct)) methods.add(m[1]);
  for (const m of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const exported = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (METHODS.includes(exported)) methods.add(exported);
    }
  }
  return methods;
}

/** @returns {Map<string, { route: string, segments: string[], methods: Set<string>, owners: Set<string> }>} */
export function scanRoutes(root) {
  const routes = new Map();
  const walk = (dir, rel, owner) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, `${rel}/${entry.name}`, owner);
      } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
        const route = `/admin${rel}`
          .replace(/\[\[?\.\.\.([^\]]+)\]?\]/g, '*')
          .replace(/\[([^\]]+)\]/g, ':$1');
        const methods = exportedMethods(fs.readFileSync(full, 'utf8'));
        const current = routes.get(route) || {
          route,
          segments: route.split('/').filter(Boolean),
          methods: new Set(),
          owners: new Set(),
        };
        methods.forEach((m) => current.methods.add(m));
        current.owners.add(owner);
        routes.set(route, current);
      }
    }
  };
  for (const { dir, owner } of adminRoots(root)) walk(dir, '', owner);
  return routes;
}

const isParam = (segment) => segment.startsWith(':');
const isPlaceholder = (segment) => /^\{[a-z_]+\}$/.test(segment);

/**
 * Busca la ruta que atendería el path declarado, como el router de Medusa: los
 * segmentos estáticos ganan a los dinámicos. Un placeholder `{id}` solo matchea
 * un segmento `:param`; un segmento estático declarado matchea igual o `:param`.
 */
export function matchRoute(routes, declaredPath) {
  const segments = declaredPath.split('?')[0].split('/').filter(Boolean);
  let best = null;
  let bestScore = -1;
  for (const route of routes.values()) {
    const rs = route.segments;
    const catchAll = rs[rs.length - 1] === '*';
    if (!catchAll && rs.length !== segments.length) continue;
    if (catchAll && segments.length < rs.length) continue;
    let score = 0;
    let ok = true;
    for (let i = 0; i < segments.length; i++) {
      const r = rs[i];
      const d = segments[i];
      if (r === '*') break;
      if (r === undefined) { ok = false; break; }
      if (isPlaceholder(d)) {
        if (!isParam(r)) { ok = false; break; }
      } else if (isParam(r)) {
        // estático declarado contra :param → matchea, sin puntaje
      } else if (r === d) {
        score += 1;
      } else {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    // Preferencia: más estáticos coincidentes; a igualdad, sin catch-all.
    const adjusted = score * 2 + (catchAll ? 0 : 1);
    if (adjusted > bestScore) {
      best = route;
      bestScore = adjusted;
    }
  }
  return best;
}

async function loadDeclaredTools() {
  const { toolPaths } = await import(pathToFileURL(path.join(REPO_ROOT, 'tools', 'paths.js')).href);
  const { listResourceEndpoints } = await import(
    pathToFileURL(path.join(REPO_ROOT, 'lib', 'extension-resources.js')).href
  );
  const declared = [];
  for (const rel of toolPaths) {
    const mod = await import(pathToFileURL(path.join(REPO_ROOT, 'tools', rel)).href);
    if (!mod.extensionResources) continue;
    const toolName = mod.apiTool?.definition?.name || rel;
    for (const ep of listResourceEndpoints(mod.extensionResources)) declared.push({ tool: toolName, ...ep });
  }
  return declared;
}

function excludedReason(route, method) {
  const hit = EXCLUDED_ROUTES.find(
    (rule) => rule.pattern.test(route) && (!rule.methods || rule.methods.includes(method)),
  );
  return hit ? hit.reason : null;
}

function familyOf(route) {
  const segments = route.split('/').filter(Boolean);
  // /admin/<family>[/<sub>] — sub solo si es estático, para agrupar legible.
  const family = segments.slice(0, 2);
  if (segments[2] && !isParam(segments[2])) family.push(segments[2]);
  return `/${family.join('/')}`;
}

export async function verify(root) {
  const routes = scanRoutes(root);
  const declared = await loadDeclaredTools();
  const mismatches = [];
  const covered = new Map(); // route → Set(method)
  const neverExposedHits = [];

  for (const ep of declared) {
    const route = matchRoute(routes, ep.path);
    const where = `${ep.tool} ${ep.resource}.${ep.sub_action || ep.action}`;
    if (!route) {
      mismatches.push({ ...ep, problem: `no route.ts matches ${ep.path}`, where });
      continue;
    }
    if (!route.methods.has(ep.method)) {
      mismatches.push({
        ...ep,
        route: route.route,
        problem: `${route.route} does not export ${ep.method} (exports: ${[...route.methods].join(', ') || 'none'})`,
        where,
      });
      continue;
    }
    const reason = excludedReason(route.route, ep.method);
    if (reason) neverExposedHits.push({ ...ep, route: route.route, reason, where });
    if (!covered.has(route.route)) covered.set(route.route, new Set());
    covered.get(route.route).add(ep.method);
  }

  const gaps = [];
  const excluded = [];
  for (const route of [...routes.values()].sort((a, b) => a.route.localeCompare(b.route))) {
    for (const method of [...route.methods].sort()) {
      if (covered.get(route.route)?.has(method)) continue;
      const reason = excludedReason(route.route, method);
      if (reason) excluded.push({ route: route.route, method, reason });
      else gaps.push({ route: route.route, method, family: familyOf(route.route), owners: [...route.owners] });
    }
  }

  const totalPairs = [...routes.values()].reduce((n, r) => n + r.methods.size, 0);
  const coveredPairs = [...covered.values()].reduce((n, s) => n + s.size, 0);
  return {
    root,
    routes: routes.size,
    route_methods: totalPairs,
    declared_calls: declared.length,
    covered_route_methods: coveredPairs,
    mismatches,
    never_exposed_declared: neverExposedHits,
    gaps,
    excluded,
  };
}

function printReport(report) {
  const out = [];
  out.push(`Boilerplate: ${report.root}`);
  out.push(
    `Routes: ${report.routes} (${report.route_methods} route+method) · declared calls: ${report.declared_calls} · covered: ${report.covered_route_methods}`,
  );
  out.push(`\nMismatches: ${report.mismatches.length}`);
  for (const m of report.mismatches) out.push(`  ✗ [${m.where}] ${m.method} ${m.path} → ${m.problem}`);
  out.push(`\nDeclared calls hitting excluded routes: ${report.never_exposed_declared.length}`);
  for (const m of report.never_exposed_declared) out.push(`  ✗ [${m.where}] ${m.method} ${m.route} (${m.reason})`);
  out.push(`\nCoverage gaps (not declared, not excluded): ${report.gaps.length}`);
  const byFamily = new Map();
  for (const gap of report.gaps) {
    if (!byFamily.has(gap.family)) byFamily.set(gap.family, []);
    byFamily.get(gap.family).push(`${gap.method} ${gap.route}`);
  }
  for (const [family, items] of byFamily) {
    out.push(`  ${family}`);
    items.forEach((item) => out.push(`    - ${item}`));
  }
  out.push(`\nIntentionally excluded: ${report.excluded.length}`);
  const reasons = new Map();
  for (const ex of report.excluded) {
    const key = ex.reason;
    if (!reasons.has(key)) reasons.set(key, []);
    reasons.get(key).push(`${ex.method} ${ex.route}`);
  }
  for (const [reason, items] of reasons) out.push(`  ${reason}: ${items.join(', ')}`);
  console.log(out.join('\n'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.root) {
    console.error('Usage: node scripts/verify-extension-routes.js <boilerplate-path> [--json] [--strict]');
    process.exit(2);
  }
  if (!fs.existsSync(path.join(args.root, 'apps', 'backend', 'src', 'api', 'admin'))) {
    console.error(`Not a Medusa boilerplate checkout (missing apps/backend/src/api/admin): ${args.root}`);
    process.exit(2);
  }
  const report = await verify(path.resolve(args.root));
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else printReport(report);
  const failed = report.mismatches.length > 0 || report.never_exposed_declared.length > 0 || (args.strict && report.gaps.length > 0);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(2);
  });
}
