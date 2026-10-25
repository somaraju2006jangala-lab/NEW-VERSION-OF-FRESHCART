import React, { useState, useEffect, useRef } from 'react';
import { Product, PackSizeOption } from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  STANDARD_UNITS,
  getQuickAddPresetsForUnit,
  isSamePackSize,
  getPackSizeConversionFactor,
} from '../utils/packSize';
export { STANDARD_UNITS };
import { X, Plus, Image as ImageIcon, Check, Upload, Trash2 } from 'lucide-react';

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

const DEFAULT_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';

export const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  onAddProduct,
  allCategories = [],
}) => {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [unit, setUnit] = useState<string>('1 kg');
  const [category, setCategory] = useState<string>('produce');
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [image, setImage] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [imageFileName, setImageFileName] = useState('');
  const [imageFileSize, setImageFileSize] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [description, setDescription] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  const [packSizes, setPackSizes] = useState<PackSizeOption[]>([
    { size: '1 kg', price: 0, stock: 0, isAvailable: true },
  ]);
  const [error, setError] = useState('');

  // Reset form to a completely clean, fresh state
  const resetForm = () => {
    setTitle('');
    setPrice('');
    setQuantity('');
    setUnit('1 kg');
    setIsCustomUnit(false);
    setCustomUnit('');
    setCategory('produce');
    setIsNewCategory(false);
    setNewCategoryName('');
    setImage('');
    setImagePreview('');
    setImageFileName('');
    setImageFileSize('');
    setIsUploadingImage(false);
    setDescription('');
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setPackSizes([
      {
        size: '1 kg',
        price: 0,
        stock: 0,
        isAvailable: true,
      },
    ]);
  };

  // Reset form whenever the modal is opened
  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const activeUnit = isCustomUnit ? customUnit.trim() : unit;
  const quickAddPresets = getQuickAddPresetsForUnit(activeUnit || '1 kg');

  // Handle top-level Unit change (keeps packSizes[0] automatically synchronized)
  const handleUnitChange = (newUnit: string) => {
    setUnit(newUnit);
    setIsCustomUnit(false);
    setPackSizes((prev) => {
      const next = [...prev];
      const numericPrice = parseFloat(price) || 0;
      const numericQty = quantity !== '' ? parseInt(quantity, 10) || 0 : 0;
      if (next.length > 0) {
        next[0] = { ...next[0], size: newUnit, price: numericPrice, stock: numericQty };
      } else {
        next.push({ size: newUnit, price: numericPrice, stock: numericQty, isAvailable: true });
      }
      // Deduplicate: remove any additional pack sizes that match the new unit
      return next.filter((ps, idx) => idx === 0 || !isSamePackSize(ps.size, newUnit));
    });
  };

  // Handle custom unit changes
  const handleCustomUnitChange = (newCustomUnit: string) => {
    setCustomUnit(newCustomUnit);
    const trimmed = newCustomUnit.trim();
    if (trimmed) {
      setPackSizes((prev) => {
        const next = [...prev];
        if (next.length > 0) {
          next[0] = { ...next[0], size: trimmed };
        }
        return next.filter((ps, idx) => idx === 0 || !isSamePackSize(ps.size, trimmed));
      });
    }
  };

  // Handle top-level Price change (maps to packSizes[0].price)
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

  // Handle top-level Stock Quantity change (maps to packSizes[0].stock)
  const handleQuantityChange = (newQty: string) => {
    setQuantity(newQty);
    const num = newQty !== '' ? Math.max(0, parseInt(newQty, 10) || 0) : 0;
    setPackSizes((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      next[0] = { ...next[0], stock: num };
      return next;
    });
  };

  // Handle editing pack-size price in the pack sizes section
  const handlePackSizePriceChange = (idx: number, newPriceVal: number) => {
    setPackSizes((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], price: newPriceVal };
      return next;
    });
    // If editing the first pack size, sync with top-level price
    if (idx === 0) {
      setPrice(newPriceVal > 0 ? String(newPriceVal) : '');
    }
  };

  // Handle editing pack-size stock in the pack sizes section
  const handlePackSizeStockChange = (idx: number, newStockVal: number | undefined) => {
    setPackSizes((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], stock: newStockVal };
      return next;
    });
    // If editing the first pack size, sync with top-level stock
    if (idx === 0) {
      setQuantity(newStockVal !== undefined ? String(newStockVal) : '');
    }
  };

  // Handle editing pack size name
  const handlePackSizeNameChange = (idx: number, newName: string) => {
    setPackSizes((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], size: newName };
      return next;
    });
    if (idx === 0) {
      if (isCustomUnit) {
        setCustomUnit(newName);
      } else {
        setUnit(newName);
      }
    }
  };

  // Add an additional pack size row (independent price & stock, no duplicates)
  const handleAddPackSizeRow = () => {
    const existingSizes = packSizes.map((ps) => ps.size.trim().toLowerCase());
    const availablePreset = quickAddPresets.find((p) => !existingSizes.includes(p.toLowerCase()));

    const newSize = availablePreset || '';
    const numericPrice = parseFloat(price) || 0;
    let initialPrice = numericPrice;
    if (newSize) {
      const factor = getPackSizeConversionFactor(newSize, activeUnit);
      if (factor && factor > 0 && numericPrice > 0) {
        initialPrice = Math.max(1, Math.round(numericPrice * factor));
      }
    }

    setPackSizes((prev) => [
      ...prev,
      {
        size: newSize,
        price: initialPrice,
        stock: quantity !== '' ? Math.max(0, parseInt(quantity, 10) || 0) : undefined,
        isAvailable: true,
      },
    ]);
  };

  // Add a specific preset pack size via quick-add (independent price & stock, prevents duplicates)
  const handleAddPresetPackSize = (preset: string) => {
    const alreadyAdded = packSizes.some((ps) => isSamePackSize(ps.size, preset));
    if (alreadyAdded) return;

    const numericPrice = parseFloat(price) || 0;
    let newPrice = numericPrice;
    const factor = getPackSizeConversionFactor(preset, activeUnit);
    if (factor && factor > 0 && numericPrice > 0) {
      newPrice = Math.max(1, Math.round(numericPrice * factor));
    }

    setPackSizes((prev) => [
      ...prev,
      {
        size: preset,
        price: newPrice,
        stock: quantity !== '' ? Math.max(0, parseInt(quantity, 10) || 0) : undefined,
        isAvailable: true,
      },
    ]);
  };

  // Remove an additional pack size row (default pack size at index 0 cannot be removed)
  const handleRemovePackSizeRow = (idx: number) => {
    if (idx === 0) return;
    setPackSizes((prev) => prev.filter((_, i) => i !== idx));
  };

  // Image Upload handler (supports JPG, JPEG, PNG, WebP)
  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;

    const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const lowerName = file.name.toLowerCase();
    const hasValidExt = validExtensions.some((ext) => lowerName.endsWith(ext));
    const hasValidMime = validMimes.includes(file.type.toLowerCase());

    if (!hasValidMime && !hasValidExt) {
      setError('Please select a valid image file (JPG, JPEG, PNG, or WebP).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image file must be under 5MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploadingImage(true);
    const sizeInKb = Math.round(file.size / 1024);
    const formattedSize = sizeInKb > 1024 ? `${(sizeInKb / 1024).toFixed(1)} MB` : `${sizeInKb} KB`;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) {
        setError('Failed to read image file.');
        setIsUploadingImage(false);
        return;
      }

      // Optimize image size using an off-screen canvas if image exceeds 1200px
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 1200;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const outputMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
              const optimized = canvas.toDataURL(outputMime, 0.88);
              setImage(optimized);
              setImagePreview(optimized);
              setImageFileName(file.name);
              setImageFileSize(formattedSize);
              setIsUploadingImage(false);
              return;
            }
          }
          setImage(dataUrl);
          setImagePreview(dataUrl);
          setImageFileName(file.name);
          setImageFileSize(formattedSize);
        } catch {
          setImage(dataUrl);
          setImagePreview(dataUrl);
          setImageFileName(file.name);
          setImageFileSize(formattedSize);
        } finally {
          setIsUploadingImage(false);
        }
      };
      img.onerror = () => {
        setImage(dataUrl);
        setImagePreview(dataUrl);
        setImageFileName(file.name);
        setImageFileSize(formattedSize);
        setIsUploadingImage(false);
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      setError('Error reading file from device.');
      setIsUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  // Remove the selected image
  const handleRemoveImage = () => {
    setImage('');
    setImagePreview('');
    setImageFileName('');
    setImageFileSize('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Submit product creation
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

    // Validate all pack sizes
    for (let i = 0; i < packSizes.length; i++) {
      const ps = packSizes[i];
      if (!ps.size || !ps.size.trim()) {
        setError(`Please enter a pack size name for pack size #${i + 1}.`);
        return;
      }
      const pNum = Number(ps.price);
      if (isNaN(pNum) || pNum <= 0) {
        setError(`Pack size "${ps.size}" must have a valid price greater than ₹0.`);
        return;
      }
    }

    // Check for duplicate pack sizes
    const sizeNames = packSizes.map((ps) => ps.size.trim().toLowerCase());
    const duplicate = sizeNames.find((name, idx) => sizeNames.indexOf(name) !== idx);
    if (duplicate) {
      setError(`Duplicate pack size "${duplicate}" found. Each pack size must be unique.`);
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

    const finalPackSizes = packSizes.map((ps, idx) => ({
      size: ps.size.trim(),
      price: Math.max(1, Math.round(Number(ps.price) || numericPrice)),
      isAvailable: ps.isAvailable !== false,
      stock:
        idx === 0
          ? numericQty
          : ps.stock !== undefined && String(ps.stock).trim() !== '' && !isNaN(Number(ps.stock))
          ? Math.max(0, Math.floor(Number(ps.stock)))
          : undefined,
    }));

    const finalImage = (image || imagePreview || DEFAULT_FALLBACK_IMAGE).trim();

    const newProduct: Product = {
      id: `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: title.trim(),
      supplier: 'Local Farm Direct',
      sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      price: numericPrice,
      unit: selectedUnit,
      stock: Math.max(0, numericQty),
      badge: 'Fresh Harvest',
      image: finalImage,
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
    resetForm();
  };

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
                    onChange={(e) => handleCustomUnitChange(e.target.value)}
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
                  onChange={(e) => handlePriceChange(e.target.value)}
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
                onChange={(e) => handleQuantityChange(e.target.value)}
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
                const isDefaultPackSize = idx === 0;

                return (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center gap-2 shadow-xs transition-colors ${
                      isDefaultPackSize
                        ? 'border-emerald-500/40 bg-emerald-950/15'
                        : 'border-white/10 bg-black/60'
                    }`}
                  >
                    {/* Size Input */}
                    <div className="flex-1 min-w-[110px]">
                      <div className="flex items-center gap-1 mb-0.5">
                        <label className="text-[10px] font-semibold text-slate-400 block">
                          Pack Size
                        </label>
                        {isDefaultPackSize && (
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1 py-0.2 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={ps.size}
                        onChange={(e) => handlePackSizeNameChange(idx, e.target.value)}
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
                          value={ps.price || ''}
                          placeholder={isDefaultPackSize && price ? price : '0'}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            handlePackSizePriceChange(idx, val);
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
                        value={
                          isDefaultPackSize
                            ? quantity !== ''
                              ? quantity
                              : ps.stock !== undefined
                              ? ps.stock
                              : ''
                            : ps.stock !== undefined
                            ? ps.stock
                            : ''
                        }
                        placeholder={isDefaultPackSize && quantity ? quantity : 'Mapped'}
                        title={
                          isDefaultPackSize
                            ? 'Mapped to top-level Stock Quantity'
                            : 'Pack-size specific stock (or leave blank for mapped product inventory)'
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value.trim() === ''
                              ? undefined
                              : Math.max(0, parseInt(e.target.value, 10) || 0);
                          handlePackSizeStockChange(idx, val);
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
                        disabled={isDefaultPackSize || packSizes.length <= 1}
                        onClick={() => handleRemovePackSizeRow(idx)}
                        className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        title={
                          isDefaultPackSize
                            ? 'Default pack size cannot be removed'
                            : 'Remove this pack size'
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Product Image Upload Field */}
          <div className="space-y-2 border border-white/10 rounded-xl p-3.5 bg-black/50 backdrop-blur-xs">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-semibold text-slate-200 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span>Product Image</span>
              </label>
              <span className="text-[11px] text-slate-400">
                JPG, JPEG, PNG, WebP (Max 5MB)
              </span>
            </div>

            <input
              ref={fileInputRef}
              id="add-product-file-upload"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={handleImageFileSelect}
              className="hidden"
            />

            {imagePreview ? (
              /* Selected Image Preview with Change & Remove options */
              <div className="flex items-center gap-3 p-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20">
                <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/20 bg-black/70 shrink-0 flex items-center justify-center shadow-inner">
                  <img
                    id="add-product-image-preview"
                    src={imagePreview}
                    alt="Product preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-white truncate">
                    {imageFileName || 'Uploaded product image'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {imageFileSize ? `${imageFileSize} • ` : ''}Ready to save
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      type="button"
                      id="change-product-image-btn"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Upload className="w-3 h-3 text-emerald-400" />
                      <span>Change Image</span>
                    </button>
                    <button
                      type="button"
                      id="remove-product-image-btn"
                      onClick={handleRemoveImage}
                      className="px-2.5 py-1 rounded-md bg-red-950/40 hover:bg-red-900/50 text-red-300 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-red-500/30"
                    >
                      <X className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Empty upload area with Upload Product Image button */
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl border border-dashed border-white/20 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 shrink-0">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-slate-200">
                      No image selected
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Upload a JPG, JPEG, PNG, or WebP photo of your product
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  id="upload-product-image-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/35 text-emerald-300 border border-emerald-500/40 text-[12px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploadingImage ? 'Reading...' : 'Upload Product Image'}</span>
                </button>
              </div>
            )}
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
              className="px-5 py-2 rounded-lg bg-[#006b2c] hover:bg-[#00873a] text-white text-[13px] font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
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
