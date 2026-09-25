import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

// The CoA Generator is now part of the organization settings page.
// This page redirects users to the settings page.
export default function AccountGenerator() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to settings page with the CoA Generator tab
    navigate('/settings', { replace: true });
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      <p className="text-muted-foreground">Redirecting to settings...</p>
    </div>
  );
}
