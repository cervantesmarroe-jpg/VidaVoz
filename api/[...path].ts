import type { IncomingMessage, ServerResponse } from "http";
import { createApp } from "../server/app";

// Vercel enruta aquí toda petición a /api/* (ruta "catch-all" por convención
// de nombre de archivo, ver vercel.json). Una app Express es en sí misma una
// función (req, res) => void, así que basta con delegarle la petición: no
// hace falta serverless-http ni adaptar nada más. La app se construye una
// sola vez por instancia Lambda y se reutiliza en las siguientes invocaciones
// mientras el contenedor siga "caliente" (ver server/app.ts).
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await createApp();
  app(req as any, res as any);
}
