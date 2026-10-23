import React, { useState, useEffect } from 'react';
import { Product, PackSizeOption } from '../types';
import { formatINR } from '../utils/currency';
import { getAvailablePackSizes, getPackStock } from '../utils/packSize';
import {
  X,
  ShoppingCart,
  Plus,
  Minus,
  Check,
  Calendar,
  Thermometer,
  Award,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { PackSizeModal } from './PackSizeModal';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (
    product: Product,
    quantity: number,
    packSize?: string,
    price?: number
  ) => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  onClose,
  onAddToCart,
}) => {
  const { t } = useLanguage();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [showPackSizePopup, setShowPackSizePopup] = useState(false);

  // Available pack sizes for this product
  const packSizes = product ? getAvailablePackSizes(product) : [];
  const isOutOfStock = !product || product.stock <= 0 || packSizes.length === 0;

  const [selectedPackSize, setSelectedPackSize] = useState<PackSizeOption>(() => {
    if (!product) return { size: '1 kg', price: 0 };
    const options = getAvailablePackSizes(product);
    const matched = options.find(
      (opt) => opt.size.toLowerCase() === product.unit.toLowerCase()
    );
    return matched || options[0] || { size: product.unit, price: product.price, isAvailable: false, stock: 0 };
  });

  // Reset quantity, pack size, and state when product changes
  useEffect(() => {
    if (product) {
      const options = getAvailablePackSizes(product);
      const matched = options.find(
        (opt) => opt.size.toLowerCase() === product.unit.toLowerCase()
      );
      const chosen = matched || options[0] || { size: product.unit, price: product.price, isAvailable: false, stock: 0 };
      setSelectedPackSize(chosen);
      setQty(1);
      setAdded(false);
      setShowPackSizePopup(false);
    }
  }, [product]);

  // Lock background body scroll and listen for Escape key
  useEffect(() => {
    if (!product) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!showPackSizePopup) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [product, onClose, showPackSizePopup]);

  if (!product) return null;

  const currentMaxStock = isOutOfStock ? 0 : getPackStock(selectedPackSize, product);

  const handleOpenPackSizePopup = () => {
    if (isOutOfStock) return;
    setShowPackSizePopup(true);
  };

  const handleConfirmFromPopup = (
    confirmedProduct: Product,
    confirmedQty: number,
    confirmedPackSize: string,
    confirmedPrice: number
  ) => {
    const finalProduct: Product = {
      ...confirmedProduct,
      unit: confirmedPackSize,
      price: confirmedPrice,
    };
    onAddToCart(
      finalProduct,
      Math.min(confirmedQty, confirmedProduct.stock),
      confirmedPackSize,
      confirmedPrice
    );
    setAdded(true);
    setTimeout(() => {
      setAdded(false);
      setShowPackSizePopup(false);
      onClose();
    }, 400);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      id="product-details-backdrop"
      onClick={handleBackdropClick}
      className="product-details-backdrop fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div
        id="product-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
        className="product-details-modal rounded-3xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[88vh] relative my-auto animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Product Image Section */}
        <div className="relative p-3.5 sm:p-4 pb-0 shrink-0">
          <div className="relative h-60 sm:h-72 w-full rounded-2xl overflow-hidden border border-white/10 bg-[#070c14]">
            <img
              src={product.image}
              alt={product.title}
              className="w-full h-full object-cover object-center"
            />
            {/* Subtle bottom gradient overlay for contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#03070c]/80 via-transparent to-black/20 pointer-events-none" />

            {/* Badges */}
            <div className="absolute bottom-3 left-3 flex items-center gap-2">
              {product.badge && (
                <span className="px-2.5 py-1 rounded-full bg-[#00873a] text-white text-[11px] font-bold shadow-md">
                  {product.badge}
                </span>
              )}
              <span className="px-2.5 py-1 rounded-full bg-[#03070c]/90 text-slate-200 border border-white/15 text-[11px] font-semibold backdrop-blur-md shadow-md">
                {product.sku}
              </span>
            </div>
          </div>

          {/* Close button in top-right */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close product details"
            className="absolute top-5 right-5 sm:top-6 sm:right-6 w-8 h-8 rounded-full bg-[#03070c]/80 hover:bg-black border border-white/20 flex items-center justify-center text-slate-200 hover:text-white shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer z-10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product Information Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          <div className="flex justify-between items-start gap-4">
            <div>
              <span className="text-[12px] text-slate-400 font-medium">
                {product.supplier} · {product.categoryLabel}
              </span>
              <h2
                id="product-modal-title"
                className="text-[20px] sm:text-[22px] font-bold text-white font-display mt-0.5 tracking-tight"
              >
                {product.title}
              </h2>
              <div className="text-[12px] text-slate-400 mt-0.5">
                <div>
                  {t('packSizeUnit')}{' '}
                  <span className="font-semibold text-white">{selectedPackSize.size}</span>
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span
                id="product-modal-price"
                className="text-[24px] sm:text-[26px] font-extrabold text-[#00c978] font-display tabular-nums"
              >
                {formatINR(selectedPackSize.price)}
              </span>
              <span className="text-[12px] text-slate-400 block">
                / {selectedPackSize.size}
              </span>
            </div>
          </div>

          {/* Pack Size Selection */}
          {packSizes.length > 0 && (
            <div className="space-y-2 pt-1" id="product-pack-size-selector">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-semibold text-white flex items-center gap-1.5">
                  <span>{t('selectPackSize') || 'Select Pack Size:'}</span>
                </label>
                <span className="text-[11px] text-[#00c978] font-medium">
                  {selectedPackSize.size} · {formatINR(selectedPackSize.price)}
                </span>
              </div>

              <div
                className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                role="radiogroup"
                aria-label="Available pack sizes"
              >
                {packSizes.map((option) => {
                  const isSelected = selectedPackSize.size === option.size;
                  return (
                    <button
                      key={option.size}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      id={`pack-size-opt-${option.size.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                      data-pack-size={option.size}
                      data-pack-price={option.price}
                      onClick={() => {
                        setSelectedPackSize(option);
                        const maxS = getPackStock(option, product);
                        if (qty > maxS) {
                          setQty(Math.max(1, maxS));
                        }
                      }}
                      className={`py-2 px-3 rounded-xl text-left transition-all duration-200 flex flex-col justify-between cursor-pointer border ${
                        isSelected
                          ? 'bg-[#00873a]/30 border-[#00c978] shadow-[0_0_14px_rgba(0,201,120,0.35)] ring-1 ring-[#00c978]/60 text-white'
                          : 'bg-white/5 border-white/10 hover:border-white/25 hover:bg-white/10 text-slate-300 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={`text-[12px] font-semibold ${
                            isSelected ? 'text-white' : 'text-slate-200'
                          }`}
                        >
                          {option.size}
                        </span>
                        {isSelected && (
                          <div className="w-3.5 h-3.5 rounded-full bg-[#00c978] text-[#03070c] flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-[13px] font-bold tabular-nums mt-1 ${
                          isSelected ? 'text-[#00c978]' : 'text-slate-300'
                        }`}
                      >
                        {formatINR(option.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-[14px] text-slate-300 leading-relaxed font-body">
            {product.description}
          </p>

          {/* Farm Quality Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <div className="product-details-card p-3 rounded-xl flex items-start gap-2.5">
              <Award className="w-4 h-4 text-[#00c978] mt-0.5 shrink-0" />
              <div>
                <span className="text-[11px] text-slate-400 font-medium block">
                  {t('farmOrigin')}
                </span>
                <span className="text-[12px] font-semibold text-white">
                  {product.farmOrigin || 'Verde Valley Organic Co-Op'}
                </span>
              </div>
            </div>

            <div className="product-details-card p-3 rounded-xl flex items-start gap-2.5">
              <Calendar className="w-4 h-4 text-[#00c978] mt-0.5 shrink-0" />
              <div>
                <span className="text-[11px] text-slate-400 font-medium block">
                  {t('harvestedBaked')}
                </span>
                <span className="text-[12px] font-semibold text-white">
                  {product.harvestDate || 'Daily Morning Batch'}
                </span>
              </div>
            </div>

            <div className="product-details-card p-3 rounded-xl flex items-start gap-2.5 sm:col-span-2">
              <Thermometer className="w-4 h-4 text-[#f59e0b] mt-0.5 shrink-0" />
              <div>
                <span className="text-[11px] text-slate-400 font-medium block">
                  {t('coldChainStandard')}
                </span>
                <span className="text-[12px] font-semibold text-white">
                  {product.tempRequirement || 'Strict Cold Chain 4°C'}
                </span>
              </div>
            </div>
          </div>

          {product.nutrition && (
            <div className="product-details-card p-3 rounded-xl text-[12px]">
              <span className="font-semibold text-white block mb-0.5">
                {t('nutritionalProfile')}
              </span>
              <span className="text-slate-300">{product.nutrition}</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="product-details-footer p-4 sm:p-5 flex items-center justify-between gap-3 sm:gap-4 shrink-0">
          <div className="product-details-qty flex items-center rounded-xl p-1">
            <button
              type="button"
              disabled={qty <= 1}
              onClick={() => qty > 1 && setQty(qty - 1)}
              aria-label="Decrease quantity"
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 text-white transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center text-[14px] font-bold text-white tabular-nums">
              {qty}
            </span>
            <button
              type="button"
              disabled={qty >= currentMaxStock || isOutOfStock}
              onClick={() => qty < currentMaxStock && setQty(qty + 1)}
              aria-label="Increase quantity"
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 text-white transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            id="product-add-to-cart-btn"
            disabled={isOutOfStock}
            onClick={handleOpenPackSizePopup}
            className={`flex-1 py-3 px-4 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 shadow-lg transition-all duration-200 ${
              isOutOfStock
                ? 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed'
                : added
                ? 'bg-[#059669] text-white shadow-emerald-950/40'
                : 'bg-[#00873a] text-white hover:bg-[#00a346] hover:-translate-y-0.5 hover:shadow-emerald-950/40 hover:brightness-105 active:translate-y-0 active:scale-98 cursor-pointer'
            }`}
          >
            {added ? (
              <>
                <Check className="w-4 h-4 text-[#7ffc97]" />
                <span>{t('addedToLiveCart')}</span>
              </>
            ) : isOutOfStock ? (
              <span>{t('unavailable')}</span>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                <span>
                  {t('addToCartTotal', {
                    qty,
                    price: formatINR(selectedPackSize.price * qty),
                  })}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Pack Size Selection Modal Portal */}
      <PackSizeModal
        product={product}
        isOpen={showPackSizePopup}
        initialQty={qty}
        initialPackSize={selectedPackSize.size}
        onClose={() => setShowPackSizePopup(false)}
        onConfirm={handleConfirmFromPopup}
      />
    </div>
  );
};
