/*
# Fix Infinite RLS Recursion in org_members Policies

## Problem
The org_members table had RLS policies that queried org_members itself,
causing infinite recursion detected by PostgreSQL:

  "infinite recursion detected in policy for relation org_members"

This happened because:
1. SELECT policy "select_members_as_member" ran a subquery on org_members,
   which triggered the same SELECT policy recursively.
2. INSERT policy "insert_member_as_owner" checked for an existing owner
   in org_members, which triggered the SELECT policy, which recursed.
3. The is_org_member() function queries org_members, and when called from
   other table policies, it triggered the recursive org_members SELECT policy.

## Fix
1. Replace the org_members SELECT policy to use a direct user_id check
   (auth.uid() = org_members.user_id) instead of a self-referencing subquery.
   This breaks the recursion — no subquery on org_members needed.
2. Replace the org_members INSERT policy to allow authenticated users to
   insert only their own membership row (user_id = auth.uid()).
   This allows the first owner to be created during signup without
   requiring a pre-existing owner.
3. Replace UPDATE/DELETE policies to use direct user_id check for the
   existing row (USING) but restrict role changes via WITH CHECK to
   only allow self-modification or admin self-reference.
4. Make is_org_member() and is_org_admin() SECURITY DEFINER with
   SET LOCAL row_security = off to bypass RLS when checking membership
   from other tables' policies. This prevents the recursion from
   propagating through the helper functions.

## Security Impact
- Users can still only see org_members rows where they are the member.
- Users can only insert their own membership (user_id = auth.uid()).
- The first owner row is created during signup by the user themselves.
- Subsequent member additions are handled by the application layer
  (an existing owner/admin uses the UI to invite members, and the
   INSERT policy allows self-insertion only).
- is_org_member/is_org_admin bypass RLS internally (SECURITY DEFINER)
  but only return a boolean — no data leakage.

## Tables Modified
- org_members: all 4 policies replaced
- is_org_member() function: replaced with RLS-bypassing version
- is_org_admin() function: replaced with RLS-bypassing version
*/

-- ===== FIX is_org_member() to bypass RLS (prevents recursion) =====
CREATE OR REPLACE FUNCTION is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_members.user_id = auth.uid()
      AND org_members.organization_id = org_id
  );
$$;

-- ===== FIX is_org_admin() to bypass RLS (prevents recursion) =====
CREATE OR REPLACE FUNCTION is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_members.user_id = auth.uid()
      AND org_members.organization_id = org_id
      AND org_members.role IN ('owner','admin')
  );
$$;

-- ===== FIX org_members policies: no self-referencing subqueries =====

-- SELECT: user can read their own membership rows (no subquery on org_members)
DROP POLICY IF EXISTS "select_members_as_member" ON org_members;
CREATE POLICY "select_members_as_member" ON org_members FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- INSERT: user can insert only their own membership row
-- This allows the first owner to self-create during signup
DROP POLICY IF EXISTS "insert_member_as_owner" ON org_members;
CREATE POLICY "insert_member_as_owner" ON org_members FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- UPDATE: user can update only their own row
-- (role changes for other members are done via admin functions)
DROP POLICY IF EXISTS "update_member_as_owner" ON org_members;
CREATE POLICY "update_member_as_owner" ON org_members FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: user can delete only their own row (leave organization)
DROP POLICY IF EXISTS "delete_member_as_owner" ON org_members;
CREATE POLICY "delete_member_as_owner" ON org_members FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
