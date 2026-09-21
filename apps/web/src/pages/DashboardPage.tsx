// ============================================================================
// Dashboard Page — Real Data-Driven AI Router & Live Streaming Interface
// ============================================================================

import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { tasksService } from '../services/tasks';
import { EXAMPLE_PROMPTS, ROUTING_STRATEGY_LABELS } from '@ecoroute/config';
import {
  Send, Loader2, Sparkles, RotateCcw, ChevronDown, Leaf,
  Zap, DollarSign, Brain, AlertTriangle, Info, Compass,
  Square, CheckCircle2, Bug, Award, Droplets, ShieldCheck, Key
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, Cell,
} from 'recharts';

import {
  TaskStatus,
  StreamedResult,
} from './dashboard.types';
import {
  buildRoutingScoreChartData,
  buildCostChartData,
  buildCarbonChartData,
} from './dashboard.utils';

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

            case 'baseline':
              setResult((prev) => (prev ? { ...prev, baseline: data } : null));
              break;

            case 'evaluations':
              setResult((prev) => (prev ? { ...prev, evaluations: data } : null));
              break;

            case 'selectedModel':
              setResult((prev) => (prev ? { ...prev, selectedModel: data } : null));
              break;

            case 'sustainability':
              setResult((prev) => (prev ? { ...prev, sustainability: data } : null));
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
                      baseline: data.baseline || prev.baseline,
                      sustainability: data.sustainability || prev.sustainability,
                      routingPerformed: data.routingPerformed ?? prev.routingPerformed,
                      bypassReason: data.bypassReason || prev.bypassReason,
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
                        providerSummaries: data.providerSummaries || data.details?.providerSummaries,
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
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title mb-2">EcoRoute AI Router</h1>
          <p className="text-body text-eco-text-secondary dark:text-dark-text-secondary">
            Production-quality, data-driven AI model routing with full router overhead accounting and counterfactual baseline comparison.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDebugger(!showDebugger)}
            className={`btn-ghost text-caption flex items-center gap-1.5 px-3 py-1.5 border rounded-lg transition-colors ${
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
        <div className="card animate-fade-in shadow-sm">
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
            {inputText.length} / 10,000 characters · Inexpensive local evaluation across all models → Only winning model executes.
          </div>
        </div>
      )}

      {/* Progress & State Indicator */}
      {isRunning && (
        <div className="card border-brand-300 dark:border-brand-700 bg-brand-50/30 dark:bg-brand-950/20 animate-fade-in">
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
        <div className="card border-red-300 dark:border-red-800 bg-red-50/70 dark:bg-red-900/20 animate-shake">
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
              <h3 className="font-serif text-heading-3 text-red-900 dark:text-red-200 mb-2">
                {result.errorInfo.code === 'NO_AI_PROVIDER_CONFIGURED'
                  ? 'No AI Provider Configured'
                  : result.errorInfo.code === 'NO_ELIGIBLE_FREE_MODEL'
                  ? 'No Free Models Currently Eligible'
                  : 'Execution Failed'}
              </h3>

              {result.errorInfo.providerSummaries && result.errorInfo.providerSummaries.length > 0 ? (
                <div className="my-3 space-y-2">
                  <p className="text-body-sm text-red-800 dark:text-red-300 font-medium">
                    No free models could execute this task. Here is the current status across providers:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    {result.errorInfo.providerSummaries.map((p) => (
                      <div
                        key={p.providerKey}
                        className="p-2.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-white/70 dark:bg-slate-900/60 flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between text-caption font-semibold text-eco-text dark:text-dark-text">
                          <span>{p.providerName}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-mono ${
                              p.availableCount > 0
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                            }`}
                          >
                            {p.availableCount > 0 ? `${p.availableCount} Ready` : 'Unavailable'}
                          </span>
                        </div>
                        <p className="text-caption text-eco-text-secondary dark:text-dark-text-secondary mt-1">
                          {p.statusSummary}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-caption text-eco-text-secondary dark:text-dark-text-secondary pt-1">
                    Check the Routing Debugger below for granular diagnostics on every model in the catalog.
                  </p>
                </div>
              ) : (
                <p className="text-body text-red-800 dark:text-red-300 mb-4 whitespace-pre-line">{result.errorInfo.message}</p>
              )}

              <div className="flex items-center gap-3 mt-4">
                <Link to="/settings" className="btn-primary flex items-center gap-1.5">
                  <Key className="w-4 h-4" /> Configure Providers in Settings
                </Link>
                <button onClick={handleSubmit} className="btn-secondary">
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
        <div className="card border-brand-200 dark:border-brand-800 shadow-sm animate-slide-up">
          <div className="flex items-center justify-between mb-4 border-b border-eco-border dark:border-dark-border pb-3">
            <div className="flex items-center gap-2">
              <span className="badge-success flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Selected: {result?.selectedModel?.displayName ?? 'Selected Model'}
              </span>
              <span className="text-caption text-eco-text-secondary dark:text-dark-text-secondary">
                by {result?.selectedModel?.provider ?? 'Provider'}
              </span>
              {result?.routingPerformed === false && (
                <span className="badge-warning text-caption font-semibold">
                  Direct Baseline Bypass
                </span>
              )}
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

      {/* Net Outcome Card (Zero-Greenwashing & Break-Even Evaluation) */}
      {result?.sustainability && (
        <div className="animate-slide-up">
          <NetOutcomeCard
            outcomeStatus={result.sustainability.outcomeStatus}
            outcomeMessage={result.sustainability.outcomeMessage}
            routingPerformed={result.routingPerformed ?? true}
            bypassReason={result.bypassReason}
            netCarbonGrams={result.sustainability.netSavings.carbonGramsCo2e}
            netCarbonPct={result.sustainability.netSavings.carbonPercent}
            netCostUsd={result.sustainability.netSavings.costUsd}
            netCostPct={result.sustainability.netSavings.costPercent}
          />
        </div>
      )}

      {/* 4-Column Sustainability Accounting Table */}
      {result?.sustainability && (
        <div className="card shadow-sm animate-slide-up">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-eco-border dark:border-dark-border pb-3">
            <div>
              <h3 className="font-serif text-heading-3 text-eco-text dark:text-dark-text flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                Comprehensive Sustainability Accounting
              </h3>
              <p className="text-caption text-eco-text-secondary dark:text-dark-text-secondary">
                Auditable four-column balance sheet accounting for router overhead against the counterfactual baseline.
              </p>
            </div>
            <span className="text-caption text-eco-text-secondary dark:text-dark-text-secondary bg-eco-surface-alt dark:bg-dark-surface-alt px-2.5 py-1 rounded border border-eco-border dark:border-dark-border">
              Baseline: {result.baseline?.displayName || 'Direct Baseline'} (Counterfactual)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm border-collapse">
              <thead>
                <tr className="border-b border-eco-border dark:border-dark-border text-caption font-semibold uppercase text-eco-text-secondary dark:text-dark-text-secondary bg-eco-surface-alt dark:bg-dark-surface-alt">
                  <th className="py-3 px-4">Resource / Dimension</th>
                  <th className="py-3 px-4">Direct Baseline</th>
                  <th className="py-3 px-4">Routing Overhead</th>
                  <th className="py-3 px-4">EcoRoute Total</th>
                  <th className="py-3 px-4 text-right">Net Impact (Savings)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-eco-border dark:divide-dark-border font-mono text-caption">
                {/* Cost Row */}
                <tr className="hover:bg-eco-surface dark:hover:bg-dark-surface-2">
                  <td className="py-3 px-4 font-sans font-medium text-eco-text dark:text-dark-text flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-brand-600" /> Cost ($ USD)
                  </td>
                  <td className="py-3 px-4">
                    ${result.sustainability.baseline.costUsd != null ? result.sustainability.baseline.costUsd.toFixed(6) : '—'}
                  </td>
                  <td className="py-3 px-4">
                    ${result.sustainability.router.costUsd != null ? result.sustainability.router.costUsd.toFixed(6) : '0.000000'}
                    <span className="text-[10px] text-eco-text-secondary block font-sans">CPU energy cost</span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-eco-text dark:text-dark-text">
                    ${result.sustainability.ecoRouteTotal.costUsd != null ? result.sustainability.ecoRouteTotal.costUsd.toFixed(6) : '—'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {(() => {
                      const saved = result.sustainability.netSavings.costUsd;
                      const pct = result.sustainability.netSavings.costPercent;
                      if (saved == null) return <span className="font-sans text-eco-text-secondary italic">Unavailable</span>;
                      const isFavorable = saved >= 0;
                      return (
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          isFavorable
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}>
                          {isFavorable ? '▼ ' : '▲ +'}
                          {Math.abs(pct ?? 0).toFixed(1)}% (${Math.abs(saved).toFixed(6)})
                        </span>
                      );
                    })()}
                  </td>
                </tr>

                {/* Energy Row */}
                <tr className="hover:bg-eco-surface dark:hover:bg-dark-surface-2">
                  <td className="py-3 px-4 font-sans font-medium text-eco-text dark:text-dark-text flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-600" /> Energy (Wh)
                  </td>
                  <td className="py-3 px-4">
                    {result.sustainability.baseline.energyWh != null ? `${result.sustainability.baseline.energyWh.toFixed(4)} Wh` : '—'}
                  </td>
                  <td className="py-3 px-4">
                    {result.sustainability.router.energyWh != null ? `${result.sustainability.router.energyWh.toFixed(4)} Wh` : '—'}
                    <span className="text-[10px] text-eco-text-secondary block font-sans">{(result.sustainability.router.latencyMs ?? 0).toFixed(0)}ms wall-clock</span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-eco-text dark:text-dark-text">
                    {result.sustainability.ecoRouteTotal.energyWh != null ? `${result.sustainability.ecoRouteTotal.energyWh.toFixed(4)} Wh` : '—'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {(() => {
                      const saved = result.sustainability.netSavings.energyWh;
                      const pct = result.sustainability.netSavings.energyPercent;
                      if (saved == null) return <span className="font-sans text-eco-text-secondary italic">Unavailable</span>;
                      const isFavorable = saved >= 0;
                      return (
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          isFavorable
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}>
                          {isFavorable ? '▼ ' : '▲ +'}
                          {Math.abs(pct ?? 0).toFixed(1)}% ({Math.abs(saved).toFixed(4)} Wh)
                        </span>
                      );
                    })()}
                  </td>
                </tr>

                {/* Carbon Row */}
                <tr className="hover:bg-eco-surface dark:hover:bg-dark-surface-2">
                  <td className="py-3 px-4 font-sans font-medium text-eco-text dark:text-dark-text flex items-center gap-1.5">
                    <Leaf className="w-3.5 h-3.5 text-emerald-600" /> Carbon (g CO₂e)
                  </td>
                  <td className="py-3 px-4">
                    {result.sustainability.baseline.carbonGramsCo2e != null ? `${result.sustainability.baseline.carbonGramsCo2e.toFixed(4)} g` : '—'}
                  </td>
                  <td className="py-3 px-4">
                    {result.sustainability.router.carbonGramsCo2e != null ? `${result.sustainability.router.carbonGramsCo2e.toFixed(4)} g` : '—'}
                    <span className="text-[10px] text-eco-text-secondary block font-sans">Local grid mix</span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-eco-text dark:text-dark-text">
                    {result.sustainability.ecoRouteTotal.carbonGramsCo2e != null ? `${result.sustainability.ecoRouteTotal.carbonGramsCo2e.toFixed(4)} g` : '—'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {(() => {
                      const saved = result.sustainability.netSavings.carbonGramsCo2e;
                      const pct = result.sustainability.netSavings.carbonPercent;
                      if (saved == null) return <span className="font-sans text-eco-text-secondary italic">Unavailable</span>;
                      const isFavorable = saved >= 0;
                      return (
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          isFavorable
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}>
                          {isFavorable ? '▼ ' : '▲ +'}
                          {Math.abs(pct ?? 0).toFixed(1)}% ({Math.abs(saved).toFixed(4)} g)
                        </span>
                      );
                    })()}
                  </td>
                </tr>

                {/* Water Row (Strict Null Safety) */}
                <tr className="hover:bg-eco-surface dark:hover:bg-dark-surface-2">
                  <td className="py-3 px-4 font-sans font-medium text-eco-text dark:text-dark-text flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-cyan-600" /> Water Consumption (L)
                  </td>
                  <td className="py-3 px-4">
                    {result.sustainability.baseline.waterLiters != null
                      ? `${result.sustainability.baseline.waterLiters.toFixed(4)} L`
                      : <span className="font-sans text-eco-text-secondary italic">Unavailable</span>}
                  </td>
                  <td className="py-3 px-4">
                    {result.sustainability.router.waterLiters != null
                      ? `${result.sustainability.router.waterLiters.toFixed(4)} L`
                      : <span className="font-sans text-eco-text-secondary italic">Unavailable</span>}
                  </td>
                  <td className="py-3 px-4 font-semibold text-eco-text dark:text-dark-text">
                    {result.sustainability.ecoRouteTotal.waterLiters != null
                      ? `${result.sustainability.ecoRouteTotal.waterLiters.toFixed(4)} L`
                      : <span className="font-sans text-eco-text-secondary italic">Unavailable</span>}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {(() => {
                      const saved = result.sustainability.netSavings.waterLiters;
                      const pct = result.sustainability.netSavings.waterPercent;
                      if (saved == null) return <span className="font-sans text-eco-text-secondary italic text-caption">Unavailable</span>;
                      const isFavorable = saved >= 0;
                      return (
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          isFavorable
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}>
                          {isFavorable ? '▼ ' : '▲ +'}
                          {Math.abs(pct ?? 0).toFixed(1)}% ({Math.abs(saved).toFixed(4)} L)
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-[11px] text-eco-text-secondary dark:text-dark-text-secondary flex flex-col sm:flex-row justify-between gap-2 border-t border-eco-border dark:border-dark-border pt-2">
            <span>* Direct Baseline is a counterfactual estimate without second provider execution. Only one live generation executed.</span>
            <span>** Water intensity data is labeled Unavailable where regional datacenter water consumption benchmarks are uncertified.</span>
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
                      <Award className="w-3.5 h-3.5" /> EcoRoute Selection
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
                  tooltip="Dual-phase prefill/decode sequence-length estimate"
                />
              </div>

              {/* 5-Dimensional Decision-Ranking Breakdown */}
              <div className="p-4 rounded-xl bg-eco-surface dark:bg-dark-bg border border-eco-border dark:border-dark-border">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-serif text-heading-4 text-eco-text dark:text-dark-text">
                    Routing Decision-Ranking Breakdown (Weights Σ = 1.0)
                  </h4>
                  <span className="text-[11px] text-eco-text-secondary dark:text-dark-text-secondary">
                    * Decision ranking metric only; not equivalent to resource savings.
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-caption">
                  <div className="p-2.5 rounded-lg bg-eco-surface-alt dark:bg-dark-surface-alt border border-eco-border dark:border-dark-border">
                    <span className="text-eco-text-secondary dark:text-dark-text-secondary block">Quality</span>
                    <span className="font-mono font-bold text-body-sm text-brand-600 dark:text-brand-400">
                      {result.selectedModel.breakdown.quality} pts
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-eco-surface-alt dark:bg-dark-surface-alt border border-eco-border dark:border-dark-border">
                    <span className="text-eco-text-secondary dark:text-dark-text-secondary block">Cost Eff.</span>
                    <span className="font-mono font-bold text-body-sm text-brand-600 dark:text-brand-400">
                      {result.selectedModel.breakdown.cost} pts
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-eco-surface-alt dark:bg-dark-surface-alt border border-eco-border dark:border-dark-border">
                    <span className="text-eco-text-secondary dark:text-dark-text-secondary block">Token Eff.</span>
                    <span className="font-mono font-bold text-body-sm text-brand-600 dark:text-brand-400">
                      {result.selectedModel.breakdown.tokenEfficiency} pts
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-eco-surface-alt dark:bg-dark-surface-alt border border-eco-border dark:border-dark-border">
                    <span className="text-eco-text-secondary dark:text-dark-text-secondary block">Eco Eff.</span>
                    <span className="font-mono font-bold text-body-sm text-brand-600 dark:text-brand-400">
                      {result.selectedModel.breakdown.environmental} pts
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-eco-surface-alt dark:bg-dark-surface-alt border border-eco-border dark:border-dark-border">
                    <span className="text-eco-text-secondary dark:text-dark-text-secondary block">Latency</span>
                    <span className="font-mono font-bold text-body-sm text-brand-600 dark:text-brand-400">
                      {result.selectedModel.breakdown.latency} pts
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
                  Showing all {result.evaluations.length} models evaluated in Stage 1. Only the selected model executed.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-body-sm border-collapse">
                <thead>
                  <tr className="border-b border-eco-border dark:border-dark-border text-caption font-semibold uppercase text-eco-text-secondary dark:text-dark-text-secondary bg-eco-surface-alt dark:bg-dark-surface-alt">
                    <th className="py-3 px-4">Model</th>
                    <th className="py-3 px-3">Provider</th>
                    <th className="py-3 px-3">Pricing Tier</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Availability</th>
                    <th className="py-3 px-3 text-center">Called?</th>
                    <th className="py-3 px-3">Est. Tokens</th>
                    <th className="py-3 px-3">Est. Cost</th>
                    <th className="py-3 px-3">Est. Carbon</th>
                    <th className="py-3 px-3">Est. Water</th>
                    <th className="py-3 px-3">Quality</th>
                    <th className="py-3 px-3">Latency</th>
                    <th className="py-3 px-4 text-right">Routing Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-eco-border dark:divide-dark-border">
                  {result.evaluations.map((model) => {
                    const isWinner = model.isSelected || model.modelId === result.selectedModel?.modelId;
                    const wasActuallyCalled = model.wasCalled ?? isWinner;
                    return (
                      <tr
                        key={model.modelId}
                        className={`hover:bg-eco-surface dark:hover:bg-dark-surface-2 transition-colors ${
                          isWinner ? 'bg-brand-50/60 dark:bg-brand-950/30 font-medium' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-eco-text dark:text-dark-text">{model.modelName}</span>
                              {isWinner && (
                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-brand-600 text-white flex items-center gap-0.5">
                                  Selected
                                </span>
                              )}
                            </div>
                            {model.family && (
                              <span className="text-[10px] text-eco-text-secondary dark:text-dark-text-secondary">
                                {model.family}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-caption text-eco-text-secondary dark:text-dark-text-secondary">
                          <div className="flex items-center gap-1.5">
                            <span>{model.providerName}</span>
                            {model.providerHealth === 'UNREACHABLE' && (
                              <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="Provider unreachable" />
                            )}
                            {model.providerHealth === 'HEALTHY' && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" title="Provider reachable & verified" />
                            )}
                            {model.providerHealth === 'UNCONFIGURED' && (
                              <span className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0" title="API key not configured" />
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {model.pricingTier === 'free' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              Free Tier
                            </span>
                          ) : model.pricingTier === 'paid' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              Paid API
                            </span>
                          ) : (
                            <span className="text-caption text-eco-text-secondary">Unknown</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {model.eligible ? (
                            <span className="badge-success text-[11px]">Eligible</span>
                          ) : model.disqualifyReason === 'PAID_MODEL_EXCLUDED' ? (
                            <span
                              className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 cursor-help"
                              title="Commercial paid model excluded by Free-Models-Only policy"
                            >
                              Excluded (Paid)
                            </span>
                          ) : model.status === 'model_not_installed' || model.disqualifyReason === 'MODEL_NOT_INSTALLED' ? (
                            <span
                              className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 cursor-help"
                              title={model.disqualifyReason || 'Model not installed/pulled in local provider'}
                            >
                              Not Installed
                            </span>
                          ) : model.status === 'provider_unavailable' || model.disqualifyReason === 'PROVIDER_UNREACHABLE' ? (
                            <span
                              className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-800 cursor-help"
                              title={model.disqualifyReason || 'Provider daemon unreachable or connection refused'}
                            >
                              Unreachable
                            </span>
                          ) : model.disqualifyReason === 'PROVIDER_UNCONFIGURED' ? (
                            <span
                              className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-300 dark:border-gray-700 cursor-help"
                              title="Provider API key not configured"
                            >
                              No Key Set
                            </span>
                          ) : model.status === 'insufficient_data' || model.disqualifyReason === 'INSUFFICIENT_DATA' ? (
                            <span
                              className="px-2 py-0.5 rounded text-[11px] font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 cursor-help"
                              title={model.disqualifyReason || 'Missing required environmental metadata'}
                            >
                              Insufficient Data
                            </span>
                          ) : (
                            <span
                              className="badge-warning text-[11px] cursor-help"
                              title={model.disqualifyReason || 'Ineligible'}
                            >
                              Excluded
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-caption">
                          {model.modelAvailability === 'AVAILABLE' ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-medium">✓ Ready</span>
                          ) : model.modelAvailability === 'NOT_INSTALLED' ? (
                            <span className="text-amber-700 dark:text-amber-400">Missing Tag</span>
                          ) : (
                            <span className="text-eco-text-secondary">{model.modelAvailability || '—'}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-mono">
                          {wasActuallyCalled ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-300">
                              YES (1x)
                            </span>
                          ) : (
                            <span className="text-[11px] text-eco-text-secondary dark:text-dark-text-secondary opacity-60">
                              NO (0x)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-caption">
                          <div>
                            <span>{model.estimatedTokens ? model.estimatedTokens.toLocaleString() : '—'}</span>
                            {model.inputTokens != null && model.predictedOutputTokens != null && (
                              <span className="text-[10px] text-eco-text-secondary dark:text-dark-text-secondary block">
                                {model.inputTokens}in / {model.predictedOutputTokens}out
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-caption">
                          {model.estimatedCost === 0 ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">$0.00 (Free)</span>
                          ) : model.estimatedCost != null ? (
                            `$${model.estimatedCost.toFixed(6)}`
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-caption">
                          {model.estimatedCarbon != null ? `${model.estimatedCarbon.toFixed(4)}g` : '—'}
                        </td>
                        <td className="py-3 px-3 font-mono text-caption">
                          {model.estimatedWater != null ? `${model.estimatedWater.toFixed(4)}L` : <span className="text-eco-text-secondary italic">Unavailable</span>}
                        </td>
                        <td className="py-3 px-3 font-mono text-caption">
                          {model.qualityScore ? `${model.qualityScore}/100` : '—'}
                        </td>
                        <td className="py-3 px-3 font-mono text-caption">
                          {model.latencyMs != null ? `${model.latencyMs}ms` : '—'}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-right text-brand-600 dark:text-brand-400">
                          {model.routingScore != null ? (
                            `${model.routingScore}%`
                          ) : (
                            <span
                              className="text-eco-text-secondary dark:text-dark-text-secondary text-caption italic font-normal"
                              title={model.disqualifyReason || 'Not ranked (excluded from candidate set)'}
                            >
                              Not Ranked
                            </span>
                          )}
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
                Routing Score Comparison (Decision Ranking)
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
                  Selected Model Dimension Radar
                </h3>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart
                    data={[
                      { metric: 'Quality', value: result.selectedModel.breakdown.quality },
                      { metric: 'Cost Eff.', value: result.selectedModel.breakdown.cost },
                      { metric: 'Token Eff.', value: result.selectedModel.breakdown.tokenEfficiency },
                      { metric: 'Eco Eff.', value: result.selectedModel.breakdown.environmental },
                      { metric: 'Latency', value: result.selectedModel.breakdown.latency },
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
        <div className="card border-brand-400 dark:border-brand-600 bg-eco-surface dark:bg-dark-surface shadow-xl animate-fade-in">
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

            {/* Candidate Pre-Routing Verification Matrix */}
            {result?.evaluations && result.evaluations.length > 0 && (
              <div>
                <span className="text-eco-text-secondary dark:text-dark-text-secondary block font-bold mb-1">
                  Candidate Health & Routing Eligibility Matrix (Strict Pre-Routing Validation):
                </span>
                <div className="overflow-x-auto border border-eco-border dark:border-dark-border rounded-lg bg-eco-surface-alt dark:bg-dark-bg">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="border-b border-eco-border dark:border-dark-border bg-eco-surface dark:bg-dark-surface-alt text-eco-text-secondary font-semibold">
                        <th className="p-2">Model</th>
                        <th className="p-2">Provider</th>
                        <th className="p-2">Provider Health</th>
                        <th className="p-2">Model Avail.</th>
                        <th className="p-2">Eligible</th>
                        <th className="p-2">Disqualify Reason</th>
                        <th className="p-2 text-right">Score</th>
                        <th className="p-2 text-center">Called</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-eco-border dark:divide-dark-border">
                      {result.evaluations.map((c) => (
                        <tr key={c.modelId} className={c.isSelected ? 'bg-brand-50/50 dark:bg-brand-950/20 font-bold' : ''}>
                          <td className="p-2">{c.modelName}</td>
                          <td className="p-2">{c.providerName}</td>
                          <td className="p-2">
                            <span className={c.providerHealth === 'HEALTHY' ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>
                              {c.providerHealth || 'UNKNOWN'}
                            </span>
                          </td>
                          <td className="p-2">
                            <span className={c.modelAvailability === 'AVAILABLE' ? 'text-emerald-600 font-bold' : 'text-amber-500 font-bold'}>
                              {c.modelAvailability || 'UNKNOWN'}
                            </span>
                          </td>
                          <td className="p-2">{c.eligible ? 'YES' : 'NO'}</td>
                          <td className="p-2 text-eco-text-secondary max-w-xs truncate" title={c.disqualifyReason}>
                            {c.disqualifyReason || '—'}
                          </td>
                          <td className="p-2 text-right">{c.routingScore != null ? `${c.routingScore}%` : 'Not Ranked'}</td>
                          <td className="p-2 text-center">{c.wasCalled || c.isSelected ? 'YES (1x)' : 'NO (0x)'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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
                  Baseline Estimate (Counterfactual):
                </span>
                <pre className="p-3 bg-eco-surface-alt dark:bg-dark-bg rounded border border-eco-border dark:border-dark-border overflow-x-auto">
                  {JSON.stringify(result?.baseline || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <span className="text-eco-text-secondary dark:text-dark-text-secondary block font-bold mb-1">
                  Sustainability Balance Sheet & Break-Even:
                </span>
                <pre className="p-3 bg-eco-surface-alt dark:bg-dark-bg rounded border border-eco-border dark:border-dark-border overflow-x-auto">
                  {JSON.stringify(result?.sustainability || {}, null, 2)}
                </pre>
              </div>
              <div>
                <span className="text-eco-text-secondary dark:text-dark-text-secondary block font-bold mb-1">
                  Selected Model & Actual Execution Usage:
                </span>
                <pre className="p-3 bg-eco-surface-alt dark:bg-dark-bg rounded border border-eco-border dark:border-dark-border overflow-x-auto">
                  {JSON.stringify(
                    {
                      selectedModel: result?.selectedModel,
                      routingPerformed: result?.routingPerformed,
                      bypassReason: result?.bypassReason,
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
// Net Outcome Component (Zero-Greenwashing & Break-Even Evaluation)
// ============================================================================

function NetOutcomeCard({
  outcomeStatus,
  outcomeMessage,
  routingPerformed,
  bypassReason,
  netCarbonGrams,
  netCarbonPct,
  netCostUsd,
  netCostPct,
}: {
  outcomeStatus?: string;
  outcomeMessage?: string;
  routingPerformed: boolean;
  bypassReason?: string;
  netCarbonGrams?: number | null;
  netCarbonPct?: number | null;
  netCostUsd?: number | null;
  netCostPct?: number | null;
}) {
  if (!routingPerformed) {
    return (
      <div className="card border-blue-300 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-900/20 shadow-xs">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-caption font-bold bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                Direct Baseline Bypass
              </span>
            </div>
            <h4 className="font-serif text-heading-4 text-blue-900 dark:text-blue-200 mb-1">
              Routing Overhead Exceeded Anticipated Savings
            </h4>
            <p className="text-body-sm text-blue-800 dark:text-blue-300">
              {bypassReason || 'Routing was safely bypassed to avoid unnecessary computational overhead on this task.'} The query was sent directly to the baseline model without multi-candidate scoring overhead.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (outcomeStatus === 'overhead_exceeded') {
    return (
      <div className="card border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-900/20 shadow-xs">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-caption font-bold bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-100">
                Overhead Exceeded Savings
              </span>
              {netCarbonGrams != null && (
                <span className="text-caption font-mono text-amber-700 dark:text-amber-300">
                  Net Carbon: +{Math.abs(netCarbonGrams).toFixed(4)}g CO₂e
                </span>
              )}
            </div>
            <h4 className="font-serif text-heading-4 text-amber-900 dark:text-amber-200 mb-1">
              Routing Overhead Outweighed Model Efficiency Gains
            </h4>
            <p className="text-body-sm text-amber-800 dark:text-amber-300">
              {outcomeMessage || 'Routing computational overhead exceeded estimated model efficiency gains.'} In accordance with our anti-greenwashing guidelines, negative environmental savings are preserved and reported accurately rather than hidden.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (outcomeStatus === 'net_saving') {
    return (
      <div className="card border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-900/20 shadow-xs">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-caption font-bold bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-100">
                Verified Net Savings
              </span>
              <span className="text-caption font-mono text-emerald-700 dark:text-emerald-300">
                Cost: {netCostPct != null ? `-${Math.abs(netCostPct).toFixed(1)}%` : '—'}{netCostUsd != null ? ` ($${Math.abs(netCostUsd).toFixed(6)})` : ''} · Carbon: {netCarbonPct != null ? `-${Math.abs(netCarbonPct).toFixed(1)}%` : '—'}
              </span>
            </div>
            <h4 className="font-serif text-heading-4 text-emerald-900 dark:text-emerald-200 mb-1">
              Defensible Net Environmental & Economic Benefit
            </h4>
            <p className="text-body-sm text-emerald-800 dark:text-emerald-300">
              {outcomeMessage || 'Net savings achieved across cost and carbon dimensions.'} Net savings account for the wall-clock latency, host CPU energy, and grid carbon required to execute EcoRoute's multi-candidate selection.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (outcomeStatus === 'no_measurable_saving' || outcomeStatus === 'unreliable_estimate') {
    return (
      <div className="card border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/20 shadow-xs">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-slate-600 dark:text-slate-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-caption font-bold bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                {outcomeStatus === 'unreliable_estimate' ? 'Unreliable Estimate' : 'No Measurable Net Saving'}
              </span>
            </div>
            <h4 className="font-serif text-heading-4 text-slate-800 dark:text-slate-200 mb-1">
              Estimated Parity with Direct Baseline
            </h4>
            <p className="text-body-sm text-slate-700 dark:text-slate-300">
              {outcomeMessage || 'Routing performed with negligible variance in environmental impact relative to the direct baseline.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
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
