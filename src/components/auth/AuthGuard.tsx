'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ShieldAlert, LogOut, RefreshCw, Loader2, Lock } from 'lucide-react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isLoading, isAuthorized, unauthorizedReason, signInWithGoogle, signOut, refreshAuth } = useAuth();

  if (pathname === '/auth/callback') {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mb-4" />
        <p className="text-sm font-medium text-slate-600">Verifying workspace authorization...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-8 space-y-6 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white font-bold text-2xl shadow-md mx-auto">
            S
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Shopify Automation Suite
            </h1>
            <p className="text-sm text-slate-500">
              Sign in with your authorized Google account to access your store workspaces.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-xs text-slate-500 flex items-start gap-2 text-left">
            <Lock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
            <span>
              Restricted workspace. Only users with permitted email domains or listed organization credentials can sign in.
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-rose-200 shadow-xl p-8 space-y-6 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 mx-auto">
            <ShieldAlert className="h-6 w-6" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Access Restricted
            </h1>
            <p className="text-xs text-slate-600 bg-slate-100 py-1.5 px-3 rounded-lg font-mono inline-block">
              {user.email}
            </p>
            <p className="text-sm text-slate-500 leading-relaxed">
              {unauthorizedReason || 'Your Google account is not permitted to access this workspace.'}
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={signOut}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-slate-800 transition cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Sign Out / Switch Account
            </button>
            <button
              type="button"
              onClick={refreshAuth}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Re-check Authorization
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
