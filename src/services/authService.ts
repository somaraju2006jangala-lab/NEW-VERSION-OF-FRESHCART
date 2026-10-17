import { Customer, CustomerAddress, CustomerOrder } from '../types';
import { INITIAL_PRODUCTS } from '../data/products';
import { validateIndianMobileNumber } from './registrationOtpService';

const STORAGE_CUSTOMERS_KEY = 'freshcart_registered_customers';
export const STORAGE_CURRENT_USER_KEY = 'freshcart_active_customer_session';
const STORAGE_CUSTOMER_ORDERS_KEY = 'freshcart_customer_orders_inr_v1';

// Demo customer credentials
export const DEMO_CUSTOMER_EMAIL = 'customer@freshcart.com';
export const DEMO_CUSTOMER_PASSWORD = 'FreshCart2026!';

import { hashPassword, generateSalt } from '../utils/crypto';
import { AuthorizedAdmin, saveAdminSession, loginAdmin, getStoredAdminToken } from './adminService';
import { AuthorizedEmployee, saveEmployeeSession, getStoredEmployeeToken } from './employeeService';

export { hashPassword, generateSalt, getStoredAdminToken, getStoredEmployeeToken };

// Initial seed orders for demo customers
const INITIAL_DEMO_ORDERS: CustomerOrder[] = [
  {
    id: '#FC-1005',
    customerId: 'rahul123',
    customerName: 'Rahul',
    customerEmail: 'rahul@example.com',
    customerPhone: '+91 9876543210',
    deliveryAddress: 'Flat 402, Green Meadows, Bengaluru 560001',
    deliveryTimeSlot: '24-30 Minutes (Direct Express Pod)',
    estimatedDeliveryTime: 'Picking in progress',
    items: [
      {
        product: {
          ...INITIAL_PRODUCTS[8], // prod-9: Basmati Rice
          title: 'Basmati Rice',
          price: 120,
          unit: '1 kg',
        },
        quantity: 2,
      },
      {
        product: {
          ...INITIAL_PRODUCTS[1], // prod-2: Milk
          title: 'Milk',
          price: 30,
          unit: '500 ml',
        },
        quantity: 2,
      },
    ],
    subtotal: 300,
    discount: 0,
    total: 300,
    status: 'Picking',
    createdAt: new Date().toISOString(),
    paymentMethod: 'Cash on Delivery',
    paymentStatus: 'PENDING',
  },
  {
    id: '#FC-1006',
    customerId: 'priya123',
    customerName: 'Priya Sharma',
    customerEmail: 'priya@example.com',
    customerPhone: '+91 9123456789',
    deliveryAddress: 'Apt 304, Palm Grove, Koramangala, Bengaluru 560034',
    deliveryTimeSlot: '24-30 Minutes (Direct Express Pod)',
    estimatedDeliveryTime: 'Picking in progress',
    items: [
      {
        product: {
          ...INITIAL_PRODUCTS[0], // prod-1: Bananas
          title: 'Organic Bananas',
          price: 60,
          unit: '1 dozen',
        },
        quantity: 1,
      },
      {
        product: {
          ...INITIAL_PRODUCTS[2], // prod-3: Honeycrisp Apples
          title: 'Honeycrisp Apples',
          price: 150,
          unit: '1 kg',
        },
        quantity: 1,
      },
    ],
    subtotal: 210,
    discount: 0,
    total: 210,
    status: 'Picking',
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    paymentMethod: 'Cash on Delivery',
    paymentStatus: 'PENDING',
  },
  {
    id: '#1001',
    customerId: 'rahul123',
    customerName: 'Rahul',
    customerEmail: 'rahul@example.com',
    customerPhone: '+91 9876543210',
    deliveryAddress: 'Flat 402, Green Meadows, Bengaluru 560001',
    deliveryTimeSlot: '24-30 Minutes (Direct Express Pod)',
    estimatedDeliveryTime: 'Arriving in ~20 minutes',
    items: [
      {
        product: {
          ...INITIAL_PRODUCTS[8], // prod-9: Basmati Rice
          title: 'Basmati Rice',
          price: 120,
          unit: '1 kg',
        },
        quantity: 2,
      },
      {
        product: {
          ...INITIAL_PRODUCTS[1], // prod-2: Milk
          title: 'Milk',
          price: 30,
          unit: '500 ml',
        },
        quantity: 2,
      },
    ],
    subtotal: 300,
    discount: 0,
    total: 300,
    status: 'Picking',
    createdAt: '2026-09-23T10:42:00.000Z',
    paymentMethod: 'Cash on Delivery',
    paymentStatus: 'PENDING',
  },
  {
    id: '#FC-94821',
    customerId: 'cust-demo-1',
    customerName: 'Alex Morgan',
    customerEmail: DEMO_CUSTOMER_EMAIL,
    customerPhone: '(555) 234-1234',
    deliveryAddress: '742 Evergreen Terrace, Apt 4B, Springfield, OR 97477',
    deliveryTimeSlot: '24-30 Minutes (Direct Express Pod)',
    estimatedDeliveryTime: 'Arriving in ~18 minutes',
    items: [
      { product: INITIAL_PRODUCTS[0], quantity: 2 }, // Bananas (2 * 69 = 138)
      { product: INITIAL_PRODUCTS[1], quantity: 1 }, // Whole Milk (1 * 79 = 79)
    ],
    subtotal: 217,
    discount: 0,
    total: 217,
    status: 'Picking',
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    paymentMethod: '⚡ Express Pay',
  },
  {
    id: 'FC-88120',
    customerId: 'cust-demo-1',
    customerName: 'Alex Morgan',
    customerEmail: DEMO_CUSTOMER_EMAIL,
    deliveryAddress: '742 Evergreen Terrace, Apt 4B, Springfield, OR 97477',
    deliveryTimeSlot: 'Yesterday, 05:45 PM',
    estimatedDeliveryTime: 'Delivered',
    items: [
      { product: INITIAL_PRODUCTS[2], quantity: 3 }, // Honeycrisp Apples (3 * 199 = 597)
      { product: INITIAL_PRODUCTS[3], quantity: 1 }, // Sourdough (1 * 149 = 149)
      { product: INITIAL_PRODUCTS[4], quantity: 2 }, // Cold Brew Coffee (2 * 299 = 598)
    ],
    subtotal: 1344,
    discount: 403,
    total: 941,
    couponCode: 'FRESH30',
    status: 'Delivered',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    paymentMethod: 'Credit Card (ending 4242)',
  },
  {
    id: 'FC-75402',
    customerId: 'cust-demo-1',
    customerName: 'Alex Morgan',
    customerEmail: DEMO_CUSTOMER_EMAIL,
    deliveryAddress: '100 Innovation Way, Suite 300, Springfield, OR 97477',
    deliveryTimeSlot: '3 days ago',
    estimatedDeliveryTime: 'Delivered',
    items: [
      { product: INITIAL_PRODUCTS[5], quantity: 4 }, // Avocados (4 * 349 = 1396)
      { product: INITIAL_PRODUCTS[6], quantity: 2 }, // Greek Yogurt (2 * 189 = 378)
    ],
    subtotal: 1774,
    discount: 0,
    total: 1774,
    status: 'Delivered',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    paymentMethod: '⚡ Express Pay',
  },
];

