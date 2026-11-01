import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  User,
  MapPin,
  Banknote,
  QrCode,
  ShoppingBag,
  Edit2,
  CheckCircle2,
  ShieldCheck,
  Package,
} from 'lucide-react-native';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { customerApi } from '../../services/apiClient';
import { Header } from '../../components/common/Header';
import { RecipientInfo } from './RecipientDetailsScreen';

interface ConfirmOrderScreenProps {
  recipient: RecipientInfo;
  deliveryAddress: string;
  paymentMethod: 'COD' | 'UPI';
  appliedCoupon?: { code: string; discount: number };
  deliveryCharge: number;
  onEditRecipient: () => void;
  onEditAddress: () => void;
  onEditPayment: () => void;
  onOrderSuccess: (order: any) => void;
  onBack: () => void;
}

export const ConfirmOrderScreen: React.FC<ConfirmOrderScreenProps> = ({
  recipient,
  deliveryAddress,
  paymentMethod,
  appliedCoupon,
  deliveryCharge,
  onEditRecipient,
  onEditAddress,
  onEditPayment,
  onOrderSuccess,
  onBack,
}) => {
  const { cart, subtotal, clearCart } = useCart();
  const { currentCustomer, customerToken } = useAuth();
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const discountAmount = appliedCoupon?.discount || 0;
  const finalPayableAmount = Math.max(0, subtotal - discountAmount + deliveryCharge);

  // Validate and submit order to backend
  const handleConfirmPlaceOrder = async () => {
    // Prevent duplicate submission from rapid button clicks
    if (isPlacingOrder) return;

    // 1. Validate all checkout information
    if (!recipient.fullName.trim() || !recipient.phone.trim()) {
      Alert.alert('Missing Details', 'Recipient information is incomplete. Please edit recipient details.');
      return;
    }
    if (!deliveryAddress.trim()) {
      Alert.alert('Missing Address', 'Delivery address is required. Please edit delivery address.');
      return;
    }
    if (!paymentMethod) {
      Alert.alert('Missing Payment', 'Please select a payment method.');
      return;
    }
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Your cart is empty. Please add items before placing an order.');
      return;
    }

    setIsPlacingOrder(true);

    try {
      const generatedOrderId = `#FC-${Math.floor(1000 + Math.random() * 9000)}`;

      const orderPayload = {
        id: generatedOrderId,
        orderId: generatedOrderId,
        customerName: recipient.fullName.trim(),
        customerId: currentCustomer?.id || 'guest',
        customerEmail: recipient.email.trim() || 'guest@freshcart.com',
        customerPhone: recipient.phone.trim(),
        deliveryAddress: deliveryAddress.trim(),
        items: cart.map((c) => ({
          product: {
            id: c.product.id,
            title: c.product.title,
            price: c.selectedPrice !== undefined ? c.selectedPrice : c.product.price,
            unit: c.product.unit,
            image: c.product.image,
            category: c.product.category,
          },
          quantity: c.quantity,
          selectedPackSize: c.selectedPackSize,
          selectedPrice: c.selectedPrice,
        })),
        subtotal,
        discount: discountAmount,
        total: finalPayableAmount,
        couponCode: appliedCoupon?.code || '',
        status: paymentMethod === 'COD' ? 'CONFIRMED' : 'Pending',
        paymentMethod: paymentMethod === 'COD' ? 'Cash on Delivery' : 'UPI',
        paymentStatus: paymentMethod === 'COD' ? 'PENDING_COLLECTION' : 'PENDING',
        createdAt: new Date().toISOString(),
      };

      const res = await customerApi.placeOrder(orderPayload, customerToken || undefined);

      if (res.success || res.order || res.orderId) {
        const confirmedOrder = res.order || orderPayload;
        clearCart();
        onOrderSuccess(confirmedOrder);
      } else {
        Alert.alert('Order Placement Failed', res.error || 'Server rejected order submission. Please retry.');
        setIsPlacingOrder(false);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to place order. Please check connection and try again.');
      setIsPlacingOrder(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Confirm Order" subtitle="Step 4 of 4: Review & Place Order" showBack onBack={onBack} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Progress Indicator - 4 Steps */}
        <View style={styles.stepProgressRow}>
          <View style={styles.stepBadge}>
            <View style={styles.stepDoneCircle}>
              <CheckCircle2 size={16} color="#ffffff" />
            </View>
            <Text style={styles.stepLabelDone}>Recipient</Text>
          </View>
          <View style={[styles.stepLine, styles.stepLineDone]} />
          <View style={styles.stepBadge}>
            <View style={styles.stepDoneCircle}>
              <CheckCircle2 size={16} color="#ffffff" />
            </View>
            <Text style={styles.stepLabelDone}>Address</Text>
          </View>
          <View style={[styles.stepLine, styles.stepLineDone]} />
          <View style={styles.stepBadge}>
            <View style={styles.stepDoneCircle}>
              <CheckCircle2 size={16} color="#ffffff" />
            </View>
            <Text style={styles.stepLabelDone}>Payment</Text>
          </View>
          <View style={[styles.stepLine, styles.stepLineDone]} />
          <View style={[styles.stepBadge, styles.stepActive]}>
            <Text style={styles.stepNumberActive}>4</Text>
            <Text style={styles.stepLabelActive}>Confirm</Text>
          </View>
        </View>

        {/* 1. Recipient Details Card with Edit */}
        <View style={styles.reviewCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconCircle}>
                <User size={18} color="#006b2c" />
              </View>
              <Text style={styles.cardHeaderTitle}>Recipient Details</Text>
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={onEditRecipient}>
              <Edit2 size={14} color="#006b2c" />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.primaryText}>{recipient.fullName}</Text>
            <Text style={styles.secondaryText}>Mobile: {recipient.phone}</Text>
            {recipient.email ? <Text style={styles.secondaryText}>Email: {recipient.email}</Text> : null}
          </View>
        </View>

        {/* 2. Delivery Address Card with Edit */}
        <View style={styles.reviewCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconCircle}>
                <MapPin size={18} color="#006b2c" />
              </View>
              <Text style={styles.cardHeaderTitle}>Delivery Address</Text>
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={onEditAddress}>
              <Edit2 size={14} color="#006b2c" />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.addressText}>{deliveryAddress}</Text>
          </View>
        </View>

        {/* 3. Payment Method Card with Edit */}
        <View style={styles.reviewCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconCircle}>
                {paymentMethod === 'COD' ? (
                  <Banknote size={18} color="#006b2c" />
                ) : (
                  <QrCode size={18} color="#006b2c" />
                )}
              </View>
              <Text style={styles.cardHeaderTitle}>Payment Method</Text>
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={onEditPayment}>
              <Edit2 size={14} color="#006b2c" />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cardBody}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.primaryText}>
                {paymentMethod === 'COD' ? 'Cash on Delivery (COD)' : 'UPI / Online Payment'}
              </Text>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>
                  {paymentMethod === 'COD' ? 'No OTP Required' : 'Instant Pay'}
                </Text>
              </View>
            </View>
            <Text style={styles.secondaryText}>
              {paymentMethod === 'COD'
                ? 'Pay upon doorstep grocery handover via cash or UPI scan.'
                : 'Payment initiated via UPI apps.'}
            </Text>
          </View>
        </View>

        {/* 4. Selected Products & Quantities Review Card */}
        <View style={styles.reviewCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconCircle}>
                <ShoppingBag size={18} color="#006b2c" />
              </View>
              <Text style={styles.cardHeaderTitle}>
                Selected Groceries ({cart.length} item{cart.length === 1 ? '' : 's'})
              </Text>
            </View>
          </View>

          <View style={styles.cardBody}>
            {cart.map((c, idx) => {
              const activePrice = c.selectedPrice !== undefined ? c.selectedPrice : c.product.price;
              const itemTotal = activePrice * c.quantity;

              return (
                <View key={`${c.product.id}-${idx}`} style={styles.productRow}>
                  {c.product.image ? (
                    <Image source={{ uri: c.product.image }} style={styles.productImg} />
                  ) : (
                    <View style={[styles.productImg, styles.productImgPlaceholder]}>
                      <Package size={16} color="#94a3b8" />
                    </View>
                  )}
                  <View style={styles.productDetails}>
                    <Text style={styles.productTitle} numberOfLines={2}>
                      {c.product.title}
                    </Text>
                    <Text style={styles.productUnit}>
                      {c.selectedPackSize || c.product.unit} • ₹{activePrice} each
                    </Text>
                  </View>
                  <View style={styles.productRight}>
                    <Text style={styles.productQty}>Qty: {c.quantity}</Text>
                    <Text style={styles.productItemTotal}>₹{itemTotal}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* 5. Order Bill Summary */}
        <View style={styles.billCard}>
          <Text style={styles.billHeading}>Final Order Bill</Text>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Items Subtotal</Text>
            <Text style={styles.billValue}>₹{subtotal}</Text>
          </View>

          {appliedCoupon && (
            <View style={styles.billRow}>
              <Text style={[styles.billLabel, { color: '#006b2c' }]}>
                Coupon Discount ({appliedCoupon.code})
              </Text>
              <Text style={[styles.billValue, { color: '#006b2c' }]}>- ₹{discountAmount}</Text>
            </View>
          )}

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Delivery Charges</Text>
            <Text style={[styles.billValue, deliveryCharge === 0 && { color: '#006b2c' }]}>
              {deliveryCharge === 0 ? 'FREE' : `₹${deliveryCharge}`}
            </Text>
          </View>

          <View style={styles.billDivider} />

          <View style={styles.billRow}>
            <Text style={styles.grandTotalLabel}>Final Payable Amount</Text>
            <Text style={styles.grandTotalValue}>₹{finalPayableAmount}</Text>
          </View>
        </View>

        {/* Assurance Note */}
        <View style={styles.assuranceBox}>
          <ShieldCheck size={18} color="#006b2c" />
          <Text style={styles.assuranceText}>
            By clicking Confirm Place Order, your grocery order will be immediately saved to MySQL and dispatched.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Confirm Place Order Action */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomBarLeft}>
          <Text style={styles.bottomTotalLabel}>Total Amount</Text>
          <Text style={styles.bottomTotalValue}>₹{finalPayableAmount}</Text>
        </View>

        <TouchableOpacity
          style={[styles.confirmBtn, isPlacingOrder && styles.confirmBtnDisabled]}
          onPress={handleConfirmPlaceOrder}
          disabled={isPlacingOrder}
        >
          {isPlacingOrder ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.confirmBtnText}>Confirm Place Order</Text>
          )}
        </TouchableOpacity>
      </View>
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
    paddingBottom: 24,
  },
  stepProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  stepBadge: {
    alignItems: 'center',
    gap: 4,
  },
  stepActive: {
    transform: [{ scale: 1.05 }],
  },
  stepDoneCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#006b2c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberActive: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#006b2c',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 28,
    fontSize: 13,
    fontWeight: '800',
  },
  stepLabelDone: {
    fontSize: 11,
    color: '#006b2c',
    fontWeight: '700',
  },
  stepLabelActive: {
    fontSize: 11,
    color: '#006b2c',
    fontWeight: '800',
  },
  stepLine: {
    width: 32,
    height: 2,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 6,
    marginBottom: 16,
  },
  stepLineDone: {
    backgroundColor: '#006b2c',
  },
  reviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 10,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#006b2c',
  },
  cardBody: {
    paddingVertical: 2,
  },
  primaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  secondaryText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
  },
  addressText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  statusPill: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
    gap: 10,
  },
  productImg: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  productImgPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  productDetails: {
    flex: 1,
  },
  productTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  productUnit: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  productRight: {
    alignItems: 'flex-end',
  },
  productQty: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  productItemTotal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#006b2c',
    marginTop: 2,
  },
  billCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  billHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  billLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  billValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  billDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 10,
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#006b2c',
  },
  assuranceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
  },
  assuranceText: {
    fontSize: 11,
    color: '#065f46',
    flex: 1,
    lineHeight: 15,
  },
  bottomBar: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  bottomBarLeft: {
    justifyContent: 'center',
  },
  bottomTotalLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  bottomTotalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  confirmBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#006b2c',
    borderRadius: 14,
    height: 48,
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
});
