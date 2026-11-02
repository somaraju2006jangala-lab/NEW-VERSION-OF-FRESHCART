import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Users,
  Search,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Calendar,
  X,
  UserX,
  UserCheck,
  ShieldAlert,
} from 'lucide-react-native';
import { adminApi } from '../../../services/apiClient';

interface CustomerAccountsSectionProps {
  customers: any[];
  adminToken: string | null;
  onRefresh: () => void;
}

export const CustomerAccountsSection: React.FC<CustomerAccountsSectionProps> = ({
  customers,
  adminToken,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const activeCount = useMemo(
    () => customers.filter((c) => c.status !== 'Suspended').length,
    [customers]
  );
  const suspendedCount = useMemo(
    () => customers.filter((c) => c.status === 'Suspended').length,
    [customers]
  );

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const name = c.name || c.fullName || '';
      const email = c.email || '';
      const phone = c.phone || c.mobile || '';
      const id = c.id || c.customerId || '';

      const matchesSearch =
        !q ||
        name.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q) ||
        phone.toLowerCase().includes(q) ||
        id.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      const isSuspended = c.status === 'Suspended';
      if (statusFilter === 'active' && isSuspended) return false;
      if (statusFilter === 'suspended' && !isSuspended) return false;

      return true;
    });
  }, [customers, searchQuery, statusFilter]);

  const handleToggleStatus = (cust: any) => {
    if (!adminToken) return;
    const isCurrentlySuspended = cust.status === 'Suspended';
    const nextStatus = isCurrentlySuspended ? 'Active' : 'Suspended';
    const custId = cust.customerId || cust.id;
    const custName = cust.name || cust.fullName || 'Customer';

    Alert.alert(
      isCurrentlySuspended ? 'Reactivate Customer' : 'Suspend Customer Account',
      `Are you sure you want to ${isCurrentlySuspended ? 'reactivate' : 'suspend'} ${custName}'s account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isCurrentlySuspended ? 'Reactivate' : 'Suspend',
          style: isCurrentlySuspended ? 'default' : 'destructive',
          onPress: async () => {
            setIsUpdating(custId);
            try {
              const res = await adminApi.updateCustomerStatus(adminToken, custId, nextStatus);
              if (res.success) {
                Alert.alert(
                  'Status Updated',
                  `Account status for ${custName} is now ${nextStatus}.`
                );
                onRefresh();
              } else {
                Alert.alert('Update Failed', res.error || 'Failed to update status.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Network error updating customer status.');
            } finally {
              setIsUpdating(null);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Active customer';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View>
            <View style={styles.titleRow}>
              <Users size={18} color="#10b981" />
              <Text style={styles.heading}>Customer Accounts</Text>
            </View>
            <Text style={styles.subheading}>
              Registered customer profiles securely managed via shared MySQL database.
            </Text>
          </View>

          <View style={styles.badgePill}>
            <Text style={styles.badgeText}>{customers.length} Accounts</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search size={15} color="#64748b" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by customer name, email, phone, ID..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={15} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips */}
        <View style={styles.filterRow}>
          {[
            { key: 'all' as const, label: `All (${customers.length})` },
            { key: 'active' as const, label: `Active (${activeCount})` },
            { key: 'suspended' as const, label: `Suspended (${suspendedCount})` },
          ].map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, statusFilter === f.key && styles.filterChipActive]}
              onPress={() => setStatusFilter(f.key)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  statusFilter === f.key && styles.filterChipTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.refreshIconBtn} onPress={onRefresh}>
            <RefreshCw size={13} color="#f8fafc" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Customers List */}
      {filteredCustomers.length === 0 ? (
        <View style={styles.emptyCard}>
          <Users size={36} color="#64748b" />
          <Text style={styles.emptyTitle}>No matching customers found</Text>
          <Text style={styles.emptySubtitle}>
            When customers register online or via mobile, they appear in this shared directory.
          </Text>
        </View>
      ) : (
        <View style={styles.customersList}>
          {filteredCustomers.map((cust) => {
            const isSuspended = cust.status === 'Suspended';
            const custId = cust.customerId || cust.id;
            const name = cust.name || cust.fullName || 'FreshCart Customer';
            const email = cust.email || 'No email provided';
            const phone = cust.phone || cust.mobile || '';
            const address = cust.address || '';
            const joined = formatDate(cust.createdAt);

            return (
              <View key={custId} style={styles.custCard}>
                <View style={styles.custHeader}>
                  <View>
                    <Text style={styles.custName}>{name}</Text>
                    <Text style={styles.custId}>ID: {custId}</Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      isSuspended ? styles.statusBadgeSuspended : styles.statusBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isSuspended ? styles.statusTextSuspended : styles.statusTextActive,
                      ]}
                    >
                      {isSuspended ? 'Suspended' : 'Active'}
                    </Text>
                  </View>
                </View>

                {/* Contact info */}
                <View style={styles.contactRow}>
                  <Mail size={12} color="#94a3b8" />
                  <Text style={styles.contactText}>{email}</Text>
                </View>

                {phone ? (
                  <View style={styles.contactRow}>
                    <Phone size={12} color="#94a3b8" />
                    <Text style={styles.contactText}>{phone}</Text>
                  </View>
                ) : null}

                {address ? (
                  <View style={styles.contactRow}>
                    <MapPin size={12} color="#94a3b8" />
                    <Text style={styles.contactText} numberOfLines={2}>
                      {address}
                    </Text>
                  </View>
                ) : null}

                {/* Footer with status toggle */}
                <View style={styles.cardFooter}>
                  <View style={styles.joinedRow}>
                    <Calendar size={11} color="#64748b" />
                    <Text style={styles.joinedText}>Joined: {joined}</Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.toggleStatusBtn,
                      isSuspended ? styles.reactivateBtn : styles.suspendBtn,
                    ]}
                    onPress={() => handleToggleStatus(cust)}
                    disabled={isUpdating === custId}
                  >
                    {isSuspended ? (
                      <>
                        <UserCheck size={12} color="#34d399" />
                        <Text style={styles.reactivateText}>Reactivate</Text>
                      </>
                    ) : (
                      <>
                        <UserX size={12} color="#fca5a5" />
                        <Text style={styles.suspendText}>Suspend</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14,
    marginBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#f8fafc',
  },
  subheading: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
    lineHeight: 16,
  },
  badgePill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#0f172a',
    fontSize: 11,
    fontWeight: '800',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    height: 38,
    marginTop: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#f8fafc',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  filterChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  filterChipActive: {
    backgroundColor: '#006b2c',
  },
  filterChipText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  refreshIconBtn: {
    marginLeft: 'auto',
    padding: 6,
    backgroundColor: '#1e293b',
    borderRadius: 6,
  },
  customersList: {
    gap: 12,
    paddingBottom: 24,
  },
  custCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14,
  },
  custHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  custName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#f8fafc',
  },
  custId: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeActive: {
    backgroundColor: '#064e3b',
  },
  statusBadgeSuspended: {
    backgroundColor: '#7f1d1d',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusTextActive: {
    color: '#34d399',
  },
  statusTextSuspended: {
    color: '#fca5a5',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
  },
  contactText: {
    fontSize: 11,
    color: '#94a3b8',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  joinedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  joinedText: {
    fontSize: 10,
    color: '#64748b',
  },
  toggleStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  suspendBtn: {
    backgroundColor: '#7f1d1d',
  },
  reactivateBtn: {
    backgroundColor: '#064e3b',
  },
  suspendText: {
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: '600',
  },
  reactivateText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 48,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
});
