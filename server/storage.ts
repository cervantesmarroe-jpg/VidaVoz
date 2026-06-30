import { db } from "./db";
import { sql } from "drizzle-orm";
import {
  messages, irisWeightFeedback,
  type InsertMessage, type Message,
  type IrisFeedbackInsert,
} from "@shared/schema";
import { eq } from "drizzle-orm";

const DEFAULT_IRIS_WEIGHT = 0.35;
const MIN_SAMPLES_FOR_WEIGHT = 50;

export interface IStorage {
  getMessages(): Promise<Message[]>;
  getMessage(id: number): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  deleteMessage(id: number): Promise<void>;
  insertIrisFeedbackBatch(records: IrisFeedbackInsert[]): Promise<number>;
  computeOptimalIrisWeight(): Promise<{ weight: number; samples: number }>;
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

  async insertIrisFeedbackBatch(records: IrisFeedbackInsert[]): Promise<number> {
    if (records.length === 0) return 0;
    const inserted = await db.insert(irisWeightFeedback).values(records).returning({ id: irisWeightFeedback.id });
    return inserted.length;
  }

  // Calcula el peso iris óptimo por mínimos cuadrados sobre todos los registros.
  // Fórmula cerrada (derivación analítica de dE/dW = 0):
  //   W_opt = Σ(target_i - bs_i)·(iris_i - bs_i) / Σ(iris_i - bs_i)²
  // Se aplica por separado a X e Y y se promedia.
  // Si hay menos de MIN_SAMPLES_FOR_WEIGHT registros devuelve el peso por defecto.
  async computeOptimalIrisWeight(): Promise<{ weight: number; samples: number }> {
    const t = irisWeightFeedback;
    const [agg] = await db.select({
      numX:    sql<number>`sum((${t.eyeTargetX} - ${t.bsEyeX}) * (${t.irisEyeX} - ${t.bsEyeX}))`,
      denX:    sql<number>`sum((${t.irisEyeX}   - ${t.bsEyeX}) * (${t.irisEyeX} - ${t.bsEyeX}))`,
      numY:    sql<number>`sum((${t.eyeTargetY} - ${t.bsEyeY}) * (${t.irisEyeY} - ${t.bsEyeY}))`,
      denY:    sql<number>`sum((${t.irisEyeY}   - ${t.bsEyeY}) * (${t.irisEyeY} - ${t.bsEyeY}))`,
      samples: sql<number>`count(*)`,
    }).from(t);

    const n = Number(agg?.samples ?? 0);
    if (n < MIN_SAMPLES_FOR_WEIGHT) {
      return { weight: DEFAULT_IRIS_WEIGHT, samples: n };
    }

    const numX = Number(agg.numX ?? 0);
    const denX = Number(agg.denX ?? 0);
    const numY = Number(agg.numY ?? 0);
    const denY = Number(agg.denY ?? 0);

    const wX = Math.abs(denX) > 1e-6 ? numX / denX : DEFAULT_IRIS_WEIGHT;
    const wY = Math.abs(denY) > 1e-6 ? numY / denY : DEFAULT_IRIS_WEIGHT;
    const weight = Math.max(0, Math.min(1, (wX + wY) / 2));

    return { weight, samples: n };
  }
}

export const storage = new DatabaseStorage();
