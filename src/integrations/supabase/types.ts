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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          admin_password_hash: string
          google_sheet_id: string | null
          google_sheet_tab: string | null
          id: number
          project_tracking_enabled: boolean
          sheet_sync_enabled: boolean
          show_pay_estimates: boolean
        }
        Insert: {
          admin_password_hash: string
          google_sheet_id?: string | null
          google_sheet_tab?: string | null
          id?: number
          project_tracking_enabled?: boolean
          sheet_sync_enabled?: boolean
          show_pay_estimates?: boolean
        }
        Update: {
          admin_password_hash?: string
          google_sheet_id?: string | null
          google_sheet_tab?: string | null
          id?: number
          project_tracking_enabled?: boolean
          sheet_sync_enabled?: boolean
          show_pay_estimates?: boolean
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_kind: string
          actor_label: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_kind: string
          actor_label?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_kind?: string
          actor_label?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      job_sites: {
        Row: {
          address: string
          archived_at: string | null
          created_at: string
          id: string
          kind: string
          label: string
          lat: number
          lng: number
          radius_m: number
        }
        Insert: {
          address: string
          archived_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          label: string
          lat: number
          lng: number
          radius_m?: number
        }
        Update: {
          address?: string
          archived_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          label?: string
          lat?: number
          lng?: number
          radius_m?: number
        }
        Relationships: []
      }
      reimbursements: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          parse_confidence: number | null
          parse_raw: Json | null
          parse_status: string | null
          parsed_at: string | null
          parsed_category: string | null
          parsed_date: string | null
          parsed_job_site_id: string | null
          parsed_subtotal: number | null
          parsed_tax: number | null
          parsed_total: number | null
          parsed_vendor: string | null
          receipt_mime: string | null
          receipt_url: string | null
          sheet_row_id: string | null
          week_start: string
          worker_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          parse_confidence?: number | null
          parse_raw?: Json | null
          parse_status?: string | null
          parsed_at?: string | null
          parsed_category?: string | null
          parsed_date?: string | null
          parsed_job_site_id?: string | null
          parsed_subtotal?: number | null
          parsed_tax?: number | null
          parsed_total?: number | null
          parsed_vendor?: string | null
          receipt_mime?: string | null
          receipt_url?: string | null
          sheet_row_id?: string | null
          week_start: string
          worker_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          parse_confidence?: number | null
          parse_raw?: Json | null
          parse_status?: string | null
          parsed_at?: string | null
          parsed_category?: string | null
          parsed_date?: string | null
          parsed_job_site_id?: string | null
          parsed_subtotal?: number | null
          parsed_tax?: number | null
          parsed_total?: number | null
          parsed_vendor?: string | null
          receipt_mime?: string | null
          receipt_url?: string | null
          sheet_row_id?: string | null
          week_start?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reimbursements_parsed_job_site_id_fkey"
            columns: ["parsed_job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reimbursements_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          clock_in: string
          clock_in_lat: number | null
          clock_in_lng: number | null
          clock_out: string | null
          clock_out_geo_status: string | null
          clock_out_job_site_id: string | null
          clock_out_lat: number | null
          clock_out_lng: number | null
          created_at: string
          created_by: string
          flagged_review: boolean
          geo_status: string | null
          id: string
          job_site_id: string | null
          offsite_reason_code: string | null
          offsite_reason_note: string | null
          planned_job_site_id: string | null
          project: string | null
          worker_id: string
        }
        Insert: {
          clock_in: string
          clock_in_lat?: number | null
          clock_in_lng?: number | null
          clock_out?: string | null
          clock_out_geo_status?: string | null
          clock_out_job_site_id?: string | null
          clock_out_lat?: number | null
          clock_out_lng?: number | null
          created_at?: string
          created_by?: string
          flagged_review?: boolean
          geo_status?: string | null
          id?: string
          job_site_id?: string | null
          offsite_reason_code?: string | null
          offsite_reason_note?: string | null
          planned_job_site_id?: string | null
          project?: string | null
          worker_id: string
        }
        Update: {
          clock_in?: string
          clock_in_lat?: number | null
          clock_in_lng?: number | null
          clock_out?: string | null
          clock_out_geo_status?: string | null
          clock_out_job_site_id?: string | null
          clock_out_lat?: number | null
          clock_out_lng?: number | null
          created_at?: string
          created_by?: string
          flagged_review?: boolean
          geo_status?: string | null
          id?: string
          job_site_id?: string | null
          offsite_reason_code?: string | null
          offsite_reason_note?: string | null
          planned_job_site_id?: string | null
          project?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_clock_out_job_site_id_fkey"
            columns: ["clock_out_job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_planned_job_site_id_fkey"
            columns: ["planned_job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_payouts: {
        Row: {
          actual_paid: number | null
          amount: number
          created_at: string
          hours: number
          id: string
          notes: string | null
          paid_at: string
          paid_by: string | null
          reimbursement_total: number
          tip_amount: number | null
          wages: number
          week_start: string
          worker_id: string
        }
        Insert: {
          actual_paid?: number | null
          amount?: number
          created_at?: string
          hours?: number
          id?: string
          notes?: string | null
          paid_at?: string
          paid_by?: string | null
          reimbursement_total?: number
          tip_amount?: number | null
          wages?: number
          week_start: string
          worker_id: string
        }
        Update: {
          actual_paid?: number | null
          amount?: number
          created_at?: string
          hours?: number
          id?: string
          notes?: string | null
          paid_at?: string
          paid_by?: string | null
          reimbursement_total?: number
          tip_amount?: number | null
          wages?: number
          week_start?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_payouts_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          created_at: string
          hourly_rate: number
          id: string
          name: string
          pin_hash: string
        }
        Insert: {
          created_at?: string
          hourly_rate?: number
          id?: string
          name: string
          pin_hash: string
        }
        Update: {
          created_at?: string
          hourly_rate?: number
          id?: string
          name?: string
          pin_hash?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      hash_password: { Args: { plain: string }; Returns: string }
      verify_hash: { Args: { hash: string; plain: string }; Returns: boolean }
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
