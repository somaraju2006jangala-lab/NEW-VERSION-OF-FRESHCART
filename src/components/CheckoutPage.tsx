import React, { useState, useEffect, useMemo } from 'react';
import { CartItem, CustomerOrder, Coupon, DeliveryChargeRule } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatINR } from '../utils/currency';
import { useLanguage } from '../context/LanguageContext';
import { DEFAULT_DELIVERY_RULES, getApplicableDeliveryChargeRule } from '../services/settingsService';
import { updateOrderPaymentStatus } from '../services/authService';
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
  QrCode,
  Smartphone,
  AlertCircle,
  ExternalLink,
  Upload,
  X,
  Check,
  Copy,
  AlertTriangle,
  Image as ImageIcon,
  ChevronRight,
  Edit3,
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
  const [step, setStep] = useState<'details' | 'success'>('details');
  const [checkoutStep, setCheckoutStep] = useState<'delivery' | 'summary'>('delivery');
  const [address, setAddress] = useState(
    currentUser?.address || '742 Evergreen Terrace, Apt 4B'
  );
  const [addressError, setAddressError] = useState<string | null>(null);
  const [deliveryNote, setDeliveryNote] = useState('Leave with doorman in thermal tote');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = React.useRef(false);
  const [showItemsList, setShowItemsList] = useState(false);

  // Stable Order Number generated once per checkout session
  const [orderNumber] = useState(() => String(Math.floor(1000 + Math.random() * 9000)));
  const formattedOrderId = `#FC-${orderNumber}`;
  const rawOrderId = `FC-${orderNumber}`;

  useEffect(() => {
    if (currentUser?.address) {
      setAddress(currentUser.address);
    }
  }, [currentUser]);

  const totalItemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce(
    (sum, item) => sum + (item.selectedPrice ?? item.product.price) * item.quantity,
    0
  );

  const activeCoupon = appliedCoupon
    ? coupons.find(
        (c) => c.code.toUpperCase() === appliedCoupon.toUpperCase() && c.isActive
      )
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

  // Final total already displayed to the customer at checkout
  const total = Math.max(0, Math.round((subtotal - discount + deliveryChargesAmount) * 100) / 100);

  const handleContinueToSummary = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!address.trim()) {
      setAddressError('Please enter a delivery address to proceed.');
      return;
    }
    setAddressError(null);
    setCheckoutStep('summary');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToDelivery = () => {
    setCheckoutStep('delivery');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePlaceOrder = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (items.length === 0) return;
    if (isSubmitting || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    setTimeout(async () => {
      try {
        const customerPhone = currentUser?.phone?.trim() || '';

        // Save order to customer account history
        const newCustomerOrder: CustomerOrder = {
          id: formattedOrderId,
          customerId: currentUser?.id || 'guest_user',
          customerName: currentUser?.name || 'Guest Customer',
          customerEmail: currentUser?.email,
          customerPhone: customerPhone || undefined,
          deliveryAddress: address,
          deliveryTimeSlot: 'Express Cold-Chain Delivery, 24–30 Minutes',
          estimatedDeliveryTime: 'Express Cold-Chain Delivery',
          items: [...items],
          subtotal,
          discount,
          total,
          couponCode: appliedCoupon || undefined,
          status: 'Picking',
          createdAt: new Date().toISOString(),
          paymentMethod: 'Cash on Delivery',
          paymentStatus: 'PENDING_COLLECTION',
        };

        if (currentUser?.id) {
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
          }).catch(() => {});
        }

        addOrder(newCustomerOrder);
        onOrderPlaced?.(items, newCustomerOrder);
        setStep('success');
        onClearCart();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err: any) {
        console.error('[Checkout] Error placing order:', err);
      } finally {
        setIsSubmitting(false);
        isSubmittingRef.current = false;
      }
    }, 300);
  };

  return (
    <div id="checkout-page-container" className="checkout-container w-full flex flex-col min-h-screen text-slate-100">
      <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-4 sm:space-y-4.5">
        {/* Step: Order Confirmed Screen */}
        {step === 'success' ? (
          <div className="checkout-panel rounded-3xl p-6 sm:p-10 max-w-2xl mx-auto my-6 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle className="w-9 h-9" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-bold text-white font-display">
                Order Received!
              </h2>
              <p className="text-sm text-slate-300">
                Your order <span className="font-bold text-white">{formattedOrderId}</span> has been
                registered successfully.
              </p>
            </div>

            {/* Delivery Details Recap */}
            <div className="checkout-subpanel rounded-2xl p-4 text-left text-xs text-slate-300 space-y-2.5">
              <div className="flex items-center gap-2 text-white font-semibold">
                <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Delivery Address</span>
              </div>
              <p className="pl-6 text-slate-400">{address}</p>

              <div className="flex items-center gap-2 text-white font-semibold pt-1">
                <Truck className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Estimated Delivery</span>
              </div>
              <p className="pl-6 text-slate-400">Express Cold-Chain Delivery, 24–30 Minutes</p>

              <div className="flex items-center gap-2 text-white font-semibold pt-1">
                <Banknote className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Payment Method</span>
              </div>
              <p className="pl-6 text-slate-400">Cash on Delivery (Pay upon doorstep grocery handover)</p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => onNavigateToDashboard?.()}
                className="flex-1 py-3 px-4 rounded-xl checkout-neon-btn text-white text-sm font-bold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>View Order in Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigateToStorefront?.()}
                className="py-3 px-5 rounded-xl checkout-subpanel hover:bg-slate-800 text-white text-sm font-semibold transition-all cursor-pointer"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        ) : (
          /* Step: Details (Separated into Page 1: Delivery Details, Page 2: Select Payment Method, Page 3: Order Items & Summary) */
          <>
            {/* CHECKOUT STEPPER HEADER */}
            <div className="checkout-panel rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {checkoutStep === 'delivery' ? (
                  <button
                    type="button"
                    id="checkout-back-to-cart-btn"
                    onClick={onBackToCart}
                    className="w-10 h-10 rounded-full bg-slate-900/90 border border-white/15 hover:border-cyan-400 hover:bg-slate-800 text-cyan-400 transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-sm active:scale-95"
                    title="Return to Cart"
                  >
                    <ArrowLeft className="w-5 h-5 text-cyan-400" />
                  </button>
                ) : (
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
                )}
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-display">
                    {checkoutStep === 'delivery'
                      ? 'Delivery Details'
                      : 'Order Items & Summary'}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                    {checkoutStep === 'delivery'
                      ? 'Step 1 of 2: Provide your delivery address and schedule'
                      : 'Step 2 of 2: Review your order items and confirm order'}
                  </p>
                </div>
              </div>

              {/* Stepper Progress Badges: 1. Delivery Details → 2. Order Items & Summary */}
              <div className="flex items-center gap-1.5 sm:gap-2 self-start sm:self-auto bg-slate-950/80 p-1.5 px-3 rounded-xl border border-white/10 overflow-x-auto max-w-full">
                {/* Step 1: Delivery Details */}
                <button
                  type="button"
                  onClick={() => {
                    if (checkoutStep !== 'delivery') handleBackToDelivery();
                  }}
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
                  <span className="whitespace-nowrap">1. Delivery Details</span>
                </button>

                <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />

                {/* Step 2: Order Items & Summary */}
                <button
                  type="button"
                  onClick={() => {
                    if (checkoutStep === 'delivery') {
                      handleContinueToSummary();
                    }
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    checkoutStep === 'summary'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-500 cursor-default'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      checkoutStep === 'summary'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    2
                  </span>
                  <span className="whitespace-nowrap">2. Order Items & Summary</span>
                </button>
              </div>
            </div>

            {/* PAGE 1: DELIVERY DETAILS (Step 1) */}
            {checkoutStep === 'delivery' && (
              <div className="space-y-4 sm:space-y-4.5 animate-fadeIn">
                <div className="checkout-panel rounded-2xl p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                      <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight font-display">
                        Delivery Address & Notes
                      </h2>
                    </div>
                    <span className="text-xs text-slate-400">Step 1 of 3</span>
                  </div>

                  {addressError && (
                    <div className="p-3 bg-rose-950/50 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{addressError}</span>
                    </div>
                  )}

                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5 font-normal">
                        Delivery Address <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => {
                          setAddress(e.target.value);
                          if (addressError) setAddressError(null);
                        }}
                        placeholder="Enter delivery street address"
                        className="checkout-input w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5 font-normal">
                        Delivery Instructions / Special Notes (Optional)
                      </label>
                      <input
                        type="text"
                        value={deliveryNote}
                        onChange={(e) => setDeliveryNote(e.target.value)}
                        placeholder="e.g. Leave with doorman in thermal tote"
                        className="checkout-input w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Page 1 Bottom Bar: Cart Total Preview & Continue */}
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

            {/* PAGE 2: ORDER ITEMS & SUMMARY (Step 2) */}
            {checkoutStep === 'summary' && (
              <div className="space-y-4 sm:space-y-4.5 animate-fadeIn">
                {/* 1. DELIVERY DETAILS RECAP */}
                <div className="checkout-panel rounded-2xl p-5 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                      <h2 className="text-sm sm:text-base font-semibold text-white tracking-tight font-display">
                        Delivery Destination
                      </h2>
                    </div>
                    <button
                      type="button"
                      id="checkout-edit-delivery-btn"
                      onClick={handleBackToDelivery}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Address & Notes</span>
                    </button>
                  </div>

                  <div className="checkout-subpanel rounded-xl p-3.5 space-y-2 text-xs">
                    <div>
                      <p className="text-slate-400 text-[11px]">Address:</p>
                      <p className="font-medium text-white">{address}</p>
                    </div>
                    {deliveryNote && (
                      <div>
                        <p className="text-slate-400 text-[11px]">Instructions / Notes:</p>
                        <p className="text-slate-300 italic">{deliveryNote}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. ORDER ITEMS & FINANCIAL BREAKDOWN */}
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
                      <span className="font-semibold text-white tabular-nums">
                        {formatINR(subtotal)}
                      </span>
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

                {/* 3. STEP 2 ACTION BAR */}
                <div className="checkout-panel rounded-2xl p-4 sm:p-6 flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                      type="button"
                      id="checkout-back-to-delivery-btn-bottom"
                      data-testid="checkout-back-to-delivery-btn"
                      onClick={handleBackToDelivery}
                      className="flex-1 sm:flex-none py-3 px-5 rounded-xl checkout-subpanel hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 border border-white/15"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back to Delivery Details</span>
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
                    id="checkout-place-order-btn"
                    data-testid="checkout-confirm-order-btn"
                    disabled={items.length === 0 || isSubmitting}
                    onClick={handlePlaceOrder}
                    className="w-full sm:w-auto py-3.5 px-8 rounded-xl checkout-neon-btn text-white text-sm sm:text-base font-bold shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Processing Order...</span>
                      </>
                    ) : (
                      <>
                        <span>Confirm Place Order ({formatINR(total)})</span>
                        <CheckCircle className="w-4 h-4" />
                      </>
                    )}
                  </button>
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
