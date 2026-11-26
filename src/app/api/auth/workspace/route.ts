import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { email, name } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const cleanEmail = email.trim().toLowerCase();

    const { data: memberRecord } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('email', cleanEmail)
      .limit(1)
      .maybeSingle();

    let workspaceId = memberRecord?.workspace_id;

    if (!workspaceId) {
      workspaceId = `ws_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const workspaceName = name ? `${name}'s Workspace` : `${cleanEmail.split('@')[0]}'s Workspace`;

      await supabase.from('workspaces').upsert(
        { id: workspaceId, name: workspaceName },
        { onConflict: 'id' }
      );

      await supabase.from('workspace_members').upsert(
        { workspace_id: workspaceId, email: cleanEmail, role: 'owner' },
        { onConflict: 'workspace_id,email' }
      );
    }

    const { data: connection } = await supabase
      .from('workspace_shopify_connections')
      .select('shop_domain, status')
      .eq('workspace_id', workspaceId)
      .eq('status', 'CONNECTED')
      .maybeSingle();

    return NextResponse.json({
      workspaceId,
      shopifyConnected: Boolean(connection?.shop_domain),
      shopDomain: connection?.shop_domain || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Workspace resolution failed' }, { status: 500 });
  }
}
