import { ExtractedProduct } from '@/types/product';
import { getShopifyConfig, executeGraphQL } from '@/lib/shopify/client';
import { getShopifyClientForWorkspace } from '@/lib/shopify/workspaceClient';

const GET_ALL_SHOPIFY_PRODUCTS_QUERY = `
  query GetAllShopifyProducts($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: UPDATED_AT, reverse: true) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        handle
        status
        variants(first: 100) {
          nodes {
            id
            title
            selectedOptions {
              name
              value
            }
          }
        }
      }
    }
  }
`;

const SEARCH_SHOPIFY_PRODUCT_QUERY = `
  query SearchShopifyProduct($query: String!) {
    products(first: 15, query: $query) {
      nodes {
        id
        title
        handle
        status
        variants(first: 100) {
          nodes {
            id
            title
            selectedOptions {
              name
              value
            }
          }
        }
      }
    }
  }
`;

function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/\bfb\b/g, 'flavour beast')
    .replace(/drip\s*'?\s*n/g, 'dripn')
    .replace(/geek\s*bar/g, 'geekbar')
    .replace(/level\s*x/g, 'levelx')
    .replace(/[\u2010-\u2015\u2212\-_/()&+,.]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isGenericFlavor(flavor: string): boolean {
  const f = normalize(flavor);
  return (
    !f ||
    f === 'no color option single product' ||
    f === 'all existing flavors list not provided' ||
    f === 'all flavors' ||
    f === 'default title' ||
    f === 'standard product'
  );
}

function matchesShopifyProduct(item: ExtractedProduct, shopifyNode: any): boolean {
  const itemTitle = normalize(item.title);
  const flavor = normalize(item.variant_or_flavor || '');
  const shopTitle = normalize(shopifyNode.title || '');

  if (!itemTitle || !shopTitle) {
    return false;
  }

  if (isGenericFlavor(flavor)) {
    if (shopTitle === itemTitle || shopTitle.includes(itemTitle) || itemTitle.includes(shopTitle)) {
      return true;
    }
  }

  const combined = `${itemTitle} ${flavor}`.trim();
  if (shopTitle === combined || shopTitle.includes(combined)) {
    return true;
  }

  const titleWords = Array.from(new Set(itemTitle.split(' ').filter((w) => w.length > 2)));
  const titleMatches = titleWords.length > 0 && titleWords.every((w) => shopTitle.includes(w));

  if (titleMatches) {
    if (isGenericFlavor(flavor)) {
      return true;
    }

    const flavorWords = Array.from(new Set(flavor.split(' ').filter((w) => w.length > 2)));
    if (flavorWords.length > 0 && flavorWords.every((w) => shopTitle.includes(w))) {
      return true;
    }

    const variants = shopifyNode.variants?.nodes || [];
    const variantMatches = variants.some((v: any) => {
      const vTitle = normalize(v.title || '');
      if (flavorWords.length > 0 && flavorWords.every((w) => vTitle.includes(w))) {
        return true;
      }
      const opts = v.selectedOptions || [];
      return opts.some((o: any) => {
        const val = normalize(o.value || '');
        return flavorWords.length > 0 && flavorWords.every((w) => val.includes(w));
      });
    });

    if (variantMatches) {
      return true;
    }
  }

  return false;
}

async function getExecutor(workspaceId?: string | null) {
  try {
    const wsClient = await getShopifyClientForWorkspace(workspaceId || '');
    return {
      shopDomain: wsClient.shopDomain,
      execute: wsClient.executeGraphQL,
      source: `workspace_oauth (${wsClient.shopDomain})`,
    };
  } catch {
  }

  try {
    const config = getShopifyConfig();
    return {
      shopDomain: config.shopDomain,
      execute: executeGraphQL,
      source: `.env fallback (${config.shopDomain})`,
    };
  } catch {
    return null;
  }
}

export async function verifyProductsWithShopify(
  products: ExtractedProduct[],
  workspaceId?: string | null
): Promise<{ verified: ExtractedProduct[]; shopifyStoreProducts: any[]; targetStore?: string; connectionSource?: string }> {
  const runner = await getExecutor(workspaceId);

  let storeProducts: any[] = [];
  if (runner) {
    try {
      let cursor: string | null = null;
      let hasNextPage = true;
      let pageCount = 0;

      while (hasNextPage && pageCount < 8) {
        pageCount++;
        const storeRes: any = await runner.execute(GET_ALL_SHOPIFY_PRODUCTS_QUERY, {
          first: 250,
          after: cursor,
        });

        const productData = storeRes?.data?.products || storeRes?.products;
        const nodes = productData?.nodes || [];
        storeProducts.push(...nodes);

        hasNextPage = Boolean(productData?.pageInfo?.hasNextPage);
        cursor = productData?.pageInfo?.endCursor || null;

        if (!cursor || nodes.length === 0) break;
      }
    } catch (err: any) {
      console.error('Failed to retrieve Shopify store products:', err.message || err);
    }
  }

  if (!products || products.length === 0) {
    return {
      verified: [],
      shopifyStoreProducts: storeProducts,
      targetStore: runner?.shopDomain,
      connectionSource: runner?.source,
    };
  }

  const queryCache = new Map<string, any[]>();

  const verifyItem = async (item: ExtractedProduct): Promise<ExtractedProduct> => {
    if (item.shopify_product_url || (item.live_url && item.live_url.includes('myshopify.com'))) {
      const url = item.shopify_product_url || item.live_url;
      return {
        ...item,
        status: 'PUSHED',
        shopify_product_url: url,
        lastPushedAt: item.sheet_updated_at || new Date().toISOString(),
      };
    }

    if (!runner || !item.title) {
      return item;
    }

    let matched = storeProducts.find((node: any) => matchesShopifyProduct(item, node));

    if (!matched) {
      const cleanSearch = normalize(item.title);
      if (cleanSearch) {
        let nodes: any[] = [];
        if (queryCache.has(cleanSearch)) {
          nodes = queryCache.get(cleanSearch) || [];
        } else {
          try {
            const res = await runner.execute<any>(SEARCH_SHOPIFY_PRODUCT_QUERY, {
              query: cleanSearch,
            });
            nodes = res?.data?.products?.nodes || res?.products?.nodes || [];
            queryCache.set(cleanSearch, nodes);
          } catch {
            nodes = [];
          }
        }
        matched = nodes.find((node: any) => matchesShopifyProduct(item, node));
      }
    }

    if (!matched) {
      return item;
    }

    const numericId = matched.id.replace('gid://shopify/Product/', '');
    const productUrl = runner.shopDomain
      ? `https://${runner.shopDomain}/admin/products/${numericId}`
      : item.shopify_product_url;

    return {
      ...item,
      status: 'PUSHED',
      shopifyId: matched.id,
      shopifyHandle: matched.handle,
      lastPushedAt: new Date().toISOString(),
      shopify_product_url: productUrl,
    };
  };

  const results: ExtractedProduct[] = [];
  const chunkSize = 10;

  for (let i = 0; i < products.length; i += chunkSize) {
    const chunk = products.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(chunk.map((prod) => verifyItem(prod)));
    results.push(...chunkResults);
  }

  return {
    verified: results,
    shopifyStoreProducts: storeProducts,
    targetStore: runner?.shopDomain,
    connectionSource: runner?.source,
  };
}
