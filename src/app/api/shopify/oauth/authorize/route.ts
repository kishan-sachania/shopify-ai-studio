import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get('shop');
    const workspaceId = searchParams.get('workspaceId');

    if (!shop || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing required parameters: shop and workspaceId' },
        { status: 400 }
      );
    }

    const cleanedShop = shop
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');

    const shopDomain = cleanedShop.includes('.') ? cleanedShop : `${cleanedShop}.myshopify.com`;

    if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shopDomain)) {
      return NextResponse.json(
        { error: 'Invalid Shopify domain format. Must be your-shop.myshopify.com' },
        { status: 400 }
      );
    }

    const clientId = process.env.SHOPIFY_CLIENT_ID;
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Server misconfiguration: Shopify credentials missing' },
        { status: 500 }
      );
    }

    const nonce = crypto.randomBytes(16).toString('hex');
    const statePayload = Buffer.from(
      JSON.stringify({ workspaceId, nonce, timestamp: Date.now() })
    ).toString('base64url');

    const signature = crypto
      .createHmac('sha256', clientSecret)
      .update(statePayload)
      .digest('base64url');

    const signedState = `${statePayload}.${signature}`;

    const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const redirectUri = `${baseUrl.replace(/\/$/, '')}/api/shopify/oauth/callback`;
    const scopes = 'read_products,write_products,read_inventory,write_inventory';

    const authUrl = `https://${shopDomain}/admin/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(
      scopes
    )}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${signedState}`;

    return NextResponse.redirect(authUrl);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to initiate OAuth' }, { status: 500 });
  }
}
