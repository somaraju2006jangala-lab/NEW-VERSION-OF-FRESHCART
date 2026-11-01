import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  TextInput,
  Alert,
  Linking,
  RefreshControl,
} from 'react-native';
import {
  Truck,
  MapPin,
  Phone,
  KeyRound,
  CheckCircle2,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Package,
  Check,
  AlertCircle,
  Coins,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { employeeApi } from '../../services/apiClient';
import { Header } from '../../components/common/Header';
import { PendingDeliveryOrder } from '../../types';

export const EmployeeDashboardScreen: React.FC = () => {
  const { currentEmployee, employeeToken } = useAuth();
  const [assignedOrders, setAssignedOrders] = useState<PendingDeliveryOrder[]>([]);
  const [workload, setWorkload] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [includeDelivered, setIncludeDelivered] = useState(false);

  // Per-order state for OTP input and expanding
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [verifyingOtp, setVerifyingOtp] = useState<Record<string, boolean>>({});

  const loadDeliveries = useCallback(async (isRefresh = false) => {
    if (!employeeToken) return;
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await employeeApi.getAssignedDeliveries(employeeToken, includeDelivered);
      if (res?.success && Array.isArray(res.orders)) {
        setAssignedOrders(res.orders);
        setWorkload(typeof res.workload === 'number' ? res.workload : res.orders.length);
      }
    } catch (err: any) {
      console.warn('Error fetching assigned deliveries:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [employeeToken, includeDelivered]);

  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries]);

  const toggleExpand = (orderId: string) => {
    setExpandedOrders((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  // OTP Verification
  const handleVerifyOtp = async (orderId: string) => {
    const code = (otpInputs[orderId] || '').trim();
    if (!code) {
      Alert.alert('Missing Code', 'Please enter the 6-digit delivery OTP from the customer.');
      return;
    }

    setVerifyingOtp((prev) => ({ ...prev, [orderId]: true }));
    try {
      const res = await employeeApi.verifyOtp(orderId, code);
      if (res.success) {
        Alert.alert('Delivery Verified', `Order #${orderId.replace(/^#/, '')} confirmed delivered!`);
        setOtpInputs((prev) => ({ ...prev, [orderId]: '' }));
        loadDeliveries();
      } else {
        Alert.alert('Verification Failed', res.error || 'Invalid OTP code.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'OTP verification failed.');
    } finally {
      setVerifyingOtp((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  // Confirm COD Cash Collection
  const handleConfirmCod = async (orderId: string) => {
    Alert.alert(
      'Confirm Cash Collection',
      `Have you collected cash payment for order #${orderId.replace(/^#/, '')}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Cash Collected',
          onPress: async () => {
            try {
              const res = await employeeApi.confirmCashCollection(orderId, employeeToken || undefined);
              if (res.success) {
                Alert.alert('Cash Confirmed', 'Cash payment confirmed in MySQL.');
                loadDeliveries();
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed confirming cash collection.');
            }
          },
        },
      ]
    );
  };

  // Update Status
  const handleUpdateStatus = async (orderId: string, status: string) => {
    try {
      await employeeApi.updateDeliveryStatus(orderId, status, employeeToken || undefined);
      loadDeliveries();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed updating status.');
    }
  };

  const handleCallPhone = (phone?: string) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Alert.alert('Call Failed', `Cannot dial ${phone} on this device.`);
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Staff Portal" portalBadge="Employee" />

      {/* Staff Profile Header Card */}
      <View style={styles.profileBanner}>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{currentEmployee?.fullName || 'Staff Member'}</Text>
          <Text style={styles.profileId}>
            ID: {currentEmployee?.employeeId} • {currentEmployee?.email}
          </Text>
        </View>
        <View style={styles.workloadBadge}>
          <Text style={styles.workloadCount}>{workload}</Text>
          <Text style={styles.workloadLabel}>Active Tasks</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, !includeDelivered && styles.filterBtnActive]}
          onPress={() => {
            setIncludeDelivered(false);
          }}
        >
          <Clock size={15} color={!includeDelivered ? '#0284c7' : '#64748b'} />
          <Text
            style={[styles.filterBtnText, !includeDelivered && styles.filterBtnTextActive]}
          >
            Pending Delivery ({workload})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterBtn, includeDelivered && styles.filterBtnActive]}
          onPress={() => {
            setIncludeDelivered(true);
          }}
        >
          <CheckCircle2 size={15} color={includeDelivered ? '#0284c7' : '#64748b'} />
          <Text
            style={[styles.filterBtnText, includeDelivered && styles.filterBtnTextActive]}
          >
            All Assigned
          </Text>
        </TouchableOpacity>
      </View>

      {/* Assigned Orders List */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => loadDeliveries(true)} />
        }
      >
        {isLoading && !isRefreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#0284c7" />
            <Text style={styles.loadingText}>Fetching assigned deliveries...</Text>
          </View>
        ) : assignedOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Truck size={48} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No Orders Assigned</Text>
            <Text style={styles.emptySubtitle}>
              You currently have no delivery dispatches pending. Pull down to refresh.
            </Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={() => loadDeliveries()}>
              <RefreshCw size={16} color="#0284c7" />
              <Text style={styles.refreshBtnText}>Check Live Assignments</Text>
            </TouchableOpacity>
          </View>
        ) : (
          assignedOrders.map((ord) => {
            const isExpanded = !!expandedOrders[ord.id];
            const isDelivered =
              ord.status?.toLowerCase() === 'delivered' ||
              ord.status?.toLowerCase() === 'completed';

            return (
              <View key={ord.id} style={styles.orderCard}>
                {/* Header */}
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.orderId}>{ord.id}</Text>
                    <Text style={styles.customerName}>{ord.customerName}</Text>
                  </View>
                  <View style={styles.amountBox}>
                    <Text style={styles.totalAmount}>₹{ord.total}</Text>
                    <View
                      style={[
                        styles.paymentPill,
                        ord.paymentMethod?.toLowerCase().includes('cash')
                          ? styles.paymentPillCod
                          : styles.paymentPillOnline,
                      ]}
                    >
                      <Text
                        style={[
                          styles.paymentPillText,
                          ord.paymentMethod?.toLowerCase().includes('cash')
                            ? styles.paymentPillTextCod
                            : styles.paymentPillTextOnline,
                        ]}
                      >
                        {ord.paymentMethod || 'COD'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Address & Contact */}
                <View style={styles.infoRow}>
                  <MapPin size={16} color="#0284c7" style={{ marginTop: 2 }} />
                  <Text style={styles.addressText}>{ord.deliveryAddress}</Text>
                </View>

                {ord.customerPhone ? (
                  <TouchableOpacity
                    style={styles.callRow}
                    onPress={() => handleCallPhone(ord.customerPhone)}
                  >
                    <Phone size={15} color="#006b2c" />
                    <Text style={styles.phoneText}>Call Customer: {ord.customerPhone}</Text>
                  </TouchableOpacity>
                ) : null}

                {/* Delivery Slot */}
                {ord.deliveryTimeSlot ? (
                  <View style={styles.slotRow}>
                    <Clock size={14} color="#64748b" />
                    <Text style={styles.slotText}>Slot: {ord.deliveryTimeSlot}</Text>
                  </View>
                ) : null}

                {/* Expandable Items Breakdown */}
                <TouchableOpacity
                  style={styles.expandHeader}
                  onPress={() => toggleExpand(ord.id)}
                >
                  <View style={styles.expandLeft}>
                    <Package size={15} color="#64748b" />
                    <Text style={styles.expandTitle}>
                      {ord.items?.length || 0} Package Item{ord.items?.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  {isExpanded ? (
                    <ChevronUp size={18} color="#64748b" />
                  ) : (
                    <ChevronDown size={18} color="#64748b" />
                  )}
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.itemsList}>
                    {ord.items && ord.items.length > 0 ? (
                      ord.items.map((item, idx) => (
                        <View key={idx} style={styles.itemRow}>
                          <Text style={styles.itemName}>
                            {item.title || item.name || item.product_name}
                          </Text>
                          <Text style={styles.itemQty}>
                            {item.quantity}x {item.unit ? `(${item.unit})` : ''}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noItemsText}>Order items loaded in warehouse.</Text>
                    )}
                  </View>
                )}

                {/* Handover & Status Controls */}
                {!isDelivered ? (
                  <View style={styles.actionsBox}>
                    {/* OTP Handover Verification Input */}
                    <Text style={styles.otpLabel}>Customer Handover OTP Code:</Text>
                    <View style={styles.otpRow}>
                      <TextInput
                        style={styles.otpInput}
                        placeholder="6-digit OTP"
                        placeholderTextColor="#94a3b8"
                        keyboardType="number-pad"
                        maxLength={8}
                        value={otpInputs[ord.id] || ''}
                        onChangeText={(v) =>
                          setOtpInputs((prev) => ({ ...prev, [ord.id]: v }))
                        }
                      />
                      <TouchableOpacity
                        style={styles.verifyOtpBtn}
                        onPress={() => handleVerifyOtp(ord.id)}
                        disabled={verifyingOtp[ord.id]}
                      >
                        {verifyingOtp[ord.id] ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Check size={16} color="#fff" />
                            <Text style={styles.verifyOtpBtnText}>Verify OTP</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* COD Collection Confirmation if Cash order */}
                    {ord.paymentMethod?.toLowerCase().includes('cash') &&
                      ord.paymentStatus !== 'PAID' && (
                        <TouchableOpacity
                          style={styles.codConfirmBtn}
                          onPress={() => handleConfirmCod(ord.id)}
                        >
                          <Coins size={16} color="#854d0e" />
                          <Text style={styles.codConfirmBtnText}>
                            Confirm Cash Received (₹{ord.total})
                          </Text>
                        </TouchableOpacity>
                      )}

                    {/* Quick status stepper */}
                    <View style={styles.statusStepper}>
                      <TouchableOpacity
                        style={[
                          styles.statusBtn,
                          ord.status === 'Cold-Chain En Route' && styles.statusBtnActive,
                        ]}
                        onPress={() => handleUpdateStatus(ord.id, 'Cold-Chain En Route')}
                      >
                        <Text
                          style={[
                            styles.statusBtnText,
                            ord.status === 'Cold-Chain En Route' && styles.statusBtnTextActive,
                          ]}
                        >
                          Mark En Route
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.statusBtn,
                          ord.status === 'Delivered' && styles.statusBtnActiveGreen,
                        ]}
                        onPress={() => handleUpdateStatus(ord.id, 'Delivered')}
                      >
                        <Text
                          style={[
                            styles.statusBtnText,
                            ord.status === 'Delivered' && styles.statusBtnTextActiveGreen,
                          ]}
                        >
                          Mark Delivered
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.deliveredNotice}>
                    <CheckCircle2 size={18} color="#166534" />
                    <Text style={styles.deliveredNoticeText}>Order Handover Complete</Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  profileBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  profileId: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  workloadBadge: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
  workloadCount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0284c7',
  },
  workloadLabel: {
    fontSize: 9,
    color: '#0369a1',
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  filterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterBtnActive: {
    backgroundColor: '#f0f9ff',
    borderColor: '#0284c7',
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  filterBtnTextActive: {
    color: '#0284c7',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#7dd3fc',
  },
  refreshBtnText: {
    fontSize: 13,
    color: '#0284c7',
    fontWeight: '700',
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  customerName: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
    marginTop: 2,
  },
  amountBox: {
    alignItems: 'flex-end',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#006b2c',
  },
  paymentPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  paymentPillCod: {
    backgroundColor: '#fffbeb',
  },
  paymentPillOnline: {
    backgroundColor: '#f0fdf4',
  },
  paymentPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  paymentPillTextCod: {
    color: '#b45309',
  },
  paymentPillTextOnline: {
    color: '#15803d',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  addressText: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
    lineHeight: 18,
  },
  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  phoneText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '700',
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  slotText: {
    fontSize: 12,
    color: '#64748b',
  },
  expandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  expandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expandTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  itemsList: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  itemName: {
    fontSize: 12,
    color: '#1e293b',
    flex: 1,
  },
  itemQty: {
    fontSize: 12,
    fontWeight: '700',
    color: '#006b2c',
    marginLeft: 10,
  },
  noItemsText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  actionsBox: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
    marginTop: 4,
  },
  otpLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  otpRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  otpInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#0f172a',
  },
  verifyOtpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#006b2c',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
  },
  verifyOtpBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  codConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fefce8',
    borderWidth: 1,
    borderColor: '#fef08a',
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  codConfirmBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#854d0e',
  },
  statusStepper: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusBtnActive: {
    backgroundColor: '#0284c7',
  },
  statusBtnActiveGreen: {
    backgroundColor: '#006b2c',
  },
  statusBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  statusBtnTextActive: {
    color: '#fff',
  },
  statusBtnTextActiveGreen: {
    color: '#fff',
  },
  deliveredNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  deliveredNoticeText: {
    fontSize: 13,
    color: '#166534',
    fontWeight: '700',
  },
});
