import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getApiBaseUrl,
  setApiBaseUrl,
  getCandidateDevUrls,
  isProductionHttpsUrl,
} from '../config/api';
import {
  Product,
  Order,
  Customer,
  AuthorizedAdmin,
  AuthorizedEmployee,
  Coupon,
  DeliveryChargeRule,
  UpiPaymentSettings,
  PendingDeliveryOrder,
  InventoryLog,
  AppSettings,
  DailyReportResponse,
  CalendarMonthResponse,
  AdminCustomerAccount,
  PaymentVerificationItem,
} from '../types';

const IS_DEV =
  typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  token?: string | null;
  timeoutMs?: number;
  retries?: number;
  skipDedup?: boolean;
  disableAutoHeal?: boolean;
  customerScoped?: boolean;
}

const inFlightGetRequests = new Map<string, Promise<any>>();

function parseJsonResponse(res: Response, rawText: string): { json: any; isHtml: boolean; isInvalidJson: boolean } {
  const trimmed = (rawText || '').trim();
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const looksLikeHtml =
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<');

  if (looksLikeHtml) {
    return { json: null, isHtml: true, isInvalidJson: true };
  }

  if (trimmed.length === 0) {
    if (contentType.includes('application/json')) {
      return { json: {}, isHtml: false, isInvalidJson: false };
    }
    return { json: {}, isHtml: false, isInvalidJson: false };
  }

  try {
    const parsed = JSON.parse(trimmed);
    return { json: parsed, isHtml: false, isInvalidJson: false };
  } catch {
    return { json: null, isHtml: false, isInvalidJson: true };
  }
}

function isTransientNetworkError(err: any): boolean {
  if (!err) return false;
  if (err?.name === 'AbortError') return true;
  const msg = String(err?.message || '').toLowerCase();
  return (
    msg === 'load failed' ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('connectexception') ||
    msg.includes('failed to connect') ||
    msg.includes('sockettimeoutexception') ||
    msg.includes('unable to resolve host') ||
    msg.includes('ehostunreach') ||
    msg.includes('enetunreach') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('etimedout') ||
    msg.includes('fetch failed') ||
    msg.includes('timed out') ||
    msg.includes('cleartext http traffic')
  );
}

