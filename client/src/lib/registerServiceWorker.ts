// ─── Service Worker — VidaVoz ──────────────────────────────────────────────
//
// En producción registra sw.js para caching offline de las 4 rutas
// principales (ver client/public/sw.js). En desarrollo NO se registra —
// además, si un registro/caché de una sesión de dev anterior sigue activo
// en el navegador, se elimina: sw.js usa cache-first y en dev nunca cambia
// de nombre de caché (el placeholder __CACHE_VERSION__ solo se sustituye en
// `npm run build`), así que sin esta limpieza el navegador podría seguir
// sirviendo un bundle antiguo cacheado indefinidamente, ignorando cualquier
// cambio de código posterior (p. ej. código ya eliminado del modo GUIADO).
if (!("serviceWorker" in navigator)) {
  // no-op
} else if (import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
} else {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
  if ("caches" in window) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }
}
