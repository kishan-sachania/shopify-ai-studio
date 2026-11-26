import ExcelJS from 'exceljs';
import { FIELD_MAP, castCellValue } from './schema';
import { ExtractedProduct, ExtractionSummary } from '@/types/product';

const SHEET_NAME = 'Product Tasks';

export async function parseExcelBuffer(
  buffer: ArrayBuffer | Buffer,
  fallbackSheetIndex = 0
): Promise<{ products: ExtractedProduct[]; summary: ExtractionSummary }> {
  const workbook = new ExcelJS.Workbook();
  // @ts-ignore - ExcelJS accepts node buffer or ArrayBuffer
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.getWorksheet(SHEET_NAME) || workbook.worksheets[fallbackSheetIndex];
  if (!worksheet) {
    throw new Error('No valid worksheet found in uploaded Excel file.');
  }

  const headerRow = worksheet.getRow(1);
  const columnMap = new Map<number, (typeof FIELD_MAP)[string]>();

  headerRow.eachCell((cell, colNumber) => {
    const rawHeaderText = String(cell.value ?? '').trim();
    const matchKey = Object.keys(FIELD_MAP).find(
      (k) => k.toLowerCase() === rawHeaderText.toLowerCase()
    );
    if (matchKey) {
      columnMap.set(colNumber, FIELD_MAP[matchKey]);
    }
  });

  const products: ExtractedProduct[] = [];
  const warnings: string[] = [];
  let totalRows = 0;
  let skippedRows = 0;

  const nowIso = new Date().toISOString();

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip headers
    totalRows++;

    const item: Record<string, any> = {};
    let hasAnyValue = false;

    for (const [colNumber, config] of columnMap.entries()) {
      const cellVal = row.getCell(colNumber).value;
      const parsed = castCellValue(cellVal, config);

      if (parsed !== null && parsed !== '') {
        hasAnyValue = true;
      }
      if (parsed !== null) {
        item[config.key] = parsed;
      }
    }

    if (!hasAnyValue) {
      skippedRows++;
      return;
    }

    // Required fields check
    const missing = Object.values(FIELD_MAP)
      .filter((cfg) => cfg.required && !item[cfg.key])
      .map((cfg) => cfg.key);

    if (missing.length > 0) {
      warnings.push(`Row ${rowNumber}: Skipped because missing [${missing.join(', ')}]`);
      skippedRows++;
      return;
    }

    // Defaults & image processing
    const title = item.title || '';
    const desc = item.descriptionHtml || `<p>${title}</p>`;
    const vendor = item.vendor || '';

    let images: string[] = [];
    if (item.image_url) {
      images = String(item.image_url)
        .split(/[\r\n]+/)
        .map((u) => u.trim())
        .filter((u) => u.startsWith('http'));
    }

    const uniqueId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const product: ExtractedProduct = {
      id: uniqueId,
      title,
      vendor,
      productType: item.productType || '',
      tags: Array.isArray(item.tags) ? item.tags : [],
      collections: Array.isArray(item.collections) ? item.collections : [],
      price: typeof item.price === 'number' && item.price > 0 ? item.price : 36.99,
      inventoryQuantity: typeof item.inventoryQuantity === 'number' ? item.inventoryQuantity : 2,
      descriptionHtml: desc,
      variant_or_flavor: item.variant_or_flavor || '',
      image_url: item.image_url || '',
      images,
      action: item.action || '',
      task_status: item.task_status || '',
      source_url: item.source_url || '',
      shopify_product_url: item.shopify_product_url || '',
      notes: item.notes || '',
      status: 'READY',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    products.push(product);
  });

  return {
    products,
    summary: {
      totalRows,
      validProducts: products.length,
      skippedRows,
      warnings,
    },
  };
}
