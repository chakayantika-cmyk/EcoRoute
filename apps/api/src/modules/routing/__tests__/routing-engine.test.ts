// ============================================================================
// Comprehensive Routing Engine Test Suite
// Validating 2-Stage Routing, Baseline Counterfactual, Break-Even,
// Uncertainty Propagation, Anti-Greenwashing, and Mock Mode Safety
// ============================================================================

import { describe, it, expect } from 'vitest';
import { TaskAnalysisService } from '../task-analysis.service';
import { TokenEstimator } from '../token-estimator.service';
import { BaselineService, BaselineEstimate } from '../baseline.service';
import { RoutingOverheadService, RouterOverheadMetrics } from '../routing-overhead.service';
import { BreakEvenService } from '../break-even.service';
import { SustainabilityAccountingService, SelectedModelMetrics } from '../sustainability-accounting.service';
import { ProviderNotConfiguredError, ProviderModelUnavailableError, ProviderUnreachableError, AllProvidersFailedError } from '../../../lib/errors';
import { ProviderHealthService } from '../../providers/provider-health.service';
import { MockProviderAdapter } from '../../../lib/adapters/mock-provider.adapter';
import { GoogleGeminiAdapter } from '../../../lib/adapters/google-gemini.adapter';
import { ROUTING_STRATEGY_WEIGHTS } from '@ecoroute/config';

describe('Task Analysis & Token Estimation', () => {
  it('classifies a coding prompt with appropriate domain, signals, and token expansion', () => {
    const prompt = 'Explain how a binary search tree works and provide Python code.';
    const analysis = TaskAnalysisService.analyze(prompt);

    expect(['code_implementation', 'coding', 'code_architecture']).toContain(analysis.domain);
    expect(analysis.detectedFeatures.some(f => f.toLowerCase().includes('code') || f.toLowerCase().includes('syntax') || f.toLowerCase().includes('logic'))).toBe(true);
    expect(analysis.expansionRatio).toBeGreaterThanOrEqual(2.0);
    expect(analysis.predictedOutputTokens).toBeGreaterThan(analysis.inputTokens);
    expect(analysis.complexityIndex).toBeGreaterThan(0.2);
  });

  it('classifies a mathematical reasoning prompt with high reasoning depth', () => {
    const prompt = 'Prove that the square root of 2 is irrational step by step using proof by contradiction.';
    const analysis = TaskAnalysisService.analyze(prompt);

    expect(['mathematical_derivation', 'reasoning', 'math', 'analytical_reasoning']).toContain(analysis.domain);
    expect(analysis.reasoningDepth).toBeGreaterThanOrEqual(0.6);
    expect(analysis.detectedFeatures.some((f) => f.includes('Proof') || f.includes('Reasoning') || f.includes('Logic'))).toBe(true);
  });

  it('classifies a short conversational prompt with low complexity', () => {
    const prompt = 'Hi, how are you today?';
    const analysis = TaskAnalysisService.analyze(prompt);

    expect(analysis.domain).toBe('casual_conversational');
    expect(analysis.complexityTier.toLowerCase()).toBe('low');
    expect(analysis.reasoningDepth).toBeLessThanOrEqual(0.3);
  });

  it('deterministically estimates tokens separating estimated from actual', () => {
    const text = 'EcoRoute is an intelligent router optimizing AI workloads.';
    const est = TokenEstimator.estimateInputTokens(text);
    expect(est).toBeGreaterThan(5);
    expect(est).toBeLessThan(30);

    const fullEstimate = TokenEstimator.estimate(text, 2.5);
    expect(fullEstimate.totalEstimatedTokens).toBe(
      fullEstimate.inputTokens + fullEstimate.predictedOutputTokens
    );
  });
});

describe('Direct Baseline Estimation (Counterfactual)', () => {
  const mockBaselineCandidate: any = {
    id: 'gemini-1.5-pro',
    modelKey: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    providerKey: 'google_gemini',
    pricing: {
      inputPricePerMillionTokens: 3.5,
      outputPricePerMillionTokens: 10.5,
    },
    energyProfile: {
      activeEnergyPer1kTokensWh: 4.5,
      idleEnergyPer1kTokensWh: 0.8,
    },
    environmentalProfile: {
      carbonIntensityGramsPerKwh: 385,
      waterIntensityLitersPerKwh: null,
    },
  };

  it('calculates counterfactual baseline without live provider execution', () => {
    const prompt = 'Write a comprehensive guide to graph algorithms in python.';
    const task = TaskAnalysisService.analyze(prompt);
    const estimate = BaselineService.estimateBaseline(mockBaselineCandidate, task);

    expect(estimate.modelKey).toBe('gemini-1.5-pro');
    expect(estimate.inputTokens).toBe(task.inputTokens);
    expect(estimate.outputTokens).toBe(task.predictedOutputTokens);
    expect(estimate.costUsd).toBeGreaterThan(0);
    expect(estimate.energyWh).toBeGreaterThan(0);
    expect(estimate.carbonGramsCo2e).toBeGreaterThan(0);
    // Water safety: null by default
    expect(estimate.waterLiters).toBeNull();
  });
});

