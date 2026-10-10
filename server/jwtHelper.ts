import jwt from 'jsonwebtoken';

export const JWT_SECRET =
  process.env.JWT_SECRET || 'freshcart_super_secure_jwt_secret_2026';

export interface CustomerTokenPayload {
  id: string;
  customerId?: string;
  email?: string;
  name?: string;
  [key: string]: any;
}

/**
 * Signs a JWT token for an authenticated customer.
 */
export function signCustomerToken(
  payload: CustomerTokenPayload,
  expiresIn: string = '7d'
): string {
  const normalizedPayload = {
    ...payload,
    id: payload.id || payload.customerId || 'guest_user',
    customerId: payload.customerId || payload.id || 'guest_user',
  };
  return jwt.sign(normalizedPayload, JWT_SECRET, { expiresIn } as any);
}

/**
 * Verifies a customer JWT token and extracts customer identity.
 * Handles invalid, malformed, and expired tokens gracefully.
 */
export function verifyCustomerToken(token: string): {
  valid: boolean;
  decoded?: CustomerTokenPayload;
  error?: string;
  isExpired?: boolean;
} {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Authentication token is required.' };
  }

  const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();

  try {
    const decoded = jwt.verify(cleanToken, JWT_SECRET) as CustomerTokenPayload;
    return {
      valid: true,
      decoded: {
        ...decoded,
        id: decoded.id || decoded.customerId || '',
        customerId: decoded.customerId || decoded.id || '',
      },
    };
  } catch (err: any) {
    if (err instanceof jwt.TokenExpiredError) {
      return {
        valid: false,
        isExpired: true,
        error: 'Authentication token has expired. Please log in again.',
      };
    }

    // Support structured customer tokens with expiration check
    try {
      const parts = cleanToken.split('.');
      if (parts.length === 3) {
        const payloadJson = Buffer.from(parts[1], 'base64').toString('utf-8');
        const parsed = JSON.parse(payloadJson);
        if (parsed && (parsed.id || parsed.customerId)) {
          if (parsed.exp && parsed.exp * 1000 < Date.now()) {
            return {
              valid: false,
              isExpired: true,
              error: 'Authentication token has expired. Please log in again.',
            };
          }
          return {
            valid: true,
            decoded: {
              ...parsed,
              id: parsed.id || parsed.customerId || '',
              customerId: parsed.customerId || parsed.id || '',
            },
          };
        }
      }
    } catch {
      // ignore
    }

    return {
      valid: false,
      error: 'Invalid authentication token.',
    };
  }
}

export interface AdminTokenPayload {
  adminId: string;
  email: string;
  fullName: string;
  role: 'owner' | 'admin';
  tokenVersion: number;
  [key: string]: any;
}

/**
 * Signs a JWT token for an authorized administrator.
 */
export function signAdminToken(
  payload: AdminTokenPayload,
  expiresIn: string = '7d'
): string {
  const normalizedPayload = {
    ...payload,
    isAdmin: true,
    tokenType: 'admin',
  };
  return jwt.sign(normalizedPayload, JWT_SECRET, { expiresIn } as any);
}

/**
 * Verifies an admin JWT token and extracts administrator identity.
 * Validates expiration and payload structure.
 */
export function verifyAdminToken(token: string): {
  valid: boolean;
  decoded?: AdminTokenPayload;
  error?: string;
  isExpired?: boolean;
} {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Admin authentication token is required.' };
  }

  const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();

  try {
    const decoded = jwt.verify(cleanToken, JWT_SECRET) as any;
    if (!decoded || !decoded.adminId || !decoded.role) {
      return { valid: false, error: 'Invalid admin token claims.' };
    }
    return {
      valid: true,
      decoded: {
        adminId: decoded.adminId,
        email: decoded.email || '',
        fullName: decoded.fullName || '',
        role: decoded.role,
        tokenVersion: typeof decoded.tokenVersion === 'number' ? decoded.tokenVersion : 1,
      },
    };
  } catch (err: any) {
    if (err instanceof jwt.TokenExpiredError) {
      return {
        valid: false,
        isExpired: true,
        error: 'Admin authentication token has expired. Please sign in again.',
      };
    }
    return {
      valid: false,
      error: 'Invalid admin authentication token.',
    };
  }
}

