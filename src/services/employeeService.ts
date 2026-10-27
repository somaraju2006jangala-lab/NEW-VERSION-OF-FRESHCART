import { getStoredAdminToken } from './adminService';

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
}

export const STORAGE_EMPLOYEE_TOKEN_KEY = 'freshcart_authorized_employee_token';
export const STORAGE_EMPLOYEE_USER_KEY = 'freshcart_authorized_employee_user';

export const DEMO_EMPLOYEE_EMAIL = 'employee@freshcart.com';
export const DEMO_EMPLOYEE_PASSWORD = 'FreshCartEmployee2026!';

/**
 * Returns currently stored employee JWT token.
 */
export function getStoredEmployeeToken(): string | null {
  try {
    const direct =
      localStorage.getItem(STORAGE_EMPLOYEE_TOKEN_KEY) ||
      localStorage.getItem('freshcart_employee_token') ||
      sessionStorage.getItem(STORAGE_EMPLOYEE_TOKEN_KEY) ||
      sessionStorage.getItem('freshcart_employee_token');
    if (direct && direct.trim()) return direct.trim();

    const rawUser =
      localStorage.getItem(STORAGE_EMPLOYEE_USER_KEY) ||
      sessionStorage.getItem(STORAGE_EMPLOYEE_USER_KEY);
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      if (parsed && typeof parsed.token === 'string' && parsed.token.trim()) {
        return parsed.token.trim();
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Returns currently active authenticated staff or admin token.
 * Prefers admin token for administrative operations like employee registration.
 */
export function getStoredStaffToken(): string | null {
  return getStoredAdminToken() || getStoredEmployeeToken() || null;
}

/**
 * Returns currently cached employee user profile from local storage.
 */
export function getStoredEmployeeUser(): AuthorizedEmployee | null {
  try {
    const raw =
      localStorage.getItem(STORAGE_EMPLOYEE_USER_KEY) ||
      sessionStorage.getItem(STORAGE_EMPLOYEE_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Saves authenticated employee session in browser local storage.
 */
export function saveEmployeeSession(token: string, employee: AuthorizedEmployee): void {
  try {
    localStorage.setItem(STORAGE_EMPLOYEE_TOKEN_KEY, token);
    localStorage.setItem('freshcart_employee_token', token);
    localStorage.setItem(STORAGE_EMPLOYEE_USER_KEY, JSON.stringify(employee));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Clears stored employee credentials.
 */
export function clearEmployeeSession(): void {
  try {
    localStorage.removeItem(STORAGE_EMPLOYEE_TOKEN_KEY);
    localStorage.removeItem('freshcart_employee_token');
    localStorage.removeItem(STORAGE_EMPLOYEE_USER_KEY);
    sessionStorage.removeItem(STORAGE_EMPLOYEE_TOKEN_KEY);
    sessionStorage.removeItem('freshcart_employee_token');
    sessionStorage.removeItem(STORAGE_EMPLOYEE_USER_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Verifies active employee session with backend /api/employee/me.
 * Clears session if token has been revoked or employee was deactivated.
 */
export async function fetchEmployeeProfile(): Promise<{
  success: boolean;
  employee?: AuthorizedEmployee;
  error?: string;
}> {
  const token = getStoredEmployeeToken();
  if (!token) {
    return { success: false, error: 'No employee token present.' };
  }

  try {
    const res = await fetch('/api/employee/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      if (res.status === 401 || res.status === 403) {
        clearEmployeeSession();
      }
      return {
        success: false,
        error: data.error || 'Employee verification failed.',
      };
    }

    if (data.employee) {
      saveEmployeeSession(token, data.employee);
      return { success: true, employee: data.employee };
    }

    return { success: false, error: 'Employee record not found.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error verifying employee session.' };
  }
}

/**
 * Fetches all registered employees from backend. Admin only.
 */
export async function fetchRegisteredEmployees(authToken?: string): Promise<{
  success: boolean;
  employees: AuthorizedEmployee[];
  totalCount: number;
  activeCount: number;
  error?: string;
}> {
  const token = (authToken && authToken.trim()) || getStoredAdminToken() || getStoredEmployeeToken();
  if (!token) {
    return {
      success: false,
      employees: [],
      totalCount: 0,
      activeCount: 0,
      error: 'Admin session has expired or authentication token is missing. Please sign in again.',
    };
  }

  try {
    const res = await fetch('/api/admin/employees', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-admin-token': token,
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      const fallback =
        res.status === 401
          ? 'Admin session has expired. Please sign in again.'
          : res.status === 403
          ? 'Access denied: Administrator privileges required.'
          : 'Failed to load employees from MySQL database.';
      return {
        success: false,
        employees: [],
        totalCount: 0,
        activeCount: 0,
        error: data.error || fallback,
      };
    }

    return {
      success: true,
      employees: Array.isArray(data.employees) ? data.employees : [],
      totalCount: typeof data.totalCount === 'number' ? data.totalCount : 0,
      activeCount: typeof data.activeCount === 'number' ? data.activeCount : 0,
    };
  } catch (err: any) {
    return {
      success: false,
      employees: [],
      totalCount: 0,
      activeCount: 0,
      error: err?.message || 'Network error fetching registered employees.',
    };
  }
}

/**
 * Provisions a new employee in MySQL. Admin only.
 */
export async function createEmployee(
  data: {
    fullName: string;
    email: string;
    mobile?: string;
    username?: string;
    password: string;
    employeeId?: string;
    status?: 'active' | 'inactive';
  },
  authToken?: string
): Promise<{
  success: boolean;
  employee?: AuthorizedEmployee;
  message?: string;
  error?: string;
  isAuthError?: boolean;
}> {
  const token = (authToken && authToken.trim()) || getStoredAdminToken() || getStoredEmployeeToken();
  if (!token) {
    return {
      success: false,
      error: 'Admin session has expired or authentication token is missing. Please sign in again.',
      isAuthError: true,
    };
  }

  try {
    const res = await fetch('/api/admin/employees', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-admin-token': token,
      },
      body: JSON.stringify(data),
    });

    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.success) {
      const isAuthError = res.status === 401 || res.status === 403;
      const fallback =
        res.status === 401
          ? 'Admin session has expired. Please sign in again.'
          : res.status === 403
          ? 'Access denied: Administrator privileges required to register employees.'
          : 'Failed to create employee account.';
      return {
        success: false,
        error: result.error || fallback,
        isAuthError,
      };
    }

    return {
      success: true,
      employee: result.employee,
      message: result.message,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error creating employee account.',
    };
  }
}


/**
 * Updates employee details (name, email, mobile, username, status). Admin only.
 */
export async function updateEmployee(
  employeeId: string,
  data: {
    fullName?: string;
    email?: string;
    mobile?: string;
    username?: string;
    status?: 'active' | 'inactive';
  },
  authToken?: string
): Promise<{
  success: boolean;
  employee?: AuthorizedEmployee;
  message?: string;
  error?: string;
}> {
  const token = (authToken && authToken.trim()) || getStoredAdminToken() || getStoredEmployeeToken();
  if (!token) {
    return {
      success: false,
      error: 'Admin session has expired or authentication token is missing. Please sign in again.',
    };
  }

  try {
    const res = await fetch(`/api/admin/employees/${encodeURIComponent(employeeId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-admin-token': token,
      },
      body: JSON.stringify(data),
    });

    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.success) {
      return {
        success: false,
        error: result.error || 'Failed to update employee details.',
      };
    }

    return {
      success: true,
      employee: result.employee,
      message: result.message,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error updating employee details.',
    };
  }
}

/**
 * Activates or deactivates an employee account. Admin only.
 */
export async function toggleEmployeeStatus(
  employeeId: string,
  status: 'active' | 'inactive',
  authToken?: string
): Promise<{
  success: boolean;
  status?: string;
  message?: string;
  error?: string;
}> {
  const token = (authToken && authToken.trim()) || getStoredAdminToken() || getStoredEmployeeToken();
  if (!token) {
    return {
      success: false,
      error: 'Admin session has expired or authentication token is missing. Please sign in again.',
    };
  }

  try {
    const res = await fetch(`/api/admin/employees/${encodeURIComponent(employeeId)}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-admin-token': token,
      },
      body: JSON.stringify({ status }),
    });

    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.success) {
      return {
        success: false,
        error: result.error || 'Failed to update employee status.',
      };
    }

    return {
      success: true,
      status: result.status,
      message: result.message,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error updating employee status.',
    };
  }
}

/**
 * Resets an employee password with secure bcrypt hashing. Admin only.
 */
export async function resetEmployeePassword(
  employeeId: string,
  newPassword: string,
  authToken?: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const token = (authToken && authToken.trim()) || getStoredAdminToken() || getStoredEmployeeToken();
  if (!token) {
    return {
      success: false,
      error: 'Admin session has expired or authentication token is missing. Please sign in again.',
    };
  }

  try {
    const res = await fetch(`/api/admin/employees/${encodeURIComponent(employeeId)}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-admin-token': token,
      },
      body: JSON.stringify({ newPassword }),
    });

    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.success) {
      return {
        success: false,
        error: result.error || 'Failed to reset employee password.',
      };
    }

    return {
      success: true,
      message: result.message,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error resetting employee password.',
    };
  }
}

/**
 * Permanently removes an employee account. Admin only.
 */
export async function deleteEmployee(
  employeeId: string,
  authToken?: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const token = (authToken && authToken.trim()) || getStoredAdminToken() || getStoredEmployeeToken();
  if (!token) {
    return {
      success: false,
      error: 'Admin session has expired or authentication token is missing. Please sign in again.',
    };
  }

  try {
    const res = await fetch(`/api/admin/employees/${encodeURIComponent(employeeId)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-admin-token': token,
      },
    });

    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.success) {
      return {
        success: false,
        error: result.error || 'Failed to delete employee account.',
      };
    }

    return {
      success: true,
      message: result.message,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error deleting employee account.',
    };
  }
}
