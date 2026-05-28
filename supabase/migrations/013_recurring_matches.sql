-- Phase 13: Recurring Matches

-- =============================================
-- ENUMS
-- =============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recurrence_type') THEN
        CREATE TYPE recurrence_type AS ENUM ('indefinite', 'count');
    END IF;
END $$;

-- =============================================
-- TABLES
-- =============================================
CREATE TABLE IF NOT EXISTS recurring_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE RESTRICT,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time_template TIME NOT NULL,
    duration_hours INT NOT NULL DEFAULT 1 CHECK (duration_hours > 0),
    recurrence_type recurrence_type NOT NULL DEFAULT 'indefinite',
    recurrence_count INT,
    court_cost DECIMAL(10,2),
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT check_recurrence_count CHECK (
        recurrence_type = 'indefinite' OR recurrence_count > 0
    )
);

COMMENT ON COLUMN recurring_matches.day_of_week IS '0=Sunday, 1=Monday, ... 6=Saturday';

-- Reference recurring_matches from matches
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS recurring_match_id UUID REFERENCES recurring_matches(id) ON DELETE SET NULL;

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_recurring_matches_group ON recurring_matches(group_id);
CREATE INDEX IF NOT EXISTS idx_recurring_matches_venue ON recurring_matches(venue_id);
CREATE INDEX IF NOT EXISTS idx_recurring_matches_day ON recurring_matches(day_of_week);
CREATE INDEX IF NOT EXISTS idx_matches_recurring ON matches(recurring_match_id);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Generate upcoming matches from recurring templates for a group
CREATE OR REPLACE FUNCTION generate_recurring_for_group(p_group_id UUID)
RETURNS INT AS $$
DECLARE
    v_template RECORD;
    v_next_date DATE;
    v_start_time TIMESTAMPTZ;
    v_end_time TIMESTAMPTZ;
    v_max_players INT;
    v_created_count INT := 0;
    v_existing_count INT;
    v_weeks_ahead INT;
    v_total_weeks INT;
    v_week_offset INT := 0;
BEGIN
    FOR v_template IN
        SELECT *
        FROM recurring_matches
        WHERE group_id = p_group_id
    LOOP
        -- Determine how many weeks ahead to generate
        IF v_template.recurrence_type = 'count' THEN
            v_total_weeks := v_template.recurrence_count;
        ELSE
            v_total_weeks := 4;
        END IF;

        FOR v_week_offset IN 0..(v_total_weeks - 1) LOOP
            -- Calculate the next occurrence date
            v_next_date := CURRENT_DATE + (v_template.day_of_week - EXTRACT(DOW FROM CURRENT_DATE))::INT + (v_week_offset * 7);

            -- If the date is in the past, skip to next week
            IF v_next_date < CURRENT_DATE THEN
                v_next_date := v_next_date + 7;
            END IF;

            -- If still past after adjusting, skip
            IF v_next_date < CURRENT_DATE THEN
                CONTINUE;
            END IF;

            -- Build start/end timestamps
            v_start_time := v_next_date + v_template.start_time_template;
            v_end_time := v_start_time + (v_template.duration_hours || ' hours')::INTERVAL;

            -- Calculate max_players based on duration
            v_max_players := calculate_max_players(v_start_time, v_end_time, v_template.group_id);

            -- Check if a match already exists for this template on this exact date/time
            SELECT COUNT(*) INTO v_existing_count
            FROM matches
            WHERE recurring_match_id = v_template.id
              AND start_time = v_start_time
              AND status != 'cancelled';

            IF v_existing_count = 0 THEN
                INSERT INTO matches (
                    group_id,
                    venue_id,
                    start_time,
                    end_time,
                    max_players,
                    court_cost,
                    status,
                    created_by,
                    recurring_match_id
                ) VALUES (
                    v_template.group_id,
                    v_template.venue_id,
                    v_start_time,
                    v_end_time,
                    v_max_players,
                    v_template.court_cost,
                    'scheduled',
                    v_template.created_by,
                    v_template.id
                );
                v_created_count := v_created_count + 1;
            END IF;
        END LOOP;
    END LOOP;

    RETURN v_created_count;
END;
$$ LANGUAGE plpgsql;

-- Delete a recurring template and all its generated (scheduled) matches
CREATE OR REPLACE FUNCTION delete_recurring_with_matches(p_recurring_match_id UUID)
RETURNS INT AS $$
DECLARE
    v_deleted_matches INT;
BEGIN
    DELETE FROM match_players
    WHERE match_id IN (
        SELECT id FROM matches WHERE recurring_match_id = p_recurring_match_id AND status = 'scheduled'
    );

    DELETE FROM match_payments
    WHERE match_id IN (
        SELECT id FROM matches WHERE recurring_match_id = p_recurring_match_id AND status = 'scheduled'
    );

    DELETE FROM matches
    WHERE recurring_match_id = p_recurring_match_id AND status = 'scheduled';
    GET DIAGNOSTICS v_deleted_matches = ROW_COUNT;

    DELETE FROM recurring_matches WHERE id = p_recurring_match_id;

    RETURN v_deleted_matches;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- RLS (if applicable; rely on general policies)
-- =============================================
-- Recurring matches inherit group-based access through group_memberships.
-- Add explicit RLS if your project uses RLS on all tables:
-- ALTER TABLE recurring_matches ENABLE ROW LEVEL SECURITY;
-- (The existing 002_rls_policies.sql pattern can be extended here if needed.)
