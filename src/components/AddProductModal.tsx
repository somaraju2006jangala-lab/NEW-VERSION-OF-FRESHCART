import React, { useState } from 'react';
import { Product, PackSizeOption } from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  STANDARD_UNITS,
  getSuggestedPackSizesForUnit,
  getQuickAddPresetsForUnit,
  isSamePackSize,
  getPackSizeConversionFactor,
} from '../utils/packSize';
export { STANDARD_UNITS };
import { X, Plus, Image as ImageIcon, Sparkles, Check } from 'lucide-react';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProduct: (product: Product) => void;
  allCategories?: string[];
}

const CATEGORY_OPTIONS: { id: Product['category']; label: string; aisle: string }[] = [
  { id: 'produce', label: 'Fruits & Vegetables', aisle: 'Fruits & Veggies' },
  { id: 'dairy', label: 'Dairy & Eggs', aisle: 'Dairy & Eggs' },
  { id: 'bakery', label: 'Bakery', aisle: 'Bakery & Bread' },
  { id: 'beverages', label: 'Beverages', aisle: 'Beverages' },
  { id: 'snacks', label: 'Snacks', aisle: 'Snacks' },
  { id: 'grains', label: 'Rice & Grains', aisle: 'Rice & Grains' },
];

const PRESET_IMAGES = [
  {
    name: 'Rice / Grains',
    url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
    category: 'grains' as const,
    unit: '1 kg',
  },
  {
    name: 'Milk / Dairy',
    url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80',
    category: 'dairy' as const,
    unit: '500 ml',
  },
  {
    name: 'Eggs',
    url: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=600&q=80',
    category: 'dairy' as const,
    unit: '1 dozen',
  },
  {
    name: 'Bread',
    url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
    category: 'bakery' as const,
    unit: '1 packet',
  },
  {
    name: 'Apples / Fruits',
    url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80',
    category: 'produce' as const,
    unit: '1 kg',
  },
  {
    name: 'Vegetables',
    url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80',
    category: 'produce' as const,
    unit: '500 g',
  },
  {
    name: 'Beverage / Juice',
    url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
    category: 'beverages' as const,
    unit: '1 litre',
  },
  {
    name: 'Snacks / Box',
    url: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?auto=format&fit=crop&w=600&q=80',
    category: 'snacks' as const,
    unit: '1 box',
  },
];

const DEFAULT_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';