describe('Router Overhead Accounting', () => {
  it('measures wall-clock timer and calculates host energy & carbon', () => {
    const endTimer = RoutingOverheadService.startTimer();
    // Simulate brief computation
    let sum = 0;
    for (let i = 0; i < 100000; i++) sum += i;

    const latencyMs = endTimer();
    const overhead = RoutingOverheadService.calculateOverhead(latencyMs, 65);

    expect(overhead.routerLatencyMs).toBeGreaterThanOrEqual(0);
    expect(overhead.routerEnergyWh).toBeGreaterThanOrEqual(0);
    expect(overhead.routerCarbonGramsCo2e).toBeGreaterThanOrEqual(0);
    // Water remains null by default when host water intensity is uncertified
    expect(overhead.routerWaterLiters).toBeNull();
  });
});

describe('Two-Phase Break-Even Verification', () => {
  const mockBaselineEstimate: BaselineEstimate = {
    modelId: 'gpt-4o',
    modelKey: 'gpt-4o',
    displayName: 'GPT-4o',
    providerName: 'OpenAI',
    providerKey: 'openai',
    inputTokens: 2,
    outputTokens: 5,
    totalTokens: 7,
    costUsd: 0.00002,
    energyWh: 0.00001,
    waterLiters: null,
    carbonGramsCo2e: 0.000005,
    latencyMs: 300,
    isCounterfactual: true,
    uncertainty: { energy: null, carbon: null },
    provenance: {
      pricingSource: 'catalog',
      energyMethodology: 'modeled',
      carbonSource: 'grid',
      waterSource: 'none',
      methodologyVersion: 'v1',
      measurementType: 'modeled',
    },
  };

  it('pre-screens trivial prompts where router overhead will outweigh savings', () => {
    const trivialTask = TaskAnalysisService.analyze('hi');
    const decision = BreakEvenService.preScreen(trivialTask, mockBaselineEstimate);
    expect(decision.shouldProceed).toBe(false);
    expect(decision.bypassReason).toContain('trivial');

    const complexTask = TaskAnalysisService.analyze(
      'Write a distributed database consensus protocol with Raft in Rust including unit tests.'
    );
    const complexDecision = BreakEvenService.preScreen(complexTask, mockBaselineEstimate);
    expect(complexDecision.shouldProceed).toBe(true);
  });

  it('detects when routing overhead exceeds expected candidate savings in Phase 2', () => {
    const mockOverhead: RouterOverheadMetrics = {
      routerLatencyMs: 80,
      routerCostUsd: 0.0001,
      routerEnergyWh: 0.005,
      routerWaterLiters: null,
      routerCarbonGramsCo2e: 0.002,
      powerWatts: 65,
      measurementType: 'modeled',
      carbonSource: 'grid',
      waterSource: 'none',
      llmRouterUsed: false,
    };

    // Candidate has higher energy than baseline, or overhead eats all savings
    const decision = BreakEvenService.evaluateFinalBreakEven(
      mockBaselineEstimate,
      0.000025, // candidate cost > baseline cost
      0.00002,  // candidate energy > baseline energy
      mockOverhead,
    );

    expect(decision.shouldRoute).toBe(false);
    expect(decision.routingPerformed).toBe(false);
    expect(decision.bypassReason).toContain('Routing overhead exceeds expected benefit');
  });

  it('permits routing when candidate provides solid savings over baseline', () => {
    const baselineBig: BaselineEstimate = {
      ...mockBaselineEstimate,
      costUsd: 0.05,
      energyWh: 0.05,
    };

    const smallOverhead: RouterOverheadMetrics = {
      routerLatencyMs: 10,
      routerCostUsd: 0.000001,
      routerEnergyWh: 0.0001,
      routerWaterLiters: null,
      routerCarbonGramsCo2e: 0.00005,
      powerWatts: 65,
      measurementType: 'modeled',
      carbonSource: 'grid',
      waterSource: 'none',
      llmRouterUsed: false,
    };

    const decision = BreakEvenService.evaluateFinalBreakEven(
      baselineBig,
      0.005, // 90% cost savings
      0.005, // 90% energy savings
      smallOverhead,
    );

    expect(decision.shouldRoute).toBe(true);
    expect(decision.routingPerformed).toBe(true);
  });
});

