import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Product, PackSizeOption } from '../types';
import { getProductPackSizes } from '../utils/packSize';
import { formatINR } from '../utils/currency';
import { useLanguage } from '../context/LanguageContext';
import { X, Plus, Minus, ShoppingCart, Check, Scale } from 'lucide-react';

interface PackSizeModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    product: Product,
    quantity: number,
    selectedPackSize: string,
    selectedPrice: number
  ) => void;
  initialQty?: number;
  initialPackSize?: string;
}

export const PackSizeModal: React.FC<PackSizeModalProps> = ({
  product,
  isOpen,
  onClose,
  onConfirm,
  initialQty = 1,
  initialPackSize,
}) => {
  const { t } = useLanguage();

  if (!isOpen || !product) return null;

  const packSizes = getProductPackSizes(product);
  const isOutOfStock = product.stock <= 0;

  // Find default selected pack size (match initialPackSize, product unit or first available)
  const defaultPackSize =
    (initialPackSize &&
      packSizes.find((ps) => ps.size.toLowerCase() === initialPackSize.toLowerCase())) ||
    packSizes.find((ps) => ps.size.toLowerCase() === product.unit.toLowerCase()) ||
    packSizes[0] || { size: product.unit, price: product.price };

  const [selectedPackSize, setSelectedPackSize] = useState<PackSizeOption>(defaultPackSize);
  const [qty, setQty] = useState<number>(() => Math.max(1, Math.min(initialQty, Math.max(1, product.stock))));
  const [added, setAdded] = useState(false);

  // Sync state when product, initialQty or initialPackSize changes
  useEffect(() => {
    const defaultPs =
      (initialPackSize &&
        packSizes.find((ps) => ps.size.toLowerCase() === initialPackSize.toLowerCase())) ||
      packSizes.find((ps) => ps.size.toLowerCase() === product.unit.toLowerCase()) ||
      packSizes[0] || { size: product.unit, price: product.price };
    setSelectedPackSize(defaultPs);
    setQty(Math.max(1, Math.min(initialQty, Math.max(1, product.stock))));
    setAdded(false);
  }, [product, initialQty, initialPackSize]);

  // Handle ESC key to dismiss without adding
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Lock body scroll while modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const totalPrice = selectedPackSize.price * qty;
  const isAtMaxStock = qty >= product.stock;

  const handleConfirm = () => {
    if (isOutOfStock) return;
    setAdded(true);
    onConfirm(product, qty, selectedPackSize.size, selectedPackSize.price);
    setTimeout(() => {
      setAdded(false);
      onClose();
    }, 400);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const modalContent = (
    <div
      id="pack-size-backdrop"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
    >
      <div
        id="pack-size-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pack-size-modal-title"
        className="relative w-full max-w-md rounded-3xl bg-[#070c14] border border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.85)] overflow-hidden text-white flex flex-col my-auto animate-in zoom-in-95 duration-200"
      >
        {/* Header with Product Summary */}
        <div className="relative p-4 sm:p-5 pb-3 border-b border-white/10 flex items-start justify-between gap-3 bg-gradient-to-b from-white/[0.04] to-transparent">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src={product.image}
              alt={product.title}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border border-white/10 bg-slate-900 shrink-0 shadow-md"
            />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full inline-block mb-1">
                {product.badge || t('farmOrigin')}
              </span>
              <h2
                id="pack-size-modal-title"
                className="text-base sm:text-lg font-bold text-white truncate font-display"
              >
                {product.title}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('selectPackSize') || 'Select pack size and quantity'}
              </p>
            </div>
          </div>

          {/* Close button (Cancels without adding) */}
          <button
            type="button"
            id="pack-size-close-btn"
            onClick={onClose}
            aria-label="Close pack size popup without adding"
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Pack Size Options */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('selectPackSize') || 'Available Pack Sizes'}</span>
              </label>
              <span className="text-[11px] text-slate-400">
                {packSizes.length} {packSizes.length === 1 ? 'size' : 'sizes'} available
              </span>
            </div>

            <div
              id="pack-size-options-container"
              className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1"
            >
              {packSizes.map((ps) => {
                const isSelected = selectedPackSize.size === ps.size;
                const sizeSlug = ps.size.toLowerCase().replace(/[^a-z0-9]+/g, '-');

                return (
                  <button
                    key={ps.size}
                    type="button"
                    id={`pack-size-opt-${sizeSlug}`}
                    data-size={ps.size}
                    data-price={ps.price}
                    onClick={() => setSelectedPackSize(ps)}
                    className={`relative p-3 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex items-center justify-between gap-2.5 ${
                      isSelected
                        ? 'border-emerald-400 bg-emerald-500/15 ring-2 ring-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.18)]'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06] text-slate-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-sm font-bold ${
                            isSelected ? 'text-white' : 'text-slate-200'
                          }`}
                        >
                          {ps.size}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-emerald-400 mt-0.5 block tabular-nums">
                        {formatINR(ps.price)}
                      </span>
                    </div>

                    {/* Radio Check Indicator */}
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                        isSelected
                          ? 'border-emerald-400 bg-emerald-500 text-white shadow-xs'
                          : 'border-white/20 bg-transparent'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity Stepper & Stock Availability */}
          <div
            id="pack-size-qty-container"
            className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-3"
          >
            <div>
              <span className="text-xs font-semibold text-slate-300 block">
                {t('availableQuantity') || 'Quantity'}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                {isOutOfStock
                  ? t('unavailable')
                  : `${t('availableStock', { stock: product.stock })} (${product.unit})`}
              </span>
            </div>

            <div className="flex items-center bg-white/5 rounded-xl border border-white/10 p-1">
              <button
                type="button"
                id="pack-size-qty-minus"
                title="Decrease quantity"
                disabled={qty <= 1 || isOutOfStock}
                onClick={() => qty > 1 && setQty(qty - 1)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span
                id="pack-size-qty-display"
                className="w-9 text-center text-sm font-bold text-white tabular-nums"
              >
                {qty}
              </span>
              <button
                type="button"
                id="pack-size-qty-plus"
                title="Increase quantity"
                disabled={qty >= product.stock || isOutOfStock}
                onClick={() => qty < product.stock && setQty(qty + 1)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {isAtMaxStock && !isOutOfStock && (
            <p className="text-[11px] text-amber-400 font-medium px-1">
              Max available stock reached ({product.stock} {product.unit})
            </p>
          )}

          {/* Pricing Calculation Summary */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/20 flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium">
              {qty} × {selectedPackSize.size} @ {formatINR(selectedPackSize.price)}
            </span>
            <div className="text-right">
              <span className="text-[11px] text-slate-400 block">Total Price:</span>
              <span
                id="pack-size-total-price"
                className="text-base font-bold text-emerald-400 tabular-nums font-display"
              >
                {formatINR(totalPrice)}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer Confirmation */}
        <div
          id="pack-size-footer"
          className="p-4 sm:p-5 pt-3 border-t border-white/10 flex items-center gap-3 bg-gradient-to-t from-white/[0.04] to-transparent"
        >
          <button
            type="button"
            id="pack-size-cancel-btn"
            onClick={onClose}
            className="py-3 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            id="confirm-add-to-basket-btn"
            disabled={isOutOfStock}
            onClick={handleConfirm}
            className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-lg transition-all duration-200 cursor-pointer ${
              isOutOfStock
                ? 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed'
                : added
                ? 'bg-[#059669] text-white shadow-emerald-950/40'
                : 'bg-[#00873a] hover:bg-[#00a347] text-white shadow-emerald-950/40 hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 active:scale-98'
            }`}
          >
            {added ? (
              <>
                <Check className="w-4 h-4 text-[#7ffc97]" />
                <span>{t('addedToLiveCart') || 'Added to Basket!'}</span>
              </>
            ) : isOutOfStock ? (
              <span>{t('unavailable')}</span>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                <span>
                  {t('addToBasketTotal', { price: formatINR(totalPrice) }) ||
                    `Add to Basket · ${formatINR(totalPrice)}`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
