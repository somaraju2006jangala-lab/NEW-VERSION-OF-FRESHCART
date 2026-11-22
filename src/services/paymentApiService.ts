import {
  RazorpayOrderResponse,
  PaymentVerificationRequest,
  VerifiedPaymentResult,
  PaymentTransactionRecord,
} from '../types/payment';

// Default to Render Razorpay backend service or local port 5001 if available
const PROD_RAZORPAY_BACKEND_URL = 'https://razorpaysample.onrender.com/api';
const LOCAL_RAZORPAY_BACKEND_URL = 'http://localhost:5001/api';

export function getRazorpayBackendUrl(): string {
  if (import.meta.env.VITE_RAZORPAY_BACKEND_URL) {
    return import.meta.env.VITE_RAZORPAY_BACKEND_URL.replace(/\/$/, '');
  }
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '');
  }
  if (
    typeof window !== 'undefined' &&
    window.location &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    return LOCAL_RAZORPAY_BACKEND_URL;
  }
  return PROD_RAZORPAY_BACKEND_URL;
}

export interface CreateOrderParams {
  freshcart_order_id: string;
  items: Array<{
    id: string;
    title: string;
    price: number;
    quantity: number;
    selectedPackSize?: string;
  }>;
  appliedCoupon?: string | null;
  deliveryAddress: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
}

export class PaymentApiService {
  private static cachedHealth: { healthy: boolean; timestamp: number } | null = null;
  private static orderInFlight: Map<string, Promise<RazorpayOrderResponse>> = new Map();
  private static lastWarmUpTimestamp = 0;
  private static warmUpInFlight: Promise<boolean> | null = null;
  private static WARM_UP_CACHE_TTL_MS = 90000; // 90 seconds deduplication cache

