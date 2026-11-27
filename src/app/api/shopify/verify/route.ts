import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { verifyProductsWithShopify } from '@/lib/shopify/verifyProducts';
import { ExtractedProduct } from '@/types/product';

export async function POST(req: NextRequest) {
  try {
    const { workspaceId } = await req.json();

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: rows, error: fetchError } = await supabase
      .from('workspace_products')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: true, count: 0, syncedCount: 0, products: [] });
    }

    const products: ExtractedProduct[] = rows.map((row: any) => ({
      ...(row.data || {}),
      id: row.id,
      title: row.title,
      vendor: row.vendor,
      status: row.status,
      price: Number(row.price || 0),
      shopifyId: row.shopify_id || undefined,
      shopifyHandle: row.shopify_handle || undefined,
      shopify_product_url: row.shopify_url || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const verified = await verifyProductsWithShopify(products, workspaceId);

    const updateRows = verified.map((p) => ({
      id: p.id,
      workspace_id: workspaceId,
      title: p.title || '',
      vendor: p.vendor || '',
      product_type: p.productType || '',
      price: p.price || 0,
      status: p.status,
      shopify_id: p.shopifyId || null,
      shopify_handle: p.shopifyHandle || null,
      shopify_url: p.shopify_product_url || null,
      data: p,
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabase
      .from('workspace_products')
      .upsert(updateRows, { onConflict: 'workspace_id,id' });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    const syncedCount = verified.filter((p) => p.status === 'PUSHED').length;

    return NextResponse.json({
      success: true,
      count: verified.length,
      syncedCount,
      products: verified,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Verification failed' }, { status: 500 });
  }
}
