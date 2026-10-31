import React, { useState, useRef, useEffect } from 'react';
import { ViewType } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSelector } from './LanguageSelector';
import {
  AISLE_CATEGORIES,
} from '../data/products';
import {
  Search,
  ShieldCheck,
  ShoppingCart,
  Store,
  X,
  ChevronDown,
  User,
  LogOut,
  Truck,
} from 'lucide-react';
import { AuthorizedEmployee } from '../services/employeeService';
import { AuthorizedAdmin } from '../services/adminService';

interface HeaderProps {
  currentView: ViewType;
  isAdminSignIn?: boolean;
  onToggleView: (view: ViewType) => void;
  cartCount: number;
  onOpenCart: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit?: (query: string) => void;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  currentEmployee?: AuthorizedEmployee | null;
  onEmployeeLogout?: () => void;
  currentAdmin?: AuthorizedAdmin | null;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  isAdminSignIn,
  onToggleView,
  cartCount,
  onOpenCart,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  selectedCategory,
  onSelectCategory,
  currentEmployee,
  onEmployeeLogout,
  currentAdmin,
}) => {
  const { currentUser, logout } = useAuth();
  const { t } = useLanguage();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showUserMenu]);

  const getViewBadgeLabel = () => {
    switch (currentView) {
      case 'storefront':
        return t('navRetailStorefront');
      case 'admin':
        return t('navOpsPortal');
      case 'employee':
        return 'Employee Portal';
      case 'dashboard':
        return t('navCustomerPortal');
      case 'login':
        return t('navSignIn');
      case 'register':
        return t('navNewAccount');
      case 'search':
        return 'Search Results';
      case 'category':
        return 'Category Catalog';
      case 'cart':
        return t('cart') || 'Shopping Cart';
      case 'checkout':
        return 'Checkout & Payment';
      default:
        return t('navRetailStorefront');
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearchSubmit) {
      onSearchSubmit(searchQuery);
    }
  };

  const getCategoryName = (catId: string, fallback: string) => {
    switch (catId) {
      case 'produce': return t('catProduce');
      case 'dairy': return t('catDairy');
      case 'bakery': return t('catBakery');
      case 'beverages': return t('catBeverages');
      case 'snacks': return t('catSnacks');
      case 'grains': return t('catGrains');
      default: return fallback;
    }
  };

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-transparent border-b border-white/10 transition-all">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-2.5 flex flex-col justify-between">
        {/* Top Tier */}
        <div className="flex items-center justify-between gap-3 sm:gap-6">
          {/* Brand Logo & View Tag */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => onToggleView('storefront')}
              className="flex items-center text-left focus:outline-hidden group cursor-pointer"
              id="brand-logo-btn"
            >
              <span className="text-[20px] font-extrabold tracking-tight text-[#006b2c] font-display">
                FreshCart
              </span>
            </button>
            {currentView !== 'dashboard' && (
              <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-white/35 backdrop-blur-xs text-[#565e74] text-[11px] font-semibold tracking-wide border border-white/50">
                {getViewBadgeLabel()}
              </span>
            )}
          </div>



          {/* Search Box / Tagline (Hidden on Admin Portal) */}
          {currentView !== 'admin' && (
            <div className="flex-1 max-w-xl mx-1 sm:mx-3">
              {currentView === 'login' || currentView === 'register' || isAdminSignIn ? (
                <div className="text-center hidden md:block">
                  <span className="text-[12px] font-medium text-[#565e74]">
                    {t('tagline')}
                  </span>
                </div>
              ) : (
                <form onSubmit={handleFormSubmit} className="relative flex items-center w-full">
                  <Search className="absolute left-3 w-4 h-4 text-[#6e7b6c] pointer-events-none" />
                  <input
                    id="global-search-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={t('searchPlaceholder')}
                    className="w-full pl-9 pr-24 py-2 rounded-xl bg-white/35 backdrop-blur-md font-body text-[13px] text-[#0b1c30] placeholder:text-[#565e74]/70 focus:bg-white/60 focus:outline-hidden focus:ring-2 focus:ring-[#006b2c] shadow-2xs border border-white/55 hover:border-white/80 transition-all"
                  />
                  <div className="absolute right-1.5 flex items-center gap-1.5">
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => onSearchChange('')}
                        className="p-1 text-[#6e7b6c] hover:text-[#0b1c30] cursor-pointer transition-colors"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="submit"
                      id="header-search-find-btn"
                      className="px-2.5 py-1 rounded-lg bg-[#006b2c] text-white text-[12px] font-semibold hover:bg-[#00873a] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs hover:brightness-105 active:translate-y-0 active:scale-98 cursor-pointer shadow-2xs"
                    >
                      {t('find')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Customer Portal Language Selector (Only shown after customer successfully logs in) */}
            {currentUser && currentView !== 'login' && currentView !== 'register' && currentView !== 'admin' && (
              <LanguageSelector variant="light" compact={true} idPrefix="header-lang" />
            )}

            {/* Toggle between Storefront/Login & Admin Portal (Hidden for logged-in customers and on Customer Dashboard) */}
            {((currentAdmin && (currentView === 'admin' || currentView === 'storefront')) || (!currentUser && currentView !== 'dashboard')) && (
              <button
                id="toggle-admin-portal-btn"
                type="button"
                data-path="dashboard-overview"
                onClick={() =>
                  onToggleView(
                    currentView === 'admin'
                      ? currentUser
                        ? 'storefront'
                        : 'login'
                      : 'admin'
                  )
                }
                className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs active:translate-y-0 active:scale-98 border cursor-pointer ${
                  currentView === 'admin'
                    ? 'bg-[#006b2c] text-white border-[#006b2c] shadow-xs'
                    : 'bg-white/35 backdrop-blur-xs text-[#131b2e] border-white/50 hover:bg-white/55'
                }`}
              >
                {currentView === 'admin' ? (
                  <>
                    <Store className="w-4 h-4" />
                    <span>{currentUser ? t('navRetailStorefront') : t('navSignIn')}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{t('navAdminPortal')}</span>
                  </>
                )}
              </button>
            )}

            {/* Employee Portal Toggle */}
            {currentEmployee && (
              <button
                id="header-employee-portal-btn"
                type="button"
                onClick={() =>
                  onToggleView(currentView === 'employee' ? 'storefront' : 'employee')
                }
                className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs active:translate-y-0 active:scale-98 border cursor-pointer ${
                  currentView === 'employee'
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-white/35 backdrop-blur-xs text-[#131b2e] border-white/50 hover:bg-white/55'
                }`}
              >
                {currentView === 'employee' ? (
                  <>
                    <Store className="w-4 h-4" />
                    <span>{t('navRetailStorefront')}</span>
                  </>
                ) : (
                  <>
                    <Truck className="w-4 h-4 text-[#006b2c]" />
                    <span>Employee Portal</span>
                  </>
                )}
              </button>
            )}

            {/* Cart Button (Navigates to dedicated Cart page; completely removed from Admin Portal) */}
            {currentView !== 'login' && currentView !== 'register' && currentView !== 'admin' && (
              <button
                id="header-cart-btn"
                type="button"
                onClick={onOpenCart}
                aria-label={t('cart')}
                title={t('cart')}
                className={`relative flex items-center justify-center px-3 py-1.5 rounded-xl text-white shadow-xs cursor-pointer cart-icon-glow transition-all ${
                  currentView === 'cart'
                    ? 'bg-[#00873a] ring-2 ring-white/50'
                    : 'bg-[#006b2c] hover:bg-[#00873a]'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                {cartCount > 0 && (
                  <span
                    id="header-cart-count-badge"
                    className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-[#ba1a1a] text-white rounded-full text-[10px] font-bold ring-2 ring-[#030305]"
                  >
                    {cartCount}
                  </span>
                )}
              </button>
            )}

            {/* Customer Account / Sign In / Register */}
            {currentUser ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  id="customer-profile-menu-btn"
                  aria-haspopup="true"
                  aria-expanded={showUserMenu}
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl bg-white/35 hover:bg-white/60 backdrop-blur-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs border border-white/50 hover:border-white/80 cursor-pointer"
                >
                  <img
                    src={
                      currentUser.avatarUrl ||
                      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser.name)}&backgroundColor=006b2c`
                    }
                    alt={currentUser.name}
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-[#006b2c]/40"
                  />
                  <div className="hidden lg:flex flex-col text-left">
                    <span className="text-[12px] font-bold text-[#0b1c30] leading-tight max-w-[110px] truncate">
                      {currentUser.name}
                    </span>
                    <span className="text-[10px] text-[#006b2c] font-semibold leading-tight">
                      {t('myDashboard')}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-[#565e74] transition-transform duration-200 ${
                      showUserMenu ? 'rotate-180 text-[#006b2c]' : ''
                    }`}
                  />
                </button>

                {showUserMenu && (
                  <div
                    id="customer-profile-dropdown-menu"
                    data-dropdown-menu="true"
                    className="freshcart-dropdown-menu absolute right-0 top-full mt-2 w-64 p-2 z-50 animate-in fade-in zoom-in-95 duration-150 max-w-[calc(100vw-2rem)]"
                    style={{
                      backgroundColor: 'rgba(3, 7, 12, 0.96)',
                      WebkitBackdropFilter: 'blur(16px)',
                      backdropFilter: 'blur(16px)',
                    }}
                  >
                    <div className="px-3 py-2.5 border-b freshcart-dropdown-divider mb-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-[#10b981] px-2 py-0.5 rounded-full border border-emerald-500/30">
                          {currentUser.loyaltyTier || 'Verified Customer'}
                        </span>
                      </div>
                      <p className="text-[13px] font-bold text-white truncate">{currentUser.name}</p>
                      <p className="text-[11px] text-[#94a3b8] truncate">{currentUser.email}</p>
                    </div>

                    <div className="space-y-1">
                      <button
                        type="button"
                        id="menu-dashboard-link"
                        onClick={() => {
                          setShowUserMenu(false);
                          onToggleView('dashboard');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-[12px] flex items-center justify-between transition-all duration-150 cursor-pointer ${
                          currentView === 'dashboard'
                            ? 'freshcart-dropdown-item-active'
                            : 'freshcart-dropdown-item'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <User
                            className={`w-4 h-4 ${
                              currentView === 'dashboard' ? 'text-[#10b981]' : 'text-[#34d399]'
                            }`}
                          />
                          <span
                            className={
                              currentView === 'dashboard'
                                ? 'text-[#10b981] font-semibold'
                                : 'text-slate-100'
                            }
                          >
                            {t('navCustomerPortal')}
                          </span>
                        </div>
                        {currentView === 'dashboard' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] shadow-[0_0_6px_#10b981]" />
                        )}
                      </button>

                      <button
                        type="button"
                        id="menu-orders-link"
                        onClick={() => {
                          setShowUserMenu(false);
                          onToggleView('dashboard');
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-[12px] freshcart-dropdown-item flex items-center justify-between transition-all duration-150 cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Truck className="w-4 h-4 text-[#34d399]" />
                          <span className="text-slate-100">{t('myOrdersTracking')}</span>
                        </div>
                      </button>

                      {currentView !== 'storefront' && (
                        <button
                          type="button"
                          id="menu-storefront-link"
                          onClick={() => {
                            setShowUserMenu(false);
                            onToggleView('storefront');
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-[12px] freshcart-dropdown-item flex items-center justify-between transition-all duration-150 cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <Store className="w-4 h-4 text-[#34d399]" />
                            <span className="text-slate-100">{t('navRetailStorefront')}</span>
                          </div>
                        </button>
                      )}
                    </div>

                    <div className="border-t freshcart-dropdown-divider mt-1.5 pt-1.5">
                      <button
                        type="button"
                        id="header-logout-btn"
                        onClick={() => {
                          setShowUserMenu(false);
                          logout();
                          onToggleView('login');
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
            ) : currentEmployee ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="header-employee-badge-btn"
                  onClick={() => onToggleView('employee')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/35 backdrop-blur-xs border border-white/50 text-[12px] font-semibold text-[#0b1c30] cursor-pointer hover:bg-white/60"
                  title="Go to Employee Portal"
                >
                  <Truck className="w-4 h-4 text-[#006b2c]" />
                  <span className="max-w-[100px] truncate">{currentEmployee.fullName}</span>
                </button>
                {onEmployeeLogout && (
                  <button
                    type="button"
                    id="header-employee-logout-btn"
                    onClick={onEmployeeLogout}
                    className="p-1.5 rounded-xl bg-white/35 hover:bg-red-50 text-red-600 border border-white/50 cursor-pointer"
                    title="Employee Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : currentView === 'login' ? (
              <button
                type="button"
                id="header-goto-reg-btn"
                onClick={() => onToggleView('register')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#006b2c] text-white hover:bg-[#00873a] text-[12px] font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs hover:brightness-105 active:translate-y-0 active:scale-98 shadow-2xs cursor-pointer"
              >
                <span>{t('navRegister')}</span>
              </button>
            ) : (
              <button
                type="button"
                id="header-login-btn"
                onClick={() => onToggleView('login')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/40 hover:bg-white/70 text-[#006b2c] border border-white/60 hover:border-white text-[12px] font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs active:translate-y-0 active:scale-98 shadow-2xs cursor-pointer"
              >
                <User className="w-4 h-4 text-[#006b2c]" />
                <span>{t('navSignIn')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Secondary Aisles Navigation Bar */}
        {(currentView === 'storefront' || currentView === 'search' || currentView === 'category') && (
          <div className="flex items-center justify-between border-t border-white/50 pt-1.5 mt-2">
            <nav className="flex items-center gap-1.5 overflow-x-auto py-1 w-full text-[12px]">
              <button
                type="button"
                onClick={() => onSelectCategory('all')}
                className={`px-3 py-1 rounded-xl transition-all duration-200 whitespace-nowrap font-medium cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-[#00873a] text-white font-semibold shadow-xs hover:-translate-y-0.5 hover:shadow-sm'
                    : 'text-[#3e4a3d] bg-white/30 hover:bg-white/50 hover:text-[#0b1c30] hover:-translate-y-0.5 border border-white/40 hover:border-white/70 backdrop-blur-xs'
                }`}
              >
                {t('allAisles')}
              </button>
              {AISLE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onSelectCategory(cat.id)}
                  className={`px-3 py-1 rounded-xl transition-all duration-200 whitespace-nowrap font-medium cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-[#00873a] text-white font-semibold shadow-xs hover:-translate-y-0.5 hover:shadow-sm'
                      : 'text-[#3e4a3d] bg-white/30 hover:bg-white/50 hover:text-[#0b1c30] hover:-translate-y-0.5 border border-white/40 hover:border-white/70 backdrop-blur-xs'
                  }`}
                >
                  {getCategoryName(cat.id, cat.name)}
                </button>
              ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

