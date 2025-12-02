export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string
          name: string
          email: string
          supabase_url: string
          supabase_anon_key: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          supabase_url: string
          supabase_anon_key: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          supabase_url?: string
          supabase_anon_key?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      peladas: {
        Row: {
          id: string
          name: string
          description: string | null
          max_players: number
          current_players: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          max_players?: number
          current_players?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          max_players?: number
          current_players?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          name: string
          phone: string | null
          position: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          phone?: string | null
          position?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          phone?: string | null
          position?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      players: {
        Row: {
          id: string
          name: string
          email: string | null
          phone: string | null
          skill_level: number
          position: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email?: string | null
          phone?: string | null
          skill_level?: number
          position?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string | null
          phone?: string | null
          skill_level?: number
          position?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      matches: {
        Row: {
          id: string
          pelada_id: string
          date: string
          location: string | null
          status: string
          team_a_score: number | null
          team_b_score: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pelada_id: string
          date: string
          location?: string | null
          status?: string
          team_a_score?: number | null
          team_b_score?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pelada_id?: string
          date?: string
          location?: string | null
          status?: string
          team_a_score?: number | null
          team_b_score?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      match_players: {
        Row: {
          id: string
          match_id: string
          player_id: string
          team: string
          position: string | null
          goals: number | null
          assists: number | null
          created_at: string
        }
        Insert: {
          id?: string
          match_id: string
          player_id: string
          team: string
          position?: string | null
          goals?: number | null
          assists?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          match_id?: string
          player_id?: string
          team?: string
          position?: string | null
          goals?: number | null
          assists?: number | null
          created_at?: string
        }
      }
      queue: {
        Row: {
          id: string
          pelada_id: string
          player_id: string
          position_in_queue: number
          joined_at: string
          is_confirmed: boolean
        }
        Insert: {
          id?: string
          pelada_id: string
          player_id: string
          position_in_queue: number
          joined_at?: string
          is_confirmed?: boolean
        }
        Update: {
          id?: string
          pelada_id?: string
          player_id?: string
          position_in_queue?: number
          joined_at?: string
          is_confirmed?: boolean
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}