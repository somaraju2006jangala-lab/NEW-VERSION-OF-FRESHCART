import React, { useState } from 'react';
import { BRAND_LOGO_URL } from '../data/products';
import { loginAdmin, AuthorizedAdmin } from '../services/adminService';
import {
  ShieldAlert,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  KeyRound,
  Sparkles,
} from 'lucide-react';

interface AdminLoginProps {
  onLoginSuccess: (admin: AuthorizedAdmin) => void;
  onBackToStorefront: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({
  onLoginSuccess,
  onBackToStorefront,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanId = identifier.trim();
    if (!cleanId) {
      setErrorMessage('Please enter your authorized admin email address or unique Admin ID.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your administrator password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await loginAdmin(cleanId, password);
      if (res.success && res.admin) {
        onLoginSuccess(res.admin);
      } else {
        setErrorMessage(res.error || 'Access denied: Invalid administrator credentials.');
      }
    } catch {
      setErrorMessage('An unexpected network error occurred while contacting the server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillOwnerDemo = () => {
    setIdentifier('owner@freshcart.com');
    setPassword('FreshCartOwner2026!');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-12 relative z-10">
      {/* Top Banner Navigation */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToStorefront}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#565e74] hover:text-[#006b2c] transition-colors cursor-pointer bg-white/40 backdrop-blur-xs px-3 py-1.5 rounded-full border border-white/50"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Storefront</span>
        </button>

        <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50/80 backdrop-blur-xs px-3 py-1 rounded-full border border-amber-200">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
          <span>Restricted Portal</span>
        </div>
      </div>

      {/* Main Glass Card */}
      <div className="w-full max-w-md bg-white/40 backdrop-blur-md rounded-3xl shadow-2xl border border-white/60 overflow-hidden">
        {/* Banner Header */}
        <div className="bg-white/25 backdrop-blur-xs p-6 sm:p-8 text-center border-b border-white/50">
          <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-white/50 backdrop-blur-xs shadow-2xs border border-white/70 mb-3">
            <img
              src={BRAND_LOGO_URL}
              alt="FreshCart Logo"
              className="h-9 w-auto object-contain"
            />
          </div>
          <h1 className="text-[22px] sm:text-[26px] font-bold text-[#0b1c30] font-display">
            Admin Portal Access
          </h1>
          <p className="text-[12px] text-[#565e74] mt-1.5 leading-relaxed">
            Only explicitly authorized administrator accounts may enter. Customer credentials are not granted access.
          </p>

          {/* Quick autofill for project owner credentials */}
          <div className="mt-4 pt-3 border-t border-dashed border-white/50">
            <button
              type="button"
              onClick={handleFillOwnerDemo}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50/80 hover:bg-emerald-100 text-[#006b2c] text-[11px] font-semibold transition-all duration-200 border border-emerald-200 shadow-2xs cursor-pointer"
              title="Autofill Project Owner administrator credentials"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#006b2c]" />
              <span>Auto-fill Project Owner Credentials</span>
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
          {errorMessage && (
            <div
              id="admin-login-error"
              className="p-3.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] text-[12px] flex items-start gap-2.5 animate-in fade-in duration-200"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#dc2626]" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Identifier Input */}
          <div className="space-y-1.5">
            <label
              htmlFor="admin-identifier"
              className="block text-[12px] font-semibold text-[#0b1c30]"
            >
              Registered Admin Email or User ID
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 w-4 h-4 text-[#6e7b6c] pointer-events-none" />
              <input
                id="admin-identifier"
                type="text"
                required
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="owner@freshcart.com or admin_owner_001"
                autoComplete="username"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/45 backdrop-blur-xs border border-white/60 text-[13px] text-[#0b1c30] placeholder:text-[#565e74]/70 focus:outline-hidden focus:bg-white/70 focus:ring-2 focus:ring-[#006b2c] focus:border-white/80 transition-all shadow-2xs"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <label
              htmlFor="admin-password"
              className="block text-[12px] font-semibold text-[#0b1c30]"
            >
              Administrator Password
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 w-4 h-4 text-[#6e7b6c] pointer-events-none" />
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="••••••••••••"
                autoComplete="current-password"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/45 backdrop-blur-xs border border-white/60 text-[13px] text-[#0b1c30] placeholder:text-[#565e74]/70 focus:outline-hidden focus:bg-white/70 focus:ring-2 focus:ring-[#006b2c] focus:border-white/80 transition-all shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-[#6e7b6c] hover:text-[#0b1c30] p-1 transition-colors cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            id="admin-login-submit-btn"
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-xl bg-[#006b2c] hover:bg-[#005222] text-white text-[13px] font-bold tracking-wide transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-2xs cursor-pointer mt-2"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Verifying Database Authorization...</span>
              </>
            ) : (
              <>
                <span>Sign In to Admin Portal</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security Notice Footer */}
        <div className="p-4 bg-white/20 backdrop-blur-xs border-t border-white/40 text-center">
          <p className="text-[11px] text-[#565e74] flex items-center justify-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-[#006b2c]" />
            <span>Encrypted with bcrypt · Persistent MySQL/TiDB verification</span>
          </p>
        </div>
      </div>
    </div>
  );
};
