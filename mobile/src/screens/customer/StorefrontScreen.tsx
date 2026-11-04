import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Platform,
} from 'react-native';
import {
  Search,
  ShoppingCart,
  User,
  Plus,
  Minus,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  Filter,
  CheckCircle2,
  X,
  Package,
  Bot,
  AlertCircle,
  RefreshCw,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { customerApi, cleanErrorMessage } from '../../services/apiClient';
import { Header } from '../../components/common/Header';
import { Product } from '../../types';
import { ProductDetailModal } from './ProductDetailModal';
import { CustomerAuthModal } from './CustomerAuthModal';
import { AssistantModal } from './AssistantModal';
import { ProductImageCarousel } from '../../components/carousel/ProductImageCarousel';

const CATEGORIES = [
  { id: 'all', name: 'All Aisles', slug: 'all' },
  { id: 'produce', name: 'Farm Produce', slug: 'produce' },
  { id: 'dairy', name: 'Dairy & Eggs', slug: 'dairy' },
  { id: 'bakery', name: 'Bakery & Bread', slug: 'bakery' },
  { id: 'beverages', name: 'Beverages', slug: 'beverages' },
  { id: 'pantry', name: 'Pantry & Spices', slug: 'pantry' },
  { id: 'meat', name: 'Poultry & Meat', slug: 'meat' },
];

/**
 * Intelligent category matching ensuring every active product from MySQL is surfaced
 * in its appropriate aisle without accidental omissions.
 */
function matchesCategory(
  productCategory: string = '',
  selectedSlug: string = '',
  productTitle: string = ''
): boolean {
  if (!selectedSlug || selectedSlug === 'all') return true;
  const cat = (productCategory || '').trim().toLowerCase();
  const slug = selectedSlug.trim().toLowerCase();
  const title = (productTitle || '').trim().toLowerCase();

  if (cat === slug) return true;

  switch (slug) {
    case 'produce':
      return (
        cat === 'produce' ||
        cat === 'fruits' ||
        cat === 'vegetables' ||
        cat === 'veg' ||
        cat === 'greens'
      );
    case 'dairy':
      return (
        cat === 'dairy' ||
        cat === 'eggs' ||
        title.includes('milk') ||
        title.includes('egg') ||
        title.includes('yogurt') ||
        title.includes('cheese') ||
        title.includes('butter')
      );
    case 'bakery':
      return (
        cat === 'bakery' ||
        cat === 'bread' ||
        title.includes('bread') ||
        title.includes('loaf') ||
        title.includes('bakery') ||
        title.includes('sourdough')
      );
    case 'beverages':
      return (
        cat === 'beverages' ||
        cat === 'drinks' ||
        cat === 'beverage' ||
        title.includes('juice') ||
        title.includes('drink') ||
        title.includes('coffee') ||
        title.includes('tea')
      );
    case 'pantry':
      return (
        cat === 'pantry' ||
        cat === 'grains' ||
        cat === 'grain' ||
        cat === 'spices' ||
        cat === 'staples' ||
        cat === 'oil' ||
        title.includes('rice') ||
        title.includes('sugar') ||
        title.includes('oil') ||
        title.includes('turmeric') ||
        title.includes('spice')
      );
    case 'meat':
      return (
        cat === 'meat' ||
        cat === 'poultry' ||
        cat === 'chicken' ||
        cat === 'fish' ||
        cat === 'mutton' ||
        title.includes('meat') ||
        title.includes('chicken')
      );
    default:
      return cat === slug;
  }
}

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
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
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
      // Retrieve the entire active product catalogue from MySQL via backend API
      const data = await customerApi.getAllProducts();
      if (Array.isArray(data)) {
        setProducts(data);
        setLoadError(null);
        setHasMore(false);
      }
    } catch (err: any) {
      console.warn('Failed loading products:', err);
      setLoadError(cleanErrorMessage(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (isFetchingMore || !hasMore || isLoading) return;
    setIsFetchingMore(true);
    try {
      const more = await customerApi.getProducts({
        offset: products.length,
        limit: 50,
      });
      if (Array.isArray(more) && more.length > 0) {
        setProducts((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const fresh = more.filter((p) => !seen.has(p.id));
          return [...prev, ...fresh];
        });
        if (more.length < 50) setHasMore(false);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.warn('Failed loading more products:', err);
    } finally {
      setIsFetchingMore(false);
    }
  }, [isFetchingMore, hasMore, isLoading, products.length]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Filter products by category and search query across the complete catalogue
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      // Category match
      const inCategory = matchesCategory(p.category, selectedCategory, p.title);
      if (!inCategory) return false;

      // Search match across name, category, aisle label, supplier, description, and badge
      if (!q) return true;
      const titleMatch = (p.title || '').toLowerCase().includes(q);
      const catMatch = (p.category || '').toLowerCase().includes(q);
      const catName = (CATEGORIES.find((c) => c.slug === p.category)?.name || '').toLowerCase();
      const catNameMatch = catName.includes(q);
      const supplierMatch = (p.supplier || '').toLowerCase().includes(q);
      const descMatch = (p.description || '').toLowerCase().includes(q);
      const badgeMatch = (p.badge || '').toLowerCase().includes(q);

      return titleMatch || catMatch || catNameMatch || supplierMatch || descMatch || badgeMatch;
    });
  }, [products, selectedCategory, searchQuery]);

  const renderListHeader = () => (
    <View style={styles.headerComponentWrapper}>
      {/* Premium Interactive Product Image Carousel */}
      <ProductImageCarousel
        products={products}
        onSelectProduct={(prod) => setSelectedProduct(prod)}
      />

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

      {/* Section Header Row */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>
          {searchQuery
            ? `Results for "${searchQuery}"`
            : selectedCategory === 'all'
            ? 'Farm-Fresh Catalogue'
            : CATEGORIES.find((c) => c.slug === selectedCategory)?.name || 'Products'}
        </Text>
        <Text style={styles.sectionSubtitle}>
          {loadError
            ? 'Connection unavailable'
            : `${filteredProducts.length} item${filteredProducts.length === 1 ? '' : 's'} available`}
        </Text>
      </View>
    </View>
  );

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
        <View style={styles.userActionsRow}>
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
          ListHeaderComponent={renderListHeader}
          contentContainerStyle={styles.gridContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => loadProducts(true)} />
          }
          ListFooterComponent={
            isFetchingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#006b2c" />
                <Text style={styles.footerLoaderText}>Loading more farm-fresh products...</Text>
              </View>
            ) : (
              <View style={{ height: 100 }} />
            )
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            loadError ? (
              <View style={styles.errorContainer}>
                <View style={styles.errorIconCircle}>
                  <AlertCircle size={32} color="#ef4444" />
                </View>
                <Text style={styles.errorTitle}>Connection Unavailable</Text>
                <Text style={styles.errorSubtitle}>
                  {cleanErrorMessage(loadError, 'Unable to connect to FreshCart server. Please check your network connection and tap Retry.')}
                </Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => loadProducts()}
                  activeOpacity={0.8}
                >
                  <RefreshCw size={14} color="#ffffff" />
                  <Text style={styles.retryBtnText}>Retry Connection</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <ShoppingBag size={48} color="#cbd5e1" />
                <Text style={styles.emptyTitle}>No Products Found</Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery
                    ? `No products matching "${searchQuery}". Try a different keyword.`
                    : 'No products available in this category yet.'}
                </Text>
                {(searchQuery || selectedCategory !== 'all') && (
                  <TouchableOpacity
                    style={styles.clearFiltersBtn}
                    onPress={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                    }}
                  >
                    <Text style={styles.clearFiltersBtnText}>View All Aisles</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          }
          renderItem={({ item }) => {
            const hasMultiplePacks = Array.isArray(item.packSizes) && item.packSizes.length > 1;
            const itemsInCartForProduct = cart.filter((c) => c.product.id === item.id);
            const totalInCart = itemsInCartForProduct.reduce((sum, c) => sum + c.quantity, 0);
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
                  <Text style={styles.productUnit}>
                    {item.unit}
                    {hasMultiplePacks ? ` • ${item.packSizes!.length} sizes` : ''}
                  </Text>

                  <View style={styles.cardBottomRow}>
                    <Text style={styles.productPrice}>₹{item.price}</Text>

                    {/* Add to cart / Stepper */}
                    {hasMultiplePacks ? (
                      totalInCart > 0 ? (
                        <TouchableOpacity
                          style={[styles.smallAddBtn, styles.multiPackBadgeBtn]}
                          onPress={() => setSelectedProduct(item)}
                        >
                          <Text style={styles.multiPackBadgeText}>{totalInCart} in cart</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.smallAddBtn}
                          onPress={() => setSelectedProduct(item)}
                        >
                          <Text style={styles.smallAddBtnText}>OPTIONS</Text>
                        </TouchableOpacity>
                      )
                    ) : inCartQty > 0 ? (
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

      {/* Floating Shopping Cart Icon (Bottom-Right Corner) */}
      <TouchableOpacity
        style={styles.floatingCartIconBtn}
        activeOpacity={0.85}
        onPress={onOpenCart}
        accessibilityLabel={`Shopping cart, ${itemCount} items`}
        accessibilityRole="button"
      >
        <View style={styles.floatingCartIconInner}>
          <ShoppingCart size={26} color="#006b2c" />
          {itemCount > 0 && (
            <View style={styles.floatingCartBadge}>
              <Text style={styles.floatingCartBadgeText}>
                {itemCount > 99 ? '99+' : itemCount}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Floating AI Assistant Button (Bottom-Left Corner) */}
      <TouchableOpacity
        style={styles.floatingAiBtn}
        activeOpacity={0.88}
        onPress={() => setShowAssistantModal(true)}
      >
        <View style={styles.floatingAiIconCircle}>
          <Bot size={18} color="#ffffff" />
          <View style={styles.aiPulseDot} />
        </View>
        <View style={styles.floatingAiTextCol}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.floatingAiTitle}>AI Assistant</Text>
            <Sparkles size={11} color="#86efac" />
          </View>
          <Text style={styles.floatingAiSubtitle}>Voice & Chat</Text>
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
        onNavigateToCart={() => {
          setShowAssistantModal(false);
          onOpenCart();
        }}
        onSelectProduct={(product) => {
          setShowAssistantModal(false);
          setSelectedProduct(product);
        }}
        catalogProducts={products}
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
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
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
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  clearFiltersBtn: {
    marginTop: 14,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  clearFiltersBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#006b2c',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  footerLoaderText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  errorIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#006b2c',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
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
  multiPackBadgeBtn: {
    backgroundColor: '#006b2c',
    borderColor: '#006b2c',
  },
  multiPackBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
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
  floatingCartIconBtn: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffffff',
    borderWidth: 2.5,
    borderColor: '#00e676',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 4px 18px rgba(0, 230, 118, 0.45), 0 8px 24px rgba(0, 0, 0, 0.12)',
          cursor: 'pointer',
        }
      : {
          shadowColor: '#00e676',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.45,
          shadowRadius: 10,
          elevation: 12,
        }),
  },
  floatingCartIconInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  floatingCartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#00e676',
    borderRadius: 11,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  floatingCartBadgeText: {
    color: '#064e3b',
    fontSize: 11,
    fontWeight: '900',
  },
  floatingAiBtn: {
    position: 'absolute',
    left: 16,
    bottom: 24,
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
    zIndex: 90,
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
  headerComponentWrapper: {
    width: '100%',
    paddingBottom: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
  },
});

