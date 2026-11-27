'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthorized: boolean;
  unauthorizedReason: string | null;
  workspaceId: string | null;
  role: string | null;
  shopifyConnected: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isAuthorized: false,
  unauthorizedReason: null,
  workspaceId: null,
  role: null,
  shopifyConnected: false,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  refreshAuth: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [unauthorizedReason, setUnauthorizedReason] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [shopifyConnected, setShopifyConnected] = useState<boolean>(false);

  const resolveWorkspace = useCallback(async (currentUser: User) => {
    if (!currentUser.email) {
      setIsAuthorized(false);
      setUnauthorizedReason('No email associated with this Google account.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentUser.email,
          name: currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || '',
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.isAuthorized) {
        setIsAuthorized(false);
        setUnauthorizedReason(data.error || 'Access restricted for your account or organization.');
        setWorkspaceId(null);
        setRole(null);
        setShopifyConnected(false);
      } else {
        setIsAuthorized(true);
        setUnauthorizedReason(null);
        setWorkspaceId(data.workspaceId);
        setRole(data.role || 'member');
        setShopifyConnected(Boolean(data.shopifyConnected));

        if (typeof window !== 'undefined') {
          localStorage.setItem('active_workspace_id', data.workspaceId);
          window.dispatchEvent(new Event('workspace_changed'));
        }
      }
    } catch {
      setIsAuthorized(false);
      setUnauthorizedReason('Failed to verify workspace permissions.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    setIsLoading(true);
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    setUser(data.session?.user || null);

    if (data.session?.user) {
      await resolveWorkspace(data.session.user);
    } else {
      setIsAuthorized(false);
      setWorkspaceId(null);
      setRole(null);
      setIsLoading(false);
    }
  }, [resolveWorkspace]);

  useEffect(() => {
    refreshAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user || null);

      if (newSession?.user) {
        await resolveWorkspace(newSession.user);
      } else {
        setIsAuthorized(false);
        setWorkspaceId(null);
        setRole(null);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshAuth, resolveWorkspace]);

  const signInWithGoogle = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAuthorized(false);
    setWorkspaceId(null);
    setRole(null);
    setShopifyConnected(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('active_workspace_id');
      window.dispatchEvent(new Event('workspace_changed'));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthorized,
        unauthorizedReason,
        workspaceId,
        role,
        shopifyConnected,
        signInWithGoogle,
        signOut,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
