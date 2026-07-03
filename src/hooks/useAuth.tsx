import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Never allow the UI to hang forever on a loading spinner.
    // IMPORTANT: This should be long enough to not accidentally "log users out" on refresh
    // due to a slow cold-start/network hiccup.
    const bootTimeout = window.setTimeout(() => {
      if (!mounted) return;
      console.warn('Auth initialization timed out; showing UI without confirmed session.');
      setIsLoading(false);
    }, 10000);

    const finishLoading = () => {
      if (!mounted) return;
      window.clearTimeout(bootTimeout);
      setIsLoading(false);
    };

    const checkAdminRole = async (userId: string): Promise<{ isAdmin: boolean; timedOut: boolean }> => {
      try {
        // Never block app boot on role checks (network/RLS issues can hang).
        const rpcPromise = supabase.rpc('has_role', {
          _user_id: userId,
          _role: 'admin',
        });

        const timeoutPromise = new Promise<{ data: unknown; error: unknown }>((resolve) =>
          setTimeout(() => resolve({ data: false, error: new Error('Role check timeout') }), 3000)
        );

        const { data, error } = (await Promise.race([rpcPromise as any, timeoutPromise])) as any;

        if (error) {
          const timedOut = error instanceof Error && error.message === 'Role check timeout';
          console.warn('Admin role check failed:', error);
          return { isAdmin: false, timedOut };
        }

        return { isAdmin: data === true, timedOut: false };
      } catch (err) {
        console.warn('Admin role check threw:', err);
        return { isAdmin: false, timedOut: false };
      }
    };

    const updateAdminStatus = async (userId: string) => {
      // Retry once or twice if the first attempt times out (common on cold start / slow networks)
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const res = await checkAdminRole(userId);
        if (!mounted) return;

        setIsAdmin(res.isAdmin);
        if (res.isAdmin) return;

        // Only retry on timeouts; other failures should not loop.
        if (!res.timedOut) return;

        // Backoff: 400ms, 800ms, 1200ms
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }
    };

    // Set up auth state listener BEFORE checking for existing session
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      finishLoading();

      if (nextSession?.user) {
        // Fire-and-forget
        void updateAdminStatus(nextSession.user.id);
      } else {
        setIsAdmin(false);
      }
    });

    const initializeAuth = async () => {
      try {
        // Do NOT race getSession against a short timeout. If it resolves after the timeout,
        // we would permanently treat the user as logged out for this page load.
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.warn('getSession failed:', error);
        }

        if (!mounted) return;

        setSession(data?.session ?? null);
        setUser(data?.session?.user ?? null);
        finishLoading();

        if (data?.session?.user) {
          void updateAdminStatus(data.session.user.id);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('Failed to get session:', err);
        finishLoading();
      }
    };

    void initializeAuth();

    return () => {
      mounted = false;
      window.clearTimeout(bootTimeout);
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    // Log logout event before clearing session (fire-and-forget)
    supabase.functions.invoke('log-auth-event', {
      body: { action: 'USER_LOGOUT' },
    }).catch(() => {});

    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, isAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

let warnedMissingAuthProvider = false;

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Avoid crashing the UI if context gets temporarily unavailable (e.g. hot reload).
    if (!warnedMissingAuthProvider) {
      warnedMissingAuthProvider = true;
      console.warn('Auth context unavailable; rendering in logged-out mode.');
    }

    return {
      user: null,
      session: null,
      isLoading: false,
      isAdmin: false,
      signOut: async () => {},
    };
  }
  return context;
}