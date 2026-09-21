// ============================================================================
// Dashboard Utilities & Chart Builders Test
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  buildRoutingScoreChartData,
  buildCostChartData,
  buildCarbonChartData,
} from '../dashboard.utils';
import { EvaluatedModel } from '../dashboard.types';

describe('Dashboard Chart Data Builders', () => {
  const mockEvaluations: EvaluatedModel[] = [
    {
      modelId: 'gpt-4o',
      modelKey: 'gpt-4o',
      modelName: 'GPT-4o',
      providerKey: 'openai',
      providerName: 'OpenAI',
      family: 'gpt',
      capabilities: ['chat'],
      contextWindow: 128000,
      eligible: true,
      estimatedTokens: 500,
      estimatedCost: 0.005,
      estimatedCarbon: 0.8,
      qualityScore: 92,
      latencyMs: 1200,
      routingScore: 88,
      breakdown: {
        quality: 30,
        cost: 15,
        tokenEfficiency: 15,
        environmental: 15,
        latency: 13,
      },
      status: 'eligible',
      isSelected: false,
    },
    {
      modelId: 'gemini-1.5-flash',
      modelKey: 'gemini-1.5-flash',
      modelName: 'Gemini 1.5 Flash',
      providerKey: 'google_gemini',
      providerName: 'Google',
      family: 'gemini',
      capabilities: ['chat'],
      contextWindow: 1000000,
      eligible: true,
      estimatedTokens: 500,
      estimatedCost: 0.0005,
      estimatedCarbon: 0.08,
      qualityScore: 84,
      latencyMs: 300,
      routingScore: 94,
      breakdown: {
        quality: 25,
        cost: 20,
        tokenEfficiency: 15,
        environmental: 20,
        latency: 14,
      },
      status: 'eligible',
      isSelected: true,
    },
    {
      modelId: 'ineligible-model',
      modelKey: 'ineligible-model',
      modelName: 'Ineligible Model',
      providerKey: 'custom',
      providerName: 'Custom',
      family: 'custom',
      capabilities: [],
      contextWindow: 100,
      eligible: false,
      disqualifyReason: 'Context window exceeded',
      estimatedTokens: 500,
      estimatedCost: null,
      estimatedCarbon: null,
      qualityScore: 50,
      latencyMs: null,
      routingScore: 0,
      breakdown: {
        quality: 0,
        cost: 0,
        tokenEfficiency: 0,
        environmental: 0,
        latency: 0,
      },
      status: 'excluded',
      isSelected: false,
    },
  ];

  it('builds routing score chart data filtered to eligible models sorted by score', () => {
    const data = buildRoutingScoreChartData(mockEvaluations);
    expect(data.length).toBe(2);
    expect(data[0]!.score).toBe(94);
    expect(data[0]!.isSelected).toBe(true);
    expect(data[1]!.score).toBe(88);
  });

  it('builds cost chart data excluding models with null cost', () => {
    const data = buildCostChartData(mockEvaluations);
    expect(data.length).toBe(2);
    expect(data[0]!.cost).toBe(0.0005);
    expect(data[1]!.cost).toBe(0.005);
  });

  it('builds carbon chart data excluding models with null carbon', () => {
    const data = buildCarbonChartData(mockEvaluations);
    expect(data.length).toBe(2);
    expect(data[0]!.carbon).toBe(0.08);
    expect(data[1]!.carbon).toBe(0.8);
  });
});
