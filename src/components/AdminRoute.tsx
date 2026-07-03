import { forwardRef, useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";

/**
 * Route-level admin guard component.
 * Defense-in-depth with direct server verification.
 */
export const AdminRoute = forwardRef<HTMLDivElement, { children?: React.ReactNode }>(
  ({ children }, ref) => {
    const { user, isAdmin, isLoading } = useAuth();
    const [verifying, setVerifying] = useState(true);
    const [hasAccess, setHasAccess] = useState(false);

    useEffect(() => {
      let cancelled = false;

      const verifyAdmin = async () => {
        if (!user) {
          setVerifying(false);
          setHasAccess(false);
          return;
        }

        // If auth context already says admin, trust it
        if (isAdmin) {
          console.log('AdminRoute: isAdmin from context is true');
          setHasAccess(true);
          setVerifying(false);
          return;
        }

        // Otherwise do a direct server check
        console.log('AdminRoute: checking admin role via RPC for user', user.id);
        try {
          const { data, error } = await supabase.rpc('has_role', {
            _user_id: user.id,
            _role: 'admin',
          });

          if (cancelled) return;

          if (error) {
            console.error('AdminRoute: RPC error', error);
            setHasAccess(false);
          } else {
            console.log('AdminRoute: RPC result', data);
            setHasAccess(data === true);
          }
        } catch (err) {
          console.error('AdminRoute: exception', err);
          if (!cancelled) setHasAccess(false);
        } finally {
          if (!cancelled) setVerifying(false);
        }
      };

      verifyAdmin();

      return () => {
        cancelled = true;
      };
    }, [user?.id, isAdmin]);

    // Show loading while auth is loading or we're verifying
    if (isLoading || verifying) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="sr-only">Verifying access...</span>
        </div>
      );
    }

    // Not authenticated - redirect to landing
    if (!user) {
      console.log('AdminRoute: no user, redirecting to landing');
      return <Navigate to="/landing" replace />;
    }

    // Not admin - redirect to home
    if (!hasAccess) {
      console.log('AdminRoute: no admin access, redirecting to /');
      return <Navigate to="/" replace />;
    }

    // Admin verified - render admin content
    console.log('AdminRoute: rendering admin content');
    return (
      <div ref={ref} className="contents">
        <AdminLayout>{children || <Outlet />}</AdminLayout>
      </div>
    );
  }
);

AdminRoute.displayName = "AdminRoute";
