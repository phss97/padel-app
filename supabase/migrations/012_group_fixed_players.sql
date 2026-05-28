-- Add is_fixed_player column to group_members
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS is_fixed_player BOOLEAN DEFAULT FALSE;

-- Create trigger function to auto-add fixed players when a match is created
CREATE OR REPLACE FUNCTION match_add_fixed_players()
RETURNS TRIGGER AS $$
DECLARE
  v_member RECORD;
  v_current_count INTEGER;
  v_max_players INTEGER;
BEGIN
  -- Get the max_players for this match
  v_max_players := NEW.max_players;

  -- Count current confirmed players
  SELECT COUNT(*) INTO v_current_count
  FROM match_players
  WHERE match_id = NEW.id AND status = 'confirmed';

  -- Loop through fixed players in the group and add them to the match
  FOR v_member IN
    SELECT gm.user_id
    FROM group_members gm
    WHERE gm.group_id = NEW.group_id
      AND gm.is_fixed_player = TRUE
    ORDER BY gm.joined_at ASC
  LOOP
    -- Check if user is already in the match
    IF NOT EXISTS (
      SELECT 1 FROM match_players
      WHERE match_id = NEW.id AND user_id = v_member.user_id
    ) THEN
      IF v_current_count < v_max_players THEN
        INSERT INTO match_players (match_id, user_id, status, joined_at)
        VALUES (NEW.id, v_member.user_id, 'confirmed', NOW());
        v_current_count := v_current_count + 1;
      ELSE
        INSERT INTO match_players (match_id, user_id, status, waitlist_position, joined_at)
        VALUES (
          NEW.id,
          v_member.user_id,
          'waitlist',
          (SELECT COALESCE(MAX(waitlist_position), 0) + 1 FROM match_players WHERE match_id = NEW.id AND status = 'waitlist'),
          NOW()
        );
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-add fixed players after match insert
DROP TRIGGER IF EXISTS trg_match_add_fixed_players ON matches;
CREATE TRIGGER trg_match_add_fixed_players
  AFTER INSERT ON matches
  FOR EACH ROW
  EXECUTE FUNCTION match_add_fixed_players();
