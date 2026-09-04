const cacheName='mountainpulse-demo-v8';
const offlineAssets=['/','/index.html','/styles.css','/mountain-data.js','/scoring.js','/route-engine.js','/safety-engine.js','/parking-model.js','/app.js','/manifest.webmanifest','/icon.svg'];
const cacheablePaths=new Set(offlineAssets);

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(offlineAssets)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==cacheName).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  const pathname=new URL(event.request.url).pathname;
  if(!cacheablePaths.has(pathname))return;
  event.respondWith(fetch(event.request).then(async response=>{
    if(response.ok){const cache=await caches.open(cacheName);await cache.put(pathname,response.clone())}
    return response;
  }).catch(()=>caches.match(pathname).then(response=>response||(event.request.mode==='navigate'?caches.match('/index.html'):Response.error()))));
});
