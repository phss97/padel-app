-- Phase 6: Match Merge Logic & Auto-Extend

-- =============================================
-- MATCH MERGE FUNCTION
-- Called when a new match is created; checks for adjacent matches
-- at the same venue and merges them into a single match.
-- =============================================
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

    -- Find adjacent match (same venue, touching timestamps)
    FOR v_adjacent IN
        SELECT * FROM matches
        WHERE venue_id = v_match.venue_id
        AND id != v_match.id
        AND status = 'scheduled'
        AND (
            -- New match starts right when existing ends
            v_match.start_time = matches.end_time
            OR
            -- New match ends right when existing starts
            v_match.end_time = matches.start_time
        )
    LOOP
        -- Determine merged boundaries
        v_new_start := LEAST(v_match.start_time, v_adjacent.start_time);
        v_new_end := GREATEST(v_match.end_time, v_adjacent.end_time);
        v_group_id := v_match.group_id;

        -- Recalculate max_players based on new duration
        v_new_max_players := calculate_max_players(v_new_start, v_new_end, v_group_id);

        -- Move all players from adjacent match to the merged one
        -- First, update existing match with new boundaries
        UPDATE matches SET
            start_time = v_new_start,
            end_time = v_new_end,
            max_players = v_new_max_players
        WHERE id = v_match.id;

        -- Move confirmed players from adjacent match
        UPDATE match_players
        SET match_id = v_match.id,
            waitlist_position = NULL,
            status = CASE WHEN status = 'confirmed' THEN 'confirmed' ELSE status END
        WHERE match_id = v_adjacent.id;

        -- Move waitlisted players, reassigning positions
        -- (trigger will handle cascade promotion)

        -- Delete the now-merged adjacent match
        DELETE FROM matches WHERE id = v_adjacent.id;

        -- Return the merged match ID
        RETURN v_match.id;
    END LOOP;

    -- No adjacent match found, return original
    RETURN p_match_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGER: Auto-merge on match insert
-- =============================================
CREATE OR REPLACE FUNCTION trg_match_insert_merge()
RETURNS TRIGGER AS $$
DECLARE
    v_merged_id UUID;
BEGIN
    v_merged_id := try_merge_match(NEW.id);
    -- Note: NEW.id is still valid even if merged; we just return NULL to prevent extra row
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_merge_match ON matches;
CREATE TRIGGER trg_auto_merge_match
    AFTER INSERT ON matches
    FOR EACH ROW
    EXECUTE FUNCTION trg_match_insert_merge();

-- =============================================
-- EXPLICIT EXTEND FUNCTION
-- Used by the "Extend match" button on match detail
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
            start_time BETWEEN v_match.end_time AND v_new_end
            OR end_time BETWEEN v_match.end_time AND v_new_end
            OR (start_time <= v_match.end_time AND end_time >= v_new_end)
        )
    LOOP
        -- An adjacent/overlapping match exists; we'll merge instead
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

-- =============================================
-- CHECK-IN WITH WAITLIST SUPPORT
-- Returns 'confirmed' if slot available, 'waitlist' if full
-- =============================================
CREATE OR REPLACE FUNCTION check_in_match(p_match_id UUID, p_user_id UUID)
RETURNS player_status AS $$
DECLARE
    v_match RECORD;
    v_confirmed_count INT;
    v_waitlist_position INT;
    v_existing_status player_status;
BEGIN
    -- Check if user is already in match
    SELECT status INTO v_existing_status
    FROM match_players
    WHERE match_id = p_match_id AND user_id = p_user_id;

    IF FOUND THEN
        RETURN v_existing_status;
    END IF;

    SELECT * INTO v_match FROM matches WHERE id = p_match_id;
    SELECT COUNT(*) INTO v_confirmed_count
    FROM match_players WHERE match_id = p_match_id AND status = 'confirmed';

    IF v_confirmed_count < v_match.max_players THEN
        INSERT INTO match_players (match_id, user_id, status, joined_at)
        VALUES (p_match_id, p_user_id, 'confirmed', NOW());
        RETURN 'confirmed';
    ELSE
        v_waitlist_position := get_next_waitlist_position(p_match_id);
        INSERT INTO match_players (match_id, user_id, status, joined_at, waitlist_position)
        VALUES (p_match_id, p_user_id, 'waitlist', NOW(), v_waitlist_position);
        RETURN 'waitlist';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- FORFEIT WITH AUTOMATIC OWNERSHIP TRANSFER
-- =============================================
CREATE OR REPLACE FUNCTION forfeit_match(p_match_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_match RECORD;
    v_next_owner RECORD;
    v_result JSONB;
BEGIN
    SELECT * INTO v_match FROM matches WHERE id = p_match_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match not found';
    END IF;

    -- Mark player as cancelled
    UPDATE match_players
    SET status = 'cancelled', waitlist_position = NULL
    WHERE match_id = p_match_id AND user_id = p_user_id;

    -- If owner forfeits, transfer ownership to earliest joined remaining player
    IF v_match.created_by = p_user_id THEN
        SELECT p.* INTO v_next_owner
        FROM match_players p
        WHERE p.match_id = p_match_id AND p.status = 'confirmed' AND p.user_id != p_user_id
        ORDER BY p.joined_at ASC
        LIMIT 1;

        IF FOUND THEN
            UPDATE matches SET created_by = v_next_owner.user_id WHERE id = p_match_id;
            v_result := jsonb_build_object(
                'ownership_transferred', true,
                'new_owner_id', v_next_owner.user_id
            );
        ELSE
            v_result := jsonb_build_object(
                'ownership_transferred', false,
                'match_orphaned', true
            );
        END IF;
    ELSE
        v_result := jsonb_build_object(
            'ownership_transferred', false,
            'match_orphaned', false
        );
    END IF;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;