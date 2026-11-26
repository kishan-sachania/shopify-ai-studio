# Shopify Multi-Tenant Product Automation Studio

A full-stack automation platform built with Next.js, Supabase, and Shopify's GraphQL Admin API. Enables multiple merchant stores to connect via OAuth, manage isolated product catalogs, push products directly to their Shopify stores, and keep inventory in sync via webhooks.

---

## Features

- **Multi-Tenant Shopify OAuth Handshake**: Merchants connect their stores using only their `brand.myshopify.com` domain. No merchant API keys or secrets required.
- **Per-Workspace Token Isolation & Encryption**: Store access tokens are encrypted with AES-256-GCM before being stored in Supabase. Each workspace executes API calls strictly with its own scoped token.
- **Store Switcher & Multi-Store Management**: Header dropdown to switch between multiple connected Shopify stores, view connection status, and disconnect stores on demand.
- **Direct Catalog Sync & Mutations**: Push extracted and edited products, variants, prices, inventory, and custom metafields directly into the active store using Shopify's modern `productSet` GraphQL mutation.
- **Bidirectional Webhook Synchronization**: Real-time listeners for `products/create`, `products/update`, `products/delete`, and `app/uninstalled` with HMAC-SHA256 signature verification.
- **Excel Extraction Pipeline**: Parse product task sheets, extract variant and flavor matrices, and normalize structured catalog data.

---

## Architecture Flow

```
[Merchant Browser] 
       │
       ▼ (Enters store domain)
[Next.js Studio: /api/shopify/oauth/authorize] 
       │
       ▼ (Redirects with central Client ID & Scopes)
[Shopify OAuth Consent Screen] 
       │
       ▼ (Merchant clicks "Install")
[Next.js Studio: /api/shopify/oauth/callback] 
       │
       ├──> Verifies HMAC & state nonce
       ├──> Exchanges authorization code for store access token
       ├──> Encrypts token with AES-256-GCM
       └──> Stores connection in Supabase linked to workspace
       │
       ▼
[Scoped Operations via /src/lib/shopify/workspaceClient.ts]
       ├──> Fetch products: products(first: 50)
       ├──> Push products: productSet(...)
       └──> Sync webhooks: /api/shopify/webhooks
```

---

## Prerequisites

- Node.js 18+
- A [Shopify Partner Account](https://partners.shopify.com/) or Shopify App created in Developer Console
- A [Supabase](https://supabase.com/) project

---

## Environment Configuration

Create a `.env` file in the project root:

```env
# Shopify App Credentials (From Shopify Developer Console)
SHOPIFY_CLIENT_ID=your_shopify_client_id
SHOPIFY_CLIENT_SECRET=shpss_your_shopify_client_secret
SHOPIFY_API_VERSION=2026-10

# Application Base URL (Must match Shopify App URL)
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase Credentials
SUPABASE_PROJECT_URL=https://<your-project-id>.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_publishable_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AES-256-GCM Token Encryption Secret (32-character string or random passphrase)
ENCRYPTION_SECRET=your_32_char_random_encryption_secret

# AI Processing Key (Optional, for AI-assisted extraction)
GROQ_API_KEY=gsk_your_groq_api_key
```

---

## Supabase Database Setup

Run the following migration in your **Supabase Dashboard > SQL Editor**:

```sql
-- 1. Workspaces
CREATE TABLE IF NOT EXISTS public.workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'Default Workspace',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default workspace
INSERT INTO public.workspaces (id, name)
VALUES ('default-workspace', 'Default Workspace')
ON CONFLICT (id) DO NOTHING;

-- 2. Shopify Connections (Isolated Per-Workspace)
CREATE TABLE IF NOT EXISTS public.workspace_shopify_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE,
    shop_domain TEXT NOT NULL,
    encrypted_access_token TEXT NOT NULL,
    token_iv TEXT NOT NULL,
    token_auth_tag TEXT NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'CONNECTED',
    installed_at TIMESTAMPTZ DEFAULT NOW(),
    uninstalled_at TIMESTAMPTZ
);

-- 3. Synced Products
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    shopify_product_id TEXT NOT NULL,
    title TEXT NOT NULL,
    handle TEXT,
    data JSONB NOT NULL DEFAULT '{}',
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_workspace_shopify_product UNIQUE (workspace_id, shopify_product_id)
);

-- Security Policies (RLS)
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_shopify_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role all on workspaces" ON public.workspaces
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role all on connections" ON public.workspace_shopify_connections
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role all on products" ON public.products
    FOR ALL TO service_role USING (true) WITH CHECK (true);
```

---

## Shopify Developer Console Setup

In your Shopify App Dashboard:

1. Go to **Versions** > Click your active version (or **Create version**).
2. Configure URLs:
   - **App URL / Application URL**: `http://localhost:3000` (or your live domain / tunnel)
   - **Allowed redirection URL(s)**: `http://localhost:3000/api/shopify/oauth/callback`
3. Request Access Scopes:
   - `read_products`, `write_products`, `read_inventory`, `write_inventory`
4. Release the version to make it **Active**.

---

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── shopify/
│   │   │   │   ├── oauth/
│   │   │   │   │   ├── authorize/route.ts   # Generates Shopify OAuth redirect
│   │   │   │   │   └── callback/route.ts    # Validates HMAC, exchanges code, encrypts token
│   │   │   │   ├── connections/route.ts     # List and delete workspace connections
│   │   │   │   ├── sync/route.ts            # Pulls products via GraphQL into Supabase
│   │   │   │   └── webhooks/route.ts        # Verifies HMAC and handles Shopify webhook events
│   │   ├── extract/                         # Excel upload and data extraction view
│   │   ├── products/                        # Product catalog table and editor drawer
│   │   └── layout.tsx
│   ├── components/
│   │   ├── common/
│   │   │   └── Header.tsx                   # Multi-store switcher and connection controls
│   │   ├── products/                        # Product table, filters, and modal components
│   │   └── settings/
│   │       └── ConnectShopifyModal.tsx      # Modal to connect new Shopify store domains
│   ├── lib/
│   │   ├── security/
│   │   │   └── crypto.ts                    # AES-256-GCM token encryption & decryption
│   │   ├── shopify/
│   │   │   ├── client.ts                    # Base GraphQL executor
│   │   │   └── workspaceClient.ts           # Workspace-scoped decrypted GraphQL client
│   │   └── supabase/
│   │       ├── client.ts                    # Supabase browser client
│   │       └── server.ts                    # Supabase server client (service role)
│   └── types/
│       ├── product.ts
│       └── shopify.ts
├── scripts/
│   └── main.py                              # FastAPI backend for AI processing
└── package.json
```

---

## Running the Project

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Next.js Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. (Optional) Run AI Extraction API
```bash
npm run ai-api
```
Runs the FastAPI background service on `http://localhost:8000`.

---

## Usage Guide

1. **Connect a Store**:
   - In the header, click **Connect Shopify**.
   - Enter your store domain (e.g. `brand-name.myshopify.com`).
   - Click **Connect Store** to be redirected to Shopify's consent screen.
   - Click **Install** in Shopify. You will be redirected back to the studio with the store connected.

2. **Switch Between Multiple Stores**:
   - Click the store badge in the top right header.
   - Select another connected store from the dropdown. All catalog actions now target that store.

3. **Disconnect a Store**:
   - Open the store dropdown from the header.
   - Click the unlink icon next to any store to remove its connection and wipe its credentials.
