import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSupabaseServerClient } from '@/lib/supabase/server';

function verifyWebhookHmac(rawBody: string, headerHmac: string | null, secret: string): boolean {
  if (!headerHmac) return false;
  const hash = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  const bufA = Buffer.from(headerHmac);
  const bufB = Buffer.from(hash);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
    const topic = req.headers.get('x-shopify-topic');
    const shopDomain = req.headers.get('x-shopify-shop-domain');

    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
    if (!clientSecret) {
      return NextResponse.json({ error: 'Missing SHOPIFY_CLIENT_SECRET' }, { status: 500 });
    }

    if (!verifyWebhookHmac(rawBody, hmacHeader, clientSecret)) {
      return NextResponse.json({ error: 'Unauthorized webhook signature' }, { status: 401 });
    }

    if (!shopDomain) {
      return NextResponse.json({ error: 'Missing shop domain header' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: connection } = await supabase
      .from('workspace_shopify_connections')
      .select('workspace_id, status')
      .eq('shop_domain', shopDomain)
      .single();

    if (!connection) {
      return NextResponse.json({ message: 'No matching workspace for shop' }, { status: 200 });
    }

    const workspaceId = connection.workspace_id;
    const payload = rawBody ? JSON.parse(rawBody) : {};

    if (topic === 'app/uninstalled') {
      await supabase
        .from('workspace_shopify_connections')
        .update({
          status: 'DISCONNECTED',
          uninstalled_at: new Date().toISOString(),
          encrypted_access_token: '',
          token_iv: '',
          token_auth_tag: '',
        })
        .eq('workspace_id', workspaceId);

      return NextResponse.json({ status: 'uninstalled_handled' }, { status: 200 });
    }

    if (topic === 'products/create' || topic === 'products/update') {
      const shopifyProductId = `gid://shopify/Product/${payload.id}`;
      await supabase.from('products').upsert(
        {
          workspace_id: workspaceId,
          shopify_product_id: shopifyProductId,
          title: payload.title || '',
          handle: payload.handle || '',
          data: payload,
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,shopify_product_id' }
      );
      return NextResponse.json({ status: 'synced' }, { status: 200 });
    }

    if (topic === 'products/delete') {
      const shopifyProductId = `gid://shopify/Product/${payload.id}`;
      await supabase
        .from('products')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('shopify_product_id', shopifyProductId);

      return NextResponse.json({ status: 'deleted' }, { status: 200 });
    }

    return NextResponse.json({ status: 'ignored_topic' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Webhook processing failed' }, { status: 500 });
  }
}
