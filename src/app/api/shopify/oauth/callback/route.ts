import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { encryptToken } from '@/lib/security/crypto';

function verifyShopifyHmac(searchParams: URLSearchParams, secret: string): boolean {
  const hmac = searchParams.get('hmac');
  if (!hmac) return false;

  const entries: string[] = [];
  searchParams.forEach((value, key) => {
    if (key !== 'hmac' && key !== 'signature') {
      entries.push(`${key}=${value}`);
    }
  });

  entries.sort();
  const message = entries.join('&');
  const computedHmac = crypto.createHmac('sha256', secret).update(message).digest('hex');

  const hmacBuf = Buffer.from(hmac, 'utf-8');
  const compBuf = Buffer.from(computedHmac, 'utf-8');

  if (hmacBuf.length !== compBuf.length) return false;
  return crypto.timingSafeEqual(hmacBuf, compBuf);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const shop = searchParams.get('shop');
    const state = searchParams.get('state');

    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
    const clientId = process.env.SHOPIFY_CLIENT_ID;

    if (!clientSecret || !clientId) {
      return NextResponse.json({ error: 'Server OAuth configuration missing' }, { status: 500 });
    }

    if (!code || !shop || !state) {
      return NextResponse.json({ error: 'Missing code, shop, or state parameter' }, { status: 400 });
    }

    if (!verifyShopifyHmac(searchParams, clientSecret)) {
      return NextResponse.json({ error: 'Invalid HMAC signature from Shopify' }, { status: 403 });
    }

    let parsedState: { workspaceId: string; nonce: string; timestamp: number };
    try {
      parsedState = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    } catch {
      return NextResponse.json({ error: 'Invalid state format' }, { status: 400 });
    }

    if (Date.now() - parsedState.timestamp > 15 * 60 * 1000) {
      return NextResponse.json({ error: 'OAuth state has expired. Please retry.' }, { status: 400 });
    }

    const tokenUrl = `https://${shop}/admin/oauth/access_token`;
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return NextResponse.json({ error: `Token exchange failed: ${errText}` }, { status: 502 });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token as string;
    const approvedScope = (tokenData.scope as string) || '';

    const { encryptedToken, iv, authTag } = encryptToken(accessToken);

    const supabase = getSupabaseServerClient();

    await supabase
      .from('workspaces')
      .upsert(
        { id: parsedState.workspaceId, name: 'Default Workspace' },
        { onConflict: 'id' }
      );

    const { error: dbError } = await supabase
      .from('workspace_shopify_connections')
      .upsert(
        {
          workspace_id: parsedState.workspaceId,
          shop_domain: shop,
          encrypted_access_token: encryptedToken,
          token_iv: iv,
          token_auth_tag: authTag,
          scopes: approvedScope.split(',').map((s) => s.trim()).filter(Boolean),
          status: 'CONNECTED',
          installed_at: new Date().toISOString(),
          uninstalled_at: null,
        },
        { onConflict: 'workspace_id' }
      );

    if (dbError) {
      return NextResponse.json({ error: `Failed to save connection: ${dbError.message}` }, { status: 500 });
    }

    const destination = new URL('/products', req.nextUrl.origin);
    destination.searchParams.set('shop', shop);
    destination.searchParams.set('status', 'connected');
    return NextResponse.redirect(destination.toString());
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'OAuth callback failed' }, { status: 500 });
  }
}
