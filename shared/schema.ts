import { pgTable, text, serial, boolean, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  category: text("category").notNull(), // 'urgent', 'messages', etc.
  icon: text("icon"), 
  isCustom: boolean("is_custom").default(true).notNull(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({ id: true });

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type CreateMessageRequest = InsertMessage;
export type UpdateMessageRequest = Partial<InsertMessage>;

// ── Tabla de feedback para optimización del peso iris ────────────────────────
// Cada activación gaze exitosa registra las señales brutas y la posición del
// target en espacio de señal ocular. Con estos datos el servidor calcula el
// IRIS_WEIGHT óptimo por mínimos cuadrados sin necesitar los coeficientes de
// regresión en tiempo de consulta (ya están normalizados en eye_target_*).
export const irisWeightFeedback = pgTable('iris_weight_feedback', {
  id:          serial('id').primaryKey(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  deviceType:  text('device_type').notNull(),      // 'tablet' | 'mobile'
  bsEyeX:      real('bs_eye_x').notNull(),         // señal blendshape horizontal
  irisEyeX:    real('iris_eye_x').notNull(),        // señal iris horizontal
  eyeTargetX:  real('eye_target_x').notNull(),      // target en espacio eyeX: (px_x - αX) / βX
  bsEyeY:      real('bs_eye_y').notNull(),
  irisEyeY:    real('iris_eye_y').notNull(),
  eyeTargetY:  real('eye_target_y').notNull(),
});

export const insertIrisFeedbackSchema = createInsertSchema(irisWeightFeedback).omit({ id: true, createdAt: true });
export type IrisFeedbackInsert = z.infer<typeof insertIrisFeedbackSchema>;
export type IrisFeedbackRecord = typeof irisWeightFeedback.$inferSelect;
