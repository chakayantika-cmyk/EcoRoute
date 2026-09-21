import { z } from 'zod';

const weightSchema = z.number().min(0).max(1);

export const updatePreferencesSchema = z
  .object({
    tokenEfficiencyWeight: weightSchema.optional(),
    costWeight: weightSchema.optional(),
    qualityWeight: weightSchema.optional(),
    environmentalWeight: weightSchema.optional(),
    latencyWeight: weightSchema.optional(),
    baselineModelId: z.string().optional().nullable(),
    defaultStrategy: z
      .enum([
        'balanced',
        'lowest_cost',
        'highest_quality',
        'eco_first',
        'token_efficient',
        'lowest_latency',
        'quality_first',
      ])
      .optional(),
  })
  .refine(
    (data) => {
      const weights = [
        data.tokenEfficiencyWeight,
        data.costWeight,
        data.qualityWeight,
        data.environmentalWeight,
        data.latencyWeight,
      ].filter((w) => w !== undefined);
      if (weights.length === 5) {
        const sum = weights.reduce((a, b) => a + (b ?? 0), 0);
        return Math.abs(sum - 1.0) < 0.01;
      }
      return true;
    },
    { message: 'When all five weights are provided, they must sum to 1.0' },
  );

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

