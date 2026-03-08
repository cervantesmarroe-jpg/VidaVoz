import { pgTable, text, serial, boolean } from "drizzle-orm/pg-core";
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
