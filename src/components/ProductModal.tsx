import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { formatINR } from '../utils/currency';
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

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  onClose,
  onAddToCart,
}) => {
  const { t } = useLanguage();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  // Reset quantity and state when product changes
  useEffect(() => {
    if (product) {
      setQty(1);
      setAdded(false);
    }
  }, [product]);

  // Lock background body scroll and listen for Escape key
  useEffect(() => {
    if (!product) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [product, onClose]);

  if (!product) return null;

  const isOutOfStock = product.stock <= 0;

  const handleAdd = () => {
    if (isOutOfStock) return;
    onAddToCart(product, Math.min(qty, product.stock));
    setAdded(true);
    setTimeout(() => {
      setAdded(false);
      onClose();
    }, 900);
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
                  <span className="font-semibold text-white">{product.unit}</span>
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[24px] sm:text-[26px] font-extrabold text-[#00c978] font-display tabular-nums">
                {formatINR(product.price)}
              </span>
              <span className="text-[12px] text-slate-400 block">
                / {product.unit}
              </span>
            </div>
          </div>

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
              disabled={qty >= product.stock}
              onClick={() => qty < product.stock && setQty(qty + 1)}
              aria-label="Increase quantity"
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 text-white transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            disabled={isOutOfStock}
            onClick={handleAdd}
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
                <span>{t('addToCartTotal', { qty, price: formatINR(product.price * qty) })}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
