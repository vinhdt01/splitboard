export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; email: string; full_name: string | null; avatar_url: string | null; created_at: string }
        Insert: { id: string; email: string; full_name?: string | null; avatar_url?: string | null }
        Update: { full_name?: string | null; avatar_url?: string | null }
      }
      boards: {
        Row: { id: string; name: string; description: string | null; invite_code: string; owner_id: string; created_at: string }
        Insert: { name: string; description?: string | null; invite_code: string; owner_id: string }
        Update: { name?: string; description?: string | null }
      }
      board_members: {
        Row: { id: string; board_id: string; user_id: string; joined_at: string }
        Insert: { board_id: string; user_id: string }
        Update: never
      }
      costs: {
        Row: { id: string; board_id: string; title: string; amount: number; paid_by: string; created_by: string; created_at: string; note: string | null }
        Insert: { board_id: string; title: string; amount: number; paid_by: string; created_by: string; note?: string | null }
        Update: { title?: string; amount?: number; note?: string | null }
      }
      cost_splits: {
        Row: { id: string; cost_id: string; user_id: string; share: number; settled: boolean; settled_at: string | null }
        Insert: { cost_id: string; user_id: string; share: number }
        Update: { settled?: boolean; settled_at?: string | null }
      }
    }
  }
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Board = Database['public']['Tables']['boards']['Row']
export type BoardMember = Database['public']['Tables']['board_members']['Row']
export type Cost = Database['public']['Tables']['costs']['Row']
export type CostSplit = Database['public']['Tables']['cost_splits']['Row']

export interface CostWithSplits extends Cost {
  splits: (CostSplit & { profile: Profile })[]
  payer_profile: Profile
}

export interface MemberDebt {
  user: Profile
  owes: number    // positive = owes money, negative = is owed money
  details: { to: Profile; amount: number }[]
}
