import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getShopifyClientForWorkspace } from '@/lib/shopify/workspaceClient';
import { executeGraphQL, getPrimaryLocationId, PRODUCT_SET_MUTATION } from '@/lib/shopify/client';
import { buildProductSetPayload } from '@/lib/shopify/payloadBuilder';
import { ExtractedProduct } from '@/types/product';
import { PushResult } from '@/types/shopify';

const GET_PRIMARY_LOCATION_QUERY = `
  query GetPrimaryLocation {
    locations(first: 1) {
      nodes {
        id
      }
    }
  }
`;

const GET_ALL_PUBLICATIONS_AND_CATALOGS_QUERY = `
  query GetAllPublicationsAndCatalogs {
    publications(first: 50) {
      nodes {
        id
        name
      }
    }
    catalogs(first: 50) {
      nodes {
        id
        title
        publication {
          id
        }
      }
    }
  }
`;

const PUBLISHABLE_PUBLISH_MUTATION = `
  mutation publishProduct($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
      userErrors {
        field
        message
      }
    }
  }
`;

const FIND_COLLECTION_QUERY = `
  query findCollection($q: String!) {
    collections(first: 5, query: $q) {
      nodes {
        id
        title
      }
    }
  }
`;

const CREATE_COLLECTION_MUTATION = `
  mutation createCollection($input: CollectionInput!) {
    collectionCreate(input: $input) {
      collection {
        id
        title
      }
      userErrors {
        field
        message
      }
    }
  }
`;

