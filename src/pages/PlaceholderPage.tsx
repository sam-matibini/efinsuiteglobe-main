import { useLocation } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PlaceholderPage() {
  const location = useLocation();
  
  // Extract page name from path
  const pathParts = location.pathname.split('/').filter(Boolean);
  const pageName = pathParts.map(part => 
    part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' ')
  ).join(' > ');

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="p-12 text-center max-w-lg">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-accent/10 mb-6">
          <Construction className="w-10 h-10 text-accent" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">{pageName}</h1>
        <p className="text-muted-foreground mb-6">
          This module is coming soon. We're working hard to bring you a complete accounting solution.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" onClick={() => window.history.back()}>
            Go Back
          </Button>
          <Button 
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
            onClick={() => window.location.href = '/'}
          >
            Return to Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
}
