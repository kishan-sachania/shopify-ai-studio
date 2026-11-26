# Shopify Product Automation via JSON Input (Node.js)

A stable, production-ready Node.js setup to automate product creation in Shopify using the modern **GraphQL Admin API (`productSet` mutation)**. This setup includes environment variable management, automatic rate-limit handling, retry logic with exponential backoff, and detailed error logging.

---

## 1. Project Initialization & Setup

Create a new directory and initialize the Node.js project:

```bash
mkdir shopify-product-importer
cd shopify-product-importer
npm init -y
```

### Configure `package.json`
Update your `package.json` to enable ES Modules (`"type": "module"`) and add a start script:

```json
{
  "name": "shopify-product-importer",
  "version": "1.0.0",
  "description": "Automate Shopify product creation from JSON using GraphQL Admin API",
  "type": "module",
  "main": "src/import.js",
  "scripts": {
    "start": "node src/import.js"
  },
  "dependencies": {
    "dotenv": "^16.4.5"
  }
}
```

Install the dependency:

```bash
npm install
```

### Recommended Folder Structure

```text
shopify-product-importer/
├── data/
│   └── products.json       # Source product JSON data
├── logs/
│   └── errors.json         # Automatically generated error logs
├── src/
│   └── import.js           # Main automation script
├── .env                    # API credentials (do not commit to Git)
├── .gitignore
└── package.json
```

Create the directories and files:

```bash
mkdir -p data logs src
touch data/products.json src/import.js .env .gitignore
```

Add `.env` and `logs/` to your `.gitignore`:

```text
node_modules/
.env
logs/*.json
```

---

## 2. Shopify Admin App & Environment Variables

### Custom Apps via Developer Dashboard (Client Credentials Grant)
1. In your **Shopify Partner / Dev Dashboard**, select or create your custom app.
2. Under **API access**, configure required scopes:
   - `write_products`
   - `write_inventory`
3. Retrieve your **Client ID** and **Client Secret**.
4. The application automatically requests a temporary access token (`POST https://${SHOPIFY_SHOP_DOMAIN}/admin/oauth/access_token` with `grant_type=client_credentials`) before calling GraphQL mutations.

### Configure `.env`
Add your store details and credentials to the `.env` file:

```env
SHOPIFY_SHOP_DOMAIN=your-store-name.myshopify.com
SHOPIFY_CLIENT_ID=your_client_id_here
SHOPIFY_CLIENT_SECRET=shpss_your_client_secret_here
SHOPIFY_API_VERSION=2026-10

# Alternatively, if using a static Admin API token:
# SHOPIFY_ACCESS_TOKEN=shpat_your_admin_api_token_here
```

---

## 3. Sample Input File (`data/products.json`)

Populate `data/products.json` with your product catalog. Ensure image URLs are publicly accessible so Shopify can download them asynchronously.

```json
[
  {
    "title": "Minimalist Cotton T-Shirt",
    "descriptionHtml": "<p>100% organic combed cotton t-shirt.</p>",
    "vendor": "Acme Apparel",
    "productType": "T-Shirts",
    "tags": ["summer", "cotton", "basics"],
    "status": "ACTIVE",
    "options": ["Color", "Size"],
    "variants": [
      {
        "optionValues": [
          { "optionName": "Color", "name": "Black" },
          { "optionName": "Size", "name": "M" }
        ],
        "price": 25.00,
        "sku": "TSHIRT-BLK-M"
      },
      {
        "optionValues": [
          { "optionName": "Color", "name": "White" },
          { "optionName": "Size", "name": "L" }
        ],
        "price": 25.00,
        "sku": "TSHIRT-WHT-L"
      }
    ],
    "media": [
      {
        "originalSource": "https://example.com/images/black-tshirt.jpg",
        "mediaContentType": "IMAGE"
      }
    ]
  }
]
```

---

## 4. Production Automation Script (`src/import.js`)

This script uses `productSet` with `synchronous: true`, checks Shopify's GraphQL `throttleStatus` dynamically to avoid hitting API rate limits, retries transient network/throttling errors, and logs failed items to `logs/errors.json`.

