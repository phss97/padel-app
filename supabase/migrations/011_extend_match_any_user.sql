-- Allow any authenticated group member to extend a match (not just the organizer)
-- and support extending in both directions via the extend_match RPC.

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
    SELECT * INTO v_match FROM matches WHERE id = p_match_id;
    IF NOT FOUND THEN RETURN p_match_id; END IF;

    FOR v_adjacent IN
        SELECT * FROM matches
        WHERE venue_id = v_match.venue_id
        AND id != v_match.id
        AND status = 'scheduled'
        AND (
            v_match.start_time <= matches.end_time
            AND v_match.end_time >= matches.start_time
        )
    LOOP
        v_new_start := LEAST(v_match.start_time, v_adjacent.start_time);
        v_new_end := GREATEST(v_match.end_time, v_adjacent.end_time);
        v_group_id := v_match.group_id;

        v_new_max_players := calculate_max_players(v_new_start, v_new_end, v_group_id);

        UPDATE matches SET
            start_time = v_new_start,
            end_time = v_new_end,
            max_players = v_new_max_players
        WHERE id = v_match.id;

        UPDATE match_players
        SET match_id = v_match.id,
            waitlist_position = NULL,
            status = CASE WHEN status = 'confirmed' THEN 'confirmed' ELSE status END
        WHERE match_id = v_adjacent.id;

        DELETE FROM matches WHERE id = v_adjacent.id;

        RETURN v_match.id;
    END LOOP;

    RETURN p_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION extend_match(p_match_id UUID, p_hours INT DEFAULT 1, p_direction TEXT DEFAULT 'after')
RETURNS UUID AS $$
DECLARE
    v_match RECORD;
    v_new_start TIMESTAMPTZ;
    v_new_end TIMESTAMPTZ;
    v_new_max_players INT;
    v_overlapping RECORD;
BEGIN
    SELECT * INTO v_match FROM matches WHERE id = p_match_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match not found';
    END IF;

    IF p_direction = 'before' THEN
        v_new_start := v_match.start_time - (p_hours || ' hours')::INTERVAL;

        FOR v_overlapping IN
            SELECT * FROM matches
            WHERE venue_id = v_match.venue_id
            AND id != p_match_id
            AND status = 'scheduled'
            AND (
                start_time < v_match.start_time
                AND end_time >= v_new_start
            )
        LOOP
            RETURN try_merge_match(p_match_id);
        END LOOP;

        v_new_max_players := calculate_max_players(v_new_start, v_match.end_time, v_match.group_id);

        UPDATE matches SET
            start_time = v_new_start,
            max_players = v_new_max_players
        WHERE id = p_match_id;
    ELSE
        v_new_end := v_match.end_time + (p_hours || ' hours')::INTERVAL;

        FOR v_overlapping IN
            SELECT * FROM matches
            WHERE venue_id = v_match.venue_id
            AND id != p_match_id
            AND status = 'scheduled'
            AND (
                v_match.end_time < matches.end_time
                AND v_new_end >= matches.start_time
            )
        LOOP
            RETURN try_merge_match(p_match_id);
        END LOOP;

        v_new_max_players := calculate_max_players(v_match.start_time, v_new_end, v_match.group_id);

        UPDATE matches SET
            end_time = v_new_end,
            max_players = v_new_max_players
        WHERE id = p_match_id;
    END IF;

    RETURN p_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
