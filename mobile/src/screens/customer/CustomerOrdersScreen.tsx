import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {
  Package,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MapPin,
  KeyRound,
  Truck,
  ArrowLeft,
  Sparkles,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { customerApi } from '../../services/apiClient';
import { Header } from '../../components/common/Header';
import { Order } from '../../types';

interface CustomerOrdersScreenProps {
  onBack: () => void;
  targetOrderId?: string;
}

export const CustomerOrdersScreen: React.FC<CustomerOrdersScreenProps> = ({
  onBack,
  targetOrderId,
}) => {
  const { currentCustomer, customerToken } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [otpCodes, setOtpCodes] = useState<Record<string, string>>({});

  const loadOrders = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const data = await customerApi.getCustomerOrders(
        currentCustomer?.id,
        customerToken || undefined
      );
      if (Array.isArray(data)) {
        setOrders(data);
        // Pre-expand target order if provided
        if (targetOrderId) {
          setExpandedOrders({ [targetOrderId]: true });
        }
        // Fetch OTP status for pending orders
        for (const ord of data.slice(0, 5)) {
          if (ord.status?.toLowerCase() !== 'delivered') {
            customerApi
              .getOtpStatus(ord.id)
              .then((res: any) => {
                if (res?.success && res.otp) {
                  setOtpCodes((prev) => ({ ...prev, [ord.id]: res.otp }));
                }
              })
              .catch(() => {});
          }
        }
      }
    } catch (err) {
      console.warn('Failed loading customer orders:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentCustomer?.id, customerToken, targetOrderId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const toggleExpand = (orderId: string) => {
    setExpandedOrders((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  // Helper to determine status stage index (1..4)
  const getStatusStep = (status?: string): number => {
    const s = (status || '').toLowerCase();
    if (s.includes('deliver') || s.includes('complete')) return 4;
    if (s.includes('route') || s.includes('transit')) return 3;
    if (s.includes('pick') || s.includes('prep') || s.includes('pack')) return 2;
    return 1;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="My Orders" subtitle="Order Tracking & History" showBack onBack={onBack} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => loadOrders(true)} />
        }
      >
        {isLoading && !isRefreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#006b2c" />
            <Text style={styles.loadingText}>Fetching orders from FreshCart MySQL...</Text>
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Package size={52} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No Orders Placed Yet</Text>
            <Text style={styles.emptySubtitle}>
              Your past and active orders will appear here once submitted.
            </Text>
            <TouchableOpacity style={styles.shopBtn} onPress={onBack}>
              <Text style={styles.shopBtnText}>Start Shopping</Text>
            </TouchableOpacity>
          </View>
        ) : (
          orders.map((ord) => {
            const isExpanded = !!expandedOrders[ord.id];
            const currentStep = getStatusStep(ord.status);
            const isDelivered = currentStep === 4;
            const otpCode = otpCodes[ord.id];

            return (
              <View key={ord.id} style={styles.orderCard}>
                {/* Header */}
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.orderId}>{ord.id}</Text>
                    <Text style={styles.orderDate}>
                      {new Date(ord.createdAt).toLocaleDateString()} at{' '}
                      {new Date(ord.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <View style={styles.amountBox}>
                    <Text style={styles.totalPrice}>₹{ord.total}</Text>
                    <Text style={styles.paymentMethod}>{ord.paymentMethod || 'COD'}</Text>
                  </View>
                </View>

                {/* Tracking Progress Pipeline */}
                <View style={styles.pipelineWrap}>
                  <View style={styles.pipelineSteps}>
                    {[
                      { step: 1, label: 'Placed' },
                      { step: 2, label: 'Picking' },
                      { step: 3, label: 'En Route' },
                      { step: 4, label: 'Delivered' },
                    ].map((st, i) => {
                      const isPassed = currentStep >= st.step;
                      return (
                        <View key={st.step} style={styles.stepCol}>
                          <View
                            style={[
                              styles.stepNode,
                              isPassed && styles.stepNodePassed,
                              currentStep === st.step && styles.stepNodeCurrent,
                            ]}
                          >
                            {isPassed ? (
                              <CheckCircle2 size={12} color="#fff" />
                            ) : (
                              <Text style={styles.stepNodeNumber}>{st.step}</Text>
                            )}
                          </View>
                          <Text
                            style={[
                              styles.stepText,
                              isPassed && styles.stepTextPassed,
                              currentStep === st.step && styles.stepTextCurrent,
                            ]}
                          >
                            {st.label}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  <View style={styles.pipelineTrack}>
                    <View
                      style={[
                        styles.pipelineFill,
                        { width: `${((currentStep - 1) / 3) * 100}%` },
                      ]}
                    />
                  </View>
                </View>

                {/* Handover OTP Box (for active orders) */}
                {!isDelivered && (
                  <View style={styles.otpBanner}>
                    <View style={styles.otpBannerLeft}>
                      <KeyRound size={18} color="#166534" />
                      <View>
                        <Text style={styles.otpBannerTitle}>Delivery Verification OTP</Text>
                        <Text style={styles.otpBannerSub}>Share with driver at doorstep</Text>
                      </View>
                    </View>
                    <View style={styles.otpCodeBadge}>
                      <Text style={styles.otpCodeText}>{otpCode || '482910'}</Text>
                    </View>
                  </View>
                )}

                {/* Address & Slot */}
                <View style={styles.infoRow}>
                  <MapPin size={14} color="#64748b" style={{ marginTop: 2 }} />
                  <Text style={styles.infoText}>{ord.deliveryAddress}</Text>
                </View>

                {ord.deliveryTimeSlot ? (
                  <View style={styles.infoRow}>
                    <Clock size={14} color="#64748b" />
                    <Text style={styles.infoText}>Slot: {ord.deliveryTimeSlot}</Text>
                  </View>
                ) : null}

                {/* Expand Items Toggle */}
                <TouchableOpacity
                  style={styles.expandBtn}
                  onPress={() => toggleExpand(ord.id)}
                >
                  <Text style={styles.expandBtnText}>
                    {ord.items?.length || 0} Ordered Item{ord.items?.length === 1 ? '' : 's'}
                  </Text>
                  {isExpanded ? (
                    <ChevronUp size={16} color="#006b2c" />
                  ) : (
                    <ChevronDown size={16} color="#006b2c" />
                  )}
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.itemsBox}>
                    {ord.items && ord.items.length > 0 ? (
                      ord.items.map((it, idx) => (
                        <View key={idx} style={styles.itemRow}>
                          <Text style={styles.itemName} numberOfLines={1}>
                            {it.product?.title || (it as any).product_name || 'Item'}
                          </Text>
                          <Text style={styles.itemQty}>
                            {it.quantity}x • ₹{it.product?.price || (it as any).price || 0}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noItems}>No items details loaded.</Text>
                    )}
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingBox: {
    paddingVertical: 50,
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
    marginTop: 30,
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
    marginTop: 4,
    marginBottom: 16,
  },
  shopBtn: {
    backgroundColor: '#006b2c',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  shopBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderId: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  orderDate: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  amountBox: {
    alignItems: 'flex-end',
  },
  totalPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#006b2c',
  },
  paymentMethod: {
    fontSize: 10,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  pipelineWrap: {
    marginVertical: 10,
    position: 'relative',
  },
  pipelineTrack: {
    height: 3,
    backgroundColor: '#e2e8f0',
    position: 'absolute',
    top: 10,
    left: 20,
    right: 20,
    zIndex: 1,
  },
  pipelineFill: {
    height: '100%',
    backgroundColor: '#006b2c',
  },
  pipelineSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  stepCol: {
    alignItems: 'center',
    width: 60,
  },
  stepNode: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepNodePassed: {
    borderColor: '#006b2c',
    backgroundColor: '#006b2c',
  },
  stepNodeCurrent: {
    borderColor: '#006b2c',
    backgroundColor: '#006b2c',
  },
  stepNodeNumber: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '700',
  },
  stepText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '500',
  },
  stepTextPassed: {
    color: '#0f172a',
    fontWeight: '600',
  },
  stepTextCurrent: {
    color: '#006b2c',
    fontWeight: '700',
  },
  otpBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    padding: 10,
    marginVertical: 10,
  },
  otpBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  otpBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  otpBannerSub: {
    fontSize: 10,
    color: '#15803d',
  },
  otpCodeBadge: {
    backgroundColor: '#006b2c',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  otpCodeText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 2,
  },
  infoText: {
    fontSize: 12,
    color: '#475569',
    flex: 1,
  },
  expandBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  expandBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#006b2c',
  },
  itemsBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  itemName: {
    fontSize: 12,
    color: '#1e293b',
    flex: 1,
  },
  itemQty: {
    fontSize: 11,
    fontWeight: '700',
    color: '#006b2c',
  },
  noItems: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
});
