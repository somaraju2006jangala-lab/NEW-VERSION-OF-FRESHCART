import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartItem, Product } from '../types';
import { useAuth } from './AuthContext';
import { customerApi } from '../services/apiClient';

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number, packSize?: string, packPrice?: number) => void;
  updateQuantity: (productId: string, quantity: number, packSize?: string) => void;
  removeFromCart: (productId: string, packSize?: string) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
}

const STORAGE_CART_KEY = 'freshcart_mobile_cart_v1';

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { customerToken } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);

  // Load saved cart from local storage
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_CART_KEY)
      .then((saved) => {
        if (saved) {
          try {
            setCart(JSON.parse(saved));
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  // Save cart to local storage whenever it changes
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_CART_KEY, JSON.stringify(cart)).catch(() => {});
  }, [cart]);

  // Sync cart from MySQL when authenticated
  useEffect(() => {
    if (customerToken) {
      customerApi
        .getCart(customerToken)
        .then((res: any) => {
          if (res?.success && Array.isArray(res.items) && res.items.length > 0) {
            setCart(res.items);
          }
        })
        .catch(() => {});
    }
  }, [customerToken]);

  const addToCart = (product: Product, quantity: number = 1, packSize?: string, packPrice?: number) => {
    setCart((prev) => {
      const targetSize = packSize || (product.packSizes && product.packSizes[0]?.size);
      const targetPrice = packPrice !== undefined ? packPrice : product.price;

      const existingIndex = prev.findIndex(
        (item) => item.product.id === product.id && (targetSize ? item.selectedPackSize === targetSize : true)
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        const newQty = updated[existingIndex].quantity + quantity;
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQty,
        };
        // Backend sync
        if (customerToken) {
          customerApi.saveCartItem(customerToken, product.id, newQty).catch(() => {});
        }
        return updated;
      }

      const newItem: CartItem = {
        product,
        quantity,
        selectedPackSize: targetSize,
        selectedPrice: targetPrice,
      };

      if (customerToken) {
        customerApi.saveCartItem(customerToken, product.id, quantity).catch(() => {});
      }

      return [...prev, newItem];
    });
  };

  const updateQuantity = (productId: string, quantity: number, packSize?: string) => {
    setCart((prev) => {
      if (quantity <= 0) {
        if (customerToken) {
          customerApi.removeCartItem(customerToken, productId).catch(() => {});
        }
        return prev.filter(
          (item) => !(item.product.id === productId && (packSize ? item.selectedPackSize === packSize : true))
        );
      }

      const updated = prev.map((item) => {
        if (item.product.id === productId && (packSize ? item.selectedPackSize === packSize : true)) {
          if (customerToken) {
            customerApi.saveCartItem(customerToken, productId, quantity).catch(() => {});
          }
          return { ...item, quantity };
        }
        return item;
      });
      return updated;
    });
  };

  const removeFromCart = (productId: string, packSize?: string) => {
    setCart((prev) =>
      prev.filter((item) => !(item.product.id === productId && (packSize ? item.selectedPackSize === packSize : true)))
    );
    if (customerToken) {
      customerApi.removeCartItem(customerToken, productId).catch(() => {});
    }
  };

  const clearCart = () => {
    setCart([]);
    if (customerToken) {
      customerApi.clearCart(customerToken).catch(() => {});
    }
  };

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const subtotal = cart.reduce((sum, item) => {
    const price = item.selectedPrice !== undefined ? item.selectedPrice : item.product.price;
    return sum + price * item.quantity;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        itemCount,
        subtotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
