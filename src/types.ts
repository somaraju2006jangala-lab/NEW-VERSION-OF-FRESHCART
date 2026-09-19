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
  category: 'produce' | 'dairy' | 'bakery' | 'beverages' | 'snacks' | 'grains';
  categoryLabel: string;
  isOrganic?: boolean;
  isQuickPrep?: boolean;
  description?: string;
  minStockLevel?: number;
  farmOrigin?: string;
  harvestDate?: string;
  tempRequirement?: string;
  nutrition?: string;
  batchNumber?: string;
  expiryDate?: string;
}

export type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

export const getStockStatus = (stock: number): StockStatus => {
  if (stock > 10) return 'In Stock';
  if (stock >= 1) return 'Low Stock';
  return 'Out of Stock';
};

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface AisleCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
  slug: string;
}

export interface InventoryLog {
  id: string;
  timestamp: string;
  sku: string;
  productTitle: string;
  changeType:
    | 'RESTOCK'
    | 'SALE'
    | 'AUDIT_ADJUSTMENT'
    | 'SPOILAGE_DISPOSAL'
    | 'PRODUCT_ADDED'
    | 'PRODUCT_UPDATED'
    | 'PRODUCT_DELETED';
  quantityChange: number;
  newStock: number;
  operator: string;
  notes: string;
}

export interface Order {
  id: string;
  customerName: string;
  deliveryAddress: string;
  deliveryTimeSlot: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  couponCode?: string;
  status: 'Pending' | 'Picking at Pod #104' | 'Cold-Chain En Route' | 'Delivered';
  createdAt: string;
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
  savedAddresses: CustomerAddress[];
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  avatarUrl?: string;
  loyaltyTier?: string;
}

export interface CustomerOrder extends Order {
  customerId?: string;
  estimatedDeliveryTime?: string;
  paymentMethod?: string;
}

export type ViewType = 'storefront' | 'admin' | 'login' | 'register' | 'dashboard';

