import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle, UserPlus, LogIn, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import logo from '@/assets/efinsuite-logo.png';

type InviteStatus = 'loading' | 'valid' | 'invalid' | 'expired' | 'accepted' | 'already_member' | 'success';

interface InvitationDetails {
  id: string;
  organization_id: string;
  organization_name: string;
  email: string;
  role: string;
  expires_at: string;
}

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<InviteStatus>('loading');
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  // Password creation form
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successOrgName, setSuccessOrgName] = useState('');

  // For existing users who want to sign in instead
  const [showSignIn, setShowSignIn] = useState(false);
  const [signInPassword, setSignInPassword] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }
    validateInvitation();
    checkAuthStatus();
  }, [token]);

  // Re-check auth after invitation is loaded (to handle email mismatch auto-signout)
  useEffect(() => {
    if (invitation) {
      checkAuthStatus();
    }
  }, [invitation]);

  const checkAuthStatus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      // If invitation is loaded and emails don't match, auto sign out
      if (invitation && session.user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
        await supabase.auth.signOut();
        setIsAuthenticated(false);
        setCurrentUserEmail(null);
        return;
      }
      setIsAuthenticated(true);
      setCurrentUserEmail(session.user.email || null);
    }
  };

  const validateInvitation = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_invitation_by_token', { p_token: token });

      if (error) {
        console.error('Invitation lookup error:', error);
        setStatus('invalid');
        return;
      }

      const inviteData = Array.isArray(data) ? data[0] : data;

      if (!inviteData) {
        setStatus('invalid');
        return;
      }

      if (inviteData.status === 'accepted') {
        setStatus('accepted');
        return;
      }

      if (inviteData.status === 'cancelled') {
        setStatus('invalid');
        return;
      }

      if (new Date(inviteData.expires_at) < new Date()) {
        setStatus('expired');
        return;
      }

      setInvitation({
        id: inviteData.id,
        organization_id: inviteData.organization_id,
        organization_name: inviteData.organization_name || 'Unknown Organization',
        email: inviteData.email,
        role: inviteData.role,
        expires_at: inviteData.expires_at,
      });
      setStatus('valid');
    } catch (err) {
      console.error('Error validating invitation:', err);
      setStatus('invalid');
    }
  };

  const handleAcceptWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation || !token) return;

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      // Call edge function that creates/updates user, adds membership, marks invitation accepted
      const { data: fnData, error: fnError } = await supabase.functions.invoke('accept-invitation', {
        body: { token, password, full_name: fullName || undefined },
      });

      if (fnError) throw new Error(fnError.message || 'Failed to accept invitation');
      if (fnData?.error) throw new Error(fnData.error);

      // Sign in with the credentials just created
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invitation.email,
        password,
      });

      if (signInError) {
        // Account was created but auto-sign-in failed – let user sign in manually
        toast.success('Account created! Please sign in with your new password.');
        setSuccessOrgName(fnData?.organization_name || invitation.organization_name);
        setStatus('success');
        return;
      }

      // Invalidate and redirect
      await queryClient.invalidateQueries({ queryKey: ['organizations'] });
      localStorage.setItem('current_organization_id', fnData?.organization_id || invitation.organization_id);

      toast.success(`Welcome to ${fnData?.organization_name || invitation.organization_name}!`);
      setTimeout(() => navigate('/'), 1500);
    } catch (err: any) {
      console.error('Accept invitation error:', err);
      toast.error(err.message || 'Failed to accept invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation) return;

    setIsSigningIn(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: invitation.email,
        password: signInPassword,
      });

      if (error) throw error;

      setIsAuthenticated(true);
      setCurrentUserEmail(invitation.email);
      setShowSignIn(false);
      toast.success('Signed in! You can now accept the invitation.');
    } catch (err: any) {
      toast.error(err.message || 'Sign in failed');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!invitation || !token) return;

    setIsAccepting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to accept this invitation');
        return;
      }

      if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
        toast.error(`This invitation was sent to ${invitation.email}. Please log in with that email address.`);
        return;
      }

      // Use edge function (service role) to bypass RLS
      const { data: fnData, error: fnError } = await supabase.functions.invoke('accept-invitation', {
        body: { token, password: 'existing-user', full_name: undefined },
      });

      if (fnError) throw new Error(fnError.message || 'Failed to accept invitation');
      if (fnData?.error) throw new Error(fnData.error);

      await queryClient.invalidateQueries({ queryKey: ['organizations'] });
      localStorage.setItem('current_organization_id', fnData?.organization_id || invitation.organization_id);

      toast.success(`Successfully joined ${fnData?.organization_name || invitation.organization_name}!`);
      setTimeout(() => navigate('/'), 1500);
    } catch (err: any) {
      console.error('Error accepting invitation:', err);
      toast.error(err.message || 'Failed to accept invitation');
    } finally {
      setIsAccepting(false);
    }
  };

  const getRoleLabel = (role: string) => {
    const roles: Record<string, string> = {
      owner: 'Owner',
      admin: 'Admin',
      finance_manager: 'Finance Manager',
      accountant: 'Accountant',
      payroll_officer: 'Payroll Officer',
      auditor: 'Auditor (Read-only)',
      member: 'Member',
    };
    return roles[role] || role;
  };

  // Loading
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
            <p className="text-muted-foreground">Validating invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success (account created, sign-in failed – manual login needed)
  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle>Account Created!</CardTitle>
            <CardDescription>
              You've joined <strong>{successOrgName}</strong>. Sign in with your new password to get started.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate('/login')}>Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid / Expired
  if (status === 'invalid' || status === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>{status === 'expired' ? 'Invitation Expired' : 'Invalid Invitation'}</CardTitle>
            <CardDescription>
              {status === 'expired'
                ? 'This invitation has expired. Please ask the organization admin to send a new one.'
                : 'This invitation link is invalid or has been cancelled.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link to="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already accepted / already a member
  if (status === 'accepted' || status === 'already_member') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle>{status === 'already_member' ? 'Already a Member' : 'Invitation Accepted'}</CardTitle>
            <CardDescription>
              {status === 'already_member'
                ? 'You are already a member of this organization.'
                : 'This invitation has already been accepted.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate('/')}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Valid invitation – main flow
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={logo} alt="efinsuite Globe" className="w-16 h-16 mx-auto mb-4" />
          <CardTitle className="text-2xl">You're Invited!</CardTitle>
          <CardDescription>
            Join <strong>{invitation?.organization_name}</strong> as {getRoleLabel(invitation?.role || 'member')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Invitation sent to</p>
            <p className="font-medium">{invitation?.email}</p>
          </div>

          {isAuthenticated ? (
            /* Already logged in – just accept */
            <div className="space-y-4">
              {currentUserEmail?.toLowerCase() === invitation?.email.toLowerCase() ? (
                <Button
                  onClick={handleAcceptInvitation}
                  disabled={isAccepting}
                  className="w-full"
                  size="lg"
                >
                  {isAccepting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Accepting...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Accept Invitation
                    </>
                  )}
                </Button>
              ) : (
                <div className="text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
                  <p className="text-sm text-muted-foreground">Switching to the correct account...</p>
                </div>
              )}
            </div>
          ) : showSignIn ? (
            /* Existing user sign-in */
            <form onSubmit={handleSignIn} className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Sign in to <strong>{invitation?.email}</strong> to accept this invitation.
              </p>
              <div className="space-y-2">
                <Label htmlFor="signInEmail">Email</Label>
                <Input id="signInEmail" type="email" value={invitation?.email} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signInPassword">Password</Label>
                <Input
                  id="signInPassword"
                  type="password"
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>
              <Button type="submit" disabled={isSigningIn} className="w-full" size="lg">
                {isSigningIn ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing In...</>
                ) : (
                  <><LogIn className="mr-2 h-4 w-4" />Sign In</>
                )}
              </Button>
              <Button type="button" variant="link" onClick={() => setShowSignIn(false)} className="w-full">
                ← Back to create account
              </Button>
            </form>
          ) : (
            /* Default: create password form */
            <form onSubmit={handleAcceptWithPassword} className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Create a password for your account to join the organization.
              </p>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={invitation?.email} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password (min 8 characters)"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-sm text-destructive">Passwords do not match</p>
                )}
              </div>
              <Button
                type="submit"
                disabled={isSubmitting || password !== confirmPassword || password.length < 8}
                className="w-full"
                size="lg"
              >
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating Account & Joining...</>
                ) : (
                  <><UserPlus className="mr-2 h-4 w-4" />Create Account & Join</>
                )}
              </Button>
              <Button type="button" variant="link" onClick={() => setShowSignIn(true)} className="w-full">
                Already have an account? Sign in
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
