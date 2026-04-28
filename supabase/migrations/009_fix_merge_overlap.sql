-- Fix try_merge_match to use overlap logic instead of exact equality
-- This catches adjacent, overlapping, and touching matches

CREATE OR REPLACE FUNCTION try_merge_match(p_match_id UUID)
RETURNS UUID AS $$
DECLARE
    v_match RECORD;
    v_adjacent RECORD;
    v_new_start TIMESTAMPTZ;
    v_new_end TIMESTAMPTZ;
    v_group_id UUID;
    v_new_max_players INT;
BEGIN
    -- Get details of the newly inserted match
    SELECT * INTO v_match FROM matches WHERE id = p_match_id;
    IF NOT FOUND THEN RETURN p_match_id; END IF;

    -- Find adjacent/overlapping match (same venue, touching or overlapping timestamps)
    FOR v_adjacent IN
        SELECT * FROM matches
        WHERE venue_id = v_match.venue_id
        AND id != v_match.id
        AND status = 'scheduled'
        AND (
            -- Overlap or touch: new match starts before/at existing end
            -- AND new match ends after/at existing start
            v_match.start_time <= matches.end_time
            AND v_match.end_time >= matches.start_time
        )
    LOOP
        -- Determine merged boundaries
        v_new_start := LEAST(v_match.start_time, v_adjacent.start_time);
        v_new_end := GREATEST(v_match.end_time, v_adjacent.end_time);
        v_group_id := v_match.group_id;

        -- Recalculate max_players based on new duration
        v_new_max_players := calculate_max_players(v_new_start, v_new_end, v_group_id);

        -- Update existing match with new boundaries
        UPDATE matches SET
            start_time = v_new_start,
            end_time = v_new_end,
            max_players = v_new_max_players
        WHERE id = v_match.id;

        -- Move all players from adjacent match to the merged one
        UPDATE match_players
        SET match_id = v_match.id,
            waitlist_position = NULL,
            status = CASE WHEN status = 'confirmed' THEN 'confirmed' ELSE status END
        WHERE match_id = v_adjacent.id;

        -- Delete the now-merged adjacent match
        DELETE FROM matches WHERE id = v_adjacent.id;

        -- Return the merged match ID
        RETURN v_match.id;
    END LOOP;

    -- No adjacent/overlapping match found, return original
    RETURN p_match_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGER: Auto-merge on match insert
-- Ensure it exists
-- =============================================
CREATE OR REPLACE FUNCTION trg_match_insert_merge()
RETURNS TRIGGER AS $$
DECLARE
    v_merged_id UUID;
BEGIN
    v_merged_id := try_merge_match(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_merge_match ON matches;
CREATE TRIGGER trg_auto_merge_match
    AFTER INSERT ON matches
    FOR EACH ROW
    EXECUTE FUNCTION trg_match_insert_merge();

-- =============================================
-- Fix extend_match overlap check too
-- =============================================
CREATE OR REPLACE FUNCTION extend_match(p_match_id UUID, p_hours INT DEFAULT 1)
RETURNS UUID AS $$
DECLARE
    v_match RECORD;
    v_new_end TIMESTAMPTZ;
    v_new_max_players INT;
    v_overlapping RECORD;
BEGIN
    SELECT * INTO v_match FROM matches WHERE id = p_match_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match not found';
    END IF;

    v_new_end := v_match.end_time + (p_hours || ' hours')::INTERVAL;

    -- Check if there's already a match in the extended slot (same venue)
    FOR v_overlapping IN
        SELECT * FROM matches
        WHERE venue_id = v_match.venue_id
        AND id != p_match_id
        AND status = 'scheduled'
        AND (
            -- Overlap or touch with extended range
            v_match.end_time < matches.end_time
            AND v_new_end >= matches.start_time
        )
    LOOP
        -- An adjacent/overlapping match exists; merge instead
        RETURN try_merge_match(p_match_id);
    END LOOP;

    -- No overlap — just extend this match
    v_new_max_players := calculate_max_players(v_match.start_time, v_new_end, v_match.group_id);

    UPDATE matches SET
        end_time = v_new_end,
        max_players = v_new_max_players
    WHERE id = p_match_id;

    RETURN p_match_id;
END;
$$ LANGUAGE plpgsql;
