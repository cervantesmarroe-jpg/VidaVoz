import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // process.cwd() es más fiable que __dirname en un bundle CJS desplegado en Railway:
  // __dirname en el bundle apunta a dist/ pero process.cwd() siempre es la raíz del proyecto.
  const distPath = path.join(process.cwd(), "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `No se encontró el directorio de build: ${distPath}. Ejecuta npm run build primero.`,
    );
  }

  console.log("[static] Sirviendo desde:", distPath);
  console.log("[static] Archivos:", fs.readdirSync(distPath).join(", "));

  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      // Los archivos bajo /assets/ los genera Vite con hash en el nombre
      // (p. ej. index-a1b2c3.js) — su contenido nunca cambia sin que cambie
      // también la URL, así que pueden cachearse en el navegador de forma
      // indefinida. El resto (index.html, sw.js, manifest.json, iconos...)
      // no lleva hash y debe seguir revalidándose como hasta ahora, para no
      // interferir con el versionado del Service Worker.
      const assetsDir = path.join(distPath, "assets") + path.sep;
      if (filePath.startsWith(assetsDir)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }));

  // Fallback SPA: solo para rutas sin extensión (páginas de la app, no assets).
  // Evita servir index.html con MIME text/html cuando el navegador pide un .js/.css
  // y express.static no encuentra el archivo — eso causa "Expected JS, got text/html".
  app.use("/{*path}", (req, res, next) => {
    if (path.extname(req.path) !== "") return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
}