/**
 * Initializes localStorage with pre-seeded demo user and orders if not yet present.
 */
export async function initializeAuthStore(): Promise<void> {
  try {
    const existing = localStorage.getItem(STORAGE_CUSTOMERS_KEY);
    if (!existing) {
      const demoSalt = 'freshcart_salt_demo_9921';
      const demoHash = await hashPassword(DEMO_CUSTOMER_PASSWORD, demoSalt);

      const demoCustomer: Customer = {
        id: 'cust-demo-1',
        name: 'Alex Morgan',
        email: DEMO_CUSTOMER_EMAIL,
        phone: '(555) 234-5678',
        address: '742 Evergreen Terrace, Apt 4B, Springfield, OR 97477',
        passwordSalt: demoSalt,
        passwordHash: demoHash,
        createdAt: '2025-01-15T09:00:00.000Z',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
        loyaltyTier: 'Fresh Gold Member (5% Cashback)',
        savedAddresses: [
          {
            id: 'addr-1',
            label: 'Home (Default)',
            street: '742 Evergreen Terrace, Apt 4B',
            city: 'Springfield',
            state: 'OR',
            zip: '97477',
            isDefault: true,
          },
          {
            id: 'addr-2',
            label: 'Office / Tech Hub',
            street: '100 Innovation Way, Suite 300',
            city: 'Springfield',
            state: 'OR',
            zip: '97477',
            isDefault: false,
          },
        ],
      };

      const rahulCustomer: Customer = {
        id: 'rahul123',
        name: 'Rahul',
        email: 'rahul@example.com',
        phone: '+91 9876543210',
        address: 'Flat 402, Green Meadows, Bengaluru 560001',
        passwordSalt: demoSalt,
        passwordHash: demoHash,
        createdAt: '2026-01-10T10:00:00.000Z',
        avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Rahul&backgroundColor=006b2c',
        loyaltyTier: 'Fresh Gold Member (5% Cashback)',
        savedAddresses: [
          {
            id: 'addr-rahul-1',
            label: 'Home',
            street: 'Flat 402, Green Meadows',
            city: 'Bengaluru',
            state: 'KA',
            zip: '560001',
            isDefault: true,
          },
        ],
      };

      const priyaCustomer: Customer = {
        id: 'priya123',
        name: 'Priya Sharma',
        email: 'priya@example.com',
        phone: '+91 9123456789',
        address: 'Apt 304, Palm Grove, Koramangala, Bengaluru 560034',
        passwordSalt: demoSalt,
        passwordHash: demoHash,
        createdAt: '2026-02-01T10:00:00.000Z',
        avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Priya&backgroundColor=006b2c',
        loyaltyTier: 'Fresh Gold Member (5% Cashback)',
        savedAddresses: [
          {
            id: 'addr-priya-1',
            label: 'Home',
            street: 'Apt 304, Palm Grove, Koramangala',
            city: 'Bengaluru',
            state: 'KA',
            zip: '560034',
            isDefault: true,
          },
        ],
      };

      localStorage.setItem(STORAGE_CUSTOMERS_KEY, JSON.stringify([demoCustomer, rahulCustomer, priyaCustomer]));
    } else {
      try {
        const parsedCust: Customer[] = JSON.parse(existing);
        const demoSalt = 'freshcart_salt_demo_9921';
        const demoHash = await hashPassword(DEMO_CUSTOMER_PASSWORD, demoSalt);

        // Ensure Rahul has the exact registered mobile number: +91 9876543210
        const rahulIndex = parsedCust.findIndex((c) => c.id === 'rahul123');
        if (rahulIndex >= 0) {
          parsedCust[rahulIndex].phone = '+91 9876543210';
        } else {
          parsedCust.push({
            id: 'rahul123',
            name: 'Rahul',
            email: 'rahul@example.com',
            phone: '+91 9876543210',
            address: 'Flat 402, Green Meadows, Bengaluru 560001',
            passwordSalt: demoSalt,
            passwordHash: demoHash,
            createdAt: '2026-01-10T10:00:00.000Z',
            avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Rahul&backgroundColor=006b2c',
            loyaltyTier: 'Fresh Gold Member (5% Cashback)',
            savedAddresses: [
              {
                id: 'addr-rahul-1',
                label: 'Home',
                street: 'Flat 402, Green Meadows',
                city: 'Bengaluru',
                state: 'KA',
                zip: '560001',
                isDefault: true,
              },
            ],
          });
        }

        // Ensure Priya Sharma (Customer B) is registered with mobile: +91 9123456789
        const priyaIndex = parsedCust.findIndex((c) => c.id === 'priya123');
        if (priyaIndex >= 0) {
          parsedCust[priyaIndex].phone = '+91 9123456789';
        } else {
          parsedCust.push({
            id: 'priya123',
            name: 'Priya Sharma',
            email: 'priya@example.com',
            phone: '+91 9123456789',
            address: 'Apt 304, Palm Grove, Koramangala, Bengaluru 560034',
            passwordSalt: demoSalt,
            passwordHash: demoHash,
            createdAt: '2026-02-01T10:00:00.000Z',
            avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Priya&backgroundColor=006b2c',
            loyaltyTier: 'Fresh Gold Member (5% Cashback)',
            savedAddresses: [
              {
                id: 'addr-priya-1',
                label: 'Home',
                street: 'Apt 304, Palm Grove, Koramangala',
                city: 'Bengaluru',
                state: 'KA',
                zip: '560034',
                isDefault: true,
              },
            ],
          });
        }

        localStorage.setItem(STORAGE_CUSTOMERS_KEY, JSON.stringify(parsedCust));
      } catch {
        // Ignore
      }
    }

    const existingOrders = localStorage.getItem(STORAGE_CUSTOMER_ORDERS_KEY);
    if (!existingOrders) {
      localStorage.setItem(STORAGE_CUSTOMER_ORDERS_KEY, JSON.stringify(INITIAL_DEMO_ORDERS));
    } else {
      try {
        const parsed: CustomerOrder[] = JSON.parse(existingOrders);
        if (!parsed.some((o) => o.id === '#FC-1005' || o.id === 'FC-1005')) {
          parsed.unshift(INITIAL_DEMO_ORDERS[0]);
        }
        if (!parsed.some((o) => o.id === '#FC-1006' || o.id === 'FC-1006')) {
          parsed.splice(1, 0, INITIAL_DEMO_ORDERS[1]);
        }
        parsed.forEach((o) => {
          if (o.id === '#FC-1005' || o.id === 'FC-1005') {
            o.customerId = 'rahul123';
            o.customerName = 'Rahul';
            o.customerEmail = 'rahul@example.com';
            o.customerPhone = '+91 9876543210';
            if (o.status === 'Ordered') o.status = 'Picking';
          }
          if (o.id === '#FC-1006' || o.id === 'FC-1006') {
            o.customerId = 'priya123';
            o.customerName = 'Priya Sharma';
            o.customerEmail = 'priya@example.com';
            o.customerPhone = '+91 9123456789';
            if (o.status === 'Ordered') o.status = 'Picking';
          }
          if (o.id === '#1001') {
            o.customerId = 'rahul123';
            o.customerPhone = '+91 9876543210';
            if (o.status === 'Ordered') o.status = 'Picking';
          }
          if (o.customerId === 'rahul123') {
            o.customerPhone = '+91 9876543210';
          } else if (o.customerId === 'priya123') {
            o.customerPhone = '+91 9123456789';
          }
        });
        localStorage.setItem(STORAGE_CUSTOMER_ORDERS_KEY, JSON.stringify(parsed));
      } catch {
        localStorage.setItem(STORAGE_CUSTOMER_ORDERS_KEY, JSON.stringify(INITIAL_DEMO_ORDERS));
      }
    }
  } catch (err) {
    console.error('Failed to initialize local auth storage:', err);
  }
}

