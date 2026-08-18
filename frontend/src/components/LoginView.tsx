import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../lib/AuthProvider';

export default function LoginView() {
  const { signIn, verifyCode } = useAuth();
  const [email, setEmail] = useState('analyst@lab.local');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await signIn(email);
    setLoading(false);
    
    if (result.error) {
      setError(result.error);
    } else if (result.requiresVerification) {
      setStep('code');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await verifyCode(email, code);
    setLoading(false);
    
    if (result.error) {
      setError(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center font-mono relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900 via-black to-black"></div>
      <div className="z-10 flex flex-col items-center w-full max-w-sm px-6">
        <ShieldAlert className="w-16 h-16 text-red-600 mb-6" />
        <h1 className="text-3xl font-bold text-red-600 tracking-widest uppercase mb-2 text-center">SOC Command</h1>
        <p className="text-neutral-500 tracking-widest uppercase text-xs mb-8 text-center">Unauthorized Access Prohibited</p>
        
        {step === 'email' ? (
          <form onSubmit={handleInit} className="w-full flex flex-col gap-4">
            <div>
              <label className="block text-neutral-500 text-[10px] uppercase tracking-widest mb-1">Analyst Email</label>
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-black border border-red-900/50 text-red-500 px-4 py-2 outline-none focus:border-red-500 transition-colors"
                placeholder="analyst@lab.local"
              />
            </div>
            {error && <div className="text-red-500 text-xs text-center uppercase tracking-widest">{error}</div>}
            <button 
              type="submit"
              disabled={loading}
              className="w-full mt-2 px-8 py-3 bg-red-900/20 border border-red-700/50 text-red-500 hover:bg-red-900/40 disabled:opacity-50 transition-colors uppercase tracking-widest text-sm font-bold"
            >
              {loading ? 'Initiating...' : 'Initiate Auth Sequence'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="w-full flex flex-col gap-4">
            <div className="text-emerald-500 text-xs text-center uppercase tracking-widest mb-2 border border-emerald-900/50 bg-emerald-900/10 p-2">
              Verification Code Dispatched (Check Console / Use 123456)
            </div>
            <div>
              <label className="block text-neutral-500 text-[10px] uppercase tracking-widest mb-1">Access Code</label>
              <input 
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="w-full bg-black border border-red-900/50 text-red-500 px-4 py-2 outline-none focus:border-red-500 transition-colors tracking-widest text-center text-lg"
                placeholder="000000"
              />
            </div>
            {error && <div className="text-red-500 text-xs text-center uppercase tracking-widest">{error}</div>}
            <button 
              type="submit"
              disabled={loading}
              className="w-full mt-2 px-8 py-3 bg-red-900/20 border border-red-700/50 text-red-500 hover:bg-red-900/40 disabled:opacity-50 transition-colors uppercase tracking-widest text-sm font-bold"
            >
              {loading ? 'Verifying...' : 'Verify & Enter'}
            </button>
            <button 
              type="button"
              onClick={() => setStep('email')}
              className="w-full text-neutral-600 hover:text-neutral-400 uppercase tracking-widest text-xs mt-2 transition-colors"
            >
              Abort Sequence
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