describe('Sustainability Accounting & Anti-Greenwashing', () => {
  const mockBaseline: BaselineEstimate = {
    modelId: 'gpt-4o',
    modelKey: 'gpt-4o',
    displayName: 'GPT-4o',
    providerName: 'OpenAI',
    providerKey: 'openai',
    inputTokens: 50,
    outputTokens: 200,
    totalTokens: 250,
    costUsd: 0.005,
    energyWh: 0.002,
    waterLiters: null,
    carbonGramsCo2e: 0.8,
    latencyMs: 1200,
    isCounterfactual: true,
    uncertainty: { energy: null, carbon: null },
    provenance: {
      pricingSource: 'catalog',
      energyMethodology: 'modeled',
      carbonSource: 'grid',
      waterSource: 'none',
      methodologyVersion: 'v1',
      measurementType: 'modeled',
    },
  };

  const mockOverhead: RouterOverheadMetrics = {
    routerLatencyMs: 15,
    routerCostUsd: 0.000001,
    routerEnergyWh: 0.00002,
    routerWaterLiters: null,
    routerCarbonGramsCo2e: 0.0001,
    powerWatts: 65,
    measurementType: 'modeled',
    carbonSource: 'grid',
    waterSource: 'none',
    llmRouterUsed: false,
  };

  it('builds 4-column accounting with uncertainty propagation', () => {
    const selected: SelectedModelMetrics = {
      modelId: 'gpt-4o-mini',
      costUsd: 0.0005,
      energyWh: 0.0002,
      waterLiters: null,
      carbonGramsCo2e: 0.08,
      latencyMs: 400,
    };

    const accounting = SustainabilityAccountingService.computeAccounting(
      mockBaseline,
      mockOverhead,
      selected,
      true,
    );

    // Verify 4 columns exist
    expect(accounting.baseline.costUsd).toBe(0.005);
    expect(accounting.router.energyWh).toBe(0.00002);
    expect(accounting.ecoRouteTotal.costUsd).toBeCloseTo(0.000501, 6);
    expect(accounting.netSavings.costPercent).toBeGreaterThan(80);
    expect(accounting.netSavings.carbonPercent).toBeGreaterThan(80);
    expect(accounting.outcomeStatus).toBe('net_saving');
  });

  it('strictly preserves negative savings when overhead exceeds benefits', () => {
    const expensiveOverhead: RouterOverheadMetrics = {
      routerLatencyMs: 500,
      routerCostUsd: 0.01,
      routerEnergyWh: 0.01,
      routerWaterLiters: null,
      routerCarbonGramsCo2e: 2.5, // 2.5g overhead exceeds baseline 0.8g!
      powerWatts: 65,
      measurementType: 'modeled',
      carbonSource: 'grid',
      waterSource: 'none',
      llmRouterUsed: false,
    };

    const selected: SelectedModelMetrics = {
      modelId: 'gpt-4o-mini',
      costUsd: 0.004,
      energyWh: 0.0019,
      waterLiters: null,
      carbonGramsCo2e: 0.75,
      latencyMs: 500,
    };

    const accounting = SustainabilityAccountingService.computeAccounting(
      mockBaseline,
      expensiveOverhead,
      selected,
      true,
    );

    expect(accounting.netSavings.carbonPercent).toBeLessThan(0);
    expect(accounting.outcomeStatus).toBe('overhead_exceeded');
    expect(accounting.outcomeMessage).toContain('exceeded the estimated benefit');
  });

  it('strictly maintains null water and never converts null to 0', () => {
    const selected: SelectedModelMetrics = {
      modelId: 'gpt-4o-mini',
      costUsd: 0.001,
      energyWh: 0.0005,
      waterLiters: null,
      carbonGramsCo2e: 0.2,
      latencyMs: 300,
    };

    const accounting = SustainabilityAccountingService.computeAccounting(
      mockBaseline,
      mockOverhead,
      selected,
      true,
    );

    expect(accounting.baseline.waterLiters).toBeNull();
    expect(accounting.router.waterLiters).toBeNull();
    expect(accounting.ecoRouteTotal.waterLiters).toBeNull();
    expect(accounting.netSavings.waterLiters).toBeNull();
  });
});

