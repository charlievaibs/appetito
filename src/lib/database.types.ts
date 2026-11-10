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
          diner_visible: boolean;
          available: boolean;
          group_id: string;
          id: string;
          name: string;
          position: number;
          price_delta_cents: number;
        };
        Insert: {
          diner_visible?: boolean;
          available?: boolean;
          group_id: string;
          id?: string;
          name: string;
          position?: number;
          price_delta_cents?: number;
        };
        Update: {
          diner_visible?: boolean;
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
      api_keys: {
        Row: {
          can_write: boolean;
          created_at: string;
          id: string;
          last_used_at: string | null;
          name: string;
          prefix: string;
          restaurant_id: string;
          revoked_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      inventory_items: {
        Row: {
          active: boolean;
          category: string;
          cost_cents: number;
          created_at: string;
          id: string;
          min_stock: number;
          name: string;
          restaurant_id: string;
          sku: string;
          stock: number;
          unit: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      inventory_movements: {
        Row: {
          created_at: string;
          delta: number;
          id: string;
          item_id: string;
          note: string | null;
          reason: string;
          restaurant_id: string;
          source: string;
          stock_after: number;
          user_id: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
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
      payment_items: {
        Row: { amount_usd_cents: number; item_id: string; payment_id: string; session_id: string };
        Insert: { amount_usd_cents: number; item_id: string; payment_id: string; session_id: string };
        Update: { amount_usd_cents?: number; item_id?: string; payment_id?: string; session_id?: string };
        Relationships: [];
      };
      payments: {
        Row: {
          cash_received_cents: number | null;
          change_given_cents: number | null;
          amount_paid_cents: number;
          amount_usd_cents: number;
          created_at: string;
          created_by: string | null;
          currency: string;
          id: string;
          method: string;
          payer_name: string | null;
          rate: number | null;
          reference: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          restaurant_id: string;
          session_id: string;
          status: string;
        };
        Insert: {
          cash_received_cents?: number | null;
          change_given_cents?: number | null;
          amount_paid_cents: number;
          amount_usd_cents: number;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          method: string;
          payer_name?: string | null;
          rate?: number | null;
          reference?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          restaurant_id: string;
          session_id: string;
          status?: string;
        };
        Update: {
          cash_received_cents?: number | null;
          change_given_cents?: number | null;
          amount_paid_cents?: number;
          amount_usd_cents?: number;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          method?: string;
          payer_name?: string | null;
          rate?: number | null;
          reference?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          restaurant_id?: string;
          session_id?: string;
          status?: string;
        };
        Relationships: [];
      };
      staff_events: {
        Row: { action: string; actor: string | null; created_at: string; detail: Json; id: string; restaurant_id: string; target: string | null };
        Insert: { action: string; actor?: string | null; created_at?: string; detail?: Json; id?: string; restaurant_id: string; target?: string | null };
        Update: { action?: string; actor?: string | null; created_at?: string; detail?: Json; id?: string; restaurant_id?: string; target?: string | null };
        Relationships: [];
      };
      staff_join_links: {
        Row: { active: boolean; code: string; created_at: string; created_by: string | null; expires_at: string; id: string; max_uses: number; restaurant_id: string; role: string; uses: number };
        Insert: { active?: boolean; code: string; created_at?: string; created_by?: string | null; expires_at: string; id?: string; max_uses?: number; restaurant_id: string; role: string; uses?: number };
        Update: { active?: boolean; code?: string; created_at?: string; created_by?: string | null; expires_at?: string; id?: string; max_uses?: number; restaurant_id?: string; role?: string; uses?: number };
        Relationships: [];
      };
      restaurant_members: {
        Row: {
          active: boolean;
          display_name: string | null;
          created_at: string;
          restaurant_id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          display_name?: string | null;
          created_at?: string;
          restaurant_id: string;
          role?: string;
          user_id: string;
        };
        Update: {
          active?: boolean;
          display_name?: string | null;
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
          prices_include_vat: boolean;
          vat_percent: number;
          menu_prices_visible: boolean;
          price_label: string;
          table_close: string;
          payment_instructions: string | null;
          payment_methods: string[];
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
          prices_include_vat?: boolean;
          vat_percent?: number;
          menu_prices_visible?: boolean;
          price_label?: string;
          table_close?: string;
          payment_instructions?: string | null;
          payment_methods?: string[];
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
          prices_include_vat?: boolean;
          vat_percent?: number;
          menu_prices_visible?: boolean;
          price_label?: string;
          table_close?: string;
          payment_instructions?: string | null;
          payment_methods?: string[];
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
          waiter_id: string | null;
          closed_unpaid_cents: number;
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
          waiter_id?: string | null;
          closed_unpaid_cents?: number;
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
          waiter_id?: string | null;
          closed_unpaid_cents?: number;
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
      adjust_inventory: {
        Args: { p_delta: number; p_item_id: string; p_note?: string; p_reason: string };
        Returns: number;
      };
      api_inventory_adjust: {
        Args: { p_delta: number; p_key: string; p_note?: string; p_reason: string; p_sku: string };
        Returns: number;
      };
      api_inventory_list: { Args: { p_key: string }; Returns: Json };
      api_inventory_upsert: { Args: { p_key: string; p_rows: Json }; Returns: Json };
      api_menu_list: { Args: { p_key: string }; Returns: Json };
      api_menu_upsert: { Args: { p_key: string; p_rows: Json }; Returns: Json };
      create_api_key: {
        Args: { p_can_write: boolean; p_name: string; p_restaurant_id: string };
        Returns: string;
      };
      import_inventory: {
        Args: { p_restaurant_id: string; p_rows: Json; p_source?: string };
        Returns: Json;
      };
      import_menu: { Args: { p_restaurant_id: string; p_rows: Json }; Returns: Json };
      revoke_api_key: { Args: { p_key_id: string }; Returns: undefined };
      accept_invites: { Args: never; Returns: number };
      invite_member: {
        Args: { p_email: string; p_restaurant_id: string; p_role: string };
        Returns: string;
      };
      list_team: { Args: { p_restaurant_id: string }; Returns: Json };
      remove_member: {
        Args: { p_confirm: string; p_restaurant_id: string; p_user_id: string };
        Returns: undefined;
      };
      request_service: {
        Args: { p_kind: string; p_session_id: string };
        Returns: string;
      };
      request_payment: {
        Args: { p_item_ids: string[]; p_method: string; p_payer_name?: string; p_reference?: string; p_session_id: string };
        Returns: string;
      };
      staff_record_payment: {
        Args: {
          p_currency?: string;
          p_item_ids: string[];
          p_method: string;
          p_payer_name?: string;
          p_rate?: number;
          p_received?: number;
          p_reference?: string;
          p_session_id: string;
        };
        Returns: string;
      };
      confirm_payment: {
        Args: {
          p_accept: boolean;
          p_currency?: string;
          p_method?: string;
          p_payment_id: string;
          p_rate?: number;
          p_received?: number;
          p_reference?: string;
        };
        Returns: undefined;
      };
      cancel_payment: { Args: { p_payment_id: string }; Returns: undefined };
      create_staff_link: {
        Args: { p_days?: number; p_max_uses?: number; p_restaurant_id: string; p_role: string };
        Returns: Json;
      };
      revoke_staff_link: { Args: { p_link_id: string }; Returns: undefined };
      preview_staff_link: { Args: { p_code: string }; Returns: Json };
      redeem_staff_link: { Args: { p_code: string; p_display_name?: string }; Returns: Json };
      set_my_name: { Args: { p_name: string; p_restaurant_id: string }; Returns: undefined };
      list_staff_names: { Args: { p_restaurant_id: string }; Returns: Json };
      set_member_active: { Args: { p_active: boolean; p_restaurant_id: string; p_user_id: string }; Returns: undefined };
      claim_session: { Args: { p_session_id: string }; Returns: undefined };
      assign_session: { Args: { p_session_id: string; p_user_id: string }; Returns: undefined };
      staff_performance: { Args: { p_from: string; p_restaurant_id: string; p_to: string }; Returns: Json };
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
      close_session: { Args: { p_force?: boolean; p_session_id: string }; Returns: undefined };
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
