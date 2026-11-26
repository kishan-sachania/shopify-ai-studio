import { ShopifyProductSetResponse } from '@/types/shopify';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let cachedAccessToken: string | null = process.env.SHOPIFY_ACCESS_TOKEN || null;
let cachedLocationId: string | null = null;

export function getShopifyConfig() {
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN || '';
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-10';
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

  if (!shopDomain) {
    throw new Error('Missing SHOPIFY_SHOP_DOMAIN in environment variables.');
  }

  return {
    shopDomain,
    apiVersion,
    clientId,
    clientSecret,
    accessToken,
    endpoint: `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`,
  };
}

export async function getAccessToken(): Promise<string> {
  if (cachedAccessToken) return cachedAccessToken;

  const { shopDomain, clientId, clientSecret, accessToken } = getShopifyConfig();

  if (accessToken) {
    cachedAccessToken = accessToken;
    return cachedAccessToken;
  }

  if (!clientId || !clientSecret) {
    throw new Error('Missing credentials. Provide either SHOPIFY_ACCESS_TOKEN or SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET.');
  }

  const tokenUrl = `https://${shopDomain}/admin/oauth/access_token`;
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OAuth request failed [HTTP ${response.status}]: ${errorText}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error(`OAuth response missing access_token: ${JSON.stringify(data)}`);
  }

  cachedAccessToken = data.access_token;
  return data.access_token as string;
}

export async function executeGraphQL<T = ShopifyProductSetResponse>(
  query: string,
  variables: Record<string, any> = {},
  retries = 5
): Promise<T> {
  const { endpoint } = getShopifyConfig();
  const token = await getAccessToken();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({ query, variables }),
      });

      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retrySeconds = retryAfterHeader ? Number(retryAfterHeader) : Math.pow(2, attempt) * 2;
        const waitMs = retrySeconds * 1000 + Math.floor(Math.random() * 500);
        console.warn(`[Shopify API] 429 Rate Limited. Pausing ${waitMs}ms before retry ${attempt}/${retries}`);
        await sleep(waitMs);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Leaky-bucket throttling check
      const throttle = result.extensions?.cost?.throttleStatus;
      if (throttle) {
        const { currentlyAvailable, restoreRate } = throttle;
        if (currentlyAvailable < 350) {
          const needed = 700 - currentlyAvailable;
          const waitMs = Math.ceil((needed / restoreRate) * 1000);
          console.log(`[Shopify API] Throttle status: pausing ${waitMs}ms to replenish points`);
          await sleep(waitMs);
        }
      }

      return result as T;
    } catch (err: any) {
      if (attempt === retries) throw err;
      const backoff = attempt * 2000 + Math.floor(Math.random() * 500);
      await sleep(backoff);
    }
  }

  throw new Error('Maximum retries exceeded');
}

export const GET_LOCATION_QUERY = `
  query getLocation {
    locations(first: 1) {
      nodes {
        id
        name
      }
    }
  }
`;

export const PRODUCT_SET_MUTATION = `
  mutation createProduct($input: ProductSetInput!, $synchronous: Boolean!) {
    productSet(input: $input, synchronous: $synchronous) {
      product {
        id
        title
        handle
        variants(first: 1) {
          nodes {
            id
            price
            inventoryQuantity
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export async function getPrimaryLocationId(): Promise<string | null> {
  if (cachedLocationId) return cachedLocationId;
  try {
    const result = await executeGraphQL<any>(GET_LOCATION_QUERY);
    const locationNode = result?.data?.locations?.nodes?.[0];
    if (locationNode?.id) {
      cachedLocationId = locationNode.id;
    }
  } catch (err) {
    console.warn('[Shopify API] Unable to retrieve primary location:', err);
  }
  return cachedLocationId;
}
