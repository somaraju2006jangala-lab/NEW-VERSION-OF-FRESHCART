import React, { useState, useEffect, useRef } from 'react';
import { Product, InventoryLog, Coupon, CustomerOrder, DeliveryChargeRule } from '../types';
import { USER_AVATAR_URL } from '../data/products';
import { formatINR } from '../utils/currency';
import { formatLogDateTime, formatOrderDateTime } from '../utils/date';
import { useLanguage } from '../context/LanguageContext';
import { DEFAULT_DELIVERY_RULES, getApplicableDeliveryChargeRule } from '../services/settingsService';
import { LanguageSelector } from './LanguageSelector';
import { AddProductModal, STANDARD_UNITS } from './AddProductModal';
import { EditProductModal } from './EditProductModal';
import { CouponModal } from './CouponModal';
import { CustomerOrdersLedger } from './CustomerOrdersLedger';
import {
  Package,
  Users,
  Activity,
  ArrowLeft,
  Plus,
  RotateCcw,
  Search,
  CheckCircle,
  AlertTriangle,
  History,
  Edit2,
  Check,
  Trash2,
  X,
  Tag,
  ShoppingBag,
  Copy,
  Calendar,
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
  Percent,
  Truck,
  CreditCard,
  QrCode,
  Eye,
  EyeOff,
  Mail,
  AlertCircle,
  RefreshCw,
  FileImage,
  XCircle,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ExternalLink,
  LogOut,
  UserPlus,
  UserX,
  UserCheck,
  ShieldAlert,
  User,
  Phone,
  ChevronDown,
  Store,
  Banknote,
  Clock,
} from 'lucide-react';
import QRCode from 'qrcode';
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
  updateOrderPaymentStatus,
  confirmCodCashCollection,
  fetchAllOrdersFromBackend,
} from '../services/authService';
import { formatIndianDisplayNumber, validateIndianMobileNumber } from '../services/registrationOtpService';
import {
  fetchUpiSettings,
  saveUpiSettings,
  isValidUpiId,
  buildUpiUri,
  adminVerifyPayment,
  adminDeleteVerificationOrder,
  adminBulkDeleteVerificationOrders,
  fetchPaymentVerificationQueue,
  PaymentVerificationItem,
} from '../services/paymentService';
import {
  AuthorizedAdmin,
  getStoredAdminToken,
  fetchAuthorizedAdmins,
  createAuthorizedAdmin,
  toggleAdminStatus,
  deleteAuthorizedAdmin,
  AdminCustomerAccount,
  fetchAdminCustomerAccounts,
  updateCustomerAccountStatus,
} from '../services/adminService';