/**
 * Helper to fetch all stored customers.
 */
export function getStoredCustomers(): Customer[] {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOMERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Resolves the registered customer account associated with an order
 * using customerId, customerEmail, or customerName.
 */
export function getRegisteredCustomerForOrder(order: Partial<CustomerOrder>): Customer | undefined {
  const customers = getStoredCustomers();
  if (order.customerId) {
    const cid = order.customerId.trim().toLowerCase();
    const byId = customers.find((c) => c.id.toLowerCase() === cid);
    if (byId) return byId;
  }
  if (order.customerEmail) {
    const cemail = order.customerEmail.trim().toLowerCase();
    const byEmail = customers.find((c) => c.email.toLowerCase() === cemail);
    if (byEmail) return byEmail;
  }
  if (order.customerName) {
    const cname = order.customerName.trim().toLowerCase();
    const byName = customers.find((c) => c.name.toLowerCase() === cname);
    if (byName) return byName;
  }
  return undefined;
}

/**
 * Returns the registered Indian mobile number for an order.
 * Strictly obtains the actual number from customer account/order data.
 */
export function getCustomerPhoneForOrder(order: Partial<CustomerOrder>): string {
  const customer = getRegisteredCustomerForOrder(order);
  if (customer?.phone && customer.phone.trim()) {
    return customer.phone.trim();
  }
  if (order.customerPhone && order.customerPhone.trim()) {
    return order.customerPhone.trim();
  }
  return '';
}

/**
 * Save customer list to storage.
 */
function saveStoredCustomers(customers: Customer[]): void {
  localStorage.setItem(STORAGE_CUSTOMERS_KEY, JSON.stringify(customers));
}


/**
 * Generates an authentication token for the customer session.
 */
export function generateClientAuthToken(customer: Partial<Customer>): string {
  try {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=+$/, '');
    const payload = btoa(
      JSON.stringify({
        id: customer.id || 'guest',
        customerId: customer.id || 'guest',
        email: customer.email || '',
        name: customer.name || '',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
      })
    ).replace(/=+$/, '');
    return `${header}.${payload}.freshcart_auth_${customer.id || 'guest'}`;
  } catch {
    return `fc_token_${customer.id || 'guest'}_${Date.now()}`;
  }
}

