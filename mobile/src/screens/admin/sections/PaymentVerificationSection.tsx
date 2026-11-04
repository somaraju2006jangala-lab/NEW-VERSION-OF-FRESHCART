import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  CheckCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Check,
  X,
  RefreshCw,
  Eye,
  Trash2,
  AlertTriangle,
  Phone,
} from 'lucide-react-native';
import { adminApi } from '../../../services/apiClient';

interface PaymentVerificationSectionProps {
  queue: any[];
  adminToken: string | null;
  onRefresh: () => void;
}

export const PaymentVerificationSection: React.FC<PaymentVerificationSectionProps> = ({
  queue,
  adminToken,
  onRefresh,
}) => {
  const [filter, setFilter] = useState<'pending' | 'all' | 'paid' | 'rejected'>('pending');
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [rejectingOrder, setRejectingOrder] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const pendingCount = useMemo(
    () =>
      queue.filter(
        (i) =>
          i.paymentStatus === 'PENDING_VERIFICATION' ||
          i.paymentStatus === 'PENDING' ||
          (!i.verifiedAt && i.paymentStatus !== 'PAID' && i.paymentStatus !== 'COMPLETED')
      ).length,
    [queue]
  );

  const filteredItems = useMemo(() => {
    return queue.filter((item) => {
      const isPaid = item.paymentStatus === 'PAID' || item.paymentStatus === 'COMPLETED';
      const isRejected = item.paymentStatus === 'REJECTED';
      const isPending = !isPaid && !isRejected;

      if (filter === 'pending') return isPending;
      if (filter === 'paid') return isPaid;
      if (filter === 'rejected') return isRejected;
      return true;
    });
  }, [queue, filter]);

  const handleApprove = async (orderId: string) => {
    if (!adminToken) return;
    setIsProcessing(true);
    try {
      const res = await adminApi.verifyPayment(adminToken, orderId, 'APPROVE');
      Alert.alert(
        'Payment Approved',
        res.message || 'Payment marked as PAID. Delivery OTP has been dispatched to customer.'
      );
      onRefresh();
    } catch (err: any) {
      Alert.alert('Approval Failed', err.message || 'Could not approve payment.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!adminToken || !rejectingOrder) return;
    setIsProcessing(true);
    try {
      const res = await adminApi.verifyPayment(
        adminToken,
        rejectingOrder.orderId,
        'REJECT',
        rejectReason.trim()
      );
      Alert.alert('Payment Rejected', res.message || 'Payment marked as REJECTED.');
      setRejectingOrder(null);
      setRejectReason('');
      onRefresh();
    } catch (err: any) {
      Alert.alert('Rejection Failed', err.message || 'Could not reject payment.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = (orderId: string) => {
    if (!adminToken) return;
    Alert.alert(
      'Delete Order & Payment Record',
      `Permanently delete order ${orderId} and payment submission?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminApi.deletePaymentOrder(adminToken, orderId);
              Alert.alert('Deleted', 'Order removed from verification queue.');
              onRefresh();
            } catch (err: any) {
              Alert.alert('Delete Failed', err.message || 'Could not delete order.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View>
            <View style={styles.titleRow}>
              <CheckCircle size={18} color="#10b981" />
              <Text style={styles.heading}>Payment Verification Queue</Text>
            </View>
            <Text style={styles.subheading}>
              Inspect customer-submitted UPI screenshots and confirm bank transaction receipts.
            </Text>
          </View>

          <TouchableOpacity style={styles.refreshIconBtn} onPress={onRefresh}>
            <RefreshCw size={14} color="#f8fafc" />
          </TouchableOpacity>
        </View>

        {/* Filter Pills with Counts */}
        <View style={styles.filterRow}>
          {[
            { key: 'pending' as const, label: 'Pending Review', count: pendingCount, highlight: true },
            { key: 'all' as const, label: 'All Orders', count: queue.length, highlight: false },
            {
              key: 'paid' as const,
              label: 'Verified & Paid',
              count: queue.filter((i) => i.paymentStatus === 'PAID' || i.paymentStatus === 'COMPLETED').length,
              highlight: false,
            },
            {
              key: 'rejected' as const,
              label: 'Rejected',
              count: queue.filter((i) => i.paymentStatus === 'REJECTED').length,
              highlight: false,
            },
          ].map((tab) => {
            const isActive = filter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setFilter(tab.key)}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {tab.label}
                </Text>
                <View
                  style={[
                    styles.countBadge,
                    tab.highlight && tab.count > 0 ? styles.countBadgeHighlight : styles.countBadgeNormal,
                  ]}
                >
                  <Text style={styles.countBadgeText}>{tab.count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Queue Items List */}
      {filteredItems.length === 0 ? (
        <View style={styles.emptyCard}>
          <CheckCircle2 size={40} color="#10b981" />
          <Text style={styles.emptyTitle}>
            {filter === 'pending'
              ? 'No pending payments to review'
              : 'No orders found matching this filter'}
          </Text>
          <Text style={styles.emptySubtitle}>
            When customers upload UPI transaction screenshots, they will appear here.
          </Text>
        </View>
      ) : (
        <View style={styles.queueList}>
          {filteredItems.map((item) => {
            const isPaid = item.paymentStatus === 'PAID' || item.paymentStatus === 'COMPLETED';
            const isRejected = item.paymentStatus === 'REJECTED';
            const isPending = !isPaid && !isRejected;

            return (
              <View key={item.id || item.orderId} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View>
                    <Text style={styles.itemOrderId}>Order #{item.orderId}</Text>
                    <Text style={styles.itemCustomer}>{item.customerName || 'Customer'}</Text>
                    {item.customerMobile ? (
                      <View style={styles.phoneRow}>
                        <Phone size={11} color="#94a3b8" />
                        <Text style={styles.phoneText}>{item.customerMobile}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.itemAmountBox}>
                    <Text style={styles.itemAmount}>₹{item.amount}</Text>
                    <View
                      style={[
                        styles.statusPill,
                        isPaid
                          ? styles.statusPillPaid
                          : isRejected
                          ? styles.statusPillRejected
                          : styles.statusPillPending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          isPaid
                            ? styles.statusTextPaid
                            : isRejected
                            ? styles.statusTextRejected
                            : styles.statusTextPending,
                        ]}
                      >
                        {item.paymentStatus}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Screenshot preview button if available */}
                {(item.screenshotUrl || item.screenshotPath) && (
                  <TouchableOpacity
                    style={styles.screenshotBtn}
                    onPress={() => setSelectedScreenshot(item.screenshotUrl || item.screenshotPath)}
                  >
                    <Eye size={14} color="#10b981" />
                    <Text style={styles.screenshotBtnText}>View Uploaded Payment Proof</Text>
                  </TouchableOpacity>
                )}

                {/* Action Buttons */}
                <View style={styles.actionRow}>
                  {isPending && (
                    <>
                      <TouchableOpacity
                        style={styles.approveBtn}
                        onPress={() => handleApprove(item.orderId)}
                        disabled={isProcessing}
                      >
                        <Check size={14} color="#fff" />
                        <Text style={styles.approveBtnText}>Approve (Send OTP)</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={() => setRejectingOrder(item)}
                        disabled={isProcessing}
                      >
                        <X size={14} color="#fff" />
                        <Text style={styles.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(item.orderId)}
                  >
                    <Trash2 size={14} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Screenshot Viewer Modal */}
      <Modal visible={!!selectedScreenshot} animationType="fade" transparent>
        <View style={styles.imageModalOverlay}>
          <View style={styles.imageModalBox}>
            <View style={styles.imageModalHeader}>
              <Text style={styles.imageModalTitle}>Customer Payment Proof</Text>
              <TouchableOpacity onPress={() => setSelectedScreenshot(null)}>
                <X size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {selectedScreenshot ? (
              <Image
                source={{ uri: selectedScreenshot }}
                style={styles.screenshotImage}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Reject Reason Modal */}
      <Modal visible={!!rejectingOrder} animationType="slide" transparent>
        <View style={styles.rejectModalOverlay}>
          <View style={styles.rejectModalBox}>
            <Text style={styles.rejectModalTitle}>
              Reject Payment for Order #{rejectingOrder?.orderId}
            </Text>
            <Text style={styles.rejectModalSubtitle}>
              Please provide a reason so the customer can correct and resubmit:
            </Text>

            <TextInput
              style={styles.reasonInput}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="e.g. Transaction reference not found / amount mismatched"
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={3}
            />

            <View style={styles.rejectModalActions}>
              <TouchableOpacity
                style={styles.cancelRejectBtn}
                onPress={() => {
                  setRejectingOrder(null);
                  setRejectReason('');
                }}
              >
                <Text style={styles.cancelRejectText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmRejectBtn}
                onPress={handleRejectConfirm}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmRejectText}>Confirm Rejection</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 10,
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
  refreshIconBtn: {
    padding: 6,
    backgroundColor: '#1e293b',
    borderRadius: 8,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  filterChipActive: {
    backgroundColor: '#006b2c',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  countBadgeHighlight: {
    backgroundColor: '#d97706',
  },
  countBadgeNormal: {
    backgroundColor: '#334155',
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  queueList: {
    gap: 12,
    paddingBottom: 24,
  },
  itemCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemOrderId: {
    fontSize: 14,
    fontWeight: '800',
    color: '#f8fafc',
  },
  itemCustomer: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  phoneText: {
    fontSize: 11,
    color: '#64748b',
  },
  itemAmountBox: {
    alignItems: 'flex-end',
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#10b981',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  statusPillPaid: {
    backgroundColor: '#064e3b',
  },
  statusPillRejected: {
    backgroundColor: '#7f1d1d',
  },
  statusPillPending: {
    backgroundColor: '#78350f',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusTextPaid: {
    color: '#34d399',
  },
  statusTextRejected: {
    color: '#fca5a5',
  },
  statusTextPending: {
    color: '#fde047',
  },
  screenshotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
  },
  screenshotBtnText: {
    fontSize: 11,
    color: '#10b981',
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  approveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#006b2c',
    borderRadius: 8,
    height: 36,
  },
  approveBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#7f1d1d',
    borderRadius: 8,
    height: 36,
  },
  rejectBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteBtn: {
    padding: 8,
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
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  imageModalBox: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    width: '100%',
    maxHeight: '80%',
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  imageModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  imageModalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
  },
  screenshotImage: {
    width: '100%',
    height: 350,
    borderRadius: 8,
  },
  rejectModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  rejectModalBox: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  rejectModalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#f8fafc',
  },
  rejectModalSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  reasonInput: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f8fafc',
    padding: 10,
    fontSize: 12,
    marginTop: 12,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  rejectModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelRejectBtn: {
    flex: 1,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cancelRejectText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  confirmRejectBtn: {
    flex: 1,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#ef4444',
  },
  confirmRejectText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
