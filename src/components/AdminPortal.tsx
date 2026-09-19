import React, { useState } from 'react';
import { Product, InventoryLog } from '../types';
import { USER_AVATAR_URL } from '../data/products';
import { AdminInventory } from './AdminInventory';
import {
  Package,
  Thermometer,
  Users,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  History,
  Radio,
  TrendingUp,
} from 'lucide-react';

interface AdminPortalProps {
  products: Product[];
  inventoryLogs: InventoryLog[];
  onBackToStorefront: () => void;
  onUpdateProductStock: (productId: string, newStock: number, reason: string) => void;
  onUpdateProductPrice: (productId: string, newPrice: number) => void;
  onSimulateCdcPulse: () => void;
  onAddProduct: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  products,
  inventoryLogs,
  onBackToStorefront,
  onUpdateProductStock,
  onUpdateProductPrice,
  onSimulateCdcPulse,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
}) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'logs' | 'coldchain'>('inventory');
  const [pulseToast, setPulseToast] = useState<string | null>(null);

  const totalProducts = products.length;
  const totalStockUnits = products.reduce((sum, p) => sum + p.stock, 0);
  const lowStockCount = products.filter((p) => p.stock >= 1 && p.stock <= 10).length;
  const outOfStockCount = products.filter((p) => p.stock === 0).length;

  const handleTriggerPulse = () => {
    onSimulateCdcPulse();
    setPulseToast('MongoDB CDC Pulse Broadcast: Store #104 stock synchronized in 18ms');
    setTimeout(() => setPulseToast(null), 3500);
  };

  return (
    <div className="w-full min-h-screen bg-[#f8fafc] text-[#0b1c30] pb-16">
      {/* Top Admin Action Bar */}
      <div className="bg-[#1e293b] text-white py-3 px-4 sm:px-6 shadow-md border-b border-[#334155]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToStorefront}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#334155] hover:bg-[#475569] text-[12px] font-semibold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Storefront</span>
            </button>
            <div className="h-4 w-px bg-[#475569] hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
              <span className="text-[13px] font-bold tracking-tight">
                Store #104 Central Fulfillment Operations &amp; Inventory Hub
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTriggerPulse}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#006b2c] hover:bg-[#00873a] text-white text-[12px] font-semibold shadow-xs transition-colors cursor-pointer"
              title="Simulate incoming order sale and live stock countdown"
            >
              <Radio className="w-3.5 h-3.5 text-[#7ffc97] animate-pulse" />
              <span>Simulate MongoDB CDC Pulse</span>
            </button>

            <div className="flex items-center gap-2 pl-2">
              <img
                src={USER_AVATAR_URL}
                alt="Sarah L."
                className="w-8 h-8 rounded-full object-cover border border-[#475569]"
              />
              <div className="hidden sm:block text-left">
                <p className="text-[12px] font-semibold leading-tight">Sarah L.</p>
                <p className="text-[10px] text-[#94a3b8] leading-tight">Ops Manager</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {pulseToast && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3">
          <div className="bg-[#dcfce7] border border-[#86efac] text-[#15803d] px-4 py-2 rounded-xl text-[12px] font-semibold flex items-center justify-between shadow-xs animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#16a34a]" />
              <span>{pulseToast}</span>
            </div>
            <button onClick={() => setPulseToast(null)} className="text-[#16a34a] cursor-pointer">
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Admin Inventory Dashboard KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Products */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#e2e8f0] shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[12px] text-[#64748b] font-medium block">
                Total Products
              </span>
              <span className="text-[28px] font-extrabold text-[#0f172a] font-display tabular-nums">
                {totalProducts}
              </span>
              <div className="text-[11px] text-[#16a34a] flex items-center gap-1 font-semibold mt-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Live catalog SKUs</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#eff4ff] text-[#006b2c] flex items-center justify-center">
              <Package className="w-6 h-6 text-[#006b2c]" />
            </div>
          </div>

          {/* Card 2: Total Stock Units */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#e2e8f0] shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[12px] text-[#64748b] font-medium block">
                Total Stock Units
              </span>
              <span className="text-[28px] font-extrabold text-[#006b2c] font-display tabular-nums">
                {totalStockUnits.toLocaleString('en-IN')}
              </span>
              <div className="text-[11px] text-[#565e74] font-medium mt-1">
                Units physically on shelves &amp; cold vault
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#dcfce7] text-[#15803d] flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-[#15803d]" />
            </div>
          </div>

          {/* Card 3: Low Stock Products */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#e2e8f0] shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[12px] text-[#64748b] font-medium block">
                Low Stock Products
              </span>
              <span className="text-[28px] font-extrabold text-[#b45309] font-display tabular-nums">
                {lowStockCount}
              </span>
              <div className="text-[11px] text-[#b45309] font-medium mt-1">
                Quantity 1–10 (restock needed)
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#fef3c7] text-[#b45309] flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-[#b45309]" />
            </div>
          </div>

          {/* Card 4: Out of Stock Products */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#e2e8f0] shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[12px] text-[#64748b] font-medium block">
                Out of Stock Products
              </span>
              <span className="text-[28px] font-extrabold text-[#dc2626] font-display tabular-nums">
                {outOfStockCount}
              </span>
              <div className="text-[11px] text-[#dc2626] font-medium mt-1">
                Quantity = 0 (unavailable for customers)
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#fee2e2] text-[#ef4444] flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-[#ef4444]" />
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[#e2e8f0] gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`pb-3 text-[13px] font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'inventory'
                ? 'border-[#006b2c] text-[#006b2c]'
                : 'border-transparent text-[#64748b] hover:text-[#0b1c30]'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Live Inventory Management ({products.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`pb-3 text-[13px] font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'logs'
                ? 'border-[#006b2c] text-[#006b2c]'
                : 'border-transparent text-[#64748b] hover:text-[#0b1c30]'
            }`}
          >
            <History className="w-4 h-4" />
            <span>CDC Audit &amp; Dispatch Logs</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('coldchain')}
            className={`pb-3 text-[13px] font-semibold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'coldchain'
                ? 'border-[#006b2c] text-[#006b2c]'
                : 'border-transparent text-[#64748b] hover:text-[#0b1c30]'
            }`}
          >
            <Thermometer className="w-4 h-4" />
            <span>Cold-Chain Telemetry</span>
          </button>
        </div>

        {/* Tab 1: Inventory Table */}
        {activeTab === 'inventory' && (
          <AdminInventory
            products={products}
            onAddProduct={onAddProduct}
            onEditProduct={onEditProduct}
            onDeleteProduct={onDeleteProduct}
            onUpdateProductStock={onUpdateProductStock}
            onUpdateProductPrice={onUpdateProductPrice}
          />
        )}

        {/* Tab 2: Logs */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0]">
              <div>
                <h3 className="text-[16px] font-bold text-[#0f172a] font-display">
                  Live Change Data Capture (CDC) Ledger
                </h3>
                <p className="text-[12px] text-[#64748b]">
                  Real-time synchronization events between Store #104 mini-fulfillment pod and customer mobile clients.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#dcfce7] text-[#15803d] text-[11px] font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-ping" />
                Cluster Healthy
              </span>
            </div>

            <div className="space-y-2">
              {inventoryLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-between text-[12px]"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                        log.changeType === 'RESTOCK'
                          ? 'bg-[#dcfce7] text-[#15803d]'
                          : log.changeType === 'SALE'
                          ? 'bg-[#e0e7ff] text-[#4338ca]'
                          : 'bg-[#fef3c7] text-[#b45309]'
                      }`}
                    >
                      {log.changeType}
                    </span>
                    <div>
                      <span className="font-semibold text-[#0f172a]">
                        {log.productTitle} ({log.sku})
                      </span>
                      <span className="text-[#64748b] block text-[11px]">
                        {log.notes} · Operator: {log.operator}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`font-bold tabular-nums block ${
                        log.quantityChange > 0 ? 'text-[#16a34a]' : 'text-[#ef4444]'
                      }`}
                    >
                      {log.quantityChange > 0 ? `+${log.quantityChange}` : log.quantityChange}
                    </span>
                    <span className="text-[10px] text-[#94a3b8]">{log.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Cold-Chain Telemetry */}
        {activeTab === 'coldchain' && (
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-xs p-5 space-y-4">
            <h3 className="text-[16px] font-bold text-[#0f172a] font-display">
              Continuous Cold-Chain Refrigeration Telemetry
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#eff4ff] border border-[#d3e4fe]">
                <span className="text-[12px] text-[#006b2c] font-semibold block">
                  Pod #104 Dairy &amp; Produce Vault
                </span>
                <span className="text-[26px] font-bold text-[#0f172a] font-display">
                  3.8°C
                </span>
                <p className="text-[11px] text-[#565e74] mt-1">
                  Target: 2.0°C – 4.0°C. Verified at 11:52 AM via IoT thermocouple #TC-992.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#eff4ff] border border-[#d3e4fe]">
                <span className="text-[12px] text-[#006b2c] font-semibold block">
                  Bakery Ambient Chute
                </span>
                <span className="text-[26px] font-bold text-[#0f172a] font-display">
                  21.2°C
                </span>
                <p className="text-[11px] text-[#565e74] mt-1">
                  Target: 19.0°C – 23.0°C. Humidity 44%. Sourdough crust preservation mode active.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#eff4ff] border border-[#d3e4fe]">
                <span className="text-[12px] text-[#006b2c] font-semibold block">
                  Electric Runner Thermal Totes
                </span>
                <span className="text-[26px] font-bold text-[#0f172a] font-display">
                  4.1°C
                </span>
                <p className="text-[11px] text-[#565e74] mt-1">
                  12/12 active thermal totes within safe limits with reusable dry ice phase-change blocks.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
