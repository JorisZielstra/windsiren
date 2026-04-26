// Hand-written to match supabase/migrations/20260423120000_initial_schema.sql.
// TODO: replace with `supabase gen types typescript` output once the Supabase
// CLI is set up. Keep this file in sync with schema migrations until then.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          profile_mode: Database["public"]["Enums"]["profile_mode"];
          thresholds: Json;
          notification_lead_time_hours: number;
          quiet_hours_start: string | null;
          quiet_hours_end: string | null;
          locale: string;
          avatar_url: string | null;
          bio: string | null;
          onboarded_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          profile_mode?: Database["public"]["Enums"]["profile_mode"];
          thresholds?: Json;
          notification_lead_time_hours?: number;
          quiet_hours_start?: string | null;
          quiet_hours_end?: string | null;
          locale?: string;
          avatar_url?: string | null;
          bio?: string | null;
          onboarded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          profile_mode?: Database["public"]["Enums"]["profile_mode"];
          thresholds?: Json;
          notification_lead_time_hours?: number;
          quiet_hours_start?: string | null;
          quiet_hours_end?: string | null;
          locale?: string;
          avatar_url?: string | null;
          bio?: string | null;
          onboarded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      spots: {
        Row: {
          id: string;
          slug: string;
          name: string;
          country_code: string;
          lat: number;
          lng: number;
          safe_wind_directions: Json;
          tide_sensitive: boolean;
          hazards: string | null;
          knmi_station_id: string | null;
          rws_tide_station_id: string | null;
          region: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          country_code?: string;
          lat: number;
          lng: number;
          safe_wind_directions: Json;
          tide_sensitive?: boolean;
          hazards?: string | null;
          knmi_station_id?: string | null;
          rws_tide_station_id?: string | null;
          region?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          country_code?: string;
          lat?: number;
          lng?: number;
          safe_wind_directions?: Json;
          tide_sensitive?: boolean;
          hazards?: string | null;
          knmi_station_id?: string | null;
          rws_tide_station_id?: string | null;
          region?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      favorite_spots: {
        Row: {
          user_id: string;
          spot_id: string;
          notifications_enabled: boolean;
          created_at: string;
        };
        Insert: {
          user_id: string;
          spot_id: string;
          notifications_enabled?: boolean;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          spot_id?: string;
          notifications_enabled?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      home_spots: {
        Row: {
          user_id: string;
          spot_id: string;
          position: number;
          created_at: string;
        };
        Insert: {
          user_id: string;
          spot_id: string;
          position?: number;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          spot_id?: string;
          position?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      rsvps: {
        Row: {
          id: string;
          user_id: string;
          spot_id: string;
          planned_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          spot_id: string;
          planned_date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          spot_id?: string;
          planned_date?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      forecasts: {
        Row: {
          id: string;
          spot_id: string;
          provider: Database["public"]["Enums"]["forecast_provider"];
          forecast_for_date: string;
          fetched_at: string;
          hourly: Json;
          raw_payload: Json | null;
        };
        Insert: {
          id?: string;
          spot_id: string;
          provider: Database["public"]["Enums"]["forecast_provider"];
          forecast_for_date: string;
          fetched_at?: string;
          hourly: Json;
          raw_payload?: Json | null;
        };
        Update: {
          id?: string;
          spot_id?: string;
          provider?: Database["public"]["Enums"]["forecast_provider"];
          forecast_for_date?: string;
          fetched_at?: string;
          hourly?: Json;
          raw_payload?: Json | null;
        };
        Relationships: [];
      };
      observations: {
        Row: {
          id: string;
          spot_id: string;
          station_id: string;
          observed_at: string;
          wind_speed_ms: number | null;
          gust_ms: number | null;
          wind_direction_deg: number | null;
          air_temp_c: number | null;
          water_temp_c: number | null;
          precipitation_mm: number | null;
          pressure_hpa: number | null;
          source: Database["public"]["Enums"]["observation_source"];
        };
        Insert: {
          id?: string;
          spot_id: string;
          station_id: string;
          observed_at: string;
          wind_speed_ms?: number | null;
          gust_ms?: number | null;
          wind_direction_deg?: number | null;
          air_temp_c?: number | null;
          water_temp_c?: number | null;
          precipitation_mm?: number | null;
          pressure_hpa?: number | null;
          source: Database["public"]["Enums"]["observation_source"];
        };
        Update: {
          id?: string;
          spot_id?: string;
          station_id?: string;
          observed_at?: string;
          wind_speed_ms?: number | null;
          gust_ms?: number | null;
          wind_direction_deg?: number | null;
          air_temp_c?: number | null;
          water_temp_c?: number | null;
          precipitation_mm?: number | null;
          pressure_hpa?: number | null;
          source?: Database["public"]["Enums"]["observation_source"];
        };
        Relationships: [];
      };
      tide_events: {
        Row: {
          id: string;
          spot_id: string;
          event_at: string;
          type: Database["public"]["Enums"]["tide_event_type"];
          height_cm: number;
          source: Database["public"]["Enums"]["tide_source"];
        };
        Insert: {
          id?: string;
          spot_id: string;
          event_at: string;
          type: Database["public"]["Enums"]["tide_event_type"];
          height_cm: number;
          source: Database["public"]["Enums"]["tide_source"];
        };
        Update: {
          id?: string;
          spot_id?: string;
          event_at?: string;
          type?: Database["public"]["Enums"]["tide_event_type"];
          height_cm?: number;
          source?: Database["public"]["Enums"]["tide_source"];
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          user_id: string;
          revenuecat_user_id: string;
          status: Database["public"]["Enums"]["subscription_status"];
          current_period_end: string | null;
          platform: Database["public"]["Enums"]["subscription_platform"];
          updated_at: string;
        };
        Insert: {
          user_id: string;
          revenuecat_user_id: string;
          status: Database["public"]["Enums"]["subscription_status"];
          current_period_end?: string | null;
          platform: Database["public"]["Enums"]["subscription_platform"];
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          revenuecat_user_id?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          current_period_end?: string | null;
          platform?: Database["public"]["Enums"]["subscription_platform"];
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications_sent: {
        Row: {
          id: string;
          user_id: string;
          spot_id: string;
          for_date: string;
          sent_at: string;
          expo_ticket_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          spot_id: string;
          for_date: string;
          sent_at?: string;
          expo_ticket_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          spot_id?: string;
          for_date?: string;
          sent_at?: string;
          expo_ticket_id?: string | null;
        };
        Relationships: [];
      };
      follows: {
        Row: {
          follower_id: string;
          followee_id: string;
          created_at: string;
        };
        Insert: {
          follower_id: string;
          followee_id: string;
          created_at?: string;
        };
        Update: {
          follower_id?: string;
          followee_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          user_id: string;
          spot_id: string;
          session_date: string;
          duration_minutes: number;
          notes: string | null;
          wind_avg_ms: number | null;
          wind_max_ms: number | null;
          wind_dir_avg_deg: number | null;
          gust_max_ms: number | null;
          max_jump_m: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          spot_id: string;
          session_date: string;
          duration_minutes: number;
          notes?: string | null;
          wind_avg_ms?: number | null;
          wind_max_ms?: number | null;
          wind_dir_avg_deg?: number | null;
          gust_max_ms?: number | null;
          max_jump_m?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          spot_id?: string;
          session_date?: string;
          duration_minutes?: number;
          notes?: string | null;
          wind_avg_ms?: number | null;
          wind_max_ms?: number | null;
          wind_dir_avg_deg?: number | null;
          gust_max_ms?: number | null;
          max_jump_m?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      likes: {
        Row: {
          user_id: string;
          session_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          session_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          session_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      session_photos: {
        Row: {
          id: string;
          session_id: string;
          storage_path: string;
          ordinal: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          storage_path: string;
          ordinal: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          storage_path?: string;
          ordinal?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      session_comments: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          body?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      profile_mode: "beginner" | "intermediate" | "expert" | "personalized";
      forecast_provider: "openweathermap" | "meteoblue" | "open_meteo";
      observation_source: "knmi" | "buienradar";
      tide_source: "rijkswaterstaat";
      tide_event_type: "high" | "low";
      subscription_status: "active" | "past_due" | "cancelled" | "expired";
      subscription_platform: "ios" | "android" | "web";
    };
    CompositeTypes: Record<string, never>;
  };
};

// Convenience aliases for common row types.
export type SpotRow = Database["public"]["Tables"]["spots"]["Row"];
export type UserRow = Database["public"]["Tables"]["users"]["Row"];
export type FavoriteSpotRow = Database["public"]["Tables"]["favorite_spots"]["Row"];
export type RsvpRow = Database["public"]["Tables"]["rsvps"]["Row"];
export type ForecastRow = Database["public"]["Tables"]["forecasts"]["Row"];
export type ObservationRow = Database["public"]["Tables"]["observations"]["Row"];
export type TideEventRow = Database["public"]["Tables"]["tide_events"]["Row"];
export type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];
export type FollowRow = Database["public"]["Tables"]["follows"]["Row"];
export type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
export type LikeRow = Database["public"]["Tables"]["likes"]["Row"];
export type SessionPhotoRow = Database["public"]["Tables"]["session_photos"]["Row"];
export type SessionCommentRow = Database["public"]["Tables"]["session_comments"]["Row"];
