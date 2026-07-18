import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function BackToHomeLink({ className = '' }: { className?: string }) {
  return (
    <Link
      to="/landing"
      className={
        'fixed top-4 left-4 z-20 inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/80 backdrop-blur px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors shadow-sm ' +
        className
      }
    >
      <ArrowLeft className="w-4 h-4" />
      Back to home
    </Link>
  );
}
