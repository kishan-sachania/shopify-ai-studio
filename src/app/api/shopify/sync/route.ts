import { NextRequest, NextResponse } from 'next/server';
import { getShopifyClientForWorkspace } from '@/lib/shopify/workspaceClient';
import { getSupabaseServerClient } from '@/lib/supabase/server';

const PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          handle
          status
          vendor
          productType
          createdAt
          updatedAt
          options {
            id
            name
            values
          }
          variants(first: 50) {
            edges {
              node {
                id
                title
                price
                sku
                inventoryQuantity
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
          media(first: 10) {
            edges {
              node {
                preview {
                  image {
                    url
                    altText
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export async function POST(req: NextRequest) {
  try {
    const { workspaceId, limit = 50 } = await req.json();

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
    }

    const client = await getShopifyClientForWorkspace(workspaceId);
    const data = await client.executeGraphQL<any>(PRODUCTS_QUERY, { first: limit });

    const edges = data?.products?.edges || [];
    const supabase = getSupabaseServerClient();

    const upsertRows = edges.map(({ node }: any) => ({
      workspace_id: workspaceId,
      shopify_product_id: node.id,
      title: node.title,
      handle: node.handle,
      data: node,
      synced_at: new Date().toISOString(),
    }));

    if (upsertRows.length > 0) {
      const { error } = await supabase
        .from('products')
        .upsert(upsertRows, { onConflict: 'workspace_id,shopify_product_id' });

      if (error) {
        return NextResponse.json({ error: `Supabase sync error: ${error.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      syncedCount: upsertRows.length,
      hasNextPage: data?.products?.pageInfo?.hasNextPage || false,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Product sync failed' }, { status: 500 });
  }
}
