import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import {
  X,
  Image as ImageIcon,
  Check,
  AlertCircle,
  Sparkles,
  IndianRupee,
  Package,
  Layers,
} from 'lucide-react';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Product) => void;
  productToEdit?: Product | null;
}

// Curated high quality image presets for quick selection
const IMAGE_PRESETS: { label: string; category: Product['category']; url: string }[] = [
  {
    label: 'Red Tomatoes',
    category: 'produce',
    url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80',
  },
  {
    label: 'Bananas',
    category: 'produce',
    url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80',
  },
  {
    label: 'Honeycrisp Apples',
    category: 'produce',
    url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80',
  },
  {
    label: 'Hass Avocados',
    category: 'produce',
    url: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=600&q=80',
  },
  {
    label: 'Fresh Strawberries',
    category: 'produce',
    url: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=600&q=80',
  },
  {
    label: 'Organic Baby Spinach',
    category: 'produce',
    url: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80',
  },
  {
    label: 'Whole Milk',
    category: 'dairy',
    url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80',
  },
  {
    label: 'Free-Range Eggs',
    category: 'dairy',
    url: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=600&q=80',
  },
  {
    label: 'Greek Yogurt',
    category: 'dairy',
    url: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80',
  },
  {
    label: 'Sourdough Loaf',
    category: 'bakery',
    url: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&w=600&q=80',
  },
  {
    label: 'Butter Croissants',
    category: 'bakery',
    url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80',
  },
  {
    label: 'Cold Brew Coffee',
    category: 'beverages',
    url: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=600&q=80',
  },
  {
    label: 'Fresh Orange Juice',
    category: 'beverages',
    url: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80',
  },
  {
    label: 'Roasted Almonds',
    category: 'snacks',
    url: 'https://images.unsplash.com/photo-1508061253366-f7da158b6d46?auto=format&fit=crop&w=600&q=80',
  },
  {
    label: 'Artisan Granola',
    category: 'snacks',
    url: 'https://images.unsplash.com/photo-1517093157656-b9ec81c969b8?auto=format&fit=crop&w=600&q=80',
  },
  {
    label: 'Organic Jasmine Rice',
    category: 'grains',
    url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
  },
  {
    label: 'Rolled Oats',
    category: 'grains',
    url: 'https://images.unsplash.com/photo-1614961909013-1e2212a2ca8b?auto=format&fit=crop&w=600&q=80',
  },
];

const CATEGORY_MAP: Record<Product['category'], string> = {
  produce: 'Fruits & Veggies',
  dairy: 'Dairy & Eggs',
  bakery: 'Bakery & Bread',
  beverages: 'Beverages',
  snacks: 'Snacks & Pantry',
  grains: 'Rice & Grains',
};