async function executeRequest<T = any>(
  endpoint: string,
  options: RequestOptions,
  cleanEndpoint: string,
  effectiveToken: string | null | undefined,
  headers: Record<string, string>
): Promise<T> {
  const baseUrl = await getApiBaseUrl();
  const url = `${baseUrl}${cleanEndpoint}`;
  const method = options.method || 'GET';
  const timeoutMs = options.timeoutMs || 18000;
  const maxAttempts =
    typeof options.retries === 'number'
      ? Math.max(1, options.retries + 1)
      : method === 'GET'
      ? 3
      : 1;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const fetchOptions: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };

      if (options.body !== undefined && method !== 'GET') {
        fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      }

      const res = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      const rawText = await res.text();
      const { json, isHtml, isInvalidJson } = parseJsonResponse(res, rawText);

      if (isHtml || isInvalidJson || typeof json !== 'object' || json === null) {
        const invalidErr: any = new Error(
          isHtml
            ? `Received HTML instead of JSON from FreshCart API (HTTP ${res.status}).`
            : `Received invalid JSON response from server (HTTP ${res.status}).`
        );
        invalidErr.status = res.status;
        invalidErr.isNonJsonResponse = true;
        throw invalidErr;
      }

      if (!res.ok) {
        const errorMsg = json?.error || json?.message || `HTTP ${res.status}: Request failed`;
        const httpErr: any = new Error(errorMsg);
        httpErr.status = res.status;
        httpErr.data = json;
        httpErr.alreadySubmitted = Boolean(json?.alreadySubmitted);
        httpErr.alreadyPaid = Boolean(json?.alreadyPaid);
        throw httpErr;
      }

      return json as T;
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;

      const isNetworkIssue = isTransientNetworkError(err);

      // Bounded backoff retry on transient network glitches
      if (isNetworkIssue && attempt < maxAttempts) {
        if (IS_DEV) {
          console.log(`[ApiClient] Retry ${attempt}/${maxAttempts - 1} for ${method} ${url}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
        continue;
      }

      // Attempt automatic LAN auto-heal ONLY in __DEV__ when primary URL is not a production HTTPS domain
      if (
        isNetworkIssue &&
        IS_DEV &&
        !options.disableAutoHeal &&
        !isProductionHttpsUrl(baseUrl)
      ) {
        const candidates = getCandidateDevUrls().filter((candidate) => candidate !== baseUrl);
        for (const candidateBase of candidates) {
          try {
            if (IS_DEV) {
              console.log(
                `[ApiClient Auto-Heal] Primary ${url} failed. Probing fallback ${candidateBase}${cleanEndpoint}...`
              );
            }
            const fallbackController = new AbortController();
            const fallbackTimer = setTimeout(() => fallbackController.abort(), 7000);
            const fallbackRes = await fetch(`${candidateBase}${cleanEndpoint}`, {
              method,
              headers,
              signal: fallbackController.signal,
              ...(options.body !== undefined && method !== 'GET'
                ? { body: typeof options.body === 'string' ? options.body : JSON.stringify(options.body) }
                : {}),
            });
            clearTimeout(fallbackTimer);

            const rawFallback = await fallbackRes.text();
            const parsedFallback = parseJsonResponse(fallbackRes, rawFallback);
            if (
              fallbackRes.ok &&
              !parsedFallback.isHtml &&
              !parsedFallback.isInvalidJson &&
              parsedFallback.json &&
              (cleanEndpoint !== '/api/health' || parsedFallback.json?.database !== 'disconnected')
            ) {
              if (IS_DEV) {
                console.log(`[ApiClient Auto-Heal] Switched active backend URL to ${candidateBase}`);
              }
              await setApiBaseUrl(candidateBase);
              return parsedFallback.json as T;
            }
          } catch (fallbackErr: any) {
            if (IS_DEV) {
              console.warn(`[ApiClient Auto-Heal] Fallback ${candidateBase} unreachable:`, fallbackErr?.message || fallbackErr);
            }
          }
        }
      }

      if (err?.name === 'AbortError') {
        if (IS_DEV) {
          console.warn(`[ApiClient Diagnostic] Timeout (${timeoutMs}ms) on ${method} ${url}`);
        }
        throw new Error('Connection timed out. Please check your network connection and try again.');
      }

      if (isNetworkIssue || err?.isNonJsonResponse) {
        if (IS_DEV) {
          console.warn(`[ApiClient Diagnostic] ${method} ${url} failed: ${err?.message || err}`);
        }
        throw new Error(
          'Unable to connect to FreshCart server. Please check your network connection and try again.'
        );
      }

      throw err;
    }
  }

  throw lastError || new Error('Request failed');
}

export async function request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const method = options.method || 'GET';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  let effectiveToken = options.token;
  if (!effectiveToken) {
    try {
      const isStaffOrAdmin =
        cleanEndpoint.startsWith('/api/admin') ||
        cleanEndpoint === '/api/payment-settings/upi' ||
        cleanEndpoint === '/api/settings';
      if (isStaffOrAdmin) {
        const raw = await AsyncStorage.getItem('freshcart_mobile_admin_session');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.token) effectiveToken = parsed.token;
        }
      }
    } catch {}
  }

  if (effectiveToken) {
    headers['Authorization'] = `Bearer ${effectiveToken}`;
    if (!options.customerScoped) {
      headers['x-admin-token'] = effectiveToken;
      headers['x-staff-token'] = effectiveToken;
      headers['x-admin-role'] = 'admin';
    }
  }

  // Deduplicate simultaneous identical GET requests to prevent overlapping network storms
  if (method === 'GET' && !options.skipDedup) {
    const tokenScope = effectiveToken ? String(effectiveToken).slice(-12) : 'anon';
    const dedupKey = `GET:${cleanEndpoint}:${tokenScope}`;
    const existing = inFlightGetRequests.get(dedupKey);
    if (existing) {
      return existing as Promise<T>;
    }
    const pendingPromise = executeRequest<T>(
      endpoint,
      options,
      cleanEndpoint,
      effectiveToken,
      headers
    ).finally(() => {
      inFlightGetRequests.delete(dedupKey);
    });
    inFlightGetRequests.set(dedupKey, pendingPromise);
    return pendingPromise;
  }

  return executeRequest<T>(endpoint, options, cleanEndpoint, effectiveToken, headers);
}

/**
 * Strips raw IPs, internal ports, URLs, and Java stack trace headers from user-facing UI messages
 */
export function cleanErrorMessage(err: any, fallback = 'Unable to connect to FreshCart server.'): string {
  if (!err) return fallback;
  const raw = typeof err === 'string' ? err : err?.message || fallback;
  if (
    raw.includes('ConnectException') ||
    raw.includes('Failed to connect') ||
    raw.includes('SocketTimeoutException') ||
    raw.includes('Unable to resolve host') ||
    raw.includes('Cleartext HTTP traffic') ||
    raw.includes('Network request failed') ||
    raw.includes('fetch failed') ||
    raw.includes('Load failed') ||
    raw.includes('ECONNREFUSED') ||
    raw.includes('EHOSTUNREACH') ||
    raw.includes('ENETUNREACH') ||
    raw.includes('ENOTFOUND') ||
    raw.includes('timed out') ||
    raw.includes('AbortError') ||
    raw.includes('Unable to connect') ||
    raw.includes('Connection unavailable') ||
    raw.includes('NetworkError')
  ) {
    return 'Unable to connect to FreshCart server. Please check your network connection and try again.';
  }
  return raw
    .replace(/https?:\/\/[^\s]+/gi, '')
    .replace(/\/?\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?\b/g, '')
    .replace(/localhost(:\d+)?/gi, '')
    .replace(/\bport \d+\b/gi, '')
    .trim() || fallback;
}

// -------------------------------------------------------------
// Authentication APIs
// -------------------------------------------------------------
export const authApi = {
  // Shared login endpoint handles customer, employee, and admin roles
  async login(identifier: string, pass: string) {
    return request('/api/auth/login', {
      method: 'POST',
      body: { identifier: identifier.trim(), password: pass },
    });
  },

  async adminLogin(identifier: string, pass: string) {
    return request('/api/admin/login', {
      method: 'POST',
      body: { identifier: identifier.trim(), password: pass },
    });
  },

  async register(data: {
    fullName: string;
    email: string;
    mobile: string;
    password: string;
    address?: string;
    transactionRef?: string;
    paymentProof?: string;
    mimeType?: string;
    fileName?: string;
  }) {
    return request('/api/auth/register', {
      method: 'POST',
      body: {
        name: data.fullName,
        fullName: data.fullName,
        email: data.email,
        phone: data.mobile,
        mobile: data.mobile,
        password: data.password,
        address: data.address,
        transactionRef: data.transactionRef,
        paymentProof: data.paymentProof,
        mimeType: data.mimeType,
        fileName: data.fileName,
      },
    });
  },

  async forgotPassword(email: string) {
    return request('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: email.trim().toLowerCase() },
    });
  },

  async resetPassword(token: string, newPassword: string) {
    return request('/api/auth/reset-password', {
      method: 'POST',
      body: { token, newPassword },
    });
  },

  async getMe(token: string) {
    return request('/api/auth/me', { token });
  },

  async updateProfile(token: string, updates: { name?: string; phone?: string; address?: string }) {
    return request('/api/auth/profile', {
      method: 'PUT',
      token,
      body: updates,
    });
  },

  async addAddress(token: string, address: { label: string; street: string; city: string; state: string; zip: string; isDefault?: boolean }) {
    return request('/api/auth/address', {
      method: 'POST',
      token,
      body: address,
    });
  },
};

// -------------------------------------------------------------
// Admin APIs
// -------------------------------------------------------------
export const adminApi = {
  async getOverview(token: string) {
    return request('/api/admin/overview', { token });
  },

  async getProducts() {
    const res = await request<{ success: boolean; products: Product[] }>('/api/products');
    return res.products || [];
  },

  async addProduct(token: string, product: Partial<Product>) {
    return request('/api/products', {
      method: 'POST',
      token,
      body: product,
    });
  },

  async updateProduct(token: string, id: string, product: Partial<Product>) {
    return request(`/api/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      token,
      body: product,
    });
  },

  async deleteProduct(token: string, id: string) {
    return request(`/api/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      token,
    });
  },

  async getInventoryLogs(token: string) {
    const res = await request<{ success: boolean; logs: InventoryLog[] }>('/api/inventory/logs', { token });
    return res.logs || [];
  },

  async getEmployees(token: string) {
    return request('/api/admin/employees', { token });
  },

  async addEmployee(token: string, data: {
    fullName: string;
    email: string;
    mobile?: string;
    username?: string;
    password: string;
  }) {
    return request('/api/admin/employees', {
      method: 'POST',
      token,
      body: data,
    });
  },

  async updateEmployee(token: string, employeeId: string, data: {
    fullName?: string;
    email?: string;
    mobile?: string;
    username?: string;
    status?: 'active' | 'inactive';
  }) {
    return request(`/api/admin/employees/${encodeURIComponent(employeeId)}`, {
      method: 'PUT',
      token,
      body: data,
    });
  },

  async toggleEmployeeStatus(token: string, employeeId: string, status: 'active' | 'inactive') {
    return request(`/api/admin/employees/${encodeURIComponent(employeeId)}/status`, {
      method: 'PATCH',
      token,
      body: { status },
    });
  },

  async resetEmployeePassword(token: string, employeeId: string, newPassword: string) {
    return request(`/api/admin/employees/${encodeURIComponent(employeeId)}/reset-password`, {
      method: 'POST',
      token,
      body: { newPassword },
    });
  },

  async deleteEmployee(token: string, employeeId: string) {
    return request(`/api/admin/employees/${encodeURIComponent(employeeId)}`, {
      method: 'DELETE',
      token,
    });
  },

  async getCustomers(token: string, search?: string) {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return request(`/api/admin/customers${q}`, { token });
  },

  async updateCustomerStatus(token: string, customerId: string, status: 'Active' | 'Suspended') {
    return request(`/api/admin/customers/${encodeURIComponent(customerId)}/status`, {
      method: 'PATCH',
      token,
      body: { status },
    });
  },

  async getOrders(token?: string) {
    const res = await request<{ success: boolean; orders: Order[] }>('/api/orders', { token });
    return res.orders || [];
  },

  async updateOrderStatus(orderId: string, status: string, token?: string) {
    return request(`/api/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PUT',
      token,
      body: { status },
    });
  },

  async confirmCashCollection(orderId: string, token?: string) {
    const cleanId = orderId.replace(/^#/, '');
    return request<{
      success: boolean;
      error?: string;
      paymentStatus?: string;
      status?: string;
      verifiedAt?: string;
      verifiedBy?: string;
    }>(`/api/orders/${encodeURIComponent(cleanId)}/confirm-cash-collection`, {
      method: 'POST',
      token,
      body: {},
    });
  },

  async deleteOrder(orderId: string, token?: string) {
    return request(`/api/orders/${encodeURIComponent(orderId)}`, {
      method: 'DELETE',
      token,
    });
  },

  async getOrdersToDeliver(token: string) {
    return request('/api/admin/orders-to-deliver', { token });
  },

  async assignOrder(token: string, orderId: string, employeeId: string) {
    return request(`/api/admin/orders/${encodeURIComponent(orderId)}/assign`, {
      method: 'POST',
      token,
      body: { employeeId },
    });
  },

  async autoAssignOrders(token: string) {
    return request('/api/admin/orders/auto-assign', {
      method: 'POST',
      token,
    });
  },

  async getCoupons() {
    const res = await request<{ success: boolean; coupons: Coupon[] }>('/api/coupons');
    return res.coupons || [];
  },

  async addCoupon(token: string, coupon: Partial<Coupon>) {
    return request('/api/coupons', {
      method: 'POST',
      token,
      body: coupon,
    });
  },

  async updateCoupon(token: string, code: string, coupon: Partial<Coupon>) {
    return request(`/api/coupons/${encodeURIComponent(code)}`, {
      method: 'PUT',
      token,
      body: coupon,
    });
  },

  async deleteCoupon(token: string, code: string) {
    return request(`/api/coupons/${encodeURIComponent(code)}`, {
      method: 'DELETE',
      token,
    });
  },

  async getDeliverySettings() {
    return request<{ success: boolean; settings: AppSettings }>('/api/settings');
  },

  async updateDeliverySettings(token: string, settings: Partial<AppSettings>) {
    return request<{ success: boolean; settings: AppSettings }>('/api/settings', {
      method: 'POST',
      token,
      body: settings,
    });
  },

  async getUpiSettings(amount?: number) {
    const q = amount !== undefined && amount > 0 ? `?amount=${amount}` : '';
    return request<{
      success: boolean;
      settings: UpiPaymentSettings | null;
      upiId?: string;
      merchantName?: string;
      qrCodeDataUrl?: string;
      qrCodeUrl?: string;
      upiUri?: string;
    }>(`/api/payment-settings/upi${q}`);
  },

  async getUpiQrCode(amount?: number) {
    const q = amount !== undefined && amount > 0 ? `?amount=${amount}&format=json` : '?format=json';
    return request<{
      success: boolean;
      upiId: string;
      merchantName: string;
      amount?: number;
      upiUri: string;
      qrCodeDataUrl: string;
    }>(`/api/payment-settings/upi/qr${q}`);
  },

  async saveUpiSettings(
    token: string,
    settings: {
      upiId: string;
      merchantName: string;
      enabled?: boolean;
      qrCodeUrl?: string;
    }
  ) {
    return request<{ success: boolean; settings?: UpiPaymentSettings; error?: string }>(
      '/api/payment-settings/upi',
      {
        method: 'POST',
        token,
        body: settings,
      }
    );
  },

  async getAuthorizedAdmins(token: string) {
    return request<{
      success: boolean;
      admins: AuthorizedAdmin[];
      activeCount: number;
      maxLimit: number;
      error?: string;
    }>('/api/admin/users', { token });
  },

  async createAuthorizedAdmin(
    token: string,
    data: {
      fullName: string;
      email: string;
      password: string;
      adminId?: string;
    }
  ) {
    return request<{ success: boolean; admin?: AuthorizedAdmin; error?: string }>('/api/admin/users', {
      method: 'POST',
      token,
      body: data,
    });
  },

  async toggleAdminStatus(token: string, adminId: string, status: 'active' | 'inactive') {
    return request<{ success: boolean; error?: string }>(
      `/api/admin/users/${encodeURIComponent(adminId)}/status`,
      {
        method: 'PATCH',
        token,
        body: { status },
      }
    );
  },

  async deleteAuthorizedAdmin(token: string, adminId: string) {
    return request<{ success: boolean; error?: string }>(`/api/admin/users/${encodeURIComponent(adminId)}`, {
      method: 'DELETE',
      token,
    });
  },

  async getDailyReport(token: string, dateStr: string): Promise<DailyReportResponse> {
    return request<DailyReportResponse>(`/api/admin/reports/daily?date=${encodeURIComponent(dateStr)}`, {
      token,
    });
  },

  async getCalendarMonthSummary(
    token: string,
    year: number,
    month: number
  ): Promise<CalendarMonthResponse> {
    return request<CalendarMonthResponse>(`/api/admin/reports/calendar-month?year=${year}&month=${month}`, {
      token,
    });
  },

  async getPaymentVerificationQueue(token: string) {
    return request('/api/admin/payments/verification-queue', { token });
  },

  async verifyPayment(token: string, orderId: string, action: 'APPROVE' | 'REJECT', notes?: string) {
    return request('/api/admin/payments/verify', {
      method: 'POST',
      token,
      body: { orderId, action, notes },
    });
  },

  async deletePaymentOrder(token: string, orderId: string) {
    return request('/api/admin/payments/delete-order', {
      method: 'POST',
      token,
      body: { orderId },
    });
  },
};

