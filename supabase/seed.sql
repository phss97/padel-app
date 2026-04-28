-- Phase 1 Part 3: Seed data
-- Useful for local testing

-- Create seed users (use signUp API instead — these are just references)
-- In Supabase Dashboard → SQL Editor, you can test with sample data.

-- Example group
INSERT INTO groups (
    name, description, max_players_1h, max_players_2h, max_players_3h_plus,
    invite_code, invite_expires_at, created_by
)
SELECT
    'Clube Padel SP',
    'Grupo principal dos jogadores de padel',
    4, 6, 8,
    'CLUB-2024-ABC',
    NOW() + INTERVAL '7 days',
    id
FROM auth.users LIMIT 1;

-- Example venue
INSERT INTO venues (name, address, type, group_id, created_by)
SELECT
    'Quadra Central',
    'Av. Paulista, 1000',
    'public',
    g.id,
    g.created_by
FROM groups g WHERE g.name = 'Clube Padel SP' LIMIT 1;

-- Example match
INSERT INTO matches (group_id, venue_id, start_time, end_time, max_players, created_by)
SELECT
    g.id,
    v.id,
    NOW() + INTERVAL '1 day',
    NOW() + INTERVAL '2 day',
    6,
    g.created_by
FROM groups g
JOIN venues v ON v.group_id = g.id
WHERE g.name = 'Clube Padel SP'
LIMIT 1;