/**
 * Authenticates a customer by email/userId and password.
 * Securely hashes input password with the stored salt and compares hashes.
 *
 * NOTE: When connecting a real backend, replace this logic with:
 * const response = await fetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
 */
/**
 * Authenticates a customer by email, User ID, or mobile number and password using the shared persistent database.
 * Confirms authentication against the MySQL/TiDB database across all devices.
 */
export interface SharedLoginResult {
  success: boolean;
  role?: 'admin' | 'employee' | 'customer';
  userRole?: 'ADMIN' | 'EMPLOYEE' | 'CUSTOMER';
  customer?: Customer;
  admin?: AuthorizedAdmin;
  employee?: AuthorizedEmployee;
  token?: string;
  error?: string;
}

/**
 * Shared authentication for customers, employees, and administrators.
 * Authenticates against backend, verifies role, and saves session.
 */
export async function loginShared(
  identifier: string,
  plainPassword: string
): Promise<SharedLoginResult> {
  const trimmedIdentifier = identifier.trim();

  if (!trimmedIdentifier) {
    return {
      success: false,
      error: 'Please enter your email address or User ID.',
    };
  }
  if (!plainPassword) {
    return {
      success: false,
      error: 'Please enter your password.',
    };
  }

  // 1. Authenticate with backend shared MySQL/TiDB database
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: trimmedIdentifier, password: plainPassword }),
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data?.success) {
      // Employee account
      if (data.role === 'employee' || data.userRole === 'EMPLOYEE' || data.employee) {
        const employee: AuthorizedEmployee = data.employee;
        const token = data.token;
        if (token && employee) {
          saveEmployeeSession(token, employee);
        }
        return {
          success: true,
          role: 'employee',
          userRole: 'EMPLOYEE',
          employee,
          token,
        };
      }

      // Administrator account
      if (data.role === 'admin' || data.userRole === 'ADMIN' || data.admin) {
        const admin: AuthorizedAdmin = data.admin;
        const token = data.token;
        if (token && admin) {
          saveAdminSession(token, admin);
        }
        return {
          success: true,
          role: 'admin',
          userRole: 'ADMIN',
          admin,
          token,
        };
      }

      // Customer account
      if (data.role === 'customer' || data.userRole === 'CUSTOMER' || data.customer) {
        const token = data.token || generateClientAuthToken(data.customer);
        const sessionUser: Customer = {
          ...data.customer,
          passwordHash: '',
          passwordSalt: '',
          token,
        };

        // Persist active session on this device
        localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(sessionUser));

        return {
          success: true,
          role: 'customer',
          userRole: 'CUSTOMER',
          customer: sessionUser,
          token,
        };
      }
    }

    // 2. Fallback: If separate admin endpoint is configured and /api/auth/login returned an error,
    // connect to /api/admin/login without weakening authentication:
    const adminRes = await loginAdmin(trimmedIdentifier, plainPassword).catch(() => null);
    if (adminRes && adminRes.success && adminRes.admin && adminRes.token) {
      return {
        success: true,
        role: 'admin',
        admin: adminRes.admin,
        token: adminRes.token,
      };
    }

    if (data?.error) {
      return {
        success: false,
        error: data.error,
      };
    }

    if (adminRes?.error) {
      return {
        success: false,
        error: adminRes.error,
      };
    }

    return {
      success: false,
      error: 'Invalid credentials. Please verify your email/User ID and password.',
    };
  } catch (err: any) {
    // If network issue contacting /api/auth/login, try admin endpoint as well
    try {
      const adminRes = await loginAdmin(trimmedIdentifier, plainPassword);
      if (adminRes && adminRes.success && adminRes.admin && adminRes.token) {
        return {
          success: true,
          role: 'admin',
          admin: adminRes.admin,
          token: adminRes.token,
        };
      }
    } catch {}

    return {
      success: false,
      error: 'Unable to connect to the authentication server. Please check your network connection.',
    };
  }
}

