import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, writeFile } from "fs/promises";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  // Inyectar timestamp de build en el service worker.
  // Vite copia client/public/sw.js tal cual a dist/public/sw.js — aquí
  // reemplazamos el placeholder para que cada despliegue genere un nombre
  // de caché único y los navegadores descarten la caché anterior sin
  // necesidad de intervención manual.
  const swPath = "dist/public/sw.js";
  const cacheVersion = `vidavoz-${Date.now()}`;
  const swSrc = await readFile(swPath, "utf-8");
  await writeFile(swPath, swSrc.replace("__CACHE_VERSION__", cacheVersion), "utf-8");
  console.log(`service worker cache → ${cacheVersion}`);

  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  // En Vercel el servidor se despliega como función serverless a partir de
  // api/[...path].ts. Dejar que @vercel/node transpile/bundlee ese archivo
  // directamente es frágil porque el package.json raíz usa "type":"module":
  // según cómo interprete eso, termina en "Cannot find module" (imports
  // locales — server/app, server/routes, @shared/* — no bundleados, y la
  // resolución ESM nativa de Node exige extensión explícita que este repo
  // no usa) o en "Failed to load the ES module" (el tracer de Vercel no
  // garantiza incluir api/package.json en el bundle final porque nada lo
  // "requiere" explícitamente, así que en runtime el único package.json
  // visible es el de la raíz con "type":"module", y Vercel intenta cargar
  // el .js con import() aunque su contenido sea CJS).
  //
  // Bundleamos aquí mismo con esbuild — mismo mecanismo que la rama de abajo
  // usa para Railway/local — a un único archivo CJS autocontenido con
  // extensión .cjs: a diferencia de .js, Node (y el runtime de Vercel) trata
  // SIEMPRE un .cjs como CommonJS por la extensión en sí, sin mirar ningún
  // package.json.
  //
  // IMPORTANTE: NO borramos ni dejamos vacío api/[...path].ts. Vercel
  // detecta sus Serverless Functions recorriendo el árbol de api/ ANTES de
  // ejecutar este Build Command, y vuelve a abrir esa misma ruta en una fase
  // posterior — si para entonces el archivo no existe, el despliegue falla
  // con ENOENT (ya nos pasó). En su lugar, sustituimos su CONTENIDO por un
  // shim mínimo que reexporta el bundle real ya compilado (.cjs, importado
  // con su extensión completa → Node lo trata como CJS sin ambigüedad). El
  // shim en sí es solo "export { default } from ..." — sintaxis estándar
  // sin requires/imports locales que resolver, así que no puede recaer en
  // ninguno de los errores anteriores sea cual sea el formato que Vercel le
  // aplique. api/_app.cjs no se expone como ruta propia: Vercel ignora
  // cualquier archivo bajo api/ que empiece por "_".
  if (process.env.VERCEL) {
    console.log("building vercel api function...");
    await esbuild({
      entryPoints: ["api/[...path].ts"],
      platform: "node",
      bundle: true,
      format: "cjs",
      outfile: "api/_app.cjs",
      define: {
        "process.env.NODE_ENV": '"production"',
      },
      minify: true,
      external: externals,
      logLevel: "info",
      // El entry usa "export default handler", así que esbuild emite
      // exports.default = handler (con marca __esModule). Si el shim de
      // abajo se reexporta vía interop (ESM nativo o el helper __toESM de
      // esbuild en modo CJS), ese require()/import() añade SU PROPIA capa
      // de ".default" — y como ambas capas se llaman igual, el resultado
      // queda doblemente envuelto ({default: {default: handler}}) según
      // qué formato elija el builder de Vercel para el shim. Aplanamos
      // aquí mismo para que module.exports SEA la función: así solo queda
      // una capa de ".default" (la que añade el shim), sea CJS o ESM.
      footer: { js: "module.exports = module.exports.default;" },
    });
    await writeFile("api/[...path].ts", `export { default } from "./_app.cjs";\n`);
    return;
  }

  console.log("building server...");
  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
