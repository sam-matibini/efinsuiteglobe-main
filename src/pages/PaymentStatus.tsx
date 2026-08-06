import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useSquarePaymentStatus } from '@/hooks/useSquarePaymentStatus';

const Confetti = () => {
  const pieces = Array.from({ length: 40 });
  const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899'];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.6;
        const duration = 2.5 + Math.random() * 1.8;
        const color = colors[i % colors.length];
        const size = 6 + Math.random() * 6;
        const rotate = Math.random() * 360;
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: '-10px',
              left: `${left}%`,
              width: size,
              height: size * 0.4,
              background: color,
              transform: `rotate(${rotate}deg)`,
              animation: `payment-status-confetti-fall ${duration}s ${delay}s ease-in forwards`,
              borderRadius: 1,
              opacity: 0.9,
            }}
          />
        );
      })}
      <style>{`
        @keyframes payment-status-confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

interface PaymentStatusProps {
  /** Optional link rendered as a "Back to invoices" action. Pass null to hide it. */
  backTo?: string | null;
}

export default function PaymentStatus({ backTo = '/sales/invoices' }: PaymentStatusProps) {
  const { linkId } = useParams<{ linkId: string }>();
  const { status, result, verifying, done, retry } = useSquarePaymentStatus(linkId);

  const backAction = backTo ? (
    <Button variant="outline" asChild className="w-full">
      <Link to={backTo}>Back to invoices</Link>
    </Button>
  ) : null;

  if (status === 'paid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 relative overflow-hidden">
        <Confetti />
        <Card className="w-full max-w-md relative z-10 shadow-xl border-green-200/50">
          <CardHeader className="text-center pb-2">
            <div className="relative mx-auto mb-3">
              <div className="absolute inset-0 rounded-full bg-green-500/20 blur-xl animate-pulse" />
              <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto relative animate-in zoom-in duration-500" />
            </div>
            <CardTitle className="text-2xl">Payment successful</CardTitle>
            {result?.amount != null && (
              <p className="text-3xl font-bold mt-3 text-foreground">
                {Number(result.amount).toFixed(2)} {result.currency}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              Your payment was confirmed and your invoice has been updated.
            </p>
            {backAction}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Loader2 className="h-12 w-12 text-primary mx-auto mb-2 animate-spin" />
            <CardTitle className="text-xl">Verifying your payment…</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            <p>Please wait a moment while we confirm the payment with Square.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'cancelled') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-14 w-14 text-amber-500 mx-auto mb-2" />
            <CardTitle className="text-xl">Payment was not completed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-center text-sm text-muted-foreground">
            <p>Your payment was cancelled or abandoned. No money has been charged.</p>
            <Button variant="outline" onClick={retry} className="w-full">
              <RefreshCw className="h-4 w-4 mr-1" /> Check again
            </Button>
            {backAction}
          </CardContent>
        </Card>
      </div>
    );
  }

  const unknown = status === 'unknown' || (status === 'pending' && done && !result?.error);
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {unknown ? (
            <AlertTriangle className="h-14 w-14 text-amber-500 mx-auto mb-2" />
          ) : (
            <Loader2 className="h-14 w-14 text-primary mx-auto mb-2 animate-spin" />
          )}
          <CardTitle className="text-xl">
            {unknown ? 'We could not confirm your payment' : 'Payment still processing'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-center text-sm text-muted-foreground">
          <p>
            {unknown
              ? result?.error || 'Please check again in a moment. No payment will be recorded until Square confirms it.'
              : 'Square is still processing your payment. Please check again in a moment.'}
          </p>
          <Button variant="outline" onClick={retry} className="w-full">
            <RefreshCw className="h-4 w-4 mr-1" /> Check again
          </Button>
          {backAction}
        </CardContent>
      </Card>
    </div>
  );
}