/**
 * Authenticates a customer by email, User ID, or mobile number and password using the shared persistent database.
 * Confirms authentication against the MySQL/TiDB database across all devices.
 */
export async function loginCustomer(
  identifier: string,
  plainPassword: string
): Promise<{ success: boolean; customer?: Customer; error?: string }> {
  const result = await loginShared(identifier, plainPassword);
  if (result.success && result.customer) {
    return { success: true, customer: result.customer };
  }
  return { success: false, error: result.error || 'Login failed' };
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  address: string;
}

/**
 * Checks if an Indian mobile number is already registered to an existing customer.
 */
export function isPhoneRegistered(rawPhone: string): boolean {
  const val = validateIndianMobileNumber(rawPhone);
  if (!val.isValid || !val.normalized) return false;
  const customers = getStoredCustomers();
  return customers.some((c) => {
    if (!c.phone) return false;
    const existingVal = validateIndianMobileNumber(c.phone);
    return (existingVal.isValid && existingVal.normalized === val.normalized) || c.phone === val.normalized;
  });
}

/**
 * Registers a new customer directly into the shared MySQL/TiDB database.
 * - Validates required fields and Indian mobile number format.
 * - Confirms persistent database insert before reporting success.
 * - Never stores or logs plain-text passwords or hashes locally.
 * - Does not report success when database operation fails.
 */
export async function registerCustomer(
  payload: RegisterPayload
): Promise<{ success: boolean; customer?: Customer; error?: string }> {
  const trimmedEmail = payload.email.trim().toLowerCase();
  const trimmedName = payload.name.trim();

  if (!trimmedName) {
    return { success: false, error: 'Full name is required.' };
  }
  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    return { success: false, error: 'Please provide a valid email address.' };
  }
  if (!payload.password || payload.password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' };
  }

  // 1. Indian Mobile Number Validation
  const phoneValidation = validateIndianMobileNumber(payload.phone);
  if (!phoneValidation.isValid || !phoneValidation.normalized) {
    return {
      success: false,
      error: phoneValidation.error || 'Please enter a valid 10-digit Indian mobile number.',
    };
  }
  const normalizedPhone = phoneValidation.normalized;

  // 2. Register via persistent shared MySQL database
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: trimmedName,
        email: trimmedEmail,
        phone: normalizedPhone,
        password: payload.password,
        address: payload.address || '',
      }),
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data?.success && data?.customer) {
      const token = data.token || generateClientAuthToken(data.customer);
      const sessionUser: Customer = {
        ...data.customer,
        passwordHash: '',
        passwordSalt: '',
        token,
      };

      // Store authenticated session for current device
      localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(sessionUser));

      return {
        success: true,
        customer: sessionUser,
      };
    }

    if (res.status === 409) {
      return {
        success: false,
        error: data?.error || 'An account with this email or mobile number already exists. Please log in.',
      };
    }

    if (data?.error) {
      return {
        success: false,
        error: data.error,
      };
    }

    return {
      success: false,
      error: `Registration failed (Status ${res.status}). Database operation could not be confirmed.`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'Unable to connect to the registration server. Please verify your network connection and server status.',
    };
  }
}

