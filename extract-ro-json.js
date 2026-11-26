import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';

const INPUT_EXCEL = './product_task_sheet.xlsx';
const OUTPUT_JSON = './products.json';
const SHEET_NAME = 'Product Tasks'; // Worksheet in product_task_sheet.xlsx

// Map Excel column headers -> target JSON keys & types
const FIELD_MAP = {
  // Required mapping per extract-ro-json.js:L9-L17
  'product_name': { key: 'title', type: 'string', required: true },
  'Product Title': { key: 'title', type: 'string', required: true },
  'category': { key: 'productType', type: 'string', default: '' },
  'Category': { key: 'productType', type: 'string', default: '' },
  'tags': { key: 'tags', type: 'array' },
  'Tags': { key: 'tags', type: 'array' },
  'price': { key: 'price', type: 'number' },
  'Price': { key: 'price', type: 'number' },
  'stock_qty': { key: 'inventoryQuantity', type: 'number', default: 2 },
  'Stock': { key: 'inventoryQuantity', type: 'number', default: 2 },
  'Brand': { key: 'vendor', type: 'string', default: '' },
  'HTML Description': { key: 'descriptionHtml', type: 'string', default: '' },

  // Additional task-sheet specific columns
  'variant_or_flavor': { key: 'variant_or_flavor', type: 'string', default: '' },
  'image_url': { key: 'image_url', type: 'string', default: '' },
  'action': { key: 'action', type: 'string', default: '' },
  'task_status': { key: 'task_status', type: 'string', default: '' },
  'source_url': { key: 'source_url', type: 'string', default: '' },
  'shopify_product_url': { key: 'shopify_product_url', type: 'string', default: '' },
  'notes': { key: 'notes', type: 'string', default: '' },
};

function castValue(rawValue, config) {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return config.default ?? null;
  }

  // ExcelJS formula cells return { formula, result }
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
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    case 'string':
    default:
      return String(value).trim();
  }
}

async function extractExcelToJson() {
  const workbook = new ExcelJS.Workbook();
  const excelFile = fs.existsSync(INPUT_EXCEL) ? INPUT_EXCEL : './products.xlsx';

  if (!fs.existsSync(excelFile)) {
    throw new Error(`Excel file not found at ${excelFile}`);
  }

  console.log(`📖 Reading Excel file: ${excelFile}`);
  await workbook.xlsx.readFile(excelFile);

  const worksheet = workbook.getWorksheet(SHEET_NAME) || workbook.worksheets[0];
  if (!worksheet) {
    throw new Error(`No worksheet found in ${excelFile}`);
  }

  console.log(`📄 Using worksheet: "${worksheet.name}" (total rows: ${worksheet.rowCount})`);

  // Read headers from Row 1 and map column index -> field config
  const headerRow = worksheet.getRow(1);
  const columnMap = new Map();

  headerRow.eachCell((cell, colNumber) => {
    const rawHeaderText = String(cell.value ?? '').trim();
    // Match exact or case-insensitively
    const matchKey = Object.keys(FIELD_MAP).find(
      (k) => k.toLowerCase() === rawHeaderText.toLowerCase()
    );
    if (matchKey) {
      columnMap.set(colNumber, FIELD_MAP[matchKey]);
    }
  });

  console.log(`🔍 Mapped ${columnMap.size} columns:`);
  for (const [colNumber, cfg] of columnMap.entries()) {
    console.log(`   Col ${colNumber} ("${worksheet.getRow(1).getCell(colNumber).value}") -> ${cfg.key}`);
  }

  const records = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header row

    const item = {};
    let hasAnyValue = false;

    for (const [colNumber, config] of columnMap.entries()) {
      const cellVal = row.getCell(colNumber).value;
      const parsed = castValue(cellVal, config);

      if (parsed !== null && parsed !== '') {
        hasAnyValue = true;
      }

      if (parsed !== null) {
        item[config.key] = parsed;
      }
    }

    // Skip completely blank trailing rows
    if (!hasAnyValue) return;

    // Validate required fields
    const missingRequired = Object.values(FIELD_MAP)
      .filter((cfg) => cfg.required && !item[cfg.key])
      .map((cfg) => cfg.key);

    if (missingRequired.length > 0) {
      console.warn(`⚠️ Skipping row ${rowNumber}: missing required fields [${missingRequired.join(', ')}]`);
      return;
    }

    // Set default descriptionHtml = title per instructions
    if (!item.descriptionHtml) {
      item.descriptionHtml = item.title ? `<p>${item.title}</p>` : '';
    }

    // Ensure vendor key exists
    if (!('vendor' in item)) {
      item.vendor = '';
    }

    // Parse image URLs into an array if available
    if (item.image_url) {
      item.images = String(item.image_url)
        .split(/[\r\n]+/)
        .map((url) => url.trim())
        .filter(Boolean);
    } else {
      item.images = [];
    }

    records.push(item);
  });

  // Write to ./products.json and ./data/products_extracted.json
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(records, null, 2), 'utf-8');
  console.log(`\n✅ Extracted ${records.length} rows into ${OUTPUT_JSON}`);

  const dataDir = path.resolve('./data');
  if (fs.existsSync(dataDir)) {
    const dataOutput = path.join(dataDir, 'products_extracted.json');
    fs.writeFileSync(dataOutput, JSON.stringify(records, null, 2), 'utf-8');
    console.log(`📄 Also saved copy to ${dataOutput}`);
  }

  return records;
}

extractExcelToJson().catch((err) => {
  console.error('❌ Extraction failed:', err.message);
  process.exit(1);
});
