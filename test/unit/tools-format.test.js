import assert from "node:assert/strict";
import { test } from "node:test";
import { transformToolsToMcp } from "../../lib/tools.js";

test("transformToolsToMcp preserves titles, icons, and read-only annotations", () => {
  const [tool] = transformToolsToMcp([
    {
      definition: {
        name: "manage_read_only_resource",
        title: "Read Only Resource",
        description: "Read-only test tool.",
        icons: [{ src: "https://example.com/icon.png", mimeType: "image/png" }],
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["list", "get"],
            },
          },
          required: ["action"],
        },
      },
    },
  ]);

  assert.equal(tool.title, "Read Only Resource");
  assert.deepEqual(tool.annotations, { readOnlyHint: true });
  assert.deepEqual(tool.icons, [{ src: "https://example.com/icon.png", mimeType: "image/png" }]);
});
