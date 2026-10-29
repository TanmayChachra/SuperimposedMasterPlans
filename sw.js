/* Service worker: the maps barely change, so keep everything on the device after the first visit.
 * - City-Tiles/*.tif  : every byte range the viewer asks for is stored (Cache API cannot store 206 replies, so each is kept as a 200
 *                       under a key made from url + range and replayed as a 206). Cached forever.
 * - OSM / Esri tiles  : cache first, newest 800 kept.
 * - CDN libraries     : cache first (versioned URLs).
 * - this site's files : stale-while-revalidate (instant, refreshed in the background for next time).
 * RULES: if you REPLACE a .tif under the same name, bump DATA_V (or rename the file) or visitors get mixed old/new blocks.
 *        Bump APP_V to force everyone onto new app files. ?nosw=1 on the page URL removes the worker and its caches. */
const APP_V = 'a1', DATA_V = 'd1', TILE_V = 't1';
const APP = 'mpm-app-' + APP_V, DATA = 'mpm-data-' + DATA_V, TILES = 'mpm-tiles-' + TILE_V;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  const keep = [APP, DATA, TILES];
  for (const k of await caches.keys()) if (k.startsWith('mpm-') && !keep.includes(k)) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin && u.pathname.includes('/City-Tiles/')) return e.respondWith(cogRange(r));
  if (u.hostname === 'tile.openstreetmap.org' || u.hostname === 'server.arcgisonline.com') return e.respondWith(cacheFirst(r, TILES, 800));
  if (u.hostname === 'cdn.jsdelivr.net') return e.respondWith(cacheFirst(r, APP, 0));
  if (u.origin === location.origin) return e.respondWith(staleWhileRevalidate(r));
});

async function cogRange(r) {
  const range = r.headers.get('range');
  const cache = await caches.open(DATA);
  const key = new Request(r.url + (r.url.includes('?') ? '&' : '?') + '__r=' + (range || 'all'));
  const hit = await cache.match(key);
  if (hit) {
    const body = await hit.arrayBuffer();
    if (!range) return new Response(body, { status: 200, headers: { 'Content-Type': hit.headers.get('Content-Type') || 'image/tiff' } });
    return new Response(body, { status: 206, headers: { 'Content-Type': hit.headers.get('Content-Type') || 'image/tiff', 'Content-Range': hit.headers.get('X-Content-Range') || '', 'Content-Length': String(body.byteLength), 'Accept-Ranges': 'bytes' } });
  }
  const res = await fetch(r);
  if (res.status === 200 || res.status === 206) {
    const copy = res.clone();
    copy.arrayBuffer().then(b => cache.put(key, new Response(b, { status: 200, headers: { 'Content-Type': res.headers.get('Content-Type') || 'image/tiff', 'X-Content-Range': res.headers.get('Content-Range') || '' } }))).catch(() => {});
  }
  return res;
}

async function cacheFirst(r, name, max) {
  const cache = await caches.open(name);
  const hit = await cache.match(r);
  if (hit) return hit;
  const res = await fetch(r);
  if (res.ok || res.type === 'opaque') {
    cache.put(r, res.clone()).then(async () => {
      if (!max) return;
      const ks = await cache.keys();
      for (let i = 0; i < ks.length - max; i++) await cache.delete(ks[i]);   // oldest first
    }).catch(() => {});
  }
  return res;
}

async function staleWhileRevalidate(r) {
  const cache = await caches.open(APP);
  const hit = await cache.match(r);
  const net = fetch(r).then(res => { if (res.ok) cache.put(r, res.clone()); return res; });
  if (hit) { net.catch(() => {}); return hit; }
  return net;
}
