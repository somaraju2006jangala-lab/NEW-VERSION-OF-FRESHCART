import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Product, PackSizeOption } from '../../types';
import { useCart } from '../../context/CartContext';
import { X, Plus, Minus, ShoppingCart, Sparkles, CheckCircle2, ShieldAlert } from 'lucide-react-native';

interface ProductDetailModalProps {
  product: Product | null;
  visible: boolean;
  onClose: () => void;
  onOpenCart?: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  visible,
  onClose,
  onOpenCart,
}) => {
  const { cart, addToCart, updateQuantity } = useCart();
  const [selectedPack, setSelectedPack] = useState<PackSizeOption | null>(null);

  useEffect(() => {
    if (product) {
      if (product.packSizes && product.packSizes.length > 0) {
        const firstAvailable =
          product.packSizes.find(
            (ps) => ps.isAvailable !== false && (ps.stock === undefined || ps.stock > 0)
          ) || product.packSizes[0];
        setSelectedPack(firstAvailable);
      } else {
        setSelectedPack(null);
      }
    }
  }, [product]);

  if (!product) return null;

  const packSizes = product.packSizes && product.packSizes.length > 0 ? product.packSizes : null;
  const currentPack = selectedPack || (packSizes ? packSizes[0] : null);
  const activePrice = currentPack ? currentPack.price : product.price;

  const isCurrentPackAvailable = currentPack
    ? currentPack.isAvailable !== false && (currentPack.stock === undefined || currentPack.stock > 0)
    : product.stock > 0;

  const isCurrentPackOutOfStock = currentPack
    ? currentPack.stock !== undefined && currentPack.stock <= 0
    : product.stock <= 0;

  // Check if item already in cart
  const cartItem = cart.find(
    (item) =>
      item.product.id === product.id &&
      (currentPack ? item.selectedPackSize === currentPack.size : true)
  );
  const inCartQty = cartItem ? cartItem.quantity : 0;

  const handleAdd = () => {
    if (!isCurrentPackAvailable) {
      Alert.alert(
        'Item Unavailable',
        currentPack?.isAvailable === false
          ? `Pack size "${currentPack?.size}" is currently marked unavailable.`
          : `Pack size "${currentPack?.size}" is currently out of stock.`
      );
      return;
    }
    addToCart(product, 1, currentPack?.size, activePrice);
  };

  const handleIncrement = () => {
    if (currentPack && currentPack.stock !== undefined && inCartQty >= currentPack.stock) {
      Alert.alert('Maximum Limit Reached', `Maximum available stock reached for ${currentPack.size}.`);
      return;
    }
    addToCart(product, 1, currentPack?.size, activePrice);
  };

  const handleDecrement = () => {
    if (inCartQty > 0) {
      updateQuantity(product.id, inCartQty - 1, currentPack?.size);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Bar */}
          <View style={styles.header}>
            <View style={styles.badgeRow}>
              {product.badge ? (
                <View style={styles.badgePill}>
                  <Sparkles size={12} color="#006b2c" />
                  <Text style={styles.badgeText}>{product.badge}</Text>
                </View>
              ) : null}
              {product.isOrganic && (
                <View style={[styles.badgePill, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                  <Text style={[styles.badgeText, { color: '#047857' }]}>100% Organic</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Product Image */}
            <Image source={{ uri: product.image }} style={styles.productImage} />

            {/* Title & Price */}
            <Text style={styles.title}>{product.title}</Text>
            <Text style={styles.supplierText}>Supplier: {product.supplier}</Text>

            <View style={styles.priceRow}>
              <Text style={styles.price}>₹{activePrice}</Text>
              <Text style={styles.unitText}>/ {currentPack ? currentPack.size : product.unit}</Text>
            </View>

            {/* Pack Size Selector if available */}
            {packSizes && packSizes.length > 0 && (
              <View style={styles.packSection}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={styles.packHeading}>Choose Pack Size:</Text>
                  {currentPack && (
                    <Text style={[styles.packStockTag, !isCurrentPackAvailable && styles.packStockTagUnavailable]}>
                      {currentPack.isAvailable === false
                        ? 'Unavailable'
                        : isCurrentPackOutOfStock
                        ? 'Out of Stock'
                        : 'In Stock'}
                    </Text>
                  )}
                </View>
                <View style={styles.packSizesRow}>
                  {packSizes.map((ps) => {
                    const isSelected = currentPack?.size === ps.size;
                    const isPsAvail = ps.isAvailable !== false;
                    const isPsOut = ps.stock !== undefined && ps.stock <= 0;

                    return (
                      <TouchableOpacity
                        key={ps.size}
                        style={[
                          styles.packPill,
                          isSelected && styles.packPillActive,
                          (!isPsAvail || isPsOut) && styles.packPillDisabled,
                        ]}
                        onPress={() => setSelectedPack(ps)}
                      >
                        <Text style={[styles.packPillText, isSelected && styles.packPillTextActive]}>
                          {ps.size}
                        </Text>
                        <Text style={[styles.packPillPrice, isSelected && styles.packPillPriceActive]}>
                          ₹{ps.price}
                        </Text>
                        {!isPsAvail ? (
                          <Text style={styles.packPillStatusText}>Unavailable</Text>
                        ) : isPsOut ? (
                          <Text style={styles.packPillStatusText}>Out of stock</Text>
                        ) : (
                          <Text style={styles.packPillStockText}>In Stock</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Description */}
            {product.description ? (
              <View style={styles.infoBlock}>
                <Text style={styles.infoHeading}>Product Description</Text>
                <Text style={styles.infoBody}>{product.description}</Text>
              </View>
            ) : null}

            {/* Origin & Nutrition Details */}
            <View style={styles.metaGrid}>
              {product.farmOrigin ? (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Farm Origin</Text>
                  <Text style={styles.metaValue}>{product.farmOrigin}</Text>
                </View>
              ) : null}

              {product.nutrition ? (
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Nutrition</Text>
                  <Text style={styles.metaValue}>{product.nutrition}</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>

          {/* Bottom Add to Cart Bar */}
          <View style={styles.bottomBar}>
            {!isCurrentPackAvailable ? (
              <TouchableOpacity
                style={[styles.addBtn, styles.addBtnDisabled]}
                disabled
                activeOpacity={0.7}
              >
                <ShieldAlert size={18} color="#fff" />
                <Text style={styles.addBtnText}>
                  {currentPack?.isAvailable === false ? 'Currently Unavailable' : 'Out of Stock'}
                </Text>
              </TouchableOpacity>
            ) : inCartQty > 0 ? (
              <View style={styles.stepperContainer}>
                <TouchableOpacity style={styles.stepperBtn} onPress={handleDecrement}>
                  <Minus size={18} color="#006b2c" />
                </TouchableOpacity>
                <Text style={styles.stepperQty}>{inCartQty}</Text>
                <TouchableOpacity style={styles.stepperBtn} onPress={handleIncrement}>
                  <Plus size={18} color="#006b2c" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.viewCartBtn}
                  onPress={() => {
                    onClose();
                    if (onOpenCart) onOpenCart();
                  }}
                >
                  <ShoppingCart size={16} color="#fff" />
                  <Text style={styles.viewCartText}>View Cart</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addBtn}
                onPress={handleAdd}
              >
                <ShoppingCart size={18} color="#fff" />
                <Text style={styles.addBtnText}>
                  Add to Cart • ₹{activePrice}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  closeBtn: {
    padding: 4,
  },
  productImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  supplierText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 14,
  },
  price: {
    fontSize: 24,
    fontWeight: '800',
    color: '#006b2c',
  },
  unitText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  packSection: {
    marginBottom: 14,
  },
  packHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  packSizesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  packPill: {
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
  packPillActive: {
    borderColor: '#006b2c',
    backgroundColor: '#f0fdf4',
  },
  packPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  packPillTextActive: {
    color: '#006b2c',
  },
  packPillPrice: {
    fontSize: 11,
    color: '#64748b',
  },
  packPillPriceActive: {
    color: '#166534',
    fontWeight: '700',
  },
  packStockTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#006b2c',
  },
  packStockTagUnavailable: {
    color: '#dc2626',
  },
  packPillDisabled: {
    borderColor: '#fca5a5',
    backgroundColor: '#fff5f5',
    opacity: 0.75,
  },
  packPillStatusText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#dc2626',
    marginTop: 2,
  },
  packPillStockText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#006b2c',
    marginTop: 2,
  },
  infoBlock: {
    marginBottom: 14,
  },
  infoHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  infoBody: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  metaGrid: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  inStock: {
    color: '#166534',
  },
  outOfStock: {
    color: '#dc2626',
  },
  bottomBar: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  addBtn: {
    backgroundColor: '#006b2c',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#006b2c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperQty: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    minWidth: 24,
    textAlign: 'center',
  },
  viewCartBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#006b2c',
    borderRadius: 12,
    paddingVertical: 12,
  },
  viewCartText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
