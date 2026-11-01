import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Image,
  TextInput,
  Alert,
} from 'react-native';
import {
  Trash2,
  Plus,
  Minus,
  Tag,
  ArrowRight,
  ArrowLeft,
  Truck,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
} from 'lucide-react-native';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { customerApi, settingsApi } from '../../services/apiClient';
import { Header } from '../../components/common/Header';
import { DeliveryChargeRule } from '../../types';

interface CartScreenProps {
  onBack: () => void;
  onProceedToCheckout: (appliedCoupon?: { code: string; discount: number }) => void;
}

export const CartScreen: React.FC<CartScreenProps> = ({
  onBack,
  onProceedToCheckout,
}) => {
  const { cart, updateQuantity, removeFromCart, clearCart, subtotal, itemCount } = useCart();
  const { currentCustomer } = useAuth();

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountPercentage: number;
    discountAmount: number;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Delivery rules state
  const [deliveryRules, setDeliveryRules] = useState<DeliveryChargeRule[]>([]);
  const [deliveryCharge, setDeliveryCharge] = useState(40);

  // Load delivery rules from backend
  useEffect(() => {
    settingsApi
      .getSettings()
      .then((res) => {
        if (res?.success && res.settings?.deliveryChargeRules) {
          setDeliveryRules(res.settings.deliveryChargeRules);
        }
      })
      .catch(() => {});
  }, []);

  // Calculate delivery charge according to active rules
  useEffect(() => {
    if (!deliveryRules || deliveryRules.length === 0) {
      setDeliveryCharge(subtotal >= 3000 ? 0 : 40);
      return;
    }
    // Sort ascending by minOrderAmount
    const sorted = [...deliveryRules].sort((a, b) => a.minOrderAmount - b.minOrderAmount);
    let charge = 40;
    for (const rule of sorted) {
      if (subtotal >= rule.minOrderAmount) {
        charge = rule.deliveryCharge;
      }
    }
    setDeliveryCharge(charge);
  }, [subtotal, deliveryRules]);

  // Recalculate discount if coupon applied
  const discountAmount = appliedCoupon
    ? Math.round((subtotal * appliedCoupon.discountPercentage) / 100)
    : 0;

  const grandTotal = Math.max(0, subtotal - discountAmount + deliveryCharge);

  // Handle Apply Coupon
  const handleApplyCoupon = async () => {
    setCouponError(null);
    const cleanCode = couponCode.trim().toUpperCase();
    if (!cleanCode) {
      setCouponError('Please enter a promo code.');
      return;
    }

    setIsApplyingCoupon(true);
    try {
      const res = await customerApi.validateCoupon(cleanCode, subtotal);
      if (res.valid) {
        const discountPct = Number(res.discountPercentage) || 0;
        const discountAmt = Math.round((subtotal * discountPct) / 100);
        setAppliedCoupon({
          code: cleanCode,
          discountPercentage: discountPct,
          discountAmount: discountAmt,
        });
        Alert.alert('Coupon Applied', `Code ${cleanCode} saved you ₹${discountAmt}!`);
      } else {
        setCouponError(res.message || 'Invalid coupon code or minimum order not met.');
      }
    } catch (err: any) {
      setCouponError(err.message || 'Failed validating coupon.');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError(null);
  };

  if (cart.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Your Cart" showBack onBack={onBack} />
        <View style={styles.emptyWrap}>
          <ShoppingBag size={64} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>Your Cart is Empty</Text>
          <Text style={styles.emptyDesc}>
            Looks like you haven't added any fresh groceries to your cart yet.
          </Text>
          <TouchableOpacity style={styles.startShopBtn} onPress={onBack}>
            <Text style={styles.startShopBtnText}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Your Cart" subtitle={`${itemCount} items`} showBack onBack={onBack} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Free Delivery Bar */}
        {subtotal < 3000 ? (
          <View style={styles.deliveryPromoBox}>
            <Truck size={16} color="#006b2c" />
            <Text style={styles.deliveryPromoText}>
              Add ₹{(3000 - subtotal).toLocaleString('en-IN')} more for{' '}
              <Text style={{ fontWeight: '800' }}>FREE Delivery</Text>!
            </Text>
          </View>
        ) : (
          <View style={[styles.deliveryPromoBox, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
            <CheckCircle2 size={16} color="#047857" />
            <Text style={[styles.deliveryPromoText, { color: '#047857' }]}>
              You have qualified for <Text style={{ fontWeight: '800' }}>FREE Delivery</Text>!
            </Text>
          </View>
        )}

        {/* Cart Items List */}
        <View style={styles.itemsCard}>
          <View style={styles.itemsHeader}>
            <Text style={styles.itemsHeading}>Grocery Items ({cart.length})</Text>
            <TouchableOpacity onPress={clearCart}>
              <Text style={styles.clearCartText}>Clear All</Text>
            </TouchableOpacity>
          </View>

          {cart.map((item, idx) => {
            const price = item.selectedPrice !== undefined ? item.selectedPrice : item.product.price;
            const itemTotal = price * item.quantity;

            return (
              <View key={`${item.product.id}-${item.selectedPackSize || idx}`} style={styles.cartItemRow}>
                <Image source={{ uri: item.product.image }} style={styles.itemImage} />

                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle} numberOfLines={2}>
                    {item.product.title}
                  </Text>
                  <Text style={styles.itemPack}>
                    {item.selectedPackSize || item.product.unit} • ₹{price}
                  </Text>
                  <Text style={styles.itemTotalLine}>Total: ₹{itemTotal}</Text>
                </View>

                {/* Stepper */}
                <View style={styles.stepperWrap}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => updateQuantity(item.product.id, item.quantity - 1, item.selectedPackSize)}
                  >
                    <Minus size={14} color="#006b2c" />
                  </TouchableOpacity>
                  <Text style={styles.stepQty}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => updateQuantity(item.product.id, item.quantity + 1, item.selectedPackSize)}
                  >
                    <Plus size={14} color="#006b2c" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        {/* Promo Coupon Card */}
        <View style={styles.couponCard}>
          <Text style={styles.couponTitle}>Apply Discount Coupon</Text>

          {appliedCoupon ? (
            <View style={styles.appliedCouponRow}>
              <View style={styles.appliedLeft}>
                <Tag size={16} color="#006b2c" />
                <View>
                  <Text style={styles.appliedCode}>{appliedCoupon.code}</Text>
                  <Text style={styles.appliedSavings}>
                    {appliedCoupon.discountPercentage}% OFF (₹{discountAmount} saved)
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={removeCoupon} style={styles.removeCouponBtn}>
                <Text style={styles.removeCouponText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <View style={styles.couponInputRow}>
                <TextInput
                  style={styles.couponInput}
                  placeholder="Enter code (e.g. FRESH20)"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="characters"
                  value={couponCode}
                  onChangeText={setCouponCode}
                />
                <TouchableOpacity
                  style={styles.applyBtn}
                  onPress={handleApplyCoupon}
                  disabled={isApplyingCoupon}
                >
                  <Text style={styles.applyBtnText}>Apply</Text>
                </TouchableOpacity>
              </View>
              {couponError && <Text style={styles.couponErrorText}>{couponError}</Text>}
            </View>
          )}
        </View>

        {/* Bill Summary Card */}
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
            <Text style={styles.grandTotalLabel}>Grand Total</Text>
            <Text style={styles.grandTotalValue}>₹{grandTotal}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Checkout Bottom Bar */}
      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.bottomTotalLabel}>Total to Pay</Text>
          <Text style={styles.bottomTotalValue}>₹{grandTotal}</Text>
        </View>

        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={() =>
            onProceedToCheckout(
              appliedCoupon
                ? { code: appliedCoupon.code, discount: discountAmount }
                : undefined
            )
          }
        >
          <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
          <ArrowRight size={18} color="#fff" />
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
    paddingBottom: 100,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 16,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  startShopBtn: {
    marginTop: 20,
    backgroundColor: '#006b2c',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  startShopBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  deliveryPromoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  deliveryPromoText: {
    fontSize: 12,
    color: '#166534',
    flex: 1,
  },
  itemsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  itemsHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  clearCartText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
  },
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  itemImage: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    marginRight: 10,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  itemPack: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  itemTotalLine: {
    fontSize: 12,
    fontWeight: '700',
    color: '#006b2c',
    marginTop: 2,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 6,
  },
  stepBtn: {
    padding: 4,
  },
  stepQty: {
    fontSize: 13,
    fontWeight: '800',
    color: '#006b2c',
    minWidth: 18,
    textAlign: 'center',
  },
  couponCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  couponTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  couponInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  couponInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '700',
  },
  applyBtn: {
    backgroundColor: '#006b2c',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  applyBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  couponErrorText: {
    color: '#ef4444',
    fontSize: 11,
    marginTop: 6,
  },
  appliedCouponRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    padding: 10,
    borderRadius: 10,
  },
  appliedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appliedCode: {
    fontSize: 13,
    fontWeight: '800',
    color: '#006b2c',
  },
  appliedSavings: {
    fontSize: 11,
    color: '#166534',
  },
  removeCouponBtn: {
    padding: 4,
  },
  removeCouponText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
  },
  billCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  billHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomTotalLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  bottomTotalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#006b2c',
  },
  checkoutBtn: {
    backgroundColor: '#006b2c',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkoutBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
