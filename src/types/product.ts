export type ProductPushStatus = 'DRAFT' | 'READY' | 'PUSHING' | 'PUSHED' | 'ERROR';

export interface ExtractedProduct {
  id: string; // Unique client-side ID
  title: string;
  vendor: string;
  productType: string;
  tags: string[];
  collections?: string[];
  price: number;
  inventoryQuantity: number;
  descriptionHtml: string;
  variant_or_flavor?: string;
  image_url?: string;
  images: string[];
  action?: string;
  task_status?: string;
  source_url?: string;
  shopify_product_url?: string;
  live_url?: string;
  sheet_updated_at?: string;
  notes?: string;

  // Local state & Shopify linkage
  status: ProductPushStatus;
  shopifyId?: string;
  shopifyHandle?: string;
  lastPushedAt?: string;
  errorMessages?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ExtractionSummary {
  totalRows: number;
  validProducts: number;
  skippedRows: number;
  warnings: string[];
}

export interface ExcelColumnFieldConfig {
  key: keyof ExtractedProduct;
  type: 'string' | 'number' | 'boolean' | 'array';
  required?: boolean;
  default?: any;
}
