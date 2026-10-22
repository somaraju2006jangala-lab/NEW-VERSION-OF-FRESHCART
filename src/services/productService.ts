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
      return data.products.map((p: any) => ({
        ...p,
        price: Number(p.price),
        stock: Number(p.stock ?? p.quantity ?? 0),
        packSizes: Array.isArray(p.packSizes) ? p.packSizes : undefined,
      }));
    }
    return null;
  } catch (err) {
    console.warn('[ProductService] Unable to fetch products from backend:', err);
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
