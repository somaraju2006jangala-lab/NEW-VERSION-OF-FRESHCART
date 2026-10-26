import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Customer, CustomerAddress, CustomerOrder } from '../types';
import {
  getCurrentCustomer,
  loginCustomer,
  loginShared,
  registerCustomer,
  logoutCustomer,
  updateCustomerProfile,
  addSavedAddress,
  removeSavedAddress,
  getCustomerOrders,
  saveOrderForCustomer,
  requestPasswordReset,
  initializeAuthStore,
  RegisterPayload,
  syncBackendOrders,
  STORAGE_CURRENT_USER_KEY,
  saveCustomerLocally,
} from '../services/authService';
import { AuthorizedAdmin } from '../services/adminService';
import { AuthorizedEmployee } from '../services/employeeService';

export interface AuthLoginResponse {
  success: boolean;
  role?: 'admin' | 'employee' | 'customer';
  userRole?: 'ADMIN' | 'EMPLOYEE' | 'CUSTOMER';
  admin?: AuthorizedAdmin;
  employee?: AuthorizedEmployee;
  error?: string;
}

interface AuthContextType {
  currentUser: Customer | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  orders: CustomerOrder[];
  login: (identifier: string, pass: string) => Promise<AuthLoginResponse>;
  register: (payload: RegisterPayload) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (updates: Partial<Pick<Customer, 'name' | 'phone' | 'address'>>) => void;
  addAddress: (address: Omit<CustomerAddress, 'id'>) => void;
  removeAddress: (addressId: string) => void;
  refreshOrders: () => void;
  addOrder: (order: CustomerOrder) => void;
  requestReset: (email: string) => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Customer | null>(() => getCurrentCustomer());
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem(STORAGE_CURRENT_USER_KEY);
    } catch {
      return false;
    }
  });
  const [orders, setOrders] = useState<CustomerOrder[]>([]);

  const refreshOrders = useCallback(() => {
    const customerOrders = getCustomerOrders(currentUser?.id);
    setOrders(customerOrders);

    const custId = currentUser?.id;
    const url = custId ? `/api/orders?customerId=${encodeURIComponent(custId)}` : '/api/orders';
    fetch(url, {
      headers: {
        ...(currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {}),
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.orders)) {
          syncBackendOrders(data.orders);
          const synced = getCustomerOrders(currentUser?.id);
          setOrders(synced);
        }
      })
      .catch(() => {});
  }, [currentUser?.id, currentUser?.token]);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeAuthStore();
        const user = getCurrentCustomer();
        if (user) {
          if (user.token) {
            try {
              const res = await fetch('/api/auth/me', {
                headers: { Authorization: `Bearer ${user.token}` },
              });
              if (res.ok) {
                const data = await res.json().catch(() => ({}));
                if (data?.success && data?.customer) {
                  const verifiedCustomer: Customer = {
                    ...user,
                    ...data.customer,
                    role: 'customer',
                    userRole: 'CUSTOMER',
                    token: user.token,
                  };
                  setCurrentUser(verifiedCustomer);
                  localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(verifiedCustomer));
                  saveCustomerLocally(verifiedCustomer);
                  setOrders(getCustomerOrders(verifiedCustomer.id));
                } else {
                  setCurrentUser(user);
                  setOrders(getCustomerOrders(user.id));
                }
              } else if (res.status === 401 || res.status === 403) {
                // Token expired or invalid - clear session!
                logoutCustomer();
                setCurrentUser(null);
                setOrders([]);
              } else {
                setCurrentUser(user);
                setOrders(getCustomerOrders(user.id));
              }
            } catch {
              setCurrentUser(user);
              setOrders(getCustomerOrders(user.id));
            }

            // Sync orders if user still active
            const ordersUrl = user.id ? `/api/orders?customerId=${encodeURIComponent(user.id)}` : '/api/orders';
            fetch(ordersUrl, {
              headers: { Authorization: `Bearer ${user.token}` },
            })
              .then((res) => res.json())
              .then((data) => {
                if (data?.success && Array.isArray(data.orders)) {
                  syncBackendOrders(data.orders);
                  setOrders(getCustomerOrders(user.id));
                }
              })
              .catch(() => {});
          } else {
            setCurrentUser(user);
            setOrders(getCustomerOrders(user.id));
          }
        } else {
          setCurrentUser(null);
        }
      } catch (err) {
        console.error('Error during Auth initialization:', err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const login = async (identifier: string, pass: string): Promise<AuthLoginResponse> => {
    setIsLoading(true);
    try {
      const res = await loginShared(identifier, pass);
      if (res.success) {
        if (res.role === 'employee' && res.employee) {
          return {
            success: true,
            role: 'employee',
            userRole: 'EMPLOYEE',
            employee: res.employee,
          };
        }
        if (res.role === 'admin' && res.admin) {
          return {
            success: true,
            role: 'admin',
            userRole: 'ADMIN',
            admin: res.admin,
          };
        }
        if (res.customer) {
          setCurrentUser(res.customer);
          setOrders(getCustomerOrders(res.customer.id));
          if (res.customer.token) {
            const custId = res.customer.id;
            fetch(`/api/orders?customerId=${encodeURIComponent(custId)}`, {
              headers: { Authorization: `Bearer ${res.customer.token}` },
            })
              .then((r) => r.json())
              .then((data) => {
                if (data?.success && Array.isArray(data.orders)) {
                  syncBackendOrders(data.orders);
                  setOrders(getCustomerOrders(custId));
                }
              })
              .catch(() => {});
          }
          return {
            success: true,
            role: 'customer',
            userRole: 'CUSTOMER',
          };
        }
      }
      return { success: false, error: res.error || 'Login failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterPayload) => {
    setIsLoading(true);
    try {
      const res = await registerCustomer(payload);
      if (res.success && res.customer) {
        setCurrentUser(res.customer);
        setOrders(getCustomerOrders(res.customer.id));
        return { success: true };
      }
      return { success: false, error: res.error || 'Registration failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    logoutCustomer();
    setCurrentUser(null);
    setOrders([]);
  };

  const updateProfile = (updates: Partial<Pick<Customer, 'name' | 'phone' | 'address'>>) => {
    if (!currentUser) return;
    const updated = updateCustomerProfile(currentUser.id, updates);
    if (updated) {
      setCurrentUser(updated);
    }
  };

  const addAddress = (address: Omit<CustomerAddress, 'id'>) => {
    if (!currentUser) return;
    const updated = addSavedAddress(currentUser.id, address);
    if (updated) {
      setCurrentUser(updated);
    }
  };

  const removeAddress = (addressId: string) => {
    if (!currentUser) return;
    const updated = removeSavedAddress(currentUser.id, addressId);
    if (updated) {
      setCurrentUser(updated);
    }
  };

  const addOrder = (order: CustomerOrder) => {
    saveOrderForCustomer(order);
    refreshOrders();
  };

  const requestReset = async (email: string) => {
    return await requestPasswordReset(email);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isLoading,
        orders,
        login,
        register,
        logout,
        updateProfile,
        addAddress,
        removeAddress,
        refreshOrders,
        addOrder,
        requestReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