async function resolveStoreCollectionGids(
  execute: <T = any>(query: string, variables?: Record<string, any>) => Promise<T>,
  collectionNames: string[],
  cache: Map<string, string>
): Promise<string[]> {
  const gids: string[] = [];

  for (const rawName of collectionNames) {
    const cleanTitle = rawName.trim();
    if (!cleanTitle) continue;

    const cacheKey = cleanTitle.toLowerCase();
    if (cache.has(cacheKey)) {
      gids.push(cache.get(cacheKey)!);
      continue;
    }

    try {
      const searchRes: any = await execute(FIND_COLLECTION_QUERY, { q: `title:"${cleanTitle}"` });
      const nodes = searchRes?.data?.collections?.nodes || searchRes?.collections?.nodes || [];
      const existing = nodes.find((c: any) => c.title.toLowerCase() === cleanTitle.toLowerCase());

      if (existing?.id) {
        cache.set(cacheKey, existing.id);
        gids.push(existing.id);
        continue;
      }

      const createRes: any = await execute(CREATE_COLLECTION_MUTATION, {
        input: { title: cleanTitle },
      });
      const newColl = createRes?.data?.collectionCreate?.collection || createRes?.collectionCreate?.collection;
      if (newColl?.id) {
        cache.set(cacheKey, newColl.id);
        gids.push(newColl.id);
      }
    } catch {
      continue;
    }
  }

  return gids;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const products: ExtractedProduct[] = Array.isArray(body.products)
      ? body.products
      : body.product
      ? [body.product]
      : [];

    if (products.length === 0) {
      return NextResponse.json({ error: 'No products provided to push' }, { status: 400 });
    }

    let targetWorkspaceId: string | null = body.workspaceId || null;
    const supabase = getSupabaseServerClient();

    if (!targetWorkspaceId) {
      const { data: latestConnection } = await supabase
        .from('workspace_shopify_connections')
        .select('workspace_id')
        .eq('status', 'CONNECTED')
        .order('installed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestConnection?.workspace_id) {
        targetWorkspaceId = latestConnection.workspace_id;
      }
    }

    let runner: {
      shopDomain: string;
      locationId: string | null;
      execute: <T = any>(query: string, variables?: Record<string, any>) => Promise<T>;
    };

    if (targetWorkspaceId) {
      const wsClient = await getShopifyClientForWorkspace(targetWorkspaceId);
      let locId: string | null = null;
      try {
        const locRes = await wsClient.executeGraphQL<any>(GET_PRIMARY_LOCATION_QUERY);
        locId = locRes?.locations?.nodes?.[0]?.id || null;
      } catch {
        locId = null;
      }

      runner = {
        shopDomain: wsClient.shopDomain,
        locationId: locId,
        execute: wsClient.executeGraphQL,
      };
    } else {
      const locId = await getPrimaryLocationId();
      runner = {
        shopDomain: process.env.SHOPIFY_SHOP_DOMAIN || '',
        locationId: locId,
        execute: executeGraphQL,
      };
    }

    let targetPublicationInputs: { publicationId: string }[] = [];
    try {
      const pubRes: any = await runner.execute(GET_ALL_PUBLICATIONS_AND_CATALOGS_QUERY);
      const pubSet = new Set<string>();

      const pubNodes = pubRes?.data?.publications?.nodes || pubRes?.publications?.nodes || [];
      pubNodes.forEach((p: any) => {
        if (p?.id) pubSet.add(p.id);
      });

      const catalogNodes = pubRes?.data?.catalogs?.nodes || pubRes?.catalogs?.nodes || [];
      catalogNodes.forEach((c: any) => {
        if (c?.publication?.id) pubSet.add(c.publication.id);
      });

      targetPublicationInputs = Array.from(pubSet).map((pubId) => ({ publicationId: pubId }));
    } catch (err) {
      console.error('Failed to query publications and catalogs:', err);
      targetPublicationInputs = [];
    }

    const results: PushResult[] = [];
    const collectionCache = new Map<string, string>();

    for (let i = 0; i < products.length; i++) {
      const item = products[i];

      let collectionGids: string[] = [];
      if (Array.isArray(item.collections) && item.collections.length > 0) {
        collectionGids = await resolveStoreCollectionGids(
          runner.execute,
          item.collections,
          collectionCache
        );
      }

      const payload = buildProductSetPayload(item, runner.locationId, collectionGids);

      try {
        let response: any = await runner.execute(PRODUCT_SET_MUTATION, {
          synchronous: true,
          input: payload,
        });

        if (
          payload.id &&
          response.data?.productSet?.userErrors?.some((e: any) =>
            e.message?.toLowerCase().includes('does not exist')
          )
        ) {
          const retryPayload = { ...payload };
          delete retryPayload.id;
          response = await runner.execute(PRODUCT_SET_MUTATION, {
            synchronous: true,
            input: retryPayload,
          });
        }

        if (response.errors && response.errors.length > 0) {
          results.push({
            productId: item.id,
            success: false,
            title: payload.title,
            errors: response.errors.map((e: any) => e.message || String(e)),
          });
        } else {
          const { product, userErrors } = response.data?.productSet || response.productSet || {};
          if (userErrors && userErrors.length > 0) {
            results.push({
              productId: item.id,
              success: false,
              title: payload.title,
              errors: userErrors.map((e: any) => e.message),
            });
          } else if (product?.id) {
            if (targetPublicationInputs.length > 0) {
              try {
                const pubOutput: any = await runner.execute(PUBLISHABLE_PUBLISH_MUTATION, {
                  id: product.id,
                  input: targetPublicationInputs,
                });
                if (pubOutput?.data?.publishablePublish?.userErrors?.length > 0) {
                  console.error('Publish userErrors:', pubOutput.data.publishablePublish.userErrors);
                }
              } catch (err) {
                console.error('Failed to execute publishablePublish:', err);
              }
            }

            const productNumericId = product.id.split('/').pop();
            const shopifyUrl = runner.shopDomain
              ? `https://${runner.shopDomain}/admin/products/${productNumericId}`
              : undefined;

            results.push({
              productId: item.id,
              success: true,
              shopifyId: product.id,
              shopifyHandle: product.handle,
              shopifyUrl,
              title: product.title,
            });
          } else {
            results.push({
              productId: item.id,
              success: false,
              title: payload.title,
              errors: ['Unknown response structure from Shopify'],
            });
          }
        }
      } catch (err: any) {
        results.push({
          productId: item.id,
          success: false,
          title: payload.title,
          errors: [err.message || 'Fatal error during push'],
        });
      }

      if (i < products.length - 1) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    return NextResponse.json({
      success: true,
      results,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Push failed' }, { status: 500 });
  }
}
