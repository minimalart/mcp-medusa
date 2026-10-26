import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const SPEC = `openapi: 3.0.0
info:
  title: Medusa Admin API
  version: 2.21.2
paths:
  /admin/orders:
    get:
      operationId: GetOrders
  /admin/claims/{id}/request:
    post:
      operationId: PostClaimsIdRequest
  /admin/users/{id}/reset-password:
    post:
      operationId: PostUsersIdResetPassword
  /admin/plugins:
    get:
      operationId: GetPlugins
  /admin/workflows-executions/{workflow_id}/subscribe:
    get:
      operationId: GetWorkflowsExecutionsSubscribe
  /admin/workflows-executions/{workflow_id}/run:
    post:
      operationId: PostWorkflowsExecutionsRun
  /admin/not-implemented-anywhere:
    post:
      operationId: PostNotImplemented
  /auth/session:
    post:
      operationId: PostSession
  /auth/mfa/factors:
    get:
      operationId: GetMfaFactors
components:
  schemas: {}
`;

test("coverage script reports intentional exclusions with a reason instead of missing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-medusa-coverage-"));
  const file = path.join(dir, "admin.yaml");
  fs.writeFileSync(file, SPEC);
  try {
    const output = execFileSync(process.execPath, ["scripts/medusa-openapi-coverage.js", "--file", file], {
      cwd: ROOT,
      encoding: "utf8",
    });
    const report = JSON.parse(output);

    assert.deepEqual(report.missingOperations, ["POST /admin/not-implemented-anywhere"]);
    assert.deepEqual(
      report.excludedOperations.map((entry) => entry.operation).sort(),
      [
        "GET /admin/plugins",
        "GET /admin/workflows-executions/{workflow_id}/subscribe",
        "POST /admin/users/{id}/reset-password",
        "POST /admin/workflows-executions/{workflow_id}/run",
        "POST /auth/session",
      ].sort()
    );
    assert.ok(report.excludedOperations.every((entry) => typeof entry.reason === "string" && entry.reason.length > 10));
    assert.equal(report.excludedOperationCount, 5);
    // GET /auth/mfa/factors is excluded by the /auth rule but a tool calls it: it stays covered.
    assert.deepEqual(report.coveredButExcluded, ["GET /auth/mfa/factors"]);
    assert.equal(report.coveredOperationCount, 3);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
