import { db } from "./db";
import { messages, type InsertMessage, type Message } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getMessages(): Promise<Message[]>;
  getMessage(id: number): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  deleteMessage(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getMessages(): Promise<Message[]> {
    return await db.select().from(messages);
  }

  async getMessage(id: number): Promise<Message | undefined> {
    const [msg] = await db.select().from(messages).where(eq(messages.id, id));
    return msg;
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [msg] = await db.insert(messages).values(insertMessage).returning();
    return msg;
  }
  
  async deleteMessage(id: number): Promise<void> {
    await db.delete(messages).where(eq(messages.id, id));
  }
}

export const storage = new DatabaseStorage();
