export type MemberRole = 'admin' | 'member';
export type VenueType = 'public' | 'private';
export type MatchStatus = 'scheduled' | 'cancelled' | 'completed';
export type PlayerStatus = 'confirmed' | 'waitlist' | 'cancelled';

export interface Profile {
  id: string;
  name: string;
  avatar_url?: string;
  pix_key?: string;
  push_subscription_json?: Record<string, unknown>;
  email_notifications_enabled: boolean;
  push_notifications_enabled: boolean;
  preferred_language: 'pt' | 'en';
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  default_venue_id?: string;
  max_players_1h: number;
  max_players_2h: number;
  max_players_3h_plus: number;
  invite_code?: string;
  invite_expires_at?: string;
  permanent_invite_code?: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
}

export interface Venue {
  id: string;
  name: string;
  address?: string;
  type: VenueType;
  group_id: string;
  created_by: string;
  created_at: string;
}

export interface Match {
  id: string;
  group_id: string;
  venue_id: string;
  start_time: string;
  end_time: string;
  max_players: number;
  court_cost?: number;
  status: MatchStatus;
  created_by: string;
  created_at: string;
}

export interface MatchPlayer {
  id: string;
  match_id: string;
  user_id: string;
  status: PlayerStatus;
  joined_at: string;
  waitlist_position?: number;
}

export interface MatchPayment {
  id: string;
  match_id: string;
  user_id: string;
  amount: number;
  paid_at?: string;
  pix_key_used?: string;
  created_at: string;
}