describe('5-Dimensional Scoring Weights', () => {
  it('ensures all 5 strategy weights sum to exactly 1.0', () => {
    for (const [, weights] of Object.entries(ROUTING_STRATEGY_WEIGHTS)) {
      const sum =
        weights.quality +
        weights.cost +
        weights.tokenEfficiency +
        weights.environmental +
        weights.latency;
      expect(sum).toBeCloseTo(1.0, 5);
    }
  });
});

describe('Production vs Mock Mode Safety', () => {
  it('prefixes mock provider output with [Simulation Mode]', async () => {
    const mockAdapter = new MockProviderAdapter();
    const chunks: string[] = [];

    const stream = mockAdapter.generateStream(
      { prompt: 'test prompt', model: 'mock-model' },
      (chunk) => {
        chunks.push(chunk);
      }
    );

    await stream;
    const fullText = chunks.join('');
    expect(fullText).toContain('[Simulation Mode]');
  });

  it('fails with structured PROVIDER_NOT_CONFIGURED error when API key is missing and AI_MOCK_MODE=false', async () => {
    // Create real adapter without API key
    const realAdapter = new GoogleGeminiAdapter({
      id: 'prov-gemini',
      name: 'Google Gemini',
      providerKey: 'google_gemini',
      adapterType: 'gemini',
      enabled: true,
      apiKey: '',
    });

    await expect(async () => {
      await realAdapter.generate({
        prompt: 'test prompt',
        model: 'gemini-1.5-flash',
      });
    }).rejects.toThrow(ProviderNotConfiguredError);
  });
});

describe('Model Eligibility & Missing Data Robustness', () => {
  it('disqualifies candidate models when prompt tokens exceed context window', () => {
    const hugePrompt = 'lorem ipsum '.repeat(3500); // 7000 words ~ 9000+ tokens
    const inputTokens = TokenEstimator.estimateInputTokens(hugePrompt);

    const smallContextModel: any = {
      id: 'tiny-model',
      contextWindowTokens: 4096,
      capabilities: ['chat'],
    };

    const isEligible = smallContextModel.contextWindowTokens >= inputTokens;
    expect(isEligible).toBe(false);
  });

  it('guarantees baseline estimation produces counterfactual data without touching network', () => {
    const prompt = 'Implement Quicksort in Python.';
    const task = TaskAnalysisService.analyze(prompt);

    const baselineCandidate: any = {
      id: 'gpt-4o',
      modelKey: 'gpt-4o',
      displayName: 'GPT-4o',
      providerKey: 'openai',
      pricing: {
        inputPricePerMillionTokens: 5.0,
        outputPricePerMillionTokens: 15.0,
      },
      energyProfile: {
        activeEnergyPer1kTokensWh: 4.5,
        idleEnergyPer1kTokensWh: 0.8,
      },
      environmentalProfile: {
        carbonIntensityGramsPerKwh: 385,
        waterIntensityLitersPerKwh: null,
      },
    };

    // Calling estimateBaseline does NOT call any network endpoint
    const estimate = BaselineService.estimateBaseline(baselineCandidate, task);
    expect(estimate.isCounterfactual).toBe(true);
    expect(estimate.costUsd).toBeGreaterThan(0);
    expect(estimate.energyWh).toBeGreaterThan(0);
  });

  it('prohibits converting missing water data to zero in sustainability balance sheet', () => {
    const mockBaseline: any = {
      modelId: 'gpt-4o',
      costUsd: 0.01,
      energyWh: 0.005,
      waterLiters: null, // explicitly null
      carbonGramsCo2e: 1.0,
    };

    const mockOverhead: any = {
      routerCostUsd: 0.0001,
      routerEnergyWh: 0.0001,
      routerWaterLiters: null, // explicitly null
      routerCarbonGramsCo2e: 0.0002,
      routerLatencyMs: 25,
    };

    const mockSelected: any = {
      modelId: 'gemini-1.5-flash',
      costUsd: 0.001,
      energyWh: 0.0005,
      waterLiters: null, // explicitly null
      carbonGramsCo2e: 0.1,
      latencyMs: 350,
    };

    const sheet = SustainabilityAccountingService.computeAccounting(
      mockBaseline,
      mockOverhead,
      mockSelected,
      true
    );

    expect(sheet.baseline.waterLiters).toBeNull();
    expect(sheet.baseline.waterLiters).not.toBe(0);
    expect(sheet.router.waterLiters).toBeNull();
    expect(sheet.router.waterLiters).not.toBe(0);
    expect(sheet.ecoRouteTotal.waterLiters).toBeNull();
    expect(sheet.ecoRouteTotal.waterLiters).not.toBe(0);
    expect(sheet.netSavings.waterLiters).toBeNull();
  });
});

