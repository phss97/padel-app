-- Phase: Fix check_in_match to allow re-check-in after forfeit
-- Problem: If player row exists with status='cancelled', the function
-- returns early without allowing the player to re-join.
-- Solution: If existing status is 'cancelled', UPDATE instead of returning.

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
        IF v_existing_status = 'confirmed' OR v_existing_status = 'waitlist' THEN
            RETURN v_existing_status;
        END IF;
        -- If cancelled, re-check them in below
    END IF;

    SELECT * INTO v_match FROM matches WHERE id = p_match_id;
    SELECT COUNT(*) INTO v_confirmed_count
    FROM match_players WHERE match_id = p_match_id AND status = 'confirmed';

    IF v_confirmed_count < v_match.max_players THEN
        IF v_existing_status = 'cancelled' THEN
            UPDATE match_players
            SET status = 'confirmed', waitlist_position = NULL, joined_at = NOW()
            WHERE match_id = p_match_id AND user_id = p_user_id;
        ELSE
            INSERT INTO match_players (match_id, user_id, status, joined_at)
            VALUES (p_match_id, p_user_id, 'confirmed', NOW());
        END IF;
        RETURN 'confirmed';
    ELSE
        v_waitlist_position := get_next_waitlist_position(p_match_id);
        IF v_existing_status = 'cancelled' THEN
            UPDATE match_players
            SET status = 'waitlist', waitlist_position = v_waitlist_position, joined_at = NOW()
            WHERE match_id = p_match_id AND user_id = p_user_id;
        ELSE
            INSERT INTO match_players (match_id, user_id, status, joined_at, waitlist_position)
            VALUES (p_match_id, p_user_id, 'waitlist', NOW(), v_waitlist_position);
        END IF;
        RETURN 'waitlist';
    END IF;
END;
$$ LANGUAGE plpgsql;
