import { z } from 'zod';

const weightSchema = z.number().min(0).max(1);

export const updatePreferencesSchema = z
  .object({
    tokenEfficiencyWeight: weightSchema.optional(),
    costWeight: weightSchema.optional(),
    qualityWeight: weightSchema.optional(),
    environmentalWeight: weightSchema.optional(),
    defaultStrategy: z
      .enum(['balanced', 'lowest_cost', 'highest_quality', 'eco_first', 'token_efficient'])
      .optional(),
  })
  .refine(
    (data) => {
      const weights = [
        data.tokenEfficiencyWeight,
        data.costWeight,
        data.qualityWeight,
        data.environmentalWeight,
      ].filter((w) => w !== undefined);
      if (weights.length === 4) {
        const sum = weights.reduce((a, b) => a + (b ?? 0), 0);
        return Math.abs(sum - 1.0) < 0.01;
      }
      return true;
    },
    { message: 'When all four weights are provided, they must sum to 1.0' },
  );

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
