import { ExtractedProduct } from '@/types/product';

export function buildProductSetPayload(
  item: ExtractedProduct,
  locationId?: string | null,
  collectionGids?: string[]
) {
  const flavor = (item.variant_or_flavor || '').trim();
  const isGeneric =
    !flavor ||
    flavor === 'No color option (single product)' ||
    flavor === 'All existing flavors (list not provided)' ||
    flavor === 'ALL flavors';

  const title = isGeneric ? item.title : `${item.title} – ${flavor}`;
  const price = typeof item.price === 'number' && item.price > 0 ? item.price : 36.99;
  const stockQty = typeof item.inventoryQuantity === 'number' ? item.inventoryQuantity : 2;

  let mediaList: string[] = [];
  if (Array.isArray(item.images) && item.images.length > 0) {
    mediaList = item.images;
  } else if (typeof item.image_url === 'string' && item.image_url.trim()) {
    mediaList = item.image_url.split(/[\r\n]+/).map((u) => u.trim());
  }

  const files = mediaList
    .filter((u) => typeof u === 'string' && u.startsWith('http'))
    .map((url) => ({ originalSource: url }));

  const validShopifyId =
    typeof item.shopifyId === 'string' && item.shopifyId.startsWith('gid://shopify/Product/')
      ? item.shopifyId
      : undefined;

  return {
    title,
    descriptionHtml: item.descriptionHtml || '',
    vendor: item.vendor || '',
    productType: item.productType || '',
    tags: Array.isArray(item.tags) ? item.tags : [],
    ...(collectionGids && collectionGids.length > 0 ? { collections: collectionGids } : {}),
    status: 'ACTIVE',
    productOptions: [
      {
        name: 'Title',
        values: [{ name: 'Default Title' }],
      },
    ],
    variants: [
      {
        price,
        optionValues: [{ optionName: 'Title', name: 'Default Title' }],
        inventoryItem: {
          tracked: true,
        },
        inventoryPolicy: 'DENY',
        ...(locationId
          ? {
              inventoryQuantities: [
                {
                  locationId,
                  name: 'available',
                  quantity: stockQty,
                },
              ],
            }
          : {}),
      },
    ],
    files,
    ...(validShopifyId ? { id: validShopifyId } : {}),
  };
}
