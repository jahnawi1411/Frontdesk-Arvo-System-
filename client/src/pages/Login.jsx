import React, { useState } from 'react';
import { Layers, Lock, Mail, AlertCircle, ArrowRight, UserRound, Users, ShieldCheck, ChevronLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, register, logout } = useAuth();
  const [portal, setPortal] = useState(null);
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const isRegistering = portal === 'customer' && mode === 'register';

  const choosePortal = (nextPortal) => {
    setPortal(nextPortal);
    setMode('login');
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);

      if (isRegistering) {
        await register(name, email, password);
        return;
      }

      const user = await login(email, password);
      const allowedRoles = portal === 'admin' ? ['ADMIN', 'AGENT'] : ['CUSTOMER'];
      if (!allowedRoles.includes(user.role)) {
        await logout();
        throw new Error(portal === 'admin'
          ? 'This account is not an Arvo staff account. Please use customer sign in or contact your administrator.'
          : 'This is an Arvo staff account. Please sign in through the admin option.');
      }
    } catch (err) {
      setError(err.message || (isRegistering ? 'Could not create your account.' : 'Invalid email or password.'));
    } finally {
      setSubmitting(false);
    }
  };

  const cardClass = 'w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 text-left hover:border-slate-400 hover:bg-slate-50 transition-colors';

  return (
    <main className="min-h-screen bg-[#f5f6f4] flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-8 pt-8 pb-8">
          <div className="flex items-center gap-3 mb-9">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-slate-900">Frontdesk</h1>
              <p className="text-xs text-slate-500">Arvo Systems Support</p>
            </div>
          </div>

          {!portal ? (
            <>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">How can we help?</h2>
              <p className="mt-2 mb-6 text-sm text-slate-500">Choose how you’d like to continue.</p>
              <div className="space-y-3">
                <button type="button" onClick={() => choosePortal('admin')} className={cardClass}>
                  <span className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-slate-900">Arvo staff</span>
                    <span className="block mt-0.5 text-xs text-slate-500">Admin and agent sign in</span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </button>
                <button type="button" onClick={() => choosePortal('customer')} className={cardClass}>
                  <span className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                    <Users className="w-5 h-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-slate-900">Customer</span>
                    <span className="block mt-0.5 text-xs text-slate-500">Track a request or get support</span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </>
          ) : (
            <>
              <button type="button" onClick={() => { setPortal(null); setError(null); }} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-5">
                <ChevronLeft className="w-4 h-4" /> Choose another option
              </button>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                {portal === 'admin' ? 'Arvo staff sign in' : isRegistering ? 'Create your account' : 'Customer sign in'}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {portal === 'admin'
                  ? 'Sign in to manage support tickets and your team.'
                  : isRegistering
                    ? 'Keep your support conversations in one place.'
                    : 'Sign in to follow up on your support requests.'}
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
                      <input id="name" autoComplete="name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
                    </div>
                  </div>
                )}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={portal === 'admin' ? 'admin@arvo.com' : 'you@example.com'} className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
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

              {portal === 'customer' && (
                <p className="mt-6 text-center text-sm text-slate-500">
                  {isRegistering ? 'Already have an account?' : 'New to Frontdesk?'}{' '}
                  <button type="button" onClick={() => { setMode(isRegistering ? 'login' : 'register'); setError(null); }} className="font-medium text-slate-900 hover:underline">
                    {isRegistering ? 'Sign in' : 'Create an account'}
                  </button>
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
