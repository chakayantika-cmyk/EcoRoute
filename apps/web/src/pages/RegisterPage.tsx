// ============================================================================
// Register Page
// ============================================================================

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Leaf, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';

type Step = 'details' | 'otp' | 'pin';

export default function RegisterPage() {
  const { requestOtp, register } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState<Step>('details');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await requestOtp(email, displayName);
      setStep('otp');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send OTP. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otp.length !== 6) {
      setError('OTP must be exactly 6 digits');
      return;
    }
    setStep('pin');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!/^\d{4}$/.test(password)) {
      setError('PIN must be exactly 4 digits');
      return;
    }

    setLoading(true);
    try {
      await register(email, otp, password, displayName);
      navigate('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-eco-bg dark:bg-dark-bg flex">
      <div className="hidden lg:flex lg:w-1/2 bg-brand-600 dark:bg-brand-800 p-12 flex-col justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <span className="font-serif text-xl text-white">EcoRoute AI</span>
        </Link>
        <div>
          <h2 className="font-serif text-[3rem] leading-[1.1] text-white mb-4">
            Join the smarter way to use AI.
          </h2>
          <p className="text-brand-100 text-body-lg">
            Make data-driven model selection decisions with transparent metrics and environmental awareness.
          </p>
        </div>
        <p className="text-brand-200 text-body-sm">© 2026 EcoRoute AI</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 relative">
        {step !== 'details' && (
          <button 
            onClick={() => setStep(step === 'pin' ? 'otp' : 'details')}
            className="absolute top-8 left-8 text-eco-text-secondary hover:text-eco-text flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        )}
        
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="font-serif text-xl text-eco-text dark:text-dark-text">EcoRoute AI</span>
          </div>

          <h1 className="font-serif text-heading-1 text-eco-text dark:text-dark-text mb-2">
            {step === 'details' ? 'Create your account' : 
             step === 'otp' ? 'Check your email' : 
             'Now you are ready to login'}
          </h1>
          <p className="text-body text-eco-text-secondary dark:text-dark-text-secondary mb-8">
            {step === 'details' ? 'Get started with intelligent AI model routing.' : 
             step === 'otp' ? `We sent a 6-digit code to ${email}.` : 
             'Create a 4-digit PIN for your account.'}
          </p>

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-body-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {step === 'details' && (
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <div>
                <label htmlFor="name" className="label">Display Name</label>
                <input id="name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                  className="input-field" placeholder="Your name" required minLength={2} autoComplete="name" />
              </div>
              <div>
                <label htmlFor="email" className="label">Email</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="input-field" placeholder="you@example.com" required autoComplete="email" />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-3 rounded-xl text-base">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <label htmlFor="otp" className="label">Verification Code</label>
                <input id="otp" type="text" inputMode="numeric" pattern="\d{6}" maxLength={6}
                  value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="input-field text-center tracking-widest text-lg font-medium" 
                  placeholder="------" required autoComplete="one-time-code" />
              </div>
              <button type="submit" className="btn-primary w-full py-3 rounded-xl text-base">
                Verify Code
              </button>
            </form>
          )}

          {step === 'pin' && (
            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label htmlFor="password" className="label">Create 4-Digit PIN</label>
                <div className="relative">
                  <input id="password" type={showPassword ? 'text' : 'password'} inputMode="numeric" pattern="\d{4}" maxLength={4}
                    value={password} onChange={(e) => setPassword(e.target.value.replace(/\D/g, ''))} 
                    className="input-field pr-12 text-center tracking-widest text-lg font-medium"
                    placeholder="••••" required autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-eco-text-secondary hover:text-eco-text"
                    aria-label={showPassword ? 'Hide PIN' : 'Show PIN'}>
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-3 rounded-xl text-base">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
              </button>
            </form>
          )}

          {step === 'details' && (
            <p className="mt-6 text-center text-body-sm text-eco-text-secondary dark:text-dark-text-secondary">
              Already have an account?{' '}
              <Link to="/login" className="text-brand-600 hover:text-brand-700 font-medium">Sign in</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
