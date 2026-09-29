/*
# Core Organization & Authentication Schema

## Purpose
Establishes the multi-tenant foundation for AI Business OS: organizations,
user profiles, organization membership with roles, and branches.

## New Tables
1. `profiles` — Extends auth.users with display info.
2. `organizations` — Top-level tenant entity. Each company is one row.
3. `org_members` — Joins users to organizations with a role (owner/admin/member/viewer).
4. `branches` — Physical or logical locations within an org.

## Security
- RLS enabled on all tables.
- `profiles`: users can read/update only their own profile.
- `organizations`: users can read orgs they are members of; only owners/admins can update.
- `org_members`: users can read memberships for orgs they belong to; only owners can manage members.
- `branches`: full CRUD scoped to org membership.

## Notes
- `org_members.role` drives authorization: owner > admin > member > viewer.
- All business tables in subsequent migrations will reference `organizations.id`
  and use org-membership-based RLS for tenant isolation.
- Tables are created BEFORE policies to avoid forward-reference errors.
*/

-- ===== TABLES (created first to avoid forward-reference issues) =====

-- profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

-- organizations
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry text DEFAULT 'General',
  currency text NOT NULL DEFAULT 'USD',
  timezone text DEFAULT 'UTC',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- org_members
CREATE TABLE IF NOT EXISTS org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member','viewer')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- branches
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  phone text,
  email text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ===== ENABLE RLS =====
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- ===== POLICIES (after all tables exist) =====

-- profiles
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- organizations
DROP POLICY IF EXISTS "select_orgs_as_member" ON organizations;
CREATE POLICY "select_orgs_as_member" ON organizations FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM org_members WHERE org_members.user_id = auth.uid() AND org_members.organization_id = organizations.id)
  );

DROP POLICY IF EXISTS "insert_org_as_owner" ON organizations;
CREATE POLICY "insert_org_as_owner" ON organizations FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_org_as_admin" ON organizations;
CREATE POLICY "update_org_as_admin" ON organizations FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM org_members WHERE org_members.user_id = auth.uid() AND org_members.organization_id = organizations.id AND org_members.role IN ('owner','admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM org_members WHERE org_members.user_id = auth.uid() AND org_members.organization_id = organizations.id AND org_members.role IN ('owner','admin'))
  );

-- org_members
DROP POLICY IF EXISTS "select_members_as_member" ON org_members;
CREATE POLICY "select_members_as_member" ON org_members FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM org_members om2 WHERE om2.user_id = auth.uid() AND om2.organization_id = org_members.organization_id)
  );

DROP POLICY IF EXISTS "insert_member_as_owner" ON org_members;
CREATE POLICY "insert_member_as_owner" ON org_members FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM org_members om2 WHERE om2.user_id = auth.uid() AND om2.organization_id = org_members.organization_id AND om2.role = 'owner')
  );

DROP POLICY IF EXISTS "update_member_as_owner" ON org_members;
CREATE POLICY "update_member_as_owner" ON org_members FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM org_members om2 WHERE om2.user_id = auth.uid() AND om2.organization_id = org_members.organization_id AND om2.role = 'owner')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM org_members om2 WHERE om2.user_id = auth.uid() AND om2.organization_id = org_members.organization_id AND om2.role = 'owner')
  );

DROP POLICY IF EXISTS "delete_member_as_owner" ON org_members;
CREATE POLICY "delete_member_as_owner" ON org_members FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM org_members om2 WHERE om2.user_id = auth.uid() AND om2.organization_id = org_members.organization_id AND om2.role = 'owner')
  );

-- branches
DROP POLICY IF EXISTS "select_branches" ON branches;
CREATE POLICY "select_branches" ON branches FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM org_members WHERE org_members.user_id = auth.uid() AND org_members.organization_id = branches.organization_id)
  );

DROP POLICY IF EXISTS "insert_branches" ON branches;
CREATE POLICY "insert_branches" ON branches FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM org_members WHERE org_members.user_id = auth.uid() AND org_members.organization_id = branches.organization_id AND org_members.role IN ('owner','admin','member'))
  );

DROP POLICY IF EXISTS "update_branches" ON branches;
CREATE POLICY "update_branches" ON branches FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM org_members WHERE org_members.user_id = auth.uid() AND org_members.organization_id = branches.organization_id AND org_members.role IN ('owner','admin','member'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM org_members WHERE org_members.user_id = auth.uid() AND org_members.organization_id = branches.organization_id AND org_members.role IN ('owner','admin','member'))
  );

DROP POLICY IF EXISTS "delete_branches" ON branches;
CREATE POLICY "delete_branches" ON branches FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM org_members WHERE org_members.user_id = auth.uid() AND org_members.organization_id = branches.organization_id AND org_members.role IN ('owner','admin'))
  );

-- ===== INDEXES =====
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON org_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_branches_org_id ON branches(organization_id);

-- ===== AUTO-CREATE PROFILE ON SIGNUP =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
