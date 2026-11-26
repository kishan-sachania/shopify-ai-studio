import { ExcelColumnFieldConfig } from '@/types/product';

export const FIELD_MAP: Record<string, ExcelColumnFieldConfig> = {
  // Required mapping
  'product_name': { key: 'title', type: 'string', required: true },
  'Product Title': { key: 'title', type: 'string', required: true },
  'category': { key: 'productType', type: 'string', default: '' },
  'Category': { key: 'productType', type: 'string', default: '' },
  'tags': { key: 'tags', type: 'array' },
  'Tags': { key: 'tags', type: 'array' },
  'collections': { key: 'collections', type: 'array' },
  'Collections': { key: 'collections', type: 'array' },
  'collection': { key: 'collections', type: 'array' },
  'Collection': { key: 'collections', type: 'array' },
  'price': { key: 'price', type: 'number' },
  'Price': { key: 'price', type: 'number' },
  'stock_qty': { key: 'inventoryQuantity', type: 'number', default: 2 },
  'Stock': { key: 'inventoryQuantity', type: 'number', default: 2 },
  'Brand': { key: 'vendor', type: 'string', default: '' },
  'brand': { key: 'vendor', type: 'string', default: '' },
  'Vendor': { key: 'vendor', type: 'string', default: '' },
  'vendor': { key: 'vendor', type: 'string', default: '' },
  'HTML Description': { key: 'descriptionHtml', type: 'string', default: '' },

  // Task-sheet specific columns
  'variant_or_flavor': { key: 'variant_or_flavor', type: 'string', default: '' },
  'image_url': { key: 'image_url', type: 'string', default: '' },
  'action': { key: 'action', type: 'string', default: '' },
  'task_status': { key: 'task_status', type: 'string', default: '' },
  'source_url': { key: 'source_url', type: 'string', default: '' },
  'shopify_product_url': { key: 'shopify_product_url', type: 'string', default: '' },
  'live_url': { key: 'live_url', type: 'string', default: '' },
  'Live URL': { key: 'live_url', type: 'string', default: '' },
  'updated_at': { key: 'sheet_updated_at', type: 'string', default: '' },
  'Updated At': { key: 'sheet_updated_at', type: 'string', default: '' },
  'notes': { key: 'notes', type: 'string', default: '' },
};

export function castCellValue(rawValue: any, config: ExcelColumnFieldConfig): any {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return config.default ?? null;
  }

  // Handle formula cell results
  const value = typeof rawValue === 'object' && rawValue !== null && 'result' in rawValue
    ? rawValue.result
    : rawValue;

  switch (config.type) {
    case 'number': {
      const num = Number(value);
      return Number.isNaN(num) ? (config.default ?? null) : num;
    }
    case 'boolean':
      return Boolean(value);
    case 'array':
      return String(value)
        .split(/[\r\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean);
    case 'string':
    default:
      return String(value).trim();
  }
}
