'use client';

import Link from 'next/link';
import { ExternalLink, Edit3, ArrowUpRight, Image as ImageIcon, Eye } from 'lucide-react';
import { ExtractedProduct } from '@/types/product';
import { Badge } from '@/components/common/Badge';

interface ProductTableProps {
  products: ExtractedProduct[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onEditProduct: (product: ExtractedProduct) => void;
  onPushProduct: (product: ExtractedProduct) => void;
  isPushing: boolean;
}

export function ProductTable({
  products,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onEditProduct,
  onPushProduct,
  isPushing,
}: ProductTableProps) {
  const allSelected = products.length > 0 && products.every((p) => selectedIds.has(p.id));

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-slate-200 text-center">
        <p className="text-slate-500 font-medium text-sm">No products found matching your filter.</p>
        <p className="text-slate-400 text-xs mt-1">Extract products from an Excel sheet to populate this catalog.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <tr>
            <th className="py-3 px-4 w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
            </th>
            <th className="py-3 px-3">Product</th>
            <th className="py-3 px-3">Flavor / Variant</th>
            <th className="py-3 px-3">Price</th>
            <th className="py-3 px-3">Stock</th>
            <th className="py-3 px-3">Images</th>
            <th className="py-3 px-3">Status</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-slate-700">
          {products.map((item) => {
            const isSelected = selectedIds.has(item.id);

            return (
              <tr
                key={item.id}
                className={`hover:bg-slate-50/80 transition-colors ${
                  isSelected ? 'bg-emerald-50/40' : ''
                }`}
              >
                <td className="py-3.5 px-4">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(item.id)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </td>

                {/* Product Title & Vendor */}
                <td className="py-3.5 px-3 max-w-xs">
                  <Link
                    href={`/products/${item.id}`}
                    className="font-medium text-slate-900 hover:text-emerald-600 transition truncate block"
                    title={item.title}
                  >
                    {item.title}
                  </Link>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                    {item.vendor && <span>Vendor: {item.vendor}</span>}
                    {item.productType && <span>• {item.productType}</span>}
                  </div>
                </td>

                {/* Flavor / Variant */}
                <td className="py-3.5 px-3">
                  <span className="text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-mono">
                    {item.variant_or_flavor || 'Default'}
                  </span>
                </td>

                {/* Price */}
                <td className="py-3.5 px-3 font-medium text-slate-900">
                  ${Number(item.price).toFixed(2)}
                </td>

                {/* Stock */}
                <td className="py-3.5 px-3">
                  <span
                    className={`inline-flex items-center text-xs font-semibold ${
                      item.inventoryQuantity > 0 ? 'text-slate-700' : 'text-rose-600'
                    }`}
                  >
                    {item.inventoryQuantity}
                  </span>
                </td>

                {/* Images */}
                <td className="py-3.5 px-3">
                  <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                    <ImageIcon className="h-3.5 w-3.5 text-slate-400" />
                    {item.images?.length || 0}
                  </span>
                </td>

                {/* Status */}
                <td className="py-3.5 px-3">
                  <Badge status={item.status} />
                  {item.errorMessages && item.errorMessages.length > 0 && (
                    <p className="text-[10px] text-rose-600 mt-1 max-w-[140px] truncate" title={item.errorMessages.join(', ')}>
                      {item.errorMessages[0]}
                    </p>
                  )}
                </td>

                {/* Actions */}
                <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                  <Link
                    href={`/products/${item.id}`}
                    className="inline-flex p-1.5 text-slate-500 hover:text-emerald-600 rounded hover:bg-slate-100"
                    title="View Product Details"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Link>

                  {item.shopify_product_url && (
                    <a
                      href={item.shopify_product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex p-1.5 text-slate-500 hover:text-emerald-600 rounded hover:bg-slate-100"
                      title="Open in Shopify Admin"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}

                  <button
                    onClick={() => onEditProduct(item)}
                    className="inline-flex p-1.5 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100"
                    title="Edit Product"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>

                  <button
                    onClick={() => onPushProduct(item)}
                    disabled={isPushing}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-slate-900 text-white hover:bg-emerald-600 disabled:opacity-40 transition-colors"
                  >
                    <ArrowUpRight className="h-3 w-3" />
                    Push
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
