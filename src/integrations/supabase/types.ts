export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      events: {
        Row: {
          cover_url: string | null
          created_at: string
          creator_id: string
          description: string | null
          duration_minutes: number | null
          end_time: string | null
          id: string
          is_free: boolean
          is_live: boolean | null
          live_ended_at: string | null
          live_started_at: string | null
          price: number | null
          room_url: string | null
          scheduled_at: string
          title: string
          updated_at: string
          viewer_count: number | null
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          creator_id: string
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          is_free?: boolean
          is_live?: boolean | null
          live_ended_at?: string | null
          live_started_at?: string | null
          price?: number | null
          room_url?: string | null
          scheduled_at: string
          title: string
          updated_at?: string
          viewer_count?: number | null
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          creator_id?: string
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          id?: string
          is_free?: boolean
          is_live?: boolean | null
          live_ended_at?: string | null
          live_started_at?: string | null
          price?: number | null
          room_url?: string | null
          scheduled_at?: string
          title?: string
          updated_at?: string
          viewer_count?: number | null
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      live_viewers: {
        Row: {
          event_id: string
          id: string
          joined_at: string | null
          last_seen: string
          user_id: string
          viewer_profile_id: string | null
        }
        Insert: {
          event_id: string
          id?: string
          joined_at?: string | null
          last_seen?: string
          user_id: string
          viewer_profile_id?: string | null
        }
        Update: {
          event_id?: string
          id?: string
          joined_at?: string | null
          last_seen?: string
          user_id?: string
          viewer_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_viewers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_items: {
        Row: {
          created_at: string | null
          id: string
          image_url: string
          profile_id: string
          title: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url: string
          profile_id: string
          title?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string
          profile_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_items_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          email: string
          founding_number: number | null
          handle: string | null
          id: string
          is_founding_member: boolean | null
          name: string
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          email: string
          founding_number?: number | null
          handle?: string | null
          id?: string
          is_founding_member?: boolean | null
          name: string
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          email?: string
          founding_number?: number | null
          handle?: string | null
          id?: string
          is_founding_member?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_active_viewer_count: { Args: { event_uuid: string }; Returns: number }
      get_all_public_profiles: {
        Args: never
        Returns: {
          avatar_url: string
          bio: string
          cover_url: string
          created_at: string
          handle: string
          id: string
          name: string
          updated_at: string
          user_id: string
          website: string
        }[]
      }
      get_follower_count: { Args: { target_user_id: string }; Returns: number }
      get_followers_list: {
        Args: { target_user_id: string }
        Returns: {
          avatar_url: string
          handle: string
          name: string
          user_id: string
        }[]
      }
      get_following_count: { Args: { target_user_id: string }; Returns: number }
      get_following_list: {
        Args: { target_user_id: string }
        Returns: {
          avatar_url: string
          handle: string
          name: string
          user_id: string
        }[]
      }
      get_live_viewer_count: { Args: { event_uuid: string }; Returns: number }
      get_portfolio_items: {
        Args: { target_user_id: string }
        Returns: {
          created_at: string
          id: string
          image_url: string
          title: string
        }[]
      }
      get_public_profile: {
        Args: { profile_user_id: string }
        Returns: {
          avatar_url: string
          bio: string
          cover_url: string
          created_at: string
          founding_number: number
          handle: string
          is_founding_member: boolean
          name: string
          user_id: string
          website: string
        }[]
      }
      get_public_profile_by_profile_id: {
        Args: { profile_id: string }
        Returns: {
          avatar_url: string
          bio: string
          cover_url: string
          created_at: string
          founding_number: number
          handle: string
          is_founding_member: boolean
          name: string
          user_id: string
          website: string
        }[]
      }
      is_following: { Args: { target_user_id: string }; Returns: boolean }
      remove_live_viewer: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: undefined
      }
      search_public_profiles: {
        Args: { search_text: string }
        Returns: {
          avatar_url: string
          bio: string
          handle: string
          id: string
          name: string
          user_id: string
        }[]
      }
      upsert_live_viewer: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