// -------------------------------------------------------------
// Employee APIs
// -------------------------------------------------------------
export const employeeApi = {
  async getProfile(token: string) {
    return request<{ success: boolean; employee: AuthorizedEmployee }>('/api/employee/me', { token });
  },

  async getAssignedDeliveries(token: string, includeDelivered: boolean = false) {
    const q = includeDelivered ? '?includeDelivered=true' : '';
    return request<{ success: boolean; orders: PendingDeliveryOrder[]; workload?: number }>(
      `/api/employee/assigned-deliveries${q}`,
      { token }
    );
  },

  async verifyOtp(orderId: string, otp: string) {
    return request('/api/otp/verify', {
      method: 'POST',
      body: { orderId, otp },
    });
  },

  async updateDeliveryStatus(orderId: string, status: string, token?: string) {
    return request(`/api/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PUT',
      token,
      body: { status },
    });
  },

  async confirmCashCollection(orderId: string, token?: string) {
    return request(`/api/orders/${encodeURIComponent(orderId)}/confirm-cash-collection`, {
      method: 'POST',
      token,
      body: {},
    });
  },
};

// -------------------------------------------------------------
// Customer APIs
// -------------------------------------------------------------
export const customerApi = {
  async checkHealth() {
    return request<{ status: string; database?: string; productCount?: number }>('/api/health', {
      timeoutMs: 8000,
      retries: 1,
    });
  },

  async getProducts(params?: { category?: string; search?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params?.category && params.category !== 'all') query.set('category', params.category);
    if (params?.search && params.search.trim()) query.set('search', params.search.trim());
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));

    const qs = query.toString();
    const endpoint = qs ? `/api/products?${qs}` : '/api/products';
    const res = await request<{
      success: boolean;
      products: Product[];
      total?: number;
      count?: number;
      hasMore?: boolean;
      error?: string;
    }>(endpoint);

    if (!res || res.success === false || !Array.isArray(res.products)) {
      throw new Error(res?.error || 'Unexpected response format from products API.');
    }

    return res.products;
  },

  async getAllProducts(params?: { category?: string; search?: string }): Promise<Product[]> {
    try {
      const query = new URLSearchParams();
      if (params?.category && params.category !== 'all') query.set('category', params.category);
      if (params?.search && params.search.trim()) query.set('search', params.search.trim());
      const qs = query.toString();
      const endpoint = qs ? `/api/products?${qs}` : '/api/products';

      const res = await request<{
        success: boolean;
        products: Product[];
        total?: number;
        hasMore?: boolean;
        error?: string;
      }>(endpoint);

      if (!res || res.success === false || !Array.isArray(res.products)) {
        throw new Error(res?.error || 'Unexpected response format from products API.');
      }

      const all: Product[] = [...res.products];
      const seen = new Set<string>(all.map((p) => p.id));
      const total = res.total ?? all.length;

      // If backend paginated, automatically fetch all remaining pages to ensure 100% complete catalogue
      if (res.hasMore && all.length < total) {
        let offset = all.length;
        const batchSize = 50;

        while (all.length < total) {
          const pageQuery = new URLSearchParams();
          if (params?.category && params.category !== 'all') pageQuery.set('category', params.category);
          if (params?.search && params.search.trim()) pageQuery.set('search', params.search.trim());
          pageQuery.set('offset', String(offset));
          pageQuery.set('limit', String(batchSize));

          const pageRes = await request<{
            success: boolean;
            products: Product[];
            total?: number;
            hasMore?: boolean;
          }>(`/api/products?${pageQuery.toString()}`);

          if (!pageRes?.products || pageRes.products.length === 0) break;

          for (const item of pageRes.products) {
            if (!seen.has(item.id)) {
              seen.add(item.id);
              all.push(item);
            }
          }

          if (!pageRes.hasMore || pageRes.products.length < batchSize) break;
          offset += pageRes.products.length;
        }
      }

      return all;
    } catch (err) {
      if (IS_DEV) {
        console.warn('getAllProducts error:', err);
      }
      throw err;
    }
  },

  async getCart(token: string) {
    return request('/api/cart', { token });
  },

  async saveCartItem(token: string, productId: string, quantity: number) {
    return request('/api/cart/items', {
      method: 'POST',
      token,
      body: { productId, quantity },
    });
  },

  async removeCartItem(token: string, productId: string) {
    return request(`/api/cart/items/${encodeURIComponent(productId)}`, {
      method: 'DELETE',
      token,
    });
  },

  async clearCart(token: string) {
    return request('/api/cart', {
      method: 'DELETE',
      token,
    });
  },

  async placeOrder(orderData: any, token?: string) {
    return request('/api/orders', {
      method: 'POST',
      token,
      customerScoped: true,
      retries: 0,
      body: orderData,
    });
  },

  async getCustomerOrders(customerId?: string, token?: string) {
    const q = customerId ? `?customerId=${encodeURIComponent(customerId)}` : '';
    const res = await request<{ success: boolean; orders: Order[] }>(`/api/orders${q}`, {
      token,
      customerScoped: true,
    });
    return res.orders || [];
  },

  async validateCoupon(code: string, subtotal: number) {
    return request('/api/coupons/validate', {
      method: 'POST',
      body: { code, subtotal },
    });
  },

  async getUpiSettings(amount?: number) {
    const q = amount !== undefined && amount > 0 ? `?amount=${amount}` : '';
    return request<{
      success: boolean;
      settings: UpiPaymentSettings | null;
      upiId?: string;
      merchantName?: string;
      qrCodeDataUrl?: string;
      qrCodeUrl?: string;
      upiUri?: string;
    }>(`/api/payment-settings/upi${q}`);
  },

  async getUpiQrCode(amount?: number) {
    const q = amount !== undefined && amount > 0 ? `?amount=${amount}&format=json` : '?format=json';
    return request<{
      success: boolean;
      upiId: string;
      merchantName: string;
      amount?: number;
      upiUri: string;
      qrCodeDataUrl: string;
    }>(`/api/payment-settings/upi/qr${q}`);
  },

  async initiateUpi(paymentData: {
    orderId: string;
    customerId?: string;
    amount: number;
    upiId?: string;
    merchantName?: string;
    transactionRef: string;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    deliveryAddress?: string;
  }) {
    return request('/api/payments/initiate-upi', {
      method: 'POST',
      customerScoped: true,
      retries: 0,
      body: paymentData,
    });
  },

  async uploadScreenshotProof(
    orderId: string,
    fileData: string,
    token?: string,
    mimeType?: string,
    fileName?: string,
    customerId?: string,
    replaceDraft = false
  ) {
    const cleanOrderId = (orderId || '').trim();
    if (!cleanOrderId) {
      throw new Error('Order ID is missing. Please restart checkout and try again.');
    }
    const cleanData = (fileData || '').trim();
    if (!cleanData) {
      throw new Error('Selected payment screenshot appears empty. Please select the image again.');
    }

    const mime =
      mimeType ||
      (cleanData.startsWith('data:application/pdf')
        ? 'application/pdf'
        : cleanData.startsWith('data:image/png')
        ? 'image/png'
        : 'image/jpeg');
    const screenshot = cleanData.startsWith('data:') ? cleanData : `data:${mime};base64,${cleanData}`;

    const extraHeaders: Record<string, string> = {};
    if (!token && customerId) {
      extraHeaders['x-customer-id'] = customerId;
    }

    return request<{
      success: boolean;
      message?: string;
      paymentStatus?: string;
      orderId?: string;
      screenshotUrl?: string;
      fileSize?: number;
      mimeType?: string;
      alreadySubmitted?: boolean;
      alreadyPaid?: boolean;
      error?: string;
    }>('/api/payments/screenshot/upload', {
      method: 'POST',
      token,
      customerScoped: true,
      headers: extraHeaders,
      timeoutMs: 45000,
      retries: 0,
      body: {
        orderId: cleanOrderId,
        screenshot,
        mimeType: mime,
        fileName: fileName || (mime === 'application/pdf' ? 'proof.pdf' : 'proof.jpg'),
        ...(replaceDraft ? { replaceDraft: true } : {}),
        ...(!token && customerId ? { customerId } : {}),
      },
    });
  },

  async removeScreenshotProof(orderId: string, token?: string, customerId?: string) {
    const cleanOrderId = (orderId || '').trim();
    if (!cleanOrderId) return { success: true };

    const extraHeaders: Record<string, string> = {};
    if (!token && customerId) {
      extraHeaders['x-customer-id'] = customerId;
    }

    return request<{ success: boolean; paymentStatus?: string; message?: string; error?: string }>(
      `/api/payments/screenshot/${encodeURIComponent(cleanOrderId)}`,
      {
        method: 'DELETE',
        token,
        customerScoped: true,
        headers: extraHeaders,
        retries: 0,
      }
    );
  },

  async getOtpStatus(orderId: string) {
    return request(`/api/otp/status/${encodeURIComponent(orderId)}`);
  },

  async confirmOrder(orderId: string, orderData: any, token?: string) {
    return request('/api/orders/confirm', {
      method: 'POST',
      token,
      customerScoped: true,
      retries: 0,
      body: { orderId, ...orderData, confirmed: true },
    });
  },
};

// -------------------------------------------------------------
// Settings APIs
// -------------------------------------------------------------
export const settingsApi = {
  async getSettings() {
    return request<{
      success: boolean;
      settings: {
        deliveryChargeRules: DeliveryChargeRule[];
        deliveryCharges: number;
      };
    }>('/api/settings');
  },
};

// -------------------------------------------------------------
// AI Assistant APIs
// -------------------------------------------------------------
export interface AssistantChatPayload {
  message: string;
  token?: string | null;
  customerId?: string;
  language?: string;
  pendingAction?: any;
  extraPayload?: Record<string, any>;
}

export interface AssistantChatResponse {
  success: boolean;
  message: string;
  spokenMessage?: string;
  language?: string;
  intent: string;
  actionExecuted?: boolean;
  cartUpdated?: boolean;
  cartItems?: any[];
  products?: any[];
  coupons?: any[];
  quickReplies?: string[];
  groceryListReview?: any;
  error?: string;
}

export const assistantApi = {
  async chat(payload: AssistantChatPayload): Promise<AssistantChatResponse> {
    const headers: Record<string, string> = {
      'x-client-platform': 'mobile',
      'x-client': 'mobile',
    };
    if (payload.customerId) {
      headers['x-customer-id'] = payload.customerId;
    }
    return request<AssistantChatResponse>('/api/assistant/chat', {
      method: 'POST',
      token: payload.token || (payload.customerId ? payload.customerId : 'guest_mobile'),
      headers,
      body: {
        message: payload.message,
        customerId: payload.customerId || 'guest_mobile',
        language: payload.language || 'en-IN',
        pendingAction: payload.pendingAction,
        ...(payload.extraPayload || {}),
      },
    });
  },
};

