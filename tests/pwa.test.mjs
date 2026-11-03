import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { makeWorker } from "../scripts/pwa.mjs";

function worker() {
  const handlers = {},
    requests = [];
  const self = {
    location: { origin: "https://feraz-hub.github.io" },
    addEventListener: (name, fn) => {
      handlers[name] = fn;
    },
  };
  const cached = new Response("offline shell");
  vm.runInNewContext(
    makeWorker("/ipod-player/", ["index.html", "assets/player.js"]),
    {
      self,
      URL,
      Set,
      fetch: async (request) => {
        requests.push(request);
        throw new Error("offline");
      },
      caches: {
        open: async () => ({
          match: async (path) =>
            path === "/ipod-player/index.html" ? cached : undefined,
        }),
      },
    },
  );
  const request = (path, options = {}) => {
    let response;
    handlers.fetch({
      request: {
        url: new URL(path, self.location.origin).href,
        method: "GET",
        headers: new Headers(),
        ...options,
      },
      respondWith: (value) => {
        response = value;
      },
    });
    return response;
  };
  return { request, requests };
}

test("offline shell resolves under the GitHub project path, including an uncached auth callback", async () => {
  const { request } = worker();
  const response = await request("/ipod-player/?code=private-auth-code", {
    mode: "navigate",
  });
  assert.equal(await response.text(), "offline shell");
});

test("service worker ignores cloud/private media, authorization, queries and writes", () => {
  const { request, requests } = worker();
  for (const path of [
    "https://project.supabase.co/functions/v1/media-gateway/stream/private",
    "/ipod-player/song.mp3",
    "/other-app/",
    "/ipod-player/assets/player.js?token=secret",
  ]) {
    assert.equal(request(path), undefined);
  }
  assert.equal(
    request("/ipod-player/assets/player.js", {
      headers: new Headers({ Authorization: "Bearer private" }),
    }),
    undefined,
  );
  assert.equal(
    request("/ipod-player/assets/player.js", { method: "POST" }),
    undefined,
  );
  assert.equal(requests.length, 0);
});

test("Home Screen launch and icons stay inside any GitHub Pages project path", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  for (const href of [
    "./favicon.svg?v=2",
    "./icons/nightshift-apple.png",
    "./manifest.webmanifest",
  ]) {
    assert.ok(html.includes(`href="${href}"`));
    assert.ok(new URL(href, "https://feraz-hub.github.io/ipod-player/").pathname.startsWith("/ipod-player/"));
  }
  const manifest = JSON.parse(
    await readFile(new URL("../public/manifest.webmanifest", import.meta.url)),
  );
  const location =
    "https://feraz-hub.github.io/ipod-player/manifest.webmanifest";
  assert.equal(
    new URL(manifest.start_url, location).href,
    "https://feraz-hub.github.io/ipod-player/",
  );
  assert.equal(manifest.display, "standalone");
  for (const icon of [
    ...manifest.icons,
    { src: "icons/nightshift-apple.png" },
  ]) {
    const data = await readFile(
      new URL("../public/" + icon.src, import.meta.url),
    );
    assert.equal(data.subarray(1, 4).toString(), "PNG");
  }
});
