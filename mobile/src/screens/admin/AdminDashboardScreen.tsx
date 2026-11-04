import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  Package,
  AlertTriangle,
  Truck,
  LogOut,
  RefreshCw,
  CheckCircle2,
  Grid,
  ArrowLeft,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../../services/apiClient';
import { Header } from '../../components/common/Header';
import { Product, Order, AuthorizedEmployee, Coupon, InventoryLog } from '../../types';
import { AdminNavigationTabs, AdminPortalSectionId } from './AdminNavigationTabs';
import { AdminQuickMenuModal } from './AdminQuickMenuModal';

// 11 Modular Section Components
import { LiveInventorySection } from './sections/LiveInventorySection';
import { CdcLogsSection } from './sections/CdcLogsSection';
import { CouponsSection } from './sections/CouponsSection';
import { CustomerOrdersSection } from './sections/CustomerOrdersSection';
import { DeliveryChargesSection } from './sections/DeliveryChargesSection';
import { UpiSettingsSection } from './sections/UpiSettingsSection';
import { PaymentVerificationSection } from './sections/PaymentVerificationSection';
import { AuthorizedAdminsSection } from './sections/AuthorizedAdminsSection';
import { EmployeeManagementSection } from './sections/EmployeeManagementSection';
import { CustomerAccountsSection } from './sections/CustomerAccountsSection';
import { OrdersCalendarSection } from './sections/OrdersCalendarSection';

