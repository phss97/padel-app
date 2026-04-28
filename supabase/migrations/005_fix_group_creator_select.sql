-- Phase: Fix group creation RLS — allow creator to see their own group
-- Problem: INSERT with .select() fails because SELECT policy requires
-- membership in group_members, which doesn't exist yet at INSERT time.
-- Solution: Add OR created_by = auth.uid() to the groups SELECT policy.

-- =============================================
-- FIX: Allow group creator to view their own group
-- =============================================
DROP POLICY IF EXISTS "Active groups visible to members" ON groups;

CREATE POLICY "Active groups visible to members"
    ON groups FOR SELECT
    USING (
        is_active = true
        AND (
            created_by = auth.uid()  -- creator always sees their own group
            OR EXISTS (
                SELECT 1 FROM public.group_members
                WHERE group_id = groups.id AND user_id = auth.uid()
            )
        )
    );
