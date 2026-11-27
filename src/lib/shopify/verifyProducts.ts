import { ExtractedProduct } from '@/types/product';
import { getShopifyConfig, executeGraphQL } from '@/lib/shopify/client';
import { getShopifyClientForWorkspace } from '@/lib/shopify/workspaceClient';
import { getSupabaseServerClient } from '@/lib/supabase/server';

const GET_ALL_SHOPIFY_PRODUCTS_QUERY = `
  query GetAllShopifyProducts($first: Int!) {
    products(first: $first) {
      nodes {
        id
        title
        handle
        status
        variants(first: 50) {
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
        variants(first: 50) {
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
    f === 'default title'
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
    return shopTitle === itemTitle || shopTitle.includes(itemTitle) || itemTitle.includes(shopTitle);
  }

  const combinedTitleFlavor = `${itemTitle} ${flavor}`.trim();

  if (shopTitle === combinedTitleFlavor || shopTitle.includes(combinedTitleFlavor)) {
    return true;
  }

  if (shopTitle === itemTitle || shopTitle.includes(itemTitle)) {
    const variants = shopifyNode.variants?.nodes || [];
    const hasVariant = variants.some((v: any) => {
      const vTitle = normalize(v.title || '');
      if (vTitle === flavor || vTitle.includes(flavor) || flavor.includes(vTitle)) {
        return true;
      }
      const opts = v.selectedOptions || [];
      return opts.some((o: any) => {
        const val = normalize(o.value || '');
        return val === flavor || val.includes(flavor) || flavor.includes(val);
      });
    });
    if (hasVariant) return true;
  }

  if (shopTitle.includes(itemTitle) && shopTitle.includes(flavor)) {
    return true;
  }

  return false;
}

async function getExecutor(workspaceId?: string | null) {
  let targetWsId = workspaceId;

  if (!targetWsId) {
    try {
      const supabase = getSupabaseServerClient();
      const { data: latestConnection } = await supabase
        .from('workspace_shopify_connections')
        .select('workspace_id')
        .eq('status', 'CONNECTED')
        .order('installed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestConnection?.workspace_id) {
        targetWsId = latestConnection.workspace_id;
      }
    } catch {
    }
  }

  if (targetWsId) {
    try {
      const wsClient = await getShopifyClientForWorkspace(targetWsId);
      return {
        shopDomain: wsClient.shopDomain,
        execute: wsClient.executeGraphQL,
      };
    } catch {
    }
  }

  try {
    const config = getShopifyConfig();
    return {
      shopDomain: config.shopDomain,
      execute: executeGraphQL,
    };
  } catch {
    return null;
  }
}

export async function verifyProductsWithShopify(
  products: ExtractedProduct[],
  workspaceId?: string | null
): Promise<ExtractedProduct[]> {
  if (!products || products.length === 0) {
    return [];
  }

  const runner = await getExecutor(workspaceId);

  let storeProducts: any[] = [];
  if (runner) {
    try {
      const storeRes = await runner.execute<any>(GET_ALL_SHOPIFY_PRODUCTS_QUERY, { first: 250 });
      storeProducts = storeRes?.data?.products?.nodes || storeRes?.products?.nodes || [];
    } catch (err) {
      console.error('Failed to pre-fetch Shopify store products:', err);
    }
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
          } catch (err) {
            console.error('Shopify search error for', cleanSearch, err);
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

  return results;
}
