import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';

export default function Login() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSuccess = async (credentialResponse: any) => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.loginWithGoogle(credentialResponse.credential);
      login(res.access_token);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again or contact the administrator.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center relative overflow-hidden font-sans">

      {/* Ambient Glow Effects */}
      <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md px-6 relative z-10">

        {/* Logo and Brand */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-400 to-emerald-500 via-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-500/20 mb-6 transform hover:scale-105 transition-transform duration-300">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 6a2 2 0 012-2h6a2 2 0 012 2v14H5V6zm3 3h4v3H8V9zm8 2h1.5a1.5 1.5 0 011.5 1.5v3.75c0 .966.534 1.75 1.25 1.75s1.25-.784 1.25-1.75V6M3 20h14" />
            </svg>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight font-display">
            PumpKhata
          </h2>
          <p className="mt-2 text-sm text-slate-500 font-medium">
            Centralized Fuel Station Ledger System
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white/70 backdrop-blur-xl border border-slate-200/60 rounded-[2rem] shadow-2xl p-8 sm:p-10 relative overflow-hidden">

          {/* Card subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center">

            <div className="text-center mb-8">
              <h3 className="text-lg font-bold text-slate-800">Secure Access</h3>
              <p className="text-xs text-slate-500 mt-1">Authorized personnel only</p>
            </div>

            {error && (
              <div className="mb-6 bg-rose-50/80 border border-rose-200 p-3 rounded-xl w-full flex items-center justify-center gap-3 shadow-sm animate-fadeIn">
                <p className="text-xs font-semibold text-rose-700 leading-relaxed">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col justify-center items-center h-20 space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                <span className="text-xs font-bold text-emerald-600 animate-pulse">Authenticating...</span>
              </div>
            ) : (
              <div className="w-full flex justify-center transform hover:-translate-y-0.5 transition-transform duration-200">
                <GoogleLogin
                  onSuccess={handleSuccess}
                  onError={() => setError('Google Sign-In failed or was cancelled.')}
                  useOneTap
                  theme="outline"
                  size="large"
                  shape="rectangular"
                  width="300"
                  text="continue_with"
                />
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-slate-200/60 w-full text-center">
              <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                By logging in, you agree to our internal operations policies.
                All activities are logged and monitored.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
