'use client';

import { Search, Filter, Trash2, ArrowUpRight } from 'lucide-react';
import { ProductPushStatus } from '@/types/product';

interface ProductFilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: ProductPushStatus | 'ALL';
  onStatusFilterChange: (status: ProductPushStatus | 'ALL') => void;
  selectedCount: number;
  totalFiltered: number;
  onPushSelected: () => void;
  onClearAll: () => void;
  isPushing: boolean;
}

export function ProductFilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  selectedCount,
  totalFiltered,
  onPushSelected,
  onClearAll,
  isPushing,
}: ProductFilterBarProps) {
  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-xl shadow-sm mb-4">
      {/* Search Bar */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by title, flavor, vendor, or tag..."
          className="w-full pl-9 pr-4 py-1.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto py-1">
        {(['ALL', 'READY', 'PUSHED', 'ERROR'] as const).map((st) => (
          <button
            key={st}
            onClick={() => onStatusFilterChange(st)}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              statusFilter === st
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {st === 'ALL' ? 'All' : st === 'READY' ? 'Ready' : st === 'PUSHED' ? 'Synced' : 'Failed'}
          </button>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onPushSelected}
          disabled={selectedCount === 0 || isPushing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-colors"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
          Push Selected ({selectedCount})
        </button>

        <button
          onClick={onClearAll}
          disabled={isPushing}
          title="Clear all stored products"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>
    </div>
  );
}
