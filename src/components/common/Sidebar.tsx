'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Package,
  Store,
  ChevronDown,
  Check,
  Plus,
  Unlink,
  Loader2,
  Menu,
  X,
} from 'lucide-react';
import { ConnectShopifyModal } from '@/components/settings/ConnectShopifyModal';

interface Connection {
  id: string;
  workspace_id: string;
  shop_domain: string;
  status: string;
  installed_at: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
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

  const navItems = [
    {
      label: 'Dashboard',
      href: '/',
      icon: LayoutDashboard,
      isActive: pathname === '/',
    },
    {
      label: 'Extract Excel',
      href: '/extract',
      icon: FileSpreadsheet,
      isActive: pathname.startsWith('/extract'),
    },
    {
      label: 'Products Catalog',
      href: '/products',
      icon: Package,
      isActive: pathname.startsWith('/products'),
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white justify-between">
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-6 pt-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-xl shadow-xs">
            S
          </span>
          <div className="min-w-0">
            <span className="font-bold text-slate-900 tracking-tight block truncate text-base leading-tight">
              Shopify AutoImporter
            </span>
            <span className="text-xs text-slate-400 block truncate">
              Excel to GraphQL Suite
            </span>
          </div>
        </div>

        <div className="px-4">
          <div className="relative" ref={dropdownRef}>
            {isLoading ? (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400 rounded-lg border border-slate-200 bg-slate-50">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                <span>Checking stores...</span>
              </div>
            ) : connections.length === 0 ? (
              <button
                type="button"
                onClick={() => setIsConnectModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-2.5 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition"
              >
                <Store className="h-4 w-4 text-emerald-600" />
                Connect Shopify Store
              </button>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-left text-xs font-medium text-slate-800 hover:bg-slate-100 transition shadow-2xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    <Store className="h-4 w-4 shrink-0 text-emerald-600" />
                    <div className="truncate">
                      <span className="block truncate font-semibold text-slate-900">
                        {activeConnection ? activeConnection.shop_domain.replace('.myshopify.com', '') : 'Select Store'}
                      </span>
                      <span className="block truncate text-[10px] text-slate-400">
                        {activeConnection ? activeConnection.shop_domain : 'No store selected'}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 ml-1" />
                </button>

                {isDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-full rounded-xl border border-slate-200 bg-white py-1 shadow-lg z-50">
                    <div className="px-3 py-1.5 border-b border-slate-100">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Stores ({connections.length})
                      </span>
                    </div>

                    <div className="max-h-56 overflow-y-auto py-1">
                      {connections.map((c) => {
                        const isCurrent = c.workspace_id === activeWorkspaceId;
                        return (
                          <div
                            key={c.workspace_id}
                            onClick={() => handleSelectWorkspace(c.workspace_id)}
                            className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer hover:bg-slate-50 transition ${
                              isCurrent ? 'bg-emerald-50 text-emerald-800 font-medium' : 'text-slate-700'
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
                              className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition shrink-0"
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
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-emerald-700 hover:bg-emerald-50 rounded-lg transition font-medium"
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

        <nav className="space-y-1 px-3">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  item.isActive
                    ? 'bg-emerald-50 text-emerald-700 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    item.isActive ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-100">
        <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-medium text-slate-700">GraphQL Admin API</span>
          </div>
          <span className="text-[10px] text-slate-400">2024-10</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="md:hidden sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-base shadow-xs">
            S
          </span>
          <span className="font-bold text-slate-900 tracking-tight text-sm">
            Shopify AutoImporter
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setIsMobileOpen((prev) => !prev)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 transition"
          aria-label="Toggle navigation menu"
        >
          {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setIsMobileOpen(false)}
          />
          <div className="relative flex w-72 max-w-xs flex-col border-r border-slate-200 bg-white shadow-xl">
            <div className="absolute right-2 top-2">
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

      <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:fixed md:inset-y-0 border-r border-slate-200 bg-white z-30">
        {sidebarContent}
      </aside>

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
