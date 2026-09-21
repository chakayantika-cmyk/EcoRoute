// ============================================================================
// Settings Page
// ============================================================================

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { preferencesService } from '../services/preferences';
import { useAuth } from '../hooks/useAuth';
import { ROUTING_STRATEGY_LABELS } from '@ecoroute/config';
import { Loader2, Save, RotateCcw, User, Sliders, AlertTriangle, CheckCircle2, Key, ExternalLink, ShieldCheck, Sparkles } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => preferencesService.get(),
  });

  const { data: apiKeysData } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => preferencesService.getApiKeys(),
  });

  const prefs = data?.data as Record<string, unknown> | undefined;
  const apiKeysResponse = apiKeysData?.data;
  const activeKeys = (apiKeysResponse ?? {}) as Record<string, any>;
  const keyDetails = apiKeysResponse?.details ?? {};

  const [tokenWeight, setTokenWeight] = useState(0.15);
  const [costWeight, setCostWeight] = useState(0.20);
  const [qualityWeight, setQualityWeight] = useState(0.30);
  const [envWeight, setEnvWeight] = useState(0.20);
  const [latencyWeight, setLatencyWeight] = useState(0.15);
  const [strategy, setStrategy] = useState('balanced');
  const [saved, setSaved] = useState(false);

  // API Keys state
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [freeModelsOnly, setFreeModelsOnly] = useState(true);
  const [keysSaved, setKeysSaved] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, { loading?: boolean; status?: string; message?: string; freeCount?: number; totalCount?: number }>>({});

  useEffect(() => {
    if (prefs) {
      setTokenWeight(Number(prefs.tokenEfficiencyWeight ?? 0.15));
      setCostWeight(Number(prefs.costWeight ?? 0.20));
      setQualityWeight(Number(prefs.qualityWeight ?? 0.30));
      setEnvWeight(Number(prefs.environmentalWeight ?? 0.20));
      setLatencyWeight(Number(prefs.latencyWeight ?? 0.15));
      setStrategy(String(prefs.defaultStrategy ?? 'balanced'));
    }
  }, [prefs]);

  useEffect(() => {
    if (apiKeysResponse?.freeModelsOnly !== undefined) {
      setFreeModelsOnly(apiKeysResponse.freeModelsOnly);
    }
  }, [apiKeysResponse]);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => preferencesService.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => preferencesService.reset(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['preferences'] }),
  });

  const updateKeysMutation = useMutation({
    mutationFn: (keys: { geminiApiKey?: string; groqApiKey?: string; openaiApiKey?: string; anthropicApiKey?: string; freeModelsOnly?: boolean }) =>
      preferencesService.updateApiKeys(keys),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setKeysSaved(true);
      setGeminiKey('');
      setGroqKey('');
      setOpenaiKey('');
      setAnthropicKey('');
      setTimeout(() => setKeysSaved(false), 2500);
    },
  });

  const handleTestProvider = async (providerKey: string) => {
    setTestResults((prev) => ({ ...prev, [providerKey]: { loading: true } }));
    try {
      const res = await preferencesService.testProvider(providerKey);
      const data = res.data;
      setTestResults((prev) => ({
        ...prev,
        [providerKey]: {
          loading: false,
          status: data.status,
          message: data.errorMessage || (data.status === 'HEALTHY' ? 'Connected successfully' : 'Status: ' + data.status),
          freeCount: data.freeModelsCount,
          totalCount: data.catalogModelsCount,
        },
      }));
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [providerKey]: {
          loading: false,
          status: 'UNREACHABLE',
          message: err.response?.data?.error?.message || err.message || 'Connection test failed',
        },
      }));
    }
  };

  const handleSaveKeys = () => {
    updateKeysMutation.mutate({
      geminiApiKey: geminiKey || undefined,
      groqApiKey: groqKey || undefined,
      openaiApiKey: openaiKey || undefined,
      anthropicApiKey: anthropicKey || undefined,
      freeModelsOnly,
    });
  };

  const totalWeight = tokenWeight + costWeight + qualityWeight + envWeight + latencyWeight;
  const isValid = Math.abs(totalWeight - 1.0) < 0.02;

  const handleSave = () => {
    if (!isValid) return;
    updateMutation.mutate({
      tokenEfficiencyWeight: tokenWeight,
      costWeight,
      qualityWeight,
      environmentalWeight: envWeight,
      latencyWeight,
      defaultStrategy: strategy,
    });
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="page-title mb-2">Settings</h1>
        <p className="text-body text-eco-text-secondary dark:text-dark-text-secondary">
          Customize your routing preferences and profile.
        </p>
      </div>

      {/* Profile */}
      <div className="card mb-6">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-5 h-5 text-eco-text-secondary" />
          <h2 className="font-serif text-heading-3 text-eco-text dark:text-dark-text">Profile</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Display Name</label>
            <input type="text" value={user?.displayName ?? ''} disabled className="input-field opacity-70" />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" value={user?.email ?? ''} disabled className="input-field opacity-70" />
          </div>
          <div>
            <label className="label">Role</label>
            <input type="text" value={user?.role ?? ''} disabled className="input-field opacity-70" />
          </div>
        </div>
      </div>

      {/* Routing Preferences */}
      <div className="card mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Sliders className="w-5 h-5 text-eco-text-secondary" />
          <h2 className="font-serif text-heading-3 text-eco-text dark:text-dark-text">Routing Preferences</h2>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="w-6 h-6 text-brand-600 animate-spin mx-auto" />
          </div>
        ) : (
          <>
            <div className="mb-6">
              <label className="label">Default Strategy</label>
              <select value={strategy} onChange={(e) => setStrategy(e.target.value)} className="input-field cursor-pointer">
                {Object.entries(ROUTING_STRATEGY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-5">
              <WeightSlider label="Quality" value={qualityWeight} onChange={setQualityWeight} />
              <WeightSlider label="Cost" value={costWeight} onChange={setCostWeight} />
              <WeightSlider label="Token Efficiency" value={tokenWeight} onChange={setTokenWeight} />
              <WeightSlider label="Environmental Impact" value={envWeight} onChange={setEnvWeight} />
              <WeightSlider label="Latency Sensitivity" value={latencyWeight} onChange={setLatencyWeight} />
            </div>

            <div className={`mt-4 p-3 rounded-lg border ${isValid ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'}`}>
              <p className={`text-body-sm font-medium ${isValid ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                Total weight: {totalWeight.toFixed(2)} {isValid ? '✓' : `(must equal 1.0)`}
              </p>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button onClick={handleSave} disabled={!isValid || updateMutation.isPending}
                className="btn-primary">
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Preferences
              </button>
              <button onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending}
                className="btn-secondary">
                <RotateCcw className="w-4 h-4" /> Reset to Default
              </button>
              {saved && (
                <span className="flex items-center gap-1.5 text-body-sm text-green-600 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4" /> Saved!
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* AI Provider API Keys (Live Execution) */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <div>
              <h2 className="font-serif text-heading-3 text-eco-text dark:text-dark-text">AI Providers & Keys</h2>
              <p className="text-body-sm text-eco-text-secondary dark:text-dark-text-secondary">
                Connect live provider keys to generate real, authentic AI responses from the routed model.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-caption font-medium bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200 dark:border-brand-800/40 self-start sm:self-auto">
            <Sparkles className="w-3.5 h-3.5" /> Real Provider Execution
          </span>
        </div>

        {/* Free Models Only Policy Toggle */}
        <div className="p-4 mb-6 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-emerald-900 dark:text-emerald-300">
                  Free-Models-Only Policy
                </span>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                  freeModelsOnly 
                    ? 'bg-emerald-600 text-white dark:bg-emerald-500' 
                    : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {freeModelsOnly ? 'ACTIVE (Zero API Fees)' : 'OFF (All Models)'}
                </span>
              </div>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-400/90 leading-relaxed">
                When active, EcoRoute strictly routes requests to verified zero-cost models (Google Gemini Free Tier, Groq Free Tier, and local Ollama). Commercial paid models (OpenAI, Anthropic) are excluded with explicit transparency tags.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
              <input
                type="checkbox"
                checked={freeModelsOnly}
                onChange={(e) => setFreeModelsOnly(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
            </label>
          </div>
        </div>

        <div className="p-3 mb-6 rounded-lg bg-eco-surface-alt dark:bg-dark-surface-alt border border-eco-border dark:border-dark-border text-body-sm text-eco-text-secondary dark:text-dark-text-secondary">
          <p className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-brand-600 mt-0.5 flex-shrink-0" />
            <span>
              API keys are encrypted at rest with AES-256-GCM. Plaintext keys are never logged or exposed to the browser.
            </span>
          </p>
        </div>

        <div className="space-y-6">
          {/* Google Gemini Card */}
          <div className="p-4 rounded-xl border border-eco-border dark:border-dark-border bg-eco-surface dark:bg-dark-surface">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-eco-text dark:text-dark-text">Google Gemini</span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Free Tier (Flash 2.0 / 1.5)
                </span>
                {activeKeys.google_gemini ? (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Active ({keyDetails.google_gemini?.maskedKey || 'configured'})
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">Not Set</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleTestProvider('google_gemini')}
                  disabled={testResults.google_gemini?.loading}
                  className="text-xs px-2.5 py-1 rounded bg-eco-surface-alt hover:bg-eco-border text-eco-text dark:bg-dark-surface-alt dark:hover:bg-dark-border font-medium flex items-center gap-1 transition-colors"
                >
                  {testResults.google_gemini?.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Test Connection
                </button>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-caption text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1 font-medium"
                >
                  Get Free Key <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
            {testResults.google_gemini && (
              <div className={`text-xs px-2.5 py-1.5 rounded mb-2 font-mono ${
                testResults.google_gemini.status === 'HEALTHY'
                  ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
              }`}>
                {testResults.google_gemini.status === 'HEALTHY' ? '✓ ' : '⚠ '}
                {testResults.google_gemini.message}
              </div>
            )}
            <input
              type="password"
              placeholder={activeKeys.google_gemini ? (keyDetails.google_gemini?.maskedKey ? `${keyDetails.google_gemini.maskedKey} (enter new key to replace)` : "•••••••••••••••• (Active - enter new to replace)") : "AIzaSy..."}
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              className="input-field font-mono text-sm"
            />
          </div>

          {/* Groq Card */}
          <div className="p-4 rounded-xl border border-eco-border dark:border-dark-border bg-eco-surface dark:bg-dark-surface">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-eco-text dark:text-dark-text">Groq (Ultra-fast LPU)</span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Free Developer Tier
                </span>
                {activeKeys.groq ? (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Active ({keyDetails.groq?.maskedKey || 'configured'})
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">Not Set</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleTestProvider('groq')}
                  disabled={testResults.groq?.loading}
                  className="text-xs px-2.5 py-1 rounded bg-eco-surface-alt hover:bg-eco-border text-eco-text dark:bg-dark-surface-alt dark:hover:bg-dark-border font-medium flex items-center gap-1 transition-colors"
                >
                  {testResults.groq?.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Test Connection
                </button>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-caption text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1 font-medium"
                >
                  Get Free Key <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
            {testResults.groq && (
              <div className={`text-xs px-2.5 py-1.5 rounded mb-2 font-mono ${
                testResults.groq.status === 'HEALTHY'
                  ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
              }`}>
                {testResults.groq.status === 'HEALTHY' ? '✓ ' : '⚠ '}
                {testResults.groq.message}
              </div>
            )}
            <input
              type="password"
              placeholder={activeKeys.groq ? (keyDetails.groq?.maskedKey ? `${keyDetails.groq.maskedKey} (enter new key to replace)` : "•••••••••••••••• (Active - enter new to replace)") : "gsk_..."}
              value={groqKey}
              onChange={(e) => setGroqKey(e.target.value)}
              className="input-field font-mono text-sm"
            />
          </div>

          {/* Ollama Local Card */}
          <div className="p-4 rounded-xl border border-eco-border dark:border-dark-border bg-eco-surface dark:bg-dark-surface">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-eco-text dark:text-dark-text">Ollama (Local Engine)</span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300">
                  Local Open-Weight (Free & Zero Cloud Carbon)
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleTestProvider('ollama')}
                disabled={testResults.ollama?.loading}
                className="text-xs px-2.5 py-1 rounded bg-eco-surface-alt hover:bg-eco-border text-eco-text dark:bg-dark-surface-alt dark:hover:bg-dark-border font-medium flex items-center gap-1 transition-colors self-start sm:self-auto"
              >
                {testResults.ollama?.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Check Local Daemon
              </button>
            </div>
            {testResults.ollama ? (
              <div className={`text-xs px-2.5 py-1.5 rounded mb-2 font-mono ${
                testResults.ollama.status === 'HEALTHY'
                  ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
              }`}>
                {testResults.ollama.status === 'HEALTHY' ? '✓ ' : '⚠ '}
                {testResults.ollama.message}
              </div>
            ) : (
              <p className="text-xs text-eco-text-secondary dark:text-dark-text-secondary">
                Connects to Ollama running locally at <code className="font-mono bg-eco-surface-alt px-1 py-0.5 rounded">http://localhost:11434</code>. No API key needed. Runs locally on your GPU/CPU with 0 cloud emissions.
              </p>
            )}
          </div>

          {/* OpenAI Card */}
          <div className="p-4 rounded-xl border border-eco-border dark:border-dark-border bg-eco-surface dark:bg-dark-surface opacity-95">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-eco-text dark:text-dark-text">OpenAI</span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  Paid Commercial
                </span>
                {activeKeys.openai ? (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Active ({keyDetails.openai?.maskedKey || 'configured'})
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">Not Set</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleTestProvider('openai')}
                  disabled={testResults.openai?.loading}
                  className="text-xs px-2.5 py-1 rounded bg-eco-surface-alt hover:bg-eco-border text-eco-text dark:bg-dark-surface-alt dark:hover:bg-dark-border font-medium flex items-center gap-1 transition-colors"
                >
                  {testResults.openai?.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Test Connection
                </button>
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-caption text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1 font-medium"
                >
                  OpenAI Console <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
            {freeModelsOnly && (
              <p className="text-xs text-amber-700 dark:text-amber-400/90 mb-2">
                ⓘ Note: Paid OpenAI models (GPT-4o, GPT-4o-mini) are excluded from routing while <strong>Free-Models-Only</strong> is active.
              </p>
            )}
            {testResults.openai && (
              <div className={`text-xs px-2.5 py-1.5 rounded mb-2 font-mono ${
                testResults.openai.status === 'HEALTHY'
                  ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
              }`}>
                {testResults.openai.status === 'HEALTHY' ? '✓ ' : '⚠ '}
                {testResults.openai.message}
              </div>
            )}
            <input
              type="password"
              placeholder={activeKeys.openai ? (keyDetails.openai?.maskedKey ? `${keyDetails.openai.maskedKey} (enter new key to replace)` : "•••••••••••••••• (Active - enter new to replace)") : "sk-..."}
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              className="input-field font-mono text-sm"
            />
          </div>

          {/* Anthropic Card */}
          <div className="p-4 rounded-xl border border-eco-border dark:border-dark-border bg-eco-surface dark:bg-dark-surface opacity-95">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-eco-text dark:text-dark-text">Anthropic</span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  Paid Commercial
                </span>
                {activeKeys.anthropic ? (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Active ({keyDetails.anthropic?.maskedKey || 'configured'})
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">Not Set</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleTestProvider('anthropic')}
                  disabled={testResults.anthropic?.loading}
                  className="text-xs px-2.5 py-1 rounded bg-eco-surface-alt hover:bg-eco-border text-eco-text dark:bg-dark-surface-alt dark:hover:bg-dark-border font-medium flex items-center gap-1 transition-colors"
                >
                  {testResults.anthropic?.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Test Connection
                </button>
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-caption text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1 font-medium"
                >
                  Anthropic Console <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
            {freeModelsOnly && (
              <p className="text-xs text-amber-700 dark:text-amber-400/90 mb-2">
                ⓘ Note: Paid Anthropic models (Claude 3.5 Sonnet, Claude 3 Haiku) are excluded from routing while <strong>Free-Models-Only</strong> is active.
              </p>
            )}
            {testResults.anthropic && (
              <div className={`text-xs px-2.5 py-1.5 rounded mb-2 font-mono ${
                testResults.anthropic.status === 'HEALTHY'
                  ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
              }`}>
                {testResults.anthropic.status === 'HEALTHY' ? '✓ ' : '⚠ '}
                {testResults.anthropic.message}
              </div>
            )}
            <input
              type="password"
              placeholder={activeKeys.anthropic ? (keyDetails.anthropic?.maskedKey ? `${keyDetails.anthropic.maskedKey} (enter new key to replace)` : "•••••••••••••••• (Active - enter new to replace)") : "sk-ant-..."}
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              className="input-field font-mono text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={handleSaveKeys}
            disabled={updateKeysMutation.isPending}
            className="btn-primary"
          >
            {updateKeysMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Provider Configuration
          </button>
          {keysSaved && (
            <span className="flex items-center gap-1.5 text-body-sm text-green-600 animate-fade-in font-medium">
              <CheckCircle2 className="w-4 h-4" /> Configuration saved successfully!
            </span>
          )}
        </div>
      </div>
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-eco-text-secondary" />
          <h2 className="font-serif text-heading-3 text-eco-text dark:text-dark-text">Data & Privacy</h2>
        </div>
        <p className="text-body text-eco-text-secondary dark:text-dark-text-secondary mb-4">
          Your task prompts and generated answers are stored in your account. Environmental impact values
          are modeled estimates. You can delete individual tasks from the History page.
        </p>
        <button className="btn-danger" onClick={() => { /* Account deletion flow */ }}>
          Delete Account
        </button>
      </div>
    </div>
  );
}

function WeightSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-body-sm font-medium text-eco-text dark:text-dark-text">{label}</label>
        <span className="text-body-sm font-mono text-eco-text-secondary">{(value * 100).toFixed(0)}%</span>
      </div>
      <input type="range" min={0} max={100} value={value * 100}
        onChange={(e) => onChange(parseInt(e.target.value) / 100)}
        className="w-full h-2 bg-eco-border dark:bg-dark-border rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
          [&::-webkit-slider-thumb]:bg-brand-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer" />
    </div>
  );
}
