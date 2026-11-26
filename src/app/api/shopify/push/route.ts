import { NextRequest, NextResponse } from 'next/server';
import { executeGraphQL, getPrimaryLocationId, PRODUCT_SET_MUTATION } from '@/lib/shopify/client';
import { buildProductSetPayload } from '@/lib/shopify/payloadBuilder';
import { ExtractedProduct } from '@/types/product';
import { PushResult } from '@/types/shopify';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const products: ExtractedProduct[] = Array.isArray(body.products)
      ? body.products
      : body.product
      ? [body.product]
      : [];

    if (products.length === 0) {
      return NextResponse.json({ error: 'No products provided to push' }, { status: 400 });
    }

    const locationId = await getPrimaryLocationId();
    const results: PushResult[] = [];
    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN || '';

    for (let i = 0; i < products.length; i++) {
      const item = products[i];
      const payload = buildProductSetPayload(item, locationId);

      try {
        const response: any = await executeGraphQL(PRODUCT_SET_MUTATION, {
          synchronous: true,
          input: payload,
        });

        if (response.errors && response.errors.length > 0) {
          results.push({
            productId: item.id,
            success: false,
            title: payload.title,
            errors: response.errors.map((e: any) => e.message || String(e)),
          });
        } else {
          const { product, userErrors } = response.data?.productSet || {};
          if (userErrors && userErrors.length > 0) {
            results.push({
              productId: item.id,
              success: false,
              title: payload.title,
              errors: userErrors.map((e: any) => e.message),
            });
          } else if (product?.id) {
            const productNumericId = product.id.split('/').pop();
            const shopifyUrl = shopDomain
              ? `https://${shopDomain}/admin/products/${productNumericId}`
              : undefined;

            results.push({
              productId: item.id,
              success: true,
              shopifyId: product.id,
              shopifyHandle: product.handle,
              shopifyUrl,
              title: product.title,
            });
          } else {
            results.push({
              productId: item.id,
              success: false,
              title: payload.title,
              errors: ['Unknown response structure from Shopify'],
            });
          }
        }
      } catch (err: any) {
        results.push({
          productId: item.id,
          success: false,
          title: payload.title,
          errors: [err.message || 'Fatal error during push'],
        });
      }

      // Small pacing delay between multiple items
      if (i < products.length - 1) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    return NextResponse.json({
      success: true,
      results,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    });
  } catch (err: any) {
    console.error('Error in Shopify push route:', err);
    return NextResponse.json({ error: err.message || 'Push failed' }, { status: 500 });
  }
}
