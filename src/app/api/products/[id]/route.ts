import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { workspaceId, updates } = body;

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: existing, error: fetchError } = await supabase
      .from('workspace_products')
      .select('data')
      .eq('workspace_id', workspaceId)
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !existing) {
      return NextResponse.json({ error: fetchError?.message || 'Product not found' }, { status: 404 });
    }

    const mergedData = { ...(existing.data || {}), ...updates, updatedAt: new Date().toISOString() };
    const rowUpdates: Record<string, any> = {
      data: mergedData,
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) rowUpdates.title = updates.title;
    if (updates.vendor !== undefined) rowUpdates.vendor = updates.vendor;
    if (updates.productType !== undefined) rowUpdates.product_type = updates.productType;
    if (updates.price !== undefined) rowUpdates.price = updates.price;
    if (updates.status !== undefined) rowUpdates.status = updates.status;
    if (updates.shopifyId !== undefined) rowUpdates.shopify_id = updates.shopifyId;
    if (updates.shopifyHandle !== undefined) rowUpdates.shopify_handle = updates.shopifyHandle;
    if (updates.shopify_product_url !== undefined) rowUpdates.shopify_url = updates.shopify_product_url;

    const { error: updateError } = await supabase
      .from('workspace_products')
      .update(rowUpdates)
      .eq('workspace_id', workspaceId)
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, product: mergedData });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from('workspace_products')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