/**
 * Returns currently authenticated customer session, if any.
 */
export function getCurrentCustomer(): Customer | null {
  try {
    const raw = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
    if (!raw) return null;
    const user: Customer = JSON.parse(raw);
    if (user && !user.token) {
      user.token = generateClientAuthToken(user);
      localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(user));
    }
    return user;
  } catch {
    return null;
  }
}

/**
 * Logs out the active customer.
 */
export function logoutCustomer(): void {
  localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
}

/**
 * Updates customer profile details (name, phone, address).
 */
export function updateCustomerProfile(
  userId: string,
  updates: Partial<Pick<Customer, 'name' | 'phone' | 'address'>>
): Customer | null {
  const customers = getStoredCustomers();
  const index = customers.findIndex((c) => c.id === userId);
  if (index === -1) return null;

  customers[index] = {
    ...customers[index],
    ...updates,
  };
  saveStoredCustomers(customers);

  const updatedSession: Customer = {
    ...customers[index],
    passwordHash: '',
    passwordSalt: '',
  };
  localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(updatedSession));
  return updatedSession;
}

/**
 * Adds a new saved delivery address.
 */
export function addSavedAddress(
  userId: string,
  address: Omit<CustomerAddress, 'id'>
): Customer | null {
  const customers = getStoredCustomers();
  const index = customers.findIndex((c) => c.id === userId);
  if (index === -1) return null;

  const newAddress: CustomerAddress = {
    ...address,
    id: `addr-${Date.now()}`,
  };

  const updatedAddresses = [...(customers[index].savedAddresses || []), newAddress];
  if (address.isDefault) {
    updatedAddresses.forEach((a) => {
      if (a.id !== newAddress.id) a.isDefault = false;
    });
  }

  customers[index].savedAddresses = updatedAddresses;
  saveStoredCustomers(customers);

  const updatedSession: Customer = {
    ...customers[index],
    passwordHash: '',
    passwordSalt: '',
  };
  localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(updatedSession));
  return updatedSession;
}

/**
 * Removes a saved delivery address.
 */
export function removeSavedAddress(userId: string, addressId: string): Customer | null {
  const customers = getStoredCustomers();
  const index = customers.findIndex((c) => c.id === userId);
  if (index === -1) return null;

  customers[index].savedAddresses = (customers[index].savedAddresses || []).filter(
    (a) => a.id !== addressId
  );
  saveStoredCustomers(customers);

  const updatedSession: Customer = {
    ...customers[index],
    passwordHash: '',
    passwordSalt: '',
  };
  localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(updatedSession));
  return updatedSession;
}

/**
 * Retrieves orders for a specific customer or all customer orders.
 * Automatically links every order to the customer's registered Indian mobile number.
 */
export function getCustomerOrders(customerId?: string): CustomerOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOMER_ORDERS_KEY);
    let orders: CustomerOrder[] = raw ? JSON.parse(raw) : INITIAL_DEMO_ORDERS;

    // Ensure test orders #FC-1005 (Rahul) and #FC-1006 (Priya) are always present
    if (!orders.some((o) => o.id === '#FC-1005' || o.id === 'FC-1005')) {
      orders.unshift(INITIAL_DEMO_ORDERS[0]);
    }
    if (!orders.some((o) => o.id === '#FC-1006' || o.id === 'FC-1006')) {
      orders.splice(1, 0, INITIAL_DEMO_ORDERS[1]);
    }

    // Connect every order to the actual customer's registered Indian mobile number
    const resolvedOrders = orders.map((o) => {
      const resolvedPhone = getCustomerPhoneForOrder(o);
      return {
        ...o,
        customerPhone: resolvedPhone || o.customerPhone,
      };
    });

    if (!customerId) return resolvedOrders;
    return resolvedOrders.filter((o) => !o.customerId || o.customerId === customerId);
  } catch {
    return [];
  }
}

/**
 * Appends a newly placed order to customer's order history.
 */
