-- Fix: Allow unauthenticated users to read groups by invite code
-- Problem: The SELECT policy on groups requires auth.uid() to be a member,
-- so unauthenticated users on /groups/join?code=XXX get "Group not found".
-- Solution: Add policies allowing anon reads when invite_code is valid.

CREATE POLICY "Anyone can view groups with valid invite"
    ON groups FOR SELECT
    USING (
        is_active = true
        AND invite_code IS NOT NULL
        AND invite_expires_at > NOW()
    );

CREATE POLICY "Anyone can view venues for groups with valid invite"
    ON venues FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = venues.group_id
            AND groups.invite_code IS NOT NULL
            AND groups.invite_expires_at > NOW()
        )
    );
