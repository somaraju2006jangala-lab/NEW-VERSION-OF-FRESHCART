import React, { useState, useEffect } from 'react';
import {
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  KeyRound,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { verifyPasswordResetToken, resetCustomerPassword } from '../services/authService';
import { BRAND_LOGO_URL } from '../data/products';

interface ResetPasswordPageProps {
  resetToken?: string;
  onNavigateToLogin: () => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({
  resetToken: initialToken = '',
  onNavigateToLogin,
}) => {
  // Extract token from prop or URL if not passed directly
  const [token, setToken] = useState<string>(() => {
    if (initialToken) return initialToken.trim();
    // Check hash
    const rawHash = window.location.hash;
    const hashQIndex = rawHash.indexOf('?');
    if (hashQIndex !== -1) {
      const params = new URLSearchParams(rawHash.substring(hashQIndex));
      const t = params.get('token');
      if (t) return t.trim();
    }
    // Check search query
    if (window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('token');
      if (t) return t.trim();
    }
    return '';
  });

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Verification state
  const [isVerifyingToken, setIsVerifyingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [associatedEmail, setAssociatedEmail] = useState<string | null>(null);

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Verify reset token on mount or when token changes
  useEffect(() => {
    let isMounted = true;

    async function checkToken() {
      if (!token) {
        if (isMounted) {
          setIsVerifyingToken(false);
          setTokenValid(false);
          setTokenError('Password reset token is missing. Please use the link sent to your email.');
        }
        return;
      }

      setIsVerifyingToken(true);
      setTokenError(null);

      try {
        const result = await verifyPasswordResetToken(token);
        if (!isMounted) return;

        if (result.valid) {
          setTokenValid(true);
          setAssociatedEmail(result.email || null);
        } else {
          setTokenValid(false);
          setTokenError(result.error || 'Invalid or expired password reset link.');
        }
      } catch {
        if (isMounted) {
          setTokenValid(false);
          setTokenError('Network error while verifying your reset link. Please check your connection.');
        }
      } finally {
        if (isMounted) {
          setIsVerifyingToken(false);
        }
      }
    }

    checkToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Password validation rules
  const hasMinLength = newPassword.length >= 6;
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  // Strength calculation
  const calculateStrength = () => {
    if (!newPassword) return 0;
    let score = 0;
    if (newPassword.length >= 6) score += 1;
    if (newPassword.length >= 10) score += 1;
    if (hasLetter && hasNumber) score += 1;
    if (/[^a-zA-Z0-9]/.test(newPassword)) score += 1;
    return score;
  };

  const strength = calculateStrength();
  const strengthLabels = ['Too Weak', 'Weak', 'Good', 'Strong', 'Very Strong'];
  const strengthColors = ['bg-rose-500', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-400'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!tokenValid || !token) {
      setFormError('Cannot update password with an invalid reset token.');
      return;
    }

    if (!hasMinLength) {
      setFormError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError('Passwords do not match. Please ensure both fields are identical.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await resetCustomerPassword(newPassword, token);
      if (res.success) {
        setIsSuccess(true);
      } else {
        setFormError(res.error || 'Failed to update password. The link may have expired.');
      }
    } catch {
      setFormError('A network error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-[90vh] w-full flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-gradient-to-b from-[#05080f] via-[#090d16] to-[#020408]">
      {/* Background Liquid Glass Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-radial from-emerald-500/12 via-emerald-600/5 to-transparent blur-3xl pointer-events-none rounded-full" />
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-emerald-500/8 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-emerald-600/8 blur-3xl pointer-events-none rounded-full" />

      {/* Main Glass Card */}
      <div className="relative z-10 w-full max-w-md bg-[#0a0f16]/90 backdrop-blur-2xl rounded-3xl border border-white/12 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.95),0_0_35px_rgba(16,185,129,0.08),inset_0_1px_1px_rgba(255,255,255,0.2)] overflow-hidden">
        {/* Specular Liquid Edge Light */}
        <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
        <div className="absolute -top-10 inset-x-0 h-20 bg-white/5 blur-lg pointer-events-none" />

        {/* Header Section */}
        <div className="p-6 sm:p-8 border-b border-white/8 bg-white/[0.02]">
          <div className="flex items-center justify-between mb-4">
            {/* Brand Logo / Tag */}
            <div className="flex items-center gap-2">
              <img
                src={BRAND_LOGO_URL}
                alt="FreshCart Logo"
                className="w-7 h-7 object-contain drop-shadow-[0_2px_8px_rgba(16,185,129,0.4)]"
              />
              <span className="text-white font-extrabold text-[17px] tracking-tight">
                Fresh<span className="text-emerald-400">Cart</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full backdrop-blur-md">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Encrypted Reset</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-700/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner shrink-0">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-[20px] sm:text-[22px] font-bold text-white tracking-tight">
                Reset Your Password
              </h1>
              <p className="text-[12px] text-slate-400 mt-0.5">
                {associatedEmail ? (
                  <span>
                    Securing account for <span className="text-emerald-400 font-medium">{associatedEmail}</span>
                  </span>
                ) : (
                  'Choose a new secure password for your account'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-5">
          {/* Token Verifying State */}
          {isVerifyingToken && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
              <p className="text-[14px] text-slate-300 font-medium">
                Validating security token...
              </p>
              <p className="text-[12px] text-slate-500">
                Verifying link authenticity and expiration
              </p>
            </div>
          )}

          {/* Token Error State */}
          {!isVerifyingToken && (!tokenValid || tokenError) && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-[13px] flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-rose-200 mb-0.5">Reset Link Unavailable</h4>
                  <p className="text-rose-300/90 leading-relaxed text-[12px]">
                    {tokenError || 'The password reset token is invalid or has expired. Reset links are single-use and expire in 15 minutes.'}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={onNavigateToLogin}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#006b2c] to-[#00873a] hover:from-[#00873a] hover:to-[#059669] text-white text-[13px] font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(0,107,44,0.35)] cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Return to Sign In</span>
                </button>
              </div>
            </div>
          )}

          {/* Success State */}
          {!isVerifyingToken && tokenValid && isSuccess && (
            <div className="py-6 text-center space-y-5">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-[19px] font-bold text-white">Password Updated!</h3>
                <p className="text-[13px] text-slate-300 max-w-sm mx-auto">
                  Your new password has been securely updated. You can now log in using your updated credentials.
                </p>
              </div>

              <button
                type="button"
                id="btn-return-login-success"
                onClick={onNavigateToLogin}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#006b2c] to-[#00873a] hover:from-[#00873a] hover:to-[#059669] text-white text-[14px] font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(0,107,44,0.35)] cursor-pointer"
              >
                <span>Sign In Now</span>
                <Sparkles className="w-4 h-4 text-emerald-200" />
              </button>
            </div>
          )}

          {/* Reset Password Form */}
          {!isVerifyingToken && tokenValid && !isSuccess && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-[12px] flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-snug">{formError}</span>
                </div>
              )}

              {/* New Password Field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="new-password"
                  className="block text-[12px] font-semibold text-slate-300"
                >
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="new-password"
                    name="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter at least 6 characters"
                    className="w-full pl-10 pr-10 py-2.5 bg-white/[0.05] border border-white/15 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 rounded-xl text-white placeholder-slate-500 text-[13px] transition-all outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password Strength Indicator */}
              {newPassword && (
                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Strength:</span>
                    <span className="font-semibold text-slate-300">
                      {strengthLabels[strength]}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 h-1.5">
                    {[0, 1, 2, 3].map((index) => (
                      <div
                        key={index}
                        className={`h-full rounded-full transition-all duration-300 ${
                          strength > index ? strengthColors[strength] : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Confirm New Password Field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="confirm-password"
                  className="block text-[12px] font-semibold text-slate-300"
                >
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    className="w-full pl-10 pr-10 py-2.5 bg-white/[0.05] border border-white/15 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 rounded-xl text-white placeholder-slate-500 text-[13px] transition-all outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password Matching Feedback */}
              {confirmPassword && (
                <div className="flex items-center gap-1.5 text-[11px] pt-0.5">
                  {passwordsMatch ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Passwords do not match
                    </span>
                  )}
                </div>
              )}

              {/* Password Rules Checklist */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/8 space-y-1 text-[11px] text-slate-400">
                <p className="font-semibold text-slate-300 mb-1">Security Requirements:</p>
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      hasMinLength ? 'bg-emerald-400' : 'bg-slate-600'
                    }`}
                  />
                  <span className={hasMinLength ? 'text-emerald-300' : ''}>
                    Minimum 6 characters
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      hasLetter && hasNumber ? 'bg-emerald-400' : 'bg-slate-600'
                    }`}
                  />
                  <span className={hasLetter && hasNumber ? 'text-emerald-300' : ''}>
                    Contains both letters and numbers
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                id="btn-update-password"
                disabled={isSubmitting || !hasMinLength || !passwordsMatch}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#006b2c] to-[#00873a] hover:from-[#00873a] hover:to-[#059669] text-white text-[13px] font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(0,107,44,0.35)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <span>Update Password</span>
                )}
              </button>

              {/* Back to Sign In Link */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={onNavigateToLogin}
                  className="text-[12px] text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Sign In</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
