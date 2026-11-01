import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Image } from 'react-native';
import { CheckCircle2, Package, MapPin, ArrowRight, Home, CreditCard, ShoppingBag } from 'lucide-react-native';
import { Header } from '../../components/common/Header';

interface OrderConfirmationScreenProps {
  order: any;
  onTrackOrder: (orderId: string) => void;
  onContinueShopping: () => void;
}

export const OrderConfirmationScreen: React.FC<OrderConfirmationScreenProps> = ({
  order,
  onTrackOrder,
  onContinueShopping,
}) => {
  const items = Array.isArray(order?.items) ? order.items : [];

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Order Confirmation" subtitle="Step 4 of 4" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Celebration Header */}
        <View style={styles.celebrationBox}>
          <View style={styles.checkCircle}>
            <CheckCircle2 size={48} color="#006b2c" />
          </View>
          <Text style={styles.heading}>Order Placed Successfully!</Text>
          <Text style={styles.subheading}>
            Your fresh grocery order has been saved and dispatched to the fulfillment center.
          </Text>
        </View>

        {/* Order Details Card */}
        <View style={styles.card}>
          <View style={styles.orderIdRow}>
            <Text style={styles.orderIdLabel}>Order Identifier</Text>
            <Text style={styles.orderIdValue}>{order?.id || order?.orderId}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Order Date</Text>
            <Text style={styles.detailValue}>
              {order?.createdAt
                ? new Date(order.createdAt).toLocaleString([], {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : new Date().toLocaleDateString()}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Order Status</Text>
            <Text style={[styles.detailValue, { color: '#006b2c' }]}>
              {order?.status || 'CONFIRMED'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Recipient Details</Text>
            <Text style={styles.detailValue}>
              {order?.customerName} {order?.customerPhone ? `(${order.customerPhone})` : ''}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Delivery Address</Text>
            <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]}>
              {order?.deliveryAddress}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment Method</Text>
            <Text style={styles.detailValue}>{order?.paymentMethod || 'Cash on Delivery'}</Text>
          </View>
        </View>

        {/* Ordered Products & Quantities List */}
        <View style={styles.itemsCard}>
          <View style={styles.itemsHeader}>
            <ShoppingBag size={18} color="#006b2c" />
            <Text style={styles.itemsTitle}>Ordered Groceries ({items.length} items)</Text>
          </View>

          {items.map((it: any, index: number) => {
            const prod = it.product || it;
            const title = prod.title || prod.name || 'Grocery Item';
            const qty = it.quantity || 1;
            const unit = it.selectedPackSize || prod.unit || 'unit';
            const price = it.selectedPrice !== undefined ? it.selectedPrice : prod.price;

            return (
              <View key={`${prod.id || index}`} style={styles.itemRow}>
                {prod.image ? (
                  <Image source={{ uri: prod.image }} style={styles.itemImg} />
                ) : (
                  <View style={[styles.itemImg, styles.itemImgPlaceholder]}>
                    <Package size={16} color="#94a3b8" />
                  </View>
                )}
                <View style={styles.itemDetails}>
                  <Text style={styles.itemTitle} numberOfLines={2}>
                    {title}
                  </Text>
                  <Text style={styles.itemPack}>
                    Pack: {unit} • Qty: {qty}
                  </Text>
                </View>
                <Text style={styles.itemPrice}>₹{price * qty}</Text>
              </View>
            );
          })}

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount Paid/Due</Text>
            <Text style={styles.totalValue}>₹{order?.total}</Text>
          </View>
        </View>

        {/* Doorstep Delivery Handover OTP Notice */}
        <View style={styles.otpNoticeBox}>
          <Text style={styles.otpNoticeTitle}>Doorstep Handover OTP</Text>
          <Text style={styles.otpNoticeDesc}>
            A 6-digit delivery verification OTP is generated in your order tracking ledger. Please share this OTP with the delivery partner upon arrival to accept the grocery bag.
          </Text>
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={styles.trackBtn}
          onPress={() => onTrackOrder(order?.id || order?.orderId)}
        >
          <Package size={18} color="#fff" />
          <Text style={styles.trackBtnText}>Track Order & View Handover OTP</Text>
          <ArrowRight size={18} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.shopMoreBtn} onPress={onContinueShopping}>
          <Home size={18} color="#006b2c" />
          <Text style={styles.shopMoreBtnText}>Continue Shopping</Text>
        </TouchableOpacity>
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
    alignItems: 'center',
    paddingBottom: 40,
  },
  celebrationBox: {
    alignItems: 'center',
    marginVertical: 14,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f0fdf4',
    borderWidth: 2,
    borderColor: '#86efac',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heading: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  subheading: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 14,
  },
  orderIdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  orderIdLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  orderIdValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#006b2c',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
    gap: 8,
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  itemsCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 14,
  },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 10,
  },
  itemsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    gap: 10,
  },
  itemImg: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  itemImgPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemDetails: {
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
  itemPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#006b2c',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#006b2c',
  },
  otpNoticeBox: {
    width: '100%',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
  },
  otpNoticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
    marginBottom: 4,
  },
  otpNoticeDesc: {
    fontSize: 11,
    color: '#166534',
    lineHeight: 16,
  },
  trackBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#006b2c',
    borderRadius: 14,
    height: 50,
    marginTop: 18,
  },
  trackBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  shopMoreBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#006b2c',
    borderRadius: 14,
    height: 50,
    marginTop: 10,
  },
  shopMoreBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#006b2c',
  },
});
