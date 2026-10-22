import React, { useState, useEffect } from 'react';
import { Product, CartItem, InventoryLog, ViewType, Coupon, CustomerOrder, DeliveryChargeRule } from './types';
import { INITIAL_PRODUCTS, INITIAL_INVENTORY_LOGS } from './data/products';
import { INITIAL_COUPONS } from './data/coupons';
import { AuthProvider, useAuth } from './context/AuthContext';
import { getCustomerOrders, updateOrderStatus, deleteCustomerOrder } from './services/authService';
import { getProductPackSizes } from './utils/packSize';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { getStoredSettings, fetchServerSettings, updateServerSettings } from './services/settingsService';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { CategoryGrid } from './components/CategoryGrid';
import { ProductCard } from './components/ProductCard';
import { CartPage } from './components/CartPage';
import { CheckoutPage } from './components/CheckoutPage';
import { ProductModal } from './components/ProductModal';
import { FloatingCart } from './components/FloatingCart';
import { AdminPortal } from './components/AdminPortal';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import {
  AuthorizedAdmin,
  getStoredAdminUser,
  getStoredAdminToken,
  fetchAdminProfile,
  clearAdminSession,
} from './services/adminService';
import {
  AuthorizedEmployee,
  getStoredEmployeeUser,
  getStoredEmployeeToken,
  fetchEmployeeProfile,
  clearEmployeeSession,
} from './services/employeeService';
import { EmployeePortal } from './components/EmployeePortal';

import { CustomerDashboard } from './components/CustomerDashboard';
import { TrustBanner } from './components/TrustBanner';
import { Footer } from './components/Footer';
import { SearchResultsPage } from './components/SearchResultsPage';
import { CategoryResultsPage } from './components/CategoryResultsPage';
import { CursorReactiveBackground } from './components/CursorReactiveBackground';
import { RefreshCw, Sparkles } from 'lucide-react';
import { createLogTimestamp, formatLogDateTime } from './utils/date';

const STORAGE_PRODUCTS_KEY = 'freshcart_products_inr_v2';
const STORAGE_COUPONS_KEY = 'freshcart_coupons_v1';
const STORAGE_INVENTORY_LOGS_KEY = 'freshcart_inventory_logs_v1';

const LEGACY_UNIT_MAP: Record<string, string> = {
  jug: '500 ml',
  carton: '1 dozen',
  lb: '1 kg',
  kg: '1 kg',
  loaf: '1 piece',
  btl: '1 litre',
  bag: '1 packet',
  tub: '500 g',
  ml: '500 ml',
  litre: '1 litre',
  dozen: '1 dozen',
  packet: '1 packet',
  piece: '1 piece',
  box: '1 box',
};

