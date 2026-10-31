// Generado desde el esquema de Supabase (proyecto appetito). No editar a mano:
// si cambia la base de datos, vuelve a generarlo.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      change_requests: {
        Row: {
          changes: Json;
          created_at: string;
          id: string;
          item_id: string;
          message: string;
          requested_by: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          restaurant_id: string;
          session_id: string;
          status: string;
        };
        Insert: {
          changes: Json;
          created_at?: string;
          id?: string;
          item_id: string;
          message: string;
          requested_by?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          restaurant_id: string;
          session_id: string;
          status?: string;
        };
        Update: {
          changes?: Json;
          created_at?: string;
          id?: string;
          item_id?: string;
          message?: string;
          requested_by?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          restaurant_id?: string;
          session_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "change_requests_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
        ];
      };
      dining_tables: {
        Row: {
          reservation_code: string | null;
          active: boolean;
          capacity: number;
          created_at: string;
          id: string;
          label: string;
          qr_token: string;
          reserved_by: string | null;
          restaurant_id: string;
        };
        Insert: {
          reservation_code?: string | null;
          active?: boolean;
          capacity?: number;
          created_at?: string;
          id?: string;
          label: string;
          qr_token?: string;
          reserved_by?: string | null;
          restaurant_id: string;
        };
        Update: {
          reservation_code?: string | null;
          active?: boolean;
          capacity?: number;
          created_at?: string;
          id?: string;
          label?: string;
          qr_token?: string;
          reserved_by?: string | null;
          restaurant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dining_tables_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      dish_option_groups: {
        Row: {
          dish_id: string;
          id: string;
          kind: string;
          name: string;
          position: number;
          required: boolean;
        };
        Insert: {
          dish_id: string;
          id?: string;
          kind?: string;
          name: string;
          position?: number;
          required?: boolean;
        };
        Update: {
          dish_id?: string;
          id?: string;
          kind?: string;
          name?: string;
          position?: number;
          required?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "dish_option_groups_dish_id_fkey";
            columns: ["dish_id"];
            isOneToOne: false;
            referencedRelation: "dishes";
            referencedColumns: ["id"];
          },
        ];
      };
      dish_options: {
        Row: {
          available: boolean;
          group_id: string;
          id: string;
          name: string;
          position: number;
          price_delta_cents: number;
        };
        Insert: {
          available?: boolean;
          group_id: string;
          id?: string;
          name: string;
          position?: number;
          price_delta_cents?: number;
        };
        Update: {
          available?: boolean;
          group_id?: string;
          id?: string;
          name?: string;
          position?: number;
          price_delta_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "dish_options_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "dish_option_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      dishes: {
        Row: {
          available: boolean;
          category: string;
          created_at: string;
          description: string;
          emoji: string;
          id: string;
          image_url: string | null;
          name: string;
          position: number;
          price_cents: number;
          restaurant_id: string;
          slug: string;
        };
        Insert: {
          available?: boolean;
          category: string;
          created_at?: string;
          description?: string;
          emoji?: string;
          id?: string;
          image_url?: string | null;
          name: string;
          position?: number;
          price_cents: number;
          restaurant_id: string;
          slug: string;
        };
        Update: {
          available?: boolean;
          category?: string;
          created_at?: string;
          description?: string;
          emoji?: string;
          id?: string;
          image_url?: string | null;
          name?: string;
          position?: number;
          price_cents?: number;
          restaurant_id?: string;
          slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dishes_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      join_requests: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          restaurant_id: string;
          resolved_at: string | null;
          resolved_by: string | null;
          seat_id: string | null;
          session_id: string | null;
          status: string;
          table_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          restaurant_id: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          seat_id?: string | null;
          session_id?: string | null;
          status?: string;
          table_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          restaurant_id?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          seat_id?: string | null;
          session_id?: string | null;
          status?: string;
          table_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "join_requests_table_id_fkey";
            columns: ["table_id"];
            isOneToOne: false;
            referencedRelation: "dining_tables";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "join_requests_seat_id_fkey";
            columns: ["seat_id"];
            isOneToOne: false;
            referencedRelation: "seats";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          added_by: string | null;
          added_by_staff: boolean;
          base_price_cents: number;
          changed_after_start: boolean;
          created_at: string;
          dish_id: string | null;
          dish_name: string;
          for_name: string | null;
          id: string;
          note: string | null;
          options: Json;
          quantity: number;
          restaurant_id: string;
          seat_id: string | null;
          seat_label: string | null;
          session_id: string;
          status: string;
          unit_price_cents: number;
          updated_at: string;
        };
        Insert: {
          added_by?: string | null;
          added_by_staff?: boolean;
          base_price_cents: number;
          changed_after_start?: boolean;
          created_at?: string;
          dish_id?: string | null;
          dish_name: string;
          for_name?: string | null;
          id?: string;
          note?: string | null;
          options?: Json;
          quantity: number;
          restaurant_id: string;
          seat_id?: string | null;
          seat_label?: string | null;
          session_id: string;
          status?: string;
          unit_price_cents: number;
          updated_at?: string;
        };
        Update: {
          added_by?: string | null;
          added_by_staff?: boolean;
          base_price_cents?: number;
          changed_after_start?: boolean;
          created_at?: string;
          dish_id?: string | null;
          dish_name?: string;
          for_name?: string | null;
          id?: string;
          note?: string | null;
          options?: Json;
          quantity?: number;
          restaurant_id?: string;
          seat_id?: string | null;
          seat_label?: string | null;
          session_id?: string;
          status?: string;
          unit_price_cents?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_dish_id_fkey";
            columns: ["dish_id"];
            isOneToOne: false;
            referencedRelation: "dishes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_seat_id_fkey";
            columns: ["seat_id"];
            isOneToOne: false;
            referencedRelation: "seats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "table_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      restaurant_members: {
        Row: {
          created_at: string;
          restaurant_id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          restaurant_id: string;
          role?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          restaurant_id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_members_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
        ];
      };
      restaurants: {
        Row: {
          manual_rate: number | null;
          manual_rate_at: string | null;
          price_display: string;
          rate_source: string;
          table_security: string;
          manual_join: string;
          address: string | null;
          change_policy: string;
          city: string | null;
          created_at: string;
          description: string;
          id: string;
          identification: string;
          latitude: number | null;
          listed: boolean;
          longitude: number | null;
          name: string;
          ordering_mode: string;
          slug: string;
        };
        Insert: {
          manual_rate?: number | null;
          manual_rate_at?: string | null;
          price_display?: string;
          rate_source?: string;
          table_security?: string;
          manual_join?: string;
          address?: string | null;
          change_policy?: string;
          city?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          identification?: string;
          latitude?: number | null;
          listed?: boolean;
          longitude?: number | null;
          name: string;
          ordering_mode?: string;
          slug: string;
        };
        Update: {
          manual_rate?: number | null;
          manual_rate_at?: string | null;
          price_display?: string;
          rate_source?: string;
          table_security?: string;
          manual_join?: string;
          address?: string | null;
          change_policy?: string;
          city?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          identification?: string;
          latitude?: number | null;
          listed?: boolean;
          longitude?: number | null;
          name?: string;
          ordering_mode?: string;
          slug?: string;
        };
        Relationships: [];
      };
      seats: {
        Row: {
          created_at: string;
          id: string;
          label: string;
          position: number;
          qr_token: string;
          table_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          label: string;
          position?: number;
          qr_token?: string;
          table_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          label?: string;
          position?: number;
          qr_token?: string;
          table_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "seats_table_id_fkey";
            columns: ["table_id"];
            isOneToOne: false;
            referencedRelation: "dining_tables";
            referencedColumns: ["id"];
          },
        ];
      };
      service_requests: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          requested_by: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          restaurant_id: string;
          seat_label: string | null;
          session_id: string;
          table_label: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind: string;
          requested_by?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          restaurant_id: string;
          seat_label?: string | null;
          session_id: string;
          table_label: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          requested_by?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          restaurant_id?: string;
          seat_label?: string | null;
          session_id?: string;
          table_label?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_requests_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_requests_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "table_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      session_participants: {
        Row: {
          display_name: string | null;
          joined_at: string;
          seat_id: string | null;
          session_id: string;
          user_id: string;
        };
        Insert: {
          display_name?: string | null;
          joined_at?: string;
          seat_id?: string | null;
          session_id: string;
          user_id: string;
        };
        Update: {
          display_name?: string | null;
          joined_at?: string;
          seat_id?: string | null;
          session_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "session_participants_seat_id_fkey";
            columns: ["seat_id"];
            isOneToOne: false;
            referencedRelation: "seats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_participants_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "table_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      table_sessions: {
        Row: {
          confirmed: boolean;
          join_code: string;
          closed_at: string | null;
          id: string;
          opened_at: string;
          restaurant_id: string;
          status: string;
          table_id: string | null;
          table_label: string;
        };
        Insert: {
          confirmed?: boolean;
          join_code?: string;
          closed_at?: string | null;
          id?: string;
          opened_at?: string;
          restaurant_id: string;
          status?: string;
          table_id?: string | null;
          table_label: string;
        };
        Update: {
          confirmed?: boolean;
          join_code?: string;
          closed_at?: string | null;
          id?: string;
          opened_at?: string;
          restaurant_id?: string;
          status?: string;
          table_id?: string | null;
          table_label?: string;
        };
        Relationships: [
          {
            foreignKeyName: "table_sessions_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "table_sessions_table_id_fkey";
            columns: ["table_id"];
            isOneToOne: false;
            referencedRelation: "dining_tables";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invites: { Args: never; Returns: number };
      invite_member: {
        Args: { p_email: string; p_restaurant_id: string; p_role: string };
        Returns: string;
      };
      list_team: { Args: { p_restaurant_id: string }; Returns: Json };
      remove_member: {
        Args: { p_restaurant_id: string; p_user_id: string };
        Returns: undefined;
      };
      request_service: {
        Args: { p_kind: string; p_session_id: string };
        Returns: string;
      };
      restaurant_pricing: { Args: { p_restaurant_id: string }; Returns: Json };
      request_item_change: {
        Args: { p_changes: Json; p_item_id: string; p_message: string };
        Returns: string;
      };
      resolve_item_change: {
        Args: { p_accept: boolean; p_request_id: string };
        Returns: undefined;
      };
      resolve_request: { Args: { p_request_id: string }; Returns: undefined };
      revoke_invite: { Args: { p_invite_id: string }; Returns: undefined };
      set_member_role: {
        Args: { p_restaurant_id: string; p_role: string; p_user_id: string };
        Returns: undefined;
      };
      add_items: {
        Args: {
          p_for_name?: string;
          p_items: Json;
          p_seat_id?: string;
          p_session_id: string;
        };
        Returns: string[];
      };
      close_session: { Args: { p_session_id: string }; Returns: undefined };
      create_restaurant: {
        Args: { p_name: string; p_slug: string };
        Returns: string;
      };
      get_session: { Args: { p_session_id: string }; Returns: Json };
      join_session: {
        Args: { p_display_name?: string; p_seat_id?: string; p_token: string };
        Returns: Json;
      };
      cancel_join_request: { Args: { p_request_id: string }; Returns: undefined };
      join_table_manual: {
        Args: { p_code?: string; p_display_name?: string; p_seat_id?: string; p_table_id: string };
        Returns: Json;
      };
      list_tables_for_join: { Args: { p_slug: string }; Returns: Json };
      resolve_join_request: {
        Args: { p_accept: boolean; p_request_id: string };
        Returns: undefined;
      };
      confirm_session: { Args: { p_session_id: string }; Returns: undefined };
      create_session_invite: { Args: { p_session_id: string }; Returns: Json };
      join_with_invite: {
        Args: { p_display_name?: string; p_seat_id?: string; p_token: string };
        Returns: Json;
      };
      list_restaurants: {
        Args: { p_lat?: number; p_limit?: number; p_lng?: number };
        Returns: Json;
      };
      set_items_status: {
        Args: { p_item_ids: string[]; p_status: string };
        Returns: number;
      };
      staff_open_session: { Args: { p_table_id: string }; Returns: string };
      update_item: {
        Args: { p_changes: Json; p_item_id: string };
        Returns: undefined;
      };
      update_participant: {
        Args: {
          p_display_name?: string;
          p_seat_id?: string;
          p_session_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
