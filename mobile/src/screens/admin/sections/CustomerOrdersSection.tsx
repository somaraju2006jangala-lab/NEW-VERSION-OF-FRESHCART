import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  ShoppingBag,
  Search,
  Truck,
  UserCheck,
  Check,
  Copy,
  Banknote,
  Trash2,
  X,
  ChevronDown,
  CheckCircle,
  Clock,
  ShieldCheck,
  ChevronRight,
  Package,
} from 'lucide-react-native';
import { Order, OrderItem, AuthorizedEmployee } from '../../../types';
import { adminApi } from '../../../services/apiClient';

interface CustomerOrdersSectionProps {
  orders: Order[];
  employees: AuthorizedEmployee[];
  adminToken: string | null;
  onRefresh: () => void;
}

// Format INR currency
const formatINR = (val: number | string | undefined): string => {
  const num = typeof val === 'number' ? val : parseFloat(String(val || 0));
  if (isNaN(num)) return '₹0';
  return '₹' + Math.round(num).toLocaleString('en-IN');
};

// Format date and time
const formatOrderDateTime = (dateStr?: string): string => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
};

// Format product item line
const formatOrderProductItem = (item: OrderItem) => {
  const qty = item.quantity || 1;
  const unit = item.selectedPackSize || item.product?.unit || 'unit';
  let unitFormatted = '';

  if (qty === 1) {
    unitFormatted = unit;
  } else if (/^1\s+[a-zA-Z]+$/i.test(unit)) {
    const unitName = unit.replace(/^1\s+/i, '');
    unitFormatted = `${qty} ${unitName}`;
  } else {
    unitFormatted = `${qty} × ${unit}`;
  }

  const price =
    typeof item.selectedPrice === 'number' && item.selectedPrice > 0
      ? item.selectedPrice
      : item.product?.price || 0;

  const linePrice = formatINR(price * qty);
  const title = item.product?.title || 'Product';

  return {
    title,
    qtyAndUnit: unitFormatted,
    linePrice,
    lineText: `${title} — ${unitFormatted} — ${linePrice}`,
  };
};

// Determine payment method and status badge
const getDisplayPaymentInfo = (order: Order) => {
  const rawMethod = (order.paymentMethod || '').trim();
  const rawStatus = (order.paymentStatus || '').trim().toUpperCase();
  const hasProof = Boolean(order.screenshotUrl);

  const isCod =
    !rawMethod ||
    rawMethod.toLowerCase().includes('cash') ||
    rawMethod.toUpperCase() === 'COD';

  if (isCod) {
    const isCollected =
      rawStatus === 'COLLECTED' ||
      rawStatus === 'COMPLETED' ||
      rawStatus === 'PAID';

    if (isCollected) {
      return {
        paymentMethod: 'Cash on Delivery',
        paymentStatus: rawStatus === 'COMPLETED' ? 'COMPLETED' : 'COLLECTED',
        badgeBg: 'rgba(16, 185, 129, 0.15)',
        badgeText: '#10b981',
        badgeBorder: 'rgba(16, 185, 129, 0.35)',
        dotColor: '#10b981',
      };
    }

    const uncollectedStatus = rawStatus === 'COD' ? 'COD' : 'PENDING_COLLECTION';
    return {
      paymentMethod: 'Cash on Delivery',
      paymentStatus: uncollectedStatus,
      badgeBg: 'rgba(245, 158, 11, 0.15)',
      badgeText: '#f59e0b',
      badgeBorder: 'rgba(245, 158, 11, 0.35)',
      dotColor: '#f59e0b',
    };
  }

  // Online payments
  let method = 'Online (UPI)';
  if (rawMethod.toLowerCase().includes('phonepe')) {
    method = 'Online (PhonePe)';
  } else if (rawMethod.toLowerCase().includes('google pay') || rawMethod.toLowerCase().includes('gpay')) {
    method = 'Online (Google Pay)';
  } else if (rawMethod.toLowerCase().includes('paytm')) {
    method = 'Online (Paytm)';
  } else if (rawMethod.startsWith('Online (')) {
    method = rawMethod;
  }

  let status: 'COMPLETED' | 'PENDING VERIFICATION' | 'REJECTED' | 'UNPAID';
  if (rawStatus === 'PAID' || rawStatus === 'COMPLETED' || rawStatus === 'APPROVED' || rawStatus === 'SUCCESS') {
    status = 'COMPLETED';
  } else if (
    rawStatus === 'PENDING_VERIFICATION' ||
    rawStatus === 'PENDING VERIFICATION' ||
    (hasProof && rawStatus !== 'REJECTED' && rawStatus !== 'FAILED')
  ) {
    status = 'PENDING VERIFICATION';
  } else if (rawStatus === 'REJECTED' || rawStatus === 'FAILED') {
    status = 'REJECTED';
  } else {
    status = 'UNPAID';
  }

  if (status === 'COMPLETED') {
    return {
      paymentMethod: method,
      paymentStatus: status,
      badgeBg: 'rgba(16, 185, 129, 0.15)',
      badgeText: '#10b981',
      badgeBorder: 'rgba(16, 185, 129, 0.35)',
      dotColor: '#10b981',
    };
  } else if (status === 'PENDING VERIFICATION') {
    return {
      paymentMethod: method,
      paymentStatus: status,
      badgeBg: 'rgba(245, 158, 11, 0.15)',
      badgeText: '#f59e0b',
      badgeBorder: 'rgba(245, 158, 11, 0.35)',
      dotColor: '#f59e0b',
    };
  } else {
    return {
      paymentMethod: method,
      paymentStatus: status,
      badgeBg: 'rgba(239, 68, 68, 0.15)',
      badgeText: '#ef4444',
      badgeBorder: 'rgba(239, 68, 68, 0.35)',
      dotColor: '#ef4444',
    };
  }
};

