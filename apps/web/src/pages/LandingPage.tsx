// ============================================================================
// Landing Page
// ============================================================================

import { Link } from 'react-router-dom';
import {
  ArrowRight, Leaf, Zap, DollarSign, Brain, BarChart3, Shield, Globe, ChevronRight,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-eco-bg dark:bg-dark-bg">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-eco-bg/80 dark:bg-dark-bg/80 backdrop-blur-xl border-b border-eco-border dark:border-dark-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="font-serif text-xl text-eco-text dark:text-dark-text">EcoRoute AI</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login" className="btn-ghost text-body-sm">Sign In</Link>
            <Link to="/register" className="btn-primary text-body-sm">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/20 mb-8 animate-fade-in">
            <Leaf className="w-4 h-4 text-brand-600" />
            <span className="text-body-sm text-brand-700 dark:text-brand-400 font-medium">Intelligent AI Model Routing</span>
          </div>

          <h1 className="font-serif text-display md:text-[4.5rem] leading-[1.05] text-eco-text dark:text-dark-text mb-6 animate-slide-up">
            Smarter AI decisions.{' '}
            <span className="text-brand-600">Lower cost.</span>{' '}
            Better impact.
          </h1>

          <p className="text-body-lg text-eco-text-secondary dark:text-dark-text-secondary max-w-2xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            EcoRoute AI evaluates available AI models — GPT, Gemini, Claude — and selects the most
            suitable one based on token efficiency, cost, quality, and estimated environmental impact.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <Link to="/register" className="btn-primary text-base px-8 py-3.5 rounded-xl">
              Start Routing <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/login" className="btn-secondary text-base px-8 py-3.5 rounded-xl">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-6 border-t border-eco-border dark:border-dark-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-heading-1 text-eco-text dark:text-dark-text mb-4">How routing works</h2>
            <p className="text-body-lg text-eco-text-secondary dark:text-dark-text-secondary max-w-2xl mx-auto">
              Three steps to optimal AI model selection with full transparency.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Submit your task',
                description: 'Enter your prompt and select a routing strategy. Choose between balanced, lowest cost, highest quality, eco-first, or token efficient.',
                icon: Brain,
              },
              {
                step: '02',
                title: 'Intelligent evaluation',
                description: 'EcoRoute evaluates all available models across token usage, cost, quality, and environmental impact using a weighted scoring system.',
                icon: BarChart3,
              },
              {
                step: '03',
                title: 'Transparent results',
                description: 'See exactly why a model was selected, with score breakdowns, cost estimates, and environmental impact — clearly labeled as actual or estimated.',
                icon: Shield,
              },
            ].map((item) => (
              <div key={item.step} className="card-hover group cursor-default">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-caption font-medium text-brand-600">{item.step}</span>
                  <div className="h-px flex-1 bg-eco-border dark:bg-dark-border" />
                </div>
                <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center mb-4 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/40 transition-colors">
                  <item.icon className="w-6 h-6 text-brand-600" />
                </div>
                <h3 className="font-serif text-heading-3 text-eco-text dark:text-dark-text mb-2">{item.title}</h3>
                <p className="text-body text-eco-text-secondary dark:text-dark-text-secondary">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-24 px-6 bg-white dark:bg-dark-surface border-t border-eco-border dark:border-dark-border">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="font-serif text-heading-1 text-eco-text dark:text-dark-text mb-6">
                Why intelligent model selection matters
              </h2>
              <p className="text-body-lg text-eco-text-secondary dark:text-dark-text-secondary mb-8">
                Different AI models excel at different tasks. Sending every request to the most expensive
                model wastes money and resources. EcoRoute helps you make informed decisions.
              </p>
              <div className="space-y-4">
                {[
                  { icon: DollarSign, label: 'Reduce costs by routing to optimal models per task' },
                  { icon: Zap, label: 'Improve token efficiency with intelligent model matching' },
                  { icon: Leaf, label: 'Understand estimated environmental impact of your AI usage' },
                  { icon: Globe, label: 'Support multiple providers: OpenAI, Google, Anthropic' },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <item.icon className="w-4 h-4 text-brand-600" />
                    </div>
                    <p className="text-body text-eco-text dark:text-dark-text">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="card bg-eco-bg dark:bg-dark-bg p-8">
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-eco-border dark:border-dark-border">
                  <span className="text-body-sm text-eco-text-secondary">Supported Providers</span>
                  <span className="badge-success">Active</span>
                </div>
                {['OpenAI (GPT-4o, GPT-4o Mini)', 'Google (Gemini 1.5 Pro, Flash)', 'Anthropic (Claude 3.5 Sonnet, Haiku)'].map((p) => (
                  <div key={p} className="flex items-center gap-3 py-2">
                    <ChevronRight className="w-4 h-4 text-brand-600" />
                    <span className="text-body text-eco-text dark:text-dark-text">{p}</span>
                  </div>
                ))}
                <div className="pt-4 border-t border-eco-border dark:border-dark-border">
                  <p className="text-caption text-eco-text-secondary dark:text-dark-text-secondary">
                    Works in mock mode without API keys. Configure providers for live routing.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Environmental Transparency */}
      <section className="py-24 px-6 border-t border-eco-border dark:border-dark-border">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center mx-auto mb-6">
            <Leaf className="w-8 h-8 text-brand-600" />
          </div>
          <h2 className="font-serif text-heading-1 text-eco-text dark:text-dark-text mb-4">
            Environmental transparency
          </h2>
          <p className="text-body-lg text-eco-text-secondary dark:text-dark-text-secondary mb-6 max-w-2xl mx-auto">
            EcoRoute provides estimated environmental impact metrics for AI inference.
            We believe in transparency about what we can and cannot measure.
          </p>
          <div className="card bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 text-left max-w-2xl mx-auto">
            <p className="text-body text-amber-800 dark:text-amber-300">
              <strong>Important:</strong> Environmental impact values shown in EcoRoute are
              <strong> modeled estimates</strong>, not direct measurements. They are based on
              published research averages (Patterson et al. 2021, IEA 2023) and should not be
              cited as exact measurements. Actual impact varies by hardware, data center
              location, and renewable energy usage.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-brand-600 dark:bg-brand-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-heading-1 text-white mb-4">
            Ready to route smarter?
          </h2>
          <p className="text-body-lg text-brand-100 mb-8">
            Start making informed AI model decisions today. No credit card required.
          </p>
          <Link to="/register" className="inline-flex items-center gap-2 bg-white text-brand-700 px-8 py-3.5 rounded-xl font-medium hover:bg-brand-50 transition-colors">
            Get Started Free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-eco-border dark:border-dark-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-brand-600" />
            <span className="font-serif text-lg text-eco-text dark:text-dark-text">EcoRoute AI</span>
          </div>
          <p className="text-body-sm text-eco-text-secondary dark:text-dark-text-secondary">
            © 2026 EcoRoute AI. Smarter AI decisions. Lower cost. Better impact.
          </p>
        </div>
      </footer>
    </div>
  );
}
