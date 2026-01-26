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
      event_rooms: {
        Row: {
          created_at: string
          event_id: string
          room_url: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          room_url: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          room_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rooms_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          category: string | null
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
          scheduled_at: string
          title: string
          updated_at: string
          viewer_count: number | null
        }
        Insert: {
          category?: string | null
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
          scheduled_at: string
          title: string
          updated_at?: string
          viewer_count?: number | null
        }
        Update: {
          category?: string | null
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
      live_hand_raises: {
        Row: {
          cleared_at: string | null
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          cleared_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          cleared_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_hand_raises_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      live_materials: {
        Row: {
          brand: string | null
          created_at: string
          event_id: string
          id: string
          name: string
          spec: string | null
          updated_at: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          event_id: string
          id?: string
          name: string
          spec?: string | null
          updated_at?: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          spec?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_materials_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      live_messages: {
        Row: {
          created_at: string
          display_name: string | null
          event_id: string
          id: string
          message: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          event_id: string
          id?: string
          message: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          event_id?: string
          id?: string
          message?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
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
      notification_preferences: {
        Row: {
          created_at: string
          email_live: boolean
          email_reminders: boolean
          email_scheduled: boolean
          id: string
          inapp_live: boolean
          inapp_scheduled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_live?: boolean
          email_reminders?: boolean
          email_scheduled?: boolean
          id?: string
          inapp_live?: boolean
          inapp_scheduled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_live?: boolean
          email_reminders?: boolean
          email_scheduled?: boolean
          id?: string
          inapp_live?: boolean
          inapp_scheduled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      portfolio_items: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string
          profile_id: string
          title: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url: string
          profile_id: string
          title?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
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
          founding_number: number | null
          handle: string | null
          id: string
          is_founding_member: boolean | null
          is_verified: boolean
          name: string
          updated_at: string
          user_id: string
          verified_at: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          founding_number?: number | null
          handle?: string | null
          id?: string
          is_founding_member?: boolean | null
          is_verified?: boolean
          name: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          founding_number?: number | null
          handle?: string | null
          id?: string
          is_founding_member?: boolean | null
          is_verified?: boolean
          name?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      recent_searches: {
        Row: {
          created_at: string
          id: string
          query: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_sessions: {
        Row: {
          created_at: string
          creator_id: string
          event_id: string
          id: string
          reminder_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          event_id: string
          id?: string
          reminder_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          event_id?: string
          id?: string
          reminder_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_emails: {
        Row: {
          email_type: string
          event_id: string
          id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          email_type: string
          event_id: string
          id?: string
          sent_at?: string
          user_id: string
        }
        Update: {
          email_type?: string
          event_id?: string
          id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sent_emails_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      session_feedback: {
        Row: {
          audience_user_id: string
          created_at: string
          creator_id: string
          event_id: string
          id: string
          improvement_category: string | null
          left_early: boolean | null
          left_early_reason: string | null
          private_feedback_text: string | null
          public_tags: string[] | null
          rating: number | null
        }
        Insert: {
          audience_user_id: string
          created_at?: string
          creator_id: string
          event_id: string
          id?: string
          improvement_category?: string | null
          left_early?: boolean | null
          left_early_reason?: string | null
          private_feedback_text?: string | null
          public_tags?: string[] | null
          rating?: number | null
        }
        Update: {
          audience_user_id?: string
          created_at?: string
          creator_id?: string
          event_id?: string
          id?: string
          improvement_category?: string | null
          left_early?: boolean | null
          left_early_reason?: string | null
          private_feedback_text?: string | null
          public_tags?: string[] | null
          rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_feedback_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          attended_at: string | null
          created_at: string
          event_id: string
          id: string
          purchased_at: string
          user_id: string
        }
        Insert: {
          attended_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          purchased_at?: string
          user_id: string
        }
        Update: {
          attended_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          purchased_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_admin_role: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      create_notification: {
        Args: {
          p_link?: string
          p_message?: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
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
          is_verified: boolean
          name: string
          updated_at: string
          user_id: string
          verified_at: string
          website: string
        }[]
      }
      get_creator_feedback: {
        Args: { target_creator_id: string }
        Returns: {
          created_at: string
          event_id: string
          id: string
          public_tags: string[]
          rating: number
        }[]
      }
      get_creator_profiles: {
        Args: { user_ids: string[] }
        Returns: {
          avatar_url: string
          is_verified: boolean
          name: string
          user_id: string
        }[]
      }
      get_creator_rating_stats: {
        Args: { target_creator_id: string }
        Returns: {
          average_rating: number
          total_guests: number
          total_ratings: number
        }[]
      }
      get_event_room_url: { Args: { event_id: string }; Returns: string }
      get_event_viewers: {
        Args: { p_event_id: string }
        Returns: {
          joined_at: string
          last_seen: string
          user_id: string
        }[]
      }
      get_follower_count: { Args: { target_user_id: string }; Returns: number }
      get_followers_list: {
        Args: { target_user_id: string }
        Returns: {
          avatar_url: string
          handle: string
          is_verified: boolean
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
          is_verified: boolean
          name: string
          user_id: string
        }[]
      }
      get_live_viewer_count: { Args: { event_uuid: string }; Returns: number }
      get_portfolio_items: {
        Args: { target_user_id: string }
        Returns: {
          created_at: string
          description: string
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
          is_verified: boolean
          name: string
          user_id: string
          verified_at: string
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
          is_verified: boolean
          name: string
          user_id: string
          verified_at: string
          website: string
        }[]
      }
      get_upcoming_sessions: {
        Args: { p_creator_id?: string; p_limit?: number }
        Returns: {
          category: string
          cover_url: string
          creator_id: string
          description: string
          id: string
          is_free: boolean
          is_live: boolean
          live_ended_at: string
          price: number
          scheduled_at: string
          status: string
          title: string
        }[]
      }
      get_user_attendance_count: {
        Args: { target_user_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_following: { Args: { target_user_id: string }; Returns: boolean }
      remove_live_viewer: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: undefined
      }
      search_public_profiles: {
        Args: { search_text: string }
        Returns: {
          account_type: string
          avatar_url: string
          bio: string
          handle: string
          id: string
          is_verified: boolean
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
      app_role: "creator" | "admin"
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
    Enums: {
      app_role: ["creator", "admin"],
    },
  },
} as const
