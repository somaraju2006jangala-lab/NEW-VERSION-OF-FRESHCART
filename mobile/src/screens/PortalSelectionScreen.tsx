import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import {
  ShieldCheck,
  Truck,
  ShoppingBag,
  ArrowRight,
  Server,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Leaf,
  Layers,
} from 'lucide-react-native';
import { PortalType, useAuth } from '../context/AuthContext';
import { getApiBaseUrl } from '../config/api';
import { ServerConfigModal } from '../components/common/ServerConfigModal';

interface PortalSelectionScreenProps {
  onSelectPortal: (portal: PortalType) => void;
}

export const PortalSelectionScreen: React.FC<PortalSelectionScreenProps> = ({ onSelectPortal }) => {
  const { currentAdmin, currentEmployee, currentCustomer } = useAuth();
  const [serverUrl, setServerUrl] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  useEffect(() => {
    checkServer();
  }, []);

  const checkServer = async () => {
    const url = await getApiBaseUrl();
    setServerUrl(url);
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${url}/api/products`, { signal: controller.signal });
      clearTimeout(id);
      setServerOnline(res.ok);
    } catch {
      setServerOnline(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top Hero Brand */}
        <View style={styles.brandHero}>
          <View style={styles.logoBadge}>
            <Leaf size={32} color="#ffffff" />
          </View>
          <Text style={styles.brandName}>FreshCart</Text>
          <Text style={styles.brandTagline}>Farm-Fresh Grocery Management & Shopping</Text>

          {/* Connection status pill */}
          <TouchableOpacity style={styles.statusPill} onPress={() => setShowConfig(true)}>
            <View
              style={[
                styles.statusDot,
                serverOnline === true
                  ? styles.statusDotOnline
                  : serverOnline === false
                  ? styles.statusDotOffline
                  : styles.statusDotUnknown,
              ]}
            />
            <Text style={styles.statusText}>
              {serverOnline === true
                ? 'Backend Connected (MySQL Live)'
                : serverOnline === false
                ? 'Offline – Tap to configure IP'
                : 'Checking server...'}
            </Text>
            <Server size={12} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Portal Selection Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Select Access Portal</Text>
          <Text style={styles.sectionSubtitle}>
            Choose your authorized role to enter FreshCart
          </Text>
        </View>

        {/* 1. Admin Portal Card */}
        <TouchableOpacity
          style={[styles.portalCard, styles.adminCard]}
          activeOpacity={0.88}
          onPress={() => onSelectPortal('admin')}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.iconWrapper, styles.adminIconWrapper]}>
              <ShieldCheck size={28} color="#006b2c" />
            </View>
            <View style={styles.cardBadge}>
              <Text style={styles.cardBadgeTextAdmin}>
                {currentAdmin ? 'Signed In' : 'Admin & Owner'}
              </Text>
            </View>
          </View>
          <Text style={styles.portalTitle}>Admin Portal</Text>
          <Text style={styles.portalDesc}>
            Manage inventory, add stock, manage products, view sales analytics, manage employees & approve payments.
          </Text>
          <View style={styles.cardFooter}>
            <Text style={styles.adminActionText}>
              {currentAdmin ? `Continue as ${currentAdmin.fullName}` : 'Open Admin Login'}
            </Text>
            <ArrowRight size={18} color="#006b2c" />
          </View>
        </TouchableOpacity>

        {/* 2. Employee Portal Card */}
        <TouchableOpacity
          style={[styles.portalCard, styles.employeeCard]}
          activeOpacity={0.88}
          onPress={() => onSelectPortal('employee')}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.iconWrapper, styles.employeeIconWrapper]}>
              <Truck size={28} color="#0284c7" />
            </View>
            <View style={styles.cardBadge}>
              <Text style={styles.cardBadgeTextEmployee}>
                {currentEmployee ? 'Signed In' : 'Delivery & Staff'}
              </Text>
            </View>
          </View>
          <Text style={styles.portalTitle}>Employee Portal</Text>
          <Text style={styles.portalDesc}>
            View assigned delivery orders, order items breakdown, customer addresses & verify delivery OTPs.
          </Text>
          <View style={styles.cardFooter}>
            <Text style={styles.employeeActionText}>
              {currentEmployee ? `Continue as ${currentEmployee.fullName}` : 'Open Staff Login'}
            </Text>
            <ArrowRight size={18} color="#0284c7" />
          </View>
        </TouchableOpacity>

        {/* 3. Customer Portal Card */}
        <TouchableOpacity
          style={[styles.portalCard, styles.customerCard]}
          activeOpacity={0.88}
          onPress={() => onSelectPortal('customer')}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.iconWrapper, styles.customerIconWrapper]}>
              <ShoppingBag size={28} color="#d97706" />
            </View>
            <View style={styles.cardBadge}>
              <Text style={styles.cardBadgeTextCustomer}>
                {currentCustomer ? 'Signed In' : 'Customer Shop'}
              </Text>
            </View>
          </View>
          <Text style={styles.portalTitle}>Customer Portal</Text>
          <Text style={styles.portalDesc}>
            Browse farm groceries, search products, add to cart, apply promo coupons, checkout & track delivery orders.
          </Text>
          <View style={styles.cardFooter}>
            <Text style={styles.customerActionText}>
              {currentCustomer ? `Continue as ${currentCustomer.name}` : 'Enter Grocery Store'}
            </Text>
            <ArrowRight size={18} color="#d97706" />
          </View>
        </TouchableOpacity>

        {/* Sync Info Footer */}
        <View style={styles.syncFooter}>
          <Layers size={14} color="#64748b" />
          <Text style={styles.syncFooterText}>
            Single Backend & Shared MySQL Database – Web and mobile stay 100% in sync
          </Text>
        </View>
      </ScrollView>

      <ServerConfigModal
        visible={showConfig}
        onClose={() => setShowConfig(false)}
        onSaved={() => checkServer()}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  brandHero: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#006b2c',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#006b2c',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    marginBottom: 12,
  },
  brandName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500',
    textAlign: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotOnline: {
    backgroundColor: '#22c55e',
  },
  statusDotOffline: {
    backgroundColor: '#ef4444',
  },
  statusDotUnknown: {
    backgroundColor: '#f59e0b',
  },
  statusText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  portalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  adminCard: {
    borderColor: '#bbf7d0',
  },
  employeeCard: {
    borderColor: '#bae6fd',
  },
  customerCard: {
    borderColor: '#fde68a',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminIconWrapper: {
    backgroundColor: '#f0fdf4',
  },
  employeeIconWrapper: {
    backgroundColor: '#f0f9ff',
  },
  customerIconWrapper: {
    backgroundColor: '#fffbeb',
  },
  cardBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
  cardBadgeTextAdmin: {
    fontSize: 11,
    fontWeight: '700',
    color: '#006b2c',
  },
  cardBadgeTextEmployee: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  cardBadgeTextCustomer: {
    fontSize: 11,
    fontWeight: '700',
    color: '#d97706',
  },
  portalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  portalDesc: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  adminActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#006b2c',
  },
  employeeActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284c7',
  },
  customerActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#d97706',
  },
  syncFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 16,
  },
  syncFooterText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '500',
  },
});
