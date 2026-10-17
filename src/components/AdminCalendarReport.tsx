import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  CreditCard,
  Banknote,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Search,
  Copy,
  Check,
  CalendarDays,
  ArrowRight,
  TrendingUp,
  Receipt,
  Eye,
  Filter,
} from 'lucide-react';
import { formatINR } from '../utils/currency';
import { formatOrderDateTime } from '../utils/date';
import {
  fetchDailyReport,
  fetchCalendarMonthSummary,
  DailyReportData,
  DailyReportOrder,
  MonthDayActivity,
} from '../services/adminReportService';

export interface AdminCalendarReportProps {
  initialDate?: string;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const AdminCalendarReport: React.FC<AdminCalendarReportProps> = ({ initialDate }) => {
  // Format local date YYYY-MM-DD helper
  const getTodayStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const initialParsedDate = initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : getTodayStr();

  // Selected date (YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(initialParsedDate);

  // Month & Year being viewed in the monthly calendar
  const initialYear = parseInt(initialParsedDate.split('-')[0], 10);
  const initialMonth = parseInt(initialParsedDate.split('-')[1], 10);
  const [viewYear, setViewYear] = useState<number>(initialYear);
  const [viewMonth, setViewMonth] = useState<number>(initialMonth); // 1-12

  // Month activity indicator map
  const [monthActivity, setMonthActivity] = useState<Record<string, MonthDayActivity>>({});
  const [isLoadingMonth, setIsLoadingMonth] = useState<boolean>(false);

  // Selected Day Report Data
  const [report, setReport] = useState<DailyReportData | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState<boolean>(true);
  const [reportError, setReportError] = useState<string | null>(null);

  // Table filters & search
  const [tableSearch, setTableSearch] = useState<string>('');
  const [methodFilter, setMethodFilter] = useState<'all' | 'upi' | 'cod'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'rejected'>('all');
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // Load monthly activity indicators
  const loadMonthActivity = useCallback(async (year: number, month: number) => {
    setIsLoadingMonth(true);
    try {
      const res = await fetchCalendarMonthSummary(year, month);
      if (res.success && res.days) {
        setMonthActivity(res.days);
      }
    } catch {
      // Ignore network errors on background indicator load
    } finally {
      setIsLoadingMonth(false);
    }
  }, []);

  // Load selected day report
  const loadDailyReport = useCallback(async (dateStr: string) => {
    setIsLoadingReport(true);
    setReportError(null);
    try {
      const res = await fetchDailyReport(dateStr);
      if (res.success && res.report) {
        setReport(res.report);
      } else {
        setReportError(res.error || `Failed to fetch report for ${dateStr}`);
      }
    } catch (err: any) {
      setReportError(err?.message || 'Error connecting to reporting server.');
    } finally {
      setIsLoadingReport(false);
    }
  }, []);

  // Sync when viewYear/viewMonth changes
  useEffect(() => {
    loadMonthActivity(viewYear, viewMonth);
  }, [viewYear, viewMonth, loadMonthActivity]);

  // Sync when selectedDate changes
  useEffect(() => {
    loadDailyReport(selectedDate);
  }, [selectedDate, loadDailyReport]);

  // Available years for dropdown selection (past years, current year, future years)
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startYear = Math.min(2015, viewYear - 5);
    const endYear = Math.max(currentYear + 6, viewYear + 5);
    const years: number[] = [];
    for (let y = startYear; y <= endYear; y++) {
      years.push(y);
    }
    return years;
  }, [viewYear]);

  // Navigate to previous month
  const handlePrevMonth = () => {
    let nextY = viewYear;
    let nextM = viewMonth - 1;
    if (nextM < 1) {
      nextY = viewYear - 1;
      nextM = 12;
    }
    setViewYear(nextY);
    setViewMonth(nextM);
    const parts = selectedDate.split('-');
    const currentDay = parseInt(parts[2] || '1', 10);
    const maxDays = new Date(nextY, nextM, 0).getDate();
    const clampedDay = Math.min(currentDay, maxDays);
    setSelectedDate(`${nextY}-${String(nextM).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`);
  };

  // Navigate to next month
  const handleNextMonth = () => {
    let nextY = viewYear;
    let nextM = viewMonth + 1;
    if (nextM > 12) {
      nextY = viewYear + 1;
      nextM = 1;
    }
    setViewYear(nextY);
    setViewMonth(nextM);
    const parts = selectedDate.split('-');
    const currentDay = parseInt(parts[2] || '1', 10);
    const maxDays = new Date(nextY, nextM, 0).getDate();
    const clampedDay = Math.min(currentDay, maxDays);
    setSelectedDate(`${nextY}-${String(nextM).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`);
  };

  // Handle month change from dropdown
  const handleMonthChange = (newMonth: number) => {
    setViewMonth(newMonth);
    const parts = selectedDate.split('-');
    const currentDay = parseInt(parts[2] || '1', 10);
    const maxDays = new Date(viewYear, newMonth, 0).getDate();
    const clampedDay = Math.min(currentDay, maxDays);
    setSelectedDate(`${viewYear}-${String(newMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`);
  };

  // Handle year change from dropdown
  const handleYearChange = (newYear: number) => {
    setViewYear(newYear);
    const parts = selectedDate.split('-');
    const currentDay = parseInt(parts[2] || '1', 10);
    const maxDays = new Date(newYear, viewMonth, 0).getDate();
    const clampedDay = Math.min(currentDay, maxDays);
    setSelectedDate(`${newYear}-${String(viewMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`);
  };

  // Jump to today
  const handleGoToToday = () => {
    const today = getTodayStr();
    const [y, m] = today.split('-').map(Number);
    setViewYear(y);
    setViewMonth(m);
    setSelectedDate(today);
  };

  // Select a specific date
  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    const [y, m] = dateStr.split('-').map(Number);
    if (y !== viewYear || m !== viewMonth) {
      setViewYear(y);
      setViewMonth(m);
    }
  };

  // Handle direct date picker input
  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      handleSelectDate(val);
    }
  };

  // Copy order ID helper
  const handleCopyOrderId = (orderId: string) => {
    navigator.clipboard?.writeText(orderId).then(() => {
      setCopiedOrderId(orderId);
      setTimeout(() => setCopiedOrderId(null), 2000);
    });
  };

  // Build calendar matrix for current viewMonth
  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth - 1, 1).getDay(); // 0 = Sunday
    const daysInCurrentMonth = new Date(viewYear, viewMonth, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth - 1, 0).getDate();

    const cells: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isSelected: boolean;
      isToday: boolean;
      orderCount: number;
    }> = [];

    const todayStr = getTodayStr();

    // Leading days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevM = viewMonth === 1 ? 12 : viewMonth - 1;
      const prevY = viewMonth === 1 ? viewYear - 1 : viewYear;
      const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      cells.push({
        dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isSelected: dateStr === selectedDate,
        isToday: dateStr === todayStr,
        orderCount: 0,
      });
    }

    // Days in current month
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const activity = monthActivity[dateStr];
      const orderCount = activity?.orderCount || 0;
      cells.push({
        dateStr,
        dayNumber: day,
        isCurrentMonth: true,
        isSelected: dateStr === selectedDate,
        isToday: dateStr === todayStr,
        orderCount,
      });
    }

    // Trailing days from next month to make complete weeks (multiples of 7)
    const totalSlots = Math.ceil(cells.length / 7) * 7;
    const remaining = totalSlots - cells.length;
    for (let day = 1; day <= remaining; day++) {
      const nextM = viewMonth === 12 ? 1 : viewMonth + 1;
      const nextY = viewMonth === 12 ? viewYear + 1 : viewYear;
      const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({
        dateStr,
        dayNumber: day,
        isCurrentMonth: false,
        isSelected: dateStr === selectedDate,
        isToday: dateStr === todayStr,
        orderCount: 0,
      });
    }

    return cells;
  }, [viewYear, viewMonth, selectedDate, monthActivity]);

  // Formatted selected date for human display
  const humanSelectedDate = useMemo(() => {
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Filtered orders list for the detailed table
  const filteredOrders = useMemo(() => {
    if (!report?.orders) return [];
    return report.orders.filter((ord) => {
      // Method filter
      const rawMethod = (ord.paymentMethod || '').toLowerCase();
      const isCod = rawMethod.includes('cash') || rawMethod === 'cod';
      if (methodFilter === 'upi' && isCod) return false;
      if (methodFilter === 'cod' && !isCod) return false;

      // Status filter
      const pStatus = (ord.paymentStatus || '').toUpperCase();
      if (statusFilter === 'completed') {
        if (pStatus !== 'COMPLETED' && pStatus !== 'PAID' && pStatus !== 'COLLECTED') return false;
      } else if (statusFilter === 'pending') {
        if (!pStatus.includes('PENDING') && pStatus !== 'COD') return false;
      } else if (statusFilter === 'rejected') {
        if (pStatus !== 'REJECTED' && pStatus !== 'FAILED') return false;
      }

      // Search query
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase().trim();
        const idMatch = ord.id.toLowerCase().includes(q);
        const nameMatch = ord.customerName.toLowerCase().includes(q);
        const phoneMatch = (ord.customerPhone || '').includes(q);
        const emailMatch = (ord.customerEmail || '').toLowerCase().includes(q);
        if (!idMatch && !nameMatch && !phoneMatch && !emailMatch) return false;
      }

      return true;
    });
  }, [report?.orders, methodFilter, statusFilter, tableSearch]);

  // Badges & styling for payment status in table
  const getPaymentStatusBadge = (status: string, method: string) => {
    const s = String(status || '').toUpperCase();
    const isCod = method.toLowerCase().includes('cash') || method.toUpperCase() === 'COD';

    if (s === 'COLLECTED') {
      return {
        label: 'COLLECTED',
        className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        dot: 'bg-emerald-400',
      };
    }
    if (s === 'COMPLETED' || s === 'PAID') {
      return {
        label: 'PAID',
        className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        dot: 'bg-emerald-400',
      };
    }
    if (s === 'PENDING_COLLECTION' || (isCod && s.includes('PENDING'))) {
      return {
        label: 'PENDING COLLECTION',
        className: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        dot: 'bg-amber-400 animate-pulse',
      };
    }
    if (s === 'PENDING_VERIFICATION' || s.includes('PENDING')) {
      return {
        label: 'PENDING VERIFICATION',
        className: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        dot: 'bg-amber-400 animate-pulse',
      };
    }
    if (s === 'REJECTED' || s === 'FAILED') {
      return {
        label: 'REJECTED',
        className: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        dot: 'bg-rose-400',
      };
    }
    return {
      label: s || 'PENDING',
      className: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
      dot: 'bg-slate-400',
    };
  };

  const getDeliveryStatusBadge = (status: string) => {
    const s = String(status || '').toLowerCase();
    if (s === 'delivered') {
      return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    }
    if (s === 'out for delivery') {
      return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
    }
    if (s === 'picking' || s === 'packing') {
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    }
    if (s === 'confirmed' || s === 'ordered') {
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    }
    return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header Card */}
      <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#006b2c] to-[#10b981] flex items-center justify-center shadow-lg shadow-emerald-950/40 border border-emerald-400/30">
                <CalendarIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-[20px] font-bold text-white font-display tracking-tight flex items-center gap-2">
                  <span>Orders & Transactions Calendar</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Live Audit Ledger
                  </span>
                </h2>
                <p className="text-[12px] text-[#94a3b8] mt-0.5">
                  Inspect daily order counts, verified UPI payments, confirmed COD collections, and individual transaction records.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Quick Date Picker */}
            <div className="flex items-center gap-1.5 bg-black/50 border border-white/15 px-3 py-1.5 rounded-xl">
              <CalendarDays className="w-4 h-4 text-emerald-400 shrink-0" />
              <label htmlFor="admin-calendar-date-input" className="text-[11px] text-[#94a3b8] font-medium shrink-0">
                Jump to Date:
              </label>
              <input
                id="admin-calendar-date-input"
                type="date"
                value={selectedDate}
                onChange={handleDateInputChange}
                className="bg-transparent text-[12px] text-white font-mono focus:outline-hidden cursor-pointer"
              />
            </div>

            {/* Jump to Today button */}
            <button
              id="admin-calendar-today-btn"
              type="button"
              onClick={handleGoToToday}
              className="px-3.5 py-1.5 rounded-xl text-[12px] font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Today</span>
            </button>

            {/* Refresh Data button */}
            <button
              id="admin-calendar-refresh-btn"
              type="button"
              onClick={() => {
                loadMonthActivity(viewYear, viewMonth);
                loadDailyReport(selectedDate);
              }}
              disabled={isLoadingReport}
              className="px-3.5 py-1.5 rounded-xl text-[12px] font-semibold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/15 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingReport ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Calendar Column + Selected Day Summary */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column: Monthly Calendar (5 cols on xl) */}
        <div className="xl:col-span-5 space-y-4">
          <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-5">
            {/* Calendar Month Header with Month/Year Selectors and Nav */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                {/* Month Dropdown */}
                <select
                  id="admin-calendar-month-select"
                  aria-label="Select Month"
                  value={viewMonth}
                  onChange={(e) => handleMonthChange(parseInt(e.target.value, 10))}
                  className="bg-black/60 hover:bg-black/80 border border-white/15 hover:border-emerald-500/50 rounded-xl px-2.5 py-1.5 text-[13px] font-bold text-white focus:outline-hidden focus:border-emerald-500 cursor-pointer shadow-xs transition-colors"
                  style={{ backgroundColor: 'rgba(10, 15, 24, 0.95)' }}
                >
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={m} value={idx + 1} style={{ backgroundColor: '#0b1c30', color: '#ffffff' }}>
                      {m}
                    </option>
                  ))}
                </select>

                {/* Year Dropdown */}
                <select
                  id="admin-calendar-year-select"
                  aria-label="Select Year"
                  value={viewYear}
                  onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
                  className="bg-black/60 hover:bg-black/80 border border-white/15 hover:border-emerald-500/50 rounded-xl px-2.5 py-1.5 text-[13px] font-bold text-white font-mono focus:outline-hidden focus:border-emerald-500 cursor-pointer shadow-xs transition-colors"
                  style={{ backgroundColor: 'rgba(10, 15, 24, 0.95)' }}
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr} style={{ backgroundColor: '#0b1c30', color: '#ffffff' }}>
                      {yr}
                    </option>
                  ))}
                </select>

                {isLoadingMonth && <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />}
              </div>

              <div className="flex items-center gap-1">
                <button
                  id="admin-calendar-prev-month-btn"
                  type="button"
                  onClick={handlePrevMonth}
                  aria-label="Previous Month"
                  title="Previous Month"
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  id="admin-calendar-next-month-btn"
                  type="button"
                  onClick={handleNextMonth}
                  aria-label="Next Month"
                  title="Next Month"
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 pt-3 pb-2 text-center">
              {WEEKDAY_NAMES.map((d) => (
                <div key={d} className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8]">
                  {d}
                </div>
              ))}
            </div>

            {/* Month Day Grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {calendarCells.map((cell) => {
                const hasOrders = cell.orderCount > 0;
                return (
                  <button
                    key={cell.dateStr}
                    id={`admin-calendar-day-${cell.dateStr}`}
                    type="button"
                    onClick={() => handleSelectDate(cell.dateStr)}
                    className={`relative p-2 rounded-xl text-center transition-all cursor-pointer flex flex-col items-center justify-between min-h-[58px] ${
                      cell.isSelected
                        ? 'bg-gradient-to-b from-emerald-600 to-[#006b2c] text-white shadow-lg shadow-emerald-950/60 ring-2 ring-emerald-400 font-bold'
                        : cell.isCurrentMonth
                        ? 'bg-white/[0.03] hover:bg-white/[0.08] text-slate-200 border border-white/[0.06]'
                        : 'bg-black/20 text-slate-600 border border-transparent opacity-40 hover:opacity-70'
                    }`}
                  >
                    {/* Day number & Today indicator */}
                    <div className="w-full flex items-center justify-between px-0.5">
                      <span className={`text-[12px] ${cell.isSelected ? 'text-white font-bold' : ''}`}>
                        {cell.dayNumber}
                      </span>
                      {cell.isToday && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            cell.isSelected ? 'bg-amber-300' : 'bg-emerald-400'
                          }`}
                          title="Today"
                        />
                      )}
                    </div>

                    {/* Order count pill / badge */}
                    {hasOrders && (
                      <div className="mt-1 w-full">
                        <span
                          className={`inline-block px-1.5 py-0.2 rounded-full text-[9px] font-extrabold truncate max-w-full ${
                            cell.isSelected
                              ? 'bg-black/40 text-emerald-200 border border-emerald-300/40'
                              : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                          }`}
                          title={`${cell.orderCount} order${cell.orderCount === 1 ? '' : 's'} placed on ${cell.dateStr}`}
                        >
                          {cell.orderCount} ord{cell.orderCount === 1 ? '' : 's'}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Calendar Legend */}
            <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between text-[11px] text-[#94a3b8] gap-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
                <span>Has Orders</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>Today</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-700 text-white font-bold text-[9px]">Active</span>
                <span>Selected</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Selected Day Report (7 cols on xl) */}
        <div className="xl:col-span-7 space-y-4">
          {/* Selected Date Header Banner */}
          <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 p-5 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" />
                  Selected Date Report
                </span>
                <h3 className="text-[18px] sm:text-[20px] font-bold text-white font-display mt-0.5">
                  {humanSelectedDate}
                </h3>
                <p className="text-[12px] text-[#94a3b8] font-mono mt-0.5">{selectedDate}</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 flex items-center gap-2">
                  <span className="text-[11px] text-[#94a3b8]">Status:</span>
                  <span
                    className={`text-[12px] font-bold ${
                      (report?.totalOrders || 0) > 0 ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  >
                    {(report?.totalOrders || 0) > 0 ? `${report?.totalOrders} Orders Placed` : 'No Orders Placed'}
                  </span>
                </div>
              </div>
            </div>

            {/* Error banner if any */}
            {reportError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[12px] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{reportError}</span>
              </div>
            )}

            {/* 6 Core Statistics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
              {/* Card 1: Total Orders */}
              <div
                id="report-card-total-orders"
                className="bg-white/[0.03] hover:bg-white/[0.05] p-3.5 rounded-xl border border-white/10 transition-all"
              >
                <div className="flex items-center justify-between text-[#94a3b8]">
                  <span className="text-[11px] font-medium">Total Orders</span>
                  <ShoppingBag className="w-4 h-4 text-sky-400" />
                </div>
                <div className="text-[22px] font-extrabold text-white font-display mt-1 tabular-nums">
                  {isLoadingReport ? '...' : report?.totalOrders ?? 0}
                </div>
                <p className="text-[10px] text-[#94a3b8] mt-0.5 truncate">Placed on selected date</p>
              </div>

              {/* Card 2: UPI Orders */}
              <div
                id="report-card-upi-orders"
                className="bg-white/[0.03] hover:bg-white/[0.05] p-3.5 rounded-xl border border-white/10 transition-all"
              >
                <div className="flex items-center justify-between text-[#94a3b8]">
                  <span className="text-[11px] font-medium">UPI Orders</span>
                  <CreditCard className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-[22px] font-extrabold text-purple-300 font-display mt-1 tabular-nums">
                  {isLoadingReport ? '...' : report?.upiOrdersCount ?? 0}
                </div>
                <p className="text-[10px] text-[#94a3b8] mt-0.5 truncate">Orders via UPI/Online</p>
              </div>

              {/* Card 3: COD Orders */}
              <div
                id="report-card-cod-orders"
                className="bg-white/[0.03] hover:bg-white/[0.05] p-3.5 rounded-xl border border-white/10 transition-all"
              >
                <div className="flex items-center justify-between text-[#94a3b8]">
                  <span className="text-[11px] font-medium">COD Orders</span>
                  <Banknote className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-[22px] font-extrabold text-amber-300 font-display mt-1 tabular-nums">
                  {isLoadingReport ? '...' : report?.codOrdersCount ?? 0}
                </div>
                <p className="text-[10px] text-[#94a3b8] mt-0.5 truncate">Cash on Delivery orders</p>
              </div>

              {/* Card 4: Total UPI Transactions */}
              <div
                id="report-card-upi-transactions"
                className="bg-purple-950/20 hover:bg-purple-950/30 p-3.5 rounded-xl border border-purple-500/20 transition-all"
              >
                <div className="flex items-center justify-between text-purple-300">
                  <span className="text-[11px] font-semibold">Total UPI Txns</span>
                  <CheckCircle2 className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-[18px] sm:text-[20px] font-extrabold text-purple-200 font-mono mt-1 tabular-nums">
                  {isLoadingReport ? '...' : formatINR(report?.totalUpiTransactions ?? 0)}
                </div>
                <p className="text-[10px] text-purple-300/70 mt-0.5 truncate">Verified PAID payments</p>
              </div>

              {/* Card 5: Total COD Collections */}
              <div
                id="report-card-cod-collections"
                className="bg-amber-950/20 hover:bg-amber-950/30 p-3.5 rounded-xl border border-amber-500/20 transition-all"
              >
                <div className="flex items-center justify-between text-amber-300">
                  <span className="text-[11px] font-semibold">Total COD Collections</span>
                  <Banknote className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-[18px] sm:text-[20px] font-extrabold text-amber-200 font-mono mt-1 tabular-nums">
                  {isLoadingReport ? '...' : formatINR(report?.totalCodCollections ?? 0)}
                </div>
                <p className="text-[10px] text-amber-300/70 mt-0.5 truncate">Confirmed COLLECTED cash</p>
              </div>

              {/* Card 6: Total Collected Amount (PROMINENT HIGHLIGHT) */}
              <div
                id="report-card-total-collected"
                className="bg-gradient-to-br from-emerald-950/60 to-emerald-900/30 p-3.5 rounded-xl border border-emerald-500/40 shadow-lg shadow-emerald-950/40 transition-all"
              >
                <div className="flex items-center justify-between text-emerald-300">
                  <span className="text-[11px] font-bold">Total Collected</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-[18px] sm:text-[20px] font-extrabold text-emerald-300 font-mono mt-1 tabular-nums">
                  {isLoadingReport ? '...' : formatINR(report?.totalCollectedAmount ?? 0)}
                </div>
                <p className="text-[10px] text-emerald-300/70 mt-0.5 truncate">UPI Paid + COD Collected</p>
              </div>
            </div>

            {/* Secondary Reconciliation Breakdown Strip */}
            <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Pending UPI */}
              <div
                id="report-pending-upi-strip"
                className="bg-black/30 p-2.5 rounded-xl border border-white/5 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-[#94a3b8] leading-tight">Pending UPI Verification</p>
                    <p className="text-[11px] font-bold text-amber-300 font-mono mt-0.5">
                      {report?.pendingUpiCount ?? 0} ord ({formatINR(report?.pendingUpiAmount ?? 0)})
                    </p>
                  </div>
                </div>
              </div>

              {/* Rejected UPI */}
              <div
                id="report-rejected-upi-strip"
                className="bg-black/30 p-2.5 rounded-xl border border-white/5 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-[#94a3b8] leading-tight">Rejected UPI Proofs</p>
                    <p className="text-[11px] font-bold text-rose-300 font-mono mt-0.5">
                      {report?.rejectedUpiCount ?? 0} ord ({formatINR(report?.rejectedUpiAmount ?? 0)})
                    </p>
                  </div>
                </div>
              </div>

              {/* Pending COD */}
              <div
                id="report-pending-cod-strip"
                className="bg-black/30 p-2.5 rounded-xl border border-white/5 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-[#94a3b8] leading-tight">Pending COD Collections</p>
                    <p className="text-[11px] font-bold text-amber-300 font-mono mt-0.5">
                      {report?.pendingCodCount ?? 0} ord ({formatINR(report?.pendingCodAmount ?? 0)})
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Order List Section for Selected Date */}
      <div className="bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-5 sm:p-6 space-y-4">
        {/* Table Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div>
            <h3 className="text-[16px] font-bold text-white font-display flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-400" />
              <span>Daily Order Records ({report?.orders?.length || 0})</span>
            </h3>
            <p className="text-[11px] text-[#94a3b8]">
              All customer orders placed on {humanSelectedDate} with authoritative payment & delivery states.
            </p>
          </div>

          {/* Filters & Search */}
          {(report?.orders?.length || 0) > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Search Bar */}
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search order ID or customer..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-[12px] text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              {/* Method filter buttons */}
              <div className="flex items-center bg-black/40 border border-white/10 p-0.5 rounded-xl">
                <button
                  type="button"
                  onClick={() => setMethodFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    methodFilter === 'all' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setMethodFilter('upi')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    methodFilter === 'upi' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  UPI
                </button>
                <button
                  type="button"
                  onClick={() => setMethodFilter('cod')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    methodFilter === 'cod' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  COD
                </button>
              </div>

              {/* Status filter buttons */}
              <div className="flex items-center bg-black/40 border border-white/10 p-0.5 rounded-xl">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    statusFilter === 'all' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Status
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('completed')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    statusFilter === 'completed'
                      ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Paid
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('pending')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    statusFilter === 'pending'
                      ? 'bg-amber-600/30 text-amber-300 border border-amber-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Pending
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Loading Spinner */}
        {isLoadingReport && (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
            <p className="text-[13px]">Loading authoritative report from database for {selectedDate}...</p>
          </div>
        )}

        {/* Empty State: No Orders on Selected Date */}
        {!isLoadingReport && (!report?.orders || report.orders.length === 0) && (
          <div
            id="report-empty-state"
            className="p-12 text-center rounded-2xl bg-white/[0.02] border border-white/5 space-y-3"
          >
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-500">
              <CalendarIcon className="w-7 h-7" />
            </div>
            <h4 className="text-[17px] font-bold text-white font-display">No orders found for this date</h4>
            <p className="text-[13px] text-[#94a3b8] max-w-md mx-auto">
              There were no customer orders placed on <strong className="text-white">{humanSelectedDate}</strong>. All
              daily counts and transaction totals are shown as zero.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleGoToToday}
                className="px-4 py-2 rounded-xl text-[12px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <span>Jump to Today</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Filtered Out State */}
        {!isLoadingReport &&
          report?.orders &&
          report.orders.length > 0 &&
          filteredOrders.length === 0 && (
            <div className="p-8 text-center rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
              <Filter className="w-6 h-6 text-slate-500 mx-auto" />
              <p className="text-[13px] text-slate-300 font-semibold">No orders matching the applied filters.</p>
              <button
                type="button"
                onClick={() => {
                  setTableSearch('');
                  setMethodFilter('all');
                  setStatusFilter('all');
                }}
                className="text-[12px] text-emerald-400 hover:underline cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          )}

        {/* Orders Table */}
        {!isLoadingReport && filteredOrders.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-black/50 text-[#94a3b8] uppercase text-[10px] font-bold tracking-wider border-b border-white/10">
                <tr>
                  <th className="py-3 px-3.5">Order ID</th>
                  <th className="py-3 px-3.5">Customer</th>
                  <th className="py-3 px-3.5">Order Time</th>
                  <th className="py-3 px-3.5">Payment Method</th>
                  <th className="py-3 px-3.5">Order Amount</th>
                  <th className="py-3 px-3.5">Payment Status</th>
                  <th className="py-3 px-3.5">Delivery Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredOrders.map((ord) => {
                  const pBadge = getPaymentStatusBadge(ord.paymentStatus, ord.paymentMethod);
                  const isCopied = copiedOrderId === ord.id;
                  const rawMethod = (ord.paymentMethod || '').toLowerCase();
                  const isCod = rawMethod.includes('cash') || rawMethod === 'cod';

                  return (
                    <tr
                      key={ord.id}
                      className="hover:bg-white/[0.03] transition-colors"
                      id={`report-order-row-${ord.id.replace(/[^a-zA-Z0-9]/g, '')}`}
                    >
                      {/* Order ID */}
                      <td className="py-3 px-3.5 font-mono font-bold text-white whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{ord.id}</span>
                          <button
                            type="button"
                            title="Copy Order ID"
                            onClick={() => handleCopyOrderId(ord.id)}
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                          >
                            {isCopied ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Customer Name */}
                      <td className="py-3 px-3.5">
                        <div className="font-semibold text-white truncate max-w-[150px] sm:max-w-[200px]">
                          {ord.customerName}
                        </div>
                        {ord.customerPhone && (
                          <div className="text-[10px] text-[#94a3b8] font-mono">{ord.customerPhone}</div>
                        )}
                      </td>

                      {/* Order Time */}
                      <td className="py-3 px-3.5 whitespace-nowrap text-[#94a3b8]">
                        {formatOrderDateTime(ord.createdAt)}
                      </td>

                      {/* Payment Method */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-200">
                          {isCod ? (
                            <Banknote className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          ) : (
                            <CreditCard className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          )}
                          <span className="font-medium">{ord.paymentMethod || (isCod ? 'Cash on Delivery' : 'UPI')}</span>
                        </div>
                      </td>

                      {/* Order Amount */}
                      <td className="py-3 px-3.5 font-mono font-bold text-emerald-300 whitespace-nowrap tabular-nums">
                        {formatINR(ord.total)}
                      </td>

                      {/* Payment Status */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border font-mono ${pBadge.className}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${pBadge.dot}`} />
                          <span>{pBadge.label}</span>
                        </span>
                      </td>

                      {/* Delivery Status */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getDeliveryStatusBadge(
                            ord.status
                          )}`}
                        >
                          {ord.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
