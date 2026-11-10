import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { validateIndianMobileNumber } from '../services/registrationOtpService';
import { fetchUpiSettings, isValidUpiId } from '../services/paymentService';
import { BRAND_LOGO_URL } from '../data/products';
import {
  User,
  Mail,
  Lock,
  MapPin,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
  QrCode,
  Copy,
  Check,
  UploadCloud,
  FileText,
  CreditCard,
} from 'lucide-react';

interface RegisterPageProps {
  onNavigateToLogin: () => void;
  onRegisterSuccess: () => void;
  onNavigateToAdmin?: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({
  onNavigateToLogin,
  onRegisterSuccess,
}) => {
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState(''); // 10-digit Indian mobile number
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [address, setAddress] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // UPI Payment State for Registration Fee (₹199)
  const [upiId, setUpiId] = useState('somaraju2006jangala-3@okicici');
  const [merchantName, setMerchantName] = useState('FreshCart Store');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [transactionRef, setTransactionRef] = useState('');
  const [paymentProofBase64, setPaymentProofBase64] = useState<string | null>(null);
  const [paymentProofMime, setPaymentProofMime] = useState<string | null>(null);
  const [paymentProofName, setPaymentProofName] = useState<string | null>(null);
  const [paymentProofSize, setPaymentProofSize] = useState<number>(0);
  const [proofError, setProofError] = useState<string | null>(null);

  // Fetch shared backend UPI settings on mount
  useEffect(() => {
    let isMounted = true;
    fetchUpiSettings()
      .then((res) => {
        if (!isMounted) return;
        if (res && res.upiId) {
          setUpiId(res.upiId);
          if (res.merchantName) setMerchantName(res.merchantName);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Standard UPI URI format: upi://pay?pa=UPI_ID&pn=MERCHANT_NAME&am=199&cu=INR
  const standardUpiUri = useMemo(() => {
    const cleanId = (upiId || '').trim();
    if (!cleanId) return '';
    const pa = encodeURIComponent(cleanId).replace(/%40/g, '@');
    const pn = encodeURIComponent(merchantName.trim() || 'FreshCart Store');
    return `upi://pay?pa=${pa}&pn=${pn}&am=199&cu=INR`;
  }, [upiId, merchantName]);

  // Generate scannable QR Code
  useEffect(() => {
    if (!standardUpiUri) return;
    QRCode.toDataURL(standardUpiUri, {
      width: 200,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#050c18', light: '#ffffff' },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch(() => setQrCodeDataUrl(''));
  }, [standardUpiUri]);

  // Copy UPI ID to clipboard
  const handleCopyUpiId = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(upiId);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = upiId;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {}
  };

  // Payment proof file selection (JPG, JPEG, PNG, PDF up to 10MB)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProofError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const validExts = ['.jpg', '.jpeg', '.png', '.pdf'];

    if (!validTypes.includes(file.type.toLowerCase()) && !validExts.includes(ext)) {
      setProofError('Please upload a valid JPG, JPEG, PNG, or PDF file.');
      return;
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setProofError('File size exceeds 10 MB limit. Please select a smaller file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPaymentProofBase64(result);
      setPaymentProofMime(file.type || (ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : 'image/jpeg'));
      setPaymentProofName(file.name);
      setPaymentProofSize(file.size);
    };
    reader.onerror = () => {
      setProofError('Failed to read the file from your device. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  // Simple password strength calculation
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const strengthScore = [hasMinLength, hasLetter, hasNumber, hasSpecial].filter(Boolean).length;

  // Handle phone input changes (10 digits only)
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(digitsOnly);
    setPhoneError(null);
  };

  // Validate form completeness and mobile validation
  const phoneValidation = validateIndianMobileNumber(phone);
  const isPhoneValid = phoneValidation.isValid;
  const isFormValid =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    email.includes('@') &&
    isPhoneValid &&
    address.trim().length > 0 &&
    password.length >= 6 &&
    confirmPassword === password;

  const isRegisterDisabled = !isFormValid || isSubmitting;

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setPhoneError(null);
    setSuccessMessage(null);

    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    const validation = validateIndianMobileNumber(phone);
    if (!validation.isValid || !validation.normalized) {
      setPhoneError(validation.error || 'Please enter a valid 10-digit Indian mobile number.');
      setErrorMessage(validation.error || 'Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify.');
      return;
    }
    if (!address.trim()) {
      setErrorMessage('Please provide your default delivery address for 30-min fulfillment.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await register({
        name: name.trim(),
        email: email.trim(),
        phone: validation.normalized, // E.164: +91XXXXXXXXXX
        password,
        address: address.trim(),
        transactionRef: transactionRef.trim() || undefined,
        paymentProof: paymentProofBase64 || undefined,
        mimeType: paymentProofMime || undefined,
        fileName: paymentProofName || undefined,
      });

      if (res.success) {
        setSuccessMessage(
          paymentProofBase64
            ? 'Registration and payment proof submitted successfully! Your payment is pending admin verification.'
            : 'Registration Completed! Opening Customer Portal...'
        );
        setTimeout(() => {
          onRegisterSuccess();
        }, 1500);
      } else {
        const errorText = res.error || 'Failed to create customer account. Please try again.';
        setErrorMessage(errorText);
        if (errorText.toLowerCase().includes('mobile') || errorText.toLowerCase().includes('number') || errorText.toLowerCase().includes('phone')) {
          setPhoneError(errorText);
        }
      }
    } catch {
      setErrorMessage('An unexpected error occurred during account creation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-10">
      {/* Top Banner Navigation */}
      <div className="w-full max-w-lg mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onNavigateToLogin}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#565e74] hover:text-[#006b2c] transition-colors group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Sign In</span>
        </button>

        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#006b2c] bg-white/35 backdrop-blur-xs px-2.5 py-1 rounded-full border border-white/50">
          New Customer Registration
        </span>
      </div>

      {/* Main Register Card - Crystal Clear Glass */}
      <div className="w-full max-w-lg bg-white/35 backdrop-blur-md rounded-3xl shadow-xl border border-white/55 overflow-hidden">
        {/* Header */}
        <div className="bg-white/20 backdrop-blur-xs p-6 sm:p-7 text-center border-b border-white/50">
          <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-white/40 backdrop-blur-xs shadow-2xs border border-white/60 mb-3">
            <img
              src={BRAND_LOGO_URL}
              alt="FreshCart Logo"
              className="h-8 w-auto object-contain"
            />
          </div>
          <h1 className="text-[22px] sm:text-[26px] font-bold text-[#0b1c30] font-display">
            Create FreshCart Account
          </h1>
          <p className="text-[13px] text-[#565e74] mt-1">
            Unlock fast 30-min neighborhood delivery, order history, and exclusive organic perks
          </p>

          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/35 backdrop-blur-xs text-[#15803d] text-[11px] font-semibold border border-white/60 shadow-2xs">
            <Sparkles className="w-3 h-3 text-[#16a34a]" />
            <span>New Member Bonus: 10% Off Your First Order</span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleRegisterSubmit} className="p-6 sm:p-7 space-y-4">
          {/* Global Form Error Message */}
          {errorMessage && (
            <div
              id="register-error-alert"
              className="p-3.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] text-[13px] flex items-start gap-2.5 animate-in fade-in duration-200"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#dc2626]" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Global Form Success Message */}
          {successMessage && (
            <div
              id="register-success-alert"
              className="p-3.5 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] text-[#065f46] text-[13px] flex items-start gap-2.5 animate-in fade-in duration-200"
            >
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-[#059669]" />
              <div className="flex-1 font-medium">{successMessage}</div>
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1">
            <label
              htmlFor="reg-name"
              className="block text-[12px] font-semibold text-[#0b1c30]"
            >
              Customer Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative flex items-center">
              <User className="absolute left-3.5 w-4 h-4 text-[#6e7b6c] pointer-events-none" />
              <input
                id="reg-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jordan Miller"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/35 backdrop-blur-xs border border-white/55 text-[13px] text-[#0b1c30] placeholder:text-[#565e74]/70 focus:outline-hidden focus:bg-white/60 focus:ring-2 focus:ring-[#006b2c] focus:border-white/80 transition-all"
              />
            </div>
          </div>

          {/* Email / User ID */}
          <div className="space-y-1">
            <label
              htmlFor="reg-email"
              className="block text-[12px] font-semibold text-[#0b1c30]"
            >
              Email / User ID <span className="text-red-500">*</span>
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 w-4 h-4 text-[#6e7b6c] pointer-events-none" />
              <input
                id="reg-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jordan@example.com"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/35 backdrop-blur-xs border border-white/55 text-[13px] text-[#0b1c30] placeholder:text-[#565e74]/70 focus:outline-hidden focus:bg-white/60 focus:ring-2 focus:ring-[#006b2c] focus:border-white/80 transition-all"
              />
            </div>
          </div>

          {/* Mobile Number - Indian +91 */}
          <div className="space-y-1">
            <label
              htmlFor="reg-mobile"
              className="block text-[12px] font-semibold text-[#0b1c30]"
            >
              Mobile Number <span className="text-red-500">*</span>
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 inline-flex items-center gap-1 text-[13px] font-semibold text-[#0b1c30] select-none pointer-events-none pr-2.5 border-r border-[#6e7b6c]/30">
                <span>🇮🇳</span>
                <span>+91</span>
              </span>
              <input
                id="reg-mobile"
                type="tel"
                required
                value={phone}
                onChange={handlePhoneChange}
                placeholder="10-digit mobile number"
                maxLength={10}
                className={`w-full pl-20 pr-3.5 py-2.5 rounded-xl bg-white/35 backdrop-blur-xs border text-[13px] text-[#0b1c30] font-medium tracking-wide placeholder:text-[#565e74]/70 placeholder:font-normal placeholder:tracking-normal focus:outline-hidden focus:bg-white/60 focus:ring-2 focus:ring-[#006b2c] transition-all ${
                  phoneError ? 'border-red-400 bg-red-50/20' : 'border-white/55'
                }`}
              />
            </div>
            {phoneError && (
              <div
                id="phone-error-msg"
                className="text-[12px] font-medium text-red-600 flex items-center gap-1 mt-1 animate-in fade-in duration-150"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
                <span>{phoneError}</span>
              </div>
            )}
          </div>

          {/* Delivery Address */}
          <div className="space-y-1">
            <label
              htmlFor="reg-address"
              className="block text-[12px] font-semibold text-[#0b1c30]"
            >
              Primary Delivery Address <span className="text-red-500">*</span>
            </label>
            <div className="relative flex items-center">
              <MapPin className="absolute left-3.5 w-4 h-4 text-[#6e7b6c] pointer-events-none" />
              <input
                id="reg-address"
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Apartment, suite, street address..."
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/35 backdrop-blur-xs border border-white/55 text-[13px] text-[#0b1c30] placeholder:text-[#565e74]/70 focus:outline-hidden focus:bg-white/60 focus:ring-2 focus:ring-[#006b2c] focus:border-white/80 transition-all"
              />
            </div>
          </div>

          {/* Passwords in 2-col grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="reg-password"
                className="block text-[12px] font-semibold text-[#0b1c30]"
              >
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 w-4 h-4 text-[#6e7b6c] pointer-events-none" />
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/35 backdrop-blur-xs border border-white/55 text-[13px] text-[#0b1c30] placeholder:text-[#565e74]/70 focus:outline-hidden focus:bg-white/60 focus:ring-2 focus:ring-[#006b2c] focus:border-white/80 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-[#6e7b6c] hover:text-[#0b1c30] cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="reg-confirm-password"
                className="block text-[12px] font-semibold text-[#0b1c30]"
              >
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 w-4 h-4 text-[#6e7b6c] pointer-events-none" />
                <input
                  id="reg-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/35 backdrop-blur-xs border border-white/55 text-[13px] text-[#0b1c30] placeholder:text-[#565e74]/70 focus:outline-hidden focus:bg-white/60 focus:ring-2 focus:ring-[#006b2c] focus:border-white/80 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 text-[#6e7b6c] hover:text-[#0b1c30] cursor-pointer"
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Password Strength Indicator */}
          {password.length > 0 && (
            <div className="space-y-1.5 p-3 rounded-xl bg-white/25 backdrop-blur-xs border border-white/45">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#565e74] font-medium">Password Strength:</span>
                <span
                  className={`font-bold ${
                    strengthScore <= 1
                      ? 'text-red-500'
                      : strengthScore <= 3
                        ? 'text-amber-500'
                        : 'text-emerald-600'
                  }`}
                >
                  {strengthScore <= 1 ? 'Weak' : strengthScore <= 3 ? 'Good' : 'Strong'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 h-1.5">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`rounded-full transition-all duration-300 ${
                      strengthScore >= step
                        ? strengthScore <= 1
                          ? 'bg-red-400'
                          : strengthScore <= 3
                            ? 'bg-amber-400'
                            : 'bg-emerald-500'
                        : 'bg-white/40'
                    }`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#565e74] pt-1">
                <span className={hasMinLength ? 'text-emerald-600 font-semibold' : ''}>
                  {hasMinLength ? '✓' : '•'} 8+ characters
                </span>
                <span className={hasLetter ? 'text-emerald-600 font-semibold' : ''}>
                  {hasLetter ? '✓' : '•'} Letters
                </span>
                <span className={hasNumber ? 'text-emerald-600 font-semibold' : ''}>
                  {hasNumber ? '✓' : '•'} Numbers
                </span>
                <span className={hasSpecial ? 'text-emerald-600 font-semibold' : ''}>
                  {hasSpecial ? '✓' : '•'} Symbols
                </span>
              </div>
            </div>
          )}

          {/* Security Notice */}
          <div className="p-3 rounded-xl bg-white/30 backdrop-blur-xs border border-white/50 flex items-start gap-2 text-[11px] text-[#3b4759]">
            <ShieldCheck className="w-4 h-4 text-[#006b2c] shrink-0 mt-0.5" />
            <span>
              <strong>Zero Plain-Text Storage:</strong> FreshCart cryptographically hashes your credentials using Web Crypto SHA-256 + individual salt before saving.
            </span>
          </div>

          {/* Customer Registration & Payment Details Section */}
          <div className="rounded-2xl bg-white/40 backdrop-blur-xs border border-white/60 p-4 sm:p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-white/60">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#006b2c]" />
                <h3 className="text-[14px] font-bold text-[#0b1c30]">Payment Details</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#006b2c]/10 text-[#006b2c] border border-[#006b2c]/20">
                Registration Fee: ₹199
              </span>
            </div>

            {/* Merchant Info & UPI ID Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
              <div className="p-2.5 rounded-xl bg-white/50 border border-white/60">
                <div className="text-[#565e74] text-[11px]">Payee / Merchant Name</div>
                <div className="font-bold text-[#0b1c30] truncate">{merchantName || 'FreshCart Store'}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/50 border border-white/60">
                <div className="text-[#565e74] text-[11px]">Official UPI ID</div>
                <div className="flex items-center justify-between gap-1 font-mono font-semibold text-[#006b2c] text-[12px]">
                  <span className="truncate">{upiId}</span>
                  <button
                    type="button"
                    onClick={handleCopyUpiId}
                    className="p-1 rounded-md hover:bg-emerald-100 text-[#006b2c] transition-colors cursor-pointer shrink-0"
                    title="Copy UPI ID"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Official QR Code Payment Box */}
            <div className="flex flex-col sm:flex-row items-center gap-4 p-3.5 rounded-xl bg-white/35 border border-white/50">
              {/* QR Code Container */}
              <div className="flex flex-col items-center shrink-0">
                {qrCodeDataUrl ? (
                  <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-200">
                    <img
                      src={qrCodeDataUrl}
                      alt="UPI Registration QR Code"
                      className="w-36 h-36 object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-36 h-36 rounded-xl bg-slate-100 flex flex-col items-center justify-center p-2 text-center text-slate-400 border border-slate-200">
                    <QrCode className="w-8 h-8 mb-1" />
                    <span className="text-[10px]">Generating QR...</span>
                  </div>
                )}
                <span className="text-[10px] text-[#565e74] mt-1.5 text-center font-medium">
                  Scan with GPay, PhonePe, Paytm, or BHIM
                </span>
              </div>

              {/* Instructions & Copy UPI ID */}
              <div className="flex-1 space-y-2.5 w-full text-center sm:text-left">
                <div className="text-[12px] text-[#0b1c30]">
                  <p className="font-semibold">Scan & Pay Registration Fee</p>
                  <p className="text-[11px] text-[#565e74] mt-0.5 leading-relaxed">
                    Scan the QR code above with any UPI app on your phone, complete the ₹199 one-time registration payment, and upload your payment receipt below.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                  <button
                    type="button"
                    onClick={handleCopyUpiId}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/80 hover:bg-white text-[#0b1c30] border border-slate-300 font-semibold text-[12px] shadow-xs transition-all cursor-pointer"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? 'UPI ID Copied to Clipboard' : 'Copy Official UPI ID'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Transaction Reference (Optional) */}
            <div className="space-y-1">
              <label htmlFor="reg-txn-ref" className="block text-[11px] font-semibold text-[#0b1c30]">
                UPI Transaction Reference / UTR Number <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                id="reg-txn-ref"
                type="text"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder="e.g. 12-digit UTR from GPay / PhonePe / Paytm"
                className="w-full px-3 py-2 rounded-xl bg-white/50 border border-white/60 text-[12px] text-[#0b1c30] placeholder:text-[#565e74]/70 focus:outline-hidden focus:ring-2 focus:ring-[#006b2c]"
              />
            </div>

            {/* Payment Proof Upload (JPG, JPEG, PNG, PDF up to 10MB) */}
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-[#0b1c30]">
                Payment Proof Upload <span className="text-slate-400 font-normal">(JPG, JPEG, PNG, PDF — Max 10MB)</span>
              </label>

              <div className="relative border-2 border-dashed border-white/70 rounded-xl p-3 bg-white/30 text-center hover:bg-white/40 transition-all">
                <input
                  type="file"
                  id="reg-proof-input"
                  accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {paymentProofName ? (
                  <div className="flex items-center justify-center gap-2 text-[12px] font-medium text-[#006b2c]">
                    {paymentProofMime === 'application/pdf' ? (
                      <FileText className="w-4 h-4 text-rose-600" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                    <span className="truncate max-w-[200px]">{paymentProofName}</span>
                    <span className="text-[10px] text-slate-500">
                      ({(paymentProofSize / 1024).toFixed(0)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPaymentProofBase64(null);
                        setPaymentProofName(null);
                        setPaymentProofSize(0);
                        setPaymentProofMime(null);
                      }}
                      className="ml-2 text-xs text-red-500 hover:underline z-10 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 pointer-events-none">
                    <UploadCloud className="w-5 h-5 text-[#006b2c]" />
                    <span className="text-[12px] font-semibold text-[#0b1c30]">
                      Click to browse or drop payment receipt screenshot / PDF
                    </span>
                    <span className="text-[10px] text-[#565e74]">
                      Accepted formats: JPG, PNG, PDF (Up to 10 MB)
                    </span>
                  </div>
                )}
              </div>

              {proofError && (
                <div className="text-[11px] font-medium text-red-600 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
                  <span>{proofError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            id="register-submit-btn"
            disabled={isRegisterDisabled}
            className="w-full py-3 rounded-xl bg-[#006b2c] hover:bg-[#00873a] hover:-translate-y-0.5 hover:shadow-lg hover:brightness-105 active:translate-y-0 active:scale-[0.99] text-white font-semibold text-[14px] shadow-md transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-md disabled:hover:brightness-100"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span>Creating FreshCart Profile...</span>
              </div>
            ) : (
              <>
                <span>Register Now</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Existing account link */}
        <div className="bg-white/20 backdrop-blur-xs px-6 sm:px-7 py-4 border-t border-white/50 text-center">
          <p className="text-[13px] text-[#565e74]">
            Already have an account?{' '}
            <button
              type="button"
              id="goto-login-btn"
              onClick={onNavigateToLogin}
              className="font-bold text-[#006b2c] hover:underline cursor-pointer"
            >
              Sign In to Your Account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
