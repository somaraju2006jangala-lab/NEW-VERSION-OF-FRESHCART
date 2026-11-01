import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  Linking,
} from 'react-native';
import {
  Banknote,
  QrCode,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react-native';
import { customerApi } from '../../services/apiClient';
import { Header } from '../../components/common/Header';
import { UpiPaymentSettings } from '../../types';

interface PaymentMethodScreenProps {
  initialPaymentMethod?: 'COD' | 'UPI';
  subtotal: number;
  deliveryCharge: number;
  appliedCoupon?: { code: string; discount: number };
  onNext: (selectedMethod: 'COD' | 'UPI') => void;
  onBack: () => void;
}

export const PaymentMethodScreen: React.FC<PaymentMethodScreenProps> = ({
  initialPaymentMethod = 'COD',
  subtotal,
  deliveryCharge,
  appliedCoupon,
  onNext,
  onBack,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'UPI'>(initialPaymentMethod);
  const [upiSettings, setUpiSettings] = useState<UpiPaymentSettings | null>(null);

  // Sync state if initialPaymentMethod changes
  useEffect(() => {
    if (initialPaymentMethod) {
      setPaymentMethod(initialPaymentMethod);
    }
  }, [initialPaymentMethod]);

  // Fetch backend UPI settings
  useEffect(() => {
    customerApi
      .getUpiSettings()
      .then((res) => {
        if (res.success && res.settings) {
          setUpiSettings(res.settings);
        }
      })
      .catch(() => {});
  }, []);

  const discountAmount = appliedCoupon?.discount || 0;
  const grandTotal = Math.max(0, subtotal - discountAmount + deliveryCharge);

  const handleNext = () => {
    if (!paymentMethod) {
      Alert.alert('Payment Method Required', 'Please select a payment method to proceed.');
      return;
    }

    onNext(paymentMethod);
  };

  const handleOpenUpiApp = () => {
    const vpa = upiSettings?.upiId || 'freshcart@upi';
    const name = encodeURIComponent(upiSettings?.merchantName || 'FreshCart Grocery');
    const note = encodeURIComponent('FreshCart Grocery Order');
    const uri = `upi://pay?pa=${vpa}&pn=${name}&am=${grandTotal.toFixed(2)}&cu=INR&tn=${note}`;
    Linking.openURL(uri).catch(() => {
      Alert.alert('UPI App Not Found', `UPI VPA: ${vpa}\nPlease use Google Pay or PhonePe directly.`);
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Checkout" subtitle="Step 3 of 4: Payment Method" showBack onBack={onBack} />

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
          <View style={[styles.stepBadge, styles.stepActive]}>
            <Text style={styles.stepNumberActive}>3</Text>
            <Text style={styles.stepLabelActive}>Payment</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.stepBadge}>
            <Text style={styles.stepNumber}>4</Text>
            <Text style={styles.stepLabel}>Confirm</Text>
          </View>
        </View>

        {/* Payment Methods Section */}
        <Text style={styles.sectionTitle}>Select Preferred Payment Method</Text>

        {/* Method 1: Cash on Delivery (COD) */}
        <TouchableOpacity
          style={[styles.methodCard, paymentMethod === 'COD' ? styles.methodCardActive : null]}
          activeOpacity={0.9}
          onPress={() => setPaymentMethod('COD')}
        >
          <View style={styles.methodHeader}>
            <View style={styles.methodLeft}>
              <View style={[styles.methodIconBox, paymentMethod === 'COD' ? styles.methodIconBoxActive : null]}>
                <Banknote size={22} color={paymentMethod === 'COD' ? '#006b2c' : '#64748b'} />
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.methodTitle}>Cash on Delivery (COD)</Text>
                  <View style={styles.noOtpBadge}>
                    <Text style={styles.noOtpBadgeText}>Instant Confirmation</Text>
                  </View>
                </View>
                <Text style={styles.methodSubtitle}>
                  Pay with cash or UPI directly upon doorstep delivery.
                </Text>
              </View>
            </View>

            <View style={[styles.radioCircle, paymentMethod === 'COD' ? styles.radioCircleActive : null]}>
              {paymentMethod === 'COD' ? <View style={styles.radioInner} /> : null}
            </View>
          </View>

          {paymentMethod === 'COD' && (
            <View style={styles.codDetailsBox}>
              <CheckCircle2 size={16} color="#006b2c" />
              <Text style={styles.codDetailsText}>
                No advance payment or OTP needed. Your order will be confirmed and packed.
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Method 2: UPI / Online Payment */}
        <TouchableOpacity
          style={[styles.methodCard, paymentMethod === 'UPI' ? styles.methodCardActive : null]}
          activeOpacity={0.9}
          onPress={() => setPaymentMethod('UPI')}
        >
          <View style={styles.methodHeader}>
            <View style={styles.methodLeft}>
              <View style={[styles.methodIconBox, paymentMethod === 'UPI' ? styles.methodIconBoxActive : null]}>
                <QrCode size={22} color={paymentMethod === 'UPI' ? '#006b2c' : '#64748b'} />
              </View>
              <View>
                <Text style={styles.methodTitle}>UPI / Instant App Payment</Text>
                <Text style={styles.methodSubtitle}>
                  GPay, PhonePe, Paytm, or BHIM UPI
                </Text>
              </View>
            </View>

            <View style={[styles.radioCircle, paymentMethod === 'UPI' ? styles.radioCircleActive : null]}>
              {paymentMethod === 'UPI' ? <View style={styles.radioInner} /> : null}
            </View>
          </View>

          {paymentMethod === 'UPI' && (
            <View style={styles.upiDetailsBox}>
              <Text style={styles.upiInstruction}>
                Pay ₹{grandTotal} using your preferred UPI app:
              </Text>
              <View style={styles.vpaRow}>
                <Text style={styles.vpaText}>UPI ID: {upiSettings?.upiId || 'freshcart@upi'}</Text>
              </View>
              <TouchableOpacity style={styles.openUpiBtn} onPress={handleOpenUpiApp}>
                <Text style={styles.openUpiBtnText}>Launch UPI Payment App</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>

        {/* Order Bill Summary */}
        <View style={styles.billCard}>
          <Text style={styles.billHeading}>Order Bill Summary</Text>

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
            <Text style={styles.billLabel}>Delivery Charge</Text>
            <Text style={[styles.billValue, deliveryCharge === 0 && { color: '#006b2c' }]}>
              {deliveryCharge === 0 ? 'FREE' : `₹${deliveryCharge}`}
            </Text>
          </View>

          <View style={styles.billDivider} />

          <View style={styles.billRow}>
            <Text style={styles.grandTotalLabel}>Total Amount</Text>
            <Text style={styles.grandTotalValue}>₹{grandTotal}</Text>
          </View>
        </View>

        {/* Trust Badge */}
        <View style={styles.trustBadge}>
          <ShieldCheck size={18} color="#006b2c" />
          <Text style={styles.trustText}>
            100% Guaranteed Fresh Produce. Inspected & Direct Packed.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Next Action */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomBarLeft}>
          <Text style={styles.bottomTotalLabel}>Total Payable</Text>
          <Text style={styles.bottomTotalValue}>₹{grandTotal}</Text>
        </View>

        <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextBtnText}>Next</Text>
          <ArrowRight size={18} color="#ffffff" />
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
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 28,
    fontSize: 13,
    fontWeight: '700',
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
  stepLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  methodCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginBottom: 12,
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
  },
  methodIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodIconBoxActive: {
    backgroundColor: '#f0fdf4',
  },
  methodTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  methodSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    maxWidth: 220,
  },
  noOtpBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  noOtpBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#006b2c',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#006b2c',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#006b2c',
  },
  codDetailsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  codDetailsText: {
    fontSize: 12,
    color: '#166534',
    flex: 1,
    lineHeight: 16,
    fontWeight: '500',
  },
  upiDetailsBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  upiInstruction: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 6,
  },
  vpaRow: {
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  vpaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  openUpiBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  openUpiBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  billCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 8,
  },
  billHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
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
    fontSize: 17,
    fontWeight: '800',
    color: '#006b2c',
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  trustText: {
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
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#006b2c',
    borderRadius: 14,
    height: 48,
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
});
