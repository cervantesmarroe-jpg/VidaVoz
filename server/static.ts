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

  app.use(express.static(distPath));

  // Fallback SPA: solo para rutas sin extensión (páginas de la app, no assets).
  // Evita servir index.html con MIME text/html cuando el navegador pide un .js/.css
  // y express.static no encuentra el archivo — eso causa "Expected JS, got text/html".
  app.use("/{*path}", (req, res, next) => {
    if (path.extname(req.path) !== "") return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
}
