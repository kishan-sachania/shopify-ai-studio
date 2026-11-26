import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const {
  SHOPIFY_SHOP_DOMAIN,
  SHOPIFY_CLIENT_ID,
  SHOPIFY_CLIENT_SECRET,
  SHOPIFY_ACCESS_TOKEN,
  SHOPIFY_API_VERSION = '2026-10',
} = process.env;

if (!SHOPIFY_SHOP_DOMAIN) {
  console.error('❌ Missing SHOPIFY_SHOP_DOMAIN in .env');
  process.exit(1);
}

if (!SHOPIFY_ACCESS_TOKEN && (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET)) {
  console.error(
    '❌ Missing credentials in .env. Provide either SHOPIFY_ACCESS_TOKEN or both SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET.'
  );
  process.exit(1);
}

const ENDPOINT = `https://${SHOPIFY_SHOP_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

const GET_LOCATION_QUERY = `
  query getLocation {
    locations(first: 1) {
      nodes {
        id
      }
    }
  }
`;

const PRODUCT_SET_MUTATION = `
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
            inventoryItem {
              tracked
            }
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let cachedAccessToken = SHOPIFY_ACCESS_TOKEN || null;
let cachedLocationId = null;

async function getAccessToken() {
  if (cachedAccessToken) return cachedAccessToken;

  const tokenUrl = `https://${SHOPIFY_SHOP_DOMAIN}/admin/oauth/access_token`;
  console.log(`🔑 Requesting access token via client credentials grant from ${tokenUrl}...`);

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OAuth request failed [HTTP ${response.status} ${response.statusText}]: ${errorText}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error(`OAuth response missing access_token: ${JSON.stringify(data)}`);
  }

  cachedAccessToken = data.access_token;
  console.log(`✅ Access token retrieved successfully (scopes: "${data.scope || 'N/A'}", expires in: ${data.expires_in || 'N/A'}s)\n`);
  return cachedAccessToken;
}

async function executeGraphQL(query, variables = {}, retries = 5) {
  const token = await getAccessToken();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({ query, variables }),
      });

      // Handle HTTP 429 Too Many Requests
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retrySeconds = retryAfterHeader ? Number(retryAfterHeader) : Math.pow(2, attempt) * 2;
        const jitter = Math.floor(Math.random() * 1000);
        const waitMs = retrySeconds * 1000 + jitter;

        console.warn(`   ⚠️ HTTP 429 Rate Limited. Pausing ${(waitMs / 1000).toFixed(1)}s before retry ${attempt}/${retries}...`);
        await sleep(waitMs);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Dynamic leaky-bucket throttling based on Shopify cost extensions
      const throttle = result.extensions?.cost?.throttleStatus;
      if (throttle) {
        const { currentlyAvailable, maximumAvailable, restoreRate } = throttle;
        if (currentlyAvailable < 350) {
          const needed = 700 - currentlyAvailable;
          const waitMs = Math.ceil((needed / restoreRate) * 1000);
          console.log(`   ⏳ Low query points (${currentlyAvailable.toFixed(0)}/${maximumAvailable}). Pausing ${waitMs}ms to replenish...`);
          await sleep(waitMs);
        }
      }

      return result;
    } catch (error) {
      if (attempt === retries) throw error;
      const backoff = attempt * 2000 + Math.floor(Math.random() * 500);
      console.warn(`   ⚠️ Attempt ${attempt} failed (${error.message}). Retrying in ${(backoff / 1000).toFixed(1)}s...`);
      await sleep(backoff);
    }
  }
}

async function getPrimaryLocationId() {
  if (cachedLocationId) return cachedLocationId;
  const result = await executeGraphQL(GET_LOCATION_QUERY);
  const locationNode = result?.data?.locations?.nodes?.[0];
  if (locationNode?.id) {
    cachedLocationId = locationNode.id;
    console.log(`📍 Primary fulfillment location: ${cachedLocationId}`);
  }
  return cachedLocationId;
}