export const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  onAddProduct,
  allCategories = [],
}) => {
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState<string>('99');
  const [quantity, setQuantity] = useState<string>('25');
  const [unit, setUnit] = useState<string>('1 kg');
  const [category, setCategory] = useState<string>('produce');
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [image, setImage] = useState(PRESET_IMAGES[0].url);
  const [description, setDescription] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  const [packSizes, setPackSizes] = useState<PackSizeOption[]>(() =>
    getSuggestedPackSizesForUnit({ unit: '1 kg', price: 99, category: 'produce', title: '' })
  );
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleApplyPreset = (preset: typeof PRESET_IMAGES[0]) => {
    setImage(preset.url);
    setCategory(preset.category);
    setUnit(preset.unit);
    setIsCustomUnit(false);
    const numericPrice = parseFloat(price) || 99;
    const derived = getSuggestedPackSizesForUnit({
      unit: preset.unit,
      price: numericPrice,
      category: preset.category,
      title: preset.name,
    });
    setPackSizes(derived);
    if (!description) {
      setDescription(`Farm fresh ${preset.name.toLowerCase()} sourced daily from local organic producers.`);
    }
  };

  const handleUnitChange = (newUnit: string) => {
    setUnit(newUnit);
    setIsCustomUnit(false);
  };

  const handleCustomUnitApply = () => {
    // Preserves existing pack sizes; quick add options dynamically update based on customUnit
  };

  const handleAddPresetPackSize = (preset: string) => {
    const alreadyAdded = packSizes.some((ps) => isSamePackSize(ps.size, preset));
    if (alreadyAdded) return;

    const selectedUnit = isCustomUnit ? customUnit.trim() : unit;
    const numericPrice = parseFloat(price) || 99;
    let newPrice = numericPrice;
    const factor = getPackSizeConversionFactor(preset, selectedUnit);
    if (factor && factor > 0) {
      newPrice = Math.max(1, Math.round(numericPrice * factor));
    }

    setPackSizes((prev) => [
      ...prev,
      { size: preset, price: newPrice, isAvailable: true },
    ]);
  };

  const handleRegeneratePackSizes = () => {
    const selectedUnit = isCustomUnit ? customUnit.trim() : unit;
    const numericPrice = parseFloat(price) || 99;
    const derived = getSuggestedPackSizesForUnit({
      unit: selectedUnit || '1 kg',
      price: numericPrice,
      category,
      title,
    });
    setPackSizes(derived);
  };

  const handleAddPackSizeRow = () => {
    const selectedUnit = isCustomUnit ? customUnit.trim() : unit;
    const numericPrice = parseFloat(price) || 99;
    setPackSizes([
      ...packSizes,
      { size: selectedUnit || '1 unit', price: numericPrice, isAvailable: true },
    ]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please enter a product name.');
      return;
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      setError('Please enter a valid price greater than ₹0.');
      return;
    }

    const numericQty = parseInt(quantity, 10);
    if (isNaN(numericQty) || numericQty < 0) {
      setError('Quantity cannot be negative.');
      return;
    }

    const selectedUnit = isCustomUnit ? customUnit.trim() : unit;
    if (!selectedUnit) {
      setError('Please specify a product unit.');
      return;
    }

    if (!description.trim()) {
      setError('Please provide a brief description of the product.');
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
      const categoryObj = CATEGORY_OPTIONS.find((c) => c.id === category);
      finalCategoryLabel = categoryObj?.aisle || categoryObj?.label || category;
    }

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

    const finalPackSizes =
      validPackSizes.length > 0
        ? validPackSizes
        : [
            {
              size: selectedUnit,
              price: numericPrice,
              isAvailable: true,
              stock: Math.max(0, numericQty),
            },
          ];

    const newProduct: Product = {
      id: `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: title.trim(),
      supplier: 'Local Farm Direct',
      sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      price: numericPrice,
      unit: selectedUnit,
      stock: Math.max(0, numericQty),
      badge: 'Fresh Harvest',
      image: image.trim() || DEFAULT_FALLBACK_IMAGE,
      category: finalCategory,
      categoryLabel: finalCategoryLabel,
      description: description.trim(),
      isOrganic: true,
      isQuickPrep: true,
      farmOrigin: 'Central Valley Organic Hub',
      harvestDate: 'Fresh Morning Stock',
      tempRequirement: 'Ambient / Cold-Chain Controlled',
      batchNumber: `LOT-2026-${Date.now().toString().slice(-4)}`,
      expiryDate: 'Fresh Daily Stock',
      packSizes: finalPackSizes,
    };

    onAddProduct(newProduct);
    onClose();

    // Reset form
    setTitle('');
    setPrice('99');
    setQuantity('25');
    setUnit('1 kg');
    setDescription('');
    setIsCustomUnit(false);
    setIsNewCategory(false);
    setNewCategoryName('');
    setPackSizes(getSuggestedPackSizesForUnit({ unit: '1 kg', price: 99, category: 'produce' }));
  };

  const activeUnit = isCustomUnit ? customUnit : unit;
  const quickAddPresets = getQuickAddPresetsForUnit(activeUnit);

  return (
    <div
      id="add-product-modal-backdrop"
      className="add-product-modal-backdrop edit-product-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
    >
      <div
        id="add-product-modal"
        className="add-product-modal edit-product-modal bg-[#060b13]/90 backdrop-blur-2xl rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-white/10 flex flex-col max-h-[90vh] text-white"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#006b2c] text-white flex items-center justify-center shadow-xs">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-white font-display">
                {t('addProductTitle')}
              </h2>
              <p className="text-[11px] text-slate-400">
                {t('addProductSubtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-2.5 rounded-lg bg-red-950/80 text-red-200 text-[12px] font-semibold border border-red-800/80">
              {error}
            </div>
          )}

          {/* Product Name */}
          <div className="space-y-1">
            <label className="text-[12px] font-semibold text-slate-200">
              {t('productNameLabel')}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('productNamePlaceholder')}
              className="w-full px-3 py-2 text-[13px] border border-white/15 rounded-lg bg-black/60 text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#006b2c]"
            />
          </div>

          {/* Category & Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[12px] font-semibold text-slate-200">
                {t('categoryLabel')}
              </label>
              <select
                value={isNewCategory ? '__new__' : category}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    setIsNewCategory(true);
                  } else {
                    setIsNewCategory(false);
                    setCategory(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 text-[13px] border border-white/15 rounded-lg bg-black/60 text-white focus:outline-hidden focus:ring-2 focus:ring-[#006b2c] cursor-pointer"
              >
                <optgroup label="Standard Categories" className="bg-[#0b121e] text-white">
                  {CATEGORY_OPTIONS.map((c) => {
                    const catLabel =
                      c.id === 'produce'
                        ? t('catProduce')
                        : c.id === 'dairy'
                        ? t('catDairy')
                        : c.id === 'bakery'
                        ? t('catBakery')
                        : c.id === 'beverages'
                        ? t('catBeverages')
                        : c.id === 'snacks'
                        ? t('catSnacks')
                        : t('catGrains');
                    return (
                      <option key={c.id} value={c.id} className="bg-[#0b121e] text-white">
                        {catLabel}
                      </option>
                    );
                  })}
                </optgroup>
                {allCategories.filter((c) => !CATEGORY_OPTIONS.some((co) => co.id === c)).length > 0 && (
                  <optgroup label="Custom Categories" className="bg-[#0b121e] text-white">
                    {allCategories
                      .filter((c) => !CATEGORY_OPTIONS.some((co) => co.id === c))
                      .map((c) => (
                        <option key={c} value={c} className="bg-[#0b121e] text-white">
                          {c}
                        </option>
                      ))}
                  </optgroup>
                )}
                <option value="__new__" className="bg-[#0b121e] text-emerald-400 font-semibold">
                  + Add New Category...
                </option>
              </select>
              {isNewCategory && (
                <div className="mt-2">
                  <input
                    type="text"
                    required
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g. Personal Care, Household, Organic Spices"
                    className="w-full px-3 py-2 text-[13px] border border-emerald-500 rounded-lg bg-black/60 text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#006b2c]"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[12px] font-semibold text-slate-200">
                {t('unitPackSizeLabel')}
              </label>
              {!isCustomUnit ? (
                <div className="flex gap-1.5">
                  <select
                    value={unit}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setIsCustomUnit(true);
                      } else {
                        handleUnitChange(e.target.value);
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
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value)}
                    onBlur={handleCustomUnitApply}
                    placeholder="e.g. 500 g, 1 kg, 1 L, 1 dozen"
                    className="flex-1 px-3 py-2 text-[13px] border border-emerald-500 rounded-lg bg-black/60 text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#006b2c]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomUnit(false);
                      handleUnitChange(unit);
                    }}
                    className="px-2.5 py-1 text-[11px] text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                  >
                    {t('switchToStandardUnits')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Price & Quantity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[12px] font-semibold text-slate-200">
                {t('priceLabel')}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-[14px] font-bold text-slate-400">
                  ₹
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 80"
                  className="w-full pl-7 pr-3 py-2 text-[13px] font-bold tabular-nums border border-white/15 rounded-lg bg-black/60 text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#006b2c]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[12px] font-semibold text-slate-200">
                {t('stockQuantityLabel')}
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 50"
                className="w-full px-3 py-2 text-[13px] font-bold tabular-nums border border-white/15 rounded-lg bg-black/60 text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#006b2c]"
              />
            </div>
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
                  id="add-pack-size-row-add-modal-btn"
                  onClick={handleAddPackSizeRow}
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
                        id={`toggle-add-availability-${idx}`}
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

          {/* Image & Quick Presets */}
          <div className="space-y-2 border border-white/10 rounded-xl p-3.5 bg-black/50 backdrop-blur-xs">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-semibold text-slate-200 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                {t('presetImageLabel')}
              </label>
            </div>

            <div className="flex gap-2 items-center">
              <input
                type="url"
                required
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="flex-1 px-3 py-2 text-[12px] border border-white/15 rounded-lg bg-black/60 text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#006b2c]"
              />
              <img
                src={image || DEFAULT_FALLBACK_IMAGE}
                alt="Preview"
                className="w-10 h-10 rounded-lg object-cover border border-white/15 bg-black/70 shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = DEFAULT_FALLBACK_IMAGE;
                }}
              />
            </div>

            {/* Quick 1-Click Preset Images */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PRESET_IMAGES.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                    image === preset.url
                      ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300 font-semibold'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-[12px] font-semibold text-slate-200">
              {t('productDescriptionLabel')}
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('productDescriptionPlaceholder')}
              className="w-full px-3 py-2 text-[13px] border border-white/15 rounded-lg bg-black/60 text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#006b2c]"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-[13px] font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#006b2c] hover:bg-[#00873a] text-white text-[13px] font-semibold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{t('addProductSubmitBtn')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
