#!/usr/bin/env node

/**
 * Compares the Medusa Admin OpenAPI spec with the routes the MCP tools call.
 *
 * Usage:
 *   node scripts/medusa-openapi-coverage.js                     # downloads the spec
 *   node scripts/medusa-openapi-coverage.js --file admin.yaml   # local spec (offline)
 *   MEDUSA_OPENAPI_FILE=admin.yaml node scripts/medusa-openapi-coverage.js
 *
 * Output (JSON on stdout):
 *   - specVersion: `info.version` of the spec (e.g. 2.21.1)
 *   - missingOperations: every "METHOD /path" in the spec (/admin and /auth) with no dedicated tool call
 *   - repoRoutesNotInSpec: tool calls that are not in the core spec (plugin/custom routes, or broken calls)
 *
 * Route extraction from the tools is static and heuristic:
 *   - string and template literals in code (comments ignored) that contain /admin/ or /auth/,
 *     with `${...}` replaced by a path parameter; a nested template in `${cond ? `/x/${y}` : ""}`
 *     yields both variants (with and without the optional suffix);
 *   - the HTTP method is the first `method: 'X'` found within the next lines (fetch default: GET);
 *   - route declarations in comments of the form "METHOD /admin/..." or "GET|POST /admin/..."
 *     at the start of a comment line (used by tools that compose paths from fragments);
 *   - known v2 resources exported by medusa-admin-v2.js (GET list / get-by-id routes).
 * Every /admin/* and /auth* route is also reachable through manage_medusa_admin_v2 action=request;
 * "missing" means there is no dedicated action for it.
 */

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { toolPaths } from "../tools/paths.js";

