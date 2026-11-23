import { Platform } from 'react-native';
import {
  RazorpayOrderResponse,
  PaymentVerificationRequest,
  VerifiedPaymentResult,
  CreateOrderParams,
} from '../types/payment';
import { DEFAULT_LAN_IP } from '../config/api';

const PROD_RAZORPAY_BACKEND_URL = 'https://razorpaysample.onrender.com/api';

// For local testing if running razorpay backend on port 5001
const getLocalRazorpayUrl = (): string => {
  if (Platform.OS === 'android') {
    return `http://${DEFAULT_LAN_IP || '10.240.114.237'}:5001/api`;
  }
  return `http://${DEFAULT_LAN_IP || '10.240.114.237'}:5001/api`;
};

export function getRazorpayBackendUrl(): string {
  if (process.env.EXPO_PUBLIC_RAZORPAY_URL) {
    return process.env.EXPO_PUBLIC_RAZORPAY_URL.replace(/\/$/, '');
  }
  // If explicitly configured for local development
  if (process.env.EXPO_PUBLIC_USE_LOCAL_PAYMENT === 'true') {
    return getLocalRazorpayUrl();
  }
  // Default to reliable Render Razorpay backend service
  return PROD_RAZORPAY_BACKEND_URL;
}

export class RazorpayMobileService {
  private static lastWarmUpTimestamp = 0;
  private static warmUpInFlight: Promise<boolean> | null = null;
  private static WARM_UP_CACHE_TTL_MS = 90000; // 90 seconds deduplication cache
  private static orderInFlight: Map<string, Promise<RazorpayOrderResponse>> = new Map();

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

        // 502/503/504 indicates Render backend container is waking up from sleep
        if (
          (response.status === 502 || response.status === 503 || response.status === 504) &&
          attempt < retries
        ) {
          console.warn(`[RazorpayMobile] Backend waking up (HTTP ${response.status}). Retrying...`);
          await new Promise((r) => setTimeout(r, retryDelayMs));
          continue;
        }

        return response;
      } catch (err: any) {
        lastError = err;
        const isAbort = err.name === 'AbortError';
        if (attempt < retries && isAbort) {
          console.warn(`[RazorpayMobile] Request timed out. Retrying in ${retryDelayMs}ms...`);
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
  static async warmUpBackend(): Promise<boolean> {
    const now = Date.now();

    // 1. Deduplication: skip redundant requests if user opens/closes cart multiple times within 90s
    if (now - this.lastWarmUpTimestamp < this.WARM_UP_CACHE_TTL_MS) {
      console.log('[RazorpayMobileWarmUp] Backend recently warmed up. Skipping redundant ping.');
      return true;
    }

    // 2. In-flight deduplication: reuse active probe
    if (this.warmUpInFlight) {
      console.log('[RazorpayMobileWarmUp] Reusing active in-flight warm-up probe...');
      return this.warmUpInFlight;
    }

    this.warmUpInFlight = (async () => {
      try {
        console.log('[RazorpayMobileWarmUp] Cart icon clicked: Sending lightweight warm-up ping to Razorpay backend...');
        const primaryUrl = getRazorpayBackendUrl();

        let res: Response | null = null;
        try {
          res = await this.fetchWithTimeout(`${primaryUrl}/health`, { method: 'GET' }, 90000, 1, 2000);
        } catch (fetchErr: any) {
          if (primaryUrl !== PROD_RAZORPAY_BACKEND_URL) {
            console.log('[RazorpayMobileWarmUp] Local backend unreachable. Falling back to Render production backend...');
            res = await this.fetchWithTimeout(`${PROD_RAZORPAY_BACKEND_URL}/health`, { method: 'GET' }, 90000, 1, 2000);
          } else {
            throw fetchErr;
          }
        }

        if (res && res.ok) {
          console.log('[RazorpayMobileWarmUp] Razorpay backend is warm and ready.');
          this.lastWarmUpTimestamp = Date.now();
          return true;
        }
        return false;
      } catch (err: any) {
        console.warn('[RazorpayMobileWarmUp] Background warm-up notice (non-blocking):', err.message);
        return false;
      } finally {
        this.warmUpInFlight = null;
      }
    })();

    return this.warmUpInFlight;
  }

  /**
   * Creates a Razorpay order through the authoritative backend.
   */
  static async createPaymentOrder(params: CreateOrderParams): Promise<RazorpayOrderResponse> {
    const orderKey = params.freshcart_order_id;
    const existing = this.orderInFlight.get(orderKey);
    if (existing) {
      return existing;
    }

    const promise = (async () => {
      try {
        console.log(`[RazorpayMobile] Requesting order creation for ${params.freshcart_order_id}...`);
        const subtotal = params.items.reduce((sum, it) => sum + it.price * it.quantity, 0);
        const rzpBackendUrl = getRazorpayBackendUrl();

        let res: Response;
        try {
          res = await this.fetchWithTimeout(
            `${rzpBackendUrl}/orders/create`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                freshcart_order_id: params.freshcart_order_id,
                amount: subtotal,
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
        } catch (fetchErr: any) {
          if (rzpBackendUrl !== PROD_RAZORPAY_BACKEND_URL) {
            console.log('[RazorpayMobile] Local backend order create failed. Trying Render production backend...');
            res = await this.fetchWithTimeout(
              `${PROD_RAZORPAY_BACKEND_URL}/orders/create`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  freshcart_order_id: params.freshcart_order_id,
                  amount: subtotal,
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
          } else {
            throw fetchErr;
          }
        }

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
   */
  static async verifyPayment(payload: PaymentVerificationRequest): Promise<VerifiedPaymentResult> {
    console.log(`[RazorpayMobile] Verifying cryptographic signature for ${payload.freshcart_order_id}...`);
    const rzpBackendUrl = getRazorpayBackendUrl();

    let res: Response;
    try {
      res = await this.fetchWithTimeout(
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
    } catch (fetchErr: any) {
      if (rzpBackendUrl !== PROD_RAZORPAY_BACKEND_URL) {
        console.log('[RazorpayMobile] Falling back to Render backend for payment verification...');
        res = await this.fetchWithTimeout(
          `${PROD_RAZORPAY_BACKEND_URL}/payments/verify`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
          30000,
          1,
          1500
        );
      } else {
        throw fetchErr;
      }
    }

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Payment signature verification failed.');
    }

    return data.data;
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
      const rzpBackendUrl = getRazorpayBackendUrl();
      await fetch(`${rzpBackendUrl}/payments/report-failure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      }).catch(() => null);
    } catch (err) {
      console.warn('[RazorpayMobile] Failed to report failure:', err);
    }
  }
}

