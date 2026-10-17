import React, { useState, useEffect, useRef } from 'react';
import { Product, CustomerOrder } from '../types';
import { formatINR } from '../utils/currency';
import { formatOrderDateTime } from '../utils/date';
import { useLanguage } from '../context/LanguageContext';
import {
  ArrowLeft,
  Search,
  CheckCircle,
  AlertTriangle,
  Check,
  X,
  ShoppingBag,
  Copy,
  Calendar,
  ShieldCheck,
  KeyRound,
  CreditCard,
  Mail,
  RefreshCw,
  Phone,
  ChevronDown,
  Banknote,
  RotateCcw,
} from 'lucide-react';
import {
  generateOrderOtp,
  verifyOrderOtp,
  resendOrderOtp,
  getOrderOtpStatus,
  maskMobileNumber,
  OtpStatusResult,
} from '../services/otpClientService';
import {
  getCustomerPhoneForOrder,
  confirmCodCashCollection,
  fetchAllOrdersFromBackend,
  getStoredAdminToken,
} from '../services/authService';
import { getStoredEmployeeToken } from '../services/employeeService';
import {
  formatIndianDisplayNumber,
  validateIndianMobileNumber,
} from '../services/registrationOtpService';
import {
  getDisplayPaymentInfo,
  parseHistoryPeriod,
  getCutoffDate,
  parseOrderDate,
  SixDigitAdminOtpInput,
  ParsedHistoryPeriod,
} from './AdminPortal';

export interface CustomerOrdersLedgerProps {
  userRole: 'admin' | 'employee';
  customerOrders?: CustomerOrder[];
  onUpdateOrderStatus?: (
    orderId: string,
    status: string,
    extraMeta?: { otpVerifiedAt?: string; handoverReleased?: boolean }
  ) => void;
  currentUserName?: string;
}

