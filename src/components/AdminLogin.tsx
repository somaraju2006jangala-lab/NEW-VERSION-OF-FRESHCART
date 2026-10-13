import React, { useState } from 'react';
import { BRAND_LOGO_URL } from '../data/products';
import { loginAdmin, AuthorizedAdmin } from '../services/adminService';
import { CursorReactiveBackground } from './CursorReactiveBackground';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  KeyRound,
  X,
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

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);

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
    <>
      {/* Moving Particles Animation matching Customer Sign-In */}
      <CursorReactiveBackground />

      <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-12 relative z-10">
        {/* Top Banner Navigation */}
        <div className="w-full max-w-md mb-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#006b2c] bg-white/35 backdrop-blur-xs px-3 py-1 rounded-full border border-white/50">
            <ShieldCheck className="w-3.5 h-3.5 text-[#006b2c]" />
            <span>Admin Access Portal</span>
          </div>

          <button
            type="button"
            onClick={onBackToStorefront}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#565e74] hover:text-[#006b2c] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Customer Portal</span>
          </button>
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
              FreshCart Admin Portal
            </h1>
            <p className="text-[13px] text-[#565e74] mt-1.5">
              Log in to manage store inventory, customer orders, coupons, and live deliveries
            </p>

            {/* 1-Click Demo Login Pill */}
            <div className="mt-4 pt-3 border-t border-dashed border-white/40">
              <button
                type="button"
                onClick={handleFillOwnerDemo}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/35 hover:bg-white/60 text-[#006b2c] text-[12px] font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs border border-white/55 shadow-2xs cursor-pointer"
                title="Auto-fill pre-seeded administrator credentials"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#006b2c]" />
                <span>Click to auto-fill Demo Admin Account</span>
              </button>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
            {/* Error Message Alert */}
            {errorMessage && (
              <div
                id="admin-login-error"
                className="p-3.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] text-[13px] flex items-start gap-2.5 animate-in fade-in duration-200"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#dc2626]" />
                <div className="flex-1 font-medium">{errorMessage}</div>
              </div>
            )}

            {/* Admin ID / Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="admin-identifier"
                className="block text-[12px] font-semibold text-[#0b1c30]"
              >
                Admin Email or User ID
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
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/35 backdrop-blur-xs border border-white/55 text-[13px] text-[#0b1c30] placeholder:text-[#565e74]/70 focus:outline-hidden focus:bg-white/60 focus:ring-2 focus:ring-[#006b2c] focus:border-white/80 transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="admin-password"
                  className="block text-[12px] font-semibold text-[#0b1c30]"
                >
                  Password
                </label>
                <button
                  type="button"
                  id="admin-forgot-password-link"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[12px] font-semibold text-[#006b2c] hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
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
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-white/35 backdrop-blur-xs border border-white/55 text-[13px] text-[#0b1c30] placeholder:text-[#565e74]/70 focus:outline-hidden focus:bg-white/60 focus:ring-2 focus:ring-[#006b2c] focus:border-white/80 transition-all font-body shadow-2xs"
                />
                <button
                  type="button"
                  id="toggle-admin-password-visibility"
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
              id="admin-login-submit-btn"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-[#006b2c] hover:bg-[#00873a] hover:-translate-y-0.5 hover:shadow-lg hover:brightness-105 active:translate-y-0 active:scale-[0.99] text-white font-semibold text-[14px] shadow-md transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Authenticating Administrator...</span>
                </div>
              ) : (
                <>
                  <span>Log In &amp; Continue to Admin Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Security Assurance Tag */}
            <div className="flex items-center justify-center gap-2 text-[11px] text-[#565e74] pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#006b2c]" />
              <span>Encrypted Session · Role-Protected Admin Access</span>
            </div>
          </form>

          {/* Return to Customer Portal Footer */}
          <div className="bg-white/20 backdrop-blur-xs px-6 sm:px-8 py-4 border-t border-white/50 text-center">
            <p className="text-[13px] text-[#565e74]">
              Not an administrator?{' '}
              <button
                type="button"
                id="admin-back-to-storefront-btn"
                onClick={onBackToStorefront}
                className="font-bold text-[#006b2c] hover:underline cursor-pointer"
              >
                Return to Customer Portal
              </button>
            </p>
          </div>
        </div>

        {/* Forgot Password Modal - Crystal Glass */}
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1c30]/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white/45 backdrop-blur-xl rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-white/60">
              <div className="p-5 border-b border-white/50 flex items-center justify-between bg-white/30 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#006b2c] text-white flex items-center justify-center shadow-2xs">
                    <KeyRound className="w-4 h-4 text-[#7ffc97]" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-bold text-[#0b1c30] font-display">
                      Admin Password Recovery
                    </h3>
                    <p className="text-[11px] text-[#565e74]">
                      Authorized administrator credential recovery
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="w-8 h-8 rounded-lg text-[#565e74] hover:bg-white/60 hover:text-[#0b1c30] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-[13px] text-[#565e74] leading-relaxed">
                  Administrator credentials are encrypted and stored in the secure database. To reset or rotate administrator access keys, contact the Project Owner (owner@freshcart.com).
                </p>

                <div className="p-3.5 rounded-xl bg-white/40 border border-white/60 text-[12px] text-[#0b1c30] space-y-1">
                  <div className="font-semibold text-[#006b2c]">Pre-seeded Demo Project Owner:</div>
                  <div className="font-mono text-[11px] text-[#565e74]">Email: owner@freshcart.com</div>
                  <div className="font-mono text-[11px] text-[#565e74]">Password: FreshCartOwner2026!</div>
                </div>

                <div className="pt-2 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-5 py-2 rounded-xl bg-[#006b2c] hover:bg-[#00873a] text-white text-[13px] font-semibold transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
