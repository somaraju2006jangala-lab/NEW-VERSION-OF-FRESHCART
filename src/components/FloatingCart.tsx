import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { CartItem } from '../types';

interface FloatingCartProps {
  cart?: CartItem[];
  cartCount?: number;
  onNavigateToCart: () => void;
  visible?: boolean;
}

export const FloatingCart: React.FC<FloatingCartProps> = ({
  cart = [],
  cartCount,
  onNavigateToCart,
  visible = true,
}) => {
  const { t } = useLanguage();

  if (!visible) return null;

  // Base enabled/disabled state directly on actual cart contents
  const actualItemCount = Array.isArray(cart) && cart.length > 0
    ? cart.reduce((sum, item) => sum + (Math.max(0, Number(item?.quantity)) || 0), 0)
    : (Number(cartCount) || 0);

  const hasItems = Array.isArray(cart) && cart.length > 0
    ? cart.some((item) => item?.product && Number(item.quantity) > 0)
    : (Number(cartCount) || 0) > 0;

  const isEmpty = !hasItems || actualItemCount <= 0;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isEmpty) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onNavigateToCart();
  };

  return (
    <div
      id="cart-drawer-toggle"
      className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 pointer-events-auto"
    >
      <button
        id="floating-cart-btn"
        type="button"
        disabled={isEmpty}
        aria-disabled={isEmpty}
        onClick={handleClick}
        aria-label={
          isEmpty
            ? (t('emptyCartTitle') || 'Your Cart is Empty')
            : `${t('cart')} (${actualItemCount})`
        }
        title={
          isEmpty
            ? (t('emptyCartTitle') || 'Your Cart is Empty')
            : `${t('cart')} (${actualItemCount})`
        }
        className={`relative flex items-center justify-center p-3.5 sm:p-4 rounded-2xl select-none transition-all ${
          isEmpty
            ? 'bg-slate-900/80 text-slate-500 border border-white/10 shadow-lg backdrop-blur-md opacity-50 cursor-not-allowed'
            : 'bg-[#006b2c] text-white border border-white/40 cart-floating-glow shadow-2xl active:scale-95 cursor-pointer hover:scale-105'
        }`}
      >
        <ShoppingCart
          className={`w-6 h-6 transition-colors ${
            isEmpty ? 'text-slate-500' : 'text-white'
          }`}
        />
        {!isEmpty && actualItemCount > 0 && (
          <span
            id="floating-cart-badge"
            className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-[#ba1a1a] text-white rounded-full text-[11px] font-bold ring-2 ring-white shadow-xs animate-in zoom-in-75 duration-150"
          >
            {actualItemCount}
          </span>
        )}
      </button>
    </div>
  );
};

export default FloatingCart;
