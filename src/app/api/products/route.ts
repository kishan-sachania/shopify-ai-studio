import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { ExtractedProduct } from '@/types/product';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('workspace_products')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const products: ExtractedProduct[] = (data || []).map((row: any) => ({
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

    return NextResponse.json({ products });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { workspaceId, products } = await req.json();

    if (!workspaceId || !Array.isArray(products)) {
      return NextResponse.json({ error: 'workspaceId and products array are required' }, { status: 400 });
    }

    if (products.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    const rows = products.map((p: ExtractedProduct) => ({
      id: p.id,
      workspace_id: workspaceId,
      title: p.title || '',
      vendor: p.vendor || '',
      product_type: p.productType || '',
      price: p.price || 0,
      status: p.status || 'DRAFT',
      shopify_id: p.shopifyId || null,
      shopify_handle: p.shopifyHandle || null,
      shopify_url: p.shopify_product_url || null,
      data: p,
      updated_at: new Date().toISOString(),
    }));

    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from('workspace_products')
      .upsert(rows, { onConflict: 'workspace_id,id' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: rows.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from('workspace_products')
      .delete()
      .eq('workspace_id', workspaceId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
