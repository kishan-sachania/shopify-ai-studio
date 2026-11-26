import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { parseExcelBuffer } from '@/lib/excel/parser';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const loadSample = formData.get('loadSample') === 'true';

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

    return NextResponse.json({
      success: true,
      count: products.length,
      products,
      summary,
    });
  } catch (error: any) {
    console.error('Error during Excel extraction:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to extract Excel products' },
      { status: 500 }
    );
  }
}
