import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Banknote,
  QrCode,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Copy,
  Check,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { customerApi, cleanErrorMessage } from '../../services/apiClient';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { Header } from '../../components/common/Header';
import { UpiPaymentSettings, UploadedPaymentProof } from '../../types';
import { UpiQrCodeView } from '../../components/payment/UpiQrCodeView';
import { UpiPaymentProofUpload } from '../../components/payment/UpiPaymentProofUpload';
import { RecipientInfo } from './RecipientDetailsScreen';
import { useKeyboardAwareScroll } from '../../utils/useKeyboardAwareScroll';

interface PaymentMethodScreenProps {
  initialPaymentMethod?: 'COD' | 'UPI';
  onPaymentMethodChange?: (method: 'COD' | 'UPI') => void;
  subtotal: number;
  deliveryCharge: number;
  appliedCoupon?: { code: string; discount: number };
  orderId: string;
  transactionRef: string;
  recipient: RecipientInfo;
  deliveryAddress: string;
  cartSignature?: string;
  uploadedProof: UploadedPaymentProof | null;
  onProofUploaded: (proof: UploadedPaymentProof) => void;
  onProofCleared: () => void;
  onOrderSuccess: (order: any) => void;
  onBack: () => void;
}

export const PaymentMethodScreen: React.FC<PaymentMethodScreenProps> = ({
  initialPaymentMethod = 'COD',
  onPaymentMethodChange,
  subtotal,
  deliveryCharge,
  appliedCoupon,
  orderId,
  transactionRef,
  recipient,
  deliveryAddress,
  cartSignature,
  uploadedProof,
  onProofUploaded,
  onProofCleared,
  onOrderSuccess,
  onBack,
}) => {
  const insets = useSafeAreaInsets();
  const {
    scrollViewRef,
    containerRef,
    isKeyboardVisible,
    scrollBottomPadding,
    onContainerLayout,
    onScroll,
    setFieldRef,
    scrollSectionIntoView,
  } = useKeyboardAwareScroll();

  useEffect(() => {
    Keyboard.dismiss();
  }, []);

  const { cart, clearCart } = useCart();
  const { currentCustomer, customerToken } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'UPI'>(initialPaymentMethod);
  const [upiSettings, setUpiSettings] = useState<UpiPaymentSettings | null>(null);
  const [proofRequiredError, setProofRequiredError] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const isSubmittingRef = useRef(false);

  // Sync state if initialPaymentMethod changes
  useEffect(() => {
    if (initialPaymentMethod) {
      setPaymentMethod(initialPaymentMethod);
    }
  }, [initialPaymentMethod]);

  const discountAmount = appliedCoupon?.discount || 0;
  const grandTotal = Math.max(0, subtotal - discountAmount + deliveryCharge);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);

  // Fetch backend UPI settings
  useEffect(() => {
    customerApi
      .getUpiSettings(grandTotal)
      .then((res) => {
        if (res.success && res.settings) {
          setUpiSettings(res.settings);
          if (res.settings.qrCodeDataUrl) {
            setQrCodeDataUrl(res.settings.qrCodeDataUrl);
          }
        }
      })
      .catch(() => {});
  }, [grandTotal]);

  const rawUpiId = (upiSettings?.upiId || 'somaraju2006jangala-1@okhdfcbank').trim();
  const rawMerchantName = (upiSettings?.merchantName || 'FreshCart Store').trim();

  const handleSelectMethod = (method: 'COD' | 'UPI') => {
    setPaymentMethod(method);
    onPaymentMethodChange?.(method);
    if (method === 'COD') {
      setProofRequiredError(null);
    } else {
      scrollSectionIntoView('proof', 180);
    }
  };

  const handlePlaceOrder = async () => {
    if (isPlacingOrder || isSubmittingRef.current) return;

    if (!recipient.fullName.trim() || !recipient.phone.trim()) {
      Alert.alert('Missing Details', 'Recipient information is incomplete. Please review recipient details.');
      return;
    }
    if (!deliveryAddress.trim()) {
      Alert.alert('Missing Address', 'Delivery address is required. Please review delivery address.');
      return;
    }
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Your cart is empty. Please add items before placing an order.');
      return;
    }
    if (!paymentMethod) {
      Alert.alert('Payment Method Required', 'Please select a payment method to proceed.');
      return;
    }

    if (paymentMethod === 'UPI' && !uploadedProof) {
      const msg =
        'Please select and upload your UPI payment screenshot proof below the QR code before submitting your order.';
      setProofRequiredError(msg);
      Alert.alert('Payment Proof Required', msg);
      return;
    }

    setProofRequiredError(null);
    isSubmittingRef.current = true;
    setIsPlacingOrder(true);

    try {
      const effectiveOrderId =
        uploadedProof?.orderId ||
        (orderId && orderId.trim()) ||
        `#FC-${Math.floor(100000 + Math.random() * 900000)}`;

      const orderPayload: any = {
        id: effectiveOrderId,
        orderId: effectiveOrderId,
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
        total: grandTotal,
        couponCode: appliedCoupon?.code || '',
        status: paymentMethod === 'COD' ? 'CONFIRMED' : 'Pending',
        paymentMethod: paymentMethod === 'COD' ? 'Cash on Delivery' : 'UPI',
        paymentStatus: paymentMethod === 'COD' ? 'PENDING_COLLECTION' : 'PENDING_VERIFICATION',
        transactionRef:
          paymentMethod === 'UPI' ? uploadedProof?.transactionRef || transactionRef : undefined,
        screenshotUrl: paymentMethod === 'UPI' ? uploadedProof?.screenshotUrl : undefined,
        createdAt: new Date().toISOString(),
      };

      const res =
        paymentMethod === 'UPI'
          ? await customerApi.confirmOrder(effectiveOrderId, orderPayload, customerToken || undefined)
          : await customerApi.placeOrder(orderPayload, customerToken || undefined);

      if (res.success || res.order || res.orderId) {
        const confirmedOrder = {
          ...orderPayload,
          ...(res.order || {}),
          paymentStatus: paymentMethod === 'COD' ? 'PENDING_COLLECTION' : 'PENDING_VERIFICATION',
          screenshotUrl: uploadedProof?.screenshotUrl || res.order?.screenshotUrl,
        };

        clearCart();
        onOrderSuccess(confirmedOrder);
      } else {
        Alert.alert(
          'Order Placement Failed',
          res.error || 'Server rejected order submission. Please retry.'
        );
        isSubmittingRef.current = false;
        setIsPlacingOrder(false);
      }
    } catch (err: any) {
      Alert.alert(
        'Error',
        cleanErrorMessage(err, 'Failed to place order. Please check your connection and try again.')
      );
      isSubmittingRef.current = false;
      setIsPlacingOrder(false);
    }
  };

  const handleCopyUpiId = async () => {
    try {
      await Clipboard.setStringAsync(rawUpiId);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
      Alert.alert('Copied', 'UPI ID copied to clipboard: ' + rawUpiId);
    } catch {
      Alert.alert('Copy failed', 'UPI ID: ' + rawUpiId);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Payment Method" subtitle="Step 4 of 4: Payment & Place Order" showBack onBack={onBack} />

      <View
        ref={containerRef}
        style={{ flex: 1 }}
        onLayout={onContainerLayout}
      >
        <ScrollView
          ref={scrollViewRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: scrollBottomPadding },
          ]}
          showsVerticalScrollIndicator={false}
        >
        {/* Progress Indicator - 4 Steps: Recipient -> Address -> Confirm -> Payment */}
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

        {/* Payment Methods Section */}
        <Text style={styles.sectionTitle}>Select Preferred Payment Method</Text>

        {/* Method 1: Cash on Delivery (COD) */}
        <View style={[styles.methodCard, paymentMethod === 'COD' ? styles.methodCardActive : null]}>
          <TouchableOpacity
            style={styles.methodHeader}
            activeOpacity={0.85}
            onPress={() => handleSelectMethod('COD')}
          >
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
          </TouchableOpacity>

          {paymentMethod === 'COD' && (
            <View style={styles.codDetailsBox}>
              <CheckCircle2 size={16} color="#006b2c" />
              <Text style={styles.codDetailsText}>
                No advance payment or OTP needed. Your order will be confirmed and packed.
              </Text>
            </View>
          )}
        </View>

        {/* Method 2: UPI / Online Payment */}
        <View style={[styles.methodCard, paymentMethod === 'UPI' ? styles.methodCardActive : null]}>
          <TouchableOpacity
            style={styles.methodHeader}
            activeOpacity={0.85}
            onPress={() => handleSelectMethod('UPI')}
          >
            <View style={styles.methodLeft}>
              <View style={[styles.methodIconBox, paymentMethod === 'UPI' ? styles.methodIconBoxActive : null]}>
                <QrCode size={22} color={paymentMethod === 'UPI' ? '#006b2c' : '#64748b'} />
              </View>
              <View>
                <Text style={styles.methodTitle}>UPI / QR Code Payment</Text>
                <Text style={styles.methodSubtitle}>
                  Scan & Pay using Google Pay, PhonePe, Paytm, or BHIM
                </Text>
              </View>
            </View>

            <View style={[styles.radioCircle, paymentMethod === 'UPI' ? styles.radioCircleActive : null]}>
              {paymentMethod === 'UPI' ? <View style={styles.radioInner} /> : null}
            </View>
          </TouchableOpacity>

          {paymentMethod === 'UPI' && (
            <View style={styles.upiDetailsBox}>
              <View style={styles.merchantRow}>
                <Text style={styles.merchantLabel}>Merchant:</Text>
                <Text style={styles.merchantValue}>{rawMerchantName}</Text>
              </View>
              <View style={styles.merchantRow}>
                <Text style={styles.merchantLabel}>Amount to Pay:</Text>
                <Text style={[styles.merchantValue, { color: '#006b2c', fontWeight: '800' }]}>
                  ₹{grandTotal.toFixed(2)}
                </Text>
              </View>

              <View style={styles.vpaRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.vpaLabel}>Official UPI ID:</Text>
                  <Text style={styles.vpaText}>{rawUpiId}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.copyInlineBtn, isCopied && styles.copyInlineBtnSuccess]}
                  onPress={handleCopyUpiId}
                >
                  {isCopied ? <Check size={14} color="#15803d" /> : <Copy size={14} color="#334155" />}
                  <Text style={[styles.copyInlineBtnText, isCopied && styles.copyInlineBtnTextSuccess]}>
                    {isCopied ? 'Copied' : 'Copy'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Scannable QR Code */}
              <UpiQrCodeView
                upiId={rawUpiId}
                merchantName={rawMerchantName}
                amount={grandTotal}
                size={180}
                qrDataUrl={qrCodeDataUrl}
                onRetry={() => {
                  customerApi.getUpiSettings(grandTotal).then((res) => {
                    if (res?.success && res.settings) {
                      setUpiSettings(res.settings);
                      if (res.settings.qrCodeDataUrl) setQrCodeDataUrl(res.settings.qrCodeDataUrl);
                    }
                  });
                }}
              />

              {/* Payment Proof Upload Directly Below QR Code & Instructions */}
              <View ref={setFieldRef('proof')} collapsable={false}>
                <UpiPaymentProofUpload
                  orderId={orderId}
                  transactionRef={transactionRef}
                  amount={grandTotal}
                  upiId={rawUpiId}
                  merchantName={rawMerchantName}
                  upiSettingsReady={upiSettings ? upiSettings.enabled !== false : Boolean(rawUpiId)}
                  recipient={recipient}
                  deliveryAddress={deliveryAddress}
                  subtotal={subtotal}
                  discountAmount={discountAmount}
                  appliedCouponCode={appliedCoupon?.code}
                  cartSignature={cartSignature}
                  uploadedProof={uploadedProof}
                  highlightedError={proofRequiredError}
                  onInteractionFocus={() => scrollSectionIntoView('proof', 140)}
                  onProofUploaded={(proof) => {
                    setProofRequiredError(null);
                    onProofUploaded(proof);
                  }}
                  onProofCleared={() => {
                    onProofCleared();
                    scrollSectionIntoView('proof', 140);
                  }}
                />
              </View>
            </View>
          )}
        </View>

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
      </View>

      {/* Bottom Place Order Action (disabled for UPI until payment proof upload succeeds) */}
      {!isKeyboardVisible && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <View style={styles.bottomBarLeft}>
            <Text style={styles.bottomTotalLabel}>
              {paymentMethod === 'UPI' && !uploadedProof ? 'Upload Proof First' : 'Total Payable'}
            </Text>
            <Text style={styles.bottomTotalValue}>₹{grandTotal}</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.nextBtn,
              (isPlacingOrder || (paymentMethod === 'UPI' && !uploadedProof)) && styles.nextBtnDisabled,
            ]}
            onPress={handlePlaceOrder}
            disabled={isPlacingOrder || (paymentMethod === 'UPI' && !uploadedProof)}
            activeOpacity={0.85}
          >
            {isPlacingOrder ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Text style={styles.nextBtnText}>
                  {paymentMethod === 'UPI' && !uploadedProof
                    ? 'Upload Proof to Submit'
                    : 'Confirm Place Order'}
                </Text>
                {!(paymentMethod === 'UPI' && !uploadedProof) && (
                  <ArrowRight size={18} color="#ffffff" />
                )}
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
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
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
  },
  merchantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  merchantLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  merchantValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  vpaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
    marginTop: 4,
  },
  vpaLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  vpaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  copyInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  copyInlineBtnSuccess: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  copyInlineBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  copyInlineBtnTextSuccess: {
    color: '#15803d',
    fontWeight: '700',
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 6,
  },
  qrFrame: {
    backgroundColor: '#ffffff',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  qrCaption: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 6,
    textAlign: 'center',
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
    paddingHorizontal: 12,
  },
  nextBtnDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.7,
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
});
