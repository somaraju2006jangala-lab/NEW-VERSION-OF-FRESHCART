import React, { useState } from 'react';
import { Product, PackSizeOption } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { STANDARD_UNITS, getSuggestedPackSizesForUnit } from '../utils/packSize';
export { STANDARD_UNITS };
import { X, Plus, Image as ImageIcon, Sparkles, Check } from 'lucide-react';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProduct: (product: Product) => void;
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
}) => {
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState<string>('99');
  const [quantity, setQuantity] = useState<string>('25');
  const [unit, setUnit] = useState<string>('1 kg');
  const [category, setCategory] = useState<Product['category']>('produce');
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
    const numericPrice = parseFloat(price) || 99;
    const derived = getSuggestedPackSizesForUnit({
      unit: newUnit,
      price: numericPrice,
      category,
      title,
    });
    setPackSizes(derived);
  };

  const handleCustomUnitApply = () => {
    const trimmed = customUnit.trim();
    if (!trimmed) return;
    const numericPrice = parseFloat(price) || 99;
    const derived = getSuggestedPackSizesForUnit({
      unit: trimmed,
      price: numericPrice,
      category,
      title,
    });
    setPackSizes(derived);
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

    const categoryObj = CATEGORY_OPTIONS.find((c) => c.id === category);

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
      category,
      categoryLabel: categoryObj?.aisle || 'Fresh Produce',
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
    setPackSizes(getSuggestedPackSizesForUnit({ unit: '1 kg', price: 99, category: 'produce' }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1c30]/50 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-[#e2e8f0] flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#e2e8f0] bg-[#f8fafc]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#006b2c] text-white flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-[#0b1c30] font-display">
                {t('addProductTitle')}
              </h2>
              <p className="text-[11px] text-[#565e74]">
                {t('addProductSubtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-[#565e74] hover:bg-[#e2e8f0] hover:text-[#0b1c30] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-2.5 rounded-lg bg-[#fee2e2] text-[#b91c1c] text-[12px] font-semibold border border-[#fecaca]">
              {error}
            </div>
          )}

          {/* Product Name */}
          <div className="space-y-1">
            <label className="text-[12px] font-semibold text-[#0b1c30]">
              {t('productNameLabel')}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('productNamePlaceholder')}
              className="w-full px-3 py-2 text-[13px] border border-[#cbd5e1] rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-[#006b2c]"
            />
          </div>

          {/* Category & Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[12px] font-semibold text-[#0b1c30]">
                {t('categoryLabel')}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Product['category'])}
                className="w-full px-3 py-2 text-[13px] border border-[#cbd5e1] rounded-lg bg-white text-[#0b1c30] focus:outline-hidden focus:ring-2 focus:ring-[#006b2c] cursor-pointer"
              >
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
                    <option key={c.id} value={c.id}>
                      {catLabel}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[12px] font-semibold text-[#0b1c30]">
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
                    className="w-full px-3 py-2 text-[13px] border border-[#cbd5e1] rounded-lg bg-white text-[#0b1c30] focus:outline-hidden focus:ring-2 focus:ring-[#006b2c] cursor-pointer font-semibold"
                  >
                    <optgroup label="Weight">
                      <option value="100 g">100 g</option>
                      <option value="250 g">250 g</option>
                      <option value="500 g">500 g</option>
                      <option value="1 kg">1 kg</option>
                      <option value="2 kg">2 kg</option>
                      <option value="5 kg">5 kg</option>
                    </optgroup>
                    <optgroup label="Volume">
                      <option value="100 ml">100 ml</option>
                      <option value="250 ml">250 ml</option>
                      <option value="500 ml">500 ml</option>
                      <option value="1 litre">1 litre</option>
                      <option value="2 litres">2 litres</option>
                      <option value="5 litres">5 litres</option>
                    </optgroup>
                    <optgroup label="Pieces">
                      <option value="1 piece">1 piece</option>
                      <option value="2 pieces">2 pieces</option>
                      <option value="4 pieces">4 pieces</option>
                      <option value="1 packet">1 packet</option>
                      <option value="1 box">1 box</option>
                      <option value="1 bunch">1 bunch</option>
                    </optgroup>
                    <optgroup label="Dozen">
                      <option value="1/2 dozen">1/2 dozen</option>
                      <option value="1 dozen">1 dozen</option>
                      <option value="2 dozen">2 dozen</option>
                    </optgroup>
                    <option value="custom">{t('enterCustomUnitBtn')}</option>
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
                    className="flex-1 px-3 py-2 text-[13px] border border-[#cbd5e1] rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-[#006b2c]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomUnit(false);
                      handleUnitChange(unit);
                    }}
                    className="px-2.5 py-1 text-[11px] text-[#565e74] hover:text-[#0b1c30] underline cursor-pointer"
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
              <label className="text-[12px] font-semibold text-[#0b1c30]">
                {t('priceLabel')}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-[14px] font-bold text-[#64748b]">
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
                  className="w-full pl-7 pr-3 py-2 text-[13px] font-bold tabular-nums border border-[#cbd5e1] rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-[#006b2c]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[12px] font-semibold text-[#0b1c30]">
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
                className="w-full px-3 py-2 text-[13px] font-bold tabular-nums border border-[#cbd5e1] rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-[#006b2c]"
              />
            </div>
          </div>

          {/* Pack Sizes, Prices, Stock & Availability Configuration */}
          <div className="space-y-3 border border-[#cbd5e1] rounded-xl p-3.5 bg-[#f8fafc]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-[13px] font-bold text-[#0b1c30] block">
                  Pack Sizes, Prices, Stock & Availability
                </label>
                <span className="text-[11px] text-[#64748b] block">
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
            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[#e2e8f0]">
              <span className="text-[11px] font-semibold text-[#64748b]">Quick add:</span>
              {[
                '100 g',
                '250 g',
                '500 g',
                '1 kg',
                '5 kg',
                '100 ml',
                '250 ml',
                '500 ml',
                '1 litre',
                '5 litres',
                '1 piece',
                '2 pieces',
                '4 pieces',
                '1/2 dozen',
                '1 dozen',
                '2 dozen',
              ].map((preset) => {
                const alreadyAdded = packSizes.some(
                  (ps) => ps.size.toLowerCase() === preset.toLowerCase()
                );
                return (
                  <button
                    key={preset}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => {
                      const numericPrice = parseFloat(price) || 99;
                      setPackSizes([
                        ...packSizes,
                        { size: preset, price: numericPrice, isAvailable: true },
                      ]);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer border ${
                      alreadyAdded
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                        : 'bg-white hover:bg-emerald-50 text-[#006b2c] border-[#cbdcfc] hover:border-[#006b2c]'
                    }`}
                  >
                    + {preset}
                  </button>
                );
              })}
            </div>

            {/* Pack Size Rows */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {packSizes.map((ps, idx) => {
                const isAvail = ps.isAvailable !== false && (ps as any).available !== false;
                return (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl border border-[#cbd5e1] bg-white flex flex-col sm:flex-row sm:items-center gap-2 shadow-2xs"
                  >
                    {/* Size Input */}
                    <div className="flex-1 min-w-[110px]">
                      <label className="text-[10px] font-semibold text-[#64748b] block mb-0.5">
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
                        className="w-full px-2.5 py-1 text-[12px] font-semibold border border-[#cbd5e1] rounded-lg bg-white text-[#0b1c30] focus:ring-1 focus:ring-[#006b2c]"
                      />
                    </div>

                    {/* Price Input */}
                    <div className="w-24">
                      <label className="text-[10px] font-semibold text-[#64748b] block mb-0.5">
                        Price (₹)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2 top-1 text-[12px] font-bold text-[#64748b]">
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
                          className="w-full pl-5 pr-2 py-1 text-[12px] font-bold tabular-nums border border-[#cbd5e1] rounded-lg bg-white text-[#0b1c30] focus:ring-1 focus:ring-[#006b2c]"
                        />
                      </div>
                    </div>

                    {/* Stock Input */}
                    <div className="w-24">
                      <label className="text-[10px] font-semibold text-[#64748b] block mb-0.5">
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
                        className="w-full px-2 py-1 text-[12px] font-bold tabular-nums border border-[#cbd5e1] rounded-lg bg-white text-[#0b1c30] focus:ring-1 focus:ring-[#006b2c]"
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
                            ? 'bg-[#dcfce7] text-[#15803d] border-[#86efac] hover:bg-[#bbf7d0]'
                            : 'bg-[#fee2e2] text-[#b91c1c] border-[#fca5a5] hover:bg-[#fecaca]'
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
                        className="p-1 rounded-lg text-[#64748b] hover:text-red-500 hover:bg-red-50 disabled:opacity-30 cursor-pointer transition-colors"
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-semibold text-[#0b1c30] flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-[#006b2c]" />
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
                className="flex-1 px-3 py-2 text-[12px] border border-[#cbd5e1] rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-[#006b2c]"
              />
              <img
                src={image || DEFAULT_FALLBACK_IMAGE}
                alt="Preview"
                className="w-10 h-10 rounded-lg object-cover border border-[#cbd5e1] bg-[#f8fafc] shrink-0"
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
                      ? 'bg-[#eff4ff] border-[#006b2c] text-[#006b2c] font-semibold'
                      : 'bg-[#f8fafc] border-[#e2e8f0] text-[#64748b] hover:border-[#cbd5e1]'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-[12px] font-semibold text-[#0b1c30]">
              {t('productDescriptionLabel')}
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('productDescriptionPlaceholder')}
              className="w-full px-3 py-2 text-[13px] border border-[#cbd5e1] rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-[#006b2c]"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-[#e2e8f0] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-[13px] font-semibold text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0b1c30] transition-colors cursor-pointer"
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
