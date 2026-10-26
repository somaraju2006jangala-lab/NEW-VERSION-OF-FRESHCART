import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { CartItem, Product, CustomerAddress, CustomerOrder } from '../types';
import { formatINR } from '../utils/currency';
import {
  User,
  Package,
  Clock,
  MapPin,
  ShoppingCart,
  LogOut,
  ChevronRight,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  Truck,
  RotateCcw,
  Plus,
  Minus,
  Trash2,
  Check,
  Edit3,
  Store,
  ShieldCheck,
  Phone,
  Mail,
  Calendar,
  Zap,
  AlertTriangle,
  Upload,
  Image as ImageIcon,
  Eye,
} from 'lucide-react';
import { getCustomerOrderOtp } from '../services/otpClientService';
import { uploadPaymentScreenshot } from '../services/paymentService';

interface CustomerDashboardProps {
  cart: CartItem[];
  onOpenCart: () => void;
  onOpenCheckout: () => void;
  onAddToCart: (product: Product, quantity: number, packSize?: string, packPrice?: number) => void;
  onUpdateQty?: (productId: string, delta: number) => void;
  onRemoveItem?: (productId: string) => void;
  onBackToStorefront: () => void;
  onLogout: () => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  cart,
  onOpenCart,
  onOpenCheckout,
  onAddToCart,
  onUpdateQty,
  onRemoveItem,
  onBackToStorefront,
  onLogout,
}) => {
  const { currentUser, orders, updateProfile, addAddress, removeAddress, refreshOrders } = useAuth();
  const { t } = useLanguage();

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Pending': return t('statusPending');
      case 'Picking at Pod #104': return t('statusPicking');
      case 'Cold-Chain En Route': return t('statusColdChain');
      case 'Delivered': return t('statusDelivered');
      default: return status;
    }
  };

  const [activeTab, setActiveTab] = useState<'orders' | 'history' | 'profile' | 'addresses' | 'cart'>('orders');
  const [showDashboardMenu, setShowDashboardMenu] = useState(false);
  const dashboardMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dashboardMenuRef.current && !dashboardMenuRef.current.contains(event.target as Node)) {
        setShowDashboardMenu(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowDashboardMenu(false);
      }
    };
    if (showDashboardMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showDashboardMenu]);

  const getActiveTabLabel = () => {
    switch (activeTab) {
      case 'orders': return t('tabMyOrders');
      case 'history': return t('tabOrderHistory');
      case 'cart': return t('tabCartOverview');
      case 'profile': return t('tabProfileSettings');
      case 'addresses': return t('tabSavedAddresses');
      default: return 'Dashboard';
    }
  };

  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(currentUser?.name || '');
  const [profilePhone, setProfilePhone] = useState(currentUser?.phone || '');
  const [profileAddress, setProfileAddress] = useState(currentUser?.address || '');
  const [profileSavedToast, setProfileSavedToast] = useState(false);

  // New address form modal/state
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [newAddrLabel, setNewAddrLabel] = useState('Home');
  const [newAddrStreet, setNewAddrStreet] = useState('');
  const [newAddrCity, setNewAddrCity] = useState('');
  const [newAddrState, setNewAddrState] = useState('');
  const [newAddrZip, setNewAddrZip] = useState('');
  const [newAddrDefault, setNewAddrDefault] = useState(false);

  // Reorder toast feedback
  const [reorderToast, setReorderToast] = useState<string | null>(null);

  if (!currentUser) {
    return null;
  }

  const activeOrders = orders.filter((o) => o.status?.toLowerCase() !== 'delivered');
  const pastOrders = orders.filter((o) => o.status?.toLowerCase() === 'delivered');

  // Order Handover OTP State for Customer Orders
  const [customerOrderOtps, setCustomerOrderOtps] = useState<
    Record<string, { otp?: string; loading?: boolean; isExpired?: boolean; error?: string }>
  >({});

  // UPI Payment Screenshot Upload State for Customer Orders
  const [uploadingScreenshot, setUploadingScreenshot] = useState<Record<string, boolean>>({});
  const [uploadError, setUploadError] = useState<Record<string, string | null>>({});
  const [uploadSuccess, setUploadSuccess] = useState<Record<string, string | null>>({});
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File | null>>({});
  const [selectedPreviews, setSelectedPreviews] = useState<Record<string, string | null>>({});

  const handleFileSelect = (orderId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type: accept JPG, JPEG, PNG
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const validExts = ['.jpg', '.jpeg', '.png'];

    if (!validTypes.includes(file.type.toLowerCase()) && !validExts.includes(ext)) {
      setUploadError((prev) => ({
        ...prev,
        [orderId]: 'Please select a valid JPG, JPEG, or PNG image file.',
      }));
      setUploadSuccess((prev) => ({ ...prev, [orderId]: null }));
      e.target.value = '';
      return;
    }

    // Check file size: max 10 MB (10 * 1024 * 1024 bytes)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadError((prev) => ({
        ...prev,
        [orderId]: 'File size exceeds the 10 MB limit. Please select a smaller screenshot.',
      }));
      setUploadSuccess((prev) => ({ ...prev, [orderId]: null }));
      e.target.value = '';
      return;
    }

    // Valid file
    setUploadError((prev) => ({ ...prev, [orderId]: null }));
    setUploadSuccess((prev) => ({ ...prev, [orderId]: null }));
    setSelectedFiles((prev) => ({ ...prev, [orderId]: file }));
    const previewUrl = URL.createObjectURL(file);
    setSelectedPreviews((prev) => ({ ...prev, [orderId]: previewUrl }));
  };

  const handleClearSelectedFile = (orderId: string) => {
    setSelectedFiles((prev) => ({ ...prev, [orderId]: null }));
    if (selectedPreviews[orderId]) {
      URL.revokeObjectURL(selectedPreviews[orderId]!);
    }
    setSelectedPreviews((prev) => ({ ...prev, [orderId]: null }));
    setUploadError((prev) => ({ ...prev, [orderId]: null }));
  };

  const handleSubmitScreenshot = async (order: CustomerOrder) => {
    const file = selectedFiles[order.id];
    if (!file || uploadingScreenshot[order.id]) return;

    setUploadingScreenshot((prev) => ({ ...prev, [order.id]: true }));
    setUploadError((prev) => ({ ...prev, [order.id]: null }));
    setUploadSuccess((prev) => ({ ...prev, [order.id]: null }));

    try {
      const res = await uploadPaymentScreenshot(order.id, file, currentUser?.token);
      if (res.success) {
        setUploadSuccess((prev) => ({
          ...prev,
          [order.id]: 'Payment proof submitted successfully. Please wait for admin verification.',
        }));
        setSelectedFiles((prev) => ({ ...prev, [order.id]: null }));
        setSelectedPreviews((prev) => ({ ...prev, [order.id]: null }));
        refreshOrders();
      } else {
        setUploadError((prev) => ({
          ...prev,
          [order.id]: res.error || 'Failed to upload screenshot. Please try again.',
        }));
        if (res.alreadySubmitted || res.alreadyPaid) {
          refreshOrders();
        }
      }
    } catch {
      setUploadError((prev) => ({
        ...prev,
        [order.id]: 'Network error while uploading screenshot. Please try again.',
      }));
    } finally {
      setUploadingScreenshot((prev) => ({ ...prev, [order.id]: false }));
    }
  };

  // Fetch active OTP from backend for Picking orders (only after online payment approval or for eligible COD)
  useEffect(() => {
    if (!currentUser?.id) return;

    orders.forEach((order) => {
      const isDelivered = order.status?.toLowerCase() === 'delivered';
      const isCod =
        order.paymentMethod?.toLowerCase().includes('cash') ||
        order.paymentMethod === 'COD' ||
        order.paymentMethod === 'Cash on Delivery';
      const isPaid =
        order.paymentStatus?.toUpperCase() === 'PAID' ||
        order.paymentStatus?.toUpperCase() === 'COMPLETED';

      // If order is delivered, clean up any active OTP state
      if (isDelivered) {
        if (customerOrderOtps[order.id]) {
          setCustomerOrderOtps((prev) => {
            const next = { ...prev };
            delete next[order.id];
            return next;
          });
        }
        return;
      }

      // Delivery OTP is fetched only after admin confirms PAID/COMPLETED for online orders (never for COD)
      if (isPaid && !isCod && !isDelivered && !customerOrderOtps[order.id]) {
        // Mark loading state
        setCustomerOrderOtps((prev) => ({
          ...prev,
          [order.id]: { loading: true },
        }));

        getCustomerOrderOtp(order.id, currentUser.id, currentUser.token)
          .then((res) => {
            if (res.success && res.otp) {
              setCustomerOrderOtps((prev) => ({
                ...prev,
                [order.id]: {
                  otp: res.otp,
                  loading: false,
                  isExpired: false,
                },
              }));
            } else if (res.status === 'USED' || res.message?.toLowerCase().includes('delivered')) {
              setCustomerOrderOtps((prev) => {
                const next = { ...prev };
                delete next[order.id];
                return next;
              });
              refreshOrders();
            } else if (res.isExpired || res.status === 'EXPIRED') {
              setCustomerOrderOtps((prev) => ({
                ...prev,
                [order.id]: {
                  isExpired: true,
                  loading: false,
                },
              }));
            } else {
              setCustomerOrderOtps((prev) => ({
                ...prev,
                [order.id]: {
                  loading: false,
                  error: res.error || 'Failed to load Order Handover OTP. Please try again.',
                },
              }));
            }
          })
          .catch(() => {
            setCustomerOrderOtps((prev) => ({
              ...prev,
              [order.id]: {
                loading: false,
                error: 'Failed to contact server for Order Handover OTP.',
              },
            }));
          });
      }
    });
  }, [activeOrders, currentUser?.id, currentUser?.token, customerOrderOtps]);

  // Sync with storage, custom update events, and periodically poll orders so admin approval reflects automatically
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'freshcart_customer_orders') {
        refreshOrders();
      }
    };
    const handleCustomSync = () => {
      refreshOrders();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('freshcart_orders_updated', handleCustomSync);
    window.addEventListener('focus', handleCustomSync);

    const pollInterval = setInterval(() => {
      // Automatically poll orders from database so admin verification or delivery changes update live
      const needsPolling = orders.some((o) => o.status?.toLowerCase() !== 'delivered');
      if (needsPolling) {
        refreshOrders();
      }
    }, 2500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('freshcart_orders_updated', handleCustomSync);
      window.removeEventListener('focus', handleCustomSync);
      clearInterval(pollInterval);
    };
  }, [orders, refreshOrders]);

  const handleFetchOtp = async (orderId: string) => {
    if (!currentUser?.id) return;
    const targetOrder = orders.find((o) => o.id === orderId);
    const isCod =
      targetOrder?.paymentMethod?.toLowerCase().includes('cash') ||
      targetOrder?.paymentMethod === 'COD' ||
      targetOrder?.paymentMethod === 'Cash on Delivery';
    if (isCod) return; // COD orders never use OTP

    setCustomerOrderOtps((prev) => ({
      ...prev,
      [orderId]: { loading: true, error: undefined },
    }));
    try {
      const res = await getCustomerOrderOtp(orderId, currentUser.id, currentUser.token);
      if (res.success && res.otp) {
        setCustomerOrderOtps((prev) => ({
          ...prev,
          [orderId]: {
            otp: res.otp,
            loading: false,
            isExpired: false,
            error: undefined,
          },
        }));
      } else if (res.status === 'USED' || res.message?.toLowerCase().includes('delivered')) {
        setCustomerOrderOtps((prev) => {
          const next = { ...prev };
          delete next[orderId];
          return next;
        });
        refreshOrders();
      } else if (res.isExpired || res.status === 'EXPIRED') {
        setCustomerOrderOtps((prev) => ({
          ...prev,
          [orderId]: {
            isExpired: true,
            loading: false,
            error: res.error || 'OTP has expired. Please request the store administrator to issue a fresh OTP.',
          },
        }));
      } else {
        setCustomerOrderOtps((prev) => ({
          ...prev,
          [orderId]: {
            loading: false,
            error: res.error || 'Failed to load Order Handover OTP. Please try again.',
          },
        }));
      }
    } catch {
      setCustomerOrderOtps((prev) => ({
        ...prev,
        [orderId]: {
          loading: false,
          error: 'Failed to contact server for Order Handover OTP.',
        },
      }));
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      name: profileName,
      phone: profilePhone,
      address: profileAddress,
    });
    setIsEditingProfile(false);
    setProfileSavedToast(true);
    setTimeout(() => setProfileSavedToast(false), 3000);
  };

  const handleCreateAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddrStreet.trim()) return;

    addAddress({
      label: newAddrLabel,
      street: newAddrStreet,
      city: newAddrCity,
      state: newAddrState,
      zip: newAddrZip,
      isDefault: newAddrDefault,
    });

    setNewAddrStreet('');
    setShowAddAddressModal(false);
  };

  const handleReorderItems = (orderItems: CartItem[], orderId: string) => {
    orderItems.forEach((it) => {
      onAddToCart(it.product, it.quantity, it.selectedPackSize, it.selectedPrice);
    });
    setReorderToast(t('reorderToastMsg', { count: orderItems.length, id: orderId }));
    setTimeout(() => setReorderToast(null), 3500);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Toast Notification */}
      {reorderToast && (
        <div className="fixed bottom-24 right-6 z-50 bg-[#006b2c] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-[13px] font-semibold animate-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#7ffc97]" />
          <span>{reorderToast}</span>
        </div>
      )}

      {profileSavedToast && (
        <div className="fixed bottom-24 right-6 z-50 bg-[#0b1c30] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-[13px] font-semibold animate-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#7ffc97]" />
          <span>{t('profileSavedMsg')}</span>
        </div>
      )}

      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#e2e8f0]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToStorefront}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#cbd5e1] text-[#0b1c30] hover:bg-[#f1f5f9] text-[12px] font-semibold transition-colors cursor-pointer"
          >
            <Store className="w-4 h-4 text-[#006b2c]" />
            <span>{t('backToStorefrontBtn')}</span>
          </button>
          <span className="text-[12px] text-[#565e74]">/</span>
          <span className="text-[13px] font-semibold text-[#006b2c]">
            {t('customerAccountDashboard')}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Dashboard Views Dropdown Menu */}
          <div className="relative" ref={dashboardMenuRef}>
            <button
              type="button"
              id="customer-dashboard-dropdown-btn"
              aria-haspopup="true"
              aria-expanded={showDashboardMenu}
              onClick={() => setShowDashboardMenu(!showDashboardMenu)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/20 bg-black/40 hover:bg-black/60 text-white text-[12px] font-semibold transition-all shadow-sm cursor-pointer hover:border-emerald-500/40"
              title="Dashboard Views Menu"
            >
              <Truck className="w-3.5 h-3.5 text-[#10b981]" />
              <span className="max-w-[130px] truncate">{getActiveTabLabel()}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#94a3b8] transition-transform duration-200 ${
                  showDashboardMenu ? 'rotate-180 text-[#10b981]' : ''
                }`}
              />
            </button>

            {showDashboardMenu && (
              <div
                id="customer-dashboard-dropdown-menu"
                data-dropdown-menu="true"
                className="freshcart-dropdown-menu absolute right-0 top-full mt-2 w-64 p-2 z-50 animate-in fade-in zoom-in-95 duration-150 max-w-[calc(100vw-2rem)]"
                style={{
                  backgroundColor: 'rgba(3, 7, 12, 0.96)',
                  WebkitBackdropFilter: 'blur(16px)',
                  backdropFilter: 'blur(16px)',
                }}
              >
                <div className="px-3 py-2 border-b freshcart-dropdown-divider mb-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">Customer Portal Menu</p>
                  <p className="text-[13px] font-bold text-white truncate">{currentUser.name}</p>
                </div>

                <div className="space-y-1">
                  <button
                    type="button"
                    id="dropdown-tab-orders"
                    onClick={() => {
                      setActiveTab('orders');
                      setShowDashboardMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12px] transition-all cursor-pointer ${
                      activeTab === 'orders' ? 'freshcart-dropdown-item-active' : 'freshcart-dropdown-item text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Truck className={`w-4 h-4 ${activeTab === 'orders' ? 'text-[#10b981]' : 'text-[#34d399]'}`} />
                      <span>{t('tabMyOrders')}</span>
                    </div>
                    {activeOrders.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30 text-[10px] font-bold">
                        {activeOrders.length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    id="dropdown-tab-history"
                    onClick={() => {
                      setActiveTab('history');
                      setShowDashboardMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12px] transition-all cursor-pointer ${
                      activeTab === 'history' ? 'freshcart-dropdown-item-active' : 'freshcart-dropdown-item text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Clock className={`w-4 h-4 ${activeTab === 'history' ? 'text-[#10b981]' : 'text-[#34d399]'}`} />
                      <span>{t('tabOrderHistory')}</span>
                    </div>
                    <span className="text-[11px] text-[#94a3b8]">{pastOrders.length}</span>
                  </button>

                  <button
                    type="button"
                    id="dropdown-tab-cart"
                    onClick={() => {
                      setActiveTab('cart');
                      setShowDashboardMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12px] transition-all cursor-pointer ${
                      activeTab === 'cart' ? 'freshcart-dropdown-item-active' : 'freshcart-dropdown-item text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <ShoppingCart className={`w-4 h-4 ${activeTab === 'cart' ? 'text-[#10b981]' : 'text-[#34d399]'}`} />
                      <span>{t('tabCartOverview')}</span>
                    </div>
                    {cartItemCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-[#10b981] border border-emerald-500/30 text-[10px] font-bold">
                        {cartItemCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    id="dropdown-tab-profile"
                    onClick={() => {
                      setActiveTab('profile');
                      setShowDashboardMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12px] transition-all cursor-pointer ${
                      activeTab === 'profile' ? 'freshcart-dropdown-item-active' : 'freshcart-dropdown-item text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <User className={`w-4 h-4 ${activeTab === 'profile' ? 'text-[#10b981]' : 'text-[#34d399]'}`} />
                      <span>{t('tabProfileSettings')}</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="dropdown-tab-addresses"
                    onClick={() => {
                      setActiveTab('addresses');
                      setShowDashboardMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12px] transition-all cursor-pointer ${
                      activeTab === 'addresses' ? 'freshcart-dropdown-item-active' : 'freshcart-dropdown-item text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <MapPin className={`w-4 h-4 ${activeTab === 'addresses' ? 'text-[#10b981]' : 'text-[#34d399]'}`} />
                      <span>{t('tabSavedAddresses')}</span>
                    </div>
                    <span className="text-[11px] text-[#94a3b8]">{(currentUser.savedAddresses || []).length}</span>
                  </button>
                </div>

                <div className="border-t freshcart-dropdown-divider mt-1.5 pt-1.5">
                  <button
                    type="button"
                    id="dashboard-dropdown-logout-btn"
                    onClick={() => {
                      setShowDashboardMenu(false);
                      onLogout();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-[12px] font-semibold freshcart-dropdown-item-danger flex items-center gap-2.5 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-[#f87171]" />
                    <span>{t('logOut')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            id="dashboard-logout-btn"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[#fecaca]/30 bg-red-500/10 text-[#f87171] hover:bg-red-500/20 text-[12px] font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t('logOut')}</span>
          </button>
        </div>
      </div>

      {/* Welcome Banner Card */}
      <div className="mt-6 rounded-3xl bg-[#006b2c]/20 p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-emerald-500/30">
        {/* Subtle decorative circles */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/10 rounded-full blur-2xl pointer-events-none transform translate-x-20 -translate-y-20" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <img
              src={
                currentUser.avatarUrl ||
                `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser.name)}&backgroundColor=006b2c`
              }
              alt={currentUser.name}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-4 ring-white/20 bg-white/10 shadow-md"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider bg-[#7ffc97] text-[#002109] px-2.5 py-0.5 rounded-full shadow-2xs">
                  {currentUser.loyaltyTier || t('verifiedCustomer')}
                </span>
                <span className="text-white/70 text-[12px] hidden sm:inline">
                  {(() => {
                    const createdVal = currentUser?.createdAt;
                    if (!createdVal) return t('memberSince', { date: '2026' });
                    const d = new Date(createdVal);
                    if (isNaN(d.getTime())) return t('memberSince', { date: '2026' });
                    return t('memberSince', {
                      date: d.toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      }),
                    });
                  })()}
                </span>
              </div>
              <h1
                id="customer-dashboard-greeting"
                className="text-[24px] sm:text-[30px] font-extrabold font-display tracking-tight text-white mt-1"
              >
                {t('welcomeBack', { name: currentUser.name })}
              </h1>
              <p className="text-white/80 text-[13px] flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-[#7ffc97]" />
                  {currentUser.email}
                </span>
                {currentUser.phone && (
                  <span className="hidden sm:flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-[#7ffc97]" />
                    {currentUser.phone}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3 sm:gap-4 bg-black/20 backdrop-blur-md p-3 rounded-2xl border border-white/15 shadow-sm">
            <div className="text-center px-2 sm:px-3">
              <div className="text-[20px] font-bold font-display text-white">
                {activeOrders.length}
              </div>
              <div className="text-[11px] text-white/75">{t('activeDeliveriesCount')}</div>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center px-2 sm:px-3">
              <div className="text-[20px] font-bold font-display text-white">
                {orders.length}
              </div>
              <div className="text-[11px] text-white/75">{t('totalOrdersCount')}</div>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center px-2 sm:px-3">
              <div className="text-[20px] font-bold font-display text-[#7ffc97]">
                {cartItemCount}
              </div>
              <div className="text-[11px] text-white/75">{t('cartItemsCount')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Tabs & Content Area */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Navigation Sidebar */}
        <aside className="lg:col-span-1 space-y-1.5">
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/80 p-2.5 shadow-md">
            <button
              type="button"
              id="tab-btn-orders"
              onClick={() => setActiveTab('orders')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-[#eff4ff] text-[#006b2c] font-bold shadow-2xs'
                  : 'text-[#565e74] hover:bg-[#f8fafc] hover:text-[#0b1c30]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Truck className="w-4 h-4" />
                <span>{t('tabMyOrders')}</span>
              </div>
              {activeOrders.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#006b2c] text-white text-[11px] font-bold">
                  {activeOrders.length}
                </span>
              )}
            </button>

            <button
              type="button"
              id="tab-btn-history"
              onClick={() => setActiveTab('history')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-[#eff4ff] text-[#006b2c] font-bold shadow-2xs'
                  : 'text-[#565e74] hover:bg-[#f8fafc] hover:text-[#0b1c30]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4" />
                <span>{t('tabOrderHistory')}</span>
              </div>
              <span className="text-[11px] text-[#565e74] font-medium">
                {pastOrders.length}
              </span>
            </button>

            <button
              type="button"
              id="tab-btn-cart"
              onClick={() => setActiveTab('cart')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors cursor-pointer ${
                activeTab === 'cart'
                  ? 'bg-[#eff4ff] text-[#006b2c] font-bold shadow-2xs'
                  : 'text-[#565e74] hover:bg-[#f8fafc] hover:text-[#0b1c30]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShoppingCart className="w-4 h-4" />
                <span>{t('tabCartOverview')}</span>
              </div>
              {cartItemCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#7ffc97] text-[#002109] text-[11px] font-bold">
                  {cartItemCount}
                </span>
              )}
            </button>

            <button
              type="button"
              id="tab-btn-profile"
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-[#eff4ff] text-[#006b2c] font-bold shadow-2xs'
                  : 'text-[#565e74] hover:bg-[#f8fafc] hover:text-[#0b1c30]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <User className="w-4 h-4" />
                <span>{t('tabProfileSettings')}</span>
              </div>
            </button>

            <button
              type="button"
              id="tab-btn-addresses"
              onClick={() => setActiveTab('addresses')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors cursor-pointer ${
                activeTab === 'addresses'
                  ? 'bg-[#eff4ff] text-[#006b2c] font-bold shadow-2xs'
                  : 'text-[#565e74] hover:bg-[#f8fafc] hover:text-[#0b1c30]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4" />
                <span>{t('tabSavedAddresses')}</span>
              </div>
              <span className="text-[11px] text-[#565e74] font-medium">
                {(currentUser.savedAddresses || []).length}
              </span>
            </button>
          </div>
        </aside>

        {/* Main Content Pane */}
        <main className="lg:col-span-3 space-y-6">
          {/* TAB: MY ORDERS (ACTIVE ORDERS) */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[20px] font-bold text-[#0b1c30] font-display">
                    Active Delivery Tracking
                  </h2>
                  <p className="text-[13px] text-[#565e74]">
                    Live fulfillment status for your neighborhood orders
                  </p>
                </div>
              </div>

              {orders.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#e2e8f0] p-10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[#eff4ff] text-[#006b2c] flex items-center justify-center mx-auto">
                    <Package className="w-6 h-6" />
                  </div>
                  <h3 className="text-[16px] font-bold text-[#0b1c30]">
                    {t('noActiveOrders')}
                  </h3>
                  <button
                    type="button"
                    onClick={onBackToStorefront}
                    className="mt-2 px-4 py-2 bg-[#006b2c] text-white text-[13px] font-semibold rounded-xl hover:bg-[#00873a] transition-colors cursor-pointer"
                  >
                    {t('backToStorefrontBtn')}
                  </button>
                </div>
              ) : (
                orders.map((order) => {
                  const isDelivered = order.status?.toLowerCase() === 'delivered';
                  const isCod =
                    order.paymentMethod?.toLowerCase().includes('cash') ||
                    order.paymentMethod === 'COD' ||
                    order.paymentMethod === 'Cash on Delivery';

                  return (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl border border-[#e2e8f0] p-5 sm:p-6 shadow-xs space-y-5"
                  >
                    {/* Order Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#e5eeff]">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[16px] font-bold text-[#0b1c30] font-display">
                            Order {order.id.startsWith('#') ? order.id : `#${order.id}`}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              isDelivered
                                ? 'bg-[#dcfce7] text-[#15803d]'
                                : 'bg-[#dcfce7] text-[#15803d] animate-pulse'
                            }`}
                          >
                            {isDelivered ? '✓' : '●'} {getStatusLabel(order.status)}
                          </span>
                          <span
                            id={`order-payment-method-badge-${order.id.replace('#', '')}`}
                            className="px-2.5 py-0.5 rounded-full bg-[#eff4ff] text-[#1e40af] border border-[#dbeafe] text-[11px] font-semibold"
                          >
                            Payment Method: {order.paymentMethod || 'Online'}
                          </span>
                          <span
                            id={`order-payment-status-badge-${order.id.replace('#', '')}`}
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                              order.paymentStatus?.toUpperCase() === 'COMPLETED' ||
                              order.paymentStatus?.toUpperCase() === 'PAID' ||
                              order.paymentStatus?.toUpperCase() === 'COLLECTED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : order.paymentStatus === 'PENDING_VERIFICATION' ||
                                  order.paymentStatus === 'PENDING VERIFICATION' ||
                                  order.paymentStatus === 'PENDING_COLLECTION'
                                ? 'bg-amber-50 text-amber-700 border-amber-300'
                                : order.paymentStatus === 'REJECTED'
                                ? 'bg-rose-50 text-rose-700 border-rose-300'
                                : 'bg-blue-50 text-blue-700 border-blue-300'
                            }`}
                          >
                            Payment Status: {
                              order.paymentStatus?.toUpperCase() === 'COMPLETED' || order.paymentStatus?.toUpperCase() === 'PAID'
                                ? 'COMPLETED'
                                : order.paymentStatus?.toUpperCase() === 'COLLECTED'
                                ? 'COLLECTED'
                                : order.paymentStatus === 'PENDING_VERIFICATION' || order.paymentStatus === 'PENDING VERIFICATION'
                                ? 'PENDING VERIFICATION'
                                : order.paymentStatus === 'PENDING_COLLECTION'
                                ? 'PENDING COLLECTION'
                                : order.paymentStatus === 'REJECTED'
                                ? 'REJECTED'
                                : (order.paymentStatus || 'PENDING')
                            }
                          </span>
                        </div>
                        <div className="text-[12px] text-[#565e74] mt-0.5 flex items-center gap-3">
                          <span>Placed: {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>•</span>
                          <span>{order.items.length} items</span>
                          <span>•</span>
                          <span className="font-semibold text-[#006b2c]">{formatINR(order.total)}</span>
                        </div>
                      </div>

                      <div className="bg-[#eff4ff] px-3.5 py-1.5 rounded-xl border border-[#d3e4fe] flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#006b2c]" />
                        <span className="text-[12px] font-semibold text-[#006b2c]">
                          {order.estimatedDeliveryTime || 'Arrival in ~20 minutes'}
                        </span>
                      </div>
                    </div>

                    {/* Upload Payment Screenshot section for online UPI orders when proof is required */}
                    {(() => {
                      const isUpi =
                        order.paymentMethod === 'UPI' ||
                        order.paymentMethod?.toLowerCase().includes('upi') ||
                        order.paymentMethod?.toLowerCase().includes('phonepe') ||
                        order.paymentMethod?.toLowerCase().includes('google pay') ||
                        order.paymentMethod?.toLowerCase().includes('gpay') ||
                        order.paymentMethod?.toLowerCase().includes('paytm') ||
                        order.paymentMethod?.toLowerCase().includes('online');
                      const isCompleted =
                        order.paymentStatus?.toUpperCase() === 'COMPLETED' ||
                        order.paymentStatus?.toUpperCase() === 'PAID';

                      // When online payment is COMPLETED, automatically remove the entire Upload Payment Screenshot section
                      if (!isUpi || isCompleted) return null;

                      const isPendingVerification = order.paymentStatus === 'PENDING_VERIFICATION';
                      const isRejected = order.paymentStatus === 'REJECTED';
                      const isUploading = !!uploadingScreenshot[order.id];
                      const fileSelected = selectedFiles[order.id];
                      const previewUrl = selectedPreviews[order.id];
                      const errorMsg = uploadError[order.id];
                      const successMsg = uploadSuccess[order.id];

                      return (
                        <div
                          id={`upload-payment-screenshot-section-${order.id.replace('#', '')}`}
                          className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-white/10 shadow-lg space-y-3.5 transition-all text-slate-200"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-white/10">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                                <Upload className="w-4 h-4 text-emerald-400" />
                              </div>
                              <div>
                                <h4 className="text-[13px] font-bold text-white font-display">
                                  Upload Payment Screenshot
                                </h4>
                                <p className="text-[11px] text-slate-400">
                                  UPI payment verification proof for order {order.id.startsWith('#') ? order.id : `#${order.id}`}
                                </p>
                              </div>
                            </div>

                            <div>
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                  isPendingVerification
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                    : isRejected
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isPendingVerification
                                      ? 'bg-amber-400'
                                      : isRejected
                                      ? 'bg-rose-400'
                                      : 'bg-emerald-400'
                                  }`}
                                />
                                {isPendingVerification
                                  ? 'Pending Verification'
                                  : isRejected
                                  ? 'Verification Rejected — Retry Available'
                                  : 'Proof Required'}
                              </span>
                            </div>
                          </div>

                          {/* If status is REJECTED: Show warning & reason, and encourage retry */}
                          {isRejected && (
                            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-[12px] flex items-start gap-2.5">
                              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <p className="font-bold text-rose-200">Payment Proof Rejected by Admin</p>
                                <p className="text-rose-300/90">
                                  {order.verificationNotes || 'Your previous screenshot could not be verified. Please select and upload a valid screenshot of your successful UPI payment to retry verification.'}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* If status is PENDING_VERIFICATION: Display uploaded screenshot proof preview and lock upload controls */}
                          {isPendingVerification && (
                            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-white/10 text-[12px] space-y-3">
                              <div className="flex items-center gap-2 text-amber-300 font-semibold">
                                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                                <span>Proof Uploaded — Awaiting Admin Verification</span>
                              </div>
                              <div className="p-2.5 rounded-lg bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                <span>Payment proof submitted successfully. Please wait for admin verification.</span>
                              </div>
                              <p className="text-slate-300 text-[11px] leading-relaxed">
                                Your screenshot is under review by our admin team. Only one upload is permitted per order. Once confirmed in MySQL, your Order Handover OTP will be issued automatically.
                              </p>
                              {order.screenshotUrl && (
                                <div className="pt-1 flex flex-col items-center">
                                  <div className="text-[11px] font-semibold text-slate-300 mb-1.5 self-start flex items-center gap-1.5">
                                    <Eye className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Current Uploaded Proof:</span>
                                  </div>
                                  <div className="p-2 bg-black/60 rounded-xl border border-white/10 shadow-md flex items-center justify-center max-w-full">
                                    <img
                                      src={`${order.screenshotUrl}${currentUser?.token ? `?token=${encodeURIComponent(currentUser.token)}` : ''}`}
                                      alt="Current Uploaded Payment Proof"
                                      className="max-h-48 max-w-full rounded-lg object-contain"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Screenshot Selection and Upload Form: Shown ONLY when NOT pending verification (e.g. if rejected or awaiting first upload) */}
                          {!isPendingVerification && (
                            <div className="space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <label
                                    htmlFor={`screenshot-input-${order.id.replace('#', '')}`}
                                    className="px-3.5 py-2 rounded-xl bg-slate-800/80 border border-white/15 hover:border-emerald-400 hover:bg-slate-800 text-slate-200 text-[12px] font-semibold flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
                                  >
                                    <ImageIcon className="w-4 h-4 text-emerald-400" />
                                    <span>
                                      {fileSelected
                                        ? 'Change File'
                                        : isRejected
                                        ? 'Select Replacement Screenshot'
                                        : 'Select Screenshot'}
                                    </span>
                                  </label>
                                  <input
                                    type="file"
                                    id={`screenshot-input-${order.id.replace('#', '')}`}
                                    accept="image/jpeg,image/png,image/jpg"
                                    onChange={(e) => handleFileSelect(order.id, e)}
                                    disabled={isUploading}
                                    className="hidden"
                                  />
                                  <span className="text-[11px] text-slate-400">
                                    JPG, JPEG, or PNG up to 10 MB
                                  </span>
                                </div>

                                {fileSelected && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleClearSelectedFile(order.id)}
                                      disabled={isUploading}
                                      className="px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      id={`upload-screenshot-btn-${order.id.replace('#', '')}`}
                                      onClick={() => handleSubmitScreenshot(order)}
                                      disabled={isUploading}
                                      className="px-4 py-1.5 rounded-xl bg-[#006b2c] hover:bg-[#00873a] text-white text-[12px] font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                      {isUploading ? (
                                        <>
                                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                          <span>Uploading...</span>
                                        </>
                                      ) : (
                                        <>
                                          <Upload className="w-3.5 h-3.5" />
                                          <span>
                                            {isRejected ? 'Upload Replacement Proof' : 'Upload Screenshot'}
                                          </span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Selected File Details & Preview */}
                              {fileSelected && previewUrl && (
                                <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10 flex flex-col sm:flex-row items-center gap-3">
                                  <img
                                    src={previewUrl}
                                    alt="Selected Preview"
                                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover border border-white/15 bg-black/40 shadow-xs shrink-0"
                                  />
                                  <div className="flex-1 min-w-0 text-center sm:text-left">
                                    <div className="text-[12px] font-bold text-white truncate">
                                      {fileSelected.name}
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-0.5">
                                      Size: {(fileSelected.size / (1024 * 1024)).toFixed(2)} MB · {fileSelected.type || 'image'}
                                    </div>
                                    <div className="text-[11px] text-emerald-400 font-semibold mt-1">
                                      Ready to upload. Click &ldquo;{isRejected ? 'Upload Replacement Proof' : 'Upload Screenshot'}&rdquo; to submit.
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Feedback messages */}
                          {errorMsg && (
                            <div
                              id={`upload-error-${order.id.replace('#', '')}`}
                              className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-[12px] flex items-center gap-2 animate-in fade-in"
                            >
                              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                              <span className="font-semibold">{errorMsg}</span>
                            </div>
                          )}

                          {successMsg && (
                            <div
                              id={`upload-success-${order.id.replace('#', '')}`}
                              className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-[12px] flex items-center gap-2 animate-in fade-in"
                            >
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span className="font-semibold">{successMsg}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Dedicated Delivery OTP Card (Only for verified online payments, removed once Delivered, never for COD) */}
                    {!isDelivered &&
                      !isCod &&
                      ((order.paymentStatus?.toUpperCase() === 'PAID' ||
                        order.paymentStatus?.toUpperCase() === 'COMPLETED') &&
                        Boolean(customerOrderOtps[order.id]?.otp)) && (() => {
                      const cleanOrderId = order.id.replace('#', '');
                      const displayOrderId = order.id.startsWith('#') ? order.id : `#${order.id}`;
                      const isPaid =
                        order.paymentStatus?.toUpperCase() === 'PAID' ||
                        order.paymentStatus?.toUpperCase() === 'COMPLETED';
                      const otpData = customerOrderOtps[order.id];
                      const otpDigits = (otpData?.otp || '').slice(0, 6).split('');

                      return (
                        <div
                          id={`order-delivery-otp-card-${cleanOrderId}`}
                          className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#064e3b]/35 via-black/85 to-[#064e3b]/25 border-2 border-emerald-500/60 shadow-[0_12px_40px_rgba(0,107,44,0.35)] text-center space-y-4 relative overflow-hidden backdrop-blur-2xl animate-in fade-in duration-200"
                        >
                          {/* Subtle ambient liquid-glass glowing circles */}
                          <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 bg-emerald-500/15 rounded-full blur-2xl" />
                          <div className="pointer-events-none absolute -bottom-16 -left-16 w-48 h-48 bg-emerald-500/15 rounded-full blur-2xl" />

                          {/* Header row: Order ID, Payment Verified, Payment Status */}
                          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-emerald-500/20">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                              </div>
                              <div className="text-left">
                                <span className="text-[14px] font-bold text-white tracking-wide font-display flex items-center gap-1.5">
                                  <span>Delivery OTP</span>
                                </span>
                                <span className="text-[11px] font-mono text-emerald-300/80">
                                  Order {displayOrderId}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {isPaid && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 shadow-xs">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Payment Verified</span>
                                </span>
                              )}
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold border font-mono shadow-xs ${
                                  isPaid
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                                    : 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                <span>Payment: {isPaid ? 'COMPLETED' : order.paymentStatus || 'COD'}</span>
                              </span>
                            </div>
                          </div>

                          {/* OTP Content Area */}
                          <div className="relative z-10 space-y-3">
                            {otpData?.loading ? (
                              <div className="py-6 flex flex-col items-center justify-center gap-2 text-emerald-300/80 text-[13px]">
                                <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                                <span>Generating secure 6-digit delivery OTP...</span>
                              </div>
                            ) : otpData?.otp ? (
                              <div className="space-y-3">
                                {/* Six Separate Numeric Boxes */}
                                <div
                                  id={`customer-order-otp-${cleanOrderId}`}
                                  className="flex items-center justify-center gap-2 sm:gap-3 py-1"
                                >
                                  {otpDigits.map((digit, idx) => (
                                    <div
                                      key={idx}
                                      id={`customer-otp-digit-${cleanOrderId}-${idx}`}
                                      className="w-11 h-14 sm:w-13 sm:h-16 rounded-xl bg-black/75 border-2 border-emerald-500/70 shadow-[0_0_18px_rgba(16,185,129,0.3),inset_0_2px_4px_rgba(0,0,0,0.8)] flex items-center justify-center text-[26px] sm:text-[32px] font-black font-mono text-emerald-400 select-all transition-all duration-150 hover:border-emerald-400 hover:shadow-[0_0_24px_rgba(16,185,129,0.45)]"
                                    >
                                      {digit}
                                    </div>
                                  ))}
                                </div>

                                <p className="text-[12.5px] text-emerald-200/90 font-medium max-w-md mx-auto leading-relaxed">
                                  Your six-digit OTP is ready. Share this code with the delivery team to confirm delivery.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-3 py-2">
                                <div className="text-[12px] font-semibold text-rose-300 flex items-center justify-center gap-1.5">
                                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                                  <span>
                                    {otpData?.isExpired
                                      ? 'OTP expired. Please request the store administrator or delivery agent to issue a fresh OTP.'
                                      : otpData?.error || 'Failed to load Order Handover OTP.'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    id={`customer-retry-otp-btn-${cleanOrderId}`}
                                    onClick={() => handleFetchOtp(order.id)}
                                    disabled={otpData?.loading}
                                    className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/20 text-[12px] font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                                  >
                                    Retry Loading
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Multi-step Live Tracking Progress Bar */}
                    {(() => {
                      const hasOtp = !isDelivered && !isCod && Boolean(customerOrderOtps[order.id]?.otp);

                      return (
                        <div className="bg-[#f8fafc] p-4 rounded-xl border border-[#e2e8f0] space-y-4">
                          <div className="flex items-center justify-between text-[12px] font-semibold text-[#0b1c30]">
                            <span>Fulfillment Timeline</span>
                            <span className="text-[#006b2c] text-[11px]">
                              {isDelivered
                                ? (isCod ? 'Delivered' : 'Delivered & OTP Verified')
                                : hasOtp
                                ? 'OTP Generated & Ready'
                                : 'Order Processing'}
                            </span>
                          </div>

                          {/* Step Progress Line */}
                          <div className="relative flex items-center justify-between">
                            <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-1 bg-[#e2e8f0] -z-0">
                              <div
                                className={`h-full bg-[#006b2c] transition-all duration-500 ${
                                  isDelivered ? 'w-full' : hasOtp ? 'w-1/2' : 'w-1/4'
                                }`}
                              />
                            </div>

                            {/* Step 1: Confirmed */}
                            <div className="relative z-10 flex flex-col items-center bg-white px-1">
                              <div className="w-7 h-7 rounded-full bg-[#006b2c] text-white flex items-center justify-center text-[11px] font-bold shadow-xs">
                                ✓
                              </div>
                              <span className="text-[11px] font-semibold text-[#0b1c30] mt-1">Confirmed</span>
                            </div>

                            {/* Step 2: OTP Generated */}
                            <div className="relative z-10 flex flex-col items-center bg-white px-1">
                              <div
                                className={`w-7 h-7 rounded-full text-white flex items-center justify-center text-[11px] font-bold shadow-xs ${
                                  hasOtp || isDelivered
                                    ? 'bg-[#006b2c] ring-4 ring-[#dcfce7]'
                                    : 'bg-[#e2e8f0] text-[#565e74]'
                                }`}
                              >
                                {hasOtp || isDelivered ? '✓' : '2'}
                              </div>
                              <span
                                className={`text-[11px] mt-1 ${
                                  hasOtp || isDelivered ? 'font-bold text-[#006b2c]' : 'text-[#565e74]'
                                }`}
                              >
                                OTP Generated
                              </span>
                            </div>

                            {/* Step 3: Out for Delivery */}
                            <div className="relative z-10 flex flex-col items-center bg-white px-1">
                              <div
                                className={`w-7 h-7 rounded-full text-white flex items-center justify-center text-[11px] font-bold shadow-xs ${
                                  isDelivered
                                    ? 'bg-[#006b2c]'
                                    : hasOtp
                                    ? 'bg-[#006b2c] ring-2 ring-[#dcfce7]'
                                    : 'bg-[#e2e8f0] text-[#565e74]'
                                }`}
                              >
                                {isDelivered ? '✓' : '3'}
                              </div>
                              <span
                                className={`text-[11px] mt-1 ${
                                  isDelivered || hasOtp ? 'font-semibold text-[#0b1c30]' : 'text-[#565e74]'
                                }`}
                              >
                                Out for Delivery
                              </span>
                            </div>

                            {/* Step 4: OTP Verified & Delivered */}
                            <div className="relative z-10 flex flex-col items-center bg-white px-1">
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${
                                  isDelivered ? 'bg-[#006b2c] text-white shadow-xs' : 'bg-[#e2e8f0] text-[#565e74]'
                                }`}
                              >
                                {isDelivered ? '✓' : '4'}
                              </div>
                              <span
                                className={`text-[11px] mt-1 ${
                                  isDelivered ? 'font-bold text-[#006b2c]' : 'text-[#565e74]'
                                }`}
                              >
                                Delivered
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Delivery Destination & Items summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[12px]">
                      <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-1">
                        <div className="font-semibold text-[#0b1c30] flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#006b2c]" />
                          Destination Address
                        </div>
                        <p className="text-[#565e74]">{order.deliveryAddress}</p>
                      </div>

                      <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-1">
                        <div className="font-semibold text-[#0b1c30] flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-[#006b2c]" />
                          Payment &amp; Dispatch
                        </div>
                        <p className="text-[#565e74]">
                          {order.paymentMethod || 'Express Checkout'} · Direct EV Runner
                        </p>
                      </div>
                    </div>

                    {/* Order Item Pills */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-[#565e74] uppercase tracking-wider">
                        Packed Goods
                      </span>
                      <div className="divide-y divide-[#f1f5f9]">
                        {order.items.map((it) => (
                          <div
                            key={it.product.id}
                            className="py-2 flex items-center justify-between text-[13px]"
                          >
                            <div className="flex items-center gap-3">
                              <img
                                src={it.product.image}
                                alt={it.product.title}
                                className="w-10 h-10 rounded-lg object-cover bg-slate-50 border border-[#e2e8f0]"
                              />
                              <div>
                                <div className="font-semibold text-[#0b1c30]">{it.product.title}</div>
                                <div className="text-[11px] text-[#565e74]">
                                  Qty: {it.quantity} {it.quantity === 1 ? 'pack' : 'packs'} ({it.product.unit}) · {formatINR(it.product.price)} / {it.product.unit}
                                </div>
                              </div>
                            </div>
                            <span className="font-semibold text-[#0b1c30]">
                              {formatINR(it.product.price * it.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            </div>
          )}

          {/* TAB: ORDER HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-[20px] font-bold text-[#0b1c30] font-display">
                  Order History
                </h2>
                <p className="text-[13px] text-[#565e74]">
                  Past delivered groceries and seasonal harvests with 1-click reorder
                </p>
              </div>

              {pastOrders.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#e2e8f0] p-10 text-center text-[#565e74]">
                  {t('noPastOrders')}
                </div>
              ) : (
                pastOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl border border-[#e2e8f0] p-5 sm:p-6 shadow-xs space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#e5eeff]">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[16px] font-bold text-[#0b1c30] font-display">
                            Order #{order.id}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[#475569] text-[11px] font-bold">
                            ✓ {getStatusLabel(order.status)}
                          </span>
                        </div>
                        <div className="text-[12px] text-[#565e74] mt-0.5">
                          Delivered on {new Date(order.createdAt).toLocaleDateString()} · {order.deliveryTimeSlot}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-[15px] font-bold text-[#006b2c] font-display">
                            {formatINR(order.total)}
                          </div>
                          <div className="text-[11px] text-[#565e74]">
                            {order.items.length} items
                          </div>
                        </div>

                        {/* 1-Click Reorder Button */}
                        <button
                          type="button"
                          onClick={() => handleReorderItems(order.items, order.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#eff4ff] hover:bg-[#dce9ff] text-[#006b2c] text-[12px] font-bold transition-all border border-[#d3e4fe] cursor-pointer"
                          title="Add all items from this order into your current cart"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-[#006b2c]" />
                          <span>{t('reorderItems')}</span>
                        </button>
                      </div>
                    </div>

                    {/* Items Accordion / Summary */}
                    <div className="divide-y divide-[#f1f5f9]">
                      {order.items.map((it) => (
                        <div
                          key={it.product.id}
                          className="py-2 flex items-center justify-between text-[12px]"
                        >
                          <div className="flex items-center gap-2.5">
                            <img
                              src={it.product.image}
                              alt={it.product.title}
                              className="w-8 h-8 rounded-lg object-cover bg-slate-50 border border-[#e2e8f0]"
                            />
                            <span className="font-medium text-[#0b1c30]">
                              {it.quantity}x {it.product.title}
                            </span>
                          </div>
                          <span className="font-semibold text-[#0b1c30]">
                            {formatINR(it.product.price * it.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB: CART OVERVIEW */}
          {activeTab === 'cart' && (
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#e5eeff]">
                <div>
                  <h2 className="text-[20px] font-bold text-[#0b1c30] font-display">
                    Active Shopping Cart
                  </h2>
                  <p className="text-[13px] text-[#565e74]">
                    Review items queued for your next 30-minute delivery
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenCart}
                  className="px-3 py-1.5 bg-[#eff4ff] text-[#006b2c] rounded-xl text-[12px] font-semibold border border-[#d3e4fe] hover:bg-[#dce9ff] cursor-pointer"
                >
                  Open Full Cart Drawer →
                </button>
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <ShoppingCart className="w-12 h-12 text-[#94a3b8] mx-auto" />
                  <h3 className="text-[16px] font-bold text-[#0b1c30]">{t('emptyCartTitle')}</h3>
                  <p className="text-[13px] text-[#565e74]">
                    {t('emptyCartDesc')}
                  </p>
                  <button
                    type="button"
                    onClick={onBackToStorefront}
                    className="mt-2 px-4 py-2 bg-[#006b2c] text-white text-[13px] font-semibold rounded-xl hover:bg-[#00873a] transition-colors cursor-pointer"
                  >
                    {t('startShopping')}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="divide-y divide-[#e2e8f0]">
                    {cart.map((item) => (
                      <div
                        key={item.product.id}
                        className="py-3 flex items-center justify-between text-[13px]"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={item.product.image}
                            alt={item.product.title}
                            className="w-12 h-12 rounded-xl object-cover border border-[#e2e8f0]"
                          />
                          <div>
                            <div className="font-bold text-[#0b1c30]">{item.product.title}</div>
                            <div className="text-[11px] text-[#565e74]">
                              {formatINR(item.product.price)} / {item.product.unit}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {onUpdateQty && (
                            <div className="flex items-center bg-[#eff4ff] rounded-lg border border-[#e2e8f0]">
                              <button
                                type="button"
                                title="Decrease quantity (removes at 0)"
                                onClick={() => onUpdateQty(item.product.id, -1)}
                                className="w-6 h-6 flex items-center justify-center text-[#0b1c30] hover:bg-[#e5eeff] rounded-l-lg transition-colors cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-6 text-center text-[11px] font-semibold tabular-nums">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                title="Increase quantity"
                                disabled={item.quantity >= item.product.stock}
                                onClick={() => onUpdateQty(item.product.id, 1)}
                                className="w-6 h-6 flex items-center justify-center text-[#0b1c30] hover:bg-[#e5eeff] rounded-r-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          <div className="text-right min-w-[70px]">
                            <div className="font-bold text-[#0b1c30] font-display">
                              {formatINR(item.product.price * item.quantity)}
                            </div>
                            <div className="text-[11px] text-[#565e74]">
                              Qty: {item.quantity} {item.quantity === 1 ? 'pack' : 'packs'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary & Checkout CTA */}
                  <div className="pt-4 border-t border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-[12px] text-[#565e74]">Subtotal ({cartItemCount} items)</span>
                      <div className="text-[22px] font-extrabold text-[#006b2c] font-display">
                        {formatINR(cartTotal)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={onOpenCheckout}
                      className="px-6 py-3 rounded-xl bg-[#006b2c] text-white font-bold text-[14px] hover:bg-[#00873a] transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Proceed to Express Checkout</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: PROFILE INFORMATION */}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#e5eeff]">
                <div>
                  <h2 className="text-[20px] font-bold text-[#0b1c30] font-display">
                    Profile Information
                  </h2>
                  <p className="text-[13px] text-[#565e74]">
                    Manage your personal details, contact information, and account preferences
                  </p>
                </div>
                {!isEditingProfile && (
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#cbd5e1] text-[#0b1c30] hover:bg-[#f8fafc] text-[12px] font-semibold transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#006b2c]" />
                    <span>{t('editProfile')}</span>
                  </button>
                )}
              </div>

              {isEditingProfile ? (
                <form onSubmit={handleSaveProfile} className="space-y-4 max-w-lg">
                  <div className="space-y-1">
                    <label className="text-[12px] font-semibold text-[#0b1c30]">Full Name</label>
                    <input
                      type="text"
                      required
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#cbd5e1] text-[13px] bg-[#f8f9ff] focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-[#006b2c]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[12px] font-semibold text-[#0b1c30]">Email / User ID</label>
                    <input
                      type="email"
                      disabled
                      value={currentUser.email}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#e2e8f0] text-[13px] bg-[#f1f5f9] text-[#64748b] cursor-not-allowed"
                    />
                    <span className="text-[10px] text-[#94a3b8]">Email cannot be changed directly</span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[12px] font-semibold text-[#0b1c30]">Phone Number</label>
                    <input
                      type="tel"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#cbd5e1] text-[13px] bg-[#f8f9ff] focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-[#006b2c]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[12px] font-semibold text-[#0b1c30]">Primary Street Address</label>
                    <input
                      type="text"
                      value={profileAddress}
                      onChange={(e) => setProfileAddress(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#cbd5e1] text-[13px] bg-[#f8f9ff] focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-[#006b2c]"
                    />
                  </div>

                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-[#006b2c] hover:bg-[#00873a] text-white text-[13px] font-semibold transition-colors cursor-pointer"
                    >
                      {t('saveChanges')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="px-4 py-2.5 rounded-xl text-[#565e74] hover:bg-[#f1f5f9] text-[13px] font-medium transition-colors cursor-pointer"
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-1">
                    <span className="text-[11px] font-bold text-[#565e74] uppercase tracking-wider">
                      Customer Name
                    </span>
                    <div className="text-[15px] font-bold text-[#0b1c30]">{currentUser.name}</div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-1">
                    <span className="text-[11px] font-bold text-[#565e74] uppercase tracking-wider">
                      Email Address
                    </span>
                    <div className="text-[15px] font-bold text-[#0b1c30]">{currentUser.email}</div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-1">
                    <span className="text-[11px] font-bold text-[#565e74] uppercase tracking-wider">
                      Phone Number
                    </span>
                    <div className="text-[15px] font-bold text-[#0b1c30]">
                      {currentUser.phone || 'No phone provided'}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-1">
                    <span className="text-[11px] font-bold text-[#565e74] uppercase tracking-wider">
                      Default Delivery Location
                    </span>
                    <div className="text-[14px] font-bold text-[#0b1c30]">
                      {currentUser.address || 'Standard Address on File'}
                    </div>
                  </div>
                </div>
              )}

              {/* Password & Security Panel */}
              <div className="pt-6 border-t border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-[14px] font-bold text-[#0b1c30]">Password &amp; Security</h4>
                  <p className="text-[12px] text-[#565e74]">
                    Password cryptographically salted &amp; hashed via Web Crypto SHA-256
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#006b2c] bg-[#eff4ff] px-3 py-1.5 rounded-xl border border-[#d3e4fe]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Secure Hashing Active</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB: SAVED ADDRESSES */}
          {activeTab === 'addresses' && (
            <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#e5eeff]">
                <div>
                  <h2 className="text-[20px] font-bold text-[#0b1c30] font-display">
                    {t('savedAddressesHeading')}
                  </h2>
                  <p className="text-[13px] text-[#565e74]">
                    Fast 30-min destination addresses for homes, apartments, and offices
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddAddressModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#006b2c] hover:bg-[#00873a] text-white text-[12px] font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('addNewAddress')}</span>
                </button>
              </div>

              {/* Addresses List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(currentUser.savedAddresses || []).map((addr) => (
                  <div
                    key={addr.id}
                    className={`p-4 rounded-xl border transition-all ${
                      addr.isDefault
                        ? 'border-[#006b2c] bg-[#eff4ff]/40 ring-1 ring-[#006b2c]/30'
                        : 'border-[#e2e8f0] bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#006b2c]" />
                        <span className="text-[13px] font-bold text-[#0b1c30]">
                          {addr.label}
                        </span>
                        {addr.isDefault && (
                          <span className="px-2 py-0.5 rounded-full bg-[#006b2c] text-white text-[10px] font-bold">
                            {t('defaultAddressBadge')}
                          </span>
                        )}
                      </div>
                      {(currentUser.savedAddresses || []).length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAddress(addr.id)}
                          className="text-[#94a3b8] hover:text-[#dc2626] transition-colors p-1 cursor-pointer"
                          title="Remove address"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="mt-2 text-[13px] text-[#565e74] leading-relaxed">
                      <div>{addr.street}</div>
                      <div>{addr.city}, {addr.state} {addr.zip}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Address Modal */}
              {showAddAddressModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1c30]/50 backdrop-blur-xs">
                  <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-[#e2e8f0] space-y-4">
                    <h3 className="text-[18px] font-bold text-[#0b1c30] font-display">
                      Add New Delivery Address
                    </h3>
                    <form onSubmit={handleCreateAddress} className="space-y-3">
                      <div>
                        <label className="text-[12px] font-semibold text-[#0b1c30]">Label</label>
                        <input
                          type="text"
                          required
                          value={newAddrLabel}
                          onChange={(e) => setNewAddrLabel(e.target.value)}
                          placeholder="e.g. Vacation Home, Studio"
                          className="w-full px-3 py-2 text-[13px] border border-[#cbd5e1] rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-[12px] font-semibold text-[#0b1c30]">Street Address</label>
                        <input
                          type="text"
                          required
                          value={newAddrStreet}
                          onChange={(e) => setNewAddrStreet(e.target.value)}
                          placeholder="Flat, House no., Building, Street"
                          className="w-full px-3 py-2 text-[13px] border border-[#cbd5e1] rounded-lg"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[12px] font-semibold text-[#0b1c30]">City</label>
                          <input
                            type="text"
                            required
                            value={newAddrCity}
                            onChange={(e) => setNewAddrCity(e.target.value)}
                            placeholder="City"
                            className="w-full px-3 py-2 text-[13px] border border-[#cbd5e1] rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="text-[12px] font-semibold text-[#0b1c30]">State</label>
                          <input
                            type="text"
                            required
                            value={newAddrState}
                            onChange={(e) => setNewAddrState(e.target.value)}
                            placeholder="State"
                            className="w-full px-3 py-2 text-[13px] border border-[#cbd5e1] rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="text-[12px] font-semibold text-[#0b1c30]">PIN / ZIP</label>
                          <input
                            type="text"
                            required
                            value={newAddrZip}
                            onChange={(e) => setNewAddrZip(e.target.value)}
                            placeholder="PIN / ZIP"
                            className="w-full px-3 py-2 text-[13px] border border-[#cbd5e1] rounded-lg"
                          />
                        </div>
                      </div>
                      <div className="pt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAddAddressModal(false)}
                          className="px-4 py-2 text-[13px] font-medium text-[#565e74] hover:bg-[#f1f5f9] rounded-lg cursor-pointer"
                        >
                          {t('cancel')}
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 rounded-lg bg-[#006b2c] hover:bg-[#00873a] text-white text-[13px] font-semibold cursor-pointer"
                        >
                          {t('saveAddressBtn')}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
