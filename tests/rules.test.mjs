import test from "node:test";
import assert from "node:assert/strict";
import { angleDelta, validateFile, MAX_FILE } from "../src/lib/rules.mjs";
test("wheel handles crossing the 180-degree boundary in both directions", () => {
  assert.equal(angleDelta(175, -175), 10);
  assert.equal(angleDelta(-175, 175), -10);
  assert.equal(angleDelta(12, 22), 10);
});
test("rejects empty, oversized and disguised unsupported uploads", () => {
  assert.throws(
    () => validateFile({ size: 0, type: "audio/mpeg" }, "music"),
    /empty/,
  );
  assert.throws(
    () => validateFile({ size: MAX_FILE + 1, type: "video/mp4" }, "clip"),
    /100 MB/,
  );
  assert.throws(
    () => validateFile({ size: 500, type: "text/html" }, "clip"),
    /Unsupported/,
  );
  assert.throws(
    () => validateFile({ size: 500, type: "video/mp4" }, "music"),
    /Unsupported/,
  );
  assert.doesNotThrow(() =>
    validateFile({ size: MAX_FILE, type: "audio/flac" }, "music"),
  );
});
