import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function BackToHomeLink({ className = '' }: { className?: string }) {
  return (
    <Link
      to="/landing"
      className={
        'absolute top-4 left-4 z-10 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors ' +
        className
      }
    >
      <ArrowLeft className="w-4 h-4" />
      Back to home
    </Link>
  );
}
