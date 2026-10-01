/*
# Create atomic org + membership function

## Problem
During signup, the frontend needs to:
1. INSERT a row into `organizations`
2. INSERT a row into `org_members` (linking the new user as owner)

Step 1 fails when using `.select()` because PostgREST runs a SELECT
after INSERT, and the organizations SELECT RLS policy checks
`is_org_member()` — which returns false because the member row doesn't
exist yet. This is a chicken-and-egg RLS problem.

Step 2 requires the org ID from step 1, but the org ID can't be returned
via `.select()` for the same reason.

## Fix
Create a SECURITY DEFINER function `create_org_for_user` that:
1. Inserts a new organization row
2. Inserts an org_members row with role='owner' for the calling user
3. Returns the organization ID

The function runs with elevated privileges (SECURITY DEFINER) so it
bypasses RLS for both inserts. It only accepts the org name and industry
as parameters — the user_id is taken from auth.uid() so a user can only
create an org for themselves.

## Security
- SECURITY DEFINER: runs as the function owner (postgres), bypassing RLS
- Only creates membership for the calling user (auth.uid())
- Only sets role to 'owner' (the first user of a new org)
- SET search_path = public to prevent search_path injection
- No user-controlled data beyond name/industry strings
*/
CREATE OR REPLACE FUNCTION create_org_for_user(p_org_name text, p_industry text DEFAULT 'General')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Insert the organization
  INSERT INTO organizations (name, industry)
  VALUES (p_org_name, p_industry)
  RETURNING id INTO v_org_id;

  -- Insert the owner membership
  INSERT INTO org_members (organization_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'owner');

  RETURN v_org_id;
END;
$$;

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION create_org_for_user(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_org_for_user(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION create_org_for_user(text, text) TO authenticated;