function FreshCartStore() {
  const { currentUser, isLoading, logout } = useAuth();
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const savedV2 = localStorage.getItem(STORAGE_PRODUCTS_KEY);
      if (savedV2) {
        const parsed: Product[] = JSON.parse(savedV2);
        INITIAL_PRODUCTS.forEach((initP) => {
          if (!parsed.some((p) => p.id === initP.id)) {
            parsed.push(initP);
          }
        });
        return parsed.map((p) => {
          const initMatch = INITIAL_PRODUCTS.find((ip) => ip.id === p.id);
          const packSizes =
            p.packSizes && p.packSizes.length > 0
              ? p.packSizes
              : initMatch?.packSizes && initMatch.packSizes.length > 0
              ? initMatch.packSizes
              : getProductPackSizes(p);
          return { ...p, packSizes };
        });
      }
      const savedV1 = localStorage.getItem('freshcart_products_inr_v1');
      if (savedV1) {
        const parsed: Product[] = JSON.parse(savedV1);
        const migrated = parsed.map((p) => ({
          ...p,
          unit: LEGACY_UNIT_MAP[p.unit] || p.unit,
        }));
        // Ensure new example products (Rice, Sugar, Turmeric) are added if not present
        INITIAL_PRODUCTS.forEach((initP) => {
          if (!migrated.some((m) => m.id === initP.id)) {
            migrated.push(initP);
          }
        });
        return migrated.map((p) => {
          const initMatch = INITIAL_PRODUCTS.find((ip) => ip.id === p.id);
          const packSizes =
            p.packSizes && p.packSizes.length > 0
              ? p.packSizes
              : initMatch?.packSizes && initMatch.packSizes.length > 0
              ? initMatch.packSizes
              : getProductPackSizes(p);
          return { ...p, packSizes };
        });
      }
    } catch {
      // fallback
    }
    return INITIAL_PRODUCTS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(products));
  }, [products]);

  // Default to login when unauthenticated; storefront when authenticated
  const [currentView, setCurrentView] = useState<ViewType>('login');

  // Authorized Admin Authentication & Session State
  const [currentAdmin, setCurrentAdmin] = useState<AuthorizedAdmin | null>(() => getStoredAdminUser());
  const [isAdminVerifying, setIsAdminVerifying] = useState<boolean>(() => !!getStoredAdminToken());

  // Authorized Employee Authentication & Session State
  const [currentEmployee, setCurrentEmployee] = useState<AuthorizedEmployee | null>(() => getStoredEmployeeUser());
  const [isEmployeeVerifying, setIsEmployeeVerifying] = useState<boolean>(() => !!getStoredEmployeeToken());

  useEffect(() => {
    const verifyAdmin = async () => {
      const token = getStoredAdminToken();
      if (token) {
        try {
          const res = await fetchAdminProfile();
          if (res.success && res.admin) {
            setCurrentAdmin(res.admin);
          } else {
            clearAdminSession();
            setCurrentAdmin(null);
          }
        } catch {
          // Network issue: keep cached admin
        }
      } else {
        clearAdminSession();
        setCurrentAdmin(null);
      }
      setIsAdminVerifying(false);
    };
    verifyAdmin();
  }, []);

  useEffect(() => {
    const verifyEmployee = async () => {
      const token = getStoredEmployeeToken();
      if (token) {
        try {
          const res = await fetchEmployeeProfile();
          if (res.success && res.employee) {
            setCurrentEmployee(res.employee);
          } else {
            clearEmployeeSession();
            setCurrentEmployee(null);
          }
        } catch {
          // Network issue: keep cached employee
        }
      } else {
        clearEmployeeSession();
        setCurrentEmployee(null);
      }
      setIsEmployeeVerifying(false);
    };
    verifyEmployee();
  }, []);

  const handleAdminLogout = () => {
    clearAdminSession();
    setCurrentAdmin(null);
    navigateToView('login');
  };

  const handleEmployeeLogout = () => {
    clearEmployeeSession();
    setCurrentEmployee(null);
    navigateToView('login');
  };

  const handleSharedLoginSuccess = (
    role: 'admin' | 'employee' | 'customer',
    data?: { admin?: AuthorizedAdmin; employee?: AuthorizedEmployee }
  ) => {
    if (role === 'employee' && data?.employee) {
      setCurrentEmployee(data.employee);
      navigateToView('employee');
    } else if (role === 'admin' && data?.admin) {
      setCurrentAdmin(data.admin);
      navigateToView('admin');
    } else {
      navigateToView('storefront');
    }
  };


  // Cart state: starts with no pre-seeded items (NO minimum product requirement)
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('freshcart_cart_v3');
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch {
      // fallback
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('freshcart_cart_v3', JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

  // Keep cart items' product metadata (title, image, category, unit, price, stock) in sync with products
  useEffect(() => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          const matchingProduct = products.find((p) => p.id === item.product.id);
          if (matchingProduct) {
            const safeQty = Math.min(item.quantity, matchingProduct.stock);
            if (safeQty <= 0) return null;
            const selectedPackSize = item.selectedPackSize || matchingProduct.unit;
            const configuredSize = matchingProduct.packSizes?.find((ps) => ps.size === selectedPackSize);
            const selectedPrice = configuredSize ? configuredSize.price : (item.selectedPrice ?? matchingProduct.price);
            return {
              ...item,
              product: matchingProduct,
              quantity: safeQty,
              selectedPackSize,
              selectedPrice,
            };
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null)
    );
  }, [products]);

  const [activeModalProduct, setActiveModalProduct] = useState<Product | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState('');

  const handleSearchSubmit = (term: string) => {
    const trimmed = term.trim();
    setSearchQuery(trimmed);
    setSubmittedSearchQuery(trimmed);
    navigateToView('search', trimmed);
  };
  const [selectedCategory, setSelectedCategory] = useState('all');

  const handleCategorySelect = (catId: string) => {
    if (catId === 'all') {
      setSelectedCategory('all');
      navigateToView('storefront');
      return;
    }
    setSelectedCategory(catId);
    navigateToView('category', catId);
  };
  const [stockFilter, setStockFilter] = useState<'all' | 'organic' | 'quickPrep'>('all');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_COUPONS_KEY);
      if (saved) {
        const parsed: Coupon[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const migrated = parsed.map((c) => {
            let minAmount = c.minOrderAmount;
            if (minAmount === undefined || isNaN(minAmount)) {
              if (c.discountPercentage === 5) minAmount = 1000;
              else if (c.discountPercentage === 7) minAmount = 1500;
              else if (c.discountPercentage === 10) minAmount = 2000;
              else minAmount = 1000;
            }
            return {
              ...c,
              minOrderAmount: minAmount,
            };
          });

          // Ensure default tiers (SAVE5, SAVE7, SAVE10) are included
          INITIAL_COUPONS.forEach((initC) => {
            const existingIdx = migrated.findIndex(
              (m) => m.code.toUpperCase() === initC.code.toUpperCase()
            );
            if (existingIdx === -1) {
              migrated.push(initC);
            } else if (migrated[existingIdx].minOrderAmount === undefined) {
              migrated[existingIdx].minOrderAmount = initC.minOrderAmount;
            }
          });

          return migrated;
        }
      }
    } catch {
      // fallback
    }
    return INITIAL_COUPONS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_COUPONS_KEY, JSON.stringify(coupons));
    } catch {
      // ignore
    }
  }, [coupons]);

  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_INVENTORY_LOGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((log: InventoryLog) => {
            const dt = formatLogDateTime(log);
            return {
              ...log,
              date: log.date || dt.date,
              time: log.time || dt.time,
              timestamp: log.timestamp?.includes('DATE :') ? log.timestamp : dt.timestamp,
            };
          });
        }
      }
    } catch {
      // fallback
    }
    return INITIAL_INVENTORY_LOGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_INVENTORY_LOGS_KEY, JSON.stringify(inventoryLogs));
    } catch {
      // ignore
    }
  }, [inventoryLogs]);

  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>(() => {
    return getCustomerOrders();
  });

  useEffect(() => {
    setCustomerOrders(getCustomerOrders());
  }, [currentUser]);

  // Admin-controlled Delivery Charges Rules Setting
  const [deliveryRules, setDeliveryRules] = useState<DeliveryChargeRule[]>(() => {
    return getStoredSettings().deliveryChargeRules;
  });

  const [deliveryCharges, setDeliveryCharges] = useState<number>(() => {
    const r = getStoredSettings().deliveryChargeRules;
    return r[0]?.deliveryCharge ?? 40;
  });

  useEffect(() => {
    fetchServerSettings().then((s) => {
      if (Array.isArray(s?.deliveryChargeRules) && s.deliveryChargeRules.length > 0) {
        setDeliveryRules(s.deliveryChargeRules);
        setDeliveryCharges(s.deliveryChargeRules[0]?.deliveryCharge ?? 40);
      }
    });
  }, []);

  const handleUpdateDeliveryRules = async (newRules: DeliveryChargeRule[]) => {
    setDeliveryRules(newRules);
    setDeliveryCharges(newRules[0]?.deliveryCharge ?? 40);
    await updateServerSettings({ deliveryChargeRules: newRules });
  };

  const handleUpdateDeliveryCharges = async (newCharge: number) => {
    setDeliveryCharges(newCharge);
    await updateServerSettings({ deliveryCharges: newCharge });
  };

  // Synchronize URL Hash routing with currentView and enforce route protection
  useEffect(() => {
    if (isLoading || isAdminVerifying || isEmployeeVerifying) return;

    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      const pathname = window.location.pathname.toLowerCase();
      if (pathname.startsWith('/checkout') && !hash.startsWith('#/checkout') && !hash.startsWith('#checkout')) {
        const query = window.location.search;
        window.location.hash = `#/checkout${query}`;
        return;
      }
      if (pathname.startsWith('/cart') && !hash.startsWith('#/cart') && !hash.startsWith('#cart')) {
        const query = window.location.search;
        window.location.hash = `#/cart${query}`;
        return;
      }

      if (!currentUser && !currentAdmin && !currentEmployee) {
        // UNAUTHENTICATED USERS:
        // Only the shared 'login' and customer 'register' pages are accessible.
        // Direct access to protected routes (#/admin, #/employee, #/storefront, #/dashboard, etc.) redirects to shared login.
        if (hash === '#/register' || hash === '#register') {
          setCurrentView('register');
        } else {
          setCurrentView('login');
          if (hash !== '#/login' && hash !== '#login') {
            window.location.hash = '#/login';
          }
        }
      } else if (currentEmployee) {
        // AUTHENTICATED EMPLOYEE:
        // Employees are strictly restricted to the Employee Portal (Customer Orders Ledger) and storefront preview
        if (hash === '#/storefront' || hash === '#storefront') {
          setCurrentView('storefront');
        } else if (hash === '#/admin' || hash === '#admin') {
          // STRICT RBAC: Employees cannot access Admin Portal! Redirect to Employee Portal.
          setCurrentView('employee');
          window.location.hash = '#/employee';
        } else {
          setCurrentView('employee');
          if (hash !== '#/employee' && hash !== '#employee') {
            window.location.hash = '#/employee';
          }
        }
      } else if (currentAdmin) {
        // AUTHENTICATED ADMINISTRATOR:
        if (hash === '#/storefront' || hash === '#storefront') {
          setCurrentView('storefront');
        } else if (hash === '#/employee' || hash === '#employee') {
          // Admins redirected to Admin Portal
          setCurrentView('admin');
          window.location.hash = '#/admin';
        } else {
          setCurrentView('admin');
          if (hash !== '#/admin' && hash !== '#admin') {
            window.location.hash = '#/admin';
          }
        }
      } else if (currentUser) {
        // AUTHENTICATED CUSTOMERS:
        // Customer accounts cannot open Admin Portal (#/admin) or Employee Portal (#/employee)
        if (hash === '#/admin' || hash === '#admin' || hash === '#/employee' || hash === '#employee') {
          setCurrentView('storefront');
          window.location.hash = '#/storefront';
        } else if (hash === '#/dashboard' || hash === '#dashboard' || hash.startsWith('#/dashboard?') || hash.startsWith('#dashboard?')) {
          setCurrentView('dashboard');
        } else if (hash === '#/cart' || hash === '#cart' || hash.startsWith('#/cart?') || hash.startsWith('#cart?')) {
          setCurrentView('cart');
        } else if (hash === '#/checkout' || hash === '#checkout' || hash.startsWith('#/checkout?') || hash.startsWith('#checkout?')) {
          setCurrentView('checkout');
        } else if (hash.startsWith('#/search') || hash.startsWith('#search')) {
          setCurrentView('search');
          const rawHash = window.location.hash;
          const searchParamIndex = rawHash.indexOf('?q=');
          if (searchParamIndex !== -1) {
            const rawQuery = rawHash.substring(searchParamIndex + 3);
            const decodedQuery = decodeURIComponent(rawQuery.split('&')[0]);
            if (decodedQuery) {
              setSearchQuery(decodedQuery);
              setSubmittedSearchQuery(decodedQuery);
            }
          }
        } else if (hash.startsWith('#/category') || hash.startsWith('#category')) {
          setCurrentView('category');
          const rawHash = window.location.hash;
          let catId = '';
          const paramIndex = rawHash.indexOf('?c=');
          if (paramIndex !== -1) {
            catId = decodeURIComponent(rawHash.substring(paramIndex + 3).split('&')[0]);
          } else {
            const parts = rawHash.split('/');
            if (parts.length >= 3) {
              catId = decodeURIComponent(parts[2]);
            }
          }
          if (catId) {
            setSelectedCategory(catId);
          }
        } else if (hash === '#/login' || hash === '#/register' || hash === '#login' || hash === '#register') {
          // Already logged in: redirect to storefront
          setCurrentView('storefront');
          window.location.hash = '#/storefront';
        } else {
          // Default authenticated view is storefront homepage
          setCurrentView('storefront');
        }
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentUser, currentAdmin, currentEmployee, isLoading, isAdminVerifying, isEmployeeVerifying]);

  const navigateToView = (view: ViewType, param?: string) => {
    // If trying to open employee portal without active employee authorization, redirect to login
    if (view === 'employee' && !currentEmployee) {
      if (currentUser) {
        setCurrentView('storefront');
        window.location.hash = '#/storefront';
        return;
      }
      setCurrentView('login');
      window.location.hash = '#/login';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // If trying to open admin without active admin authorization, redirect to authorized portal or login
    if (view === 'admin' && !currentAdmin) {
      if (currentEmployee) {
        setCurrentView('employee');
        window.location.hash = '#/employee';
        return;
      }
      if (currentUser) {
        setCurrentView('storefront');
        window.location.hash = '#/storefront';
        return;
      }
      setCurrentView('login');
      window.location.hash = '#/login';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Route guard: if trying to open protected views without auth, redirect to login
    if (
      !currentUser &&
      !currentAdmin &&
      !currentEmployee &&
      (view === 'storefront' ||
        view === 'dashboard' ||
        view === 'search' ||
        view === 'category' ||
        view === 'cart' ||
        view === 'checkout' ||
        view === 'admin' ||
        view === 'employee')
    ) {
      setCurrentView('login');
      window.location.hash = '#/login';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setCurrentView(view);
    if (view === 'storefront') {
      window.location.hash = '#/storefront';
    } else if (view === 'cart') {
      window.location.hash = '#/cart';
    } else if (view === 'checkout') {
      window.location.hash = '#/checkout';
    } else if (view === 'search') {
      const q = param !== undefined ? param : (submittedSearchQuery || searchQuery);
      window.location.hash = q ? `#/search?q=${encodeURIComponent(q)}` : '#/search';
    } else if (view === 'category') {
      const c = param !== undefined ? param : selectedCategory;
      window.location.hash = c && c !== 'all' ? `#/category?c=${encodeURIComponent(c)}` : '#/category';
    } else {
      window.location.hash = `#/${view}`;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Cart Handlers
  const handleAddToCart = (
    product: Product,
    quantity: number,
    packSize?: string,
    packPrice?: number
  ) => {
    const currentProduct = products.find((p) => p.id === product.id) || product;
    if (currentProduct.stock <= 0) return;

    const chosenPackSize = packSize || currentProduct.unit;
    const chosenPrice = packPrice !== undefined ? packPrice : currentProduct.price;

    setCart((prev) => {
      const existing = prev.find(
        (item) =>
          item.product.id === currentProduct.id &&
          (item.selectedPackSize || item.product.unit) === chosenPackSize
      );

      // Check total quantity across ALL pack sizes of this product currently in cart
      const totalProductQty = prev
        .filter((item) => item.product.id === currentProduct.id)
        .reduce((sum, item) => sum + item.quantity, 0);

      const maxCanAdd = Math.max(0, currentProduct.stock - totalProductQty);
      if (maxCanAdd <= 0) return prev;

      const toAdd = Math.min(quantity, maxCanAdd);
      if (toAdd <= 0) return prev;

      if (existing) {
        return prev.map((item) =>
          item.product.id === currentProduct.id &&
          (item.selectedPackSize || item.product.unit) === chosenPackSize
            ? {
                ...item,
                quantity: item.quantity + toAdd,
                selectedPrice: chosenPrice,
                selectedPackSize: chosenPackSize,
              }
            : item
        );
      }
      return [
        ...prev,
        {
          product: currentProduct,
          quantity: toAdd,
          selectedPackSize: chosenPackSize,
          selectedPrice: chosenPrice,
        },
      ];
    });
  };

  const handleUpdateCartQty = (productId: string, delta: number, packSize?: string) => {
    const currentProduct = products.find((p) => p.id === productId);

    setCart((prev) => {
      const targetItem = prev.find(
        (item) =>
          item.product.id === productId &&
          (!packSize || (item.selectedPackSize || item.product.unit) === packSize)
      );
      if (!targetItem) return prev;

      const stockLimit = currentProduct ? currentProduct.stock : targetItem.product.stock;

      // Total quantity of other pack sizes of this product in cart
      const otherQty = prev
        .filter(
          (item) =>
            item.product.id === productId &&
            item !== targetItem
        )
        .reduce((sum, item) => sum + item.quantity, 0);

      const maxAllowedForThisItem = Math.max(0, stockLimit - otherQty);
      const targetQty = targetItem.quantity + delta;

      if (targetQty <= 0) {
        return prev.filter((item) => item !== targetItem);
      }

      const finalQty = Math.min(targetQty, maxAllowedForThisItem);
      if (finalQty <= 0) {
        return prev.filter((item) => item !== targetItem);
      }

      return prev.map((item) => {
        if (item === targetItem) {
          return { ...item, quantity: finalQty };
        }
        return item;
      });
    });
  };

  const handleRemoveCartItem = (productId: string, packSize?: string) => {
    setCart((prev) =>
      prev.filter((item) => {
        if (item.product.id !== productId) return true;
        if (packSize && (item.selectedPackSize || item.product.unit) !== packSize) return true;
        return false;
      })
    );
  };

  const handleClearCart = () => {
    setCart([]);
  };

  // When a customer purchases a product, reduce the available quantity accordingly
  const handleOrderPlaced = (purchasedItems: CartItem[], placedOrder?: CustomerOrder) => {
    const qtyByProductId: Record<string, number> = {};
    purchasedItems.forEach((it) => {
      qtyByProductId[it.product.id] = (qtyByProductId[it.product.id] || 0) + it.quantity;
    });

    setProducts((prev) =>
      prev.map((p) => {
        const totalPurchased = qtyByProductId[p.id];
        if (totalPurchased) {
          const newStock = Math.max(0, p.stock - totalPurchased);
          return { ...p, stock: newStock };
        }
        return p;
      })
    );

    // Record CDC inventory audit log entries for the purchase
    purchasedItems.forEach((it) => {
      const remainingStock = Math.max(0, it.product.stock - it.quantity);
      const packLabel = it.selectedPackSize || it.product.unit;
      const { date, time, timestamp } = createLogTimestamp();
      const logEntry: InventoryLog = {
        id: `log-${Date.now()}-${it.product.id}-${packLabel}`,
        timestamp,
        date,
        time,
        sku: it.product.sku,
        productTitle: it.product.title,
        changeType: 'SALE',
        quantityChange: -it.quantity,
        newStock: remainingStock,
        operator: 'Customer Checkout',
        notes: `Customer Order Purchase (${it.quantity} × ${packLabel})`,
      };
      setInventoryLogs((prevLogs) => [logEntry, ...prevLogs]);
    });

    // Update customer orders state
    if (placedOrder) {
      setCustomerOrders((prev) => [placedOrder, ...prev.filter((o) => o.id !== placedOrder.id)]);
    } else {
      setCustomerOrders(getCustomerOrders());
    }
  };

  const handleUpdateOrderStatus = (orderId: string, status: string, extraMeta?: any) => {
    updateOrderStatus(orderId, status, extraMeta);
    setCustomerOrders(getCustomerOrders());
  };

  const handleDeleteCustomerOrder = (orderId: string) => {
    deleteCustomerOrder(orderId);
    setCustomerOrders(getCustomerOrders());
  };

  // Inventory Updates (from Admin or simulated events)
  const handleUpdateProductStock = (productId: string, newStock: number, reason: string) => {
    const validStock = Math.max(0, newStock);
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          const change = validStock - p.stock;
          const { date, time, timestamp } = createLogTimestamp();
          const logEntry: InventoryLog = {
            id: `log-${Date.now()}`,
            timestamp,
            date,
            time,
            sku: p.sku,
            productTitle: p.title,
            changeType: change > 0 ? 'RESTOCK' : 'SALE',
            quantityChange: change,
            newStock: validStock,
            operator: 'Manager Override',
            notes: reason,
          };
          setInventoryLogs((prevLogs) => [logEntry, ...prevLogs]);
          return { ...p, stock: validStock };
        }
        return p;
      })
    );
  };

  const handleUpdateProductPrice = (productId: string, newPrice: number) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, price: newPrice } : p))
    );
  };

  const handleAddProduct = (newProduct: Product) => {
    setProducts((prev) => [newProduct, ...prev]);

    const { date, time, timestamp } = createLogTimestamp();
    const logEntry: InventoryLog = {
      id: `log-${Date.now()}-${newProduct.id}`,
      timestamp,
      date,
      time,
      sku: newProduct.sku,
      productTitle: newProduct.title,
      changeType: 'RESTOCK',
      quantityChange: newProduct.stock,
      newStock: newProduct.stock,
      operator: 'Admin Portal',
      notes: `Added new product: ${newProduct.title} (₹${newProduct.price} / ${newProduct.unit})`,
    };
    setInventoryLogs((prevLogs) => [logEntry, ...prevLogs]);
  };

  const handleDeleteProduct = (productId: string) => {
    const productToDelete = products.find((p) => p.id === productId);
    if (productToDelete) {
      const { date, time, timestamp } = createLogTimestamp();
      const logEntry: InventoryLog = {
        id: `log-${Date.now()}-${productId}`,
        timestamp,
        date,
        time,
        sku: productToDelete.sku,
        productTitle: productToDelete.title,
        changeType: 'SPOILAGE_DISPOSAL',
        quantityChange: -productToDelete.stock,
        newStock: 0,
        operator: 'Admin Portal',
        notes: `Removed product from store: ${productToDelete.title}`,
      };
      setInventoryLogs((prevLogs) => [logEntry, ...prevLogs]);
    }

    setProducts((prev) => prev.filter((p) => p.id !== productId));
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
    if (activeModalProduct && activeModalProduct.id === productId) {
      setActiveModalProduct(null);
    }
  };

  const handleUpdateProductUnit = (productId: string, newUnit: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, unit: newUnit } : p))
    );

    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, product: { ...item.product, unit: newUnit } }
          : item
      )
    );

    if (activeModalProduct && activeModalProduct.id === productId) {
      setActiveModalProduct((prev) => (prev ? { ...prev, unit: newUnit } : null));
    }

    const targetProduct = products.find((p) => p.id === productId);
    if (targetProduct) {
      const { date, time, timestamp } = createLogTimestamp();
      const logEntry: InventoryLog = {
        id: `log-${Date.now()}-${productId}`,
        timestamp,
        date,
        time,
        sku: targetProduct.sku,
        productTitle: targetProduct.title,
        changeType: 'AUDIT_ADJUSTMENT',
        quantityChange: 0,
        newStock: targetProduct.stock,
        operator: 'Admin Portal',
        notes: `Updated unit for ${targetProduct.title} to "${newUnit}"`,
      };
      setInventoryLogs((prevLogs) => [logEntry, ...prevLogs]);
    }
  };

  const handleEditProduct = (updatedProduct: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );

    if (activeModalProduct && activeModalProduct.id === updatedProduct.id) {
      setActiveModalProduct(updatedProduct);
    }

    const { date, time, timestamp } = createLogTimestamp();
    const logEntry: InventoryLog = {
      id: `log-${Date.now()}-${updatedProduct.id}`,
      timestamp,
      date,
      time,
      sku: updatedProduct.sku,
      productTitle: updatedProduct.title,
      changeType: 'AUDIT_ADJUSTMENT',
      quantityChange: 0,
      newStock: updatedProduct.stock,
      operator: 'Admin Portal',
      notes: `Updated details: ${updatedProduct.title} (${updatedProduct.category}, ${updatedProduct.supplier}, ₹${updatedProduct.price} / ${updatedProduct.unit}, Stock: ${updatedProduct.stock})`,
    };
    setInventoryLogs((prevLogs) => [logEntry, ...prevLogs]);
  };

  const handleDeleteInventoryLog = (logId: string) => {
    setInventoryLogs((prevLogs) => prevLogs.filter((log) => log.id !== logId));
  };

  const handleClearInventoryLogs = () => {
    setInventoryLogs([]);
  };

  // Simulate real-time CDC pulse
  const handleSimulateCdcPulse = () => {
    const candidate = products.find((p) => p.stock > 1);
    if (!candidate) return;

    handleUpdateProductStock(
      candidate.id,
      candidate.stock - 1,
      'Live Online Order #FC-' + Math.floor(1000 + Math.random() * 9000)
    );
  };

  // Coupon Management Handlers (Admin CRUD)
  const handleCreateCoupon = (couponData: Omit<Coupon, 'id'>) => {
    const newCoupon: Coupon = {
      ...couponData,
      id: `cpn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    setCoupons((prev) => [newCoupon, ...prev]);
  };

  const handleUpdateCoupon = (updatedCoupon: Coupon) => {
    setCoupons((prev) =>
      prev.map((c) => (c.id === updatedCoupon.id ? updatedCoupon : c))
    );
  };

  const handleDeleteCoupon = (couponId: string) => {
    const deleted = coupons.find((c) => c.id === couponId);
    if (deleted && appliedCoupon && deleted.code.toUpperCase() === appliedCoupon.toUpperCase()) {
      setAppliedCoupon(null);
    }
    setCoupons((prev) => prev.filter((c) => c.id !== couponId));
  };

  const handleToggleCouponStatus = (couponId: string) => {
    setCoupons((prev) =>
      prev.map((c) => {
        if (c.id === couponId) {
          const toggled = !c.isActive;
          if (!toggled && appliedCoupon && c.code.toUpperCase() === appliedCoupon.toUpperCase()) {
            setAppliedCoupon(null);
          }
          return { ...c, isActive: toggled };
        }
        return c;
      })
    );
  };

  // Product Filtering logic
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      searchQuery === '' ||
      product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.categoryLabel.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'all' || product.category === selectedCategory;

    const matchesStockFilter =
      stockFilter === 'all' ||
      (stockFilter === 'organic' && product.isOrganic) ||
      (stockFilter === 'quickPrep' && product.isQuickPrep);

    return matchesSearch && matchesCategory && matchesStockFilter;
  });

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (isLoading || isAdminVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent relative z-10 overflow-hidden">
        <div className="relative z-10 flex flex-col items-center gap-3 bg-white/40 backdrop-blur-md p-8 rounded-3xl border border-white/55 shadow-xl">
          <span className="w-8 h-8 border-3 border-[#006b2c]/30 border-t-[#006b2c] rounded-full animate-spin" />
          <span className="text-[13px] font-semibold text-[#565e74]">{t('loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-[#f1f5f9] relative z-10">
      {/* Moving Particles Animation ONLY on Sign In Page */}
      {currentView === 'login' && <CursorReactiveBackground />}

      {/* Universal Header with View Navigation & Customer Authentication */}
      <Header
        currentView={currentView}
        isAdminSignIn={false}
        onToggleView={(view) => navigateToView(view)}
        cartCount={cartCount}
        onOpenCart={() => navigateToView('cart')}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        selectedCategory={selectedCategory}
        onSelectCategory={handleCategorySelect}
      />

      {/* Main Content Area */}
      <main className="flex-1 pt-24 sm:pt-28 relative z-10">
        {currentView === 'admin' ? (
          currentAdmin ? (
            <AdminPortal
              products={products}
              inventoryLogs={inventoryLogs}
              coupons={coupons}
              customerOrders={customerOrders}
              currentAdmin={currentAdmin}
              onAdminLogout={handleAdminLogout}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onDeleteCustomerOrder={handleDeleteCustomerOrder}
              onBackToStorefront={() => navigateToView(currentUser ? 'storefront' : 'login')}
              onUpdateProductStock={handleUpdateProductStock}
              onUpdateProductPrice={handleUpdateProductPrice}
              onUpdateProductUnit={handleUpdateProductUnit}
              onAddProduct={handleAddProduct}
              onEditProduct={handleEditProduct}
              onDeleteProduct={handleDeleteProduct}
              onSimulateCdcPulse={handleSimulateCdcPulse}
              onCreateCoupon={handleCreateCoupon}
              onUpdateCoupon={handleUpdateCoupon}
              onDeleteCoupon={handleDeleteCoupon}
              onToggleCoupon={handleToggleCouponStatus}
              onDeleteInventoryLog={handleDeleteInventoryLog}
              onClearInventoryLogs={handleClearInventoryLogs}
              deliveryCharges={deliveryCharges}
              onUpdateDeliveryCharges={handleUpdateDeliveryCharges}
              deliveryRules={deliveryRules}
              onUpdateDeliveryRules={handleUpdateDeliveryRules}
            />
          ) : (
            <LoginPage
              onNavigateToRegister={() => navigateToView('register')}
              onLoginSuccess={handleSharedLoginSuccess}
            />
          )
        ) : currentView === 'employee' ? (
          currentEmployee ? (
            <EmployeePortal
              currentEmployee={currentEmployee}
              customerOrders={customerOrders}
              onBackToStorefront={() => navigateToView(currentUser ? 'storefront' : 'login')}
              onEmployeeLogout={handleEmployeeLogout}
              onUpdateOrderStatus={handleUpdateOrderStatus}
            />
          ) : (
            <LoginPage
              onNavigateToRegister={() => navigateToView('register')}
              onLoginSuccess={handleSharedLoginSuccess}
            />
          )
        ) : currentView === 'login' ? (
          <LoginPage
            onNavigateToRegister={() => navigateToView('register')}
            onLoginSuccess={handleSharedLoginSuccess}
          />
        ) : currentView === 'register' ? (
          <RegisterPage
            onNavigateToLogin={() => navigateToView('login')}
            onRegisterSuccess={() => navigateToView('storefront')}
          />
        ) : currentView === 'dashboard' ? (
          currentUser ? (
            <CustomerDashboard
              cart={cart}
              onOpenCart={() => navigateToView('cart')}
              onOpenCheckout={() => navigateToView('checkout')}
              onAddToCart={handleAddToCart}
              onUpdateQty={handleUpdateCartQty}
              onRemoveItem={handleRemoveCartItem}
              onBackToStorefront={() => navigateToView('storefront')}
              onLogout={() => {
                logout();
                navigateToView('login');
              }}
            />
          ) : (
            <LoginPage
              onNavigateToRegister={() => navigateToView('register')}
              onLoginSuccess={handleSharedLoginSuccess}
            />
          )
        ) : currentView === 'search' ? (
          currentUser ? (
            <SearchResultsPage
              searchQuery={submittedSearchQuery}
              products={products}
              onAddToCart={handleAddToCart}
              onOpenDetails={(p) => setActiveModalProduct(p)}
              onBackToStorefront={() => navigateToView('storefront')}
              onOpenAdmin={() => navigateToView('admin')}
              onSelectCategory={handleCategorySelect}
              onOpenLogin={() => navigateToView(currentUser ? 'dashboard' : 'login')}
              onOpenDashboard={() => navigateToView('dashboard')}
            />
          ) : (
            <LoginPage
              onNavigateToRegister={() => navigateToView('register')}
              onLoginSuccess={handleSharedLoginSuccess}
            />
          )
        ) : currentView === 'category' ? (
          currentUser ? (
            <CategoryResultsPage
              selectedCategory={selectedCategory}
              products={products}
              onAddToCart={handleAddToCart}
              onOpenDetails={(p) => setActiveModalProduct(p)}
              onBackToStorefront={() => navigateToView('storefront')}
              onSelectCategory={handleCategorySelect}
              onOpenAdmin={() => navigateToView('admin')}
              onOpenLogin={() => navigateToView(currentUser ? 'dashboard' : 'login')}
              onOpenDashboard={() => navigateToView('dashboard')}
            />
          ) : (
            <LoginPage
              onNavigateToRegister={() => navigateToView('register')}
              onLoginSuccess={handleSharedLoginSuccess}
            />
          )
        ) : currentView === 'cart' ? (
          currentUser ? (
            <CartPage
              items={cart}
              onUpdateQty={handleUpdateCartQty}
              onRemoveItem={handleRemoveCartItem}
              onOpenCheckout={() => navigateToView('checkout')}
              appliedCoupon={appliedCoupon}
              onApplyCoupon={(code) => setAppliedCoupon(code)}
              onRemoveCoupon={() => setAppliedCoupon(null)}
              coupons={coupons}
              deliveryCharges={deliveryCharges}
              deliveryRules={deliveryRules}
              onBackToStorefront={() => navigateToView('storefront')}
              onOpenAdmin={() => navigateToView('admin')}
              onSelectCategory={handleCategorySelect}
              onOpenLogin={() => navigateToView(currentUser ? 'dashboard' : 'login')}
              onOpenDashboard={() => navigateToView('dashboard')}
            />
          ) : (
            <LoginPage
              onNavigateToRegister={() => navigateToView('register')}
              onLoginSuccess={handleSharedLoginSuccess}
            />
          )
        ) : currentView === 'checkout' ? (
          currentUser ? (
            <CheckoutPage
              items={cart}
              appliedCoupon={appliedCoupon}
              onClearCart={handleClearCart}
              onOrderPlaced={handleOrderPlaced}
              coupons={coupons}
              deliveryCharges={deliveryCharges}
              deliveryRules={deliveryRules}
              onBackToCart={() => navigateToView('cart')}
              onNavigateToDashboard={() => navigateToView('dashboard')}
              onNavigateToStorefront={() => navigateToView('storefront')}
              onOpenAdmin={() => navigateToView('admin')}
              onSelectCategory={handleCategorySelect}
              onOpenLogin={() => navigateToView(currentUser ? 'dashboard' : 'login')}
              onOpenDashboard={() => navigateToView('dashboard')}
            />
          ) : (
            <LoginPage
              onNavigateToRegister={() => navigateToView('register')}
              onLoginSuccess={handleSharedLoginSuccess}
            />
          )
        ) : currentUser ? (
          /* Main Grocery Storefront (Protected: only visible when successfully logged in) */
          <div className="flex flex-col w-full">
            {/* Hero Section (Top: Centered Text -> Below: Product Image Carousel -> Below: Category Navigation) */}
            <HeroSection
              onSearch={handleSearchSubmit}
              selectedCategory={selectedCategory}
              onSelectCategory={handleCategorySelect}
              onApplyCoupon={(code) => setAppliedCoupon(code)}
              appliedCoupon={appliedCoupon}
              products={products}
            />

            {/* Curated Catalog Category Grid */}
            <CategoryGrid
              selectedCategory={selectedCategory}
              onSelectCategory={handleCategorySelect}
            />

            {/* Featured Harvest & Daily Goods Section */}
            <section className="w-full px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6">
                <div>
                  <div className="flex items-center gap-1.5 text-[#006b2c] text-[11px] uppercase tracking-wider font-bold">
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{t('liveProduceHeader')}</span>
                  </div>
                  <h2 className="text-[26px] sm:text-[32px] text-[#0b1c30] font-bold font-display">
                    {t('featuredHarvestTitle')}
                  </h2>
                </div>

                {/* Filter Chips - Crystal Glass */}
                <div className="flex items-center gap-1 bg-white/35 backdrop-blur-md p-1.5 rounded-2xl border border-white/50 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setStockFilter('all')}
                    className={`px-3.5 py-1.5 rounded-xl text-[12px] font-semibold transition-all duration-200 hover:-translate-y-0.5 cursor-pointer ${
                      stockFilter === 'all'
                        ? 'bg-white/60 text-[#0b1c30] shadow-xs border border-white/60'
                        : 'text-[#565e74] hover:text-[#0b1c30]'
                    }`}
                  >
                    {t('filterAllStock')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockFilter('organic')}
                    className={`px-3.5 py-1.5 rounded-xl text-[12px] font-semibold transition-all duration-200 hover:-translate-y-0.5 cursor-pointer ${
                      stockFilter === 'organic'
                        ? 'bg-white/60 text-[#0b1c30] shadow-xs border border-white/60'
                        : 'text-[#565e74] hover:text-[#0b1c30]'
                    }`}
                  >
                    {t('filterOrganicOnly')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockFilter('quickPrep')}
                    className={`px-3.5 py-1.5 rounded-xl text-[12px] font-semibold transition-all duration-200 hover:-translate-y-0.5 cursor-pointer ${
                      stockFilter === 'quickPrep'
                        ? 'bg-white/60 text-[#0b1c30] shadow-xs border border-white/60'
                        : 'text-[#565e74] hover:text-[#0b1c30]'
                    }`}
                  >
                    {t('filterQuickPrep')}
                  </button>
                </div>
              </div>

              {/* Products Grid */}
              {filteredProducts.length === 0 ? (
                <div className="text-center py-16 bg-white/35 backdrop-blur-md rounded-3xl border border-white/50 p-8 shadow-md">
                  <Sparkles className="w-10 h-10 text-[#006b2c] mx-auto mb-3 opacity-60" />
                  <h3 className="text-[18px] font-bold text-[#0b1c30]">
                    {t('noItemsFound')}
                  </h3>
                  <p className="text-[13px] text-[#565e74] mt-1 max-w-md mx-auto">
                    {t('tryClearingSearch', { query: searchQuery })}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                      setStockFilter('all');
                    }}
                    className="mt-4 px-5 py-2.5 bg-[#006b2c] text-white text-[12px] font-semibold rounded-xl hover:bg-[#00873a] hover:-translate-y-0.5 hover:shadow-md hover:brightness-105 active:translate-y-0 active:scale-98 transition-all duration-200 cursor-pointer shadow-xs"
                  >
                    {t('resetAllFilters')}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onAddToCart={handleAddToCart}
                      onOpenDetails={(p) => setActiveModalProduct(p)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Trust & Guarantee Banner */}
            <TrustBanner />

            {/* Footer */}
            <Footer
              onOpenAdmin={() => navigateToView('admin')}
              onSelectCategory={handleCategorySelect}
              onOpenLogin={() => navigateToView(currentUser ? 'dashboard' : 'login')}
              onOpenDashboard={() => navigateToView('dashboard')}
            />
          </div>
        ) : (
          /* Fallback if unauthenticated and somehow on storefront view */
          <LoginPage
            onNavigateToRegister={() => navigateToView('register')}
            onLoginSuccess={handleSharedLoginSuccess}
          />
        )}
      </main>



      {/* Product Quick View Modal */}
      {currentView !== 'admin' && (
        <ProductModal
          product={activeModalProduct}
          onClose={() => setActiveModalProduct(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* Floating Cart Icon (Customer Portal) */}
      {currentView !== 'admin' &&
        currentView !== 'employee' &&
        currentView !== 'cart' &&
        currentView !== 'checkout' &&
        currentView !== 'login' &&
        currentView !== 'register' && (
          <FloatingCart
            cart={cart}
            cartCount={cartCount}
            onNavigateToCart={() => navigateToView('cart')}
          />
        )}
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <div className="min-h-screen bg-[#030305] text-[#f1f5f9] relative">
          <FreshCartStore />
        </div>
      </AuthProvider>
    </LanguageProvider>
  );
}
