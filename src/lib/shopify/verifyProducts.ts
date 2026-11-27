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
        vendor
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
        vendor
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
    .replace(/\bfb\s+beast\b/g, 'flavour beast')
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

function tokenize(str: string): string[] {
  return str
    .split(' ')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== 'x');
}

function getModelTokens(tokens: string[]): string[] {
  return tokens.filter((t) => /\d/.test(t) && !/^\d+(mg|ml)$/.test(t));
}

function matchesVendor(itemVendor?: string, shopVendor?: string): boolean {
  const normItem = normalize(itemVendor || '');
  const normShop = normalize(shopVendor || '');
  if (!normItem || !normShop) {
    return true;
  }

  const itemTokens = tokenize(normItem);
  const shopTokens = new Set(tokenize(normShop));

  return itemTokens.some((t) => shopTokens.has(t)) || Array.from(shopTokens).some((t) => itemTokens.includes(t));
}

function matchesShopifyProduct(item: ExtractedProduct, shopifyNode: any): boolean {
  if (!matchesVendor(item.vendor, shopifyNode.vendor)) {
    return false;
  }

  const itemTitle = normalize(item.title);
  const flavor = normalize(item.variant_or_flavor || '');
  const shopTitle = normalize(shopifyNode.title || '');

  if (!itemTitle || !shopTitle) {
    return false;
  }

  const itemTokens = tokenize(itemTitle);
  const shopTokens = new Set(tokenize(shopTitle));

  const hasAllTitleTokens =
    itemTokens.length > 0 &&
    itemTokens.every((token) => shopTokens.has(token));

  if (!hasAllTitleTokens) {
    return false;
  }

  const itemModels = getModelTokens(itemTokens);
  const shopModels = getModelTokens(Array.from(shopTokens));

  for (const m of itemModels) {
    if (!shopTokens.has(m)) return false;
  }
  for (const m of shopModels) {
    if (!itemTokens.includes(m)) return false;
  }

  if (isGenericFlavor(flavor)) {
    return true;
  }

  const flavorTokens = tokenize(flavor);
  if (flavorTokens.length === 0) {
    return true;
  }

  const titleHasFlavor = flavorTokens.every((fToken) => shopTokens.has(fToken));
  if (titleHasFlavor) {
    return true;
  }

  const variants = shopifyNode.variants?.nodes || [];
  return variants.some((v: any) => {
    const vTitle = normalize(v.title || '');
    const vTokens = new Set(tokenize(vTitle));
    if (flavorTokens.every((fToken) => vTokens.has(fToken))) {
      return true;
    }
    const opts = v.selectedOptions || [];
    return opts.some((o: any) => {
      const val = normalize(o.value || '');
      const valTokens = new Set(tokenize(val));
      return flavorTokens.every((fToken) => valTokens.has(fToken));
    });
  });
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
      return {
        ...item,
        status: 'READY',
        shopifyId: undefined,
        shopifyHandle: undefined,
        shopify_product_url: undefined,
        lastPushedAt: undefined,
      };
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
      lastPushedAt: item.lastPushedAt || new Date().toISOString(),
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
