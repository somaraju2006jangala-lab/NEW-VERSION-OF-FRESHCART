export interface AuthorizedAdmin {
  adminId: string;
  fullName: string;
  email: string;
  role: 'owner' | 'admin';
  status: 'active' | 'inactive';
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export const STORAGE_ADMIN_TOKEN_KEY = 'freshcart_authorized_admin_token';
export const STORAGE_ADMIN_USER_KEY = 'freshcart_authorized_admin_user';

/**
 * Returns currently stored admin JWT token.
 */
export function getStoredAdminToken(): string | null {
  try {
    const direct =
      localStorage.getItem(STORAGE_ADMIN_TOKEN_KEY) ||
      localStorage.getItem('freshcart_admin_token') ||
      sessionStorage.getItem(STORAGE_ADMIN_TOKEN_KEY) ||
      sessionStorage.getItem('freshcart_admin_token');
    if (direct && direct.trim()) return direct.trim();

    const rawUser =
      localStorage.getItem(STORAGE_ADMIN_USER_KEY) ||
      sessionStorage.getItem(STORAGE_ADMIN_USER_KEY);
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
 * Returns currently cached admin user profile from local storage.
 */
export function getStoredAdminUser(): AuthorizedAdmin | null {
  try {
    const raw =
      localStorage.getItem(STORAGE_ADMIN_USER_KEY) ||
      sessionStorage.getItem(STORAGE_ADMIN_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Saves authenticated admin session in browser local storage.
 */
export function saveAdminSession(token: string, admin: AuthorizedAdmin): void {
  try {
    localStorage.setItem(STORAGE_ADMIN_TOKEN_KEY, token);
    localStorage.setItem('freshcart_admin_token', token);
    localStorage.setItem(STORAGE_ADMIN_USER_KEY, JSON.stringify(admin));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Clears stored admin credentials.
 */
export function clearAdminSession(): void {
  try {
    localStorage.removeItem(STORAGE_ADMIN_TOKEN_KEY);
    localStorage.removeItem('freshcart_admin_token');
    localStorage.removeItem(STORAGE_ADMIN_USER_KEY);
    sessionStorage.removeItem(STORAGE_ADMIN_TOKEN_KEY);
    sessionStorage.removeItem('freshcart_admin_token');
    sessionStorage.removeItem(STORAGE_ADMIN_USER_KEY);
  } catch {
    // Ignore
  }
}


/**
 * Authenticates an admin against backend /api/admin/login and MySQL database.
 */
export async function loginAdmin(
  identifier: string,
  pass: string
): Promise<{ success: boolean; admin?: AuthorizedAdmin; token?: string; error?: string }> {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: identifier.trim(), password: pass }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to authenticate admin credentials.',
      };
    }

    if (data.token && data.admin) {
      saveAdminSession(data.token, data.admin);
      return {
        success: true,
        admin: data.admin,
        token: data.token,
      };
    }

    return {
      success: false,
      error: 'Malformed response received from admin server.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error while attempting admin sign in.',
    };
  }
}

/**
 * Verifies active session with backend /api/admin/me.
 * Clears session if token has been revoked or admin was deactivated.
 */
export async function fetchAdminProfile(): Promise<{
  success: boolean;
  admin?: AuthorizedAdmin;
  error?: string;
}> {
  const token = getStoredAdminToken();
  if (!token) {
    return { success: false, error: 'No admin token present.' };
  }

  try {
    const res = await fetch('/api/admin/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      // Invalidate local session if backend rejected token (e.g. deactivated or revoked)
      if (res.status === 401 || res.status === 403) {
        clearAdminSession();
      }
      return {
        success: false,
        error: data.error || 'Admin verification failed.',
      };
    }

    if (data.admin) {
      saveAdminSession(token, data.admin);
      return { success: true, admin: data.admin };
    }

    return { success: false, error: 'Admin record not found.' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error verifying admin session.' };
  }
}

/**
 * Fetches all registered authorized administrators and quota status from backend.
 */
export async function fetchAuthorizedAdmins(): Promise<{
  success: boolean;
  admins: AuthorizedAdmin[];
  activeCount: number;
  maxLimit: number;
  error?: string;
}> {
  const token = getStoredAdminToken();
  try {
    const res = await fetch('/api/admin/users', {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      return {
        success: false,
        admins: [],
        activeCount: 0,
        maxLimit: 5,
        error: data.error || 'Failed to load authorized administrators.',
      };
    }

    return {
      success: true,
      admins: Array.isArray(data.admins) ? data.admins : [],
      activeCount: typeof data.activeCount === 'number' ? data.activeCount : 0,
      maxLimit: typeof data.maxLimit === 'number' ? data.maxLimit : 5,
    };
  } catch (err: any) {
    return {
      success: false,
      admins: [],
      activeCount: 0,
      maxLimit: 5,
      error: err?.message || 'Network error fetching authorized admins.',
    };
  }
}

/**
 * Creates a new authorized admin. Project Owner only.
 */
export async function createAuthorizedAdmin(data: {
  fullName: string;
  email: string;
  password: string;
  adminId?: string;
}): Promise<{ success: boolean; admin?: AuthorizedAdmin; error?: string }> {
  const token = getStoredAdminToken();
  try {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });

    const result = await res.json().catch(() => ({}));

    if (!res.ok || !result.success) {
      return {
        success: false,
        error: result.error || 'Failed to create authorized administrator.',
      };
    }

    return {
      success: true,
      admin: result.admin,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error creating authorized administrator.',
    };
  }
}

/**
 * Toggles an administrator status between active and inactive. Project Owner only.
 */
export async function toggleAdminStatus(
  adminId: string,
  status: 'active' | 'inactive'
): Promise<{ success: boolean; error?: string }> {
  const token = getStoredAdminToken();
  try {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(adminId)}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ status }),
    });

    const result = await res.json().catch(() => ({}));

    if (!res.ok || !result.success) {
      return {
        success: false,
        error: result.error || 'Failed to update administrator status.',
      };
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error updating administrator status.',
    };
  }
}

