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
          cash_export_enabled: boolean
          cash_export_sheet_id: string | null
          cash_export_tab: string | null
          google_sheet_id: string | null
          google_sheet_tab: string | null
          id: number
          ledger_export_last_sync_at: string | null
          ledger_export_sheet_id: string | null
          project_tracking_enabled: boolean
          sheet_sync_enabled: boolean
          show_pay_estimates: boolean
          worker_export_last_sync_at: string | null
          worker_export_sheet_id: string | null
        }
        Insert: {
          admin_password_hash: string
          cash_export_enabled?: boolean
          cash_export_sheet_id?: string | null
          cash_export_tab?: string | null
          google_sheet_id?: string | null
          google_sheet_tab?: string | null
          id?: number
          ledger_export_last_sync_at?: string | null
          ledger_export_sheet_id?: string | null
          project_tracking_enabled?: boolean
          sheet_sync_enabled?: boolean
          show_pay_estimates?: boolean
          worker_export_last_sync_at?: string | null
          worker_export_sheet_id?: string | null
        }
        Update: {
          admin_password_hash?: string
          cash_export_enabled?: boolean
          cash_export_sheet_id?: string | null
          cash_export_tab?: string | null
          google_sheet_id?: string | null
          google_sheet_tab?: string | null
          id?: number
          ledger_export_last_sync_at?: string | null
          ledger_export_sheet_id?: string | null
          project_tracking_enabled?: boolean
          sheet_sync_enabled?: boolean
          show_pay_estimates?: boolean
          worker_export_last_sync_at?: string | null
          worker_export_sheet_id?: string | null
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
      clients: {
        Row: {
          archived_at: string | null
          created_at: string
          email: string | null
          id: string
          lead_source: string | null
          name: string
          notes: string | null
          phone: string | null
          preferred_contact_method: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lead_source?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          preferred_contact_method?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lead_source?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          preferred_contact_method?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      job_events: {
        Row: {
          body: string | null
          created_at: string
          id: string
          job_id: string
          kind: string
          meta: Json
          occurred_at: string
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          job_id: string
          kind: string
          meta?: Json
          occurred_at?: string
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          job_id?: string
          kind?: string
          meta?: Json
          occurred_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "os_jobs"
            referencedColumns: ["id"]
          },
        ]
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
          project_id: string | null
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
          project_id?: string | null
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
          project_id?: string | null
          radius_m?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_sites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ledger_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_job_events: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          job_id: string
          kind: string
          occurred_at: string
          title: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          job_id: string
          kind: string
          occurred_at?: string
          title: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          job_id?: string
          kind?: string
          occurred_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_job_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ledger_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_jobs: {
        Row: {
          activated_at: string | null
          actual_completion_date: string | null
          actual_start_date: string | null
          address: string
          archived_at: string | null
          assigned_owner: string | null
          budget_cents: number
          client_email: string | null
          client_id: string | null
          client_name: string
          client_phone: string | null
          collected_cents: number
          created_at: string
          delivery_status: string | null
          estimated_value_cents: number
          expected_completion_date: string | null
          expected_start_date: string | null
          expenses_cents: number
          id: string
          lost_reason: string | null
          name: string
          next_action: string | null
          next_action_due_at: string | null
          next_action_owner: string | null
          next_action_status: string
          progress: number
          project_type: string
          property_id: string | null
          sales_stage: string | null
          sales_stage_changed_at: string | null
          scheduled_for: string | null
          status: string
          trades: string[]
          updated_at: string
          workers_on_site: number
        }
        Insert: {
          activated_at?: string | null
          actual_completion_date?: string | null
          actual_start_date?: string | null
          address: string
          archived_at?: string | null
          assigned_owner?: string | null
          budget_cents?: number
          client_email?: string | null
          client_id?: string | null
          client_name: string
          client_phone?: string | null
          collected_cents?: number
          created_at?: string
          delivery_status?: string | null
          estimated_value_cents?: number
          expected_completion_date?: string | null
          expected_start_date?: string | null
          expenses_cents?: number
          id?: string
          lost_reason?: string | null
          name: string
          next_action?: string | null
          next_action_due_at?: string | null
          next_action_owner?: string | null
          next_action_status?: string
          progress?: number
          project_type: string
          property_id?: string | null
          sales_stage?: string | null
          sales_stage_changed_at?: string | null
          scheduled_for?: string | null
          status?: string
          trades?: string[]
          updated_at?: string
          workers_on_site?: number
        }
        Update: {
          activated_at?: string | null
          actual_completion_date?: string | null
          actual_start_date?: string | null
          address?: string
          archived_at?: string | null
          assigned_owner?: string | null
          budget_cents?: number
          client_email?: string | null
          client_id?: string | null
          client_name?: string
          client_phone?: string | null
          collected_cents?: number
          created_at?: string
          delivery_status?: string | null
          estimated_value_cents?: number
          expected_completion_date?: string | null
          expected_start_date?: string | null
          expenses_cents?: number
          id?: string
          lost_reason?: string | null
          name?: string
          next_action?: string | null
          next_action_due_at?: string | null
          next_action_owner?: string | null
          next_action_status?: string
          progress?: number
          project_type?: string
          property_id?: string | null
          sales_stage?: string | null
          sales_stage_changed_at?: string | null
          scheduled_for?: string | null
          status?: string
          trades?: string[]
          updated_at?: string
          workers_on_site?: number
        }
        Relationships: [
          {
            foreignKeyName: "ledger_jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_jobs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      os_jobs: {
        Row: {
          address: string | null
          archived_at: string | null
          budget_cents: number
          client_id: string | null
          collected_cents: number
          created_at: string
          expenses_cents: number
          id: string
          lat: number | null
          lng: number | null
          name: string
          progress: number
          project_type: string | null
          status: string
          trades: string[]
          updated_at: string
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          budget_cents?: number
          client_id?: string | null
          collected_cents?: number
          created_at?: string
          expenses_cents?: number
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          progress?: number
          project_type?: string | null
          status?: string
          trades?: string[]
          updated_at?: string
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          budget_cents?: number
          client_id?: string | null
          collected_cents?: number
          created_at?: string
          expenses_cents?: number
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          progress?: number
          project_type?: string | null
          status?: string
          trades?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "os_jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      project_crew: {
        Row: {
          assigned_at: string
          created_at: string
          id: string
          is_active: boolean | null
          project_id: string
          removed_at: string | null
          role: string | null
          updated_at: string
          worker_id: string
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          project_id: string
          removed_at?: string | null
          role?: string | null
          updated_at?: string
          worker_id: string
        }
        Update: {
          assigned_at?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          project_id?: string
          removed_at?: string | null
          role?: string | null
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_crew_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ledger_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_crew_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      project_documents: {
        Row: {
          created_at: string
          id: string
          kind: string
          project_id: string
          storage_path: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          project_id: string
          storage_path?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          project_id?: string
          storage_path?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ledger_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      project_payments: {
        Row: {
          amount_expected_cents: number
          amount_received_cents: number
          created_at: string
          description: string
          due_date: string | null
          id: string
          method: string | null
          notes: string | null
          project_id: string
          received_date: string | null
          updated_at: string
        }
        Insert: {
          amount_expected_cents?: number
          amount_received_cents?: number
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          project_id: string
          received_date?: string | null
          updated_at?: string
        }
        Update: {
          amount_expected_cents?: number
          amount_received_cents?: number
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          project_id?: string
          received_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ledger_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          dependency_task_id: string | null
          description: string | null
          due_at: string | null
          id: string
          priority: string
          project_id: string
          sort_order: number
          status: string
          task_type: string
          template_item_key: string | null
          template_key: string | null
          title: string
          trade: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          dependency_task_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: string
          project_id: string
          sort_order?: number
          status?: string
          task_type?: string
          template_item_key?: string | null
          template_key?: string | null
          title: string
          trade?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          dependency_task_id?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: string
          project_id?: string
          sort_order?: number
          status?: string
          task_type?: string
          template_item_key?: string | null
          template_key?: string | null
          title?: string
          trade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_dependency_task_id_fkey"
            columns: ["dependency_task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "ledger_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string
          archived_at: string | null
          city: string | null
          client_id: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          postal_code: string | null
          province: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          address: string
          archived_at?: string | null
          city?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          postal_code?: string | null
          province?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          archived_at?: string | null
          city?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          postal_code?: string | null
          province?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      reimbursements: {
        Row: {
          amount: number
          billable_job_site_id: string | null
          created_at: string
          description: string
          id: string
          is_admin_receipt: boolean
          material_type: string
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
          payee_label: string | null
          receipt_mime: string | null
          receipt_url: string | null
          sheet_row_id: string | null
          uploaded_by_admin: boolean
          week_start: string
          worker_id: string | null
        }
        Insert: {
          amount: number
          billable_job_site_id?: string | null
          created_at?: string
          description: string
          id?: string
          is_admin_receipt?: boolean
          material_type?: string
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
          payee_label?: string | null
          receipt_mime?: string | null
          receipt_url?: string | null
          sheet_row_id?: string | null
          uploaded_by_admin?: boolean
          week_start: string
          worker_id?: string | null
        }
        Update: {
          amount?: number
          billable_job_site_id?: string | null
          created_at?: string
          description?: string
          id?: string
          is_admin_receipt?: boolean
          material_type?: string
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
          payee_label?: string | null
          receipt_mime?: string | null
          receipt_url?: string | null
          sheet_row_id?: string | null
          uploaded_by_admin?: boolean
          week_start?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reimbursements_billable_job_site_id_fkey"
            columns: ["billable_job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
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
          assigned_job_site_ids: string[]
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
          assigned_job_site_ids?: string[]
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
          assigned_job_site_ids?: string[]
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
          paid_by_person: string | null
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
          paid_by_person?: string | null
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
          paid_by_person?: string | null
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
          address: string | null
          created_at: string
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          hourly_rate: number
          id: string
          name: string
          phone: string | null
          pin_hash: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          hourly_rate?: number
          id?: string
          name: string
          phone?: string | null
          pin_hash: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          hourly_rate?: number
          id?: string
          name?: string
          phone?: string | null
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
