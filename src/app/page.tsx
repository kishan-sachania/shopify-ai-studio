'use client';

import Link from 'next/link';
import { FileSpreadsheet, PackageCheck, ArrowRight, ShieldCheck, Database, Layers } from 'lucide-react';
import { useLocalStorageProducts } from '@/hooks/useLocalStorageProducts';

export default function HomePage() {
  const { products, isLoaded } = useLocalStorageProducts();

  const total = products.length;
  const ready = products.filter((p) => p.status === 'READY').length;
  const synced = products.filter((p) => p.status === 'PUSHED').length;
  const failed = products.filter((p) => p.status === 'ERROR').length;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-8 sm:p-10 text-white shadow-lg">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
            <ShieldCheck className="h-4 w-4" />
            Next.js App Router & GraphQL Admin API
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Shopify Product Automation Suite
          </h1>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
            Extract product datasets directly from Excel workbooks, stage and inspect items in your shared workspace, and push them smoothly to your Shopify store with GraphQL rate-limiting protection.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/extract"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-600 transition"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Extract from Excel
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20 transition border border-white/15"
            >
              <PackageCheck className="h-4 w-4" />
              View Products ({isLoaded ? total : '...'})
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total in Storage</span>
            <Database className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {isLoaded ? total : '-'}
          </div>
          <p className="text-xs text-slate-400 mt-1">Saved in Supabase workspace</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-blue-600">
            <span className="text-xs font-semibold uppercase tracking-wider">Ready to Push</span>
            <Layers className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {isLoaded ? ready : '-'}
          </div>
          <p className="text-xs text-slate-400 mt-1">Staged & validated</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-xs font-semibold uppercase tracking-wider">Pushed to Shopify</span>
            <PackageCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {isLoaded ? synced : '-'}
          </div>
          <p className="text-xs text-slate-400 mt-1">Successfully created</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-rose-600">
            <span className="text-xs font-semibold uppercase tracking-wider">Failed / Issues</span>
            <ShieldCheck className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {isLoaded ? failed : '-'}
          </div>
          <p className="text-xs text-slate-400 mt-1">Need review / credentials fix</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Excel Task Sheet Extractor</h3>
            <p className="text-sm text-slate-600 mt-2">
              Parse multi-sheet Excel files into normalized product variants. Handles flavor splitting, pricing defaults, inventory counts, and multi-line image URLs.
            </p>
          </div>
          <div className="mt-6">
            <Link
              href="/extract"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Go to Extractor <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 mb-4">
              <PackageCheck className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Paginated Product Catalog</h3>
            <p className="text-sm text-slate-600 mt-2">
              Inspect extracted items with pagination, instant title and tag search, status filters, and pre-push editing. Push individual products or run controlled batch imports.
            </p>
          </div>
          <div className="mt-6">
            <Link
              href="/products"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Browse Catalog <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
