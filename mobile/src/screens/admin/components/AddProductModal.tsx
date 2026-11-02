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
  Plus,
  X,
  Upload,
  Check,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react-native';
import { Product, PackSizeOption } from '../../../types';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProduct: (productPayload: Partial<Product>) => Promise<void>;
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

export const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  onAddProduct,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('produce');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [supplier, setSupplier] = useState('Local Farm Direct');
  const [image, setImage] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [imageFileName, setImageFileName] = useState('');
  const [imageFileSize, setImageFileSize] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [packSizes, setPackSizes] = useState<PackSizeOption[]>([
    { size: '', price: 0, stock: undefined, isAvailable: true },
  ]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setCategory('produce');
      setUnit('');
      setPrice('');
      setStock('');
      setSupplier('Local Farm Direct');
      setImage('');
      setImagePreview('');
      setImageFileName('');
      setImageFileSize('');
      setError('');
      setPackSizes([{ size: '', price: 0, stock: undefined, isAvailable: true }]);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Handle top-level Unit change (synchronizes packSizes[0])
  const handleUnitChange = (newUnit: string) => {
    setUnit(newUnit);
    setPackSizes((prev) => {
      const next = [...prev];
      const numericPrice = parseFloat(price) || 0;
      const numericQty = stock !== '' ? parseInt(stock, 10) || 0 : undefined;
      if (next.length > 0) {
        next[0] = { ...next[0], size: newUnit, price: numericPrice, stock: numericQty };
      } else {
        next.push({ size: newUnit, price: numericPrice, stock: numericQty, isAvailable: true });
      }
      return next;
    });
  };

  // Handle top-level Price change (synchronizes packSizes[0].price)
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

  // Handle top-level Stock Quantity change (synchronizes packSizes[0].stock)
  const handleStockChange = (newStock: string) => {
    setStock(newStock);
    const num = newStock !== '' ? Math.max(0, parseInt(newStock, 10) || 0) : undefined;
    setPackSizes((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      next[0] = { ...next[0], stock: num };
      return next;
    });
  };

  // Add a new pack size row
  const handleAddPackSizeRow = () => {
    const basePrice = parseFloat(price) || 50;
    const baseStock = stock !== '' ? Math.max(0, parseInt(stock, 10) || 0) : undefined;
    setPackSizes((prev) => [
      ...prev,
      {
        size: '',
        price: basePrice,
        stock: baseStock,
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
      if (field === 'stock') setStock(value !== undefined ? String(value) : '');
    }
  };

  // Remove pack size row
  const handleRemovePackSize = (index: number) => {
    if (index === 0) return; // Default pack size cannot be removed
    setPackSizes((prev) => prev.filter((_, i) => i !== index));
  };

  // Image picking via expo-image-picker
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
        setImageFileName(asset.fileName || 'Product Image');
        if (asset.fileSize) {
          const kb = Math.round(asset.fileSize / 1024);
          setImageFileSize(kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);
        } else {
          setImageFileSize('Ready');
        }
        setIsUploadingImage(false);
      }
    } catch {
      setIsUploadingImage(false);
      Alert.alert('Notice', 'Unable to open image picker. You can also paste an image URL directly.');
    }
  };

  const handleRemoveImage = () => {
    setImage('');
    setImagePreview('');
    setImageFileName('');
    setImageFileSize('');
  };

  // Submit product creation
  const handleSubmit = async () => {
    setError('');

    if (!title.trim()) {
      setError('Please enter a product name.');
      return;
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      setError('Please enter a valid price greater than ₹0.');
      return;
    }

    const numStock = parseInt(stock, 10);
    if (isNaN(numStock) || numStock < 0) {
      setError('Stock quantity cannot be negative.');
      return;
    }

    if (!unit.trim()) {
      setError('Please specify a product unit / pack size.');
      return;
    }

    if (!category.trim()) {
      setError('Please select or enter a category.');
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

    // Check for duplicate pack sizes
    const names = packSizes.map((ps) => ps.size.trim().toLowerCase());
    const duplicate = names.find((name, idx) => names.indexOf(name) !== idx);
    if (duplicate) {
      setError(`Duplicate pack size "${duplicate}" found. Each pack size must be unique.`);
      return;
    }

    const finalImage = (image || imagePreview || DEFAULT_FALLBACK_IMAGE).trim();

    const finalPackSizes = packSizes.map((ps, idx) => ({
      size: ps.size.trim(),
      price: Math.max(1, Math.round(Number(ps.price) || numPrice)),
      isAvailable: ps.isAvailable !== false,
      stock:
        idx === 0
          ? numStock
          : ps.stock !== undefined && String(ps.stock).trim() !== '' && !isNaN(Number(ps.stock))
          ? Math.max(0, Math.floor(Number(ps.stock)))
          : undefined,
    }));

    const productPayload: Partial<Product> = {
      title: title.trim(),
      category: category.trim().toLowerCase(),
      categoryLabel: category.trim(),
      unit: unit.trim(),
      price: numPrice,
      stock: numStock,
      supplier: supplier.trim() || 'Local Farm Direct',
      image: finalImage,
      badge: 'Fresh Harvest',
      description: '',
      isOrganic: true,
      packSizes: finalPackSizes,
    };

    setIsSubmitting(true);
    try {
      await onAddProduct(productPayload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add product. Please try again.');
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
                <Plus size={18} color="#ffffff" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Add Product</Text>
                <Text style={styles.modalSubtitle}>
                  Enter product details to add a new item to live inventory.
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

          {/* Form Scroll Area */}
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

            {/* 2. Category */}
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

            {/* 3. Unit / Pack Size */}
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

            {/* 4. Price & Stock Quantity (2 Columns) */}
            <View style={styles.twoColRow}>
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

              <View style={styles.colHalf}>
                <Text style={styles.inputLabel}>Stock Quantity *</Text>
                <TextInput
                  style={styles.textInput}
                  value={stock}
                  onChangeText={handleStockChange}
                  placeholder="47"
                  placeholderTextColor="#64748b"
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* 5. Pack Sizes, Prices, Stock & Availability Section */}
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
                            placeholder={isDefault && stock ? stock : 'Mapped'}
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

            {/* 6. Product Image Section */}
            <View style={styles.imageSectionCard}>
              <View style={styles.imageSectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <ImageIcon size={15} color="#10b981" />
                  <Text style={styles.imageSectionTitle}>Product Image</Text>
                </View>
                <Text style={styles.imageSectionSubtitle}>
                  JPG, JPEG, PNG, WebP (Max 5MB)
                </Text>
              </View>

              {imagePreview ? (
                <View style={styles.imagePreviewBox}>
                  <Image source={{ uri: imagePreview }} style={styles.imageThumbnail} />
                  <View style={{ flex: 1, paddingLeft: 12 }}>
                    <Text style={styles.imageFileNameText} numberOfLines={1}>
                      {imageFileName || 'Selected product image'}
                    </Text>
                    <Text style={styles.imageFileStatus}>
                      {imageFileSize ? `${imageFileSize} • ` : ''}Ready to save
                    </Text>
                    <View style={styles.imagePreviewActions}>
                      <TouchableOpacity style={styles.changeImgBtn} onPress={pickImage}>
                        <Upload size={12} color="#10b981" />
                        <Text style={styles.changeImgText}>Change Image</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.removeImgBtn}
                        onPress={handleRemoveImage}
                      >
                        <X size={12} color="#ef4444" />
                        <Text style={styles.removeImgText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.emptyImageBox}>
                  <View style={styles.emptyImgIconWrap}>
                    <ImageIcon size={24} color="#64748b" />
                  </View>
                  <View style={{ flex: 1, paddingHorizontal: 10 }}>
                    <Text style={styles.emptyImgTitle}>No image selected</Text>
                    <Text style={styles.emptyImgDesc}>
                      Upload a photo of your product or paste a URL below
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.uploadImgBtn}
                    onPress={pickImage}
                    disabled={isUploadingImage}
                  >
                    <Upload size={13} color="#10b981" />
                    <Text style={styles.uploadImgText}>
                      {isUploadingImage ? 'Reading...' : 'Upload Image'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Optional URL input */}
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
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Plus size={16} color="#ffffff" />
                  <Text style={styles.submitBtnText}>Add Product to Live Store</Text>
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
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  colHalf: {
    flex: 1,
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

  // Image section
  imageSectionCard: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  imageSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  imageSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  imageSectionSubtitle: {
    fontSize: 10,
    color: '#94a3b8',
  },
  imagePreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0d14',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  imageThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  imageFileNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  imageFileStatus: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  imagePreviewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  changeImgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  changeImgText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981',
  },
  removeImgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  removeImgText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ef4444',
  },
  emptyImageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#334155',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  emptyImgIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#0a0d14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyImgTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  emptyImgDesc: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  uploadImgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
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
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#006b2c',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