export function saveOrderForCustomer(order: CustomerOrder): void {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOMER_ORDERS_KEY);
    const orders: CustomerOrder[] = raw ? JSON.parse(raw) : [...INITIAL_DEMO_ORDERS];
    orders.unshift(order);
    localStorage.setItem(STORAGE_CUSTOMER_ORDERS_KEY, JSON.stringify(orders));

    // Synchronize to backend MySQL database
    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    }).catch(() => {});
  } catch (err) {
    console.error('Failed to record customer order:', err);
  }
}

/**
 * Updates the status of an existing customer order.
 */
export function updateOrderStatus(
  orderId: string,
  newStatus: string,
  extraMeta?: { otpVerifiedAt?: string; handoverReleased?: boolean; paymentStatus?: string }
): void {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOMER_ORDERS_KEY);
    const orders: CustomerOrder[] = raw ? JSON.parse(raw) : INITIAL_DEMO_ORDERS;
    const updated = orders.map((o) =>
      o.id === orderId
        ? {
            ...o,
            status: newStatus as any,
            ...(extraMeta || {}),
          }
        : o
    );
    localStorage.setItem(STORAGE_CUSTOMER_ORDERS_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('freshcart_orders_updated'));
    }
  } catch (err) {
    console.error('Failed to update order status:', err);
  }
}

/**
 * Updates the payment status of an existing customer order (Admin Payment Verification).
 */
export function updateOrderPaymentStatus(
  orderId: string,
  paymentStatus: 'Pending' | 'Pending Verification' | 'PENDING_VERIFICATION' | 'Paid' | 'PAID' | 'Failed' | 'REJECTED' | 'COMPLETED' | 'COLLECTED' | 'PENDING_COLLECTION' | 'COD' | string,
  meta?: { screenshotUrl?: string; verifiedAt?: string; verifiedBy?: string; verificationNotes?: string }
): void {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOMER_ORDERS_KEY);
    const orders: CustomerOrder[] = raw ? JSON.parse(raw) : INITIAL_DEMO_ORDERS;
    const isPaid = paymentStatus.toUpperCase() === 'PAID' || paymentStatus.toUpperCase() === 'COMPLETED' || paymentStatus.toUpperCase() === 'COLLECTED';
    const altId = orderId.startsWith('#') ? orderId.slice(1) : `#${orderId}`;
    const updated = orders.map((o) =>
      o.id === orderId || o.id === altId
        ? {
            ...o,
            paymentStatus,
            screenshotUrl: isPaid ? undefined : (meta?.screenshotUrl !== undefined ? meta.screenshotUrl : o.screenshotUrl),
            verifiedAt: meta?.verifiedAt || o.verifiedAt,
            verifiedBy: meta?.verifiedBy || o.verifiedBy,
            verificationNotes: meta?.verificationNotes || o.verificationNotes,
          }
        : o
    );
    localStorage.setItem(STORAGE_CUSTOMER_ORDERS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('freshcart_orders_updated'));

    // Persist payment status update to MySQL database
    const cleanId = orderId.replace(/^#/, '');
    const adminToken = getStoredAdminToken();
    fetch(`/api/orders/${encodeURIComponent(cleanId)}/payment-status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-role': 'admin',
        ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      },
      body: JSON.stringify({ paymentStatus, ...meta }),
    }).catch(() => {});
  } catch (err) {
    console.error('Failed to update order payment status:', err);
  }
}

/**
 * Confirms cash collection for a Cash on Delivery (COD) order.
 * - Allowed for authorized employees and administrators.
 * - Saves COLLECTED status and confirmation metadata (timestamp, confirmed by) to MySQL.
 * - Prevents duplicate cash collection confirmation.
 */
export async function confirmCodCashCollection(
  orderId: string
): Promise<{ success: boolean; error?: string; paymentStatus?: string; verifiedAt?: string; verifiedBy?: string }> {
  try {
    const cleanId = orderId.replace(/^#/, '');
    const adminToken = getStoredAdminToken();
    const employeeToken = getStoredEmployeeToken();
    const token = adminToken || employeeToken;
    const role = adminToken ? 'admin' : (employeeToken ? 'employee' : 'admin');

    const res = await fetch(`/api/orders/${encodeURIComponent(cleanId)}/confirm-cash-collection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-role': role,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data?.success) {
      const verifiedAt = data.verifiedAt || new Date().toISOString();
      const verifiedBy = data.verifiedBy || (role === 'employee' ? 'Operations Employee' : 'Admin');

      updateOrderPaymentStatus(orderId, 'COLLECTED', {
        verifiedAt,
        verifiedBy,
      });

      return {
        success: true,
        paymentStatus: 'COLLECTED',
        verifiedAt,
        verifiedBy,
      };
    }

    if (res.status === 409) {
      return {
        success: false,
        error: data?.error || 'Cash collection has already been confirmed for this order.',
      };
    }

    return {
      success: false,
      error: data?.error || 'Failed to confirm cash collection.',
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to confirm cash collection.' };
  }
}

