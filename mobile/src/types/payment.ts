export type PaymentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUND_INITIATED'
  | 'REFUNDED';

export interface RazorpayOrderResponse {
  key_id: string;
  razorpay_order_id: string;
  freshcart_order_id: string;
  amount: number;
  amount_in_paise: number;
  authoritativeTotal?: number;
  currency: string;
  customer?: {
    name: string;
    email: string;
    phone: string;
  };
  payment_mode?: 'test' | 'live';
  is_simulated?: boolean;
}

export interface PaymentVerificationRequest {
  freshcart_order_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  orderData?: any;
}

export interface VerifiedPaymentResult {
  verified: boolean;
  status: PaymentStatus;
  transaction_id: string;
  razorpay_payment_id: string;
  razorpay_order_id: string;
  freshcart_order_id: string;
  amount: number;
  currency: string;
  method?: string;
  timestamp: string;
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

