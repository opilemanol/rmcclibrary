const CACHE_NAME = "rmcc-library-shell-v1";
const CORE_FILES = [
  "./index.html",
  "./manifest.json",
  "./icon.svg",
  "./fonts/DejaVuSans.ttf",
  "./fonts/DejaVuSans-Bold.ttf",
  "./data/sunday-school.json",
  "./data/daily-devotionals.json",
  "./data/sunday-sermons.json",
  "./data/family-devotionals.json",
  "./data/prayer-guides.json",
  "./data/bible-study.json",
  "./data/reports-forms.json",
  "./data/baptismal-course.json",
  "./data/discipleship-course.json"
];
const BUILD_ASSETS = [];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll([...CORE_FILES, ...BUILD_ASSETS])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("rmcc-library-") && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(request).then(async (cached) => {
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    } catch {
      if (request.mode === "navigate") return (await caches.match("./index.html")) || Response.error();
      return Response.error();
    }
  }));
});