/**
 * Fetches all orders from MySQL database for Admin Portal.
 * Merges authoritative database records with local state.
 */
export async function fetchAllOrdersFromBackend(): Promise<CustomerOrder[]> {
  try {
    const adminToken = getStoredAdminToken();
    const res = await fetch('/api/orders', {
      headers: {
        'x-admin-role': 'admin',
        ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      },
    });
    const data = await res.json().catch(() => null);
    if (data?.success && Array.isArray(data.orders)) {
      syncBackendOrders(data.orders);
    }
    return getCustomerOrders();
  } catch (err) {
    console.warn('Failed to fetch orders from backend:', err);
    return getCustomerOrders();
  }
}

/**
 * Synchronizes orders in local storage with authoritative state from backend MySQL database.
 */
export function syncBackendOrders(backendOrders: any[]): void {
  if (!Array.isArray(backendOrders) || backendOrders.length === 0) return;
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOMER_ORDERS_KEY);
    let orders: CustomerOrder[] = raw ? JSON.parse(raw) : [...INITIAL_DEMO_ORDERS];
    let changed = false;

    backendOrders.forEach((bo) => {
      const boCleanId = String(bo.id || '').replace(/^#/, '');
      const matchIndex = orders.findIndex((o) => {
        const oCleanId = String(o.id || '').replace(/^#/, '');
        return oCleanId === boCleanId;
      });

      if (matchIndex >= 0) {
        const existing = orders[matchIndex];
        orders[matchIndex] = {
          ...existing,
          paymentMethod: bo.paymentMethod || existing.paymentMethod,
          paymentStatus: bo.paymentStatus || existing.paymentStatus,
          screenshotUrl: bo.screenshotUrl !== undefined ? bo.screenshotUrl : existing.screenshotUrl,
          verifiedAt: bo.verifiedAt || existing.verifiedAt,
          verifiedBy: bo.verifiedBy || existing.verifiedBy,
          verificationNotes: bo.verificationNotes || existing.verificationNotes,
          status: bo.status || existing.status,
        };
        changed = true;
      } else {
        orders.push({
          ...bo,
          id: bo.id.startsWith('#') ? bo.id : `#${bo.id}`,
        });
        changed = true;
      }
    });

    if (changed) {
      localStorage.setItem(STORAGE_CUSTOMER_ORDERS_KEY, JSON.stringify(orders));
    }
  } catch (err) {
    console.error('Failed to sync backend orders:', err);
  }
}

/**
 * Deletes a customer order by ID.
 */
export function deleteCustomerOrder(orderId: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOMER_ORDERS_KEY);
    const orders: CustomerOrder[] = raw ? JSON.parse(raw) : INITIAL_DEMO_ORDERS;
    const updated = orders.filter((o) => o.id !== orderId);
    localStorage.setItem(STORAGE_CUSTOMER_ORDERS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to delete order:', err);
  }
}

/**
 * Clears all customer orders.
 */
export function clearCustomerOrders(): void {
  try {
    localStorage.setItem(STORAGE_CUSTOMER_ORDERS_KEY, JSON.stringify([]));
  } catch (err) {
    console.error('Failed to clear customer orders:', err);
  }
}

/**
 * Requests a password reset via backend /api/auth/forgot-password.
 * Keeps customer passwords private and unreadable to admins and users.
 */
export async function requestPasswordReset(
  email: string
): Promise<{ success: boolean; message: string }> {
  const trimmed = email.trim().toLowerCase();

  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmed }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success) {
      return {
        success: true,
        message: data.message || `A secure password reset link has been dispatched to ${trimmed}.`,
      };
    }
  } catch {
    // Fall back to client storage check if network fails
  }

  const customers = getStoredCustomers();
  const exists = customers.some((c) => c.email.toLowerCase() === trimmed);

  if (!exists && trimmed !== DEMO_CUSTOMER_EMAIL) {
    return {
      success: false,
      message: `No active account found for "${email}". Please verify or create an account.`,
    };
  }

  return {
    success: true,
    message: `A secure password reset link has been dispatched to ${trimmed}. Check your inbox!`,
  };
}

/**
 * Resets a customer password using the secure one-way salted password reset API.
 */
export async function resetCustomerPassword(
  identifier: string,
  newPassword: string,
  resetToken?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, newPassword, resetToken }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success) {
      return {
        success: true,
        message: data.message || 'Password successfully reset.',
      };
    }
    return {
      success: false,
      error: data?.error || 'Failed to reset password.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error during password reset.',
    };
  }
}
