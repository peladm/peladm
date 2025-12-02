export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  position?: 'goleiro' | 'linha';
  created_at: string;
  updated_at: string;
  avatar_url?: string;
  is_admin?: boolean;
}

export interface Player {
  id: string;
  user_id: string;
  name: string;
  position: 'goleiro' | 'linha';
  skill_level?: number; // 1-5
  games_played: number;
  wins: number;
  goals: number;
  assists: number;
  is_present: boolean;
  queue_position?: number;
  created_at: string;
  updated_at: string;
}

export interface Game {
  id: string;
  created_by: string;
  status: 'waiting' | 'active' | 'finished';
  team_a: string[];
  team_b: string[];
  score_a: number;
  score_b: number;
  duration: number; // em minutos
  substitutions?: Substitution[];
  started_at?: string;
  finished_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Substitution {
  id: string;
  game_id: string;
  player_out_id: string;
  player_in_id: string;
  team: 'A' | 'B';
  minute: number;
  reason?: 'injury' | 'tactical' | 'request';
  created_at: string;
}

export interface Queue {
  id: string;
  players: QueuePlayer[];
  max_players: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QueuePlayer {
  id: string;
  user_id: string;
  name: string;
  position: 'goleiro' | 'linha';
  queue_position: number;
  arrived_at: string;
  is_playing: boolean;
}

export interface Statistics {
  player_id: string;
  total_games: number;
  wins: number;
  losses: number;
  win_rate: number;
  goals: number;
  assists: number;
  avg_goals_per_game: number;
  consecutive_wins: number;
  best_streak: number;
  favorite_position: 'goleiro' | 'linha';
  last_played: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'queue' | 'game' | 'system';
  is_read: boolean;
  action_url?: string;
  created_at: string;
}

export interface AppSettings {
  max_players_per_team: number;
  game_duration: number;
  auto_substitute: boolean;
  notifications_enabled: boolean;
  queue_limit: number;
  allow_position_change: boolean;
}

// Tipos para formulários
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  name: string;
  email: string;
  password: string;
  phone?: string;
  position: 'goleiro' | 'linha';
}

export interface PlayerForm {
  name: string;
  position: 'goleiro' | 'linha';
  skill_level: number;
}

// Tipos para API responses
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}