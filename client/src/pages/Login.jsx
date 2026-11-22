import React, { useState } from 'react';
import { Layers, Lock, Mail, AlertCircle, ArrowRight, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const isRegistering = mode === 'register';

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      if (isRegistering) await register(name, email, password);
      else await login(email, password);
    } catch (err) {
      setError(err.message || (isRegistering ? 'Could not create your account.' : 'Invalid email or password.'));
    } finally {
      setSubmitting(false);
    }
  };

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-[#f5f6f4] flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-8 pt-8 pb-6">
          <div className="flex items-center gap-3 mb-9">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-slate-900">Frontdesk</h1>
              <p className="text-xs text-slate-500">Arvo Systems Support</p>
            </div>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            {isRegistering ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {isRegistering ? 'Keep your support conversations in one place.' : 'Sign in to follow up on your support requests.'}
          </p>

          {error && (
            <div role="alert" className="mt-5 p-3 bg-red-50 border border-red-100 text-red-700 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {isRegistering && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">Your name</label>
                <div className="relative">
                  <UserRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input id="name" autoComplete="name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="jahnawi" className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
                </div>
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input id="password" type="password" autoComplete={isRegistering ? 'new-password' : 'current-password'} minLength={isRegistering ? 8 : undefined} maxLength={isRegistering ? 128 : undefined} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isRegistering ? 'At least 8 characters' : 'Your password'} className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
              </div>
            </div>
            <button type="submit" disabled={submitting} className="w-full py-2.5 mt-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-60">
              <span>{submitting ? (isRegistering ? 'Creating account…' : 'Signing in…') : (isRegistering ? 'Create account' : 'Sign in')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            {isRegistering ? 'Already have an account?' : 'New to Frontdesk?'}{' '}
            <button type="button" onClick={() => changeMode(isRegistering ? 'login' : 'register')} className="font-medium text-slate-900 hover:underline">
              {isRegistering ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