/**
 * Permanently removes an administrator from the database. Project Owner only.
 */
export async function deleteAuthorizedAdmin(
  adminId: string
): Promise<{ success: boolean; error?: string }> {
  const token = getStoredAdminToken();
  try {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(adminId)}`, {
      method: 'DELETE',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const result = await res.json().catch(() => ({}));

    if (!res.ok || !result.success) {
      return {
        success: false,
        error: result.error || 'Failed to remove administrator.',
      };
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error removing administrator.',
    };
  }
}

export interface AdminCustomerAccount {
  id: string;
  customerId: string;
  name: string;
  email: string | null;
  phone: string | null;
  address?: string | null;
  status: string;
  loyaltyTier?: string;
  createdAt: string;
}

/**
 * Fetches registered customer accounts from backend /api/admin/customers.
 * Supports optional search query (name, user ID, email, phone).
 * Privacy & Security: Passwords/hashes are never exposed or returned.
 */
export async function fetchAdminCustomerAccounts(searchQuery?: string): Promise<{
  success: boolean;
  customers: AdminCustomerAccount[];
  totalCount?: number;
  error?: string;
}> {
  const token = getStoredAdminToken();
  try {
    const url = new URL('/api/admin/customers', window.location.origin);
    if (searchQuery && searchQuery.trim()) {
      url.searchParams.set('search', searchQuery.trim());
    }

    const res = await fetch(url.toString(), {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      return {
        success: false,
        customers: [],
        error: data.error || 'Failed to load customer accounts from MySQL database.',
      };
    }

    return {
      success: true,
      customers: data.customers || [],
      totalCount: data.totalCount || 0,
    };
  } catch (err: any) {
    return {
      success: false,
      customers: [],
      error: err?.message || 'Network error while fetching customer accounts.',
    };
  }
}

/**
 * Updates a customer account status (e.g. Active, Suspended) via backend /api/admin/customers/:customerId/status.
 */
export async function updateCustomerAccountStatus(
  customerId: string,
  status: 'Active' | 'Suspended'
): Promise<{ success: boolean; message?: string; error?: string }> {
  const token = getStoredAdminToken();
  try {
    const res = await fetch(`/api/admin/customers/${encodeURIComponent(customerId)}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ status }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to update customer account status.',
      };
    }

    return {
      success: true,
      message: data.message || `Customer status updated to ${status}.`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error while updating customer status.',
    };
  }
}
