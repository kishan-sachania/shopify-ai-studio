'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Store, ChevronDown, Check, Plus, Unlink, Loader2 } from 'lucide-react';
import { ConnectShopifyModal } from '@/components/settings/ConnectShopifyModal';

interface Connection {
  id: string;
  workspace_id: string;
  shop_domain: string;
  status: string;
  installed_at: string;
}

export function Header() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchConnections = async () => {
    try {
      const res = await fetch('/api/shopify/connections');
      const data = await res.json();
      const list: Connection[] = data.connections || [];
      setConnections(list);

      const saved = localStorage.getItem('active_workspace_id');
      if (saved && list.some((c) => c.workspace_id === saved)) {
        setActiveWorkspaceId(saved);
      } else if (list.length > 0) {
        setActiveWorkspaceId(list[0].workspace_id);
        localStorage.setItem('active_workspace_id', list[0].workspace_id);
      } else {
        setActiveWorkspaceId('');
        localStorage.removeItem('active_workspace_id');
      }
    } catch {
      setConnections([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectWorkspace = (workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
    localStorage.setItem('active_workspace_id', workspaceId);
    setIsDropdownOpen(false);
    window.dispatchEvent(new Event('workspace_changed'));
  };

  const handleDisconnect = async (workspaceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to disconnect this store?')) return;

    try {
      const res = await fetch(`/api/shopify/connections?workspaceId=${encodeURIComponent(workspaceId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchConnections();
        window.dispatchEvent(new Event('workspace_changed'));
      }
    } catch {
      alert('Failed to disconnect store');
    }
  };

  const activeConnection = connections.find((c) => c.workspace_id === activeWorkspaceId);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-lg shadow-xs">
                S
              </span>
              <div className="leading-tight">
                <span className="font-bold text-slate-900 tracking-tight block">Shopify AutoImporter</span>
                <span className="text-xs text-slate-500 block">Excel to GraphQL Automation</span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              <Link
                href="/"
                className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/extract"
                className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors"
              >
                Extract Excel
              </Link>
              <Link
                href="/products"
                className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors"
              >
                Products Catalog
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {isLoading ? (
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              </div>
            ) : connections.length === 0 ? (
              <button
                type="button"
                onClick={() => setIsConnectModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <Store className="h-3.5 w-3.5 text-emerald-600" />
                Connect Shopify
              </button>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <Store className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="max-w-[160px] truncate text-slate-900">
                    {activeConnection ? activeConnection.shop_domain.replace('.myshopify.com', '') : 'Select Store'}
                  </span>
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white py-1 shadow-lg z-50">
                    <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Connected Stores ({connections.length})
                      </span>
                    </div>

                    <div className="max-h-60 overflow-y-auto py-1">
                      {connections.map((c) => {
                        const isCurrent = c.workspace_id === activeWorkspaceId;
                        return (
                          <div
                            key={c.workspace_id}
                            onClick={() => handleSelectWorkspace(c.workspace_id)}
                            className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer hover:bg-slate-50 transition-colors ${
                              isCurrent ? 'bg-emerald-50/60 font-medium' : 'text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              {isCurrent ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              ) : (
                                <span className="h-3.5 w-3.5 shrink-0" />
                              )}
                              <div className="truncate">
                                <div className="truncate text-slate-900 font-medium">
                                  {c.shop_domain.replace('.myshopify.com', '')}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {c.shop_domain}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              title="Disconnect Store"
                              onClick={(e) => handleDisconnect(c.workspace_id, e)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors shrink-0"
                            >
                              <Unlink className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t border-slate-100 p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsDropdownOpen(false);
                          setIsConnectModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors font-medium"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Connect Another Store
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <ConnectShopifyModal
        isOpen={isConnectModalOpen}
        onClose={() => {
          setIsConnectModalOpen(false);
          fetchConnections();
        }}
      />
    </>
  );
}
