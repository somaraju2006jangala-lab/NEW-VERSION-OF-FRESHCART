import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  FlatList,
  Modal,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import {
  LayoutDashboard,
  Boxes,
  Truck,
  Users,
  CreditCard,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Check,
  X,
  ChevronRight,
  TrendingUp,
  Package,
  Shield,
  Tag,
  LogOut,
  Upload,
  Sparkles,
  AlertCircle,
  Image as ImageIcon,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../../services/apiClient';
import { Header } from '../../components/common/Header';
import { Product, Order, AuthorizedEmployee, Coupon, InventoryLog, PackSizeOption } from '../../types';
import {
  formatUnitString,
  getQuickAddPresetsForUnit,
  getPackSizeConversionFactor,
  isSamePackSize,
} from '../../utils/packSize';

type AdminTab = 'overview' | 'inventory' | 'orders' | 'employees' | 'settings';

export const AdminDashboardScreen: React.FC = () => {
  const { currentAdmin, adminToken, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Overview metrics
  const [metrics, setMetrics] = useState<{
    totalSales: number;
    totalOrders: number;
    totalProducts: number;
    totalCustomers: number;
    pendingOrders: number;
    ordersToDeliver: number;
  }>({
    totalSales: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalCustomers: 0,
    pendingOrders: 0,
    ordersToDeliver: 0,
  });

  // State arrays
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [employees, setEmployees] = useState<AuthorizedEmployee[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);
  const [ordersToDeliver, setOrdersToDeliver] = useState<any[]>([]);
  const [verificationQueue, setVerificationQueue] = useState<any[]>([]);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [showAddCouponModal, setShowAddCouponModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [assigningOrder, setAssigningOrder] = useState<any | null>(null);

  // Form states
  const [productForm, setProductForm] = useState<{
    title: string;
    category: string;
    price: string;
    stock: string;
    unit: string;
    supplier: string;
    badge: string;
    image: string;
    description: string;
    packSizes: PackSizeOption[];
  }>({
    title: '',
    category: 'produce',
    price: '',
    stock: '',
    unit: '1 kg',
    supplier: 'Local Farm Direct',
    badge: 'Fresh Harvest',
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
    description: '',
    packSizes: [{ size: '1 kg', price: 0, stock: 0, isAvailable: true }],
  });

  const [employeeForm, setEmployeeForm] = useState({
    fullName: '',
    email: '',
    mobile: '',
    username: '',
    password: '',
  });

  const [couponForm, setCouponForm] = useState({
    code: '',
    discountPercentage: '',
    minOrderAmount: '',
    description: '',
  });

  // Load all data
  const loadAllData = useCallback(async () => {
    if (!adminToken) return;
    setIsRefreshing(true);
    try {
      const [
        overviewRes,
        prodRes,
        orderRes,
        empRes,
        custRes,
        coupRes,
        deliverRes,
        verifyRes,
      ] = await Promise.all([
        adminApi.getOverview(adminToken).catch(() => null),
        adminApi.getProducts().catch(() => []),
        adminApi.getOrders(adminToken).catch(() => []),
        adminApi.getEmployees(adminToken).catch(() => null),
        adminApi.getCustomers(adminToken).catch(() => null),
        adminApi.getCoupons().catch(() => []),
        adminApi.getOrdersToDeliver(adminToken).catch(() => null),
        adminApi.getPaymentVerificationQueue(adminToken).catch(() => null),
      ]);
      if (overviewRes?.success && overviewRes.overview) {
        setMetrics(overviewRes.overview);
      }
      if (Array.isArray(prodRes)) setProducts(prodRes);
      if (Array.isArray(orderRes)) setOrders(orderRes);
      if (empRes?.success && Array.isArray(empRes.employees)) setEmployees(empRes.employees);
      if (custRes?.success && Array.isArray(custRes.customers)) setCustomers(custRes.customers);
      if (Array.isArray(coupRes)) setCoupons(coupRes);
      if (deliverRes?.success && Array.isArray(deliverRes.orders)) setOrdersToDeliver(deliverRes.orders);
      if (verifyRes?.success && Array.isArray(verifyRes.payments)) setVerificationQueue(verifyRes.payments);
    } catch (err) {
      console.warn('Admin data fetch error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [adminToken]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Pack sizes handlers for Add/Edit product modal
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      title: '',
      category: '',
      price: '',
      stock: '',
      unit: '1 kg',
      supplier: 'Local Farm Direct',
      badge: 'Fresh Harvest',
      image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
      description: '',
      packSizes: [{ size: '1 kg', price: 0, stock: 0, isAvailable: true }],
    });
    setShowAddProductModal(true);
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    const initialPackSizes: PackSizeOption[] =
      Array.isArray(prod.packSizes) && prod.packSizes.length > 0
        ? prod.packSizes.map((ps) => ({
            size: ps.size,
            price: Number(ps.price) || prod.price,
            stock: ps.stock !== undefined ? ps.stock : prod.stock,
            isAvailable: ps.isAvailable !== false,
          }))
        : [
            {
              size: prod.unit || '1 kg',
              price: prod.price,
              stock: prod.stock,
              isAvailable: true,
            },
          ];

    setProductForm({
      title: prod.title,
      category: prod.category,
      price: String(prod.price),
      stock: String(prod.stock),
      unit: prod.unit || '1 kg',
      supplier: prod.supplier || 'Local Farm Direct',
      badge: prod.badge || '',
      image: prod.image,
      description: prod.description || '',
      packSizes: initialPackSizes,
    });
    setShowAddProductModal(true);
  };

  // Sync top-level unit with packSizes[0]
  const handleUnitChange = (newUnit: string) => {
    setProductForm((prev) => {
      const nextPackSizes = [...prev.packSizes];
      const numericPrice = parseFloat(prev.price) || 0;
      const numericStock = parseInt(prev.stock, 10) || 0;
      if (nextPackSizes.length > 0) {
        nextPackSizes[0] = { ...nextPackSizes[0], size: newUnit, price: numericPrice, stock: numericStock };
      } else {
        nextPackSizes.push({ size: newUnit, price: numericPrice, stock: numericStock, isAvailable: true });
      }
      return {
        ...prev,
        unit: newUnit,
        packSizes: nextPackSizes.filter((ps, idx) => idx === 0 || !isSamePackSize(ps.size, newUnit)),
      };
    });
  };

  // Sync top-level price with packSizes[0]
  const handlePriceChange = (newPrice: string) => {
    setProductForm((prev) => {
      const nextPackSizes = [...prev.packSizes];
      const num = parseFloat(newPrice) || 0;
      if (nextPackSizes.length > 0) {
        nextPackSizes[0] = { ...nextPackSizes[0], price: num };
      }
      return { ...prev, price: newPrice, packSizes: nextPackSizes };
    });
  };

  // Sync top-level stock with packSizes[0]
  const handleStockChange = (newStock: string) => {
    setProductForm((prev) => {
      const nextPackSizes = [...prev.packSizes];
      const num = parseInt(newStock, 10) || 0;
      if (nextPackSizes.length > 0) {
        nextPackSizes[0] = { ...nextPackSizes[0], stock: num };
      }
      return { ...prev, stock: newStock, packSizes: nextPackSizes };
    });
  };

  // Handle editing pack-size price
  const handlePackSizePriceChange = (idx: number, newPriceVal: number) => {
    setProductForm((prev) => {
      const next = [...prev.packSizes];
      next[idx] = { ...next[idx], price: newPriceVal };
      const updatedPrice = idx === 0 ? (newPriceVal > 0 ? String(newPriceVal) : '') : prev.price;
      return { ...prev, price: updatedPrice, packSizes: next };
    });
  };

  // Handle editing pack-size stock
  const handlePackSizeStockChange = (idx: number, newStockVal: number) => {
    setProductForm((prev) => {
      const next = [...prev.packSizes];
      next[idx] = { ...next[idx], stock: newStockVal };
      const updatedStock = idx === 0 ? (newStockVal >= 0 ? String(newStockVal) : '') : prev.stock;
      return { ...prev, stock: updatedStock, packSizes: next };
    });
  };

  // Handle editing pack size name
  const handlePackSizeNameChange = (idx: number, newName: string) => {
    setProductForm((prev) => {
      const next = [...prev.packSizes];
      next[idx] = { ...next[idx], size: newName };
      const updatedUnit = idx === 0 ? newName : prev.unit;
      return { ...prev, unit: updatedUnit, packSizes: next };
    });
  };

  // Toggle pack size availability
  const handleTogglePackSizeAvailability = (idx: number) => {
    setProductForm((prev) => {
      const next = [...prev.packSizes];
      next[idx] = { ...next[idx], isAvailable: next[idx].isAvailable === false ? true : false };
      return { ...prev, packSizes: next };
    });
  };

  // Remove pack size row (default pack size cannot be removed)
  const handleRemovePackSizeRow = (idx: number) => {
    if (idx === 0) return;
    setProductForm((prev) => ({
      ...prev,
      packSizes: prev.packSizes.filter((_, i) => i !== idx),
    }));
  };

  // Add a new custom pack size row (manual entry)
  const handleAddPackSizeRow = () => {
    setProductForm((prev) => {
      const numericPrice = parseFloat(prev.price) || 0;
      const numericStock = parseInt(prev.stock, 10) || 0;
      return {
        ...prev,
        packSizes: [
          ...prev.packSizes,
          {
            size: '',
            price: numericPrice,
            stock: numericStock,
            isAvailable: true,
          },
        ],
      };
    });
  };

  // Handle image upload from gallery
  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Please allow camera roll access to pick an image.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setProductForm((prev) => ({ ...prev, image: uri }));
      }
    } catch (err: any) {
      Alert.alert('Image Pick Error', err.message || 'Could not pick image.');
    }
  };

  // Handle Add/Edit Product with pack sizes validation and persistence
  const handleSaveProduct = async () => {
    if (!adminToken) return;
    if (!productForm.title.trim()) {
      Alert.alert('Missing Field', 'Please enter a product title.');
      return;
    }
    if (!productForm.category.trim()) {
      Alert.alert('Missing Field', 'Please enter a category.');
      return;
    }
    if (!productForm.unit.trim()) {
      Alert.alert('Missing Field', 'Please enter a unit / pack size.');
      return;
    }
    const numericPrice = parseFloat(productForm.price) || 0;
    if (numericPrice <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price greater than ₹0.');
      return;
    }
    const numericStock = parseInt(productForm.stock, 10);
    if (isNaN(numericStock) || numericStock < 0) {
      Alert.alert('Invalid Stock', 'Please enter a valid stock quantity.');
      return;
    }

    // Validate all pack sizes
    for (let i = 0; i < productForm.packSizes.length; i++) {
      const ps = productForm.packSizes[i];
      if (!ps.size || !ps.size.trim()) {
        Alert.alert('Pack Size Error', `Please enter a pack size name for pack size #${i + 1}.`);
        return;
      }
      const pNum = Number(ps.price);
      if (isNaN(pNum) || pNum <= 0) {
        Alert.alert('Pack Size Error', `Pack size "${ps.size}" must have a valid price greater than ₹0.`);
        return;
      }
      if (ps.stock !== undefined && (isNaN(Number(ps.stock)) || Number(ps.stock) < 0)) {
        Alert.alert('Pack Size Error', `Pack size "${ps.size}" must have a valid non-negative stock quantity.`);
        return;
      }
    }

    // Check duplicate pack sizes
    const sizeNames = productForm.packSizes.map((ps) => ps.size.trim().toLowerCase());
    const duplicate = sizeNames.find((name, idx) => sizeNames.indexOf(name) !== idx);
    if (duplicate) {
      Alert.alert('Duplicate Pack Size', `Duplicate pack size "${duplicate}" found. Each pack size must be unique.`);
      return;
    }

    try {
      const finalPackSizes: PackSizeOption[] = productForm.packSizes.map((ps, idx) => ({
        size: ps.size.trim(),
        price: Math.max(1, Math.round(Number(ps.price) || numericPrice)),
        isAvailable: ps.isAvailable !== false,
        stock: idx === 0 ? numericStock : Math.max(0, parseInt(String(ps.stock), 10) || 0),
      }));

      const payload: Partial<Product> = {
        title: productForm.title.trim(),
        category: productForm.category.trim().toLowerCase(),
        price: numericPrice,
        stock: numericStock,
        unit: productForm.unit.trim(),
        supplier: productForm.supplier.trim() || 'Local Farm Direct',
        badge: productForm.badge.trim() || 'Fresh Harvest',
        image: productForm.image.trim() || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
        description: '',
        packSizes: finalPackSizes,
      };

      if (editingProduct) {
        await adminApi.updateProduct(adminToken, editingProduct.id, payload);
        Alert.alert('Updated', 'Product details and pack sizes updated in MySQL.');
      } else {
        await adminApi.addProduct(adminToken, payload);
        Alert.alert('Success', 'New product with pack sizes added to inventory.');
      }
      setShowAddProductModal(false);
      setEditingProduct(null);
      loadAllData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed saving product.');
    }
  };

  // Handle Delete Product
  const handleDeleteProduct = (product: Product) => {
    Alert.alert(
      'Delete Product',
      `Permanently remove "${product.title}" from inventory?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!adminToken) return;
            try {
              await adminApi.deleteProduct(adminToken, product.id);
              loadAllData();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed deleting product.');
            }
          },
        },
      ]
    );
  };

  // Quick Stock Adjustment (+/-)
  const handleAdjustStock = async (product: Product, delta: number) => {
    if (!adminToken) return;
    const newStock = Math.max(0, product.stock + delta);
    try {
      await adminApi.updateProduct(adminToken, product.id, { stock: newStock });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, stock: newStock } : p))
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed adjusting stock.');
    }
  };

  // Handle Add Employee
  const handleSaveEmployee = async () => {
    if (!adminToken) return;
    if (!employeeForm.fullName.trim() || !employeeForm.email.trim() || !employeeForm.password) {
      Alert.alert('Missing Fields', 'Full name, email, and password are required.');
      return;
    }
    try {
      const res = await adminApi.addEmployee(adminToken, {
        fullName: employeeForm.fullName.trim(),
        email: employeeForm.email.trim().toLowerCase(),
        mobile: employeeForm.mobile.trim(),
        username: employeeForm.username.trim(),
        password: employeeForm.password,
      });
      if (res.success) {
        Alert.alert('Success', 'Employee registered successfully.');
        setShowAddEmployeeModal(false);
        setEmployeeForm({ fullName: '', email: '', mobile: '', username: '', password: '' });
        loadAllData();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed adding employee.');
    }
  };

  // Toggle Employee Status
  const handleToggleEmployeeStatus = async (employee: AuthorizedEmployee) => {
    if (!adminToken) return;
    const nextStatus = employee.status === 'active' ? 'inactive' : 'active';
    try {
      await adminApi.toggleEmployeeStatus(adminToken, employee.employeeId, nextStatus);
      loadAllData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed updating status.');
    }
  };

  // Handle Order Status Update
  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await adminApi.updateOrderStatus(orderId, newStatus, adminToken || undefined);
      loadAllData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed updating order status.');
    }
  };

  // Auto-assign orders
  const handleAutoAssign = async () => {
    if (!adminToken) return;
    try {
      const res = await adminApi.autoAssignOrders(adminToken);
      Alert.alert('Auto-Assignment Complete', res.message || 'Orders assigned.');
      loadAllData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Auto-assign failed.');
    }
  };

  // Manual assign order to employee
  const handleAssignToEmployee = async (orderId: string, employeeId: string) => {
    if (!adminToken) return;
    try {
      await adminApi.assignOrder(adminToken, orderId, employeeId);
      Alert.alert('Assigned', 'Order assigned successfully.');
      setAssigningOrder(null);
      loadAllData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Assignment failed.');
    }
  };

  // Add Coupon
  const handleSaveCoupon = async () => {
    if (!adminToken) return;
    if (!couponForm.code.trim() || !couponForm.discountPercentage) {
      Alert.alert('Missing Fields', 'Coupon code and discount % are required.');
      return;
    }
    try {
      await adminApi.addCoupon(adminToken, {
        code: couponForm.code.trim().toUpperCase(),
        discountPercentage: parseFloat(couponForm.discountPercentage) || 0,
        minOrderAmount: parseFloat(couponForm.minOrderAmount) || 0,
        description: couponForm.description,
        isActive: true,
      });
      Alert.alert('Success', `Coupon ${couponForm.code.toUpperCase()} created.`);
      setShowAddCouponModal(false);
      setCouponForm({ code: '', discountPercentage: '', minOrderAmount: '', description: '' });
      loadAllData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed creating coupon.');
    }
  };

  // Payment Verification (Approve / Reject)
  const handleVerifyPayment = async (orderId: string, action: 'APPROVE' | 'REJECT') => {
    if (!adminToken) return;
    try {
      const res = await adminApi.verifyPayment(adminToken, orderId, action);
      Alert.alert(action === 'APPROVE' ? 'Payment Approved' : 'Payment Rejected', res.message || 'Processed.');
      loadAllData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Verification failed.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Admin Portal"
        portalBadge={currentAdmin?.role === 'owner' ? 'Owner' : 'Admin'}
      />

      {/* Quick Navigation Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'overview' && styles.tabItemActive]}
          onPress={() => setActiveTab('overview')}
        >
          <LayoutDashboard size={18} color={activeTab === 'overview' ? '#006b2c' : '#64748b'} />
          <Text style={[styles.tabLabel, activeTab === 'overview' && styles.tabLabelActive]}>
            Overview
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'inventory' && styles.tabItemActive]}
          onPress={() => setActiveTab('inventory')}
        >
          <Boxes size={18} color={activeTab === 'inventory' ? '#006b2c' : '#64748b'} />
          <Text style={[styles.tabLabel, activeTab === 'inventory' && styles.tabLabelActive]}>
            Inventory
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'orders' && styles.tabItemActive]}
          onPress={() => setActiveTab('orders')}
        >
          <Truck size={18} color={activeTab === 'orders' ? '#006b2c' : '#64748b'} />
          <Text style={[styles.tabLabel, activeTab === 'orders' && styles.tabLabelActive]}>
            Orders
          </Text>
          {metrics.ordersToDeliver > 0 && (
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>{metrics.ordersToDeliver}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'employees' && styles.tabItemActive]}
          onPress={() => setActiveTab('employees')}
        >
          <Users size={18} color={activeTab === 'employees' ? '#006b2c' : '#64748b'} />
          <Text style={[styles.tabLabel, activeTab === 'employees' && styles.tabLabelActive]}>
            Staff
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'settings' && styles.tabItemActive]}
          onPress={() => setActiveTab('settings')}
        >
          <CreditCard size={18} color={activeTab === 'settings' ? '#006b2c' : '#64748b'} />
          <Text style={[styles.tabLabel, activeTab === 'settings' && styles.tabLabelActive]}>
            Payments
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* =====================================================================
            TAB 1: OVERVIEW & ANALYTICS
        ===================================================================== */}
        {activeTab === 'overview' && (
          <View>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Dashboard Overview</Text>
              <TouchableOpacity onPress={loadAllData} style={styles.refreshIconBtn}>
                <RefreshCw size={16} color="#006b2c" />
              </TouchableOpacity>
            </View>

            {/* Metrics Grid */}
            <View style={styles.metricsGrid}>
              <View style={[styles.metricCard, { borderLeftColor: '#006b2c' }]}>
                <Text style={styles.metricLabel}>Total Revenue</Text>
                <Text style={styles.metricVal}>₹{metrics.totalSales.toLocaleString('en-IN')}</Text>
                <Text style={styles.metricSub}>Live MySQL transactions</Text>
              </View>

              <View style={[styles.metricCard, { borderLeftColor: '#0284c7' }]}>
                <Text style={styles.metricLabel}>Total Orders</Text>
                <Text style={styles.metricVal}>{metrics.totalOrders}</Text>
                <Text style={styles.metricSub}>{metrics.pendingOrders} pending picking</Text>
              </View>

              <View style={[styles.metricCard, { borderLeftColor: '#d97706' }]}>
                <Text style={styles.metricLabel}>Orders to Deliver</Text>
                <Text style={styles.metricVal}>{metrics.ordersToDeliver}</Text>
                <Text style={styles.metricSub}>Awaiting delivery handover</Text>
              </View>

              <View style={[styles.metricCard, { borderLeftColor: '#8b5cf6' }]}>
                <Text style={styles.metricLabel}>Catalogue Size</Text>
                <Text style={styles.metricVal}>{products.length}</Text>
                <Text style={styles.metricSub}>{customers.length} registered customers</Text>
              </View>
            </View>

            {/* Quick Actions */}
            <Text style={[styles.sectionTitle, { marginTop: 18, marginBottom: 12 }]}>
              Quick Management
            </Text>
            <View style={styles.quickActionRow}>
              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={handleOpenAddProduct}
              >
                <Plus size={20} color="#006b2c" />
                <Text style={styles.quickActionText}>Add Product</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={handleAutoAssign}
              >
                <Truck size={20} color="#0284c7" />
                <Text style={styles.quickActionText}>Auto-Assign</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={() => setShowAddEmployeeModal(true)}
              >
                <Users size={20} color="#8b5cf6" />
                <Text style={styles.quickActionText}>Add Staff</Text>
              </TouchableOpacity>
            </View>

            {/* Recent Orders Preview */}
            <Text style={[styles.sectionTitle, { marginTop: 22, marginBottom: 12 }]}>
              Recent Orders
            </Text>
            {orders.slice(0, 5).map((ord) => (
              <View key={ord.id} style={styles.recentOrderCard}>
                <View style={styles.orderTop}>
                  <Text style={styles.orderId}>{ord.id}</Text>
                  <View style={styles.statusBadgeSmall}>
                    <Text style={styles.statusBadgeTextSmall}>{ord.status}</Text>
                  </View>
                </View>
                <Text style={styles.customerName}>{ord.customerName}</Text>
                <View style={styles.orderBtm}>
                  <Text style={styles.orderTotal}>₹{ord.total}</Text>
                  <Text style={styles.orderDate}>
                    {new Date(ord.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* =====================================================================
            TAB 2: INVENTORY & PRODUCTS
        ===================================================================== */}
        {activeTab === 'inventory' && (
          <View>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Product Inventory ({products.length})</Text>
              <TouchableOpacity
                style={styles.addPrimaryBtn}
                onPress={handleOpenAddProduct}
              >
                <Plus size={16} color="#fff" />
                <Text style={styles.addPrimaryBtnText}>New Product</Text>
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchBar}>
              <Search size={18} color="#64748b" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search products by title or category..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#94a3b8"
              />
            </View>

            {/* Product List */}
            {products
              .filter(
                (p) =>
                  !searchQuery ||
                  p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  p.category.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((prod) => (
                <View key={prod.id} style={styles.productAdminCard}>
                  <Image source={{ uri: prod.image }} style={styles.productAdminImg} />
                  <View style={styles.productAdminInfo}>
                    <Text style={styles.productAdminTitle}>{prod.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                      <Text style={styles.productAdminMeta}>
                        {prod.category} • {prod.unit} • ₹{prod.price}
                      </Text>
                      {prod.packSizes && prod.packSizes.length > 0 && (
                        <View style={styles.packSizeCountBadge}>
                          <Text style={styles.packSizeCountBadgeText}>
                            {prod.packSizes.length} Pack Sizes
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Stock level display */}
                    <View style={styles.stockModifierRow}>
                      <Text style={styles.stockLabel}>Stock: {prod.stock}</Text>
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={styles.productAdminActions}>
                    <TouchableOpacity
                      style={styles.actionIconBtn}
                      onPress={() => handleOpenEditProduct(prod)}
                    >
                      <Edit2 size={16} color="#0284c7" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionIconBtn}
                      onPress={() => handleDeleteProduct(prod)}
                    >
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
          </View>
        )}

        {/* =====================================================================
            TAB 3: ORDERS & DISPATCH
        ===================================================================== */}
        {activeTab === 'orders' && (
          <View>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Customer Orders ({orders.length})</Text>
              <TouchableOpacity style={styles.autoAssignHeaderBtn} onPress={handleAutoAssign}>
                <Truck size={14} color="#006b2c" />
                <Text style={styles.autoAssignHeaderText}>Auto-Assign All</Text>
              </TouchableOpacity>
            </View>

            {orders.map((ord) => (
              <View key={ord.id} style={styles.orderManageCard}>
                <View style={styles.orderManageHeader}>
                  <View>
                    <Text style={styles.orderManageId}>{ord.id}</Text>
                    <Text style={styles.orderManageCustomer}>{ord.customerName}</Text>
                    {ord.customerPhone ? (
                      <Text style={styles.orderManagePhone}>Phone: {ord.customerPhone}</Text>
                    ) : null}
                  </View>
                  <View style={styles.orderManageAmount}>
                    <Text style={styles.orderManagePrice}>₹{ord.total}</Text>
                    <Text style={styles.orderManagePayment}>{ord.paymentMethod || 'COD'}</Text>
                  </View>
                </View>

                <Text style={styles.orderManageAddress} numberOfLines={2}>
                  📍 {ord.deliveryAddress}
                </Text>

                {/* Items summary */}
                <View style={styles.orderItemsSummary}>
                  <Text style={styles.orderItemsCount}>
                    {ord.items?.length || 0} item{ord.items?.length === 1 ? '' : 's'}
                  </Text>
                  {ord.assignedEmployeeName ? (
                    <Text style={styles.assignedToText}>
                      Assigned: {ord.assignedEmployeeName}
                    </Text>
                  ) : (
                    <Text style={styles.unassignedText}>Unassigned</Text>
                  )}
                </View>

                {/* Status Picker Buttons */}
                <View style={styles.statusButtonsRow}>
                  {['Picking', 'Cold-Chain En Route', 'Delivered'].map((statusOption) => (
                    <TouchableOpacity
                      key={statusOption}
                      style={[
                        styles.statusSelectBtn,
                        ord.status === statusOption && styles.statusSelectBtnActive,
                      ]}
                      onPress={() => handleUpdateOrderStatus(ord.id, statusOption)}
                    >
                      <Text
                        style={[
                          styles.statusSelectText,
                          ord.status === statusOption && styles.statusSelectTextActive,
                        ]}
                      >
                        {statusOption === 'Cold-Chain En Route' ? 'En Route' : statusOption}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={styles.manualAssignBtn}
                    onPress={() => setAssigningOrder(ord)}
                  >
                    <Text style={styles.manualAssignBtnText}>Assign</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* =====================================================================
            TAB 4: EMPLOYEES & STAFF
        ===================================================================== */}
        {activeTab === 'employees' && (
          <View>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Delivery Staff ({employees.length})</Text>
              <TouchableOpacity
                style={styles.addPrimaryBtn}
                onPress={() => setShowAddEmployeeModal(true)}
              >
                <Plus size={16} color="#fff" />
                <Text style={styles.addPrimaryBtnText}>New Employee</Text>
              </TouchableOpacity>
            </View>

            {employees.map((emp) => (
              <View key={emp.employeeId} style={styles.employeeCardItem}>
                <View style={styles.employeeTopRow}>
                  <View>
                    <Text style={styles.employeeName}>{emp.fullName}</Text>
                    <Text style={styles.employeeEmail}>{emp.email}</Text>
                    <Text style={styles.employeeIdTag}>ID: {emp.employeeId}</Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.empStatusBtn,
                      emp.status === 'active' ? styles.empStatusActive : styles.empStatusInactive,
                    ]}
                    onPress={() => handleToggleEmployeeStatus(emp)}
                  >
                    <Text
                      style={[
                        styles.empStatusBtnText,
                        emp.status === 'active'
                          ? styles.empStatusTextActive
                          : styles.empStatusTextInactive,
                      ]}
                    >
                      {emp.status === 'active' ? 'Active' : 'Inactive'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {emp.mobile ? (
                  <Text style={styles.empMobile}>Phone: {emp.mobile}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {/* =====================================================================
            TAB 5: PAYMENTS & COUPONS & CUSTOMERS
        ===================================================================== */}
        {activeTab === 'settings' && (
          <View>
            {/* Payment Verification Queue */}
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>
                UPI Verification Queue ({verificationQueue.length})
              </Text>
            </View>

            {verificationQueue.length === 0 ? (
              <View style={styles.emptyCard}>
                <CheckCircle2 size={32} color="#006b2c" />
                <Text style={styles.emptyCardText}>No pending UPI payments to verify</Text>
              </View>
            ) : (
              verificationQueue.map((item) => (
                <View key={item.paymentId || item.orderId} style={styles.verifyCard}>
                  <View style={styles.verifyTop}>
                    <Text style={styles.verifyOrderId}>Order #{item.orderId}</Text>
                    <Text style={styles.verifyAmount}>₹{item.amount}</Text>
                  </View>
                  <Text style={styles.verifyCustName}>{item.customerName || 'Customer'}</Text>
                  <Text style={styles.verifyStatus}>Status: {item.paymentStatus}</Text>

                  <View style={styles.verifyActions}>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => handleVerifyPayment(item.orderId, 'APPROVE')}
                    >
                      <Check size={16} color="#fff" />
                      <Text style={styles.verifyBtnText}>Approve (Send OTP)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => handleVerifyPayment(item.orderId, 'REJECT')}
                    >
                      <X size={16} color="#fff" />
                      <Text style={styles.verifyBtnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            {/* Coupons Section */}
            <View style={[styles.sectionTitleRow, { marginTop: 24 }]}>
              <Text style={styles.sectionTitle}>Coupons ({coupons.length})</Text>
              <TouchableOpacity
                style={styles.addPrimaryBtn}
                onPress={() => setShowAddCouponModal(true)}
              >
                <Plus size={16} color="#fff" />
                <Text style={styles.addPrimaryBtnText}>New Coupon</Text>
              </TouchableOpacity>
            </View>

            {coupons.map((c) => (
              <View key={c.id || c.code} style={styles.couponCard}>
                <View style={styles.couponTop}>
                  <View style={styles.couponCodePill}>
                    <Tag size={14} color="#006b2c" />
                    <Text style={styles.couponCodeText}>{c.code}</Text>
                  </View>
                  <Text style={styles.couponDiscount}>{c.discountPercentage}% OFF</Text>
                </View>
                <Text style={styles.couponMinOrder}>Min Order: ₹{c.minOrderAmount}</Text>
              </View>
            ))}

            {/* Customers Directory */}
            <View style={[styles.sectionTitleRow, { marginTop: 24 }]}>
              <Text style={styles.sectionTitle}>Registered Customers ({customers.length})</Text>
            </View>
            {customers.slice(0, 10).map((c) => (
              <View key={c.id || c.customerId} style={styles.customerCardItem}>
                <Text style={styles.customerItemName}>{c.name}</Text>
                <Text style={styles.customerItemMeta}>
                  {c.email} • {c.phone}
                </Text>
                <Text style={styles.customerItemTier}>{c.loyaltyTier || 'Fresh Member'}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* =====================================================================
          ADD / EDIT PRODUCT MODAL
      ===================================================================== */}
      <Modal
        visible={showAddProductModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddProductModal(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '92%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </Text>
              <TouchableOpacity onPress={() => setShowAddProductModal(false)}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {/* Product Name */}
              <Text style={styles.formLabel}>Product Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Sona Masoori Rice / Organic Farm Bananas"
                placeholderTextColor="#94a3b8"
                value={productForm.title}
                onChangeText={(v) => setProductForm({ ...productForm, title: v })}
              />

              {/* Category (Manual Entry Only) */}
              <Text style={styles.formLabel}>Category *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Fruits & Vegetables, Dairy, Bakery, Beverages, Spices..."
                placeholderTextColor="#94a3b8"
                value={productForm.category}
                onChangeText={(v) => setProductForm({ ...productForm, category: v })}
              />

              {/* Unit / Pack Size (Manual Entry Only) */}
              <Text style={styles.formLabel}>Unit / Pack Size *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. 100 g, 250 g, 500 g, 1 kg, 500 ml, 1 litre, 1 piece..."
                placeholderTextColor="#94a3b8"
                value={productForm.unit}
                onChangeText={handleUnitChange}
              />

              {/* Price & Stock Row */}
              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.formLabel}>Price (₹) *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. 90"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={productForm.price}
                    onChangeText={handlePriceChange}
                  />
                </View>

                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.formLabel}>Stock Quantity *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. 50"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    value={productForm.stock}
                    onChangeText={handleStockChange}
                  />
                </View>
              </View>

              {/* DEDICATED SECTION: Pack Sizes, Prices, Stock & Availability */}
              <View style={styles.packSizesSectionCard}>
                <View style={styles.packSizesHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.packSizesSectionTitle}>
                      Pack Sizes, Prices, Stock & Availability
                    </Text>
                    <Text style={styles.packSizesSectionSubtitle}>
                      Configure independent prices, stock, and availability status for each pack size.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.addPackSizeBtn}
                    onPress={handleAddPackSizeRow}
                  >
                    <Plus size={14} color="#ffffff" />
                    <Text style={styles.addPackSizeBtnText}>Add Pack Size</Text>
                  </TouchableOpacity>
                </View>

                {/* Pack Size Rows */}
                <View style={styles.packRowsList}>
                  {productForm.packSizes.map((ps, idx) => {
                    const isDefault = idx === 0;
                    const isAvailable = ps.isAvailable !== false;

                    return (
                      <View
                        key={`pack-${idx}`}
                        style={[styles.packSizeRowCard, isDefault && styles.packSizeRowDefault]}
                      >
                        {/* Row Header: Sub-unit # & Delete Option */}
                        <View style={styles.packRowTopLine}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.packRowIndexLabel}>Sub-Unit #{idx + 1}</Text>
                            {isDefault && (
                              <View style={styles.defaultPackBadge}>
                                <Text style={styles.defaultPackBadgeText}>Default Unit</Text>
                              </View>
                            )}
                          </View>

                          {/* Delete option */}
                          {!isDefault && (
                            <TouchableOpacity
                              onPress={() => handleRemovePackSizeRow(idx)}
                              style={styles.deletePackBtn}
                              accessibilityLabel={`Remove pack size ${ps.size}`}
                            >
                              <Trash2 size={16} color="#ef4444" />
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Input Fields */}
                        <View style={styles.packInputsRow}>
                          {/* Pack Size */}
                          <View style={{ flex: 1.2, marginRight: 6 }}>
                            <Text style={styles.packInputMiniLabel}>Pack Size</Text>
                            <TextInput
                              style={styles.packMiniInput}
                              placeholder="e.g. 500 g"
                              placeholderTextColor="#94a3b8"
                              value={ps.size}
                              onChangeText={(v) => handlePackSizeNameChange(idx, v)}
                            />
                          </View>

                          {/* Price */}
                          <View style={{ flex: 0.9, marginRight: 6 }}>
                            <Text style={styles.packInputMiniLabel}>Price (₹)</Text>
                            <TextInput
                              style={styles.packMiniInput}
                              placeholder="₹0"
                              placeholderTextColor="#94a3b8"
                              keyboardType="numeric"
                              value={ps.price > 0 ? String(ps.price) : ''}
                              onChangeText={(v) => handlePackSizePriceChange(idx, parseFloat(v) || 0)}
                            />
                          </View>

                          {/* Stock Quantity */}
                          <View style={{ flex: 0.9 }}>
                            <Text style={styles.packInputMiniLabel}>Stock Qty</Text>
                            <TextInput
                              style={styles.packMiniInput}
                              placeholder="0"
                              placeholderTextColor="#94a3b8"
                              keyboardType="numeric"
                              value={ps.stock !== undefined ? String(ps.stock) : ''}
                              onChangeText={(v) => handlePackSizeStockChange(idx, parseInt(v, 10) || 0)}
                            />
                          </View>
                        </View>

                        {/* Availability Status Toggle */}
                        <View style={styles.packRowStatusLine}>
                          <Text style={styles.packStatusPrompt}>Availability Status:</Text>
                          <TouchableOpacity
                            style={[
                              styles.availabilityToggleBtn,
                              isAvailable ? styles.availabilityBtnActive : styles.availabilityBtnInactive,
                            ]}
                            onPress={() => handleTogglePackSizeAvailability(idx)}
                          >
                            {isAvailable ? (
                              <>
                                <Check size={14} color="#006b2c" strokeWidth={3} />
                                <Text style={styles.availabilityTextActive}>Available</Text>
                              </>
                            ) : (
                              <>
                                <X size={14} color="#dc2626" strokeWidth={3} />
                                <Text style={styles.availabilityTextInactive}>Unavailable</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Product Image */}
              <View style={styles.imageSection}>
                <Text style={styles.formLabel}>Product Image</Text>
                <View style={styles.imagePreviewRow}>
                  {productForm.image ? (
                    <Image source={{ uri: productForm.image }} style={styles.imagePreviewThumb} />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <ImageIcon size={24} color="#94a3b8" />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 8 }}>
                    <TouchableOpacity style={styles.uploadImgBtn} onPress={handlePickImage}>
                      <Upload size={15} color="#006b2c" />
                      <Text style={styles.uploadImgBtnText}>Choose from Gallery</Text>
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.formInput, { marginBottom: 0 }]}
                      placeholder="Or paste Image URL..."
                      placeholderTextColor="#94a3b8"
                      value={productForm.image}
                      onChangeText={(v) => setProductForm({ ...productForm, image: v })}
                    />
                  </View>
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleSaveProduct}>
                <Text style={styles.saveSubmitBtnText}>
                  {editingProduct ? 'Save Changes' : 'Add Product'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* =====================================================================
          ADD EMPLOYEE MODAL
      ===================================================================== */}
      <Modal
        visible={showAddEmployeeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddEmployeeModal(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Provision New Employee</Text>
              <TouchableOpacity onPress={() => setShowAddEmployeeModal(false)}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.formLabel}>Full Name</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Vikram Singh"
                value={employeeForm.fullName}
                onChangeText={(v) => setEmployeeForm({ ...employeeForm, fullName: v })}
              />

              <Text style={styles.formLabel}>Email Address</Text>
              <TextInput
                style={styles.formInput}
                placeholder="vikram@freshcart.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={employeeForm.email}
                onChangeText={(v) => setEmployeeForm({ ...employeeForm, email: v })}
              />

              <Text style={styles.formLabel}>Mobile Number</Text>
              <TextInput
                style={styles.formInput}
                placeholder="+91 9876543210"
                keyboardType="phone-pad"
                value={employeeForm.mobile}
                onChangeText={(v) => setEmployeeForm({ ...employeeForm, mobile: v })}
              />

              <Text style={styles.formLabel}>Login Password</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Minimum 6 characters"
                secureTextEntry
                value={employeeForm.password}
                onChangeText={(v) => setEmployeeForm({ ...employeeForm, password: v })}
              />

              <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleSaveEmployee}>
                <Text style={styles.saveSubmitBtnText}>Register Staff Member</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* =====================================================================
          ADD COUPON MODAL
      ===================================================================== */}
      <Modal
        visible={showAddCouponModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddCouponModal(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Discount Coupon</Text>
              <TouchableOpacity onPress={() => setShowAddCouponModal(false)}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.formLabel}>Coupon Code</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. FRESH20"
                autoCapitalize="characters"
                value={couponForm.code}
                onChangeText={(v) => setCouponForm({ ...couponForm, code: v })}
              />

              <Text style={styles.formLabel}>Discount Percentage (%)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="20"
                keyboardType="numeric"
                value={couponForm.discountPercentage}
                onChangeText={(v) => setCouponForm({ ...couponForm, discountPercentage: v })}
              />

              <Text style={styles.formLabel}>Minimum Order Amount (₹)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="500"
                keyboardType="numeric"
                value={couponForm.minOrderAmount}
                onChangeText={(v) => setCouponForm({ ...couponForm, minOrderAmount: v })}
              />

              <TouchableOpacity style={styles.saveSubmitBtn} onPress={handleSaveCoupon}>
                <Text style={styles.saveSubmitBtnText}>Publish Coupon</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* =====================================================================
          MANUAL ASSIGN MODAL
      ===================================================================== */}
      <Modal
        visible={!!assigningOrder}
        transparent
        animationType="slide"
        onRequestClose={() => setAssigningOrder(null)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Assign Order #{assigningOrder?.id}
              </Text>
              <TouchableOpacity onPress={() => setAssigningOrder(null)}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.assignSubtitle}>
              Select active delivery employee to dispatch this order:
            </Text>

            {employees.length === 0 ? (
              <Text style={styles.noStaffText}>No active employees registered.</Text>
            ) : (
              employees.map((emp) => (
                <TouchableOpacity
                  key={emp.employeeId}
                  style={styles.empAssignOption}
                  onPress={() => handleAssignToEmployee(assigningOrder?.id, emp.employeeId)}
                >
                  <View>
                    <Text style={styles.empAssignName}>{emp.fullName}</Text>
                    <Text style={styles.empAssignEmail}>{emp.email}</Text>
                  </View>
                  <ChevronRight size={18} color="#006b2c" />
                </TouchableOpacity>
              ))
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#006b2c',
  },
  tabLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 4,
  },
  tabLabelActive: {
    color: '#006b2c',
    fontWeight: '700',
  },
  badgePill: {
    position: 'absolute',
    top: 6,
    right: 12,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgePillText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  refreshIconBtn: {
    padding: 6,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  metricCard: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  metricVal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginVertical: 4,
  },
  metricSub: {
    fontSize: 10,
    color: '#94a3b8',
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  quickActionBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  recentOrderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  orderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderId: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  statusBadgeSmall: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeTextSmall: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  customerName: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 8,
  },
  orderBtm: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#006b2c',
  },
  orderDate: {
    fontSize: 11,
    color: '#94a3b8',
  },
  addPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#006b2c',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addPrimaryBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
  },
  productAdminCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  productAdminImg: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    marginRight: 12,
  },
  productAdminInfo: {
    flex: 1,
  },
  productAdminTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  productAdminMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 6,
  },
  stockModifierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  stockLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  stockStepperBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stockStepperText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  stockBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stockBadgeLow: {
    backgroundColor: '#fef2f2',
  },
  stockBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#166534',
  },
  stockBadgeTextLow: {
    color: '#dc2626',
  },
  productAdminActions: {
    gap: 8,
    marginLeft: 6,
  },
  actionIconBtn: {
    padding: 6,
  },
  autoAssignHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  autoAssignHeaderText: {
    fontSize: 11,
    color: '#006b2c',
    fontWeight: '700',
  },
  orderManageCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  orderManageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  orderManageId: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  orderManageCustomer: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  orderManagePhone: {
    fontSize: 11,
    color: '#64748b',
  },
  orderManageAmount: {
    alignItems: 'flex-end',
  },
  orderManagePrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#006b2c',
  },
  orderManagePayment: {
    fontSize: 10,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  orderManageAddress: {
    fontSize: 12,
    color: '#64748b',
    marginVertical: 6,
  },
  orderItemsSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  orderItemsCount: {
    fontSize: 11,
    color: '#475569',
  },
  assignedToText: {
    fontSize: 11,
    color: '#0284c7',
    fontWeight: '600',
  },
  unassignedText: {
    fontSize: 11,
    color: '#d97706',
    fontWeight: '600',
  },
  statusButtonsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  statusSelectBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  statusSelectBtnActive: {
    backgroundColor: '#006b2c',
  },
  statusSelectText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  statusSelectTextActive: {
    color: '#ffffff',
  },
  manualAssignBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#7dd3fc',
    alignItems: 'center',
  },
  manualAssignBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284c7',
  },
  employeeCardItem: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  employeeTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  employeeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  employeeEmail: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  employeeIdTag: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  empMobile: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 6,
  },
  empStatusBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  empStatusActive: {
    backgroundColor: '#f0fdf4',
  },
  empStatusInactive: {
    backgroundColor: '#fef2f2',
  },
  empStatusBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  empStatusTextActive: {
    color: '#166534',
  },
  empStatusTextInactive: {
    color: '#b91c1c',
  },
  verifyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  verifyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  verifyOrderId: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  verifyAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#006b2c',
  },
  verifyCustName: {
    fontSize: 13,
    color: '#334155',
  },
  verifyStatus: {
    fontSize: 11,
    color: '#64748b',
    marginVertical: 6,
  },
  verifyActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#006b2c',
    paddingVertical: 8,
    borderRadius: 8,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ef4444',
    paddingVertical: 8,
    borderRadius: 8,
  },
  verifyBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyCardText: {
    fontSize: 13,
    color: '#64748b',
  },
  couponCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  couponTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  couponCodePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  couponCodeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#006b2c',
  },
  couponDiscount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#006b2c',
  },
  couponMinOrder: {
    fontSize: 11,
    color: '#64748b',
  },
  customerCardItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  customerItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  customerItemMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  customerItemTier: {
    fontSize: 10,
    color: '#0284c7',
    fontWeight: '600',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  formInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 12,
  },
  formRow: {
    flexDirection: 'row',
  },
  saveSubmitBtn: {
    backgroundColor: '#006b2c',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  saveSubmitBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  assignSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
  },
  noStaffText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 20,
  },
  empAssignOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  empAssignName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  empAssignEmail: {
    fontSize: 11,
    color: '#64748b',
  },
  categoryPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  categorySmallPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  categorySmallPillActive: {
    backgroundColor: '#006b2c',
    borderColor: '#006b2c',
  },
  categorySmallPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  categorySmallPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  packSizesSectionCard: {
    marginTop: 14,
    marginBottom: 14,
    padding: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#86efac',
  },
  packSizesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  packSizesSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#006b2c',
  },
  packSizesSectionSubtitle: {
    fontSize: 11,
    color: '#166534',
    marginTop: 2,
  },
  addPackSizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#006b2c',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addPackSizeBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  quickAddBar: {
    borderTopWidth: 1,
    borderTopColor: '#bbf7d0',
    paddingTop: 8,
    marginBottom: 10,
  },
  quickAddLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 4,
  },
  quickAddScroll: {
    gap: 6,
    alignItems: 'center',
  },
  quickAddChip: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  quickAddChipDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    opacity: 0.6,
  },
  quickAddChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#006b2c',
  },
  quickAddChipTextDisabled: {
    color: '#94a3b8',
  },
  packRowsList: {
    gap: 8,
  },
  packSizeRowCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 10,
  },
  packSizeRowDefault: {
    borderColor: '#00e676',
    borderWidth: 1.5,
  },
  packRowTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  packRowIndexLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  defaultPackBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  defaultPackBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#006b2c',
  },
  deletePackBtn: {
    padding: 4,
  },
  packInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  packInputMiniLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 2,
  },
  packMiniInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  packRowStatusLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  packStatusPrompt: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  availabilityToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  availabilityBtnActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  availabilityBtnInactive: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  availabilityTextActive: {
    fontSize: 11,
    fontWeight: '800',
    color: '#006b2c',
  },
  availabilityTextInactive: {
    fontSize: 11,
    fontWeight: '800',
    color: '#dc2626',
  },
  imageSection: {
    marginVertical: 10,
  },
  imagePreviewRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  imagePreviewThumb: {
    width: 70,
    height: 70,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  imagePlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadImgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  uploadImgBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#006b2c',
  },
  packSizeCountBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  packSizeCountBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369a1',
  },
});
