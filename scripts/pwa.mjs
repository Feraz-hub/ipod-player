import { createHash } from "node:crypto";

// Cache the published app shell only. Private music, auth responses and remote
// clips must never enter a shared service-worker cache.
export function makeWorker(base, assets) {
  const paths = [...new Set(assets.map((name) => `${base}${name}`))].sort();
  const version = createHash("sha256")
    .update(JSON.stringify(paths))
    .digest("hex")
    .slice(0, 16);
  return `const PREFIX = ${JSON.stringify(`nightshift-shell:${base}:`)};
const CACHE = PREFIX + ${JSON.stringify(version)};
const BASE = ${JSON.stringify(base)};
const FILES = ${JSON.stringify(paths)};
const ALLOWED = new Set(FILES);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('authorization')) return;
  if (request.mode === 'navigate' && (url.pathname === BASE || url.pathname === BASE + 'index.html')) {
    // Never write a magic-link/OAuth callback URL or response into a cache.
    event.respondWith(fetch(request, {cache: 'no-store'}).catch(() => caches.open(CACHE).then(cache => cache.match(BASE + 'index.html'))));
    return;
  }
  if (url.search || !ALLOWED.has(url.pathname)) return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(url.pathname)) || fetch(request)));
});
`;
}

export default function appShell() {
  let base = "/";
  return {
    name: "nightshift-app-shell",
    apply: "build",
    configResolved(config) {
      base = config.base;
    },
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle).filter(
        (name) => !name.endsWith(".map"),
      );
      assets.push(
        "index.html",
        "manifest.webmanifest",
        "favicon.svg",
        "night-alley.jpg",
        "city-night.jpg",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/apple-touch-icon.png",
      );
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: makeWorker(base, assets),
      });
    },
  };
}