export const AdminDashboardScreen: React.FC = () => {
  const { currentAdmin, adminToken, logout, setActivePortal } = useAuth();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'android'
    ? Math.max(insets.top, RNStatusBar.currentHeight || 0, 24)
    : insets.top;
  const bottomInset = insets.bottom;

  const [activeSection, setActiveSection] = useState<AdminPortalSectionId>('inventory');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Core Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [employees, setEmployees] = useState<AuthorizedEmployee[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);
  const [ordersToDeliver, setOrdersToDeliver] = useState<any[]>([]);
  const [verificationQueue, setVerificationQueue] = useState<any[]>([]);
  const [adminsCount, setAdminsCount] = useState({ active: 2, max: 5 });

  // Load all live backend data from MySQL
  const loadAllData = useCallback(async () => {
    if (!adminToken) return;
    setIsRefreshing(true);
    try {
      const [
        prodRes,
        orderRes,
        empRes,
        custRes,
        coupRes,
        deliverRes,
        verifyRes,
        logsRes,
        adminsRes,
      ] = await Promise.all([
        adminApi.getProducts().catch(() => []),
        adminApi.getOrders(adminToken).catch(() => []),
        adminApi.getEmployees(adminToken).catch(() => null),
        adminApi.getCustomers(adminToken).catch(() => null),
        adminApi.getCoupons().catch(() => []),
        adminApi.getOrdersToDeliver(adminToken).catch(() => null),
        adminApi.getPaymentVerificationQueue(adminToken).catch(() => null),
        adminApi.getInventoryLogs(adminToken).catch(() => []),
        adminApi.getAuthorizedAdmins(adminToken).catch(() => null),
      ]);

      if (Array.isArray(prodRes)) setProducts(prodRes);
      if (Array.isArray(orderRes)) setOrders(orderRes);
      if (empRes?.success && Array.isArray(empRes.employees)) setEmployees(empRes.employees);
      if (custRes?.success && Array.isArray(custRes.customers)) setCustomers(custRes.customers);
      if (Array.isArray(coupRes)) setCoupons(coupRes);
      if (deliverRes?.success && Array.isArray(deliverRes.orders)) setOrdersToDeliver(deliverRes.orders);
      if (verifyRes?.success && Array.isArray(verifyRes.payments)) setVerificationQueue(verifyRes.payments);
      if (Array.isArray(logsRes)) setInventoryLogs(logsRes);
      if (adminsRes?.success) {
        setAdminsCount({
          active: typeof adminsRes.activeCount === 'number' ? adminsRes.activeCount : 2,
          max: typeof adminsRes.maxLimit === 'number' ? adminsRes.maxLimit : 5,
        });
      }
    } catch (err) {
      console.warn('Admin live data fetch error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [adminToken]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    RNStatusBar.setBarStyle('light-content');
  }, []);

  // Derived KPI Counts
  const totalSkus = products.length;
  const lowStockCount = useMemo(
    () => products.filter((p) => p.stock >= 1 && p.stock <= 5).length,
    [products]
  );
  const outOfStockCount = useMemo(
    () => products.filter((p) => p.stock <= 0).length,
    [products]
  );
  const totalStockWarnings = lowStockCount + outOfStockCount;

  const pendingVerificationCount = useMemo(
    () =>
      verificationQueue.filter(
        (i) =>
          i.paymentStatus === 'PENDING_VERIFICATION' ||
          i.paymentStatus === 'PENDING' ||
          (!i.verifiedAt && i.paymentStatus !== 'PAID' && i.paymentStatus !== 'COMPLETED')
      ).length,
    [verificationQueue]
  );

  const displayedOrdersToDeliver = ordersToDeliver.length || orders.filter((o) => o.status === 'Picking' || o.status === 'Cold-Chain En Route').length;

  // Clear CDC logs handler
  const handleClearLogs = () => {
    setInventoryLogs([]);
    setToastMessage('Cleared CDC audit log history from view.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDeleteLog = (logId: string) => {
    setInventoryLogs((prev) => prev.filter((l) => l.id !== logId));
  };

  // Simulate CDC Pulse
  const handleSimulateCdcPulse = async () => {
    if (!adminToken) return;
    const candidate = products.find((p) => p.stock > 1);
    if (!candidate) {
      Alert.alert('Notice', 'No products available with sufficient stock to simulate sale.');
      return;
    }
    try {
      await adminApi.updateProduct(adminToken, candidate.id, {
        stock: candidate.stock - 1,
      });
      setToastMessage(`Simulated live CDC purchase for "${candidate.title}". Stock synchronized.`);
      setTimeout(() => setToastMessage(null), 3500);
      loadAllData();
    } catch {
      Alert.alert('Notice', 'Could not simulate pulse.');
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to exit the Admin Portal?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  return (
    <View style={styles.screenContainer}>
      <StatusBar style="light" />

      {/* Top Header Bar - Full Width, Positioned below Android Status Bar */}
      <View style={[styles.topHeader, { paddingTop: topInset + 10 }]}>
        <View style={styles.topHeaderLeft}>
          <View style={styles.storeTitleRow}>
            <Text style={styles.storeBrand}>FreshCart <Text style={styles.storeBrandSlash}>/</Text></Text>
            <Text style={styles.storeTitle} numberOfLines={1}>
              Store #104
            </Text>
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          </View>
          <Text style={styles.adminName} numberOfLines={1}>
            {currentAdmin?.fullName || 'FreshCart Project Owner'} ·{' '}
            <Text style={styles.adminRole}>
              {currentAdmin?.role === 'owner' ? 'Project Owner' : 'Operations Admin'}
            </Text>
          </Text>
        </View>

        <View style={styles.topHeaderRight}>
          <TouchableOpacity
            style={styles.refreshIconBtn}
            onPress={loadAllData}
            disabled={isRefreshing}
            accessibilityLabel="Refresh All Data"
          >
            <RefreshCw
              size={16}
              color="#34d399"
              style={isRefreshing ? { transform: [{ rotate: '45deg' }] } : {}}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            accessibilityLabel="Sign Out"
          >
            <LogOut size={16} color="#f87171" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Complete 11-Section Navigation Bar - Full Width with Horizontal Scroll */}
      <AdminNavigationTabs
        activeSection={activeSection}
        onSelectSection={(id) => setActiveSection(id)}
        onOpenQuickMenu={() => setIsQuickMenuOpen(true)}
        pendingVerificationCount={pendingVerificationCount}
        activeAdminsCount={adminsCount.active}
        maxAdminsLimit={adminsCount.max}
        customerAccountsCount={customers.length}
      />

      {/* Main Full-Width Vertically Scrollable Content */}
      <ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={[
          styles.mainScrollContent,
          { paddingBottom: Math.max(bottomInset, 16) + 30 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={loadAllData}
            tintColor="#10b981"
            colors={['#10b981']}
          />
        }
          >
            {/* Pulse Toast Banner */}
            {toastMessage && (
              <View style={styles.toastBanner}>
                <CheckCircle2 size={15} color="#34d399" />
                <Text style={styles.toastText}>{toastMessage}</Text>
              </View>
            )}

            {/* Top 3 KPI Metric Cards (Matching Website Admin Dashboard) */}
            <View style={styles.kpiContainer}>
              <TouchableOpacity
                style={styles.kpiCard}
                onPress={() => setActiveSection('inventory')}
                activeOpacity={0.8}
              >
                <View style={styles.kpiLeft}>
                  <Text style={styles.kpiTitle} numberOfLines={2}>
                    Total SKUs Monitored
                  </Text>
                  <Text style={styles.kpiValue}>{totalSkus}</Text>
                </View>
                <View style={[styles.kpiIconBox, { backgroundColor: '#064e3b' }]}>
                  <Package size={15} color="#34d399" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.kpiCard}
                onPress={() => setActiveSection('inventory')}
                activeOpacity={0.8}
              >
                <View style={styles.kpiLeft}>
                  <Text style={styles.kpiTitle} numberOfLines={2}>
                    Stock Warnings
                  </Text>
                  <Text style={[styles.kpiValue, { color: '#f59e0b' }]}>
                    {totalStockWarnings}
                  </Text>
                </View>
                <View style={[styles.kpiIconBox, { backgroundColor: '#78350f' }]}>
                  <AlertTriangle size={15} color="#f59e0b" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.kpiCard}
                onPress={() => setActiveSection('orders')}
                activeOpacity={0.8}
              >
                <View style={styles.kpiLeft}>
                  <Text style={styles.kpiTitle} numberOfLines={2}>
                    Orders to Deliver
                  </Text>
                  <Text style={[styles.kpiValue, { color: '#38bdf8' }]}>
                    {displayedOrdersToDeliver}
                  </Text>
                </View>
                <View style={[styles.kpiIconBox, { backgroundColor: '#0c4a6e' }]}>
                  <Truck size={15} color="#38bdf8" />
                </View>
              </TouchableOpacity>
            </View>

            {/* Active Section Header Bar */}
            <View style={styles.activeSectionHeader}>
              <Text style={styles.activeSectionTitle}>
                {activeSection === 'inventory' && 'Live Inventory Management'}
                {activeSection === 'logs' && 'CDC Audit & Dispatch Logs'}
                {activeSection === 'coupons' && 'Coupons Management'}
                {activeSection === 'orders' && 'Customer Orders'}
                {activeSection === 'delivery-charges' && 'Delivery Charges Configuration'}
                {activeSection === 'upi-settings' && 'UPI Settings & Merchant Config'}
                {activeSection === 'payment-verification' && 'Payment Verification Queue'}
                {activeSection === 'admins' && 'Authorized Administrator Management'}
                {activeSection === 'employees' && 'Employee & Staff Management'}
                {activeSection === 'customers' && 'Customer Accounts Directory'}
                {activeSection === 'calendar' && 'Orders & Transactions Calendar'}
              </Text>

              <TouchableOpacity
                style={styles.sectionMenuBtn}
                onPress={() => setIsQuickMenuOpen(true)}
              >
                <Grid size={13} color="#10b981" />
                <Text style={styles.sectionMenuBtnText}>All Sections</Text>
              </TouchableOpacity>
            </View>

            {/* Render 1 of 11 Fully Functional Sections */}
            {activeSection === 'inventory' && (
              <LiveInventorySection
                products={products}
                adminToken={adminToken}
                onRefresh={loadAllData}
              />
            )}

            {activeSection === 'logs' && (
              <CdcLogsSection
                logs={inventoryLogs}
                adminToken={adminToken}
                onRefresh={loadAllData}
                onClearLogs={handleClearLogs}
                onDeleteLog={handleDeleteLog}
                onSimulatePulse={handleSimulateCdcPulse}
              />
            )}

            {activeSection === 'coupons' && (
              <CouponsSection
                coupons={coupons}
                adminToken={adminToken}
                onRefresh={loadAllData}
              />
            )}

            {activeSection === 'orders' && (
              <CustomerOrdersSection
                orders={orders}
                employees={employees}
                adminToken={adminToken}
                onRefresh={loadAllData}
              />
            )}

            {activeSection === 'delivery-charges' && (
              <DeliveryChargesSection adminToken={adminToken} />
            )}

            {activeSection === 'upi-settings' && (
              <UpiSettingsSection adminToken={adminToken} />
            )}

            {activeSection === 'payment-verification' && (
              <PaymentVerificationSection
                queue={verificationQueue}
                adminToken={adminToken}
                onRefresh={loadAllData}
              />
            )}

            {activeSection === 'admins' && (
              <AuthorizedAdminsSection
                currentAdmin={currentAdmin}
                adminToken={adminToken}
              />
            )}

            {activeSection === 'employees' && (
              <EmployeeManagementSection
                employees={employees}
                adminToken={adminToken}
                onRefresh={loadAllData}
              />
            )}

            {activeSection === 'customers' && (
              <CustomerAccountsSection
                customers={customers}
                adminToken={adminToken}
                onRefresh={loadAllData}
              />
            )}

            {activeSection === 'calendar' && (
              <OrdersCalendarSection adminToken={adminToken} />
            )}

            {/* Return to Portal Selection Link at the bottom of the dashboard */}
            <View style={styles.bottomNavContainer}>
              <TouchableOpacity
                style={styles.backToPortalBtn}
                onPress={() => setActivePortal('selection')}
                activeOpacity={0.8}
              >
                <ArrowLeft size={16} color="#10b981" />
                <Text style={styles.backToPortalText}>Back to Portal Selection</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

      {/* Quick Menu Modal for Instant Jumping across 11 Sections */}
      <AdminQuickMenuModal
        visible={isQuickMenuOpen}
        activeSection={activeSection}
        onSelectSection={(id) => setActiveSection(id)}
        onClose={() => setIsQuickMenuOpen(false)}
        pendingVerificationCount={pendingVerificationCount}
        activeAdminsCount={adminsCount.active}
        maxAdminsLimit={adminsCount.max}
        customerAccountsCount={customers.length}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#030712',
    width: '100%',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    width: '100%',
  },
  topHeaderLeft: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  storeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  storeBrand: {
    fontSize: 14,
    fontWeight: '900',
    color: '#10b981',
    letterSpacing: 0.2,
  },
  storeBrandSlash: {
    color: '#64748b',
    fontWeight: '400',
  },
  storeTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: 0.2,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#064e3b',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  onlineText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#34d399',
  },
  adminName: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 3,
  },
  adminRole: {
    color: '#10b981',
    fontWeight: '700',
  },
  topHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  refreshIconBtn: {
    padding: 8,
    backgroundColor: '#1e293b',
    borderRadius: 8,
  },
  logoutBtn: {
    padding: 8,
    backgroundColor: '#7f1d1d',
    borderRadius: 8,
  },
  mainScrollView: {
    flex: 1,
    width: '100%',
  },
  mainScrollContent: {
    paddingTop: 12,
    width: '100%',
  },
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#064e3b',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 10,
  },
  toastText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  kpiContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
    width: '100%',
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 0,
  },
  kpiLeft: {
    flex: 1,
    minWidth: 0,
    marginRight: 4,
  },
  kpiTitle: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '600',
    textTransform: 'uppercase',
    lineHeight: 12,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
    marginTop: 3,
  },
  kpiIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activeSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    marginBottom: 6,
    width: '100%',
  },
  activeSectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#34d399',
    letterSpacing: 0.2,
    flex: 1,
    marginRight: 8,
  },
  sectionMenuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    flexShrink: 0,
  },
  sectionMenuBtnText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '700',
  },
  bottomNavContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    alignItems: 'center',
  },
  backToPortalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  backToPortalText: {
    color: '#10b981',
    fontSize: 12.5,
    fontWeight: '700',
  },
});