const COMMON_UNITS = [
  'kg',
  'g',
  'litre',
  'ml',
  'piece',
  'packet',
  'bunch',
  'box',
  'btl',
  'carton',
  'loaf',
  'bag',
  'tub',
  'lb',
  'oz',
  'item',
];

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  productToEdit,
}) => {
  const isEditing = Boolean(productToEdit);

  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Product['category']>('produce');
  const [price, setPrice] = useState<string>('');
  const [stock, setStock] = useState<string>('');
  const [minStockLevel, setMinStockLevel] = useState<string>('5');
  const [unit, setUnit] = useState('kg');
  const [customUnit, setCustomUnit] = useState('');
  const [image, setImage] = useState('');
  const [description, setDescription] = useState('');
  const [supplier, setSupplier] = useState('');
  const [sku, setSku] = useState('');
  const [badge, setBadge] = useState('Fresh Harvest');
  const [isOrganic, setIsOrganic] = useState(true);
  const [isQuickPrep, setIsQuickPrep] = useState(false);
  const [farmOrigin, setFarmOrigin] = useState('');
  const [tempRequirement, setTempRequirement] = useState('Chilled 2-4°C');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPresets, setShowPresets] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Reset or pre-fill form when modal opens or productToEdit changes
  useEffect(() => {
    if (productToEdit) {
      setTitle(productToEdit.title);
      setCategory(productToEdit.category);
      setPrice(productToEdit.price.toString());
      setStock(productToEdit.stock.toString());
      setMinStockLevel(
        productToEdit.minStockLevel !== undefined
          ? productToEdit.minStockLevel.toString()
          : '5'
      );
      if (COMMON_UNITS.includes(productToEdit.unit)) {
        setUnit(productToEdit.unit);
        setCustomUnit('');
      } else {
        setUnit('custom');
        setCustomUnit(productToEdit.unit);
      }
      setImage(productToEdit.image);
      setDescription(productToEdit.description || '');
      setSupplier(productToEdit.supplier || '');
      setSku(productToEdit.sku || '');
      setBadge(productToEdit.badge || 'Fresh Harvest');
      setIsOrganic(productToEdit.isOrganic ?? true);
      setIsQuickPrep(productToEdit.isQuickPrep ?? false);
      setFarmOrigin(productToEdit.farmOrigin || '');
      setTempRequirement(productToEdit.tempRequirement || 'Chilled 2-4°C');
    } else {
      // New product defaults
      setTitle('');
      setCategory('produce');
      setPrice('');
      setStock('25');
      setMinStockLevel('5');
      setUnit('kg');
      setCustomUnit('');
      setImage(IMAGE_PRESETS[0].url);
      setDescription('');
      setSupplier('Verde Valley Organic Co-Op');
      setSku(`SKU-${Math.floor(1000 + Math.random() * 9000)}`);
      setBadge('Fresh Harvest');
      setIsOrganic(true);
      setIsQuickPrep(false);
      setFarmOrigin('Local Certified Harvest Pod #104');
      setTempRequirement('Chilled 2-4°C');
    }
    setErrors({});
    setImageError(false);
    setShowPresets(false);
  }, [productToEdit, isOpen]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!title.trim()) {
      errs.title = 'Product name is required';
    } else if (title.trim().length < 2) {
      errs.title = 'Product name must be at least 2 characters';
    }

    const parsedPrice = parseFloat(price);
    if (!price || isNaN(parsedPrice) || parsedPrice <= 0) {
      errs.price = 'Enter a valid price greater than ₹0';
    }

    const parsedStock = parseInt(stock, 10);
    if (stock === '' || isNaN(parsedStock) || parsedStock < 0) {
      errs.stock = 'Stock must be 0 or a positive number';
    }

    const parsedMinStock = parseInt(minStockLevel, 10);
    if (minStockLevel === '' || isNaN(parsedMinStock) || parsedMinStock < 0) {
      errs.minStockLevel = 'Minimum stock must be 0 or a positive number';
    }

    const finalUnit = unit === 'custom' ? customUnit.trim() : unit;
    if (!finalUnit) {
      errs.unit = 'Unit measurement is required';
    }

    if (!image.trim()) {
      errs.image = 'Product image URL is required';
    }

    if (!description.trim()) {
      errs.description = 'Product description is required';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const parsedPrice = parseFloat(parseFloat(price).toFixed(2));
    const parsedStock = parseInt(stock, 10);
    const parsedMinStock = parseInt(minStockLevel, 10) || 5;
    const finalUnit = unit === 'custom' ? customUnit.trim() : unit;
    const finalSku = sku.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
    const finalSupplier = supplier.trim() || 'FreshCart Local Farms';

    const productPayload: Product = {
      id: productToEdit ? productToEdit.id : `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: title.trim(),
      category,
      categoryLabel: CATEGORY_MAP[category],
      price: parsedPrice,
      stock: parsedStock,
      minStockLevel: parsedMinStock,
      unit: finalUnit,
      image: image.trim(),
      description: description.trim(),
      supplier: finalSupplier,
      sku: finalSku,
      badge: badge.trim() || (isOrganic ? 'Organic' : 'Fresh'),
      isOrganic,
      isQuickPrep,
      farmOrigin: farmOrigin.trim() || 'Store #104 Direct Partner',
      tempRequirement: tempRequirement.trim() || 'Ambient / Chilled',
      harvestDate: productToEdit?.harvestDate || 'Harvested Today',
      batchNumber: productToEdit?.batchNumber || `LOT-2026-${finalSku.replace('SKU-', '')}`,
      expiryDate: productToEdit?.expiryDate || 'In 7 days',
    };

    onSave(productPayload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1c30]/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-[#cbd5e1] flex flex-col my-8 max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-[#1e293b] text-white px-6 py-4 flex items-center justify-between border-b border-[#334155] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#006b2c] flex items-center justify-center text-white shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold tracking-tight font-display">
                {isEditing ? 'Edit Inventory Product' : 'Add New Product to Inventory'}
              </h2>
              <p className="text-[12px] text-[#94a3b8]">
                {isEditing
                  ? 'Update pricing, live stock, specifications, and media'
                  : 'Add item to Store #104 catalog and synchronize with customer storefront'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#334155] hover:bg-[#475569] text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Product Name */}
          <div>
            <label className="block text-[12px] font-bold text-[#0f172a] uppercase tracking-wider mb-1.5">
              Product Name <span className="text-[#ef4444]">*</span>
            </label>
            <input
              type="text"
              id="product-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Organic Honeycrisp Apples, Grade-A Whole Milk"
              className={`w-full px-3.5 py-2.5 text-[13px] rounded-xl border transition-all ${
                errors.title
                  ? 'border-[#ef4444] bg-[#fef2f2] focus:ring-2 focus:ring-[#ef4444]/20'
                  : 'border-[#cbd5e1] bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-[#006b2c]/30 focus:border-[#006b2c]'
              }`}
            />
            {errors.title && (
              <p className="text-[11px] text-[#ef4444] mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.title}
              </p>
            )}
          </div>

          {/* Category & Unit Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-bold text-[#0f172a] uppercase tracking-wider mb-1.5">
                Category Aisle <span className="text-[#ef4444]">*</span>
              </label>
              <div className="relative">
                <select
                  id="product-category-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Product['category'])}
                  className="w-full px-3.5 py-2.5 text-[13px] rounded-xl border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-[#006b2c]/30 focus:border-[#006b2c] cursor-pointer"
                >
                  <option value="produce">Produce &amp; Fruit (Fruits &amp; Veg)</option>
                  <option value="dairy">Dairy &amp; Eggs</option>
                  <option value="bakery">Bakery &amp; Bread</option>
                  <option value="beverages">Beverages &amp; Juices</option>
                  <option value="snacks">Snacks &amp; Pantry</option>
                  <option value="grains">Rice &amp; Grains</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-bold text-[#0f172a] uppercase tracking-wider mb-1.5">
                Unit of Measure <span className="text-[#ef4444]">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  id="product-unit-select"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="flex-1 px-3 py-2.5 text-[13px] rounded-xl border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-[#006b2c]/30 focus:border-[#006b2c] cursor-pointer"
                >
                  {COMMON_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                  <option value="custom">Other (Custom)...</option>
                </select>
                {unit === 'custom' && (
                  <input
                    type="text"
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value)}
                    placeholder="e.g. bunch"
                    className="w-28 px-3 py-2.5 text-[13px] rounded-xl border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-[#006b2c]/30"
                  />
                )}
              </div>
              {errors.unit && (
                <p className="text-[11px] text-[#ef4444] mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.unit}
                </p>
              )}
            </div>
          </div>

          {/* Price, Stock & Minimum Stock Level Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[12px] font-bold text-[#0f172a] uppercase tracking-wider mb-1.5">
                Price (INR ₹) <span className="text-[#ef4444]">*</span>
              </label>
              <div className="relative">
                <IndianRupee className="w-4 h-4 text-[#64748b] absolute left-3.5 top-3" />
                <input
                  type="number"
                  step="1"
                  min="1"
                  id="product-price-input"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="199"
                  className={`w-full pl-9 pr-3.5 py-2.5 text-[13px] rounded-xl border tabular-nums transition-all ${
                    errors.price
                      ? 'border-[#ef4444] bg-[#fef2f2] focus:ring-2 focus:ring-[#ef4444]/20'
                      : 'border-[#cbd5e1] bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-[#006b2c]/30 focus:border-[#006b2c]'
                  }`}
                />
              </div>
              {errors.price && (
                <p className="text-[11px] text-[#ef4444] mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.price}
                </p>
              )}
            </div>

            <div>
              <label className="block text-[12px] font-bold text-[#0f172a] uppercase tracking-wider mb-1.5">
                Quantity / Stock <span className="text-[#ef4444]">*</span>
              </label>
              <div className="relative">
                <Layers className="w-4 h-4 text-[#64748b] absolute left-3.5 top-3" />
                <input
                  type="number"
                  min="0"
                  step="1"
                  id="product-stock-input"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="25"
                  className={`w-full pl-9 pr-3.5 py-2.5 text-[13px] rounded-xl border tabular-nums transition-all ${
                    errors.stock
                      ? 'border-[#ef4444] bg-[#fef2f2] focus:ring-2 focus:ring-[#ef4444]/20'
                      : 'border-[#cbd5e1] bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-[#006b2c]/30 focus:border-[#006b2c]'
                  }`}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                {errors.stock ? (
                  <p className="text-[11px] text-[#ef4444] flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.stock}
                  </p>
                ) : (
                  <span className="text-[11px] text-[#64748b]">
                    {parseInt(stock, 10) === 0 ? (
                      <span className="text-[#ef4444] font-semibold">Out of Stock (qty = 0)</span>
                    ) : parseInt(stock, 10) <= 10 ? (
                      <span className="text-[#b45309] font-semibold">Low Stock (qty 1–10)</span>
                    ) : (
                      <span className="text-[#16a34a] font-semibold">In Stock (qty &gt; 10)</span>
                    )}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-bold text-[#0f172a] uppercase tracking-wider mb-1.5">
                Min Stock Level <span className="text-[#ef4444]">*</span>
              </label>
              <div className="relative">
                <Layers className="w-4 h-4 text-[#64748b] absolute left-3.5 top-3" />
                <input
                  type="number"
                  min="0"
                  step="1"
                  id="product-min-stock-input"
                  value={minStockLevel}
                  onChange={(e) => setMinStockLevel(e.target.value)}
                  placeholder="5"
                  className={`w-full pl-9 pr-3.5 py-2.5 text-[13px] rounded-xl border tabular-nums transition-all ${
                    errors.minStockLevel
                      ? 'border-[#ef4444] bg-[#fef2f2] focus:ring-2 focus:ring-[#ef4444]/20'
                      : 'border-[#cbd5e1] bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-[#006b2c]/30 focus:border-[#006b2c]'
                  }`}
                />
              </div>
              {errors.minStockLevel ? (
                <p className="text-[11px] text-[#ef4444] mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.minStockLevel}
                </p>
              ) : (
                <span className="text-[10px] text-[#64748b] mt-1 block">
                  Alert threshold for replenishment
                </span>
              )}
            </div>
          </div>

          {/* Image URL & Preset Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[12px] font-bold text-[#0f172a] uppercase tracking-wider">
                Product Image URL <span className="text-[#ef4444]">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowPresets(!showPresets)}
                className="text-[12px] text-[#006b2c] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{showPresets ? 'Hide Image Presets' : 'Browse Fresh Image Presets'}</span>
              </button>
            </div>

            <div className="flex gap-3">
              <div className="relative flex-1">
                <ImageIcon className="w-4 h-4 text-[#64748b] absolute left-3.5 top-3" />
                <input
                  type="url"
                  id="product-image-input"
                  value={image}
                  onChange={(e) => {
                    setImage(e.target.value);
                    setImageError(false);
                  }}
                  placeholder="https://images.unsplash.com/..."
                  className={`w-full pl-9 pr-3.5 py-2.5 text-[13px] rounded-xl border transition-all ${
                    errors.image
                      ? 'border-[#ef4444] bg-[#fef2f2] focus:ring-2 focus:ring-[#ef4444]/20'
                      : 'border-[#cbd5e1] bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-[#006b2c]/30 focus:border-[#006b2c]'
                  }`}
                />
              </div>

              {/* Live Preview Thumbnail */}
              <div className="w-12 h-12 rounded-xl bg-[#eff4ff] border border-[#cbd5e1] overflow-hidden shrink-0 flex items-center justify-center">
                {image && !imageError ? (
                  <img
                    src={image}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <ImageIcon className="w-6 h-6 text-[#94a3b8]" />
                )}
              </div>
            </div>
            {errors.image && (
              <p className="text-[11px] text-[#ef4444] mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.image}
              </p>
            )}

            {/* Curated Preset Picker Tray */}
            {showPresets && (
              <div className="mt-3 p-3 bg-[#f8fafc] rounded-xl border border-[#e2e8f0] space-y-2 animate-in slide-in-from-top-2">
                <p className="text-[11px] font-semibold text-[#64748b]">
                  Click any verified high-res grocery photo to apply instantly:
                </p>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {IMAGE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      title={preset.label}
                      onClick={() => {
                        setImage(preset.url);
                        setImageError(false);
                        if (!title) setTitle(preset.label);
                        setCategory(preset.category);
                      }}
                      className={`group relative rounded-lg overflow-hidden border transition-all aspect-square cursor-pointer ${
                        image === preset.url
                          ? 'ring-2 ring-[#006b2c] border-[#006b2c]'
                          : 'border-[#cbd5e1] hover:opacity-85'
                      }`}
                    >
                      <img
                        src={preset.url}
                        alt={preset.label}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] truncate px-1 py-0.5 text-center">
                        {preset.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-[12px] font-bold text-[#0f172a] uppercase tracking-wider mb-1.5">
              Product Description <span className="text-[#ef4444]">*</span>
            </label>
            <textarea
              id="product-description-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe freshness, taste profile, origin, and key quality attributes..."
              className={`w-full px-3.5 py-2.5 text-[13px] rounded-xl border transition-all ${
                errors.description
                  ? 'border-[#ef4444] bg-[#fef2f2] focus:ring-2 focus:ring-[#ef4444]/20'
                  : 'border-[#cbd5e1] bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-[#006b2c]/30 focus:border-[#006b2c]'
              }`}
            />
            {errors.description && (
              <p className="text-[11px] text-[#ef4444] mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.description}
              </p>
            )}
          </div>

          {/* Supplier, SKU & Badge Attributes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1">
                Farm Supplier
              </label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Verde Valley Organic"
                className="w-full px-3 py-2 text-[12px] rounded-lg border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-[#006b2c]/30"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1">
                SKU Identifier
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="SKU-9920"
                className="w-full px-3 py-2 text-[12px] font-mono rounded-lg border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-[#006b2c]/30"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1">
                Marketing Badge
              </label>
              <input
                type="text"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                placeholder="Fresh Harvest, Organic"
                className="w-full px-3 py-2 text-[12px] rounded-lg border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white focus:ring-2 focus:ring-[#006b2c]/30"
              />
            </div>
          </div>

          {/* Checkboxes & Extra Attributes */}
          <div className="p-3.5 bg-[#eff4ff]/60 rounded-xl border border-[#dce9ff] flex flex-wrap items-center justify-between gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-[12px] font-semibold text-[#0f172a]">
              <input
                type="checkbox"
                checked={isOrganic}
                onChange={(e) => setIsOrganic(e.target.checked)}
                className="w-4 h-4 rounded text-[#006b2c] focus:ring-[#006b2c]"
              />
              <span>Certified 100% Organic</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-[12px] font-semibold text-[#0f172a]">
              <input
                type="checkbox"
                checked={isQuickPrep}
                onChange={(e) => setIsQuickPrep(e.target.checked)}
                className="w-4 h-4 rounded text-[#006b2c] focus:ring-[#006b2c]"
              />
              <span>Quick Meal Prep Ready</span>
            </label>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#565e74]">Cold-Chain:</span>
              <select
                value={tempRequirement}
                onChange={(e) => setTempRequirement(e.target.value)}
                className="px-2 py-1 text-[11px] rounded-md border border-[#cbd5e1] bg-white text-[#0f172a]"
              >
                <option value="Chilled 2-4°C">Chilled 2-4°C (Vault)</option>
                <option value="Ambient 18-22°C">Ambient 18-22°C</option>
                <option value="Crisp 4-6°C">Crisp Produce 4-6°C</option>
                <option value="Freezer -18°C">Freezer -18°C</option>
              </select>
            </div>
          </div>
        </form>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:px-6 bg-[#f8fafc] border-t border-[#e2e8f0] flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-semibold text-[#64748b] hover:text-[#0f172a] rounded-xl hover:bg-[#e2e8f0]/60 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            id="save-product-btn"
            onClick={handleSubmit}
            className="px-6 py-2.5 text-[13px] font-bold text-white bg-[#006b2c] hover:bg-[#00873a] rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{isEditing ? 'Save Product Changes' : 'Publish Product to Inventory'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
