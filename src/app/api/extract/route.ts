import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { parseExcelBuffer } from '@/lib/excel/parser';
import { verifyProductsWithShopify } from '@/lib/shopify/verifyProducts';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const loadSample = formData.get('loadSample') === 'true';
    const workspaceId = formData.get('workspaceId') as string | null;

    let buffer: Buffer;

    if (loadSample) {
      const samplePath = path.resolve('product_task_sheet.xlsx');
      if (!fs.existsSync(samplePath)) {
        return NextResponse.json(
          { error: 'Sample file product_task_sheet.xlsx not found on server' },
          { status: 404 }
        );
      }
      buffer = fs.readFileSync(samplePath);
    } else if (file) {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      return NextResponse.json(
        { error: 'No file provided and loadSample not set' },
        { status: 400 }
      );
    }

    const { products, summary } = await parseExcelBuffer(buffer);
    const { verified: verifiedProducts, shopifyStoreProducts, targetStore, connectionSource } = await verifyProductsWithShopify(products, workspaceId);

    const syncedCount = verifiedProducts.filter((p) => p.status === 'PUSHED').length;
    const readyCount = verifiedProducts.filter((p) => p.status === 'READY').length;
    const needsUpdateCount = verifiedProducts.filter((p) => p.status === 'NEEDS_UPDATE').length;

    return NextResponse.json({
      success: true,
      count: verifiedProducts.length,
      syncedCount,
      readyCount,
      needsUpdateCount,
      products: verifiedProducts,
      summary,
      shopifyStoreProducts,
      targetStore,
      connectionSource,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to extract Excel products' },
      { status: 500 }
    );
  }
}
