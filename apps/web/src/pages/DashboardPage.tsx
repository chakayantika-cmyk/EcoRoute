// ============================================================================
// Dashboard Page — Real Data-Driven AI Router & Live Streaming Interface
// ============================================================================

import { useState, useRef, useEffect } from 'react';
import { tasksService } from '../services/tasks';
import { EXAMPLE_PROMPTS, ROUTING_STRATEGY_LABELS } from '@ecoroute/config';
import {
  Send, Loader2, Sparkles, RotateCcw, ChevronDown, Leaf,
  Zap, DollarSign, Brain, BarChart3, AlertTriangle, Info, Compass,
  BookOpen, Square, CheckCircle2, ShieldAlert, Bug, Award
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, Cell, ScatterChart,
  Scatter, ZAxis, CartesianGrid,
} from 'recharts';

export type TaskStatus =
  | 'idle'
  | 'analyzing'
  | 'evaluating'
  | 'routing'
  | 'generating'
  | 'completed'
  | 'error';

export interface EvaluatedModel {
  modelId: string;
  modelKey: string;
  modelName: string;
  providerKey: string;
  providerName: string;
  family: string;
  capabilities: string[];
  contextWindow: number;
  eligible: boolean;
  disqualifyReason?: string;
  estimatedTokens: number;
  estimatedCost: number | null;
  estimatedCarbon: number | null;
  qualityScore: number;
  qualitySource?: string;
  latencyMs: number | null;
  routingScore: number;
  breakdown: {
    quality: number;
    cost: number;
    tokenEfficiency: number;
    environmental: number;
  };
  status: 'evaluated' | 'ineligible';
  isSelected?: boolean;
}

export interface TaskAnalysisData {
  domain: string;
  domainLabel: string;
  complexityIndex: number;
  complexityTier: string;
  reasoningDepth: number;
  constraintDensity: number;
  lexicalDiversity: number;
  wordCount: number;
  inputTokens: number;
  predictedOutputTokens: number;
  expansionRatio: number;
  totalEstimatedTokens: number;
  detectedFeatures: string[];
}

export interface StreamedResult {
  taskId: string;
  inputText: string;
  taskAnalysis?: TaskAnalysisData;
  evaluations: EvaluatedModel[];
  selectedModel?: {
    modelId: string;
    modelKey: string;
    displayName: string;
    provider: string;
    routingScore: number;
    breakdown: {
      quality: number;
      cost: number;
      tokenEfficiency: number;
      environmental: number;
    };
    estimatedCost: number | null;
    estimatedCarbon: number | null;
    estimatedTokens: number;
    qualityScore: number;
    estimatedLatencyMs?: number | null;
  };
  streamedAnswer: string;
  explanation?: string;
  actualUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    latencyMs?: number;
    actualCost?: number | null;
  };
  errorInfo?: {
    code: string;
    message: string;
    provider?: string;
  };
}

