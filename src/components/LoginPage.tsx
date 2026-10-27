import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BRAND_LOGO_URL } from '../data/products';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  KeyRound,
  X,
} from 'lucide-react';

import { AuthorizedAdmin } from '../services/adminService';
import { AuthorizedEmployee } from '../services/employeeService';

interface LoginPageProps {
  onNavigateToRegister: () => void;
  onNavigateToResetPassword?: (token?: string) => void;
  onLoginSuccess: (
    role: 'admin' | 'employee' | 'customer',
    data?: { admin?: AuthorizedAdmin; employee?: AuthorizedEmployee }
  ) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onNavigateToRegister,
  onNavigateToResetPassword,
  onLoginSuccess,
}) => {
  const { login, requestReset } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotStatus, setForgotStatus] = useState<{
    success: boolean;
    message: string;
    resetToken?: string;
    resetUrl?: string;
  } | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      setErrorMessage('Please enter your email or User ID.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await login(cleanIdentifier, password);
      if (result.success) {
        if (result.role === 'employee' && result.employee) {
          onLoginSuccess('employee', { employee: result.employee });
        } else if (result.role === 'admin' && result.admin) {
          onLoginSuccess('admin', { admin: result.admin });
        } else {
          onLoginSuccess('customer');
        }
      } else {
        setErrorMessage(result.error || 'Invalid credentials. Please verify your email/User ID and password.');
      }
    } catch {
      setErrorMessage('An unexpected error occurred during login. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillAdminDemo = () => {
    setIdentifier('owner@freshcart.com');
    setPassword('FreshCartOwner2026!');
    setErrorMessage(null);
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    setForgotLoading(true);
    setForgotStatus(null);
    try {
      const res = await requestReset(forgotEmail);
      setForgotStatus(res);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-12">
      {/* Top Banner Navigation */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#006b2c] bg-white/35 backdrop-blur-xs px-3 py-1 rounded-full border border-white/50">
          <ShieldCheck className="w-3.5 h-3.5 text-[#006b2c]" />
          <span>Secure Sign-In Portal</span>
        </div>

        <span className="text-[11px] text-[#565e74] font-medium bg-white/20 backdrop-blur-xs px-2.5 py-0.5 rounded-full border border-white/40">
          Role-Based Access
        </span>
      </div>

      {/* Main Login Card - Crystal Clear Glass */}
      <div className="w-full max-w-md bg-white/35 backdrop-blur-md rounded-3xl shadow-xl border border-white/55 overflow-hidden">
        {/* Brand Banner Top */}
        <div className="bg-white/20 backdrop-blur-xs p-6 sm:p-8 text-center border-b border-white/50">
          <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-white/40 backdrop-blur-xs shadow-2xs border border-white/60 mb-4">
            <img
              src={BRAND_LOGO_URL}
              alt="FreshCart Logo"
              className="h-9 w-auto object-contain"
            />
          </div>
          <h1 className="text-[24px] sm:text-[28px] font-bold text-[#0b1c30] font-display">
            Welcome to FreshCart
          </h1>
          <p className="text-[13px] text-[#565e74] mt-1.5">
            Single unified sign-in for Customers, Employees, and Administrators
          </p>

          {/* 1-Click Demo Login Pill for Admin */}
          <div className="mt-4 pt-3 border-t border-dashed border-white/40 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              id="demo-login-admin-btn"
              onClick={handleFillAdminDemo}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/35 hover:bg-white/60 text-[#006b2c] text-[11px] font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs border border-white/55 shadow-2xs cursor-pointer"
              title="Auto-fill pre-seeded administrator credentials"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#006b2c]" />
              <span>Admin Demo</span>
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLoginSubmit} className="p-6 sm:p-8 space-y-5">
          {/* Error Message Alert */}
          {errorMessage && (
            <div
              id="login-error-alert"
              className="p-3.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] text-[13px] flex items-start gap-2.5 animate-in fade-in duration-200"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#dc2626]" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* User ID / Email */}
          <div className="space-y-1.5">
            <label
              htmlFor="login-identifier"
              className="block text-[12px] font-semibold text-[#0b1c30]"
            >
              Email or User ID
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 w-4 h-4 text-[#6e7b6c] pointer-events-none" />
              <input
                id="login-identifier"
                type="text"
                required
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Enter your email or User ID"
                autoComplete="username"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/35 backdrop-blur-xs border border-white/55 text-[13px] text-[#0b1c30] placeholder:text-[#565e74]/70 focus:outline-hidden focus:bg-white/60 focus:ring-2 focus:ring-[#006b2c] focus:border-white/80 transition-all shadow-2xs"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="login-password"
                className="block text-[12px] font-semibold text-[#0b1c30]"
              >
                Password
              </label>
              <button
                type="button"
                id="forgot-password-link"
                onClick={() => {
                  setForgotEmail(identifier || '');
                  setForgotStatus(null);
                  setShowForgotModal(true);
                }}
                className="text-[12px] font-semibold text-[#006b2c] hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 w-4 h-4 text-[#6e7b6c] pointer-events-none" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="••••••••••••"
                autoComplete="current-password"
                className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-white/35 backdrop-blur-xs border border-white/55 text-[13px] text-[#0b1c30] placeholder:text-[#565e74]/70 focus:outline-hidden focus:bg-white/60 focus:ring-2 focus:ring-[#006b2c] focus:border-white/80 transition-all font-body shadow-2xs"
              />
              <button
                type="button"
                id="toggle-password-visibility"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 p-1 text-[#6e7b6c] hover:text-[#0b1c30] transition-colors cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            id="sign-in-btn"
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl bg-[#006b2c] hover:bg-[#00873a] hover:-translate-y-0.5 hover:shadow-lg hover:brightness-105 active:translate-y-0 active:scale-[0.99] text-white font-semibold text-[14px] shadow-md transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span>Signing In...</span>
              </div>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Security Assurance Tag */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-[#565e74] pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#006b2c]" />
            <span>Encrypted Session · Automatic Role Redirection</span>
          </div>
        </form>

        {/* Register Account Footer */}
        <div className="bg-white/20 backdrop-blur-xs px-6 sm:px-8 py-4 border-t border-white/50 text-center">
          <p className="text-[13px] text-[#565e74]">
            New to FreshCart?{' '}
            <button
              type="button"
              id="goto-register-btn"
              onClick={onNavigateToRegister}
              className="font-bold text-[#006b2c] hover:underline cursor-pointer"
            >
              Create Account / Register
            </button>
          </p>
        </div>
      </div>

      {/* Forgot Password Modal - Black Liquid Semi-Solid Opaque Glass */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-[#0a0f16]/95 backdrop-blur-2xl rounded-3xl border border-white/12 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.95),0_0_35px_rgba(16,185,129,0.08),inset_0_1px_1px_rgba(255,255,255,0.2)] overflow-hidden">
            {/* Specular Liquid Edge Light */}
            <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
            <div className="absolute -top-10 inset-x-0 h-20 bg-white/5 blur-lg pointer-events-none" />

            {/* Modal Header */}
            <div className="p-5 border-b border-white/8 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-700/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                  <KeyRound className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-[17px] font-bold text-white tracking-tight">
                    Reset Password
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Verify email to receive your password reset link
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleForgotPasswordSubmit} className="p-6 space-y-4">
              {forgotStatus && (
                <div
                  className={`p-3.5 rounded-xl text-[12px] flex flex-col gap-2.5 ${
                    forgotStatus.success
                      ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-200'
                      : 'bg-rose-950/40 border border-rose-500/30 text-rose-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {forgotStatus.success ? (
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
                    )}
                    <span className="leading-snug">{forgotStatus.message}</span>
                  </div>

                  {forgotStatus.success && forgotStatus.resetToken && (
                    <button
                      type="button"
                      id="btn-open-reset-screen"
                      onClick={() => {
                        setShowForgotModal(false);
                        if (onNavigateToResetPassword) {
                          onNavigateToResetPassword(forgotStatus.resetToken);
                        } else {
                          window.location.hash = `#/reset-password?token=${forgotStatus.resetToken}`;
                        }
                      }}
                      className="mt-1 w-full py-2.5 px-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300 text-[12px] font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>Proceed to Enter New Password</span>
                      <ArrowRight className="w-3.5 h-3.5 text-emerald-300" />
                    </button>
                  )}
                </div>
              )}

              <p className="text-[13px] text-slate-300 leading-relaxed">
                Enter the email address registered with your FreshCart account. We will dispatch a secure 15-minute reset link.
              </p>

              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-slate-300">
                  Your Account Email
                </label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 text-[13px] text-white placeholder-slate-500 bg-white/[0.05] focus:bg-white/[0.08] focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 transition-all"
                />
              </div>

              <div className="pt-2 flex items-center gap-2.5 justify-end">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="px-4 py-2 rounded-xl text-[13px] font-medium text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#006b2c] to-[#00873a] hover:from-[#00873a] hover:to-[#059669] text-white text-[13px] font-semibold transition-all duration-200 flex items-center gap-2 shadow-[0_8px_20px_rgba(0,107,44,0.35)] cursor-pointer disabled:opacity-60"
                >
                  {forgotLoading ? (
                    <span>Dispatching Link...</span>
                  ) : (
                    <span>Send Reset Link</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
