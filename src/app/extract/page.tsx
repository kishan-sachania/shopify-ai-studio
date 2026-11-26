'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { FileDropzone } from '@/components/extract/FileDropzone';
import { useLocalStorageProducts } from '@/hooks/useLocalStorageProducts';
import { ExtractedProduct, ExtractionSummary } from '@/types/product';

export default function ExtractPage() {
  const router = useRouter();
  const { bulkAddProducts } = useLocalStorageProducts();
  const [extractedData, setExtractedData] = useState<{
    products: ExtractedProduct[];
    summary: ExtractionSummary;
  } | null>(null);

  const handleSuccess = (products: ExtractedProduct[], summary: ExtractionSummary) => {
    bulkAddProducts(products);
    setExtractedData({ products, summary });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Extract Excel Products</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload your product spreadsheet to automatically extract items, flavors, prices, and images into local storage.
        </p>
      </div>

      <FileDropzone onExtractionSuccess={handleSuccess} />

      {extractedData && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <h3 className="font-semibold text-slate-900">Extraction Summary</h3>
            </div>
            <button
              onClick={() => router.push('/products')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
            >
              Open in Products Catalog <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-xs text-slate-500">Total Rows Read</span>
              <p className="text-xl font-bold text-slate-800">{extractedData.summary.totalRows}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              <span className="text-xs text-emerald-700">Valid Products Created</span>
              <p className="text-xl font-bold text-emerald-800">{extractedData.summary.validProducts}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
              <span className="text-xs text-amber-700">Skipped Rows</span>
              <p className="text-xl font-bold text-amber-800">{extractedData.summary.skippedRows}</p>
            </div>
          </div>

          {extractedData.summary.warnings.length > 0 && (
            <div className="mt-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>Extraction Warnings:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 max-h-32 overflow-y-auto">
                {extractedData.summary.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
