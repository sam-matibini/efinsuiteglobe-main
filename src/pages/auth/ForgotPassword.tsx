import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import efinsuiteLogo from '@/assets/efinsuite-logo.png';
import { BackToHomeLink } from '@/components/auth/BackToHomeLink';

export default function ForgotPassword() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setIsSuccess(true);
      toast({
        title: 'Reset link sent',
        description: 'Check your email for a link to reset your password.',
      });
    } catch (error: any) {
      toast({
        title: 'Request failed',
        description: error.message || 'Unable to send reset link. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="relative min-h-screen flex items-start md:items-center justify-center bg-background p-4 py-10 md:py-4 overflow-x-hidden">
        <BackToHomeLink />
        <div 
          className="absolute inset-0 opacity-50"
          style={{ background: 'var(--gradient-hero)' }}
        />
        <Card className="relative w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <Link to="/landing" className="inline-flex items-center justify-center gap-2 mb-4">
              <img src={efinsuiteLogo} alt="efinsuite Globe" className="w-10 h-10 object-contain" />
              <span className="text-xl font-bold text-foreground">efinsuite Globe</span>
            </Link>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription>
              We've sent a password reset link to <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            <p>
              Click the link in the email to reset your password. 
              If you don't see the email, check your spam folder.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setIsSuccess(false)}
            >
              <Mail className="mr-2 h-4 w-4" />
              Try different email
            </Button>
            <Link to="/login" className="text-sm text-accent hover:underline">
              Back to sign in
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-start md:items-center justify-center bg-background p-4 py-10 md:py-4 overflow-x-hidden">
      <BackToHomeLink />
      <div 
        className="absolute inset-0 opacity-50"
        style={{ background: 'var(--gradient-hero)' }}
      />
      <Card className="relative w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <Link to="/landing" className="inline-flex items-center justify-center gap-2 mb-4">
            <img src={efinsuiteLogo} alt="efinsuite Globe" className="w-10 h-10 object-contain" />
            <span className="text-xl font-bold text-foreground">efinsuite Globe</span>
          </Link>
          <CardTitle className="text-2xl">Forgot password?</CardTitle>
          <CardDescription>
            Enter your email address and we'll send you a link to reset your password
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending reset link...
                </>
              ) : (
                'Send reset link'
              )}
            </Button>
            <Link 
              to="/login" 
              className="inline-flex items-center text-sm text-accent hover:underline"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to sign in
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
