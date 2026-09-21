// ============================================================================
// Reset Password Page
// ============================================================================

import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import { Leaf, Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) { setError('Invalid reset link'); return; }
    setError('');
    setLoading(true);
    try {
      await authService.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-eco-bg dark:bg-dark-bg flex items-center justify-center p-6">
        <div className="card text-center py-12 max-w-md">
          <CheckCircle2 className="w-16 h-16 text-brand-600 mx-auto mb-4" />
          <h2 className="font-serif text-heading-2 text-eco-text dark:text-dark-text mb-2">Password reset!</h2>
          <p className="text-body text-eco-text-secondary">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-eco-bg dark:bg-dark-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <span className="font-serif text-xl text-eco-text dark:text-dark-text">EcoRoute AI</span>
        </div>
        <h1 className="font-serif text-heading-1 text-eco-text dark:text-dark-text mb-2">Set new password</h1>
        <p className="text-body text-eco-text-secondary dark:text-dark-text-secondary mb-8">Choose a strong new password.</p>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-body-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="password" className="label">New Password</label>
            <div className="relative">
              <input id="password" type={showPassword ? 'text' : 'password'} value={password}
                onChange={(e) => setPassword(e.target.value)} className="input-field pr-12"
                placeholder="Min 8 chars, 1 uppercase, 1 number" required minLength={8} />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-eco-text-secondary hover:text-eco-text"
                aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3 rounded-xl text-base">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Reset Password'}
          </button>
        </form>
        <p className="mt-6 text-center text-body-sm text-eco-text-secondary">
          <Link to="/login" className="text-brand-600 hover:text-brand-700 font-medium">Back to Sign In</Link>
        </p>
      </div>
    </div>
  );
}