export default function DashboardPage() {
  const [inputText, setInputText] = useState('');
  const [strategy, setStrategy] = useState('balanced');
  const [showExamples, setShowExamples] = useState(false);
  const [status, setStatus] = useState<TaskStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [result, setResult] = useState<StreamedResult | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [showDebugger, setShowDebugger] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer effect for elapsed generation time
  useEffect(() => {
    if (status === 'analyzing' || status === 'evaluating' || status === 'routing' || status === 'generating') {
      setElapsedSec(0);
      timerRef.current = setInterval(() => {
        setElapsedSec((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus('idle');
    setStatusMessage('Generation stopped by user');
  };

  const handleSubmit = async () => {
    const text = inputText.trim();
    if (!text) return;

    setStatus('analyzing');
    setStatusMessage('Analyzing task characteristics...');
    setResult({
      taskId: '',
      inputText: text,
      evaluations: [],
      streamedAnswer: '',
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await tasksService.stream(
        text,
        strategy,
        (event, data) => {
          switch (event) {
            case 'taskCreated':
              setResult((prev) => (prev ? { ...prev, taskId: data.taskId } : null));
              break;

            case 'state':
              setStatus(data.status as TaskStatus);
              setStatusMessage(data.message || '');
              break;

            case 'taskAnalysis':
              setResult((prev) => (prev ? { ...prev, taskAnalysis: data } : null));
              break;

            case 'evaluations':
              setResult((prev) => (prev ? { ...prev, evaluations: data } : null));
              break;

            case 'selectedModel':
              setResult((prev) => (prev ? { ...prev, selectedModel: data } : null));
              break;

            case 'chunk':
              setResult((prev) =>
                prev ? { ...prev, streamedAnswer: data.fullText || prev.streamedAnswer + data.chunk } : null
              );
              break;

            case 'completed':
              setStatus('completed');
              setStatusMessage('Complete');
              setResult((prev) =>
                prev
                  ? {
                      ...prev,
                      actualUsage: data.actualUsage,
                      explanation: data.explanation,
                    }
                  : null
              );
              break;

            case 'error':
              setStatus('error');
              setStatusMessage(data.message || 'Routing failed');
              setResult((prev) =>
                prev
                  ? {
                      ...prev,
                      errorInfo: {
                        code: data.code || 'ROUTING_ERROR',
                        message: data.message || 'Routing error occurred',
                        provider: data.provider,
                      },
                    }
                  : null
              );
              break;
          }
        },
        controller.signal
      );
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setStatus('idle');
        setStatusMessage('Generation stopped by user');
      } else {
        setStatus('error');
        setStatusMessage(err.message || 'Network error occurred');
        setResult((prev) =>
          prev
            ? {
                ...prev,
                errorInfo: {
                  code: err.code || 'ROUTING_ERROR',
                  message: err.message || 'An error occurred during routing and execution.',
                },
              }
            : null
        );
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleRouteAnother = () => {
    setResult(null);
    setInputText('');
    setStatus('idle');
    setStatusMessage('');
  };

  const isRunning =
    status === 'analyzing' || status === 'evaluating' || status === 'routing' || status === 'generating';

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title mb-2">EcoRoute AI Router</h1>
          <p className="text-body text-eco-text-secondary dark:text-dark-text-secondary">
            Two-stage dynamic AI routing: rapid multi-model Pareto evaluation followed by single-model live execution.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDebugger(!showDebugger)}
            className={`btn-ghost text-caption flex items-center gap-1.5 px-3 py-1.5 border rounded-lg ${
              showDebugger ? 'bg-brand-50 border-brand-300 dark:bg-brand-900/30 dark:border-brand-700' : 'border-eco-border dark:border-dark-border'
            }`}
          >
            <Bug className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            <span>Routing Debugger</span>
          </button>
        </div>
      </div>

      {/* Task Composer */}
      {status === 'idle' && !result?.streamedAnswer && (
        <div className="card mb-8 animate-fade-in shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-heading-3 text-eco-text dark:text-dark-text">Task Composer</h2>
            <button
              onClick={() => setShowExamples(!showExamples)}
              className="btn-ghost text-caption flex items-center gap-1"
            >
              <Sparkles className="w-4 h-4 text-brand-600" /> Examples
              <ChevronDown className={`w-4 h-4 transition-transform ${showExamples ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Example Prompts */}
          {showExamples && (
            <div className="mb-4 grid sm:grid-cols-2 gap-2 animate-slide-down">
              {EXAMPLE_PROMPTS.map((ex) => (
                <button
                  key={ex.label}
                  onClick={() => {
                    setInputText(ex.text);
                    setShowExamples(false);
                  }}
                  className="text-left p-3 rounded-lg border border-eco-border dark:border-dark-border hover:bg-eco-surface dark:hover:bg-dark-surface-2 transition-colors"
                >
                  <span className="text-caption font-medium text-brand-600 block mb-1">{ex.label}</span>
                  <span className="text-caption text-eco-text-secondary dark:text-dark-text-secondary line-clamp-2">
                    {ex.text}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Text Area */}
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Enter your prompt... e.g., 'Explain how a binary search tree works and provide Python code.'"
            className="input-field min-h-[130px] resize-y mb-4"
            rows={4}
            maxLength={10000}
          />

          {/* Strategy Selector + Submit Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1">
              <label htmlFor="strategy-select" className="sr-only">
                Routing Strategy
              </label>
              <select
                id="strategy-select"
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                className="input-field cursor-pointer font-sans"
              >
                {Object.entries(ROUTING_STRATEGY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    Strategy: {label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleSubmit}
              disabled={!inputText.trim() || isRunning}
              className="btn-primary py-3 px-6 rounded-xl flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> Route Task
            </button>
          </div>

          <div className="mt-2 text-caption text-eco-text-secondary dark:text-dark-text-secondary">
            {inputText.length} / 10,000 characters · Inexpensive local evaluation across all models → Only winner executes.
          </div>
        </div>
      )}

      {/* Progress & State Indicator */}
      {isRunning && (
        <div className="card mb-8 border-brand-300 dark:border-brand-700 bg-brand-50/30 dark:bg-brand-950/20 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center flex-shrink-0 animate-pulse">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-caption font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
                    EcoRoute Pipeline · {status.toUpperCase()}
                  </span>
                  <span className="text-caption text-eco-text-secondary dark:text-dark-text-secondary font-mono">
                    {elapsedSec}s elapsed
                  </span>
                </div>
                <h3 className="font-serif text-heading-3 text-eco-text dark:text-dark-text">{statusMessage}</h3>
              </div>
            </div>

            <button
              onClick={handleCancel}
              className="btn-secondary text-red-600 hover:text-red-700 border-red-200 dark:border-red-900 flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Square className="w-3.5 h-3.5 fill-current" /> Stop generating
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {status === 'error' && result?.errorInfo && (
        <div className="card border-red-300 dark:border-red-800 bg-red-50/70 dark:bg-red-900/20 mb-8 animate-shake">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded text-caption font-mono font-bold bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-100">
                  {result.errorInfo.code}
                </span>
                {result.errorInfo.provider && (
                  <span className="text-caption text-red-700 dark:text-red-300 font-medium">
                    Provider: {result.errorInfo.provider}
                  </span>
                )}
              </div>
              <h3 className="font-serif text-heading-3 text-red-900 dark:text-red-200 mb-2">Execution Failed</h3>
              <p className="text-body text-red-800 dark:text-red-300 mb-4">{result.errorInfo.message}</p>
              <div className="flex items-center gap-3">
                <button onClick={handleSubmit} className="btn-primary bg-red-600 hover:bg-red-700 text-white">
                  Retry Execution
                </button>
                <button onClick={handleRouteAnother} className="btn-secondary">
                  Start New Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Streamed Answer Area */}
      {(result?.streamedAnswer || status === 'generating' || status === 'completed') && (
        <div className="card mb-8 border-brand-200 dark:border-brand-800 shadow-sm animate-slide-up">
          <div className="flex items-center justify-between mb-4 border-b border-eco-border dark:border-dark-border pb-3">
            <div className="flex items-center gap-2">
              <span className="badge-success flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Selected: {result?.selectedModel?.displayName ?? 'Selected Model'}
              </span>
              <span className="text-caption text-eco-text-secondary dark:text-dark-text-secondary">
                by {result?.selectedModel?.provider ?? 'Provider'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isRunning && (
                <span className="text-caption text-brand-600 dark:text-brand-400 flex items-center gap-1 font-mono animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-brand-500 animate-ping"></span>
                  Streaming ({elapsedSec}s)...
                </span>
              )}
              {status === 'completed' && (
                <span className="badge-info font-mono text-caption">
                  {result?.actualUsage?.totalTokens ? `${result.actualUsage.totalTokens} tokens` : 'Completed'} ·{' '}
                  {result?.actualUsage?.latencyMs ? `${(result.actualUsage.latencyMs / 1000).toFixed(2)}s` : ''}
                </span>
              )}
            </div>
          </div>

          <div className="prose prose-sm max-w-none text-eco-text dark:text-dark-text">
            <pre className="whitespace-pre-wrap text-body leading-relaxed bg-eco-surface dark:bg-dark-bg p-4 rounded-xl border border-eco-border dark:border-dark-border overflow-auto font-sans">
              {result?.streamedAnswer || (isRunning ? 'Waiting for first token...' : '')}
            </pre>
          </div>
        </div>
      )}

      {/* Post-Routing Analytics: Recommendations, Comparison, Charts */}
      {result && result.evaluations && result.evaluations.length > 0 && (
        <div className="space-y-8 animate-slide-up">
          {/* 1. EcoRoute Recommendation Card */}
          {result.selectedModel && (
            <div className="card border-brand-300 dark:border-brand-700 bg-gradient-to-br from-brand-50/50 via-eco-surface to-eco-surface dark:from-brand-950/30 dark:via-dark-surface dark:to-dark-surface shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-2.5 py-0.5 rounded-full text-caption font-bold bg-brand-600 text-white flex items-center gap-1">
                      <Award className="w-3.5 h-3.5" /> EcoRoute Recommendation
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-caption bg-brand-100 text-brand-800 dark:bg-brand-900/50 dark:text-brand-200">
                      Score: {result.selectedModel.routingScore}%
                    </span>
                  </div>
                  <h2 className="font-serif text-heading-2 text-eco-text dark:text-dark-text">
                    {result.selectedModel.displayName}
                  </h2>
                  <p className="text-body text-eco-text-secondary dark:text-dark-text-secondary">
                    Provided by {result.selectedModel.provider} · Evaluated under "{strategy}" strategy
                  </p>
                </div>

                <button onClick={handleRouteAnother} className="btn-secondary self-start sm:self-auto flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4" /> Route Another Task
                </button>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <MetricCard
                  icon={Zap}
                  label="Tokens"
                  estimated={String(result.selectedModel.estimatedTokens)}
                  actual={result.actualUsage?.totalTokens ? String(result.actualUsage.totalTokens) : null}
                  status={result.actualUsage?.totalTokens ? 'actual' : 'estimated'}
                />
                <MetricCard
                  icon={DollarSign}
                  label="Cost"
                  estimated={
                    result.selectedModel.estimatedCost != null
                      ? `$${result.selectedModel.estimatedCost.toFixed(6)}`
                      : 'Unavailable'
                  }
                  actual={
                    result.actualUsage?.actualCost != null
                      ? `$${result.actualUsage.actualCost.toFixed(6)}`
                      : null
                  }
                  status={result.actualUsage?.actualCost != null ? 'actual' : 'estimated'}
                />
                <MetricCard
                  icon={Brain}
                  label="Quality Estimate"
                  estimated={`${result.selectedModel.qualityScore}/100`}
                  status="benchmark"
                  tooltip="Benchmark-derived estimate (Sprout 2024)"
                />
                <MetricCard
                  icon={Leaf}
                  label="Carbon Estimate"
                  estimated={
                    result.selectedModel.estimatedCarbon != null
                      ? `${result.selectedModel.estimatedCarbon.toFixed(4)}g CO₂`
                      : 'Unavailable'
                  }
                  status="estimated"
                  tooltip="Modeled dual-phase prefill/decode sequence-length estimate"
                />
              </div>

              {/* Why was this model selected? Breakdown */}
              <div className="p-4 rounded-xl bg-eco-surface dark:bg-dark-bg border border-eco-border dark:border-dark-border">
                <h4 className="font-serif text-heading-4 text-eco-text dark:text-dark-text mb-3">
                  Why was this model selected? (Routing Score Breakdown)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-caption">
                  <div className="p-2.5 rounded-lg bg-eco-surface-alt dark:bg-dark-surface-alt border border-eco-border dark:border-dark-border">
                    <span className="text-eco-text-secondary dark:text-dark-text-secondary block">Quality Contribution</span>
                    <span className="font-mono font-bold text-body-sm text-brand-600 dark:text-brand-400">
                      {result.selectedModel.breakdown.quality} pts
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-eco-surface-alt dark:bg-dark-surface-alt border border-eco-border dark:border-dark-border">
                    <span className="text-eco-text-secondary dark:text-dark-text-secondary block">Cost Efficiency</span>
                    <span className="font-mono font-bold text-body-sm text-brand-600 dark:text-brand-400">
                      {result.selectedModel.breakdown.cost} pts
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-eco-surface-alt dark:bg-dark-surface-alt border border-eco-border dark:border-dark-border">
                    <span className="text-eco-text-secondary dark:text-dark-text-secondary block">Token Efficiency</span>
                    <span className="font-mono font-bold text-body-sm text-brand-600 dark:text-brand-400">
                      {result.selectedModel.breakdown.tokenEfficiency} pts
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-eco-surface-alt dark:bg-dark-surface-alt border border-eco-border dark:border-dark-border">
                    <span className="text-eco-text-secondary dark:text-dark-text-secondary block">Eco Efficiency</span>
                    <span className="font-mono font-bold text-body-sm text-brand-600 dark:text-brand-400">
                      {result.selectedModel.breakdown.environmental} pts
                    </span>
                  </div>
                </div>

                {result.explanation && (
                  <p className="mt-3 text-caption text-eco-text-secondary dark:text-dark-text-secondary leading-relaxed border-t border-eco-border dark:border-dark-border pt-3">
                    {result.explanation}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 2. Task Analysis Profile */}
          {result.taskAnalysis && (
            <div className="card border-eco-border dark:border-dark-border bg-eco-surface dark:bg-dark-surface">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-brand-600/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-caption font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                      Task Analysis Profile
                    </span>
                    <h3 className="font-serif text-heading-3 text-eco-text dark:text-dark-text">
                      {result.taskAnalysis.domainLabel}
                    </h3>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-caption font-semibold bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300 self-start sm:self-auto">
                  {result.taskAnalysis.complexityTier} Complexity · {Math.round(result.taskAnalysis.complexityIndex * 100)}% TCI
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="p-3 rounded-lg bg-eco-surface-alt dark:bg-dark-bg border border-eco-border dark:border-dark-border">
                  <p className="text-caption text-eco-text-secondary dark:text-dark-text-secondary mb-1">Reasoning Depth</p>
                  <p className="font-mono text-body-sm font-semibold text-eco-text dark:text-dark-text">
                    {Math.round(result.taskAnalysis.reasoningDepth * 100)}%
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-eco-surface-alt dark:bg-dark-bg border border-eco-border dark:border-dark-border">
                  <p className="text-caption text-eco-text-secondary dark:text-dark-text-secondary mb-1">Token Expansion</p>
                  <p className="font-mono text-body-sm font-semibold text-eco-text dark:text-dark-text">
                    {result.taskAnalysis.expansionRatio}x ({result.taskAnalysis.inputTokens} in → {result.taskAnalysis.predictedOutputTokens} out)
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-eco-surface-alt dark:bg-dark-bg border border-eco-border dark:border-dark-border">
                  <p className="text-caption text-eco-text-secondary dark:text-dark-text-secondary mb-1">Lexical Diversity</p>
                  <p className="font-mono text-body-sm font-semibold text-eco-text dark:text-dark-text">
                    {Math.round(result.taskAnalysis.lexicalDiversity * 100)}% TTR
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-eco-surface-alt dark:bg-dark-bg border border-eco-border dark:border-dark-border">
                  <p className="text-caption text-eco-text-secondary dark:text-dark-text-secondary mb-1">Constraint Density</p>
                  <p className="font-mono text-body-sm font-semibold text-eco-text dark:text-dark-text">
                    {Math.round(result.taskAnalysis.constraintDensity * 100)}%
                  </p>
                </div>
              </div>

              {result.taskAnalysis.detectedFeatures.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-caption text-eco-text-secondary dark:text-dark-text-secondary">Detected Signals:</span>
                  {result.taskAnalysis.detectedFeatures.map((feat, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-0.5 rounded-md text-caption bg-eco-surface dark:bg-dark-surface-alt border border-eco-border dark:border-dark-border text-eco-text dark:text-dark-text"
                    >
                      {feat}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. All Models Comparison Table */}
          <div className="card overflow-hidden shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-serif text-heading-3 text-eco-text dark:text-dark-text">
                  All Models Comparison
                </h3>
                <p className="text-caption text-eco-text-secondary dark:text-dark-text-secondary">
                  Showing all {result.evaluations.length} models evaluated in Stage 1. Only the selected model was executed.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-body-sm border-collapse">
                <thead>
                  <tr className="border-b border-eco-border dark:border-dark-border text-caption font-semibold uppercase text-eco-text-secondary dark:text-dark-text-secondary bg-eco-surface-alt dark:bg-dark-surface-alt">
                    <th className="py-3 px-4">Model</th>
                    <th className="py-3 px-3">Provider</th>
                    <th className="py-3 px-3">Eligibility</th>
                    <th className="py-3 px-3">Est. Tokens</th>
                    <th className="py-3 px-3">Est. Cost</th>
                    <th className="py-3 px-3">Est. Carbon</th>
                    <th className="py-3 px-3">Quality</th>
                    <th className="py-3 px-3">Latency</th>
                    <th className="py-3 px-4 text-right">Routing Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-eco-border dark:divide-dark-border">
                  {result.evaluations.map((model) => {
                    const isWinner = model.isSelected || model.modelId === result.selectedModel?.modelId;
                    return (
                      <tr
                        key={model.modelId}
                        className={`hover:bg-eco-surface dark:hover:bg-dark-surface-2 transition-colors ${
                          isWinner ? 'bg-brand-50/60 dark:bg-brand-950/30 font-medium' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span>{model.modelName}</span>
                            {isWinner && (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-brand-600 text-white flex items-center gap-0.5">
                                Selected by EcoRoute
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-caption text-eco-text-secondary dark:text-dark-text-secondary">
                          {model.providerName}
                        </td>
                        <td className="py-3 px-3">
                          {model.eligible ? (
                            <span className="badge-success text-[11px]">Eligible</span>
                          ) : (
                            <span
                              className="badge-warning text-[11px] cursor-help"
                              title={model.disqualifyReason || 'Ineligible'}
                            >
                              Ineligible
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-caption">
                          {model.estimatedTokens ? model.estimatedTokens.toLocaleString() : '—'}
                        </td>
                        <td className="py-3 px-3 font-mono text-caption">
                          {model.estimatedCost != null ? `$${model.estimatedCost.toFixed(6)}` : '—'}
                        </td>
                        <td className="py-3 px-3 font-mono text-caption">
                          {model.estimatedCarbon != null ? `${model.estimatedCarbon.toFixed(4)}g` : '—'}
                        </td>
                        <td className="py-3 px-3 font-mono text-caption">
                          {model.qualityScore ? `${model.qualityScore}/100` : '—'}
                        </td>
                        <td className="py-3 px-3 font-mono text-caption">
                          {model.latencyMs != null ? `${model.latencyMs}ms` : '—'}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-right text-brand-600 dark:text-brand-400">
                          {model.routingScore}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. Model Efficiency Analytics Charts */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Chart 1: Routing Score Comparison */}
            <div className="card shadow-sm">
              <h3 className="font-serif text-heading-3 text-eco-text dark:text-dark-text mb-4">
                Routing Score Comparison
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={buildRoutingScoreChartData(result.evaluations)} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: any) => [`${value}%`, 'Score']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E5E5E0', fontSize: '13px' }}
                  />
                  <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={18}>
                    {buildRoutingScoreChartData(result.evaluations).map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.isSelected ? '#1B4332' : '#82C482'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 2: Cost Comparison */}
            <div className="card shadow-sm">
              <h3 className="font-serif text-heading-3 text-eco-text dark:text-dark-text mb-4">
                Estimated Cost Comparison ($ USD)
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={buildCostChartData(result.evaluations)} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: any) => [value != null ? `$${value}` : 'Unavailable', 'Est. Cost']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E5E5E0', fontSize: '13px' }}
                  />
                  <Bar dataKey="cost" fill="#2D7A2D" radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 3: Carbon Impact Comparison */}
            <div className="card shadow-sm">
              <h3 className="font-serif text-heading-3 text-eco-text dark:text-dark-text mb-4">
                Estimated Carbon Impact (g CO₂e)
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={buildCarbonChartData(result.evaluations)} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: any) => [value != null ? `${value}g CO₂` : 'Unavailable', 'Carbon Impact']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E5E5E0', fontSize: '13px' }}
                  />
                  <Bar dataKey="carbon" fill="#4EA54E" radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 4: Score Radar of Selected Model */}
            {result.selectedModel && (
              <div className="card shadow-sm">
                <h3 className="font-serif text-heading-3 text-eco-text dark:text-dark-text mb-4">
                  Selected Model Efficiency Radar
                </h3>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart
                    data={[
                      { metric: 'Quality', value: result.selectedModel.breakdown.quality },
                      { metric: 'Cost Eff.', value: result.selectedModel.breakdown.cost },
                      { metric: 'Token Eff.', value: result.selectedModel.breakdown.tokenEfficiency },
                      { metric: 'Eco Eff.', value: result.selectedModel.breakdown.environmental },
                    ]}
                    cx="50%"
                    cy="50%"
                  >
                    <PolarGrid stroke="#E5E5E0" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12, fill: '#6B6B6B' }} />
                    <Radar dataKey="value" stroke="#1B4332" fill="#1B4332" fillOpacity={0.25} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Admin Routing Debugger Modal / Section */}
      {showDebugger && (
        <div className="card mt-8 border-brand-400 dark:border-brand-600 bg-eco-surface dark:bg-dark-surface shadow-xl animate-fade-in">
          <div className="flex items-center justify-between mb-4 border-b border-eco-border dark:border-dark-border pb-3">
            <div className="flex items-center gap-2">
              <Bug className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              <h3 className="font-serif text-heading-3 text-eco-text dark:text-dark-text">Routing Debugger</h3>
            </div>
            <button onClick={() => setShowDebugger(false)} className="btn-ghost text-caption">
              Close
            </button>
          </div>

          <div className="space-y-4 font-mono text-caption">
            <div>
              <span className="text-eco-text-secondary dark:text-dark-text-secondary block font-bold mb-1">
                Original Prompt:
              </span>
              <pre className="p-3 bg-eco-surface-alt dark:bg-dark-bg rounded border border-eco-border dark:border-dark-border overflow-x-auto">
                {result?.inputText || inputText || 'No prompt active'}
              </pre>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <span className="text-eco-text-secondary dark:text-dark-text-secondary block font-bold mb-1">
                  Task Analysis:
                </span>
                <pre className="p-3 bg-eco-surface-alt dark:bg-dark-bg rounded border border-eco-border dark:border-dark-border overflow-x-auto">
                  {JSON.stringify(result?.taskAnalysis || {}, null, 2)}
                </pre>
              </div>
              <div>
                <span className="text-eco-text-secondary dark:text-dark-text-secondary block font-bold mb-1">
                  Selected Model & Actual Usage:
                </span>
                <pre className="p-3 bg-eco-surface-alt dark:bg-dark-bg rounded border border-eco-border dark:border-dark-border overflow-x-auto">
                  {JSON.stringify(
                    {
                      selectedModel: result?.selectedModel,
                      actualUsage: result?.actualUsage,
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Chart Data Builders (Dynamic, Non-Hardcoded, Handling Missing Values)
// ============================================================================

function isFiniteNumber(val: any): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

export function buildRoutingScoreChartData(evaluations: EvaluatedModel[]) {
  return evaluations
    .filter((e) => e.eligible)
    .map((e) => ({
      name: e.modelName.replace(' ', '\n'),
      score: e.routingScore,
      isSelected: e.isSelected,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

export function buildCostChartData(evaluations: EvaluatedModel[]) {
  return evaluations
    .filter((e) => e.eligible && isFiniteNumber(e.estimatedCost))
    .map((e) => ({
      name: e.modelName.replace(' ', '\n'),
      cost: isFiniteNumber(e.estimatedCost) ? Number(e.estimatedCost.toFixed(6)) : null,
    }))
    .sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0))
    .slice(0, 8);
}

export function buildCarbonChartData(evaluations: EvaluatedModel[]) {
  return evaluations
    .filter((e) => e.eligible && isFiniteNumber(e.estimatedCarbon))
    .map((e) => ({
      name: e.modelName.replace(' ', '\n'),
      carbon: isFiniteNumber(e.estimatedCarbon) ? Number(e.estimatedCarbon.toFixed(4)) : null,
    }))
    .sort((a, b) => (a.carbon ?? 0) - (b.carbon ?? 0))
    .slice(0, 8);
}

// ============================================================================
// Metric Card Component
// ============================================================================

function MetricCard({
  icon: Icon,
  label,
  estimated,
  actual,
  status,
  tooltip,
}: {
  icon: typeof Zap;
  label: string;
  estimated: string;
  actual?: string | null;
  status: string;
  tooltip?: string;
}) {
  const badgeClass = `badge-${
    status === 'actual' ? 'success' : status === 'estimated' ? 'warning' : status === 'benchmark' ? 'info' : 'neutral'
  }`;

  return (
    <div className="p-4 rounded-xl bg-eco-surface dark:bg-dark-bg border border-eco-border dark:border-dark-border shadow-xs">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-caption text-eco-text-secondary dark:text-dark-text-secondary">
          <Icon className="w-4 h-4" />
          <span>{label}</span>
        </div>
        {tooltip && (
          <span title={tooltip} className="cursor-help text-eco-text-secondary hover:text-eco-text">
            <Info className="w-3.5 h-3.5" />
          </span>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-heading-3 font-sans font-semibold text-eco-text dark:text-dark-text">
          {actual ? actual : estimated}
        </p>
        {actual && (
          <p className="text-caption text-eco-text-secondary dark:text-dark-text-secondary font-mono">
            Est: {estimated}
          </p>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <span className={badgeClass}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
      </div>
    </div>
  );
}
