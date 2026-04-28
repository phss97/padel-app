-- Phase 1: Initial Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ENUMS
-- =============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_role') THEN
        CREATE TYPE member_role AS ENUM ('admin', 'member');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'venue_type') THEN
        CREATE TYPE venue_type AS ENUM ('public', 'private');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_status') THEN
        CREATE TYPE match_status AS ENUM ('scheduled', 'cancelled', 'completed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'player_status') THEN
        CREATE TYPE player_status AS ENUM ('confirmed', 'waitlist', 'cancelled');
    END IF;
END $$;

-- =============================================
-- TABLES
-- =============================================

-- Profiles (extends auth.users via trigger)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    avatar_url TEXT,
    pix_key TEXT,
    push_subscription_json JSONB,
    email_notifications_enabled BOOLEAN DEFAULT FALSE,
    push_notifications_enabled BOOLEAN DEFAULT TRUE,
    preferred_language TEXT DEFAULT 'pt' CHECK (preferred_language IN ('pt', 'en')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Groups
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    default_venue_id UUID,
    max_players_1h INT NOT NULL DEFAULT 4,
    max_players_2h INT NOT NULL DEFAULT 6,
    max_players_3h_plus INT NOT NULL DEFAULT 8,
    invite_code TEXT UNIQUE,
    invite_expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group memberships
CREATE TABLE IF NOT EXISTS group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role member_role NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (group_id, user_id)
);

-- Venues
CREATE TABLE IF NOT EXISTS venues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    type venue_type DEFAULT 'public',
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK from groups to venues after venues table exists
ALTER TABLE groups
    DROP CONSTRAINT IF EXISTS fk_default_venue;
ALTER TABLE groups
    ADD CONSTRAINT fk_default_venue
    FOREIGN KEY (default_venue_id) REFERENCES venues(id)
    ON DELETE SET NULL;

-- Matches
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    max_players INT NOT NULL DEFAULT 4,
    court_cost DECIMAL(10,2),
    status match_status NOT NULL DEFAULT 'scheduled',
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_duration CHECK (end_time > start_time)
);

-- Match players
CREATE TABLE IF NOT EXISTS match_players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status player_status NOT NULL DEFAULT 'confirmed',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    waitlist_position INT,
    UNIQUE (match_id, user_id)
);

-- Manual payment tracking
CREATE TABLE IF NOT EXISTS match_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    paid_at TIMESTAMPTZ,
    pix_key_used TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (match_id, user_id)
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_venues_group ON venues(group_id);
CREATE INDEX IF NOT EXISTS idx_matches_group ON matches(group_id);
CREATE INDEX IF NOT EXISTS idx_matches_venue ON matches(venue_id);
CREATE INDEX IF NOT EXISTS idx_matches_time ON matches(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_match_players_match ON match_players(match_id);
CREATE INDEX IF NOT EXISTS idx_match_players_user ON match_players(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Calculate max_players based on duration
CREATE OR REPLACE FUNCTION calculate_max_players(
    p_start TIMESTAMPTZ,
    p_end TIMESTAMPTZ,
    p_group_id UUID
)
RETURNS INT AS $$
DECLARE
    v_hours NUMERIC;
    v_1h INT;
    v_2h INT;
    v_3h INT;
BEGIN
    SELECT EXTRACT(EPOCH FROM (p_end - p_start)) / 3600 INTO v_hours;
    SELECT max_players_1h, max_players_2h, max_players_3h_plus
    INTO v_1h, v_2h, v_3h
    FROM groups WHERE id = p_group_id;

    IF v_hours < 2 THEN RETURN COALESCE(v_1h, 4);
    ELSIF v_hours < 3 THEN RETURN COALESCE(v_2h, 6);
    ELSE RETURN COALESCE(v_3h, 8);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Get next waitlist position
CREATE OR REPLACE FUNCTION get_next_waitlist_position(p_match_id UUID)
RETURNS INT AS $$
DECLARE
    v_max INT;
BEGIN
    SELECT COALESCE(MAX(waitlist_position), 0) + 1
    INTO v_max
    FROM match_players
    WHERE match_id = p_match_id AND status = 'waitlist';
    RETURN v_max;
END;
$$ LANGUAGE plpgsql;

-- Promote waitlisted players when a slot opens
CREATE OR REPLACE FUNCTION promote_waitlist()
RETURNS TRIGGER AS $$
DECLARE
    v_next_player RECORD;
    v_confirmed_count INT;
    v_max_players INT;
BEGIN
    -- Only promote if player left was confirmed
    IF OLD.status != 'confirmed' THEN
        RETURN NEW;
    END IF;

    SELECT max_players INTO v_max_players
    FROM matches WHERE id = OLD.match_id;

    SELECT COUNT(*) INTO v_confirmed_count
    FROM match_players
    WHERE match_id = OLD.match_id AND status = 'confirmed';

    -- While there's room and waitlisted players exist
    WHILE v_confirmed_count < v_max_players LOOP
        SELECT * INTO v_next_player
        FROM match_players
        WHERE match_id = OLD.match_id AND status = 'waitlist'
        ORDER BY waitlist_position ASC, joined_at ASC
        LIMIT 1;

        EXIT WHEN NOT FOUND;

        UPDATE match_players
        SET status = 'confirmed', waitlist_position = NULL
        WHERE id = v_next_player.id;

        -- TODO: Trigger push notification here for promoted user

        v_confirmed_count := v_confirmed_count + 1;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for waitlist promotion
DROP TRIGGER IF EXISTS trg_promote_waitlist ON match_players;
CREATE TRIGGER trg_promote_waitlist
    AFTER UPDATE ON match_players
    FOR EACH ROW
    WHEN (OLD.status = 'confirmed' AND NEW.status = 'cancelled')
    EXECUTE FUNCTION promote_waitlist();

-- Also trigger on delete (player unchecks)
CREATE OR REPLACE FUNCTION promote_waitlist_on_delete()
RETURNS TRIGGER AS $$
DECLARE
    v_next_player RECORD;
    v_confirmed_count INT;
    v_max_players INT;
BEGIN
    IF OLD.status != 'confirmed' THEN
        RETURN OLD;
    END IF;

    SELECT max_players INTO v_max_players
    FROM matches WHERE id = OLD.match_id;

    SELECT COUNT(*) INTO v_confirmed_count
    FROM match_players
    WHERE match_id = OLD.match_id AND status = 'confirmed';

    WHILE v_confirmed_count < v_max_players LOOP
        SELECT * INTO v_next_player
        FROM match_players
        WHERE match_id = OLD.match_id AND status = 'waitlist'
        ORDER BY waitlist_position ASC, joined_at ASC
        LIMIT 1;

        EXIT WHEN NOT FOUND;

        UPDATE match_players
        SET status = 'confirmed', waitlist_position = NULL
        WHERE id = v_next_player.id;

        v_confirmed_count := v_confirmed_count + 1;
    END LOOP;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_promote_waitlist_delete ON match_players;
CREATE TRIGGER trg_promote_waitlist_delete
    AFTER DELETE ON match_players
    FOR EACH ROW
    EXECUTE FUNCTION promote_waitlist_on_delete();

-- =============================================
-- HANDLE NEW USER: create profile
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, preferred_language)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(
            CASE 
                WHEN (NEW.raw_user_meta_data->>'language') IS NOT NULL AND LEFT(NEW.raw_user_meta_data->>'language', 2) = 'en' THEN 'en'
                ELSE 'pt'
            END,
            'pt'
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
