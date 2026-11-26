'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useLocalStorageProducts } from '@/hooks/useLocalStorageProducts';
import { usePagination } from '@/hooks/usePagination';
import { useShopifyPush } from '@/hooks/useShopifyPush';
import { ProductTable } from '@/components/products/ProductTable';
import { ProductFilterBar } from '@/components/products/ProductFilterBar';
import { ProductEditDrawer } from '@/components/products/ProductEditDrawer';
import { Pagination } from '@/components/common/Pagination';
import { ExtractedProduct, ProductPushStatus } from '@/types/product';

export default function ProductsPage() {
  const {
    products,
    isLoaded,
    updateProduct,
    updateProductStatus,
    clearAllProducts,
  } = useLocalStorageProducts();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductPushStatus | 'ALL'>('ALL');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingProduct, setEditingProduct] = useState<ExtractedProduct | null>(null);

  // Shopify Push hook
  const { isPushing, progress, currentTitle, pushSingleProduct, pushBatch } = useShopifyPush({
    onProductPushed: (productId, success, details) => {
      updateProductStatus(
        productId,
        success ? 'PUSHED' : 'ERROR',
        details
      );
    },
  });

  // Filter products by search and status
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
      if (!matchesStatus) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        (p.variant_or_flavor && p.variant_or_flavor.toLowerCase().includes(q)) ||
        (p.vendor && p.vendor.toLowerCase().includes(q)) ||
        (p.tags && p.tags.some((t) => t.toLowerCase().includes(q)))
      );
    });
  }, [products, statusFilter, searchQuery]);

  // Pagination hook
  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedItems,
    goToPage,
    changePageSize,
  } = usePagination({ items: filteredProducts, initialPageSize: 10 });

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    const pageIds = paginatedItems.map((p) => p.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handlePushSelected = async () => {
    const selectedItems = products.filter((p) => selectedIds.has(p.id));
    if (selectedItems.length === 0) return;
    await pushBatch(selectedItems);
    setSelectedIds(new Set());
  };

  const handlePushSingle = async (item: ExtractedProduct) => {
    await pushSingleProduct(item);
  };

  if (!isLoaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Products Catalog</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review staged products from localStorage, edit metadata, and push directly to Shopify.
          </p>
        </div>

        <Link
          href="/extract"
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition self-start"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Extract More Products
        </Link>
      </div>

      {/* Progress Banner while pushing */}
      {isPushing && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 space-y-2 shadow-sm animate-pulse">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>
              Pushing {progress.current} of {progress.total}: {currentTitle}
            </span>
            <span>
              ✅ {progress.success} succeeded &nbsp;|&nbsp; ❌ {progress.failed} failed
            </span>
          </div>
          <div className="w-full bg-emerald-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-600 h-full transition-all duration-300"
              style={{
                width: `${(progress.current / Math.max(1, progress.total)) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Filter and Action Bar */}
      <ProductFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        selectedCount={selectedIds.size}
        totalFiltered={totalItems}
        onPushSelected={handlePushSelected}
        onClearAll={clearAllProducts}
        isPushing={isPushing}
      />

      {/* Paginated Product Table */}
      <ProductTable
        products={paginatedItems}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
        onEditProduct={setEditingProduct}
        onPushProduct={handlePushSingle}
        isPushing={isPushing}
      />

      {/* Pagination Controls */}
      {totalItems > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={goToPage}
          onPageSizeChange={changePageSize}
        />
      )}

      {/* Edit Product Drawer */}
      <ProductEditDrawer
        product={editingProduct}
        isOpen={Boolean(editingProduct)}
        onClose={() => setEditingProduct(null)}
        onSave={(updated) => updateProduct(updated.id, updated)}
      />
    </div>
  );
}
