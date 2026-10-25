import { Product } from '../types';
import { getStoredAdminToken } from './adminService';

/**
 * Service for fetching and synchronizing products with the backend database.
 * Preserves MySQL as the source of truth while gracefully falling back to local state.
 */

export async function fetchProductsFromBackend(): Promise<Product[] | null> {
  try {
    const res = await fetch('/api/products');
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && Array.isArray(data.products)) {
      const items = data.products.map((p: any) => ({
        ...p,
        price: Number(p.price),
        stock: Number(p.stock ?? p.quantity ?? 0),
        packSizes: Array.isArray(p.packSizes) ? p.packSizes : undefined,
      }));
      console.log('[Diagnostic Stage 2: ProductService] Received from /api/products: count =', items.length, 'IDs =', items.map((p: any) => p.id));
      return items;
    }
    return null;
  } catch (err) {
    console.warn('[ProductService] Unable to fetch products from backend:', err);
    return null;
  }
}

/**
 * Fetches a single paginated batch of products from MySQL via the backend.
 */
export async function fetchProductsBatchFromBackend(params: {
  offset?: number;
  limit?: number;
  category?: string;
  search?: string;
}): Promise<{ products: Product[]; total: number; hasMore: boolean } | null> {
  try {
    const searchParams = new URLSearchParams();
    if (params.offset !== undefined) searchParams.set('offset', String(params.offset));
    if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
    if (params.category) searchParams.set('category', params.category);
    if (params.search) searchParams.set('search', params.search);

    const res = await fetch(`/api/products?${searchParams.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && Array.isArray(data.products)) {
      const products: Product[] = data.products.map((p: any) => ({
        ...p,
        price: Number(p.price),
        stock: Number(p.stock ?? p.quantity ?? 0),
        packSizes: Array.isArray(p.packSizes) ? p.packSizes : undefined,
      }));
      return {
        products,
        total: Number(data.total ?? products.length),
        hasMore: Boolean(data.hasMore),
      };
    }
    return null;
  } catch (err) {
    console.warn('[ProductService] Unable to fetch products batch:', err);
    return null;
  }
}

/**
 * Iteratively retrieves every page from the backend until the complete catalogue is loaded.
 */
export async function fetchAllProductsFromBackend(batchSize = 100): Promise<Product[] | null> {
  const direct = await fetchProductsFromBackend();
  if (direct && direct.length > 0) {
    return direct;
  }
  try {
    const all: Product[] = [];
    const seen = new Set<string>();
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const batchRes = await fetchProductsBatchFromBackend({ offset, limit: batchSize });
      if (!batchRes) break;
      for (const p of batchRes.products) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          all.push(p);
        }
      }
      if (!batchRes.hasMore || batchRes.products.length === 0 || all.length >= batchRes.total) {
        hasMore = false;
      } else {
        offset += batchRes.products.length;
      }
    }
    return all.length > 0 ? all : null;
  } catch (err) {
    console.warn('[ProductService] Error fetching all paginated products:', err);
    return null;
  }
}

export async function saveProductToBackend(
  product: Partial<Product> & { id: string }
): Promise<boolean> {
  const token = getStoredAdminToken();
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const payload = {
      title: product.title,
      name: product.title,
      price: product.price !== undefined ? Number(product.price) : undefined,
      stock: product.stock !== undefined ? Number(product.stock) : undefined,
      quantity: product.stock !== undefined ? Number(product.stock) : undefined,
      unit: product.unit,
      category: product.category,
      categoryLabel: product.categoryLabel,
      supplier: product.supplier,
      image: product.image,
      description: product.description,
      sku: product.sku,
      badge: product.badge,
      packSizes: product.packSizes,
      isOrganic: product.isOrganic,
      isQuickPrep: product.isQuickPrep,
    };

    // Try updating existing product
    const putRes = await fetch(`/api/products/${encodeURIComponent(product.id)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });

    if (putRes.ok) {
      return true;
    }

    // If product does not yet exist in backend (404), create it via POST
    if (putRes.status === 404) {
      const postRes = await fetch('/api/products', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...payload,
          id: product.id,
          productId: product.id,
        }),
      });
      return postRes.ok;
    }

    return false;
  } catch (err) {
    console.warn('[ProductService] Failed to save product to backend:', err);
    return false;
  }
}

export async function deleteProductFromBackend(productId: string): Promise<boolean> {
  const token = getStoredAdminToken();
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`/api/products/${encodeURIComponent(productId)}`, {
      method: 'DELETE',
      headers,
    });
    return res.ok;
  } catch (err) {
    console.warn('[ProductService] Failed to delete product from backend:', err);
    return false;
  }
}
