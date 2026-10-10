// 電波がなくてもアプリが開けるようにする係。
// まずネットから最新を取りに行き、だめなら保存しておいたものを出す。
const CACHE = 'karada-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== location.origin && url.hostname !== 'www.gstatic.com') return;
  e.respondWith(
    // no-cache：毎回サーバーに「新しくなった？」と確認する（古い画面が残らないように）
    fetch(e.request, url.origin === location.origin ? { cache: 'no-cache' } : {})
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
