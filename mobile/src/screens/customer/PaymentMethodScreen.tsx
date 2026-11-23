import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CreditCard,
  Banknote,
  CheckCircle2,
  ShieldCheck,
  Lock,
  ArrowRight,
  Sparkles,
} from 'lucide-react-native';
import { Header } from '../../components/common/Header';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { customerApi } from '../../services/apiClient';
import { RazorpayMobileService } from '../../services/razorpayMobileService';
import { RazorpayCheckoutModal } from '../../components/payment/RazorpayCheckoutModal';
import { RecipientInfo } from './RecipientDetailsScreen';
import { RazorpayOrderResponse } from '../../types/payment';

interface PaymentMethodScreenProps {
  recipient: RecipientInfo;
  deliveryAddress: string;
  appliedCoupon?: { code: string; discount: number };
  deliveryCharge: number;
  onOrderSuccess: (order: any) => void;
  onBack: () => void;
}

export const PaymentMethodScreen: React.FC<PaymentMethodScreenProps> = ({
  recipient,
  deliveryAddress,
  appliedCoupon,
  deliveryCharge,
  onOrderSuccess,
  onBack,
}) => {
  const insets = useSafeAreaInsets();
  const { cart, subtotal, clearCart } = useCart();
  const { currentCustomer, customerToken } = useAuth();

  const [selectedMethod, setSelectedMethod] = useState<'razorpay' | 'cod'>('razorpay');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');

  // Payment retry tracking
  const [paymentAttemptCount, setPaymentAttemptCount] = useState(0);

  // Razorpay Modal state
  const [razorpayOrder, setRazorpayOrder] = useState<RazorpayOrderResponse | null>(null);
  const [showRazorpayModal, setShowRazorpayModal] = useState(false);

  const discountAmount = appliedCoupon?.discount || 0;
  const finalPayableAmount = Math.max(0, subtotal - discountAmount + deliveryCharge);

  // Base FreshCart order ID - stable throughout checkout session
  const [freshcartOrderId] = useState(() => `#FC-${Math.floor(1000 + Math.random() * 9000)}`);

  // Gateway payment attempt identifier
  const currentAttemptId = paymentAttemptCount === 0
    ? freshcartOrderId
    : `${freshcartOrderId}-R${paymentAttemptCount}`;

  // Clean switching between payment methods
  const handleSelectMethod = (method: 'razorpay' | 'cod') => {
    setSelectedMethod(method);
    setIsProcessing(false);
    setProcessingStatus('');
  };

  // Handle Order Placement
  const handleProceedPayment = async () => {
    if (isProcessing) return;

    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Your cart is empty. Please add items to proceed.');
      return;
    }

    if (selectedMethod === 'cod') {
      // Cash on Delivery direct order creation
      setIsProcessing(true);
      setProcessingStatus('Confirming Cash on Delivery Order...');

      try {
        const orderPayload = {
          id: freshcartOrderId,
          orderId: freshcartOrderId,
          customerName: recipient.fullName.trim(),
          customerId: currentCustomer?.id || 'guest',
          customerEmail: recipient.email.trim() || 'customer@freshcart.com',
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
          status: 'CONFIRMED',
          paymentMethod: 'Cash on Delivery',
          paymentStatus: 'PENDING_COLLECTION',
          createdAt: new Date().toISOString(),
        };

        const res = await customerApi.placeOrder(orderPayload, customerToken || undefined);

        if (res && (res.success || res.order || res.orderId)) {
          const confirmedOrder = {
            ...orderPayload,
            ...(res.order || {}),
            total: (res.order && typeof res.order.total === 'number' && res.order.total > 0)
              ? res.order.total
              : finalPayableAmount,
          };
          clearCart();
          onOrderSuccess(confirmedOrder);
        } else {
          Alert.alert('Order Placement Failed', res?.error || 'Server rejected order submission. Please retry.');
          setIsProcessing(false);
        }
      } catch (err: any) {
        Alert.alert('Order Error', err.message || 'Failed to place order. Please try again.');
        setIsProcessing(false);
      }
      return;
    }

    // Razorpay Online Payment Flow
    setIsProcessing(true);
    setProcessingStatus('Connecting to Secure Razorpay Gateway...');
    setShowRazorpayModal(false);
    setRazorpayOrder(null);

    try {
      const orderParams = {
        freshcart_order_id: currentAttemptId,
        items: cart.map((c) => ({
          id: c.product.id,
          title: c.product.title,
          price: c.selectedPrice !== undefined ? c.selectedPrice : c.product.price,
          quantity: c.quantity,
          selectedPackSize: c.selectedPackSize,
        })),
        appliedCoupon: appliedCoupon?.code || null,
        deliveryAddress: deliveryAddress.trim(),
        customer: {
          name: recipient.fullName.trim(),
          email: recipient.email.trim() || 'customer@freshcart.com',
          phone: recipient.phone.trim(),
        },
      };

      const orderData = await RazorpayMobileService.createPaymentOrder(orderParams);
      console.log('[PaymentScreen] Razorpay order initialized:', orderData.razorpay_order_id);
      setRazorpayOrder(orderData);
      setShowRazorpayModal(true);
      setIsProcessing(false);
      setProcessingStatus('');
    } catch (err: any) {
      console.error('[PaymentScreen] Order creation error:', err);
      setIsProcessing(false);
      setProcessingStatus('');
      setPaymentAttemptCount((prev) => prev + 1);
    }
  };

  // Razorpay Payment Success Handler
  const handleRazorpaySuccess = async (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => {
    setShowRazorpayModal(false);
    setRazorpayOrder(null);
    setIsProcessing(true);
    setProcessingStatus('Authoritatively Verifying Signature...');

    try {
      // 1. Authoritative backend signature verification
      const verifyRes = await RazorpayMobileService.verifyPayment({
        freshcart_order_id: currentAttemptId,
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      });

      console.log('[PaymentScreen] Signature verified successfully:', verifyRes);

      // 2. Submit confirmed order to FreshCart backend
      setProcessingStatus('Finalizing Confirmed Order...');

      const expectedRupees = finalPayableAmount > 0 ? finalPayableAmount : subtotal + deliveryCharge - discountAmount;
      let verifiedTotal = expectedRupees;

      if (verifyRes && typeof verifyRes.amount === 'number' && verifyRes.amount > 0) {
        // If the verified amount is returned in paise (100 paise = 1 INR), convert to rupees exactly once.
        if (expectedRupees > 0 && Math.round(verifyRes.amount) === Math.round(expectedRupees * 100)) {
          verifiedTotal = Math.round((verifyRes.amount / 100) * 100) / 100;
        } else {
          verifiedTotal = verifyRes.amount;
        }
      }

      const orderPayload = {
        id: freshcartOrderId,
        orderId: freshcartOrderId,
        customerName: recipient.fullName.trim(),
        customerId: currentCustomer?.id || 'guest',
        customerEmail: recipient.email.trim() || 'customer@freshcart.com',
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
        total: verifiedTotal,
        couponCode: appliedCoupon?.code || '',
        status: 'CONFIRMED',
        paymentMethod: 'Online Payment (Razorpay)',
        paymentStatus: 'PAID',
        razorpayOrderId: response.razorpay_order_id,
        razorpayPaymentId: response.razorpay_payment_id,
        transactionId: verifyRes?.transaction_id || response.razorpay_payment_id,
        verifiedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      const res = await customerApi.placeOrder(orderPayload, customerToken || undefined);

      const confirmedOrder = {
        ...orderPayload,
        ...(res && res.order ? res.order : {}),
        total: (res && res.order && typeof res.order.total === 'number' && res.order.total > 0)
          ? res.order.total
          : verifiedTotal,
        paymentStatus: 'PAID',
        paymentMethod: 'Online Payment (Razorpay)',
        razorpayPaymentId: response.razorpay_payment_id,
        razorpayOrderId: response.razorpay_order_id,
        transactionId: verifyRes?.transaction_id || response.razorpay_payment_id,
      };

      clearCart();
      onOrderSuccess(confirmedOrder);
    } catch (err: any) {
      console.error('[PaymentScreen] Verification error:', err);
      setIsProcessing(false);
      setProcessingStatus('');
      setPaymentAttemptCount((prev) => prev + 1);
    }
  };

  const handleRazorpayDismiss = () => {
    console.log('[PaymentScreen] Razorpay checkout dismissed by user.');
    setShowRazorpayModal(false);
    setRazorpayOrder(null);
    setIsProcessing(false);
    setProcessingStatus('');
    setPaymentAttemptCount((prev) => prev + 1);
  };

  const handleRazorpayFailure = (error: any) => {
    console.warn('[PaymentScreen] Razorpay payment failed/declined:', error);
    setShowRazorpayModal(false);
    setRazorpayOrder(null);
    setIsProcessing(false);
    setProcessingStatus('');
    setPaymentAttemptCount((prev) => prev + 1);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Checkout" subtitle="Step 4 of 4: Payment Method" showBack onBack={onBack} />

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
            <Text style={styles.stepLabelDone}>Confirm</Text>
          </View>
          <View style={[styles.stepLine, styles.stepLineDone]} />
          <View style={[styles.stepBadge, styles.stepActive]}>
            <Text style={styles.stepNumberActive}>4</Text>
            <Text style={styles.stepLabelActive}>Payment</Text>
          </View>
        </View>

        {/* Section Heading */}
        <Text style={styles.sectionTitle}>Select Payment Method</Text>

        {/* Option 1: Razorpay Online Payment */}
        <TouchableOpacity
          style={[styles.methodCard, selectedMethod === 'razorpay' && styles.methodCardActive]}
          activeOpacity={0.88}
          onPress={() => handleSelectMethod('razorpay')}
        >
          <View style={styles.methodHeader}>
            <View style={styles.methodLeft}>
              <View style={[styles.iconBox, selectedMethod === 'razorpay' && styles.iconBoxActive]}>
                <CreditCard size={22} color={selectedMethod === 'razorpay' ? '#006b2c' : '#64748b'} />
              </View>
              <View style={styles.methodInfo}>
                <View style={styles.titleRow}>
                  <Text style={styles.methodTitle}>Razorpay Secure Online</Text>
                  <View style={styles.recommendedBadge}>
                    <Sparkles size={10} color="#006b2c" />
                    <Text style={styles.recommendedText}>Recommended</Text>
                  </View>
                </View>
                <Text style={styles.methodSubtitle}>
                  UPI, Cards (Visa/Mastercard/RuPay), NetBanking & Wallets
                </Text>
              </View>
            </View>
            <View style={[styles.radio, selectedMethod === 'razorpay' && styles.radioActive]}>
              {selectedMethod === 'razorpay' && <View style={styles.radioInner} />}
            </View>
          </View>

          {selectedMethod === 'razorpay' && (
            <View style={styles.razorpayPerksBox}>
              <View style={styles.perkRow}>
                <CheckCircle2 size={14} color="#006b2c" />
                <Text style={styles.perkText}>Instant Order Confirmation & Cold-Chain Priority</Text>
              </View>
              <View style={styles.perkRow}>
                <ShieldCheck size={14} color="#006b2c" />
                <Text style={styles.perkText}>100% Secure 256-bit Bank-Grade Encryption</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* Option 2: Cash on Delivery (COD) */}
        <TouchableOpacity
          style={[styles.methodCard, selectedMethod === 'cod' && styles.methodCardActive]}
          activeOpacity={0.88}
          onPress={() => handleSelectMethod('cod')}
        >
          <View style={styles.methodHeader}>
            <View style={styles.methodLeft}>
              <View style={[styles.iconBox, selectedMethod === 'cod' && styles.iconBoxActive]}>
                <Banknote size={22} color={selectedMethod === 'cod' ? '#006b2c' : '#64748b'} />
              </View>
              <View style={styles.methodInfo}>
                <View style={styles.titleRow}>
                  <Text style={styles.methodTitle}>Cash on Delivery (COD)</Text>
                  <View style={styles.noOtpBadge}>
                    <Text style={styles.noOtpText}>No OTP Required</Text>
                  </View>
                </View>
                <Text style={styles.methodSubtitle}>
                  Pay at doorstep via Cash or Delivery Partner QR scan
                </Text>
              </View>
            </View>
            <View style={[styles.radio, selectedMethod === 'cod' && styles.radioActive]}>
              {selectedMethod === 'cod' && <View style={styles.radioInner} />}
            </View>
          </View>
        </TouchableOpacity>

        {/* Bill Breakdown Summary */}
        <View style={styles.billCard}>
          <Text style={styles.billHeading}>Payment Breakdown</Text>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Cart Subtotal</Text>
            <Text style={styles.billValue}>₹{subtotal}</Text>
          </View>
          {discountAmount > 0 && (
            <View style={styles.billRow}>
              <Text style={[styles.billLabel, { color: '#006b2c' }]}>
                Coupon ({appliedCoupon?.code})
              </Text>
              <Text style={[styles.billValue, { color: '#006b2c' }]}>-₹{discountAmount}</Text>
            </View>
          )}
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Cold-Chain Delivery</Text>
            <Text style={styles.billValue}>
              {deliveryCharge === 0 ? 'FREE' : `₹${deliveryCharge}`}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Payable Amount</Text>
            <Text style={styles.totalValue}>₹{finalPayableAmount}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <View style={styles.bottomBarLeft}>
          <Text style={styles.bottomTotalLabel}>Total Amount</Text>
          <Text style={styles.bottomTotalValue}>₹{finalPayableAmount}</Text>
        </View>

        <TouchableOpacity
          style={[styles.payBtn, isProcessing && styles.payBtnDisabled]}
          activeOpacity={0.85}
          onPress={handleProceedPayment}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <View style={styles.processingRow}>
              <ActivityIndicator size="small" color="#ffffff" />
              <Text style={styles.payBtnText}>
                {processingStatus || 'Processing...'}
              </Text>
            </View>
          ) : selectedMethod === 'razorpay' ? (
            <>
              <Lock size={18} color="#ffffff" />
              <Text style={styles.payBtnText}>Pay Securely with Razorpay</Text>
              <ArrowRight size={16} color="#ffffff" />
            </>
          ) : (
            <>
              <CheckCircle2 size={18} color="#ffffff" />
              <Text style={styles.payBtnText}>Confirm Place Order (COD)</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* In-App Razorpay Checkout Modal */}
      <RazorpayCheckoutModal
        visible={showRazorpayModal}
        orderData={razorpayOrder}
        onSuccess={handleRazorpaySuccess}
        onDismiss={handleRazorpayDismiss}
        onFailure={handleRazorpayFailure}
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
    padding: 16,
    paddingBottom: 30,
  },
  stepProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
    paddingHorizontal: 8,
  },
  stepBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 54,
  },
  stepActive: {},
  stepDoneCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#006b2c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberActive: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#006b2c',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 26,
    fontSize: 12,
    fontWeight: '800',
  },
  stepLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 4,
  },
  stepLabelDone: {
    fontSize: 10,
    color: '#006b2c',
    fontWeight: '700',
    marginTop: 4,
  },
  stepLabelActive: {
    fontSize: 10,
    color: '#006b2c',
    fontWeight: '800',
    marginTop: 4,
  },
  stepLine: {
    width: 24,
    height: 2,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 3,
    marginBottom: 14,
  },
  stepLineDone: {
    backgroundColor: '#006b2c',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginVertical: 10,
  },
  methodCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  methodCardActive: {
    borderColor: '#006b2c',
    backgroundColor: '#ffffff',
    shadowColor: '#006b2c',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  methodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 8,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxActive: {
    backgroundColor: '#f0fdf4',
  },
  methodInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  methodTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  recommendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  recommendedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#006b2c',
  },
  noOtpBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  noOtpText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  methodSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 15,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: '#006b2c',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#006b2c',
  },
  razorpayPerksBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 6,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  perkText: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
  },
  billCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginVertical: 8,
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
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#006b2c',
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
  payBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#006b2c',
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 12,
  },
  payBtnDisabled: {
    opacity: 0.7,
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
});