const OPENAPI_URL = process.env.MEDUSA_OPENAPI_URL || "https://docs.medusajs.com/api/download/admin";
const METHODS = ["get", "post", "put", "patch", "delete"];
const METHOD_WINDOW_LINES = 10;

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function loadSpecText() {
  const file = argValue("--file") || process.env.MEDUSA_OPENAPI_FILE;
  if (file) {
    return { source: path.resolve(file), text: fs.readFileSync(file, "utf8") };
  }

  const response = await fetch(OPENAPI_URL, {
    headers: {
      Accept: "application/x-yaml,text/yaml,*/*",
      "User-Agent": "mcp-medusa-coverage",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download OpenAPI spec: HTTP ${response.status}`);
  }

  return { source: OPENAPI_URL, text: await response.text() };
}

function extractSpecVersion(yaml) {
  const match = yaml.match(/^info:\s*\n(?:[ \t]+.*\n)*?[ \t]+version:\s*['"]?([^'"\n]+)['"]?\s*$/m);
  return match ? match[1].trim() : null;
}

/** Parses `paths:` of an OpenAPI YAML without a YAML dependency (2-space indentation). */
function extractSpecOperations(yaml) {
  const operations = [];
  const lines = yaml.split(/\r?\n/);
  let inPaths = false;
  let currentPath = null;

  for (const line of lines) {
    if (/^paths:\s*$/.test(line)) {
      inPaths = true;
      continue;
    }
    if (!inPaths) continue;
    if (/^\S/.test(line)) break; // next top-level key (components:, tags:, ...)

    const pathMatch = line.match(/^  (\/[^:]+):\s*$/) || line.match(/^  ['"](\/[^'"]+)['"]:\s*$/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      continue;
    }

    const methodMatch = line.match(/^    (get|post|put|patch|delete):\s*$/);
    if (methodMatch && currentPath && (currentPath.startsWith("/admin") || currentPath.startsWith("/auth"))) {
      operations.push({ method: methodMatch[1].toUpperCase(), path: currentPath });
    }
  }

  return operations;
}

function extractSpecTags(yaml) {
  const tagsBlock = yaml.match(/^tags:\s*\n((?:[ \t-].*\n)*)/m);
  if (!tagsBlock) return [];
  return [...tagsBlock[1].matchAll(/^  - name: (.+)$/gm)].map((match) => match[1].trim()).sort();
}

function normalizeRoute(route) {
  return route
    .replace(/\?.*$/, "")
    .replace(/\{[^}]*\}/g, "{}")
    .replace(/\/{2,}/g, "/")
    .replace(/\/+$/, "")
    .toLowerCase();
}

/**
 * Splits JS source into code with comments blanked out (so literals inside comments are
 * ignored) and a list of comment texts with their line numbers.
 */
function splitSource(source) {
  let code = "";
  const comments = [];
  let i = 0;
  let line = 1;
  const push = (char) => {
    code += char;
    if (char === "\n") line += 1;
  };

  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];
    if (char === "/" && next === "/") {
      const end = source.indexOf("\n", i);
      const stop = end < 0 ? source.length : end;
      comments.push({ line, text: source.slice(i + 2, stop) });
      code += " ".repeat(stop - i);
      i = stop;
      continue;
    }
    if (char === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end < 0 ? source.length : end + 2;
      const text = source.slice(i + 2, stop - 2);
      text.split("\n").forEach((commentLine, index) => comments.push({ line: line + index, text: commentLine }));
      for (const c of source.slice(i, stop)) push(c === "\n" ? "\n" : " ");
      i = stop;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      const end = skipLiteral(source, i);
      for (const c of source.slice(i, end)) push(c);
      i = end;
      continue;
    }
    push(char);
    i += 1;
  }

  return { code, comments };
}

/** Returns the index right after the literal starting at `start`. */
function skipLiteral(source, start) {
  const quote = source[start];
  let i = start + 1;
  while (i < source.length) {
    const char = source[i];
    if (char === "\\") {
      i += 2;
      continue;
    }
    if (quote === "`" && char === "$" && source[i + 1] === "{") {
      i = skipExpression(source, i + 2);
      continue;
    }
    if (char === quote) return i + 1;
    if (quote !== "`" && char === "\n") return i;
    i += 1;
  }
  return i;
}

/** Skips a `${ ... }` expression body (balanced braces, nested literals). Returns index after `}`. */
function skipExpression(source, start) {
  let depth = 1;
  let i = start;
  while (i < source.length && depth > 0) {
    const char = source[i];
    if (char === "'" || char === '"' || char === "`") {
      i = skipLiteral(source, i);
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    i += 1;
  }
  return i;
}

/**
 * Expands a template literal body into concrete route shapes. `${expr}` becomes `{param}`,
 * except when `expr` contains a nested template literal starting with "/": then both the
 * variant without it and the expanded nested literal are produced (optional suffix pattern).
 */
function expandTemplate(body) {
  let variants = [""];
  let i = 0;
  while (i < body.length) {
    if (body[i] === "\\") {
      variants = variants.map((variant) => variant + body.slice(i, i + 2));
      i += 2;
      continue;
    }
    if (body[i] === "$" && body[i + 1] === "{") {
      const end = skipExpression(body, i + 2);
      const expression = body.slice(i + 2, end - 1);
      const nested = [...expression.matchAll(/`(\/[^`]*)`/g)].map((match) => match[1]);
      if (nested.length > 0) {
        const expanded = nested.flatMap((inner) => expandTemplate(inner));
        variants = variants.flatMap((variant) => [variant, ...expanded.map((suffix) => variant + suffix)]);
      } else {
        variants = variants.map((variant) => `${variant}{param}`);
      }
      i = end;
      continue;
    }
    variants = variants.map((variant) => variant + body[i]);
    i += 1;
  }
  return variants;
}

function extractLiterals(code) {
  const literals = [];
  let i = 0;
  let line = 1;
  while (i < code.length) {
    const char = code[i];
    if (char === "\n") line += 1;
    if (char === "'" || char === '"' || char === "`") {
      const end = skipLiteral(code, i);
      const body = code.slice(i + 1, Math.max(i + 1, end - 1));
      const shapes = char === "`" ? expandTemplate(body) : [body];
      // `path: "/admin/..."` object values (v2 RESOURCES) are reported through the RESOURCES export.
      const isPathProperty = /\bpath:\s*$/.test(code.slice(Math.max(0, i - 20), i));
      if (!isPathProperty) literals.push({ line, shapes });
      line += (code.slice(i, end).match(/\n/g) || []).length;
      i = end;
      continue;
    }
    i += 1;
  }
  return literals;
}

/**
 * Only literals that ARE a path/URL count (optionally prefixed by `${baseUrl}`); prose such as
 * error messages that mention a route contains whitespace and is ignored.
 */
function routeFromShape(shape) {
  if (/\s/.test(shape)) return null;
  const match = shape.match(/^(?:\{param\}|https?:\/\/[^/]+)?(\/(?:admin|auth)\/[^"'`?)]+)/);
  if (!match) return null;
  return match[1]
    .replace(/\{param\}\{param\}/g, "{param}")
    // `.../options${suffix}`: a parameter glued to a word is an optional suffix, not a segment.
    .replace(/([^/])\{param\}/g, "$1")
    .replace(/\/+$/, "");
}

function methodNear(lines, lineIndex) {
  for (let j = lineIndex; j < Math.min(lines.length, lineIndex + METHOD_WINDOW_LINES); j += 1) {
    // Do not look past the end of the current function into the next one.
    if (j > lineIndex && /^(\}|(export\s+)?(async\s+)?function\b|const\s+\w+\s*=\s*(async\s*)?\()/.test(lines[j])) break;
    const match = lines[j].match(/method:\s*['"`](GET|POST|PUT|PATCH|DELETE)['"`]/i);
    if (match) return { method: match[1].toUpperCase(), explicit: true };
  }
  return { method: "GET", explicit: false };
}

function extractRepoRoutes(fullPath) {
  const source = fs.readFileSync(fullPath, "utf8").replace(/\r\n/g, "\n");
  const lines = source.split("\n");
  const { code, comments } = splitSource(source);
  const declared = [];

  // Declarations: "METHOD[|METHOD] /path" at the start of a comment line, followed by end of
  // line, 2+ spaces (column-aligned lists), " (" or an arrow/dash. Prose like
  // "GET /admin/x no existe" (single space + word) is not a declaration.
  const declarationRe =
    /^\s*\*?\s*((?:GET|POST|PUT|PATCH|DELETE)(?:\|(?:GET|POST|PUT|PATCH|DELETE))*)\s+(\/(?:admin|auth)\/[^\s,;)]*)(?:\s*$|\s{2,}|\s+\(|\s+[—–→-])/;
  for (const comment of comments) {
    const match = comment.text.match(declarationRe);
    if (!match) continue;
    for (const method of match[1].split("|")) {
      declared.push({ method, path: match[2], line: comment.line, declared: true });
    }
  }

  // A literal without an explicit `method:` nearby defaults to GET (fetch default). When the same
  // path is declared in a comment, that guess is dropped: the call goes through a helper and the
  // declaration carries the real method.
  const declaredPaths = new Set(declared.map((route) => normalizeRoute(route.path)));
  const literals = [];
  for (const literal of extractLiterals(code)) {
    for (const shape of literal.shapes) {
      const route = routeFromShape(shape);
      if (!route) continue;
      const { method, explicit } = methodNear(lines, literal.line - 1);
      if (!explicit && declaredPaths.has(normalizeRoute(route))) continue;
      literals.push({ method, path: route, line: literal.line });
    }
  }

  return [...declared, ...literals];
}

async function loadTools() {
  const tools = [];
  for (const relativePath of toolPaths) {
    const fullPath = path.join(process.cwd(), "tools", relativePath);
    const mod = await import(pathToFileURL(fullPath).href);
    tools.push({ relativePath, fullPath, mod });
  }
  return tools;
}

function collectRepoRoutes(tools) {
  const repoRoutes = [];
  for (const tool of tools) {
    const name = tool.mod.apiTool?.definition?.name || tool.relativePath;
    for (const route of extractRepoRoutes(tool.fullPath)) {
      repoRoutes.push({ ...route, tool: name });
    }
    // Known v2 resources: GET list and GET by id.
    const resources = tool.mod.RESOURCES;
    if (resources && typeof resources === "object") {
      for (const config of Object.values(resources)) {
        if (config.list) repoRoutes.push({ method: "GET", path: config.path, tool: name, declared: true });
        if (config.get) repoRoutes.push({ method: "GET", path: `${config.path}/{id}`, tool: name, declared: true });
      }
    }
  }
  return repoRoutes;
}

async function main() {
  const tools = await loadTools();
  const repoRoutes = collectRepoRoutes(tools);

  // --routes: print the routes the tools call ("METHOD /path<TAB>tool") and exit; no spec needed.
  if (process.argv.includes("--routes")) {
    const lines = [...new Set(repoRoutes.map((route) => `${route.method} ${route.path}\t${route.tool}`))].sort();
    console.log(lines.join("\n"));
    return;
  }

  const { source, text: yaml } = await loadSpecText();
  const specVersion = extractSpecVersion(yaml);
  const operations = extractSpecOperations(yaml);

  const covered = new Set(repoRoutes.map((route) => `${route.method} ${normalizeRoute(route.path)}`));
  const coveredPaths = new Set(repoRoutes.map((route) => normalizeRoute(route.path)));
  const specKeys = new Set(operations.map((operation) => `${operation.method} ${normalizeRoute(operation.path)}`));

  const missingOperations = operations
    .filter((operation) => !covered.has(`${operation.method} ${normalizeRoute(operation.path)}`))
    .map((operation) => `${operation.method} ${operation.path}`)
    .sort((a, b) => a.split(" ")[1].localeCompare(b.split(" ")[1]) || a.localeCompare(b));

  const missingPathsWithoutAnyMethod = [...new Set(
    operations
      .filter((operation) => !coveredPaths.has(normalizeRoute(operation.path)))
      .map((operation) => operation.path)
  )].sort();

  const notInSpec = new Map();
  for (const route of repoRoutes) {
    const key = `${route.method} ${normalizeRoute(route.path)}`;
    if (specKeys.has(key)) continue;
    const label = `${route.method} ${route.path}`;
    if (!notInSpec.has(label)) notInSpec.set(label, new Set());
    notInSpec.get(label).add(route.tool);
  }

  const report = {
    source,
    specVersion,
    specOperationCount: operations.length,
    specPathCount: new Set(operations.map((operation) => operation.path)).size,
    specTags: extractSpecTags(yaml),
    toolCount: tools.length,
    tools: tools.map((tool) => tool.mod.apiTool?.definition?.name).filter(Boolean).sort(),
    coveredOperationCount: operations.length - missingOperations.length,
    missingOperationCount: missingOperations.length,
    missingOperations,
    missingPathsWithoutAnyMethod,
    repoRoutesNotInSpec: [...notInSpec.entries()]
      .map(([route, toolNames]) => ({ route, tools: [...toolNames].sort() }))
      .sort((a, b) => a.route.split(" ")[1].localeCompare(b.route.split(" ")[1]) || a.route.localeCompare(b.route)),
    note:
      "Route extraction is heuristic. Every /admin/* and /auth* route is reachable through manage_medusa_admin_v2 action=request; " +
      "missingOperations lists routes without a dedicated action. repoRoutesNotInSpec includes plugin/custom routes " +
      "(loyalty, extensions) and would reveal calls to routes that do not exist.",
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
