import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  makeBinarySafeRequest,
  makeRequest,
  MedusaClientError,
  parseContentDispositionFilename,
  summarizeResponseBody,
} from "../../lib/medusa-client.js";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  process.env.MEDUSA_AUTH_TYPE = "api-key";
  process.env.MEDUSA_API_KEY = "sk_test";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  globalThis.fetch = ORIGINAL_FETCH;
});

const bytes = (text) => new TextEncoder().encode(text);

test("parseContentDispositionFilename handles quoted, bare and RFC 5987 names", () => {
  assert.equal(parseContentDispositionFilename('attachment; filename="a b.pdf"'), "a b.pdf");
  assert.equal(parseContentDispositionFilename("inline; filename=labels.zip"), "labels.zip");
  assert.equal(parseContentDispositionFilename("attachment; filename*=UTF-8''constancia%20%C3%B1.pdf"), "constancia ñ.pdf");
  assert.equal(parseContentDispositionFilename(null), null);
});

test("summarizeResponseBody: binary, zip meta headers, text truncation, sniffed JSON, SSE", () => {
  const zip = summarizeResponseBody({
    contentType: "application/zip",
    buffer: new Uint8Array([0x50, 0x4b, 3, 4]),
    headers: new Headers({
      "content-disposition": 'attachment; filename="andreani-labels.zip"',
      "x-andreani-total-matched": "12",
      "x-andreani-truncated": "false",
      "x-internal-token": "nope",
    }),
  });
  assert.deepEqual(zip, {
    content_type: "application/zip",
    size_bytes: 4,
    filename: "andreani-labels.zip",
    headers: { "x-andreani-total-matched": "12", "x-andreani-truncated": "false" },
    binary: true,
  });

  const image = summarizeResponseBody({ contentType: "image/png", buffer: new Uint8Array(10) });
  assert.equal(image.binary, true);
  assert.equal(image.size_bytes, 10);

  const long = summarizeResponseBody({ contentType: "text/html", buffer: bytes("x".repeat(5000)) }, { maxTextChars: 100 });
  assert.equal(long.text.length, 100);
  assert.equal(long.truncated, true);

  assert.deepEqual(summarizeResponseBody({ contentType: "text/plain", buffer: bytes('{"a":1}') }), { a: 1 });
  assert.deepEqual(summarizeResponseBody({ contentType: "", buffer: bytes("[1,2]") }), [1, 2]);

  const undeclaredBinary = summarizeResponseBody({ contentType: "", buffer: new Uint8Array([0, 1, 2, 3, 255]) });
  assert.equal(undeclaredBinary.binary, true);

  const sse = summarizeResponseBody({ contentType: "text/event-stream", buffer: bytes("data: {}\n\n") });
  assert.equal(sse.streaming, true);
  assert.equal("text" in sse, false);

  assert.deepEqual(summarizeResponseBody({ contentType: "application/pdf", buffer: new Uint8Array(0) }), {});
});

test("makeBinarySafeRequest matches makeRequest for JSON and errors", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ brands: [] }), { status: 200, headers: { "content-type": "application/json" } });
  assert.deepEqual(await makeBinarySafeRequest("https://x.test/admin/brands"), await makeRequest("https://x.test/admin/brands"));

  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.deepEqual(await makeBinarySafeRequest("https://x.test/admin/brands/1", { method: "DELETE" }), {});

  globalThis.fetch = async () => new Response("x".repeat(10000), { status: 500, headers: { "content-type": "text/html" } });
  await assert.rejects(
    () => makeBinarySafeRequest("https://x.test/admin/brands"),
    (error) => {
      assert.ok(error instanceof MedusaClientError);
      assert.equal(error.status, 500);
      assert.ok(error.body.length < 4100, "error body is truncated");
      return true;
    },
  );
});

test("makeBinarySafeRequest sends auth + custom headers like makeRequest", async () => {
  let seen;
  globalThis.fetch = async (_url, options) => {
    seen = options.headers;
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  };
  await makeBinarySafeRequest("https://x.test/admin/brands", { headers: { "x-site-id": "site_1" } });
  assert.equal(seen.Authorization, "Basic sk_test");
  assert.equal(seen["x-site-id"], "site_1");
  assert.equal(seen["Content-Type"], "application/json");
});
