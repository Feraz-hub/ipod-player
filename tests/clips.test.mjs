import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const clips = JSON.parse(
  readFileSync(new URL("../src/licensed-clips.json", import.meta.url), "utf8"),
);
const manifest = JSON.parse(
  readFileSync(
    new URL("../public/clip-manifest.json", import.meta.url),
    "utf8",
  ),
);

test("every bundled video has matching source, creator and license records", () => {
  assert.equal(new Set(clips.map((clip) => clip.id)).size, clips.length);
  assert.equal(
    new Set(manifest.enabled.map((clip) => clip.id)).size,
    manifest.enabled.length,
  );
  for (const clip of clips) {
    const record = manifest.enabled.find((entry) => entry.id === clip.id);
    assert.ok(record, clip.id);
    assert.equal(record.source, clip.source, clip.id);
    assert.equal(record.preview, clip.externalUrl, clip.id);
    assert.equal(record.creator, clip.artist, clip.id);
    assert.ok(record.licenseUrl.startsWith("https://"));
    assert.ok(!/Restricted/i.test(record.license));
    assert.ok(!manifest.excluded.some((entry) => entry.source === clip.source));
  }
});

test("Pexels playback uses published SD selections, and Tokyo rain uses 240p", () => {
  const pexels = clips.filter((clip) => clip.id.startsWith("pexels-"));
  assert.ok(pexels.length >= 8);
  for (const clip of pexels) {
    const url = new URL(clip.externalUrl);
    assert.equal(url.hostname, "www.pexels.com");
    assert.equal(url.pathname, `/download/video/${clip.id.slice(7)}/`);
    assert.ok(Number(url.searchParams.get("h")) <= 360);
    assert.ok(Number(url.searchParams.get("w")) <= 640);
  }
  assert.match(
    clips.find((clip) => clip.id === "commons-tokyo-rain").externalUrl,
    /240p\.vp9\.webm$/,
  );
});