// Delivery status badge styling
const getDeliveryBadgeStyle = (status: string) => {
  switch (status) {
    case 'Delivered':
      return {
        bg: '#eff6ff',
        text: '#1d4ed8',
        border: '#bfdbfe',
        dot: '#2563eb',
      };
    case 'Picking':
      return {
        bg: '#fef3c7',
        text: '#92400e',
        border: '#fde68a',
        dot: '#d97706',
      };
    case 'Cold-Chain En Route':
      return {
        bg: '#f5f3ff',
        text: '#5b21b6',
        border: '#ddd6fe',
        dot: '#7c3aed',
      };
    case 'Ordered':
    case 'CONFIRMED':
    case 'Pending':
      return {
        bg: '#dcfce7',
        text: '#15803d',
        border: '#86efac',
        dot: '#16a34a',
      };
    default:
      return {
        bg: '#f1f5f9',
        text: '#475569',
        border: '#cbd5e1',
        dot: '#64748b',
      };
  }
};

export const CustomerOrdersSection: React.FC<CustomerOrdersSectionProps> = ({
  orders,
  employees,
  adminToken,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [isConfirmingCash, setIsConfirmingCash] = useState<Record<string, boolean>>({});

  // Status Picker modal
  const [statusModalOrder, setStatusModalOrder] = useState<Order | null>(null);

  // Assign Delivery Modal
  const [assigningOrder, setAssigningOrder] = useState<Order | null>(null);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status === 'active'),
    [employees]
  );

  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        ord.id?.toLowerCase().includes(q) ||
        ord.customerName?.toLowerCase().includes(q) ||
        ord.customerPhone?.toLowerCase().includes(q) ||
        ord.customerEmail?.toLowerCase().includes(q) ||
        ord.deliveryAddress?.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (statusFilter !== 'all' && ord.status !== statusFilter) return false;

      return true;
    });
  }, [orders, searchQuery, statusFilter]);

  // Copy full structured order record to clipboard
  const handleCopyRecord = async (order: Order) => {
    const displayOrderId = order.id.startsWith('#') ? order.id : `#${order.id}`;
    const formattedDateTime = formatOrderDateTime(order.createdAt);
    const paymentInfo = getDisplayPaymentInfo(order);

    const lines: string[] = [
      `Customer: ${order.customerName}`,
      `User ID: ${order.customerId || 'N/A'}`,
      `Mobile: ${order.customerPhone || 'Not available'}`,
      `Order ID: ${displayOrderId}`,
    ];

    if (order.customerEmail) {
      lines.push(`Email: ${order.customerEmail}`);
    }
    lines.push(`Date & Time: ${formattedDateTime}`);
    if (order.otpVerifiedAt) {
      lines.push(`OTP Verified At: ${formatOrderDateTime(order.otpVerifiedAt)}`);
    }

    lines.push('');
    lines.push('Products:');
    (order.items || []).forEach((item) => {
      const formatted = formatOrderProductItem(item);
      lines.push(`- ${formatted.lineText}`);
    });

    lines.push('');
    lines.push(`Total: ${formatINR(order.total)}`);
    lines.push(`Payment Method: ${paymentInfo.paymentMethod}`);
    lines.push(`Payment Status: ${paymentInfo.paymentStatus}`);
    lines.push(`Status: ${order.status}`);

    const fullOrderText = lines.join('\n');

    try {
      await Clipboard.setStringAsync(fullOrderText);
      setCopiedOrderId(order.id);
      setTimeout(() => setCopiedOrderId(null), 2000);
    } catch (err: any) {
      Alert.alert('Copy Error', 'Failed to copy order details to clipboard.');
    }
  };

  // Confirm cash collection for COD order
  const handleConfirmCashCollection = async (order: Order) => {
    if (!adminToken) {
      Alert.alert('Unauthorized', 'Admin session expired. Please log in again.');
      return;
    }

    const displayOrderId = order.id.startsWith('#') ? order.id : `#${order.id}`;
    Alert.alert(
      'Confirm Cash Collection',
      `Confirm cash collection of ${formatINR(order.total)} for Order ${displayOrderId}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Cash',
          onPress: async () => {
            setIsConfirmingCash((prev) => ({ ...prev, [order.id]: true }));
            try {
              const res = await adminApi.confirmCashCollection(order.id, adminToken);
              if (res.success) {
                Alert.alert(
                  'Cash Collected',
                  `Payment for order ${displayOrderId} verified and marked as COLLECTED.`
                );
                onRefresh();
              } else {
                Alert.alert('Notice', res.error || 'Could not confirm cash collection.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to confirm cash collection.');
            } finally {
              setIsConfirmingCash((prev) => ({ ...prev, [order.id]: false }));
            }
          },
        },
      ]
    );
  };

  // Update order status
  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    if (!adminToken) return;
    try {
      await adminApi.updateOrderStatus(orderId, newStatus, adminToken);
      setStatusModalOrder(null);
      Alert.alert('Status Updated', `Order status changed to ${newStatus}.`);
      onRefresh();
    } catch (err: any) {
      Alert.alert('Status Update Failed', err.message || 'Could not update order status.');
    }
  };

  // Auto assign orders
  const handleAutoAssign = async () => {
    if (!adminToken) return;
    setIsAutoAssigning(true);
    try {
      const res = await adminApi.autoAssignOrders(adminToken);
      Alert.alert('Auto-Assignment Complete', res.message || 'Orders assigned to available delivery personnel.');
      onRefresh();
    } catch (err: any) {
      Alert.alert('Auto-Assign Error', err.message || 'Could not auto-assign orders.');
    } finally {
      setIsAutoAssigning(false);
    }
  };

  // Assign order to specific employee
  const handleAssignEmployee = async (employeeId: string) => {
    if (!adminToken || !assigningOrder) return;
    try {
      await adminApi.assignOrder(adminToken, assigningOrder.id, employeeId);
      Alert.alert('Assigned', 'Order successfully assigned.');
      setAssigningOrder(null);
      onRefresh();
    } catch (err: any) {
      Alert.alert('Assignment Failed', err.message || 'Could not assign employee.');
    }
  };

  // Delete order
  const handleDeleteOrder = (orderId: string) => {
    if (!adminToken) return;
    const displayId = orderId.startsWith('#') ? orderId : `#${orderId}`;
    Alert.alert(
      'Delete Order',
      `Permanently delete order ${displayId}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminApi.deleteOrder(orderId, adminToken);
              Alert.alert('Deleted', 'Order deleted.');
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
      {/* Header Info & Auto-assign */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.heading}>Customer Orders ({orders.length})</Text>
          <Text style={styles.subheading}>
            {orders.filter((o) => o.status === 'Picking').length} picking ·{' '}
            {orders.filter((o) => o.status === 'Cold-Chain En Route').length} en route ·{' '}
            {orders.filter((o) => o.status === 'Delivered').length} delivered
          </Text>
        </View>

        <TouchableOpacity
          style={styles.autoAssignBtn}
          onPress={handleAutoAssign}
          disabled={isAutoAssigning}
          accessibilityLabel="Auto-Assign All Orders"
        >
          <Truck size={14} color="#ffffff" />
          <Text style={styles.autoAssignText}>
            {isAutoAssigning ? 'Assigning...' : 'Auto-Assign'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchBar}>
        <Search size={16} color="#64748b" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search order ID, customer, phone..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={16} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Status Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
        {[
          { key: 'all', label: `All (${orders.length})` },
          { key: 'Picking', label: 'Picking' },
          { key: 'Cold-Chain En Route', label: 'En Route' },
          { key: 'Delivered', label: 'Delivered' },
        ].map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, statusFilter === f.key && styles.filterChipActive]}
            onPress={() => setStatusFilter(f.key)}
            accessibilityLabel={`Filter by ${f.label}`}
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
      </ScrollView>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <View style={styles.emptyCard}>
          <ShoppingBag size={42} color="#10b981" style={{ opacity: 0.4, marginBottom: 12 }} />
          <Text style={styles.emptyTitle}>No customer orders found</Text>
          <Text style={styles.emptySubtitle}>
            Orders placed by customers will automatically appear here with real-time updates.
          </Text>
        </View>
      ) : (
        <View style={styles.ordersList}>
          {filteredOrders.map((order) => {
            const displayOrderId = order.id.startsWith('#') ? order.id : `#${order.id}`;
            const formattedDateTime = formatOrderDateTime(order.createdAt);
            const paymentInfo = getDisplayPaymentInfo(order);
            const deliveryBadge = getDeliveryBadgeStyle(order.status);

            const isCod =
              !order.paymentMethod ||
              order.paymentMethod.toLowerCase().includes('cash') ||
              order.paymentMethod.toUpperCase() === 'COD';

            const canConfirmCash =
              isCod &&
              paymentInfo.paymentStatus !== 'COLLECTED' &&
              paymentInfo.paymentStatus !== 'COMPLETED';

            const isCopied = copiedOrderId === order.id;
            const isSavingCash = isConfirmingCash[order.id];

            return (
              <View key={order.id} style={styles.orderCard}>
                {/* 1. TOP ACTION BAR */}
                <View style={styles.topActionBar}>
                  {/* Status Badges Group */}
                  <View style={styles.badgesRow}>
                    {/* Order Delivery Status Badge */}
                    <View
                      style={[
                        styles.badgePill,
                        {
                          backgroundColor: deliveryBadge.bg,
                          borderColor: deliveryBadge.border,
                        },
                      ]}
                    >
                      <View style={[styles.badgeDot, { backgroundColor: deliveryBadge.dot }]} />
                      <Text style={[styles.badgeText, { color: deliveryBadge.text }]}>
                        {order.status}
                      </Text>
                    </View>

                    {/* Payment Status Badge */}
                    <View
                      style={[
                        styles.badgePill,
                        {
                          backgroundColor: paymentInfo.badgeBg,
                          borderColor: paymentInfo.badgeBorder,
                        },
                      ]}
                    >
                      <View style={[styles.badgeDot, { backgroundColor: paymentInfo.dotColor }]} />
                      <Text style={[styles.badgeText, { color: paymentInfo.badgeText }]}>
                        {paymentInfo.paymentStatus}
                      </Text>
                    </View>
                  </View>

                  {/* Action Buttons Group */}
                  <View style={styles.actionsRow}>
                    {/* Copy Record button */}
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleCopyRecord(order)}
                      accessibilityLabel="Copy order record text"
                      activeOpacity={0.7}
                    >
                      {isCopied ? (
                        <>
                          <Check size={13} color="#10b981" />
                          <Text style={[styles.actionBtnText, { color: '#10b981' }]}>Copied</Text>
                        </>
                      ) : (
                        <>
                          <Copy size={13} color="#cbd5e1" />
                          <Text style={styles.actionBtnText}>Copy Record</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    {/* Confirm Cash Collection button (for pending COD orders) */}
                    {canConfirmCash && (
                      <TouchableOpacity
                        style={styles.confirmCashBtn}
                        onPress={() => handleConfirmCashCollection(order)}
                        disabled={isSavingCash}
                        accessibilityLabel={`Confirm cash collection of ${formatINR(order.total)}`}
                        activeOpacity={0.7}
                      >
                        <Banknote size={13} color="#10b981" />
                        <Text style={styles.confirmCashText}>
                          {isSavingCash ? 'Saving...' : 'Confirm Cash Collection'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* Order Status button showing current status & allowing updates */}
                    <TouchableOpacity
                      style={styles.statusDisplayBtn}
                      onPress={() => setStatusModalOrder(order)}
                      accessibilityLabel={`Change status for order ${displayOrderId}`}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.statusDisplayText}>Status: {order.status}</Text>
                      <ChevronDown size={12} color="#94a3b8" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>

                    {/* Assign delivery staff button */}
                    <TouchableOpacity
                      style={styles.iconActionBtn}
                      onPress={() => setAssigningOrder(order)}
                      accessibilityLabel="Assign delivery staff"
                      activeOpacity={0.7}
                    >
                      <UserCheck size={13} color="#10b981" />
                      <Text style={styles.iconActionText}>
                        {order.assignedEmployeeName ? 'Reassign' : 'Assign'}
                      </Text>
                    </TouchableOpacity>

                    {/* Delete button */}
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteOrder(order.id)}
                      accessibilityLabel="Delete order"
                      activeOpacity={0.7}
                    >
                      <Trash2 size={13} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 2. STRUCTURED ORDER RECORD BOX */}
                <View style={styles.recordBox}>
                  {/* Customer Name */}
                  <View style={styles.recordRow}>
                    <Text style={styles.recordLabel}>Customer: </Text>
                    <Text style={styles.recordValueBold}>{order.customerName || 'N/A'}</Text>
                  </View>

                  {/* User ID */}
                  <View style={styles.recordRow}>
                    <Text style={styles.recordLabel}>User ID: </Text>
                    <Text style={styles.recordValue}>{order.customerId || 'N/A'}</Text>
                  </View>

                  {/* Mobile */}
                  <View style={styles.recordRow}>
                    <Text style={styles.recordLabel}>Mobile: </Text>
                    <Text style={styles.recordValue}>
                      {order.customerPhone || 'Not available'}
                    </Text>
                  </View>

                  {/* Order ID (highlighted in neon green) */}
                  <View style={styles.recordRow}>
                    <Text style={styles.recordLabel}>Order ID: </Text>
                    <Text style={styles.orderIdHighlight}>{displayOrderId}</Text>
                  </View>

                  {/* Email address */}
                  {Boolean(order.customerEmail) && (
                    <View style={styles.recordRow}>
                      <Text style={styles.recordLabel}>Email: </Text>
                      <Text style={styles.recordValue}>{order.customerEmail}</Text>
                    </View>
                  )}

                  {/* Date & Time */}
                  <View style={styles.recordRow}>
                    <Text style={styles.recordLabel}>Date & Time: </Text>
                    <Text style={styles.recordValue}>{formattedDateTime}</Text>
                  </View>

                  {/* OTP Verified At if present */}
                  {Boolean(order.otpVerifiedAt) && (
                    <View style={styles.recordRow}>
                      <Text style={styles.recordLabel}>OTP Verified At: </Text>
                      <Text style={styles.orderIdHighlight}>
                        {formatOrderDateTime(order.otpVerifiedAt)}
                      </Text>
                    </View>
                  )}

                  {/* Delivery Address */}
                  {Boolean(order.deliveryAddress) && (
                    <View style={styles.recordRowMultiline}>
                      <Text style={styles.recordLabel}>Address: </Text>
                      <Text style={styles.recordValueAddress} numberOfLines={2}>
                        {order.deliveryAddress}
                      </Text>
                    </View>
                  )}

                  {/* Assigned Employee (if any) */}
                  {Boolean(order.assignedEmployeeName) && (
                    <View style={styles.recordRow}>
                      <Text style={styles.recordLabel}>Assigned Staff: </Text>
                      <Text style={styles.assignedStaffValue}>
                        👤 {order.assignedEmployeeName}
                      </Text>
                    </View>
                  )}

                  {/* 3. PRODUCTS LIST */}
                  <View style={styles.productsSection}>
                    <Text style={styles.productsHeader}>Products:</Text>
                    <View style={styles.productsList}>
                      {(order.items || []).map((item, idx) => {
                        const formatted = formatOrderProductItem(item);
                        return (
                          <Text key={idx} style={styles.productLineItem}>
                            - {formatted.title} — {formatted.qtyAndUnit} — {formatted.linePrice}
                          </Text>
                        );
                      })}
                    </View>
                  </View>

                  {/* 4. PAYMENT & TOTAL SUMMARY */}
                  <View style={styles.paymentSummarySection}>
                    {/* Total (highlighted in neon green) */}
                    <View style={styles.recordRow}>
                      <Text style={styles.recordLabel}>Total: </Text>
                      <Text style={styles.totalHighlight}>{formatINR(order.total)}</Text>
                    </View>

                    {/* Payment Method */}
                    <View style={styles.recordRow}>
                      <Text style={styles.recordLabel}>Payment Method: </Text>
                      <Text style={styles.recordValueBold}>{paymentInfo.paymentMethod}</Text>
                    </View>

                    {/* Payment Status badge line */}
                    <View style={styles.paymentStatusRow}>
                      <Text style={styles.recordLabel}>Payment Status: </Text>
                      <View
                        style={[
                          styles.inlinePaymentBadge,
                          {
                            backgroundColor: paymentInfo.badgeBg,
                            borderColor: paymentInfo.badgeBorder,
                          },
                        ]}
                      >
                        <View
                          style={[styles.badgeDotSmall, { backgroundColor: paymentInfo.dotColor }]}
                        />
                        <Text
                          style={[styles.inlinePaymentBadgeText, { color: paymentInfo.badgeText }]}
                        >
                          {paymentInfo.paymentStatus}
                        </Text>
                      </View>
                    </View>

                    {/* Delivery Status */}
                    <View style={styles.recordRow}>
                      <Text style={styles.recordLabel}>Status: </Text>
                      <Text style={styles.statusHighlight}>{order.status}</Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* STATUS CHANGER MODAL */}
      <Modal visible={!!statusModalOrder} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.statusModalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Update Order Status</Text>
                <Text style={styles.modalSubtitleId}>
                  Order #{statusModalOrder?.id?.replace(/^#/, '')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setStatusModalOrder(null)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalPromptText}>
              Select new delivery status for this customer order:
            </Text>

            <View style={styles.statusOptionsList}>
              {[
                {
                  key: 'Picking',
                  title: 'Picking',
                  desc: 'Warehouse team is gathering and packing products',
                  dot: '#f59e0b',
                },
                {
                  key: 'Cold-Chain En Route',
                  title: 'Cold-Chain En Route',
                  desc: 'Delivery driver is in transit with cold-pack van',
                  dot: '#818cf8',
                },
                {
                  key: 'Delivered',
                  title: 'Delivered',
                  desc: 'Handover complete and order received by customer',
                  dot: '#10b981',
                },
              ].map((st) => {
                const isCurrent = statusModalOrder?.status === st.key;
                return (
                  <TouchableOpacity
                    key={st.key}
                    style={[
                      styles.statusOptionCard,
                      isCurrent && styles.statusOptionCardSelected,
                    ]}
                    onPress={() =>
                      statusModalOrder && handleUpdateStatus(statusModalOrder.id, st.key)
                    }
                  >
                    <View style={styles.statusOptionLeft}>
                      <View style={[styles.statusOptionDot, { backgroundColor: st.dot }]} />
                      <View>
                        <Text
                          style={[
                            styles.statusOptionTitle,
                            isCurrent && { color: '#10b981', fontWeight: '700' },
                          ]}
                        >
                          {st.title}
                        </Text>
                        <Text style={styles.statusOptionDesc}>{st.desc}</Text>
                      </View>
                    </View>
                    {isCurrent && <Check size={18} color="#10b981" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* ASSIGN EMPLOYEE MODAL */}
      <Modal visible={!!assigningOrder} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  Assign Order #{assigningOrder?.id?.replace(/^#/, '')}
                </Text>
                <Text style={styles.modalSubtitleId}>
                  Customer: {assigningOrder?.customerName}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setAssigningOrder(null)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalSubtitle}>
                Select an active delivery team member to assign this order:
              </Text>

              {activeEmployees.length === 0 ? (
                <View style={styles.noStaffCard}>
                  <Text style={styles.noStaffText}>
                    No active delivery employees available. Add active staff in Employee Management first.
                  </Text>
                </View>
              ) : (
                activeEmployees.map((emp) => (
                  <TouchableOpacity
                    key={emp.employeeId}
                    style={styles.employeeOption}
                    onPress={() => handleAssignEmployee(emp.employeeId)}
                  >
                    <View>
                      <Text style={styles.employeeOptionName}>{emp.fullName}</Text>
                      <Text style={styles.employeeOptionId}>ID: {emp.employeeId}</Text>
                      {emp.mobile ? (
                        <Text style={styles.employeeOptionPhone}>Phone: {emp.mobile}</Text>
                      ) : null}
                    </View>
                    <ChevronRight size={18} color="#10b981" />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  heading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  subheading: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  autoAssignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  autoAssignText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0d14',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#ffffff',
    padding: 0,
  },
  filtersScroll: {
    marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  filterChipTextActive: {
    color: '#10b981',
    fontWeight: '700',
  },
  emptyCard: {
    paddingVertical: 48,
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
  },
  ordersList: {
    gap: 16,
  },

  // 1. ORDER CARD CONTAINER
  orderCard: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },

  // 2. TOP ACTION BAR
  topActionBar: {
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingBottom: 12,
    marginBottom: 14,
    gap: 10,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    gap: 6,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 5,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  confirmCashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 78, 59, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.5)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 5,
  },
  confirmCashText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a7f3d0',
  },
  statusDisplayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0d14',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  statusDisplayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  iconActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  iconActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981',
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 3. STRUCTURED ORDER RECORD BOX
  recordBox: {
    backgroundColor: '#05070c',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  recordRowMultiline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  recordLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: 0.1,
  },
  recordValueBold: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  recordValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#e2e8f0',
  },
  recordValueAddress: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#cbd5e1',
    lineHeight: 18,
  },
  orderIdHighlight: {
    fontSize: 13,
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: 0.3,
  },
  assignedStaffValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10b981',
  },

  // 4. PRODUCTS SECTION
  productsSection: {
    paddingTop: 8,
    marginTop: 4,
  },
  productsHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 4,
  },
  productsList: {
    paddingLeft: 8,
    gap: 4,
  },
  productLineItem: {
    fontSize: 13,
    color: '#e2e8f0',
    fontWeight: '500',
    lineHeight: 18,
  },

  // 5. PAYMENT & TOTAL SUMMARY
  paymentSummarySection: {
    paddingTop: 10,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    gap: 6,
  },
  totalHighlight: {
    fontSize: 14,
    fontWeight: '800',
    color: '#10b981',
  },
  paymentStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlinePaymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    gap: 5,
  },
  badgeDotSmall: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  inlinePaymentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  statusHighlight: {
    fontSize: 13,
    fontWeight: '800',
    color: '#10b981',
  },

  // MODAL STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  statusModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0a0d14',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  modalSubtitleId: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalPromptText: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 16,
  },
  statusOptionsList: {
    gap: 10,
  },
  statusOptionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
  },
  statusOptionCardSelected: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  statusOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 8,
  },
  statusOptionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  statusOptionDesc: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },

  // ASSIGN MODAL
  modalContent: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '80%',
    backgroundColor: '#0a0d14',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 14,
  },
  modalBody: {
    marginTop: 6,
  },
  noStaffCard: {
    padding: 20,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    alignItems: 'center',
  },
  noStaffText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
  },
  employeeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  employeeOptionName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  employeeOptionId: {
    fontSize: 12,
    color: '#10b981',
    marginTop: 2,
  },
  employeeOptionPhone: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
});
