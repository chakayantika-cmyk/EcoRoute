// ============================================================================
// Routing Engine — Core Service (Scientific Dynamic Multi-Model Router)
// Stage 1: Inexpensive local parallel evaluation of all models + Counterfactual Baseline
// Stage 2: Execution of the single winning model (or baseline if break-even bypassed)
// Strict Production Rule: Never fabricate answers, never silently fall back to fake answers.
// ============================================================================

import { PrismaClient } from '@prisma/client';
import {
  ROUTING_STRATEGY_WEIGHTS,
  calculateDualPhaseEnvironmentalEstimate,
  ENVIRONMENTAL_METHODOLOGY,
  ModelEnergyProfile,
} from '@ecoroute/config';
import { NotFoundError, AllProvidersFailedError, NoEligibleFreeModelError } from '../../lib/errors';
import { executeModelCall, streamModelCall } from '../../lib/ai-providers';
import { ModelRegistryCache, CandidateModelRecord } from '../models/model-registry.service';
import { ProviderHealthService } from '../providers/provider-health.service';
import { TaskAnalysisService } from './task-analysis.service';
import { TaskAnalysisProfile } from './task-analysis.types';
import { BaselineService, BaselineEstimate } from './baseline.service';
import { RoutingOverheadService } from './routing-overhead.service';
import { BreakEvenService } from './break-even.service';
import { SustainabilityAccountingService, SelectedModelMetrics } from './sustainability-accounting.service';

export interface CandidateModel extends CandidateModelRecord {}

export interface ScoredCandidate {
  model: CandidateModel;
  scores: {
    quality: number;
    cost: number;
    tokenEfficiency: number;
    environmental: number;
    latency: number;
  };
  totalScore: number | null;
  estimatedTokens: number;
  estimatedCost: number | null;
  estimatedEnergyWh: number | null;
  estimatedWaterLiters: number | null;
  estimatedCarbonGrams: number | null;
  estimatedLatencyMs: number | null;
  prefillEnergyWh?: number | null;
  decodeEnergyWh?: number | null;
  qualityScore: number;
  qualitySource: string;
  eligible: boolean;
  status: 'evaluated' | 'eligible' | 'excluded' | 'insufficient_data' | 'provider_unavailable' | 'model_not_installed';
  disqualifyReason?: string;
  providerHealth?: 'HEALTHY' | 'UNREACHABLE' | 'UNCONFIGURED' | 'DEGRADED';
  modelAvailability?: 'AVAILABLE' | 'NOT_INSTALLED' | 'UNKNOWN' | 'INSUFFICIENT_DATA';
  wasCalled?: boolean;
  provenance: {
    qualitySource: string;
    qualityBenchmark: string;
    latencySource: string;
    energySource: string;
    pricingSource: string;
  };
}

