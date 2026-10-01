import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Organization, OrgMember, Profile } from '@/types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  organizations: Organization[];
  activeOrg: Organization | null;
  activeMembership: OrgMember | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  setActiveOrg: (org: Organization) => void;
  refreshOrgs: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Maps Supabase auth errors and network failures to user-friendly messages.
 * Distinguishes between network errors, validation errors, duplicate emails,
 * rate limits, and other authentication-specific failures.
 */
function mapAuthError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : String(err);

  // Network / connection errors — the "Failed to fetch" family
  if (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('network') ||
    message.includes('fetch failed')
  ) {
    return 'Unable to connect to the authentication service. Please check your internet connection and try again.';
  }

  // Duplicate email
  if (message.includes('already been registered') || message.includes('already registered') || message.includes('User already registered')) {
    return 'This email is already registered. Try signing in instead.';
  }

  // Invalid credentials
  if (message.includes('Invalid login credentials') || message.includes('invalid_credentials')) {
    return 'Incorrect email or password. Please try again.';
  }

  // Email not confirmed (if email confirmation is on)
  if (message.includes('Email not confirmed') || message.includes('email_not_confirmed')) {
    return 'Please confirm your email address before signing in.';
  }

  // Weak password
  if (message.includes('weak_password') || message.includes('Password is known to be weak')) {
    return 'This password is too common or has appeared in a data breach. Please choose a stronger password.';
  }

  // Rate limited
  if (message.includes('rate limit') || message.includes('too many') || message.includes('over_request_rate_limit')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  // Signup disabled
  if (message.includes('signup is disabled') || message.includes('Signups not allowed')) {
    return 'Account creation is currently disabled. Please contact your administrator.';
  }

  // Generic Supabase error with a usable message
  if (message.length > 0 && message.length < 200) {
    return message;
  }

  return fallback;
}

/** Validates email format client-side before hitting the network */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrg, setActiveOrgState] = useState<Organization | null>(null);
  const [activeMembership, setActiveMembership] = useState<OrgMember | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserData = useCallback(async (userId: string) => {
    try {
      const [profileRes, orgsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase
          .from('organizations')
          .select('*, org_members!inner(role, user_id, organization_id, id, created_at)')
          .filter('org_members.user_id', 'eq', userId),
      ]);

      if (profileRes.data) setProfile(profileRes.data as Profile);

      const orgs = (orgsRes.data || []) as unknown as (Organization & {
        org_members: { role: string; user_id: string; organization_id: string; id: string; created_at: string }[];
      })[];

      const mappedOrgs: Organization[] = orgs.map((o) => ({
        id: o.id,
        name: o.name,
        industry: o.industry,
        currency: o.currency,
        timezone: o.timezone,
        created_at: o.created_at,
        updated_at: o.updated_at,
      }));

      setOrganizations(mappedOrgs);

      const storedOrgId = localStorage.getItem('abos-active-org');
      const orgToActivate =
        mappedOrgs.find((o) => o.id === storedOrgId) || mappedOrgs[0] || null;

      if (orgToActivate) {
        setActiveOrgState(orgToActivate);
        localStorage.setItem('abos-active-org', orgToActivate.id);

        const membershipData = orgs.find((o) => o.id === orgToActivate.id)?.org_members[0];
        if (membershipData) {
          setActiveMembership({
            id: membershipData.id,
            organization_id: membershipData.organization_id,
            user_id: membershipData.user_id,
            role: membershipData.role as OrgMember['role'],
            created_at: membershipData.created_at,
          });
        }
      }
    } catch (err) {
      console.error('Failed to load user data:', err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!mounted) return;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        loadUserData(initialSession.user.id).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    }).catch((err) => {
      console.error('getSession error:', err);
      if (mounted) setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      (async () => {
        if (!mounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          await loadUserData(newSession.user.id);
        } else {
          setProfile(null);
          setOrganizations([]);
          setActiveOrgState(null);
          setActiveMembership(null);
          localStorage.removeItem('abos-active-org');
        }
        setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [loadUserData]);

  const signUp = async (email: string, password: string, fullName: string) => {
    // Client-side validation
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = fullName.trim();

    if (!trimmedName) {
      return { error: 'Please enter your full name.' };
    }
    if (!isValidEmail(trimmedEmail)) {
      return { error: 'Please enter a valid email address.' };
    }
    if (password.length < 6) {
      return { error: 'Password must be at least 6 characters long.' };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { data: { full_name: trimmedName } },
      });

      if (error) {
        return { error: mapAuthError(error, 'Account creation failed. Please try again.') };
      }

      if (!data.user) {
        return { error: 'Account creation failed — no user returned. Please try again.' };
      }

      // Create the organization and owner membership atomically via a
      // SECURITY DEFINER function. This bypasses the chicken-and-egg RLS
      // problem: the organizations SELECT policy requires membership, but
      // the member row can't be created without the org ID, and the org
      // ID can't be returned via .select() because membership doesn't exist yet.
      // The RPC function handles both inserts internally with RLS bypassed.
      const orgName = `${trimmedName}'s Organization`;
      const { error: createError } = await supabase.rpc('create_org_for_user', {
        p_org_name: orgName,
        p_industry: 'General',
      });

      if (createError) {
        console.error('create_org_for_user error:', createError.message);
        // Auth account was created successfully but org setup failed —
        // non-fatal. User can sign in and we retry org creation.
        return { error: null };
      }

      await loadUserData(data.user.id);
      return { error: null };
    } catch (err) {
      console.error('signUp exception:', err);
      return { error: mapAuthError(err, 'Account creation failed. Please try again.') };
    }
  };

  const signIn = async (email: string, password: string) => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!isValidEmail(trimmedEmail)) {
      return { error: 'Please enter a valid email address.' };
    }
    if (!password) {
      return { error: 'Please enter your password.' };
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        return { error: mapAuthError(error, 'Sign in failed. Please check your email and password.') };
      }

      return { error: null };
    } catch (err) {
      console.error('signIn exception:', err);
      return { error: mapAuthError(err, 'Unable to sign in. Please try again.') };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('signOut error:', err);
    }
    setProfile(null);
    setOrganizations([]);
    setActiveOrgState(null);
    setActiveMembership(null);
    localStorage.removeItem('abos-active-org');
  };

  const setActiveOrg = (org: Organization) => {
    setActiveOrgState(org);
    localStorage.setItem('abos-active-org', org.id);
  };

  const refreshOrgs = async () => {
    if (user) await loadUserData(user.id);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        organizations,
        activeOrg,
        activeMembership,
        loading,
        signUp,
        signIn,
        signOut,
        setActiveOrg,
        refreshOrgs,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
