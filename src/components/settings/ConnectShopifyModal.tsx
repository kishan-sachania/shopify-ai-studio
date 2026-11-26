'use client';

import { useState } from 'react';
import { Store, ArrowRight, X } from 'lucide-react';

interface ConnectShopifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultWorkspaceId?: string;
  onConnected?: () => void;
}

export function ConnectShopifyModal({ isOpen, onClose, defaultWorkspaceId }: ConnectShopifyModalProps) {
  const [domain, setDomain] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleaned = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!cleaned) {
      setError('Please enter your Shopify store domain');
      return;
    }

    const shopDomain = cleaned.includes('.') ? cleaned : `${cleaned}.myshopify.com`;
    const cleanStoreSlug = shopDomain.replace('.myshopify.com', '').replace(/[^a-z0-9_-]/g, '-');
    const targetWorkspaceId = defaultWorkspaceId || `ws-${cleanStoreSlug}-${Date.now().toString(36)}`;

    window.location.href = `/api/shopify/oauth/authorize?workspaceId=${encodeURIComponent(targetWorkspaceId)}&shop=${encodeURIComponent(shopDomain)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Connect Shopify Store</h3>
            <p className="text-xs text-slate-500">Connect a store to sync and manage products</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Store Domain
            </label>
            <input
              type="text"
              placeholder="brand-name.myshopify.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
            {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition-colors shadow-xs"
            >
              Connect Store
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
