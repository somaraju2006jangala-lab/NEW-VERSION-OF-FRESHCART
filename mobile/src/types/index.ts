export interface PackSizeOption {
  size: string;
  price: number;
  isAvailable?: boolean;
  stock?: number;
}

export interface Product {
  id: string;
  title: string;
  supplier: string;
  sku: string;
  price: number;
  unit: string;
  stock: number;
  badge: string;
  image: string;
  category: string;
  categoryLabel?: string;
  isOrganic?: boolean;
  isQuickPrep?: boolean;
  description?: string;
  farmOrigin?: string;
  harvestDate?: string;
  tempRequirement?: string;
  nutrition?: string;
  batchNumber?: string;
  expiryDate?: string;
  packSizes?: PackSizeOption[];
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedPackSize?: string;
  selectedPrice?: number;
}

export interface AisleCategory {
  id: string;
  name: string;
  icon: string;
  slug: string;
}

export interface InventoryLog {
  id: string;
  timestamp: string;
  date?: string;
  time?: string;
  sku?: string;
  productTitle?: string;
  changeType: 'RESTOCK' | 'SALE' | 'AUDIT_ADJUSTMENT' | 'SPOILAGE_DISPOSAL' | string;
  quantityChange: number;
  newStock: number;
  operator: string;
  notes: string;
}

export interface OrderItem {
  product: {
    id: string;
    title: string;
    price: number;
    unit?: string;
    image?: string;
    category?: string;
  };
  quantity: number;
  selectedPackSize?: string;
  selectedPrice?: number;
}

export interface Order {
  id: string;
  customerName: string;
  customerId?: string;
  customerEmail?: string;
  customerPhone?: string;
  deliveryAddress: string;
  deliveryTimeSlot: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  couponCode?: string;
  status: 'Picking' | 'Ordered' | 'Pending' | 'Cold-Chain En Route' | 'Delivered' | 'CONFIRMED' | string;
  createdAt: string;
  otpVerifiedAt?: string;
  handoverReleased?: boolean;
  paymentMethod?: string;
  paymentStatus?: string;
  screenshotUrl?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  verificationNotes?: string;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  assignedAt?: string | null;
  assignedBy?: string | null;
  assignmentStatus?: 'assigned' | 'delivered' | 'cancelled' | 'unassigned' | string;
}

export interface CustomerAddress {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  isDefault?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  savedAddresses?: CustomerAddress[];
  createdAt?: string;
  loyaltyTier?: string;
  token?: string;
  status?: string;
  role?: 'customer';
  userRole?: 'CUSTOMER';
}

export interface AuthorizedAdmin {
  adminId: string;
  fullName: string;
  email: string;
  role: 'owner' | 'admin';
  status: 'active' | 'inactive';
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  token?: string;
}

export interface AuthorizedEmployee {
  employeeId: string;
  fullName: string;
  email: string;
  mobile?: string;
  username?: string;
  role: 'employee';
  status: 'active' | 'inactive';
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  token?: string;
}

export interface Coupon {
  id: string;
  code: string;
  discountPercentage: number;
  minOrderAmount: number;
  isActive: boolean;
  description?: string;
  createdAt?: string;
}

export interface DeliveryChargeRule {
  id: string;
  minOrderAmount: number;
  deliveryCharge: number;
}

export interface UpiPaymentSettings {
  upiId: string;
  merchantName: string;
  enabled: boolean;
  qrCodeUrl?: string;
}

export interface PendingDeliveryOrder {
  id: string;
  cleanId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryAddress: string;
  deliveryTimeSlot?: string;
  total: number;
  subtotal?: number;
  status: string;
  paymentMethod?: string;
  paymentStatus?: string;
  createdAt: string;
  assignedAt?: string;
  items?: Array<{
    id?: string;
    product_name?: string;
    name?: string;
    title?: string;
    quantity: number;
    unit?: string;
    price?: number;
  }>;
}
