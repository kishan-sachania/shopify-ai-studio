'use client';

import { useState, useEffect, useCallback } from 'react';
import { ExtractedProduct, ProductPushStatus } from '@/types/product';
import { useAuth } from '@/context/AuthContext';

export function useLocalStorageProducts() {
  const { workspaceId: authWsId } = useAuth();
  const [products, setProducts] = useState<ExtractedProduct[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const getActiveWorkspaceId = useCallback(() => {
    if (authWsId) return authWsId;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('active_workspace_id');
    }
    return null;
  }, [authWsId]);

  const fetchProducts = useCallback(async () => {
    const wsId = getActiveWorkspaceId();
    if (!wsId) {
      setIsLoaded(true);
      return;
    }

    try {
      const res = await fetch(`/api/products?workspace_id=${encodeURIComponent(wsId)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.products)) {
          setProducts(data.products);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoaded(true);
    }
  }, [getActiveWorkspaceId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    const handleWorkspaceChanged = () => {
      fetchProducts();
    };

    window.addEventListener('workspace_changed', handleWorkspaceChanged);
    return () => {
      window.removeEventListener('workspace_changed', handleWorkspaceChanged);
    };
  }, [fetchProducts]);

  const bulkAddProducts = useCallback(
    async (newItems: ExtractedProduct[]) => {
      const wsId = getActiveWorkspaceId();
      setProducts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const filtered = newItems.filter((p) => !existingIds.has(p.id));
        return [...filtered, ...prev];
      });

      if (!wsId || newItems.length === 0) return;

      try {
        await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId: wsId, products: newItems }),
        });
      } catch (err) {
        console.error(err);
      }
    },
    [getActiveWorkspaceId]
  );

  const updateProduct = useCallback(
    async (id: string, updates: Partial<ExtractedProduct>) => {
      const wsId = getActiveWorkspaceId();
      setProducts((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
        )
      );

      if (!wsId) return;

      try {
        await fetch(`/api/products/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId: wsId, updates }),
        });
      } catch (err) {
        console.error(err);
      }
    },
    [getActiveWorkspaceId]
  );

  const updateProductStatus = useCallback(
    async (
      id: string,
      status: ProductPushStatus,
      extra?: {
        shopifyId?: string;
        shopifyHandle?: string;
        shopifyUrl?: string;
        errors?: string[];
      }
    ) => {
      const wsId = getActiveWorkspaceId();
      const updates: Partial<ExtractedProduct> = {
        status,
        shopifyId: extra?.shopifyId,
        shopifyHandle: extra?.shopifyHandle,
        shopify_product_url: extra?.shopifyUrl,
        errorMessages: extra?.errors,
        lastPushedAt: status === 'PUSHED' ? new Date().toISOString() : undefined,
        updatedAt: new Date().toISOString(),
      };

      setProducts((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          return {
            ...item,
            status,
            shopifyId:
              extra?.shopifyId !== undefined
                ? extra.shopifyId
                : status === 'ERROR' && extra?.errors?.some((e) => e.includes('does not exist'))
                ? undefined
                : item.shopifyId,
            shopifyHandle: extra?.shopifyHandle || item.shopifyHandle,
            shopify_product_url: extra?.shopifyUrl || item.shopify_product_url,
            errorMessages: extra?.errors || item.errorMessages,
            lastPushedAt: status === 'PUSHED' ? new Date().toISOString() : item.lastPushedAt,
            updatedAt: new Date().toISOString(),
          };
        })
      );

      if (!wsId) return;

      try {
        await fetch(`/api/products/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId: wsId, updates }),
        });
      } catch (err) {
        console.error(err);
      }
    },
    [getActiveWorkspaceId]
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      const wsId = getActiveWorkspaceId();
      setProducts((prev) => prev.filter((item) => item.id !== id));

      if (!wsId) return;

      try {
        await fetch(`/api/products/${encodeURIComponent(id)}?workspace_id=${encodeURIComponent(wsId)}`, {
          method: 'DELETE',
        });
      } catch (err) {
        console.error(err);
      }
    },
    [getActiveWorkspaceId]
  );

  const clearAllProducts = useCallback(async () => {
    const wsId = getActiveWorkspaceId();
    setProducts([]);

    if (!wsId) return;

    try {
      await fetch(`/api/products?workspace_id=${encodeURIComponent(wsId)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error(err);
    }
  }, [getActiveWorkspaceId]);

  return {
    products,
    isLoaded,
    bulkAddProducts,
    updateProduct,
    updateProductStatus,
    deleteProduct,
    clearAllProducts,
    refreshProducts: fetchProducts,
  };
}
