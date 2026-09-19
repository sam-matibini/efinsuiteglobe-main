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
      api_idempotency: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          idempotency_key: string
          org_id: string
          response: Json
          status_code: number
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          idempotency_key: string
          org_id: string
          response?: Json
          status_code?: number
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          idempotency_key?: string
          org_id?: string
          response?: Json
          status_code?: number
        }
        Relationships: [
          {
            foreignKeyName: "api_idempotency_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          environment: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          org_id: string
          revoked_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          environment?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          org_id?: string
          revoked_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          environment?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          org_id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_notepad: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          purpose: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          purpose?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          purpose?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_rate_counters: {
        Row: {
          bucket: string
          created_at: string
          hits: number
          id: string
          key_id: string
        }
        Insert: {
          bucket: string
          created_at?: string
          hits?: number
          id?: string
          key_id: string
        }
        Update: {
          bucket?: string
          created_at?: string
          hits?: number
          id?: string
          key_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_rate_counters_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          billing_email: string | null
          city: string | null
          contact_email: string | null
          country: string | null
          created_at: string
          cron_secret: string
          email_from_address: string | null
          email_from_name: string | null
          id: string
          invoice_footer: string | null
          legal_name: string | null
          phone: string | null
          postal_code: string | null
          region: string | null
          registration_number: string | null
          singleton: boolean
          support_email: string | null
          tax_number: string | null
          tax_rate: number
          trading_name: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          billing_email?: string | null
          city?: string | null
          contact_email?: string | null
          country?: string | null
          created_at?: string
          cron_secret?: string
          email_from_address?: string | null
          email_from_name?: string | null
          id?: string
          invoice_footer?: string | null
          legal_name?: string | null
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          registration_number?: string | null
          singleton?: boolean
          support_email?: string | null
          tax_number?: string | null
          tax_rate?: number
          trading_name?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          billing_email?: string | null
          city?: string | null
          contact_email?: string | null
          country?: string | null
          created_at?: string
          cron_secret?: string
          email_from_address?: string | null
          email_from_name?: string | null
          id?: string
          invoice_footer?: string | null
          legal_name?: string | null
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          registration_number?: string | null
          singleton?: boolean
          support_email?: string | null
          tax_number?: string | null
          tax_rate?: number
          trading_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          detail: Json
          entity_id: string | null
          entity_type: string
          id: string
          org_id: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
          org_id?: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_owners: {
        Row: {
          birth_date: string | null
          case_id: string
          control_basis: string | null
          control_role: string | null
          country: string | null
          created_at: string
          effective_pct: number | null
          entity_type: string
          id: string
          is_ubo: boolean
          name: string
          org_id: string
          ownership_pct: number | null
          parent_owner_id: string | null
          screening_status: string
        }
        Insert: {
          birth_date?: string | null
          case_id: string
          control_basis?: string | null
          control_role?: string | null
          country?: string | null
          created_at?: string
          effective_pct?: number | null
          entity_type?: string
          id?: string
          is_ubo?: boolean
          name: string
          org_id?: string
          ownership_pct?: number | null
          parent_owner_id?: string | null
          screening_status?: string
        }
        Update: {
          birth_date?: string | null
          case_id?: string
          control_basis?: string | null
          control_role?: string | null
          country?: string | null
          created_at?: string
          effective_pct?: number | null
          entity_type?: string
          id?: string
          is_ubo?: boolean
          name?: string
          org_id?: string
          ownership_pct?: number | null
          parent_owner_id?: string | null
          screening_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_owners_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_owners_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_owners_parent_owner_id_fkey"
            columns: ["parent_owner_id"]
            isOneToOne: false
            referencedRelation: "business_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      case_addresses: {
        Row: {
          case_id: string
          checks: Json
          city: string | null
          country: string
          created_at: string
          id: string
          line1: string
          line2: string | null
          org_id: string
          postal_code: string | null
          region: string | null
          result: Database["public"]["Enums"]["check_result"]
          source: string
        }
        Insert: {
          case_id: string
          checks?: Json
          city?: string | null
          country?: string
          created_at?: string
          id?: string
          line1: string
          line2?: string | null
          org_id?: string
          postal_code?: string | null
          region?: string | null
          result?: Database["public"]["Enums"]["check_result"]
          source?: string
        }
        Update: {
          case_id?: string
          checks?: Json
          city?: string | null
          country?: string
          created_at?: string
          id?: string
          line1?: string
          line2?: string | null
          org_id?: string
          postal_code?: string | null
          region?: string | null
          result?: Database["public"]["Enums"]["check_result"]
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_addresses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_addresses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      case_checks: {
        Row: {
          case_id: string
          category: string
          checked_at: string
          detail: string | null
          id: string
          name: string
          org_id: string
          result: Database["public"]["Enums"]["check_result"]
          source: string | null
        }
        Insert: {
          case_id: string
          category: string
          checked_at?: string
          detail?: string | null
          id?: string
          name: string
          org_id?: string
          result?: Database["public"]["Enums"]["check_result"]
          source?: string | null
        }
        Update: {
          case_id?: string
          category?: string
          checked_at?: string
          detail?: string | null
          id?: string
          name?: string
          org_id?: string
          result?: Database["public"]["Enums"]["check_result"]
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_checks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_checks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          assigned_to: string | null
          case_type: Database["public"]["Enums"]["case_type"]
          country: string | null
          created_at: string
          created_by: string | null
          decision_note: string | null
          id: string
          org_id: string
          reference: string
          risk_level: Database["public"]["Enums"]["risk_level"]
          risk_score: number
          status: Database["public"]["Enums"]["case_status"]
          subject_name: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          case_type: Database["public"]["Enums"]["case_type"]
          country?: string | null
          created_at?: string
          created_by?: string | null
          decision_note?: string | null
          id?: string
          org_id?: string
          reference: string
          risk_level?: Database["public"]["Enums"]["risk_level"]
          risk_score?: number
          status?: Database["public"]["Enums"]["case_status"]
          subject_name: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          case_type?: Database["public"]["Enums"]["case_type"]
          country?: string | null
          created_at?: string
          created_by?: string | null
          decision_note?: string | null
          id?: string
          org_id?: string
          reference?: string
          risk_level?: Database["public"]["Enums"]["risk_level"]
          risk_score?: number
          status?: Database["public"]["Enums"]["case_status"]
          subject_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      device_signals: {
        Row: {
          case_id: string
          claimed_country: string | null
          created_at: string
          detail: Json
          fingerprint: string | null
          id: string
          ip_address: string | null
          ip_country: string | null
          is_datacenter: boolean
          is_tor: boolean
          is_vpn: boolean
          languages: string[] | null
          org_id: string
          platform: string | null
          repeat_device_cases: number
          screen: string | null
          session_id: string | null
          timezone: string | null
          user_agent: string | null
          velocity_24h: number
        }
        Insert: {
          case_id: string
          claimed_country?: string | null
          created_at?: string
          detail?: Json
          fingerprint?: string | null
          id?: string
          ip_address?: string | null
          ip_country?: string | null
          is_datacenter?: boolean
          is_tor?: boolean
          is_vpn?: boolean
          languages?: string[] | null
          org_id?: string
          platform?: string | null
          repeat_device_cases?: number
          screen?: string | null
          session_id?: string | null
          timezone?: string | null
          user_agent?: string | null
          velocity_24h?: number
        }
        Update: {
          case_id?: string
          claimed_country?: string | null
          created_at?: string
          detail?: Json
          fingerprint?: string | null
          id?: string
          ip_address?: string | null
          ip_country?: string | null
          is_datacenter?: boolean
          is_tor?: boolean
          is_vpn?: boolean
          languages?: string[] | null
          org_id?: string
          platform?: string | null
          repeat_device_cases?: number
          screen?: string | null
          session_id?: string | null
          timezone?: string | null
          user_agent?: string | null
          velocity_24h?: number
        }
        Relationships: [
          {
            foreignKeyName: "device_signals_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_signals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_signals_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "verification_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          birth_date: string | null
          case_id: string
          checks: Json
          created_at: string
          created_by: string | null
          doc_type: string
          document_number: string | null
          expiry_date: string | null
          given_names: string | null
          id: string
          integrity: Json
          issue_date: string | null
          issuing_country: string | null
          issuing_region: string | null
          mrz_raw: string | null
          mrz_valid: boolean | null
          org_id: string
          result: Database["public"]["Enums"]["check_result"]
          session_id: string | null
          storage_path: string | null
          surname: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          case_id: string
          checks?: Json
          created_at?: string
          created_by?: string | null
          doc_type: string
          document_number?: string | null
          expiry_date?: string | null
          given_names?: string | null
          id?: string
          integrity?: Json
          issue_date?: string | null
          issuing_country?: string | null
          issuing_region?: string | null
          mrz_raw?: string | null
          mrz_valid?: boolean | null
          org_id?: string
          result?: Database["public"]["Enums"]["check_result"]
          session_id?: string | null
          storage_path?: string | null
          surname?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          case_id?: string
          checks?: Json
          created_at?: string
          created_by?: string | null
          doc_type?: string
          document_number?: string | null
          expiry_date?: string | null
          given_names?: string | null
          id?: string
          integrity?: Json
          issue_date?: string | null
          issuing_country?: string | null
          issuing_region?: string | null
          mrz_raw?: string | null
          mrz_valid?: boolean | null
          org_id?: string
          result?: Database["public"]["Enums"]["check_result"]
          session_id?: string | null
          storage_path?: string | null
          surname?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "verification_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          created_at: string
          error_detail: string | null
          event: string
          id: string
          org_id: string | null
          provider: string
          provider_id: string | null
          recipient: string
          status: string
          subject: string
        }
        Insert: {
          created_at?: string
          error_detail?: string | null
          event: string
          id?: string
          org_id?: string | null
          provider?: string
          provider_id?: string | null
          recipient: string
          status: string
          subject: string
        }
        Update: {
          created_at?: string
          error_detail?: string | null
          event?: string
          id?: string
          org_id?: string | null
          provider?: string
          provider_id?: string | null
          recipient?: string
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_settings: {
        Row: {
          category: string
          config: Json
          created_at: string
          enabled: boolean
          id: string
          label: string
          last_checked_at: string | null
          last_error: string | null
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          label: string
          last_checked_at?: string | null
          last_error?: string | null
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          label?: string
          last_checked_at?: string | null
          last_error?: string | null
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoice_lines: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          unit_amount: number
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          unit_amount?: number
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          unit_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          due_at: string | null
          id: string
          issued_at: string | null
          notes: string | null
          number: string
          org_id: string
          paid_at: string | null
          period: string
          status: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          due_at?: string | null
          id?: string
          issued_at?: string | null
          notes?: string | null
          number: string
          org_id: string
          paid_at?: string | null
          period: string
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          due_at?: string | null
          id?: string
          issued_at?: string | null
          notes?: string | null
          number?: string
          org_id?: string
          paid_at?: string | null
          period?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_alerts: {
        Row: {
          alert_type: string
          case_id: string
          created_at: string
          detail: string | null
          id: string
          org_id: string
          status: string
        }
        Insert: {
          alert_type: string
          case_id: string
          created_at?: string
          detail?: string | null
          id?: string
          org_id?: string
          status?: string
        }
        Update: {
          alert_type?: string
          case_id?: string
          created_at?: string
          detail?: string | null
          id?: string
          org_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_alerts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitoring_alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          enabled: boolean
          event: string
          id: string
          org_id: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          event: string
          id?: string
          org_id: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          event?: string
          id?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_applications: {
        Row: {
          address_line1: string | null
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          expected_volume: number | null
          id: string
          legal_name: string
          org_id: string
          owners: Json
          postal_code: string | null
          region: string | null
          registration_number: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_note: string | null
          status: string
          submitted_by: string | null
          updated_at: string
          use_case: string | null
          verification: Json
          verification_result: Database["public"]["Enums"]["check_result"]
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          expected_volume?: number | null
          id?: string
          legal_name: string
          org_id: string
          owners?: Json
          postal_code?: string | null
          region?: string | null
          registration_number?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          status?: string
          submitted_by?: string | null
          updated_at?: string
          use_case?: string | null
          verification?: Json
          verification_result?: Database["public"]["Enums"]["check_result"]
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          expected_volume?: number | null
          id?: string
          legal_name?: string
          org_id?: string
          owners?: Json
          postal_code?: string | null
          region?: string | null
          registration_number?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_note?: string | null
          status?: string
          submitted_by?: string | null
          updated_at?: string
          use_case?: string | null
          verification?: Json
          verification_result?: Database["public"]["Enums"]["check_result"]
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_applications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_contracts: {
        Row: {
          accepted_at: string
          accepted_by: string | null
          accepted_email: string | null
          accepted_ip: string | null
          accepted_name: string | null
          created_at: string
          document_path: string | null
          id: string
          method: string
          note: string | null
          org_id: string
          recorded_by: string | null
          status: string
          version: string
        }
        Insert: {
          accepted_at?: string
          accepted_by?: string | null
          accepted_email?: string | null
          accepted_ip?: string | null
          accepted_name?: string | null
          created_at?: string
          document_path?: string | null
          id?: string
          method?: string
          note?: string | null
          org_id: string
          recorded_by?: string | null
          status?: string
          version?: string
        }
        Update: {
          accepted_at?: string
          accepted_by?: string | null
          accepted_email?: string | null
          accepted_ip?: string | null
          accepted_name?: string | null
          created_at?: string
          document_path?: string | null
          id?: string
          method?: string
          note?: string | null
          org_id?: string
          recorded_by?: string | null
          status?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_contracts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_subscriptions: {
        Row: {
          created_at: string
          id: string
          included_volume_override: number | null
          notes: string | null
          org_id: string
          plan_id: string | null
          price_override: number | null
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          included_volume_override?: number | null
          notes?: string | null
          org_id: string
          plan_id?: string | null
          price_override?: number | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          included_volume_override?: number | null
          notes?: string | null
          org_id?: string
          plan_id?: string | null
          price_override?: number | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          org_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          live_access: string
          live_approved_at: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          live_access?: string
          live_approved_at?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          live_access?: string
          live_approved_at?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      plaid_identity_results: {
        Row: {
          bank_addresses: Json
          bank_emails: string[]
          bank_names: string[]
          bank_phones: string[]
          case_id: string
          comparisons: Json
          created_at: string
          created_by: string | null
          id: string
          institution_name: string | null
          item_id: string | null
          org_id: string
          result: Database["public"]["Enums"]["check_result"]
        }
        Insert: {
          bank_addresses?: Json
          bank_emails?: string[]
          bank_names?: string[]
          bank_phones?: string[]
          case_id: string
          comparisons?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          institution_name?: string | null
          item_id?: string | null
          org_id: string
          result?: Database["public"]["Enums"]["check_result"]
        }
        Update: {
          bank_addresses?: Json
          bank_emails?: string[]
          bank_names?: string[]
          bank_phones?: string[]
          case_id?: string
          comparisons?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          institution_name?: string | null
          item_id?: string | null
          org_id?: string
          result?: Database["public"]["Enums"]["check_result"]
        }
        Relationships: [
          {
            foreignKeyName: "plaid_identity_results_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plaid_identity_results_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "plaid_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plaid_identity_results_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plaid_items: {
        Row: {
          access_token: string
          case_id: string
          created_at: string
          created_by: string | null
          cursor: string | null
          environment: string
          id: string
          institution_id: string | null
          institution_name: string | null
          item_id: string
          last_error: string | null
          last_synced_at: string | null
          org_id: string
          status: string
          updated_at: string
        }
        Insert: {
          access_token: string
          case_id: string
          created_at?: string
          created_by?: string | null
          cursor?: string | null
          environment?: string
          id?: string
          institution_id?: string | null
          institution_name?: string | null
          item_id: string
          last_error?: string | null
          last_synced_at?: string | null
          org_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          case_id?: string
          created_at?: string
          created_by?: string | null
          cursor?: string | null
          environment?: string
          id?: string
          institution_id?: string | null
          institution_name?: string | null
          item_id?: string
          last_error?: string | null
          last_synced_at?: string | null
          org_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plaid_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plaid_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          blurb: string | null
          code: string
          created_at: string
          custom_pricing: boolean
          featured: boolean
          features: string[]
          id: string
          included_volume: number
          name: string
          overage_amount: number | null
          price_amount: number | null
          price_currency: string
          price_unit: string
          public_visible: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          blurb?: string | null
          code: string
          created_at?: string
          custom_pricing?: boolean
          featured?: boolean
          features?: string[]
          id?: string
          included_volume?: number
          name: string
          overage_amount?: number | null
          price_amount?: number | null
          price_currency?: string
          price_unit?: string
          public_visible?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          blurb?: string | null
          code?: string
          created_at?: string
          custom_pricing?: boolean
          featured?: boolean
          features?: string[]
          id?: string
          included_volume?: number
          name?: string
          overage_amount?: number | null
          price_amount?: number | null
          price_currency?: string
          price_unit?: string
          public_visible?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_staff: {
        Row: {
          created_at: string
          email: string | null
          id: string
          level: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          level?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          level?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      regulatory_reports: {
        Row: {
          authority: string
          case_id: string | null
          created_at: string
          created_by: string | null
          id: string
          jurisdiction: string
          org_id: string
          payload: Json
          reference: string | null
          report_type: string
          status: string
          submitted_at: string | null
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          authority?: string
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          jurisdiction?: string
          org_id?: string
          payload?: Json
          reference?: string | null
          report_type: string
          status?: string
          submitted_at?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          authority?: string
          case_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          jurisdiction?: string
          org_id?: string
          payload?: Json
          reference?: string | null
          report_type?: string
          status?: string
          submitted_at?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_reports_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_reports_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_factors: {
        Row: {
          case_id: string
          category: string
          code: string
          created_at: string
          detail: string | null
          id: string
          label: string
          org_id: string
          source: string
          weight: number
        }
        Insert: {
          case_id: string
          category: string
          code: string
          created_at?: string
          detail?: string | null
          id?: string
          label: string
          org_id?: string
          source?: string
          weight?: number
        }
        Update: {
          case_id?: string
          category?: string
          code?: string
          created_at?: string
          detail?: string | null
          id?: string
          label?: string
          org_id?: string
          source?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "risk_factors_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_factors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_hits: {
        Row: {
          case_id: string
          category: Database["public"]["Enums"]["hit_category"]
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          detail: string | null
          disposition: Database["public"]["Enums"]["hit_disposition"]
          entity_id: string | null
          id: string
          list_name: string
          list_version: string | null
          match_score: number | null
          matched_name: string
          org_id: string
          reasons: Json
          run_id: string | null
        }
        Insert: {
          case_id: string
          category: Database["public"]["Enums"]["hit_category"]
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          detail?: string | null
          disposition?: Database["public"]["Enums"]["hit_disposition"]
          entity_id?: string | null
          id?: string
          list_name: string
          list_version?: string | null
          match_score?: number | null
          matched_name: string
          org_id?: string
          reasons?: Json
          run_id?: string | null
        }
        Update: {
          case_id?: string
          category?: Database["public"]["Enums"]["hit_category"]
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          detail?: string | null
          disposition?: Database["public"]["Enums"]["hit_disposition"]
          entity_id?: string | null
          id?: string
          list_name?: string
          list_version?: string | null
          match_score?: number | null
          matched_name?: string
          org_id?: string
          reasons?: Json
          run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "screening_hits_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_hits_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "watchlist_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_hits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_hits_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "screening_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_runs: {
        Row: {
          birth_date: string | null
          candidates_examined: number
          case_id: string | null
          country: string | null
          created_at: string
          created_by: string | null
          engine_version: string
          hit_count: number
          id: string
          org_id: string
          subject_name: string
          subject_type: Database["public"]["Enums"]["case_type"]
          threshold: number
        }
        Insert: {
          birth_date?: string | null
          candidates_examined?: number
          case_id?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          engine_version?: string
          hit_count?: number
          id?: string
          org_id?: string
          subject_name: string
          subject_type?: Database["public"]["Enums"]["case_type"]
          threshold?: number
        }
        Update: {
          birth_date?: string | null
          candidates_examined?: number
          case_id?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          engine_version?: string
          hit_count?: number
          id?: string
          org_id?: string
          subject_name?: string
          subject_type?: Database["public"]["Enums"]["case_type"]
          threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "screening_runs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      selfies: {
        Row: {
          case_id: string
          challenge: string | null
          created_at: string
          created_by: string | null
          document_id: string | null
          face_match_score: number | null
          face_match_status: string
          id: string
          liveness_score: number | null
          liveness_signals: Json
          org_id: string
          quality: Json
          result: Database["public"]["Enums"]["check_result"]
          session_id: string | null
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          case_id: string
          challenge?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          face_match_score?: number | null
          face_match_status?: string
          id?: string
          liveness_score?: number | null
          liveness_signals?: Json
          org_id?: string
          quality?: Json
          result?: Database["public"]["Enums"]["check_result"]
          session_id?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          case_id?: string
          challenge?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          face_match_score?: number | null
          face_match_status?: string
          id?: string
          liveness_score?: number | null
          liveness_signals?: Json
          org_id?: string
          quality?: Json
          result?: Database["public"]["Enums"]["check_result"]
          session_id?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "selfies_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selfies_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selfies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "selfies_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "verification_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      thekyb_profiles: {
        Row: {
          aml_hits: Json
          aml_match_status: string | null
          aml_request_id: string | null
          case_id: string
          company_name: string
          company_status: string | null
          company_type: string | null
          country_code: string | null
          created_at: string
          created_by: string | null
          fetch_status: string | null
          id: string
          kyb_request_id: string | null
          kyb_response_id: string | null
          org_id: string
          profile: Json
          registration_number: string | null
          risk_level: string | null
          updated_at: string
          verification_status: string | null
        }
        Insert: {
          aml_hits?: Json
          aml_match_status?: string | null
          aml_request_id?: string | null
          case_id: string
          company_name: string
          company_status?: string | null
          company_type?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          fetch_status?: string | null
          id?: string
          kyb_request_id?: string | null
          kyb_response_id?: string | null
          org_id?: string
          profile?: Json
          registration_number?: string | null
          risk_level?: string | null
          updated_at?: string
          verification_status?: string | null
        }
        Update: {
          aml_hits?: Json
          aml_match_status?: string | null
          aml_request_id?: string | null
          case_id?: string
          company_name?: string
          company_status?: string | null
          company_type?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          fetch_status?: string | null
          id?: string
          kyb_request_id?: string | null
          kyb_response_id?: string | null
          org_id?: string
          profile?: Json
          registration_number?: string | null
          risk_level?: string | null
          updated_at?: string
          verification_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "thekyb_profiles_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thekyb_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_alerts: {
        Row: {
          case_id: string
          citation: string | null
          created_at: string
          detail: string | null
          id: string
          org_id: string
          rule_code: string
          rule_name: string
          severity: string
          status: string
          transaction_id: string
        }
        Insert: {
          case_id: string
          citation?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          org_id?: string
          rule_code: string
          rule_name: string
          severity?: string
          status?: string
          transaction_id: string
        }
        Update: {
          case_id?: string
          citation?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          org_id?: string
          rule_code?: string
          rule_name?: string
          severity?: string
          status?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_alerts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_alerts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          amount_cad: number
          case_id: string
          channel: string
          counterparty_account: string | null
          counterparty_country: string | null
          counterparty_name: string | null
          created_at: string
          created_by: string | null
          currency: string
          detail: Json
          direction: string
          external_id: string | null
          id: string
          method: string
          occurred_at: string
          org_id: string
          risk_score: number
          status: string
        }
        Insert: {
          amount: number
          amount_cad: number
          case_id: string
          channel?: string
          counterparty_account?: string | null
          counterparty_country?: string | null
          counterparty_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          detail?: Json
          direction?: string
          external_id?: string | null
          id?: string
          method?: string
          occurred_at?: string
          org_id?: string
          risk_score?: number
          status?: string
        }
        Update: {
          amount?: number
          amount_cad?: number
          case_id?: string
          channel?: string
          counterparty_account?: string | null
          counterparty_country?: string | null
          counterparty_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          detail?: Json
          direction?: string
          external_id?: string | null
          id?: string
          method?: string
          occurred_at?: string
          org_id?: string
          risk_score?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          id: string
          org_id: string
          period: string
          screenings: number
          transactions: number
          updated_at: string
          verifications: number
        }
        Insert: {
          id?: string
          org_id: string
          period: string
          screenings?: number
          transactions?: number
          updated_at?: string
          verifications?: number
        }
        Update: {
          id?: string
          org_id?: string
          period?: string
          screenings?: number
          transactions?: number
          updated_at?: string
          verifications?: number
        }
        Relationships: [
          {
            foreignKeyName: "usage_counters_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      verification_sessions: {
        Row: {
          case_id: string
          channel: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          org_id: string
          redirect_url: string | null
          status: string
          token_hash: string | null
          updated_at: string
          used_at: string | null
        }
        Insert: {
          case_id: string
          channel?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          org_id?: string
          redirect_url?: string | null
          status?: string
          token_hash?: string | null
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          case_id?: string
          channel?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          org_id?: string
          redirect_url?: string | null
          status?: string
          token_hash?: string | null
          updated_at?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_sessions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist_entities: {
        Row: {
          aliases: string[]
          birth_date: string | null
          content_hash: string
          countries: string[]
          created_at: string
          entity_schema: string
          external_id: string
          id: string
          identifiers: string | null
          last_change: string | null
          name: string
          name_norm: string
          programs: string | null
          removed_at: string | null
          source_id: string
          updated_at: string
          version_id: string | null
        }
        Insert: {
          aliases?: string[]
          birth_date?: string | null
          content_hash: string
          countries?: string[]
          created_at?: string
          entity_schema?: string
          external_id: string
          id?: string
          identifiers?: string | null
          last_change?: string | null
          name: string
          name_norm: string
          programs?: string | null
          removed_at?: string | null
          source_id: string
          updated_at?: string
          version_id?: string | null
        }
        Update: {
          aliases?: string[]
          birth_date?: string | null
          content_hash?: string
          countries?: string[]
          created_at?: string
          entity_schema?: string
          external_id?: string
          id?: string
          identifiers?: string | null
          last_change?: string | null
          name?: string
          name_norm?: string
          programs?: string | null
          removed_at?: string | null
          source_id?: string
          updated_at?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_entities_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "watchlist_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_entities_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "watchlist_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist_names: {
        Row: {
          entity_id: string
          id: number
          kind: string
          name: string
          name_norm: string
          source_id: string
        }
        Insert: {
          entity_id: string
          id?: number
          kind?: string
          name: string
          name_norm: string
          source_id: string
        }
        Update: {
          entity_id?: string
          id?: number
          kind?: string
          name?: string
          name_norm?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_names_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "watchlist_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_names_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "watchlist_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist_sources: {
        Row: {
          category: Database["public"]["Enums"]["hit_category"]
          code: string
          created_at: string
          enabled: boolean
          entity_count: number
          feed_url: string
          homepage: string | null
          id: string
          jurisdiction: string | null
          last_refreshed_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["hit_category"]
          code: string
          created_at?: string
          enabled?: boolean
          entity_count?: number
          feed_url: string
          homepage?: string | null
          id?: string
          jurisdiction?: string | null
          last_refreshed_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["hit_category"]
          code?: string
          created_at?: string
          enabled?: boolean
          entity_count?: number
          feed_url?: string
          homepage?: string | null
          id?: string
          jurisdiction?: string | null
          last_refreshed_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      watchlist_versions: {
        Row: {
          added_count: number
          changed_count: number
          completed_at: string | null
          error_detail: string | null
          id: string
          removed_count: number
          row_count: number
          source_id: string
          started_at: string
          status: string
          version_label: string
        }
        Insert: {
          added_count?: number
          changed_count?: number
          completed_at?: string | null
          error_detail?: string | null
          id?: string
          removed_count?: number
          row_count?: number
          source_id: string
          started_at?: string
          status?: string
          version_label: string
        }
        Update: {
          added_count?: number
          changed_count?: number
          completed_at?: string | null
          error_detail?: string | null
          id?: string
          removed_count?: number
          row_count?: number
          source_id?: string
          started_at?: string
          status?: string
          version_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_versions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "watchlist_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          endpoint_id: string
          error_detail: string | null
          event: string
          id: string
          org_id: string
          payload: Json
          response_code: number | null
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          endpoint_id: string
          error_detail?: string | null
          event: string
          id?: string
          org_id?: string
          payload?: Json
          response_code?: number | null
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          endpoint_id?: string
          error_detail?: string | null
          event?: string
          id?: string
          org_id?: string
          payload?: Json
          response_code?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean
          environment: string
          events: string[]
          id: string
          org_id: string
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          environment?: string
          events?: string[]
          id?: string
          org_id?: string
          secret: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          environment?: string
          events?: string[]
          id?: string
          org_id?: string
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bump_rate: { Args: { _bucket: string; _key: string }; Returns: number }
      bump_usage: {
        Args: { _amount?: number; _kind: string; _org: string }
        Returns: undefined
      }
      caller_org_id: { Args: never; Returns: string }
      can_write: { Args: { _user_id: string }; Returns: boolean }
      can_write_org: { Args: { _org: string }; Returns: boolean }
      current_org_ids: { Args: never; Returns: string[] }
      has_any_role: { Args: { _user_id: string }; Returns: boolean }
      has_org_role: {
        Args: { _org: string; _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: { Args: { _org: string }; Returns: boolean }
      is_platform_staff: { Args: never; Returns: boolean }
      match_watchlist_names: {
        Args: { _limit?: number; _q: string; _threshold?: number }
        Returns: {
          entity_id: string
          kind: string
          matched_name: string
          matched_norm: string
          sim: number
          source_id: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "analyst" | "viewer"
      case_status: "pending" | "in_review" | "approved" | "rejected"
      case_type: "person" | "business"
      check_result: "pass" | "fail" | "review" | "not_run"
      hit_category: "sanctions" | "pep" | "rca" | "watchlist" | "adverse_media"
      hit_disposition: "open" | "true_positive" | "false_positive"
      risk_level: "low" | "medium" | "high"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "analyst", "viewer"],
      case_status: ["pending", "in_review", "approved", "rejected"],
      case_type: ["person", "business"],
      check_result: ["pass", "fail", "review", "not_run"],
      hit_category: ["sanctions", "pep", "rca", "watchlist", "adverse_media"],
      hit_disposition: ["open", "true_positive", "false_positive"],
      risk_level: ["low", "medium", "high"],
    },
  },
} as const