export const CustomerOrdersLedger: React.FC<CustomerOrdersLedgerProps> = ({
  userRole,
  customerOrders,
  onUpdateOrderStatus,
  currentUserName,
}) => {
  const { t } = useLanguage();

  // Search & Filters
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [showOrderStatusDropdown, setShowOrderStatusDropdown] = useState(false);
  const orderStatusDropdownRef = useRef<HTMLDivElement>(null);

  // History search state
  const [historySearchInput, setHistorySearchInput] = useState<string>('');
  const [activeHistoryPeriod, setActiveHistoryPeriod] = useState<ParsedHistoryPeriod | null>(null);
  const [historySearchError, setHistorySearchError] = useState<string | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // Orders list state & synchronization
  const [ordersList, setOrdersList] = useState<CustomerOrder[]>(customerOrders || []);
  const [isConfirmingCash, setIsConfirmingCash] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (customerOrders && customerOrders.length > 0) {
      setOrdersList(customerOrders);
    }
  }, [customerOrders]);

  useEffect(() => {
    fetchAllOrdersFromBackend().then((orders) => {
      if (Array.isArray(orders) && orders.length > 0) {
        setOrdersList(orders);
      }
    });
  }, []);

  // OTP Verification States
  const [orderOtpInputs, setOrderOtpInputs] = useState<Record<string, string>>({});
  const [orderVerifying, setOrderVerifying] = useState<Record<string, boolean>>({});
  const [orderOtpFeedback, setOrderOtpFeedback] = useState<
    Record<string, { type: 'success' | 'error' | 'expired'; message: string; remainingAttempts?: number }>
  >({});
  const [selectedOtpOrderId, setSelectedOtpOrderId] = useState<string | null>(null);
  const selectedOtpOrder = selectedOtpOrderId
    ? ordersList.find((o) => o.id === selectedOtpOrderId)
    : null;
  const [orderOtpStatusMap, setOrderOtpStatusMap] = useState<Record<string, OtpStatusResult>>({});
  const [isSendingOtp, setIsSendingOtp] = useState<Record<string, boolean>>({});
  const [expandedOtpOrders, setExpandedOtpOrders] = useState<Record<string, boolean>>({});
  const [resendCooldown, setResendCooldown] = useState<Record<string, number>>({});

  // Countdown timer for resend OTP cooldown
  useEffect(() => {
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        let changed = false;
        const next: Record<string, number> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (v > 1) {
            next[k] = v - 1;
            changed = true;
          } else if (v === 1) {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        orderStatusDropdownRef.current &&
        !orderStatusDropdownRef.current.contains(e.target as Node)
      ) {
        setShowOrderStatusDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch OTP status for selected order
  useEffect(() => {
    if (!selectedOtpOrderId) return;
    getOrderOtpStatus(selectedOtpOrderId, { role: userRole }).then((status) => {
      if (status) {
        setOrderOtpStatusMap((prev) => ({ ...prev, [selectedOtpOrderId]: status }));
      }
    });
  }, [selectedOtpOrderId, userRole]);

  // Fetch OTP status for active ledger orders
  useEffect(() => {
    const eligibleOrders = ordersList.filter((o) => {
      if (o.status === 'Delivered') return false;
      const isCod =
        !o.paymentMethod ||
        o.paymentMethod.toLowerCase().includes('cash') ||
        o.paymentMethod.toUpperCase() === 'COD';
      if (isCod) return false; // COD orders never use OTP
      const isCompleted =
        o.paymentStatus === 'COMPLETED' || o.paymentStatus === 'PAID';
      return isCompleted;
    });

    eligibleOrders.forEach((o) => {
      getOrderOtpStatus(o.id, { role: userRole }).then((status) => {
        if (status) {
          setOrderOtpStatusMap((prev) => ({ ...prev, [o.id]: status }));
        }
      });
    });
  }, [ordersList, userRole]);

  const formatOrderProductItem = (item: { product: Product; quantity: number }) => {
    const qty = item.quantity;
    const unit = item.product.unit || 'unit';
    let unitFormatted = '';

    if (qty === 1) {
      unitFormatted = unit;
    } else if (/^1\s+[a-zA-Z]+$/i.test(unit)) {
      const unitName = unit.replace(/^1\s+/i, '');
      unitFormatted = `${qty} ${unitName}`;
    } else {
      unitFormatted = `${qty} × ${unit}`;
    }

    const linePrice = formatINR(item.product.price * qty);
    return {
      title: item.product.title,
      qtyAndUnit: unitFormatted,
      linePrice,
      lineText: `${item.product.title} — ${unitFormatted} — ${linePrice}`,
    };
  };

  const handleCustomHistorySearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = historySearchInput.trim();
    if (!trimmed) {
      setHistorySearchError("Please enter a period, e.g. '1 week', '3 months', '6 months', '1 year', or 'all'.");
      return;
    }
    const parsed = parseHistoryPeriod(trimmed);
    if (!parsed) {
      setHistorySearchError("Invalid period. Please enter e.g. '1 week', '2 weeks', '3 months', '6 months', '1 year', or 'all'.");
      return;
    }
    setHistorySearchError(null);
    setActiveHistoryPeriod(parsed);
  };

  const handleClearHistorySearch = () => {
    setHistorySearchInput('');
    setActiveHistoryPeriod(null);
    setHistorySearchError(null);
  };

  const handleOtpInputChange = (orderId: string, value: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 6);
    setOrderOtpInputs((prev) => ({ ...prev, [orderId]: clean }));
    if (orderOtpFeedback[orderId]) {
      setOrderOtpFeedback((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    }
  };

  const handleVerifyOtp = async (order: CustomerOrder) => {
    if (order.status === 'Delivered') {
      return;
    }
    const enteredOtp = (orderOtpInputs[order.id] || '').trim();
    if (!enteredOtp || enteredOtp.length !== 6) {
      setOrderOtpFeedback((prev) => ({
        ...prev,
        [order.id]: {
          type: 'error',
          message: 'Invalid OTP.',
        },
      }));
      return;
    }

    setOrderVerifying((prev) => ({ ...prev, [order.id]: true }));
    try {
      const res = await verifyOrderOtp(order.id, enteredOtp);
      if (res.success && res.status === 'Delivered') {
        const verifiedTime = res.verifiedAt || new Date().toISOString();
        setOrderOtpFeedback((prev) => ({
          ...prev,
          [order.id]: {
            type: 'success',
            message: 'OTP Verified. Order completed.',
          },
        }));
        if (onUpdateOrderStatus) {
          onUpdateOrderStatus(order.id, 'Delivered', {
            otpVerifiedAt: verifiedTime,
            handoverReleased: true,
          });
        }
        setOrdersList((prev) =>
          prev.map((o) =>
            o.id === order.id ? { ...o, status: 'Delivered', otpVerifiedAt: verifiedTime } : o
          )
        );
        setOrderOtpStatusMap((prev) => ({
          ...prev,
          [order.id]: {
            ...(prev[order.id] || {}),
            status: 'USED',
            verifiedAt: verifiedTime,
            hasRecord: true,
            orderId: order.id,
            maskedPhone: prev[order.id]?.maskedPhone || 'Customer mobile',
            expiresAt: prev[order.id]?.expiresAt || 0,
            isExpired: false,
            providerConfigured: true,
          },
        }));
        setOrderOtpInputs((prev) => {
          const next = { ...prev };
          delete next[order.id];
          return next;
        });
      } else {
        if (res.isExpired) {
          setOrderOtpFeedback((prev) => ({
            ...prev,
            [order.id]: {
              type: 'expired',
              message: 'OTP expired. Please send a new OTP.',
            },
          }));
        } else {
          setOrderOtpFeedback((prev) => ({
            ...prev,
            [order.id]: {
              type: 'error',
              message:
                res.remainingAttempts !== undefined
                  ? `Invalid OTP. (${res.remainingAttempts} attempt${res.remainingAttempts === 1 ? '' : 's'} remaining)`
                  : 'Invalid OTP.',
              remainingAttempts: res.remainingAttempts,
            },
          }));
        }
      }
    } catch {
      setOrderOtpFeedback((prev) => ({
        ...prev,
        [order.id]: {
          type: 'error',
          message: 'Invalid OTP.',
        },
      }));
    } finally {
      setOrderVerifying((prev) => ({ ...prev, [order.id]: false }));
    }
  };

  const handleResendOtp = async (order: CustomerOrder) => {
    if (isSendingOtp[order.id] || (resendCooldown[order.id] || 0) > 0) return;
    const rawPhone = getCustomerPhoneForOrder(order);
    setIsSendingOtp((prev) => ({ ...prev, [order.id]: true }));
    try {
      const res = await resendOrderOtp(
        order.id,
        order.customerId || 'guest',
        rawPhone || ''
      );
      if (res.success) {
        setResendCooldown((prev) => ({ ...prev, [order.id]: 15 }));
        setOrderOtpInputs((prev) => ({ ...prev, [order.id]: '' }));
        setOrderOtpFeedback((prev) => ({
          ...prev,
          [order.id]: {
            type: 'success',
            message: 'Fresh 6-digit OTP dispatched to customer. Previous code invalidated.',
          },
        }));
        const updatedStatus = await getOrderOtpStatus(order.id, { role: userRole });
        if (updatedStatus) {
          setOrderOtpStatusMap((prev) => ({ ...prev, [order.id]: updatedStatus }));
        }
      } else {
        setOrderOtpFeedback((prev) => ({
          ...prev,
          [order.id]: {
            type: 'error',
            message: res.error || res.message || 'Failed to resend OTP.',
          },
        }));
      }
    } catch {
      setOrderOtpFeedback((prev) => ({
        ...prev,
        [order.id]: {
          type: 'error',
          message: 'Error communicating with server to resend OTP.',
        },
      }));
    } finally {
      setIsSendingOtp((prev) => ({ ...prev, [order.id]: false }));
    }
  };

  const handleConfirmCashCollection = async (orderId: string) => {
    if (userRole !== 'admin' && userRole !== 'employee') return; // Authorized employee or admin only
    const target = ordersList.find(
      (o) => o.id === orderId || o.id.replace(/^#/, '') === orderId.replace(/^#/, '')
    );
    if (target && (target.paymentStatus === 'COLLECTED' || getDisplayPaymentInfo(target).paymentStatus === 'COLLECTED')) {
      return; // Prevent duplicate cash-collection confirmations
    }

    setIsConfirmingCash((prev) => ({ ...prev, [orderId]: true }));
    try {
      const res = await confirmCodCashCollection(orderId);
      if (res.success) {
        const verifiedAt = res.verifiedAt || new Date().toISOString();
        const staffName = res.verifiedBy || currentUserName || (userRole === 'employee' ? 'Operations Employee' : 'Admin');
        setOrdersList((prev) =>
          prev.map((o) => {
            const oClean = o.id.replace(/^#/, '');
            const cleanId = orderId.replace(/^#/, '');
            return oClean === cleanId
              ? {
                  ...o,
                  paymentStatus: 'COLLECTED',
                  verifiedAt,
                  verifiedBy: staffName,
                }
              : o;
          })
        );
        if (onUpdateOrderStatus) {
          const found = ordersList.find(
            (o) => o.id === orderId || o.id.replace(/^#/, '') === orderId.replace(/^#/, '')
          );
          if (found) {
            onUpdateOrderStatus(orderId, found.status, {
              paymentStatus: 'COLLECTED',
              verifiedAt,
              verifiedBy: staffName,
            } as any);
          }
        }
      }
    } finally {
      setIsConfirmingCash((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const periodDisplayMessage = activeHistoryPeriod ? activeHistoryPeriod.displayMessage : null;

  const filteredOrders = ordersList
    .filter((order) => {
      const q = orderSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        order.id.toLowerCase().includes(q) ||
        order.customerName.toLowerCase().includes(q) ||
        (order.customerId && order.customerId.toLowerCase().includes(q)) ||
        (order.customerEmail && order.customerEmail.toLowerCase().includes(q)) ||
        order.items.some((it) => it.product.title.toLowerCase().includes(q));

      const matchesStatus =
        orderStatusFilter === 'all' ||
        order.status.toLowerCase() === orderStatusFilter.toLowerCase();

      if (activeHistoryPeriod) {
        const cutoff = getCutoffDate(activeHistoryPeriod);
        if (cutoff) {
          const orderDate = parseOrderDate(order.createdAt);
          if (!orderDate) return false;
          if (orderDate.getTime() < cutoff.getTime()) {
            return false;
          }
        }
      }

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const timeA = parseOrderDate(a.createdAt)?.getTime() || 0;
      const timeB = parseOrderDate(b.createdAt)?.getTime() || 0;
      return timeB - timeA;
    });

  // Dedicated OTP Page
  if (selectedOtpOrder) {
    const displayOrderId = selectedOtpOrder.id.startsWith('#')
      ? selectedOtpOrder.id
      : `#${selectedOtpOrder.id}`;
    const cleanOrderId = selectedOtpOrder.id.replace(/^#/, '');
    const rawPhone = getCustomerPhoneForOrder(selectedOtpOrder);
    const displayMobile =
      formatIndianDisplayNumber(rawPhone) || rawPhone || 'Not available';
    const validatedPhone = validateIndianMobileNumber(rawPhone);
    const maskedMobile =
      validatedPhone.isValid && validatedPhone.normalized
        ? maskMobileNumber(validatedPhone.normalized)
        : rawPhone && rawPhone.trim().length >= 4
        ? `******${rawPhone.replace(/\D/g, '').slice(-4)}`
        : 'Not available';
    const paymentInfo = getDisplayPaymentInfo(selectedOtpOrder);
    const otpStatus = orderOtpStatusMap[selectedOtpOrder.id];
    const isDelivered = selectedOtpOrder.status === 'Delivered';
    const hasOtpRecord = Boolean(otpStatus?.hasRecord || selectedOtpOrder.otpVerifiedAt);
    const isExpired = otpStatus?.isExpired || otpStatus?.status === 'EXPIRED';
    const isLocked = otpStatus?.status === 'LOCKED';
    const isSending = isSendingOtp[selectedOtpOrder.id] || false;
    const isVerifying = orderVerifying[selectedOtpOrder.id] || false;
    const currentFeedback = orderOtpFeedback[selectedOtpOrder.id];

    return (
      <div
        id={`dedicated-otp-page-${cleanOrderId}`}
        className="relative rounded-2xl overflow-hidden border border-white/[0.12] bg-[#05070c]/90 backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.15)] p-4 sm:p-7 space-y-6 transition-all duration-200"
      >
        {/* Ambient liquid lighting */}
        <div className="pointer-events-none absolute -top-32 -right-32 w-80 h-80 bg-emerald-500/12 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {/* Top Navigation Bar */}
        <div className="relative flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
          <button
            type="button"
            id="back-to-customer-orders-btn"
            onClick={() => setSelectedOtpOrderId(null)}
            className="px-3.5 py-1.5 rounded-xl border border-white/15 bg-black/40 hover:bg-black/60 text-slate-200 hover:text-white text-[13px] font-semibold flex items-center gap-2 cursor-pointer transition-all shadow-[0_4px_16px_rgba(0,0,0,0.4)] backdrop-blur-md hover:border-white/25"
          >
            <ArrowLeft className="w-4 h-4 text-[#10b981]" />
            <span>Back to Customer Orders</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-lg border border-white/10 bg-white/[0.04] text-[12px] font-medium text-slate-300 font-mono">
              Customer Orders Ledger &rsaquo; Order {displayOrderId} &rsaquo; OTP Verification
            </span>
          </div>
        </div>

        {/* Header Title Section */}
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-[#10b981] flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.25)]">
              <ShieldCheck className="w-6 h-6 text-[#10b981]" />
            </div>
            <div>
              <h3 className="text-[22px] font-bold text-white font-display tracking-tight flex items-center gap-2">
                <span>Order Handover OTP Verification</span>
              </h3>
              <p className="text-[12px] text-slate-400 mt-0.5">
                Verify customer 6-digit code for physical order handover authorization
              </p>
            </div>
          </div>

          {/* Quick status pills */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span
              className={`px-2.5 py-1 rounded-full text-[12px] font-bold border font-mono ${
                isDelivered
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40'
                  : 'bg-amber-950/60 text-amber-400 border-amber-500/40'
              }`}
            >
              ● Status: {selectedOtpOrder.status}
            </span>
            <span className="px-2.5 py-1 rounded-full text-[12px] font-bold border font-mono bg-emerald-950/60 text-[#10b981] border-[#10b981]/40">
              ● Payment: {paymentInfo.paymentStatus}
            </span>
          </div>
        </div>

        {/* Two-Column Grid: Order Details & OTP Controls */}
        <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Panel 1: Order & Customer Information */}
          <div className="rounded-xl border border-white/10 bg-black/60 backdrop-blur-xl p-5 sm:p-6 space-y-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h4 className="text-[14px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[#10b981]" />
                <span>Order & Customer Details</span>
              </h4>
              <span className="text-[11px] font-mono text-slate-400">
                {formatOrderDateTime(selectedOtpOrder.createdAt)}
              </span>
            </div>

            <div className="space-y-3 font-mono text-[13px]">
              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="font-semibold text-slate-400">Order ID:</span>
                <span id="otp-page-order-id" className="font-bold text-[#10b981] text-[14px]">
                  {displayOrderId}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="font-semibold text-slate-400">Customer Name:</span>
                <span id="otp-page-customer-name" className="font-bold text-white font-sans text-[14px]">
                  {selectedOtpOrder.customerName}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="font-semibold text-slate-400">Customer ID:</span>
                <span id="otp-page-customer-id" className="font-semibold text-slate-200">
                  {selectedOtpOrder.customerId || 'N/A'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="font-semibold text-slate-400">Customer Mobile:</span>
                <span id="otp-page-customer-mobile" className="font-bold text-white tracking-wider flex items-center gap-1.5 font-sans">
                  <Phone className="w-3.5 h-3.5 text-[#10b981]" />
                  <span>{displayMobile}</span>
                  {maskedMobile !== 'Not available' && (
                    <span className="text-[11px] text-slate-400 font-mono">({maskedMobile})</span>
                  )}
                </span>
              </div>

              {selectedOtpOrder.customerEmail && (
                <div className="flex items-center justify-between py-1 border-b border-white/5">
                  <span className="font-semibold text-slate-400">Customer Email:</span>
                  <span id="otp-page-customer-email" className="text-slate-200 font-sans text-[12px] flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedOtpOrder.customerEmail}</span>
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="font-semibold text-slate-400">Order Total:</span>
                <span className="font-bold text-[#10b981] text-[14px]">
                  {formatINR(selectedOtpOrder.total)}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="font-semibold text-slate-400">Payment Method:</span>
                <span id="otp-page-payment-method" className="font-bold text-white flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-[#10b981]" />
                  <span>{paymentInfo.paymentMethod}</span>
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="font-semibold text-slate-400">Payment Status:</span>
                <span
                  id="otp-page-payment-status"
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[12px] font-bold border border-emerald-500/50 bg-[#064e3b]/50 text-[#10b981]"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                  <span>{paymentInfo.paymentStatus}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Panel 2: Dedicated OTP Handover & Verification */}
          <div className="rounded-xl border border-white/10 bg-black/60 backdrop-blur-xl p-5 sm:p-6 space-y-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <h4 className="text-[14px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#10b981]" />
                  <span>Customer Code Verification</span>
                </h4>
                <span className="text-[11px] font-mono text-emerald-400 font-bold">
                  {hasOtpRecord ? 'OTP ACTIVE' : 'NO OTP GENERATED'}
                </span>
              </div>

              {isDelivered ? (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-[14px]">
                    <CheckCircle className="w-5 h-5 text-[#10b981]" />
                    <span>Order Successfully Delivered</span>
                  </div>
                  <p className="text-[12px] text-emerald-400/90 font-mono">
                    OTP Handover was successfully authorized and verified on{' '}
                    {selectedOtpOrder.otpVerifiedAt
                      ? formatOrderDateTime(selectedOtpOrder.otpVerifiedAt)
                      : 'system handover'}
                    .
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="separate-otp-input"
                      className="block text-[13px] font-bold text-white mb-1.5"
                    >
                      Enter Customer Handover Code
                    </label>
                    <p className="text-[12px] text-slate-400 mb-3">
                      Request the 6-digit code shown on the customer's device to confirm order delivery.
                    </p>

                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <SixDigitAdminOtpInput
                          idPrefix="separate-otp"
                          value={orderOtpInputs[selectedOtpOrder.id] || ''}
                          onChange={(val) => handleOtpInputChange(selectedOtpOrder.id, val)}
                          disabled={isVerifying}
                          autoFocus
                        />

                        <button
                          type="button"
                          id="separate-otp-verify-btn"
                          onClick={() => handleVerifyOtp(selectedOtpOrder)}
                          disabled={
                            isVerifying ||
                            (orderOtpInputs[selectedOtpOrder.id] || '').length !== 6
                          }
                          className={`h-11 px-5 rounded-xl text-[13px] font-bold shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all flex items-center gap-2 cursor-pointer ${
                            (orderOtpInputs[selectedOtpOrder.id] || '').length === 6 && !isVerifying
                              ? 'bg-gradient-to-r from-[#006b2c] to-[#059669] hover:from-[#005221] hover:to-[#047857] text-white hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]'
                              : 'bg-white/5 border border-white/10 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {isVerifying ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Verifying...</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-4 h-4 text-[#10b981]" />
                              <span>Verify OTP</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          id="separate-otp-resend-btn"
                          onClick={() => handleResendOtp(selectedOtpOrder)}
                          disabled={
                            isVerifying ||
                            isSending ||
                            (resendCooldown[selectedOtpOrder.id] || 0) > 0
                          }
                          title={`Invalidates previous OTP and generates a fresh one for Order ${displayOrderId}`}
                          className="h-11 px-4 rounded-xl text-[13px] font-bold border border-emerald-500/30 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                        >
                          {isSending ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                              <span>Generating...</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                              <span>
                                {(resendCooldown[selectedOtpOrder.id] || 0) > 0
                                  ? `Resend OTP (${resendCooldown[selectedOtpOrder.id]}s)`
                                  : 'Resend OTP'}
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Feedback Messages */}
                  {currentFeedback && (
                    <div
                      id="separate-otp-feedback"
                      className={`text-[12px] p-3 rounded-xl flex items-center justify-between gap-2.5 animate-in fade-in ${
                        currentFeedback.type === 'success'
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 font-bold'
                          : currentFeedback.type === 'expired'
                          ? 'bg-amber-950/60 text-amber-300 border border-amber-500/40 font-semibold'
                          : 'bg-red-950/60 text-red-300 border border-red-500/40 font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {currentFeedback.type === 'success' ? (
                          <CheckCircle className="w-4 h-4 text-[#16a34a] shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-[#dc2626] shrink-0" />
                        )}
                        <span>{currentFeedback.message}</span>
                      </div>
                      {currentFeedback.type === 'expired' && (
                        <button
                          type="button"
                          onClick={() => handleResendOtp(selectedOtpOrder)}
                          disabled={isVerifying || isSending || (resendCooldown[selectedOtpOrder.id] || 0) > 0}
                          className="underline font-bold text-amber-300 hover:text-amber-200 cursor-pointer ml-2 text-[11px] disabled:opacity-50"
                        >
                          Resend OTP
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="text-[11px] font-mono text-slate-400 pt-3 border-t border-white/5 flex items-center justify-between">
              <span>Security: Verified server-side encryption</span>
              <span>Role: {userRole.toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main Ledger View
  return (
    <div className="bg-black/35 backdrop-blur-xl rounded-xl border border-white/12 shadow-2xl p-5 sm:p-6 space-y-6">
      {/* Header & Filter Controls Bar */}
      <div className="pb-4 border-b border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-[18px] font-bold text-white font-display flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#10b981]" />
              <span>Customer Orders Ledger</span>
            </h3>
            <p className="text-[12px] text-[#94a3b8] mt-0.5">
              Live customer orders from store purchases. Deliveries require verified customer handover OTP.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[12px] font-bold border border-emerald-500/30 bg-emerald-950/40 text-emerald-400 font-mono">
              {filteredOrders.length} {filteredOrders.length === 1 ? 'Order' : 'Orders'}
            </span>
          </div>
        </div>

        {/* 3-Zone Filter Controls Bar */}
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-2.5">
          <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-3">
            {/* 1. Search Box on the LEFT */}
            <div className="justify-self-start w-full max-w-[260px]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                <input
                  type="text"
                  id="admin-order-search"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder={t('filterOrdersPlaceholder') || 'Search orders...'}
                  className="w-full h-8 pl-8 pr-7 py-1 border border-white/15 rounded-md text-[12px] bg-black/30 text-white placeholder:text-[#94a3b8] focus:outline-hidden focus:ring-1.5 focus:ring-[#10b981]/40 focus:border-[#10b981]"
                />
                {orderSearch && (
                  <button
                    type="button"
                    onClick={() => setOrderSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 2. All Order Statuses dropdown horizontally CENTERED */}
            <div className="justify-self-center relative" ref={orderStatusDropdownRef}>
              <button
                type="button"
                id="admin-order-status-dropdown-btn"
                aria-haspopup="true"
                aria-expanded={showOrderStatusDropdown}
                onClick={() => setShowOrderStatusDropdown(!showOrderStatusDropdown)}
                className="w-[180px] h-8 px-2.5 py-1 border border-white/15 rounded-md text-[12px] bg-black/40 hover:bg-black/60 text-slate-200 focus:outline-hidden focus:ring-1.5 focus:ring-[#10b981]/40 focus:border-[#10b981] cursor-pointer flex items-center justify-between"
                style={{ backgroundColor: 'rgba(3, 7, 12, 0.96)' }}
              >
                <span className="truncate">
                  {orderStatusFilter === 'all'
                    ? (t('allOrderStatuses') || 'All Statuses')
                    : orderStatusFilter}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#94a3b8] transition-transform duration-200 ${
                    showOrderStatusDropdown ? 'rotate-180 text-[#10b981]' : ''
                  }`}
                />
              </button>

              {showOrderStatusDropdown && (
                <div
                  id="admin-order-status-dropdown-menu"
                  data-dropdown-menu="true"
                  className="freshcart-dropdown-menu absolute left-1/2 -translate-x-1/2 top-full mt-1.5 w-48 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
                  style={{
                    backgroundColor: 'rgba(3, 7, 12, 0.96)',
                    WebkitBackdropFilter: 'blur(16px)',
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  {[
                    { value: 'all', label: t('allOrderStatuses') || 'All Statuses' },
                    { value: 'Picking', label: 'Picking' },
                    { value: 'Delivered', label: 'Delivered' },
                  ].map((opt) => {
                    const isSel = orderStatusFilter === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        id={`admin-order-filter-${opt.value}`}
                        onClick={() => {
                          setOrderStatusFilter(opt.value);
                          setShowOrderStatusDropdown(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[12px] transition-all cursor-pointer ${
                          isSel
                            ? 'freshcart-dropdown-item-active'
                            : 'freshcart-dropdown-item text-slate-100'
                        }`}
                      >
                        <span className={isSel ? 'text-[#10b981] font-semibold' : 'text-slate-100'}>{opt.label}</span>
                        {isSel && <Check className="w-3.5 h-3.5 text-[#10b981]" />}
                      </button>
                    );
                  })}
                </div>
              )}

              <select
                id="admin-order-status-filter"
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              >
                <option value="all">{t('allOrderStatuses') || 'All Statuses'}</option>
                <option value="Picking">Picking</option>
                <option value="Delivered">Delivered</option>
              </select>
            </div>

            {/* 3. Order History on the RIGHT */}
            <div className="justify-self-end">
              <form
                onSubmit={handleCustomHistorySearch}
                className="flex items-center gap-2 shrink-0"
              >
                <label
                  htmlFor="admin-order-custom-history-input"
                  className="text-[12px] font-bold text-slate-300 flex items-center gap-1 shrink-0 whitespace-nowrap"
                >
                  <Calendar className="w-3.5 h-3.5 text-[#10b981]" />
                  <span>Order History:</span>
                </label>

                <div className="relative w-[130px]">
                  <input
                    type="text"
                    id="admin-order-custom-history-input"
                    value={historySearchInput}
                    onChange={(e) => {
                      setHistorySearchInput(e.target.value);
                      if (historySearchError) setHistorySearchError(null);
                    }}
                    placeholder="Enter period"
                    aria-label="Enter period"
                    className={`w-full h-8 pl-2.5 pr-7 py-1 border rounded-md text-[12px] bg-black/30 text-white placeholder:text-[#94a3b8] focus:outline-hidden focus:ring-1.5 ${
                      historySearchError
                        ? 'border-[#ef4444] focus:ring-[#ef4444]/30 focus:border-[#ef4444]'
                        : 'border-white/15 focus:ring-[#10b981]/40 focus:border-[#10b981]'
                    }`}
                  />
                  <button
                    type="submit"
                    id="admin-order-custom-history-search-btn"
                    title="Search"
                    aria-label="Search order history"
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-[#10b981] hover:text-[#34d399] hover:bg-emerald-500/10 rounded transition-colors cursor-pointer flex items-center justify-center"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </button>
                </div>

                {activeHistoryPeriod && (
                  <button
                    type="button"
                    id="admin-order-custom-history-clear-btn"
                    onClick={handleClearHistorySearch}
                    title="Clear period filter"
                    className="h-8 px-2.5 py-1 rounded-md bg-black/30 border border-white/15 hover:bg-black/50 text-[#94a3b8] hover:text-white text-[12px] font-medium transition-colors cursor-pointer shrink-0"
                  >
                    Reset
                  </button>
                )}
              </form>
            </div>
          </div>
        </div>

        {/* Validation Error Message */}
        {historySearchError && (
          <div className="text-[11px] text-[#f87171] font-medium flex items-center gap-1 justify-end pl-1">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>{historySearchError}</span>
          </div>
        )}

        {/* Selected Period Display Badge */}
        {periodDisplayMessage && (
          <div
            id="order-period-display"
            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-emerald-950/30 border border-emerald-500/30 text-[11px] text-emerald-300 font-medium self-end ml-auto max-w-fit backdrop-blur-md"
          >
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
              <span className="font-semibold">{periodDisplayMessage}</span>
            </div>
            <span className="text-[11px] text-emerald-400 font-bold ml-2">
              {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'} found
            </span>
          </div>
        )}
      </div>

      {/* Orders List / Cards */}
      {filteredOrders.length === 0 ? (
        <div className="py-16 text-center text-[#94a3b8]">
          <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-30 text-[#10b981]" />
          <p className="text-[14px] font-semibold text-slate-300">
            {activeHistoryPeriod ? 'No orders found for this period.' : (t('noOrdersFound') || 'No orders found.')}
          </p>
          <p className="text-[12px] text-[#94a3b8] mt-1">
            {activeHistoryPeriod
              ? 'Try widening the time window in the history filter above.'
              : 'Orders placed by customers from the Customer Portal will appear here automatically.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const formattedDateTime = formatOrderDateTime(order.createdAt);
            const displayOrderId = order.id.startsWith('#') ? order.id : `#${order.id}`;
            const cleanOrderId = order.id.replace(/^#/, '');
            const resolvedPhone = getCustomerPhoneForOrder(order);
            const displayMobile =
              formatIndianDisplayNumber(resolvedPhone) || resolvedPhone || 'Not available';
            const paymentInfo = getDisplayPaymentInfo(order);
            const isCod =
              !order.paymentMethod ||
              order.paymentMethod.toLowerCase().includes('cash') ||
              order.paymentMethod.toUpperCase() === 'COD';

            const isOnlineMethod =
              !isCod &&
              (paymentInfo.paymentMethod.toLowerCase().includes('online') ||
                paymentInfo.paymentMethod.toLowerCase().includes('upi') ||
                paymentInfo.paymentMethod.toLowerCase().includes('phonepe') ||
                paymentInfo.paymentMethod.toLowerCase().includes('paytm') ||
                paymentInfo.paymentMethod.toLowerCase().includes('google pay') ||
                paymentInfo.paymentMethod.toLowerCase().includes('gpay'));

            const isCompletedPayment =
              (paymentInfo.paymentStatus === 'COMPLETED' ||
                order.paymentStatus === 'COMPLETED' ||
                order.paymentStatus === 'PAID') &&
              paymentInfo.paymentStatus !== 'PENDING VERIFICATION' &&
              paymentInfo.paymentStatus !== 'REJECTED' &&
              paymentInfo.paymentStatus !== 'UNPAID' &&
              paymentInfo.paymentStatus !== 'COD' &&
              paymentInfo.paymentStatus !== 'PENDING_COLLECTION' &&
              paymentInfo.paymentStatus !== 'COLLECTED';

            const isOtpEligible = !isCod && isOnlineMethod && isCompletedPayment;

            const textLines: string[] = [
              `Customer: ${order.customerName}`,
              `User ID: ${order.customerId || 'N/A'}`,
              `Mobile: ${displayMobile}`,
              `Order ID: ${displayOrderId}`,
            ];
            if (order.customerEmail) {
              textLines.push(`Email: ${order.customerEmail}`);
            }
            textLines.push(`Date & Time: ${formattedDateTime}`);
            if (order.otpVerifiedAt) {
              textLines.push(`OTP Verified At: ${formatOrderDateTime(order.otpVerifiedAt)}`);
            }
            textLines.push('');
            textLines.push('Products:');
            order.items.forEach((item) => {
              const formattedItem = formatOrderProductItem(item);
              textLines.push(`- ${formattedItem.lineText}`);
            });
            textLines.push('');
            textLines.push(`Total: ${formatINR(order.total)}`);
            textLines.push(`Payment Method: ${paymentInfo.paymentMethod}`);
            textLines.push(`Payment Status: ${paymentInfo.paymentStatus}`);
            textLines.push(`Status: ${order.status}`);

            const fullOrderText = textLines.join('\n');

            return (
              <div
                key={order.id}
                className="border border-white/12 rounded-xl p-4 sm:p-5 bg-black/30 backdrop-blur-md hover:bg-black/40 hover:border-white/20 hover:shadow-xl transition-all duration-150 space-y-4"
              >
                {/* Top Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        order.status === 'Picking'
                          ? 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]'
                          : order.status === 'Ordered'
                          ? 'bg-[#dcfce7] text-[#15803d] border-[#86efac]'
                          : order.status === 'Delivered'
                          ? 'bg-[#eff4ff] text-[#1d4ed8] border-[#bfdbfe]'
                          : 'bg-[#f1f5f9] text-[#475569] border-[#cbd5e1]'
                      }`}
                    >
                      ● {order.status}
                    </span>
                    <span
                      id={`order-payment-badge-${cleanOrderId}`}
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold border font-mono ${paymentInfo.badgeStyle.bg} ${paymentInfo.badgeStyle.text} ${paymentInfo.badgeStyle.border}`}
                    >
                      ● {paymentInfo.paymentStatus}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      title="Copy order record text"
                      onClick={() => {
                        navigator.clipboard?.writeText(fullOrderText);
                        setCopiedOrderId(order.id);
                        setTimeout(() => setCopiedOrderId(null), 2000);
                      }}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white bg-black/30 border border-white/15 rounded-lg hover:bg-black/50 transition-colors flex items-center gap-1 cursor-pointer backdrop-blur-xs"
                    >
                      {copiedOrderId === order.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#16a34a]" />
                          <span className="text-[#16a34a]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Record</span>
                        </>
                      )}
                    </button>

                    {/* Confirm Cash Collection: Only visible for authorized employee or admin on COD orders whose cash collection is still pending */}
                    {(userRole === 'admin' || userRole === 'employee') &&
                      isCod &&
                      paymentInfo.paymentStatus !== 'COLLECTED' && (
                        <button
                          type="button"
                          id={`confirm-cash-btn-${cleanOrderId}`}
                          onClick={() => handleConfirmCashCollection(order.id)}
                          disabled={isConfirmingCash[order.id]}
                          title={`Confirm cash collection of ${formatINR(order.total)} for Order ${displayOrderId}`}
                          className="px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:text-white bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs backdrop-blur-xs disabled:opacity-50"
                        >
                          <Banknote className="w-3.5 h-3.5 text-[#10b981]" />
                          <span>{isConfirmingCash[order.id] ? 'Saving...' : 'Confirm Cash Collection'}</span>
                        </button>
                    )}

                    {/* OTP Status & Trigger Buttons */}
                    {isOtpEligible && (
                      <div className="flex items-center gap-1.5">
                        {order.otpVerifiedAt || order.status === 'Delivered' ? (
                          <span
                            id={`order-otp-status-badge-${cleanOrderId}`}
                            title="Order handover OTP verified"
                            className="px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-500/40 bg-emerald-950/40 text-emerald-400 font-mono flex items-center gap-1"
                          >
                            <CheckCircle className="w-3 h-3 text-[#10b981]" />
                            <span>Verified</span>
                          </span>
                        ) : orderOtpStatusMap[order.id]?.isExpired || orderOtpStatusMap[order.id]?.status === 'EXPIRED' ? (
                          <span
                            id={`order-otp-status-badge-${cleanOrderId}`}
                            title="Order handover OTP expired"
                            className="px-2 py-0.5 rounded text-[10px] font-bold border border-amber-500/40 bg-amber-950/40 text-amber-400 font-mono flex items-center gap-1"
                          >
                            <AlertTriangle className="w-3 h-3 text-[#f59e0b]" />
                            <span>Expired</span>
                          </span>
                        ) : (
                          <span
                            id={`order-otp-status-badge-${cleanOrderId}`}
                            title="OTP generated and sent to customer"
                            className="px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 font-mono flex items-center gap-1"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-[#10b981]" />
                            <span>Generated</span>
                          </span>
                        )}

                        {order.status !== 'Delivered' && (
                          <button
                            type="button"
                            id={`order-enter-otp-btn-${cleanOrderId}`}
                            onClick={() => {
                              setExpandedOtpOrders((prev) => ({
                                ...prev,
                                [order.id]: prev[order.id] === false ? true : false,
                              }));
                              if (!orderOtpStatusMap[order.id]) {
                                getOrderOtpStatus(order.id, { role: userRole }).then((st) => {
                                  if (st) setOrderOtpStatusMap((prev) => ({ ...prev, [order.id]: st }));
                                });
                              }
                            }}
                            title={`Enter OTP for Order ${displayOrderId}`}
                            className="px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:text-white bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 rounded-lg transition-all duration-150 flex items-center gap-1.5 cursor-pointer shadow-[0_2px_10px_rgba(16,185,129,0.15)] hover:shadow-[0_4px_16px_rgba(16,185,129,0.3)] backdrop-blur-xs"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-[#10b981]" />
                            <span>Enter OTP</span>
                          </button>
                        )}

                        <button
                          type="button"
                          id={`order-otp-btn-${cleanOrderId}`}
                          onClick={() => setSelectedOtpOrderId(order.id)}
                          title={`Open Dedicated OTP Verification Page for Order ${displayOrderId}`}
                          className="px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:text-white bg-black/40 hover:bg-black/60 border border-white/15 rounded-lg transition-all duration-150 flex items-center gap-1.5 cursor-pointer backdrop-blur-xs"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-[#10b981]" />
                          <span>Details</span>
                        </button>
                      </div>
                    )}

                    {/* Automatic read-only status display */}
                    <div
                      id={`order-status-display-${order.id}`}
                      className={`px-2.5 py-1 text-[11px] font-bold border rounded-lg select-none cursor-default ${
                        order.status === 'Picking'
                          ? 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]'
                          : order.status === 'Delivered'
                          ? 'bg-[#eff4ff] text-[#1d4ed8] border-[#bfdbfe]'
                          : 'bg-[#f1f5f9] text-[#475569] border-[#cbd5e1]'
                      }`}
                    >
                      Status: {order.status}
                    </div>
                  </div>
                </div>

                {/* Structured Order Record Box */}
                <div className="bg-black/25 backdrop-blur-md border border-white/10 rounded-xl p-4 sm:p-5 font-mono text-[13px] text-[#f8fafc] space-y-2 shadow-2xs">
                  <div>
                    <span className="font-semibold text-[#94a3b8]">Customer: </span>
                    <span className="font-bold text-white">{order.customerName}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#94a3b8]">User ID: </span>
                    <span className="font-semibold text-slate-200">{order.customerId || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#94a3b8]">Mobile: </span>
                    <span className="font-semibold text-slate-200">{displayMobile}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#94a3b8]">Order ID: </span>
                    <span className="font-bold text-[#10b981]">{displayOrderId}</span>
                  </div>
                  {order.customerEmail && (
                    <div>
                      <span className="font-semibold text-[#94a3b8]">Email: </span>
                      <span className="text-slate-300">{order.customerEmail}</span>
                    </div>
                  )}
                  <div>
                    <span className="font-semibold text-[#94a3b8]">Date & Time: </span>
                    <span className="font-medium text-slate-200">{formattedDateTime}</span>
                  </div>

                  {order.otpVerifiedAt && (
                    <div>
                      <span className="font-semibold text-[#94a3b8]">OTP Verified At: </span>
                      <span className="font-medium text-[#10b981]">{formatOrderDateTime(order.otpVerifiedAt)}</span>
                    </div>
                  )}
                  <div className="pt-2">
                    <span className="font-semibold text-[#94a3b8] block mb-1">Products:</span>
                    <ul className="space-y-1 pl-2">
                      {order.items.map((item, idx) => {
                        const formattedItem = formatOrderProductItem(item);
                        return (
                          <li key={idx} className="text-slate-200 font-medium">
                            - {formattedItem.title} — {formattedItem.qtyAndUnit} — {formattedItem.linePrice}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div className="pt-2 border-t border-white/10">
                    <span className="font-semibold text-[#94a3b8]">Total: </span>
                    <span className="font-bold text-[#10b981]">{formatINR(order.total)}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#94a3b8]">Payment Method: </span>
                    <span
                      id={`order-payment-method-${cleanOrderId}`}
                      data-payment-method={paymentInfo.paymentMethod}
                      className="font-bold text-white"
                    >
                      {paymentInfo.paymentMethod}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#94a3b8]">Payment Status: </span>
                    <span
                      id={`order-payment-status-${cleanOrderId}`}
                      data-payment-status={paymentInfo.paymentStatus}
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[12px] font-bold border font-mono ${paymentInfo.badgeStyle.bg} ${paymentInfo.badgeStyle.text} ${paymentInfo.badgeStyle.border}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${paymentInfo.badgeStyle.dot}`} />
                      <span>{paymentInfo.paymentStatus}</span>
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#94a3b8]">Status: </span>
                    <span className="font-bold text-[#10b981]">{order.status}</span>
                  </div>
                </div>

                {/* Inline 6-Digit OTP Verification Panel */}
                {isOtpEligible && order.status !== 'Delivered' && expandedOtpOrders[order.id] !== false && (
                  <div
                    id={`order-otp-ledger-panel-${cleanOrderId}`}
                    className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 backdrop-blur-md p-4 sm:p-5 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-[#10b981]" />
                        <span className="text-[13px] font-bold text-white font-display">
                          Customer Delivery Handover OTP
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Enter the 6-digit code shown on the customer's portal
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <SixDigitAdminOtpInput
                        idPrefix={`ledger-otp-${cleanOrderId}`}
                        value={orderOtpInputs[order.id] || ''}
                        onChange={(val) => handleOtpInputChange(order.id, val)}
                        disabled={orderVerifying[order.id]}
                      />

                      <button
                        type="button"
                        id={`order-verify-otp-btn-${cleanOrderId}`}
                        onClick={() => handleVerifyOtp(order)}
                        disabled={
                          orderVerifying[order.id] ||
                          (orderOtpInputs[order.id] || '').length !== 6
                        }
                        className={`h-11 px-4 rounded-xl text-[12px] font-bold shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all flex items-center gap-2 cursor-pointer ${
                          (orderOtpInputs[order.id] || '').length === 6 && !orderVerifying[order.id]
                            ? 'bg-gradient-to-r from-[#006b2c] to-[#059669] hover:from-[#005221] hover:to-[#047857] text-white hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]'
                            : 'bg-white/5 border border-white/10 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {orderVerifying[order.id] ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Verifying...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4 text-[#10b981]" />
                            <span>Verify OTP</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        id={`order-resend-otp-btn-${cleanOrderId}`}
                        onClick={() => handleResendOtp(order)}
                        disabled={
                          orderVerifying[order.id] ||
                          isSendingOtp[order.id] ||
                          (resendCooldown[order.id] || 0) > 0
                        }
                        title={`Invalidates previous OTP and generates a fresh one for Order ${displayOrderId}`}
                        className="h-11 px-3.5 rounded-xl text-[12px] font-bold border border-emerald-500/30 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                      >
                        {isSendingOtp[order.id] ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                            <span>
                              {(resendCooldown[order.id] || 0) > 0
                                ? `Resend OTP (${resendCooldown[order.id]}s)`
                                : 'Resend OTP'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Inline Feedback Messages */}
                    {orderOtpFeedback[order.id] && (
                      <div
                        id={`order-otp-feedback-${cleanOrderId}`}
                        className={`text-[12px] p-2.5 rounded-xl flex items-center justify-between gap-2 animate-in fade-in ${
                          orderOtpFeedback[order.id].type === 'success'
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 font-bold'
                            : orderOtpFeedback[order.id].type === 'expired'
                            ? 'bg-amber-950/60 text-amber-300 border border-amber-500/40 font-semibold'
                            : 'bg-red-950/60 text-red-300 border border-red-500/40 font-semibold'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {orderOtpFeedback[order.id].type === 'success' ? (
                            <CheckCircle className="w-4 h-4 text-[#16a34a] shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-[#dc2626] shrink-0" />
                          )}
                          <span>{orderOtpFeedback[order.id].message}</span>
                        </div>
                        {orderOtpFeedback[order.id].type === 'expired' && (
                          <button
                            type="button"
                            onClick={() => handleResendOtp(order)}
                            disabled={
                              orderVerifying[order.id] ||
                              isSendingOtp[order.id] ||
                              (resendCooldown[order.id] || 0) > 0
                            }
                            className="underline font-bold text-amber-300 hover:text-amber-200 cursor-pointer ml-2 text-[11px] disabled:opacity-50"
                          >
                            Resend OTP
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
