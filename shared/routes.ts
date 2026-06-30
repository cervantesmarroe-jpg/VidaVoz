import { z } from 'zod';
import { insertMessageSchema, insertIrisFeedbackSchema, messages } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  irisFeedback: {
    push: {
      method: 'POST' as const,
      path: '/api/iris-feedback' as const,
      input: z.array(insertIrisFeedbackSchema).max(100),
      responses: { 201: z.object({ inserted: z.number() }) },
    },
  },
  irisWeight: {
    get: {
      method: 'GET' as const,
      path: '/api/iris-weight' as const,
      responses: {
        200: z.object({ weight: z.number(), samples: z.number() }),
      },
    },
  },
  messages: {
    list: {
      method: 'GET' as const,
      path: '/api/messages' as const,
      responses: {
        200: z.array(z.custom<typeof messages.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/messages' as const,
      input: insertMessageSchema,
      responses: {
        201: z.custom<typeof messages.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/messages/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
