'use client';

import { useState } from 'react';
import { ExtractedProduct } from '@/types/product';

interface UseShopifyPushOptions {
  onProductPushed?: (
    productId: string,
    success: boolean,
    details?: { shopifyId?: string; shopifyHandle?: string; shopifyUrl?: string; errors?: string[] }
  ) => void;
}

export function useShopifyPush({ onProductPushed }: UseShopifyPushOptions = {}) {
  const [isPushing, setIsPushing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [currentTitle, setCurrentTitle] = useState<string>('');

  const pushSingleProduct = async (product: ExtractedProduct) => {
    try {
      const res = await fetch('/api/shopify/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to push product');
      }

      const result = data.results?.[0];
      if (result) {
        onProductPushed?.(product.id, result.success, {
          shopifyId: result.shopifyId,
          shopifyHandle: result.shopifyHandle,
          shopifyUrl: result.shopifyUrl,
          errors: result.errors,
        });
      }

      return result;
    } catch (err: any) {
      onProductPushed?.(product.id, false, { errors: [err.message] });
      return { success: false, errors: [err.message] };
    }
  };

  const pushBatch = async (products: ExtractedProduct[]) => {
    if (products.length === 0) return;

    setIsPushing(true);
    setProgress({ current: 0, total: products.length, success: 0, failed: 0 });

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      setCurrentTitle(product.title);
      setProgress((p) => ({ ...p, current: i + 1 }));

      const res = await pushSingleProduct(product);
      if (res?.success) {
        successCount++;
      } else {
        failedCount++;
      }

      setProgress((p) => ({ ...p, success: successCount, failed: failedCount }));
    }

    setIsPushing(false);
    setCurrentTitle('');
  };

  return {
    isPushing,
    progress,
    currentTitle,
    pushSingleProduct,
    pushBatch,
  };
}