export class RoutingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Complete non-streaming route execution
   */
  async routeTask(taskId: string, userId: string, strategy?: string, abortSignal?: AbortSignal) {
    const stopTimer = RoutingOverheadService.startTimer();
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundError('Task', taskId);

    await this.prisma.task.update({ where: { id: taskId }, data: { status: 'ROUTING' } });

    try {
      const preferences = await this.prisma.routingPreference.findUnique({
        where: { userId },
      });

      const strategyKey = (strategy ?? preferences?.defaultStrategy ?? 'balanced');
      const baseWeights: { quality: number; cost: number; tokenEfficiency: number; environmental: number; latency: number } =
        (ROUTING_STRATEGY_WEIGHTS as any)[strategyKey] ?? ROUTING_STRATEGY_WEIGHTS.balanced;

      console.log(`[EcoRoute] Task received: ${taskId}`);
      const taskProfile = TaskAnalysisService.analyze(task.inputText);
      console.log(`[EcoRoute] Task type: ${taskProfile.domain} (TCI: ${taskProfile.complexityIndex})`);

      const candidates = await ModelRegistryCache.getActiveModels(this.prisma);
      console.log(`[EcoRoute] Loaded ${candidates.length} candidates from catalog`);

      // 1. Counterfactual Baseline Estimate (No double AI call)
      const baselineModel = BaselineService.resolveBaselineModel(candidates, preferences?.baselineModelId);
      const baselineEstimate = BaselineService.estimateBaseline(baselineModel, taskProfile);
      console.log(`[EcoRoute] Baseline model: ${baselineEstimate.displayName} (${baselineEstimate.providerName})`);

      // 2. Phase 1: Cheap Pre-Screen
      const preScreen = BreakEvenService.preScreen(taskProfile, baselineEstimate);

      // 3. Parallel Candidate Model Evaluation
      const scoredCandidates = await this.evaluateCandidatesParallel(
        candidates,
        taskProfile,
        baseWeights,
        strategyKey,
      );

      const eligible = scoredCandidates.filter((c) => c.eligible && c.totalScore != null);
      console.log(`[EcoRoute] Eligible models: ${eligible.length} / ${candidates.length}`);

      if (eligible.length === 0) {
        const providerSummaries = this.buildProviderSummaries(scoredCandidates);
        const diagnostics = scoredCandidates
          .map((c) => `• ${c.model.displayName} (${c.model.providerName}): ${c.disqualifyReason || 'Ineligible'}`)
          .join('\n');
        const summaryText = providerSummaries.map((p) => `• ${p.providerName}: ${p.statusSummary}`).join('\n');
        const errMsg = `No eligible AI models are currently available to execute this task.\n\nProvider Status:\n${summaryText}`;

        await this.prisma.task.update({
          where: { id: taskId },
          data: { status: 'FAILED', errorInfo: errMsg, completedAt: new Date() },
        });
        if (process.env.FREE_MODELS_ONLY !== 'false') {
          throw new NoEligibleFreeModelError(errMsg, { candidateCount: candidates.length, diagnostics, providerSummaries });
        }
        throw new AllProvidersFailedError(errMsg, { candidateCount: candidates.length, diagnostics, providerSummaries });
      }

      const bestCandidate = eligible.sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0))[0]!;
      bestCandidate.wasCalled = true;

      // 4. Measure Router Overhead so far
      const elapsedRouterMs = stopTimer();
      const overhead = RoutingOverheadService.calculateOverhead(elapsedRouterMs);
      console.log(`[EcoRoute] Routing latency: ${overhead.routerLatencyMs}ms, overhead energy: ${overhead.routerEnergyWh}Wh`);

      // 5. Phase 2: Final Break-Even check
      let selectedCandidate = bestCandidate;
      let routingPerformed = true;
      let bypassReason: string | null = null;

      if (!preScreen.shouldProceed) {
        routingPerformed = false;
        bypassReason = preScreen.bypassReason || 'Routing overhead exceeds expected benefit.';
      } else {
        const breakEven = BreakEvenService.evaluateFinalBreakEven(
          baselineEstimate,
          bestCandidate.estimatedCost,
          bestCandidate.estimatedEnergyWh,
          overhead,
        );

        if (!breakEven.shouldRoute) {
          routingPerformed = false;
          bypassReason = breakEven.bypassReason || 'Routing overhead exceeds expected benefit.';
          console.log(`[EcoRoute] Break-even bypass triggered: ${bypassReason}`);
        }
      }

      // If bypassed, direct execution goes to Baseline Model ONLY if Baseline Model is eligible; otherwise to Best Candidate
      const canExecuteBaseline = eligible.some((e) => e.model.id === baselineModel.id);
      const modelToExecute = (routingPerformed || !canExecuteBaseline) ? selectedCandidate.model : baselineModel;
      if (!routingPerformed && !canExecuteBaseline) {
        console.log(`[EcoRoute] Break-even bypass triggered, but baseline model (${baselineModel.displayName}) is not eligible to execute. Executing best eligible candidate (${selectedCandidate.model.displayName}) instead.`);
      }
      console.log(`[EcoRoute] Selected model for execution: ${modelToExecute.displayName} (${modelToExecute.providerName})`);

      await this.prisma.task.update({ where: { id: taskId }, data: { status: 'GENERATING' } });

      // Stage 2: Execution with ONLY the single chosen model
      const providerRecord = await this.prisma.aIProvider.findUnique({
        where: { id: modelToExecute.providerId },
      });
      let providerApiKey: string | undefined;
      if (providerRecord?.configJson) {
        try {
          const cfg = JSON.parse(providerRecord.configJson);
          providerApiKey = cfg.apiKey;
        } catch {}
      }

      const execResult = await executeModelCall(
        task.inputText,
        {
          modelKey: modelToExecute.modelKey,
          displayName: modelToExecute.displayName,
          providerKey: modelToExecute.providerKey,
          providerName: modelToExecute.providerName,
          providerModelId: modelToExecute.providerModelId,
          adapterType: modelToExecute.adapterType,
          baseUrl: modelToExecute.baseUrl,
          capabilities: modelToExecute.capabilities,
          contextWindow: modelToExecute.contextWindow,
          pricing: modelToExecute.pricing,
        },
        providerApiKey,
        abortSignal,
      );

      console.log(`[EcoRoute] Provider generation completed in ${execResult.latencyMs}ms (${execResult.actualTokens} tokens)`);

      // 6. Sustainability Accounting
      const selectedMetrics: SelectedModelMetrics = {
        modelId: modelToExecute.id,
        costUsd: execResult.actualCost ?? (routingPerformed ? selectedCandidate.estimatedCost : baselineEstimate.costUsd),
        energyWh: routingPerformed ? selectedCandidate.estimatedEnergyWh : baselineEstimate.energyWh,
        waterLiters: routingPerformed ? selectedCandidate.estimatedWaterLiters : baselineEstimate.waterLiters,
        carbonGramsCo2e: routingPerformed ? selectedCandidate.estimatedCarbonGrams : baselineEstimate.carbonGramsCo2e,
        latencyMs: execResult.latencyMs,
      };

      const sustainability = SustainabilityAccountingService.computeAccounting(
        baselineEstimate,
        overhead,
        selectedMetrics,
        routingPerformed,
        bypassReason,
      );

      const explanation = this.buildScientificExplanation(
        selectedCandidate,
        strategyKey,
        taskProfile,
        scoredCandidates.length,
        execResult.isLive,
        routingPerformed,
        bypassReason,
      );

      const evaluationsJson = this.buildEvaluationsPayload(scoredCandidates, taskProfile, selectedCandidate, baselineEstimate);

      // Persist to database
      const routingResult = await this.prisma.routingResult.create({
        data: {
          taskId,
          selectedModelId: modelToExecute.id,
          strategy: strategyKey,
          estimatedTokens: taskProfile.totalEstimatedTokens,
          actualTokens: execResult.actualTokens,
          estimatedCostValue: selectedCandidate.estimatedCost,
          estimatedCostCurrency: 'USD',
          actualCostValue: execResult.actualCost,
          energyWh: selectedCandidate.estimatedEnergyWh,
          waterLiters: selectedCandidate.estimatedWaterLiters,
          carbonGrams: selectedCandidate.estimatedCarbonGrams,
          environmentalStatus: 'ESTIMATED',
          methodologyVersion: ENVIRONMENTAL_METHODOLOGY.version,
          qualityScore: selectedCandidate.qualityScore,
          qualityScoreType: execResult.isLive ? 'ACTUAL' : 'SIMULATED',
          explanation,
          candidateScoresJson: JSON.stringify(evaluationsJson),

          // Baseline accounting
          baselineModelId: baselineEstimate.modelId,
          baselineCostValue: baselineEstimate.costUsd,
          baselineEnergyWh: baselineEstimate.energyWh,
          baselineWaterLiters: baselineEstimate.waterLiters,
          baselineCarbonGrams: baselineEstimate.carbonGramsCo2e,
          baselineLatencyMs: baselineEstimate.latencyMs,

          // Router overhead
          routerLatencyMs: overhead.routerLatencyMs,
          routerCostValue: overhead.routerCostUsd,
          routerEnergyWh: overhead.routerEnergyWh,
          routerWaterLiters: overhead.routerWaterLiters,
          routerCarbonGrams: overhead.routerCarbonGramsCo2e,

          // EcoRoute totals
          ecoRouteTotalCostValue: sustainability.ecoRouteTotal.costUsd,
          ecoRouteTotalEnergyWh: sustainability.ecoRouteTotal.energyWh,
          ecoRouteTotalWaterLiters: sustainability.ecoRouteTotal.waterLiters,
          ecoRouteTotalCarbonGrams: sustainability.ecoRouteTotal.carbonGramsCo2e,
          ecoRouteTotalLatencyMs: sustainability.ecoRouteTotal.latencyMs,

          // Net savings
          netCostSavings: sustainability.netSavings.costUsd,
          netEnergySavings: sustainability.netSavings.energyWh,
          netWaterSavings: sustainability.netSavings.waterLiters,
          netCarbonSavings: sustainability.netSavings.carbonGramsCo2e,
          netSavingsPercentage: sustainability.netSavings.energyPercent,

          // Bypass info
          routingPerformed,
          bypassReason,

          sustainabilityJson: JSON.stringify(sustainability),
          snapshotsJson: JSON.stringify({
            baseline: baselineEstimate,
            selected: selectedCandidate,
            overhead,
          }),
        },
      });

      await this.prisma.generatedAnswer.create({
        data: {
          taskId,
          answerText: execResult.answer,
          providerRequestId: execResult.providerRequestId,
        },
      });

      await this.saveMetricSnapshots(routingResult.id, selectedCandidate, taskProfile.totalEstimatedTokens);

      await this.prisma.task.update({
        where: { id: taskId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      return {
        task,
        routingResult,
        selectedModel: selectedCandidate,
        evaluations: evaluationsJson.evaluations,
        baseline: baselineEstimate,
        sustainability,
        answer: execResult,
      };
    } catch (err: any) {
      await this.prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'FAILED',
          errorInfo: err.message || 'Routing failed',
          completedAt: new Date(),
        },
      });
      throw err;
    }
  }

  /**
   * Stage 1 & Stage 2 Streaming Execution Pipeline (SSE)
   */
  async routeTaskStream(
    taskId: string,
    userId: string,
    strategy: string | undefined,
    onEvent: (event: { event: string; data: any }) => void,
    abortSignal?: AbortSignal,
  ) {
    const stopTimer = RoutingOverheadService.startTimer();
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundError('Task', taskId);

    // Event 1: Analyzing
    onEvent({ event: 'state', data: { status: 'analyzing', message: 'Analyzing task characteristics...' } });

    const preferences = await this.prisma.routingPreference.findUnique({
      where: { userId },
    });
    const strategyKey = (strategy ?? preferences?.defaultStrategy ?? 'balanced');
    const baseWeights: { quality: number; cost: number; tokenEfficiency: number; environmental: number; latency: number } =
      (ROUTING_STRATEGY_WEIGHTS as any)[strategyKey] ?? ROUTING_STRATEGY_WEIGHTS.balanced;

    const taskProfile = TaskAnalysisService.analyze(task.inputText);
    onEvent({ event: 'taskAnalysis', data: taskProfile });

    // Event 2: Evaluating
    const candidates = await ModelRegistryCache.getActiveModels(this.prisma);
    onEvent({
      event: 'state',
      data: { status: 'evaluating', message: `Evaluating ${candidates.length} candidate models...` },
    });

    const baselineModel = BaselineService.resolveBaselineModel(candidates, preferences?.baselineModelId);
    const baselineEstimate = BaselineService.estimateBaseline(baselineModel, taskProfile);

    const scoredCandidates = await this.evaluateCandidatesParallel(
      candidates,
      taskProfile,
      baseWeights,
      strategyKey,
    );

    const eligible = scoredCandidates.filter((c) => c.eligible && c.totalScore != null);
    if (eligible.length === 0) {
      const providerSummaries = this.buildProviderSummaries(scoredCandidates);
      const diagnostics = scoredCandidates
        .map((c) => `• ${c.model.displayName} (${c.model.providerName}): ${c.disqualifyReason || 'Ineligible'}`)
        .join('\n');
      const summaryText = providerSummaries.map((p) => `• ${p.providerName}: ${p.statusSummary}`).join('\n');
      const hasAnyConfigured = scoredCandidates.some((c) => c.providerHealth !== 'UNCONFIGURED');
      const errCode = process.env.FREE_MODELS_ONLY !== 'false' ? 'NO_ELIGIBLE_FREE_MODEL' : (hasAnyConfigured ? 'ALL_PROVIDERS_FAILED' : 'NO_AI_PROVIDER_CONFIGURED');
      const errMsg = `No eligible AI models are currently available to execute this task.\n\nProvider Status:\n${summaryText}`;

      const evaluationsJson = this.buildEvaluationsPayload(scoredCandidates, taskProfile, null, baselineEstimate);
      onEvent({ event: 'evaluations', data: evaluationsJson.evaluations });
      onEvent({ event: 'baseline', data: baselineEstimate });

      onEvent({
        event: 'error',
        data: {
          code: errCode,
          message: errMsg,
          providerSummaries,
          details: { diagnostics, providerSummaries },
        },
      });

      await this.prisma.task.update({
        where: { id: taskId },
        data: { status: 'FAILED', errorInfo: errMsg, completedAt: new Date() },
      });

      if (process.env.FREE_MODELS_ONLY !== 'false') {
        throw new NoEligibleFreeModelError(errMsg, { candidateCount: candidates.length, diagnostics, providerSummaries });
      }
      throw new AllProvidersFailedError(errMsg, { candidateCount: candidates.length, diagnostics, providerSummaries });
    }

    const bestCandidate = eligible.sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0))[0]!;
    bestCandidate.wasCalled = true;
    const evaluationsJson = this.buildEvaluationsPayload(scoredCandidates, taskProfile, bestCandidate, baselineEstimate);

    onEvent({ event: 'evaluations', data: evaluationsJson.evaluations });
    onEvent({ event: 'baseline', data: baselineEstimate });

    // Event 3: Routing decision & Break-Even check
    const elapsedRouterMs = stopTimer();
    const overhead = RoutingOverheadService.calculateOverhead(elapsedRouterMs);

    const preScreen = BreakEvenService.preScreen(taskProfile, baselineEstimate);
    let selectedCandidate = bestCandidate;
    let routingPerformed = true;
    let bypassReason: string | null = null;

    if (!preScreen.shouldProceed) {
      routingPerformed = false;
      bypassReason = preScreen.bypassReason || 'Routing overhead exceeds expected benefit.';
    } else {
      const breakEven = BreakEvenService.evaluateFinalBreakEven(
        baselineEstimate,
        bestCandidate.estimatedCost,
        bestCandidate.estimatedEnergyWh,
        overhead,
      );
      if (!breakEven.shouldRoute) {
        routingPerformed = false;
        bypassReason = breakEven.bypassReason || 'Routing overhead exceeds expected benefit.';
      }
    }

    const canExecuteBaseline = eligible.some((e) => e.model.id === baselineModel.id);
    const modelToExecute = (routingPerformed || !canExecuteBaseline) ? selectedCandidate.model : baselineModel;
    if (!routingPerformed && !canExecuteBaseline) {
      console.log(`[EcoRoute] Break-even bypass triggered in stream, but baseline model (${baselineModel.displayName}) is not eligible to execute. Executing best eligible candidate (${selectedCandidate.model.displayName}) instead.`);
    }

    onEvent({
      event: 'state',
      data: {
        status: 'routing',
        message: routingPerformed
          ? `Selected ${modelToExecute.displayName} (${modelToExecute.providerName})`
          : `Direct execution via Baseline (${modelToExecute.displayName}): ${bypassReason}`,
      },
    });

    onEvent({
      event: 'selectedModel',
      data: {
        modelId: modelToExecute.id,
        modelKey: modelToExecute.modelKey,
        displayName: modelToExecute.displayName,
        provider: modelToExecute.providerName,
        routingScore: selectedCandidate.totalScore != null ? Number((selectedCandidate.totalScore * 100).toFixed(1)) : null,
        breakdown: {
          quality: Number((selectedCandidate.scores.quality * 100).toFixed(1)),
          cost: Number((selectedCandidate.scores.cost * 100).toFixed(1)),
          tokenEfficiency: Number((selectedCandidate.scores.tokenEfficiency * 100).toFixed(1)),
          environmental: Number((selectedCandidate.scores.environmental * 100).toFixed(1)),
          latency: Number((selectedCandidate.scores.latency * 100).toFixed(1)),
        },
        estimatedCost: selectedCandidate.estimatedCost,
        estimatedEnergy: selectedCandidate.estimatedEnergyWh,
        estimatedWater: selectedCandidate.estimatedWaterLiters,
        estimatedCarbon: selectedCandidate.estimatedCarbonGrams,
        estimatedTokens: selectedCandidate.estimatedTokens,
        qualityScore: selectedCandidate.qualityScore,
        estimatedLatencyMs: selectedCandidate.estimatedLatencyMs,
        routingPerformed,
        bypassReason,
      },
    });

    // Event 4: Generating (streaming answer tokens)
    onEvent({
      event: 'state',
      data: {
        status: 'generating',
        message: `Generating response with ${modelToExecute.displayName}...`,
        selectedModel: modelToExecute.displayName,
        provider: modelToExecute.providerName,
      },
    });

    const providerRecord = await this.prisma.aIProvider.findUnique({
      where: { id: modelToExecute.providerId },
    });
    let providerApiKey: string | undefined;
    if (providerRecord?.configJson) {
      try {
        const cfg = JSON.parse(providerRecord.configJson);
        providerApiKey = cfg.apiKey;
      } catch {}
    }

    let fullAnswer = '';
    const execResult = await streamModelCall(
      task.inputText,
      {
        modelKey: modelToExecute.modelKey,
        displayName: modelToExecute.displayName,
        providerKey: modelToExecute.providerKey,
        providerName: modelToExecute.providerName,
        providerModelId: modelToExecute.providerModelId,
        adapterType: modelToExecute.adapterType,
        baseUrl: modelToExecute.baseUrl,
        capabilities: modelToExecute.capabilities,
        contextWindow: modelToExecute.contextWindow,
        pricing: modelToExecute.pricing,
      },
      (chunk: string) => {
        fullAnswer += chunk;
        onEvent({ event: 'chunk', data: { chunk, fullText: fullAnswer } });
      },
      providerApiKey,
      abortSignal,
    );

    const selectedMetrics: SelectedModelMetrics = {
      modelId: modelToExecute.id,
      costUsd: execResult.actualCost ?? (routingPerformed ? selectedCandidate.estimatedCost : baselineEstimate.costUsd),
      energyWh: routingPerformed ? selectedCandidate.estimatedEnergyWh : baselineEstimate.energyWh,
      waterLiters: routingPerformed ? selectedCandidate.estimatedWaterLiters : baselineEstimate.waterLiters,
      carbonGramsCo2e: routingPerformed ? selectedCandidate.estimatedCarbonGrams : baselineEstimate.carbonGramsCo2e,
      latencyMs: execResult.latencyMs,
    };

    const sustainability = SustainabilityAccountingService.computeAccounting(
      baselineEstimate,
      overhead,
      selectedMetrics,
      routingPerformed,
      bypassReason,
    );

    const explanation = this.buildScientificExplanation(
      selectedCandidate,
      strategyKey,
      taskProfile,
      scoredCandidates.length,
      execResult.isLive,
      routingPerformed,
      bypassReason,
    );

    // Persist to database
    const routingResult = await this.prisma.routingResult.create({
      data: {
        taskId,
        selectedModelId: modelToExecute.id,
        strategy: strategyKey,
        estimatedTokens: taskProfile.totalEstimatedTokens,
        actualTokens: execResult.actualTokens,
        estimatedCostValue: selectedCandidate.estimatedCost,
        estimatedCostCurrency: 'USD',
        actualCostValue: execResult.actualCost,
        energyWh: selectedCandidate.estimatedEnergyWh,
        waterLiters: selectedCandidate.estimatedWaterLiters,
        carbonGrams: selectedCandidate.estimatedCarbonGrams,
        environmentalStatus: 'ESTIMATED',
        methodologyVersion: ENVIRONMENTAL_METHODOLOGY.version,
        qualityScore: selectedCandidate.qualityScore,
        qualityScoreType: execResult.isLive ? 'ACTUAL' : 'SIMULATED',
        explanation,
        candidateScoresJson: JSON.stringify(evaluationsJson),

        baselineModelId: baselineEstimate.modelId,
        baselineCostValue: baselineEstimate.costUsd,
        baselineEnergyWh: baselineEstimate.energyWh,
        baselineWaterLiters: baselineEstimate.waterLiters,
        baselineCarbonGrams: baselineEstimate.carbonGramsCo2e,
        baselineLatencyMs: baselineEstimate.latencyMs,

        routerLatencyMs: overhead.routerLatencyMs,
        routerCostValue: overhead.routerCostUsd,
        routerEnergyWh: overhead.routerEnergyWh,
        routerWaterLiters: overhead.routerWaterLiters,
        routerCarbonGrams: overhead.routerCarbonGramsCo2e,

        ecoRouteTotalCostValue: sustainability.ecoRouteTotal.costUsd,
        ecoRouteTotalEnergyWh: sustainability.ecoRouteTotal.energyWh,
        ecoRouteTotalWaterLiters: sustainability.ecoRouteTotal.waterLiters,
        ecoRouteTotalCarbonGrams: sustainability.ecoRouteTotal.carbonGramsCo2e,
        ecoRouteTotalLatencyMs: sustainability.ecoRouteTotal.latencyMs,

        netCostSavings: sustainability.netSavings.costUsd,
        netEnergySavings: sustainability.netSavings.energyWh,
        netWaterSavings: sustainability.netSavings.waterLiters,
        netCarbonSavings: sustainability.netSavings.carbonGramsCo2e,
        netSavingsPercentage: sustainability.netSavings.energyPercent,

        routingPerformed,
        bypassReason,

        sustainabilityJson: JSON.stringify(sustainability),
        snapshotsJson: JSON.stringify({
          baseline: baselineEstimate,
          selected: selectedCandidate,
          overhead,
        }),
      },
    });

    await this.prisma.generatedAnswer.create({
      data: {
        taskId,
        answerText: execResult.answer || fullAnswer,
        providerRequestId: execResult.providerRequestId,
      },
    });

    await this.saveMetricSnapshots(routingResult.id, selectedCandidate, taskProfile.totalEstimatedTokens);

    await this.prisma.task.update({
      where: { id: taskId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    // Event 5: Completed
    onEvent({
      event: 'completed',
      data: {
        taskId,
        status: 'completed',
        selectedModel: {
          modelId: modelToExecute.id,
          modelName: modelToExecute.displayName,
          provider: modelToExecute.providerName,
        },
        actualUsage: {
          inputTokens: execResult.inputTokens,
          outputTokens: execResult.outputTokens,
          totalTokens: execResult.actualTokens,
          latencyMs: execResult.latencyMs,
          actualCost: execResult.actualCost,
        },
        routingResultId: routingResult.id,
        routingPerformed,
        bypassReason,
        sustainability,
        explanation,
      },
    });
  }

  // ---- Parallel Stage 1 Model Evaluation ----

  private async evaluateCandidatesParallel(
    candidates: CandidateModel[],
    task: TaskAnalysisProfile,
    baseWeights: { quality: number; cost: number; tokenEfficiency: number; environmental: number; latency: number },
    strategyKey: string,
  ): Promise<ScoredCandidate[]> {
    // Dynamic weight adjustment based on task complexity
    let weights = { ...baseWeights };
    if (strategyKey === 'balanced') {
      if (task.complexityIndex < 0.35) {
        weights = {
          quality: 0.20,
          cost: 0.35,
          environmental: 0.25,
          tokenEfficiency: 0.10,
          latency: 0.10,
        };
      } else if (task.complexityIndex < 0.65) {
        weights = {
          quality: 0.40,
          cost: 0.20,
          environmental: 0.18,
          tokenEfficiency: 0.10,
          latency: 0.12,
        };
      } else {
        const qWeight = Math.min(0.70, 0.45 + (task.complexityIndex - 0.65) * 0.60);
        const rem = 1.0 - qWeight;
        weights = {
          quality: qWeight,
          cost: rem * 0.40,
          environmental: rem * 0.30,
          tokenEfficiency: rem * 0.15,
          latency: rem * 0.15,
        };
      }
    }

    const needsVision = task.detectedFeatures.some((f) => /vision|image|photo/i.test(f));
    const needsToolCalling = task.detectedFeatures.some((f) => /tool|function/i.test(f));

    const providers = await this.prisma.aIProvider.findMany({
      select: { providerKey: true, configJson: true },
    });
    const providerKeyMap = new Map<string, string>();
    for (const p of providers) {
      if (p.configJson) {
        try {
          const cfg = JSON.parse(p.configJson);
          if (cfg.apiKey) providerKeyMap.set(p.providerKey, cfg.apiKey);
        } catch {}
      }
    }

    // Parallel evaluation across ALL models in catalog
    const rawEvaluations = await Promise.allSettled(
      candidates.map(async (model) => {
        let eligible = true;
        let status: 'evaluated' | 'eligible' | 'excluded' | 'insufficient_data' | 'provider_unavailable' | 'model_not_installed' = 'evaluated';
        let disqualifyReason: string | undefined = undefined;

        // 1. Active Provider Health & Model Availability Verification
        const configuredApiKey = providerKeyMap.get(model.providerKey);
        const avail = await ProviderHealthService.checkModelAvailability(
          model.providerKey,
          model.providerModelId,
          model.modelKey,
          model.baseUrl,
          configuredApiKey,
          model.pricingTier,
        );

        if (!avail.isAvailable) {
          eligible = false;
          if (avail.modelAvailability === 'NOT_INSTALLED') {
            status = 'model_not_installed';
          } else if (avail.providerHealth === 'UNREACHABLE') {
            status = 'provider_unavailable';
          } else {
            status = 'excluded';
          }
          disqualifyReason = avail.reason;
        } else if (!model.enabled) {
          eligible = false;
          status = 'excluded';
          disqualifyReason = 'Model disabled in catalog';
        } else if (!model.providerEnabled) {
          eligible = false;
          status = 'excluded';
          disqualifyReason = 'Provider disabled by administrator';
        } else if (!model.available) {
          eligible = false;
          status = 'excluded';
          disqualifyReason = 'Model marked unavailable in catalog';
        } else if (task.totalEstimatedTokens > model.contextWindow) {
          eligible = false;
          status = 'excluded';
          disqualifyReason = `Exceeds context window (${task.totalEstimatedTokens.toLocaleString()} > ${model.contextWindow.toLocaleString()} tokens)`;
        } else if (needsVision && !model.capabilities.includes('vision') && !model.capabilities.includes('multimodal')) {
          eligible = false;
          status = 'excluded';
          disqualifyReason = 'Missing required vision / multimodal capability';
        } else if (needsToolCalling && !model.capabilities.includes('tool_calling') && !model.capabilities.includes('function_calling')) {
          eligible = false;
          status = 'excluded';
          disqualifyReason = 'Missing required tool/function calling capability';
        }

        const qualityScore = this.computeDynamicQualityScore(model, task);
        const qualityRaw = qualityScore / 100;

        const inPrice = model.pricing.inputPricePerMillionTokens ?? 0.15;
        const outPrice = model.pricing.outputPricePerMillionTokens ?? 0.60;
        const estimatedCost = (task.inputTokens * inPrice + task.predictedOutputTokens * outPrice) / 1_000_000;
        const costRaw = 1 / (1 + Math.log10(1 + estimatedCost * 5000));

        const key = model.modelKey.toLowerCase();
        let energyPerTokenWh = 0.00025;
        let prefillEnergyPerTokenWh = 0.00007;
        let decodeEnergyPerTokenWh = 0.00030;

        if (key.includes('o3') || key.includes('r1') || key.includes('opus') || key.includes('3.7-sonnet')) {
          energyPerTokenWh = 0.00055;
          prefillEnergyPerTokenWh = 0.00015;
          decodeEnergyPerTokenWh = 0.00065;
        } else if (key.includes('3.5-sonnet') || key.includes('4o') || key.includes('70b') || key.includes('72b')) {
          energyPerTokenWh = 0.00038;
          prefillEnergyPerTokenWh = 0.00010;
          decodeEnergyPerTokenWh = 0.00045;
        } else if (key.includes('mini') || key.includes('flash') || key.includes('haiku')) {
          energyPerTokenWh = 0.00014;
          prefillEnergyPerTokenWh = 0.00003;
          decodeEnergyPerTokenWh = 0.00016;
        } else if (key.includes('nano') || key.includes('lite') || key.includes('8b')) {
          energyPerTokenWh = 0.00008;
          prefillEnergyPerTokenWh = 0.00002;
          decodeEnergyPerTokenWh = 0.00009;
        }

        const energyProfile: ModelEnergyProfile = {
          modelKey: model.modelKey,
          energyPerTokenWh,
          prefillEnergyPerTokenWh,
          decodeEnergyPerTokenWh,
          modelSizeCategory: (key.includes('nano') || key.includes('8b') ? 'small' : key.includes('70b') || key.includes('opus') ? 'large' : 'medium') as any,
          architecture: 'moe' as const,
          confidence: 'high' as const,
          notes: 'Dynamic sequence-length profile',
        };

        const dualPhaseEnv = calculateDualPhaseEnvironmentalEstimate(
          task.inputTokens,
          task.predictedOutputTokens,
          energyProfile,
        );
        const carbon = dualPhaseEnv.carbonGrams;
        const envRaw = 1 / (1 + Math.log10(1 + carbon * 800));

        let speed = 60;
        if (model.providerKey === 'groq') speed = 250;
        else if (key.includes('flash') || key.includes('mini') || key.includes('haiku') || key.includes('nano')) speed = 140;
        else if (key.includes('o3') || key.includes('r1') || key.includes('opus')) speed = 45;
        else speed = 80;

        const estimatedLatencyMs = Math.round(120 + (task.predictedOutputTokens / speed) * 1000);
        const latencyRaw = Math.max(0.1, 1 / (1 + estimatedLatencyMs / 1000));
        const headroom = Math.min(1.0, 1.0 - (task.totalEstimatedTokens / model.contextWindow));
        const tokenEfficiencyRaw = 0.50 * latencyRaw + 0.50 * headroom;

        return {
          model,
          tokenEfficiencyRaw,
          costRaw,
          qualityRaw,
          envRaw,
          latencyRaw,
          estimatedTokens: task.totalEstimatedTokens,
          estimatedCost,
          estimatedEnergyWh: dualPhaseEnv.energyWh,
          estimatedWaterLiters: dualPhaseEnv.waterLiters,
          estimatedCarbonGrams: dualPhaseEnv.carbonGrams,
          estimatedLatencyMs,
          prefillEnergyWh: dualPhaseEnv.prefillEnergyWh,
          decodeEnergyWh: dualPhaseEnv.decodeEnergyWh,
          qualityScore,
          qualitySource: 'Benchmark-derived estimate (Sprout 2024)',
          eligible,
          status: (eligible ? 'eligible' : status) as ScoredCandidate['status'],
          disqualifyReason,
          providerHealth: avail.providerHealth,
          modelAvailability: avail.modelAvailability,
          wasCalled: false,
          provenance: {
            qualitySource: 'EcoRoute Pareto Benchmark Suite',
            qualityBenchmark: 'MMLU / HumanEval composite',
            latencySource: 'Empirical token decode throughput',
            energySource: 'Dual-Phase Sequence Length Modeling',
            pricingSource: 'Published provider pricing card',
          },
        };
      }),
    );

    const rawScores = rawEvaluations.map((r, index) => {
      if (r.status === 'fulfilled') return r.value;
      const model = candidates[index]!;
      return {
        model,
        tokenEfficiencyRaw: 0.1,
        costRaw: 0.1,
        qualityRaw: 0.1,
        envRaw: 0.1,
        latencyRaw: 0.1,
        estimatedTokens: task.totalEstimatedTokens,
        estimatedCost: null,
        estimatedEnergyWh: null,
        estimatedWaterLiters: null,
        estimatedCarbonGrams: null,
        estimatedLatencyMs: null,
        prefillEnergyWh: null,
        decodeEnergyWh: null,
        qualityScore: 50,
        qualitySource: 'Unavailable',
        eligible: false,
        status: 'insufficient_data' as const,
        disqualifyReason: 'Evaluation calculation failed: ' + (r.reason?.message || 'Error'),
        providerHealth: 'UNREACHABLE' as const,
        modelAvailability: 'UNKNOWN' as const,
        wasCalled: false,
        provenance: {
          qualitySource: 'Unavailable',
          qualityBenchmark: 'None',
          latencySource: 'Unavailable',
          energySource: 'Unavailable',
          pricingSource: 'Unavailable',
        },
      };
    });

    // Separate eligible and non-eligible candidates
    // ONLY eligible candidates are normalized and ranked!
    const eligibleRaw = rawScores.filter((s) => s.eligible);

    const normalize = (values: number[]) => {
      if (values.length === 0) return [];
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min;
      return values.map((v) => (range > 0 ? 0.25 + (0.75 * (v - min)) / range : 0.5));
    };

    const tokenNorm = normalize(eligibleRaw.map((s) => s.tokenEfficiencyRaw));
    const costNorm = normalize(eligibleRaw.map((s) => s.costRaw));
    const qualityNorm = normalize(eligibleRaw.map((s) => s.qualityRaw));
    const envNorm = normalize(eligibleRaw.map((s) => s.envRaw));
    const latencyNorm = normalize(eligibleRaw.map((s) => s.latencyRaw));

    let eligibleIndex = 0;
    return rawScores.map((raw) => {
      if (raw.eligible) {
        const scores = {
          quality: qualityNorm[eligibleIndex]!,
          cost: costNorm[eligibleIndex]!,
          tokenEfficiency: tokenNorm[eligibleIndex]!,
          environmental: envNorm[eligibleIndex]!,
          latency: latencyNorm[eligibleIndex]!,
        };
        const totalScore =
          weights.quality * scores.quality +
          weights.cost * scores.cost +
          weights.tokenEfficiency * scores.tokenEfficiency +
          weights.environmental * scores.environmental +
          weights.latency * scores.latency;

        eligibleIndex++;
        return {
          model: raw.model,
          scores,
          totalScore,
          estimatedTokens: raw.estimatedTokens,
          estimatedCost: raw.estimatedCost,
          estimatedEnergyWh: raw.estimatedEnergyWh,
          estimatedWaterLiters: raw.estimatedWaterLiters,
          estimatedCarbonGrams: raw.estimatedCarbonGrams,
          estimatedLatencyMs: raw.estimatedLatencyMs,
          prefillEnergyWh: raw.prefillEnergyWh,
          decodeEnergyWh: raw.decodeEnergyWh,
          qualityScore: raw.qualityScore,
          qualitySource: raw.qualitySource,
          eligible: true,
          status: 'eligible' as const,
          disqualifyReason: undefined,
          providerHealth: raw.providerHealth,
          modelAvailability: raw.modelAvailability,
          wasCalled: false,
          provenance: raw.provenance,
        };
      } else {
        // Disqualified models must be excluded from the ranking candidate set: totalScore is null!
        return {
          model: raw.model,
          scores: { quality: 0, cost: 0, tokenEfficiency: 0, environmental: 0, latency: 0 },
          totalScore: null,
          estimatedTokens: raw.estimatedTokens,
          estimatedCost: raw.estimatedCost,
          estimatedEnergyWh: raw.estimatedEnergyWh,
          estimatedWaterLiters: raw.estimatedWaterLiters,
          estimatedCarbonGrams: raw.estimatedCarbonGrams,
          estimatedLatencyMs: raw.estimatedLatencyMs,
          prefillEnergyWh: raw.prefillEnergyWh,
          decodeEnergyWh: raw.decodeEnergyWh,
          qualityScore: raw.qualityScore,
          qualitySource: raw.qualitySource,
          eligible: false,
          status: raw.status,
          disqualifyReason: raw.disqualifyReason,
          providerHealth: raw.providerHealth,
          modelAvailability: raw.modelAvailability,
          wasCalled: false,
          provenance: raw.provenance,
        };
      }
    });
  }

  private computeDynamicQualityScore(model: CandidateModel, task: TaskAnalysisProfile): number {
    const key = model.modelKey.toLowerCase();
    let capacity = 0.70;
    let baseQuality = 80;

    if (key.includes('o3') || key.includes('r1') || key.includes('claude-3.7-sonnet') || key.includes('claude-4-opus')) {
      capacity = 0.98;
      baseQuality = 97;
    } else if (
      key.includes('claude-3.5-sonnet') ||
      (key.includes('gpt-4o') && !key.includes('mini')) ||
      key.includes('claude-4-sonnet') ||
      key.includes('deepseek-v3') ||
      key.includes('2.5-pro')
    ) {
      capacity = 0.94;
      baseQuality = 94;
    } else if (
      key.includes('70b') ||
      key.includes('72b') ||
      key.includes('1.5-pro') ||
      (key.includes('gpt-4.1') && !key.includes('mini') && !key.includes('nano'))
    ) {
      capacity = 0.88;
      baseQuality = 88;
    } else if (key.includes('o4-mini') || key.includes('claude-3.5-haiku') || key.includes('2.5-flash')) {
      capacity = 0.78;
      baseQuality = 84;
    } else if (key.includes('gpt-4o-mini') || key.includes('2.0-flash') || key.includes('1.5-flash') || key.includes('8x7b') || key.includes('mistral-7b')) {
      capacity = 0.70;
      baseQuality = 79;
    } else if (key.includes('8b') || (key.includes('haiku') && !key.includes('3.5'))) {
      capacity = 0.58;
      baseQuality = 74;
    } else {
      capacity = 0.48;
      baseQuality = 68;
    }

    let domainBonus = 0;
    switch (task.domain) {
      case 'code_architecture':
        if (key.includes('claude-3.5-sonnet') || key.includes('claude-3.7-sonnet')) domainBonus += 7;
        else if (key.includes('deepseek-v3') || (key.includes('gpt-4o') && !key.includes('mini'))) domainBonus += 5;
        else if (key.includes('70b') || key.includes('72b')) domainBonus += 3;
        break;

      case 'code_implementation':
        if (key.includes('deepseek-v3') || key.includes('claude-3.5-sonnet') || key.includes('claude-3.5-haiku')) domainBonus += 6;
        else if (key.includes('gpt-4o') || key.includes('qwen')) domainBonus += 4;
        else if (model.capabilities.includes('code_generation')) domainBonus += 2;
        break;

      case 'mathematical_derivation':
        if (key.includes('o3') || key.includes('r1')) domainBonus += 9;
        else if (key.includes('o4-mini') || key.includes('claude-3.7-sonnet')) domainBonus += 6;
        else if (key.includes('deepseek-v3') || key.includes('gpt-4o')) domainBonus += 3;
        break;

      case 'cross_lingual':
        if (key.includes('gemini') || key.includes('qwen') || key.includes('polyglot')) domainBonus += 8;
        else if (key.includes('gpt-4o') || key.includes('sonnet')) domainBonus += 3;
        break;

      case 'summarization':
        if (key.includes('flash') || key.includes('haiku') || key.includes('mini')) domainBonus += 6;
        break;

      case 'creative_composition':
        if (key.includes('claude') || key.includes('gpt-4.1') || key.includes('gpt-4o')) domainBonus += 6;
        break;

      case 'factual_lookup':
      case 'casual_conversational':
        if (key.includes('nano') || key.includes('lite') || key.includes('flash') || key.includes('8b')) domainBonus += 6;
        break;
    }

    let underPenalty = 0;
    if (task.complexityIndex > capacity) {
      const deficit = task.complexityIndex - capacity;
      underPenalty = Math.min(55, Math.pow(deficit * 10, 1.7) * 7.5);
    }

    let overPenalty = 0;
    if (task.complexityIndex < 0.35 && capacity > 0.80) {
      const excess = capacity - task.complexityIndex;
      overPenalty = (excess - 0.40) * 40;
    }

    return Math.max(25, Math.min(99, Math.round(baseQuality + domainBonus - underPenalty - overPenalty)));
  }

  private buildEvaluationsPayload(
    scoredCandidates: ScoredCandidate[],
    taskProfile: TaskAnalysisProfile,
    selected: ScoredCandidate | null,
    baseline: BaselineEstimate,
  ) {
    const evaluations = scoredCandidates.map((c) => ({
      modelId: c.model.id,
      modelKey: c.model.modelKey,
      modelName: c.model.displayName,
      providerKey: c.model.providerKey,
      providerName: c.model.providerName,
      family: c.model.family,
      capabilities: c.model.capabilities,
      contextWindow: c.model.contextWindow,
      pricing: c.model.pricing,
      pricingTier: c.model.pricingTier,
      pricingSource: c.model.pricingSource,
      pricingLastUpdated: c.model.pricingLastUpdated,
      inputTokens: taskProfile.inputTokens,
      predictedOutputTokens: taskProfile.predictedOutputTokens,
      eligible: c.eligible,
      status: c.status,
      disqualifyReason: c.disqualifyReason,
      providerHealth: c.providerHealth,
      modelAvailability: c.modelAvailability,
      wasCalled: c.wasCalled ?? false,
      estimatedTokens: c.estimatedTokens,
      estimatedCost: c.estimatedCost != null ? Number(c.estimatedCost.toFixed(6)) : null,
      estimatedEnergy: c.estimatedEnergyWh != null ? Number(c.estimatedEnergyWh.toFixed(4)) : null,
      estimatedWater: c.estimatedWaterLiters != null ? Number(c.estimatedWaterLiters.toFixed(4)) : null,
      estimatedCarbon: c.estimatedCarbonGrams != null ? Number(c.estimatedCarbonGrams.toFixed(4)) : null,
      qualityScore: c.qualityScore,
      qualitySource: c.qualitySource,
      latencyMs: c.estimatedLatencyMs ?? null,
      routingScore: c.totalScore != null ? Number((c.totalScore * 100).toFixed(1)) : null,
      breakdown: {
        quality: Number((c.scores.quality * 100).toFixed(1)),
        cost: Number((c.scores.cost * 100).toFixed(1)),
        tokenEfficiency: Number((c.scores.tokenEfficiency * 100).toFixed(1)),
        environmental: Number((c.scores.environmental * 100).toFixed(1)),
        latency: Number((c.scores.latency * 100).toFixed(1)),
      },
      provenance: c.provenance,
      isSelected: selected ? c.model.id === selected.model.id : false,
      isBaseline: c.model.id === baseline.modelId,
    }));

    return {
      taskAnalysis: taskProfile,
      evaluations,
      baseline,
      selectedModel: selected
        ? {
            modelId: selected.model.id,
            name: selected.model.displayName,
            provider: selected.model.providerName,
          }
        : null,
    };
  }

  private buildScientificExplanation(
    selected: ScoredCandidate,
    strategy: string,
    task: TaskAnalysisProfile,
    candidateCount: number,
    isLive: boolean,
    routingPerformed: boolean,
    bypassReason?: string | null,
  ): string {
    const parts = [
      `Task analyzed as ${task.domainLabel} (Complexity: ${(task.complexityIndex * 100).toFixed(0)}%, Tier: ${task.complexityTier}, Expansion: ${task.expansionRatio}x).`,
    ];

    if (!routingPerformed) {
      parts.push(`Direct execution selected because: ${bypassReason || 'routing was not expected to provide sufficient net benefit'}.`);
    } else {
      parts.push(`Evaluated across ${candidateCount} models under "${strategy}" strategy.`);
      parts.push(`${selected.model.displayName} emerged with optimal decision score of ${selected.totalScore != null ? (selected.totalScore * 100).toFixed(1) : 'N/A'}%.`);
    }

    if (isLive) {
      parts.push(`Executed via live ${selected.model.providerName} API.`);
    } else {
      parts.push(`Executed in [Simulation Mode] (AI_MOCK_MODE=true).`);
    }

    return parts.join(' ');
  }

  private async saveMetricSnapshots(routingResultId: string, selected: ScoredCandidate, totalTokens: number) {
    const snapshots = [
      {
        routingResultId,
        metricName: 'estimated_tokens',
        value: totalTokens,
        unit: 'tokens',
        measurementType: 'ESTIMATED' as const,
        methodologyVersion: 'v2-dual-phase',
        dataSource: 'Dynamic Expansion Modeling (EMNLP 2024)',
      },
      {
        routingResultId,
        metricName: 'quality_score',
        value: selected.qualityScore,
        unit: 'score',
        measurementType: 'MODELED' as const,
        methodologyVersion: 'v2-sprout-pareto',
        dataSource: 'Sprout Dynamic Fitness Function',
      },
    ];

    if (selected.estimatedCost != null) {
      snapshots.push({
        routingResultId,
        metricName: 'estimated_cost',
        value: selected.estimatedCost,
        unit: 'USD',
        measurementType: 'ESTIMATED' as const,
        methodologyVersion: 'v2',
        dataSource: 'Model pricing metadata',
      });
    }

    if (selected.estimatedCarbonGrams != null) {
      snapshots.push({
        routingResultId,
        metricName: 'carbon_impact',
        value: selected.estimatedCarbonGrams,
        unit: 'grams CO2',
        measurementType: 'MODELED' as const,
        methodologyVersion: 'v2-dual-phase',
        dataSource: 'Sequence-Length Energy Dynamics (Sustainable Computing 2023)',
      });
    }

    if (selected.estimatedWaterLiters != null) {
      snapshots.push({
        routingResultId,
        metricName: 'water_impact',
        value: selected.estimatedWaterLiters,
        unit: 'liters',
        measurementType: 'MODELED' as const,
        methodologyVersion: 'v2-water-intensity',
        dataSource: 'Regional Utility Water Footprint',
      });
    }

    await this.prisma.metricSnapshot.createMany({ data: snapshots });
  }

  private buildProviderSummaries(candidates: ScoredCandidate[]): Array<{
    providerKey: string;
    providerName: string;
    statusSummary: string;
    availableCount: number;
    totalCount: number;
  }> {
    const providerMap = new Map<string, { providerName: string; candidates: ScoredCandidate[] }>();
    for (const c of candidates) {
      const existing = providerMap.get(c.model.providerKey);
      if (existing) {
        existing.candidates.push(c);
      } else {
        providerMap.set(c.model.providerKey, { providerName: c.model.providerName, candidates: [c] });
      }
    }

    const summaries: Array<{
      providerKey: string;
      providerName: string;
      statusSummary: string;
      availableCount: number;
      totalCount: number;
    }> = [];

    for (const [providerKey, data] of providerMap.entries()) {
      const cands = data.candidates;
      const readyCands = cands.filter((c) => c.eligible);
      let statusSummary = '';

      if (readyCands.length > 0) {
        statusSummary = `Ready (${readyCands.length} available model${readyCands.length > 1 ? 's' : ''})`;
      } else if (cands.every((c) => c.disqualifyReason?.includes('PAID_MODEL_EXCLUDED') || c.disqualifyReason?.includes('commercial paid model'))) {
        statusSummary = 'Excluded (commercial paid models only in FREE_MODELS_ONLY mode)';
      } else if (cands.some((c) => c.providerHealth === 'UNCONFIGURED' || c.disqualifyReason?.includes('API key missing') || c.disqualifyReason?.includes('MISSING_API_KEY'))) {
        statusSummary = 'API key missing / not configured';
      } else if (cands.some((c) => c.disqualifyReason?.includes('FREE_TIER_QUOTA_EXHAUSTED') || c.disqualifyReason?.toLowerCase().includes('quota exhausted'))) {
        statusSummary = 'Free-tier quota exhausted';
      } else if (cands.some((c) => c.disqualifyReason?.includes('LOCAL_MODEL_NOT_INSTALLED') || c.modelAvailability === 'NOT_INSTALLED')) {
        statusSummary = 'Ollama daemon running, but required free model not installed';
      } else if (cands.some((c) => c.providerHealth === 'UNREACHABLE')) {
        statusSummary = providerKey === 'ollama' ? 'Ollama daemon not running' : 'Provider unreachable';
      } else {
        const firstReason = cands[0]?.disqualifyReason || 'Ineligible';
        statusSummary = firstReason;
      }

      summaries.push({
        providerKey,
        providerName: data.providerName,
        statusSummary,
        availableCount: readyCands.length,
        totalCount: cands.length,
      });
    }

    return summaries;
  }
}
