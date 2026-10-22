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
  Package,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatINR } from '../utils/currency';
import { formatOrderDateTime } from '../utils/date';
import { useLanguage } from '../context/LanguageContext';
import {
  fetchOrdersToDeliverFromBackend,
  fetchOrderDetailsForDelivery,
  PendingDeliveryOrder,
  PendingOrderItem,
  ActiveDeliveryEmployee,
  getStoredAdminToken,
  assignOrderToEmployee,
  triggerAutoAssignOrders,
} from '../services/authService';
import { getStoredEmployeeToken } from '../services/employeeService';
import { verifyOrderOtp } from '../services/otpClientService';
import {
  UserCheck,
  AlertTriangle,
  Sparkles,
  User,
} from 'lucide-react';

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
  const [assignedCount, setAssignedCount] = useState<number>(0);
  const [unassignedCount, setUnassignedCount] = useState<number>(0);
  const [activeEmployees, setActiveEmployees] = useState<ActiveDeliveryEmployee[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Assignment states
  const [activeAssignOrderId, setActiveAssignOrderId] = useState<string | null>(null);
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [isAutoAssigning, setIsAutoAssigning] = useState<boolean>(false);

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

  // Card expansion & ordered items state
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});
  const [orderItemsMap, setOrderItemsMap] = useState<Record<string, PendingOrderItem[]>>({});
  const [loadingItemsMap, setLoadingItemsMap] = useState<Record<string, boolean>>({});
  const [itemsErrorMap, setItemsErrorMap] = useState<Record<string, string>>({});

  // Fetch orders from backend MySQL database
  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchOrdersToDeliverFromBackend();
      if (res.success && Array.isArray(res.orders)) {
        setOrders(res.orders);
        setTotalCount(typeof res.total === 'number' ? res.total : res.orders.length);
        if (typeof res.assignedCount === 'number') {
          setAssignedCount(res.assignedCount);
        } else {
          setAssignedCount(res.orders.filter((o) => o.assignedEmployeeId).length);
        }
        if (typeof res.unassignedCount === 'number') {
          setUnassignedCount(res.unassignedCount);
        } else {
          setUnassignedCount(res.orders.filter((o) => !o.assignedEmployeeId).length);
        }
        if (Array.isArray(res.activeEmployees)) {
          setActiveEmployees(res.activeEmployees);
        }

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
        setError(res.error || 'Failed to fetch pending delivery orders from server.');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error while retrieving orders from database.');
    } finally {
      setIsLoading(false);
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

  // Manual assign / reassign order
  const handleAssignOrder = async (orderId: string, employeeId: string) => {
    setAssigningOrderId(orderId);
    setActionSuccessMessage(null);
    try {
      const res = await assignOrderToEmployee(orderId, employeeId);
      if (res.success) {
        setActionSuccessMessage(
          `Order ${orderId} assigned to ${res.assignedEmployeeName || res.assignedEmployeeId || employeeId} successfully.`
        );
        setActiveAssignOrderId(null);
        await loadOrders();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('freshcart_orders_updated'));
        }
      } else {
        alert(res.error || 'Failed to assign order to employee.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error occurred while assigning delivery order.');
    } finally {
      setAssigningOrderId(null);
    }
  };

  // Auto assign all eligible unassigned orders
  const handleAutoAssignAll = async () => {
    setIsAutoAssigning(true);
    setActionSuccessMessage(null);
    try {
      const res = await triggerAutoAssignOrders();
      if (res.success) {
        setActionSuccessMessage(
          res.message || `Auto-assignment completed. ${res.assignedCount ?? 0} orders assigned.`
        );
        await loadOrders();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('freshcart_orders_updated'));
        }
      } else {
        alert(res.error || 'Failed to auto-assign delivery orders.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error occurred during auto-assignment.');
    } finally {
      setIsAutoAssigning(false);
    }
  };

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
              <div className="flex flex-wrap items-center gap-2">
                <h3 id="orders-to-deliver-title" className="text-lg font-bold text-white font-display">
                  {t('ordersToDeliver') || 'Orders to Deliver'}
                </h3>
                <span
                  id="modal-orders-to-deliver-count-badge"
                  className="px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-sky-950/90 text-sky-300 border border-sky-500/40"
                  title="Total orders awaiting customer delivery"
                >
                  {totalCount} Total
                </span>
                <span
                  id="modal-orders-assigned-count-badge"
                  className="px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-emerald-950/90 text-emerald-300 border border-emerald-500/40"
                  title="Orders assigned to active delivery employees"
                >
                  {assignedCount} Assigned
                </span>
                {unassignedCount > 0 && (
                  <span
                    id="modal-orders-unassigned-count-badge"
                    className="px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-amber-950/90 text-amber-300 border border-amber-500/40"
                    title="Orders awaiting employee assignment"
                  >
                    ⚠️ {unassignedCount} Unassigned
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Confirmed orders awaiting customer delivery • Live MySQL database workload balancing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {userRole === 'admin' && (
              <button
                type="button"
                id="orders-to-deliver-auto-assign-btn"
                onClick={handleAutoAssignAll}
                disabled={isAutoAssigning || unassignedCount === 0 || activeEmployees.length === 0}
                title="Automatically assign unassigned orders to active employees using current workload"
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs font-bold shadow-xs"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAutoAssigning ? 'animate-spin' : ''}`} />
                <span>{isAutoAssigning ? 'Assigning...' : 'Auto-Assign Orders'}</span>
              </button>
            )}
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

        {/* No active employees warning banner */}
        {unassignedCount > 0 && activeEmployees.length === 0 && (
          <div
            id="orders-to-deliver-no-employee-alert"
            className="px-5 py-2.5 bg-amber-950/80 border-b border-amber-500/50 text-amber-200 text-xs font-medium flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Attention Admin:</strong> {unassignedCount} order(s) remain unassigned because no active delivery employees are currently available in the system. Orders will be assigned once delivery staff become active.
            </span>
          </div>
        )}

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
                      <th className="py-3 px-4">Assigned To</th>
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

                          {/* Assigned Employee */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="relative inline-block text-left">
                              {order.assignedEmployeeId ? (
                                <div className="flex items-center gap-1.5">
                                  <span
                                    id={`modal-assigned-pill-${cleanId}`}
                                    className="px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1"
                                    title={`Assigned at ${order.assignedAt || 'N/A'}`}
                                  >
                                    <UserCheck className="w-3 h-3 text-emerald-400" />
                                    <span>{order.assignedEmployeeName || order.assignedEmployeeId}</span>
                                  </span>
                                  {userRole === 'admin' && (
                                    <button
                                      type="button"
                                      id={`modal-reassign-btn-${cleanId}`}
                                      onClick={() =>
                                        setActiveAssignOrderId(
                                          activeAssignOrderId === order.id ? null : order.id
                                        )
                                      }
                                      className="text-[10px] text-sky-400 hover:text-white underline cursor-pointer"
                                    >
                                      Reassign
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span
                                    id={`modal-unassigned-pill-${cleanId}`}
                                    className="px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-amber-950/60 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1"
                                  >
                                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                                    <span>Unassigned</span>
                                  </span>
                                  {userRole === 'admin' && (
                                    <button
                                      type="button"
                                      id={`modal-assign-btn-${cleanId}`}
                                      onClick={() =>
                                        setActiveAssignOrderId(
                                          activeAssignOrderId === order.id ? null : order.id
                                        )
                                      }
                                      className="text-[10px] text-emerald-400 hover:text-white font-semibold underline cursor-pointer"
                                    >
                                      Assign
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Dropdown Popover for Manual (Re)Assignment */}
                              {activeAssignOrderId === order.id && (
                                <div className="absolute left-0 top-full mt-1 z-30 w-72 bg-[#091524] border border-white/20 rounded-xl p-3 shadow-2xl space-y-2">
                                  <div className="flex items-center justify-between text-xs text-white font-semibold border-b border-white/10 pb-1.5">
                                    <span>Assign Delivery Employee</span>
                                    <button
                                      type="button"
                                      onClick={() => setActiveAssignOrderId(null)}
                                      className="text-slate-400 hover:text-white"
                                    >
                                      &times;
                                    </button>
                                  </div>
                                  {activeEmployees.length === 0 ? (
                                    <p className="text-[11px] text-amber-400 py-1">
                                      No active delivery employees available in the database.
                                    </p>
                                  ) : (
                                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                                      {activeEmployees.map((emp) => {
                                        const isCurrent = order.assignedEmployeeId === emp.employeeId;
                                        return (
                                          <button
                                            key={emp.employeeId}
                                            type="button"
                                            disabled={assigningOrderId === order.id}
                                            onClick={() => handleAssignOrder(order.id, emp.employeeId)}
                                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer border ${
                                              isCurrent
                                                ? 'bg-emerald-950/60 border-emerald-500/50 text-white font-bold'
                                                : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10 hover:text-white'
                                            }`}
                                          >
                                            <div className="truncate pr-2">
                                              <p className="font-semibold truncate">{emp.name || emp.fullName}</p>
                                              <p className="text-[10px] text-slate-400 font-mono">
                                                ID: {emp.employeeId}
                                              </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-sky-300">
                                                Load: {emp.currentWorkload ?? emp.workload}
                                              </span>
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
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
                  const isExpanded = !!expandedOrderIds[order.id];
                  const items = orderItemsMap[order.id] || order.items || [];
                  const isLoadingItems = !!loadingItemsMap[order.id];
                  const itemsError = itemsErrorMap[order.id];

                  return (
                    <div
                      key={order.id}
                      id={`modal-order-card-${cleanId}`}
                      onClick={() => handleToggleExpandOrder(order)}
                      className={`border rounded-xl p-3.5 bg-black/30 backdrop-blur-md space-y-3 cursor-pointer select-none transition-all duration-150 ${
                        isExpanded
                          ? 'border-emerald-500/50 bg-black/50 ring-1 ring-emerald-500/20'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      {/* Header: Order ID & Amount */}
                      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[#38bdf8] font-mono text-xs">{order.id}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyOrderId(order.id);
                            }}
                            className="text-slate-400 hover:text-white p-1 cursor-pointer"
                          >
                            {copiedOrderId === order.id ? (
                              <Check className="w-3 h-3 text-[#10b981]" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white font-mono text-xs">
                            {formatINR(order.total)}
                          </span>
                          <div className="text-slate-400">
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Customer</span>
                          <span className="font-semibold text-white truncate block">
                            {order.customerName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {order.customerPhone || order.customerEmail || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Date & Time</span>
                          <span className="font-mono text-[11px] text-slate-200 block">
                            {formatOrderDateTime(order.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Assigned Employee on Mobile */}
                      <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-white/5">
                        <span className="text-[10px] text-slate-400">Assigned To:</span>
                        <div className="flex items-center gap-1.5">
                          {order.assignedEmployeeId ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1">
                              <UserCheck className="w-2.5 h-2.5 text-emerald-400" />
                              <span>{order.assignedEmployeeName || order.assignedEmployeeId}</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-amber-950/60 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                              <span>Unassigned</span>
                            </span>
                          )}
                          {userRole === 'admin' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveAssignOrderId(
                                  activeAssignOrderId === order.id ? null : order.id
                                );
                              }}
                              className="text-[10px] text-sky-400 hover:text-white underline cursor-pointer"
                            >
                              {order.assignedEmployeeId ? 'Reassign' : 'Assign'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Mobile Manual Assignment List */}
                      {activeAssignOrderId === order.id && (
                        <div
                          className="bg-[#091524] border border-white/20 rounded-xl p-3 space-y-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between text-xs text-white font-semibold">
                            <span>Assign Delivery Employee</span>
                            <button
                              type="button"
                              onClick={() => setActiveAssignOrderId(null)}
                              className="text-slate-400 hover:text-white cursor-pointer"
                            >
                              &times;
                            </button>
                          </div>
                          {activeEmployees.length === 0 ? (
                            <p className="text-[11px] text-amber-400">No active delivery employees available.</p>
                          ) : (
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {activeEmployees.map((emp) => (
                                <button
                                  key={emp.employeeId}
                                  type="button"
                                  disabled={assigningOrderId === order.id}
                                  onClick={() => handleAssignOrder(order.id, emp.employeeId)}
                                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between bg-white/5 border border-white/10 text-white cursor-pointer hover:bg-white/10"
                                >
                                  <span>{emp.name || emp.fullName}</span>
                                  <span className="text-[10px] text-sky-300 font-mono">
                                    Load: {emp.currentWorkload ?? emp.workload}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

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

                        <button
                          type="button"
                          id={`modal-mobile-toggle-btn-${cleanId}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleExpandOrder(order);
                          }}
                          className="text-[10px] font-mono font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer transition-colors p-1 rounded hover:bg-emerald-950/40"
                        >
                          {isExpanded ? (
                            <>
                              <span>Hide Items</span>
                              <ChevronUp className="w-3 h-3" />
                            </>
                          ) : (
                            <>
                              <span>View Items & OTP</span>
                              <ChevronDown className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      </div>

                      {/* Expanded Section */}
                      {isExpanded && (
                        <div
                          id={`modal-order-expanded-details-${cleanId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="pt-2 border-t border-white/10 space-y-2.5 cursor-default select-text"
                        >
                          {/* 1. Ordered Items Display */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold text-white font-mono border-b border-white/10 pb-1">
                              <div className="flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Ordered Items</span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-normal">
                                {isLoadingItems ? 'Loading...' : `${items.length} items`}
                              </span>
                            </div>

                            {isLoadingItems ? (
                              <div className="py-4 text-center space-y-1 bg-black/40 rounded-lg">
                                <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin mx-auto" />
                                <p className="text-xs text-slate-400">Loading products...</p>
                              </div>
                            ) : itemsError ? (
                              <div className="py-2 px-2.5 bg-red-950/40 border border-red-500/30 rounded-lg text-center space-y-1.5">
                                <p className="text-xs text-red-300">{itemsError}</p>
                                <button
                                  type="button"
                                  onClick={() => loadOrderItems(order.id, true)}
                                  className="px-2 py-0.5 bg-red-800 text-white rounded text-xs"
                                >
                                  Retry
                                </button>
                              </div>
                            ) : items.length === 0 ? (
                              <div className="py-2 text-center text-xs text-slate-400">
                                No items found for this order.
                              </div>
                            ) : (
                              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {items.map((item, idx) => {
                                  const itemTitle =
                                    item.title || item.name || item.product?.title || 'Item';
                                  const itemImage = item.image || item.product?.image;
                                  const itemQty = item.quantity;
                                  const itemUnit = item.unit || item.product?.unit || 'unit';
                                  const itemPrice = item.price || item.product?.price || 0;
                                  const itemSubtotal = item.subtotal || itemQty * itemPrice;

                                  return (
                                    <div
                                      key={item.id || item.productId || idx}
                                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/50 border border-white/10 text-xs"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        {itemImage ? (
                                          <img
                                            src={itemImage}
                                            alt={itemTitle}
                                            className="w-9 h-9 object-cover rounded-md border border-white/15 bg-black shrink-0"
                                            onError={(e) => {
                                              (e.currentTarget as HTMLElement).style.display = 'none';
                                            }}
                                          />
                                        ) : (
                                          <div className="w-9 h-9 rounded-md border border-white/10 bg-white/5 flex items-center justify-center shrink-0 text-slate-400">
                                            <Package className="w-4 h-4" />
                                          </div>
                                        )}
                                        <div className="min-w-0">
                                          <p className="font-semibold text-white truncate" title={itemTitle}>
                                            {itemTitle}
                                          </p>
                                          <p className="text-[11px] text-slate-400 font-mono">
                                            <span className="text-emerald-400 font-bold">{itemQty} {itemUnit}</span> &bull; {formatINR(itemPrice)} / {itemUnit}
                                          </p>
                                        </div>
                                      </div>
                                      <span className="font-bold font-mono text-white text-xs shrink-0">
                                        {formatINR(itemSubtotal)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* 2. Order Total Section */}
                          <div className="pt-1.5 border-t border-white/10 flex items-center justify-between font-mono text-xs">
                            <span className="text-slate-300 font-semibold">Total Order Amount</span>
                            <span className="font-bold text-[#10b981] text-sm">{formatINR(order.total)}</span>
                          </div>

                          {/* 3. Action Section: Placed BELOW items and total */}
                          <div className="pt-1.5 border-t border-white/10">
                            {isCod ? (
                              <button
                                type="button"
                                id={`modal-confirm-delivery-btn-${cleanId}`}
                                onClick={() => handleConfirmDelivery(order)}
                                disabled={deliveringOrderId === order.id || isLoadingItems}
                                className="w-full py-1.5 text-xs font-bold text-sky-300 hover:text-white bg-sky-950/80 border border-sky-500/40 rounded-lg flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <Truck className="w-3.5 h-3.5" />
                                <span>{deliveringOrderId === order.id ? 'Saving...' : 'Confirm Delivery (COD)'}</span>
                              </button>
                            ) : (
                              <div className="space-y-2">
                                <button
                                  type="button"
                                  id={`modal-enter-otp-btn-${cleanId}`}
                                  disabled={isLoadingItems}
                                  onClick={() =>
                                    setActiveOtpOrderId(activeOtpOrderId === order.id ? null : order.id)
                                  }
                                  className="w-full py-1.5 text-xs font-bold text-emerald-300 hover:text-white bg-emerald-950/80 border border-emerald-500/40 rounded-lg flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                  <span>
                                    {isLoadingItems
                                      ? 'Loading Details...'
                                      : activeOtpOrderId === order.id
                                      ? 'Cancel OTP'
                                      : 'Enter Handover OTP'}
                                  </span>
                                </button>

                                {/* Mobile OTP input popover */}
                                {activeOtpOrderId === order.id && (
                                  <div className="bg-black/80 border border-white/20 rounded-xl p-3 space-y-2">
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
                                      className="w-full px-2.5 py-1.5 bg-black/90 border border-white/20 rounded-lg text-center font-mono text-sm tracking-widest text-emerald-400 focus:outline-none focus:border-emerald-500"
                                    />
                                    {otpError[order.id] && (
                                      <p className="text-[10px] text-red-400">{otpError[order.id]}</p>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleVerifyOtp(order)}
                                      disabled={otpVerifying[order.id] || (otpInputs[order.id] || '').length !== 6}
                                      className="w-full py-1 text-xs font-bold text-white bg-emerald-600 rounded-lg cursor-pointer disabled:opacity-50"
                                    >
                                      {otpVerifying[order.id] ? 'Verifying...' : 'Complete Delivery'}
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
