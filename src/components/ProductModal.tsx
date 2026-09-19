import React, { useState } from 'react';
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
  ShieldCheck,
  Award,
} from 'lucide-react';

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
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  if (!product) return null;

  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock >= 1 && product.stock <= 10;
  const effectiveQty = isOutOfStock ? 0 : Math.min(qty, product.stock);

  const handleAdd = () => {
    if (isOutOfStock || effectiveQty <= 0) return;
    onAddToCart(product, effectiveQty);
    setAdded(true);
    setTimeout(() => {
      setAdded(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1c30]/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-[#e2e8f0] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="relative h-64 w-full bg-[#eff4ff] overflow-hidden shrink-0">
          <img
            src={product.image}
            alt={product.title}
            className={`w-full h-full object-cover ${isOutOfStock ? 'grayscale' : ''}`}
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-[#0b1c30] hover:bg-white shadow-md transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
            <span className="px-2.5 py-1 rounded-full bg-[#006b2c] text-white text-[11px] font-bold shadow-xs">
              {product.badge}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-white/90 text-[#0b1c30] text-[11px] font-semibold backdrop-blur-xs shadow-xs">
              {product.sku}
            </span>
            {/* Stock status indicator pill */}
            {isOutOfStock ? (
              <span className="px-2.5 py-1 rounded-full bg-[#ffdad6] text-[#ba1a1a] text-[11px] font-bold shadow-xs">
                Out of Stock (0 {product.unit})
              </span>
            ) : isLowStock ? (
              <span className="px-2.5 py-1 rounded-full bg-[#ffddb8] text-[#825100] text-[11px] font-bold shadow-xs">
                Low Stock ({product.stock} {product.unit} left)
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-[#dcfce7] text-[#166534] text-[11px] font-bold shadow-xs">
                In Stock ({product.stock} {product.unit} available)
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          <div className="flex justify-between items-start gap-4">
            <div>
              <span className="text-[12px] text-[#565e74] font-medium">
                {product.supplier} · {product.categoryLabel}
              </span>
              <h2 className="text-[20px] sm:text-[22px] font-bold text-[#0b1c30] font-display mt-0.5">
                {product.title}
              </h2>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[24px] font-extrabold text-[#006b2c] font-display tabular-nums">
                {formatINR(product.price)}
              </span>
              <span className="text-[12px] text-[#565e74] block">
                / {product.unit}
              </span>
            </div>
          </div>

          <p className="text-[14px] text-[#3e4a3d] leading-relaxed font-body">
            {product.description}
          </p>

          {/* Farm Quality & Stock Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
            <div className="bg-[#eff4ff]/60 p-3 rounded-xl border border-[#e2e8f0]/60 flex items-start gap-2.5">
              <Award className="w-4 h-4 text-[#006b2c] mt-0.5 shrink-0" />
              <div>
                <span className="text-[11px] text-[#565e74] font-medium block">
                  Farm Origin
                </span>
                <span className="text-[12px] font-semibold text-[#0b1c30]">
                  {product.farmOrigin || 'Verde Valley Organic Co-Op'}
                </span>
              </div>
            </div>

            <div className="bg-[#eff4ff]/60 p-3 rounded-xl border border-[#e2e8f0]/60 flex items-start gap-2.5">
              <Calendar className="w-4 h-4 text-[#006b2c] mt-0.5 shrink-0" />
              <div>
                <span className="text-[11px] text-[#565e74] font-medium block">
                  Harvested / Baked
                </span>
                <span className="text-[12px] font-semibold text-[#0b1c30]">
                  {product.harvestDate || 'Daily Morning Batch'}
                </span>
              </div>
            </div>

            <div className="bg-[#eff4ff]/60 p-3 rounded-xl border border-[#e2e8f0]/60 flex items-start gap-2.5">
              <Thermometer className="w-4 h-4 text-[#825100] mt-0.5 shrink-0" />
              <div>
                <span className="text-[11px] text-[#565e74] font-medium block">
                  Cold-Chain Standard
                </span>
                <span className="text-[12px] font-semibold text-[#0b1c30]">
                  {product.tempRequirement || 'Strict Cold Chain 4°C'}
                </span>
              </div>
            </div>

            <div className="bg-[#eff4ff]/60 p-3 rounded-xl border border-[#e2e8f0]/60 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#006b2c] mt-0.5 shrink-0" />
              <div>
                <span className="text-[11px] text-[#565e74] font-medium block">
                  Live Available Stock
                </span>
                <span className="text-[12px] font-semibold text-[#0b1c30]">
                  {product.stock > 0
                    ? `${product.stock} ${product.unit} available in Pod #104`
                    : 'Currently out of inventory'}
                </span>
              </div>
            </div>
          </div>

          {product.nutrition && (
            <div className="bg-[#f8fafc] p-3 rounded-xl border border-[#e2e8f0] text-[12px]">
              <span className="font-semibold text-[#0b1c30] block mb-0.5">
                Nutritional Profile:
              </span>
              <span className="text-[#565e74]">{product.nutrition}</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 sm:p-5 border-t border-[#e5eeff] bg-white flex items-center justify-between gap-4">
          <div className="flex items-center bg-[#eff4ff] rounded-xl p-1 border border-[#e2e8f0]">
            <button
              type="button"
              disabled={effectiveQty <= 1 || isOutOfStock}
              onClick={() => qty > 1 && setQty(qty - 1)}
              className={`w-9 h-9 flex items-center justify-center rounded-lg text-[#0b1c30] transition-colors ${
                effectiveQty <= 1 || isOutOfStock
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:bg-[#e5eeff] cursor-pointer'
              }`}
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center text-[14px] font-bold text-[#0b1c30] tabular-nums">
              {effectiveQty}
            </span>
            <button
              type="button"
              disabled={effectiveQty >= product.stock || isOutOfStock}
              onClick={() => qty < product.stock && setQty(qty + 1)}
              className={`w-9 h-9 flex items-center justify-center rounded-lg text-[#0b1c30] transition-colors ${
                effectiveQty >= product.stock || isOutOfStock
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:bg-[#e5eeff] cursor-pointer'
              }`}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            disabled={isOutOfStock || effectiveQty <= 0}
            onClick={handleAdd}
            className={`flex-1 py-3 px-4 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 shadow-md transition-all ${
              isOutOfStock
                ? 'bg-[#cbd5e1] text-[#64748b] cursor-not-allowed'
                : added
                ? 'bg-[#15803d] text-white'
                : 'bg-[#006b2c] text-white hover:bg-[#00873a] cursor-pointer'
            }`}
          >
            {added ? (
              <>
                <Check className="w-4 h-4 text-[#7ffc97]" />
                <span>Added to Live Cart</span>
              </>
            ) : isOutOfStock ? (
              <span>Out of Stock</span>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                <span>Add {effectiveQty} to Cart · {formatINR(product.price * effectiveQty)}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
