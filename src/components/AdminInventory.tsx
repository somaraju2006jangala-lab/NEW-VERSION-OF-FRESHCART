import React, { useState } from 'react';
import { Product } from '../types';
import { ProductFormModal } from './ProductFormModal';
import { formatINR } from '../utils/currency';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle,
  Edit2,
  Trash2,
  Filter,
  Check,
  X,
  Layers,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';

interface AdminInventoryProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onUpdateProductStock: (productId: string, newStock: number, reason: string) => void;
  onUpdateProductPrice: (productId: string, newPrice: number) => void;
}

export const AdminInventory: React.FC<AdminInventoryProps> = ({
  products,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onUpdateProductStock,
  onUpdateProductPrice,
}) => {
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'inStock' | 'low' | 'out'>('all');

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Inline Direct Stock Editing State (Direct Quantity Edit)
  const [editingDirectStockId, setEditingDirectStockId] = useState<string | null>(null);
  const [tempDirectStock, setTempDirectStock] = useState<number>(0);

  // Inline Quick Stock Adjustment State
  const [adjustingStockId, setAdjustingStockId] = useState<string | null>(null);
  const [adjustStockDelta, setAdjustStockDelta] = useState<number>(10);

  // Inline Quick Price Edit State
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<number>(0);

  // Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // KPI Calculations based on required specifications:
  // - Total Products: unique product count
  // - Total Stock Units: sum of all available units
  // - Low Stock Products: quantity 1–10
  // - Out of Stock Products: quantity = 0
  const totalProducts = products.length;
  const totalStockUnits = products.reduce((sum, p) => sum + p.stock, 0);
  const lowStockCount = products.filter((p) => p.stock >= 1 && p.stock <= 10).length;
  const outOfStockCount = products.filter((p) => p.stock === 0).length;
  const inStockCount = products.filter((p) => p.stock > 10).length;

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      searchTerm === '' ||
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.categoryLabel.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      selectedCategory === 'all' || p.category === selectedCategory;

    const matchesStock =
      stockFilter === 'all' ||
      (stockFilter === 'inStock' && p.stock > 10) ||
      (stockFilter === 'low' && p.stock >= 1 && p.stock <= 10) ||
      (stockFilter === 'out' && p.stock === 0);

    return matchesSearch && matchesCategory && matchesStock;
  });

  // Action handlers
  const handleOpenAdd = () => {
    setProductToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setProductToEdit(product);
    setIsFormModalOpen(true);
  };

  const handleSaveProduct = (productData: Product) => {
    if (productToEdit) {
      onEditProduct(productData);
      showToast(`Successfully updated "${productData.title}"`);
    } else {
      onAddProduct(productData);
      showToast(`Successfully added "${productData.title}" to catalog`);
    }
  };

  const handleConfirmDelete = () => {
    if (!productToDelete) return;
    const title = productToDelete.title;
    onDeleteProduct(productToDelete.id);
    setProductToDelete(null);
    showToast(`Removed "${title}" from inventory & storefront`);
  };

  const handleStockIncrement = (product: Product, delta: number) => {
    const newStock = Math.max(0, product.stock + delta);
    const reason =
      delta > 0
        ? `Manual Stock Inbound (+${delta})`
        : `Manual Stock Reduction (${delta})`;
    onUpdateProductStock(product.id, newStock, reason);
  };

  const handleStartDirectStock = (product: Product) => {
    setEditingDirectStockId(product.id);
    setTempDirectStock(product.stock);
  };

  const handleSaveDirectStock = (productId: string) => {
    const safeStock = Math.max(0, tempDirectStock);
    onUpdateProductStock(
      productId,
      safeStock,
      `Direct Quantity Override (Set to ${safeStock})`
    );
    setEditingDirectStockId(null);
    showToast(`Updated stock quantity to ${safeStock}`);
  };

  const handleApplyCustomStock = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    const newStock = Math.max(0, prod.stock + adjustStockDelta);
    onUpdateProductStock(
      productId,
      newStock,
      `Manual Stock Adjustment (${adjustStockDelta >= 0 ? '+' : ''}${adjustStockDelta})`
    );
    setAdjustingStockId(null);
  };

  const handleStartEditPrice = (product: Product) => {
    setEditingPriceId(product.id);
    setTempPrice(product.price);
  };

  const handleSavePrice = (productId: string) => {
    if (tempPrice > 0) {
      onUpdateProductPrice(productId, tempPrice);
      showToast(`Updated product price to ${formatINR(tempPrice)}`);
    }
    setEditingPriceId(null);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 animate-in slide-in-from-top-4 fade-in duration-200">
          <div className="bg-[#15803d] text-white px-4 py-2.5 rounded-xl shadow-lg text-[13px] font-semibold flex items-center gap-2 border border-[#86efac]/40">
            <CheckCircle className="w-4 h-4 text-[#86efac]" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Admin Inventory Dashboard KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Products */}
        <button
          type="button"
          onClick={() => setStockFilter('all')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            stockFilter === 'all'
              ? 'bg-[#eff4ff] border-[#006b2c] ring-2 ring-[#006b2c]/20 shadow-xs'
              : 'bg-white border-[#e2e8f0] hover:bg-[#f8fafc]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#64748b]">Total Products</span>
            <Package className="w-4 h-4 text-[#006b2c]" />
          </div>
          <span className="text-[26px] font-extrabold text-[#0f172a] font-display block mt-1 tabular-nums">
            {totalProducts}
          </span>
          <span className="text-[11px] text-[#006b2c] font-semibold flex items-center gap-1 mt-0.5">
            Active in catalog
          </span>
        </button>

        {/* Card 2: Total Stock Units */}
        <div
          className="p-4 rounded-xl border bg-white border-[#e2e8f0] text-left shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#64748b]">Total Stock Units</span>
            <Layers className="w-4 h-4 text-[#006b2c]" />
          </div>
          <span className="text-[26px] font-extrabold text-[#006b2c] font-display block mt-1 tabular-nums">
            {totalStockUnits.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-[#565e74] font-medium mt-0.5 block">
            {inStockCount} In Stock (&gt;10 units)
          </span>
        </div>

        {/* Card 3: Low Stock Products */}
        <button
          type="button"
          onClick={() => setStockFilter('low')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            stockFilter === 'low'
              ? 'bg-[#fef3c7]/60 border-[#b45309] ring-2 ring-[#b45309]/20 shadow-xs'
              : 'bg-white border-[#e2e8f0] hover:bg-[#f8fafc]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#64748b]">Low Stock Products</span>
            <AlertTriangle className="w-4 h-4 text-[#b45309]" />
          </div>
          <span className="text-[26px] font-extrabold text-[#b45309] font-display block mt-1 tabular-nums">
            {lowStockCount}
          </span>
          <span className="text-[11px] text-[#b45309] font-semibold mt-0.5 block">
            Quantity 1–10 units
          </span>
        </button>

        {/* Card 4: Out of Stock Products */}
        <button
          type="button"
          onClick={() => setStockFilter('out')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            stockFilter === 'out'
              ? 'bg-[#fee2e2]/60 border-[#dc2626] ring-2 ring-[#dc2626]/20 shadow-xs'
              : 'bg-white border-[#e2e8f0] hover:bg-[#f8fafc]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-[#64748b]">Out of Stock Products</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
          </div>
          <span className="text-[26px] font-extrabold text-[#dc2626] font-display block mt-1 tabular-nums">
            {outOfStockCount}
          </span>
          <span className="text-[11px] text-[#dc2626] font-semibold mt-0.5 block">
            Quantity = 0 units
          </span>
        </button>
      </div>

      {/* Low / Out-of-Stock Alert Notification Banner */}
      {(lowStockCount > 0 || outOfStockCount > 0) && stockFilter === 'all' && (
        <div className="bg-[#fffbeb] border border-[#fde68a] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#fef3c7] text-[#b45309] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-[#92400e]">
                Inventory Restock Recommended: {outOfStockCount} Out of Stock, {lowStockCount} Low Stock
              </p>
              <p className="text-[11px] text-[#b45309]">
                Store #104 picking runners may face shortages. Use the quick restock controls below to update quantities.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {outOfStockCount > 0 && (
              <button
                type="button"
                onClick={() => setStockFilter('out')}
                className="px-3 py-1.5 bg-[#fee2e2] hover:bg-[#fecaca] text-[#991b1b] rounded-lg text-[12px] font-semibold transition-colors cursor-pointer"
              >
                View Out of Stock ({outOfStockCount})
              </button>
            )}
            {lowStockCount > 0 && (
              <button
                type="button"
                onClick={() => setStockFilter('low')}
                className="px-3 py-1.5 bg-[#fef3c7] hover:bg-[#fde68a] text-[#92400e] rounded-lg text-[12px] font-semibold transition-colors cursor-pointer"
              >
                View Low Stock ({lowStockCount})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Action Toolbar & Search */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#94a3b8]" />
            <input
              type="text"
              id="admin-inventory-search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search product title, SKU code, or supplier..."
              className="w-full pl-9 pr-8 py-2 text-[13px] border border-[#cbd5e1] rounded-xl bg-[#f8fafc] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#006b2c]/30 focus:border-[#006b2c]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-[#94a3b8] hover:text-[#0f172a]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns & Add Button */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Category Filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[#64748b]" />
              <select
                id="admin-filter-category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 text-[12px] font-medium border border-[#cbd5e1] rounded-xl bg-white text-[#0f172a] focus:ring-2 focus:ring-[#006b2c]/30 cursor-pointer"
              >
                <option value="all">All Aisles</option>
                <option value="produce">Produce &amp; Fruit</option>
                <option value="dairy">Dairy &amp; Eggs</option>
                <option value="bakery">Bakery &amp; Bread</option>
                <option value="beverages">Beverages</option>
                <option value="snacks">Snacks &amp; Pantry</option>
                <option value="grains">Rice &amp; Grains</option>
              </select>
            </div>

            {/* Stock Filter */}
            <select
              id="admin-filter-stock"
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              className="px-3 py-2 text-[12px] font-medium border border-[#cbd5e1] rounded-xl bg-white text-[#0f172a] focus:ring-2 focus:ring-[#006b2c]/30 cursor-pointer"
            >
              <option value="all">All Stock Statuses ({totalProducts})</option>
              <option value="inStock">In Stock (&gt; 10) ({inStockCount})</option>
              <option value="low">Low Stock (1–10) ({lowStockCount})</option>
              <option value="out">Out of Stock (0) ({outOfStockCount})</option>
            </select>

            {/* Reset Filters button if active */}
            {(searchTerm || selectedCategory !== 'all' || stockFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                  setStockFilter('all');
                }}
                className="px-3 py-2 text-[12px] text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] rounded-xl transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}

            {/* Primary Add New Product Button */}
            <button
              type="button"
              id="admin-add-product-btn"
              onClick={handleOpenAdd}
              className="ml-auto px-4 py-2 bg-[#006b2c] hover:bg-[#00873a] text-white rounded-xl text-[13px] font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Product</span>
            </button>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="overflow-x-auto border border-[#e2e8f0] rounded-xl">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="bg-[#f8fafc] text-[#64748b] border-b border-[#e2e8f0] text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Item &amp; Supplier</th>
                <th className="py-3 px-4">SKU / Batch</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Price (₹)</th>
                <th className="py-3 px-4">Current Quantity</th>
                <th className="py-3 px-4">Stock Status</th>
                <th className="py-3 px-4 text-center">Quantity Controls (+ / - / Edit)</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 bg-white">
                    <Package className="w-10 h-10 text-[#94a3b8] mx-auto mb-2 opacity-50" />
                    <p className="text-[14px] font-bold text-[#0f172a]">No products found</p>
                    <p className="text-[12px] text-[#64748b] mt-0.5">
                      Try clearing search filters or click &quot;Add New Product&quot; to create one.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isOut = p.stock === 0;
                  const isLow = p.stock >= 1 && p.stock <= 10;
                  const stockBarPct = Math.min(100, Math.round((p.stock / 30) * 100));

                  return (
                    <tr
                      key={p.id}
                      id={`inventory-row-${p.id}`}
                      className="hover:bg-[#f8fafc]/80 transition-colors group"
                    >
                      {/* Item & Supplier */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.image}
                            alt={p.title}
                            className={`w-11 h-11 rounded-xl object-cover bg-[#f1f5f9] shrink-0 border border-[#e2e8f0] ${
                              isOut ? 'grayscale opacity-75' : ''
                            }`}
                          />
                          <div>
                            <span className="font-bold text-[#0f172a] block hover:text-[#006b2c] transition-colors">
                              {p.title}
                            </span>
                            <span className="text-[11px] text-[#64748b]">
                              {p.supplier || 'Local Supplier'}
                            </span>
                            {p.badge && (
                              <span className="ml-2 inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]">
                                {p.badge}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* SKU / Batch */}
                      <td className="py-3 px-4 font-mono text-[12px] text-[#475569]">
                        <span className="font-semibold text-[#0f172a] block">{p.sku}</span>
                        <span className="text-[10px] text-[#94a3b8]">
                          {p.batchNumber || 'LOT-2026-GEN'}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-[#eff4ff] text-[#006b2c] text-[11px] font-bold border border-[#dce9ff]">
                          {p.categoryLabel}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-3 px-4">
                        {editingPriceId === p.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[#64748b] text-[12px]">₹</span>
                            <input
                              type="number"
                              step="1"
                              value={tempPrice}
                              onChange={(e) => setTempPrice(parseFloat(e.target.value) || 0)}
                              className="w-16 px-1.5 py-0.5 border border-[#cbd5e1] rounded text-[12px] font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => handleSavePrice(p.id)}
                              className="p-1 bg-[#006b2c] text-white rounded hover:bg-[#00873a] cursor-pointer"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartEditPrice(p)}
                            title="Click to edit price"
                            className="flex items-center gap-1 font-semibold text-[#0f172a] hover:text-[#006b2c] tabular-nums font-display group/edit cursor-pointer"
                          >
                            <span className="text-[14px] font-bold">{formatINR(p.price)}</span>
                            <span className="text-[11px] text-[#64748b]">/ {p.unit}</span>
                            <Edit2 className="w-3 h-3 opacity-0 group-hover/edit:opacity-100 text-[#94a3b8]" />
                          </button>
                        )}
                      </td>

                      {/* Current Quantity Display with Unit and Min Stock */}
                      <td className="py-3 px-4">
                        <div className="w-32 space-y-1">
                          <div className="flex justify-between items-center text-[12px] font-bold tabular-nums">
                            <span
                              className={
                                isOut
                                  ? 'text-[#ef4444]'
                                  : isLow
                                  ? 'text-[#b45309]'
                                  : 'text-[#16a34a]'
                              }
                            >
                              {p.stock} {p.unit}
                            </span>
                            {p.minStockLevel !== undefined && (
                              <span className="text-[10px] text-[#94a3b8] font-normal">
                                Min: {p.minStockLevel} {p.unit}
                              </span>
                            )}
                          </div>
                          {/* Mini visual indicator */}
                          <div className="w-full h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isOut
                                  ? 'bg-[#ef4444] w-0'
                                  : isLow
                                  ? 'bg-[#f59e0b]'
                                  : 'bg-[#16a34a]'
                              }`}
                              style={{ width: isOut ? '0%' : `${stockBarPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Stock Status Badge (quantity > 10 = In Stock, 1-10 = Low Stock, 0 = Out of Stock) */}
                      <td className="py-3 px-4">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#fee2e2] text-[#991b1b] text-[11px] font-bold border border-[#fecaca]">
                            <span className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse" />
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#fef3c7] text-[#92400e] text-[11px] font-bold border border-[#fde68a]">
                            <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                            Low Stock ({p.stock} left)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#dcfce7] text-[#166534] text-[11px] font-bold border border-[#bbf7d0]">
                            <span className="w-2 h-2 rounded-full bg-[#16a34a]" />
                            In Stock
                          </span>
                        )}
                      </td>

                      {/* Inventory Controls: Increase (+), Decrease (-), Direct Edit */}
                      <td className="py-3 px-4 text-center">
                        {editingDirectStockId === p.id ? (
                          <div className="inline-flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-lg border border-[#006b2c] shadow-xs">
                            <input
                              type="number"
                              min="0"
                              value={tempDirectStock}
                              onChange={(e) =>
                                setTempDirectStock(
                                  Math.max(0, parseInt(e.target.value, 10) || 0)
                                )
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveDirectStock(p.id);
                                if (e.key === 'Escape') setEditingDirectStockId(null);
                              }}
                              className="w-16 px-1.5 py-0.5 text-[12px] font-bold text-center font-mono border border-[#cbd5e1] rounded bg-white"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveDirectStock(p.id)}
                              title="Save Quantity"
                              className="p-1 bg-[#006b2c] hover:bg-[#00873a] text-white rounded cursor-pointer transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingDirectStockId(null)}
                              title="Cancel"
                              className="p-1 text-[#64748b] hover:text-[#0f172a] rounded cursor-pointer transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : adjustingStockId === p.id ? (
                          <div className="inline-flex items-center gap-1.5 bg-[#f1f5f9] p-1 rounded-lg border border-[#cbd5e1]">
                            <span className="text-[11px] text-[#64748b]">Add:</span>
                            <input
                              type="number"
                              value={adjustStockDelta}
                              onChange={(e) => setAdjustStockDelta(parseInt(e.target.value, 10) || 0)}
                              className="w-14 px-1.5 py-0.5 text-[12px] bg-white border border-[#cbd5e1] rounded font-mono tabular-nums text-center"
                            />
                            <button
                              type="button"
                              onClick={() => handleApplyCustomStock(p.id)}
                              className="px-2 py-0.5 bg-[#006b2c] hover:bg-[#00873a] text-white text-[11px] font-bold rounded cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setAdjustingStockId(null)}
                              className="text-[#64748b] hover:text-[#0f172a] px-1 cursor-pointer"
                            >
                              &times;
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 justify-center">
                            {/* 1. Decrease Product Quantity using - Button */}
                            <button
                              type="button"
                              id={`decrease-stock-${p.id}`}
                              title="Decrease quantity by 1 (-)"
                              disabled={p.stock <= 0}
                              onClick={() => handleStockIncrement(p, -1)}
                              className={`w-7 h-7 rounded-lg text-[13px] font-bold flex items-center justify-center transition-all cursor-pointer ${
                                p.stock <= 0
                                  ? 'bg-[#f1f5f9] text-[#cbd5e1] cursor-not-allowed'
                                  : 'bg-[#f1f5f9] hover:bg-[#fee2e2] hover:text-[#dc2626] text-[#475569] active:scale-95'
                              }`}
                            >
                              -
                            </button>

                            {/* 3. Directly Edit Quantity Button */}
                            <button
                              type="button"
                              id={`direct-edit-stock-${p.id}`}
                              onClick={() => handleStartDirectStock(p)}
                              title="Click to directly edit quantity"
                              className="px-2 py-1 bg-white hover:bg-[#eff4ff] text-[#0f172a] hover:text-[#006b2c] border border-[#cbd5e1] hover:border-[#006b2c] rounded-lg text-[12px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs group/btn"
                            >
                              <span className="font-mono tabular-nums">{p.stock}</span>
                              <Edit2 className="w-3 h-3 text-[#94a3b8] group-hover/btn:text-[#006b2c]" />
                            </button>

                            {/* 1. Increase Product Quantity using + Button */}
                            <button
                              type="button"
                              id={`increase-stock-${p.id}`}
                              title="Increase quantity by 1 (+)"
                              onClick={() => handleStockIncrement(p, 1)}
                              className="w-7 h-7 rounded-lg bg-[#eff4ff] hover:bg-[#dcfce7] text-[#006b2c] hover:text-[#15803d] text-[13px] font-bold flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                            >
                              +
                            </button>

                            {/* Quick Restock (+10) */}
                            <button
                              type="button"
                              id={`restock-10-${p.id}`}
                              title="Quick Restock +10 units"
                              onClick={() => handleStockIncrement(p, 10)}
                              className="px-1.5 h-7 rounded-lg bg-[#dcfce7] hover:bg-[#bbf7d0] text-[#15803d] text-[10px] font-bold flex items-center justify-center transition-colors cursor-pointer"
                            >
                              +10
                            </button>

                            {/* Custom delta popover */}
                            <button
                              type="button"
                              title="Custom amount adjustment"
                              onClick={() => {
                                setAdjustingStockId(p.id);
                                setAdjustStockDelta(15);
                              }}
                              className="w-6 h-7 rounded-lg bg-[#f8fafc] hover:bg-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] text-[11px] font-semibold flex items-center justify-center border border-[#cbd5e1] cursor-pointer"
                            >
                              <ArrowUpDown className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Row Actions: Edit & Delete */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            id={`edit-product-${p.id}`}
                            onClick={() => handleOpenEdit(p)}
                            title="Edit Product Details"
                            className="p-1.5 rounded-lg bg-[#eff4ff] hover:bg-[#dce9ff] text-[#006b2c] transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            id={`delete-product-${p.id}`}
                            onClick={() => setProductToDelete(p)}
                            title="Delete Product"
                            className="p-1.5 rounded-lg bg-[#fee2e2]/60 hover:bg-[#fee2e2] text-[#dc2626] transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info showing filtered SKU counts */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-[12px] text-[#64748b] pt-2 gap-2">
          <span>
            Showing <strong className="text-[#0f172a]">{filteredProducts.length}</strong> of{' '}
            <strong className="text-[#0f172a]">{totalCount}</strong> total items
          </span>
          <span className="flex items-center gap-1 text-[11px] text-[#006b2c] font-semibold">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Storefront catalog in live two-way sync</span>
          </span>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      <ProductFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setProductToEdit(null);
        }}
        onSave={handleSaveProduct}
        productToEdit={productToEdit}
      />

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b1c30]/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-[#cbd5e1] space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#fee2e2] text-[#dc2626] flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-[17px] font-bold text-[#0f172a] font-display">
                Delete &quot;{productToDelete.title}&quot;?
              </h3>
              <p className="text-[13px] text-[#64748b] mt-1 leading-relaxed">
                Are you sure you want to delete this product ({productToDelete.sku})? This will immediately remove it from the customer storefront and remove any active cart selections.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="px-4 py-2 text-[13px] font-semibold text-[#64748b] hover:text-[#0f172a] rounded-xl hover:bg-[#f1f5f9] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-product-btn"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-[13px] font-bold text-white bg-[#dc2626] hover:bg-[#b91c1c] rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
