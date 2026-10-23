import React, { useState, useEffect, useRef } from 'react';
import { Product, PackSizeOption } from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  STANDARD_UNITS,
  SELECTABLE_STANDARD_UNITS,
  getProductPackSizes,
  getQuickAddPresetsForUnit,
  isSamePackSize,
  getPackSizeConversionFactor,
  formatUnitString,
} from '../utils/packSize';
import { X, Check, Upload, Image as ImageIcon, Plus, Minus, Edit3, Sparkles } from 'lucide-react';

interface EditProductModalProps {
  isOpen: boolean;
  product: Product | null;
  onClose: () => void;
  onSaveProduct: (updatedProduct: Product) => void;
  allCategories?: string[];
}

const DEFAULT_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';

const STANDARD_CATEGORY_OPTIONS = [
  { id: 'produce', label: 'Fruits & Vegetables' },
  { id: 'dairy', label: 'Dairy & Eggs' },
  { id: 'bakery', label: 'Bakery' },
  { id: 'beverages', label: 'Beverages' },
  { id: 'snacks', label: 'Snacks' },
  { id: 'grains', label: 'Rice & Grains' },
];

export const EditProductModal: React.FC<EditProductModalProps> = ({
  isOpen,
  product,
  onClose,
  onSaveProduct,
  allCategories = [],
}) => {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [supplier, setSupplier] = useState('');
  const [price, setPrice] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(0);
  const [unit, setUnit] = useState<string>('1 kg');
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  const [customUnit, setCustomUnit] = useState('');
  const [category, setCategory] = useState<string>('produce');
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [image, setImage] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [description, setDescription] = useState('');
  const [packSizes, setPackSizes] = useState<PackSizeOption[]>([]);
  const [error, setError] = useState('');

  // Populate form fields when product changes
  useEffect(() => {
    if (product) {
      setTitle(product.title || '');
      setSupplier(product.supplier || 'Local Farm Direct');
      setPrice(product.price ? product.price.toString() : '0');
      setQuantity(Math.max(0, product.stock || 0));

      const formattedUnit = formatUnitString(product.unit || '');
      const matchedSelectOption = SELECTABLE_STANDARD_UNITS.find(
        (opt) =>
          opt.toLowerCase() === (product.unit || '').trim().toLowerCase() ||
          opt.toLowerCase() === formattedUnit.toLowerCase()
      );

      if (matchedSelectOption) {
        setUnit(matchedSelectOption);
        setIsCustomUnit(false);
        setCustomUnit('');
      } else {
        setUnit('custom');
        setIsCustomUnit(true);
        setCustomUnit(product.unit || '');
      }

      const isStandardCat = STANDARD_CATEGORY_OPTIONS.some((c) => c.id === product.category);
      if (isStandardCat) {
        setCategory(product.category);
        setIsNewCategory(false);
        setNewCategoryName('');
      } else {
        setCategory('__new__');
        setIsNewCategory(true);
        setNewCategoryName(product.categoryLabel || product.category || '');
      }

      setImage(product.image || '');
      setImagePreview(product.image || '');
      setDescription(product.description || '');

      const initialSizes =
        product.packSizes && product.packSizes.length > 0
          ? product.packSizes
          : getProductPackSizes(product);
      setPackSizes(initialSizes);

      setError('');
    }
  }, [product]);

  if (!isOpen || !product) return null;

  // Handle local image file upload and convert to base64 for instant preview & persistence
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WebP, etc.).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image file must be under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setImage(result);
        setImagePreview(result);
      }
    };
    reader.onerror = () => {
      setError('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleQuantityDelta = (delta: number) => {
    setQuantity((prev) => Math.max(0, prev + delta));
  };

  const handleAddPresetPackSize = (preset: string) => {
    const alreadyAdded = packSizes.some((ps) => isSamePackSize(ps.size, preset));
    if (alreadyAdded) return;

    const currentUnit = isCustomUnit ? customUnit.trim() : unit;
    const numericPrice = parseFloat(price) || product.price || 50;
    let newPrice = numericPrice;
    const factor = getPackSizeConversionFactor(preset, currentUnit);
    if (factor && factor > 0) {
      newPrice = Math.max(1, Math.round(numericPrice * factor));
    }

    setPackSizes((prev) => [
      ...prev,
      { size: preset, price: newPrice, isAvailable: true },
    ]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      setError('Please enter a valid price in Indian Rupees (₹) greater than 0.');
      return;
    }

    if (isNaN(quantity) || quantity < 0) {
      setError('Product quantity cannot be negative.');
      return;
    }

    const selectedUnit = isCustomUnit ? customUnit.trim() : unit;
    if (!selectedUnit) {
      setError('Please specify a valid product unit or pack size.');
      return;
    }

    let finalCategory = category;
    let finalCategoryLabel = '';

    if (isNewCategory) {
      const trimmedNewCat = newCategoryName.trim();
      if (!trimmedNewCat) {
        setError('Please enter a new category name.');
        return;
      }
      finalCategory = trimmedNewCat.toLowerCase().replace(/\s+/g, '-');
      finalCategoryLabel = trimmedNewCat;
    } else {
      const standardMatch = STANDARD_CATEGORY_OPTIONS.find((c) => c.id === category);
      if (standardMatch) {
        finalCategoryLabel = standardMatch.label;
      } else {
        finalCategoryLabel = category;
      }
    }

    const finalImage = (image || imagePreview || product.image || DEFAULT_FALLBACK_IMAGE).trim();

    const validPackSizes = packSizes
      .filter((ps) => ps.size && ps.size.trim() && !isNaN(Number(ps.price)) && Number(ps.price) > 0)
      .map((ps) => ({
        size: ps.size.trim(),
        price: Math.max(1, Math.round(Number(ps.price) || 0)),
        isAvailable: ps.isAvailable !== false && (ps as any).available !== false,
        stock:
          ps.stock !== undefined && ps.stock !== null && String(ps.stock).trim() !== '' && !isNaN(Number(ps.stock))
            ? Math.max(0, Math.floor(Number(ps.stock)))
            : undefined,
      }));

    const updatedProduct: Product = {
      ...product,
      title: trimmedTitle,
      supplier: trimmedSupplier,
      price: numericPrice,
      stock: quantity,
      unit: selectedUnit,
      category: finalCategory,
      categoryLabel: finalCategoryLabel,
      image: finalImage,
      description: description.trim() || product.description || '',
      packSizes: validPackSizes.length > 0 ? validPackSizes : undefined,
    };

    onSaveProduct(updatedProduct);
    onClose();
  };

  // Combine standard and any custom categories present in catalog
  const dynamicCategories = Array.from(
    new Set([
      ...STANDARD_CATEGORY_OPTIONS.map((c) => c.id),
      ...allCategories.filter((c) => c && c !== '__new__'),
    ])
  );

  const activeUnit = isCustomUnit ? customUnit : unit;
  const quickAddPresets = getQuickAddPresetsForUnit(activeUnit);

  return (
    <div
      id="edit-product-modal-backdrop"
      className="edit-product-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
    >
      <div
        id="edit-product-modal"
        className="edit-product-modal bg-[#060b13]/90 backdrop-blur-2xl rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-white/10 flex flex-col max-h-[92vh] text-white"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#006b2c] text-white flex items-center justify-center shadow-xs">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h2 id="edit-product-modal-title" className="text-[17px] font-bold text-white font-display">
                {t('editProductTitle')}
              </h2>
              <p className="text-[11px] text-slate-400">
                {t('editProductSubtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-edit-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div
              id="edit-product-error-alert"
              className="p-2.5 rounded-lg bg-red-950/80 text-red-200 text-[12px] font-semibold border border-red-800/80"
            >
              {error}
            </div>
          )}

          {/* 1. Item / Product Name */}
          <div className="space-y-1">
            <label htmlFor="edit-product-name" className="text-[12px] font-semibold text-slate-200">
              {t('productNameLabel')}
            </label>
            <input
              id="edit-product-name"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Basmati Rice"
              className="w-full px-3 py-2 text-[13px] border border-white/15 rounded-lg bg-black/60 text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#006b2c]"
            />
          </div>

          {/* 2. Supplier */}
          <div className="space-y-1">
            <label htmlFor="edit-product-supplier" className="text-[12px] font-semibold text-slate-200">
              {t('supplierLabel')}
            </label>
            <input
              id="edit-product-supplier"
              type="text"
              required
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder={t('supplierPlaceholder')}
              className="w-full px-3 py-2 text-[13px] border border-white/15 rounded-lg bg-black/60 text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#006b2c]"
            />
          </div>

          {/* 3. Category (Existing or New) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="edit-product-category" className="text-[12px] font-semibold text-slate-200">
                {t('categoryLabel')}
              </label>
              <button
                type="button"
                id="toggle-new-category-btn"
                onClick={() => {
                  setIsNewCategory(!isNewCategory);
                  if (!isNewCategory) {
                    setCategory('__new__');
                  } else {
                    setCategory('produce');
                  }
                }}
                className="text-[11px] font-semibold text-emerald-400 hover:underline cursor-pointer"
              >
                {isNewCategory ? '← Select Existing Category' : t('enterNewCategory')}
              </button>
            </div>

            {!isNewCategory ? (
              <select
                id="edit-product-category"
                value={category}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    setIsNewCategory(true);
                  } else {
                    setCategory(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 text-[13px] border border-white/15 rounded-lg bg-black/60 text-white focus:outline-hidden focus:ring-2 focus:ring-[#006b2c] cursor-pointer"
              >
                {dynamicCategories.map((catId) => {
                  const std = STANDARD_CATEGORY_OPTIONS.find((s) => s.id === catId);
                  const label = std
                    ? catId === 'produce'
                      ? t('catProduce')
                      : catId === 'dairy'
                      ? t('catDairy')
                      : catId === 'bakery'
                      ? t('catBakery')
                      : catId === 'beverages'
                      ? t('catBeverages')
                      : catId === 'snacks'
                      ? t('catSnacks')
                      : t('catGrains')
                    : catId;
                  return (
                    <option key={catId} value={catId} className="bg-[#0b121e] text-white">
                      {label}
                    </option>
                  );
                })}
                <option value="__new__" className="bg-[#0b121e] text-white">{t('enterNewCategory')}</option>
              </select>
            ) : (
              <input
                id="edit-product-new-category-input"
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={t('newCategoryPlaceholder')}
                className="w-full px-3 py-2 text-[13px] border border-emerald-500 rounded-lg bg-black/60 text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#006b2c]"
                autoFocus
              />
            )}
          </div>

          {/* 4. Product Image Upload & Preview */}
          <div className="space-y-2 border border-white/10 rounded-xl p-3.5 bg-black/50 backdrop-blur-xs">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-semibold text-slate-200 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('imagePreview')}</span>
              </label>
              <span className="text-[11px] text-slate-400">
                {t('imageUploadHint')}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Image Preview Thumbnail */}
              <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/15 bg-black/70 shadow-inner shrink-0 flex items-center justify-center">
                <img
                  id="edit-product-image-preview"
                  src={imagePreview || image || DEFAULT_FALLBACK_IMAGE}
                  alt="Product preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = DEFAULT_FALLBACK_IMAGE;
                  }}
                />
              </div>

              {/* Upload Button and URL Fallback */}
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    id="edit-product-file-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    id="trigger-image-upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-[12px] font-semibold border border-emerald-500/30 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{t('uploadNewImage')}</span>
                  </button>
                  <span className="text-[11px] text-slate-400">PNG, JPG, WebP</span>
                </div>

                <input
                  id="edit-product-image-url"
                  type="url"
                  value={image.startsWith('data:') ? '' : image}
                  onChange={(e) => {
                    setImage(e.target.value);
                    setImagePreview(e.target.value);
                  }}
                  placeholder="Or paste remote image URL (https://...)"
                  className="w-full px-2.5 py-1 text-[11px] border border-white/15 rounded-lg bg-black/60 text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#006b2c]"
                />
              </div>
            </div>
          </div>

          {/* 5. Quantity & 7. Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 5. Quantity (Increase, Decrease, Direct Edit) */}
            <div className="space-y-1">
              <label htmlFor="edit-product-stock-qty" className="text-[12px] font-semibold text-slate-200">
                {t('stockQuantityLabel')}
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  id="edit-qty-decrement-btn"
                  title="Decrease quantity by 1"
                  disabled={quantity <= 0}
                  onClick={() => handleQuantityDelta(-1)}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/15 text-white flex items-center justify-center font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  id="edit-product-stock-qty"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setQuantity(isNaN(val) ? 0 : Math.max(0, val));
                  }}
                  className="flex-1 px-2 py-1.5 text-[13px] font-bold text-center tabular-nums border border-white/15 rounded-lg bg-black/60 text-white focus:outline-hidden focus:ring-2 focus:ring-[#006b2c]"
                />
                <button
                  type="button"
                  id="edit-qty-increment-btn"
                  title="Increase quantity by 1"
                  onClick={() => handleQuantityDelta(1)}
                  className="w-8 h-8 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/35 text-emerald-300 border border-emerald-500/30 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 7. Price in Indian Rupees (₹) */}
            <div className="space-y-1">
              <label htmlFor="edit-product-price" className="text-[12px] font-semibold text-slate-200">
                {t('priceLabel')}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-[14px] font-bold text-slate-400">
                  ₹
                </span>
                <input
                  id="edit-product-price"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 120"
                  className="w-full pl-7 pr-3 py-1.5 text-[13px] font-bold tabular-nums border border-white/15 rounded-lg bg-black/60 text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#006b2c]"
                />
              </div>
            </div>
          </div>

          {/* 6. Unit / Pack Size */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="edit-product-unit" className="text-[12px] font-semibold text-slate-200">
                {t('unitPackSizeLabel')}
              </label>
              <button
                type="button"
                id="toggle-custom-unit-btn"
                onClick={() => {
                  const nextState = !isCustomUnit;
                  setIsCustomUnit(nextState);
                  if (nextState) {
                    if (!customUnit && unit && unit !== 'custom') {
                      setCustomUnit(unit);
                    }
                  } else {
                    if (!unit || unit === 'custom') {
                      setUnit('1 kg');
                    }
                  }
                }}
                className="text-[11px] font-semibold text-emerald-400 hover:underline cursor-pointer"
              >
                {isCustomUnit ? t('switchToStandardUnits') : t('enterCustomUnitBtn')}
              </button>
            </div>

            {!isCustomUnit ? (
              <select
                id="edit-product-unit"
                value={unit}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setIsCustomUnit(true);
                  } else {
                    setUnit(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 text-[13px] border border-white/15 rounded-lg bg-black/60 text-white focus:outline-hidden focus:ring-2 focus:ring-[#006b2c] cursor-pointer font-semibold"
              >
                <optgroup label="Weight" className="bg-[#0b121e] text-white">
                  <option value="100 g" className="bg-[#0b121e] text-white">100 g</option>
                  <option value="250 g" className="bg-[#0b121e] text-white">250 g</option>
                  <option value="500 g" className="bg-[#0b121e] text-white">500 g</option>
                  <option value="1 kg" className="bg-[#0b121e] text-white">1 kg</option>
                  <option value="2 kg" className="bg-[#0b121e] text-white">2 kg</option>
                  <option value="5 kg" className="bg-[#0b121e] text-white">5 kg</option>
                </optgroup>
                <optgroup label="Volume" className="bg-[#0b121e] text-white">
                  <option value="100 ml" className="bg-[#0b121e] text-white">100 ml</option>
                  <option value="250 ml" className="bg-[#0b121e] text-white">250 ml</option>
                  <option value="500 ml" className="bg-[#0b121e] text-white">500 ml</option>
                  <option value="1 litre" className="bg-[#0b121e] text-white">1 litre</option>
                  <option value="2 litres" className="bg-[#0b121e] text-white">2 litres</option>
                  <option value="5 litres" className="bg-[#0b121e] text-white">5 litres</option>
                </optgroup>
                <optgroup label="Pieces" className="bg-[#0b121e] text-white">
                  <option value="1 piece" className="bg-[#0b121e] text-white">1 piece</option>
                  <option value="2 pieces" className="bg-[#0b121e] text-white">2 pieces</option>
                  <option value="4 pieces" className="bg-[#0b121e] text-white">4 pieces</option>
                  <option value="1 packet" className="bg-[#0b121e] text-white">1 packet</option>
                  <option value="1 box" className="bg-[#0b121e] text-white">1 box</option>
                  <option value="1 bunch" className="bg-[#0b121e] text-white">1 bunch</option>
                </optgroup>
                <optgroup label="Dozen" className="bg-[#0b121e] text-white">
                  <option value="1/2 dozen" className="bg-[#0b121e] text-white">1/2 dozen</option>
                  <option value="1 dozen" className="bg-[#0b121e] text-white">1 dozen</option>
                  <option value="2 dozen" className="bg-[#0b121e] text-white">2 dozen</option>
                </optgroup>
                <option value="custom" className="bg-[#0b121e] text-white">{t('enterCustomUnitBtn')}</option>
              </select>
            ) : (
              <input
                id="edit-product-custom-unit"
                type="text"
                required
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value)}
                placeholder="e.g. 1 kg, 500 g, 250 g, 100 g, 1 litre, 500 ml, 1 piece, packet, box"
                className="w-full px-3 py-2 text-[13px] border border-emerald-500 rounded-lg bg-black/60 text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#006b2c]"
                autoFocus
              />
            )}
          </div>

          {/* Pack Sizes, Prices, Stock & Availability Configuration */}
          <div className="space-y-3 border border-white/10 rounded-xl p-3.5 bg-black/50 backdrop-blur-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-[13px] font-bold text-white block">
                  Pack Sizes, Prices, Stock & Availability
                </label>
                <span className="text-[11px] text-slate-400 block">
                  Configure independent prices, stock, and availability status for each pack size.
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  id="add-pack-size-row-btn"
                  onClick={() => {
                    const currentUnit = isCustomUnit ? customUnit.trim() : unit;
                    const numericPrice = parseFloat(price) || product.price || 50;
                    setPackSizes([
                      ...packSizes,
                      { size: currentUnit || '1 unit', price: numericPrice, isAvailable: true },
                    ]);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#006b2c] text-white hover:bg-[#00873a] text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Pack Size</span>
                </button>
              </div>
            </div>

            {/* Quick Add Presets Bar */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-white/10">
              <span className="text-[11px] font-semibold text-slate-400">Quick add:</span>
              {quickAddPresets.length > 0 ? (
                quickAddPresets.map((preset) => {
                  const alreadyAdded = packSizes.some((ps) =>
                    isSamePackSize(ps.size, preset)
                  );
                  return (
                    <button
                      key={preset}
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => handleAddPresetPackSize(preset)}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer border ${
                        alreadyAdded
                          ? 'bg-white/5 text-slate-500 border-white/10 cursor-not-allowed opacity-50'
                          : 'bg-white/5 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:border-emerald-400'
                      }`}
                    >
                      + {preset}
                    </button>
                  );
                })
              ) : (
                <span className="text-[11px] text-slate-400 italic">
                  Enter a custom unit to see quick add options, or use &quot;Add Pack Size&quot; above.
                </span>
              )}
            </div>

            {/* Pack Size Rows */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {packSizes.map((ps, idx) => {
                const isAvail = ps.isAvailable !== false && (ps as any).available !== false;
                return (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl border border-white/10 bg-black/60 flex flex-col sm:flex-row sm:items-center gap-2 shadow-xs"
                  >
                    {/* Size Input */}
                    <div className="flex-1 min-w-[110px]">
                      <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                        Pack Size
                      </label>
                      <input
                        type="text"
                        value={ps.size}
                        onChange={(e) => {
                          const next = [...packSizes];
                          next[idx] = { ...next[idx], size: e.target.value };
                          setPackSizes(next);
                        }}
                        placeholder="e.g. 500 g, 1 litre"
                        className="w-full px-2.5 py-1 text-[12px] font-semibold border border-white/15 rounded-lg bg-black/70 text-white focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Price Input */}
                    <div className="w-24">
                      <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                        Price (₹)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2 top-1 text-[12px] font-bold text-slate-400">
                          ₹
                        </span>
                        <input
                          type="number"
                          min="1"
                          value={ps.price}
                          onChange={(e) => {
                            const next = [...packSizes];
                            next[idx] = { ...next[idx], price: Number(e.target.value) || 0 };
                            setPackSizes(next);
                          }}
                          className="w-full pl-5 pr-2 py-1 text-[12px] font-bold tabular-nums border border-white/15 rounded-lg bg-black/70 text-white focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Stock Input */}
                    <div className="w-24">
                      <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                        Stock
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={ps.stock !== undefined ? ps.stock : ''}
                        placeholder="Mapped"
                        title="Pack-size specific stock (or leave blank for mapped product inventory)"
                        onChange={(e) => {
                          const next = [...packSizes];
                          const val =
                            e.target.value.trim() === ''
                              ? undefined
                              : Math.max(0, parseInt(e.target.value, 10) || 0);
                          next[idx] = { ...next[idx], stock: val };
                          setPackSizes(next);
                        }}
                        className="w-full px-2 py-1 text-[12px] font-bold tabular-nums border border-white/15 rounded-lg bg-black/70 text-white placeholder-slate-500 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Availability Toggle & Remove */}
                    <div className="pt-2 sm:pt-3.5 flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        id={`toggle-availability-${idx}`}
                        title={isAvail ? 'Mark as Unavailable' : 'Mark as Available'}
                        onClick={() => {
                          const next = [...packSizes];
                          next[idx] = { ...next[idx], isAvailable: !isAvail };
                          setPackSizes(next);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors border ${
                          isAvail
                            ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/70'
                            : 'bg-red-950/70 text-red-300 border-red-500/40 hover:bg-red-900/70'
                        }`}
                      >
                        {isAvail ? (
                          <>
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>Available</span>
                          </>
                        ) : (
                          <>
                            <X className="w-3 h-3 stroke-[3]" />
                            <span>Unavailable</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={packSizes.length <= 1}
                        onClick={() => {
                          setPackSizes(packSizes.filter((_, i) => i !== idx));
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/10 disabled:opacity-30 cursor-pointer transition-colors"
                        title="Remove this pack size"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label htmlFor="edit-product-description" className="text-[12px] font-semibold text-slate-200">
              {t('productDescriptionLabel')}
            </label>
            <textarea
              id="edit-product-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('productDescriptionPlaceholder')}
              className="w-full px-3 py-1.5 text-[12px] border border-white/15 rounded-lg bg-black/60 text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#006b2c]"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-end gap-2">
            <button
              type="button"
              id="cancel-edit-btn"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-[13px] font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              id="save-edit-product-btn"
              className="px-5 py-2 rounded-lg bg-[#006b2c] hover:bg-[#00873a] text-white text-[13px] font-semibold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{t('saveChanges')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
