-- Fix: Allow unauthenticated users to read groups by invite code
-- Problem: The SELECT policy on groups requires auth.uid() to be a member,
-- so unauthenticated users on /groups/join?code=XXX get "Group not found".
-- Solution: Add policies allowing anon reads when invite_code is valid.
-- Also add permanent_invite_code for never-expiring invite links.

-- Add permanent_invite_code column
ALTER TABLE groups ADD COLUMN IF NOT EXISTS permanent_invite_code TEXT;

-- Backfill existing groups with a permanent code
UPDATE groups
SET permanent_invite_code = SUBSTRING(MD5(RANDOM()::TEXT), 1, 8)
WHERE permanent_invite_code IS NULL;

-- Temporary invite: anyone can view groups with valid invite code
DROP POLICY IF EXISTS "Anyone can view groups with valid invite" ON groups;
CREATE POLICY "Anyone can view groups with valid invite"
    ON groups FOR SELECT
    USING (
        is_active = true
        AND invite_code IS NOT NULL
        AND invite_expires_at > NOW()
    );

-- Permanent invite: anyone can view groups with permanent invite code
DROP POLICY IF EXISTS "Anyone can view groups with permanent invite" ON groups;
CREATE POLICY "Anyone can view groups with permanent invite"
    ON groups FOR SELECT
    USING (
        is_active = true
        AND permanent_invite_code IS NOT NULL
    );

-- Temporary invite: venues for groups with valid invite
DROP POLICY IF EXISTS "Anyone can view venues for groups with valid invite" ON venues;
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

-- Permanent invite: venues for groups with permanent invite
DROP POLICY IF EXISTS "Anyone can view venues for groups with permanent invite" ON venues;
CREATE POLICY "Anyone can view venues for groups with permanent invite"
    ON venues FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = venues.group_id
            AND groups.permanent_invite_code IS NOT NULL
        )
    );
