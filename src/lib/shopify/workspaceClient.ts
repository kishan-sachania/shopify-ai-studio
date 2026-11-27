import { getSupabaseServerClient } from '@/lib/supabase/server';
import { decryptToken } from '@/lib/security/crypto';

export interface WorkspaceShopifyClient {
  shopDomain: string;
  apiVersion: string;
  executeGraphQL: <T = any>(query: string, variables?: Record<string, any>) => Promise<T>;
}

export async function getShopifyClientForWorkspace(workspaceId: string): Promise<WorkspaceShopifyClient> {
  const supabase = getSupabaseServerClient();

  let { data: connection, error } = await supabase
    .from('workspace_shopify_connections')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('installed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!connection) {
    const { data: anyConn, error: anyErr } = await supabase
      .from('workspace_shopify_connections')
      .select('*')
      .eq('status', 'CONNECTED')
      .order('installed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (anyConn) {
      connection = anyConn;
    } else {
      throw new Error(`Shopify connection not found for workspace ${workspaceId}: ${error?.message || anyErr?.message || 'No connected rows in database'}`);
    }
  }

  if (connection.status !== 'CONNECTED') {
    throw new Error(`Shopify connection for workspace is ${connection.status}`);
  }

  const plainToken = decryptToken(
    connection.encrypted_access_token,
    connection.token_iv,
    connection.token_auth_tag
  );

  const shopDomain = connection.shop_domain;
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-10';
  const endpoint = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;

  return {
    shopDomain,
    apiVersion,
    executeGraphQL: async <T = any>(query: string, variables: Record<string, any> = {}): Promise<T> => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': plainToken,
        },
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Shopify GraphQL HTTP error [${response.status}]: ${errText || response.statusText}`);
      }

      const json = await response.json();
      if (json.errors && json.errors.length > 0) {
        throw new Error(`Shopify GraphQL error: ${json.errors.map((e: any) => e.message).join(', ')}`);
      }

      return json.data as T;
    },
  };
}
