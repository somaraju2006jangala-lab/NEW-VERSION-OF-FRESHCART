import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Edit3,
  X,
  Upload,
  Check,
  Plus,
  Minus,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react-native';
import { Product, PackSizeOption } from '../../../types';
import { getProductPackSizes } from '../../../utils/packSize';

interface EditProductModalProps {
  isOpen: boolean;
  product: Product | null;
  onClose: () => void;
  onSaveProduct: (updatedPayload: Partial<Product>) => Promise<void>;
}

const PRESET_CATEGORIES = [
  'Produce',
  'Dairy',
  'Bakery',
  'Beverages',
  'Snacks',
  'Grains',
  'Pantry',
  'Meat',
];

const DEFAULT_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';

export const EditProductModal: React.FC<EditProductModalProps> = ({
  isOpen,
  product,
  onClose,
  onSaveProduct,
}) => {
  const [title, setTitle] = useState('');
  const [supplier, setSupplier] = useState('');
  const [category, setCategory] = useState('produce');
  const [unit, setUnit] = useState('1 kg');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  const [image, setImage] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [packSizes, setPackSizes] = useState<PackSizeOption[]>([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Sync state when product opens
  useEffect(() => {
    if (product && isOpen) {
      setTitle(product.title || '');
      setSupplier(product.supplier || 'Local Farm Direct');
      setCategory(product.categoryLabel || product.category || 'produce');
      setUnit(product.unit || '1 kg');
      setPrice(product.price ? String(product.price) : '0');
      setQuantity(Math.max(0, product.stock || 0));
      setImage(product.image || '');
      setImagePreview(product.image || '');
      setError('');
      setIsSubmitting(false);

      const initialSizes: PackSizeOption[] =
        Array.isArray(product.packSizes) && product.packSizes.length > 0
          ? product.packSizes.map((ps) => ({
              size: ps.size,
              price: Number(ps.price) || product.price || 0,
              stock: ps.stock !== undefined ? ps.stock : product.stock,
              isAvailable: ps.isAvailable !== false,
            }))
          : getProductPackSizes(product);

      setPackSizes(initialSizes);
    }
  }, [product, isOpen]);

  // Adjust quantity with +/- buttons
  const handleQuantityDelta = (delta: number) => {
    const nextQty = Math.max(0, quantity + delta);
    setQuantity(nextQty);
    // Sync with Sub-Unit #1 stock if it's default
    setPackSizes((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      next[0] = { ...next[0], stock: nextQty };
      return next;
    });
  };

  // Direct edit of quantity text input
  const handleQuantityChange = (valStr: string) => {
    const val = parseInt(valStr, 10);
    const nextQty = isNaN(val) ? 0 : Math.max(0, val);
    setQuantity(nextQty);
    setPackSizes((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      next[0] = { ...next[0], stock: nextQty };
      return next;
    });
  };

  // Change top-level unit
  const handleUnitChange = (newUnit: string) => {
    setUnit(newUnit);
    setPackSizes((prev) => {
      if (prev.length === 0) return [{ size: newUnit, price: parseFloat(price) || 0, stock: quantity, isAvailable: true }];
      const next = [...prev];
      next[0] = { ...next[0], size: newUnit };
      return next;
    });
  };

  // Change top-level price
  const handlePriceChange = (newPrice: string) => {
    setPrice(newPrice);
    const num = parseFloat(newPrice) || 0;
    setPackSizes((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      next[0] = { ...next[0], price: num };
      return next;
    });
  };

  // Add new pack size row
  const handleAddPackSizeRow = () => {
    const basePrice = parseFloat(price) || product?.price || 50;
    setPackSizes((prev) => [
      ...prev,
      {
        size: '',
        price: basePrice,
        stock: quantity,
        isAvailable: true,
      },
    ]);
  };

  // Update pack size details
  const updatePackSizeField = (
    index: number,
    field: 'size' | 'price' | 'stock' | 'isAvailable',
    value: any
  ) => {
    setPackSizes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });

    if (index === 0) {
      if (field === 'size') setUnit(value);
      if (field === 'price') setPrice(value > 0 ? String(value) : '');
      if (field === 'stock') setQuantity(value !== undefined ? Number(value) || 0 : 0);
    }
  };

  // Remove pack size row
  const handleRemovePackSize = (index: number) => {
    if (index === 0) return;
    setPackSizes((prev) => prev.filter((_, i) => i !== index));
  };

  // Image picking
  const pickImage = async () => {
    setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsUploadingImage(true);
        const asset = result.assets[0];
        let imgData = asset.base64 ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}` : asset.uri;

        // On Web or large images, compress using canvas down to max 800px
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
          try {
            const dataUrl = await new Promise<string>((resolve) => {
              const img = new (window as any).Image();
              img.onload = () => {
                try {
                  const maxDim = 800;
                  let { width, height } = img;
                  if (width > maxDim || height > maxDim) {
                    if (width > height) {
                      height = Math.round((height * maxDim) / width);
                      width = maxDim;
                    } else {
                      width = Math.round((width * maxDim) / height);
                      height = maxDim;
                    }
                  }
                  const canvas = document.createElement('canvas');
                  canvas.width = width;
                  canvas.height = height;
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                    return;
                  }
                } catch {
                  // fallback
                }
                resolve(imgData);
              };
              img.onerror = () => resolve(imgData);
              img.src = imgData;
            });
            imgData = dataUrl;
          } catch {
            // fallback
          }
        }

        setImage(imgData);
        setImagePreview(imgData);
        setIsUploadingImage(false);
      }
    } catch {
      setIsUploadingImage(false);
      Alert.alert('Notice', 'Unable to pick image. You can also paste an image URL directly.');
    }
  };

  // Save changes
  const handleSubmit = async () => {
    if (!product) return;
    setError('');

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Please enter a product name.');
      return;
    }

    const trimmedSupplier = supplier.trim();
    if (!trimmedSupplier) {
      setError('Please enter a supplier name.');
      return;
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      setError('Please enter a valid price greater than ₹0.');
      return;
    }

    if (isNaN(quantity) || quantity < 0) {
      setError('Stock quantity cannot be negative.');
      return;
    }

    if (!unit.trim()) {
      setError('Please specify a product unit / pack size.');
      return;
    }

    if (!category.trim()) {
      setError('Please enter a category.');
      return;
    }

    // Validate pack sizes
    for (let i = 0; i < packSizes.length; i++) {
      const ps = packSizes[i];
      if (!ps.size || !ps.size.trim()) {
        setError(`Please enter a pack size name for Sub-Unit #${i + 1}.`);
        return;
      }
      const pNum = Number(ps.price);
      if (isNaN(pNum) || pNum <= 0) {
        setError(`Pack size "${ps.size}" must have a valid price greater than ₹0.`);
        return;
      }
    }

    const finalImage = (image || imagePreview || product.image || DEFAULT_FALLBACK_IMAGE).trim();

    const finalPackSizes = packSizes.map((ps, idx) => ({
      size: ps.size.trim(),
      price: Math.max(1, Math.round(Number(ps.price) || numPrice)),
      isAvailable: ps.isAvailable !== false,
      stock:
        idx === 0
          ? quantity
          : ps.stock !== undefined && String(ps.stock).trim() !== '' && !isNaN(Number(ps.stock))
          ? Math.max(0, Math.floor(Number(ps.stock)))
          : undefined,
    }));

    const updatedPayload: Partial<Product> = {
      title: trimmedTitle,
      supplier: trimmedSupplier,
      category: category.trim().toLowerCase(),
      categoryLabel: category.trim(),
      unit: unit.trim(),
      price: numPrice,
      stock: quantity,
      image: finalImage,
      packSizes: finalPackSizes,
    };

    setIsSubmitting(true);
    try {
      await onSaveProduct(updatedPayload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update product. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={isOpen} animationType="slide" transparent>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <View style={styles.greenIconBox}>
                <Edit3 size={18} color="#ffffff" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Edit Product Details</Text>
                <Text style={styles.modalSubtitle}>
                  Update product pricing, inventory levels, pack sizes, and images.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityLabel="Close modal"
            >
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Form Scroll Body */}
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Error Banner */}
            {Boolean(error) && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* 1. Product Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Product Name *</Text>
              <TextInput
                style={styles.textInput}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Organic Farm Bananas"
                placeholderTextColor="#64748b"
              />
            </View>

            {/* 2. Supplier */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Supplier *</Text>
              <TextInput
                style={styles.textInput}
                value={supplier}
                onChangeText={setSupplier}
                placeholder="e.g. Local Farm Direct"
                placeholderTextColor="#64748b"
              />
            </View>

            {/* 3. Category */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category *</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.pillsScroll}
              >
                {PRESET_CATEGORIES.map((cat) => {
                  const isSelected = category.toLowerCase() === cat.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.pill, isSelected && styles.pillSelected]}
                      onPress={() => setCategory(cat.toLowerCase())}
                    >
                      <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TextInput
                style={styles.textInput}
                value={category}
                onChangeText={setCategory}
                placeholder="produce, dairy, bakery, beverages..."
                placeholderTextColor="#64748b"
              />
            </View>

            {/* 4. Product Image Upload & Preview */}
            <View style={styles.imageCard}>
              <View style={styles.imageCardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <ImageIcon size={15} color="#10b981" />
                  <Text style={styles.imageCardTitle}>Product Image</Text>
                </View>
                <Text style={styles.imageCardFormatText}>PNG, JPG, WebP</Text>
              </View>

              <View style={styles.imageRow}>
                {/* Image Preview Thumbnail */}
                <View style={styles.imageThumbnailWrap}>
                  <Image
                    source={{ uri: imagePreview || image || DEFAULT_FALLBACK_IMAGE }}
                    style={styles.imageThumbnail}
                  />
                </View>

                {/* Upload Action & URL fallback */}
                <View style={{ flex: 1, gap: 8 }}>
                  <TouchableOpacity
                    style={styles.uploadImgBtn}
                    onPress={pickImage}
                    disabled={isUploadingImage}
                  >
                    <Upload size={14} color="#10b981" />
                    <Text style={styles.uploadImgText}>
                      {isUploadingImage ? 'Reading...' : 'Upload / Replace Image'}
                    </Text>
                  </TouchableOpacity>

                  <TextInput
                    style={styles.imageUrlInput}
                    value={image.startsWith('data:') ? '' : image}
                    onChangeText={(val) => {
                      setImage(val);
                      setImagePreview(val);
                    }}
                    placeholder="Or paste remote image URL (https://...)"
                    placeholderTextColor="#64748b"
                  />
                </View>
              </View>
            </View>

            {/* 5. Stock Quantity & 6. Price (2 Columns) */}
            <View style={styles.twoColRow}>
              {/* Stock Quantity with Stepper */}
              <View style={styles.colHalf}>
                <Text style={styles.inputLabel}>Stock Quantity *</Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={[styles.stepperBtn, quantity <= 0 && styles.stepperBtnDisabled]}
                    onPress={() => handleQuantityDelta(-1)}
                    disabled={quantity <= 0}
                  >
                    <Minus size={14} color="#ffffff" />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.stepperInput}
                    value={String(quantity)}
                    onChangeText={handleQuantityChange}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity
                    style={styles.stepperBtnAdd}
                    onPress={() => handleQuantityDelta(1)}
                  >
                    <Plus size={14} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Price */}
              <View style={styles.colHalf}>
                <Text style={styles.inputLabel}>Price (₹) *</Text>
                <View style={styles.currencyInputBox}>
                  <Text style={styles.currencyPrefix}>₹</Text>
                  <TextInput
                    style={styles.currencyInput}
                    value={price}
                    onChangeText={handlePriceChange}
                    placeholder="170"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

            {/* 7. Unit / Pack Size */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Unit / Pack Size *</Text>
              <TextInput
                style={styles.textInput}
                value={unit}
                onChangeText={handleUnitChange}
                placeholder="e.g. 1 dozen, 1 kg, 500 g, 1 litre, ½ dozen..."
                placeholderTextColor="#64748b"
              />
            </View>

            {/* 8. Pack Sizes, Prices, Stock & Availability Section */}
            <View style={styles.packSizesCard}>
              <View style={styles.packSizesHeader}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.packSizesTitle}>
                    Pack Sizes, Prices, Stock & Availability
                  </Text>
                  <Text style={styles.packSizesSubtitle}>
                    Configure independent prices, stock, and availability status for each pack size.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.addPackSizeBtn}
                  onPress={handleAddPackSizeRow}
                  activeOpacity={0.8}
                >
                  <Plus size={14} color="#ffffff" />
                  <Text style={styles.addPackSizeBtnText}>Add Pack Size</Text>
                </TouchableOpacity>
              </View>

              {/* Pack Size Rows (Sub-Units) */}
              <View style={styles.subUnitsList}>
                {packSizes.map((ps, idx) => {
                  const isDefault = idx === 0;
                  const isAvail = ps.isAvailable !== false;
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.subUnitCard,
                        isDefault && styles.subUnitDefaultCard,
                      ]}
                    >
                      {/* Sub-Unit Title / Default Badge */}
                      <View style={styles.subUnitHeader}>
                        <View style={styles.subUnitTitleGroup}>
                          <Text style={styles.subUnitTitle}>Sub-Unit #{idx + 1}</Text>
                          {isDefault && (
                            <View style={styles.defaultBadge}>
                              <Text style={styles.defaultBadgeText}>Default Unit</Text>
                            </View>
                          )}
                        </View>
                        {!isDefault && (
                          <TouchableOpacity
                            onPress={() => handleRemovePackSize(idx)}
                            style={styles.removeSubUnitBtn}
                          >
                            <Trash2 size={14} color="#ef4444" />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Row Inputs: Pack Size, Price, Stock */}
                      <View style={styles.subUnitInputsRow}>
                        <View style={{ flex: 1.2, minWidth: 100 }}>
                          <Text style={styles.subInputLabel}>Pack Size</Text>
                          <TextInput
                            style={styles.subInput}
                            value={ps.size}
                            onChangeText={(val) => updatePackSizeField(idx, 'size', val)}
                            placeholder="e.g. 1/2 dozen"
                            placeholderTextColor="#64748b"
                          />
                        </View>

                        <View style={{ flex: 0.9, minWidth: 80 }}>
                          <Text style={styles.subInputLabel}>Price (₹)</Text>
                          <TextInput
                            style={styles.subInput}
                            value={ps.price ? String(ps.price) : ''}
                            onChangeText={(val) =>
                              updatePackSizeField(idx, 'price', Number(val) || 0)
                            }
                            placeholder="Price"
                            placeholderTextColor="#64748b"
                            keyboardType="numeric"
                          />
                        </View>

                        <View style={{ flex: 0.9, minWidth: 80 }}>
                          <Text style={styles.subInputLabel}>Stock Qty</Text>
                          <TextInput
                            style={styles.subInput}
                            value={ps.stock !== undefined ? String(ps.stock) : ''}
                            onChangeText={(val) =>
                              updatePackSizeField(
                                idx,
                                'stock',
                                val.trim() === '' ? undefined : Math.max(0, parseInt(val, 10) || 0)
                              )
                            }
                            placeholder={isDefault ? String(quantity) : 'Mapped'}
                            placeholderTextColor="#64748b"
                            keyboardType="numeric"
                          />
                        </View>
                      </View>

                      {/* Availability Status Toggle */}
                      <View style={styles.availToggleRow}>
                        <Text style={styles.subInputLabel}>Availability Status:</Text>
                        <TouchableOpacity
                          style={[
                            styles.availToggleBtn,
                            isAvail ? styles.availBtnActive : styles.availBtnInactive,
                          ]}
                          onPress={() => updatePackSizeField(idx, 'isAvailable', !isAvail)}
                        >
                          {isAvail ? (
                            <>
                              <Check size={12} color="#10b981" />
                              <Text style={styles.availTextActive}>Available</Text>
                            </>
                          ) : (
                            <>
                              <X size={12} color="#ef4444" />
                              <Text style={styles.availTextInactive}>Unavailable</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Footer Action Buttons */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Check size={16} color="#ffffff" />
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modalCard: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '92%',
    backgroundColor: '#060b13',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0a101d',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  greenIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#006b2c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  modalBody: {
    padding: 16,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#ffffff',
  },
  pillsScroll: {
    marginBottom: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    marginRight: 6,
  },
  pillSelected: {
    backgroundColor: '#006b2c',
    borderColor: '#10b981',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  pillTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },

  // Image section
  imageCard: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  imageCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  imageCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  imageCardFormatText: {
    fontSize: 10,
    color: '#94a3b8',
  },
  imageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  imageThumbnailWrap: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  imageThumbnail: {
    width: '100%',
    height: '100%',
  },
  uploadImgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  uploadImgText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10b981',
  },
  imageUrlInput: {
    backgroundColor: '#0a0d14',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 11,
    color: '#ffffff',
  },

  // Two col
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  colHalf: {
    flex: 1,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    padding: 3,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.4,
  },
  stepperInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    paddingVertical: 4,
  },
  stepperBtnAdd: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#006b2c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  currencyPrefix: {
    fontSize: 14,
    fontWeight: '800',
    color: '#94a3b8',
    marginRight: 4,
  },
  currencyInput: {
    flex: 1,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Pack sizes section
  packSizesCard: {
    borderWidth: 1,
    borderColor: '#10b981',
    backgroundColor: 'rgba(6, 78, 59, 0.1)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  packSizesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  packSizesTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#10b981',
  },
  packSizesSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  addPackSizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#006b2c',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addPackSizeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  quickAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  quickAddLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10b981',
  },
  quickAddPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginRight: 6,
  },
  quickAddPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  subUnitsList: {
    gap: 10,
  },
  subUnitCard: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
  },
  subUnitDefaultCard: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: '#040d12',
  },
  subUnitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subUnitTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subUnitTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  defaultBadge: {
    backgroundColor: '#064e3b',
    borderWidth: 1,
    borderColor: '#10b981',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#34d399',
  },
  removeSubUnitBtn: {
    padding: 4,
  },
  subUnitInputsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  subInputLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 3,
  },
  subInput: {
    backgroundColor: '#0a0d14',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  availToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 8,
  },
  availToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  availBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
  },
  availBtnInactive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
  },
  availTextActive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10b981',
  },
  availTextInactive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
  },

  // Footer
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    backgroundColor: '#0a101d',
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#006b2c',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
