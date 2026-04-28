-- Fix: Allow unauthenticated users to read groups by invite code
-- Problem: The SELECT policy on groups requires auth.uid() to be a member,
-- so unauthenticated users on /groups/join?code=XXX get "Group not found".
-- Solution: Add a policy allowing anon reads when invite_code is valid.

CREATE POLICY "Anyone can view groups with valid invite"
    ON groups FOR SELECT
    USING (
        is_active = true
        AND invite_code IS NOT NULL
        AND invite_expires_at > NOW()
    );
