import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Image,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  User,
  MapPin,
  ShoppingBag,
  Edit2,
  CheckCircle2,
  ShieldCheck,
  Package,
  ArrowRight,
} from 'lucide-react-native';
import { useCart } from '../../context/CartContext';
import { Header } from '../../components/common/Header';
import { RecipientInfo } from './RecipientDetailsScreen';
import { RazorpayMobileService } from '../../services/razorpayMobileService';

interface ConfirmOrderScreenProps {
  recipient: RecipientInfo;
  deliveryAddress: string;
  appliedCoupon?: { code: string; discount: number };
  deliveryCharge: number;
  onEditRecipient: () => void;
  onEditAddress: () => void;
  onProceedToPayment: () => void;
  onBack: () => void;
}

export const ConfirmOrderScreen: React.FC<ConfirmOrderScreenProps> = ({
  recipient,
  deliveryAddress,
  appliedCoupon,
  deliveryCharge,
  onEditRecipient,
  onEditAddress,
  onProceedToPayment,
  onBack,
}) => {
  const insets = useSafeAreaInsets();
  const { cart, subtotal } = useCart();

  useEffect(() => {
    Keyboard.dismiss();
  }, []);

  const discountAmount = appliedCoupon?.discount || 0;
  const finalPayableAmount = Math.max(0, subtotal - discountAmount + deliveryCharge);

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Confirm Order"
        subtitle="Step 3 of 4: Review Order Summary"
        showBack
        onBack={onBack}
      />

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
            <Text style={styles.stepLabelActive}>Confirm</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.stepBadge}>
            <Text style={styles.stepNumber}>4</Text>
            <Text style={styles.stepLabel}>Payment</Text>
          </View>
        </View>

        {/* 1. Recipient Details Review Card */}
        <View style={styles.reviewCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconCircle}>
                <User size={16} color="#006b2c" />
              </View>
              <Text style={styles.cardHeaderTitle}>Recipient Details</Text>
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={onEditRecipient}>
              <Edit2 size={12} color="#006b2c" />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.primaryText}>{recipient.fullName || 'Recipient'}</Text>
            <Text style={styles.secondaryText}>Mobile: {recipient.phone}</Text>
            {recipient.email ? (
              <Text style={styles.secondaryText}>Email: {recipient.email}</Text>
            ) : null}
          </View>
        </View>

        {/* 2. Delivery Address Review Card */}
        <View style={styles.reviewCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconCircle}>
                <MapPin size={16} color="#006b2c" />
              </View>
              <Text style={styles.cardHeaderTitle}>Delivery Address</Text>
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={onEditAddress}>
              <Edit2 size={12} color="#006b2c" />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cardBody}>
            <Text style={styles.addressText}>{deliveryAddress}</Text>
          </View>
        </View>

        {/* 3. Selected Products & Quantities Review Card */}
        <View style={styles.reviewCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.iconCircle}>
                <ShoppingBag size={16} color="#006b2c" />
              </View>
              <Text style={styles.cardHeaderTitle}>
                Selected Groceries ({cart.length} {cart.length === 1 ? 'item' : 'items'})
              </Text>
            </View>
          </View>

          <View style={styles.cardBody}>
            {cart.map((item, idx) => {
              const unitPrice =
                item.selectedPrice !== undefined ? item.selectedPrice : item.product.price;
              const itemTotal = unitPrice * item.quantity;

              return (
                <View
                  key={`${item.product.id}-${idx}`}
                  style={[
                    styles.productRow,
                    idx !== cart.length - 1 && styles.productRowBorder,
                  ]}
                >
                  {item.product.image ? (
                    <Image source={{ uri: item.product.image }} style={styles.productImg} />
                  ) : (
                    <View style={[styles.productImg, styles.productImgPlaceholder]}>
                      <Package size={18} color="#94a3b8" />
                    </View>
                  )}

                  <View style={styles.productDetails}>
                    <Text style={styles.productTitle} numberOfLines={1}>
                      {item.product.title}
                    </Text>
                    <Text style={styles.productUnit}>
                      {item.selectedPackSize || item.product.unit} • ₹{unitPrice} each
                    </Text>
                  </View>

                  <View style={styles.productRight}>
                    <Text style={styles.productQty}>Qty: {item.quantity}</Text>
                    <Text style={styles.productItemTotal}>₹{itemTotal}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* 4. Order Bill Summary */}
        <View style={styles.billCard}>
          <Text style={styles.billHeading}>Final Order Bill</Text>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Item Subtotal</Text>
            <Text style={styles.billValue}>₹{subtotal}</Text>
          </View>

          {discountAmount > 0 ? (
            <View style={styles.billRow}>
              <Text style={[styles.billLabel, { color: '#006b2c' }]}>
                Promotional Discount ({appliedCoupon?.code})
              </Text>
              <Text style={[styles.billValue, { color: '#006b2c' }]}>-₹{discountAmount}</Text>
            </View>
          ) : null}

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Cold-Chain Delivery Charge</Text>
            <Text style={styles.billValue}>
              {deliveryCharge === 0 ? 'FREE' : `₹${deliveryCharge}`}
            </Text>
          </View>

          <View style={styles.billDivider} />

          <View style={styles.billRow}>
            <Text style={styles.grandTotalLabel}>Total Amount</Text>
            <Text style={styles.grandTotalValue}>₹{finalPayableAmount}</Text>
          </View>
        </View>

        {/* Assurance Box */}
        <View style={styles.assuranceBox}>
          <ShieldCheck size={18} color="#006b2c" />
          <Text style={styles.assuranceText}>
            Review your items and delivery address above. In the next step, you can select your preferred payment method (Razorpay or COD).
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Action Bar: Proceed to Payment */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <View style={styles.bottomBarLeft}>
          <Text style={styles.bottomTotalLabel}>Total Amount</Text>
          <Text style={styles.bottomTotalValue}>₹{finalPayableAmount}</Text>
        </View>

        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={() => {
            // Trigger 4: Clicks Proceed to Payment / Payment Selection
            RazorpayMobileService.warmUpBackend('proceed_payment').catch(() => {});
            onProceedToPayment();
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.confirmBtnText}>Proceed to Payment</Text>
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
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e2e8f0',
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 26,
    fontSize: 12,
    fontWeight: '700',
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
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
    gap: 10,
  },
  productRowBorder: {
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#006b2c',
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 12,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
});
