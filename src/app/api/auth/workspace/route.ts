import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { checkEmailAccess } from '@/lib/auth/accessControl';

const PUBLIC_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];

export async function POST(req: NextRequest) {
  try {
    const { email, name } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const accessCheck = checkEmailAccess(cleanEmail);

    if (!accessCheck.allowed) {
      return NextResponse.json(
        {
          error: accessCheck.reason || 'Access denied: Organization or email not authorized.',
          isAuthorized: false,
        },
        { status: 403 }
      );
    }

    const supabase = getSupabaseServerClient();
    const domain = cleanEmail.split('@')[1];
    const isPublicEmail = PUBLIC_DOMAINS.includes(domain);

    const { data: memberRecord } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('email', cleanEmail)
      .limit(1)
      .maybeSingle();

    let workspaceId = memberRecord?.workspace_id;
    let userRole = memberRecord?.role || 'member';

    if (!workspaceId) {
      if (domain && !isPublicEmail) {
        workspaceId = `ws_org_${domain.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const orgPrefix = domain.split('.')[0];
        const formattedOrgName = orgPrefix.charAt(0).toUpperCase() + orgPrefix.slice(1);
        const workspaceName = `${formattedOrgName} Workspace`;

        const { data: existingWs } = await supabase
          .from('workspaces')
          .select('id')
          .eq('id', workspaceId)
          .maybeSingle();

        if (!existingWs) {
          await supabase.from('workspaces').upsert(
            { id: workspaceId, name: workspaceName },
            { onConflict: 'id' }
          );
          userRole = 'owner';
        } else {
          userRole = 'member';
        }

        await supabase.from('workspace_members').upsert(
          { workspace_id: workspaceId, email: cleanEmail, role: userRole },
          { onConflict: 'workspace_id,email' }
        );
      } else {
        workspaceId = `ws_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const workspaceName = name ? `${name}'s Workspace` : `${cleanEmail.split('@')[0]}'s Workspace`;
        userRole = 'owner';

        await supabase.from('workspaces').upsert(
          { id: workspaceId, name: workspaceName },
          { onConflict: 'id' }
        );

        await supabase.from('workspace_members').upsert(
          { workspace_id: workspaceId, email: cleanEmail, role: userRole },
          { onConflict: 'workspace_id,email' }
        );
      }
    }

    const { data: connection } = await supabase
      .from('workspace_shopify_connections')
      .select('shop_domain, status')
      .eq('workspace_id', workspaceId)
      .eq('status', 'CONNECTED')
      .maybeSingle();

    return NextResponse.json({
      workspaceId,
      role: userRole,
      isAuthorized: true,
      shopifyConnected: Boolean(connection?.shop_domain),
      shopDomain: connection?.shop_domain || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Workspace resolution failed' }, { status: 500 });
  }
}
