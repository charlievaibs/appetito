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
      dining_tables: {
        Row: {
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
      order_items: {
        Row: {
          dish_id: string | null;
          dish_name: string;
          id: string;
          order_id: string;
          quantity: number;
          unit_price_cents: number;
        };
        Insert: {
          dish_id?: string | null;
          dish_name: string;
          id?: string;
          order_id: string;
          quantity: number;
          unit_price_cents: number;
        };
        Update: {
          dish_id?: string | null;
          dish_name?: string;
          id?: string;
          order_id?: string;
          quantity?: number;
          unit_price_cents?: number;
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
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          created_at: string;
          diner_name: string | null;
          id: string;
          note: string | null;
          restaurant_id: string;
          seat_id: string | null;
          seat_label: string | null;
          status: string;
          table_id: string | null;
          table_label: string;
          total_cents: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          diner_name?: string | null;
          id?: string;
          note?: string | null;
          restaurant_id: string;
          seat_id?: string | null;
          seat_label?: string | null;
          status?: string;
          table_id?: string | null;
          table_label: string;
          total_cents: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          diner_name?: string | null;
          id?: string;
          note?: string | null;
          restaurant_id?: string;
          seat_id?: string | null;
          seat_label?: string | null;
          status?: string;
          table_id?: string | null;
          table_label?: string;
          total_cents?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_seat_id_fkey";
            columns: ["seat_id"];
            isOneToOne: false;
            referencedRelation: "seats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_table_id_fkey";
            columns: ["table_id"];
            isOneToOne: false;
            referencedRelation: "dining_tables";
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
          created_at: string;
          id: string;
          identification: string;
          name: string;
          ordering_mode: string;
          slug: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          identification?: string;
          name: string;
          ordering_mode?: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          identification?: string;
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_restaurant: {
        Args: { p_name: string; p_slug: string };
        Returns: string;
      };
      get_order: { Args: { p_order_id: string }; Returns: Json };
      place_order: {
        Args: {
          p_diner_name?: string;
          p_items: Json;
          p_note?: string;
          p_seat_id?: string;
          p_token: string;
        };
        Returns: string;
      };
      resolve_qr: { Args: { p_token: string }; Returns: Json };
      staff_place_order: {
        Args: {
          p_diner_name?: string;
          p_items: Json;
          p_note?: string;
          p_seat_id?: string;
          p_table_id: string;
        };
        Returns: string;
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
