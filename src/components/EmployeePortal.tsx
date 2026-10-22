import React, { useState, useEffect, useCallback } from 'react';
import { CustomerOrder } from '../types';
import {
  AuthorizedEmployee,
  clearEmployeeSession,
  getStoredEmployeeToken,
} from '../services/employeeService';
import {
  fetchEmployeeAssignedDeliveries,
  fetchOrderDetailsForDelivery,
  PendingDeliveryOrder,
  PendingOrderItem,
} from '../services/authService';
import { verifyOrderOtp } from '../services/otpClientService';
import { formatINR } from '../utils/currency';
import { formatOrderDateTime } from '../utils/date';
import { CustomerOrdersLedger } from './CustomerOrdersLedger';
import { LanguageSelector } from './LanguageSelector';
import {
  ArrowLeft,
  LogOut,
  Shield,
  Sparkles,
  Truck,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Check,
  Copy,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  RefreshCw,
  Search,
  Package,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { USER_AVATAR_URL } from '../data/products';

export interface EmployeePortalProps {
  currentEmployee: AuthorizedEmployee | null;
  customerOrders?: CustomerOrder[];
  onBackToStorefront: () => void;
  onEmployeeLogout: () => void;
  onUpdateOrderStatus?: (
    orderId: string,
    status: string,
    extraMeta?: { otpVerifiedAt?: string; handoverReleased?: boolean }
  ) => void;
}

export const EmployeePortal: React.FC<EmployeePortalProps> = ({
  currentEmployee,
  customerOrders,
  onBackToStorefront,
  onEmployeeLogout,
  onUpdateOrderStatus,
}) => {
  const [assignedOrders, setAssignedOrders] = useState<PendingDeliveryOrder[]>([]);
  const [workload, setWorkload] = useState<number>(0);
  const [isLoadingAssigned, setIsLoadingAssigned] = useState<boolean>(false);
  const [assignedError, setAssignedError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Per-order delivery states
  const [deliveringOrderId, setDeliveringOrderId] = useState<string | null>(null);
  const [activeOtpOrderId, setActiveOtpOrderId] = useState<string | null>(null);
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [otpVerifying, setOtpVerifying] = useState<Record<string, boolean>>({});
  const [otpErrors, setOtpErrors] = useState<Record<string, string>>({});

  // Card expansion & ordered items state
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});
  const [orderItemsMap, setOrderItemsMap] = useState<Record<string, PendingOrderItem[]>>({});
  const [loadingItemsMap, setLoadingItemsMap] = useState<Record<string, boolean>>({});
  const [itemsErrorMap, setItemsErrorMap] = useState<Record<string, string>>({});

  // Fetch strictly assigned deliveries from backend using employee auth token
  const loadAssignedDeliveries = useCallback(async () => {
    setIsLoadingAssigned(true);
    setAssignedError(null);
    try {
      const res = await fetchEmployeeAssignedDeliveries();
      if (res.success && Array.isArray(res.orders)) {
        setAssignedOrders(res.orders);
        setWorkload(typeof res.workload === 'number' ? res.workload : res.orders.length);

        // Pre-populate items map if items returned with order
        const map: Record<string, PendingOrderItem[]> = {};
        for (const ord of res.orders) {
          if (Array.isArray(ord.items) && ord.items.length > 0) {
            map[ord.id] = ord.items;
          }
        }
        if (Object.keys(map).length > 0) {
          setOrderItemsMap((prev) => ({ ...prev, ...map }));
        }
      } else {
        setAssignedError(res.error || 'Failed to retrieve your assigned deliveries.');
      }
    } catch (err: any) {
      setAssignedError(err?.message || 'Network error fetching assigned deliveries.');
    } finally {
      setIsLoadingAssigned(false);
    }
  }, []);

  // Fetch ordered items on demand if not already loaded
  const loadOrderItems = useCallback(
    async (orderId: string, force: boolean = false) => {
      if (!force && orderItemsMap[orderId] && orderItemsMap[orderId].length > 0) {
        return;
      }
      setLoadingItemsMap((prev) => ({ ...prev, [orderId]: true }));
      setItemsErrorMap((prev) => ({ ...prev, [orderId]: '' }));
      try {
        const res = await fetchOrderDetailsForDelivery(orderId);
        if (res.success && Array.isArray(res.items)) {
          setOrderItemsMap((prev) => ({ ...prev, [orderId]: res.items || [] }));
        } else {
          setItemsErrorMap((prev) => ({
            ...prev,
            [orderId]: res.error || 'Failed to retrieve ordered items from database.',
          }));
        }
      } catch (err: any) {
        setItemsErrorMap((prev) => ({
          ...prev,
          [orderId]: err?.message || 'Error communicating with database.',
        }));
      } finally {
        setLoadingItemsMap((prev) => ({ ...prev, [orderId]: false }));
      }
    },
    [orderItemsMap]
  );

  // Toggle order card expand/collapse
  const handleToggleExpandOrder = (order: PendingDeliveryOrder) => {
    const isCurrentlyExpanded = !!expandedOrderIds[order.id];
    const willExpand = !isCurrentlyExpanded;

    setExpandedOrderIds((prev) => ({ ...prev, [order.id]: willExpand }));

    // If expanding and items are not loaded yet, fetch them
    if (willExpand && (!orderItemsMap[order.id] || orderItemsMap[order.id].length === 0)) {
      if (Array.isArray(order.items) && order.items.length > 0) {
        setOrderItemsMap((prev) => ({ ...prev, [order.id]: order.items || [] }));
      } else {
        loadOrderItems(order.id);
      }
    }
  };

  useEffect(() => {
    loadAssignedDeliveries();
  }, [loadAssignedDeliveries]);

  // Synchronize on global order updates
  useEffect(() => {
    const handleSync = () => {
      loadAssignedDeliveries();
    };
    window.addEventListener('freshcart_orders_updated', handleSync);
    return () => window.removeEventListener('freshcart_orders_updated', handleSync);
  }, [loadAssignedDeliveries]);

  const handleLogout = () => {
    clearEmployeeSession();
    onEmployeeLogout();
  };

  const handleCopyOrderId = (id: string) => {
    navigator.clipboard?.writeText(id);
    setCopiedOrderId(id);
    setTimeout(() => setCopiedOrderId(null), 2000);
  };

  // Confirm Delivery for COD orders
  const handleConfirmCodDelivery = async (order: PendingDeliveryOrder) => {
    setDeliveringOrderId(order.id);
    setSuccessNotice(null);
    try {
      const cleanId = order.id.replace(/^#/, '');
      const token = getStoredEmployeeToken();
      const res = await fetch(`/api/orders/${encodeURIComponent(cleanId)}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-role': 'employee',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: 'Delivered' }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        setAssignedOrders((prev) => prev.filter((o) => o.id !== order.id));
        setWorkload((prev) => Math.max(0, prev - 1));
        setSuccessNotice(`Order ${order.id} marked as Delivered! Workload updated.`);

        if (onUpdateOrderStatus) {
          onUpdateOrderStatus(order.id, 'Delivered');
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('freshcart_orders_updated'));
        }
      } else {
        alert(data?.error || 'Failed to complete delivery.');
      }
    } catch (err: any) {
      alert(err?.message || 'Network error while completing delivery.');
    } finally {
      setDeliveringOrderId(null);
    }
  };

  // Complete Delivery for Prepaid/UPI orders with OTP
  const handleVerifyOtpDelivery = async (order: PendingDeliveryOrder) => {
    const code = (otpInputs[order.id] || '').trim();
    if (!code || code.length !== 6) {
      setOtpErrors((prev) => ({ ...prev, [order.id]: 'Please enter a valid 6-digit OTP code.' }));
      return;
    }

    setOtpVerifying((prev) => ({ ...prev, [order.id]: true }));
    setOtpErrors((prev) => ({ ...prev, [order.id]: '' }));

    try {
      const token = getStoredEmployeeToken();
      const res = await verifyOrderOtp(order.id, code, token || undefined);
      if (res.success && res.status === 'Delivered') {
        setAssignedOrders((prev) => prev.filter((o) => o.id !== order.id));
        setWorkload((prev) => Math.max(0, prev - 1));
        setSuccessNotice(`Order ${order.id} handover OTP verified! Marked as Delivered.`);
        setActiveOtpOrderId(null);

        if (onUpdateOrderStatus) {
          onUpdateOrderStatus(order.id, 'Delivered', { otpVerifiedAt: new Date().toISOString() });
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('freshcart_orders_updated'));
        }
      } else {
        setOtpErrors((prev) => ({
          ...prev,
          [order.id]: res.error || 'Invalid OTP. Please ask customer to re-check code.',
        }));
      }
    } catch (err: any) {
      setOtpErrors((prev) => ({
        ...prev,
        [order.id]: err?.message || 'Error communicating with server during OTP verification.',
      }));
    } finally {
      setOtpVerifying((prev) => ({ ...prev, [order.id]: false }));
    }
  };

  const filteredAssignedOrders = assignedOrders.filter((order) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      order.id.toLowerCase().includes(q) ||
      order.customerName.toLowerCase().includes(q) ||
      (order.customerPhone || '').toLowerCase().includes(q) ||
      (order.customerEmail || '').toLowerCase().includes(q) ||
      (order.deliveryAddress || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full min-h-screen bg-transparent pb-16 relative z-10 selection:bg-emerald-500 selection:text-black">
      {/* Top Employee Action Bar matching AdminPortal style */}
      <div className="bg-transparent text-white py-3 px-4 sm:px-6 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="employee-back-to-storefront-btn"
              onClick={onBackToStorefront}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#334155]/80 hover:bg-[#475569] text-white text-[12px] font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs cursor-pointer shadow-xs border border-white/10"
              title="Return to public storefront"
            >
              <ArrowLeft className="w-4 h-4 text-[#10b981]" />
              <span>Back to Storefront</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Language Selector */}
            <LanguageSelector variant="dark" idPrefix="employee-lang" />

            {/* Employee User Badge */}
            <div
              id="employee-profile-pill"
              className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-black/40 border border-white/10 shadow-xs backdrop-blur-md"
            >
              <div className="relative">
                <img
                  src={USER_AVATAR_URL}
                  alt={currentEmployee?.fullName || 'Employee'}
                  className="w-7 h-7 rounded-full object-cover border border-emerald-500/40"
                />
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#10b981] ring-1 ring-black" />
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-[12px] font-bold leading-tight text-white truncate max-w-[140px]">
                  {currentEmployee?.fullName || 'Operations Employee'}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Shield className="w-2.5 h-2.5 text-[#10b981]" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 font-mono">
                    EMPLOYEE
                  </span>
                </div>
              </div>
            </div>

            {/* Sign Out Button */}
            <button
              type="button"
              id="employee-logout-btn"
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 hover:text-white text-[12px] font-bold transition-all duration-150 cursor-pointer shadow-xs"
              title="Sign out of Employee Portal"
            >
              <LogOut className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Welcome Notice Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-950/50 via-black/40 to-black/60 backdrop-blur-xl p-4 sm:p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-[#10b981] flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <Sparkles className="w-5 h-5 text-[#10b981]" />
              </div>
              <div>
                <h2 className="text-[17px] font-bold text-white font-display flex flex-wrap items-center gap-2">
                  <span>Welcome, {currentEmployee?.fullName || 'Operations Employee'}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold uppercase tracking-wider">
                    Staff ID: {currentEmployee?.employeeId || 'emp_001'}
                  </span>
                </h2>
                <p className="text-[12px] text-slate-300 mt-0.5">
                  Authorized Employee Portal &bull; Automatic Delivery Assignment & Workload Management
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto font-mono text-[11px]">
              <div
                id="employee-workload-badge"
                className="bg-black/40 px-3 py-1.5 rounded-lg border border-emerald-500/30 text-emerald-300 flex items-center gap-2 shadow-xs"
              >
                <Truck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Workload: <strong className="text-white text-xs">{workload}</strong> Pending</span>
              </div>
              <div className="text-slate-400 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-300 font-semibold">Active Staff</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action feedback message */}
        {successNotice && (
          <div className="px-5 py-3 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-xs font-medium flex items-center justify-between shadow-lg animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#10b981] shrink-0" />
              <span>{successNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessNotice(null)}
              className="text-emerald-400 hover:text-white ml-2 text-sm leading-none"
            >
              &times;
            </button>
          </div>
        )}

        {/* SECTION: My Assigned Deliveries */}
        <div
          id="employee-assigned-deliveries-section"
          className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl p-4 sm:p-6 shadow-xl space-y-4"
        >
          {/* Section Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-950/80 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-inner">
                <Truck className="w-5 h-5 text-[#38bdf8]" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-bold text-white font-display">
                    My Assigned Deliveries
                  </h3>
                  <span
                    id="employee-assigned-orders-count"
                    className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-sky-950/90 text-sky-300 border border-sky-500/40"
                  >
                    {assignedOrders.length} Assigned
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Live orders assigned to your staff profile based on automated workload balancing
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Search input if multiple orders */}
              {assignedOrders.length > 2 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search assigned orders..."
                    className="pl-8 pr-2.5 py-1 bg-black/40 border border-white/15 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 w-44 font-mono"
                  />
                </div>
              )}

              <button
                type="button"
                id="employee-refresh-assigned-btn"
                onClick={loadAssignedDeliveries}
                disabled={isLoadingAssigned}
                title="Refresh assigned deliveries from database"
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 text-xs font-semibold"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-sky-400 ${isLoadingAssigned ? 'animate-spin' : ''}`}
                />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {/* Assigned Orders Content */}
          {isLoadingAssigned && assignedOrders.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-7 h-7 text-sky-400 animate-spin mx-auto" />
              <p className="text-sm font-medium text-slate-300">
                Loading your assigned delivery orders...
              </p>
            </div>
          ) : assignedError ? (
            <div className="py-8 px-4 text-center space-y-3 max-w-md mx-auto">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
              <p className="text-xs text-red-300">{assignedError}</p>
              <button
                type="button"
                onClick={loadAssignedDeliveries}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold"
              >
                Retry
              </button>
            </div>
          ) : assignedOrders.length === 0 ? (
            <div
              id="employee-assigned-empty-state"
              className="py-12 text-center space-y-3 border border-white/5 rounded-xl bg-black/20 p-6"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6 text-[#10b981]" />
              </div>
              <h4 className="text-sm font-bold text-white">No Pending Deliveries Assigned</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                You currently have 0 pending delivery assignments. When new eligible orders are confirmed, the system will automatically assign them to you based on your active workload status.
              </p>
            </div>
          ) : filteredAssignedOrders.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No assigned deliveries match your search query "{searchQuery}".
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAssignedOrders.map((order) => {
                const cleanId = order.id.replace(/^#/, '');
                const isCod =
                  (order.paymentMethod || '').toUpperCase() === 'COD' ||
                  (order.paymentMethod || '').toLowerCase().includes('cash');
                const isExpanded = !!expandedOrderIds[order.id];
                const items = orderItemsMap[order.id] || order.items || [];
                const isLoadingItems = !!loadingItemsMap[order.id];
                const itemsError = itemsErrorMap[order.id];

                return (
                  <div
                    key={order.id}
                    id={`employee-assigned-order-card-${cleanId}`}
                    onClick={() => handleToggleExpandOrder(order)}
                    className={`border rounded-xl p-4 bg-black/40 hover:border-emerald-500/40 transition-all duration-150 space-y-3 shadow-md cursor-pointer select-none ${
                      isExpanded
                        ? 'border-emerald-500/50 bg-black/60 ring-1 ring-emerald-500/20'
                        : 'border-white/15'
                    }`}
                  >
                    {/* Header: Order ID & Amount */}
                    <div
                      id={`order-card-header-${cleanId}`}
                      className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#38bdf8] font-mono text-xs hover:underline">
                          {order.id}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyOrderId(order.id);
                          }}
                          title="Copy Order ID"
                          className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          {copiedOrderId === order.id ? (
                            <Check className="w-3 h-3 text-[#10b981]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        <span className="font-bold text-white font-mono text-sm">
                          {formatINR(order.total)}
                        </span>
                        <div
                          className="p-1 text-slate-400 hover:text-white transition-colors"
                          title={isExpanded ? 'Collapse order details' : 'Expand order details'}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Customer & Address Details */}
                    <div
                      id={`order-customer-details-${cleanId}`}
                      className="space-y-1.5 text-xs"
                    >
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                          Customer
                        </span>
                        <p className="font-semibold text-white truncate">{order.customerName}</p>
                      </div>

                      {/* Contact: Phone & Email */}
                      <div className="flex flex-wrap items-center gap-3 pt-0.5 text-slate-300 font-mono text-[11px]">
                        {order.customerPhone && (
                          <a
                            href={`tel:${order.customerPhone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-emerald-400 hover:underline"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{order.customerPhone}</span>
                          </a>
                        )}
                        {order.customerEmail && (
                          <a
                            href={`mailto:${order.customerEmail}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-sky-400 hover:underline truncate max-w-[180px]"
                          >
                            <Mail className="w-3 h-3" />
                            <span>{order.customerEmail}</span>
                          </a>
                        )}
                      </div>

                      {/* Delivery Address */}
                      <div className="pt-1">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono block">
                          Delivery Address
                        </span>
                        <div className="flex items-start gap-1.5 text-slate-200 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                          <p className="text-[11px] leading-tight">
                            {order.deliveryAddress || 'Address on file with customer'}
                          </p>
                        </div>
                      </div>

                      {/* Date & Time */}
                      <div className="flex items-center gap-1 pt-1 text-[11px] text-slate-400 font-mono">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>Order Placed: {formatOrderDateTime(order.createdAt)}</span>
                      </div>
                    </div>

                    {/* Status & Payment Pills Area */}
                    <div
                      id={`order-status-area-${cleanId}`}
                      className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
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
                            order.paymentStatus === 'COLLECTED' ||
                            order.paymentStatus === 'COMPLETED' ||
                            order.paymentStatus === 'PAID'
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                              : 'bg-yellow-950/60 text-yellow-300 border-yellow-500/40'
                          }`}
                        >
                          ● {order.paymentStatus}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-sky-950/60 text-sky-300 border border-sky-500/40">
                          ● {order.status}
                        </span>
                      </div>

                      <button
                        type="button"
                        id={`employee-toggle-items-btn-${cleanId}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleExpandOrder(order);
                        }}
                        className="text-[11px] font-mono font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer transition-colors p-1 rounded hover:bg-emerald-950/40"
                      >
                        {isExpanded ? (
                          <>
                            <span>Hide Items</span>
                            <ChevronUp className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <>
                            <span>View Items & OTP</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>

                    {/* Expanded Section: Ordered Items first, Order Total next, OTP button below */}
                    {isExpanded && (
                      <div
                        id={`order-expanded-details-${cleanId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="pt-3 border-t border-white/15 space-y-3 cursor-default select-text"
                      >
                        {/* 1. Ordered Items Display: Shown FIRST before OTP button */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-white font-mono border-b border-white/10 pb-1.5">
                            <div className="flex items-center gap-1.5">
                              <Package className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Ordered Items</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {isLoadingItems
                                ? 'Loading...'
                                : `${items.length} product${items.length !== 1 ? 's' : ''}`}
                            </span>
                          </div>

                          {isLoadingItems ? (
                            <div className="py-5 text-center space-y-2 bg-black/30 rounded-lg border border-white/5">
                              <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin mx-auto" />
                              <p className="text-xs text-slate-400">Loading ordered items from database...</p>
                            </div>
                          ) : itemsError ? (
                            <div className="py-3 px-3 bg-red-950/40 border border-red-500/30 rounded-lg text-center space-y-2">
                              <p className="text-xs text-red-300">{itemsError}</p>
                              <button
                                type="button"
                                onClick={() => loadOrderItems(order.id, true)}
                                className="px-3 py-1 bg-red-800 hover:bg-red-700 text-white rounded text-xs font-bold cursor-pointer"
                              >
                                Retry
                              </button>
                            </div>
                          ) : items.length === 0 ? (
                            <div className="py-3 text-center text-xs text-slate-400 bg-white/5 rounded-lg border border-white/10">
                              No ordered items found for this order.
                            </div>
                          ) : (
                            <div
                              id={`order-items-list-${cleanId}`}
                              className="space-y-2 max-h-60 overflow-y-auto pr-1"
                            >
                              {items.map((item, idx) => {
                                const itemTitle =
                                  item.title ||
                                  item.name ||
                                  item.product?.title ||
                                  item.product?.name ||
                                  'Ordered Item';
                                const itemImage = item.image || item.product?.image;
                                const itemQty = item.quantity;
                                const itemUnit = item.unit || item.product?.unit || 'unit';
                                const itemPrice = item.price || item.product?.price || 0;
                                const itemSubtotal =
                                  item.subtotal || itemQty * itemPrice;

                                return (
                                  <div
                                    key={item.id || item.productId || idx}
                                    id={`order-item-${cleanId}-${idx}`}
                                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-black/60 border border-white/10 text-xs hover:border-white/20 transition-colors"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      {itemImage ? (
                                        <img
                                          src={itemImage}
                                          alt={itemTitle}
                                          className="w-10 h-10 object-cover rounded-md border border-white/15 bg-black/60 shrink-0"
                                          onError={(e) => {
                                            (e.currentTarget as HTMLElement).style.display = 'none';
                                          }}
                                        />
                                      ) : (
                                        <div className="w-10 h-10 rounded-md border border-white/10 bg-white/5 flex items-center justify-center shrink-0 text-slate-400">
                                          <Package className="w-4 h-4" />
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <p
                                          id={`order-item-title-${cleanId}-${idx}`}
                                          className="font-semibold text-white truncate"
                                          title={itemTitle}
                                        >
                                          {itemTitle}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                                          <span
                                            id={`order-item-qty-${cleanId}-${idx}`}
                                            className="text-emerald-400 font-bold"
                                          >
                                            {itemQty} {itemUnit}
                                          </span>
                                          <span>&bull;</span>
                                          <span id={`order-item-price-${cleanId}-${idx}`}>
                                            {formatINR(itemPrice)} / {itemUnit}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <span
                                        id={`order-item-total-${cleanId}-${idx}`}
                                        className="font-bold font-mono text-white text-xs"
                                      >
                                        {formatINR(itemSubtotal)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* 2. Order Total Section: Shown NEXT right after the items */}
                        <div
                          id={`order-total-section-${cleanId}`}
                          className="pt-2 border-t border-white/10 space-y-1 font-mono text-xs"
                        >
                          {order.discount > 0 && (
                            <div className="flex items-center justify-between text-slate-400 text-[11px]">
                              <span>Discount Applied</span>
                              <span className="text-emerald-400">-{formatINR(order.discount)}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between font-bold text-sm text-white pt-1">
                            <span className="text-slate-300">Total Order Amount</span>
                            <span
                              id={`order-total-amount-${cleanId}`}
                              className="text-[#10b981] text-base"
                            >
                              {formatINR(order.total)}
                            </span>
                          </div>
                        </div>

                        {/* 3. Delivery Completion Action: Placed BELOW the ordered items and total */}
                        <div className="pt-2 border-t border-white/10">
                          {isCod ? (
                            <button
                              type="button"
                              id={`employee-confirm-delivery-btn-${cleanId}`}
                              onClick={() => handleConfirmCodDelivery(order)}
                              disabled={deliveringOrderId === order.id || isLoadingItems}
                              className="w-full py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 border border-sky-400/40 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>
                                {deliveringOrderId === order.id
                                  ? 'Completing Delivery...'
                                  : 'Confirm Delivery (COD)'}
                              </span>
                            </button>
                          ) : (
                            <div className="space-y-2">
                              <button
                                type="button"
                                id={`employee-verify-otp-btn-${cleanId}`}
                                disabled={isLoadingItems}
                                onClick={() =>
                                  setActiveOtpOrderId(
                                    activeOtpOrderId === order.id ? null : order.id
                                  )
                                }
                                className="w-full py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/40 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                                <span>
                                  {isLoadingItems
                                    ? 'Loading Order Details...'
                                    : activeOtpOrderId === order.id
                                    ? 'Cancel OTP Input'
                                    : 'Enter Handover OTP'}
                                </span>
                              </button>

                              {/* Preserved OTP Verification Form */}
                              {activeOtpOrderId === order.id && (
                                <div className="bg-black/60 border border-white/20 rounded-xl p-3 space-y-2 animate-in fade-in">
                                  <div className="flex items-center justify-between text-xs text-white font-semibold">
                                    <span>Customer Handover OTP</span>
                                    <span className="text-[10px] text-slate-400">
                                      Ask customer for 6-digit code
                                    </span>
                                  </div>
                                  <input
                                    type="text"
                                    maxLength={6}
                                    id={`employee-otp-input-${cleanId}`}
                                    value={otpInputs[order.id] || ''}
                                    onChange={(e) => {
                                      const v = e.target.value.replace(/\D/g, '');
                                      setOtpInputs((prev) => ({ ...prev, [order.id]: v }));
                                    }}
                                    placeholder="000000"
                                    className="w-full px-3 py-2 bg-black/80 border border-white/25 rounded-lg text-center font-mono text-base tracking-widest text-emerald-400 focus:outline-none focus:border-emerald-500"
                                  />
                                  {otpErrors[order.id] && (
                                    <p className="text-[11px] text-red-400 font-medium text-center">
                                      {otpErrors[order.id]}
                                    </p>
                                  )}
                                  <button
                                    type="button"
                                    id={`employee-submit-otp-btn-${cleanId}`}
                                    onClick={() => handleVerifyOtpDelivery(order)}
                                    disabled={
                                      otpVerifying[order.id] ||
                                      (otpInputs[order.id] || '').length !== 6
                                    }
                                    className="w-full py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                    <span>
                                      {otpVerifying[order.id]
                                        ? 'Verifying...'
                                        : 'Complete Delivery'}
                                    </span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Customer Orders Ledger: Reused without duplication */}
        <CustomerOrdersLedger
          userRole="employee"
          customerOrders={customerOrders}
          onUpdateOrderStatus={onUpdateOrderStatus}
          currentUserName={currentEmployee?.fullName || currentEmployee?.employeeId}
        />
      </div>
    </div>
  );
};
