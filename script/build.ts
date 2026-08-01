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

  // En Vercel el servidor no se ejecuta como proceso Node de larga duración:
  // se despliega como función serverless (api/[...path].ts), que Vercel
  // bundlea con su propio builder. Empaquetar aquí server/index.ts con
  // esbuild sería trabajo perdido (y ni siquiera es el entrypoint que usa
  // Vercel), así que lo omitimos cuando detectamos su entorno de build.
  if (process.env.VERCEL) {
    console.log("VERCEL detectado: omitiendo bundle esbuild del servidor (usa api/[...path].ts).");
    return;
  }

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

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
