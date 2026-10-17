import { getStoredAdminToken } from './adminService';

export interface DailyReportOrder {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  deliveryAddress: string;
  deliveryTimeSlot?: string;
  subtotal: number;
  discount: number;
  total: number;
  couponCode?: string;
  paymentId?: string;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  screenshotUrl?: string;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  createdAt: string;
}

export interface DailyReportData {
  selectedDate: string;
  totalOrders: number;
  upiOrdersCount: number;
  codOrdersCount: number;
  totalUpiTransactions: number;
  totalCodCollections: number;
  totalCollectedAmount: number;
  pendingUpiCount: number;
  pendingUpiAmount: number;
  rejectedUpiCount: number;
  rejectedUpiAmount: number;
  pendingCodCount: number;
  pendingCodAmount: number;
  orders: DailyReportOrder[];
}

export interface MonthDayActivity {
  date: string;
  orderCount: number;
  hasOrders: boolean;
}

export interface DailyReportResponse {
  success: boolean;
  report?: DailyReportData;
  error?: string;
}

export interface CalendarMonthResponse {
  success: boolean;
  year?: number;
  month?: number;
  days?: Record<string, MonthDayActivity>;
  error?: string;
}

/**
 * Fetches the daily orders and payment transactions report for a specific date (YYYY-MM-DD).
 */
export async function fetchDailyReport(dateStr: string): Promise<DailyReportResponse> {
  const token = getStoredAdminToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-admin-token'] = token;
  }

  try {
    const res = await fetch(`/api/admin/reports/daily?date=${encodeURIComponent(dateStr)}`, {
      method: 'GET',
      headers,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || `HTTP ${res.status}: Failed to load daily report for ${dateStr}.`,
      };
    }
    return {
      success: true,
      report: data.report,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error fetching daily report.',
    };
  }
}

/**
 * Fetches the monthly calendar activity (which dates have orders) for a given year and month (1-12).
 */
export async function fetchCalendarMonthSummary(year: number, month: number): Promise<CalendarMonthResponse> {
  const token = getStoredAdminToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-admin-token'] = token;
  }

  try {
    const res = await fetch(`/api/admin/reports/calendar-month?year=${year}&month=${month}`, {
      method: 'GET',
      headers,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || `HTTP ${res.status}: Failed to load calendar activity for ${year}-${month}.`,
      };
    }
    return {
      success: true,
      year: data.year,
      month: data.month,
      days: data.days || {},
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error fetching calendar month summary.',
    };
  }
}
