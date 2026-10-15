export interface AuthorizedEmployee {
  employeeId: string;
  fullName: string;
  email: string;
  role: 'employee';
  status: 'active' | 'inactive';
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
    return localStorage.getItem(STORAGE_EMPLOYEE_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

/**
 * Returns currently cached employee user profile from local storage.
 */
export function getStoredEmployeeUser(): AuthorizedEmployee | null {
  try {
    const raw = localStorage.getItem(STORAGE_EMPLOYEE_USER_KEY);
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
    localStorage.removeItem(STORAGE_EMPLOYEE_USER_KEY);
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