export function getAdminScreenshotUrl(base?: string, orderId?: string): string {
  const cleanId = String(orderId || '').replace(/^#/, '');
  const url = base || `/api/payments/screenshot/${encodeURIComponent(cleanId)}`;
  const token = getStoredAdminToken();
  if (!token) return `${url}${url.includes('?') ? '&' : '?'}admin=true`;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}adminToken=${encodeURIComponent(token)}`;
}


export interface ParsedHistoryPeriod {
  type: 'all' | 'relative';
  value?: number;
  unit?: 'day' | 'week' | 'month' | 'year';
  displayMessage: string;
}

export const parseHistoryPeriod = (input: string): ParsedHistoryPeriod | null => {
  const clean = input.trim().toLowerCase();
  if (!clean) return null;

  if (clean === 'all') {
    return {
      type: 'all',
      displayMessage: 'Showing all order history.',
    };
  }

  const match = clean.match(/^(\d+)\s*(day|days|week|weeks|month|months|year|years)?$/);
  if (!match) return null;

  const count = parseInt(match[1], 10);
  if (isNaN(count) || count <= 0) return null;

  const rawUnit = match[2] || 'week';
  let unit: 'day' | 'week' | 'month' | 'year' = 'week';
  let unitText = '';

  if (rawUnit.startsWith('day')) {
    unit = 'day';
    unitText = count === 1 ? '1 day' : `${count} days`;
  } else if (rawUnit.startsWith('week')) {
    unit = 'week';
    unitText = count === 1 ? '1 week' : `${count} weeks`;
  } else if (rawUnit.startsWith('month')) {
    unit = 'month';
    unitText = count === 1 ? '1 month' : `${count} months`;
  } else if (rawUnit.startsWith('year')) {
    unit = 'year';
    unitText = count === 1 ? '1 year' : `${count} years`;
  }

  return {
    type: 'relative',
    value: count,
    unit,
    displayMessage: `Showing orders from the last ${unitText}.`,
  };
};

export const getCutoffDate = (period: ParsedHistoryPeriod): Date | null => {
  if (period.type === 'all' || !period.value || !period.unit) {
    return null;
  }
  const now = new Date();
  if (period.unit === 'day') {
    return new Date(now.getTime() - period.value * 24 * 60 * 60 * 1000);
  }
  if (period.unit === 'week') {
    return new Date(now.getTime() - period.value * 7 * 24 * 60 * 60 * 1000);
  }
  if (period.unit === 'month') {
    const d = new Date(now);
    d.setMonth(d.getMonth() - period.value);
    return d;
  }
  if (period.unit === 'year') {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - period.value);
    return d;
  }
  return null;
};

export const parseOrderDate = (createdAt?: string | Date | number): Date | null => {
  if (!createdAt) return null;
  if (createdAt instanceof Date) return isNaN(createdAt.getTime()) ? null : createdAt;
  if (typeof createdAt === 'number') {
    const d = new Date(createdAt);
    return isNaN(d.getTime()) ? null : d;
  }
  const str = String(createdAt).trim();
  const direct = new Date(str);
  if (!isNaN(direct.getTime())) return direct;

  const match = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const timeMatch = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
    let hours = 0;
    let minutes = 0;
    let seconds = 0;
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
      if (timeMatch[3]) seconds = parseInt(timeMatch[3], 10);
      const ampm = timeMatch[4]?.toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
    }
    const d = new Date(year, month, day, hours, minutes, seconds);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

interface AdminPortalProps {
  products: Product[];
  inventoryLogs: InventoryLog[];
  coupons: Coupon[];
  customerOrders?: CustomerOrder[];
  onBackToStorefront: () => void;
  onUpdateProductStock: (productId: string, newStock: number, reason: string) => void;
  onUpdateProductPrice: (productId: string, newPrice: number) => void;
  onUpdateProductUnit: (productId: string, newUnit: string) => void;
  onAddProduct: (product: Product) => void;
  onEditProduct?: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onSimulateCdcPulse?: () => void;
  onCreateCoupon: (couponData: Omit<Coupon, 'id'>) => void;
  onUpdateCoupon: (coupon: Coupon) => void;
  onDeleteCoupon: (couponId: string) => void;
  onToggleCoupon: (couponId: string) => void;
  onDeleteInventoryLog?: (logId: string) => void;
  onClearInventoryLogs?: () => void;
  onUpdateOrderStatus?: (orderId: string, status: string, extraMeta?: { otpVerifiedAt?: string; handoverReleased?: boolean }) => void;
  onDeleteCustomerOrder?: (orderId: string) => void;
  deliveryCharges?: number;
  onUpdateDeliveryCharges?: (charge: number) => Promise<void> | void;
  deliveryRules?: DeliveryChargeRule[];
  onUpdateDeliveryRules?: (rules: DeliveryChargeRule[]) => Promise<void> | void;
  taxAndPackingPercentage?: number;
  onUpdateTaxAndPacking?: (percentage: number) => Promise<void> | void;
  currentAdmin?: AuthorizedAdmin | null;
  onAdminLogout?: () => void;
}
 
/**
 * Resolves payment method display name, payment status, and themed styling
 * according to Customer Orders Ledger specifications:
 *
 * Online payments (UPI, PhonePe, Google Pay, Paytm, etc.):
 * - Successfully verified/approved: COMPLETED (Green)
 * - Proof awaiting verification: PENDING VERIFICATION (Amber)
 * - Admin rejects proof: REJECTED (Red)
 * - No successful payment recorded: UNPAID (Red)
 *
 * Cash on Delivery (COD):
 * - Method: Cash on Delivery
 * - Before cash is collected: COD (Amber)
 * - Confirmed cash collection: COMPLETED (Green)
 */
export function getDisplayPaymentInfo(order: CustomerOrder): {
  paymentMethod: string;
  paymentStatus: 'COLLECTED' | 'PENDING_COLLECTION' | 'COMPLETED' | 'PENDING VERIFICATION' | 'REJECTED' | 'UNPAID' | 'COD';
  badgeStyle: {
    bg: string;
    text: string;
    border: string;
    dot: string;
  };
} {
  const rawMethod = (order.paymentMethod || '').trim();
  const rawStatus = (order.paymentStatus || '').trim().toUpperCase();
  const hasProof = Boolean(order.screenshotUrl);

  const isCod =
    !rawMethod ||
    rawMethod.toLowerCase().includes('cash') ||
    rawMethod.toUpperCase() === 'COD';

  if (isCod) {
    const isCollected =
      rawStatus === 'COLLECTED' ||
      rawStatus === 'COMPLETED' ||
      rawStatus === 'PAID';

    if (isCollected) {
      return {
        paymentMethod: 'Cash on Delivery',
        paymentStatus: rawStatus === 'COMPLETED' ? 'COMPLETED' : 'COLLECTED',
        badgeStyle: {
          bg: 'bg-emerald-500/15',
          text: 'text-[#10b981]',
          border: 'border-emerald-500/30',
          dot: 'bg-[#10b981]',
        },
      };
    }

    const uncollectedStatus = rawStatus === 'COD' ? 'COD' : 'PENDING_COLLECTION';
    return {
      paymentMethod: 'Cash on Delivery',
      paymentStatus: uncollectedStatus,
      badgeStyle: {
        bg: 'bg-amber-500/15',
        text: 'text-[#f59e0b]',
        border: 'border-amber-500/30',
        dot: 'bg-[#f59e0b]',
      },
    };
  }

  // Online payments (UPI, PhonePe, Google Pay, Paytm, or other online UPI methods)
  let method = 'Online (UPI)';
  if (rawMethod.toLowerCase().includes('phonepe')) {
    method = 'Online (PhonePe)';
  } else if (rawMethod.toLowerCase().includes('google pay') || rawMethod.toLowerCase().includes('gpay')) {
    method = 'Online (Google Pay)';
  } else if (rawMethod.toLowerCase().includes('paytm')) {
    method = 'Online (Paytm)';
  } else if (rawMethod.startsWith('Online (')) {
    method = rawMethod;
  }

  let status: 'COMPLETED' | 'PENDING VERIFICATION' | 'REJECTED' | 'UNPAID';

  if (rawStatus === 'PAID' || rawStatus === 'COMPLETED' || rawStatus === 'APPROVED' || rawStatus === 'SUCCESS') {
    status = 'COMPLETED';
  } else if (
    rawStatus === 'PENDING_VERIFICATION' ||
    rawStatus === 'PENDING VERIFICATION' ||
    (hasProof && rawStatus !== 'REJECTED' && rawStatus !== 'FAILED')
  ) {
    status = 'PENDING VERIFICATION';
  } else if (rawStatus === 'REJECTED' || rawStatus === 'FAILED') {
    status = 'REJECTED';
  } else {
    status = 'UNPAID';
  }

  const badgeStyle =
    status === 'COMPLETED'
      ? {
          bg: 'bg-emerald-500/15',
          text: 'text-[#10b981]',
          border: 'border-emerald-500/30',
          dot: 'bg-[#10b981]',
        }
      : status === 'PENDING VERIFICATION'
      ? {
          bg: 'bg-amber-500/15',
          text: 'text-[#f59e0b]',
          border: 'border-amber-500/30',
          dot: 'bg-[#f59e0b] animate-pulse',
        }
      : status === 'REJECTED'
      ? {
          bg: 'bg-rose-500/15',
          text: 'text-[#ef4444]',
          border: 'border-rose-500/30',
          dot: 'bg-[#ef4444]',
        }
      : {
          bg: 'bg-rose-500/15',
          text: 'text-[#ef4444]',
          border: 'border-rose-500/30',
          dot: 'bg-[#ef4444]',
        };

  return {
    paymentMethod: method,
    paymentStatus: status,
    badgeStyle,
  };
}

interface SixDigitAdminOtpInputProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  idPrefix?: string;
}

export const SixDigitAdminOtpInput: React.FC<SixDigitAdminOtpInputProps> = ({
  value,
  onChange,
  disabled = false,
  autoFocus = false,
  idPrefix = 'admin-otp',
}) => {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  const handleChange = (index: number, char: string) => {
    const clean = char.replace(/\D/g, '');
    if (!clean) {
      const newDigits = [...digits];
      newDigits[index] = '';
      onChange(newDigits.join(''));
      return;
    }

    if (clean.length === 1) {
      const newDigits = [...digits];
      newDigits[index] = clean;
      const combined = newDigits.join('').slice(0, 6);
      onChange(combined);
      if (index < 5 && inputsRef.current[index + 1]) {
        inputsRef.current[index + 1]?.focus();
      }
    } else {
      const slice = clean.slice(0, 6);
      onChange(slice);
      const nextIdx = Math.min(slice.length, 5);
      inputsRef.current[nextIdx]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        onChange(newDigits.join(''));
        inputsRef.current[index - 1]?.focus();
      } else {
        const newDigits = [...digits];
        newDigits[index] = '';
        onChange(newDigits.join(''));
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      onChange(pasted);
      const focusIndex = Math.min(pasted.length, 5);
      inputsRef.current[focusIndex]?.focus();
    }
  };

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <input
        type="hidden"
        id={idPrefix === 'separate-otp' ? 'separate-otp-input' : `${idPrefix}-input`}
        value={value}
        readOnly
      />
      {Array.from({ length: 6 }).map((_, idx) => (
        <input
          key={idx}
          ref={(el) => {
            inputsRef.current[idx] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          id={`${idPrefix}-box-${idx}`}
          value={digits[idx] || ''}
          onChange={(e) => handleChange(idx, e.target.value)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          onPaste={handlePaste}
          disabled={disabled}
          autoFocus={autoFocus && idx === 0}
          className="w-9 h-11 sm:w-11 sm:h-12 rounded-xl bg-black/75 text-white font-mono text-[18px] sm:text-[20px] font-bold text-center border border-white/20 focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/40 focus:outline-hidden transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] disabled:opacity-50"
        />
      ))}
    </div>
  );
};

export const AdminPortal: React.FC<AdminPortalProps> = ({
  products,
  inventoryLogs,
  coupons,
  customerOrders = [],
  onBackToStorefront,
  onUpdateProductStock,
  onUpdateProductPrice,
  onUpdateProductUnit,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onCreateCoupon,
  onUpdateCoupon,
  onDeleteCoupon,
  onToggleCoupon,
  onDeleteInventoryLog,
  onClearInventoryLogs,
  onUpdateOrderStatus,
  onDeleteCustomerOrder,
  deliveryCharges = 40,
  onUpdateDeliveryCharges,
  deliveryRules,
  onUpdateDeliveryRules,
  taxAndPackingPercentage,
  onUpdateTaxAndPacking,
  currentAdmin,
  onAdminLogout,
}) => {
  const { t } = useLanguage();
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStockStatus, setFilterStockStatus] = useState('all');
  const [adminSearch, setAdminSearch] = useState('');
  const [activeTab, setActiveTab] = useState<
    'inventory' | 'logs' | 'coupons' | 'orders' | 'settings' | 'payment-settings' | 'payment-verification' | 'admins' | 'customers'
  >('inventory');

  const [showAdminProfileMenu, setShowAdminProfileMenu] = useState(false);
  const adminProfileMenuRef = useRef<HTMLDivElement>(null);

  const [showAdminTabMenu, setShowAdminTabMenu] = useState(false);
  const adminTabMenuRef = useRef<HTMLDivElement>(null);

  const [showOrderStatusDropdown, setShowOrderStatusDropdown] = useState(false);
  const orderStatusDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (adminProfileMenuRef.current && !adminProfileMenuRef.current.contains(event.target as Node)) {
        setShowAdminProfileMenu(false);
      }
      if (adminTabMenuRef.current && !adminTabMenuRef.current.contains(event.target as Node)) {
        setShowAdminTabMenu(false);
      }
      if (orderStatusDropdownRef.current && !orderStatusDropdownRef.current.contains(event.target as Node)) {
        setShowOrderStatusDropdown(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowAdminProfileMenu(false);
        setShowAdminTabMenu(false);
        setShowOrderStatusDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const getAdminTabLabel = (tab: typeof activeTab) => {
    switch (tab) {
      case 'inventory': return t('tabLiveInventory') || 'Live Inventory';
      case 'logs': return t('tabCdcLogs') || 'CDC Logs';
      case 'coupons': return t('tabCoupons') || 'Coupons';
      case 'orders': return t('tabCustomerOrders') || 'Customer Orders';
      case 'settings': return t('tabSettings') || 'Delivery Charges';
      case 'payment-settings': return 'UPI Settings';
      case 'payment-verification': return 'Payment Verification';
      case 'admins': return 'Authorized Admins';
      case 'customers': return 'Customer Accounts';
      default: return 'Admin Dashboard';
    }
  };

  // Customer Accounts Management State
  const [customerAccounts, setCustomerAccounts] = useState<AdminCustomerAccount[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState<boolean>(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [customerStatusFilter, setCustomerStatusFilter] = useState<'all' | 'Active' | 'Suspended'>('all');
  const [customerMgmtError, setCustomerMgmtError] = useState<string | null>(null);
  const [customerMgmtSuccess, setCustomerMgmtSuccess] = useState<string | null>(null);
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<AdminCustomerAccount | null>(null);
  const [isTogglingCustomerStatus, setIsTogglingCustomerStatus] = useState<string | null>(null);

  // Authorized Administrators Management State
  const [adminsList, setAdminsList] = useState<AuthorizedAdmin[]>([]);
  const [activeAdminsCount, setActiveAdminsCount] = useState<number>(1);
  const [maxAdminsLimit, setMaxAdminsLimit] = useState<number>(5);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState<boolean>(false);
  const [adminMgmtError, setAdminMgmtError] = useState<string | null>(null);
  const [adminMgmtSuccess, setAdminMgmtSuccess] = useState<string | null>(null);

  // Add Admin Modal State
  const [showAddAdminModal, setShowAddAdminModal] = useState<boolean>(false);
  const [newAdminFullName, setNewAdminFullName] = useState<string>('');
  const [newAdminEmail, setNewAdminEmail] = useState<string>('');
  const [newAdminCustomId, setNewAdminCustomId] = useState<string>('');
  const [newAdminPassword, setNewAdminPassword] = useState<string>('');
  const [showNewAdminPassword, setShowNewAdminPassword] = useState<boolean>(false);
  const [isSubmittingAdmin, setIsSubmittingAdmin] = useState<boolean>(false);
  const [addAdminModalError, setAddAdminModalError] = useState<string | null>(null);

  // Status toggle & Delete confirmation state
  const [togglingAdminId, setTogglingAdminId] = useState<string | null>(null);
  const [deletingAdmin, setDeletingAdmin] = useState<AuthorizedAdmin | null>(null);
  const [isDeletingAdmin, setIsDeletingAdmin] = useState<boolean>(false);

  const loadCustomerAccounts = async (search?: string) => {
    setIsLoadingCustomers(true);
    setCustomerMgmtError(null);
    try {
      const res = await fetchAdminCustomerAccounts(search !== undefined ? search : customerSearchQuery);
      if (res.success) {
        setCustomerAccounts(res.customers);
      } else {
        setCustomerMgmtError(res.error || 'Failed to load customer accounts from MySQL database.');
      }
    } catch {
      setCustomerMgmtError('Network error while retrieving customer accounts.');
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const handleToggleCustomerStatus = async (customer: AdminCustomerAccount) => {
    const nextStatus = customer.status === 'Active' ? 'Suspended' : 'Active';
    setIsTogglingCustomerStatus(customer.customerId);
    setCustomerMgmtError(null);
    setCustomerMgmtSuccess(null);
    try {
      const res = await updateCustomerAccountStatus(customer.customerId, nextStatus);
      if (res.success) {
        setCustomerMgmtSuccess(`Customer account ${customer.customerId} status set to ${nextStatus}.`);
        setTimeout(() => setCustomerMgmtSuccess(null), 4000);
        setCustomerAccounts((prev) =>
          prev.map((c) => (c.customerId === customer.customerId ? { ...c, status: nextStatus } : c))
        );
        if (selectedCustomerDetail && selectedCustomerDetail.customerId === customer.customerId) {
          setSelectedCustomerDetail({ ...selectedCustomerDetail, status: nextStatus });
        }
      } else {
        setCustomerMgmtError(res.error || 'Failed to update customer account status.');
      }
    } catch {
      setCustomerMgmtError('Network error updating customer status.');
    } finally {
      setIsTogglingCustomerStatus(null);
    }
  };

  const loadAdmins = async () => {
    setIsLoadingAdmins(true);
    setAdminMgmtError(null);
    try {
      const res = await fetchAuthorizedAdmins();
      if (res.success) {
        setAdminsList(res.admins);
        setActiveAdminsCount(res.activeCount);
        setMaxAdminsLimit(res.maxLimit || 5);
      } else {
        setAdminMgmtError(res.error || 'Failed to retrieve authorized administrators.');
      }
    } catch {
      setAdminMgmtError('Network error while retrieving administrator list.');
    } finally {
      setIsLoadingAdmins(false);
    }
  };

  useEffect(() => {
    loadAdmins();
    loadCustomerAccounts();
  }, []);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddAdminModalError(null);

    const name = newAdminFullName.trim();
    const email = newAdminEmail.trim().toLowerCase();
    const pass = newAdminPassword;
    const customId = newAdminCustomId.trim();

    if (!name) {
      setAddAdminModalError('Please enter the full name of the authorized administrator.');
      return;
    }
    if (!email || !email.includes('@')) {
      setAddAdminModalError('Please enter a valid registered email address.');
      return;
    }
    if (!pass || pass.length < 6) {
      setAddAdminModalError('Assigned password must be at least 6 characters long.');
      return;
    }

    if (activeAdminsCount >= maxAdminsLimit) {
      setAddAdminModalError(`Active admin limit reached. A maximum of ${maxAdminsLimit} active admin accounts are permitted.`);
      return;
    }

    setIsSubmittingAdmin(true);
    try {
      const res = await createAuthorizedAdmin({
        fullName: name,
        email,
        password: pass,
        adminId: customId || undefined,
      });

      if (res.success) {
        setShowAddAdminModal(false);
        setNewAdminFullName('');
        setNewAdminEmail('');
        setNewAdminCustomId('');
        setNewAdminPassword('');
        setAdminMgmtSuccess(`Successfully authorized ${name} as a new administrator.`);
        setTimeout(() => setAdminMgmtSuccess(null), 4000);
        await loadAdmins();
      } else {
        setAddAdminModalError(res.error || 'Failed to add authorized administrator.');
      }
    } catch {
      setAddAdminModalError('Unexpected error occurred while creating administrator.');
    } finally {
      setIsSubmittingAdmin(false);
    }
  };

  const handleToggleAdminStatus = async (admin: AuthorizedAdmin) => {
    const nextStatus = admin.status === 'active' ? 'inactive' : 'active';
    setTogglingAdminId(admin.adminId);
    setAdminMgmtError(null);
    try {
      const res = await toggleAdminStatus(admin.adminId, nextStatus);
      if (res.success) {
        setAdminMgmtSuccess(`Administrator ${admin.fullName} has been ${nextStatus === 'active' ? 'activated' : 'deactivated'}.`);
        setTimeout(() => setAdminMgmtSuccess(null), 4000);
        await loadAdmins();
      } else {
        setAdminMgmtError(res.error || 'Failed to update administrator status.');
      }
    } catch {
      setAdminMgmtError('Network error while updating administrator status.');
    } finally {
      setTogglingAdminId(null);
    }
  };

  const handleConfirmDeleteAdmin = async () => {
    if (!deletingAdmin) return;
    setIsDeletingAdmin(true);
    setAdminMgmtError(null);
    try {
      const res = await deleteAuthorizedAdmin(deletingAdmin.adminId);
      if (res.success) {
        setAdminMgmtSuccess(`Administrator ${deletingAdmin.fullName} has been permanently removed.`);
        setTimeout(() => setAdminMgmtSuccess(null), 4000);
        setDeletingAdmin(null);
        await loadAdmins();
      } else {
        setAdminMgmtError(res.error || 'Failed to remove administrator.');
      }
    } catch {
      setAdminMgmtError('Network error while removing administrator.');
    } finally {
      setIsDeletingAdmin(false);
    }
  };

  // Customizable Delivery Charges Rules State
  const [rules, setRules] = useState<DeliveryChargeRule[]>(() => {
    if (deliveryRules && deliveryRules.length > 0) {
      return [...deliveryRules].sort((a, b) => a.minOrderAmount - b.minOrderAmount);
    }
    return DEFAULT_DELIVERY_RULES;
  });

  const activeDeliveryCharge = rules.length > 0 ? rules[0].deliveryCharge : 40;

  React.useEffect(() => {
    if (deliveryRules && deliveryRules.length > 0) {
      setRules([...deliveryRules].sort((a, b) => a.minOrderAmount - b.minOrderAmount));
    }
  }, [deliveryRules]);

  // Add Rule form inputs
  const [newMinOrder, setNewMinOrder] = useState<string>('');
  const [newDeliveryCharge, setNewDeliveryCharge] = useState<string>('');
  const [newIsFree, setNewIsFree] = useState<boolean>(false);
  const [addRuleError, setAddRuleError] = useState<string>('');

  // Edit Rule form state
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editMinOrder, setEditMinOrder] = useState<string>('');
  const [editDeliveryCharge, setEditDeliveryCharge] = useState<string>('');
  const [editIsFree, setEditIsFree] = useState<boolean>(false);
  const [editRuleError, setEditRuleError] = useState<string>('');

  // Rules save / persistence state
  const [isSavingRules, setIsSavingRules] = useState<boolean>(false);
  const [saveRulesSuccess, setSaveRulesSuccess] = useState<string>('');
  const [saveRulesError, setSaveRulesError] = useState<string>('');

  // Interactive Live Rule Simulation / Testing
  const [testSubtotalInput, setTestSubtotalInput] = useState<string>('1750');

  const handleAddRule = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAddRuleError('');
    setSaveRulesSuccess('');
    setSaveRulesError('');

    const minTrimmed = newMinOrder.trim();
    if (!minTrimmed && minTrimmed !== '0') {
      setAddRuleError('Please enter a Minimum Order Amount.');
      return;
    }
    const minNum = Number(minTrimmed);
    if (isNaN(minNum)) {
      setAddRuleError('Minimum Order Amount must be a valid number.');
      return;
    }
    if (minNum < 0) {
      setAddRuleError('Minimum Order Amount cannot be negative.');
      return;
    }

    let chargeNum = 0;
    if (!newIsFree) {
      const chargeTrimmed = newDeliveryCharge.trim();
      if (!chargeTrimmed && chargeTrimmed !== '0') {
        setAddRuleError('Please enter a Delivery Charge or select "FREE".');
        return;
      }
      chargeNum = Number(chargeTrimmed);
      if (isNaN(chargeNum)) {
        setAddRuleError('Delivery Charge must be a valid number.');
        return;
      }
      if (chargeNum < 0) {
        setAddRuleError('Delivery Charge cannot be negative.');
        return;
      }
    }

    const roundedMin = Math.round(minNum * 100) / 100;
    const roundedCharge = Math.round(chargeNum * 100) / 100;

    // Duplicate check
    if (rules.some((r) => r.minOrderAmount === roundedMin)) {
      setAddRuleError(`A rule for Minimum Order Amount of ₹${roundedMin} already exists.`);
      return;
    }

    const newRule: DeliveryChargeRule = {
      id: `rule-${roundedMin}-${Date.now()}`,
      minOrderAmount: roundedMin,
      deliveryCharge: roundedCharge,
    };

    const updated = [...rules, newRule].sort((a, b) => a.minOrderAmount - b.minOrderAmount);
    setRules(updated);
    setNewMinOrder('');
    setNewDeliveryCharge('');
    setNewIsFree(false);
    setAddRuleError('');
  };

  const handleStartEdit = (rule: DeliveryChargeRule) => {
    setEditingRuleId(rule.id);
    setEditMinOrder(String(rule.minOrderAmount));
    setEditDeliveryCharge(rule.deliveryCharge === 0 ? '0' : String(rule.deliveryCharge));
    setEditIsFree(rule.deliveryCharge === 0);
    setEditRuleError('');
  };

  const handleSaveEdit = (ruleId: string) => {
    setEditRuleError('');
    const minTrimmed = editMinOrder.trim();
    if (!minTrimmed && minTrimmed !== '0') {
      setEditRuleError('Please enter a Minimum Order Amount.');
      return;
    }
    const minNum = Number(minTrimmed);
    if (isNaN(minNum)) {
      setEditRuleError('Minimum Order Amount must be a valid number.');
      return;
    }
    if (minNum < 0) {
      setEditRuleError('Minimum Order Amount cannot be negative.');
      return;
    }

    let chargeNum = 0;
    if (!editIsFree) {
      const chargeTrimmed = editDeliveryCharge.trim();
      if (!chargeTrimmed && chargeTrimmed !== '0') {
        setEditRuleError('Please enter a Delivery Charge or select "FREE".');
        return;
      }
      chargeNum = Number(chargeTrimmed);
      if (isNaN(chargeNum)) {
        setEditRuleError('Delivery Charge must be a valid number.');
        return;
      }
      if (chargeNum < 0) {
        setEditRuleError('Delivery Charge cannot be negative.');
        return;
      }
    }

    const roundedMin = Math.round(minNum * 100) / 100;
    const roundedCharge = Math.round(chargeNum * 100) / 100;

    // Check duplicate against other rules
    if (rules.some((r) => r.id !== ruleId && r.minOrderAmount === roundedMin)) {
      setEditRuleError(`A rule for Minimum Order Amount of ₹${roundedMin} already exists.`);
      return;
    }

    const updated = rules
      .map((r) =>
        r.id === ruleId
          ? { ...r, minOrderAmount: roundedMin, deliveryCharge: roundedCharge }
          : r
      )
      .sort((a, b) => a.minOrderAmount - b.minOrderAmount);

    setRules(updated);
    setEditingRuleId(null);
    setEditRuleError('');
  };

  const handleCancelEdit = () => {
    setEditingRuleId(null);
    setEditRuleError('');
  };

  const handleDeleteRule = (ruleId: string) => {
    const updated = rules.filter((r) => r.id !== ruleId);
    setRules(updated);
    if (editingRuleId === ruleId) {
      setEditingRuleId(null);
    }
  };

  const handleSaveAllRules = async () => {
    setSaveRulesError('');
    setSaveRulesSuccess('');

    if (rules.length === 0) {
      setSaveRulesError('Please configure at least one delivery charge rule.');
      return;
    }

    setIsSavingRules(true);
    try {
      const sorted = [...rules].sort((a, b) => a.minOrderAmount - b.minOrderAmount);
      if (onUpdateDeliveryRules) {
        await onUpdateDeliveryRules(sorted);
      }
      if (onUpdateDeliveryCharges) {
        await onUpdateDeliveryCharges(sorted[0]?.deliveryCharge || 0);
      }
      setSaveRulesSuccess('Delivery charge rules saved successfully!');
      setTimeout(() => setSaveRulesSuccess(''), 4000);
    } catch {
      setSaveRulesError('Failed to save rules. Please try again.');
    } finally {
      setIsSavingRules(false);
    }
  };

  const handleResetToDefaultRules = () => {
    setRules(DEFAULT_DELIVERY_RULES);
    setEditingRuleId(null);
    setAddRuleError('');
    setEditRuleError('');
    setSaveRulesSuccess('Reset to default example rules. Click "Save Delivery Rules" to commit.');
    setTimeout(() => setSaveRulesSuccess(''), 4000);
  };

  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [historySearchInput, setHistorySearchInput] = useState<string>('');
  const [activeHistoryPeriod, setActiveHistoryPeriod] = useState<ParsedHistoryPeriod | null>(null);
  const [historySearchError, setHistorySearchError] = useState<string | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<number>(0);
  const [editingCustomUnitId, setEditingCustomUnitId] = useState<string | null>(null);
  const [customUnitInput, setCustomUnitInput] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [deleteConfirmCoupon, setDeleteConfirmCoupon] = useState<Coupon | null>(null);
  const [deleteConfirmLog, setDeleteConfirmLog] = useState<InventoryLog | null>(null);
  const [showClearLogsConfirm, setShowClearLogsConfirm] = useState(false);
  const [pulseToast, setPulseToast] = useState<string | null>(null);

  // Customer Orders Ledger state & synchronization with authoritative database
  const [ordersList, setOrdersList] = useState<CustomerOrder[]>(customerOrders);
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
  }, [activeTab]);

  // OTP Verification States for Admin Customer Orders Ledger
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

  // Fetch authoritative OTP record status when opening dedicated OTP page and for active ledger orders
  useEffect(() => {
    if (!selectedOtpOrderId) return;
    getOrderOtpStatus(selectedOtpOrderId, { role: 'admin' }).then((status) => {
      if (status) {
        setOrderOtpStatusMap((prev) => ({ ...prev, [selectedOtpOrderId]: status }));
      }
    });
  }, [selectedOtpOrderId]);

  useEffect(() => {
    const eligibleOrders = ordersList.filter((o) => {
      if (o.status === 'Delivered') return false;
      const isCod =
        !o.paymentMethod ||
        o.paymentMethod.toLowerCase().includes('cash') ||
        o.paymentMethod.toUpperCase() === 'COD';
      const isCompleted =
        o.paymentStatus === 'COMPLETED' || o.paymentStatus === 'PAID';
      return isCod || isCompleted;
    });

    eligibleOrders.forEach((o) => {
      getOrderOtpStatus(o.id, { role: 'admin' }).then((status) => {
        if (status) {
          setOrderOtpStatusMap((prev) => ({ ...prev, [o.id]: status }));
        }
      });
    });
  }, [ordersList]);

  // UPI Payment Configuration State
  const [upiIdInput, setUpiIdInput] = useState('');
  const [merchantNameInput, setMerchantNameInput] = useState('');
  const [adminQrPreviewUrl, setAdminQrPreviewUrl] = useState<string>('');
  const [adminQrPreviewUri, setAdminQrPreviewUri] = useState<string>('');
  const [isAdminQrGenerating, setIsAdminQrGenerating] = useState<boolean>(false);
  const [upiSaveSuccess, setUpiSaveSuccess] = useState<string | null>(null);
  const [upiSaveError, setUpiSaveError] = useState<string | null>(null);
  const [isSavingUpi, setIsSavingUpi] = useState(false);

  useEffect(() => {
    fetchUpiSettings().then((s) => {
      if (s) {
        setUpiIdInput(s.upiId || '');
        setMerchantNameInput(s.merchantName || '');
        if (s.qrCodeUrl) {
          setAdminQrPreviewUrl(s.qrCodeUrl);
        }
      }
    });
  }, []);

  // Generate live UPI QR preview whenever UPI ID or Merchant Name changes
  useEffect(() => {
    const trimmedId = upiIdInput.trim();
    const trimmedName = merchantNameInput.trim() || 'FreshCart Store';

    if (trimmedId && isValidUpiId(trimmedId)) {
      setIsAdminQrGenerating(true);
      const previewUri = buildUpiUri({
        upiId: trimmedId,
        merchantName: trimmedName,
      });
      setAdminQrPreviewUri(previewUri);

      QRCode.toDataURL(previewUri, {
        width: 220,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#050c18',
          light: '#ffffff',
        },
      })
        .then((url) => {
          setAdminQrPreviewUrl(url);
          setIsAdminQrGenerating(false);
        })
        .catch((err) => {
          console.error('[Admin UPI] Error generating preview QR:', err);
          setAdminQrPreviewUrl('');
          setAdminQrPreviewUri('');
          setIsAdminQrGenerating(false);
        });
    } else {
      setAdminQrPreviewUrl('');
      setAdminQrPreviewUri('');
      setIsAdminQrGenerating(false);
    }
  }, [upiIdInput, merchantNameInput]);

  const handleSaveUpiSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpiSaveSuccess(null);
    setUpiSaveError(null);

    const trimmedId = upiIdInput.trim();
    const trimmedName = merchantNameInput.trim();

    if (!trimmedId) {
      setUpiSaveError('Please enter a valid UPI ID (e.g. example@upi).');
      return;
    }

    if (!isValidUpiId(trimmedId)) {
      setUpiSaveError('Invalid UPI ID format. Please enter a valid handle (e.g. example@upi, riya.bakery@sbi).');
      return;
    }

    if (!trimmedName) {
      setUpiSaveError('Please enter a Merchant / Business Name.');
      return;
    }

    setIsSavingUpi(true);
    try {
      let qrDataUrlToSave = adminQrPreviewUrl;
      if (!qrDataUrlToSave) {
        const previewUri = buildUpiUri({
          upiId: trimmedId,
          merchantName: trimmedName,
        });
        qrDataUrlToSave = await QRCode.toDataURL(previewUri, {
          width: 240,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#050c18', light: '#ffffff' },
        });
      }

      const res = await saveUpiSettings({
        upiId: trimmedId,
        merchantName: trimmedName,
        enabled: true,
        qrCodeUrl: qrDataUrlToSave,
      });

      if (res.success) {
        if (res.settings) {
          setUpiIdInput(res.settings.upiId || trimmedId);
          setMerchantNameInput(res.settings.merchantName || trimmedName);
          if (res.settings.qrCodeUrl) {
            setAdminQrPreviewUrl(res.settings.qrCodeUrl);
          }
        }
        setUpiSaveSuccess('UPI payment settings and QR configuration saved successfully!');
      } else {
        setUpiSaveError(res.error || 'Failed to save UPI settings.');
      }
    } catch (err: any) {
      setUpiSaveError(err?.message || 'Error saving UPI settings.');
    } finally {
      setIsSavingUpi(false);
    }
  };

  // UPI Payment Verification State
  const [verificationQueue, setVerificationQueue] = useState<PaymentVerificationItem[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [queueFilter, setQueueFilter] = useState<'all' | 'pending' | 'paid' | 'rejected'>('pending');
  const [viewingScreenshotItem, setViewingScreenshotItem] = useState<PaymentVerificationItem | null>(null);
  const [screenshotZoom, setScreenshotZoom] = useState(1);
  const [rejectingItem, setRejectingItem] = useState<PaymentVerificationItem | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [isVerifyingAction, setIsVerifyingAction] = useState(false);
  const [deleteConfirmVerificationOrder, setDeleteConfirmVerificationOrder] = useState<PaymentVerificationItem | null>(null);
  const [isDeletingVerificationOrder, setIsDeletingVerificationOrder] = useState(false);
  const [queueFeedback, setQueueFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Bulk Deletion State for Verified & Paid and Rejected sections
  const [selectedPaidOrderIds, setSelectedPaidOrderIds] = useState<Set<string>>(new Set());
  const [selectedRejectedOrderIds, setSelectedRejectedOrderIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState<{
    type: 'SELECTED' | 'ALL';
    section: 'PAID' | 'REJECTED';
    sectionName: string;
    count: number;
    orderIds?: string[];
  } | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const loadVerificationQueue = React.useCallback(async () => {
    setIsLoadingQueue(true);
    try {
      const res = await fetchPaymentVerificationQueue();
      if (res.success && res.payments) {
        setVerificationQueue(res.payments);
        const availableIds = new Set(res.payments.map((p) => p.orderId.replace(/^#/, '')));
        setSelectedPaidOrderIds((prev) => {
          const next = new Set<string>();
          for (const id of prev) {
            if (availableIds.has(id)) next.add(id);
          }
          return next;
        });
        setSelectedRejectedOrderIds((prev) => {
          const next = new Set<string>();
          for (const id of prev) {
            if (availableIds.has(id)) next.add(id);
          }
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to load verification queue:', err);
    } finally {
      setIsLoadingQueue(false);
    }
  }, []);

  useEffect(() => {
    loadVerificationQueue();
  }, [loadVerificationQueue]);

  const pendingVerificationCount = verificationQueue.filter(
    (item) => item.paymentStatus === 'PENDING_VERIFICATION' || (item.paymentStatus as string) === 'PENDING'
  ).length;

  const handleApprovePayment = async (item: PaymentVerificationItem) => {
    setIsVerifyingAction(true);
    setQueueFeedback(null);
    try {
      const res = await adminVerifyPayment(item.orderId, 'APPROVE');
      if (res.success) {
        const cleanId = item.orderId.replace(/^#/, '');
        setQueueFeedback({
          type: 'success',
          message: `Payment for Order #${cleanId} verified successfully and confirmed as COMPLETED in database. Delivery OTP dispatched to customer.`,
        });
        const verifiedAt = res.verifiedAt || new Date().toISOString();
        const verifiedBy = res.verifiedBy || 'admin';
        updateOrderPaymentStatus(item.orderId, 'COMPLETED', {
          verifiedAt,
          verifiedBy,
        });
        setOrdersList((prev) =>
          prev.map((o) => {
            const oClean = o.id.replace(/^#/, '');
            return oClean === cleanId
              ? {
                  ...o,
                  paymentStatus: 'COMPLETED',
                  verifiedAt,
                  verifiedBy,
                  screenshotUrl: undefined,
                }
              : o;
          })
        );
        if (onUpdateOrderStatus) {
          onUpdateOrderStatus(item.orderId, 'Picking');
        }
        if (viewingScreenshotItem?.orderId === item.orderId) {
          setViewingScreenshotItem(null);
        }
        await loadVerificationQueue();
      } else {
        setQueueFeedback({
          type: 'error',
          message: res.error || 'Failed to verify payment.',
        });
      }
    } catch (err: any) {
      setQueueFeedback({
        type: 'error',
        message: err?.message || 'Error occurred while verifying payment.',
      });
    } finally {
      setIsVerifyingAction(false);
    }
  };

  const handleRejectPayment = async (item: PaymentVerificationItem, reason: string) => {
    if (!reason.trim()) {
      setQueueFeedback({
        type: 'error',
        message: 'Please provide a rejection reason.',
      });
      return;
    }
    setIsVerifyingAction(true);
    setQueueFeedback(null);
    try {
      const res = await adminVerifyPayment(item.orderId, 'REJECT', reason.trim());
      if (res.success) {
        const cleanId = item.orderId.replace(/^#/, '');
        const verifiedAt = res.verifiedAt || new Date().toISOString();
        const verifiedBy = res.verifiedBy || 'admin';
        updateOrderPaymentStatus(item.orderId, 'REJECTED', {
          verificationNotes: reason.trim(),
          verifiedAt,
          verifiedBy,
        });
        setOrdersList((prev) =>
          prev.map((o) => {
            const oClean = o.id.replace(/^#/, '');
            return oClean === cleanId
              ? {
                  ...o,
                  paymentStatus: 'REJECTED',
                  verificationNotes: reason.trim(),
                  verifiedAt,
                  verifiedBy,
                }
              : o;
          })
        );
        setRejectingItem(null);
        setRejectReasonInput('');
        if (viewingScreenshotItem?.orderId === item.orderId) {
          setViewingScreenshotItem(null);
        }
        await loadVerificationQueue();
      } else {
        setQueueFeedback({
          type: 'error',
          message: res.error || 'Failed to reject payment.',
        });
      }
    } catch (err: any) {
      setQueueFeedback({
        type: 'error',
        message: err?.message || 'Error occurred while rejecting payment.',
      });
    } finally {
      setIsVerifyingAction(false);
    }
  };

  const handleConfirmCashCollection = async (orderId: string) => {
    setIsConfirmingCash((prev) => ({ ...prev, [orderId]: true }));
    try {
      await confirmCodCashCollection(orderId);
      const verifiedAt = new Date().toISOString();
      const adminName = currentAdmin?.fullName || currentAdmin?.adminId || 'Admin';
      setOrdersList((prev) =>
        prev.map((o) => {
          const oClean = o.id.replace(/^#/, '');
          const cleanId = orderId.replace(/^#/, '');
          return oClean === cleanId
            ? {
                ...o,
                paymentStatus: 'COMPLETED',
                verifiedAt,
                verifiedBy: adminName,
              }
            : o;
        })
      );
      if (onUpdateOrderStatus) {
        const found = ordersList.find(
          (o) => o.id === orderId || o.id.replace(/^#/, '') === orderId.replace(/^#/, '')
        );
        if (found) {
          onUpdateOrderStatus(orderId, found.status, { paymentStatus: 'COMPLETED' } as any);
        }
      }
    } finally {
      setIsConfirmingCash((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const handleDeleteVerificationOrder = async (item: PaymentVerificationItem) => {
    if (!item) return;
    setIsDeletingVerificationOrder(true);
    try {
      const cleanId = item.orderId.replace(/^#/, '');
      const res = await adminDeleteVerificationOrder(cleanId);
      if (res.success) {
        setVerificationQueue((prev) =>
          prev.filter((q) => q.orderId.replace(/^#/, '') !== cleanId)
        );
        setSelectedPaidOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(cleanId);
          return next;
        });
        setSelectedRejectedOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(cleanId);
          return next;
        });
        setDeleteConfirmVerificationOrder(null);
        setQueueFeedback({
          type: 'success',
          message: res.message || `Order #${cleanId} deleted successfully.`,
        });
        await loadVerificationQueue();
      } else {
        setQueueFeedback({
          type: 'error',
          message: res.error || 'Failed to delete order.',
        });
        setDeleteConfirmVerificationOrder(null);
      }
    } catch (err: any) {
      setQueueFeedback({
        type: 'error',
        message: err?.message || 'Error occurred while deleting order.',
      });
      setDeleteConfirmVerificationOrder(null);
    } finally {
      setIsDeletingVerificationOrder(false);
    }
  };

  const handleExecuteBulkDelete = async () => {
    if (!bulkDeleteConfirm || isBulkDeleting) return;
    setIsBulkDeleting(true);
    try {
      const res = await adminBulkDeleteVerificationOrders({
        statusFilter: bulkDeleteConfirm.section,
        orderIds: bulkDeleteConfirm.type === 'SELECTED' ? bulkDeleteConfirm.orderIds : undefined,
        deleteAll: bulkDeleteConfirm.type === 'ALL',
      });

      if (res.success) {
        const deletedIds = res.deletedOrderIds || bulkDeleteConfirm.orderIds || [];
        const deletedSet = new Set(deletedIds.map((id) => id.replace(/^#/, '')));

        setVerificationQueue((prev) =>
          prev.filter((item) => {
            if (bulkDeleteConfirm.type === 'ALL') {
              return item.paymentStatus !== bulkDeleteConfirm.section;
            }
            return !deletedSet.has(item.orderId.replace(/^#/, ''));
          })
        );

        if (bulkDeleteConfirm.section === 'PAID') {
          setSelectedPaidOrderIds(new Set());
        } else {
          setSelectedRejectedOrderIds(new Set());
        }

        setBulkDeleteConfirm(null);
        const count = res.deletedCount ?? bulkDeleteConfirm.count;
        setQueueFeedback({
          type: 'success',
          message: res.message || `Successfully deleted ${count} ${bulkDeleteConfirm.sectionName} record${count === 1 ? '' : 's'}.`,
        });

        await loadVerificationQueue();
      } else {
        setQueueFeedback({
          type: 'error',
          message: res.error || 'Failed to delete records.',
        });
        setBulkDeleteConfirm(null);
      }
    } catch (err: any) {
      setQueueFeedback({
        type: 'error',
        message: err?.message || 'Error occurred during deletion.',
      });
      setBulkDeleteConfirm(null);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const customCategories = Array.from(
    new Set(products.map((p) => p.category))
  ).filter((c) => !['produce', 'dairy', 'bakery', 'beverages', 'snacks', 'grains'].includes(c));

  const allCatalogCategories = Array.from(new Set(products.map((p) => p.category)));

  const totalSkus = products.length;
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= 5).length;
  const outOfStockCount = products.filter((p) => p.stock === 0).length;

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(adminSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(adminSearch.toLowerCase()) ||
      p.supplier.toLowerCase().includes(adminSearch.toLowerCase());

    const matchesCategory =
      filterCategory === 'all' || p.category === filterCategory;

    const matchesStock =
      filterStockStatus === 'all' ||
      (filterStockStatus === 'low' && p.stock > 0 && p.stock <= 5) ||
      (filterStockStatus === 'out' && p.stock === 0) ||
      (filterStockStatus === 'healthy' && p.stock > 5);

    return matchesSearch && matchesCategory && matchesStock;
  });

  const formatOrderProductItem = (item: { product: Product; quantity: number }) => {
    const qty = item.quantity;
    const unit = item.product.unit || 'unit';
    let unitFormatted = '';

    if (qty === 1) {
      unitFormatted = unit;
    } else if (/^1\s+[a-zA-Z]+$/i.test(unit)) {
      // e.g. "1 kg" -> "2 kg", "1 dozen" -> "2 dozen"
      const unitName = unit.replace(/^1\s+/i, '');
      unitFormatted = `${qty} ${unitName}`;
    } else {
      // e.g. "500 ml" -> "2 × 500 ml", "piece" -> "2 × piece"
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

  // OTP Handlers for Customer Order Handover
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
              message: res.remainingAttempts !== undefined
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

  const handleGenerateOtp = async (order: CustomerOrder) => {
    if (isSendingOtp[order.id]) return;
    const rawPhone = getCustomerPhoneForOrder(order);
    setIsSendingOtp((prev) => ({ ...prev, [order.id]: true }));
    try {
      const res = await generateOrderOtp(order.id, order.customerId || 'guest', rawPhone || '');
      if (res.success) {
        setOrderOtpFeedback((prev) => ({
          ...prev,
          [order.id]: {
            type: 'success',
            message: 'Order Handover OTP generated and dispatched to customer.',
          },
        }));
        const updatedStatus = await getOrderOtpStatus(order.id, { role: 'admin' });
        if (updatedStatus) {
          setOrderOtpStatusMap((prev) => ({ ...prev, [order.id]: updatedStatus }));
        }
      } else {
        setOrderOtpFeedback((prev) => ({
          ...prev,
          [order.id]: {
            type: 'error',
            message: res.error || res.message || 'Failed to generate OTP.',
          },
        }));
      }
    } catch {
      setOrderOtpFeedback((prev) => ({
        ...prev,
        [order.id]: {
          type: 'error',
          message: 'Error communicating with server to generate OTP.',
        },
      }));
    } finally {
      setIsSendingOtp((prev) => ({ ...prev, [order.id]: false }));
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
        const updatedStatus = await getOrderOtpStatus(order.id, { role: 'admin' });
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

  const handleStartEditPrice = (product: Product) => {
    setEditingPriceId(product.id);
    setTempPrice(product.price);
  };

  const handleSavePrice = (productId: string) => {
    if (tempPrice > 0) {
      onUpdateProductPrice(productId, tempPrice);
    }
    setEditingPriceId(null);
  };

  const handleSaveCustomUnit = (productId: string) => {
    const trimmed = customUnitInput.trim();
    if (trimmed) {
      onUpdateProductUnit(productId, trimmed);
      const prod = products.find((p) => p.id === productId);
      setPulseToast(`Updated unit for "${prod?.title || 'product'}" to "${trimmed}"`);
      setTimeout(() => setPulseToast(null), 2500);
    }
    setEditingCustomUnitId(null);
  };

  return (
    <div className="w-full min-h-screen bg-transparent text-[#0b1c30] pb-16 relative z-10">
      {/* Top Admin Action Bar */}
      <div className="bg-transparent text-white py-3 px-4 sm:px-6 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToStorefront}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#334155]/80 hover:bg-[#475569] text-[12px] font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t('backToStorefrontBtn')}</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Language Selector in Admin Portal */}
            <LanguageSelector variant="dark" idPrefix="admin-lang" />

            {/* Quick Delivery Charges in Admin Header */}
            <button
              type="button"
              id="admin-header-delivery-btn"
              onClick={() => setActiveTab('settings')}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#475569] text-white hover:bg-[#334155] text-[12px] font-medium transition-colors cursor-pointer"
              title="Configure Delivery Charges"
            >
              <Truck className="w-3.5 h-3.5 text-[#7ffc97]" />
              <span>Delivery Charges: <strong className="text-[#7ffc97]">{activeDeliveryCharge > 0 ? formatINR(activeDeliveryCharge) : 'FREE'}</strong></span>
            </button>

            {/* Admin Profile Dropdown Menu */}
            <div className="relative pl-2" ref={adminProfileMenuRef}>
              <button
                type="button"
                id="admin-profile-menu-btn"
                aria-haspopup="true"
                aria-expanded={showAdminProfileMenu}
                onClick={() => setShowAdminProfileMenu(!showAdminProfileMenu)}
                className="flex items-center gap-2 px-2 py-1 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 hover:border-emerald-500/40 transition-all cursor-pointer shadow-xs"
              >
                <div className="relative">
                  <img
                    src={USER_AVATAR_URL}
                    alt={currentAdmin?.fullName || 'Admin User'}
                    className="w-8 h-8 rounded-full object-cover border border-[#475569]"
                  />
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#10b981] ring-1 ring-black" />
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-[12px] font-semibold leading-tight text-white">{currentAdmin?.fullName || 'Sarah L.'}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded-sm leading-tight ${
                        currentAdmin?.role === 'owner'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {currentAdmin?.role === 'owner' ? 'Project Owner' : t('opsManager')}
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#94a3b8] transition-transform duration-200 ${
                    showAdminProfileMenu ? 'rotate-180 text-[#10b981]' : ''
                  }`}
                />
              </button>

              {showAdminProfileMenu && (
                <div
                  id="admin-profile-dropdown-menu"
                  data-dropdown-menu="true"
                  className="freshcart-dropdown-menu absolute right-0 top-full mt-2 w-72 p-2 z-50 animate-in fade-in zoom-in-95 duration-150 max-w-[calc(100vw-2rem)]"
                  style={{
                    backgroundColor: 'rgba(3, 7, 12, 0.96)',
                    WebkitBackdropFilter: 'blur(16px)',
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  <div className="px-3 py-2.5 border-b freshcart-dropdown-divider mb-1">
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          currentAdmin?.role === 'owner'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {currentAdmin?.role === 'owner' ? 'Project Owner' : 'Operations Manager'}
                      </span>
                      <span className="text-[10px] text-emerald-400 font-mono">Online</span>
                    </div>
                    <p className="text-[13px] font-bold text-white truncate">{currentAdmin?.fullName || 'Sarah L.'}</p>
                    <p className="text-[11px] text-[#94a3b8] truncate">{currentAdmin?.email || 'admin@freshcart.ops'}</p>
                  </div>

                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">
                    Admin Dashboard Views
                  </div>

                  <div className="space-y-0.5 max-h-64 overflow-y-auto">
                    {[
                      { id: 'inventory', label: t('tabLiveInventory') || 'Live Inventory', icon: Package },
                      { id: 'orders', label: t('tabCustomerOrders') || 'Customer Orders', icon: ShoppingBag },
                      { id: 'payment-verification', label: 'Payment Verification', icon: CheckCircle, badge: pendingVerificationCount },
                      { id: 'coupons', label: t('tabCoupons') || 'Coupons', icon: Tag },
                      { id: 'settings', label: t('tabSettings') || 'Delivery Charges', icon: Truck },
                      { id: 'payment-settings', label: 'UPI Settings', icon: CreditCard },
                      { id: 'admins', label: 'Authorized Admins', icon: ShieldCheck },
                      { id: 'customers', label: 'Customer Accounts', icon: Users },
                      { id: 'logs', label: t('tabCdcLogs') || 'CDC Logs', icon: History },
                    ].map((item) => {
                      const isActive = activeTab === item.id;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          id={`admin-menu-${item.id}`}
                          onClick={() => {
                            if (item.id === 'payment-verification') loadVerificationQueue();
                            if (item.id === 'admins') loadAdmins();
                            if (item.id === 'customers') loadCustomerAccounts();
                            if (item.id === 'orders') setSelectedOtpOrderId(null);
                            setActiveTab(item.id as any);
                            setShowAdminProfileMenu(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12px] transition-all cursor-pointer ${
                            isActive
                              ? 'freshcart-dropdown-item-active'
                              : 'freshcart-dropdown-item text-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className={`w-4 h-4 ${isActive ? 'text-[#10b981]' : 'text-[#34d399]'}`} />
                            <span className={isActive ? 'font-semibold text-[#10b981]' : 'text-slate-100'}>{item.label}</span>
                          </div>
                          {item.badge ? (
                            <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                              {item.badge}
                            </span>
                          ) : isActive ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] shadow-[0_0_6px_#10b981]" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>

                  {onBackToStorefront && (
                    <div className="border-t freshcart-dropdown-divider mt-1.5 pt-1.5">
                      <button
                        type="button"
                        id="admin-menu-storefront-btn"
                        onClick={() => {
                          setShowAdminProfileMenu(false);
                          onBackToStorefront();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-[12px] freshcart-dropdown-item flex items-center gap-2.5 cursor-pointer text-slate-100"
                      >
                        <Store className="w-4 h-4 text-[#34d399]" />
                        <span>{t('navRetailStorefront')}</span>
                      </button>
                    </div>
                  )}

                  {onAdminLogout && (
                    <div className="border-t freshcart-dropdown-divider mt-1 pt-1">
                      <button
                        type="button"
                        id="admin-menu-logout-btn"
                        onClick={() => {
                          setShowAdminProfileMenu(false);
                          onAdminLogout();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-[12px] font-semibold freshcart-dropdown-item-danger flex items-center gap-2.5 cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-[#f87171]" />
                        <span>Sign Out of Ops</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {onAdminLogout && (
              <button
                type="button"
                id="admin-logout-btn"
                onClick={onAdminLogout}
                className="ml-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-semibold transition-colors cursor-pointer border border-rose-500/30 shadow-2xs"
                title="Sign out of Admin Portal"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {pulseToast && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3">
          <div className="bg-[#dcfce7] border border-[#86efac] text-[#15803d] px-4 py-2 rounded-xl text-[12px] font-semibold flex items-center justify-between shadow-xs animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#16a34a]" />
              <span>{pulseToast}</span>
            </div>
            <button onClick={() => setPulseToast(null)} className="text-[#16a34a]">
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#e2e8f0] shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[12px] text-[#64748b] font-medium block">
                {t('totalSkusMonitored')}
              </span>
              <span className="text-[28px] font-extrabold text-[#0f172a] font-display tabular-nums">
                {totalSkus}
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#eff4ff] text-[#006b2c] flex items-center justify-center">
              <Package className="w-6 h-6 text-[#006b2c]" />
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#e2e8f0] shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[12px] text-[#64748b] font-medium block">
                {t('stockWarnings')}
              </span>
              <span className="text-[28px] font-extrabold text-[#b45309] font-display tabular-nums">
                {lowStockCount + outOfStockCount}
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#fee2e2] text-[#ef4444] flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-[#ef4444]" />
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-[#e2e8f0] pb-2 gap-3">
          {/* Quick Dashboard Views Dropdown Menu */}
          <div className="relative shrink-0" ref={adminTabMenuRef}>
            <button
              type="button"
              id="admin-dashboard-views-dropdown-btn"
              aria-haspopup="true"
              aria-expanded={showAdminTabMenu}
              onClick={() => setShowAdminTabMenu(!showAdminTabMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/20 bg-black/40 hover:bg-black/60 text-white text-[12px] font-semibold transition-all shadow-sm cursor-pointer hover:border-emerald-500/40"
              title="Select Dashboard View"
            >
              <Package className="w-3.5 h-3.5 text-[#10b981]" />
              <span className="truncate max-w-[150px]">View: <strong>{getAdminTabLabel(activeTab)}</strong></span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#94a3b8] transition-transform duration-200 ${
                  showAdminTabMenu ? 'rotate-180 text-[#10b981]' : ''
                }`}
              />
            </button>

            {showAdminTabMenu && (
              <div
                id="admin-dashboard-views-dropdown-menu"
                data-dropdown-menu="true"
                className="freshcart-dropdown-menu absolute left-0 top-full mt-2 w-72 p-2 z-50 animate-in fade-in zoom-in-95 duration-150 max-w-[calc(100vw-2rem)]"
                style={{
                  backgroundColor: 'rgba(3, 7, 12, 0.96)',
                  WebkitBackdropFilter: 'blur(16px)',
                  backdropFilter: 'blur(16px)',
                }}
              >
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] border-b freshcart-dropdown-divider mb-1">
                  Select Dashboard View
                </div>
                <div className="space-y-0.5">
                  {[
                    { id: 'inventory', label: t('tabLiveInventory') || 'Live Inventory', icon: Package },
                    { id: 'orders', label: t('tabCustomerOrders') || 'Customer Orders', icon: ShoppingBag },
                    { id: 'payment-verification', label: 'Payment Verification', icon: CheckCircle, badge: pendingVerificationCount },
                    { id: 'coupons', label: t('tabCoupons') || 'Coupons', icon: Tag },
                    { id: 'settings', label: t('tabSettings') || 'Delivery Charges', icon: Truck },
                    { id: 'payment-settings', label: 'UPI Settings', icon: CreditCard },
                    { id: 'admins', label: 'Authorized Admins', icon: ShieldCheck },
                    { id: 'customers', label: 'Customer Accounts', icon: Users },
                    { id: 'logs', label: t('tabCdcLogs') || 'CDC Logs', icon: History },
                  ].map((item) => {
                    const isActive = activeTab === item.id;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        id={`admin-tab-view-${item.id}`}
                        onClick={() => {
                          if (item.id === 'payment-verification') loadVerificationQueue();
                          if (item.id === 'admins') loadAdmins();
                          if (item.id === 'customers') loadCustomerAccounts();
                          if (item.id === 'orders') setSelectedOtpOrderId(null);
                          setActiveTab(item.id as any);
                          setShowAdminTabMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12px] transition-all cursor-pointer ${
                          isActive
                            ? 'freshcart-dropdown-item-active'
                            : 'freshcart-dropdown-item text-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className={`w-4 h-4 ${isActive ? 'text-[#10b981]' : 'text-[#34d399]'}`} />
                          <span className={isActive ? 'font-semibold text-[#10b981]' : 'text-slate-100'}>{item.label}</span>
                        </div>
                        {item.badge ? (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                            {item.badge}
                          </span>
                        ) : isActive ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] shadow-[0_0_6px_#10b981]" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 overflow-x-auto pb-1">
            <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`pb-3 text-[13px] font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'inventory'
                ? 'border-[#006b2c] text-[#006b2c]'
                : 'border-transparent text-[#64748b] hover:text-[#0b1c30]'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>{t('tabLiveInventory')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`pb-3 text-[13px] font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'logs'
                ? 'border-[#006b2c] text-[#006b2c]'
                : 'border-transparent text-[#64748b] hover:text-[#0b1c30]'
            }`}
          >
            <History className="w-4 h-4" />
            <span>{t('tabCdcLogs')}</span>
          </button>
          <button
            type="button"
            id="admin-tab-coupons"
            onClick={() => setActiveTab('coupons')}
            className={`pb-3 text-[13px] font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'coupons'
                ? 'border-[#006b2c] text-[#006b2c]'
                : 'border-transparent text-[#64748b] hover:text-[#0b1c30]'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>{t('tabCoupons')}</span>
          </button>
          <button
            type="button"
            id="admin-tab-orders"
            onClick={() => {
              setActiveTab('orders');
              setSelectedOtpOrderId(null);
            }}
            className={`pb-3 text-[13px] font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'orders'
                ? 'border-[#006b2c] text-[#006b2c]'
                : 'border-transparent text-[#64748b] hover:text-[#0b1c30]'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>{t('tabCustomerOrders') || 'Customer Orders'}</span>
          </button>
          <button
            type="button"
            id="admin-tab-settings"
            onClick={() => setActiveTab('settings')}
            className={`pb-3 text-[13px] font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'settings'
                ? 'border-[#006b2c] text-[#006b2c]'
                : 'border-transparent text-[#64748b] hover:text-[#0b1c30]'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>{t('tabSettings') || 'Delivery Charges'}</span>
          </button>
          <button
            type="button"
            id="admin-tab-payment-settings"
            onClick={() => setActiveTab('payment-settings')}
            className={`pb-3 text-[13px] font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'payment-settings'
                ? 'border-[#006b2c] text-[#006b2c]'
                : 'border-transparent text-[#64748b] hover:text-[#0b1c30]'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>UPI Settings</span>
          </button>
          <button
            type="button"
            id="admin-tab-payment-verification"
            onClick={() => {
              setActiveTab('payment-verification');
              loadVerificationQueue();
            }}
            className={`pb-3 text-[13px] font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'payment-verification'
                ? 'border-[#006b2c] text-[#006b2c]'
                : 'border-transparent text-[#64748b] hover:text-[#0b1c30]'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            <span>Payment Verification</span>
            {pendingVerificationCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-white animate-pulse">
                {pendingVerificationCount}
              </span>
            )}
          </button>
          <button
            type="button"
            id="admin-tab-authorized-admins"
            onClick={() => {
              setActiveTab('admins');
              loadAdmins();
            }}
            className={`pb-3 text-[13px] font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'admins'
                ? 'border-[#006b2c] text-[#006b2c]'
                : 'border-transparent text-[#64748b] hover:text-[#0b1c30]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Authorized Admins</span>
            <span
              className={`ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full border ${
                activeAdminsCount >= maxAdminsLimit
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-300'
              }`}
            >
              {activeAdminsCount}/{maxAdminsLimit}
            </span>
          </button>
          <button
            type="button"
            id="admin-tab-customer-accounts"
            onClick={() => {
              setActiveTab('customers');
              loadCustomerAccounts();
            }}
            className={`pb-3 text-[13px] font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'customers'
                ? 'border-[#006b2c] text-[#006b2c]'
                : 'border-transparent text-[#64748b] hover:text-[#0b1c30]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Customer Accounts</span>
            {customerAccounts.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {customerAccounts.length}
              </span>
            )}
          </button>
          </div>
        </div>

        {/* Tab 1: Inventory Table */}
        {activeTab === 'inventory' && (
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs overflow-hidden space-y-4 p-4 sm:p-5">
            {/* Table Filters & Actions */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#94a3b8]" />
                <input
                  type="text"
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                  placeholder={t('filterSkuPlaceholder')}
                  className="w-full pl-9 pr-3 py-1.5 text-[13px] border border-[#cbd5e1] rounded-lg bg-[#f8fafc] focus:outline-hidden focus:ring-2 focus:ring-[#006b2c]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="freshcart-select px-3 py-1.5 text-[12px] border border-white/15 rounded-lg text-white focus:outline-hidden cursor-pointer"
                  style={{ backgroundColor: 'rgba(3, 7, 12, 0.96)' }}
                >
                  <option value="all" style={{ backgroundColor: 'rgba(3, 7, 12, 0.96)', color: '#ffffff' }}>{t('allAisles')}</option>
                  <option value="produce" style={{ backgroundColor: 'rgba(3, 7, 12, 0.96)', color: '#ffffff' }}>{t('catProduce')}</option>
                  <option value="dairy" style={{ backgroundColor: 'rgba(3, 7, 12, 0.96)', color: '#ffffff' }}>{t('catDairy')}</option>
                  <option value="bakery" style={{ backgroundColor: 'rgba(3, 7, 12, 0.96)', color: '#ffffff' }}>{t('catBakery')}</option>
                  <option value="beverages" style={{ backgroundColor: 'rgba(3, 7, 12, 0.96)', color: '#ffffff' }}>{t('catBeverages')}</option>
                  <option value="snacks" style={{ backgroundColor: 'rgba(3, 7, 12, 0.96)', color: '#ffffff' }}>{t('catSnacks')}</option>
                  <option value="grains" style={{ backgroundColor: 'rgba(3, 7, 12, 0.96)', color: '#ffffff' }}>{t('catGrains')}</option>
                  {customCategories.map((c) => (
                    <option key={c} value={c} style={{ backgroundColor: 'rgba(3, 7, 12, 0.96)', color: '#ffffff' }}>
                      {c}
                    </option>
                  ))}
                </select>

                <select
                  value={filterStockStatus}
                  onChange={(e) => setFilterStockStatus(e.target.value)}
                  className="freshcart-select px-3 py-1.5 text-[12px] border border-white/15 rounded-lg text-white focus:outline-hidden cursor-pointer"
                  style={{ backgroundColor: 'rgba(3, 7, 12, 0.96)' }}
                >
                  <option value="all" style={{ backgroundColor: 'rgba(3, 7, 12, 0.96)', color: '#ffffff' }}>{t('allStockStatuses')}</option>
                  <option value="healthy" style={{ backgroundColor: 'rgba(3, 7, 12, 0.96)', color: '#ffffff' }}>{t('inStockOption')}</option>
                  <option value="low" style={{ backgroundColor: 'rgba(3, 7, 12, 0.96)', color: '#ffffff' }}>{t('lowStockOption')}</option>
                  <option value="out" style={{ backgroundColor: 'rgba(3, 7, 12, 0.96)', color: '#ffffff' }}>{t('outOfStockOption')}</option>
                </select>

                <button
                  type="button"
                  id="admin-add-product-btn"
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#006b2c] hover:bg-[#00873a] text-white text-[12px] font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('addNewProductBtn')}</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="bg-[#f8fafc] text-[#64748b] border-b border-[#e2e8f0] text-[11px] font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">{t('tableHeaderItem')}</th>
                    <th className="py-3 px-4">{t('tableHeaderSku')}</th>
                    <th className="py-3 px-4">{t('tableHeaderCategory')}</th>
                    <th className="py-3 px-4">{t('tableHeaderPrice')}</th>
                    <th className="py-3 px-4">{t('tableHeaderUnit')}</th>
                    <th className="py-3 px-4">{t('tableHeaderQuantity')}</th>
                    <th className="py-3 px-4">{t('tableHeaderStatus')}</th>
                    <th className="py-3 px-4 text-right">{t('tableHeaderActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {filteredProducts.map((p) => {
                    const isLow = p.stock > 0 && p.stock <= 5;
                    const isOut = p.stock === 0;

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-[#f8fafc]/80 transition-colors group"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={p.image}
                              alt={p.title}
                              className="w-10 h-10 rounded-lg object-cover bg-[#f1f5f9] shrink-0 border border-[#e2e8f0]"
                            />
                            <div>
                              <span className="font-semibold text-[#0f172a] block">
                                {p.title}
                              </span>
                              <span className="text-[11px] text-[#64748b]">
                                {p.supplier}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-mono text-[12px] font-semibold text-[#475569] bg-[#f1f5f9] px-2 py-0.5 rounded">
                            {p.sku}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="capitalize text-[12px] font-medium text-[#475569]">
                            {p.category}
                          </span>
                        </td>

                        {/* Price Column with inline edit */}
                        <td className="py-3 px-4">
                          {editingPriceId === p.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[12px] font-bold text-[#64748b]">₹</span>
                              <input
                                type="number"
                                min="1"
                                value={tempPrice}
                                onChange={(e) => setTempPrice(Math.max(1, parseInt(e.target.value, 10) || 0))}
                                className="w-16 px-1.5 py-0.5 text-[12px] font-bold border border-[#006b2c] rounded bg-white text-[#0b1c30] focus:outline-hidden"
                                autoFocus
                              />
                              <button
                                type="button"
                                title="Save price"
                                onClick={() => handleSavePrice(p.id)}
                                className="p-1 rounded bg-[#006b2c] text-white hover:bg-[#00873a] cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStartEditPrice(p)}
                              className="flex items-center gap-1 font-semibold text-[#0f172a] hover:text-[#006b2c] tabular-nums font-display group/edit cursor-pointer"
                              title="Click to edit price"
                            >
                              <span>{formatINR(p.price)}</span>
                              <Edit2 className="w-3 h-3 opacity-0 group-hover/edit:opacity-100 text-[#94a3b8]" />
                            </button>
                          )}
                        </td>

                        {/* Unit Column with direct editing & custom unit support */}
                        <td className="py-3 px-4">
                          {editingCustomUnitId === p.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={customUnitInput}
                                onChange={(e) => setCustomUnitInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveCustomUnit(p.id);
                                  if (e.key === 'Escape') setEditingCustomUnitId(null);
                                }}
                                placeholder="e.g. 500 g"
                                className="w-24 px-2 py-1 text-[12px] font-bold border border-[#006b2c] rounded-lg bg-white text-[#0b1c30] focus:outline-hidden focus:ring-2 focus:ring-[#006b2c]"
                                autoFocus
                              />
                              <button
                                type="button"
                                title="Save unit"
                                onClick={() => handleSaveCustomUnit(p.id)}
                                className="w-6 h-6 rounded-md bg-[#006b2c] text-white flex items-center justify-center hover:bg-[#00873a] cursor-pointer shrink-0"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Cancel"
                                onClick={() => setEditingCustomUnitId(null)}
                                className="w-6 h-6 rounded-md bg-[#f1f5f9] text-[#64748b] flex items-center justify-center hover:bg-[#e2e8f0] cursor-pointer shrink-0"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <select
                                value={p.unit}
                                onChange={(e) => {
                                  if (e.target.value === '__custom__') {
                                    setEditingCustomUnitId(p.id);
                                    setCustomUnitInput(p.unit);
                                  } else {
                                    onUpdateProductUnit(p.id, e.target.value);
                                    setPulseToast(`Updated unit for "${p.title}" to "${e.target.value}"`);
                                    setTimeout(() => setPulseToast(null), 2500);
                                  }
                                }}
                                className="px-2 py-1 text-[12px] font-bold border border-[#cbd5e1] rounded-lg bg-white text-[#0b1c30] hover:border-[#006b2c] focus:outline-hidden focus:ring-2 focus:ring-[#006b2c] cursor-pointer"
                                title="Edit product unit / pack size"
                              >
                                {!STANDARD_UNITS.includes(p.unit as any) && (
                                  <option value={p.unit}>{p.unit} (Custom)</option>
                                )}
                                {STANDARD_UNITS.map((u) => (
                                  <option key={u} value={u}>
                                    {u}
                                  </option>
                                ))}
                                <option value="__custom__">{t('customUnitOption')}</option>
                              </select>
                              <button
                                type="button"
                                title="Enter custom unit"
                                onClick={() => {
                                  setEditingCustomUnitId(p.id);
                                  setCustomUnitInput(p.unit);
                                }}
                                className="w-6 h-6 rounded-md hover:bg-[#f1f5f9] text-[#94a3b8] hover:text-[#006b2c] flex items-center justify-center cursor-pointer transition-colors shrink-0"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              title="Decrease quantity by 1"
                              disabled={p.stock <= 0}
                              onClick={() => onUpdateProductStock(p.id, Math.max(0, p.stock - 1), 'Admin Stock Decrement')}
                              className="w-7 h-7 rounded-lg bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#0b1c30] flex items-center justify-center font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={p.stock}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                const newStock = isNaN(val) ? 0 : Math.max(0, val);
                                onUpdateProductStock(p.id, newStock, 'Admin Quantity Direct Edit');
                              }}
                              className="w-16 px-2 py-1 border border-[#cbd5e1] rounded-lg text-center font-bold tabular-nums text-[13px] bg-white focus:outline-hidden focus:ring-2 focus:ring-[#006b2c]"
                              title="Directly edit quantity (must never go below 0)"
                            />
                            <button
                              type="button"
                              title="Increase quantity by 1"
                              onClick={() => onUpdateProductStock(p.id, p.stock + 1, 'Admin Stock Increment')}
                              className="w-7 h-7 rounded-lg bg-[#eff4ff] hover:bg-[#dce9ff] text-[#006b2c] flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          {isOut ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#fee2e2] text-[#b91c1c] text-[11px] font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
                              {t('outOfStockStatus')}
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#b45309] text-[11px] font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
                              {t('lowStockStatus')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#dcfce7] text-[#15803d] text-[11px] font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
                              {t('healthyStatus')}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              id={`edit-product-btn-${p.id}`}
                              title={`Edit ${p.title}`}
                              onClick={() => setEditingProduct(p)}
                              className="px-2.5 py-1 rounded-lg bg-[#eff4ff] hover:bg-[#dce9ff] text-[#006b2c] text-[11px] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer border border-[#cbdcfc]"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-[#006b2c]" />
                              <span>{t('editProductBtn')}</span>
                            </button>
                            <button
                              type="button"
                              title={`Delete ${p.title} from store`}
                              onClick={() => setDeleteConfirmProduct(p)}
                              className="px-2.5 py-1 rounded-lg bg-[#fee2e2] hover:bg-[#fecaca] text-[#b91c1c] text-[11px] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-[#ef4444]" />
                              <span>{t('deleteBtn')}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Logs */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e2e8f0]">
              <div>
                <h3 className="text-[16px] font-bold text-[#0f172a] font-display">
                  {t('cdcLedgerHeading')}
                </h3>
                <p className="text-[12px] text-[#64748b]">
                  {t('cdcLedgerSubheading')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {inventoryLogs.length > 0 && (
                  <button
                    type="button"
                    id="clear-logs-btn"
                    onClick={() => setShowClearLogsConfirm(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#ef4444]/30 text-[#b91c1c] hover:bg-[#fee2e2]/60 text-[12px] font-semibold transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[#ef4444]" />
                    <span>Clear Logs</span>
                  </button>
                )}
                <span className="px-2.5 py-1 rounded-full bg-[#dcfce7] text-[#15803d] text-[11px] font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-ping" />
                  {t('clusterHealthy')}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {inventoryLogs.length === 0 ? (
                <div className="p-8 text-center text-[#64748b] text-[13px] bg-[#f8fafc] rounded-lg border border-[#e2e8f0]">
                  No CDC log records found.
                </div>
              ) : (
                inventoryLogs.map((log) => {
                  const logDt = formatLogDateTime(log);
                  return (
                    <div
                      key={log.id}
                      id={`cdc-log-${log.id}`}
                      className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-between text-[12px] gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold shrink-0 ${
                            log.changeType === 'RESTOCK'
                              ? 'bg-[#dcfce7] text-[#15803d]'
                              : log.changeType === 'SALE'
                              ? 'bg-[#e0e7ff] text-[#4338ca]'
                              : 'bg-[#fef3c7] text-[#b45309]'
                          }`}
                        >
                          {log.changeType}
                        </span>
                        <div className="min-w-0">
                          <span className="font-semibold text-[#0f172a] truncate block">
                            {log.productTitle} ({log.sku})
                          </span>
                          <span className="text-[#64748b] block text-[11px] truncate">
                            {log.notes} · Operator: {log.operator}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span
                            className={`font-bold tabular-nums block ${
                              log.quantityChange > 0 ? 'text-[#16a34a]' : 'text-[#ef4444]'
                            }`}
                          >
                            {log.quantityChange > 0 ? `+${log.quantityChange}` : log.quantityChange}
                          </span>
                          <div className="text-[10px] text-[#64748b] leading-tight font-medium mt-0.5 whitespace-nowrap">
                            <span className="block">DATE :{logDt.date}</span>
                            <span className="block">TIME:{logDt.time}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          id={`delete-log-btn-${log.id}`}
                          title="Delete log record"
                          onClick={() => setDeleteConfirmLog(log)}
                          className="p-1.5 rounded-lg text-[#94a3b8] hover:text-[#ef4444] hover:bg-[#fee2e2]/60 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}


        {/* Tab 4: Coupons Management */}
        {activeTab === 'coupons' && (
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs p-4 sm:p-5 space-y-4">
            {/* Top action bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e2e8f0]">
              <div>
                <h3 className="text-[17px] font-bold text-[#0f172a] font-display flex items-center gap-2">
                  <Tag className="w-5 h-5 text-[#006b2c]" />
                  <span>{t('couponsManagementTitle')}</span>
                </h3>
                <p className="text-[12px] text-[#565e74] mt-0.5">
                  {t('couponsManagementSubtitle')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-[#565e74] hidden md:inline">
                  {t('activeCouponsCount', {
                    active: coupons.filter((c) => c.isActive).length,
                    total: coupons.length,
                  })}
                </span>
                <button
                  type="button"
                  id="admin-create-coupon-btn"
                  onClick={() => {
                    setEditingCoupon(null);
                    setIsCouponModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#006b2c] hover:bg-[#00873a] text-white text-[12px] font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('createCouponBtn')}</span>
                </button>
              </div>
            </div>

            {/* Associated Delivery Charges Banner */}
            <div className="flex items-center justify-between p-3 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] text-[12px]">
              <div className="flex items-center gap-2 text-[#565e74]">
                <Truck className="w-4 h-4 text-[#006b2c]" />
                <span>Storefront Delivery Charges: <strong className="text-[#0b1c30]">{activeDeliveryCharge > 0 ? formatINR(activeDeliveryCharge) : 'FREE'}</strong></span>
              </div>
              <button
                type="button"
                id="coupons-goto-delivery-settings-btn"
                onClick={() => setActiveTab('settings')}
                className="text-[#006b2c] font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>Configure Delivery Charges</span>
              </button>
            </div>

            {/* Coupons Table */}
            {coupons.length === 0 ? (
              <div className="text-center py-12 text-[#565e74]">
                <Tag className="w-10 h-10 mx-auto text-[#cbd5e1] mb-2" />
                <p className="text-[13px] font-medium">{t('noCouponsAvailable')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="bg-[#f8fafc] text-[#64748b] border-b border-[#e2e8f0] text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">{t('couponCodeLabel')}</th>
                      <th className="py-3 px-4">Min Order Amount</th>
                      <th className="py-3 px-4">{t('discountPercentageLabel')}</th>
                      <th className="py-3 px-4">{t('couponDescriptionLabel')} & Validity</th>
                      <th className="py-3 px-4">{t('couponStatusLabel')}</th>
                      <th className="py-3 px-4 text-right">{t('tableHeaderActions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {coupons.map((coupon) => (
                      <tr
                        key={coupon.id}
                        id={`coupon-row-${coupon.id}`}
                        className="hover:bg-[#f8fafc]/80 transition-colors"
                      >
                        {/* Coupon Code */}
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-[13px] text-[#006b2c] bg-[#eff4ff] border border-[#d3e4fe] px-2.5 py-1 rounded-lg">
                            {coupon.code}
                          </span>
                        </td>

                        {/* Minimum Order Amount */}
                        <td className="py-3 px-4">
                          <span className="font-bold text-[13px] text-[#0b1c30] tabular-nums">
                            {formatINR(coupon.minOrderAmount || 0)}
                          </span>
                        </td>

                        {/* Discount Percentage */}
                        <td className="py-3 px-4">
                          <span className="font-extrabold text-[14px] text-[#0f172a] font-display tabular-nums">
                            {coupon.discountPercentage}% OFF
                          </span>
                        </td>

                        {/* Description & Validity */}
                        <td className="py-3 px-4 text-[12px] text-[#565e74]">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-[#0b1c30]">{coupon.description || '—'}</span>
                            {(coupon.startDate || coupon.expiryDate) && (
                              <span className="text-[10.5px] text-[#64748b]">
                                Validity: {coupon.startDate || 'Immediate'} to {coupon.expiryDate || 'No expiry'}
                              </span>
                            )}
                            {coupon.maxUses && (
                              <span className="text-[10.5px] text-[#006b2c] font-medium">
                                Max uses: {coupon.maxUses}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status Badge & Quick Toggle */}
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            id={`toggle-coupon-${coupon.id}`}
                            title={coupon.isActive ? 'Click to disable coupon' : 'Click to enable coupon'}
                            onClick={() => {
                              onToggleCoupon(coupon.id);
                              setPulseToast(
                                `${coupon.code} is now ${coupon.isActive ? 'Disabled' : 'Active'}`
                              );
                              setTimeout(() => setPulseToast(null), 2500);
                            }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer border ${
                              coupon.isActive
                                ? 'bg-[#dcfce7] text-[#15803d] border-[#86efac] hover:bg-[#bbf7d0]'
                                : 'bg-[#f1f5f9] text-[#64748b] border-[#cbd5e1] hover:bg-[#e2e8f0]'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                coupon.isActive ? 'bg-[#16a34a]' : 'bg-[#94a3b8]'
                              }`}
                            />
                            <span>{coupon.isActive ? t('couponActive') : t('couponDisabled')}</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              id={`edit-coupon-btn-${coupon.id}`}
                              title={`Edit coupon ${coupon.code}`}
                              onClick={() => {
                                setEditingCoupon(coupon);
                                setIsCouponModalOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#eff4ff] hover:bg-[#dce9ff] text-[#006b2c] text-[11px] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer border border-[#cbdcfc]"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-[#006b2c]" />
                              <span>{t('editCouponBtn')}</span>
                            </button>

                            <button
                              type="button"
                              id={`delete-coupon-btn-${coupon.id}`}
                              title={`Delete coupon ${coupon.code}`}
                              onClick={() => setDeleteConfirmCoupon(coupon)}
                              className="px-2.5 py-1 rounded-lg bg-[#fee2e2] hover:bg-[#fecaca] text-[#b91c1c] text-[11px] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-[#ef4444]" />
                              <span>{t('deleteBtn')}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Customer Orders */}
        {activeTab === 'orders' && (
          <CustomerOrdersLedger
            userRole="admin"
            customerOrders={customerOrders}
            onUpdateOrderStatus={onUpdateOrderStatus}
            currentUserName={currentAdmin?.fullName || currentAdmin?.adminId}
          />
        )}

        {/* Tab 5: Settings - Customizable Delivery Charges Rules */}
        {activeTab === 'settings' && (
          <div className="bg-black/35 backdrop-blur-xl rounded-xl border border-white/12 shadow-2xl p-5 sm:p-6 space-y-6">
            {/* Header */}
            <div className="pb-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-[18px] font-bold text-white font-display flex items-center gap-2">
                  <Truck className="w-5 h-5 text-[#10b981]" />
                  <span>Delivery Charges</span>
                </h3>
                <p className="text-[12px] text-[#94a3b8] mt-0.5">
                  Configure custom delivery charge rules based on customer cart minimum order amounts.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-sky-950/30 px-3 py-1.5 rounded-xl border border-sky-500/20 backdrop-blur-xs">
                  <span className="text-[12px] font-semibold text-sky-300">Rules Active:</span>
                  <span className="text-[13px] font-extrabold text-sky-400 tabular-nums">
                    {rules.length}
                  </span>
                </div>
                {(() => {
                  const freeRule = [...rules]
                    .sort((a, b) => a.minOrderAmount - b.minOrderAmount)
                    .find((r) => r.deliveryCharge === 0);
                  if (freeRule) {
                    return (
                      <div className="flex items-center gap-1.5 bg-emerald-950/30 px-3 py-1.5 rounded-xl border border-emerald-500/20 backdrop-blur-xs">
                        <span className="text-[12px] font-semibold text-emerald-300">Free Delivery From:</span>
                        <span className="text-[13px] font-extrabold text-emerald-400 tabular-nums">
                          {formatINR(freeRule.minOrderAmount)}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>

            {/* Notification Banners */}
            {saveRulesSuccess && (
              <div
                id="admin-delivery-charges-success"
                className="p-3 bg-emerald-950/40 text-emerald-300 rounded-xl text-[13px] font-semibold border border-emerald-500/30 flex items-center gap-2 animate-fadeIn backdrop-blur-md"
              >
                <CheckCircle className="w-4 h-4 shrink-0 text-[#10b981]" />
                <span>{saveRulesSuccess}</span>
              </div>
            )}

            {saveRulesError && (
              <div
                id="admin-delivery-charges-error"
                className="p-3 bg-rose-950/40 text-rose-300 rounded-xl text-[13px] font-semibold border border-rose-500/30 flex items-center gap-2 backdrop-blur-md"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-[#f87171]" />
                <span>{saveRulesError}</span>
              </div>
            )}

            {/* Section 1: Add New Delivery Rule Form */}
            <div className="bg-black/25 backdrop-blur-md border border-white/10 rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[14px] font-bold text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#10b981]" />
                  <span>Add New Delivery Charge Rule</span>
                </h4>
                <span className="text-[11px] font-medium text-[#94a3b8]">
                  Rules are evaluated by highest applicable minimum order
                </span>
              </div>

              <form onSubmit={handleAddRule} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                {/* Minimum Order Amount Field */}
                <div className="sm:col-span-5">
                  <label
                    htmlFor="admin-min-order-input"
                    className="block text-[12px] font-bold text-slate-300 mb-1"
                  >
                    Minimum Order Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-[14px] font-bold text-[#94a3b8] pointer-events-none">
                      ₹
                    </span>
                    <input
                      id="admin-min-order-input"
                      type="number"
                      min="0"
                      step="1"
                      value={newMinOrder}
                      onChange={(e) => {
                        setNewMinOrder(e.target.value);
                        if (addRuleError) setAddRuleError('');
                      }}
                      placeholder="e.g. 1500"
                      className="w-full pl-8 pr-3 py-2 text-[14px] font-semibold bg-black/30 border border-white/15 text-white rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#10b981] transition-all tabular-nums placeholder:text-[#94a3b8]"
                    />
                  </div>
                </div>

                {/* Delivery Charge Field */}
                <div className="sm:col-span-4">
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="admin-charge-input"
                      className="block text-[12px] font-bold text-slate-300"
                    >
                      Delivery Charge
                    </label>
                    <button
                      type="button"
                      id="admin-free-toggle-btn"
                      onClick={() => {
                        const next = !newIsFree;
                        setNewIsFree(next);
                        if (next) {
                          setNewDeliveryCharge('0');
                        } else {
                          setNewDeliveryCharge('');
                        }
                        if (addRuleError) setAddRuleError('');
                      }}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md transition-colors cursor-pointer border ${
                        newIsFree
                          ? 'bg-[#006b2c] text-white border-[#006b2c]'
                          : 'bg-black/30 text-slate-200 border-white/15 hover:bg-black/50'
                      }`}
                    >
                      {newIsFree ? '✓ FREE Selected' : 'Select FREE'}
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-[14px] font-bold text-[#94a3b8] pointer-events-none">
                      ₹
                    </span>
                    <input
                      id="admin-charge-input"
                      type="number"
                      min="0"
                      step="1"
                      disabled={newIsFree}
                      value={newIsFree ? '0' : newDeliveryCharge}
                      onChange={(e) => {
                        setNewDeliveryCharge(e.target.value);
                        if (e.target.value === '0') {
                          setNewIsFree(true);
                        } else {
                          setNewIsFree(false);
                        }
                        if (addRuleError) setAddRuleError('');
                      }}
                      placeholder="e.g. 12 (or select FREE)"
                      className={`w-full pl-8 pr-3 py-2 text-[14px] font-semibold rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#10b981] transition-all tabular-nums placeholder:text-[#94a3b8] ${
                        newIsFree
                          ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                          : 'bg-black/30 border border-white/15 text-white'
                      }`}
                    />
                  </div>
                </div>

                {/* Add Rule Button */}
                <div className="sm:col-span-3">
                  <button
                    type="submit"
                    id="admin-add-rule-btn"
                    className="w-full py-2.5 bg-[#006b2c] hover:bg-[#00873a] text-white text-[13px] font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Rule</span>
                  </button>
                </div>
              </form>

              {/* Add Rule Error */}
              {addRuleError && (
                <div
                  id="admin-rule-add-error"
                  className="p-2.5 bg-rose-950/40 text-rose-300 rounded-lg text-[12px] font-semibold border border-rose-500/30 flex items-center gap-1.5 backdrop-blur-md"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 text-[#f87171]" />
                  <span>{addRuleError}</span>
                </div>
              )}
            </div>

            {/* Section 2: Delivery Charges Rules Table */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[13px] font-bold text-white uppercase tracking-wide">
                  Configured Delivery Rules ({rules.length})
                </span>
                <span className="text-[11px] text-[#94a3b8]">
                  Rules are automatically sorted from lowest to highest Minimum Order Amount
                </span>
              </div>

              <div className="overflow-x-auto border border-white/12 rounded-xl shadow-2xs bg-black/20 backdrop-blur-md">
                <table className="w-full text-left border-collapse text-[13px]" id="delivery-rules-table">
                  <thead>
                    <tr className="bg-black/35 border-b border-white/10 text-slate-300 font-bold text-[12px]">
                      <th className="py-3 px-4">Minimum Order</th>
                      <th className="py-3 px-4">Delivery Charge</th>
                      <th className="py-3 px-4 hidden md:table-cell">Rule Application</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {rules.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-[#94a3b8]">
                          No delivery rules configured. Click &ldquo;Reset to Defaults&rdquo; below or add a custom rule.
                        </td>
                      </tr>
                    ) : (
                      rules.map((rule, idx) => {
                        const isEditing = editingRuleId === rule.id;
                        const nextRule = rules[idx + 1];

                        if (isEditing) {
                          return (
                            <tr key={rule.id} className="bg-emerald-950/30 border-l-4 border-l-[#10b981]">
                              {/* Edit Min Order */}
                              <td className="py-3 px-4">
                                <div className="relative max-w-[140px]">
                                  <span className="absolute left-2.5 top-2 text-[12px] font-bold text-[#94a3b8]">
                                    ₹
                                  </span>
                                  <input
                                    id={`admin-edit-min-order-${rule.id}`}
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={editMinOrder}
                                    onChange={(e) => {
                                      setEditMinOrder(e.target.value);
                                      if (editRuleError) setEditRuleError('');
                                    }}
                                    className="w-full pl-6 pr-2 py-1.5 text-[13px] font-bold bg-black/35 text-white border border-white/20 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#10b981] tabular-nums"
                                  />
                                </div>
                              </td>

                              {/* Edit Delivery Charge */}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2 max-w-[200px]">
                                  <div className="relative flex-1">
                                    <span className="absolute left-2.5 top-2 text-[12px] font-bold text-[#94a3b8]">
                                      ₹
                                    </span>
                                    <input
                                      id={`admin-edit-charge-${rule.id}`}
                                      type="number"
                                      min="0"
                                      step="1"
                                      disabled={editIsFree}
                                      value={editIsFree ? '0' : editDeliveryCharge}
                                      onChange={(e) => {
                                        setEditDeliveryCharge(e.target.value);
                                        if (e.target.value === '0') {
                                          setEditIsFree(true);
                                        } else {
                                          setEditIsFree(false);
                                        }
                                        if (editRuleError) setEditRuleError('');
                                      }}
                                      className={`w-full pl-6 pr-2 py-1.5 text-[13px] font-bold rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#10b981] tabular-nums ${
                                        editIsFree
                                          ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                                          : 'bg-black/35 border border-white/20 text-white'
                                      }`}
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    id={`admin-edit-free-toggle-${rule.id}`}
                                    onClick={() => {
                                      const next = !editIsFree;
                                      setEditIsFree(next);
                                      if (next) {
                                        setEditDeliveryCharge('0');
                                      }
                                      if (editRuleError) setEditRuleError('');
                                    }}
                                    className={`px-2 py-1 rounded text-[11px] font-bold transition-all border cursor-pointer ${
                                      editIsFree
                                        ? 'bg-[#006b2c] text-white border-[#006b2c]'
                                        : 'bg-black/30 text-slate-200 border-white/15 hover:bg-black/50'
                                    }`}
                                  >
                                    FREE
                                  </button>
                                </div>
                                {editRuleError && (
                                  <p className="text-[11px] text-[#f87171] font-semibold mt-1">
                                    {editRuleError}
                                  </p>
                                )}
                              </td>

                              {/* Rule Edit Range Note */}
                              <td className="py-3 px-4 hidden md:table-cell text-[#94a3b8] text-[12px]">
                                Editing rule...
                              </td>

                              {/* Action Buttons */}
                              <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                                <button
                                  type="button"
                                  id={`admin-save-rule-btn-${rule.id}`}
                                  onClick={() => handleSaveEdit(rule.id)}
                                  className="px-2.5 py-1.5 bg-[#006b2c] hover:bg-[#00873a] text-white text-[12px] font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Save</span>
                                </button>
                                <button
                                  type="button"
                                  id={`admin-cancel-rule-btn-${rule.id}`}
                                  onClick={handleCancelEdit}
                                  className="px-2.5 py-1.5 bg-black/30 hover:bg-black/50 text-slate-200 border border-white/15 text-[12px] font-semibold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Cancel</span>
                                </button>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={rule.id} className="hover:bg-white/5 transition-colors border-b border-white/5">
                            {/* Minimum Order */}
                            <td className="py-3 px-4 font-bold text-white tabular-nums">
                              {formatINR(rule.minOrderAmount)}
                            </td>

                            {/* Delivery Charge */}
                            <td className="py-3 px-4 tabular-nums">
                              {rule.deliveryCharge === 0 ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-950/40 text-emerald-300 border border-emerald-500/30">
                                  FREE
                                </span>
                              ) : (
                                <span className="font-extrabold text-white">
                                  {formatINR(rule.deliveryCharge)}
                                </span>
                              )}
                            </td>

                            {/* Rule Range / Condition */}
                            <td className="py-3 px-4 hidden md:table-cell text-slate-300 text-[12px]">
                              {nextRule ? (
                                <span>
                                  Applies for subtotals from <strong className="text-white">{formatINR(rule.minOrderAmount)}</strong> to <strong className="text-white">{formatINR(nextRule.minOrderAmount - 1)}</strong>
                                </span>
                              ) : (
                                <span>
                                  Applies for subtotals <strong className="text-white">≥ {formatINR(rule.minOrderAmount)}</strong>
                                </span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                id={`admin-edit-rule-btn-${rule.id}`}
                                onClick={() => handleStartEdit(rule)}
                                className="px-2.5 py-1 text-[12px] font-semibold text-sky-400 bg-sky-950/40 hover:bg-sky-900/50 border border-sky-500/20 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                id={`admin-delete-rule-btn-${rule.id}`}
                                onClick={() => handleDeleteRule(rule.id)}
                                className="px-2.5 py-1 text-[12px] font-semibold text-rose-400 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/20 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 3: Save and Reset Actions Bar */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-white/10">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  id="admin-save-delivery-charges-btn"
                  onClick={handleSaveAllRules}
                  disabled={isSavingRules}
                  className="px-6 py-2.5 bg-[#006b2c] hover:bg-[#00873a] text-white text-[13px] font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSavingRules ? (
                    <span>Saving Rules...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Delivery Rules</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  id="admin-reset-delivery-rules-btn"
                  onClick={handleResetToDefaultRules}
                  className="px-4 py-2.5 bg-black/30 hover:bg-black/50 border border-white/15 text-slate-200 text-[13px] font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Defaults</span>
                </button>
              </div>

              <span className="text-[12px] text-[#94a3b8]">
                Changes affect customer Cart and Checkout immediately upon save.
              </span>
            </div>

            {/* Section 4: Live Rule Application Simulator / Tester */}
            <div className="bg-black/30 backdrop-blur-md border border-white/15 rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-[14px] font-bold text-white flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-sky-400" />
                    <span>Live Rule Application Tester (Customer Perspective)</span>
                  </h4>
                  <p className="text-[11px] text-sky-300/80 mt-0.5">
                    Test how different customer cart subtotals match the configured rules in real time.
                  </p>
                </div>

                {/* Quick Test Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-300">Quick Test:</span>
                  {[
                    { label: '₹200', val: 200 },
                    { label: '₹1,000', val: 1000 },
                    { label: '₹1,750 (Example)', val: 1750 },
                    { label: '₹3,000 (Example)', val: 3000 },
                    { label: '₹5,000', val: 5000 },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setTestSubtotalInput(String(preset.val))}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors cursor-pointer ${
                        testSubtotalInput === String(preset.val)
                          ? 'bg-sky-600 text-white border-sky-500'
                          : 'bg-black/30 text-sky-200 border-white/15 hover:bg-white/10'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                {/* Input Subtotal */}
                <div className="sm:col-span-5">
                  <label htmlFor="admin-test-subtotal-input" className="block text-[12px] font-bold text-slate-200 mb-1">
                    Simulate Cart Subtotal (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-[14px] font-bold text-[#94a3b8] pointer-events-none">
                      ₹
                    </span>
                    <input
                      id="admin-test-subtotal-input"
                      type="number"
                      min="0"
                      step="1"
                      value={testSubtotalInput}
                      onChange={(e) => setTestSubtotalInput(e.target.value)}
                      placeholder="e.g. 1750"
                      className="w-full pl-8 pr-3 py-2 text-[14px] font-bold bg-black/30 border border-white/15 text-white rounded-xl focus:outline-hidden focus:ring-2 focus:ring-sky-500 tabular-nums placeholder:text-[#94a3b8]"
                    />
                  </div>
                </div>

                {/* Simulation Output Card */}
                {(() => {
                  const testNum = Math.max(0, parseFloat(testSubtotalInput) || 0);
                  const matchedRule = getApplicableDeliveryChargeRule(rules, testNum);
                  const appliedCharge = matchedRule ? matchedRule.deliveryCharge : 0;
                  const finalTotal = testNum + appliedCharge;

                  return (
                    <div className="sm:col-span-7 bg-black/25 backdrop-blur-md p-3.5 rounded-xl border border-white/12 shadow-2xs space-y-1.5 text-[12px]">
                      <div className="flex justify-between text-slate-400">
                        <span>Simulated Subtotal:</span>
                        <span className="font-bold text-white tabular-nums">{formatINR(testNum)}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Highest Minimum Order Reached:</span>
                        <span className="font-bold text-sky-400 tabular-nums">
                          {matchedRule ? `Rule ≥ ${formatINR(matchedRule.minOrderAmount)}` : 'None'}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Delivery Charges:</span>
                        <span className={`font-extrabold tabular-nums ${appliedCharge === 0 ? 'text-[#10b981]' : 'text-white'}`}>
                          {appliedCharge === 0 ? 'FREE' : formatINR(appliedCharge)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-1.5 border-t border-white/10 text-[13px] font-extrabold text-white">
                        <span>Customer Final Total:</span>
                        <span className="text-[#10b981] tabular-nums">{formatINR(finalTotal)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Step-by-step Rule Breakdown Checklist */}
              {(() => {
                const testNum = Math.max(0, parseFloat(testSubtotalInput) || 0);
                const matchedRule = getApplicableDeliveryChargeRule(rules, testNum);

                return (
                  <div className="pt-2 border-t border-white/10">
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                      Rule Evaluation Trace (Cart Subtotal = {formatINR(testNum)}):
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {rules.map((r) => {
                        const isReached = testNum >= r.minOrderAmount;
                        const isApplied = matchedRule && matchedRule.id === r.id;

                        return (
                          <div
                            key={r.id}
                            className={`p-2 rounded-lg border text-[11px] transition-all backdrop-blur-xs ${
                              isApplied
                                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 font-bold shadow-2xs ring-1 ring-emerald-500/30'
                                : isReached
                                ? 'bg-black/25 border-white/12 text-slate-300'
                                : 'bg-black/15 border-dashed border-white/10 text-slate-500'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span>≥ {formatINR(r.minOrderAmount)}:</span>
                              <span className="tabular-nums font-bold">
                                {r.deliveryCharge === 0 ? 'FREE' : formatINR(r.deliveryCharge)}
                              </span>
                            </div>
                            <div className="text-[10px] mt-0.5">
                              {isApplied ? (
                                <span className="text-emerald-400 font-extrabold">← Applied</span>
                              ) : isReached ? (
                                <span className="text-slate-400">Reached (overridden)</span>
                              ) : (
                                <span className="text-slate-500">Not reached</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Tab 6: UPI Payment Settings */}
        {activeTab === 'payment-settings' && (
          <div className="bg-black/35 backdrop-blur-xl rounded-xl border border-white/12 shadow-2xl p-5 sm:p-6 space-y-6">
            <div className="pb-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-[18px] font-bold text-white font-display flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-[#10b981]" />
                  <span>UPI Payment Configuration</span>
                </h3>
                <p className="text-[12px] text-[#94a3b8] mt-0.5">
                  Configure direct merchant UPI ID and Business Name for checkout QR codes and mobile payments.
                </p>
              </div>
            </div>

            {/* Notification Banners */}
            {upiSaveSuccess && (
              <div
                id="admin-upi-save-success"
                className="p-3 bg-emerald-950/40 text-emerald-300 rounded-xl text-[13px] font-semibold border border-emerald-500/30 flex items-center gap-2 animate-fadeIn backdrop-blur-md"
              >
                <CheckCircle className="w-4 h-4 shrink-0 text-[#10b981]" />
                <span>{upiSaveSuccess}</span>
              </div>
            )}

            {upiSaveError && (
              <div
                id="admin-upi-save-error"
                className="p-3 bg-rose-950/40 text-rose-300 rounded-xl text-[13px] font-semibold border border-rose-500/30 flex items-center gap-2 backdrop-blur-md"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-[#f87171]" />
                <span>{upiSaveError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Form Controls (Left Column) */}
              <form onSubmit={handleSaveUpiSettings} className="space-y-4 lg:col-span-7">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    UPI ID (VPA) <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    id="admin-upi-id-input"
                    type="text"
                    value={upiIdInput}
                    onChange={(e) => setUpiIdInput(e.target.value)}
                    placeholder="e.g. example@upi"
                    className="w-full px-4 py-2.5 rounded-xl text-sm bg-black/40 border border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Must be a valid UPI handle (e.g. example@upi, riya.bakery@sbi).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Merchant / Business Name <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    id="admin-merchant-name-input"
                    type="text"
                    value={merchantNameInput}
                    onChange={(e) => setMerchantNameInput(e.target.value)}
                    placeholder="e.g. FreshCart Store"
                    className="w-full px-4 py-2.5 rounded-xl text-sm bg-black/40 border border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    id="admin-save-upi-btn"
                    disabled={isSavingUpi}
                    className="px-6 py-2.5 bg-[#006b2c] hover:bg-[#00873a] text-white rounded-xl text-sm font-bold shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSavingUpi ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* QR Preview Card (Right Column) */}
              <div
                id="admin-upi-qr-preview-panel"
                className="lg:col-span-5 bg-black/30 border border-white/15 rounded-2xl p-5 flex flex-col items-center justify-center text-center space-y-3 backdrop-blur-md"
              >
                <div className="flex items-center justify-between w-full pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
                    <QrCode className="w-4 h-4 text-emerald-400" />
                    <span>UPI QR Code Preview</span>
                  </div>
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Live Preview
                  </span>
                </div>

                <div className="p-3 bg-white rounded-2xl shadow-xl border border-white/20 min-w-[200px] min-h-[200px] flex items-center justify-center">
                  {isAdminQrGenerating ? (
                    <div className="w-48 h-48 flex items-center justify-center bg-slate-100 rounded-xl">
                      <span className="w-6 h-6 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin" />
                    </div>
                  ) : adminQrPreviewUrl ? (
                    <img
                      id="admin-upi-qr-preview-image"
                      data-upi-uri={adminQrPreviewUri}
                      src={adminQrPreviewUrl}
                      alt="UPI QR Code Preview"
                      className="w-48 h-48 rounded-xl object-contain select-none"
                    />
                  ) : (
                    <div className="w-48 h-48 flex flex-col items-center justify-center bg-slate-100 rounded-xl text-slate-400 text-center p-3">
                      <QrCode className="w-10 h-10 text-slate-300 mb-2" />
                      <span className="text-[11px] font-medium leading-tight text-slate-500">
                        Enter a valid UPI ID to generate the live QR preview
                      </span>
                    </div>
                  )}
                </div>

                {upiIdInput.trim() && (
                  <div className="text-center space-y-0.5 w-full">
                    <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                      Configured UPI ID
                    </p>
                    <p className="text-xs font-mono font-bold text-emerald-400 break-all">
                      {upiIdInput.trim()}
                    </p>
                    {merchantNameInput.trim() && (
                      <p className="text-[11px] text-slate-300">
                        Merchant: {merchantNameInput.trim()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 7: UPI Payment Verification */}
        {activeTab === 'payment-verification' && (
          <div className="space-y-6">
            {/* Header & Stats Card */}
            <div className="bg-black/35 backdrop-blur-xl rounded-xl border border-white/12 shadow-2xl p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                <div>
                  <h3 className="text-[18px] font-bold text-white font-display flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-[#10b981]" />
                    <span>Payment Verification</span>
                  </h3>
                </div>
                <button
                  type="button"
                  id="admin-refresh-verification-queue-btn"
                  onClick={loadVerificationQueue}
                  disabled={isLoadingQueue}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white border border-white/15 flex items-center gap-2 cursor-pointer transition-colors shrink-0 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingQueue ? 'animate-spin text-emerald-400' : ''}`} />
                  <span>Refresh Queue</span>
                </button>
              </div>

              {/* Feedback Banner */}
              {queueFeedback && (
                <div
                  className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 animate-fadeIn backdrop-blur-md ${
                    queueFeedback.type === 'success'
                      ? 'bg-emerald-950/60 text-emerald-200 border border-emerald-500/30'
                      : 'bg-rose-950/60 text-rose-200 border border-rose-500/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {queueFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>{queueFeedback.message}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQueueFeedback(null)}
                    className="p-1 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Metrics / Filter Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {(
                  [
                    { key: 'pending' as const, label: 'Pending Review', count: pendingVerificationCount, highlight: true },
                    { key: 'all' as const, label: 'All Orders', count: verificationQueue.length, highlight: false },
                    {
                      key: 'paid' as const,
                      label: 'Verified & Paid',
                      count: verificationQueue.filter((i) => i.paymentStatus === 'PAID' || i.paymentStatus === 'COMPLETED').length,
                      highlight: false,
                    },
                    {
                      key: 'rejected' as const,
                      label: 'Rejected',
                      count: verificationQueue.filter((i) => i.paymentStatus === 'REJECTED').length,
                      highlight: false,
                    },
                  ]
                ).map((filter) => {
                  const isActive = queueFilter === filter.key;
                  return (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => setQueueFilter(filter.key)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                        isActive
                          ? 'bg-[#006b2c] text-white shadow-xs'
                          : 'bg-black/30 hover:bg-black/50 text-slate-300 border border-white/10'
                      }`}
                    >
                      <span>{filter.label}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                          isActive
                            ? 'bg-black/20 text-white'
                            : filter.highlight && filter.count > 0
                            ? 'bg-amber-500 text-white font-black'
                            : 'bg-white/10 text-slate-300'
                        }`}
                      >
                        {filter.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Queue Table / List */}
            <div className="bg-black/35 backdrop-blur-xl rounded-xl border border-white/12 shadow-2xl overflow-hidden">
              {(() => {
                const filtered = verificationQueue.filter((item) => {
                  if (queueFilter === 'pending') {
                    return item.paymentStatus === 'PENDING_VERIFICATION' || (item.paymentStatus as string) === 'PENDING';
                  }
                  if (queueFilter === 'paid') return item.paymentStatus === 'PAID' || item.paymentStatus === 'COMPLETED';
                  if (queueFilter === 'rejected') return item.paymentStatus === 'REJECTED';
                  return true;
                });

                const isBulkEligible = queueFilter === 'paid' || queueFilter === 'rejected';
                const currentSelectedSet = queueFilter === 'paid' ? selectedPaidOrderIds : selectedRejectedOrderIds;
                const sectionItems = filtered;
                const sectionTotal = sectionItems.length;
                const selectedCount = currentSelectedSet.size;
                const isAllSelected = sectionTotal > 0 && selectedCount === sectionTotal;
                const isSomeSelected = selectedCount > 0 && selectedCount < sectionTotal;

                if (isLoadingQueue && verificationQueue.length === 0) {
                  return (
                    <div className="py-16 text-center text-slate-400 space-y-2">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-400" />
                      <p className="text-xs">Loading payment verification queue...</p>
                    </div>
                  );
                }

                if (filtered.length === 0) {
                  return (
                    <div className="py-16 text-center text-slate-400 space-y-3">
                      <CreditCard className="w-10 h-10 mx-auto text-slate-600" />
                      <p className="text-sm font-semibold text-slate-300">
                        {queueFilter === 'pending'
                          ? 'No pending payments awaiting verification'
                          : 'No orders found matching the selected filter'}
                      </p>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Online UPI orders with uploaded customer payment screenshots will appear here for review and verification.
                      </p>
                    </div>
                  );
                }

                return (
                  <div>
                    {/* Bulk Action Controls for Verified & Paid and Rejected sections */}
                    {isBulkEligible && sectionTotal > 0 && (
                      <div className="p-3 sm:p-3.5 px-4 bg-black/40 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 text-xs font-semibold text-slate-200 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              id={`admin-select-all-${queueFilter}-toolbar-checkbox`}
                              checked={isAllSelected}
                              ref={(input) => {
                                if (input) input.indeterminate = isSomeSelected;
                              }}
                              onChange={() => {
                                if (isAllSelected) {
                                  if (queueFilter === 'paid') setSelectedPaidOrderIds(new Set());
                                  else setSelectedRejectedOrderIds(new Set());
                                } else {
                                  const all = new Set(sectionItems.map((i) => i.orderId.replace(/^#/, '')));
                                  if (queueFilter === 'paid') setSelectedPaidOrderIds(all);
                                  else setSelectedRejectedOrderIds(all);
                                }
                              }}
                              className="w-4 h-4 rounded border-white/20 bg-black/60 text-[#006b2c] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#10b981]"
                            />
                            <span>Select All</span>
                          </label>

                          {selectedCount > 0 && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {selectedCount} of {sectionTotal} selected
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Delete Selected Button */}
                          <button
                            type="button"
                            id={`admin-delete-selected-${queueFilter}-btn`}
                            disabled={selectedCount === 0 || isBulkDeleting}
                            onClick={() => {
                              if (selectedCount === 0) return;
                              const sectionName = queueFilter === 'paid' ? 'Verified & Paid' : 'Rejected';
                              setBulkDeleteConfirm({
                                type: 'SELECTED',
                                section: queueFilter === 'paid' ? 'PAID' : 'REJECTED',
                                sectionName,
                                count: selectedCount,
                                orderIds: Array.from(currentSelectedSet),
                              });
                            }}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 hover:text-white border border-rose-500/40 flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                            title={selectedCount === 0 ? 'Select records using checkboxes to delete' : `Delete ${selectedCount} selected records`}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            <span>Delete Selected ({selectedCount})</span>
                          </button>

                          {/* Delete All Button */}
                          <button
                            type="button"
                            id={`admin-delete-all-${queueFilter}-btn`}
                            disabled={sectionTotal === 0 || isBulkDeleting}
                            onClick={() => {
                              const sectionName = queueFilter === 'paid' ? 'Verified & Paid' : 'Rejected';
                              setBulkDeleteConfirm({
                                type: 'ALL',
                                section: queueFilter === 'paid' ? 'PAID' : 'REJECTED',
                                sectionName,
                                count: sectionTotal,
                              });
                            }}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-red-600/20 hover:bg-red-600/35 text-red-300 hover:text-red-100 border border-red-500/50 flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                            title={`Delete all ${sectionTotal} records in the ${queueFilter === 'paid' ? 'Verified & Paid' : 'Rejected'} section`}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            <span>Delete All ({sectionTotal})</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-white/10 bg-black/40 text-slate-400 font-semibold tracking-wider uppercase text-[11px]">
                            {isBulkEligible && (
                              <th className="py-3.5 px-3 w-10 text-center">
                                <input
                                  type="checkbox"
                                  id={`admin-table-header-select-all-${queueFilter}`}
                                  checked={isAllSelected}
                                  ref={(input) => {
                                    if (input) input.indeterminate = isSomeSelected;
                                  }}
                                  onChange={() => {
                                    if (isAllSelected) {
                                      if (queueFilter === 'paid') setSelectedPaidOrderIds(new Set());
                                      else setSelectedRejectedOrderIds(new Set());
                                    } else {
                                      const all = new Set(sectionItems.map((i) => i.orderId.replace(/^#/, '')));
                                      if (queueFilter === 'paid') setSelectedPaidOrderIds(all);
                                      else setSelectedRejectedOrderIds(all);
                                    }
                                  }}
                                  className="w-4 h-4 rounded border-white/20 bg-black/60 text-[#006b2c] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#10b981]"
                                  title="Select All"
                                />
                              </th>
                            )}
                            <th className="py-3.5 px-4">Order ID</th>
                            <th className="py-3.5 px-4">Customer Details</th>
                            <th className="py-3.5 px-4">Amount</th>
                            <th className="py-3.5 px-4">Payment Method</th>
                            <th className="py-3.5 px-4">Status</th>
                            <th className="py-3.5 px-4">Payment Proof</th>
                            <th className="py-3.5 px-4">Uploaded / Audit</th>
                            <th className="py-3.5 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-200">
                          {filtered.map((item) => {
                            const isPending =
                              item.paymentStatus === 'PENDING_VERIFICATION' ||
                              (item.paymentStatus as string) === 'PENDING';
                            const isPaid = item.paymentStatus === 'PAID' || item.paymentStatus === 'COMPLETED';
                            const isRejected = item.paymentStatus === 'REJECTED';
                            const hasProof = !!(item.screenshotUrl || item.screenshotPath);
                            const adminImgSrc = getAdminScreenshotUrl(item.screenshotUrl, item.orderId);
                            const cleanId = item.orderId.replace(/^#/, '');
                            const isSelected = currentSelectedSet.has(cleanId);

                            return (
                              <tr key={item.id || item.orderId} className={`hover:bg-white/[0.03] transition-colors ${isSelected ? 'bg-emerald-950/20' : ''}`}>
                                {isBulkEligible && (
                                  <td className="py-3 px-3 text-center">
                                    <input
                                      type="checkbox"
                                      id={`select-order-row-${cleanId}`}
                                      checked={isSelected}
                                      onChange={() => {
                                        if (queueFilter === 'paid') {
                                          setSelectedPaidOrderIds((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(cleanId)) next.delete(cleanId);
                                            else next.add(cleanId);
                                            return next;
                                          });
                                        } else {
                                          setSelectedRejectedOrderIds((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(cleanId)) next.delete(cleanId);
                                            else next.add(cleanId);
                                            return next;
                                          });
                                        }
                                      }}
                                      className="w-4 h-4 rounded border-white/20 bg-black/60 text-[#006b2c] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#10b981]"
                                    />
                                  </td>
                                )}
                                <td className="py-3 px-4 font-mono font-bold text-white whitespace-nowrap">
                                  #{cleanId}
                                </td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-white">{item.customerName || 'Customer'}</div>
                                <div className="text-[11px] text-slate-400">
                                  {item.customerMobile || item.customerEmail || 'N/A'}
                                </div>
                              </td>
                              <td className="py-3 px-4 font-bold text-emerald-400 text-sm whitespace-nowrap">
                                {formatINR(Number(item.amount || item.orderTotal || (item as any).total || 0))}
                              </td>
                              <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[11px]">
                                  <CreditCard className="w-3 h-3 text-emerald-400" />
                                  <span>{item.paymentMethod || 'UPI QR'}</span>
                                </span>
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                {isPending ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                    <span>Pending Verification</span>
                                  </span>
                                ) : isPaid ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span>PAID</span>
                                  </span>
                                ) : isRejected ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                    <X className="w-3 h-3 text-rose-400" />
                                    <span>REJECTED</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">
                                    <span>{item.paymentStatus}</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                {hasProof ? (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      id={`view-payment-proof-thumb-${item.orderId.replace(/^#/, '')}`}
                                      onClick={() => {
                                        setScreenshotZoom(1);
                                        setViewingScreenshotItem(item);
                                      }}
                                      title="View Payment Proof"
                                      className="relative w-10 h-10 rounded-lg overflow-hidden border border-white/20 hover:border-emerald-400 transition-colors cursor-pointer group shrink-0 bg-black/40"
                                    >
                                      <img
                                        src={adminImgSrc}
                                        alt="Proof Thumbnail"
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                        onError={(e) => {
                                          (e.target as HTMLElement).style.display = 'none';
                                        }}
                                      />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <Eye className="w-4 h-4 text-white" />
                                      </div>
                                    </button>
                                    <button
                                      type="button"
                                      id={`view-payment-proof-btn-${item.orderId.replace(/^#/, '')}`}
                                      onClick={() => {
                                        setScreenshotZoom(1);
                                        setViewingScreenshotItem(item);
                                      }}
                                      className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 underline underline-offset-2 flex items-center gap-1 cursor-pointer"
                                    >
                                      <span>View Payment Proof</span>
                                    </button>
                                  </div>
                                ) : isPaid ? (
                                  <span className="text-[11px] text-slate-400 italic flex items-center gap-1">
                                    <Lock className="w-3 h-3 text-slate-500" />
                                    <span>Purged upon verification</span>
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-500 italic">
                                    Awaiting upload
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-slate-400 text-[11px]">
                                {item.screenshotUploadedAt && (
                                  <div>
                                    <span className="text-slate-500">Uploaded: </span>
                                    <span>{formatOrderDateTime(item.screenshotUploadedAt)}</span>
                                  </div>
                                )}
                                {item.verifiedAt && (
                                  <div>
                                    <span className="text-slate-500">Verified: </span>
                                    <span>
                                      {formatOrderDateTime(item.verifiedAt)} by {item.verifiedBy || 'Admin'}
                                    </span>
                                  </div>
                                )}
                                {item.verificationNotes && (
                                  <div className="text-rose-300 font-semibold truncate max-w-[180px]" title={item.verificationNotes}>
                                    Note: {item.verificationNotes}
                                  </div>
                                )}
                                {item.otpSent && (
                                  <div className="text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                                    <ShieldCheck className="w-3 h-3" />
                                    <span>OTP Dispatched</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-2">
                                  {hasProof && (
                                    <button
                                      type="button"
                                      onClick={() => setViewingScreenshotItem(item)}
                                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white border border-white/15 flex items-center gap-1.5 cursor-pointer transition-colors"
                                      title="Open screenshot proof"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>View</span>
                                    </button>
                                  )}
                                  {!isPaid && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleApprovePayment(item)}
                                        disabled={isVerifyingAction}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#006b2c] hover:bg-[#00873a] text-white shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                                        title="Confirm payment received and mark as PAID"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Approve (Mark Paid)</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRejectingItem(item);
                                          setRejectReasonInput('');
                                        }}
                                        disabled={isVerifyingAction}
                                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-500/40 flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                                        title="Reject payment proof and request re-upload"
                                      >
                                        <X className="w-3.5 h-3.5 text-rose-400" />
                                        <span>Reject</span>
                                      </button>
                                    </>
                                  )}
                                  {isPaid && (
                                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Verified</span>
                                    </span>
                                  )}
                                  {(isPaid || isRejected) && (
                                    <button
                                      type="button"
                                      id={`admin-delete-order-btn-${item.orderId.replace(/^#/, '')}`}
                                      onClick={() => setDeleteConfirmVerificationOrder(item)}
                                      disabled={isVerifyingAction || isDeletingVerificationOrder}
                                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-100 border border-rose-500/30 flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                                      title={`Delete order #${item.orderId.replace(/^#/, '')}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                      <span>Delete</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Tab 8: Authorized Administrator Management */}
        {activeTab === 'admins' && (
          <div className="space-y-6">
            {/* Header & Quota Card */}
            <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0]">
                <div>
                  <h3 className="text-[18px] font-bold text-[#0b1c30] font-display flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[#006b2c]" />
                    <span>Authorized Administrator Management</span>
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadAdmins}
                    disabled={isLoadingAdmins}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#e2e8f0] text-[#0b1c30] hover:bg-[#f8fafc] text-[12px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    title="Refresh administrator list"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-[#64748b] ${isLoadingAdmins ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>

                  {currentAdmin?.role === 'owner' ? (
                    <button
                      type="button"
                      id="btn-add-authorized-admin"
                      disabled={activeAdminsCount >= maxAdminsLimit}
                      onClick={() => {
                        setAddAdminModalError(null);
                        setNewAdminFullName('');
                        setNewAdminEmail('');
                        setNewAdminCustomId('');
                        setNewAdminPassword('');
                        setShowAddAdminModal(true);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#006b2c] hover:bg-[#005222] text-white text-[12px] font-bold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      title={
                        activeAdminsCount >= maxAdminsLimit
                          ? 'Active admin quota reached (max 5 accounts)'
                          : 'Add a new authorized administrator'
                      }
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Add Authorized Admin</span>
                    </button>
                  ) : (
                    <span className="text-[11px] font-medium text-[#64748b] bg-[#f1f5f9] px-2.5 py-1.5 rounded-lg border border-[#e2e8f0]">
                      Standard Admin Mode (View Only)
                    </span>
                  )}
                </div>
              </div>

              {/* Success Notification */}
              {adminMgmtSuccess && (
                <div className="p-3.5 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] text-[#065f46] text-[12px] flex items-center justify-between animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#059669] shrink-0" />
                    <span className="font-semibold">{adminMgmtSuccess}</span>
                  </div>
                  <button onClick={() => setAdminMgmtSuccess(null)} className="text-[#059669] hover:text-[#047857]">
                    &times;
                  </button>
                </div>
              )}

              {/* Error Notification */}
              {adminMgmtError && (
                <div className="p-3.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] text-[12px] flex items-center justify-between animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#dc2626] shrink-0" />
                    <span className="font-semibold">{adminMgmtError}</span>
                  </div>
                  <button onClick={() => setAdminMgmtError(null)} className="text-[#dc2626] hover:text-[#b91c1c]">
                    &times;
                  </button>
                </div>
              )}

              {/* Authorized Administrators Directory Table */}
              <div className="overflow-x-auto rounded-xl border border-[#e2e8f0]">
                <table className="w-full text-left border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#64748b] font-bold text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-4">Admin Personnel</th>
                      <th className="py-3 px-4">Account Identifiers</th>
                      <th className="py-3 px-4">Access Role</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Authorized On</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0] bg-white">
                    {isLoadingAdmins && adminsList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-[#64748b]">
                          <div className="flex flex-col items-center gap-2">
                            <span className="w-5 h-5 border-2 border-[#006b2c]/30 border-t-[#006b2c] rounded-full animate-spin" />
                            <span>Loading authorized administrators...</span>
                          </div>
                        </td>
                      </tr>
                    ) : adminsList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-[#64748b]">
                          No administrators found in the database.
                        </td>
                      </tr>
                    ) : (
                      adminsList.map((adm) => {
                        const isOwnerRow = adm.role === 'owner';
                        const isSelf = currentAdmin?.adminId === adm.adminId;
                        const isTogglingThis = togglingAdminId === adm.adminId;

                        return (
                          <tr
                            key={adm.adminId}
                            id={`admin-row-${adm.adminId}`}
                            className="hover:bg-[#f8fafc]/80 transition-colors"
                          >
                            {/* Personnel Name */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                                    isOwnerRow
                                      ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                      : 'bg-[#eff4ff] text-[#006b2c] border border-[#006b2c]/20'
                                  }`}
                                >
                                  {adm.fullName ? adm.fullName.charAt(0).toUpperCase() : 'A'}
                                </div>
                                <div>
                                  <div className="font-bold text-[#0b1c30] flex items-center gap-1.5">
                                    <span>{adm.fullName}</span>
                                    {isSelf && (
                                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                                        You
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-[#64748b]">
                                    {isOwnerRow ? 'Project Owner' : 'Operations Manager'}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Identifiers: Email & ID */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-0.5">
                                <div className="font-medium text-[#0b1c30] flex items-center gap-1">
                                  <Mail className="w-3 h-3 text-[#94a3b8]" />
                                  <span>{adm.email}</span>
                                </div>
                                <div className="text-[10px] font-mono text-[#64748b] bg-[#f1f5f9] px-1.5 py-0.5 rounded inline-block">
                                  ID: {adm.adminId}
                                </div>
                              </div>
                            </td>

                            {/* Access Role */}
                            <td className="py-3.5 px-4">
                              {isOwnerRow ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                  <ShieldAlert className="w-3 h-3 text-purple-600" />
                                  <span>Project Owner</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                  <span>Administrator</span>
                                </span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4">
                              {adm.status === 'active' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                  <span>Active</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                                  <span>Deactivated</span>
                                </span>
                              )}
                            </td>

                            {/* Created Date */}
                            <td className="py-3.5 px-4 text-[#64748b] text-[11px]">
                              {adm.createdAt ? formatOrderDateTime(adm.createdAt) : 'Initial Setup'}
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-right">
                              {currentAdmin?.role === 'owner' ? (
                                isOwnerRow ? (
                                  <span className="text-[11px] font-medium text-slate-400 italic">
                                    Protected Owner
                                  </span>
                                ) : (
                                  <div className="flex items-center justify-end gap-2">
                                    {/* Toggle Active / Inactive */}
                                    <button
                                      type="button"
                                      id={`btn-toggle-status-${adm.adminId}`}
                                      disabled={isTogglingThis || (adm.status !== 'active' && activeAdminsCount >= maxAdminsLimit)}
                                      onClick={() => handleToggleAdminStatus(adm)}
                                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                        adm.status === 'active'
                                          ? 'border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100'
                                          : 'border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                      }`}
                                      title={
                                        adm.status === 'active'
                                          ? 'Deactivate administrator and revoke active sessions'
                                          : activeAdminsCount >= maxAdminsLimit
                                          ? 'Cannot activate: maximum 5 active admin limit reached'
                                          : 'Authorize and activate administrator'
                                      }
                                    >
                                      {isTogglingThis ? (
                                        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                                      ) : adm.status === 'active' ? (
                                        'Deactivate'
                                      ) : (
                                        'Authorize'
                                      )}
                                    </button>

                                    {/* Remove Admin */}
                                    <button
                                      type="button"
                                      id={`btn-delete-admin-${adm.adminId}`}
                                      onClick={() => setDeletingAdmin(adm)}
                                      className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                                      title="Permanently remove administrator"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">Read-only</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 9: Customer Accounts Management */}
        {activeTab === 'customers' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Header & Security Notice */}
            <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0]">
                <div>
                  <h3 className="text-[18px] font-bold text-[#0b1c30] font-display flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#006b2c]" />
                    <span>Customer Accounts</span>
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => loadCustomerAccounts()}
                    disabled={isLoadingCustomers}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#e2e8f0] text-[#0b1c30] hover:bg-[#f8fafc] text-[12px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    title="Refresh customer accounts from database"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-[#64748b] ${isLoadingCustomers ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Status & Feedback Alerts */}
              {customerMgmtError && (
                <div className="p-3.5 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] text-[12px] flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#dc2626]" />
                  <div className="flex-1 font-semibold">{customerMgmtError}</div>
                  <button
                    type="button"
                    onClick={() => setCustomerMgmtError(null)}
                    className="text-[#991b1b] hover:text-black cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {customerMgmtSuccess && (
                <div className="p-3.5 rounded-xl bg-[#f0fdf4] border border-[#bbf7d0] text-[#166534] text-[12px] flex items-start gap-2 animate-in fade-in">
                  <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#16a34a]" />
                  <div className="flex-1 font-semibold">{customerMgmtSuccess}</div>
                  <button
                    type="button"
                    onClick={() => setCustomerMgmtSuccess(null)}
                    className="text-[#166534] hover:text-black cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider block">
                      Total Registered
                    </span>
                    <span className="text-[22px] font-bold text-[#0b1c30] mt-0.5 block font-display">
                      {customerAccounts.length}
                    </span>
                    <span className="text-[11px] text-[#64748b] mt-0.5 block">Shared MySQL Database</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#006b2c] flex items-center justify-center border border-emerald-100">
                    <Users className="w-5 h-5 text-[#006b2c]" />
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider block">
                      Active Accounts
                    </span>
                    <span className="text-[22px] font-bold text-[#006b2c] mt-0.5 block font-display">
                      {customerAccounts.filter((c) => c.status === 'Active').length}
                    </span>
                    <span className="text-[11px] text-[#64748b] mt-0.5 block">Full ordering access</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#006b2c] flex items-center justify-center border border-emerald-100">
                    <UserCheck className="w-5 h-5 text-[#006b2c]" />
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider block">
                      Suspended Accounts
                    </span>
                    <span className="text-[22px] font-bold text-amber-700 mt-0.5 block font-display">
                      {customerAccounts.filter((c) => c.status !== 'Active').length}
                    </span>
                    <span className="text-[11px] text-[#64748b] mt-0.5 block">Access restricted</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
                    <UserX className="w-5 h-5 text-amber-700" />
                  </div>
                </div>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    id="admin-customer-search-input"
                    value={customerSearchQuery}
                    onChange={(e) => {
                      setCustomerSearchQuery(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        loadCustomerAccounts(customerSearchQuery);
                      }
                    }}
                    placeholder="Search by name, user ID, email, or phone number..."
                    className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-[#cbd5e1] text-[13px] text-[#0b1c30] placeholder:text-[#94a3b8] focus:outline-hidden focus:ring-2 focus:ring-[#006b2c] focus:border-[#006b2c] bg-white transition-all"
                  />
                  {customerSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerSearchQuery('');
                        loadCustomerAccounts('');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0b1c30] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <select
                    id="admin-customer-status-filter"
                    value={customerStatusFilter}
                    onChange={(e) => setCustomerStatusFilter(e.target.value as any)}
                    className="freshcart-select px-3 py-2.5 rounded-xl border border-white/15 text-[13px] text-white focus:outline-hidden focus:ring-2 focus:ring-[#006b2c] cursor-pointer"
                    style={{ backgroundColor: 'rgba(3, 7, 12, 0.96)' }}
                  >
                    <option value="all" style={{ backgroundColor: 'rgba(3, 7, 12, 0.96)', color: '#ffffff' }}>All Account Statuses</option>
                    <option value="Active" style={{ backgroundColor: 'rgba(3, 7, 12, 0.96)', color: '#ffffff' }}>Active Accounts</option>
                    <option value="Suspended" style={{ backgroundColor: 'rgba(3, 7, 12, 0.96)', color: '#ffffff' }}>Suspended Accounts</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => loadCustomerAccounts(customerSearchQuery)}
                    className="px-3.5 py-2.5 rounded-xl bg-[#006b2c] hover:bg-[#005222] text-white text-[12px] font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Search</span>
                  </button>
                </div>
              </div>

              {/* Customers Table */}
              <div className="border border-[#e2e8f0] rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[11px] font-bold text-[#64748b] uppercase tracking-wider">
                      <th className="py-3 px-4">Customer Name</th>
                      <th className="py-3 px-4">Customer User ID</th>
                      <th className="py-3 px-4">Email Address</th>
                      <th className="py-3 px-4">Phone Number</th>
                      <th className="py-3 px-4">Registration Date</th>
                      <th className="py-3 px-4">Account Status</th>
                      <th className="py-3 px-4">Password Security</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0]">
                    {isLoadingCustomers ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-[#64748b]">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <span className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                            <span className="text-[13px] font-semibold">Loading customer accounts from MySQL...</span>
                          </div>
                        </td>
                      </tr>
                    ) : (() => {
                      const query = customerSearchQuery.trim().toLowerCase();
                      const filtered = customerAccounts.filter((c) => {
                        if (customerStatusFilter !== 'all' && c.status !== customerStatusFilter) return false;
                        if (!query) return true;
                        return (
                          (c.name && c.name.toLowerCase().includes(query)) ||
                          (c.customerId && c.customerId.toLowerCase().includes(query)) ||
                          (c.email && c.email.toLowerCase().includes(query)) ||
                          (c.phone && c.phone.toLowerCase().includes(query))
                        );
                      });

                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={8} className="py-12 text-center text-[#64748b]">
                              <div className="flex flex-col items-center justify-center gap-2">
                                <Users className="w-8 h-8 text-[#94a3b8]" />
                                <span className="text-[14px] font-bold text-[#0b1c30]">No customer accounts found</span>
                                <span className="text-[12px] text-[#64748b]">
                                  {customerSearchQuery
                                    ? `No records match "${customerSearchQuery}". Try clearing search.`
                                    : 'No customers registered in database yet.'}
                                </span>
                                {customerSearchQuery && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCustomerSearchQuery('');
                                      loadCustomerAccounts('');
                                    }}
                                    className="mt-2 text-[12px] text-[#006b2c] font-bold hover:underline cursor-pointer"
                                  >
                                    Clear search query
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return filtered.map((cust) => {
                        const isToggling = isTogglingCustomerStatus === cust.customerId;
                        return (
                          <tr key={cust.customerId} className="hover:bg-[#f8fafc] transition-colors">
                            {/* Customer Name */}
                            <td className="py-3.5 px-4 font-semibold text-[#0b1c30]">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#006b2c] font-bold flex items-center justify-center text-[12px] border border-emerald-200">
                                  {cust.name ? cust.name.charAt(0).toUpperCase() : 'C'}
                                </div>
                                <div>
                                  <div className="font-bold text-[#0b1c30]">{cust.name}</div>
                                  <div className="text-[10px] text-[#64748b]">{cust.loyaltyTier || 'Fresh Member'}</div>
                                </div>
                              </div>
                            </td>

                            {/* User ID */}
                            <td className="py-3.5 px-4">
                              <span className="font-mono text-[12px] font-semibold px-2 py-0.5 rounded-md bg-[#f1f5f9] text-[#0b1c30] border border-[#e2e8f0]">
                                {cust.customerId}
                              </span>
                            </td>

                            {/* Email */}
                            <td className="py-3.5 px-4 text-[#0b1c30]">
                              <div className="flex items-center gap-1.5 text-[12px]">
                                <Mail className="w-3.5 h-3.5 text-[#94a3b8]" />
                                <span>{cust.email || '—'}</span>
                              </div>
                            </td>

                            {/* Phone */}
                            <td className="py-3.5 px-4 text-[#0b1c30]">
                              <div className="flex items-center gap-1.5 text-[12px]">
                                <Phone className="w-3.5 h-3.5 text-[#94a3b8]" />
                                <span>{cust.phone ? formatIndianDisplayNumber(cust.phone) : '—'}</span>
                              </div>
                            </td>

                            {/* Registration Date */}
                            <td className="py-3.5 px-4 text-[#64748b] text-[11px]">
                              {cust.createdAt ? formatOrderDateTime(cust.createdAt) : 'Registered'}
                            </td>

                            {/* Account Status */}
                            <td className="py-3.5 px-4">
                              {cust.status === 'Active' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                  <span>Active</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                                  <span>Suspended</span>
                                </span>
                              )}
                            </td>

                            {/* Password Security */}
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200" title="Salted bcrypt hash stored securely. Inaccessible to admins.">
                                <Lock className="w-3 h-3 text-[#006b2c]" />
                                <span>Encrypted (Hidden)</span>
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  id={`btn-view-customer-${cust.customerId}`}
                                  onClick={() => setSelectedCustomerDetail(cust)}
                                  className="px-2.5 py-1 rounded-lg border border-[#cbd5e1] text-[#0b1c30] hover:bg-[#f1f5f9] text-[11px] font-semibold transition-colors cursor-pointer"
                                  title="View full customer details"
                                >
                                  View Details
                                </button>
                                <button
                                  type="button"
                                  disabled={isToggling}
                                  onClick={() => handleToggleCustomerStatus(cust)}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer disabled:opacity-50 ${
                                    cust.status === 'Active'
                                      ? 'border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100'
                                      : 'border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                  }`}
                                  title={cust.status === 'Active' ? 'Suspend customer account' : 'Reactivate customer account'}
                                >
                                  {isToggling ? '...' : cust.status === 'Active' ? 'Suspend' : 'Activate'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add New Authorized Admin Modal */}
      {showAddAdminModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(0,0,0,0.65)] backdrop-blur-xs animate-in fade-in"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)' }}
        >
          <div 
            className="rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-white/15 backdrop-blur-md p-6 sm:p-7 space-y-5 animate-in zoom-in-95"
            style={{ 
              backgroundColor: 'rgba(10, 10, 10, 0.88)', 
              backdropFilter: 'blur(16px)', 
              WebkitBackdropFilter: 'blur(16px)',
              borderColor: 'rgba(255, 255, 255, 0.15)' 
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <UserPlus className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-[18px] font-bold text-white font-display">
                    Authorize Administrator
                  </h3>
                  <p className="text-[12px] text-slate-400">
                    Add an authorized admin account to the persistent database.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddAdminModal(false)}
                className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addAdminModalError && (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-[12px] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
                <div className="flex-1 font-semibold">{addAdminModalError}</div>
              </div>
            )}

            <form onSubmit={handleCreateAdmin} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="block text-[12px] font-semibold text-slate-200">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="new-admin-fullname-input"
                  type="text"
                  required
                  placeholder="e.g. Maya Krishnan"
                  value={newAdminFullName}
                  onChange={(e) => setNewAdminFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-white/5 text-[13px] text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#006b2c] focus:border-[#006b2c]"
                />
              </div>

              {/* Registered Email */}
              <div className="space-y-1">
                <label className="block text-[12px] font-semibold text-slate-200">
                  Registered Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  id="new-admin-email-input"
                  type="email"
                  required
                  placeholder="e.g. maya@freshcart.com"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-white/5 text-[13px] text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#006b2c] focus:border-[#006b2c]"
                />
              </div>

              {/* Custom Admin User ID */}
              <div className="space-y-1">
                <label className="block text-[12px] font-semibold text-slate-200">
                  Admin User ID <span className="text-[11px] font-normal text-slate-400">(Optional)</span>
                </label>
                <input
                  id="new-admin-id-input"
                  type="text"
                  placeholder="e.g. adm_maya_105 (Auto-generated if left blank)"
                  value={newAdminCustomId}
                  onChange={(e) => setNewAdminCustomId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-white/5 text-[13px] text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#006b2c] focus:border-[#006b2c]"
                />
              </div>

              {/* Assigned Password */}
              <div className="space-y-1">
                <label className="block text-[12px] font-semibold text-slate-200">
                  Assigned Administrator Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    id="new-admin-password-input"
                    type={showNewAdminPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Minimum 6 characters"
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    className="w-full px-3.5 pr-10 py-2.5 rounded-xl border border-white/15 bg-white/5 text-[13px] text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#006b2c] focus:border-[#006b2c]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewAdminPassword(!showNewAdminPassword)}
                    className="absolute right-3 text-slate-400 hover:text-white p-1 cursor-pointer transition-colors"
                  >
                    {showNewAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Role Info Notice */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-400 space-y-1">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Assigned Role: Standard Administrator</span>
                </div>
                <p>
                  Passwords are securely hashed using bcrypt before database insertion. Normal administrators cannot promote themselves or other accounts to owner access.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddAdminModal(false)}
                  disabled={isSubmittingAdmin}
                  className="px-4 py-2.5 rounded-xl border border-white/20 text-[13px] font-semibold text-slate-300 hover:bg-white/10 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="submit-create-admin-btn"
                  disabled={isSubmittingAdmin || activeAdminsCount >= maxAdminsLimit}
                  className="px-5 py-2.5 rounded-xl bg-[#006b2c] hover:bg-[#005222] text-white text-[13px] font-bold shadow-xs transition-all duration-200 cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmittingAdmin ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving in Database...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Authorize Administrator</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Admin Confirmation Modal */}
      {deletingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1c30]/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-[#e2e8f0] p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-[#0b1c30] font-display">
                  Remove Administrator
                </h3>
                <p className="text-[12px] text-[#64748b]">
                  Permanent administrator access revocation.
                </p>
              </div>
            </div>

            <p className="text-[13px] text-[#3e4a3d] leading-relaxed">
              Are you sure you want to remove <strong>{deletingAdmin.fullName}</strong> ({deletingAdmin.email})? Their account and credentials will be deleted from the persistent database, and all active sessions will be terminated immediately.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e2e8f0]">
              <button
                type="button"
                onClick={() => setDeletingAdmin(null)}
                disabled={isDeletingAdmin}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold text-[#64748b] hover:bg-[#f1f5f9] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-remove-admin-btn"
                onClick={handleConfirmDeleteAdmin}
                disabled={isDeletingAdmin}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[13px] font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {isDeletingAdmin ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Removal</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Product Modal */}
      <AddProductModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddProduct={(newProd) => {
          onAddProduct(newProd);
          setPulseToast(`Added "${newProd.title}" (₹${newProd.price} / ${newProd.unit}) to store`);
          setTimeout(() => setPulseToast(null), 3500);
        }}
      />

      {/* Delete Product Confirmation Dialog */}
      {deleteConfirmProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1c30]/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-[#e2e8f0] p-6 space-y-4">
            <div className="flex items-center gap-3 text-[#b91c1c]">
              <div className="w-10 h-10 rounded-full bg-[#fee2e2] flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-[#ef4444]" />
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-[#0b1c30] font-display">
                  {t('removeProductTitle')}
                </h3>
                <p className="text-[12px] text-[#565e74]">
                  {t('removeProductSubtitle')}
                </p>
              </div>
            </div>

            <p className="text-[13px] text-[#3e4a3d] leading-relaxed">
              {t('removeProductConfirm', { title: deleteConfirmProduct.title })}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e2e8f0]">
              <button
                type="button"
                onClick={() => setDeleteConfirmProduct(null)}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold text-[#64748b] hover:bg-[#f1f5f9] cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteProduct(deleteConfirmProduct.id);
                  setPulseToast(`Removed "${deleteConfirmProduct.title}" from store`);
                  setDeleteConfirmProduct(null);
                  setTimeout(() => setPulseToast(null), 3000);
                }}
                className="px-4 py-2 rounded-lg bg-[#ef4444] hover:bg-[#dc2626] text-white text-[13px] font-bold shadow-xs transition-colors cursor-pointer"
              >
                {t('yesDeleteProduct')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      <EditProductModal
        isOpen={!!editingProduct}
        product={editingProduct}
        allCategories={allCatalogCategories}
        onClose={() => setEditingProduct(null)}
        onSaveProduct={(updatedProd) => {
          if (onEditProduct) {
            onEditProduct(updatedProd);
          }
          setPulseToast(`Saved changes for "${updatedProd.title}" (₹${updatedProd.price} / ${updatedProd.unit})`);
          setTimeout(() => setPulseToast(null), 3500);
        }}
      />
      {/* Delete Coupon Confirmation Dialog */}
      {deleteConfirmCoupon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1c30]/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-[#e2e8f0] p-6 space-y-4">
            <div className="flex items-center gap-3 text-[#b91c1c]">
              <div className="w-10 h-10 rounded-full bg-[#fee2e2] flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-[#ef4444]" />
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-[#0b1c30] font-display">
                  Delete Coupon
                </h3>
                <p className="text-[12px] text-[#565e74]">
                  This coupon will no longer be usable by customers.
                </p>
              </div>
            </div>

            <p className="text-[13px] text-[#3e4a3d] leading-relaxed">
              {t('deleteCouponConfirm', { code: deleteConfirmCoupon.code })}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e2e8f0]">
              <button
                type="button"
                onClick={() => setDeleteConfirmCoupon(null)}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold text-[#64748b] hover:bg-[#f1f5f9] cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                id="confirm-delete-coupon-btn"
                onClick={() => {
                  onDeleteCoupon(deleteConfirmCoupon.id);
                  setPulseToast(`Deleted coupon "${deleteConfirmCoupon.code}"`);
                  setDeleteConfirmCoupon(null);
                  setTimeout(() => setPulseToast(null), 3000);
                }}
                className="px-4 py-2 rounded-lg bg-[#ef4444] hover:bg-[#dc2626] text-white text-[13px] font-bold shadow-xs transition-colors cursor-pointer"
              >
                {t('deleteBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Log Confirmation Dialog */}
      {deleteConfirmLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1c30]/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-[#e2e8f0] p-6 space-y-4">
            <div className="flex items-center gap-3 text-[#b91c1c]">
              <div className="w-10 h-10 rounded-full bg-[#fee2e2] flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-[#ef4444]" />
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-[#0b1c30] font-display">
                  Delete Audit Log
                </h3>
                <p className="text-[12px] text-[#565e74]">
                  This will remove this log record from the audit trail.
                </p>
              </div>
            </div>

            <p className="text-[13px] text-[#3e4a3d] leading-relaxed">
              Are you sure you want to delete the log record for <span className="font-semibold text-[#0b1c30]">{deleteConfirmLog.productTitle}</span> ({deleteConfirmLog.changeType})? The actual product and stock will remain unchanged.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e2e8f0]">
              <button
                type="button"
                onClick={() => setDeleteConfirmLog(null)}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold text-[#64748b] hover:bg-[#f1f5f9] cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                id="confirm-delete-log-btn"
                onClick={() => {
                  if (onDeleteInventoryLog) {
                    onDeleteInventoryLog(deleteConfirmLog.id);
                  }
                  setPulseToast(`Deleted audit log record for "${deleteConfirmLog.productTitle}"`);
                  setDeleteConfirmLog(null);
                  setTimeout(() => setPulseToast(null), 3000);
                }}
                className="px-4 py-2 rounded-lg bg-[#ef4444] hover:bg-[#dc2626] text-white text-[13px] font-bold shadow-xs transition-colors cursor-pointer"
              >
                {t('deleteBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Logs Confirmation Dialog */}
      {showClearLogsConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1c30]/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-[#e2e8f0] p-6 space-y-4">
            <div className="flex items-center gap-3 text-[#b91c1c]">
              <div className="w-10 h-10 rounded-full bg-[#fee2e2] flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-[#ef4444]" />
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-[#0b1c30] font-display">
                  Clear All Audit Logs
                </h3>
                <p className="text-[12px] text-[#565e74]">
                  This will remove all CDC audit & dispatch log history.
                </p>
              </div>
            </div>

            <p className="text-[13px] text-[#3e4a3d] leading-relaxed">
              Are you sure you want to clear all {inventoryLogs.length} audit log entries? This will only remove the log history; all products and quantities will remain unchanged.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e2e8f0]">
              <button
                type="button"
                onClick={() => setShowClearLogsConfirm(false)}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold text-[#64748b] hover:bg-[#f1f5f9] cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                id="confirm-clear-logs-btn"
                onClick={() => {
                  if (onClearInventoryLogs) {
                    onClearInventoryLogs();
                  }
                  setPulseToast('Cleared all CDC audit & dispatch log records');
                  setShowClearLogsConfirm(false);
                  setTimeout(() => setPulseToast(null), 3000);
                }}
                className="px-4 py-2 rounded-lg bg-[#ef4444] hover:bg-[#dc2626] text-white text-[13px] font-bold shadow-xs transition-colors cursor-pointer"
              >
                Clear All Logs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Coupon Create / Edit Modal */}
      <CouponModal
        isOpen={isCouponModalOpen}
        coupon={editingCoupon}
        existingCodes={coupons.map((c) => c.code)}
        onClose={() => {
          setIsCouponModalOpen(false);
          setEditingCoupon(null);
        }}
        onSave={(data) => {
          if (editingCoupon) {
            onUpdateCoupon({
              ...editingCoupon,
              ...data,
            });
            setPulseToast(`Updated coupon "${data.code}" (${data.discountPercentage}% OFF)`);
          } else {
            onCreateCoupon(data);
            setPulseToast(`Created coupon "${data.code}" (${data.discountPercentage}% OFF)`);
          }
          setIsCouponModalOpen(false);
          setEditingCoupon(null);
          setTimeout(() => setPulseToast(null), 3500);
        }}
      />

      {/* View Screenshot Modal */}
      {viewingScreenshotItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0b1c30] rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-white/15 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-black/40">
              <div>
                <h3 className="text-[17px] font-bold text-white font-display flex items-center gap-2">
                  <FileImage className="w-5 h-5 text-emerald-400" />
                  <span>Payment Screenshot Proof</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Order #{viewingScreenshotItem.orderId.replace(/^#/, '')} • {formatINR(Number(viewingScreenshotItem.amount || viewingScreenshotItem.orderTotal || (viewingScreenshotItem as any).total || 0))}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Zoom Controls */}
                <div className="flex items-center bg-white/10 rounded-lg p-0.5 border border-white/10 text-xs">
                  <button
                    type="button"
                    onClick={() => setScreenshotZoom((prev) => Math.max(0.75, Number((prev - 0.25).toFixed(2))))}
                    title="Zoom Out"
                    className="p-1.5 hover:bg-white/10 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 text-[11px] font-mono text-slate-300 font-medium select-none min-w-[42px] text-center">
                    {Math.round(screenshotZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setScreenshotZoom((prev) => Math.min(3, Number((prev + 0.25).toFixed(2))))}
                    title="Zoom In"
                    className="p-1.5 hover:bg-white/10 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  {screenshotZoom !== 1 && (
                    <button
                      type="button"
                      onClick={() => setScreenshotZoom(1)}
                      title="Reset Zoom (100%)"
                      className="px-1.5 py-1 text-[10px] hover:bg-white/10 rounded text-emerald-400 font-semibold transition-colors cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {/* Open Full Image in New Tab */}
                <a
                  href={getAdminScreenshotUrl(viewingScreenshotItem.screenshotUrl, viewingScreenshotItem.orderId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open image in new tab at original resolution"
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-xs"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>

                {/* Close Button */}
                <button
                  type="button"
                  id="close-screenshot-modal-btn"
                  onClick={() => {
                    setViewingScreenshotItem(null);
                    setScreenshotZoom(1);
                  }}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {/* Customer summary */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-white/5 rounded-xl border border-white/10 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Customer</span>
                  <span className="font-bold text-white">{viewingScreenshotItem.customerName || 'Customer'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Mobile</span>
                  <span className="font-semibold text-slate-200">{viewingScreenshotItem.customerMobile || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Status</span>
                  <span className="font-bold text-amber-400">{viewingScreenshotItem.paymentStatus}</span>
                </div>
              </div>

              {/* High-res Image preview with Zoom & Pan */}
              <div className="p-3 bg-black/60 rounded-xl border border-white/10 flex items-center justify-center min-h-[300px] max-h-[58vh] overflow-auto">
                <img
                  src={getAdminScreenshotUrl(viewingScreenshotItem.screenshotUrl, viewingScreenshotItem.orderId)}
                  alt={`Payment Screenshot for Order #${viewingScreenshotItem.orderId.replace(/^#/, '')}`}
                  style={{
                    transform: `scale(${screenshotZoom})`,
                    transformOrigin: 'center center',
                    transition: 'transform 0.15s ease-out',
                  }}
                  className="max-h-[52vh] max-w-full rounded-lg object-contain shadow-lg cursor-zoom-in"
                  onClick={() => setScreenshotZoom((prev) => (prev >= 2 ? 1 : prev + 0.5))}
                  title="Click to zoom in"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent && !parent.querySelector('.img-error-placeholder')) {
                      const div = document.createElement('div');
                      div.className = 'img-error-placeholder py-8 px-4 text-center space-y-2';
                      div.innerHTML = `
                        <div class="inline-flex p-3 rounded-full bg-rose-500/10 text-rose-400 mb-1">
                          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        </div>
                        <p class="font-bold text-slate-200 text-sm">Payment Proof Unavailable</p>
                        <p class="text-xs text-slate-400 max-w-md mx-auto">The payment screenshot proof could not be loaded or is unavailable in persistent storage. You can reject this verification with a note requesting the customer to upload a replacement proof in their customer dashboard.</p>
                      `;
                      parent.appendChild(div);
                    }
                  }}
                />
              </div>

              <p className="text-[11px] text-slate-400 text-center">
                Click image or use zoom controls to enlarge. Admins can view this screenshot multiple times while retained. Closing does not delete or alter the file.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/10 bg-black/40 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setViewingScreenshotItem(null);
                  setScreenshotZoom(1);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/10 hover:bg-white/15 transition-colors cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {viewingScreenshotItem.paymentStatus !== 'PAID' && viewingScreenshotItem.paymentStatus !== 'COMPLETED' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectingItem(viewingScreenshotItem);
                        setRejectReasonInput('');
                      }}
                      disabled={isVerifyingAction}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Reject Payment
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprovePayment(viewingScreenshotItem)}
                      disabled={isVerifyingAction}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#006b2c] hover:bg-[#00873a] shadow-md transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve & Mark as Paid</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Payment Proof Modal */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0b1c30] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-white/15 p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-950/60 border border-rose-500/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-white font-display">
                  Reject Payment Proof
                </h3>
                <p className="text-xs text-slate-400">
                  Order #{rejectingItem.orderId.replace(/^#/, '')} • {formatINR(Number(rejectingItem.amount || rejectingItem.orderTotal || (rejectingItem as any).total || 0))}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              The screenshot will be retained for admin review. The customer will be notified and allowed to submit a new screenshot proof.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Reason for Rejection <span className="text-rose-400">*</span>
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {[
                  'Amount mismatch',
                  'Invalid UTR / Transaction ID',
                  'Blurry / unreadable image',
                  'Incorrect merchant UPI handle',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRejectReasonInput(preset)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/5 hover:bg-white/15 text-slate-300 border border-white/10 cursor-pointer transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <textarea
                value={rejectReasonInput}
                onChange={(e) => setRejectReasonInput(e.target.value)}
                placeholder="Explain why this proof is being rejected..."
                rows={3}
                className="w-full px-3 py-2 rounded-xl text-xs bg-black/40 border border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-400 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setRejectingItem(null);
                  setRejectReasonInput('');
                }}
                disabled={isVerifyingAction}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRejectPayment(rejectingItem, rejectReasonInput)}
                disabled={isVerifyingAction || !rejectReasonInput.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isVerifyingAction ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Rejecting...</span>
                  </>
                ) : (
                  <>
                    <X className="w-3.5 h-3.5" />
                    <span>Confirm Rejection</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Verification Order Confirmation Modal */}
      {deleteConfirmVerificationOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0b1c30] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-white/15 p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-950/60 border border-rose-500/40 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-white font-display">
                  Delete Order #{deleteConfirmVerificationOrder.orderId.replace(/^#/, '')}
                </h3>
                <p className="text-xs text-slate-400">
                  {deleteConfirmVerificationOrder.paymentStatus === 'PAID' || deleteConfirmVerificationOrder.paymentStatus === 'COMPLETED'
                    ? 'Verified & Paid'
                    : deleteConfirmVerificationOrder.paymentStatus === 'REJECTED'
                    ? 'Rejected Payment'
                    : deleteConfirmVerificationOrder.paymentStatus} • {formatINR(Number(deleteConfirmVerificationOrder.amount || deleteConfirmVerificationOrder.orderTotal || 0))}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Customer:</span>
                <span className="font-semibold text-white">{deleteConfirmVerificationOrder.customerName || 'Customer'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Status:</span>
                <span className={(deleteConfirmVerificationOrder.paymentStatus === 'PAID' || deleteConfirmVerificationOrder.paymentStatus === 'COMPLETED') ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {deleteConfirmVerificationOrder.paymentStatus}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete <strong>Order #{deleteConfirmVerificationOrder.orderId.replace(/^#/, '')}</strong>? This will remove the order from the payment verification queue and active database. All financial and audit history will be safely preserved in the audit archive.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setDeleteConfirmVerificationOrder(null)}
                disabled={isDeletingVerificationOrder}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-verification-order-btn"
                onClick={() => handleDeleteVerificationOrder(deleteConfirmVerificationOrder)}
                disabled={isDeletingVerificationOrder}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDeletingVerificationOrder ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0b1c30] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-white/15 p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-950/60 border border-rose-500/40 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-white font-display">
                  {bulkDeleteConfirm.type === 'ALL'
                    ? `Delete All ${bulkDeleteConfirm.sectionName} Records`
                    : `Delete Selected ${bulkDeleteConfirm.sectionName} Records`}
                </h3>
                <p className="text-xs text-slate-400">
                  Section: <strong className="text-white">{bulkDeleteConfirm.sectionName}</strong> • {bulkDeleteConfirm.count} record{bulkDeleteConfirm.count === 1 ? '' : 's'} selected
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Section Name:</span>
                <span className="font-semibold text-white">{bulkDeleteConfirm.sectionName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Records to Delete:</span>
                <span className="font-bold text-rose-400">
                  {bulkDeleteConfirm.count} record{bulkDeleteConfirm.count === 1 ? '' : 's'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Scope:</span>
                <span className="font-semibold text-amber-300">
                  {bulkDeleteConfirm.type === 'ALL' ? 'All records in this section' : 'Selected records only'}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {bulkDeleteConfirm.type === 'ALL'
                ? `Are you sure you want to delete ALL ${bulkDeleteConfirm.count} record(s) from the ${bulkDeleteConfirm.sectionName} section? This will remove these records from the active queue and active database. All financial and audit history will be safely preserved in the audit archive. Records in other sections will remain untouched.`
                : `Are you sure you want to delete ${bulkDeleteConfirm.count} selected record(s) from the ${bulkDeleteConfirm.sectionName} section? All financial and audit history will be safely preserved in the audit archive.`}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setBulkDeleteConfirm(null)}
                disabled={isBulkDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-bulk-delete-btn"
                onClick={handleExecuteBulkDelete}
                disabled={isBulkDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isBulkDeleting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {bulkDeleteConfirm.type === 'ALL'
                        ? `Delete All (${bulkDeleteConfirm.count})`
                        : `Confirm Delete (${bulkDeleteConfirm.count})`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Customer Account Details Modal */}
      {selectedCustomerDetail && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(0,0,0,0.65)] backdrop-blur-xs animate-in fade-in"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)' }}
        >
          <div 
            className="rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-white/15 backdrop-blur-md p-6 sm:p-7 space-y-5 animate-in zoom-in-95"
            style={{ 
              backgroundColor: 'rgba(10, 10, 10, 0.88)', 
              backdropFilter: 'blur(16px)', 
              WebkitBackdropFilter: 'blur(16px)',
              borderColor: 'rgba(255, 255, 255, 0.15)' 
            }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 font-bold text-base">
                  {selectedCustomerDetail.name ? selectedCustomerDetail.name.charAt(0).toUpperCase() : 'C'}
                </div>
                <div>
                  <h3 className="text-[18px] font-bold text-white font-display">
                    Customer Account Details
                  </h3>
                  <p className="text-[12px] text-slate-400">
                    Registered through FreshCart Customer Portal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomerDetail(null)}
                className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Customer Details Content */}
            <div className="space-y-4">
              {/* Account summary cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 block">Customer User ID</span>
                  <span className="font-mono text-[13px] font-bold text-white block">
                    {selectedCustomerDetail.customerId}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 block">Account Status</span>
                  {selectedCustomerDetail.status === 'Active' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Active</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                      <span>Suspended</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Detail Rows */}
              <div className="rounded-xl border border-white/10 divide-y divide-white/10 text-[13px] bg-white/5">
                <div className="p-3 flex justify-between items-center">
                  <span className="text-slate-400">Full Name:</span>
                  <span className="font-bold text-white">{selectedCustomerDetail.name}</span>
                </div>
                <div className="p-3 flex justify-between items-center">
                  <span className="text-slate-400">Email Address:</span>
                  <span className="font-medium text-slate-200">{selectedCustomerDetail.email || 'None provided'}</span>
                </div>
                <div className="p-3 flex justify-between items-center">
                  <span className="text-slate-400">Phone Number:</span>
                  <span className="font-medium text-slate-200">
                    {selectedCustomerDetail.phone ? formatIndianDisplayNumber(selectedCustomerDetail.phone) : 'None provided'}
                  </span>
                </div>
                <div className="p-3 flex justify-between items-center">
                  <span className="text-slate-400">Loyalty Tier:</span>
                  <span className="font-semibold text-emerald-400">{selectedCustomerDetail.loyaltyTier || 'Fresh Member'}</span>
                </div>
                <div className="p-3 flex justify-between items-center">
                  <span className="text-slate-400">Registration Date:</span>
                  <span className="text-slate-200">{formatOrderDateTime(selectedCustomerDetail.createdAt)}</span>
                </div>
                {selectedCustomerDetail.address && (
                  <div className="p-3 flex justify-between items-start">
                    <span className="text-slate-400 shrink-0">Saved Address:</span>
                    <span className="text-right text-slate-200 max-w-[260px]">{selectedCustomerDetail.address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => handleToggleCustomerStatus(selectedCustomerDetail)}
                disabled={isTogglingCustomerStatus === selectedCustomerDetail.customerId}
                className={`px-4 py-2 rounded-xl text-[12px] font-bold border transition-colors cursor-pointer ${
                  selectedCustomerDetail.status === 'Active'
                    ? 'border-amber-500/30 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20'
                    : 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20'
                }`}
              >
                {selectedCustomerDetail.status === 'Active' ? 'Suspend Account' : 'Reactivate Account'}
              </button>

              <button
                type="button"
                onClick={() => setSelectedCustomerDetail(null)}
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[12px] font-bold transition-colors cursor-pointer border border-white/20"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
