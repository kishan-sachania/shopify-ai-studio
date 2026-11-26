'use client';

import { useState, useEffect, useCallback } from 'react';
import { ExtractedProduct, ProductPushStatus } from '@/types/product';
import { getStoredProductsRaw, setStoredProductsRaw, clearStoredProductsRaw } from '@/lib/storage/localStorage';

export function useLocalStorageProducts() {
  const [products, setProducts] = useState<ExtractedProduct[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize from localStorage on mount (hydration safe)
  useEffect(() => {
    try {
      const raw = getStoredProductsRaw();
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setProducts(parsed);
        }
      }
    } catch (e) {
      console.error('Error hydrating products from localStorage:', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const saveProducts = useCallback((items: ExtractedProduct[]) => {
    setProducts(items);
    setStoredProductsRaw(items);
  }, []);

  const bulkAddProducts = useCallback((newItems: ExtractedProduct[]) => {
    setProducts((prev) => {
      // Avoid duplicate IDs
      const existingIds = new Set(prev.map((p) => p.id));
      const filtered = newItems.filter((p) => !existingIds.has(p.id));
      const combined = [...filtered, ...prev];
      setStoredProductsRaw(combined);
      return combined;
    });
  }, []);

  const updateProduct = useCallback((id: string, updates: Partial<ExtractedProduct>) => {
    setProducts((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
      );
      setStoredProductsRaw(updated);
      return updated;
    });
  }, []);

  const updateProductStatus = useCallback(
    (
      id: string,
      status: ProductPushStatus,
      extra?: {
        shopifyId?: string;
        shopifyHandle?: string;
        shopifyUrl?: string;
        errors?: string[];
      }
    ) => {
      setProducts((prev) => {
        const updated = prev.map((item) => {
          if (item.id !== id) return item;
          return {
            ...item,
            status,
            shopifyId: extra?.shopifyId || item.shopifyId,
            shopifyHandle: extra?.shopifyHandle || item.shopifyHandle,
            shopify_product_url: extra?.shopifyUrl || item.shopify_product_url,
            errorMessages: extra?.errors || item.errorMessages,
            lastPushedAt: status === 'PUSHED' ? new Date().toISOString() : item.lastPushedAt,
            updatedAt: new Date().toISOString(),
          };
        });
        setStoredProductsRaw(updated);
        return updated;
      });
    },
    []
  );

  const deleteProduct = useCallback((id: string) => {
    setProducts((prev) => {
      const filtered = prev.filter((item) => item.id !== id);
      setStoredProductsRaw(filtered);
      return filtered;
    });
  }, []);

  const clearAllProducts = useCallback(() => {
    clearStoredProductsRaw();
    setProducts([]);
  }, []);

  return {
    products,
    isLoaded,
    saveProducts,
    bulkAddProducts,
    updateProduct,
    updateProductStatus,
    deleteProduct,
    clearAllProducts,
  };
}
