import { getApiBaseUrl } from '../config/api';
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

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  token?: string | null;
  timeoutMs?: number;
}

export async function request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const baseUrl = await getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${cleanEndpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
    headers['x-admin-token'] = options.token;
    headers['x-staff-token'] = options.token;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 15000);

  try {
    const fetchOptions: RequestInit = {
      method: options.method || 'GET',
      headers,
      signal: controller.signal,
    };

    if (options.body !== undefined && options.method !== 'GET') {
      fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    const res = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errorMsg = json?.error || json?.message || `HTTP ${res.status}: Request failed`;
      throw new Error(errorMsg);
    }

    return json as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Connection timed out. Please check that FreshCart server is running.');
    }
    if (
      err.message === 'Load failed' ||
      err.message?.includes('Failed to fetch') ||
      err.message?.includes('NetworkError')
    ) {
      throw new Error(`Unable to connect to FreshCart backend at ${baseUrl}. Please ensure the server is active.`);
    }
    throw err;
  }
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
  }) {
    return request('/api/auth/register', {
      method: 'POST',
      body: data,
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

  async getUpiSettings() {
    return request<{ success: boolean; settings: UpiPaymentSettings | null; upiId?: string; merchantName?: string }>(
      '/api/payment-settings/upi'
    );
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
  async getProducts() {
    const res = await request<{ success: boolean; products: Product[] }>('/api/products');
    return res.products || [];
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
      body: orderData,
    });
  },

  async getCustomerOrders(customerId?: string, token?: string) {
    const q = customerId ? `?customerId=${encodeURIComponent(customerId)}` : '';
    const res = await request<{ success: boolean; orders: Order[] }>(`/api/orders${q}`, { token });
    return res.orders || [];
  },

  async validateCoupon(code: string, subtotal: number) {
    return request('/api/coupons/validate', {
      method: 'POST',
      body: { code, subtotal },
    });
  },

  async getUpiSettings() {
    return request<{ success: boolean; settings: UpiPaymentSettings | null; upiId?: string; merchantName?: string }>(
      '/api/payment-settings/upi'
    );
  },

  async initiateUpi(paymentData: {
    orderId: string;
    customerId?: string;
    amount: number;
    transactionRef: string;
    customerName?: string;
    customerPhone?: string;
  }) {
    return request('/api/payments/initiate-upi', {
      method: 'POST',
      body: paymentData,
    });
  },

  async uploadScreenshotProof(orderId: string, base64Image: string, token?: string) {
    return request('/api/payments/screenshot/upload', {
      method: 'POST',
      token,
      body: {
        orderId,
        screenshot: base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}`,
      },
    });
  },

  async getOtpStatus(orderId: string) {
    return request(`/api/otp/status/${encodeURIComponent(orderId)}`);
  },

  async confirmOrder(orderId: string, orderData: any, token?: string) {
    return request('/api/orders/confirm', {
      method: 'POST',
      token,
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
  error?: string;
}

export const assistantApi = {
  async chat(payload: AssistantChatPayload): Promise<AssistantChatResponse> {
    const headers: Record<string, string> = {};
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

