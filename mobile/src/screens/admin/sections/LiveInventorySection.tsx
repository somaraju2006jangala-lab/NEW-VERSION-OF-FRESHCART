import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  Package,
  Search,
  Plus,
  Edit2,
  Trash2,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  Upload,
  Check,
  ChevronDown,
} from 'lucide-react-native';
import { Product } from '../../../types';
import { adminApi } from '../../../services/apiClient';
import { AddProductModal } from '../components/AddProductModal';
import { EditProductModal } from '../components/EditProductModal';

interface LiveInventorySectionProps {
  products: Product[];
  adminToken: string | null;
  onRefresh: () => void;
}

export const LiveInventorySection: React.FC<LiveInventorySectionProps> = ({
  products,
  adminToken,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'healthy' | 'low' | 'out'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Add / Edit Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Derived metrics
  const healthyCount = useMemo(() => products.filter((p) => p.stock > 5).length, [products]);
  const lowCount = useMemo(() => products.filter((p) => p.stock >= 1 && p.stock <= 5).length, [products]);
  const outCount = useMemo(() => products.filter((p) => p.stock <= 0).length, [products]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        prod.title?.toLowerCase().includes(q) ||
        prod.sku?.toLowerCase().includes(q) ||
        prod.supplier?.toLowerCase().includes(q) ||
        prod.category?.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // Status
      if (statusFilter === 'healthy' && prod.stock <= 5) return false;
      if (statusFilter === 'low' && (prod.stock < 1 || prod.stock > 5)) return false;
      if (statusFilter === 'out' && prod.stock > 0) return false;

      // Category
      if (categoryFilter !== 'all' && prod.category !== categoryFilter) return false;

      return true;
    });
  }, [products, searchQuery, statusFilter, categoryFilter]);

  const handleOpenAdd = () => {
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (prod: Product) => {
    setEditingProduct(prod);
  };

  const handleDeleteProduct = (prod: Product) => {
    if (!adminToken) return;
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${prod.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminApi.deleteProduct(adminToken, prod.id);
              Alert.alert('Deleted', `"${prod.title}" removed.`);
              onRefresh();
            } catch (err: any) {
              Alert.alert('Delete Failed', err.message || 'Could not delete product.');
            }
          },
        },
      ]
    );
  };

  const handleQuickStockAdjust = async (prod: Product, delta: number) => {
    if (!adminToken) return;
    const newStock = Math.max(0, (prod.stock || 0) + delta);
    try {
      await adminApi.updateProduct(adminToken, prod.id, { stock: newStock });
      onRefresh();
    } catch (err: any) {
      Alert.alert('Stock Update Failed', err.message || 'Could not update stock.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Top SKU Health Badges */}
      <View style={styles.metricsRow}>
        <View style={[styles.metricChip, { borderColor: '#10b981' }]}>
          <Text style={styles.metricChipVal}>{products.length}</Text>
          <Text style={styles.metricChipLabel}>Total SKUs</Text>
        </View>
        <View style={[styles.metricChip, { borderColor: '#059669' }]}>
          <Text style={[styles.metricChipVal, { color: '#10b981' }]}>{healthyCount}</Text>
          <Text style={styles.metricChipLabel}>Healthy</Text>
        </View>
        <View style={[styles.metricChip, { borderColor: '#f59e0b' }]}>
          <Text style={[styles.metricChipVal, { color: '#f59e0b' }]}>{lowCount}</Text>
          <Text style={styles.metricChipLabel}>Low Stock</Text>
        </View>
        <View style={[styles.metricChip, { borderColor: '#ef4444' }]}>
          <Text style={[styles.metricChipVal, { color: '#ef4444' }]}>{outCount}</Text>
          <Text style={styles.metricChipLabel}>Out of Stock</Text>
        </View>
      </View>

      {/* Action Bar */}
      <View style={styles.actionBar}>
        <View style={styles.searchContainer}>
          <Search size={16} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search SKU, item, farm supplier..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={handleOpenAdd}>
          <Plus size={18} color="#fff" />
          <Text style={styles.addBtnText}>Add Product</Text>
        </TouchableOpacity>
      </View>

      {/* Status Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        <TouchableOpacity
          style={[styles.filterChip, statusFilter === 'all' && styles.filterChipActive]}
          onPress={() => setStatusFilter('all')}
        >
          <Text style={[styles.filterChipText, statusFilter === 'all' && styles.filterChipTextActive]}>
            All ({products.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, statusFilter === 'healthy' && styles.filterChipActive]}
          onPress={() => setStatusFilter('healthy')}
        >
          <CheckCircle2 size={12} color={statusFilter === 'healthy' ? '#fff' : '#10b981'} />
          <Text style={[styles.filterChipText, statusFilter === 'healthy' && styles.filterChipTextActive]}>
            In Stock ({healthyCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, statusFilter === 'low' && styles.filterChipActive]}
          onPress={() => setStatusFilter('low')}
        >
          <AlertTriangle size={12} color={statusFilter === 'low' ? '#fff' : '#f59e0b'} />
          <Text style={[styles.filterChipText, statusFilter === 'low' && styles.filterChipTextActive]}>
            Low Stock ({lowCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, statusFilter === 'out' && styles.filterChipActive]}
          onPress={() => setStatusFilter('out')}
        >
          <XCircle size={12} color={statusFilter === 'out' ? '#fff' : '#ef4444'} />
          <Text style={[styles.filterChipText, statusFilter === 'out' && styles.filterChipTextActive]}>
            Out of Stock ({outCount})
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Products List */}
      {filteredProducts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Package size={40} color="#64748b" />
          <Text style={styles.emptyTitle}>No matching products found</Text>
          <Text style={styles.emptySubtitle}>Try adjusting your search query or status filter.</Text>
        </View>
      ) : (
        <View style={styles.productsList}>
          {filteredProducts.map((prod) => {
            const isOutOfStock = prod.stock <= 0;
            const isLowStock = prod.stock >= 1 && prod.stock <= 5;
            return (
              <View key={prod.id} style={styles.productCard}>
                <Image
                  source={{ uri: prod.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80' }}
                  style={styles.productThumb}
                />
                <View style={styles.productInfo}>
                  <View style={styles.productHeaderRow}>
                    <Text style={styles.productTitle} numberOfLines={1}>
                      {prod.title}
                    </Text>
                    <View
                      style={[
                        styles.statusPill,
                        isOutOfStock
                          ? styles.statusPillOut
                          : isLowStock
                          ? styles.statusPillLow
                          : styles.statusPillHealthy,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          isOutOfStock
                            ? styles.statusTextOut
                            : isLowStock
                            ? styles.statusTextLow
                            : styles.statusTextHealthy,
                        ]}
                      >
                        {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'Healthy'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.productMeta}>
                    SKU: {prod.sku || prod.id} · {prod.category}
                  </Text>
                  <Text style={styles.productSupplier} numberOfLines={1}>
                    Supplier: {prod.supplier || 'Local Farm Direct'}
                  </Text>

                  <View style={styles.productBottomRow}>
                    <View>
                      <Text style={styles.productPrice}>₹{prod.price}</Text>
                      <Text style={styles.productUnit}>per {prod.unit || '1 kg'}</Text>
                    </View>

                    {/* Stock Quick Controller */}
                    <View style={styles.stockController}>
                      <TouchableOpacity
                        style={styles.stockAdjBtn}
                        onPress={() => handleQuickStockAdjust(prod, -1)}
                      >
                        <Text style={styles.stockAdjText}>-</Text>
                      </TouchableOpacity>
                      <View style={styles.stockDisplay}>
                        <Text style={styles.stockVal}>{prod.stock}</Text>
                        <Text style={styles.stockUnits}>units</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.stockAdjBtn}
                        onPress={() => handleQuickStockAdjust(prod, 1)}
                      >
                        <Text style={styles.stockAdjText}>+</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Edit & Delete Action Buttons */}
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={styles.editIconBtn}
                        onPress={() => handleOpenEdit(prod)}
                      >
                        <Edit2 size={16} color="#006b2c" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteIconBtn}
                        onPress={() => handleDeleteProduct(prod)}
                      >
                        <Trash2 size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddProduct={async (payload: Partial<Product>) => {
          if (!adminToken) {
            Alert.alert('Authentication Error', 'Admin token missing. Please sign in again.');
            return;
          }
          await adminApi.addProduct(adminToken, payload);
          Alert.alert('Success', `Added "${payload.title}" to live store.`);
          onRefresh();
        }}
      />

      {/* Edit Product Modal */}
      <EditProductModal
        isOpen={!!editingProduct}
        product={editingProduct}
        onClose={() => setEditingProduct(null)}
        onSaveProduct={async (updatedPayload) => {
          if (!adminToken || !editingProduct) {
            Alert.alert('Authentication Error', 'Admin token missing. Please sign in again.');
            return;
          }
          await adminApi.updateProduct(adminToken, editingProduct.id, updatedPayload);
          Alert.alert('Success', `Updated "${updatedPayload.title || editingProduct.title}" successfully.`);
          onRefresh();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  metricChip: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  metricChipVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
  },
  metricChipLabel: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
    fontWeight: '500',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#f8fafc',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#006b2c',
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 10,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  filterScroll: {
    marginBottom: 14,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#006b2c',
    borderColor: '#10b981',
  },
  filterChipText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  productsList: {
    gap: 10,
    paddingBottom: 24,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 12,
    gap: 12,
  },
  productThumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  productInfo: {
    flex: 1,
  },
  productHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  productTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusPillHealthy: {
    backgroundColor: '#064e3b',
  },
  statusPillLow: {
    backgroundColor: '#78350f',
  },
  statusPillOut: {
    backgroundColor: '#7f1d1d',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusTextHealthy: {
    color: '#34d399',
  },
  statusTextLow: {
    color: '#fde047',
  },
  statusTextOut: {
    color: '#fca5a5',
  },
  productMeta: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  productSupplier: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  productBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#10b981',
  },
  productUnit: {
    fontSize: 10,
    color: '#94a3b8',
  },
  stockController: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 2,
  },
  stockAdjBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 6,
  },
  stockAdjText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  stockDisplay: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  stockVal: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '800',
  },
  stockUnits: {
    color: '#64748b',
    fontSize: 9,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editIconBtn: {
    padding: 6,
    backgroundColor: '#064e3b',
    borderRadius: 6,
  },
  deleteIconBtn: {
    padding: 6,
    backgroundColor: '#7f1d1d',
    borderRadius: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
  },
  modalBody: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 6,
    marginTop: 10,
  },
  modalInput: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  multilineInput: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
  },
  colHalf: {
    flex: 1,
  },
  imagePickerRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  pickImgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#006b2c',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 8,
  },
  pickImgText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  imagePreview: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: '#1e293b',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#006b2c',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
