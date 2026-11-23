import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CartItem, CustomerOrder, Coupon, DeliveryChargeRule } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatINR } from '../utils/currency';
import { useLanguage } from '../context/LanguageContext';
import { DEFAULT_DELIVERY_RULES, getApplicableDeliveryChargeRule } from '../services/settingsService';
import { loadRazorpaySdk } from '../utils/razorpayLoader';
import { PaymentApiService } from '../services/paymentApiService';
import {
  CheckCircle,
  Banknote,
  MapPin,
  Clock,
  ShieldCheck,
  CreditCard,
  ArrowLeft,
  ArrowRight,
  ShoppingBag,
  Truck,
  Smartphone,
  Check,
  ChevronRight,
  Edit3,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { Footer } from './Footer';

interface CheckoutPageProps {
  items: CartItem[];
  appliedCoupon: string | null;
  onClearCart: () => void;
  onOrderPlaced?: (items: CartItem[], placedOrder?: CustomerOrder) => void;
  coupons?: Coupon[];
  onApplyCoupon?: (code: string) => void;
  onRemoveCoupon?: () => void;
  deliveryCharges?: number;
  deliveryRules?: DeliveryChargeRule[];
  onBackToCart: () => void;
  onNavigateToDashboard?: () => void;
  onNavigateToStorefront?: () => void;
  onOpenAdmin: () => void;
  onSelectCategory: (category: string) => void;
  onOpenLogin: () => void;
  onOpenDashboard: () => void;
}

export const CheckoutPage: React.FC<CheckoutPageProps> = ({
  items,
  appliedCoupon,
  onClearCart,
  onOrderPlaced,
  coupons = [],
  deliveryCharges = 40,
  deliveryRules,
  onBackToCart,
  onNavigateToDashboard,
  onNavigateToStorefront,
  onOpenAdmin,
  onSelectCategory,
  onOpenLogin,
  onOpenDashboard,
}) => {
  const { currentUser, addOrder } = useAuth();
  const { t } = useLanguage();

  // Primary Screen State
  const [step, setStep] = useState<'details' | 'success'>(() => {
    try {
      const savedStep = sessionStorage.getItem('freshcart_checkout_view_step');
      if (savedStep === 'success') return 'success';
    } catch {}
    return 'details';
  });
  // Stepper: 1. Recipient & Delivery -> 2. Order Items & Summary -> 3. Payment Method
  const [checkoutStep, setCheckoutStep] = useState<'delivery' | 'summary' | 'payment'>('delivery');

  // Recipient Details State
  const [recipientName, setRecipientName] = useState(currentUser?.name || 'Raju');
  const [recipientPhone, setRecipientPhone] = useState(currentUser?.phone || '9676164364');
  const [recipientEmail, setRecipientEmail] = useState(currentUser?.email || 'somaraju2006jangala@gmail.com');
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Delivery Address State
  const [address, setAddress] = useState(
    currentUser?.address || '5-168, Ramalayam, Burrilanka, Rjy, AP - 533126'
  );
  const [addressError, setAddressError] = useState<string | null>(null);
  const [deliveryNote, setDeliveryNote] = useState('Express Cold-Chain Delivery, 24–30 Minutes');

  // Payment Selection State
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'razorpay' | 'cod'>('razorpay');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [paymentAttemptCount, setPaymentAttemptCount] = useState(0);
  const [confirmedOrderDetails, setConfirmedOrderDetails] = useState<CustomerOrder | null>(() => {
    try {
      const saved = sessionStorage.getItem('freshcart_last_confirmed_order');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const updateConfirmedOrder = (order: CustomerOrder) => {
    setConfirmedOrderDetails(order);
    try {
      sessionStorage.setItem('freshcart_last_confirmed_order', JSON.stringify(order));
      sessionStorage.setItem('freshcart_checkout_view_step', 'success');
    } catch {}
  };

  const handleNavigateAway = (callback?: () => void) => {
    try {
      sessionStorage.removeItem('freshcart_checkout_view_step');
      sessionStorage.removeItem('freshcart_last_confirmed_order');
    } catch {}
    callback?.();
  };

  const isSubmittingRef = useRef(false);
  const activeRzpInstanceRef = useRef<any>(null);

  // Stable Order Number generated once per checkout session
  const [orderNumber] = useState(() => String(Math.floor(1000 + Math.random() * 9000)));
  const formattedOrderId = `#FC-${orderNumber}`;

  // Pre-load Razorpay SDK in the background when checkout mounts
  useEffect(() => {
    loadRazorpaySdk().catch(() => {});
  }, []);

  useEffect(() => {
    if (currentUser?.address) setAddress(currentUser.address);
    if (currentUser?.name) setRecipientName(currentUser.name);
    if (currentUser?.phone) setRecipientPhone(currentUser.phone);
    if (currentUser?.email) setRecipientEmail(currentUser.email);
  }, [currentUser]);

  // Cart Calculations
  const totalItemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce(
    (sum, item) => sum + (item.selectedPrice ?? item.product.price) * item.quantity,
    0
  );

  const activeCoupon = appliedCoupon
    ? coupons.find((c) => c.code.toUpperCase() === appliedCoupon.toUpperCase() && c.isActive)
    : null;
  const discountPercent = activeCoupon ? activeCoupon.discountPercentage : 0;
  const discount = Math.round((subtotal * discountPercent) / 100);

  // Delivery Charges calculation based on custom admin-controlled rules
  const effectiveRules =
    deliveryRules && deliveryRules.length > 0 ? deliveryRules : DEFAULT_DELIVERY_RULES;

  const applicableDeliveryRule =
    items.length > 0 && subtotal > 0
      ? getApplicableDeliveryChargeRule(effectiveRules, subtotal)
      : null;

  const deliveryChargesAmount =
    items.length > 0 && subtotal > 0 && applicableDeliveryRule
      ? applicableDeliveryRule.deliveryCharge
      : items.length > 0
      ? deliveryCharges
      : 0;

  // Final total displayed at checkout
  const total = Math.max(0, Math.round((subtotal - discount + deliveryChargesAmount) * 100) / 100);

  // Validation & Navigation: Step 1 -> Step 2
  const handleContinueToSummary = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let hasError = false;

    if (!recipientName.trim()) {
      setNameError('Recipient name is required.');
      hasError = true;
    } else {
      setNameError(null);
    }

    const cleanPhone = recipientPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setPhoneError('Please enter a valid 10-digit mobile number.');
      hasError = true;
    } else {
      setPhoneError(null);
    }

    if (!address.trim()) {
      setAddressError('Please enter a delivery address to proceed.');
      hasError = true;
    } else {
      setAddressError(null);
    }

    if (hasError) return;

    setCheckoutStep('summary');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Switching between COD and Razorpay resets active flags cleanly
  const handleSelectPaymentMethod = (method: 'razorpay' | 'cod') => {
    setSelectedPaymentMethod(method);
    setIsSubmitting(false);
    isSubmittingRef.current = false;
    setIsVerifyingPayment(false);
  };

  // Navigation: Step 2 -> Step 3 (Payment Method)
  const handleContinueToPayment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (items.length === 0) return;
    setCheckoutStep('payment');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Back Navigation Helpers
  const handleBackToDelivery = () => {
    setCheckoutStep('delivery');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToSummary = () => {
    setCheckoutStep('summary');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * Cash on Delivery Placement
   */
  const handlePlaceCodOrder = async () => {
    if (items.length === 0 || isSubmitting || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const customerPhone = recipientPhone.trim() || currentUser?.phone?.trim() || '';

      const newCustomerOrder: CustomerOrder = {
        id: formattedOrderId,
        customerId: currentUser?.id || 'guest_user',
        customerName: recipientName.trim() || currentUser?.name || 'Guest Customer',
        customerEmail: recipientEmail.trim() || currentUser?.email || undefined,
        customerPhone: customerPhone || undefined,
        deliveryAddress: address.trim(),
        deliveryTimeSlot: deliveryNote || 'Express Cold-Chain Delivery, 24–30 Minutes',
        estimatedDeliveryTime: 'Express Cold-Chain Delivery',
        items: [...items],
        subtotal,
        discount,
        total,
        couponCode: appliedCoupon || undefined,
        status: 'CONFIRMED',
        createdAt: new Date().toISOString(),
        paymentMethod: 'Cash on Delivery',
        paymentStatus: 'PENDING_COLLECTION',
      };

      // Persist order in FreshCart backend
      await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {}),
        },
        body: JSON.stringify({
          ...newCustomerOrder,
          confirmed: true,
        }),
      }).catch((e) => console.warn('[Checkout] Order persist notice:', e.message));

      addOrder(newCustomerOrder);
      onOrderPlaced?.(items, newCustomerOrder);
      updateConfirmedOrder(newCustomerOrder);
      setStep('success');
      onClearCart();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error('[Checkout] Error placing COD order:', err);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  /**
   * Razorpay Online Payment Checkout Flow
   * 1. Loads Razorpay Standard Checkout modal
   * 2. Authoritatively calculates order total on server (never trusts client amount)
   * 3. Launches checkout modal
   * 4. Cryptographically verifies HMAC-SHA256 signature with backend
   * 5. Confirms order only after verified payment
   */
  const handleRazorpayPayment = async () => {
    if (items.length === 0 || isSubmitting || isSubmittingRef.current || isVerifyingPayment) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    // Clean up any stale active instance
    if (activeRzpInstanceRef.current && typeof activeRzpInstanceRef.current.close === 'function') {
      try {
        activeRzpInstanceRef.current.close();
      } catch (e) {
        // ignore
      }
      activeRzpInstanceRef.current = null;
    }

    try {
      // 1. Ensure Razorpay SDK is loaded
      const isLoaded = await loadRazorpaySdk();
      if (!isLoaded || typeof window.Razorpay !== 'function') {
        throw new Error('Unable to load Razorpay payment SDK. Please verify your internet connection.');
      }

      // 2. Prepare customer details
      const customerName = recipientName.trim() || currentUser?.name || 'Customer';
      const customerEmail = recipientEmail.trim() || currentUser?.email || 'customer@freshcart.com';
      const customerPhone = recipientPhone.trim() || currentUser?.phone || '9876543210';

      // 3. Unique payment attempt identifier for backend idempotency & retry tracking
      const attemptOrderId = paymentAttemptCount === 0
        ? formattedOrderId
        : `${formattedOrderId}-R${paymentAttemptCount}`;

      console.log(`[Checkout] Initiating payment attempt: ${attemptOrderId} (Base: ${formattedOrderId})`);

      // 4. Request server-calculated Razorpay Order ID from backend
      const rzpOrderResponse = await PaymentApiService.createOrder({
        freshcart_order_id: attemptOrderId,
        items: items.map((it) => ({
          id: it.product.id,
          title: it.product.title,
          price: it.selectedPrice ?? it.product.price,
          quantity: it.quantity,
          selectedPackSize: it.selectedPackSize,
        })),
        appliedCoupon,
        deliveryAddress: address,
        customer: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
        },
      });

      if (!rzpOrderResponse || !rzpOrderResponse.razorpay_order_id) {
        throw new Error('Failed to obtain verified payment order from server.');
      }

      const verifiedRazorpayOrderId = rzpOrderResponse.razorpay_order_id;
      const keyId = rzpOrderResponse.key_id;

      // 5. Draft order payload - preserving base FreshCart order ID and authoritative total!
      const authoritativeOrderTotal = (rzpOrderResponse.authoritativeTotal !== undefined && rzpOrderResponse.authoritativeTotal !== null && Number(rzpOrderResponse.authoritativeTotal) > 0)
        ? Number(rzpOrderResponse.authoritativeTotal)
        : total;

      const orderDraftPayload: CustomerOrder = {
        id: formattedOrderId,
        customerId: currentUser?.id || 'guest_user',
        customerName,
        customerEmail,
        customerPhone,
        deliveryAddress: address.trim(),
        deliveryTimeSlot: deliveryNote || 'Express Cold-Chain Delivery, 24–30 Minutes',
        estimatedDeliveryTime: 'Express Cold-Chain Delivery',
        items: [...items],
        subtotal,
        discount,
        total: authoritativeOrderTotal,
        couponCode: appliedCoupon || undefined,
        status: 'CONFIRMED',
        createdAt: new Date().toISOString(),
        paymentMethod: 'Online Payment (Razorpay)',
        paymentStatus: 'PAID',
        razorpayOrderId: verifiedRazorpayOrderId,
      };

      // 6. Open Razorpay Standard Checkout popup modal
      const options = {
        key: keyId,
        amount: rzpOrderResponse.amount_in_paise || Math.round(total * 100),
        currency: rzpOrderResponse.currency || 'INR',
        name: 'FreshCart Grocery',
        description: `Order ${formattedOrderId} Payment`,
        image: 'https://cdn-icons-png.flaticon.com/512/3724/3724720.png',
        order_id: verifiedRazorpayOrderId,
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone,
        },
        theme: {
          color: '#006b2c',
        },
        modal: {
          ondismiss: () => {
            console.log('[Razorpay] Checkout modal dismissed by user.');
            setIsSubmitting(false);
            isSubmittingRef.current = false;
            activeRzpInstanceRef.current = null;
            // Advance attempt counter so next retry uses a fresh attempt ID
            setPaymentAttemptCount((prev) => prev + 1);
          },
        },
        handler: async (response: any) => {
          console.log('[Razorpay] Payment response received:', response);
          setIsVerifyingPayment(true);

          try {
            // Authoritative server-side HMAC-SHA256 signature verification
            const verifyResult = await PaymentApiService.verifyPayment({
              freshcart_order_id: attemptOrderId,
              razorpay_order_id: response.razorpay_order_id || verifiedRazorpayOrderId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              orderData: {
                ...orderDraftPayload,
                id: formattedOrderId,
              },
            });

            if (verifyResult && verifyResult.verified) {
              const rawVerifiedAmount = verifyResult.amount;
              let verifiedTotal = authoritativeOrderTotal;

              if (rawVerifiedAmount !== undefined && rawVerifiedAmount !== null && Number(rawVerifiedAmount) > 0) {
                const numAmount = Number(rawVerifiedAmount);
                // Ensure conversion happens exactly once if returned amount is in paise (100 paise = 1 INR)
                if (authoritativeOrderTotal > 0 && Math.round(numAmount) === Math.round(authoritativeOrderTotal * 100)) {
                  verifiedTotal = Math.round((numAmount / 100) * 100) / 100;
                } else {
                  verifiedTotal = numAmount;
                }
              }

              const fullyConfirmedOrder: CustomerOrder = {
                ...orderDraftPayload,
                id: formattedOrderId,
                status: 'CONFIRMED',
                paymentMethod: 'Online Payment (Razorpay)',
                paymentStatus: 'PAID',
                total: verifiedTotal,
                razorpayOrderId: response.razorpay_order_id || verifiedRazorpayOrderId,
                razorpayPaymentId: response.razorpay_payment_id,
                transactionId: verifyResult.transaction_id || response.razorpay_payment_id,
                verifiedAt: new Date().toISOString(),
              };

              addOrder(fullyConfirmedOrder);
              onOrderPlaced?.(items, fullyConfirmedOrder);
              updateConfirmedOrder(fullyConfirmedOrder);
              setStep('success');
              onClearCart();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              console.error('[Razorpay] Payment verification failed:', verifyResult);
              setPaymentAttemptCount((prev) => prev + 1);
            }
          } catch (verifyErr: any) {
            console.error('[Razorpay] Signature verification error:', verifyErr);
            setPaymentAttemptCount((prev) => prev + 1);
          } finally {
            setIsSubmitting(false);
            setIsVerifyingPayment(false);
            isSubmittingRef.current = false;
            activeRzpInstanceRef.current = null;
          }
        },
      };

      const rzpInstance = new window.Razorpay(options);

      rzpInstance.on('payment.failed', (failResp: any) => {
        console.warn('[Razorpay] Payment failed:', failResp);
        setIsSubmitting(false);
        isSubmittingRef.current = false;
        activeRzpInstanceRef.current = null;
        setPaymentAttemptCount((prev) => prev + 1);
      });

      activeRzpInstanceRef.current = rzpInstance;
      rzpInstance.open();
    } catch (err: any) {
      console.error('[Razorpay] Launch error:', err);
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      activeRzpInstanceRef.current = null;
      setPaymentAttemptCount((prev) => prev + 1);
    }
  };

  return (
    <div id="checkout-page-container" className="checkout-container w-full flex flex-col min-h-screen text-slate-100">
      <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-4 sm:space-y-4.5">
        {/* STEP: ORDER CONFIRMED SCREEN */}
        {step === 'success' ? (
          <div className="checkout-panel rounded-3xl p-6 sm:p-10 max-w-2xl mx-auto my-6 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle className="w-9 h-9" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-bold text-white font-display">
                Order Confirmed!
              </h2>
              <p className="text-sm text-slate-300">
                Your order <span className="font-bold text-white">{formattedOrderId}</span> has been
                registered successfully.
              </p>
            </div>

            {/* Order & Payment Recap Card */}
            <div className="checkout-subpanel rounded-2xl p-4 text-left text-xs text-slate-300 space-y-3">
              <div className="flex items-center gap-2 text-white font-semibold">
                <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Delivery Address</span>
              </div>
              <p className="pl-6 text-slate-300">{confirmedOrderDetails?.deliveryAddress || address}</p>

              <div className="flex items-center gap-2 text-white font-semibold pt-1">
                <Truck className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Estimated Delivery</span>
              </div>
              <p className="pl-6 text-slate-300">Express Cold-Chain Delivery, 24–30 Minutes</p>

              <div className="flex items-center gap-2 text-white font-semibold pt-1">
                {confirmedOrderDetails?.paymentMethod?.includes('Razorpay') ? (
                  <CreditCard className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Banknote className="w-4 h-4 text-cyan-400 shrink-0" />
                )}
                <span>Payment Information</span>
              </div>
              <div className="pl-6 space-y-1 text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">Method:</span>
                  <span>{confirmedOrderDetails?.paymentMethod || 'Cash on Delivery'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">Status:</span>
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    {confirmedOrderDetails?.paymentStatus === 'PAID'
                      ? 'Paid & Authoritatively Verified'
                      : 'Pending Collection (Doorstep)'}
                  </span>
                </div>
                {confirmedOrderDetails?.razorpayPaymentId && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">Razorpay Payment ID:</span>
                    <span className="font-mono text-cyan-300 text-[11px]">{confirmedOrderDetails.razorpayPaymentId}</span>
                  </div>
                )}
                {confirmedOrderDetails?.transactionId && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">Transaction Reference:</span>
                    <span className="font-mono text-slate-400 text-[11px]">{confirmedOrderDetails.transactionId}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <span className="font-medium text-white">Total Amount:</span>
                  <span className="font-bold text-emerald-400 text-sm">
                    {formatINR(
                      (confirmedOrderDetails && typeof confirmedOrderDetails.total === 'number' && confirmedOrderDetails.total > 0)
                        ? confirmedOrderDetails.total
                        : (total > 0 ? total : 0)
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleNavigateAway(onNavigateToDashboard)}
                className="flex-1 py-3 px-4 rounded-xl checkout-neon-btn text-white text-sm font-bold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>View Order in Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleNavigateAway(onNavigateToStorefront)}
                className="py-3 px-5 rounded-xl checkout-subpanel hover:bg-slate-800 text-white text-sm font-semibold transition-all cursor-pointer"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        ) : (
          /* STEP: DETAILS & CHECKOUT FLOW */
          <>
            {/* STEPPER PROGRESS HEADER */}
            <div className="checkout-panel rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {checkoutStep === 'delivery' ? (
                  <button
                    type="button"
                    id="checkout-back-to-cart-btn"
                    onClick={() => handleNavigateAway(onBackToCart)}
                    className="w-10 h-10 rounded-full bg-slate-900/90 border border-white/15 hover:border-cyan-400 hover:bg-slate-800 text-cyan-400 transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-sm active:scale-95"
                    title="Return to Cart"
                  >
                    <ArrowLeft className="w-5 h-5 text-cyan-400" />
                  </button>
                ) : checkoutStep === 'summary' ? (
                  <button
                    type="button"
                    id="checkout-back-to-delivery-btn"
                    data-testid="checkout-back-to-delivery-btn"
                    onClick={handleBackToDelivery}
                    className="w-10 h-10 rounded-full bg-slate-900/90 border border-white/15 hover:border-cyan-400 hover:bg-slate-800 text-cyan-400 transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-sm active:scale-95"
                    title="Back to Delivery Details"
                  >
                    <ArrowLeft className="w-5 h-5 text-cyan-400" />
                  </button>
                ) : (
                  <button
                    type="button"
                    id="checkout-back-to-summary-btn"
                    onClick={handleBackToSummary}
                    className="w-10 h-10 rounded-full bg-slate-900/90 border border-white/15 hover:border-cyan-400 hover:bg-slate-800 text-cyan-400 transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-sm active:scale-95"
                    title="Back to Order Items"
                  >
                    <ArrowLeft className="w-5 h-5 text-cyan-400" />
                  </button>
                )}
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-display">
                    {checkoutStep === 'delivery'
                      ? 'Recipient & Delivery Details'
                      : checkoutStep === 'summary'
                      ? 'Order Items & Summary'
                      : 'Payment Method'}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                    {checkoutStep === 'delivery'
                      ? 'Step 1 of 3: Enter recipient information and delivery address'
                      : checkoutStep === 'summary'
                      ? 'Step 2 of 3: Review items, quantities, and bill breakdown'
                      : 'Step 3 of 3: Select payment method and place your order'}
                  </p>
                </div>
              </div>

              {/* Stepper Badges */}
              <div className="flex items-center gap-1.5 sm:gap-2 self-start sm:self-auto bg-slate-950/80 p-1.5 px-3 rounded-xl border border-white/10 overflow-x-auto max-w-full">
                {/* Step 1 Badge */}
                <button
                  type="button"
                  onClick={() => setCheckoutStep('delivery')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    checkoutStep === 'delivery'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-300 hover:text-white cursor-pointer'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      checkoutStep === 'delivery'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-emerald-500/30 text-emerald-300'
                    }`}
                  >
                    {checkoutStep !== 'delivery' ? '✓' : '1'}
                  </span>
                  <span className="whitespace-nowrap">1. Delivery</span>
                </button>

                <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />

                {/* Step 2 Badge */}
                <button
                  type="button"
                  onClick={() => {
                    if (checkoutStep === 'delivery') handleContinueToSummary();
                    else setCheckoutStep('summary');
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    checkoutStep === 'summary'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : checkoutStep === 'payment'
                      ? 'text-slate-300 hover:text-white cursor-pointer'
                      : 'text-slate-500 cursor-default'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      checkoutStep === 'summary'
                        ? 'bg-emerald-500 text-slate-950'
                        : checkoutStep === 'payment'
                        ? 'bg-emerald-500/30 text-emerald-300'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {checkoutStep === 'payment' ? '✓' : '2'}
                  </span>
                  <span className="whitespace-nowrap">2. Summary</span>
                </button>

                <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />

                {/* Step 3 Badge */}
                <button
                  type="button"
                  onClick={() => {
                    if (checkoutStep === 'summary') handleContinueToPayment();
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    checkoutStep === 'payment'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-500 cursor-default'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      checkoutStep === 'payment'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    3
                  </span>
                  <span className="whitespace-nowrap">3. Payment</span>
                </button>
              </div>
            </div>

            {/* ================================================================= */}
            {/* STEP 1: RECIPIENT & DELIVERY DETAILS */}
            {/* ================================================================= */}
            {checkoutStep === 'delivery' && (
              <div className="space-y-4 sm:space-y-4.5 animate-fadeIn">
                <div className="checkout-panel rounded-2xl p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                      <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight font-display">
                        Recipient & Delivery Details
                      </h2>
                    </div>
                    <span className="text-xs text-slate-400">Step 1 of 3</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    {/* Recipient Full Name */}
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5 font-normal">
                        Recipient Full Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={recipientName}
                        onChange={(e) => {
                          setRecipientName(e.target.value);
                          if (nameError) setNameError(null);
                        }}
                        placeholder="e.g. Somaraju Jangala"
                        className="checkout-input w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none"
                      />
                      {nameError && <p className="text-[11px] text-rose-400 mt-1">{nameError}</p>}
                    </div>

                    {/* Mobile Phone Number */}
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5 font-normal">
                        Mobile Phone Number (10 Digits) <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="tel"
                        value={recipientPhone}
                        onChange={(e) => {
                          setRecipientPhone(e.target.value);
                          if (phoneError) setPhoneError(null);
                        }}
                        placeholder="e.g. 9676164364"
                        className="checkout-input w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none"
                      />
                      {phoneError && <p className="text-[11px] text-rose-400 mt-1">{phoneError}</p>}
                    </div>

                    {/* Email Address */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-slate-400 mb-1.5 font-normal">
                        Email Address (For Order Receipts & Razorpay Payment Invoice)
                      </label>
                      <input
                        type="email"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        placeholder="e.g. somaraju2006jangala@gmail.com"
                        className="checkout-input w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none"
                      />
                    </div>

                    {/* Delivery Address */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-slate-400 mb-1.5 font-normal">
                        Delivery Street Address <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => {
                          setAddress(e.target.value);
                          if (addressError) setAddressError(null);
                        }}
                        placeholder="Enter full doorstep delivery address (House No, Street, Landmark, Pin)"
                        className="checkout-input w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none"
                      />
                      {addressError && <p className="text-[11px] text-rose-400 mt-1">{addressError}</p>}
                    </div>

                    {/* Delivery Instructions */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-slate-400 mb-1.5 font-normal">
                        Delivery Instructions / Special Notes (Optional)
                      </label>
                      <input
                        type="text"
                        value={deliveryNote}
                        onChange={(e) => setDeliveryNote(e.target.value)}
                        placeholder="e.g. Express Cold-Chain Delivery, 24–30 Minutes"
                        className="checkout-input w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Step 1 Bottom Action Bar */}
                <div className="checkout-panel rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">
                        Cart Total ({totalItemCount} {totalItemCount === 1 ? 'item' : 'items'})
                      </p>
                      <p className="text-xl font-extrabold text-[#00e699] tabular-nums font-display">
                        {formatINR(total)}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    id="checkout-continue-btn"
                    data-testid="checkout-continue-btn"
                    onClick={handleContinueToSummary}
                    className="py-3.5 px-8 rounded-xl checkout-neon-btn text-white text-sm sm:text-base font-bold shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
                  >
                    <span>Continue to Order Items & Summary</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* STEP 2: ORDER ITEMS & FINANCIAL BREAKDOWN */}
            {/* ================================================================= */}
            {checkoutStep === 'summary' && (
              <div className="space-y-4 sm:space-y-4.5 animate-fadeIn">
                {/* Delivery Details Recap */}
                <div className="checkout-panel rounded-2xl p-5 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                      <h2 className="text-sm sm:text-base font-semibold text-white tracking-tight font-display">
                        Delivery Destination & Recipient
                      </h2>
                    </div>
                    <button
                      type="button"
                      id="checkout-edit-delivery-btn"
                      onClick={handleBackToDelivery}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Details</span>
                    </button>
                  </div>

                  <div className="checkout-subpanel rounded-xl p-3.5 space-y-2 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div>
                        <span className="text-slate-400">Recipient: </span>
                        <span className="font-semibold text-white">{recipientName}</span>
                        <span className="text-slate-400"> • Phone: </span>
                        <span className="font-semibold text-white">{recipientPhone}</span>
                      </div>
                      {recipientEmail && (
                        <div className="text-slate-400">
                          <span>Email: </span>
                          <span className="text-slate-300">{recipientEmail}</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-slate-400 text-[11px]">Address:</p>
                      <p className="font-medium text-white">{address}</p>
                    </div>
                  </div>
                </div>

                {/* Items List & Summary */}
                <div className="checkout-panel rounded-2xl p-5 sm:p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-cyan-400 shrink-0" />
                      <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight font-display">
                        Order Items & Summary
                      </h2>
                    </div>
                    <span className="text-xs text-slate-400">
                      {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
                    </span>
                  </div>

                  {/* Items List */}
                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {items.map((item) => {
                      const itemPackSize = item.selectedPackSize || item.product.unit;
                      const itemPrice = item.selectedPrice ?? item.product.price;

                      return (
                        <div
                          key={`${item.product.id}-${itemPackSize}`}
                          className="flex items-center gap-3.5 checkout-subpanel p-3.5 rounded-xl text-xs"
                        >
                          <img
                            src={item.product.image}
                            alt={item.product.title}
                            className="w-14 h-14 rounded-lg object-cover bg-slate-900 border border-white/10 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold truncate sm:text-sm">{item.product.title}</p>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-400 text-[11px] mt-1">
                              <span>Pack Size: <span className="text-emerald-400 font-medium">{itemPackSize}</span></span>
                              <span>•</span>
                              <span>Qty: <span className="text-white font-medium">{item.quantity}</span></span>
                              <span>•</span>
                              <span>Price: <span className="text-slate-300 font-medium">{formatINR(itemPrice)}</span></span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400">Item Total</p>
                            <p className="font-bold text-white tabular-nums sm:text-sm">
                              {formatINR(itemPrice * item.quantity)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Financial Breakdown */}
                  <div className="checkout-subpanel rounded-xl p-4 sm:p-5 space-y-3">
                    <div className="flex justify-between items-center text-xs sm:text-sm text-slate-300">
                      <span>Subtotal ({totalItemCount} {totalItemCount === 1 ? 'item' : 'items'})</span>
                      <span className="font-semibold text-white tabular-nums">{formatINR(subtotal)}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs sm:text-sm text-slate-300">
                      <span>Delivery Charges</span>
                      <span
                        className={`tabular-nums ${
                          deliveryChargesAmount > 0
                            ? 'font-semibold text-white'
                            : 'text-emerald-400 font-semibold'
                        }`}
                      >
                        {items.length === 0
                          ? '₹0'
                          : deliveryChargesAmount > 0
                          ? formatINR(deliveryChargesAmount)
                          : 'FREE'}
                      </span>
                    </div>

                    {discount > 0 && activeCoupon && (
                      <div className="flex justify-between items-center text-xs sm:text-sm text-emerald-400 font-medium">
                        <span>Discount ({activeCoupon.discountPercentage}% OFF - {activeCoupon.code})</span>
                        <span className="tabular-nums font-semibold">-{formatINR(discount)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-baseline pt-3 border-t border-white/10">
                      <div>
                        <span className="text-base sm:text-lg font-bold text-white">Final Payable Amount</span>
                        <p className="text-[11px] text-slate-400">Inclusive of all applicable taxes</p>
                      </div>
                      <span className="text-2xl sm:text-3xl font-extrabold text-[#00e699] tabular-nums font-display">
                        {formatINR(total)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Step 2 Bottom Action Bar */}
                <div className="checkout-panel rounded-2xl p-4 sm:p-6 flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                      type="button"
                      id="checkout-back-to-delivery-btn-bottom"
                      onClick={handleBackToDelivery}
                      className="flex-1 sm:flex-none py-3 px-5 rounded-xl checkout-subpanel hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 border border-white/15"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back to Details</span>
                    </button>
                    <button
                      type="button"
                      id="checkout-return-to-cart-btn"
                      onClick={onBackToCart}
                      className="py-3 px-4 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 text-xs sm:text-sm font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>Return to Cart</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    id="checkout-proceed-to-payment-btn"
                    data-testid="checkout-confirm-order-btn"
                    disabled={items.length === 0}
                    onClick={handleContinueToPayment}
                    className="w-full sm:w-auto py-3.5 px-8 rounded-xl checkout-neon-btn text-white text-sm sm:text-base font-bold shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    <span>Proceed to Payment ({formatINR(total)})</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* STEP 3: PAYMENT METHOD SELECTION & CHECKOUT */}
            {/* ================================================================= */}
            {checkoutStep === 'payment' && (
              <div className="space-y-4 sm:space-y-4.5 animate-fadeIn">
                {/* Order Summary Snapshot */}
                <div className="checkout-panel rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-400">Order ID: <span className="font-semibold text-white">{formattedOrderId}</span></p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Delivering to: <span className="text-slate-200">{address}</span>
                    </p>
                  </div>
                  <div className="text-right self-start sm:self-auto">
                    <p className="text-xs text-slate-400">Total Payable</p>
                    <p className="text-2xl font-extrabold text-[#00e699] font-display">{formatINR(total)}</p>
                  </div>
                </div>

                {/* Payment Options Selection Card */}
                <div className="checkout-panel rounded-2xl p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-cyan-400 shrink-0" />
                      <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight font-display">
                        Choose Payment Method
                      </h2>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                      <Lock className="w-3 h-3" />
                      <span>256-Bit SSL Encrypted</span>
                    </div>
                  </div>

                  <div className="space-y-3 pt-1">
                    {/* OPTION 1: ONLINE PAYMENT (RAZORPAY) */}
                    <div
                      onClick={() => handleSelectPaymentMethod('razorpay')}
                      className={`rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer ${
                        selectedPaymentMethod === 'razorpay'
                          ? 'bg-emerald-950/30 border-emerald-500 shadow-md ring-1 ring-emerald-500/50'
                          : 'checkout-subpanel border-white/10 hover:border-white/25 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                              selectedPaymentMethod === 'razorpay'
                                ? 'border-emerald-400 bg-emerald-500'
                                : 'border-slate-500'
                            }`}
                          >
                            {selectedPaymentMethod === 'razorpay' && (
                              <div className="w-2 h-2 rounded-full bg-slate-950" />
                            )}
                          </div>
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm sm:text-base font-bold text-white">
                                Online Payment (Razorpay)
                              </h3>
                              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Recommended
                              </span>
                            </div>
                            <p className="text-xs text-slate-300">
                              Instant order confirmation via UPI (Google Pay, PhonePe, Paytm, BHIM), Credit/Debit Cards, NetBanking, and Wallets.
                            </p>
                            <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px] text-slate-400">
                              <span className="px-2 py-0.5 bg-slate-800/80 rounded border border-white/10">UPI / QR</span>
                              <span className="px-2 py-0.5 bg-slate-800/80 rounded border border-white/10">Google Pay</span>
                              <span className="px-2 py-0.5 bg-slate-800/80 rounded border border-white/10">PhonePe</span>
                              <span className="px-2 py-0.5 bg-slate-800/80 rounded border border-white/10">Cards</span>
                              <span className="px-2 py-0.5 bg-slate-800/80 rounded border border-white/10">NetBanking</span>
                            </div>
                          </div>
                        </div>

                        <div className="hidden sm:flex flex-col items-end shrink-0">
                          <span className="text-xs font-semibold text-emerald-400">Zero Extra Fee</span>
                          <span className="text-[10px] text-slate-400">Instant Verification</span>
                        </div>
                      </div>
                    </div>

                    {/* OPTION 2: CASH ON DELIVERY (COD) */}
                    <div
                      onClick={() => handleSelectPaymentMethod('cod')}
                      className={`rounded-2xl p-4 sm:p-5 border transition-all cursor-pointer ${
                        selectedPaymentMethod === 'cod'
                          ? 'bg-emerald-950/30 border-emerald-500 shadow-md ring-1 ring-emerald-500/50'
                          : 'checkout-subpanel border-white/10 hover:border-white/25 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                              selectedPaymentMethod === 'cod'
                                ? 'border-emerald-400 bg-emerald-500'
                                : 'border-slate-500'
                            }`}
                          >
                            {selectedPaymentMethod === 'cod' && (
                              <div className="w-2 h-2 rounded-full bg-slate-950" />
                            )}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm sm:text-base font-bold text-white">
                                Cash on Delivery (COD)
                              </h3>
                            </div>
                            <p className="text-xs text-slate-300">
                              Pay upon doorstep grocery handover via cash or doorstep UPI scan.
                            </p>
                          </div>
                        </div>

                        <div className="hidden sm:flex flex-col items-end shrink-0">
                          <span className="text-xs font-semibold text-slate-300">Doorstep Handover</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Security Assurance Box */}
                  <div className="p-3.5 bg-slate-950/60 border border-white/10 rounded-xl flex items-center gap-2.5 text-xs text-slate-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Transactions are cryptographically verified by our authoritative backend before order confirmation.
                    </span>
                  </div>
                </div>

                {/* Step 3 Bottom Action Bar */}
                <div className="checkout-panel rounded-2xl p-4 sm:p-6 flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={handleBackToSummary}
                    disabled={isSubmitting || isVerifyingPayment}
                    className="w-full sm:w-auto py-3 px-5 rounded-xl checkout-subpanel hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 border border-white/15"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Order Summary</span>
                  </button>

                  {selectedPaymentMethod === 'razorpay' ? (
                    <button
                      type="button"
                      id="checkout-pay-razorpay-btn"
                      disabled={isSubmitting || isVerifyingPayment}
                      onClick={handleRazorpayPayment}
                      className="w-full sm:w-auto py-3.5 px-8 rounded-xl checkout-neon-btn text-white text-sm sm:text-base font-bold shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isVerifyingPayment ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Verifying Payment Signature...</span>
                        </>
                      ) : isSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Connecting to Razorpay...</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" />
                          <span>Pay with Razorpay ({formatINR(total)})</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      id="checkout-place-cod-btn"
                      disabled={isSubmitting}
                      onClick={handlePlaceCodOrder}
                      className="w-full sm:w-auto py-3.5 px-8 rounded-xl checkout-neon-btn text-white text-sm sm:text-base font-bold shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Placing Order...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>Confirm Place Order (COD {formatINR(total)})</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <Footer
        onOpenAdmin={onOpenAdmin}
        onSelectCategory={onSelectCategory}
        onOpenLogin={onOpenLogin}
        onOpenDashboard={onOpenDashboard}
      />
    </div>
  );
};
