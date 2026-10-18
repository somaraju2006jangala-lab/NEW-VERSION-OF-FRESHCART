import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Truck,
  X,
  RefreshCw,
  Search,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  KeyRound,
  Eye,
} from 'lucide-react';
import { formatINR } from '../utils/currency';
import { formatOrderDateTime } from '../utils/date';
import { useLanguage } from '../context/LanguageContext';
import {
  fetchOrdersToDeliverFromBackend,
  PendingDeliveryOrder,
  getStoredAdminToken,
} from '../services/authService';
import { getStoredEmployeeToken } from '../services/employeeService';
import { verifyOrderOtp } from '../services/otpClientService';

interface OrdersToDeliverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderDelivered?: (orderId: string) => void;
  userRole?: string;
  currentUserName?: string;
}

export const OrdersToDeliverModal: React.FC<OrdersToDeliverModalProps> = ({
  isOpen,
  onClose,
  onOrderDelivered,
  userRole = 'admin',
  currentUserName,
}) => {
  const { t } = useLanguage();

  const [orders, setOrders] = useState<PendingDeliveryOrder[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'UPI' | 'COD'>('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Per-order action states
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [deliveringOrderId, setDeliveringOrderId] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // OTP Verification popover inside modal
  const [activeOtpOrderId, setActiveOtpOrderId] = useState<string | null>(null);
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [otpVerifying, setOtpVerifying] = useState<Record<string, boolean>>({});
  const [otpError, setOtpError] = useState<Record<string, string>>({});

  // Fetch orders from backend MySQL database
  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchOrdersToDeliverFromBackend();
      if (res.success && Array.isArray(res.orders)) {
        setOrders(res.orders);
        setTotalCount(typeof res.total === 'number' ? res.total : res.orders.length);
      } else {
        setError(res.error || 'Failed to fetch pending delivery orders from server.');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error while retrieving orders from database.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh on modal open
  useEffect(() => {
    if (isOpen) {
      loadOrders();
      setCurrentPage(1);
      setSearchQuery('');
      setPaymentFilter('ALL');
      setActionSuccessMessage(null);
    }
  }, [isOpen, loadOrders]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Copy Order ID
  const handleCopyOrderId = (id: string) => {
    navigator.clipboard?.writeText(id);
    setCopiedOrderId(id);
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  // Delivery confirmation for COD orders
  const handleConfirmDelivery = async (order: PendingDeliveryOrder) => {
    setDeliveringOrderId(order.id);
    setActionSuccessMessage(null);
    try {
      const cleanId = order.id.replace(/^#/, '');
      const adminToken = getStoredAdminToken();
      const employeeToken = getStoredEmployeeToken();
      const token = adminToken || employeeToken;
      const role = userRole || (adminToken ? 'admin' : (employeeToken ? 'employee' : 'admin'));

      const res = await fetch(`/api/orders/${encodeURIComponent(cleanId)}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-role': role,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: 'Delivered' }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        // Remove delivered order immediately from pending list
        setOrders((prev) => prev.filter((o) => o.id !== order.id && o.cleanOrderId !== cleanId.toLowerCase()));
        setTotalCount((prev) => Math.max(0, prev - 1));
        setActionSuccessMessage(`Order ${order.id} marked as Delivered successfully.`);

        // Notify parent and broadcast sync event
        if (onOrderDelivered) {
          onOrderDelivered(order.id);
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('freshcart_orders_updated'));
        }
      } else {
        alert(data?.error || 'Failed to update order status to Delivered.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error occurred while marking order as Delivered.');
    } finally {
      setDeliveringOrderId(null);
    }
  };

  // OTP verification for online orders
  const handleVerifyOtp = async (order: PendingDeliveryOrder) => {
    const code = (otpInputs[order.id] || '').trim();
    if (!code || code.length !== 6) {
      setOtpError((prev) => ({ ...prev, [order.id]: 'Please enter a valid 6-digit OTP.' }));
      return;
    }

    setOtpVerifying((prev) => ({ ...prev, [order.id]: true }));
    setOtpError((prev) => ({ ...prev, [order.id]: '' }));

    try {
      const res = await verifyOrderOtp(order.id, code);
      if (res.success && res.status === 'Delivered') {
        const cleanId = order.id.replace(/^#/, '').toLowerCase();
        setOrders((prev) => prev.filter((o) => o.id !== order.id && o.cleanOrderId !== cleanId));
        setTotalCount((prev) => Math.max(0, prev - 1));
        setActionSuccessMessage(`Order ${order.id} handover verified and delivered successfully.`);
        setActiveOtpOrderId(null);

        if (onOrderDelivered) {
          onOrderDelivered(order.id);
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('freshcart_orders_updated'));
        }
      } else {
        setOtpError((prev) => ({
          ...prev,
          [order.id]: res.error || 'Invalid OTP code. Please verify customer phone.',
        }));
      }
    } catch (err: any) {
      setOtpError((prev) => ({
        ...prev,
        [order.id]: err?.message || 'Error verifying OTP with server.',
      }));
    } finally {
      setOtpVerifying((prev) => ({ ...prev, [order.id]: false }));
    }
  };

  // Filtered orders based on search & payment method
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Payment filter
      if (paymentFilter !== 'ALL') {
        const isCod =
          order.paymentMethod.toUpperCase() === 'COD' ||
          order.paymentMethod.toLowerCase().includes('cash');
        if (paymentFilter === 'COD' && !isCod) return false;
        if (paymentFilter === 'UPI' && isCod) return false;
      }

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchId = order.id.toLowerCase().includes(q) || order.cleanOrderId.includes(q);
      const matchName = order.customerName.toLowerCase().includes(q);
      const matchPhone = (order.customerPhone || '').toLowerCase().includes(q);
      const matchEmail = (order.customerEmail || '').toLowerCase().includes(q);
      const matchAddress = (order.deliveryAddress || '').toLowerCase().includes(q);
      const matchStatus = order.status.toLowerCase().includes(q);
      return matchId || matchName || matchPhone || matchEmail || matchAddress || matchStatus;
    });
  }, [orders, paymentFilter, searchQuery]);

  // Paginated slice
  const paginatedOrders = useMemo(() => {
    if (pageSize >= filteredOrders.length) {
      return filteredOrders;
    }
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, paymentFilter, pageSize]);

  if (!isOpen) return null;

  return (
    <div
      id="orders-to-deliver-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="orders-to-deliver-title"
    >
      <div className="bg-[#0b1c30] rounded-2xl shadow-2xl max-w-5xl w-full overflow-hidden border border-white/15 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-950/80 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-inner">
              <Truck className="w-5 h-5 text-[#38bdf8]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 id="orders-to-deliver-title" className="text-lg font-bold text-white font-display">
                  {t('ordersToDeliver') || 'Orders to Deliver'}
                </h3>
                <span
                  id="modal-orders-to-deliver-count-badge"
                  className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-sky-950/90 text-sky-300 border border-sky-500/40"
                  title="Authoritative count of orders awaiting delivery"
                >
                  {totalCount} Total
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Confirmed orders awaiting customer delivery • Live MySQL database records
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="orders-to-deliver-refresh-btn"
              onClick={loadOrders}
              disabled={isLoading}
              title="Refresh orders from MySQL database"
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 text-xs font-semibold"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              id="orders-to-deliver-close-btn"
              onClick={onClose}
              title="Close modal (Esc)"
              className="p-2 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action feedback message */}
        {actionSuccessMessage && (
          <div className="px-5 py-2.5 bg-emerald-950/60 border-b border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0" />
              <span>{actionSuccessMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionSuccessMessage(null)}
              className="text-emerald-400 hover:text-white ml-2 text-sm leading-none"
            >
              &times;
            </button>
          </div>
        )}

        {/* Filters & Search Toolbar */}
        <div className="p-3.5 sm:p-4 bg-black/20 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              id="orders-to-deliver-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order ID, customer, phone..."
              className="w-full pl-9 pr-3 py-1.5 bg-black/40 border border-white/15 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 transition-colors font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                &times;
              </button>
            )}
          </div>

          {/* Payment Method Filter Pills */}
          <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-lg border border-white/10 text-xs">
            {(['ALL', 'UPI', 'COD'] as const).map((method) => (
              <button
                key={method}
                type="button"
                id={`orders-to-deliver-filter-${method.toLowerCase()}`}
                onClick={() => setPaymentFilter(method)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  paymentFilter === method
                    ? 'bg-sky-600 text-white shadow-2xs font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {method === 'ALL' ? 'All Methods' : method}
              </button>
            ))}
          </div>

          {/* Page Size Selector */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="hidden sm:inline">Per page:</span>
            <select
              id="orders-to-deliver-page-size-select"
              value={pageSize >= 9999 ? 'all' : pageSize}
              onChange={(e) => {
                const val = e.target.value;
                setPageSize(val === 'all' ? 99999 : parseInt(val, 10));
              }}
              className="bg-black/40 border border-white/15 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="all">All ({filteredOrders.length})</option>
            </select>
          </div>
        </div>

        {/* Modal Body: Orders List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {isLoading && orders.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-sky-400 animate-spin mx-auto" />
              <p className="text-sm font-medium text-slate-300">
                Fetching orders awaiting delivery from MySQL database...
              </p>
              <p className="text-xs text-slate-500">Checking order lifecycle status and payment confirmation</p>
            </div>
          ) : error ? (
            <div className="py-12 px-6 text-center space-y-4 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-xl bg-red-950/60 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6 text-[#ef4444]" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">Failed to Load Orders</h4>
                <p className="text-xs text-red-300">{error}</p>
              </div>
              <button
                type="button"
                onClick={loadOrders}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-md inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Connection</span>
              </button>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8 text-[#10b981]" />
              </div>
              <h4 className="text-base font-bold text-white font-display">
                {orders.length === 0 ? 'All Orders Delivered!' : 'No Matching Orders'}
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {orders.length === 0
                  ? 'There are currently no orders awaiting delivery in the database. All confirmed orders have been fulfilled.'
                  : `No pending orders matched your search criteria "${searchQuery}".`}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-3 py-1 bg-white/10 hover:bg-white/15 text-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Clear Search Filter
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto rounded-xl border border-white/10 bg-black/25">
                <table className="w-full text-left text-xs text-slate-200 border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-black/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
                      <th className="py-3 px-4">Order ID</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Payment</th>
                      <th className="py-3 px-4">Delivery Status</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-sans">
                    {paginatedOrders.map((order) => {
                      const cleanId = order.cleanOrderId;
                      const isCod =
                        order.paymentMethod.toUpperCase() === 'COD' ||
                        order.paymentMethod.toLowerCase().includes('cash');

                      return (
                        <tr
                          key={order.id}
                          id={`modal-order-row-${cleanId}`}
                          className="hover:bg-white/5 transition-colors group"
                        >
                          {/* Order ID */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[#38bdf8] font-mono">{order.id}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyOrderId(order.id)}
                                title="Copy Order ID"
                                className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors opacity-70 group-hover:opacity-100"
                              >
                                {copiedOrderId === order.id ? (
                                  <Check className="w-3 h-3 text-[#10b981]" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* Customer */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-white truncate max-w-[170px]">
                              {order.customerName}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono truncate max-w-[170px]">
                              {order.customerPhone || order.customerEmail || 'No contact info'}
                            </div>
                          </td>

                          {/* Date & Time */}
                          <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-300">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>{formatOrderDateTime(order.createdAt)}</span>
                            </div>
                          </td>

                          {/* Payment Method & Status */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                                  isCod
                                    ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                                    : 'bg-indigo-950/60 text-indigo-300 border-indigo-500/40'
                                }`}
                              >
                                {order.paymentMethod}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                                  order.paymentStatus === 'COLLECTED' || order.paymentStatus === 'COMPLETED' || order.paymentStatus === 'PAID'
                                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                                    : 'bg-yellow-950/60 text-yellow-300 border-yellow-500/40'
                                }`}
                              >
                                ● {order.paymentStatus}
                              </span>
                            </div>
                          </td>

                          {/* Delivery Status */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border font-mono ${
                                order.status === 'Picking'
                                  ? 'bg-amber-950/40 text-amber-300 border-amber-500/40'
                                  : order.status === 'Ordered'
                                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40'
                                  : 'bg-slate-800 text-slate-300 border-slate-600'
                              }`}
                            >
                              ● {order.status}
                            </span>
                          </td>

                          {/* Amount */}
                          <td className="py-3 px-4 whitespace-nowrap text-right font-mono font-bold text-white text-xs">
                            {formatINR(order.total)}
                          </td>

                          {/* Delivery Action */}
                          <td className="py-3 px-4 whitespace-nowrap text-center">
                            {isCod ? (
                              <button
                                type="button"
                                id={`modal-confirm-delivery-btn-${cleanId}`}
                                onClick={() => handleConfirmDelivery(order)}
                                disabled={deliveringOrderId === order.id}
                                title={`Confirm delivery for Order ${order.id}`}
                                className="px-2.5 py-1 text-[11px] font-bold text-sky-300 hover:text-white bg-sky-950/60 hover:bg-sky-900/80 border border-sky-500/40 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs backdrop-blur-xs disabled:opacity-50"
                              >
                                <Truck className="w-3.5 h-3.5 text-[#38bdf8]" />
                                <span>{deliveringOrderId === order.id ? 'Delivering...' : 'Confirm Delivery'}</span>
                              </button>
                            ) : (
                              <div className="relative inline-block text-left">
                                <button
                                  type="button"
                                  id={`modal-enter-otp-btn-${cleanId}`}
                                  onClick={() =>
                                    setActiveOtpOrderId(activeOtpOrderId === order.id ? null : order.id)
                                  }
                                  title="Enter handover delivery OTP"
                                  className="px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:text-white bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs backdrop-blur-xs"
                                >
                                  <KeyRound className="w-3.5 h-3.5 text-[#10b981]" />
                                  <span>Enter OTP</span>
                                </button>

                                {/* Inline OTP verification popover */}
                                {activeOtpOrderId === order.id && (
                                  <div className="absolute right-0 top-full mt-1.5 z-20 w-64 bg-[#091524] border border-white/20 rounded-xl p-3 shadow-2xl space-y-2">
                                    <div className="flex items-center justify-between text-xs text-white font-semibold">
                                      <span>Verify Handover OTP</span>
                                      <button
                                        type="button"
                                        onClick={() => setActiveOtpOrderId(null)}
                                        className="text-slate-400 hover:text-white"
                                      >
                                        &times;
                                      </button>
                                    </div>
                                    <input
                                      type="text"
                                      maxLength={6}
                                      value={otpInputs[order.id] || ''}
                                      onChange={(e) => {
                                        const v = e.target.value.replace(/\D/g, '');
                                        setOtpInputs((prev) => ({ ...prev, [order.id]: v }));
                                      }}
                                      placeholder="6-digit OTP"
                                      className="w-full px-2.5 py-1.5 bg-black/60 border border-white/20 rounded-lg text-center font-mono text-sm tracking-widest text-emerald-400 focus:outline-none focus:border-emerald-500"
                                    />
                                    {otpError[order.id] && (
                                      <p className="text-[10px] text-red-400 font-medium">
                                        {otpError[order.id]}
                                      </p>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleVerifyOtp(order)}
                                      disabled={otpVerifying[order.id] || (otpInputs[order.id] || '').length !== 6}
                                      className="w-full py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                      <ShieldCheck className="w-3 h-3" />
                                      <span>{otpVerifying[order.id] ? 'Verifying...' : 'Complete Delivery'}</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile / Tablet Cards View */}
              <div className="lg:hidden space-y-2.5">
                {paginatedOrders.map((order) => {
                  const cleanId = order.cleanOrderId;
                  const isCod =
                    order.paymentMethod.toUpperCase() === 'COD' ||
                    order.paymentMethod.toLowerCase().includes('cash');

                  return (
                    <div
                      key={order.id}
                      id={`modal-order-card-${cleanId}`}
                      className="border border-white/10 rounded-xl p-3.5 bg-black/30 backdrop-blur-md space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[#38bdf8] font-mono text-xs">{order.id}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyOrderId(order.id)}
                            className="text-slate-400 hover:text-white p-1"
                          >
                            {copiedOrderId === order.id ? (
                              <Check className="w-3 h-3 text-[#10b981]" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <span className="font-bold text-white font-mono text-xs">
                          {formatINR(order.total)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Customer</span>
                          <span className="font-semibold text-white truncate block">
                            {order.customerName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {order.customerPhone || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Date & Time</span>
                          <span className="font-mono text-[11px] text-slate-200 block">
                            {formatOrderDateTime(order.createdAt)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                              isCod
                                ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                                : 'bg-indigo-950/60 text-indigo-300 border-indigo-500/40'
                            }`}
                          >
                            {order.paymentMethod}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                              order.paymentStatus === 'COLLECTED' || order.paymentStatus === 'COMPLETED' || order.paymentStatus === 'PAID'
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                                : 'bg-yellow-950/60 text-yellow-300 border-yellow-500/40'
                            }`}
                          >
                            ● {order.paymentStatus}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-800 text-slate-300 border border-slate-600">
                            ● {order.status}
                          </span>
                        </div>

                        {/* Action on Mobile */}
                        {isCod ? (
                          <button
                            type="button"
                            onClick={() => handleConfirmDelivery(order)}
                            disabled={deliveringOrderId === order.id}
                            className="px-2.5 py-1 text-[11px] font-bold text-sky-300 hover:text-white bg-sky-950/80 border border-sky-500/40 rounded-lg flex items-center gap-1"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>{deliveringOrderId === order.id ? 'Saving...' : 'Deliver'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setActiveOtpOrderId(activeOtpOrderId === order.id ? null : order.id)
                            }
                            className="px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:text-white bg-emerald-950/80 border border-emerald-500/40 rounded-lg flex items-center gap-1"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Enter OTP</span>
                          </button>
                        )}
                      </div>

                      {/* Mobile OTP input popover */}
                      {activeOtpOrderId === order.id && !isCod && (
                        <div className="bg-black/60 border border-white/20 rounded-xl p-3 space-y-2">
                          <span className="text-xs text-white font-semibold block">Enter 6-Digit Delivery OTP</span>
                          <input
                            type="text"
                            maxLength={6}
                            value={otpInputs[order.id] || ''}
                            onChange={(e) => {
                              const v = e.target.value.replace(/\D/g, '');
                              setOtpInputs((prev) => ({ ...prev, [order.id]: v }));
                            }}
                            placeholder="6-digit OTP"
                            className="w-full px-2.5 py-1.5 bg-black/80 border border-white/20 rounded-lg text-center font-mono text-sm tracking-widest text-emerald-400 focus:outline-none focus:border-emerald-500"
                          />
                          {otpError[order.id] && (
                            <p className="text-[10px] text-red-400">{otpError[order.id]}</p>
                          )}
                          <button
                            type="button"
                            onClick={() => handleVerifyOtp(order)}
                            disabled={otpVerifying[order.id] || (otpInputs[order.id] || '').length !== 6}
                            className="w-full py-1 text-xs font-bold text-white bg-emerald-600 rounded-lg"
                          >
                            {otpVerifying[order.id] ? 'Verifying...' : 'Complete Delivery'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer & Pagination */}
        <div className="p-3.5 sm:p-4 bg-black/40 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <div>
            {filteredOrders.length > 0 ? (
              <span>
                Showing{' '}
                <strong className="text-white font-mono">
                  {(currentPage - 1) * pageSize + 1}
                </strong>
                –
                <strong className="text-white font-mono">
                  {Math.min(currentPage * pageSize, filteredOrders.length)}
                </strong>{' '}
                of <strong className="text-sky-300 font-mono">{filteredOrders.length}</strong> matching
                orders awaiting delivery
                {totalCount !== filteredOrders.length && (
                  <span className="text-slate-400"> (filtered from {totalCount} total)</span>
                )}
              </span>
            ) : (
              <span>0 orders awaiting delivery</span>
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                id="orders-to-deliver-prev-page"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1 font-mono text-xs">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    // Show first, last, and current +/- 1
                    return p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1;
                  })
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    const hasGap = prev && p - prev > 1;

                    return (
                      <React.Fragment key={p}>
                        {hasGap && <span className="px-1 text-slate-500">...</span>}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(p)}
                          className={`min-w-[28px] h-7 px-2 rounded-md font-bold transition-colors cursor-pointer ${
                            currentPage === p
                              ? 'bg-sky-600 text-white shadow-xs'
                              : 'text-slate-400 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              <button
                type="button"
                id="orders-to-deliver-next-page"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
