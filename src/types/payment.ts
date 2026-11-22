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

export interface PaymentTransactionRecord {
  id: string;
  freshcart_order_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: string | null;
  bank?: string | null;
  wallet?: string | null;
  vpa?: string | null;
  card_network?: string | null;
  card_type?: string | null;
  error_code?: string | null;
  error_description?: string | null;
  signature_verified: number;
  created_at: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
}