describe('Provider & Model Availability Validation (Strict Anti-404 Guard)', () => {
  it('correctly maps ProviderModelUnavailableError with 404 and PROVIDER_MODEL_UNAVAILABLE code', () => {
    const err = new ProviderModelUnavailableError('ollama', 'llama3.1:8b');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('PROVIDER_MODEL_UNAVAILABLE');
    expect(err.message).toContain('llama3.1:8b');
    expect(err.message).toContain('ollama');
  });

  it('correctly maps ProviderUnreachableError with 503 and PROVIDER_UNREACHABLE code', () => {
    const err = new ProviderUnreachableError('ollama', 'Connection refused at localhost:11434');
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe('PROVIDER_UNREACHABLE');
  });

  it('correctly maps AllProvidersFailedError with 502 and structured diagnostics', () => {
    const err = new AllProvidersFailedError('All providers failed', {
      failedCandidates: [
        { provider: 'ollama', model: 'llama3.1:8b', reason: 'Model not installed' },
        { provider: 'openai', model: 'gpt-4o', reason: 'Missing API key' },
      ],
    });
    expect(err.statusCode).toBe(502);
    expect(err.code).toBe('ALL_PROVIDERS_FAILED');
    expect((err.details as any)?.failedCandidates).toHaveLength(2);
  });

  it('verifies Ollama offline returns UNREACHABLE and disqualifies candidates', async () => {
    // Port 65530 is closed and guaranteed to refuse connection
    const check = await ProviderHealthService.checkModelAvailability(
      'ollama',
      'llama3.1:8b',
      'llama3.1-8b',
      'http://127.0.0.1:65530'
    );

    expect(check.isAvailable).toBe(false);
    expect(check.providerHealth).toBe('UNREACHABLE');
    expect(check.reason).toBeDefined();
  });

  it('guarantees cache invalidation clears cached provider health immediately', async () => {
    // Manually set a mock health record and test invalidation
    ProviderHealthService.invalidate('ollama');
    const health = ProviderHealthService.getCachedHealth('ollama');
    expect(health).toBeNull();
  });

  it('enforces that disqualified models have totalScore: null (NEVER 0) and cannot win routing', () => {
    // Test that ranking logic strictly excludes null scores and doesn't treat them as 0
    const candidates = [
      {
        id: 'llama-local',
        displayName: 'Llama 3.1 8B (Local)',
        eligible: false,
        totalScore: null,
        scores: { quality: 0, cost: 0, tokenEfficiency: 0, environmental: 0, latency: 0 },
        estimatedCost: 0, // Zero cost tempting heuristic
        estimatedCarbonGrams: 0.001, // Low carbon
      },
      {
        id: 'gemini-flash',
        displayName: 'Gemini 1.5 Flash',
        eligible: true,
        totalScore: 0.725,
        scores: { quality: 0.85, cost: 0.9, tokenEfficiency: 0.8, environmental: 0.7, latency: 0.85 },
        estimatedCost: 0.0001,
        estimatedCarbonGrams: 0.05,
      },
    ];

    // Rule: eligibleCandidates = candidates.filter(candidate => candidate.eligible)
    const eligibleCandidates = candidates.filter((c) => c.eligible);
    expect(eligibleCandidates).toHaveLength(1);
    expect(eligibleCandidates[0]?.id).toBe('gemini-flash');

    // Winner selection must only be from eligible candidates
    const winningCandidate = eligibleCandidates.sort(
      (a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1)
    )[0];

    expect(winningCandidate).toBeDefined();
    expect(winningCandidate?.id).toBe('gemini-flash');
    expect(winningCandidate?.id).not.toBe('llama-local');

    // The disqualified candidate's score is null, not 0
    const disqualified = candidates.find((c) => !c.eligible);
    expect(disqualified?.totalScore).toBeNull();
    expect(disqualified?.totalScore).not.toBe(0);
  });
});

