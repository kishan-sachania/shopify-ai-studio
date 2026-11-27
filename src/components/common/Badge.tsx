import { ProductPushStatus } from '@/types/product';

interface BadgeProps {
  status: ProductPushStatus;
}

export function Badge({ status }: BadgeProps) {
  switch (status) {
    case 'PUSHED':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
          Synced
        </span>
      );
    case 'NEEDS_UPDATE':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
          Needs Update
        </span>
      );
    case 'READY':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
          Ready
        </span>
      );
    case 'PUSHING':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
          Pushing...
        </span>
      );
    case 'ERROR':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200">
          Failed
        </span>
      );
    case 'DRAFT':
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
          Draft
        </span>
      );
  }
}
