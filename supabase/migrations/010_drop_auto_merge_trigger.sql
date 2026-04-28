-- Drop the auto-merge trigger since merges are now handled client-side.
-- The frontend detects adjacent matches and extends the existing match
-- instead of inserting a new row.

DROP TRIGGER IF EXISTS trg_auto_merge_match ON matches;
DROP FUNCTION IF EXISTS trg_match_insert_merge();
