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

  const { data: apiKeysData, isLoading: isLoadingKeys } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => preferencesService.getApiKeys(),
  });

  const prefs = data?.data as Record<string, unknown> | undefined;
  const activeKeys = (apiKeysData?.data ?? {}) as Record<string, boolean>;

  const [tokenWeight, setTokenWeight] = useState(0.25);
  const [costWeight, setCostWeight] = useState(0.25);
  const [qualityWeight, setQualityWeight] = useState(0.25);
  const [envWeight, setEnvWeight] = useState(0.25);
  const [strategy, setStrategy] = useState('balanced');
  const [saved, setSaved] = useState(false);

  // API Keys state
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [keysSaved, setKeysSaved] = useState(false);

  useEffect(() => {
    if (prefs) {
      setTokenWeight(Number(prefs.tokenEfficiencyWeight ?? 0.25));
      setCostWeight(Number(prefs.costWeight ?? 0.25));
      setQualityWeight(Number(prefs.qualityWeight ?? 0.25));
      setEnvWeight(Number(prefs.environmentalWeight ?? 0.25));
      setStrategy(String(prefs.defaultStrategy ?? 'balanced'));
    }
  }, [prefs]);

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
    mutationFn: (keys: { geminiApiKey?: string; openaiApiKey?: string; anthropicApiKey?: string }) =>
      preferencesService.updateApiKeys(keys),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setKeysSaved(true);
      setGeminiKey('');
      setOpenaiKey('');
      setAnthropicKey('');
      setTimeout(() => setKeysSaved(false), 2500);
    },
  });

  const handleSaveKeys = () => {
    updateKeysMutation.mutate({
      geminiApiKey: geminiKey || undefined,
      openaiApiKey: openaiKey || undefined,
      anthropicApiKey: anthropicKey || undefined,
    });
  };

  const totalWeight = tokenWeight + costWeight + qualityWeight + envWeight;
  const isValid = Math.abs(totalWeight - 1.0) < 0.02;

  const handleSave = () => {
    if (!isValid) return;
    updateMutation.mutate({
      tokenEfficiencyWeight: tokenWeight,
      costWeight,
      qualityWeight,
      environmentalWeight: envWeight,
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
              <WeightSlider label="Token Efficiency" value={tokenWeight} onChange={setTokenWeight} />
              <WeightSlider label="Cost" value={costWeight} onChange={setCostWeight} />
              <WeightSlider label="Quality" value={qualityWeight} onChange={setQualityWeight} />
              <WeightSlider label="Environmental Impact" value={envWeight} onChange={setEnvWeight} />
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <div>
              <h2 className="font-serif text-heading-3 text-eco-text dark:text-dark-text">AI Provider API Keys</h2>
              <p className="text-body-sm text-eco-text-secondary dark:text-dark-text-secondary">
                Connect live provider keys to generate real, authentic AI responses from the routed model.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-caption font-medium bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200 dark:border-brand-800/40">
            <Sparkles className="w-3.5 h-3.5" /> Live Engine
          </span>
        </div>

        <div className="p-3 mb-5 rounded-lg bg-eco-surface-alt dark:bg-dark-surface-alt border border-eco-border dark:border-dark-border text-body-sm text-eco-text-secondary dark:text-dark-text-secondary">
          <p className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-brand-600 mt-0.5 flex-shrink-0" />
            <span>
              Your keys are encrypted and stored locally in your database or environment. When configured, tasks execute via the actual provider endpoint. If no key is set, EcoRoute seamlessly generates deep contextual simulations.
            </span>
          </p>
        </div>

        <div className="space-y-4">
          {/* Google Gemini */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-body-sm font-medium text-eco-text dark:text-dark-text flex items-center gap-2">
                Google Gemini API Key
                {activeKeys.google_gemini ? (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Active</span>
                ) : (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-eco-surface-alt text-eco-text-secondary dark:bg-dark-surface-alt">Not Set</span>
                )}
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-caption text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1"
              >
                Get Free Gemini Key <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="password"
              placeholder={activeKeys.google_gemini ? "•••••••••••••••• (Key Active - enter new one to update)" : "AIzaSy..."}
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              className="input-field font-mono text-sm"
            />
          </div>

          {/* OpenAI */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-body-sm font-medium text-eco-text dark:text-dark-text flex items-center gap-2">
                OpenAI API Key
                {activeKeys.openai ? (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Active</span>
                ) : (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-eco-surface-alt text-eco-text-secondary dark:bg-dark-surface-alt">Not Set</span>
                )}
              </label>
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="text-caption text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1"
              >
                OpenAI Dashboard <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="password"
              placeholder={activeKeys.openai ? "•••••••••••••••• (Key Active - enter new one to update)" : "sk-..."}
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              className="input-field font-mono text-sm"
            />
          </div>

          {/* Anthropic */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-body-sm font-medium text-eco-text dark:text-dark-text flex items-center gap-2">
                Anthropic API Key
                {activeKeys.anthropic ? (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Active</span>
                ) : (
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-eco-surface-alt text-eco-text-secondary dark:bg-dark-surface-alt">Not Set</span>
                )}
              </label>
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer"
                className="text-caption text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1"
              >
                Anthropic Console <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="password"
              placeholder={activeKeys.anthropic ? "•••••••••••••••• (Key Active - enter new one to update)" : "sk-ant-..."}
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              className="input-field font-mono text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={handleSaveKeys}
            disabled={(!geminiKey && !openaiKey && !anthropicKey) || updateKeysMutation.isPending}
            className="btn-primary"
          >
            {updateKeysMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save API Keys
          </button>
          {keysSaved && (
            <span className="flex items-center gap-1.5 text-body-sm text-green-600 animate-fade-in">
              <CheckCircle2 className="w-4 h-4" /> Keys updated successfully!
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
