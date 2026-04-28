-- Phase 1 Part 2: Row Level Security Policies
-- Run this after 001_init_schema.sql

-- =============================================
-- ENABLE RLS
-- =============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_payments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PROFILES
-- =============================================
-- Users can view any profile (they need names/avatars)
CREATE POLICY "Profiles are viewable by everyone"
    ON profiles FOR SELECT
    USING (true);

-- Users can update only their own profile
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Delete handled by cascade on auth.users

-- =============================================
-- GROUPS
-- =============================================
-- Anyone in the group can view active groups
CREATE POLICY "Active groups visible to members"
    ON groups FOR SELECT
    USING (
        is_active = true
        AND EXISTS (
            SELECT 1 FROM group_members
            WHERE group_id = groups.id AND user_id = auth.uid()
        )
    );

-- Admins can update their groups
CREATE POLICY "Admins can update group"
    ON groups FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM group_members
            WHERE group_id = groups.id AND user_id = auth.uid() AND role = 'admin'
        )
    );

-- Only group creator (owner) or admin can soft-delete (set is_active=false)
CREATE POLICY "Admins can soft-delete group"
    ON groups FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM group_members
            WHERE group_id = groups.id AND user_id = auth.uid() AND role = 'admin'
        )
    );

-- Anyone authenticated can create a group
CREATE POLICY "Authenticated users can create groups"
    ON groups FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- GROUP_MEMBERS
-- =============================================
-- Members can view memberships of their groups
CREATE POLICY "Members can view group memberships"
    ON group_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM group_members AS my_membership
            WHERE my_membership.group_id = group_members.group_id
            AND my_membership.user_id = auth.uid()
        )
        OR group_id IN (
            SELECT id FROM groups WHERE invite_code IS NOT NULL AND invite_expires_at > NOW()
        )
    );

-- Users can join via invite code
CREATE POLICY "Users can join with invite code"
    ON group_members FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM groups
            WHERE id = group_members.group_id
            AND invite_code IS NOT NULL
            AND invite_expires_at > NOW()
        )
    );

-- Admins can update roles
CREATE POLICY "Admins can update member roles"
    ON group_members FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM group_members AS my_membership
            WHERE my_membership.group_id = group_members.group_id
            AND my_membership.user_id = auth.uid()
            AND my_membership.role = 'admin'
        )
    );

-- Admins can remove members, users can leave
CREATE POLICY "Admins can remove members, users can leave"
    ON group_members FOR DELETE
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM group_members AS my_membership
            WHERE my_membership.group_id = group_members.group_id
            AND my_membership.user_id = auth.uid()
            AND my_membership.role = 'admin'
        )
    );

-- =============================================
-- VENUES
-- =============================================
-- Members can view venues in their groups
CREATE POLICY "Members can view group venues"
    ON venues FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM group_members
            WHERE group_id = venues.group_id AND user_id = auth.uid()
        )
    );

-- Members can create venues in their groups
CREATE POLICY "Members can create venues"
    ON venues FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM group_members
            WHERE group_id = venues.group_id AND user_id = auth.uid()
        )
    );

-- Venue creator or admins can update
CREATE POLICY "Creator or admin can update venue"
    ON venues FOR UPDATE
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM group_members
            WHERE group_id = venues.group_id AND user_id = auth.uid() AND role = 'admin'
        )
    );

-- Venue creator or admins can delete
CREATE POLICY "Creator or admin can delete venue"
    ON venues FOR DELETE
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM group_members
            WHERE group_id = venues.group_id AND user_id = auth.uid() AND role = 'admin'
        )
    );

-- =============================================
-- MATCHES
-- =============================================
-- Members can view matches in their groups
CREATE POLICY "Members can view group matches"
    ON matches FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM group_members
            WHERE group_id = matches.group_id AND user_id = auth.uid()
        )
    );

-- Members can create matches in their groups
CREATE POLICY "Members can create matches"
    ON matches FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM group_members
            WHERE group_id = matches.group_id AND user_id = auth.uid()
        )
    );

-- Match owner or group admin can update
CREATE POLICY "Owner or admin can update match"
    ON matches FOR UPDATE
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM group_members
            WHERE group_id = matches.group_id AND user_id = auth.uid() AND role = 'admin'
        )
    );

-- Match owner or group admin can delete (actually only cancel/delete)
CREATE POLICY "Owner or admin can delete match"
    ON matches FOR DELETE
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM group_members
            WHERE group_id = matches.group_id AND user_id = auth.uid() AND role = 'admin'
        )
    );

-- =============================================
-- MATCH_PLAYERS
-- =============================================
-- Members can view players of matches in their groups
CREATE POLICY "Members can view match players"
    ON match_players FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM matches m
            JOIN group_members gm ON m.group_id = gm.group_id
            WHERE m.id = match_players.match_id AND gm.user_id = auth.uid()
        )
    );

-- Users can check themselves in (or join waitlist)
CREATE POLICY "Users can check themselves in"
    ON match_players FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM matches m
            JOIN group_members gm ON m.group_id = gm.group_id
            WHERE m.id = match_players.match_id AND gm.user_id = auth.uid()
        )
    );

-- Users can update their own status (forfeit)
CREATE POLICY "Users can forfeit their check-in"
    ON match_players FOR UPDATE
    USING (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM matches m
            JOIN group_members gm ON m.group_id = gm.group_id
            WHERE m.id = match_players.match_id AND gm.user_id = auth.uid()
        )
    );

-- Users can remove themselves (cancel)
CREATE POLICY "Users can remove themselves"
    ON match_players FOR DELETE
    USING (user_id = auth.uid());

-- =============================================
-- MATCH_PAYMENTS
-- =============================================
-- Members can view payments for matches in their groups
CREATE POLICY "Members can view match payments"
    ON match_payments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM matches m
            JOIN group_members gm ON m.group_id = gm.group_id
            WHERE m.id = match_payments.match_id AND gm.user_id = auth.uid()
        )
    );

-- Users can record their own payment
CREATE POLICY "Users can record own payment"
    ON match_payments FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM matches m
            JOIN group_members gm ON m.group_id = gm.group_id
            WHERE m.id = match_payments.match_id AND gm.user_id = auth.uid()
        )
    );

-- Match owner or admin can update payment status
CREATE POLICY "Owner or admin can update payment"
    ON match_payments FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM matches m
            JOIN group_members gm ON m.group_id = gm.group_id
            WHERE m.id = match_payments.match_id
            AND (m.created_by = auth.uid() OR (gm.user_id = auth.uid() AND gm.role = 'admin'))
        )
    );