function buildIndividualProductPayload(item, locationId) {
  const flavor = (item.variant_or_flavor || '').trim();
  const isGeneric =
    !flavor ||
    flavor === 'No color option (single product)' ||
    flavor === 'All existing flavors (list not provided)' ||
    flavor === 'ALL flavors';

  const title = isGeneric ? item.title : `${item.title} – ${flavor}`;
  const price = typeof item.price === 'number' && item.price > 0 ? item.price : 36.99;
  const stockQty = typeof item.inventoryQuantity === 'number' ? item.inventoryQuantity : 2;

  // Extract media specific to this item
  let mediaList = [];
  if (Array.isArray(item.images) && item.images.length > 0) {
    mediaList = item.images;
  } else if (typeof item.image_url === 'string' && item.image_url.trim()) {
    mediaList = item.image_url.split(/[\r\n]+/).map((u) => u.trim());
  }

  const files = mediaList
    .filter((u) => typeof u === 'string' && u.startsWith('http'))
    .map((url) => ({ originalSource: url }));

  return {
    title,
    descriptionHtml: item.descriptionHtml || `<p>${title}</p>`,
    vendor: item.vendor || '',
    productType: item.productType || '',
    tags: Array.isArray(item.tags) ? item.tags : [],
    status: 'ACTIVE',
    productOptions: [
      {
        name: 'Title',
        values: [{ name: 'Default Title' }],
      },
    ],
    variants: [
      {
        price,
        optionValues: [{ optionName: 'Title', name: 'Default Title' }],
        inventoryItem: {
          tracked: true,
        },
        inventoryPolicy: 'DENY',
        ...(locationId
          ? {
              inventoryQuantities: [
                {
                  locationId,
                  name: 'available',
                  quantity: stockQty,
                },
              ],
            }
          : {}),
      },
    ],
    files,
  };
}

async function runAutomation() {
  const defaultPath = fs.existsSync(path.resolve('data/products_extracted.json'))
    ? path.resolve('data/products_extracted.json')
    : path.resolve('data/products.json');

  const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultPath;
  const errorLogPath = path.resolve('logs/errors.json');

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input file not found at ${inputPath}`);
    process.exit(1);
  }

  // Pre-authenticate and resolve primary location
  await getAccessToken();
  const locationId = await getPrimaryLocationId();

  console.log(`📂 Loading data from: ${inputPath}`);
  const rawItems = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  console.log(`📊 Loaded ${rawItems.length} individual items to create as standalone products.\n`);

  const failedItems = [];
  let successCount = 0;

  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i];
    const progress = `[${i + 1}/${rawItems.length}]`;
    const payload = buildIndividualProductPayload(item, locationId);

    console.log(`${progress} Creating "${payload.title}" ($${payload.variants[0].price}, Stock: ${payload.variants[0].inventoryQuantities?.[0]?.quantity ?? 2}, Images: ${payload.files.length})...`);

    try {
      const variables = {
        synchronous: true,
        input: payload,
      };

      const result = await executeGraphQL(PRODUCT_SET_MUTATION, variables);

      if (result.errors) {
        console.error(`${progress} ❌ GraphQL Error for "${payload.title}":`, JSON.stringify(result.errors, null, 2));
        failedItems.push({ title: payload.title, errors: result.errors });
      } else {
        const { product, userErrors } = result.data.productSet;
        if (userErrors && userErrors.length > 0) {
          console.error(`${progress} ❌ Validation Error for "${payload.title}":`, userErrors);
          failedItems.push({ title: payload.title, errors: userErrors });
        } else {
          successCount++;
          console.log(`${progress} ✅ Created: ${product.title} (${product.id})`);
        }
      }
    } catch (err) {
      console.error(`${progress} ❌ Fatal Error for "${payload.title}": ${err.message}`);
      failedItems.push({ title: payload.title, errors: [{ message: err.message }] });
    }

    // Pacing delay between requests to keep the rate limiter completely clear
    if (i < rawItems.length - 1) {
      await sleep(800);
    }
  }

  console.log('\n==============================');
  console.log('       Import Summary         ');
  console.log('==============================');
  console.log(`✅ Succeeded: ${successCount} products`);
  console.log(`❌ Failed:    ${failedItems.length} products`);

  if (failedItems.length > 0) {
    const logDir = path.dirname(errorLogPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.writeFileSync(errorLogPath, JSON.stringify(failedItems, null, 2));
    console.log(`📄 Failed items saved to ${errorLogPath}`);
  } else {
    if (fs.existsSync(errorLogPath)) {
      fs.unlinkSync(errorLogPath);
    }
  }
}

runAutomation();
