// ============================================================================
// Forgot Password Page
// ============================================================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/auth';
import { Leaf, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-eco-bg dark:bg-dark-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <span className="font-serif text-xl text-eco-text dark:text-dark-text">EcoRoute AI</span>
        </div>

        {sent ? (
          <div className="card text-center py-12">
            <CheckCircle2 className="w-16 h-16 text-brand-600 mx-auto mb-4" />
            <h2 className="font-serif text-heading-2 text-eco-text dark:text-dark-text mb-2">Check your email</h2>
            <p className="text-body text-eco-text-secondary dark:text-dark-text-secondary mb-6">
              If an account exists for {email}, you will receive a password reset link.
            </p>
            <Link to="/login" className="btn-primary">Back to Sign In</Link>
          </div>
        ) : (
          <>
            <h1 className="font-serif text-heading-1 text-eco-text dark:text-dark-text mb-2">Reset password</h1>
            <p className="text-body text-eco-text-secondary dark:text-dark-text-secondary mb-8">
              Enter your email and we'll send you a reset link.
            </p>

            {error && (
              <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-body-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="label">Email</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="input-field" placeholder="you@example.com" required autoComplete="email" />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-3 rounded-xl text-base">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Reset Link'}
              </button>
            </form>

            <Link to="/login" className="mt-6 flex items-center gap-2 text-body-sm text-eco-text-secondary hover:text-eco-text justify-center">
              <ArrowLeft className="w-4 h-4" /> Back to Sign In
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
