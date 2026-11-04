import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Customer, AuthorizedAdmin, AuthorizedEmployee } from '../types';
import { authApi, cleanErrorMessage } from '../services/apiClient';

export type PortalType = 'selection' | 'admin' | 'employee' | 'customer';

interface AuthContextType {
  activePortal: PortalType;
  setActivePortal: (portal: PortalType) => void;
  currentAdmin: AuthorizedAdmin | null;
  currentEmployee: AuthorizedEmployee | null;
  currentCustomer: Customer | null;
  adminToken: string | null;
  employeeToken: string | null;
  customerToken: string | null;
  isLoading: boolean;
  loginAdmin: (identifier: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  loginEmployee: (identifier: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  loginCustomer: (identifier: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  registerCustomer: (data: { fullName: string; email: string; mobile: string; password: string; address?: string }) => Promise<{ success: boolean; error?: string }>;
  logout: (portal?: PortalType) => Promise<void>;
  updateCustomerProfile: (updates: { name?: string; phone?: string; address?: string }) => Promise<void>;
}

const STORAGE_PORTAL_KEY = 'freshcart_mobile_active_portal';
const STORAGE_ADMIN_KEY = 'freshcart_mobile_admin_session';
const STORAGE_EMPLOYEE_KEY = 'freshcart_mobile_employee_session';
const STORAGE_CUSTOMER_KEY = 'freshcart_mobile_customer_session';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activePortal, setActivePortalState] = useState<PortalType>('selection');
  const [currentAdmin, setCurrentAdmin] = useState<AuthorizedAdmin | null>(null);
  const [currentEmployee, setCurrentEmployee] = useState<AuthorizedEmployee | null>(null);
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [employeeToken, setEmployeeToken] = useState<string | null>(null);
  const [customerToken, setCustomerToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore sessions from storage on launch
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const [savedPortal, savedAdmin, savedEmp, savedCust] = await Promise.all([
          AsyncStorage.getItem(STORAGE_PORTAL_KEY),
          AsyncStorage.getItem(STORAGE_ADMIN_KEY),
          AsyncStorage.getItem(STORAGE_EMPLOYEE_KEY),
          AsyncStorage.getItem(STORAGE_CUSTOMER_KEY),
        ]);

        if (savedAdmin) {
          const parsed = JSON.parse(savedAdmin);
          setCurrentAdmin(parsed.admin);
          setAdminToken(parsed.token);
        }
        if (savedEmp) {
          const parsed = JSON.parse(savedEmp);
          setCurrentEmployee(parsed.employee);
          setEmployeeToken(parsed.token);
        }
        if (savedCust) {
          const parsed = JSON.parse(savedCust);
          setCurrentCustomer(parsed.customer);
          setCustomerToken(parsed.token);
        }

        if (savedPortal && ['selection', 'admin', 'employee', 'customer'].includes(savedPortal)) {
          setActivePortalState(savedPortal as PortalType);
        }
      } catch (err) {
        console.warn('Failed restoring mobile session:', err);
      } finally {
        setIsLoading(false);
      }
    };
    restoreSession();
  }, []);

  const setActivePortal = async (portal: PortalType) => {
    setActivePortalState(portal);
    try {
      await AsyncStorage.setItem(STORAGE_PORTAL_KEY, portal);
    } catch {}
  };

  const loginAdmin = async (identifier: string, pass: string) => {
    try {
      // First try dedicated admin login endpoint
      let res = await authApi.adminLogin(identifier, pass);
      if (!res.success) {
        // Fallback to unified auth login endpoint
        try {
          const fallbackRes = await authApi.login(identifier, pass);
          if (fallbackRes.success && (fallbackRes.role === 'admin' || fallbackRes.admin)) {
            res = fallbackRes;
          }
        } catch {}
      }

      if (res.success && res.admin && res.token) {
        // Enforce role
        if (res.admin.role !== 'owner' && res.admin.role !== 'admin') {
          return { success: false, error: 'Access denied: Account is not an administrator.' };
        }
        setCurrentAdmin(res.admin);
        setAdminToken(res.token);
        await AsyncStorage.setItem(
          STORAGE_ADMIN_KEY,
          JSON.stringify({ admin: res.admin, token: res.token })
        );
        await setActivePortal('admin');
        return { success: true };
      }
      return { success: false, error: res.error || 'Invalid administrator credentials.' };
    } catch (err: any) {
      return { success: false, error: cleanErrorMessage(err, 'Login failed.') };
    }
  };

  const loginEmployee = async (identifier: string, pass: string) => {
    try {
      // Call shared auth login
      const res = await authApi.login(identifier, pass);
      if (res.success && (res.role === 'employee' || res.employee)) {
        const emp = res.employee;
        const token = res.token;
        if (!emp || !token) {
          return { success: false, error: 'Employee authorization missing from server response.' };
        }
        setCurrentEmployee(emp);
        setEmployeeToken(token);
        await AsyncStorage.setItem(
          STORAGE_EMPLOYEE_KEY,
          JSON.stringify({ employee: emp, token })
        );
        await setActivePortal('employee');
        return { success: true };
      }
      if (res.success && res.role !== 'employee') {
        return { success: false, error: 'Access denied: This portal is for delivery staff only.' };
      }
      return { success: false, error: res.error || 'Invalid employee credentials.' };
    } catch (err: any) {
      return { success: false, error: cleanErrorMessage(err, 'Employee login failed.') };
    }
  };

  const loginCustomer = async (identifier: string, pass: string) => {
    try {
      const res = await authApi.login(identifier, pass);
      if (res.success && (res.role === 'customer' || res.customer)) {
        const cust = res.customer;
        const token = res.token || 'demo_token';
        setCurrentCustomer(cust);
        setCustomerToken(token);
        await AsyncStorage.setItem(
          STORAGE_CUSTOMER_KEY,
          JSON.stringify({ customer: cust, token })
        );
        await setActivePortal('customer');
        return { success: true };
      }
      return { success: false, error: res.error || 'Invalid email or password.' };
    } catch (err: any) {
      return { success: false, error: cleanErrorMessage(err, 'Customer login failed.') };
    }
  };

  const registerCustomer = async (data: {
    fullName: string;
    email: string;
    mobile: string;
    password: string;
    address?: string;
  }) => {
    try {
      const res = await authApi.register(data);
      if (res.success && res.customer) {
        const cust = res.customer;
        const token = res.token || 'demo_token';
        setCurrentCustomer(cust);
        setCustomerToken(token);
        await AsyncStorage.setItem(
          STORAGE_CUSTOMER_KEY,
          JSON.stringify({ customer: cust, token })
        );
        await setActivePortal('customer');
        return { success: true };
      }
      return { success: false, error: res.error || 'Registration failed.' };
    } catch (err: any) {
      return { success: false, error: cleanErrorMessage(err, 'Registration failed.') };
    }
  };

  const updateCustomerProfile = async (updates: { name?: string; phone?: string; address?: string }) => {
    if (!customerToken || !currentCustomer) return;
    try {
      const res = await authApi.updateProfile(customerToken, updates);
      if (res.success && res.customer) {
        const updated = { ...currentCustomer, ...res.customer };
        setCurrentCustomer(updated);
        await AsyncStorage.setItem(
          STORAGE_CUSTOMER_KEY,
          JSON.stringify({ customer: updated, token: customerToken })
        );
      }
    } catch (err) {
      console.warn('Profile update error:', err);
    }
  };

  const logout = async (portal?: PortalType) => {
    const targetPortal = portal || activePortal;
    if (targetPortal === 'admin') {
      setCurrentAdmin(null);
      setAdminToken(null);
      await AsyncStorage.removeItem(STORAGE_ADMIN_KEY);
    } else if (targetPortal === 'employee') {
      setCurrentEmployee(null);
      setEmployeeToken(null);
      await AsyncStorage.removeItem(STORAGE_EMPLOYEE_KEY);
    } else if (targetPortal === 'customer') {
      setCurrentCustomer(null);
      setCustomerToken(null);
      await AsyncStorage.removeItem(STORAGE_CUSTOMER_KEY);
    }
    await setActivePortal('selection');
  };

  return (
    <AuthContext.Provider
      value={{
        activePortal,
        setActivePortal,
        currentAdmin,
        currentEmployee,
        currentCustomer,
        adminToken,
        employeeToken,
        customerToken,
        isLoading,
        loginAdmin,
        loginEmployee,
        loginCustomer,
        registerCustomer,
        logout,
        updateCustomerProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
