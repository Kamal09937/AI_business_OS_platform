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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrg, setActiveOrgState] = useState<Organization | null>(null);
  const [activeMembership, setActiveMembership] = useState<OrgMember | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserData = useCallback(async (userId: string) => {
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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { error: error.message };
    if (data.user) {
      const orgName = `${fullName || 'My'}'s Organization`;
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: orgName, industry: 'General' })
        .select()
        .single();
      if (orgError) return { error: orgError.message };

      const { error: memberError } = await supabase
        .from('org_members')
        .insert({
          organization_id: orgData.id,
          user_id: data.user.id,
          role: 'owner',
        });
      if (memberError) return { error: memberError.message };

      await loadUserData(data.user.id);
    }
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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
