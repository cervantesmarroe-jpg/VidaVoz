import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertIrisFeedbackSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Seed initial data if empty
  app.get('/api/seed', async (req, res) => {
    try {
      const existing = await storage.getMessages();
      if (existing.length === 0) {
        // Just adding a couple of custom messages for demonstration,
        // the rest of the hardcoded messages should be in the frontend.
        await storage.createMessage({
          text: "Por favor, llama a mi esposa",
          category: "messages",
          icon: "phone",
          isCustom: true
        });
        await storage.createMessage({
          text: "Necesito mis gafas",
          category: "urgent",
          icon: "glasses",
          isCustom: true
        });
      }
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get(api.messages.list.path, async (req, res) => {
    const msgs = await storage.getMessages();
    res.json(msgs);
  });

  app.post(api.messages.create.path, async (req, res) => {
    try {
      const input = api.messages.create.input.parse(req.body);
      const msg = await storage.createMessage(input);
      res.status(201).json(msg);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.messages.delete.path, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getMessage(id);
    if (!existing) {
      return res.status(404).json({ message: "Message not found" });
    }
    await storage.deleteMessage(id);
    res.status(204).end();
  });

  // ── Iris weight feedback ─────────────────────────────────────────────────────
  app.post(api.irisFeedback.push.path, async (req, res) => {
    try {
      const batch = z.array(insertIrisFeedbackSchema).max(100).parse(req.body);
      const inserted = await storage.insertIrisFeedbackBatch(batch);
      res.status(201).json({ inserted });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get(api.irisWeight.get.path, async (_req, res) => {
    const result = await storage.computeOptimalIrisWeight();
    res.json(result);
  });

  return httpServer;
}
