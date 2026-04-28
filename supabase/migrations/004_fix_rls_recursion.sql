-- Phase: Fix infinite recursion in group_members RLS policies
-- Problem: The SELECT policy on group_members queries group_members itself,
-- causing PostgreSQL to re-check the SAME policy infinitely.
-- Solution: Create SECURITY DEFINER helper functions that bypass RLS.

-- =============================================
-- HELPER FUNCTION: Check membership (bypasses RLS)
-- =============================================
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = p_group_id AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- HELPER FUNCTION: Check admin status (bypasses RLS)
-- =============================================
CREATE OR REPLACE FUNCTION public.is_group_admin(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = p_group_id AND user_id = p_user_id AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- HELPER FUNCTION: Check valid invite (bypasses RLS)
-- =============================================
CREATE OR REPLACE FUNCTION public.group_has_valid_invite(p_group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.groups
        WHERE id = p_group_id
        AND invite_code IS NOT NULL
        AND invite_expires_at > NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- FIX: Drop and recreate group_members SELECT policy
-- =============================================
DROP POLICY IF EXISTS "Members can view group memberships" ON group_members;

CREATE POLICY "Members can view group memberships"
    ON group_members FOR SELECT
    USING (
        user_id = auth.uid()
        OR public.is_group_member(group_id, auth.uid())
        OR public.group_has_valid_invite(group_id)
    );

-- =============================================
-- FIX: Drop and recreate group_members UPDATE policy
-- =============================================
DROP POLICY IF EXISTS "Admins can update member roles" ON group_members;

CREATE POLICY "Admins can update member roles"
    ON group_members FOR UPDATE
    USING (
        public.is_group_admin(group_id, auth.uid())
    );

-- =============================================
-- FIX: Drop and recreate group_members DELETE policy
-- =============================================
DROP POLICY IF EXISTS "Admins can remove members, users can leave" ON group_members;

CREATE POLICY "Admins can remove members, users can leave"
    ON group_members FOR DELETE
    USING (
        user_id = auth.uid()
        OR public.is_group_admin(group_id, auth.uid())
    );