```javascript
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const {
  SHOPIFY_SHOP_DOMAIN,
  SHOPIFY_CLIENT_ID,
  SHOPIFY_CLIENT_SECRET,
  SHOPIFY_ACCESS_TOKEN,
  SHOPIFY_API_VERSION = '2026-01',
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

const PRODUCT_SET_MUTATION = `
  mutation createProduct($input: ProductSetInput!, $synchronous: Boolean!) {
    productSet(input: $input, synchronous: $synchronous) {
      product {
        id
        title
        handle
        variants(first: 10) {
          nodes {
            id
            sku
            price
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

/**
 * Requests or returns the active Shopify Admin API access token.
 * Supports the Client Credentials Grant (Dev Dashboard apps) as well as direct static tokens.
 */
async function getAccessToken() {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }

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

/**
 * Formats raw JSON product data into Shopify's ProductSetInput schema
 */
function buildProductVariables(productData) {
  const productOptions = (productData.options || []).map((optionName) => {
    const uniqueValues = [
      ...new Set(
        (productData.variants || []).flatMap((v) =>
          (v.optionValues || [])
            .filter((ov) => ov.optionName === optionName)
            .map((ov) => ov.name)
        )
      ),
    ];

    return {
      name: optionName,
      values: uniqueValues.map((val) => ({ name: val })),
    };
  });

  return {
    synchronous: true,
    input: {
      title: productData.title,
      descriptionHtml: productData.descriptionHtml || '',
      vendor: productData.vendor || '',
      productType: productData.productType || '',
      tags: productData.tags || [],
      status: productData.status || 'DRAFT',
      productOptions,
      variants: (productData.variants || []).map((v) => ({
        optionValues: v.optionValues,
        price: v.price,
        sku: v.sku,
      })),
      files: (productData.media || productData.files || []).map((f) => ({
        originalSource: f.originalSource,
        ...(f.alt ? { alt: f.alt } : {}),
      })),
    },
  };
}

/**
 * Executes GraphQL request with retry logic and dynamic rate-limit throttling
 */
async function executeGraphQL(query, variables, retries = 3) {
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

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('Retry-After')) || 2;
        console.warn(`⚠️ HTTP 429 Rate Limited. Retrying in ${retryAfter}s...`);
        await sleep(retryAfter * 1000);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Dynamic leaky-bucket throttling based on Shopify cost extensions
      const throttle = result.extensions?.cost?.throttleStatus;
      if (throttle && throttle.currentlyAvailable < 150) {
        const waitMs = Math.ceil(
          ((200 - throttle.currentlyAvailable) / throttle.restoreRate) * 1000
        );
        console.log(`⏳ Low query points (${throttle.currentlyAvailable}). Pausing ${waitMs}ms...`);
        await sleep(waitMs);
      }

      return result;
    } catch (error) {
      if (attempt === retries) throw error;
      const backoff = attempt * 1500;
      console.warn(`⚠️ Attempt ${attempt} failed (${error.message}). Retrying in ${backoff}ms...`);
      await sleep(backoff);
    }
  }
}

async function runAutomation() {
  const inputPath = path.resolve('data/products.json');
  const errorLogPath = path.resolve('logs/errors.json');

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input file not found at ${inputPath}`);
    process.exit(1);
  }

  // Ensure token is retrieved and validated up front
  await getAccessToken();

  const products = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  const failedItems = [];
  let successCount = 0;

  console.log(`🚀 Starting import of ${products.length} products...\n`);

  for (let i = 0; i < products.length; i++) {
    const productData = products[i];
    const progress = `[${i + 1}/${products.length}]`;

    try {
      const variables = buildProductVariables(productData);
      const result = await executeGraphQL(PRODUCT_SET_MUTATION, variables);

      if (result.errors) {
        console.error(`${progress} ❌ GraphQL Error for "${productData.title}":`, result.errors);
        failedItems.push({ product: productData, errors: result.errors });
        continue;
      }

      const { product, userErrors } = result.data.productSet;

      if (userErrors && userErrors.length > 0) {
        console.error(`${progress} ❌ Validation Error for "${productData.title}":`, userErrors);
        failedItems.push({ product: productData, errors: userErrors });
      } else {
        successCount++;
        console.log(`${progress} ✅ Created: ${product.title} (${product.id})`);
      }
    } catch (err) {
      console.error(`${progress} ❌ Fatal Error for "${productData.title}": ${err.message}`);
      failedItems.push({ product: productData, errors: [{ message: err.message }] });
    }
  }

  console.log('\n--- Import Summary ---');
  console.log(`✅ Succeeded: ${successCount}`);
  console.log(`❌ Failed:    ${failedItems.length}`);

  if (failedItems.length > 0) {
    const logDir = path.dirname(errorLogPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.writeFileSync(errorLogPath, JSON.stringify(failedItems, null, 2));
    console.log(`📄 Failed items saved to ${errorLogPath}`);
  }
}

runAutomation();
```

---

## 5. Running the Project

Execute the importer from your project root:

```bash
npm start
```

### Best Practices for Scaling
* **Upserting Existing Products:** If you pass an existing Shopify Product `id` (`gid://shopify/Product/123456789`) inside `input`, `productSet` will update the existing product rather than creating a duplicate.
* **Inventory Quantities:** To set initial stock levels, query your store's `locations(first: 5)` via GraphQL to retrieve your `locationId`, and pass `inventoryQuantities: [{ locationId: "gid://shopify/Location/...", name: "available", quantity: 50 }]` inside each variant object.
* **Catalogs Over 1,000 Items:** Convert `products.json` into a `.jsonl` (JSON Lines) file and use Shopify's `stagedUploadsCreate` + `bulkOperationRunMutation` workflow for asynchronous background processing.