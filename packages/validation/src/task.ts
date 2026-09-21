import { z } from 'zod';

export const createTaskSchema = z.object({
  inputText: z
    .string()
    .min(1, 'Task input is required')
    .max(10000, 'Task input must be at most 10,000 characters')
    .trim(),
  routingStrategy: z
    .enum(['balanced', 'lowest_cost', 'highest_quality', 'eco_first', 'token_efficient'])
    .optional(),
  strategy: z
    .enum(['balanced', 'lowest_cost', 'highest_quality', 'eco_first', 'token_efficient'])
    .optional(),
});

export const routeTaskSchema = z.object({
  strategy: z
    .enum(['balanced', 'lowest_cost', 'highest_quality', 'eco_first', 'token_efficient'])
    .optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type RouteTaskInput = z.infer<typeof routeTaskSchema>;
