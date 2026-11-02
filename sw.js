const CACHE='mhh-v71';
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./','index.html','exlib.js','msicons.js','condlib.js','foodlib.js','dishlib.js','dishes.js','storelib.js','labelscan.js','mealscan.js','extras.js','app.js','sync.js','ai.js','style.css','manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable-192.png','icon-maskable-512.png','apple-touch-icon.png','favicon-32.png','favicon.ico','icon.svg','privacy.html','terms.html'].map(u=>new Request(u,{cache:'reload'}))).catch(()=>{})))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
 e.respondWith(fetch(e.request,{cache:'no-cache'}).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./'))))});
self.addEventListener('message',e=>{if(e.data==='skip')self.skipWaiting()});
