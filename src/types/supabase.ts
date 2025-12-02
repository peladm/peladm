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
      clientes: {
        Row: {
          id: string
          name: string
          email: string
          supabase_url: string
          supabase_anon_key: string
          responsible_name: string
          phone: string
          pelada_name: string
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
          responsible_name: string
          phone: string
          pelada_name: string
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
          responsible_name?: string
          phone?: string
          pelada_name?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
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