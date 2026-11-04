import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  X,
  ChevronRight,
} from 'lucide-react-native';
import { AdminPortalSectionId } from './AdminNavigationTabs';

interface AdminQuickMenuModalProps {
  visible: boolean;
  activeSection: AdminPortalSectionId;
  onSelectSection: (id: AdminPortalSectionId) => void;
  onClose: () => void;
  pendingVerificationCount?: number;
  activeAdminsCount?: number;
  maxAdminsLimit?: number;
  customerAccountsCount?: number;
}

export const AdminQuickMenuModal: React.FC<AdminQuickMenuModalProps> = ({
  visible,
  activeSection,
  onSelectSection,
  onClose,
  pendingVerificationCount = 0,
  activeAdminsCount = 2,
  maxAdminsLimit = 5,
  customerAccountsCount = 0,
}) => {
  const insets = useSafeAreaInsets();
  const sections: Array<{
    id: AdminPortalSectionId;
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ size: number; color: string }>;
    badge?: string | number | null;
    badgeColor?: string;
  }> = [
    {
      id: 'inventory',
      title: '1. Live Inventory Management',
      subtitle: 'View products, stock levels, and edit pack sizes',
      icon: Package,
    },
    {
      id: 'logs',
      title: '2. CDC Audit & Dispatch Logs',
      subtitle: 'Real-time CDC ledger & stock changes',
      icon: History,
    },
    {
      id: 'coupons',
      title: '3. Coupons',
      subtitle: 'Create, edit & manage promo discount codes',
      icon: Tag,
    },
    {
      id: 'orders',
      title: '4. Customer Orders',
      subtitle: 'View customer orders, assign delivery & update status',
      icon: ShoppingBag,
    },
    {
      id: 'delivery-charges',
      title: '5. Delivery Charges',
      subtitle: 'Configure order amount tiers & free delivery',
      icon: Truck,
    },
    {
      id: 'upi-settings',
      title: '6. UPI Settings',
      subtitle: 'Merchant VPA & dynamic QR code configuration',
      icon: CreditCard,
    },
    {
      id: 'payment-verification',
      title: '7. Payment Verification',
      subtitle: 'Review UPI transaction screenshots & dispatch OTP',
      icon: CheckCircle,
      badge: pendingVerificationCount > 0 ? `${pendingVerificationCount} Pending` : null,
      badgeColor: '#d97706',
    },
    {
      id: 'admins',
      title: '8. Authorized Admins',
      subtitle: 'Manage authorized administrator credentials & roles',
      icon: ShieldCheck,
      badge: `${activeAdminsCount}/${maxAdminsLimit}`,
      badgeColor: '#006b2c',
    },
    {
      id: 'employees',
      title: '9. Employee Management',
      subtitle: 'Manage delivery partners & operations staff',
      icon: UserCheck,
    },
    {
      id: 'customers',
      title: '10. Customer Accounts',
      subtitle: 'Registered customer profiles & account status',
      icon: Users,
      badge: customerAccountsCount > 0 ? `${customerAccountsCount}` : null,
      badgeColor: '#334155',
    },
    {
      id: 'calendar',
      title: '11. Orders & Transactions Calendar',
      subtitle: 'Calendar grid, daily reports & transaction history',
      icon: Calendar,
    },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Admin Portal Sections</Text>
              <Text style={styles.subtitle}>
                Tap any section to navigate directly
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {sections.map((item) => {
              const isActive = activeSection === item.id;
              const Icon = item.icon;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.sectionRow, isActive && styles.sectionRowActive]}
                  onPress={() => {
                    onSelectSection(item.id);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.iconCircle,
                      isActive ? styles.iconCircleActive : styles.iconCircleInactive,
                    ]}
                  >
                    <Icon size={18} color={isActive ? '#10b981' : '#94a3b8'} />
                  </View>

                  <View style={styles.textContainer}>
                    <View style={styles.titleLine}>
                      <Text
                        style={[
                          styles.sectionTitle,
                          isActive && styles.sectionTitleActive,
                        ]}
                      >
                        {item.title}
                      </Text>
                      {item.badge && (
                        <View
                          style={[
                            styles.badgePill,
                            { backgroundColor: item.badgeColor || '#006b2c' },
                          ]}
                        >
                          <Text style={styles.badgeText}>{item.badge}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.sectionSubtitle} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  </View>

                  <ChevronRight
                    size={16}
                    color={isActive ? '#10b981' : '#475569'}
                  />
                </TouchableOpacity>
              );
            })}
            <View style={{ height: Math.max(insets.bottom, 20) + 10 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#090d16',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: '#1e293b',
    borderRadius: 8,
  },
  body: {
    padding: 16,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 12,
  },
  sectionRowActive: {
    backgroundColor: '#062615',
    borderColor: '#10b981',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleActive: {
    backgroundColor: '#064e3b',
  },
  iconCircleInactive: {
    backgroundColor: '#1e293b',
  },
  textContainer: {
    flex: 1,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
  },
  sectionTitleActive: {
    color: '#10b981',
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
});
