/* DAELIX OPERATOR, CLIENT VIEW. Service worker.
   It caches the app shell only: the page, the fonts, the icons, the manifest.
   It never caches an API call. Every webhook call is a POST, and this worker
   passes every POST and every cross origin request straight to the network,
   so no decision, no record line and no token is ever stored in the cache. */

var CACHE = "daelix-client-view-v1";

var SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./fonts/IBMPlexMono-Regular.woff2",
  "./fonts/IBMPlexMono-Medium.woff2",
  "./fonts/IBMPlexMono-SemiBold.woff2",
  "./fonts/Archivo-400.ttf",
  "./fonts/Archivo-700.ttf",
  "./fonts/Archivo-400-semiexpanded.ttf"
];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return Promise.all(SHELL.map(function(u){
        return c.add(new Request(u, {cache: "reload"})).catch(function(){ return null; });
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        return (k === CACHE) ? null : caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  var req = e.request;

  /* anything that is not a plain GET of our own files goes to the network,
     untouched and unstored. That is every webhook call. */
  if (req.method !== "GET") return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;

  /* a navigation is served from the network when there is one, from the
     shell when there is not, so the app opens with no signal. */
  if (req.mode === "navigate"){
    e.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put("./index.html", copy); });
        return res;
      }).catch(function(){
        return caches.match("./index.html").then(function(m){
          return m || new Response("OFFLINE", {status: 503, headers: {"Content-Type": "text/plain"}});
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function(hit){
      if (hit) return hit;
      return fetch(req).then(function(res){
        if (res && res.status === 200 && res.type === "basic"){
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){
        return new Response("", {status: 504});
      });
    })
  );
});
