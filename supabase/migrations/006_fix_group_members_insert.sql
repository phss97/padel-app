-- Phase: Fix group_members INSERT — allow creator to add themselves
-- Problem: Group creation fails because INSERT into group_members only
-- allows joining via invite code. Newly created groups have no invite yet.
-- Solution: Add INSERT policy allowing group creator to add themselves.

DROP POLICY IF EXISTS "Group creators can add themselves" ON group_members;

CREATE POLICY "Group creators can add themselves"
    ON group_members FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM groups
            WHERE id = group_members.group_id
            AND created_by = auth.uid()
        )
    );