  /**
   * Helper fetch with timeout and retry for Render cold start tolerance (up to 90s).
   */
  private static async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeoutMs = 90000,
    retries = 1,
    retryDelayMs = 2500
  ): Promise<Response> {
    let lastError: any = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        // 502/503/504 indicates Render backend container is still spinning up
        if (
          (response.status === 502 || response.status === 503 || response.status === 504) &&
          attempt < retries
        ) {
          console.warn(`[RazorpayGateway] Backend container waking up (HTTP ${response.status}). Retrying...`);
          await new Promise((r) => setTimeout(r, retryDelayMs));
          continue;
        }

        return response;
      } catch (err: any) {
        lastError = err;
        const isAbort = err.name === 'AbortError';
        if (attempt < retries && isAbort) {
          console.warn(`[RazorpayGateway] Request timed out. Retrying in ${retryDelayMs}ms...`);
          await new Promise((r) => setTimeout(r, retryDelayMs));
          continue;
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw lastError || new Error('Request failed after retries.');
  }

  /**
   * Lightweight health-check / warm-up probe triggered when customer clicks the Cart icon.
   * Completely asynchronous, non-blocking, and deduplicated (skips redundant requests within 90s).
   * Tolerates sleeping Render backend cold start.
   */
  static async warmUpRazorpayBackend(): Promise<boolean> {
    const now = Date.now();
    // 1. Deduplication: skip redundant requests if user opens/closes cart multiple times within 90s
    if (now - this.lastWarmUpTimestamp < this.WARM_UP_CACHE_TTL_MS) {
      console.log('[RazorpayWarmUp] Backend was recently warmed up. Skipping redundant ping.');
      return true;
    }

    // 2. In-flight deduplication: reuse active probe
    if (this.warmUpInFlight) {
      console.log('[RazorpayWarmUp] Reusing in-flight warm-up probe...');
      return this.warmUpInFlight;
    }

    this.warmUpInFlight = (async () => {
      try {
        console.log('[RazorpayWarmUp] Cart icon clicked: Sending lightweight warm-up ping to Razorpay backend...');
        const primaryUrl = getRazorpayBackendUrl();

        // Send lightweight GET request to /health
        let res: Response | null = null;
        try {
          res = await this.fetchWithTimeout(`${primaryUrl}/health`, { method: 'GET' }, 90000, 1, 2000);
        } catch (fetchErr: any) {
          // If local port 5001 is not running, fall back to Render production backend
          if (primaryUrl !== PROD_RAZORPAY_BACKEND_URL) {
            console.log('[RazorpayWarmUp] Local backend unavailable. Falling back to Render production backend...');
            res = await this.fetchWithTimeout(`${PROD_RAZORPAY_BACKEND_URL}/health`, { method: 'GET' }, 90000, 1, 2000);
          } else {
            throw fetchErr;
          }
        }

        if (res && res.ok) {
          console.log('[RazorpayWarmUp] Razorpay backend is warm and ready.');
          this.lastWarmUpTimestamp = Date.now();
          this.cachedHealth = { healthy: true, timestamp: Date.now() };
          return true;
        }
        return false;
      } catch (err: any) {
        console.warn('[RazorpayWarmUp] Background warm-up notice (non-blocking):', err.message);
        return false;
      } finally {
        this.warmUpInFlight = null;
      }
    })();

    return this.warmUpInFlight;
  }

  /**
   * Pre-warm / ping payment backend health
   */
  static async checkHealth(): Promise<boolean> {
    const now = Date.now();
    if (this.cachedHealth && now - this.cachedHealth.timestamp < 60000) {
      return this.cachedHealth.healthy;
    }

    try {
      // First check local FreshCart server
      const localRes = await fetch('/api/payment/health', { signal: AbortSignal.timeout(3000) }).catch(() => null);
      if (localRes && localRes.ok) {
        this.cachedHealth = { healthy: true, timestamp: now };
        return true;
      }

      // Then check direct Razorpay backend
      const rzpUrl = getRazorpayBackendUrl();
      const res = await this.fetchWithTimeout(`${rzpUrl}/health`, {}, 15000, 0);
      const healthy = res.ok;
      this.cachedHealth = { healthy, timestamp: now };
      return healthy;
    } catch {
      return false;
    }
  }

  /**
   * Creates a Razorpay order through the authoritative backend.
   * Calculations are strictly verified on the server side using product catalog and coupon rules.
   */
  static async createOrder(params: CreateOrderParams): Promise<RazorpayOrderResponse> {
    const orderKey = params.freshcart_order_id;
    const existing = this.orderInFlight.get(orderKey);
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      try {
        console.log(`[RazorpayGateway] Requesting server-verified order creation for ${params.freshcart_order_id}...`);

        // 1. First attempt to route through FreshCart's server endpoint (/api/payment/create-order)
        // which authoritatively calculates total from MySQL and calls the Razorpay backend
        try {
          const freshcartRes = await this.fetchWithTimeout(
            '/api/payment/create-order',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(params),
            },
            45000,
            1,
            2000
          );

          if (freshcartRes.ok) {
            const result = await freshcartRes.json();
            if (result.success && result.data?.razorpay_order_id) {
              console.log(`[RazorpayGateway] Order created via FreshCart server: ${result.data.razorpay_order_id}`);
              return result.data;
            }
          }
        } catch (localErr: any) {
          console.warn('[RazorpayGateway] Local endpoint notice, falling back to direct Razorpay backend:', localErr.message);
        }

        // 2. Direct fallback to Razorpay Render Backend
        const subtotal = params.items.reduce((sum, it) => sum + it.price * it.quantity, 0);
        const rzpBackendUrl = getRazorpayBackendUrl();
        const res = await this.fetchWithTimeout(
          `${rzpBackendUrl}/orders/create`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              freshcart_order_id: params.freshcart_order_id,
              amount: subtotal, // Fallback; backend validates
              currency: 'INR',
              customer: params.customer,
              items: params.items,
              notes: {
                delivery_address: params.deliveryAddress,
                applied_coupon: params.appliedCoupon || '',
              },
            }),
          },
          90000,
          1,
          2500
        );

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data?.error || `Failed to create payment order (HTTP ${res.status}).`);
        }

        return data.data;
      } finally {
        this.orderInFlight.delete(orderKey);
      }
    })();

    this.orderInFlight.set(orderKey, promise);
    return promise;
  }

  /**
   * Authoritatively verifies Razorpay HMAC-SHA256 signature with the backend.
   * Never marks an order paid on client side without server verification.
   */
  static async verifyPayment(payload: PaymentVerificationRequest): Promise<VerifiedPaymentResult> {
    console.log(`[RazorpayGateway] Verifying cryptographic signature for ${payload.freshcart_order_id}...`);

    // 1. First attempt to verify via FreshCart's server endpoint (/api/payment/verify)
    try {
      const res = await this.fetchWithTimeout(
        '/api/payment/verify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        30000,
        1,
        1500
      );

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data?.verified) {
          return data.data;
        }
      }
    } catch (err: any) {
      console.warn('[RazorpayGateway] Local verification notice, checking direct backend:', err.message);
    }

    // 2. Fallback to direct Razorpay backend verification
    const rzpBackendUrl = getRazorpayBackendUrl();
    const directRes = await this.fetchWithTimeout(
      `${rzpBackendUrl}/payments/verify`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      30000,
      1,
      1500
    );

    const directData = await directRes.json();
    if (!directRes.ok || !directData.success) {
      throw new Error(directData.error || 'Payment signature verification failed.');
    }

    return directData.data;
  }

  /**
   * Reports payment dismissal or failure to backend audit logs.
   */
  static async reportFailure(params: {
    freshcart_order_id: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    error_code?: string;
    error_description?: string;
  }): Promise<void> {
    try {
      await fetch('/api/payment/report-failure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      }).catch(() => null);

      const rzpBackendUrl = getRazorpayBackendUrl();
      await fetch(`${rzpBackendUrl}/payments/report-failure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      }).catch(() => null);
    } catch (err) {
      console.warn('Failed to report failure:', err);
    }
  }

  /**
   * Retrieves verified transaction records for the Admin Portal.
   */
  static async getAdminTransactions(): Promise<PaymentTransactionRecord[]> {
    try {
      const localRes = await fetch('/api/payment/transactions').catch(() => null);
      if (localRes && localRes.ok) {
        const localData = await localRes.json();
        if (localData.success && Array.isArray(localData.transactions)) {
          return localData.transactions;
        }
      }

      const rzpBackendUrl = getRazorpayBackendUrl();
      const res = await fetch(`${rzpBackendUrl}/admin/transactions`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          return data.data;
        }
      }
    } catch (err) {
      console.warn('Failed to retrieve admin transactions:', err);
    }
    return [];
  }
}

