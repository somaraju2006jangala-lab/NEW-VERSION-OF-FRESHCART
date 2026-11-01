import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import {
  Search,
  ShoppingCart,
  User,
  Plus,
  Minus,
  Sparkles,
  ShoppingBag,
  Clock,
  ArrowRight,
  Filter,
  CheckCircle2,
  X,
  Package,
  Bot,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { customerApi } from '../../services/apiClient';
import { Header } from '../../components/common/Header';
import { Product } from '../../types';
import { ProductDetailModal } from './ProductDetailModal';
import { CustomerAuthModal } from './CustomerAuthModal';
import { AssistantModal } from './AssistantModal';

const CATEGORIES = [
  { id: 'all', name: 'All Aisles', slug: 'all' },
  { id: 'produce', name: 'Farm Produce', slug: 'produce' },
  { id: 'dairy', name: 'Dairy & Eggs', slug: 'dairy' },
  { id: 'bakery', name: 'Bakery & Bread', slug: 'bakery' },
  { id: 'beverages', name: 'Beverages', slug: 'beverages' },
  { id: 'pantry', name: 'Pantry & Spices', slug: 'pantry' },
  { id: 'meat', name: 'Poultry & Meat', slug: 'meat' },
];

interface StorefrontScreenProps {
  onOpenCart: () => void;
  onOpenOrders: () => void;
  onBackToSelection: () => void;
}

export const StorefrontScreen: React.FC<StorefrontScreenProps> = ({
  onOpenCart,
  onOpenOrders,
  onBackToSelection,
}) => {
  const { currentCustomer } = useAuth();
  const { cart, addToCart, updateQuantity, itemCount, subtotal } = useCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAssistantModal, setShowAssistantModal] = useState(false);

  const loadProducts = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const data = await customerApi.getProducts();
      if (Array.isArray(data)) {
        setProducts(data);
      }
    } catch (err) {
      console.warn('Failed loading products:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesCat =
      selectedCategory === 'all' ||
      p.category?.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.supplier?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="FreshCart"
        portalBadge="Customer"
        showCart
        onCartPress={onOpenCart}
      />

      {/* Top Customer Info & Action Strip */}
      <View style={styles.userStrip}>
        <View style={styles.deliveryBadge}>
          <Clock size={13} color="#006b2c" />
          <Text style={styles.deliveryText}>24-30 Min Direct Express</Text>
        </View>

        <View style={styles.userActionsRow}>
          {/* AI Assistant Header Button */}
          <TouchableOpacity
            style={styles.aiAssistantHeaderBtn}
            onPress={() => setShowAssistantModal(true)}
          >
            <Sparkles size={14} color="#006b2c" />
            <Text style={styles.aiAssistantHeaderBtnText}>Ask AI</Text>
          </TouchableOpacity>

          {currentCustomer ? (
            <TouchableOpacity style={styles.ordersBtn} onPress={onOpenOrders}>
              <Package size={14} color="#0284c7" />
              <Text style={styles.ordersBtnText}>My Orders</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.signInBtn}
              onPress={() => setShowAuthModal(true)}
            >
              <User size={14} color="#006b2c" />
              <Text style={styles.signInBtnText}>Sign In</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={18} color="#64748b" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search fresh fruits, vegetables, dairy..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Horizontal Category Filter Pills */}
      <View style={styles.categoriesWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.slug;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
                onPress={() => setSelectedCategory(cat.slug)}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    isSelected && styles.categoryPillTextActive,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Products Grid */}
      {isLoading && !isRefreshing ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#006b2c" />
          <Text style={styles.loadingText}>Fetching farm-fresh catalogue from MySQL...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.gridContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => loadProducts(true)} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <ShoppingBag size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Products Found</Text>
              <Text style={styles.emptySubtitle}>Try adjusting your search query or category filter.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const cartMatch = cart.find((c) => c.product.id === item.id);
            const inCartQty = cartMatch ? cartMatch.quantity : 0;

            return (
              <TouchableOpacity
                style={styles.productCard}
                activeOpacity={0.9}
                onPress={() => setSelectedProduct(item)}
              >
                <View style={styles.cardImageWrapper}>
                  <Image source={{ uri: item.image }} style={styles.cardImage} />
                  {item.badge ? (
                    <View style={styles.itemBadge}>
                      <Text style={styles.itemBadgeText}>{item.badge}</Text>
                    </View>
                  ) : item.isOrganic ? (
                    <View style={[styles.itemBadge, styles.organicBadge]}>
                      <Text style={[styles.itemBadgeText, styles.organicBadgeText]}>Organic</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.cardDetails}>
                  <Text style={styles.productTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.productUnit}>{item.unit}</Text>

                  <View style={styles.cardBottomRow}>
                    <Text style={styles.productPrice}>₹{item.price}</Text>

                    {/* Add to cart / Stepper - Customer-facing stock status removed */}
                    {inCartQty > 0 ? (
                      <View style={styles.smallStepper}>
                        <TouchableOpacity
                          style={styles.smallStepperBtn}
                          onPress={() => updateQuantity(item.id, inCartQty - 1)}
                        >
                          <Minus size={12} color="#006b2c" />
                        </TouchableOpacity>
                        <Text style={styles.smallStepperQty}>{inCartQty}</Text>
                        <TouchableOpacity
                          style={styles.smallStepperBtn}
                          onPress={() => updateQuantity(item.id, inCartQty + 1)}
                        >
                          <Plus size={12} color="#006b2c" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.smallAddBtn}
                        onPress={() => addToCart(item, 1)}
                      >
                        <Plus size={14} color="#006b2c" />
                        <Text style={styles.smallAddBtnText}>ADD</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Floating Cart Bar (when items in cart) */}
      {itemCount > 0 && (
        <View style={styles.floatingCartBar}>
          <View style={styles.floatingCartLeft}>
            <Text style={styles.floatingCartQty}>
              {itemCount} item{itemCount === 1 ? '' : 's'}
            </Text>
            <Text style={styles.floatingCartTotal}>₹{subtotal.toLocaleString('en-IN')}</Text>
          </View>
          <TouchableOpacity style={styles.floatingCartAction} onPress={onOpenCart}>
            <Text style={styles.floatingCartActionText}>View Cart</Text>
            <ArrowRight size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Floating AI Assistant Button (Always accessible) */}
      <TouchableOpacity
        style={[
          styles.floatingAiBtn,
          itemCount > 0 ? { bottom: 84 } : { bottom: 20 },
        ]}
        activeOpacity={0.88}
        onPress={() => setShowAssistantModal(true)}
      >
        <View style={styles.floatingAiIconCircle}>
          <Bot size={20} color="#ffffff" />
          <View style={styles.aiPulseDot} />
        </View>
        <View style={styles.floatingAiTextCol}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.floatingAiTitle}>AI Assistant</Text>
            <Sparkles size={11} color="#86efac" />
          </View>
          <Text style={styles.floatingAiSubtitle}>Voice & Chat Shopping</Text>
        </View>
      </TouchableOpacity>

      {/* Modals */}
      <ProductDetailModal
        product={selectedProduct}
        visible={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onOpenCart={onOpenCart}
      />

      <CustomerAuthModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

      <AssistantModal
        visible={showAssistantModal}
        onClose={() => setShowAssistantModal(false)}
        onNavigateToCart={onOpenCart}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  userStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  deliveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deliveryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  userActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ordersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  ordersBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  signInBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#006b2c',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
  },
  categoriesWrapper: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  categoriesScroll: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryPillActive: {
    backgroundColor: '#006b2c',
    borderColor: '#006b2c',
  },
  categoryPillText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  categoryPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
  },
  gridContent: {
    padding: 10,
    paddingBottom: 90,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  productCard: {
    flex: 1,
    margin: 6,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  cardImageWrapper: {
    width: '100%',
    height: 120,
    backgroundColor: '#f8fafc',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  itemBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#006b2c',
  },
  organicBadge: {
    backgroundColor: '#ecfdf5',
  },
  organicBadgeText: {
    color: '#047857',
  },
  cardDetails: {
    padding: 10,
  },
  productTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    minHeight: 34,
  },
  productUnit: {
    fontSize: 11,
    color: '#64748b',
    marginVertical: 4,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  smallAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#006b2c',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  smallAddBtnDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  smallAddBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#006b2c',
  },
  smallStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#006b2c',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 3,
    gap: 6,
  },
  smallStepperBtn: {
    padding: 2,
  },
  smallStepperQty: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  floatingCartBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#006b2c',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#006b2c',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  floatingCartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  floatingCartQty: {
    fontSize: 12,
    color: '#bbf7d0',
    fontWeight: '600',
  },
  floatingCartTotal: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  floatingCartAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  floatingCartActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  aiAssistantHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    marginRight: 6,
  },
  aiAssistantHeaderBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#006b2c',
  },
  floatingAiBtn: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#0b1726',
    borderRadius: 24,
    paddingVertical: 7,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#10b981',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 9,
    gap: 8,
  },
  floatingAiIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#006b2c',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  aiPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
    position: 'absolute',
    bottom: -1,
    right: -1,
    borderWidth: 1.5,
    borderColor: '#0b1726',
  },
  floatingAiTextCol: {
    justifyContent: 'center',
  },
  floatingAiTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  floatingAiSubtitle: {
    fontSize: 10,
    color: '#86efac',
    fontWeight: '500',
  },
});

