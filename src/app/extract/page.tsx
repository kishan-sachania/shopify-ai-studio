'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { FileDropzone } from '@/components/extract/FileDropzone';
import { Badge } from '@/components/common/Badge';
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

  const syncedCount = extractedData?.products.filter((p) => p.status === 'PUSHED').length || 0;
  const readyCount = extractedData?.products.filter((p) => p.status === 'READY').length || 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Extract Excel Products</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload your product spreadsheet to automatically extract items, flavors, prices, and images into your workspace database.
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

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-xs text-slate-500">Total Read</span>
              <p className="text-xl font-bold text-slate-800">{extractedData.summary.totalRows}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              <span className="text-xs text-emerald-700">Synced with Shopify</span>
              <p className="text-xl font-bold text-emerald-800">{syncedCount}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <span className="text-xs text-blue-700">Ready to Push</span>
              <p className="text-xl font-bold text-blue-800">{readyCount}</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
              <span className="text-xs text-amber-700">Skipped Rows</span>
              <p className="text-xl font-bold text-amber-800">{extractedData.summary.skippedRows}</p>
            </div>
          </div>

          {extractedData.products.length > 0 && (
            <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 text-xs font-semibold text-slate-600">
                Extracted Products Preview ({extractedData.products.length})
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {extractedData.products.slice(0, 15).map((prod) => (
                  <div key={prod.id} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-slate-50">
                    <div className="min-w-0 pr-4">
                      <p className="font-medium text-slate-800 truncate">{prod.title}</p>
                      <p className="text-xs text-slate-500">
                        {prod.variant_or_flavor ? `Flavor: ${prod.variant_or_flavor}` : 'Standard product'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge status={prod.status} />
                      {prod.shopify_product_url && (
                        <a
                          href={prod.shopify_product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-emerald-600"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
