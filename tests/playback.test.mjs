import test from "node:test";
import assert from "node:assert/strict";
import { pauseMusic, applyMusicVolume, resumeMusicOutput } from "../src/lib/playback.mjs";

test("pause silences output before asking the media element to pause", () => {
  const gain = { gain: { value: 0.8 } };
  const audio = { paused: false, muted: false, pause() {
    assert.equal(gain.gain.value, 0);
    assert.equal(this.muted, true);
    this.paused = true;
  } };
  pauseMusic(audio, gain);
  applyMusicVolume(audio, gain, 1);
  assert.equal(gain.gain.value, 0, "turning the wheel while paused must not restore a stuck buffer");
  audio.paused = false;
  applyMusicVolume(audio, gain, 0.4);
  assert.equal(gain.gain.value, 0.4);
});

test("an interrupted phone output is resumed, and a stuck resume is bounded", async () => {
  const context = { state: "interrupted", async resume() { this.state = "running"; } };
  assert.equal(await resumeMusicOutput(context), true);
  assert.equal(await resumeMusicOutput({ state: "suspended", resume: () => new Promise(() => {}) }, 10), false);
});
