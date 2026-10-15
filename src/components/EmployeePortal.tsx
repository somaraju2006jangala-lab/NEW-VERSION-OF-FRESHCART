import React from 'react';
import { CustomerOrder } from '../types';
import { AuthorizedEmployee, clearEmployeeSession } from '../services/employeeService';
import { CustomerOrdersLedger } from './CustomerOrdersLedger';
import { LanguageSelector } from './LanguageSelector';
import {
  ShoppingBag,
  ArrowLeft,
  LogOut,
  Shield,
  Sparkles,
} from 'lucide-react';
import { USER_AVATAR_URL } from '../data/products';

export interface EmployeePortalProps {
  currentEmployee: AuthorizedEmployee | null;
  customerOrders?: CustomerOrder[];
  onBackToStorefront: () => void;
  onEmployeeLogout: () => void;
  onUpdateOrderStatus?: (
    orderId: string,
    status: string,
    extraMeta?: { otpVerifiedAt?: string; handoverReleased?: boolean }
  ) => void;
}

export const EmployeePortal: React.FC<EmployeePortalProps> = ({
  currentEmployee,
  customerOrders,
  onBackToStorefront,
  onEmployeeLogout,
  onUpdateOrderStatus,
}) => {
  const handleLogout = () => {
    clearEmployeeSession();
    onEmployeeLogout();
  };

  return (
    <div className="w-full min-h-screen bg-transparent pb-16 relative z-10 selection:bg-emerald-500 selection:text-black">
      {/* Top Employee Action Bar matching AdminPortal style */}
      <div className="bg-transparent text-white py-3 px-4 sm:px-6 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="employee-back-to-storefront-btn"
              onClick={onBackToStorefront}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#334155]/80 hover:bg-[#475569] text-white text-[12px] font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs cursor-pointer shadow-xs border border-white/10"
              title="Return to public storefront"
            >
              <ArrowLeft className="w-4 h-4 text-[#10b981]" />
              <span>Back to Storefront</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Language Selector */}
            <LanguageSelector variant="dark" idPrefix="employee-lang" />

            {/* Employee User Badge */}
            <div
              id="employee-profile-pill"
              className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-black/40 border border-white/10 shadow-xs backdrop-blur-md"
            >
              <div className="relative">
                <img
                  src={USER_AVATAR_URL}
                  alt={currentEmployee?.fullName || 'Employee'}
                  className="w-7 h-7 rounded-full object-cover border border-emerald-500/40"
                />
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#10b981] ring-1 ring-black" />
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-[12px] font-bold leading-tight text-white truncate max-w-[140px]">
                  {currentEmployee?.fullName || 'Operations Employee'}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Shield className="w-2.5 h-2.5 text-[#10b981]" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 font-mono">
                    EMPLOYEE
                  </span>
                </div>
              </div>
            </div>

            {/* Sign Out Button */}
            <button
              type="button"
              id="employee-logout-btn"
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 hover:text-white text-[12px] font-bold transition-all duration-150 cursor-pointer shadow-xs"
              title="Sign out of Employee Portal"
            >
              <LogOut className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Welcome Notice Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-950/50 via-black/40 to-black/60 backdrop-blur-xl p-4 sm:p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-[#10b981] flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <Sparkles className="w-5 h-5 text-[#10b981]" />
              </div>
              <div>
                <h2 className="text-[17px] font-bold text-white font-display flex flex-wrap items-center gap-2">
                  <span>Welcome, {currentEmployee?.fullName || 'Operations Employee'}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold uppercase tracking-wider">
                    Staff ID: {currentEmployee?.employeeId || 'emp_001'}
                  </span>
                </h2>
                <p className="text-[12px] text-slate-300 mt-0.5">
                  Authorized Employee Portal &bull; Customer Orders Ledger fulfillment and delivery verification
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto font-mono text-[11px] text-slate-400 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-300 font-semibold">Active Session</span>
            </div>
          </div>
        </div>

        {/* Customer Orders Ledger: Reused without duplication */}
        <CustomerOrdersLedger
          userRole="employee"
          customerOrders={customerOrders}
          onUpdateOrderStatus={onUpdateOrderStatus}
          currentUserName={currentEmployee?.fullName || currentEmployee?.employeeId}
        />
      </div>
    </div>
  );
};
