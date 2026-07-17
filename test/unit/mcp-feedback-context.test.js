import assert from "node:assert/strict";
import { test } from "node:test";
import { discoverTools, transformToolsToMcp, executeToolOptimized } from "../../lib/tools.js";
import { sendTelemetry } from "../../lib/telemetry.js";
import { globalMetrics } from "../../lib/monitoring.js";

test("transformToolsToMcp injects an optional `context` property into every tool", () => {
  const tools = transformToolsToMcp([
    {
      definition: {
        name: "sample_tool",
        description: "Sample.",
        parameters: {
          type: "object",
          properties: { action: { type: "string", enum: ["list"] } },
          required: ["action"],
        },
      },
    },
  ]);

  const [tool] = tools;
  assert.ok(tool.inputSchema.properties.context, "context property should be present");
  assert.equal(tool.inputSchema.properties.context.type, "string");
  assert.ok(!tool.inputSchema.required.includes("context"), "context must NOT be required");
});

test("transformToolsToMcp does not mutate the original tool definition", () => {
  const definition = {
    name: "sample_tool",
    description: "Sample.",
    parameters: { type: "object", properties: { action: { type: "string" } } },
  };
  transformToolsToMcp([{ definition }]);
  assert.ok(!definition.parameters.properties.context, "original schema must stay untouched");
});

test("executeToolOptimized strips `context` before calling the tool function", async () => {
  let received = null;
  const tools = [
    {
      definition: {
        name: "capture_args",
        description: "Captures args.",
        parameters: { type: "object", properties: { action: { type: "string" } } },
      },
      function: async (args) => {
        received = args;
        return { ok: true };
      },
    },
  ];

  await executeToolOptimized(tools, "capture_args", { action: "list", context: "why I called" });
  assert.deepEqual(received, { action: "list" }, "context must not leak into the tool args");
});

test("sendTelemetry is a no-op over the network without FEEDBACK_WEBHOOK_URL and records in monitoring", () => {
  const prev = process.env.FEEDBACK_WEBHOOK_URL;
  delete process.env.FEEDBACK_WEBHOOK_URL;
  const before = globalMetrics.getMetrics().telemetry.total;

  assert.doesNotThrow(() => sendTelemetry({ type: "feedback", tool: "x", data: { message: "hi" } }));

  const after = globalMetrics.getMetrics().telemetry.total;
  assert.equal(after, before + 1, "event should be recorded in in-memory monitoring");

  if (prev !== undefined) process.env.FEEDBACK_WEBHOOK_URL = prev;
});

test("the report_mcp_feedback tool is discovered and exposed", async () => {
  const tools = await discoverTools(true);
  const mcp = transformToolsToMcp(tools);
  const feedback = mcp.find((t) => t.name === "report_mcp_feedback");
  assert.ok(feedback, "report_mcp_feedback should be listed");
  assert.ok(feedback.inputSchema.required.includes("message"), "message should be required");
});
