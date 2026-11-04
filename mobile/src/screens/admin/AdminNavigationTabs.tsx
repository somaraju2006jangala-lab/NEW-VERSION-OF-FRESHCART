import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {
  Package,
  History,
  Tag,
  ShoppingBag,
  Truck,
  CreditCard,
  CheckCircle,
  ShieldCheck,
  UserCheck,
  Users,
  Calendar,
  Grid,
} from 'lucide-react-native';

export type AdminPortalSectionId =
  | 'inventory'
  | 'logs'
  | 'coupons'
  | 'orders'
  | 'delivery-charges'
  | 'upi-settings'
  | 'payment-verification'
  | 'admins'
  | 'employees'
  | 'customers'
  | 'calendar';

export interface AdminNavItem {
  id: AdminPortalSectionId;
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  badge?: string | number | null;
  badgeType?: 'orange' | 'green' | 'light';
}

interface AdminNavigationTabsProps {
  activeSection: AdminPortalSectionId;
  onSelectSection: (id: AdminPortalSectionId) => void;
  onOpenQuickMenu: () => void;
  pendingVerificationCount?: number;
  activeAdminsCount?: number;
  maxAdminsLimit?: number;
  customerAccountsCount?: number;
}

export const AdminNavigationTabs: React.FC<AdminNavigationTabsProps> = ({
  activeSection,
  onSelectSection,
  onOpenQuickMenu,
  pendingVerificationCount = 0,
  activeAdminsCount = 2,
  maxAdminsLimit = 5,
  customerAccountsCount = 0,
}) => {
  const scrollRef = useRef<any>(null);

  const navItems: AdminNavItem[] = [
    {
      id: 'inventory',
      label: 'Live Inventory Management',
      icon: Package,
    },
    {
      id: 'logs',
      label: 'CDC Audit & Dispatch Logs',
      icon: History,
    },
    {
      id: 'coupons',
      label: 'Coupons',
      icon: Tag,
    },
    {
      id: 'orders',
      label: 'Customer Orders',
      icon: ShoppingBag,
    },
    {
      id: 'delivery-charges',
      label: 'Delivery Charges',
      icon: Truck,
    },
    {
      id: 'upi-settings',
      label: 'UPI Settings',
      icon: CreditCard,
    },
    {
      id: 'payment-verification',
      label: 'Payment Verification',
      icon: CheckCircle,
      badge: pendingVerificationCount > 0 ? pendingVerificationCount : null,
      badgeType: 'orange',
    },
    {
      id: 'admins',
      label: 'Authorized Admins',
      icon: ShieldCheck,
      badge: `${activeAdminsCount}/${maxAdminsLimit}`,
      badgeType: 'green',
    },
    {
      id: 'employees',
      label: 'Employee Management',
      icon: UserCheck,
    },
    {
      id: 'customers',
      label: 'Customer Accounts',
      icon: Users,
      badge: customerAccountsCount > 0 ? customerAccountsCount : null,
      badgeType: 'light',
    },
    {
      id: 'calendar',
      label: 'Orders & Transactions Calendar',
      icon: Calendar,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.barWrapper}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            const Icon = item.icon;

            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                onPress={() => onSelectSection(item.id)}
                activeOpacity={0.8}
              >
                <Icon
                  size={15}
                  color={isActive ? '#10b981' : '#94a3b8'}
                />
                <Text
                  style={[styles.tabText, isActive && styles.tabTextActive]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>

                {item.badge !== undefined && item.badge !== null ? (
                  <View
                    style={[
                      styles.badgeBox,
                      item.badgeType === 'orange'
                        ? styles.badgeOrange
                        : item.badgeType === 'green'
                        ? styles.badgeGreen
                        : styles.badgeLight,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        item.badgeType === 'orange'
                          ? styles.badgeTextOrange
                          : item.badgeType === 'green'
                          ? styles.badgeTextGreen
                          : styles.badgeTextLight,
                      ]}
                    >
                      {item.badge}
                    </Text>
                  </View>
                ) : null}

                {/* Underline for active indicator matching screenshot */}
                {isActive && <View style={styles.activeIndicator} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Quick Menu Button to show all 11 sections at once */}
        <TouchableOpacity
          style={styles.quickMenuBtn}
          onPress={onOpenQuickMenu}
          accessibilityLabel="All Sections"
        >
          <Grid size={15} color="#10b981" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#090d16',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  barWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  tabsScrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 10,
    position: 'relative',
  },
  tabButtonActive: {},
  tabText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: 0.1,
  },
  tabTextActive: {
    color: '#10b981',
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 6,
    right: 6,
    height: 2.5,
    backgroundColor: '#10b981',
    borderRadius: 2,
    shadowColor: '#10b981',
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  badgeBox: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 2,
  },
  badgeOrange: {
    backgroundColor: '#d97706',
  },
  badgeGreen: {
    backgroundColor: '#064e3b',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  badgeLight: {
    backgroundColor: '#f1f5f9',
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  badgeTextOrange: {
    color: '#fff',
  },
  badgeTextGreen: {
    color: '#34d399',
  },
  badgeTextLight: {
    color: '#0f172a',
  },
  quickMenuBtn: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#1e293b',
    backgroundColor: '#090d16',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
