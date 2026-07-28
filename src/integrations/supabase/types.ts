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
      account_aliases: {
        Row: {
          account_id: string
          alias_code: string
          alias_name: string | null
          created_at: string
          id: string
          is_active: boolean | null
          organization_id: string
          source_system: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          alias_code: string
          alias_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          organization_id: string
          source_system?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          alias_code?: string
          alias_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          organization_id?: string
          source_system?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_aliases_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_aliases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      accountant_delegations: {
        Row: {
          created_at: string
          delegated_user_id: string
          expires_at: string | null
          granted_by: string | null
          id: string
          notes: string | null
          organization_id: string
          revoked_at: string | null
          revoked_reason: string | null
          scope: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          delegated_user_id: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          revoked_at?: string | null
          revoked_reason?: string | null
          scope?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          delegated_user_id?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          scope?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accountant_delegations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_class: string | null
          account_group: string | null
          account_sub_group: string | null
          account_type: Database["public"]["Enums"]["account_type"]
          cash_flow_category: string | null
          closes_to_account_id: string | null
          code: string
          created_at: string
          current_balance: number | null
          description: string | null
          equity_category: string | null
          equity_type: Database["public"]["Enums"]["equity_type"] | null
          id: string
          is_active: boolean
          is_current: boolean | null
          is_header: boolean
          name: string
          normal_balance: string
          opening_balance: number | null
          organization_id: string | null
          parent_id: string | null
          posting_allowed: boolean | null
          t3010_category: string | null
          updated_at: string
        }
        Insert: {
          account_class?: string | null
          account_group?: string | null
          account_sub_group?: string | null
          account_type: Database["public"]["Enums"]["account_type"]
          cash_flow_category?: string | null
          closes_to_account_id?: string | null
          code: string
          created_at?: string
          current_balance?: number | null
          description?: string | null
          equity_category?: string | null
          equity_type?: Database["public"]["Enums"]["equity_type"] | null
          id?: string
          is_active?: boolean
          is_current?: boolean | null
          is_header?: boolean
          name: string
          normal_balance?: string
          opening_balance?: number | null
          organization_id?: string | null
          parent_id?: string | null
          posting_allowed?: boolean | null
          t3010_category?: string | null
          updated_at?: string
        }
        Update: {
          account_class?: string | null
          account_group?: string | null
          account_sub_group?: string | null
          account_type?: Database["public"]["Enums"]["account_type"]
          cash_flow_category?: string | null
          closes_to_account_id?: string | null
          code?: string
          created_at?: string
          current_balance?: number | null
          description?: string | null
          equity_category?: string | null
          equity_type?: Database["public"]["Enums"]["equity_type"] | null
          id?: string
          is_active?: boolean
          is_current?: boolean | null
          is_header?: boolean
          name?: string
          normal_balance?: string
          opening_balance?: number | null
          organization_id?: string | null
          parent_id?: string | null
          posting_allowed?: boolean | null
          t3010_category?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_closes_to_account_id_fkey"
            columns: ["closes_to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_categorization_applications: {
        Row: {
          applied_at: string
          confidence: number | null
          context: string
          feedback_id: string | null
          id: string
          new_value: Json
          organization_id: string
          prior_value: Json | null
          reasoning: string | null
          row_id: string
          source: string | null
          target: string
          undone_at: string | null
          undone_by: string | null
        }
        Insert: {
          applied_at?: string
          confidence?: number | null
          context: string
          feedback_id?: string | null
          id?: string
          new_value: Json
          organization_id: string
          prior_value?: Json | null
          reasoning?: string | null
          row_id: string
          source?: string | null
          target: string
          undone_at?: string | null
          undone_by?: string | null
        }
        Update: {
          applied_at?: string
          confidence?: number | null
          context?: string
          feedback_id?: string | null
          id?: string
          new_value?: Json
          organization_id?: string
          prior_value?: Json | null
          reasoning?: string | null
          row_id?: string
          source?: string | null
          target?: string
          undone_at?: string | null
          undone_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_categorization_applications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_categorization_feedback: {
        Row: {
          accepted: boolean | null
          confidence: number | null
          context: string
          created_at: string
          created_by: string | null
          desc_key: string | null
          final_account_id: string | null
          id: string
          line_id: string
          organization_id: string
          source: string | null
          suggested_account_id: string | null
          target: string
          vendor_key: string | null
        }
        Insert: {
          accepted?: boolean | null
          confidence?: number | null
          context: string
          created_at?: string
          created_by?: string | null
          desc_key?: string | null
          final_account_id?: string | null
          id?: string
          line_id: string
          organization_id: string
          source?: string | null
          suggested_account_id?: string | null
          target: string
          vendor_key?: string | null
        }
        Update: {
          accepted?: boolean | null
          confidence?: number | null
          context?: string
          created_at?: string
          created_by?: string | null
          desc_key?: string | null
          final_account_id?: string | null
          id?: string
          line_id?: string
          organization_id?: string
          source?: string | null
          suggested_account_id?: string | null
          target?: string
          vendor_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_categorization_feedback_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_categorization_settings: {
        Row: {
          auto_apply_enabled: boolean
          auto_apply_scopes: string[]
          auto_apply_threshold: number
          created_at: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          auto_apply_enabled?: boolean
          auto_apply_scopes?: string[]
          auto_apply_threshold?: number
          created_at?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          auto_apply_enabled?: boolean
          auto_apply_scopes?: string[]
          auto_apply_threshold?: number
          created_at?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_categorization_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_financial_tools: {
        Row: {
          ai_insights: Json | null
          created_at: string | null
          created_by: string
          id: string
          inputs: Json
          name: string
          organization_id: string
          results: Json
          tool_type: string
          updated_at: string | null
        }
        Insert: {
          ai_insights?: Json | null
          created_at?: string | null
          created_by: string
          id?: string
          inputs: Json
          name: string
          organization_id: string
          results: Json
          tool_type: string
          updated_at?: string | null
        }
        Update: {
          ai_insights?: Json | null
          created_at?: string | null
          created_by?: string
          id?: string
          inputs?: Json
          name?: string
          organization_id?: string
          results?: Json
          tool_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_financial_tools_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_formula_cache: {
        Row: {
          args_hash: string
          confidence: number | null
          created_at: string
          formula: string
          organization_id: string
          value: Json
        }
        Insert: {
          args_hash: string
          confidence?: number | null
          created_at?: string
          formula: string
          organization_id: string
          value: Json
        }
        Update: {
          args_hash?: string
          confidence?: number | null
          created_at?: string
          formula?: string
          organization_id?: string
          value?: Json
        }
        Relationships: []
      }
      ai_setup_logs: {
        Row: {
          applied_value: Json | null
          confidence_score: number | null
          created_at: string | null
          detected_value: Json | null
          id: string
          organization_id: string
          overridden_by: string | null
          override_reason: string | null
          setup_type: string
          was_overridden: boolean | null
        }
        Insert: {
          applied_value?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          detected_value?: Json | null
          id?: string
          organization_id: string
          overridden_by?: string | null
          override_reason?: string | null
          setup_type: string
          was_overridden?: boolean | null
        }
        Update: {
          applied_value?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          detected_value?: Json | null
          id?: string
          organization_id?: string
          overridden_by?: string | null
          override_reason?: string | null
          setup_type?: string
          was_overridden?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_setup_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_sheets_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          organization_id: string
          session_id: string
          sheet_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          organization_id: string
          session_id?: string
          sheet_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          organization_id?: string
          session_id?: string
          sheet_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_sheets_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      allocation_rule_targets: {
        Row: {
          created_at: string
          driver_metric: string | null
          id: string
          rule_id: string
          target_department_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          driver_metric?: string | null
          id?: string
          rule_id: string
          target_department_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          driver_metric?: string | null
          id?: string
          rule_id?: string
          target_department_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "allocation_rule_targets_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "allocation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_rule_targets_target_department_id_fkey"
            columns: ["target_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      allocation_rules: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          frequency: string
          id: string
          is_active: boolean
          method: string
          name: string
          organization_id: string
          source_account_id: string | null
          source_department_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          method: string
          name: string
          organization_id: string
          source_account_id?: string | null
          source_department_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          method?: string
          name?: string
          organization_id?: string
          source_account_id?: string | null
          source_department_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocation_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_rules_source_account_id_fkey"
            columns: ["source_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_rules_source_department_id_fkey"
            columns: ["source_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      allocation_run_lines: {
        Row: {
          account_id: string
          allocated_amount: number
          created_at: string
          driver_value: number | null
          id: string
          run_id: string
          source_amount: number
          source_department_id: string | null
          target_department_id: string
        }
        Insert: {
          account_id: string
          allocated_amount?: number
          created_at?: string
          driver_value?: number | null
          id?: string
          run_id: string
          source_amount?: number
          source_department_id?: string | null
          target_department_id: string
        }
        Update: {
          account_id?: string
          allocated_amount?: number
          created_at?: string
          driver_value?: number | null
          id?: string
          run_id?: string
          source_amount?: number
          source_department_id?: string | null
          target_department_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocation_run_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_run_lines_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "allocation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_run_lines_source_department_id_fkey"
            columns: ["source_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_run_lines_target_department_id_fkey"
            columns: ["target_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      allocation_runs: {
        Row: {
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          journal_entry_id: string | null
          notes: string | null
          organization_id: string
          period_end: string
          period_start: string
          reversal_journal_entry_id: string | null
          rule_id: string | null
          status: string
          total_allocated: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          organization_id: string
          period_end: string
          period_start: string
          reversal_journal_entry_id?: string | null
          rule_id?: string | null
          status?: string
          total_allocated?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          organization_id?: string
          period_end?: string
          period_start?: string
          reversal_journal_entry_id?: string | null
          rule_id?: string | null
          status?: string
          total_allocated?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocation_runs_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "allocation_runs_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_runs_reversal_journal_entry_id_fkey"
            columns: ["reversal_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "allocation_runs_reversal_journal_entry_id_fkey"
            columns: ["reversal_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_runs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "allocation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      allocation_schedules: {
        Row: {
          active: boolean
          created_at: string
          day_of_period: number
          frequency: string
          id: string
          last_run_at: string | null
          last_run_error: string | null
          last_run_status: string | null
          next_run_at: string
          notes: string | null
          organization_id: string
          rule_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          day_of_period?: number
          frequency: string
          id?: string
          last_run_at?: string | null
          last_run_error?: string | null
          last_run_status?: string | null
          next_run_at?: string
          notes?: string | null
          organization_id: string
          rule_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          day_of_period?: number
          frequency?: string
          id?: string
          last_run_at?: string | null
          last_run_error?: string | null
          last_run_status?: string | null
          next_run_at?: string
          notes?: string | null
          organization_id?: string
          rule_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocation_schedules_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "allocation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      ap_payment_batch_items: {
        Row: {
          amount: number
          batch_id: string
          bill_id: string | null
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          journal_entry_id: string | null
          metadata: Json | null
          provider_transfer_id: string | null
          rail: string | null
          status: string
          updated_at: string
          vendor_id: string | null
          vendor_payment_id: string | null
        }
        Insert: {
          amount: number
          batch_id: string
          bill_id?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          journal_entry_id?: string | null
          metadata?: Json | null
          provider_transfer_id?: string | null
          rail?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string | null
          vendor_payment_id?: string | null
        }
        Update: {
          amount?: number
          batch_id?: string
          bill_id?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          journal_entry_id?: string | null
          metadata?: Json | null
          provider_transfer_id?: string | null
          rail?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string | null
          vendor_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ap_payment_batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "ap_payment_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_payment_batch_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_payment_batch_items_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "ap_payment_batch_items_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_payment_batch_items_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      ap_payment_batches: {
        Row: {
          approval_state: string
          approved_at: string | null
          approved_by: string | null
          batch_number: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          funding_bank_account_id: string | null
          id: string
          metadata: Json | null
          notes: string | null
          organization_id: string
          originator_id: string | null
          pay_date: string
          provider: string
          provider_batch_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          approval_state?: string
          approved_at?: string | null
          approved_by?: string | null
          batch_number: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          funding_bank_account_id?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          organization_id: string
          originator_id?: string | null
          pay_date?: string
          provider?: string
          provider_batch_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          approval_state?: string
          approved_at?: string | null
          approved_by?: string | null
          batch_number?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          funding_bank_account_id?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          organization_id?: string
          originator_id?: string | null
          pay_date?: string
          provider?: string
          provider_batch_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ap_payment_batches_funding_bank_account_id_fkey"
            columns: ["funding_bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_payment_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_actions: {
        Row: {
          action: string
          action_at: string
          action_by: string
          approval_request_id: string
          comments: string | null
          created_at: string
          id: string
          step_order: number
        }
        Insert: {
          action: string
          action_at?: string
          action_by: string
          approval_request_id: string
          comments?: string | null
          created_at?: string
          id?: string
          step_order: number
        }
        Update: {
          action?: string
          action_at?: string
          action_by?: string
          approval_request_id?: string
          comments?: string | null
          created_at?: string
          id?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "approval_actions_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: number
          document_id: string
          document_type: string
          id: string
          organization_id: string | null
          requested_at: string
          requested_by: string
          status: string
          updated_at: string
          workflow_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          document_id: string
          document_type: string
          id?: string
          organization_id?: string | null
          requested_at?: string
          requested_by: string
          status?: string
          updated_at?: string
          workflow_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          document_id?: string
          document_type?: string
          id?: string
          organization_id?: string | null
          requested_at?: string
          requested_by?: string
          status?: string
          updated_at?: string
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "approval_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_workflow_steps: {
        Row: {
          approver_id: string | null
          approver_type: string
          created_at: string
          id: string
          max_amount: number | null
          min_amount: number | null
          requires_all: boolean
          step_order: number
          workflow_id: string
        }
        Insert: {
          approver_id?: string | null
          approver_type: string
          created_at?: string
          id?: string
          max_amount?: number | null
          min_amount?: number | null
          requires_all?: boolean
          step_order: number
          workflow_id: string
        }
        Update: {
          approver_id?: string | null
          approver_type?: string
          created_at?: string
          id?: string
          max_amount?: number | null
          min_amount?: number | null
          requires_all?: boolean
          step_order?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "approval_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_workflows: {
        Row: {
          created_at: string
          document_type: string
          id: string
          is_active: boolean
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_type: string
          id?: string
          is_active?: boolean
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_type?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_workflows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_audit_trail: {
        Row: {
          action: string
          asset_id: string
          details: Json | null
          field_changed: string | null
          id: string
          ip_address: string | null
          new_value: string | null
          old_value: string | null
          performed_at: string
          performed_by: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          asset_id: string
          details?: Json | null
          field_changed?: string | null
          id?: string
          ip_address?: string | null
          new_value?: string | null
          old_value?: string | null
          performed_at?: string
          performed_by?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          asset_id?: string
          details?: Json | null
          field_changed?: string | null
          id?: string
          ip_address?: string | null
          new_value?: string | null
          old_value?: string | null
          performed_at?: string
          performed_by?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_audit_trail_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "fixed_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_disposals: {
        Row: {
          accumulated_dep_at_disposal: number
          approved_at: string | null
          approved_by: string | null
          asset_id: string
          book_value_at_disposal: number
          buyer_name: string | null
          buyer_reference: string | null
          costs_of_disposal: number | null
          created_at: string
          created_by: string | null
          depreciation_journal_entry_id: string | null
          disposal_date: string
          disposal_type: string
          final_depreciation_amount: number | null
          gain_loss: number
          id: string
          journal_entry_id: string | null
          net_proceeds: number | null
          notes: string | null
          proceeds: number | null
        }
        Insert: {
          accumulated_dep_at_disposal: number
          approved_at?: string | null
          approved_by?: string | null
          asset_id: string
          book_value_at_disposal: number
          buyer_name?: string | null
          buyer_reference?: string | null
          costs_of_disposal?: number | null
          created_at?: string
          created_by?: string | null
          depreciation_journal_entry_id?: string | null
          disposal_date: string
          disposal_type: string
          final_depreciation_amount?: number | null
          gain_loss: number
          id?: string
          journal_entry_id?: string | null
          net_proceeds?: number | null
          notes?: string | null
          proceeds?: number | null
        }
        Update: {
          accumulated_dep_at_disposal?: number
          approved_at?: string | null
          approved_by?: string | null
          asset_id?: string
          book_value_at_disposal?: number
          buyer_name?: string | null
          buyer_reference?: string | null
          costs_of_disposal?: number | null
          created_at?: string
          created_by?: string | null
          depreciation_journal_entry_id?: string | null
          disposal_date?: string
          disposal_type?: string
          final_depreciation_amount?: number | null
          gain_loss?: number
          id?: string
          journal_entry_id?: string | null
          net_proceeds?: number | null
          notes?: string | null
          proceeds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_disposals_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "fixed_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_disposals_depreciation_journal_entry_id_fkey"
            columns: ["depreciation_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "asset_disposals_depreciation_journal_entry_id_fkey"
            columns: ["depreciation_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_disposals_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "asset_disposals_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_movements: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          asset_id: string
          created_at: string
          created_by: string | null
          from_custodian: string | null
          from_department: string | null
          from_location: string | null
          id: string
          movement_date: string
          movement_type: string
          notes: string | null
          reason: string | null
          to_custodian: string | null
          to_department: string | null
          to_location: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          asset_id: string
          created_at?: string
          created_by?: string | null
          from_custodian?: string | null
          from_department?: string | null
          from_location?: string | null
          id?: string
          movement_date?: string
          movement_type: string
          notes?: string | null
          reason?: string | null
          to_custodian?: string | null
          to_department?: string | null
          to_location?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          asset_id?: string
          created_at?: string
          created_by?: string | null
          from_custodian?: string | null
          from_department?: string | null
          from_location?: string | null
          id?: string
          movement_date?: string
          movement_type?: string
          notes?: string | null
          reason?: string | null
          to_custodian?: string | null
          to_department?: string | null
          to_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_movements_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "fixed_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_revaluations: {
        Row: {
          adjustment_amount: number
          appraiser_name: string | null
          appraiser_reference: string | null
          approved_at: string | null
          approved_by: string | null
          asset_id: string
          created_at: string
          created_by: string | null
          id: string
          journal_entry_id: string | null
          new_book_value: number
          notes: string | null
          old_book_value: number
          revaluation_date: string
          revaluation_type: string
        }
        Insert: {
          adjustment_amount: number
          appraiser_name?: string | null
          appraiser_reference?: string | null
          approved_at?: string | null
          approved_by?: string | null
          asset_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          journal_entry_id?: string | null
          new_book_value: number
          notes?: string | null
          old_book_value: number
          revaluation_date: string
          revaluation_type: string
        }
        Update: {
          adjustment_amount?: number
          appraiser_name?: string | null
          appraiser_reference?: string | null
          approved_at?: string | null
          approved_by?: string | null
          asset_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          journal_entry_id?: string | null
          new_book_value?: number
          notes?: string | null
          old_book_value?: number
          revaluation_date?: string
          revaluation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_revaluations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "fixed_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_revaluations_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "asset_revaluations_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          organization_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          organization_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      auditor_export_runs: {
        Row: {
          bundle_path: string | null
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          organization_id: string
          period_end: string
          period_start: string
          requested_by: string | null
          status: string
        }
        Insert: {
          bundle_path?: string | null
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          organization_id: string
          period_end: string
          period_start: string
          requested_by?: string | null
          status?: string
        }
        Update: {
          bundle_path?: string | null
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          organization_id?: string
          period_end?: string
          period_start?: string
          requested_by?: string | null
          status?: string
        }
        Relationships: []
      }
      auditor_portal_sessions: {
        Row: {
          actions_count: number
          auditor_user_id: string | null
          delegation_id: string
          ended_at: string | null
          id: string
          ip_address: unknown
          organization_id: string
          scopes_used: string[]
          started_at: string
          user_agent: string | null
        }
        Insert: {
          actions_count?: number
          auditor_user_id?: string | null
          delegation_id: string
          ended_at?: string | null
          id?: string
          ip_address?: unknown
          organization_id: string
          scopes_used?: string[]
          started_at?: string
          user_agent?: string | null
        }
        Update: {
          actions_count?: number
          auditor_user_id?: string | null
          delegation_id?: string
          ended_at?: string | null
          id?: string
          ip_address?: unknown
          organization_id?: string
          scopes_used?: string[]
          started_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      bank_account_stripe_connect: {
        Row: {
          bank_account_id: string
          connected_account_id: string
          created_at: string
          id: string
          is_default: boolean | null
          organization_id: string
        }
        Insert: {
          bank_account_id: string
          connected_account_id: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          organization_id: string
        }
        Update: {
          bank_account_id?: string
          connected_account_id?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_account_stripe_connect_connected_account_id_fkey"
            columns: ["connected_account_id"]
            isOneToOne: false
            referencedRelation: "stripe_connected_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          created_at: string
          currency: string
          current_balance: number
          gl_account_id: string | null
          id: string
          institution: string
          institution_code: string | null
          institution_type: string
          is_active: boolean
          is_nibss_enabled: boolean
          is_rtgs_enabled: boolean
          is_treasury_funding_default: boolean
          last_reconciled_at: string | null
          last_reconciled_balance: number | null
          name: string
          opening_balance: number
          opening_date: string | null
          organization_id: string | null
          paysafe_card_enabled: boolean
          paysafe_eft_enabled: boolean
          paysafe_merchant_ref: string | null
          plaid_access_token: string | null
          plaid_account_id: string | null
          plaid_item_id: string | null
          plaid_last_synced_at: string | null
          plaid_sync_error: string | null
          plaid_sync_status: string | null
          rails_supported: string[]
          stripe_bank_account_id: string | null
          stripe_processor_token_created_at: string | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          created_at?: string
          currency?: string
          current_balance?: number
          gl_account_id?: string | null
          id?: string
          institution: string
          institution_code?: string | null
          institution_type?: string
          is_active?: boolean
          is_nibss_enabled?: boolean
          is_rtgs_enabled?: boolean
          is_treasury_funding_default?: boolean
          last_reconciled_at?: string | null
          last_reconciled_balance?: number | null
          name: string
          opening_balance?: number
          opening_date?: string | null
          organization_id?: string | null
          paysafe_card_enabled?: boolean
          paysafe_eft_enabled?: boolean
          paysafe_merchant_ref?: string | null
          plaid_access_token?: string | null
          plaid_account_id?: string | null
          plaid_item_id?: string | null
          plaid_last_synced_at?: string | null
          plaid_sync_error?: string | null
          plaid_sync_status?: string | null
          rails_supported?: string[]
          stripe_bank_account_id?: string | null
          stripe_processor_token_created_at?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          created_at?: string
          currency?: string
          current_balance?: number
          gl_account_id?: string | null
          id?: string
          institution?: string
          institution_code?: string | null
          institution_type?: string
          is_active?: boolean
          is_nibss_enabled?: boolean
          is_rtgs_enabled?: boolean
          is_treasury_funding_default?: boolean
          last_reconciled_at?: string | null
          last_reconciled_balance?: number | null
          name?: string
          opening_balance?: number
          opening_date?: string | null
          organization_id?: string | null
          paysafe_card_enabled?: boolean
          paysafe_eft_enabled?: boolean
          paysafe_merchant_ref?: string | null
          plaid_access_token?: string | null
          plaid_account_id?: string | null
          plaid_item_id?: string | null
          plaid_last_synced_at?: string | null
          plaid_sync_error?: string | null
          plaid_sync_status?: string | null
          rails_supported?: string[]
          stripe_bank_account_id?: string | null
          stripe_processor_token_created_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_reconciliations: {
        Row: {
          bank_account_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          difference: number | null
          id: string
          notes: string | null
          reconciled_balance: number | null
          statement_balance: number
          statement_date: string
          status: string
          updated_at: string
        }
        Insert: {
          bank_account_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          difference?: number | null
          id?: string
          notes?: string | null
          reconciled_balance?: number | null
          statement_balance: number
          statement_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          bank_account_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          difference?: number | null
          id?: string
          notes?: string | null
          reconciled_balance?: number | null
          statement_balance?: number
          statement_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliations_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          amount: number
          bank_account_id: string
          category: string | null
          cleared_at: string | null
          country_id: string | null
          created_at: string
          customer_id: string | null
          department_id: string | null
          description: string
          gl_account_id: string | null
          id: string
          imported_at: string | null
          is_cleared: boolean
          journal_entry_id: string | null
          jurisdiction_id: string | null
          matched_bill_id: string | null
          matched_invoice_id: string | null
          memo: string | null
          payee_payor: string | null
          reference: string | null
          status: string
          subtotal_amount: number | null
          tax_amount: number | null
          tax_breakdown: Json | null
          tax_code_id: string | null
          transaction_date: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          amount: number
          bank_account_id: string
          category?: string | null
          cleared_at?: string | null
          country_id?: string | null
          created_at?: string
          customer_id?: string | null
          department_id?: string | null
          description: string
          gl_account_id?: string | null
          id?: string
          imported_at?: string | null
          is_cleared?: boolean
          journal_entry_id?: string | null
          jurisdiction_id?: string | null
          matched_bill_id?: string | null
          matched_invoice_id?: string | null
          memo?: string | null
          payee_payor?: string | null
          reference?: string | null
          status?: string
          subtotal_amount?: number | null
          tax_amount?: number | null
          tax_breakdown?: Json | null
          tax_code_id?: string | null
          transaction_date: string
          transaction_type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string
          category?: string | null
          cleared_at?: string | null
          country_id?: string | null
          created_at?: string
          customer_id?: string | null
          department_id?: string | null
          description?: string
          gl_account_id?: string | null
          id?: string
          imported_at?: string | null
          is_cleared?: boolean
          journal_entry_id?: string | null
          jurisdiction_id?: string | null
          matched_bill_id?: string | null
          matched_invoice_id?: string | null
          memo?: string | null
          payee_payor?: string | null
          reference?: string | null
          status?: string
          subtotal_amount?: number | null
          tax_amount?: number | null
          tax_breakdown?: Json | null
          tax_code_id?: string | null
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "bank_transactions_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "combined_tax_rates"
            referencedColumns: ["jurisdiction_id"]
          },
          {
            foreignKeyName: "bank_transactions_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "jurisdictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_tax_code_id_fkey"
            columns: ["tax_code_id"]
            isOneToOne: false
            referencedRelation: "tax_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_lines: {
        Row: {
          amount: number
          bill_id: string
          created_at: string
          department_id: string | null
          description: string
          discount_percent: number | null
          expense_account_id: string | null
          id: string
          line_order: number
          quantity: number
          tax_amount: number | null
          tax_rate: number | null
          unit_price: number
        }
        Insert: {
          amount?: number
          bill_id: string
          created_at?: string
          department_id?: string | null
          description: string
          discount_percent?: number | null
          expense_account_id?: string | null
          id?: string
          line_order?: number
          quantity?: number
          tax_amount?: number | null
          tax_rate?: number | null
          unit_price?: number
        }
        Update: {
          amount?: number
          bill_id?: string
          created_at?: string
          department_id?: string | null
          description?: string
          discount_percent?: number | null
          expense_account_id?: string | null
          id?: string
          line_order?: number
          quantity?: number
          tax_amount?: number | null
          tax_rate?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "bill_lines_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_lines_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_lines_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_taxes: {
        Row: {
          authority: string | null
          bill_id: string
          created_at: string | null
          gl_account_id: string | null
          id: string
          is_recoverable: boolean | null
          jurisdiction_code: string | null
          rate: number
          tax_amount: number
          tax_code: string | null
          tax_type: string
          taxable_amount: number
        }
        Insert: {
          authority?: string | null
          bill_id: string
          created_at?: string | null
          gl_account_id?: string | null
          id?: string
          is_recoverable?: boolean | null
          jurisdiction_code?: string | null
          rate: number
          tax_amount: number
          tax_code?: string | null
          tax_type: string
          taxable_amount: number
        }
        Update: {
          authority?: string | null
          bill_id?: string
          created_at?: string | null
          gl_account_id?: string | null
          id?: string
          is_recoverable?: boolean | null
          jurisdiction_code?: string | null
          rate?: number
          tax_amount?: number
          tax_code?: string | null
          tax_type?: string
          taxable_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "bill_taxes_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_taxes_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          amount_paid: number
          ap_account_id: string | null
          balance_due: number
          base_currency_total: number | null
          bill_date: string
          bill_number: string
          created_at: string
          currency: string
          deleted_at: string | null
          deleted_by: string | null
          department_id: string | null
          discount_amount: number | null
          discount_type: string | null
          discount_value: number | null
          due_date: string
          exchange_rate: number | null
          id: string
          journal_entry_id: string | null
          notes: string | null
          organization_id: string | null
          paid_at: string | null
          payment_terms_id: string | null
          purchase_order_id: string | null
          received_at: string | null
          status: string
          stripe_connected_account_id: string | null
          subtotal: number
          tax_amount: number
          terms: string | null
          total: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          amount_paid?: number
          ap_account_id?: string | null
          balance_due?: number
          base_currency_total?: number | null
          bill_date?: string
          bill_number: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          department_id?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          due_date: string
          exchange_rate?: number | null
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          organization_id?: string | null
          paid_at?: string | null
          payment_terms_id?: string | null
          purchase_order_id?: string | null
          received_at?: string | null
          status?: string
          stripe_connected_account_id?: string | null
          subtotal?: number
          tax_amount?: number
          terms?: string | null
          total?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          amount_paid?: number
          ap_account_id?: string | null
          balance_due?: number
          base_currency_total?: number | null
          bill_date?: string
          bill_number?: string
          created_at?: string
          currency?: string
          deleted_at?: string | null
          deleted_by?: string | null
          department_id?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          due_date?: string
          exchange_rate?: number | null
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          organization_id?: string | null
          paid_at?: string | null
          payment_terms_id?: string | null
          purchase_order_id?: string | null
          received_at?: string | null
          status?: string
          stripe_connected_account_id?: string | null
          subtotal?: number
          tax_amount?: number
          terms?: string | null
          total?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_ap_account_id_fkey"
            columns: ["ap_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "bills_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_payment_terms_id_fkey"
            columns: ["payment_terms_id"]
            isOneToOne: false
            referencedRelation: "payment_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_stripe_connected_account_id_fkey"
            columns: ["stripe_connected_account_id"]
            isOneToOne: false
            referencedRelation: "stripe_connected_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_actuals: {
        Row: {
          actual_amount: number
          ai_explanation: string | null
          ai_recommendation: string | null
          budget_amount: number
          budget_line_item_id: string
          created_at: string
          id: string
          period_number: number
          snapshot_date: string
          variance_amount: number | null
          variance_percentage: number | null
          variance_type: string | null
        }
        Insert: {
          actual_amount: number
          ai_explanation?: string | null
          ai_recommendation?: string | null
          budget_amount: number
          budget_line_item_id: string
          created_at?: string
          id?: string
          period_number: number
          snapshot_date?: string
          variance_amount?: number | null
          variance_percentage?: number | null
          variance_type?: string | null
        }
        Update: {
          actual_amount?: number
          ai_explanation?: string | null
          ai_recommendation?: string | null
          budget_amount?: number
          budget_line_item_id?: string
          created_at?: string
          id?: string
          period_number?: number
          snapshot_date?: string
          variance_amount?: number | null
          variance_percentage?: number | null
          variance_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_actuals_budget_line_item_id_fkey"
            columns: ["budget_line_item_id"]
            isOneToOne: false
            referencedRelation: "budget_line_items"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_ai_forecasts: {
        Row: {
          accuracy_score: number | null
          budget_master_id: string | null
          confidence_interval_lower: Json | null
          confidence_interval_upper: Json | null
          created_at: string
          expires_at: string | null
          forecast_data: Json | null
          forecast_horizon_months: number | null
          forecast_type: string
          generated_at: string
          id: string
          key_drivers: Json | null
          mape: number | null
          model_name: string | null
          organization_id: string | null
          recommendations: Json | null
          rmse: number | null
        }
        Insert: {
          accuracy_score?: number | null
          budget_master_id?: string | null
          confidence_interval_lower?: Json | null
          confidence_interval_upper?: Json | null
          created_at?: string
          expires_at?: string | null
          forecast_data?: Json | null
          forecast_horizon_months?: number | null
          forecast_type: string
          generated_at?: string
          id?: string
          key_drivers?: Json | null
          mape?: number | null
          model_name?: string | null
          organization_id?: string | null
          recommendations?: Json | null
          rmse?: number | null
        }
        Update: {
          accuracy_score?: number | null
          budget_master_id?: string | null
          confidence_interval_lower?: Json | null
          confidence_interval_upper?: Json | null
          created_at?: string
          expires_at?: string | null
          forecast_data?: Json | null
          forecast_horizon_months?: number | null
          forecast_type?: string
          generated_at?: string
          id?: string
          key_drivers?: Json | null
          mape?: number | null
          model_name?: string | null
          organization_id?: string | null
          recommendations?: Json | null
          rmse?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_ai_forecasts_budget_master_id_fkey"
            columns: ["budget_master_id"]
            isOneToOne: false
            referencedRelation: "budget_masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_ai_forecasts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_approvals: {
        Row: {
          action_at: string | null
          approver_id: string | null
          approver_role: string
          budget_master_id: string
          comments: string | null
          created_at: string
          id: string
          status: string
          step_number: number
          threshold_amount: number | null
        }
        Insert: {
          action_at?: string | null
          approver_id?: string | null
          approver_role: string
          budget_master_id: string
          comments?: string | null
          created_at?: string
          id?: string
          status?: string
          step_number: number
          threshold_amount?: number | null
        }
        Update: {
          action_at?: string | null
          approver_id?: string | null
          approver_role?: string
          budget_master_id?: string
          comments?: string | null
          created_at?: string
          id?: string
          status?: string
          step_number?: number
          threshold_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_approvals_budget_master_id_fkey"
            columns: ["budget_master_id"]
            isOneToOne: false
            referencedRelation: "budget_masters"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_assumptions: {
        Row: {
          ai_recommended: boolean | null
          assumption_category: string
          assumption_name: string
          assumption_value: number
          budget_master_id: string | null
          created_at: string
          effective_from: string | null
          effective_to: string | null
          id: string
          notes: string | null
          organization_id: string | null
          source: string | null
          updated_at: string
        }
        Insert: {
          ai_recommended?: boolean | null
          assumption_category: string
          assumption_name: string
          assumption_value: number
          budget_master_id?: string | null
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          ai_recommended?: boolean | null
          assumption_category?: string
          assumption_name?: string
          assumption_value?: number
          budget_master_id?: string | null
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_assumptions_budget_master_id_fkey"
            columns: ["budget_master_id"]
            isOneToOne: false
            referencedRelation: "budget_masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_assumptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_audit_logs: {
        Row: {
          action: string
          ai_recommendation_followed: boolean | null
          budget_line_item_id: string | null
          budget_master_id: string | null
          created_at: string
          field_changed: string | null
          id: string
          ip_address: string | null
          new_value: string | null
          old_value: string | null
          performed_by: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          ai_recommendation_followed?: boolean | null
          budget_line_item_id?: string | null
          budget_master_id?: string | null
          created_at?: string
          field_changed?: string | null
          id?: string
          ip_address?: string | null
          new_value?: string | null
          old_value?: string | null
          performed_by?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          ai_recommendation_followed?: boolean | null
          budget_line_item_id?: string | null
          budget_master_id?: string | null
          created_at?: string
          field_changed?: string | null
          id?: string
          ip_address?: string | null
          new_value?: string | null
          old_value?: string | null
          performed_by?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_audit_logs_budget_line_item_id_fkey"
            columns: ["budget_line_item_id"]
            isOneToOne: false
            referencedRelation: "budget_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_audit_logs_budget_master_id_fkey"
            columns: ["budget_master_id"]
            isOneToOne: false
            referencedRelation: "budget_masters"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_drivers: {
        Row: {
          base_value: number | null
          created_at: string
          description: string | null
          driver_name: string
          driver_type: string
          id: string
          is_active: boolean | null
          is_ai_discovered: boolean | null
          organization_id: string | null
          sensitivity_score: number | null
          unit_of_measure: string | null
          updated_at: string
        }
        Insert: {
          base_value?: number | null
          created_at?: string
          description?: string | null
          driver_name: string
          driver_type: string
          id?: string
          is_active?: boolean | null
          is_ai_discovered?: boolean | null
          organization_id?: string | null
          sensitivity_score?: number | null
          unit_of_measure?: string | null
          updated_at?: string
        }
        Update: {
          base_value?: number | null
          created_at?: string
          description?: string | null
          driver_name?: string
          driver_type?: string
          id?: string
          is_active?: boolean | null
          is_ai_discovered?: boolean | null
          organization_id?: string | null
          sensitivity_score?: number | null
          unit_of_measure?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_drivers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_hierarchy: {
        Row: {
          code: string | null
          country_id: string | null
          created_at: string
          currency: string | null
          hierarchy_level: string
          id: string
          is_active: boolean | null
          is_consolidation_point: boolean | null
          name: string
          organization_id: string | null
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          country_id?: string | null
          created_at?: string
          currency?: string | null
          hierarchy_level: string
          id?: string
          is_active?: boolean | null
          is_consolidation_point?: boolean | null
          name: string
          organization_id?: string | null
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          country_id?: string | null
          created_at?: string
          currency?: string | null
          hierarchy_level?: string
          id?: string
          is_active?: boolean | null
          is_consolidation_point?: boolean | null
          name?: string
          organization_id?: string | null
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_hierarchy_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_hierarchy_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_hierarchy_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "budget_hierarchy"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_line_items: {
        Row: {
          account_id: string | null
          ai_confidence: number | null
          ai_suggested: boolean | null
          annual_total: number | null
          budget_master_id: string
          budget_version_id: string | null
          cost_object_id: string | null
          cost_object_type: string | null
          created_at: string
          department_id: string | null
          driver_id: string | null
          id: string
          line_description: string
          notes: string | null
          period_1: number | null
          period_10: number | null
          period_11: number | null
          period_12: number | null
          period_2: number | null
          period_3: number | null
          period_4: number | null
          period_5: number | null
          period_6: number | null
          period_7: number | null
          period_8: number | null
          period_9: number | null
          quantity: number | null
          unit_cost: number | null
          unit_of_measure: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          ai_confidence?: number | null
          ai_suggested?: boolean | null
          annual_total?: number | null
          budget_master_id: string
          budget_version_id?: string | null
          cost_object_id?: string | null
          cost_object_type?: string | null
          created_at?: string
          department_id?: string | null
          driver_id?: string | null
          id?: string
          line_description: string
          notes?: string | null
          period_1?: number | null
          period_10?: number | null
          period_11?: number | null
          period_12?: number | null
          period_2?: number | null
          period_3?: number | null
          period_4?: number | null
          period_5?: number | null
          period_6?: number | null
          period_7?: number | null
          period_8?: number | null
          period_9?: number | null
          quantity?: number | null
          unit_cost?: number | null
          unit_of_measure?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          ai_confidence?: number | null
          ai_suggested?: boolean | null
          annual_total?: number | null
          budget_master_id?: string
          budget_version_id?: string | null
          cost_object_id?: string | null
          cost_object_type?: string | null
          created_at?: string
          department_id?: string | null
          driver_id?: string | null
          id?: string
          line_description?: string
          notes?: string | null
          period_1?: number | null
          period_10?: number | null
          period_11?: number | null
          period_12?: number | null
          period_2?: number | null
          period_3?: number | null
          period_4?: number | null
          period_5?: number | null
          period_6?: number | null
          period_7?: number | null
          period_8?: number | null
          period_9?: number | null
          quantity?: number | null
          unit_cost?: number | null
          unit_of_measure?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_line_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_line_items_budget_master_id_fkey"
            columns: ["budget_master_id"]
            isOneToOne: false
            referencedRelation: "budget_masters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_line_items_budget_version_id_fkey"
            columns: ["budget_version_id"]
            isOneToOne: false
            referencedRelation: "budget_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_line_items_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_masters: {
        Row: {
          ai_confidence_score: number | null
          ai_generated: boolean | null
          ai_model_used: string | null
          approved_at: string | null
          approved_by: string | null
          base_currency: string | null
          budget_type: string
          cost_center_id: string | null
          country_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          department_id: string | null
          description: string | null
          end_date: string
          facility_id: string | null
          fiscal_year: string
          id: string
          name: string
          organization_id: string | null
          parent_budget_id: string | null
          period_type: string
          start_date: string
          status: string
          total_amount: number | null
          updated_at: string
          version: number
        }
        Insert: {
          ai_confidence_score?: number | null
          ai_generated?: boolean | null
          ai_model_used?: string | null
          approved_at?: string | null
          approved_by?: string | null
          base_currency?: string | null
          budget_type: string
          cost_center_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          department_id?: string | null
          description?: string | null
          end_date: string
          facility_id?: string | null
          fiscal_year: string
          id?: string
          name: string
          organization_id?: string | null
          parent_budget_id?: string | null
          period_type?: string
          start_date: string
          status?: string
          total_amount?: number | null
          updated_at?: string
          version?: number
        }
        Update: {
          ai_confidence_score?: number | null
          ai_generated?: boolean | null
          ai_model_used?: string | null
          approved_at?: string | null
          approved_by?: string | null
          base_currency?: string | null
          budget_type?: string
          cost_center_id?: string | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          department_id?: string | null
          description?: string | null
          end_date?: string
          facility_id?: string | null
          fiscal_year?: string
          id?: string
          name?: string
          organization_id?: string | null
          parent_budget_id?: string | null
          period_type?: string
          start_date?: string
          status?: string
          total_amount?: number | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_masters_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_masters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_masters_parent_budget_id_fkey"
            columns: ["parent_budget_id"]
            isOneToOne: false
            referencedRelation: "budget_masters"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_versions: {
        Row: {
          budget_master_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          scenario_type: string | null
          total_amount: number | null
          updated_at: string
          version_name: string
          version_number: number
        }
        Insert: {
          budget_master_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          scenario_type?: string | null
          total_amount?: number | null
          updated_at?: string
          version_name: string
          version_number: number
        }
        Update: {
          budget_master_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          scenario_type?: string | null
          total_amount?: number | null
          updated_at?: string
          version_name?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_versions_budget_master_id_fkey"
            columns: ["budget_master_id"]
            isOneToOne: false
            referencedRelation: "budget_masters"
            referencedColumns: ["id"]
          },
        ]
      }
      cashflow_forecasts: {
        Row: {
          ai_insights: string | null
          created_at: string
          created_by: string
          end_date: string
          forecast_data: Json
          forecast_name: string
          id: string
          opening_balance: number
          organization_id: string
          period_type: string
          risk_alerts: Json | null
          start_date: string
          updated_at: string
        }
        Insert: {
          ai_insights?: string | null
          created_at?: string
          created_by: string
          end_date: string
          forecast_data?: Json
          forecast_name: string
          id?: string
          opening_balance?: number
          organization_id: string
          period_type: string
          risk_alerts?: Json | null
          start_date: string
          updated_at?: string
        }
        Update: {
          ai_insights?: string | null
          created_at?: string
          created_by?: string
          end_date?: string
          forecast_data?: Json
          forecast_name?: string
          id?: string
          opening_balance?: number
          organization_id?: string
          period_type?: string
          risk_alerts?: Json | null
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      cca_classes: {
        Row: {
          class_number: string
          country_id: string | null
          created_at: string
          description: string | null
          half_year_rule: boolean | null
          id: string
          is_active: boolean | null
          method: string | null
          organization_id: string | null
          rate: number
          recapture_eligible: boolean | null
          terminal_loss_eligible: boolean | null
          updated_at: string
        }
        Insert: {
          class_number: string
          country_id?: string | null
          created_at?: string
          description?: string | null
          half_year_rule?: boolean | null
          id?: string
          is_active?: boolean | null
          method?: string | null
          organization_id?: string | null
          rate: number
          recapture_eligible?: boolean | null
          terminal_loss_eligible?: boolean | null
          updated_at?: string
        }
        Update: {
          class_number?: string
          country_id?: string | null
          created_at?: string
          description?: string | null
          half_year_rule?: boolean | null
          id?: string
          is_active?: boolean | null
          method?: string | null
          organization_id?: string | null
          rate?: number
          recapture_eligible?: boolean | null
          terminal_loss_eligible?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cca_classes_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cca_classes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cloud_storage_connections: {
        Row: {
          access_token_encrypted: string | null
          connection_status: string | null
          created_at: string
          folder_mapping: Json | null
          id: string
          last_sync_at: string | null
          organization_id: string | null
          provider: string
          refresh_token_encrypted: string | null
          sync_enabled: boolean | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          connection_status?: string | null
          created_at?: string
          folder_mapping?: Json | null
          id?: string
          last_sync_at?: string | null
          organization_id?: string | null
          provider: string
          refresh_token_encrypted?: string | null
          sync_enabled?: boolean | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          connection_status?: string | null
          created_at?: string
          folder_mapping?: Json | null
          id?: string
          last_sync_at?: string | null
          organization_id?: string | null
          provider?: string
          refresh_token_encrypted?: string | null
          sync_enabled?: boolean | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cloud_storage_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      coa_template_accounts: {
        Row: {
          account_group: string | null
          account_sub_group: string | null
          account_type: string
          code: string
          created_at: string | null
          deduction_type_code: string | null
          description: string | null
          id: string
          is_header: boolean | null
          is_payroll_account: boolean | null
          is_tax_account: boolean | null
          name: string
          normal_balance: string | null
          parent_code: string | null
          sort_order: number | null
          tax_type_code: string | null
          template_id: string
        }
        Insert: {
          account_group?: string | null
          account_sub_group?: string | null
          account_type: string
          code: string
          created_at?: string | null
          deduction_type_code?: string | null
          description?: string | null
          id?: string
          is_header?: boolean | null
          is_payroll_account?: boolean | null
          is_tax_account?: boolean | null
          name: string
          normal_balance?: string | null
          parent_code?: string | null
          sort_order?: number | null
          tax_type_code?: string | null
          template_id: string
        }
        Update: {
          account_group?: string | null
          account_sub_group?: string | null
          account_type?: string
          code?: string
          created_at?: string | null
          deduction_type_code?: string | null
          description?: string | null
          id?: string
          is_header?: boolean | null
          is_payroll_account?: boolean | null
          is_tax_account?: boolean | null
          name?: string
          normal_balance?: string | null
          parent_code?: string | null
          sort_order?: number | null
          tax_type_code?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coa_template_accounts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "coa_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      coa_templates: {
        Row: {
          accounting_standard: string | null
          country_id: string | null
          created_at: string | null
          description: string | null
          id: string
          industry: string | null
          is_active: boolean | null
          is_default: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          accounting_standard?: string | null
          country_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          accounting_standard?: string | null
          country_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coa_templates_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_contacts: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          cell_phone: string | null
          cell_phone_normalized: string | null
          city: string | null
          company: string | null
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          first_name: string | null
          id: string
          is_active: boolean
          is_favorite: boolean
          landline: string | null
          landline_normalized: string | null
          last_name: string | null
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          phone_normalized: string | null
          postal_code: string | null
          province: string | null
          source: Database["public"]["Enums"]["contact_source"]
          source_id: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          cell_phone?: string | null
          cell_phone_normalized?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean
          is_favorite?: boolean
          landline?: string | null
          landline_normalized?: string | null
          last_name?: string | null
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          phone_normalized?: string | null
          postal_code?: string | null
          province?: string | null
          source?: Database["public"]["Enums"]["contact_source"]
          source_id?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          cell_phone?: string | null
          cell_phone_normalized?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean
          is_favorite?: boolean
          landline?: string | null
          landline_normalized?: string | null
          last_name?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          phone_normalized?: string | null
          postal_code?: string | null
          province?: string | null
          source?: Database["public"]["Enums"]["contact_source"]
          source_id?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_identity: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          department_id: string | null
          display_name: string | null
          email: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          legal_name: string | null
          logo_position: string | null
          logo_url: string | null
          organization_id: string
          phone: string | null
          postal_code: string | null
          priority: number | null
          profile_image_url: string | null
          province: string | null
          signature_html: string | null
          signature_image_url: string | null
          signature_plain_text: string | null
          tagline: string | null
          updated_at: string | null
          updated_by: string | null
          user_id: string | null
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          legal_name?: string | null
          logo_position?: string | null
          logo_url?: string | null
          organization_id: string
          phone?: string | null
          postal_code?: string | null
          priority?: number | null
          profile_image_url?: string | null
          province?: string | null
          signature_html?: string | null
          signature_image_url?: string | null
          signature_plain_text?: string | null
          tagline?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          department_id?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          legal_name?: string | null
          logo_position?: string | null
          logo_url?: string | null
          organization_id?: string
          phone?: string | null
          postal_code?: string | null
          priority?: number | null
          profile_image_url?: string | null
          province?: string | null
          signature_html?: string | null
          signature_image_url?: string | null
          signature_plain_text?: string | null
          tagline?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_identity_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_identity_channels: {
        Row: {
          channel: string
          communication_identity_id: string
          created_at: string | null
          custom_signature_html: string | null
          custom_signature_plain: string | null
          enabled: boolean | null
          id: string
          updated_at: string | null
        }
        Insert: {
          channel: string
          communication_identity_id: string
          created_at?: string | null
          custom_signature_html?: string | null
          custom_signature_plain?: string | null
          enabled?: boolean | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          channel?: string
          communication_identity_id?: string
          created_at?: string | null
          custom_signature_html?: string | null
          custom_signature_plain?: string | null
          enabled?: boolean | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_identity_channels_communication_identity_id_fkey"
            columns: ["communication_identity_id"]
            isOneToOne: false
            referencedRelation: "communication_identity"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_senders: {
        Row: {
          avatar_url: string | null
          communication_identity_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          organization_id: string
          phone: string | null
          phone_normalized: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          avatar_url?: string | null
          communication_identity_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          organization_id: string
          phone?: string | null
          phone_normalized?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          avatar_url?: string | null
          communication_identity_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          organization_id?: string
          phone?: string | null
          phone_normalized?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_senders_communication_identity_id_fkey"
            columns: ["communication_identity_id"]
            isOneToOne: false
            referencedRelation: "communication_identity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_senders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_templates: {
        Row: {
          body: string
          category: string | null
          channel: string
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean | null
          name: string
          organization_id: string
          subject: string | null
          updated_at: string
          use_count: number | null
          variables: string[] | null
        }
        Insert: {
          body: string
          category?: string | null
          channel: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          organization_id: string
          subject?: string | null
          updated_at?: string
          use_count?: number | null
          variables?: string[] | null
        }
        Update: {
          body?: string
          category?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          organization_id?: string
          subject?: string | null
          updated_at?: string
          use_count?: number | null
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compilation_audit_trail: {
        Row: {
          action: string
          action_details: Json | null
          compilation_report_id: string
          field_changed: string | null
          id: string
          ip_address: string | null
          new_value: string | null
          old_value: string | null
          performed_at: string
          performed_by: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          action_details?: Json | null
          compilation_report_id: string
          field_changed?: string | null
          id?: string
          ip_address?: string | null
          new_value?: string | null
          old_value?: string | null
          performed_at?: string
          performed_by?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          action_details?: Json | null
          compilation_report_id?: string
          field_changed?: string | null
          id?: string
          ip_address?: string | null
          new_value?: string | null
          old_value?: string | null
          performed_at?: string
          performed_by?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compilation_audit_trail_compilation_report_id_fkey"
            columns: ["compilation_report_id"]
            isOneToOne: false
            referencedRelation: "compilation_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      compilation_report_versions: {
        Row: {
          change_summary: string | null
          compilation_report_id: string
          created_at: string
          created_by: string | null
          id: string
          is_locked: boolean | null
          locked_at: string | null
          locked_by: string | null
          snapshot_data: Json
          version_number: number
        }
        Insert: {
          change_summary?: string | null
          compilation_report_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_locked?: boolean | null
          locked_at?: string | null
          locked_by?: string | null
          snapshot_data: Json
          version_number?: number
        }
        Update: {
          change_summary?: string | null
          compilation_report_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_locked?: boolean | null
          locked_at?: string | null
          locked_by?: string | null
          snapshot_data?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "compilation_report_versions_compilation_report_id_fkey"
            columns: ["compilation_report_id"]
            isOneToOne: false
            referencedRelation: "compilation_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      compilation_reports: {
        Row: {
          accountant_logo_url: string | null
          accountant_signature_url: string | null
          accounting_framework: string | null
          additional_qualifications: string[] | null
          basis_of_accounting: string | null
          client_address: string | null
          comparative_period_end: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          custom_notes: string | null
          engagement_letter_date: string | null
          firm_address: string | null
          firm_name: string | null
          fiscal_year: string
          fiscal_year_end: string
          id: string
          issued_at: string | null
          management_responsibility_acknowledged: boolean | null
          notes: Json | null
          organization_id: string | null
          period_start_date: string | null
          prepared_by: string | null
          preparer_license_number: string | null
          report_date: string
          report_type: string | null
          reporting_period_type: string | null
          restriction_notice: string | null
          selected_note_templates: Json | null
          statement_types: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          accountant_logo_url?: string | null
          accountant_signature_url?: string | null
          accounting_framework?: string | null
          additional_qualifications?: string[] | null
          basis_of_accounting?: string | null
          client_address?: string | null
          comparative_period_end?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          custom_notes?: string | null
          engagement_letter_date?: string | null
          firm_address?: string | null
          firm_name?: string | null
          fiscal_year: string
          fiscal_year_end: string
          id?: string
          issued_at?: string | null
          management_responsibility_acknowledged?: boolean | null
          notes?: Json | null
          organization_id?: string | null
          period_start_date?: string | null
          prepared_by?: string | null
          preparer_license_number?: string | null
          report_date?: string
          report_type?: string | null
          reporting_period_type?: string | null
          restriction_notice?: string | null
          selected_note_templates?: Json | null
          statement_types?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          accountant_logo_url?: string | null
          accountant_signature_url?: string | null
          accounting_framework?: string | null
          additional_qualifications?: string[] | null
          basis_of_accounting?: string | null
          client_address?: string | null
          comparative_period_end?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          custom_notes?: string | null
          engagement_letter_date?: string | null
          firm_address?: string | null
          firm_name?: string | null
          fiscal_year?: string
          fiscal_year_end?: string
          id?: string
          issued_at?: string | null
          management_responsibility_acknowledged?: boolean | null
          notes?: Json | null
          organization_id?: string | null
          period_start_date?: string | null
          prepared_by?: string | null
          preparer_license_number?: string | null
          report_date?: string
          report_type?: string | null
          reporting_period_type?: string | null
          restriction_notice?: string | null
          selected_note_templates?: Json | null
          statement_types?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compilation_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      consolidation_exchange_rates: {
        Row: {
          average_rate: number | null
          closing_rate: number | null
          created_at: string
          from_currency: string
          group_id: string
          id: string
          rate_date: string
          source: string | null
          spot_rate: number
          to_currency: string
        }
        Insert: {
          average_rate?: number | null
          closing_rate?: number | null
          created_at?: string
          from_currency: string
          group_id: string
          id?: string
          rate_date: string
          source?: string | null
          spot_rate: number
          to_currency: string
        }
        Update: {
          average_rate?: number | null
          closing_rate?: number | null
          created_at?: string
          from_currency?: string
          group_id?: string
          id?: string
          rate_date?: string
          source?: string | null
          spot_rate?: number
          to_currency?: string
        }
        Relationships: [
          {
            foreignKeyName: "consolidation_exchange_rates_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "consolidation_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      consolidation_group_members: {
        Row: {
          consolidation_method: string
          created_at: string
          effective_from: string
          effective_to: string | null
          functional_currency: string
          group_id: string
          id: string
          is_parent: boolean
          organization_id: string
          ownership_percentage: number
          updated_at: string
        }
        Insert: {
          consolidation_method?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          functional_currency: string
          group_id: string
          id?: string
          is_parent?: boolean
          organization_id: string
          ownership_percentage?: number
          updated_at?: string
        }
        Update: {
          consolidation_method?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          functional_currency?: string
          group_id?: string
          id?: string
          is_parent?: boolean
          organization_id?: string
          ownership_percentage?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consolidation_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "consolidation_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consolidation_group_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      consolidation_groups: {
        Row: {
          base_currency: string
          consolidation_type: string
          created_at: string
          created_by: string | null
          description: string | null
          fiscal_year_end_month: number | null
          id: string
          is_active: boolean
          name: string
          parent_organization_id: string | null
          updated_at: string
        }
        Insert: {
          base_currency?: string
          consolidation_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          fiscal_year_end_month?: number | null
          id?: string
          is_active?: boolean
          name: string
          parent_organization_id?: string | null
          updated_at?: string
        }
        Update: {
          base_currency?: string
          consolidation_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          fiscal_year_end_month?: number | null
          id?: string
          is_active?: boolean
          name?: string
          parent_organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consolidation_groups_parent_organization_id_fkey"
            columns: ["parent_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      consolidation_reports: {
        Row: {
          base_currency: string
          created_at: string
          currency_translations: Json | null
          elimination_entries: Json | null
          finalized_at: string | null
          generated_at: string
          generated_by: string | null
          group_id: string
          id: string
          notes: string | null
          period_end: string
          period_start: string
          report_data: Json | null
          report_type: string
          status: string
        }
        Insert: {
          base_currency: string
          created_at?: string
          currency_translations?: Json | null
          elimination_entries?: Json | null
          finalized_at?: string | null
          generated_at?: string
          generated_by?: string | null
          group_id: string
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          report_data?: Json | null
          report_type: string
          status?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          currency_translations?: Json | null
          elimination_entries?: Json | null
          finalized_at?: string | null
          generated_at?: string
          generated_by?: string | null
          group_id?: string
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          report_data?: Json | null
          report_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "consolidation_reports_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "consolidation_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      consolidation_runs: {
        Row: {
          base_currency: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          elimination_summary: Json | null
          error_message: string | null
          fx_summary: Json | null
          group_id: string
          id: string
          net_income: number | null
          organization_id: string
          period_end: string
          period_start: string
          status: string
          total_assets: number | null
          total_equity: number | null
          total_expenses: number | null
          total_liabilities: number | null
          total_revenue: number | null
        }
        Insert: {
          base_currency?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          elimination_summary?: Json | null
          error_message?: string | null
          fx_summary?: Json | null
          group_id: string
          id?: string
          net_income?: number | null
          organization_id: string
          period_end: string
          period_start: string
          status?: string
          total_assets?: number | null
          total_equity?: number | null
          total_expenses?: number | null
          total_liabilities?: number | null
          total_revenue?: number | null
        }
        Update: {
          base_currency?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          elimination_summary?: Json | null
          error_message?: string | null
          fx_summary?: Json | null
          group_id?: string
          id?: string
          net_income?: number | null
          organization_id?: string
          period_end?: string
          period_start?: string
          status?: string
          total_assets?: number | null
          total_equity?: number | null
          total_expenses?: number | null
          total_liabilities?: number | null
          total_revenue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consolidation_runs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "consolidation_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          channel: Database["public"]["Enums"]["message_channel"]
          contact_identifier: string
          contact_name: string | null
          created_at: string | null
          id: string
          is_archived: boolean | null
          last_message_at: string | null
          last_message_preview: string | null
          organization_id: string | null
          unread_count: number | null
          updated_at: string | null
        }
        Insert: {
          channel: Database["public"]["Enums"]["message_channel"]
          contact_identifier: string
          contact_name?: string | null
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          organization_id?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["message_channel"]
          contact_identifier?: string
          contact_name?: string | null
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          organization_id?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_conversations: {
        Row: {
          created_at: string
          id: string
          model: string
          organization_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string
          organization_id: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string
          organization_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      copilot_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          organization_id: string
          role: string
          tokens: number | null
          tool_calls: Json | null
          tool_trace: Json | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          organization_id: string
          role: string
          tokens?: number | null
          tool_calls?: Json | null
          tool_trace?: Json | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          tokens?: number | null
          tool_calls?: Json | null
          tool_trace?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "copilot_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_allocations: {
        Row: {
          allocation_method: string | null
          allocation_rate: number | null
          amount: number
          cost_type: string
          created_at: string
          description: string | null
          effective_from: string
          effective_to: string | null
          id: string
          is_active: boolean
          organization_id: string | null
          product_service_id: string | null
          updated_at: string
        }
        Insert: {
          allocation_method?: string | null
          allocation_rate?: number | null
          amount?: number
          cost_type: string
          created_at?: string
          description?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string | null
          product_service_id?: string | null
          updated_at?: string
        }
        Update: {
          allocation_method?: string | null
          allocation_rate?: number | null
          amount?: number
          cost_type?: string
          created_at?: string
          description?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string | null
          product_service_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_allocations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_allocations_product_service_id_fkey"
            columns: ["product_service_id"]
            isOneToOne: false
            referencedRelation: "products_services"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_centers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          accounting_standard: string | null
          code: string
          code_alpha3: string | null
          created_at: string | null
          date_format: string | null
          default_currency: string
          default_fiscal_month: number | null
          default_locale: string | null
          default_timezone: string | null
          esignature_certificate_required: boolean | null
          esignature_compliance_notes: string | null
          esignature_legal_framework: string | null
          esignature_requires_timestamp: boolean | null
          esignature_requires_witness: boolean | null
          esignature_retention_years: number | null
          fiscal_year_type: string | null
          id: string
          invoice_deletion_config: Json | null
          is_active: boolean | null
          name: string
          number_format: string | null
          payroll_regime_type: string | null
          phone_code: string | null
          tax_exemption_config: Json | null
          tax_labels: Json | null
          tax_regime_type: string | null
          time_format: string | null
          updated_at: string | null
        }
        Insert: {
          accounting_standard?: string | null
          code: string
          code_alpha3?: string | null
          created_at?: string | null
          date_format?: string | null
          default_currency?: string
          default_fiscal_month?: number | null
          default_locale?: string | null
          default_timezone?: string | null
          esignature_certificate_required?: boolean | null
          esignature_compliance_notes?: string | null
          esignature_legal_framework?: string | null
          esignature_requires_timestamp?: boolean | null
          esignature_requires_witness?: boolean | null
          esignature_retention_years?: number | null
          fiscal_year_type?: string | null
          id?: string
          invoice_deletion_config?: Json | null
          is_active?: boolean | null
          name: string
          number_format?: string | null
          payroll_regime_type?: string | null
          phone_code?: string | null
          tax_exemption_config?: Json | null
          tax_labels?: Json | null
          tax_regime_type?: string | null
          time_format?: string | null
          updated_at?: string | null
        }
        Update: {
          accounting_standard?: string | null
          code?: string
          code_alpha3?: string | null
          created_at?: string | null
          date_format?: string | null
          default_currency?: string
          default_fiscal_month?: number | null
          default_locale?: string | null
          default_timezone?: string | null
          esignature_certificate_required?: boolean | null
          esignature_compliance_notes?: string | null
          esignature_legal_framework?: string | null
          esignature_requires_timestamp?: boolean | null
          esignature_requires_witness?: boolean | null
          esignature_retention_years?: number | null
          fiscal_year_type?: string | null
          id?: string
          invoice_deletion_config?: Json | null
          is_active?: boolean | null
          name?: string
          number_format?: string | null
          payroll_regime_type?: string | null
          phone_code?: string | null
          tax_exemption_config?: Json | null
          tax_labels?: Json | null
          tax_regime_type?: string | null
          time_format?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      country_tax_code_seeds: {
        Row: {
          code: string
          collected_account_patterns: string[]
          collected_account_type: string
          country_code: string
          created_at: string
          display_order: number
          id: string
          is_compound: boolean
          is_exempt: boolean
          is_recoverable: boolean
          is_zero_rated: boolean
          jurisdiction_code: string | null
          name: string
          paid_account_patterns: string[]
          paid_account_type: string
          rate: number
          tax_type: string
          updated_at: string
        }
        Insert: {
          code: string
          collected_account_patterns?: string[]
          collected_account_type?: string
          country_code: string
          created_at?: string
          display_order?: number
          id?: string
          is_compound?: boolean
          is_exempt?: boolean
          is_recoverable?: boolean
          is_zero_rated?: boolean
          jurisdiction_code?: string | null
          name: string
          paid_account_patterns?: string[]
          paid_account_type?: string
          rate?: number
          tax_type?: string
          updated_at?: string
        }
        Update: {
          code?: string
          collected_account_patterns?: string[]
          collected_account_type?: string
          country_code?: string
          created_at?: string
          display_order?: number
          id?: string
          is_compound?: boolean
          is_exempt?: boolean
          is_recoverable?: boolean
          is_zero_rated?: boolean
          jurisdiction_code?: string | null
          name?: string
          paid_account_patterns?: string[]
          paid_account_type?: string
          rate?: number
          tax_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      cra_approval_rules: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          max_amount: number | null
          min_amount: number
          name: string
          organization_id: string
          priority: number
          program_codes: string[]
          required_approver_count: number
          required_role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          max_amount?: number | null
          min_amount?: number
          name: string
          organization_id: string
          priority?: number
          program_codes?: string[]
          required_approver_count?: number
          required_role?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          max_amount?: number | null
          min_amount?: number
          name?: string
          organization_id?: string
          priority?: number
          program_codes?: string[]
          required_approver_count?: number
          required_role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cra_approval_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cra_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          organization_id: string
          payload: Json
          provider_event_id: string | null
          tax_payment_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          organization_id: string
          payload?: Json
          provider_event_id?: string | null
          tax_payment_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          organization_id?: string
          payload?: Json
          provider_event_id?: string | null
          tax_payment_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cra_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cra_audit_log_tax_payment_id_fkey"
            columns: ["tax_payment_id"]
            isOneToOne: false
            referencedRelation: "tax_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      cra_filings: {
        Row: {
          acknowledged_at: string | null
          confirmation_number: string | null
          created_at: string
          created_by: string | null
          filing_type: string
          human_summary: Json
          id: string
          organization_id: string
          period_end: string
          period_start: string
          status: string
          submitted_at: string | null
          updated_at: string
          xml_storage_path: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          confirmation_number?: string | null
          created_at?: string
          created_by?: string | null
          filing_type: string
          human_summary?: Json
          id?: string
          organization_id: string
          period_end: string
          period_start: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          xml_storage_path?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          confirmation_number?: string | null
          created_at?: string
          created_by?: string | null
          filing_type?: string
          human_summary?: Json
          id?: string
          organization_id?: string
          period_end?: string
          period_start?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          xml_storage_path?: string | null
        }
        Relationships: []
      }
      cra_payee_catalog: {
        Row: {
          cra_bill_payee_code: string | null
          created_at: string
          description: string | null
          display_label: string
          due_date_rule: Json
          id: string
          is_active: boolean
          payment_type: string
          program_code: string
          remittance_voucher_form: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          cra_bill_payee_code?: string | null
          created_at?: string
          description?: string | null
          display_label: string
          due_date_rule?: Json
          id?: string
          is_active?: boolean
          payment_type: string
          program_code: string
          remittance_voucher_form?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          cra_bill_payee_code?: string | null
          created_at?: string
          description?: string | null
          display_label?: string
          due_date_rule?: Json
          id?: string
          is_active?: boolean
          payment_type?: string
          program_code?: string
          remittance_voucher_form?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      cra_payment_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          organization_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          organization_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          organization_id?: string
        }
        Relationships: []
      }
      cra_payment_batch_items: {
        Row: {
          amount: number
          batch_id: string
          created_at: string
          employee_count: number | null
          failure_reason: string | null
          id: string
          pay_run_id: string | null
          status: string
          tax_payment_id: string | null
        }
        Insert: {
          amount: number
          batch_id: string
          created_at?: string
          employee_count?: number | null
          failure_reason?: string | null
          id?: string
          pay_run_id?: string | null
          status?: string
          tax_payment_id?: string | null
        }
        Update: {
          amount?: number
          batch_id?: string
          created_at?: string
          employee_count?: number | null
          failure_reason?: string | null
          id?: string
          pay_run_id?: string | null
          status?: string
          tax_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cra_payment_batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "cra_payment_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cra_payment_batch_items_pay_run_id_fkey"
            columns: ["pay_run_id"]
            isOneToOne: false
            referencedRelation: "pay_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cra_payment_batch_items_tax_payment_id_fkey"
            columns: ["tax_payment_id"]
            isOneToOne: false
            referencedRelation: "tax_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      cra_payment_batches: {
        Row: {
          bank_account_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          item_count: number
          metadata: Json
          notes: string | null
          organization_id: string
          pad_agreement_id: string | null
          period_end: string
          period_start: string
          program_code: string
          reference: string
          status: string
          submitted_at: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          bank_account_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_count?: number
          metadata?: Json
          notes?: string | null
          organization_id: string
          pad_agreement_id?: string | null
          period_end: string
          period_start: string
          program_code: string
          reference: string
          status?: string
          submitted_at?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          bank_account_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_count?: number
          metadata?: Json
          notes?: string | null
          organization_id?: string
          pad_agreement_id?: string | null
          period_end?: string
          period_start?: string
          program_code?: string
          reference?: string
          status?: string
          submitted_at?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cra_payment_batches_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cra_payment_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cra_payment_batches_pad_agreement_id_fkey"
            columns: ["pad_agreement_id"]
            isOneToOne: false
            referencedRelation: "pad_agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      cra_program_accounts: {
        Row: {
          account_name: string
          business_number: string
          created_at: string
          created_by: string | null
          full_account_number: string | null
          id: string
          is_default: boolean
          metadata: Json
          organization_id: string
          program_code: string
          reference_number: string
          status: string
          tax_type: string
          updated_at: string
        }
        Insert: {
          account_name: string
          business_number: string
          created_at?: string
          created_by?: string | null
          full_account_number?: string | null
          id?: string
          is_default?: boolean
          metadata?: Json
          organization_id: string
          program_code: string
          reference_number: string
          status?: string
          tax_type: string
          updated_at?: string
        }
        Update: {
          account_name?: string
          business_number?: string
          created_at?: string
          created_by?: string | null
          full_account_number?: string | null
          id?: string
          is_default?: boolean
          metadata?: Json
          organization_id?: string
          program_code?: string
          reference_number?: string
          status?: string
          tax_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      cra_remittance_approvals: {
        Row: {
          approver_user_id: string
          comment: string | null
          created_at: string
          decided_at: string
          decision: string
          id: string
          level: number
          organization_id: string
          tax_payment_id: string
        }
        Insert: {
          approver_user_id: string
          comment?: string | null
          created_at?: string
          decided_at?: string
          decision: string
          id?: string
          level?: number
          organization_id: string
          tax_payment_id: string
        }
        Update: {
          approver_user_id?: string
          comment?: string | null
          created_at?: string
          decided_at?: string
          decision?: string
          id?: string
          level?: number
          organization_id?: string
          tax_payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cra_remittance_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cra_remittance_approvals_tax_payment_id_fkey"
            columns: ["tax_payment_id"]
            isOneToOne: false
            referencedRelation: "tax_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_card_reconciliations: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          credit_card_id: string
          difference: number | null
          id: string
          notes: string | null
          reconciled_balance: number | null
          statement_balance: number
          statement_date: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          credit_card_id: string
          difference?: number | null
          id?: string
          notes?: string | null
          reconciled_balance?: number | null
          statement_balance: number
          statement_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          credit_card_id?: string
          difference?: number | null
          id?: string
          notes?: string | null
          reconciled_balance?: number | null
          statement_balance?: number
          statement_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_reconciliations_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_card_transactions: {
        Row: {
          amount: number
          category: string | null
          cleared_at: string | null
          country_id: string | null
          created_at: string
          credit_card_id: string
          department_id: string | null
          description: string
          gl_account_id: string | null
          id: string
          imported_at: string | null
          is_cleared: boolean | null
          journal_entry_id: string | null
          jurisdiction_id: string | null
          memo: string | null
          merchant_category_code: string | null
          payee_payor: string | null
          posted_date: string | null
          reference: string | null
          status: string | null
          subtotal_amount: number | null
          tax_amount: number | null
          tax_breakdown: Json | null
          tax_code_id: string | null
          transaction_date: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string | null
          cleared_at?: string | null
          country_id?: string | null
          created_at?: string
          credit_card_id: string
          department_id?: string | null
          description: string
          gl_account_id?: string | null
          id?: string
          imported_at?: string | null
          is_cleared?: boolean | null
          journal_entry_id?: string | null
          jurisdiction_id?: string | null
          memo?: string | null
          merchant_category_code?: string | null
          payee_payor?: string | null
          posted_date?: string | null
          reference?: string | null
          status?: string | null
          subtotal_amount?: number | null
          tax_amount?: number | null
          tax_breakdown?: Json | null
          tax_code_id?: string | null
          transaction_date: string
          transaction_type?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          cleared_at?: string | null
          country_id?: string | null
          created_at?: string
          credit_card_id?: string
          department_id?: string | null
          description?: string
          gl_account_id?: string | null
          id?: string
          imported_at?: string | null
          is_cleared?: boolean | null
          journal_entry_id?: string | null
          jurisdiction_id?: string | null
          memo?: string | null
          merchant_category_code?: string | null
          payee_payor?: string | null
          posted_date?: string | null
          reference?: string | null
          status?: string | null
          subtotal_amount?: number | null
          tax_amount?: number | null
          tax_breakdown?: Json | null
          tax_code_id?: string | null
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_transactions_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_transactions_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_transactions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_transactions_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_transactions_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "credit_card_transactions_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_transactions_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "combined_tax_rates"
            referencedColumns: ["jurisdiction_id"]
          },
          {
            foreignKeyName: "credit_card_transactions_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "jurisdictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_card_transactions_tax_code_id_fkey"
            columns: ["tax_code_id"]
            isOneToOne: false
            referencedRelation: "tax_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_cards: {
        Row: {
          ach_verified_at: string | null
          card_number: string | null
          created_at: string
          credit_limit: number | null
          currency: string | null
          current_balance: number | null
          gl_account_id: string | null
          id: string
          is_active: boolean | null
          issuer: string
          last_reconciled_at: string | null
          last_reconciled_balance: number | null
          name: string
          opening_balance: number | null
          opening_date: string | null
          organization_id: string | null
          payment_due_day: number | null
          plaid_access_token: string | null
          plaid_account_id: string | null
          plaid_item_id: string | null
          plaid_last_synced_at: string | null
          plaid_sync_error: string | null
          plaid_sync_status: string | null
          routing_number: string | null
          statement_closing_day: number | null
          updated_at: string
        }
        Insert: {
          ach_verified_at?: string | null
          card_number?: string | null
          created_at?: string
          credit_limit?: number | null
          currency?: string | null
          current_balance?: number | null
          gl_account_id?: string | null
          id?: string
          is_active?: boolean | null
          issuer: string
          last_reconciled_at?: string | null
          last_reconciled_balance?: number | null
          name: string
          opening_balance?: number | null
          opening_date?: string | null
          organization_id?: string | null
          payment_due_day?: number | null
          plaid_access_token?: string | null
          plaid_account_id?: string | null
          plaid_item_id?: string | null
          plaid_last_synced_at?: string | null
          plaid_sync_error?: string | null
          plaid_sync_status?: string | null
          routing_number?: string | null
          statement_closing_day?: number | null
          updated_at?: string
        }
        Update: {
          ach_verified_at?: string | null
          card_number?: string | null
          created_at?: string
          credit_limit?: number | null
          currency?: string | null
          current_balance?: number | null
          gl_account_id?: string | null
          id?: string
          is_active?: boolean | null
          issuer?: string
          last_reconciled_at?: string | null
          last_reconciled_balance?: number | null
          name?: string
          opening_balance?: number | null
          opening_date?: string | null
          organization_id?: string | null
          payment_due_day?: number | null
          plaid_access_token?: string | null
          plaid_account_id?: string | null
          plaid_item_id?: string | null
          plaid_last_synced_at?: string | null
          plaid_sync_error?: string | null
          plaid_sync_status?: string | null
          routing_number?: string | null
          statement_closing_day?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_cards_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_cards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_note_lines: {
        Row: {
          amount: number
          created_at: string
          credit_note_id: string
          department_id: string | null
          description: string
          id: string
          line_order: number
          quantity: number
          tax_amount: number | null
          tax_rate: number | null
          unit_price: number
        }
        Insert: {
          amount?: number
          created_at?: string
          credit_note_id: string
          department_id?: string | null
          description: string
          id?: string
          line_order?: number
          quantity?: number
          tax_amount?: number | null
          tax_rate?: number | null
          unit_price?: number
        }
        Update: {
          amount?: number
          created_at?: string
          credit_note_id?: string
          department_id?: string | null
          description?: string
          id?: string
          line_order?: number
          quantity?: number
          tax_amount?: number | null
          tax_rate?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_lines_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_lines_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          amount_applied: number
          balance_remaining: number
          created_at: string
          credit_note_date: string
          credit_note_number: string
          currency: string
          customer_id: string
          department_id: string | null
          id: string
          invoice_id: string | null
          issued_at: string | null
          journal_entry_id: string | null
          notes: string | null
          organization_id: string | null
          reason: string | null
          status: string
          subtotal: number
          tax_amount: number
          total: number
          updated_at: string
        }
        Insert: {
          amount_applied?: number
          balance_remaining?: number
          created_at?: string
          credit_note_date?: string
          credit_note_number: string
          currency?: string
          customer_id: string
          department_id?: string | null
          id?: string
          invoice_id?: string | null
          issued_at?: string | null
          journal_entry_id?: string | null
          notes?: string | null
          organization_id?: string | null
          reason?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount_applied?: number
          balance_remaining?: number
          created_at?: string
          credit_note_date?: string
          credit_note_number?: string
          currency?: string
          customer_id?: string
          department_id?: string | null
          id?: string
          invoice_id?: string | null
          issued_at?: string | null
          journal_entry_id?: string | null
          notes?: string | null
          organization_id?: string | null
          reason?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "credit_notes_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string
          decimal_places: number
          id: string
          is_active: boolean
          is_base: boolean
          name: string
          organization_id: string | null
          symbol: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          decimal_places?: number
          id?: string
          is_active?: boolean
          is_base?: boolean
          name: string
          organization_id?: string | null
          symbol: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          decimal_places?: number
          id?: string
          is_active?: boolean
          is_base?: boolean
          name?: string
          organization_id?: string | null
          symbol?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "currencies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      currency_revaluation_lines: {
        Row: {
          account_id: string
          balance_fc: number
          base_balance_after: number
          base_balance_before: number
          closing_rate: number
          created_at: string
          currency: string
          gain_loss: number
          historical_rate: number | null
          id: string
          revaluation_id: string
        }
        Insert: {
          account_id: string
          balance_fc: number
          base_balance_after: number
          base_balance_before: number
          closing_rate: number
          created_at?: string
          currency: string
          gain_loss: number
          historical_rate?: number | null
          id?: string
          revaluation_id: string
        }
        Update: {
          account_id?: string
          balance_fc?: number
          base_balance_after?: number
          base_balance_before?: number
          closing_rate?: number
          created_at?: string
          currency?: string
          gain_loss?: number
          historical_rate?: number | null
          id?: string
          revaluation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "currency_revaluation_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "currency_revaluation_lines_revaluation_id_fkey"
            columns: ["revaluation_id"]
            isOneToOne: false
            referencedRelation: "currency_revaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      currency_revaluations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          journal_entry_id: string | null
          notes: string | null
          organization_id: string
          period_end: string
          reversal_journal_entry_id: string | null
          status: string
          total_unrealized_gain: number
          total_unrealized_loss: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          organization_id: string
          period_end: string
          reversal_journal_entry_id?: string | null
          status?: string
          total_unrealized_gain?: number
          total_unrealized_loss?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          organization_id?: string
          period_end?: string
          reversal_journal_entry_id?: string | null
          status?: string
          total_unrealized_gain?: number
          total_unrealized_loss?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "currency_revaluations_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "currency_revaluations_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "currency_revaluations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "currency_revaluations_reversal_journal_entry_id_fkey"
            columns: ["reversal_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "currency_revaluations_reversal_journal_entry_id_fkey"
            columns: ["reversal_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payments: {
        Row: {
          amount: number
          bank_account_id: string | null
          bank_transaction_id: string | null
          created_at: string
          customer_id: string
          department_id: string | null
          id: string
          invoice_id: string | null
          journal_entry_id: string | null
          notes: string | null
          organization_id: string | null
          payment_date: string
          payment_method: string | null
          reference: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          bank_transaction_id?: string | null
          created_at?: string
          customer_id: string
          department_id?: string | null
          id?: string
          invoice_id?: string | null
          journal_entry_id?: string | null
          notes?: string | null
          organization_id?: string | null
          payment_date?: string
          payment_method?: string | null
          reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          bank_transaction_id?: string | null
          created_at?: string
          customer_id?: string
          department_id?: string | null
          id?: string
          invoice_id?: string | null
          journal_entry_id?: string | null
          notes?: string | null
          organization_id?: string | null
          payment_date?: string
          payment_method?: string | null
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "customer_payments_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_statements: {
        Row: {
          closing_balance: number
          created_at: string
          customer_id: string
          id: string
          opening_balance: number
          organization_id: string | null
          period_end: string
          period_start: string
          sent_at: string | null
          sent_via: string | null
          statement_date: string
          total_credits: number
          total_invoiced: number
          total_payments: number
        }
        Insert: {
          closing_balance?: number
          created_at?: string
          customer_id: string
          id?: string
          opening_balance?: number
          organization_id?: string | null
          period_end: string
          period_start: string
          sent_at?: string | null
          sent_via?: string | null
          statement_date?: string
          total_credits?: number
          total_invoiced?: number
          total_payments?: number
        }
        Update: {
          closing_balance?: number
          created_at?: string
          customer_id?: string
          id?: string
          opening_balance?: number
          organization_id?: string | null
          period_end?: string
          period_start?: string
          sent_at?: string | null
          sent_via?: string | null
          statement_date?: string
          total_credits?: number
          total_invoiced?: number
          total_payments?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_statements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_statements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          created_at: string
          credit_limit: number | null
          default_currency: string | null
          default_tax_code_id: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          organization_id: string | null
          payment_terms: number | null
          phone: string | null
          postal_code: string | null
          province: string | null
          tax_exempt: boolean
          tax_exempt_certificate_no: string | null
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          credit_limit?: number | null
          default_currency?: string | null
          default_tax_code_id?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          organization_id?: string | null
          payment_terms?: number | null
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          tax_exempt?: boolean
          tax_exempt_certificate_no?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          credit_limit?: number | null
          default_currency?: string | null
          default_tax_code_id?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          organization_id?: string | null
          payment_terms?: number | null
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          tax_exempt?: boolean
          tax_exempt_certificate_no?: string | null
          tax_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_default_tax_code_id_fkey"
            columns: ["default_tax_code_id"]
            isOneToOne: false
            referencedRelation: "tax_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          allow_postings: boolean
          code: string
          created_at: string
          description: string | null
          division_type: string
          id: string
          is_active: boolean
          is_shared: boolean
          manager_id: string | null
          name: string
          organization_id: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          allow_postings?: boolean
          code: string
          created_at?: string
          description?: string | null
          division_type?: string
          id?: string
          is_active?: boolean
          is_shared?: boolean
          manager_id?: string | null
          name: string
          organization_id: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          allow_postings?: boolean
          code?: string
          created_at?: string
          description?: string | null
          division_type?: string
          id?: string
          is_active?: boolean
          is_shared?: boolean
          manager_id?: string | null
          name?: string
          organization_id?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      depreciation_entries: {
        Row: {
          accumulated_depreciation: number
          asset_id: string
          book_value: number
          created_at: string
          department_id: string | null
          depreciation_amount: number
          id: string
          journal_entry_id: string | null
          period_end: string
          period_start: string
          posted_at: string | null
          posted_by: string | null
          status: string
        }
        Insert: {
          accumulated_depreciation: number
          asset_id: string
          book_value: number
          created_at?: string
          department_id?: string | null
          depreciation_amount: number
          id?: string
          journal_entry_id?: string | null
          period_end: string
          period_start: string
          posted_at?: string | null
          posted_by?: string | null
          status?: string
        }
        Update: {
          accumulated_depreciation?: number
          asset_id?: string
          book_value?: number
          created_at?: string
          department_id?: string | null
          depreciation_amount?: number
          id?: string
          journal_entry_id?: string | null
          period_end?: string
          period_start?: string
          posted_at?: string | null
          posted_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "depreciation_entries_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "fixed_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depreciation_entries_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "depreciation_entries_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "depreciation_entries_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_presets: {
        Row: {
          country_id: string | null
          created_at: string
          created_by: string | null
          duration: string
          duration_in_months: number | null
          expires_at: string | null
          id: string
          max_redemptions: number | null
          name: string
          percent: number
          scope: string
          status: string
          stripe_coupon_id: string
          updated_at: string
        }
        Insert: {
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          duration: string
          duration_in_months?: number | null
          expires_at?: string | null
          id?: string
          max_redemptions?: number | null
          name: string
          percent: number
          scope?: string
          status?: string
          stripe_coupon_id: string
          updated_at?: string
        }
        Update: {
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          duration?: string
          duration_in_months?: number | null
          expires_at?: string | null
          id?: string
          max_redemptions?: number | null
          name?: string
          percent?: number
          scope?: string
          status?: string
          stripe_coupon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_presets_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      docsign_notifications: {
        Row: {
          channel: string | null
          content: Json | null
          created_at: string
          delivered_at: string | null
          document_id: string | null
          error_message: string | null
          id: string
          notification_type: string
          organization_id: string | null
          recipient_email: string | null
          recipient_id: string | null
          retry_count: number | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          channel?: string | null
          content?: Json | null
          created_at?: string
          delivered_at?: string | null
          document_id?: string | null
          error_message?: string | null
          id?: string
          notification_type: string
          organization_id?: string | null
          recipient_email?: string | null
          recipient_id?: string | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          channel?: string | null
          content?: Json | null
          created_at?: string
          delivered_at?: string | null
          document_id?: string | null
          error_message?: string | null
          id?: string
          notification_type?: string
          organization_id?: string | null
          recipient_email?: string | null
          recipient_id?: string | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "docsign_notifications_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "docsign_notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_type: string | null
          browser_info: Json | null
          compliance_relevant: boolean | null
          country_code: string | null
          created_at: string
          details: Json | null
          device_info: Json | null
          document_id: string
          geo_location: Json | null
          id: string
          ip_address: string | null
          legal_framework: string | null
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_type?: string | null
          browser_info?: Json | null
          compliance_relevant?: boolean | null
          country_code?: string | null
          created_at?: string
          details?: Json | null
          device_info?: Json | null
          document_id: string
          geo_location?: Json | null
          id?: string
          ip_address?: string | null
          legal_framework?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_type?: string | null
          browser_info?: Json | null
          compliance_relevant?: boolean | null
          country_code?: string | null
          created_at?: string
          details?: Json | null
          device_info?: Json | null
          document_id?: string
          geo_location?: Json | null
          id?: string
          ip_address?: string | null
          legal_framework?: string | null
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_audit_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_comments: {
        Row: {
          comment_type: string | null
          content: string
          created_at: string
          document_id: string
          id: string
          is_private: boolean | null
          is_resolved: boolean | null
          mentions: Json | null
          page_number: number | null
          parent_comment_id: string | null
          position_x: number | null
          position_y: number | null
          resolved_at: string | null
          resolved_by: string | null
          signer_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          comment_type?: string | null
          content: string
          created_at?: string
          document_id: string
          id?: string
          is_private?: boolean | null
          is_resolved?: boolean | null
          mentions?: Json | null
          page_number?: number | null
          parent_comment_id?: string | null
          position_x?: number | null
          position_y?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          signer_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          comment_type?: string | null
          content?: string
          created_at?: string
          document_id?: string
          id?: string
          is_private?: boolean | null
          is_resolved?: boolean | null
          mentions?: Json | null
          page_number?: number | null
          parent_comment_id?: string | null
          position_x?: number | null
          position_y?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          signer_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_comments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "document_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_comments_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "document_signers"
            referencedColumns: ["id"]
          },
        ]
      }
      document_compliance_certificates: {
        Row: {
          certificate_data: Json
          certificate_hash: string | null
          certificate_type: string
          certificate_url: string | null
          country_code: string | null
          document_id: string
          id: string
          issued_at: string
          legal_framework: string
          valid_until: string | null
        }
        Insert: {
          certificate_data: Json
          certificate_hash?: string | null
          certificate_type: string
          certificate_url?: string | null
          country_code?: string | null
          document_id: string
          id?: string
          issued_at?: string
          legal_framework: string
          valid_until?: string | null
        }
        Update: {
          certificate_data?: Json
          certificate_hash?: string | null
          certificate_type?: string
          certificate_url?: string | null
          country_code?: string | null
          document_id?: string
          id?: string
          issued_at?: string
          legal_framework?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_compliance_certificates_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_envelopes: {
        Row: {
          bulk_send_data: Json | null
          completed_at: string | null
          completed_count: number | null
          created_at: string
          created_by: string | null
          declined_count: number | null
          description: string | null
          expired_count: number | null
          id: string
          name: string
          organization_id: string | null
          sent_at: string | null
          sent_count: number | null
          status: string | null
          template_id: string | null
          total_documents: number | null
          updated_at: string
        }
        Insert: {
          bulk_send_data?: Json | null
          completed_at?: string | null
          completed_count?: number | null
          created_at?: string
          created_by?: string | null
          declined_count?: number | null
          description?: string | null
          expired_count?: number | null
          id?: string
          name: string
          organization_id?: string | null
          sent_at?: string | null
          sent_count?: number | null
          status?: string | null
          template_id?: string | null
          total_documents?: number | null
          updated_at?: string
        }
        Update: {
          bulk_send_data?: Json | null
          completed_at?: string | null
          completed_count?: number | null
          created_at?: string
          created_by?: string | null
          declined_count?: number | null
          description?: string | null
          expired_count?: number | null
          id?: string
          name?: string
          organization_id?: string | null
          sent_at?: string | null
          sent_count?: number | null
          status?: string | null
          template_id?: string | null
          total_documents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_envelopes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_envelopes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      document_fields: {
        Row: {
          assigned_signer_id: string | null
          created_at: string
          document_id: string
          efinsign_field_id: string | null
          field_config: Json | null
          field_type: string
          filled_at: string | null
          filled_value: string | null
          height: number | null
          id: string
          is_required: boolean | null
          label: string | null
          page_number: number | null
          pdf_page_height_pt: number | null
          pdf_page_width_pt: number | null
          position_x: number
          position_y: number
          template_id: string | null
          validation_rules: Json | null
          width: number | null
        }
        Insert: {
          assigned_signer_id?: string | null
          created_at?: string
          document_id: string
          efinsign_field_id?: string | null
          field_config?: Json | null
          field_type: string
          filled_at?: string | null
          filled_value?: string | null
          height?: number | null
          id?: string
          is_required?: boolean | null
          label?: string | null
          page_number?: number | null
          pdf_page_height_pt?: number | null
          pdf_page_width_pt?: number | null
          position_x: number
          position_y: number
          template_id?: string | null
          validation_rules?: Json | null
          width?: number | null
        }
        Update: {
          assigned_signer_id?: string | null
          created_at?: string
          document_id?: string
          efinsign_field_id?: string | null
          field_config?: Json | null
          field_type?: string
          filled_at?: string | null
          filled_value?: string | null
          height?: number | null
          id?: string
          is_required?: boolean | null
          label?: string | null
          page_number?: number | null
          pdf_page_height_pt?: number | null
          pdf_page_width_pt?: number | null
          position_x?: number
          position_y?: number
          template_id?: string | null
          validation_rules?: Json | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_fields_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      document_in_person_sessions: {
        Row: {
          completed_at: string | null
          current_signer_id: string | null
          device_info: Json | null
          document_id: string
          host_user_id: string
          id: string
          ip_address: string | null
          location_info: Json | null
          session_token: string | null
          started_at: string
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          current_signer_id?: string | null
          device_info?: Json | null
          document_id: string
          host_user_id: string
          id?: string
          ip_address?: string | null
          location_info?: Json | null
          session_token?: string | null
          started_at?: string
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          current_signer_id?: string | null
          device_info?: Json | null
          document_id?: string
          host_user_id?: string
          id?: string
          ip_address?: string | null
          location_info?: Json | null
          session_token?: string | null
          started_at?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_in_person_sessions_current_signer_id_fkey"
            columns: ["current_signer_id"]
            isOneToOne: false
            referencedRelation: "document_signers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_in_person_sessions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_recipient_group_members: {
        Row: {
          added_at: string
          email: string
          group_id: string
          id: string
          is_active: boolean | null
          name: string | null
          user_id: string | null
        }
        Insert: {
          added_at?: string
          email: string
          group_id: string
          id?: string
          is_active?: boolean | null
          name?: string | null
          user_id?: string | null
        }
        Update: {
          added_at?: string
          email?: string
          group_id?: string
          id?: string
          is_active?: boolean | null
          name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_recipient_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "document_recipient_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      document_recipient_groups: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          group_type: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          group_type?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          group_type?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_recipient_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_reminders: {
        Row: {
          created_at: string
          document_id: string
          email_body: string | null
          email_subject: string | null
          id: string
          reminder_type: string | null
          scheduled_for: string
          sent_at: string | null
          signer_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          document_id: string
          email_body?: string | null
          email_subject?: string | null
          id?: string
          reminder_type?: string | null
          scheduled_for: string
          sent_at?: string | null
          signer_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string
          email_body?: string | null
          email_subject?: string | null
          id?: string
          reminder_type?: string | null
          scheduled_for?: string
          sent_at?: string | null
          signer_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_reminders_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_reminders_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "document_signers"
            referencedColumns: ["id"]
          },
        ]
      }
      document_retention_policies: {
        Row: {
          action_on_expiry: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          document_type: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          notify_before_days: number | null
          notify_emails: string[] | null
          organization_id: string
          policy_name: string
          retention_days: number
          updated_at: string
        }
        Insert: {
          action_on_expiry?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_type?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          notify_before_days?: number | null
          notify_emails?: string[] | null
          organization_id: string
          policy_name: string
          retention_days: number
          updated_at?: string
        }
        Update: {
          action_on_expiry?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_type?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          notify_before_days?: number | null
          notify_emails?: string[] | null
          organization_id?: string
          policy_name?: string
          retention_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_retention_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_routing_rules: {
        Row: {
          action_add_signers: Json | null
          action_skip_signers: number[] | null
          action_target_signer_order: number | null
          action_terminate: boolean | null
          action_type: string
          condition_field_id: string | null
          condition_operator: string | null
          condition_type: string
          condition_value: string | null
          created_at: string
          document_id: string | null
          id: string
          is_active: boolean | null
          rule_name: string
          rule_order: number | null
          template_id: string | null
        }
        Insert: {
          action_add_signers?: Json | null
          action_skip_signers?: number[] | null
          action_target_signer_order?: number | null
          action_terminate?: boolean | null
          action_type: string
          condition_field_id?: string | null
          condition_operator?: string | null
          condition_type: string
          condition_value?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          is_active?: boolean | null
          rule_name: string
          rule_order?: number | null
          template_id?: string | null
        }
        Update: {
          action_add_signers?: Json | null
          action_skip_signers?: number[] | null
          action_target_signer_order?: number | null
          action_terminate?: boolean | null
          action_type?: string
          condition_field_id?: string | null
          condition_operator?: string | null
          condition_type?: string
          condition_value?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          is_active?: boolean | null
          rule_name?: string
          rule_order?: number | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_routing_rules_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_routing_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      document_signers: {
        Row: {
          access_code: string | null
          auth_id_verification_data: Json | null
          auth_id_verified: boolean | null
          auth_method: string | null
          auth_sms_sent_at: string | null
          auth_sms_verified: boolean | null
          consent_given: boolean | null
          consent_timestamp: string | null
          created_at: string
          decline_reason: string | null
          declined_at: string | null
          delegated_at: string | null
          delegated_to_id: string | null
          delegation_allowed: boolean | null
          device_info: Json | null
          document_id: string
          efinsign_signer_id: string | null
          email: string
          email_sent_at: string | null
          id: string
          in_person_verified_by: string | null
          ip_address: string | null
          is_in_person: boolean | null
          language_code: string | null
          name: string | null
          notification_preferences: Json | null
          phone_number: string | null
          private_message: string | null
          recipient_group_id: string | null
          recipient_type: string | null
          reminder_count: number | null
          reminder_sent_at: string | null
          role: string | null
          routing_condition: Json | null
          routing_order: number | null
          signature_data: string | null
          signed_at: string | null
          signing_order: number | null
          signing_token: string | null
          status: string | null
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          access_code?: string | null
          auth_id_verification_data?: Json | null
          auth_id_verified?: boolean | null
          auth_method?: string | null
          auth_sms_sent_at?: string | null
          auth_sms_verified?: boolean | null
          consent_given?: boolean | null
          consent_timestamp?: string | null
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          delegated_at?: string | null
          delegated_to_id?: string | null
          delegation_allowed?: boolean | null
          device_info?: Json | null
          document_id: string
          efinsign_signer_id?: string | null
          email: string
          email_sent_at?: string | null
          id?: string
          in_person_verified_by?: string | null
          ip_address?: string | null
          is_in_person?: boolean | null
          language_code?: string | null
          name?: string | null
          notification_preferences?: Json | null
          phone_number?: string | null
          private_message?: string | null
          recipient_group_id?: string | null
          recipient_type?: string | null
          reminder_count?: number | null
          reminder_sent_at?: string | null
          role?: string | null
          routing_condition?: Json | null
          routing_order?: number | null
          signature_data?: string | null
          signed_at?: string | null
          signing_order?: number | null
          signing_token?: string | null
          status?: string | null
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          access_code?: string | null
          auth_id_verification_data?: Json | null
          auth_id_verified?: boolean | null
          auth_method?: string | null
          auth_sms_sent_at?: string | null
          auth_sms_verified?: boolean | null
          consent_given?: boolean | null
          consent_timestamp?: string | null
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          delegated_at?: string | null
          delegated_to_id?: string | null
          delegation_allowed?: boolean | null
          device_info?: Json | null
          document_id?: string
          efinsign_signer_id?: string | null
          email?: string
          email_sent_at?: string | null
          id?: string
          in_person_verified_by?: string | null
          ip_address?: string | null
          is_in_person?: boolean | null
          language_code?: string | null
          name?: string | null
          notification_preferences?: Json | null
          phone_number?: string | null
          private_message?: string | null
          recipient_group_id?: string | null
          recipient_type?: string | null
          reminder_count?: number | null
          reminder_sent_at?: string | null
          role?: string | null
          routing_condition?: Json | null
          routing_order?: number | null
          signature_data?: string | null
          signed_at?: string | null
          signing_order?: number | null
          signing_token?: string | null
          status?: string | null
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_signers_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          custom_email_body: string | null
          custom_email_subject: string | null
          default_expiration_days: number | null
          default_reminder_days: number[] | null
          description: string | null
          fields: Json | null
          file_url: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          name: string
          organization_id: string | null
          recipient_roles: Json | null
          routing_rules: Json | null
          shared_with_org: boolean | null
          signing_order_type: string | null
          tags: string[] | null
          template_type: string | null
          updated_at: string
          use_count: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          custom_email_body?: string | null
          custom_email_subject?: string | null
          default_expiration_days?: number | null
          default_reminder_days?: number[] | null
          description?: string | null
          fields?: Json | null
          file_url?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name: string
          organization_id?: string | null
          recipient_roles?: Json | null
          routing_rules?: Json | null
          shared_with_org?: boolean | null
          signing_order_type?: string | null
          tags?: string[] | null
          template_type?: string | null
          updated_at?: string
          use_count?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          custom_email_body?: string | null
          custom_email_subject?: string | null
          default_expiration_days?: number | null
          default_reminder_days?: number[] | null
          description?: string | null
          fields?: Json | null
          file_url?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name?: string
          organization_id?: string | null
          recipient_roles?: Json | null
          routing_rules?: Json | null
          shared_with_org?: boolean | null
          signing_order_type?: string | null
          tags?: string[] | null
          template_type?: string | null
          updated_at?: string
          use_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_threads: {
        Row: {
          attachments: Json | null
          author_email: string | null
          author_id: string | null
          author_name: string | null
          content: string | null
          created_at: string
          document_id: string
          id: string
          is_internal: boolean | null
          parent_thread_id: string | null
          read_by: Json | null
          thread_type: string | null
          updated_at: string
        }
        Insert: {
          attachments?: Json | null
          author_email?: string | null
          author_id?: string | null
          author_name?: string | null
          content?: string | null
          created_at?: string
          document_id: string
          id?: string
          is_internal?: boolean | null
          parent_thread_id?: string | null
          read_by?: Json | null
          thread_type?: string | null
          updated_at?: string
        }
        Update: {
          attachments?: Json | null
          author_email?: string | null
          author_id?: string | null
          author_name?: string | null
          content?: string | null
          created_at?: string
          document_id?: string
          id?: string
          is_internal?: boolean | null
          parent_thread_id?: string | null
          read_by?: Json | null
          thread_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_threads_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_threads_parent_thread_id_fkey"
            columns: ["parent_thread_id"]
            isOneToOne: false
            referencedRelation: "document_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          ai_extracted_at: string | null
          ai_extraction: Json | null
          ai_extraction_confidence: number | null
          auto_delete_at: string | null
          completed_at: string | null
          compliance_certificate_url: string | null
          created_at: string
          custom_email_body: string | null
          custom_email_subject: string | null
          document_hash: string | null
          document_type: string | null
          efinsign_document_id: string | null
          envelope_id: string | null
          expires_at: string | null
          file_size: number | null
          file_url: string | null
          id: string
          in_person_host_id: string | null
          is_in_person_signing: boolean | null
          last_reminder_sent_at: string | null
          legal_framework: string | null
          metadata: Json | null
          mime_type: string | null
          organization_id: string | null
          original_file_url: string | null
          owner_id: string
          parent_document_id: string | null
          reminder_count: number | null
          reminder_schedule: number[] | null
          retention_until: string | null
          signed_pdf_url: string | null
          signing_order_type: string | null
          status: string | null
          template_id: string | null
          title: string
          updated_at: string
          version: number | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          ai_extracted_at?: string | null
          ai_extraction?: Json | null
          ai_extraction_confidence?: number | null
          auto_delete_at?: string | null
          completed_at?: string | null
          compliance_certificate_url?: string | null
          created_at?: string
          custom_email_body?: string | null
          custom_email_subject?: string | null
          document_hash?: string | null
          document_type?: string | null
          efinsign_document_id?: string | null
          envelope_id?: string | null
          expires_at?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          in_person_host_id?: string | null
          is_in_person_signing?: boolean | null
          last_reminder_sent_at?: string | null
          legal_framework?: string | null
          metadata?: Json | null
          mime_type?: string | null
          organization_id?: string | null
          original_file_url?: string | null
          owner_id: string
          parent_document_id?: string | null
          reminder_count?: number | null
          reminder_schedule?: number[] | null
          retention_until?: string | null
          signed_pdf_url?: string | null
          signing_order_type?: string | null
          status?: string | null
          template_id?: string | null
          title: string
          updated_at?: string
          version?: number | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          ai_extracted_at?: string | null
          ai_extraction?: Json | null
          ai_extraction_confidence?: number | null
          auto_delete_at?: string | null
          completed_at?: string | null
          compliance_certificate_url?: string | null
          created_at?: string
          custom_email_body?: string | null
          custom_email_subject?: string | null
          document_hash?: string | null
          document_type?: string | null
          efinsign_document_id?: string | null
          envelope_id?: string | null
          expires_at?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          in_person_host_id?: string | null
          is_in_person_signing?: boolean | null
          last_reminder_sent_at?: string | null
          legal_framework?: string | null
          metadata?: Json | null
          mime_type?: string | null
          organization_id?: string | null
          original_file_url?: string | null
          owner_id?: string
          parent_document_id?: string | null
          reminder_count?: number | null
          reminder_schedule?: number[] | null
          retention_until?: string | null
          signed_pdf_url?: string | null
          signing_order_type?: string | null
          status?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string
          version?: number | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_envelope_id_fkey"
            columns: ["envelope_id"]
            isOneToOne: false
            referencedRelation: "document_envelopes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_parent_document_id_fkey"
            columns: ["parent_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      donation_audit_logs: {
        Row: {
          action: string
          details: Json | null
          entity_id: string
          entity_type: string
          field_changed: string | null
          id: string
          ip_address: unknown
          new_value: string | null
          old_value: string | null
          organization_id: string
          performed_at: string
          performed_by: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          details?: Json | null
          entity_id: string
          entity_type: string
          field_changed?: string | null
          id?: string
          ip_address?: unknown
          new_value?: string | null
          old_value?: string | null
          organization_id: string
          performed_at?: string
          performed_by?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          details?: Json | null
          entity_id?: string
          entity_type?: string
          field_changed?: string | null
          id?: string
          ip_address?: unknown
          new_value?: string | null
          old_value?: string | null
          organization_id?: string
          performed_at?: string
          performed_by?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donation_audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      donation_campaigns: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          fund_id: string | null
          goal_amount: number | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          program_id: string | null
          raised_amount: number | null
          start_date: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          fund_id?: string | null
          goal_amount?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          program_id?: string | null
          raised_amount?: number | null
          start_date: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          fund_id?: string | null
          goal_amount?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          program_id?: string | null
          raised_amount?: number | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "donation_campaigns_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "donation_funds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donation_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donation_campaigns_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "donation_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      donation_designations: {
        Row: {
          amount: number
          created_at: string
          donation_id: string
          fund_id: string | null
          id: string
          notes: string | null
          percentage: number | null
          program_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          donation_id: string
          fund_id?: string | null
          id?: string
          notes?: string | null
          percentage?: number | null
          program_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          donation_id?: string
          fund_id?: string | null
          id?: string
          notes?: string | null
          percentage?: number | null
          program_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donation_designations_donation_id_fkey"
            columns: ["donation_id"]
            isOneToOne: false
            referencedRelation: "donations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donation_designations_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "donation_funds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donation_designations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "donation_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      donation_funds: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          current_balance: number | null
          deferred_revenue_account_id: string | null
          description: string | null
          fund_type: Database["public"]["Enums"]["fund_type"]
          gl_account_id: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          restriction_terms: string | null
          target_amount: number | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          current_balance?: number | null
          deferred_revenue_account_id?: string | null
          description?: string | null
          fund_type?: Database["public"]["Enums"]["fund_type"]
          gl_account_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          restriction_terms?: string | null
          target_amount?: number | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          current_balance?: number | null
          deferred_revenue_account_id?: string | null
          description?: string | null
          fund_type?: Database["public"]["Enums"]["fund_type"]
          gl_account_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          restriction_terms?: string | null
          target_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "donation_funds_deferred_revenue_account_id_fkey"
            columns: ["deferred_revenue_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donation_funds_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donation_funds_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      donation_in_kind: {
        Row: {
          appraisal_date: string | null
          appraisal_document_url: string | null
          appraised_by: string | null
          category: string | null
          created_at: string
          description: string
          donation_id: string
          fair_market_value: number
          id: string
          notes: string | null
          quantity: number | null
          updated_at: string
        }
        Insert: {
          appraisal_date?: string | null
          appraisal_document_url?: string | null
          appraised_by?: string | null
          category?: string | null
          created_at?: string
          description: string
          donation_id: string
          fair_market_value: number
          id?: string
          notes?: string | null
          quantity?: number | null
          updated_at?: string
        }
        Update: {
          appraisal_date?: string | null
          appraisal_document_url?: string | null
          appraised_by?: string | null
          category?: string | null
          created_at?: string
          description?: string
          donation_id?: string
          fair_market_value?: number
          id?: string
          notes?: string | null
          quantity?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "donation_in_kind_donation_id_fkey"
            columns: ["donation_id"]
            isOneToOne: false
            referencedRelation: "donations"
            referencedColumns: ["id"]
          },
        ]
      }
      donation_pledges: {
        Row: {
          campaign_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          donor_id: string
          expected_end_date: string | null
          expected_start_date: string | null
          fulfilled_amount: number | null
          fund_id: string | null
          id: string
          notes: string | null
          organization_id: string
          payment_frequency: string | null
          pledge_date: string
          pledge_number: string
          program_id: string | null
          remaining_amount: number | null
          status: Database["public"]["Enums"]["pledge_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          donor_id: string
          expected_end_date?: string | null
          expected_start_date?: string | null
          fulfilled_amount?: number | null
          fund_id?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          payment_frequency?: string | null
          pledge_date: string
          pledge_number: string
          program_id?: string | null
          remaining_amount?: number | null
          status?: Database["public"]["Enums"]["pledge_status"]
          total_amount: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          donor_id?: string
          expected_end_date?: string | null
          expected_start_date?: string | null
          fulfilled_amount?: number | null
          fund_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          payment_frequency?: string | null
          pledge_date?: string
          pledge_number?: string
          program_id?: string | null
          remaining_amount?: number | null
          status?: Database["public"]["Enums"]["pledge_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "donation_pledges_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "donation_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donation_pledges_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donation_pledges_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "donation_funds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donation_pledges_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donation_pledges_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "donation_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      donation_programs: {
        Row: {
          budget: number | null
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          gl_expense_account_id: string | null
          gl_revenue_account_id: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          budget?: number | null
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          gl_expense_account_id?: string | null
          gl_revenue_account_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          budget?: number | null
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          gl_expense_account_id?: string | null
          gl_revenue_account_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "donation_programs_gl_expense_account_id_fkey"
            columns: ["gl_expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donation_programs_gl_revenue_account_id_fkey"
            columns: ["gl_revenue_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donation_programs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      donation_receipt_items: {
        Row: {
          advantage_value: number
          amount: number
          created_at: string
          date_received: string
          donation_id: string
          donation_type: string
          eligible_amount: number
          id: string
          receipt_id: string
        }
        Insert: {
          advantage_value?: number
          amount: number
          created_at?: string
          date_received: string
          donation_id: string
          donation_type: string
          eligible_amount: number
          id?: string
          receipt_id: string
        }
        Update: {
          advantage_value?: number
          amount?: number
          created_at?: string
          date_received?: string
          donation_id?: string
          donation_type?: string
          eligible_amount?: number
          id?: string
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "donation_receipt_items_donation_id_fkey"
            columns: ["donation_id"]
            isOneToOne: false
            referencedRelation: "donations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donation_receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "donation_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      donation_receipts: {
        Row: {
          advantage_description: string | null
          advantage_value: number | null
          amount: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          charity_address: string
          charity_bn: string
          charity_legal_name: string
          country: string | null
          cra_disclaimer: string
          created_at: string
          created_by: string | null
          date_of_donation: string
          date_of_issue: string
          document_url: string | null
          donation_id: string | null
          donor_address: string
          donor_name: string
          eligible_amount: number
          id: string
          is_consolidated: boolean
          is_locked: boolean | null
          issued_at: string | null
          issued_by: string | null
          locale: string | null
          location_issued: string | null
          organization_id: string
          receipt_number: string
          replaced_by_receipt_id: string | null
          replaces_receipt_id: string | null
          signatory_name: string | null
          signatory_position: string | null
          status: Database["public"]["Enums"]["receipt_status"]
          updated_at: string
        }
        Insert: {
          advantage_description?: string | null
          advantage_value?: number | null
          amount: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          charity_address: string
          charity_bn: string
          charity_legal_name: string
          country?: string | null
          cra_disclaimer?: string
          created_at?: string
          created_by?: string | null
          date_of_donation: string
          date_of_issue: string
          document_url?: string | null
          donation_id?: string | null
          donor_address: string
          donor_name: string
          eligible_amount: number
          id?: string
          is_consolidated?: boolean
          is_locked?: boolean | null
          issued_at?: string | null
          issued_by?: string | null
          locale?: string | null
          location_issued?: string | null
          organization_id: string
          receipt_number: string
          replaced_by_receipt_id?: string | null
          replaces_receipt_id?: string | null
          signatory_name?: string | null
          signatory_position?: string | null
          status?: Database["public"]["Enums"]["receipt_status"]
          updated_at?: string
        }
        Update: {
          advantage_description?: string | null
          advantage_value?: number | null
          amount?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          charity_address?: string
          charity_bn?: string
          charity_legal_name?: string
          country?: string | null
          cra_disclaimer?: string
          created_at?: string
          created_by?: string | null
          date_of_donation?: string
          date_of_issue?: string
          document_url?: string | null
          donation_id?: string | null
          donor_address?: string
          donor_name?: string
          eligible_amount?: number
          id?: string
          is_consolidated?: boolean
          is_locked?: boolean | null
          issued_at?: string | null
          issued_by?: string | null
          locale?: string | null
          location_issued?: string | null
          organization_id?: string
          receipt_number?: string
          replaced_by_receipt_id?: string | null
          replaces_receipt_id?: string | null
          signatory_name?: string | null
          signatory_position?: string | null
          status?: Database["public"]["Enums"]["receipt_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "donation_receipts_donation_id_fkey"
            columns: ["donation_id"]
            isOneToOne: false
            referencedRelation: "donations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donation_receipts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donation_receipts_replaced_by_receipt_id_fkey"
            columns: ["replaced_by_receipt_id"]
            isOneToOne: false
            referencedRelation: "donation_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donation_receipts_replaces_receipt_id_fkey"
            columns: ["replaces_receipt_id"]
            isOneToOne: false
            referencedRelation: "donation_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      donations: {
        Row: {
          advantage_description: string | null
          advantage_value: number | null
          amount: number
          bank_transaction_id: string | null
          campaign_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          currency: string
          date_received: string
          donation_number: string
          donation_type: Database["public"]["Enums"]["donation_type"]
          donor_id: string
          eligible_amount: number
          fund_id: string | null
          id: string
          journal_entry_id: string | null
          memo: string | null
          notes: string | null
          organization_id: string
          pledge_id: string | null
          program_id: string | null
          receipt_id: string | null
          receipt_issued: boolean | null
          status: Database["public"]["Enums"]["donation_status"]
          updated_at: string
        }
        Insert: {
          advantage_description?: string | null
          advantage_value?: number | null
          amount: number
          bank_transaction_id?: string | null
          campaign_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          date_received: string
          donation_number: string
          donation_type?: Database["public"]["Enums"]["donation_type"]
          donor_id: string
          eligible_amount: number
          fund_id?: string | null
          id?: string
          journal_entry_id?: string | null
          memo?: string | null
          notes?: string | null
          organization_id: string
          pledge_id?: string | null
          program_id?: string | null
          receipt_id?: string | null
          receipt_issued?: boolean | null
          status?: Database["public"]["Enums"]["donation_status"]
          updated_at?: string
        }
        Update: {
          advantage_description?: string | null
          advantage_value?: number | null
          amount?: number
          bank_transaction_id?: string | null
          campaign_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          date_received?: string
          donation_number?: string
          donation_type?: Database["public"]["Enums"]["donation_type"]
          donor_id?: string
          eligible_amount?: number
          fund_id?: string | null
          id?: string
          journal_entry_id?: string | null
          memo?: string | null
          notes?: string | null
          organization_id?: string
          pledge_id?: string | null
          program_id?: string | null
          receipt_id?: string | null
          receipt_issued?: boolean | null
          status?: Database["public"]["Enums"]["donation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "donations_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "donation_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "donation_funds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "donations_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_pledge_id_fkey"
            columns: ["pledge_id"]
            isOneToOne: false
            referencedRelation: "donation_pledges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "donation_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "donation_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      donor_preferences: {
        Row: {
          casl_consent: boolean | null
          casl_consent_date: string | null
          communication_preferences: Json | null
          created_at: string
          customer_id: string
          donor_type: Database["public"]["Enums"]["donor_type"] | null
          id: string
          is_anonymous: boolean | null
          notes: string | null
          pipeda_consent: boolean | null
          receipt_preference: string | null
          recognition_level: string | null
          updated_at: string
        }
        Insert: {
          casl_consent?: boolean | null
          casl_consent_date?: string | null
          communication_preferences?: Json | null
          created_at?: string
          customer_id: string
          donor_type?: Database["public"]["Enums"]["donor_type"] | null
          id?: string
          is_anonymous?: boolean | null
          notes?: string | null
          pipeda_consent?: boolean | null
          receipt_preference?: string | null
          recognition_level?: string | null
          updated_at?: string
        }
        Update: {
          casl_consent?: boolean | null
          casl_consent_date?: string | null
          communication_preferences?: Json | null
          created_at?: string
          customer_id?: string
          donor_type?: Database["public"]["Enums"]["donor_type"] | null
          id?: string
          is_anonymous?: boolean | null
          notes?: string | null
          pipeda_consent?: boolean | null
          receipt_preference?: string | null
          recognition_level?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "donor_preferences_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      efinsign_webhook_events: {
        Row: {
          event: string
          id: string
          received_at: string
        }
        Insert: {
          event: string
          id: string
          received_at?: string
        }
        Update: {
          event?: string
          id?: string
          received_at?: string
        }
        Relationships: []
      }
      employee_banking_profiles: {
        Row: {
          account_number: string | null
          allocation_percent: number
          created_at: string
          deposit_type: string
          employee_id: string
          id: string
          institution_number: string | null
          is_active: boolean
          metadata: Json
          organization_id: string
          transit_number: string | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          allocation_percent?: number
          created_at?: string
          deposit_type?: string
          employee_id: string
          id?: string
          institution_number?: string | null
          is_active?: boolean
          metadata?: Json
          organization_id: string
          transit_number?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          allocation_percent?: number
          created_at?: string
          deposit_type?: string
          employee_id?: string
          id?: string
          institution_number?: string | null
          is_active?: boolean
          metadata?: Json
          organization_id?: string
          transit_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      employee_compensation: {
        Row: {
          amount: number
          compensation_type: string
          created_at: string
          currency: string
          effective_date: string
          employee_id: string
          end_date: string | null
          frequency: string
          id: string
          notes: string | null
          organization_id: string
          source_batch_id: string | null
          taxable: boolean
          updated_at: string
        }
        Insert: {
          amount?: number
          compensation_type: string
          created_at?: string
          currency?: string
          effective_date?: string
          employee_id: string
          end_date?: string | null
          frequency?: string
          id?: string
          notes?: string | null
          organization_id: string
          source_batch_id?: string | null
          taxable?: boolean
          updated_at?: string
        }
        Update: {
          amount?: number
          compensation_type?: string
          created_at?: string
          currency?: string
          effective_date?: string
          employee_id?: string
          end_date?: string | null
          frequency?: string
          id?: string
          notes?: string | null
          organization_id?: string
          source_batch_id?: string | null
          taxable?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_compensation_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_compensation_source_batch_id_fkey"
            columns: ["source_batch_id"]
            isOneToOne: false
            referencedRelation: "employee_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_deductions: {
        Row: {
          amount: number
          category: string
          created_at: string
          currency: string
          deduction_type: string
          employee_id: string
          end_date: string | null
          frequency: string
          id: string
          notes: string | null
          organization_id: string
          source_batch_id: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          currency?: string
          deduction_type: string
          employee_id: string
          end_date?: string | null
          frequency?: string
          id?: string
          notes?: string | null
          organization_id: string
          source_batch_id?: string | null
          start_date?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          currency?: string
          deduction_type?: string
          employee_id?: string
          end_date?: string | null
          frequency?: string
          id?: string
          notes?: string | null
          organization_id?: string
          source_batch_id?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_deductions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_deductions_source_batch_id_fkey"
            columns: ["source_batch_id"]
            isOneToOne: false
            referencedRelation: "employee_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_guarantors: {
        Row: {
          confirmation_method: string | null
          confirmed: boolean
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          email: string | null
          employee_id: string
          full_name: string
          guarantor_order: number
          id: string
          marital_status: string | null
          notes: string | null
          office_address: string | null
          office_city: string | null
          office_country: string | null
          office_postal_code: string | null
          office_state: string | null
          organization_id: string
          phone_number: string | null
          profession: string | null
          relationship: string | null
          residential_address: string | null
          residential_city: string | null
          residential_country: string | null
          residential_postal_code: string | null
          residential_state: string | null
          sex: string | null
          updated_at: string
        }
        Insert: {
          confirmation_method?: string | null
          confirmed?: boolean
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          email?: string | null
          employee_id: string
          full_name: string
          guarantor_order: number
          id?: string
          marital_status?: string | null
          notes?: string | null
          office_address?: string | null
          office_city?: string | null
          office_country?: string | null
          office_postal_code?: string | null
          office_state?: string | null
          organization_id: string
          phone_number?: string | null
          profession?: string | null
          relationship?: string | null
          residential_address?: string | null
          residential_city?: string | null
          residential_country?: string | null
          residential_postal_code?: string | null
          residential_state?: string | null
          sex?: string | null
          updated_at?: string
        }
        Update: {
          confirmation_method?: string | null
          confirmed?: boolean
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          email?: string | null
          employee_id?: string
          full_name?: string
          guarantor_order?: number
          id?: string
          marital_status?: string | null
          notes?: string | null
          office_address?: string | null
          office_city?: string | null
          office_country?: string | null
          office_postal_code?: string | null
          office_state?: string | null
          organization_id?: string
          phone_number?: string | null
          profession?: string | null
          relationship?: string | null
          residential_address?: string | null
          residential_city?: string | null
          residential_country?: string | null
          residential_postal_code?: string | null
          residential_state?: string | null
          sex?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_guarantors_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_import_audit: {
        Row: {
          action: string
          batch_id: string
          details: Json
          id: string
          performed_at: string
          performed_by: string | null
        }
        Insert: {
          action: string
          batch_id: string
          details?: Json
          id?: string
          performed_at?: string
          performed_by?: string | null
        }
        Update: {
          action?: string
          batch_id?: string
          details?: Json
          id?: string
          performed_at?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_import_audit_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "employee_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_import_batches: {
        Row: {
          country_code: string | null
          created_at: string
          created_by: string | null
          created_count: number
          error_report: Json | null
          failed_count: number
          file_hash: string | null
          file_name: string | null
          file_size_bytes: number | null
          id: string
          import_mode: string
          organization_id: string
          posted_at: string | null
          posted_by: string | null
          replace_blanks: boolean
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          skipped_count: number
          status: string
          template_version: string
          total_rows: number
          updated_at: string
          updated_count: number
          validation_summary: Json
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          created_count?: number
          error_report?: Json | null
          failed_count?: number
          file_hash?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          id?: string
          import_mode?: string
          organization_id: string
          posted_at?: string | null
          posted_by?: string | null
          replace_blanks?: boolean
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          skipped_count?: number
          status?: string
          template_version?: string
          total_rows?: number
          updated_at?: string
          updated_count?: number
          validation_summary?: Json
        }
        Update: {
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          created_count?: number
          error_report?: Json | null
          failed_count?: number
          file_hash?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          id?: string
          import_mode?: string
          organization_id?: string
          posted_at?: string | null
          posted_by?: string | null
          replace_blanks?: boolean
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          skipped_count?: number
          status?: string
          template_version?: string
          total_rows?: number
          updated_at?: string
          updated_count?: number
          validation_summary?: Json
        }
        Relationships: []
      }
      employee_import_rows: {
        Row: {
          batch_id: string
          created_at: string
          employee_number: string | null
          id: string
          is_valid: boolean
          match_type: string | null
          posted: boolean
          posted_entity_id: string | null
          previous_data: Json | null
          raw_data: Json
          resolved_employee_id: string | null
          row_number: number
          sheet: string
          updated_at: string
          validation_errors: Json
          validation_warnings: Json
        }
        Insert: {
          batch_id: string
          created_at?: string
          employee_number?: string | null
          id?: string
          is_valid?: boolean
          match_type?: string | null
          posted?: boolean
          posted_entity_id?: string | null
          previous_data?: Json | null
          raw_data?: Json
          resolved_employee_id?: string | null
          row_number: number
          sheet: string
          updated_at?: string
          validation_errors?: Json
          validation_warnings?: Json
        }
        Update: {
          batch_id?: string
          created_at?: string
          employee_number?: string | null
          id?: string
          is_valid?: boolean
          match_type?: string | null
          posted?: boolean
          posted_entity_id?: string | null
          previous_data?: Json | null
          raw_data?: Json
          resolved_employee_id?: string | null
          row_number?: number
          sheet?: string
          updated_at?: string
          validation_errors?: Json
          validation_warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "employee_import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "employee_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_payment_methods: {
        Row: {
          account_name: string | null
          account_number_encrypted: string | null
          account_number_last4: string | null
          bank_name: string | null
          created_at: string
          currency: string
          employee_id: string
          iban: string | null
          id: string
          institution_number: string | null
          is_primary: boolean
          method: string
          organization_id: string
          routing_number: string | null
          source_batch_id: string | null
          swift: string | null
          transit_number: string | null
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number_encrypted?: string | null
          account_number_last4?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string
          employee_id: string
          iban?: string | null
          id?: string
          institution_number?: string | null
          is_primary?: boolean
          method?: string
          organization_id: string
          routing_number?: string | null
          source_batch_id?: string | null
          swift?: string | null
          transit_number?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number_encrypted?: string | null
          account_number_last4?: string | null
          bank_name?: string | null
          created_at?: string
          currency?: string
          employee_id?: string
          iban?: string | null
          id?: string
          institution_number?: string | null
          is_primary?: boolean
          method?: string
          organization_id?: string
          routing_number?: string | null
          source_batch_id?: string | null
          swift?: string | null
          transit_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_payment_methods_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_payment_methods_source_batch_id_fkey"
            columns: ["source_batch_id"]
            isOneToOne: false
            referencedRelation: "employee_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_self_service: {
        Row: {
          can_edit_personal_info: boolean | null
          can_submit_timesheets: boolean | null
          can_view_pay_stubs: boolean | null
          can_view_tax_slips: boolean | null
          created_at: string
          employee_id: string
          id: string
          last_login_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          can_edit_personal_info?: boolean | null
          can_submit_timesheets?: boolean | null
          can_view_pay_stubs?: boolean | null
          can_view_tax_slips?: boolean | null
          created_at?: string
          employee_id: string
          id?: string
          last_login_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          can_edit_personal_info?: boolean | null
          can_submit_timesheets?: boolean | null
          can_view_pay_stubs?: boolean | null
          can_view_tax_slips?: boolean | null
          created_at?: string
          employee_id?: string
          id?: string
          last_login_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_self_service_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_stripe_connect: {
        Row: {
          connected_account_id: string
          created_at: string
          employee_id: string
          id: string
          organization_id: string
        }
        Insert: {
          connected_account_id: string
          created_at?: string
          employee_id: string
          id?: string
          organization_id: string
        }
        Update: {
          connected_account_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_stripe_connect_connected_account_id_fkey"
            columns: ["connected_account_id"]
            isOneToOne: false
            referencedRelation: "stripe_connected_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_td1: {
        Row: {
          additional_tax_deduction: number | null
          age_amount: number | null
          ai_confidence: number | null
          ai_suggested: boolean | null
          basic_personal_amount: number
          canada_employment_amount: number | null
          caregiver_amount: number | null
          created_at: string
          dependant_amount: number | null
          disability_amount: number | null
          employee_id: string
          form_type: string
          id: string
          non_resident: boolean | null
          other_credits: number | null
          pension_income_amount: number | null
          reduce_tax_deduction: boolean | null
          signed_date: string | null
          spouse_amount: number | null
          tax_year: number
          total_claim_amount: number
          tuition_amount: number | null
          updated_at: string
        }
        Insert: {
          additional_tax_deduction?: number | null
          age_amount?: number | null
          ai_confidence?: number | null
          ai_suggested?: boolean | null
          basic_personal_amount?: number
          canada_employment_amount?: number | null
          caregiver_amount?: number | null
          created_at?: string
          dependant_amount?: number | null
          disability_amount?: number | null
          employee_id: string
          form_type?: string
          id?: string
          non_resident?: boolean | null
          other_credits?: number | null
          pension_income_amount?: number | null
          reduce_tax_deduction?: boolean | null
          signed_date?: string | null
          spouse_amount?: number | null
          tax_year?: number
          total_claim_amount?: number
          tuition_amount?: number | null
          updated_at?: string
        }
        Update: {
          additional_tax_deduction?: number | null
          age_amount?: number | null
          ai_confidence?: number | null
          ai_suggested?: boolean | null
          basic_personal_amount?: number
          canada_employment_amount?: number | null
          caregiver_amount?: number | null
          created_at?: string
          dependant_amount?: number | null
          disability_amount?: number | null
          employee_id?: string
          form_type?: string
          id?: string
          non_resident?: boolean | null
          other_credits?: number | null
          pension_income_amount?: number | null
          reduce_tax_deduction?: boolean | null
          signed_date?: string | null
          spouse_amount?: number | null
          tax_year?: number
          total_claim_amount?: number
          tuition_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_td1_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_timesheets: {
        Row: {
          approval_method: Database["public"]["Enums"]["approval_method"] | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          employee_id: string
          entry_type: Database["public"]["Enums"]["timesheet_entry_type"]
          id: string
          notes: string | null
          organization_id: string | null
          pay_run_id: string | null
          period_end: string
          period_start: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["timesheet_status"]
          submitted_at: string | null
          total_hours: number | null
          total_overtime_hours: number | null
          total_regular_hours: number | null
          updated_at: string
        }
        Insert: {
          approval_method?:
            | Database["public"]["Enums"]["approval_method"]
            | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          employee_id: string
          entry_type?: Database["public"]["Enums"]["timesheet_entry_type"]
          id?: string
          notes?: string | null
          organization_id?: string | null
          pay_run_id?: string | null
          period_end: string
          period_start: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["timesheet_status"]
          submitted_at?: string | null
          total_hours?: number | null
          total_overtime_hours?: number | null
          total_regular_hours?: number | null
          updated_at?: string
        }
        Update: {
          approval_method?:
            | Database["public"]["Enums"]["approval_method"]
            | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          employee_id?: string
          entry_type?: Database["public"]["Enums"]["timesheet_entry_type"]
          id?: string
          notes?: string | null
          organization_id?: string | null
          pay_run_id?: string | null
          period_end?: string
          period_start?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["timesheet_status"]
          submitted_at?: string | null
          total_hours?: number | null
          total_overtime_hours?: number | null
          total_regular_hours?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_timesheets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_timesheets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_timesheets_pay_run_id_fkey"
            columns: ["pay_run_id"]
            isOneToOne: false
            referencedRelation: "pay_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          annual_salary: number | null
          bank_account: string | null
          bank_institution: string | null
          bank_transit: string | null
          city: string | null
          cost_centre: string | null
          country: string | null
          cpp_exempt: boolean
          created_at: string
          date_of_birth: string | null
          deleted_at: string | null
          department: string | null
          ei_exempt: boolean
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          employee_number: string
          employment_type: Database["public"]["Enums"]["employment_type"]
          first_name: string
          guarantors_confirmed: boolean
          hire_date: string
          hourly_rate: number | null
          id: string
          job_title: string | null
          last_name: string
          mailing_province: string | null
          manager_id: string | null
          national_id_encrypted: string | null
          nationality: string | null
          notes: string | null
          organization_id: string | null
          pay_frequency: Database["public"]["Enums"]["pay_frequency"]
          payroll_start_date: string | null
          phone: string | null
          postal_code: string | null
          preferred_name: string | null
          province: string
          sin_encrypted: string | null
          status: Database["public"]["Enums"]["employee_status"]
          statutory_profile: Json
          tax_id_encrypted: string | null
          termination_date: string | null
          termination_reason_code:
            | Database["public"]["Enums"]["roe_reason"]
            | null
          termination_reason_notes: string | null
          updated_at: string
          work_schedule: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          annual_salary?: number | null
          bank_account?: string | null
          bank_institution?: string | null
          bank_transit?: string | null
          city?: string | null
          cost_centre?: string | null
          country?: string | null
          cpp_exempt?: boolean
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          department?: string | null
          ei_exempt?: boolean
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          employee_number: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          first_name: string
          guarantors_confirmed?: boolean
          hire_date: string
          hourly_rate?: number | null
          id?: string
          job_title?: string | null
          last_name: string
          mailing_province?: string | null
          manager_id?: string | null
          national_id_encrypted?: string | null
          nationality?: string | null
          notes?: string | null
          organization_id?: string | null
          pay_frequency?: Database["public"]["Enums"]["pay_frequency"]
          payroll_start_date?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_name?: string | null
          province?: string
          sin_encrypted?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          statutory_profile?: Json
          tax_id_encrypted?: string | null
          termination_date?: string | null
          termination_reason_code?:
            | Database["public"]["Enums"]["roe_reason"]
            | null
          termination_reason_notes?: string | null
          updated_at?: string
          work_schedule?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          annual_salary?: number | null
          bank_account?: string | null
          bank_institution?: string | null
          bank_transit?: string | null
          city?: string | null
          cost_centre?: string | null
          country?: string | null
          cpp_exempt?: boolean
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          department?: string | null
          ei_exempt?: boolean
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          employee_number?: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          first_name?: string
          guarantors_confirmed?: boolean
          hire_date?: string
          hourly_rate?: number | null
          id?: string
          job_title?: string | null
          last_name?: string
          mailing_province?: string | null
          manager_id?: string | null
          national_id_encrypted?: string | null
          nationality?: string | null
          notes?: string | null
          organization_id?: string | null
          pay_frequency?: Database["public"]["Enums"]["pay_frequency"]
          payroll_start_date?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_name?: string | null
          province?: string
          sin_encrypted?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          statutory_profile?: Json
          tax_id_encrypted?: string | null
          termination_date?: string | null
          termination_reason_code?:
            | Database["public"]["Enums"]["roe_reason"]
            | null
          termination_reason_notes?: string | null
          updated_at?: string
          work_schedule?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      equity_movements: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          equity_account_id: string
          fiscal_year: number
          id: string
          movement_type: string
          organization_id: string
          source_module: string | null
          source_reference: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          equity_account_id: string
          fiscal_year: number
          id?: string
          movement_type: string
          organization_id: string
          source_module?: string | null
          source_reference?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          equity_account_id?: string
          fiscal_year?: number
          id?: string
          movement_type?: string
          organization_id?: string
          source_module?: string | null
          source_reference?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equity_movements_equity_account_id_fkey"
            columns: ["equity_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equity_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      eu_oss_return_lines: {
        Row: {
          created_at: string
          id: string
          member_state_of_consumption: string
          organization_id: string
          return_id: string
          supply_type: string
          taxable_base_cents: number
          vat_amount_cents: number
          vat_rate: number
          vat_rate_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_state_of_consumption: string
          organization_id: string
          return_id: string
          supply_type: string
          taxable_base_cents: number
          vat_amount_cents: number
          vat_rate: number
          vat_rate_type: string
        }
        Update: {
          created_at?: string
          id?: string
          member_state_of_consumption?: string
          organization_id?: string
          return_id?: string
          supply_type?: string
          taxable_base_cents?: number
          vat_amount_cents?: number
          vat_rate?: number
          vat_rate_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "eu_oss_return_lines_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "eu_oss_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      eu_oss_returns: {
        Row: {
          confirmation_number: string | null
          created_at: string
          currency: string
          id: string
          notes: string | null
          organization_id: string
          period_end: string
          period_quarter: number
          period_start: string
          period_year: number
          registration_id: string
          scheme: string
          status: string
          submitted_at: string | null
          total_taxable_base_cents: number
          total_vat_cents: number
          updated_at: string
          xml_payload: string | null
        }
        Insert: {
          confirmation_number?: string | null
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          organization_id: string
          period_end: string
          period_quarter: number
          period_start: string
          period_year: number
          registration_id: string
          scheme: string
          status?: string
          submitted_at?: string | null
          total_taxable_base_cents?: number
          total_vat_cents?: number
          updated_at?: string
          xml_payload?: string | null
        }
        Update: {
          confirmation_number?: string | null
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          organization_id?: string
          period_end?: string
          period_quarter?: number
          period_start?: string
          period_year?: number
          registration_id?: string
          scheme?: string
          status?: string
          submitted_at?: string | null
          total_taxable_base_cents?: number
          total_vat_cents?: number
          updated_at?: string
          xml_payload?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eu_oss_returns_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "eu_vat_oss_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      eu_reverse_charge_log: {
        Row: {
          created_at: string
          currency: string
          customer_country_code: string
          customer_id: string | null
          customer_name: string | null
          customer_vat_number: string
          document_date: string
          document_reference: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          organization_id: string
          supply_type: string
          taxable_amount_cents: number
          vies_validation_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          customer_country_code: string
          customer_id?: string | null
          customer_name?: string | null
          customer_vat_number: string
          document_date: string
          document_reference?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          organization_id: string
          supply_type: string
          taxable_amount_cents: number
          vies_validation_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          customer_country_code?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_vat_number?: string
          document_date?: string
          document_reference?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          organization_id?: string
          supply_type?: string
          taxable_amount_cents?: number
          vies_validation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eu_reverse_charge_log_vies_validation_id_fkey"
            columns: ["vies_validation_id"]
            isOneToOne: false
            referencedRelation: "eu_vat_number_validations"
            referencedColumns: ["id"]
          },
        ]
      }
      eu_vat_number_validations: {
        Row: {
          country_code: string
          created_at: string
          customer_id: string | null
          expires_at: string
          id: string
          is_valid: boolean
          organization_id: string
          raw_response: Json | null
          trader_address: string | null
          trader_name: string | null
          vat_number: string
          vies_consultation_number: string | null
          vies_request_date: string
        }
        Insert: {
          country_code: string
          created_at?: string
          customer_id?: string | null
          expires_at?: string
          id?: string
          is_valid: boolean
          organization_id: string
          raw_response?: Json | null
          trader_address?: string | null
          trader_name?: string | null
          vat_number: string
          vies_consultation_number?: string | null
          vies_request_date?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          customer_id?: string | null
          expires_at?: string
          id?: string
          is_valid?: boolean
          organization_id?: string
          raw_response?: Json | null
          trader_address?: string | null
          trader_name?: string | null
          vat_number?: string
          vies_consultation_number?: string | null
          vies_request_date?: string
        }
        Relationships: []
      }
      eu_vat_oss_registrations: {
        Row: {
          created_at: string
          effective_date: string
          end_date: string | null
          id: string
          ioss_intermediary_number: string | null
          is_active: boolean
          member_state_of_identification: string
          notes: string | null
          organization_id: string
          oss_registration_number: string
          scheme: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          effective_date: string
          end_date?: string | null
          id?: string
          ioss_intermediary_number?: string | null
          is_active?: boolean
          member_state_of_identification: string
          notes?: string | null
          organization_id: string
          oss_registration_number: string
          scheme: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          end_date?: string | null
          id?: string
          ioss_intermediary_number?: string | null
          is_active?: boolean
          member_state_of_identification?: string
          notes?: string | null
          organization_id?: string
          oss_registration_number?: string
          scheme?: string
          updated_at?: string
        }
        Relationships: []
      }
      eu_vat_rates: {
        Row: {
          country_code: string
          country_name: string
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          parking_rate: number | null
          reduced_rate_1: number | null
          reduced_rate_2: number | null
          source_url: string | null
          standard_rate: number
          super_reduced_rate: number | null
        }
        Insert: {
          country_code: string
          country_name: string
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id?: string
          parking_rate?: number | null
          reduced_rate_1?: number | null
          reduced_rate_2?: number | null
          source_url?: string | null
          standard_rate: number
          super_reduced_rate?: number | null
        }
        Update: {
          country_code?: string
          country_name?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          parking_rate?: number | null
          reduced_rate_1?: number | null
          reduced_rate_2?: number | null
          source_url?: string | null
          standard_rate?: number
          super_reduced_rate?: number | null
        }
        Relationships: []
      }
      exchange_rate_audit: {
        Row: {
          action: string
          effective_date: string
          exchange_rate_id: string | null
          from_currency: string
          id: string
          new_rate: number
          old_rate: number | null
          organization_id: string
          performed_at: string
          performed_by: string | null
          source: string | null
          to_currency: string
        }
        Insert: {
          action: string
          effective_date: string
          exchange_rate_id?: string | null
          from_currency: string
          id?: string
          new_rate: number
          old_rate?: number | null
          organization_id: string
          performed_at?: string
          performed_by?: string | null
          source?: string | null
          to_currency: string
        }
        Update: {
          action?: string
          effective_date?: string
          exchange_rate_id?: string | null
          from_currency?: string
          id?: string
          new_rate?: number
          old_rate?: number | null
          organization_id?: string
          performed_at?: string
          performed_by?: string | null
          source?: string | null
          to_currency?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rate_audit_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rate_locks: {
        Row: {
          id: string
          locked: boolean
          locked_at: string
          locked_by: string | null
          notes: string | null
          organization_id: string
          period_end: string
        }
        Insert: {
          id?: string
          locked?: boolean
          locked_at?: string
          locked_by?: string | null
          notes?: string | null
          organization_id: string
          period_end: string
        }
        Update: {
          id?: string
          locked?: boolean
          locked_at?: string
          locked_by?: string | null
          notes?: string | null
          organization_id?: string
          period_end?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rate_locks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          created_at: string
          effective_date: string
          from_currency: string
          id: string
          organization_id: string | null
          rate: number
          source: string | null
          to_currency: string
        }
        Insert: {
          created_at?: string
          effective_date: string
          from_currency: string
          id?: string
          organization_id?: string | null
          rate: number
          source?: string | null
          to_currency: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          from_currency?: string
          id?: string
          organization_id?: string | null
          rate?: number
          source?: string | null
          to_currency?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_statement_signatures: {
        Row: {
          archived_pdf_url: string | null
          certification_text: string
          created_at: string
          fiscal_year_id: string | null
          id: string
          ip_address: string | null
          is_latest: boolean
          organization_id: string
          period_end: string
          period_start: string
          report_snapshot: Json | null
          report_snapshot_hash: string | null
          revision: number
          signature_hash: string | null
          signature_image_url: string
          signed_at: string
          signer_name: string
          signer_role: string
          signer_title: string
          signer_user_id: string
          statement_type: Database["public"]["Enums"]["exec_statement_type"]
          user_agent: string | null
        }
        Insert: {
          archived_pdf_url?: string | null
          certification_text: string
          created_at?: string
          fiscal_year_id?: string | null
          id?: string
          ip_address?: string | null
          is_latest?: boolean
          organization_id: string
          period_end: string
          period_start: string
          report_snapshot?: Json | null
          report_snapshot_hash?: string | null
          revision?: number
          signature_hash?: string | null
          signature_image_url: string
          signed_at?: string
          signer_name: string
          signer_role?: string
          signer_title: string
          signer_user_id: string
          statement_type: Database["public"]["Enums"]["exec_statement_type"]
          user_agent?: string | null
        }
        Update: {
          archived_pdf_url?: string | null
          certification_text?: string
          created_at?: string
          fiscal_year_id?: string | null
          id?: string
          ip_address?: string | null
          is_latest?: boolean
          organization_id?: string
          period_end?: string
          period_start?: string
          report_snapshot?: Json | null
          report_snapshot_hash?: string | null
          revision?: number
          signature_hash?: string | null
          signature_image_url?: string
          signed_at?: string
          signer_name?: string
          signer_role?: string
          signer_title?: string
          signer_user_id?: string
          statement_type?: Database["public"]["Enums"]["exec_statement_type"]
          user_agent?: string | null
        }
        Relationships: []
      }
      expense_claim_lines: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          customer_id: string | null
          department_id: string | null
          description: string
          expense_account_id: string | null
          expense_claim_id: string
          expense_date: string
          id: string
          is_billable: boolean | null
          line_order: number
          receipt_url: string | null
          receipt_urls: string[]
          tax_amount: number | null
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          customer_id?: string | null
          department_id?: string | null
          description: string
          expense_account_id?: string | null
          expense_claim_id: string
          expense_date: string
          id?: string
          is_billable?: boolean | null
          line_order?: number
          receipt_url?: string | null
          receipt_urls?: string[]
          tax_amount?: number | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          customer_id?: string | null
          department_id?: string | null
          description?: string
          expense_account_id?: string | null
          expense_claim_id?: string
          expense_date?: string
          id?: string
          is_billable?: boolean | null
          line_order?: number
          receipt_url?: string | null
          receipt_urls?: string[]
          tax_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_claim_lines_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_claim_lines_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_claim_lines_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_claim_lines_expense_claim_id_fkey"
            columns: ["expense_claim_id"]
            isOneToOne: false
            referencedRelation: "expense_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_claims: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          claim_date: string
          claim_number: string
          created_at: string
          currency: string
          department_id: string | null
          description: string | null
          employee_id: string
          id: string
          journal_entry_id: string | null
          notes: string | null
          organization_id: string | null
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          stripe_connected_account_id: string | null
          submitted_at: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          claim_date?: string
          claim_number: string
          created_at?: string
          currency?: string
          department_id?: string | null
          description?: string | null
          employee_id: string
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          organization_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          stripe_connected_account_id?: string | null
          submitted_at?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          claim_date?: string
          claim_number?: string
          created_at?: string
          currency?: string
          department_id?: string | null
          description?: string | null
          employee_id?: string
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          organization_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          stripe_connected_account_id?: string | null
          submitted_at?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_claims_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_claims_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_claims_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "expense_claims_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_claims_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_claims_stripe_connected_account_id_fkey"
            columns: ["stripe_connected_account_id"]
            isOneToOne: false
            referencedRelation: "stripe_connected_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_items: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          expense_account_id: string | null
          expense_id: string
          id: string
          line_order: number | null
          quantity: number | null
          tax_amount: number | null
          tax_code_id: string | null
          unit_price: number | null
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          expense_account_id?: string | null
          expense_id: string
          id?: string
          line_order?: number | null
          quantity?: number | null
          tax_amount?: number | null
          tax_code_id?: string | null
          unit_price?: number | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          expense_account_id?: string | null
          expense_id?: string
          id?: string
          line_order?: number | null
          quantity?: number | null
          tax_amount?: number | null
          tax_code_id?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_items_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_items_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_items_tax_code_id_fkey"
            columns: ["tax_code_id"]
            isOneToOne: false
            referencedRelation: "tax_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_taxes: {
        Row: {
          authority: string | null
          created_at: string | null
          expense_id: string
          gl_account_id: string | null
          id: string
          is_recoverable: boolean | null
          jurisdiction_code: string | null
          rate: number
          tax_amount: number
          tax_code: string | null
          tax_type: string
          taxable_amount: number
        }
        Insert: {
          authority?: string | null
          created_at?: string | null
          expense_id: string
          gl_account_id?: string | null
          id?: string
          is_recoverable?: boolean | null
          jurisdiction_code?: string | null
          rate: number
          tax_amount: number
          tax_code?: string | null
          tax_type: string
          taxable_amount: number
        }
        Update: {
          authority?: string | null
          created_at?: string | null
          expense_id?: string
          gl_account_id?: string | null
          id?: string
          is_recoverable?: boolean | null
          jurisdiction_code?: string | null
          rate?: number
          tax_amount?: number
          tax_code?: string | null
          tax_type?: string
          taxable_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_taxes_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_taxes_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          department_id: string | null
          distance: number | null
          distance_unit: string | null
          expense_account_id: string | null
          expense_date: string
          expense_type: string
          from_location: string | null
          id: string
          is_billable: boolean | null
          is_posted: boolean | null
          journal_entry_id: string | null
          notes: string | null
          organization_id: string | null
          paid_through_account_id: string | null
          rate_per_unit: number | null
          receipt_url: string | null
          receipt_urls: string[]
          reference: string | null
          tax_amount: number | null
          tax_code_id: string | null
          tax_treatment: string
          to_location: string | null
          updated_at: string
          vehicle_description: string | null
          vendor_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          department_id?: string | null
          distance?: number | null
          distance_unit?: string | null
          expense_account_id?: string | null
          expense_date?: string
          expense_type?: string
          from_location?: string | null
          id?: string
          is_billable?: boolean | null
          is_posted?: boolean | null
          journal_entry_id?: string | null
          notes?: string | null
          organization_id?: string | null
          paid_through_account_id?: string | null
          rate_per_unit?: number | null
          receipt_url?: string | null
          receipt_urls?: string[]
          reference?: string | null
          tax_amount?: number | null
          tax_code_id?: string | null
          tax_treatment?: string
          to_location?: string | null
          updated_at?: string
          vehicle_description?: string | null
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          department_id?: string | null
          distance?: number | null
          distance_unit?: string | null
          expense_account_id?: string | null
          expense_date?: string
          expense_type?: string
          from_location?: string | null
          id?: string
          is_billable?: boolean | null
          is_posted?: boolean | null
          journal_entry_id?: string | null
          notes?: string | null
          organization_id?: string | null
          paid_through_account_id?: string | null
          rate_per_unit?: number | null
          receipt_url?: string | null
          receipt_urls?: string[]
          reference?: string | null
          tax_amount?: number | null
          tax_code_id?: string | null
          tax_treatment?: string
          to_location?: string | null
          updated_at?: string
          vehicle_description?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "expenses_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_through_account_id_fkey"
            columns: ["paid_through_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_tax_code_id_fkey"
            columns: ["tax_code_id"]
            isOneToOne: false
            referencedRelation: "tax_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      fintrac_eftr_reports: {
        Row: {
          aggregate_amount: number
          conductor_name: string | null
          counterparty_country: string | null
          counterparty_name: string | null
          created_at: string
          currency: string
          direction: string
          due_at: string | null
          filed_at: string | null
          filed_by: string | null
          fintrac_reference: string | null
          id: string
          notes: string | null
          organization_id: string
          report_status: string
          source_kind: string | null
          source_transaction_ids: string[]
          updated_at: string
          window_end: string
          window_start: string
        }
        Insert: {
          aggregate_amount: number
          conductor_name?: string | null
          counterparty_country?: string | null
          counterparty_name?: string | null
          created_at?: string
          currency?: string
          direction?: string
          due_at?: string | null
          filed_at?: string | null
          filed_by?: string | null
          fintrac_reference?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          report_status?: string
          source_kind?: string | null
          source_transaction_ids?: string[]
          updated_at?: string
          window_end: string
          window_start: string
        }
        Update: {
          aggregate_amount?: number
          conductor_name?: string | null
          counterparty_country?: string | null
          counterparty_name?: string | null
          created_at?: string
          currency?: string
          direction?: string
          due_at?: string | null
          filed_at?: string | null
          filed_by?: string | null
          fintrac_reference?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          report_status?: string
          source_kind?: string | null
          source_transaction_ids?: string[]
          updated_at?: string
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      fintrac_large_eft_reports: {
        Row: {
          aggregate_amount: number
          created_at: string
          currency: string
          filed_at: string | null
          fintrac_reference: string | null
          id: string
          notes: string | null
          organization_id: string
          report_status: string
          reportable_date: string
          tax_payment_id: string | null
          updated_at: string
        }
        Insert: {
          aggregate_amount: number
          created_at?: string
          currency?: string
          filed_at?: string | null
          fintrac_reference?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          report_status?: string
          reportable_date: string
          tax_payment_id?: string | null
          updated_at?: string
        }
        Update: {
          aggregate_amount?: number
          created_at?: string
          currency?: string
          filed_at?: string | null
          fintrac_reference?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          report_status?: string
          reportable_date?: string
          tax_payment_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fintrac_large_eft_reports_tax_payment_id_fkey"
            columns: ["tax_payment_id"]
            isOneToOne: false
            referencedRelation: "tax_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      fintrac_lctr_reports: {
        Row: {
          aggregate_amount: number
          conductor_id: string | null
          conductor_name: string | null
          created_at: string
          currency: string
          due_at: string | null
          filed_at: string | null
          filed_by: string | null
          fintrac_reference: string | null
          id: string
          notes: string | null
          organization_id: string
          report_status: string
          source_transaction_ids: string[]
          updated_at: string
          window_end: string
          window_start: string
        }
        Insert: {
          aggregate_amount: number
          conductor_id?: string | null
          conductor_name?: string | null
          created_at?: string
          currency?: string
          due_at?: string | null
          filed_at?: string | null
          filed_by?: string | null
          fintrac_reference?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          report_status?: string
          source_transaction_ids?: string[]
          updated_at?: string
          window_end: string
          window_start: string
        }
        Update: {
          aggregate_amount?: number
          conductor_id?: string | null
          conductor_name?: string | null
          created_at?: string
          currency?: string
          due_at?: string | null
          filed_at?: string | null
          filed_by?: string | null
          fintrac_reference?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          report_status?: string
          source_transaction_ids?: string[]
          updated_at?: string
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      fintrac_retention_locks: {
        Row: {
          id: string
          locked_at: string
          organization_id: string
          reason: string | null
          report_id: string
          report_table: string
          retain_until: string
        }
        Insert: {
          id?: string
          locked_at?: string
          organization_id: string
          reason?: string | null
          report_id: string
          report_table: string
          retain_until: string
        }
        Update: {
          id?: string
          locked_at?: string
          organization_id?: string
          reason?: string | null
          report_id?: string
          report_table?: string
          retain_until?: string
        }
        Relationships: []
      }
      fintrac_str_reports: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          detected_at: string
          due_at: string | null
          filed_at: string | null
          filed_by: string | null
          fintrac_reference: string | null
          id: string
          narrative: string | null
          narrative_drafted_by_ai: boolean
          notes: string | null
          organization_id: string
          related_transaction_ids: string[]
          report_status: string
          risk_flags: Json
          subject_id: string | null
          subject_name: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          detected_at?: string
          due_at?: string | null
          filed_at?: string | null
          filed_by?: string | null
          fintrac_reference?: string | null
          id?: string
          narrative?: string | null
          narrative_drafted_by_ai?: boolean
          notes?: string | null
          organization_id: string
          related_transaction_ids?: string[]
          report_status?: string
          risk_flags?: Json
          subject_id?: string | null
          subject_name?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          detected_at?: string
          due_at?: string | null
          filed_at?: string | null
          filed_by?: string | null
          fintrac_reference?: string | null
          id?: string
          narrative?: string | null
          narrative_drafted_by_ai?: boolean
          notes?: string | null
          organization_id?: string
          related_transaction_ids?: string[]
          report_status?: string
          risk_flags?: Json
          subject_id?: string | null
          subject_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      firm_client_links: {
        Row: {
          id: string
          linked_at: string
          linked_by: string | null
          organization_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          linked_at?: string
          linked_by?: string | null
          organization_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          linked_at?: string
          linked_by?: string | null
          organization_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "firm_client_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "firm_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      firm_workspace_members: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "firm_workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "firm_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      firm_workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
        }
        Relationships: []
      }
      fiscal_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          end_date: string
          id: string
          name: string
          notes: string | null
          organization_id: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          end_date: string
          id?: string
          name: string
          notes?: string | null
          organization_id?: string | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_periods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_year_closes: {
        Row: {
          closed_at: string
          closed_by: string | null
          closing_journal_entry_id: string | null
          created_at: string
          fiscal_year: number
          fiscal_year_end: string
          fiscal_year_start: string
          id: string
          net_income: number
          notes: string | null
          organization_id: string
          retained_earnings_account_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string
          closed_by?: string | null
          closing_journal_entry_id?: string | null
          created_at?: string
          fiscal_year: number
          fiscal_year_end: string
          fiscal_year_start: string
          id?: string
          net_income: number
          notes?: string | null
          organization_id: string
          retained_earnings_account_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string
          closed_by?: string | null
          closing_journal_entry_id?: string | null
          created_at?: string
          fiscal_year?: number
          fiscal_year_end?: string
          fiscal_year_start?: string
          id?: string
          net_income?: number
          notes?: string | null
          organization_id?: string
          retained_earnings_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_year_closes_closing_journal_entry_id_fkey"
            columns: ["closing_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "fiscal_year_closes_closing_journal_entry_id_fkey"
            columns: ["closing_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_year_closes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_year_closes_retained_earnings_account_id_fkey"
            columns: ["retained_earnings_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_asset_categories: {
        Row: {
          accumulated_depreciation_account_id: string | null
          asset_account_id: string | null
          country_id: string | null
          created_at: string
          default_cca_class: string | null
          default_cca_rate: number | null
          default_declining_rate: number | null
          default_depreciation_method: string
          default_useful_life_months: number
          depreciation_account_id: string | null
          description: string | null
          gain_loss_account_id: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          accumulated_depreciation_account_id?: string | null
          asset_account_id?: string | null
          country_id?: string | null
          created_at?: string
          default_cca_class?: string | null
          default_cca_rate?: number | null
          default_declining_rate?: number | null
          default_depreciation_method?: string
          default_useful_life_months?: number
          depreciation_account_id?: string | null
          description?: string | null
          gain_loss_account_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          accumulated_depreciation_account_id?: string | null
          asset_account_id?: string | null
          country_id?: string | null
          created_at?: string
          default_cca_class?: string | null
          default_cca_rate?: number | null
          default_declining_rate?: number | null
          default_depreciation_method?: string
          default_useful_life_months?: number
          depreciation_account_id?: string | null
          description?: string | null
          gain_loss_account_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_asset_categories_accumulated_depreciation_account_id_fkey"
            columns: ["accumulated_depreciation_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_asset_categories_asset_account_id_fkey"
            columns: ["asset_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_asset_categories_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_asset_categories_depreciation_account_id_fkey"
            columns: ["depreciation_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_asset_categories_gain_loss_account_id_fkey"
            columns: ["gain_loss_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_asset_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_assets: {
        Row: {
          accumulated_depreciation: number
          accumulated_depreciation_account_id: string | null
          acquisition_cost: number
          acquisition_date: string
          acquisition_journal_id: string | null
          acquisition_method: string
          ai_classification_confidence: number | null
          ai_suggested_class: string | null
          ai_suggested_useful_life: number | null
          asset_account_id: string | null
          asset_condition: string | null
          asset_number: string
          barcode: string | null
          bill_id: string | null
          book_value: number
          capitalization_threshold: number | null
          category_id: string | null
          cca_class: string | null
          cca_rate: number | null
          cost_center: string | null
          country_id: string | null
          created_at: string
          custodian_id: string | null
          declining_rate: number | null
          department_id: string | null
          depreciation_account_id: string | null
          depreciation_method: string
          depreciation_start_date: string
          description: string | null
          disposal_amount: number | null
          disposal_date: string | null
          disposal_journal_entry_id: string | null
          disposal_method: string | null
          funding_source: string | null
          half_year_convention: boolean | null
          id: string
          idle_since: string | null
          impairment_amount: number | null
          insurance_expiry_date: string | null
          insurance_policy_ref: string | null
          invoice_number: string | null
          is_idle: boolean | null
          last_revaluation_date: string | null
          location: string | null
          location_id: string | null
          name: string
          notes: string | null
          organization_id: string | null
          ownership_status: string | null
          qr_code: string | null
          revaluation_amount: number | null
          salvage_value: number
          serial_number: string | null
          status: string
          tax_accumulated_depreciation: number | null
          tax_book_value: number | null
          tax_depreciation_method: string | null
          updated_at: string
          useful_life_months: number
          vendor_id: string | null
          warranty_expiry_date: string | null
        }
        Insert: {
          accumulated_depreciation?: number
          accumulated_depreciation_account_id?: string | null
          acquisition_cost: number
          acquisition_date: string
          acquisition_journal_id?: string | null
          acquisition_method?: string
          ai_classification_confidence?: number | null
          ai_suggested_class?: string | null
          ai_suggested_useful_life?: number | null
          asset_account_id?: string | null
          asset_condition?: string | null
          asset_number: string
          barcode?: string | null
          bill_id?: string | null
          book_value: number
          capitalization_threshold?: number | null
          category_id?: string | null
          cca_class?: string | null
          cca_rate?: number | null
          cost_center?: string | null
          country_id?: string | null
          created_at?: string
          custodian_id?: string | null
          declining_rate?: number | null
          department_id?: string | null
          depreciation_account_id?: string | null
          depreciation_method?: string
          depreciation_start_date: string
          description?: string | null
          disposal_amount?: number | null
          disposal_date?: string | null
          disposal_journal_entry_id?: string | null
          disposal_method?: string | null
          funding_source?: string | null
          half_year_convention?: boolean | null
          id?: string
          idle_since?: string | null
          impairment_amount?: number | null
          insurance_expiry_date?: string | null
          insurance_policy_ref?: string | null
          invoice_number?: string | null
          is_idle?: boolean | null
          last_revaluation_date?: string | null
          location?: string | null
          location_id?: string | null
          name: string
          notes?: string | null
          organization_id?: string | null
          ownership_status?: string | null
          qr_code?: string | null
          revaluation_amount?: number | null
          salvage_value?: number
          serial_number?: string | null
          status?: string
          tax_accumulated_depreciation?: number | null
          tax_book_value?: number | null
          tax_depreciation_method?: string | null
          updated_at?: string
          useful_life_months: number
          vendor_id?: string | null
          warranty_expiry_date?: string | null
        }
        Update: {
          accumulated_depreciation?: number
          accumulated_depreciation_account_id?: string | null
          acquisition_cost?: number
          acquisition_date?: string
          acquisition_journal_id?: string | null
          acquisition_method?: string
          ai_classification_confidence?: number | null
          ai_suggested_class?: string | null
          ai_suggested_useful_life?: number | null
          asset_account_id?: string | null
          asset_condition?: string | null
          asset_number?: string
          barcode?: string | null
          bill_id?: string | null
          book_value?: number
          capitalization_threshold?: number | null
          category_id?: string | null
          cca_class?: string | null
          cca_rate?: number | null
          cost_center?: string | null
          country_id?: string | null
          created_at?: string
          custodian_id?: string | null
          declining_rate?: number | null
          department_id?: string | null
          depreciation_account_id?: string | null
          depreciation_method?: string
          depreciation_start_date?: string
          description?: string | null
          disposal_amount?: number | null
          disposal_date?: string | null
          disposal_journal_entry_id?: string | null
          disposal_method?: string | null
          funding_source?: string | null
          half_year_convention?: boolean | null
          id?: string
          idle_since?: string | null
          impairment_amount?: number | null
          insurance_expiry_date?: string | null
          insurance_policy_ref?: string | null
          invoice_number?: string | null
          is_idle?: boolean | null
          last_revaluation_date?: string | null
          location?: string | null
          location_id?: string | null
          name?: string
          notes?: string | null
          organization_id?: string | null
          ownership_status?: string | null
          qr_code?: string | null
          revaluation_amount?: number | null
          salvage_value?: number
          serial_number?: string | null
          status?: string
          tax_accumulated_depreciation?: number | null
          tax_book_value?: number | null
          tax_depreciation_method?: string | null
          updated_at?: string
          useful_life_months?: number
          vendor_id?: string | null
          warranty_expiry_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixed_assets_accumulated_depreciation_account_id_fkey"
            columns: ["accumulated_depreciation_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_acquisition_journal_id_fkey"
            columns: ["acquisition_journal_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "fixed_assets_acquisition_journal_id_fkey"
            columns: ["acquisition_journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_asset_account_id_fkey"
            columns: ["asset_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "fixed_asset_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_depreciation_account_id_fkey"
            columns: ["depreciation_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_disposal_journal_entry_id_fkey"
            columns: ["disposal_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "fixed_assets_disposal_journal_entry_id_fkey"
            columns: ["disposal_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      funds: {
        Row: {
          code: string
          created_at: string
          description: string | null
          fund_type: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          restriction_level: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          fund_type?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          restriction_level?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          fund_type?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          restriction_level?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funds_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      import_audit_logs: {
        Row: {
          action: string
          batch_id: string
          details: Json | null
          id: string
          ip_address: string | null
          performed_at: string
          performed_by: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          batch_id: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          performed_at?: string
          performed_by?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          batch_id?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          performed_at?: string
          performed_by?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_audit_logs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batch_rows: {
        Row: {
          account_code: string | null
          account_name: string | null
          batch_id: string
          converted_amount: number | null
          cost_center: string | null
          created_at: string
          credit_amount: number | null
          currency: string | null
          debit_amount: number | null
          department: string | null
          exchange_rate: number | null
          fund: string | null
          id: string
          is_posted: boolean | null
          is_valid: boolean | null
          journal_entry_line_id: string | null
          location: string | null
          match_confidence: number | null
          match_suggestions: Json | null
          match_type: string | null
          matched_account_id: string | null
          net_balance: number | null
          posted_at: string | null
          program: string | null
          project: string | null
          raw_data: Json
          row_number: number
          source_amount: number | null
          updated_at: string
          validation_errors: Json | null
          validation_warnings: Json | null
        }
        Insert: {
          account_code?: string | null
          account_name?: string | null
          batch_id: string
          converted_amount?: number | null
          cost_center?: string | null
          created_at?: string
          credit_amount?: number | null
          currency?: string | null
          debit_amount?: number | null
          department?: string | null
          exchange_rate?: number | null
          fund?: string | null
          id?: string
          is_posted?: boolean | null
          is_valid?: boolean | null
          journal_entry_line_id?: string | null
          location?: string | null
          match_confidence?: number | null
          match_suggestions?: Json | null
          match_type?: string | null
          matched_account_id?: string | null
          net_balance?: number | null
          posted_at?: string | null
          program?: string | null
          project?: string | null
          raw_data: Json
          row_number: number
          source_amount?: number | null
          updated_at?: string
          validation_errors?: Json | null
          validation_warnings?: Json | null
        }
        Update: {
          account_code?: string | null
          account_name?: string | null
          batch_id?: string
          converted_amount?: number | null
          cost_center?: string | null
          created_at?: string
          credit_amount?: number | null
          currency?: string | null
          debit_amount?: number | null
          department?: string | null
          exchange_rate?: number | null
          fund?: string | null
          id?: string
          is_posted?: boolean | null
          is_valid?: boolean | null
          journal_entry_line_id?: string | null
          location?: string | null
          match_confidence?: number | null
          match_suggestions?: Json | null
          match_type?: string | null
          matched_account_id?: string | null
          net_balance?: number | null
          posted_at?: string | null
          program?: string | null
          project?: string | null
          raw_data?: Json
          row_number?: number
          source_amount?: number | null
          updated_at?: string
          validation_errors?: Json | null
          validation_warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "import_batch_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batch_rows_journal_entry_line_id_fkey"
            columns: ["journal_entry_line_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["line_id"]
          },
          {
            foreignKeyName: "import_batch_rows_journal_entry_line_id_fkey"
            columns: ["journal_entry_line_id"]
            isOneToOne: false
            referencedRelation: "journal_entry_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batch_rows_journal_entry_line_id_fkey"
            columns: ["journal_entry_line_id"]
            isOneToOne: false
            referencedRelation: "v_je_lines_with_division"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batch_rows_matched_account_id_fkey"
            columns: ["matched_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          as_of_date: string
          base_currency: string
          column_mappings: Json | null
          country_id: string | null
          created_at: string
          created_by: string | null
          date_format: string | null
          entity_id: string | null
          exchange_rate: number | null
          file_hash: string | null
          file_size_bytes: number | null
          fiscal_year: string
          fx_source: string | null
          id: string
          import_type: string
          invert_signs: boolean | null
          journal_entry_ids: string[] | null
          number_format: string | null
          organization_id: string
          original_filename: string | null
          period_end: string | null
          period_start: string | null
          posted_at: string | null
          posted_by: string | null
          posted_total_credits: number | null
          posted_total_debits: number | null
          posting_mode: string
          reversal_journal_entry_ids: string[] | null
          reversal_reason: string | null
          reversed_at: string | null
          reversed_by: string | null
          source_balance_difference: number | null
          source_currency: string | null
          source_system: string | null
          source_total_credits: number | null
          source_total_debits: number | null
          status: string
          total_rows: number | null
          treat_brackets_as_negative: boolean | null
          updated_at: string
          validation_errors: Json | null
          validation_status: string | null
          validation_warnings: Json | null
        }
        Insert: {
          as_of_date: string
          base_currency?: string
          column_mappings?: Json | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          date_format?: string | null
          entity_id?: string | null
          exchange_rate?: number | null
          file_hash?: string | null
          file_size_bytes?: number | null
          fiscal_year: string
          fx_source?: string | null
          id?: string
          import_type: string
          invert_signs?: boolean | null
          journal_entry_ids?: string[] | null
          number_format?: string | null
          organization_id: string
          original_filename?: string | null
          period_end?: string | null
          period_start?: string | null
          posted_at?: string | null
          posted_by?: string | null
          posted_total_credits?: number | null
          posted_total_debits?: number | null
          posting_mode?: string
          reversal_journal_entry_ids?: string[] | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          source_balance_difference?: number | null
          source_currency?: string | null
          source_system?: string | null
          source_total_credits?: number | null
          source_total_debits?: number | null
          status?: string
          total_rows?: number | null
          treat_brackets_as_negative?: boolean | null
          updated_at?: string
          validation_errors?: Json | null
          validation_status?: string | null
          validation_warnings?: Json | null
        }
        Update: {
          as_of_date?: string
          base_currency?: string
          column_mappings?: Json | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          date_format?: string | null
          entity_id?: string | null
          exchange_rate?: number | null
          file_hash?: string | null
          file_size_bytes?: number | null
          fiscal_year?: string
          fx_source?: string | null
          id?: string
          import_type?: string
          invert_signs?: boolean | null
          journal_entry_ids?: string[] | null
          number_format?: string | null
          organization_id?: string
          original_filename?: string | null
          period_end?: string | null
          period_start?: string | null
          posted_at?: string | null
          posted_by?: string | null
          posted_total_credits?: number | null
          posted_total_debits?: number | null
          posting_mode?: string
          reversal_journal_entry_ids?: string[] | null
          reversal_reason?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          source_balance_difference?: number | null
          source_currency?: string | null
          source_system?: string | null
          source_total_credits?: number | null
          source_total_debits?: number | null
          status?: string
          total_rows?: number | null
          treat_brackets_as_negative?: boolean | null
          updated_at?: string
          validation_errors?: Json | null
          validation_status?: string | null
          validation_warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batches_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "budget_hierarchy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      import_mapping_templates: {
        Row: {
          created_at: string
          created_by: string | null
          date_format: string | null
          default_currency: string | null
          default_entity_id: string | null
          id: string
          import_type: string
          invert_signs: boolean | null
          is_default: boolean | null
          mappings: Json
          name: string
          number_format: string | null
          organization_id: string
          source_system: string | null
          treat_brackets_as_negative: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_format?: string | null
          default_currency?: string | null
          default_entity_id?: string | null
          id?: string
          import_type: string
          invert_signs?: boolean | null
          is_default?: boolean | null
          mappings?: Json
          name: string
          number_format?: string | null
          organization_id: string
          source_system?: string | null
          treat_brackets_as_negative?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_format?: string | null
          default_currency?: string | null
          default_entity_id?: string | null
          id?: string
          import_type?: string
          invert_signs?: boolean | null
          is_default?: boolean | null
          mappings?: Json
          name?: string
          number_format?: string | null
          organization_id?: string
          source_system?: string | null
          treat_brackets_as_negative?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_mapping_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          installation_id: string
          key_hash: string
          key_prefix: string
          label: string | null
          last_used_at: string | null
          organization_id: string
          revoked_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          installation_id: string
          key_hash: string
          key_prefix: string
          label?: string | null
          last_used_at?: string | null
          organization_id: string
          revoked_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          installation_id?: string
          key_hash?: string
          key_prefix?: string
          label?: string | null
          last_used_at?: string | null
          organization_id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_api_keys_installation_id_fkey"
            columns: ["installation_id"]
            isOneToOne: false
            referencedRelation: "org_integration_installations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_event_log: {
        Row: {
          created_at: string
          direction: string
          event_type: string
          http_status: number | null
          id: string
          installation_id: string | null
          organization_id: string
          payload: Json
          response: Json
          status: string
        }
        Insert: {
          created_at?: string
          direction: string
          event_type: string
          http_status?: number | null
          id?: string
          installation_id?: string | null
          organization_id: string
          payload?: Json
          response?: Json
          status?: string
        }
        Update: {
          created_at?: string
          direction?: string
          event_type?: string
          http_status?: number | null
          id?: string
          installation_id?: string | null
          organization_id?: string
          payload?: Json
          response?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_event_log_installation_id_fkey"
            columns: ["installation_id"]
            isOneToOne: false
            referencedRelation: "org_integration_installations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_settings: {
        Row: {
          connection_status: string | null
          created_at: string
          error_message: string | null
          id: string
          integration_name: string
          is_enabled: boolean
          last_tested_at: string | null
          settings: Json | null
          updated_at: string
        }
        Insert: {
          connection_status?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          integration_name: string
          is_enabled?: boolean
          last_tested_at?: string | null
          settings?: Json | null
          updated_at?: string
        }
        Update: {
          connection_status?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          integration_name?: string
          is_enabled?: boolean
          last_tested_at?: string | null
          settings?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      integrity_findings: {
        Row: {
          check_type: string
          detected_at: string
          id: string
          message: string
          organization_id: string
          payload: Json
          resolved_at: string | null
          resolved_by: string | null
          severity: string
        }
        Insert: {
          check_type: string
          detected_at?: string
          id?: string
          message: string
          organization_id: string
          payload?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
        }
        Update: {
          check_type?: string
          detected_at?: string
          id?: string
          message?: string
          organization_id?: string
          payload?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrity_findings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      intercompany_accounts: {
        Row: {
          account_type: string
          created_at: string
          from_account_id: string | null
          from_organization_id: string
          group_id: string
          id: string
          is_active: boolean
          to_account_id: string | null
          to_organization_id: string
        }
        Insert: {
          account_type: string
          created_at?: string
          from_account_id?: string | null
          from_organization_id: string
          group_id: string
          id?: string
          is_active?: boolean
          to_account_id?: string | null
          to_organization_id: string
        }
        Update: {
          account_type?: string
          created_at?: string
          from_account_id?: string | null
          from_organization_id?: string
          group_id?: string
          id?: string
          is_active?: boolean
          to_account_id?: string | null
          to_organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intercompany_accounts_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intercompany_accounts_from_organization_id_fkey"
            columns: ["from_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intercompany_accounts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "consolidation_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intercompany_accounts_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intercompany_accounts_to_organization_id_fkey"
            columns: ["to_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      intl_filing_submissions: {
        Row: {
          ack: Json
          created_at: string
          created_by: string | null
          filing_type: string
          id: string
          jurisdiction: string
          organization_id: string
          payload: Json
          period_key: string
          provider_reference: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          ack?: Json
          created_at?: string
          created_by?: string | null
          filing_type: string
          id?: string
          jurisdiction: string
          organization_id: string
          payload?: Json
          period_key: string
          provider_reference?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          ack?: Json
          created_at?: string
          created_by?: string | null
          filing_type?: string
          id?: string
          jurisdiction?: string
          organization_id?: string
          payload?: Json
          period_key?: string
          provider_reference?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      intl_payment_rail_submissions: {
        Row: {
          ack: Json
          batch_reference: string | null
          created_at: string
          created_by: string | null
          entry_count: number
          file_hash: string | null
          id: string
          organization_id: string
          rail_id: string | null
          status: string
          submission_type: string
          total_amount: number
        }
        Insert: {
          ack?: Json
          batch_reference?: string | null
          created_at?: string
          created_by?: string | null
          entry_count?: number
          file_hash?: string | null
          id?: string
          organization_id: string
          rail_id?: string | null
          status?: string
          submission_type: string
          total_amount?: number
        }
        Update: {
          ack?: Json
          batch_reference?: string | null
          created_at?: string
          created_by?: string | null
          entry_count?: number
          file_hash?: string | null
          id?: string
          organization_id?: string
          rail_id?: string | null
          status?: string
          submission_type?: string
          total_amount?: number
        }
        Relationships: []
      }
      inventory_adjustment_lines: {
        Row: {
          adjustment_id: string
          created_at: string
          department_id: string | null
          id: string
          item_id: string
          line_order: number
          quantity_counted: number
          quantity_difference: number
          quantity_on_hand: number
          total_adjustment: number
          unit_cost: number
        }
        Insert: {
          adjustment_id: string
          created_at?: string
          department_id?: string | null
          id?: string
          item_id: string
          line_order?: number
          quantity_counted: number
          quantity_difference: number
          quantity_on_hand: number
          total_adjustment: number
          unit_cost: number
        }
        Update: {
          adjustment_id?: string
          created_at?: string
          department_id?: string | null
          id?: string
          item_id?: string
          line_order?: number
          quantity_counted?: number
          quantity_difference?: number
          quantity_on_hand?: number
          total_adjustment?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustment_lines_adjustment_id_fkey"
            columns: ["adjustment_id"]
            isOneToOne: false
            referencedRelation: "inventory_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustment_lines_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustment_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_adjustments: {
        Row: {
          adjustment_date: string
          adjustment_number: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          id: string
          journal_entry_id: string | null
          notes: string | null
          organization_id: string | null
          reason: string
          status: string
          updated_at: string
        }
        Insert: {
          adjustment_date?: string
          adjustment_number: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          organization_id?: string | null
          reason: string
          status?: string
          updated_at?: string
        }
        Update: {
          adjustment_date?: string
          adjustment_number?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          organization_id?: string | null
          reason?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "inventory_adjustments_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string | null
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id?: string | null
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string | null
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "inventory_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          average_cost: number | null
          bin_location: string | null
          category_id: string | null
          cogs_account_id: string | null
          cost_price: number
          created_at: string
          default_tax_code_id: string | null
          description: string | null
          dimensions_height: number | null
          dimensions_length: number | null
          dimensions_unit: string | null
          dimensions_width: number | null
          id: string
          income_account_id: string | null
          inventory_account_id: string | null
          is_active: boolean
          is_taxable: boolean
          last_purchase_date: string | null
          last_purchase_price: number | null
          last_sale_date: string | null
          last_sale_price: number | null
          lead_time_days: number | null
          manufacturer: string | null
          manufacturer_part_number: string | null
          max_stock_level: number | null
          min_order_quantity: number | null
          name: string
          organization_id: string | null
          quantity_on_hand: number
          reorder_point: number | null
          reorder_quantity: number | null
          safety_stock: number | null
          selling_price: number
          sku: string
          tax_category: string | null
          tax_rate: number | null
          unit_of_measure: string
          updated_at: string
          valuation_method: string | null
          warranty_months: number | null
          weight: number | null
          weight_unit: string | null
        }
        Insert: {
          average_cost?: number | null
          bin_location?: string | null
          category_id?: string | null
          cogs_account_id?: string | null
          cost_price?: number
          created_at?: string
          default_tax_code_id?: string | null
          description?: string | null
          dimensions_height?: number | null
          dimensions_length?: number | null
          dimensions_unit?: string | null
          dimensions_width?: number | null
          id?: string
          income_account_id?: string | null
          inventory_account_id?: string | null
          is_active?: boolean
          is_taxable?: boolean
          last_purchase_date?: string | null
          last_purchase_price?: number | null
          last_sale_date?: string | null
          last_sale_price?: number | null
          lead_time_days?: number | null
          manufacturer?: string | null
          manufacturer_part_number?: string | null
          max_stock_level?: number | null
          min_order_quantity?: number | null
          name: string
          organization_id?: string | null
          quantity_on_hand?: number
          reorder_point?: number | null
          reorder_quantity?: number | null
          safety_stock?: number | null
          selling_price?: number
          sku: string
          tax_category?: string | null
          tax_rate?: number | null
          unit_of_measure?: string
          updated_at?: string
          valuation_method?: string | null
          warranty_months?: number | null
          weight?: number | null
          weight_unit?: string | null
        }
        Update: {
          average_cost?: number | null
          bin_location?: string | null
          category_id?: string | null
          cogs_account_id?: string | null
          cost_price?: number
          created_at?: string
          default_tax_code_id?: string | null
          description?: string | null
          dimensions_height?: number | null
          dimensions_length?: number | null
          dimensions_unit?: string | null
          dimensions_width?: number | null
          id?: string
          income_account_id?: string | null
          inventory_account_id?: string | null
          is_active?: boolean
          is_taxable?: boolean
          last_purchase_date?: string | null
          last_purchase_price?: number | null
          last_sale_date?: string | null
          last_sale_price?: number | null
          lead_time_days?: number | null
          manufacturer?: string | null
          manufacturer_part_number?: string | null
          max_stock_level?: number | null
          min_order_quantity?: number | null
          name?: string
          organization_id?: string | null
          quantity_on_hand?: number
          reorder_point?: number | null
          reorder_quantity?: number | null
          safety_stock?: number | null
          selling_price?: number
          sku?: string
          tax_category?: string | null
          tax_rate?: number | null
          unit_of_measure?: string
          updated_at?: string
          valuation_method?: string | null
          warranty_months?: number | null
          weight?: number | null
          weight_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inventory_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_cogs_account_id_fkey"
            columns: ["cogs_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_default_tax_code_id_fkey"
            columns: ["default_tax_code_id"]
            isOneToOne: false
            referencedRelation: "tax_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_income_account_id_fkey"
            columns: ["income_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_inventory_account_id_fkey"
            columns: ["inventory_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_lots: {
        Row: {
          created_at: string
          expiry_date: string | null
          id: string
          item_id: string
          lot_number: string | null
          quantity_received: number
          quantity_remaining: number
          received_date: string
          reference: string | null
          unit_cost: number
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          item_id: string
          lot_number?: string | null
          quantity_received: number
          quantity_remaining: number
          received_date?: string
          reference?: string | null
          unit_cost: number
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          item_id?: string
          lot_number?: string | null
          quantity_received?: number
          quantity_remaining?: number
          received_date?: string
          reference?: string | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_lots_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          bill_id: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          id: string
          invoice_id: string | null
          item_id: string
          journal_entry_id: string | null
          lot_id: string | null
          notes: string | null
          organization_id: string | null
          quantity: number
          reference: string | null
          total_cost: number
          transaction_date: string
          transaction_type: string
          unit_cost: number
        }
        Insert: {
          bill_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          invoice_id?: string | null
          item_id: string
          journal_entry_id?: string | null
          lot_id?: string | null
          notes?: string | null
          organization_id?: string | null
          quantity: number
          reference?: string | null
          total_cost: number
          transaction_date?: string
          transaction_type: string
          unit_cost: number
        }
        Update: {
          bill_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          id?: string
          invoice_id?: string | null
          item_id?: string
          journal_entry_id?: string | null
          lot_id?: string | null
          notes?: string | null
          organization_id?: string | null
          quantity?: number
          reference?: string | null
          total_cost?: number
          transaction_date?: string
          transaction_type?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "inventory_transactions_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_valuations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          organization_id: string | null
          total_items: number
          total_quantity: number
          total_value: number
          valuation_date: string
          valuation_method: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          total_items?: number
          total_quantity?: number
          total_value?: number
          valuation_date: string
          valuation_method?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          total_items?: number
          total_quantity?: number
          total_value?: number
          valuation_date?: string
          valuation_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_valuations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_custom_field_templates: {
        Row: {
          created_at: string
          default_value: string | null
          document_type: string | null
          field_type: string
          id: string
          is_active: boolean
          is_required: boolean
          label: string
          organization_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_value?: string | null
          document_type?: string | null
          field_type?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          label: string
          organization_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_value?: string | null
          document_type?: string | null
          field_type?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          label?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_custom_field_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          amount: number
          created_at: string
          department_id: string | null
          description: string
          discount_percent: number | null
          id: string
          income_account_id: string | null
          invoice_id: string
          line_order: number
          notes: string | null
          quantity: number
          tax_amount: number | null
          tax_rate: number | null
          unit_price: number
        }
        Insert: {
          amount?: number
          created_at?: string
          department_id?: string | null
          description: string
          discount_percent?: number | null
          id?: string
          income_account_id?: string | null
          invoice_id: string
          line_order?: number
          notes?: string | null
          quantity?: number
          tax_amount?: number | null
          tax_rate?: number | null
          unit_price?: number
        }
        Update: {
          amount?: number
          created_at?: string
          department_id?: string | null
          description?: string
          discount_percent?: number | null
          id?: string
          income_account_id?: string | null
          invoice_id?: string
          line_order?: number
          notes?: string | null
          quantity?: number
          tax_amount?: number | null
          tax_rate?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_income_account_id_fkey"
            columns: ["income_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_taxes: {
        Row: {
          authority: string | null
          created_at: string | null
          gl_account_id: string | null
          id: string
          invoice_id: string
          is_recoverable: boolean | null
          jurisdiction_code: string | null
          rate: number
          tax_amount: number
          tax_code: string | null
          tax_type: string
          taxable_amount: number
        }
        Insert: {
          authority?: string | null
          created_at?: string | null
          gl_account_id?: string | null
          id?: string
          invoice_id: string
          is_recoverable?: boolean | null
          jurisdiction_code?: string | null
          rate: number
          tax_amount: number
          tax_code?: string | null
          tax_type: string
          taxable_amount: number
        }
        Update: {
          authority?: string | null
          created_at?: string | null
          gl_account_id?: string | null
          id?: string
          invoice_id?: string
          is_recoverable?: boolean | null
          jurisdiction_code?: string | null
          rate?: number
          tax_amount?: number
          tax_code?: string | null
          tax_type?: string
          taxable_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_taxes_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_taxes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          adjustment: number | null
          adjustment_label: string | null
          amount_paid: number
          application_fee_amount: number | null
          ar_account_id: string | null
          attention_of: string | null
          balance_due: number
          base_currency_amount: number | null
          base_currency_total: number | null
          buyer_address_line1: string | null
          buyer_address_line2: string | null
          buyer_city: string | null
          buyer_country: string | null
          buyer_email: string | null
          buyer_name: string | null
          buyer_phone: string | null
          buyer_postal_code: string | null
          buyer_province: string | null
          buyer_signature_data: string | null
          buyer_signature_date: string | null
          country_id: string | null
          created_at: string
          currency: string
          custom_fields: Json | null
          customer_id: string
          dealer_permit_number: string | null
          deleted_at: string | null
          deleted_by: string | null
          department_id: string | null
          discount_amount: number | null
          discount_type: string | null
          discount_value: number | null
          document_title: string | null
          due_date: string
          exchange_rate: number | null
          exchange_rate_used: number | null
          exemption_reason: string | null
          gst_hst_amount: number | null
          gst_hst_number: string | null
          id: string
          inventory_item_ids: string[] | null
          invoice_date: string
          invoice_number: string
          is_gst_hst_exempt: boolean | null
          is_pst_exempt: boolean | null
          issued_at: string | null
          journal_entry_id: string | null
          jurisdiction_id: string | null
          notes: string | null
          order_number: string | null
          organization_id: string | null
          paid_at: string | null
          payable_to_connected_account_id: string | null
          payment_terms_id: string | null
          pst_amount: number | null
          pst_number: string | null
          seller_email: string | null
          seller_phone: string | null
          seller_signature_id: string | null
          sent_at: string | null
          shipping_charges: number | null
          status: string
          subject: string | null
          subtotal: number
          tax_amount: number
          tax_exemption_certificate: string | null
          terms: string | null
          total: number
          updated_at: string
          vehicle_info: Json | null
        }
        Insert: {
          adjustment?: number | null
          adjustment_label?: string | null
          amount_paid?: number
          application_fee_amount?: number | null
          ar_account_id?: string | null
          attention_of?: string | null
          balance_due?: number
          base_currency_amount?: number | null
          base_currency_total?: number | null
          buyer_address_line1?: string | null
          buyer_address_line2?: string | null
          buyer_city?: string | null
          buyer_country?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          buyer_postal_code?: string | null
          buyer_province?: string | null
          buyer_signature_data?: string | null
          buyer_signature_date?: string | null
          country_id?: string | null
          created_at?: string
          currency?: string
          custom_fields?: Json | null
          customer_id: string
          dealer_permit_number?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          department_id?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          document_title?: string | null
          due_date: string
          exchange_rate?: number | null
          exchange_rate_used?: number | null
          exemption_reason?: string | null
          gst_hst_amount?: number | null
          gst_hst_number?: string | null
          id?: string
          inventory_item_ids?: string[] | null
          invoice_date?: string
          invoice_number: string
          is_gst_hst_exempt?: boolean | null
          is_pst_exempt?: boolean | null
          issued_at?: string | null
          journal_entry_id?: string | null
          jurisdiction_id?: string | null
          notes?: string | null
          order_number?: string | null
          organization_id?: string | null
          paid_at?: string | null
          payable_to_connected_account_id?: string | null
          payment_terms_id?: string | null
          pst_amount?: number | null
          pst_number?: string | null
          seller_email?: string | null
          seller_phone?: string | null
          seller_signature_id?: string | null
          sent_at?: string | null
          shipping_charges?: number | null
          status?: string
          subject?: string | null
          subtotal?: number
          tax_amount?: number
          tax_exemption_certificate?: string | null
          terms?: string | null
          total?: number
          updated_at?: string
          vehicle_info?: Json | null
        }
        Update: {
          adjustment?: number | null
          adjustment_label?: string | null
          amount_paid?: number
          application_fee_amount?: number | null
          ar_account_id?: string | null
          attention_of?: string | null
          balance_due?: number
          base_currency_amount?: number | null
          base_currency_total?: number | null
          buyer_address_line1?: string | null
          buyer_address_line2?: string | null
          buyer_city?: string | null
          buyer_country?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          buyer_postal_code?: string | null
          buyer_province?: string | null
          buyer_signature_data?: string | null
          buyer_signature_date?: string | null
          country_id?: string | null
          created_at?: string
          currency?: string
          custom_fields?: Json | null
          customer_id?: string
          dealer_permit_number?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          department_id?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          document_title?: string | null
          due_date?: string
          exchange_rate?: number | null
          exchange_rate_used?: number | null
          exemption_reason?: string | null
          gst_hst_amount?: number | null
          gst_hst_number?: string | null
          id?: string
          inventory_item_ids?: string[] | null
          invoice_date?: string
          invoice_number?: string
          is_gst_hst_exempt?: boolean | null
          is_pst_exempt?: boolean | null
          issued_at?: string | null
          journal_entry_id?: string | null
          jurisdiction_id?: string | null
          notes?: string | null
          order_number?: string | null
          organization_id?: string | null
          paid_at?: string | null
          payable_to_connected_account_id?: string | null
          payment_terms_id?: string | null
          pst_amount?: number | null
          pst_number?: string | null
          seller_email?: string | null
          seller_phone?: string | null
          seller_signature_id?: string | null
          sent_at?: string | null
          shipping_charges?: number | null
          status?: string
          subject?: string | null
          subtotal?: number
          tax_amount?: number
          tax_exemption_certificate?: string | null
          terms?: string | null
          total?: number
          updated_at?: string
          vehicle_info?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_ar_account_id_fkey"
            columns: ["ar_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "invoices_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "combined_tax_rates"
            referencedColumns: ["jurisdiction_id"]
          },
          {
            foreignKeyName: "invoices_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "jurisdictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payable_to_connected_account_id_fkey"
            columns: ["payable_to_connected_account_id"]
            isOneToOne: false
            referencedRelation: "stripe_connected_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payment_terms_id_fkey"
            columns: ["payment_terms_id"]
            isOneToOne: false
            referencedRelation: "payment_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_seller_signature_id_fkey"
            columns: ["seller_signature_id"]
            isOneToOne: false
            referencedRelation: "user_signatures"
            referencedColumns: ["id"]
          },
        ]
      }
      irs_filings: {
        Row: {
          confirmation_number: string | null
          created_at: string
          filing_type: string
          id: string
          organization_id: string
          payload: Json | null
          pdf_url: string | null
          period: string | null
          status: string
          submitted_at: string | null
          tax_year: number
          updated_at: string
          xml_url: string | null
        }
        Insert: {
          confirmation_number?: string | null
          created_at?: string
          filing_type: string
          id?: string
          organization_id: string
          payload?: Json | null
          pdf_url?: string | null
          period?: string | null
          status?: string
          submitted_at?: string | null
          tax_year: number
          updated_at?: string
          xml_url?: string | null
        }
        Update: {
          confirmation_number?: string | null
          created_at?: string
          filing_type?: string
          id?: string
          organization_id?: string
          payload?: Json | null
          pdf_url?: string | null
          period?: string | null
          status?: string
          submitted_at?: string | null
          tax_year?: number
          updated_at?: string
          xml_url?: string | null
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          base_currency_amount: number | null
          country_id: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          entry_date: string
          exchange_rate_used: number | null
          id: string
          journal_type: Database["public"]["Enums"]["journal_type"]
          jurisdiction_id: string | null
          notes: string | null
          organization_id: string | null
          posted_at: string | null
          posted_by: string | null
          reference: string
          reversal_of: string | null
          reversed_at: string | null
          reversed_by: string | null
          status: Database["public"]["Enums"]["journal_entry_status"]
          updated_at: string
        }
        Insert: {
          base_currency_amount?: number | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          entry_date?: string
          exchange_rate_used?: number | null
          id?: string
          journal_type?: Database["public"]["Enums"]["journal_type"]
          jurisdiction_id?: string | null
          notes?: string | null
          organization_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reference: string
          reversal_of?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["journal_entry_status"]
          updated_at?: string
        }
        Update: {
          base_currency_amount?: number | null
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          entry_date?: string
          exchange_rate_used?: number | null
          id?: string
          journal_type?: Database["public"]["Enums"]["journal_type"]
          jurisdiction_id?: string | null
          notes?: string | null
          organization_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reference?: string
          reversal_of?: string | null
          reversed_at?: string | null
          reversed_by?: string | null
          status?: Database["public"]["Enums"]["journal_entry_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "combined_tax_rates"
            referencedColumns: ["jurisdiction_id"]
          },
          {
            foreignKeyName: "journal_entries_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "jurisdictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "journal_entries_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_attachments: {
        Row: {
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          journal_entry_id: string
          mime_type: string | null
          organization_id: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          journal_entry_id: string
          mime_type?: string | null
          organization_id: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          journal_entry_id?: string
          mime_type?: string | null
          organization_id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          base_currency_credit: number | null
          base_currency_debit: number | null
          cost_center_id: string | null
          created_at: string
          credit: number
          currency: string | null
          customer_id: string | null
          debit: number
          department_id: string | null
          description: string | null
          exchange_rate: number | null
          fund_id: string | null
          id: string
          journal_entry_id: string
          line_order: number
          location_id: string | null
          project_id: string | null
          segment_id: string | null
          source_document_id: string | null
          source_document_type: string | null
          tax_code_id: string | null
          vendor_id: string | null
        }
        Insert: {
          account_id: string
          base_currency_credit?: number | null
          base_currency_debit?: number | null
          cost_center_id?: string | null
          created_at?: string
          credit?: number
          currency?: string | null
          customer_id?: string | null
          debit?: number
          department_id?: string | null
          description?: string | null
          exchange_rate?: number | null
          fund_id?: string | null
          id?: string
          journal_entry_id: string
          line_order?: number
          location_id?: string | null
          project_id?: string | null
          segment_id?: string | null
          source_document_id?: string | null
          source_document_type?: string | null
          tax_code_id?: string | null
          vendor_id?: string | null
        }
        Update: {
          account_id?: string
          base_currency_credit?: number | null
          base_currency_debit?: number | null
          cost_center_id?: string | null
          created_at?: string
          credit?: number
          currency?: string | null
          customer_id?: string | null
          debit?: number
          department_id?: string | null
          description?: string | null
          exchange_rate?: number | null
          fund_id?: string | null
          id?: string
          journal_entry_id?: string
          line_order?: number
          location_id?: string | null
          project_id?: string | null
          segment_id?: string | null
          source_document_id?: string | null
          source_document_type?: string | null
          tax_code_id?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "funds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_tax_code_id_fkey"
            columns: ["tax_code_id"]
            isOneToOne: false
            referencedRelation: "tax_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      jurisdictions: {
        Row: {
          code: string
          country_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          jurisdiction_type: string | null
          name: string
          parent_jurisdiction_id: string | null
          requires_separate_pst_accounting: boolean | null
          tax_model: string | null
          tax_zone_code: string | null
          updated_at: string | null
        }
        Insert: {
          code: string
          country_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          jurisdiction_type?: string | null
          name: string
          parent_jurisdiction_id?: string | null
          requires_separate_pst_accounting?: boolean | null
          tax_model?: string | null
          tax_zone_code?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          country_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          jurisdiction_type?: string | null
          name?: string
          parent_jurisdiction_id?: string | null
          requires_separate_pst_accounting?: boolean | null
          tax_model?: string | null
          tax_zone_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jurisdictions_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jurisdictions_parent_jurisdiction_id_fkey"
            columns: ["parent_jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "combined_tax_rates"
            referencedColumns: ["jurisdiction_id"]
          },
          {
            foreignKeyName: "jurisdictions_parent_jurisdiction_id_fkey"
            columns: ["parent_jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "jurisdictions"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_categories: {
        Row: {
          accumulated_depreciation_account_id: string | null
          created_at: string
          depreciation_expense_account_id: string | null
          description: string | null
          id: string
          interest_expense_account_id: string | null
          is_active: boolean | null
          lease_liability_account_id: string | null
          name: string
          organization_id: string | null
          rou_asset_account_id: string | null
          updated_at: string
        }
        Insert: {
          accumulated_depreciation_account_id?: string | null
          created_at?: string
          depreciation_expense_account_id?: string | null
          description?: string | null
          id?: string
          interest_expense_account_id?: string | null
          is_active?: boolean | null
          lease_liability_account_id?: string | null
          name: string
          organization_id?: string | null
          rou_asset_account_id?: string | null
          updated_at?: string
        }
        Update: {
          accumulated_depreciation_account_id?: string | null
          created_at?: string
          depreciation_expense_account_id?: string | null
          description?: string | null
          id?: string
          interest_expense_account_id?: string | null
          is_active?: boolean | null
          lease_liability_account_id?: string | null
          name?: string
          organization_id?: string | null
          rou_asset_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lease_categories_accumulated_depreciation_account_id_fkey"
            columns: ["accumulated_depreciation_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_categories_depreciation_expense_account_id_fkey"
            columns: ["depreciation_expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_categories_interest_expense_account_id_fkey"
            columns: ["interest_expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_categories_lease_liability_account_id_fkey"
            columns: ["lease_liability_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_categories_rou_asset_account_id_fkey"
            columns: ["rou_asset_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_modifications: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          discount_rate_used: number | null
          id: string
          journal_entry_id: string | null
          lease_id: string
          modification_date: string
          modification_type: string
          new_end_date: string | null
          new_payment_amount: number | null
          new_term_months: number | null
          previous_end_date: string | null
          previous_payment_amount: number | null
          previous_term_months: number | null
          remeasurement_amount: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_rate_used?: number | null
          id?: string
          journal_entry_id?: string | null
          lease_id: string
          modification_date: string
          modification_type: string
          new_end_date?: string | null
          new_payment_amount?: number | null
          new_term_months?: number | null
          previous_end_date?: string | null
          previous_payment_amount?: number | null
          previous_term_months?: number | null
          remeasurement_amount?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_rate_used?: number | null
          id?: string
          journal_entry_id?: string | null
          lease_id?: string
          modification_date?: string
          modification_type?: string
          new_end_date?: string | null
          new_payment_amount?: number | null
          new_term_months?: number | null
          previous_end_date?: string | null
          previous_payment_amount?: number | null
          previous_term_months?: number | null
          remeasurement_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lease_modifications_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "lease_modifications_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_modifications_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_modifications_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "v_lease_liability_current_portion"
            referencedColumns: ["lease_id"]
          },
        ]
      }
      lease_payment_schedule: {
        Row: {
          actual_payment_amount: number | null
          actual_payment_date: string | null
          closing_liability: number
          created_at: string
          depreciation_amount: number
          id: string
          interest_amount: number
          journal_entry_id: string | null
          lease_id: string
          opening_liability: number
          payment_amount: number
          payment_date: string
          payment_number: number
          principal_amount: number
          rou_amortization_plug: number | null
          rou_asset_closing: number
          rou_asset_opening: number
          status: string
          straight_line_expense: number | null
        }
        Insert: {
          actual_payment_amount?: number | null
          actual_payment_date?: string | null
          closing_liability: number
          created_at?: string
          depreciation_amount: number
          id?: string
          interest_amount: number
          journal_entry_id?: string | null
          lease_id: string
          opening_liability: number
          payment_amount: number
          payment_date: string
          payment_number: number
          principal_amount: number
          rou_amortization_plug?: number | null
          rou_asset_closing: number
          rou_asset_opening: number
          status?: string
          straight_line_expense?: number | null
        }
        Update: {
          actual_payment_amount?: number | null
          actual_payment_date?: string | null
          closing_liability?: number
          created_at?: string
          depreciation_amount?: number
          id?: string
          interest_amount?: number
          journal_entry_id?: string | null
          lease_id?: string
          opening_liability?: number
          payment_amount?: number
          payment_date?: string
          payment_number?: number
          principal_amount?: number
          rou_amortization_plug?: number | null
          rou_asset_closing?: number
          rou_asset_opening?: number
          status?: string
          straight_line_expense?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lease_payment_schedule_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "lease_payment_schedule_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_payment_schedule_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lease_payment_schedule_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "v_lease_liability_current_portion"
            referencedColumns: ["lease_id"]
          },
        ]
      }
      leases: {
        Row: {
          accumulated_depreciation: number | null
          accumulated_depreciation_account_id: string | null
          accumulated_interest: number | null
          asset_type: string
          category_id: string | null
          commencement_date: string
          commencement_journal_id: string | null
          created_at: string
          currency: string | null
          depreciation_expense_account_id: string | null
          description: string | null
          discount_rate: number
          end_date: string
          first_payment_date: string
          grace_period_months: number | null
          id: string
          initial_direct_costs: number | null
          interest_expense_account_id: string | null
          lease_incentives_received: number | null
          lease_liability_account_id: string | null
          lease_liability_current: number
          lease_liability_initial: number
          lease_number: string
          lease_type: string
          lessor_contact: string | null
          lessor_name: string
          name: string
          notes: string | null
          organization_id: string | null
          payment_account_id: string | null
          payment_amount: number
          payment_frequency: string
          payment_timing: string
          present_value_payments: number
          purchase_option_price: number | null
          purchase_option_reasonably_certain: boolean | null
          rent_expense_account_id: string | null
          residual_value_guarantee: number | null
          rou_asset_account_id: string | null
          rou_asset_current: number
          rou_asset_initial: number
          status: string
          term_months: number
          updated_at: string
        }
        Insert: {
          accumulated_depreciation?: number | null
          accumulated_depreciation_account_id?: string | null
          accumulated_interest?: number | null
          asset_type?: string
          category_id?: string | null
          commencement_date: string
          commencement_journal_id?: string | null
          created_at?: string
          currency?: string | null
          depreciation_expense_account_id?: string | null
          description?: string | null
          discount_rate: number
          end_date: string
          first_payment_date: string
          grace_period_months?: number | null
          id?: string
          initial_direct_costs?: number | null
          interest_expense_account_id?: string | null
          lease_incentives_received?: number | null
          lease_liability_account_id?: string | null
          lease_liability_current: number
          lease_liability_initial: number
          lease_number: string
          lease_type?: string
          lessor_contact?: string | null
          lessor_name: string
          name: string
          notes?: string | null
          organization_id?: string | null
          payment_account_id?: string | null
          payment_amount: number
          payment_frequency?: string
          payment_timing?: string
          present_value_payments: number
          purchase_option_price?: number | null
          purchase_option_reasonably_certain?: boolean | null
          rent_expense_account_id?: string | null
          residual_value_guarantee?: number | null
          rou_asset_account_id?: string | null
          rou_asset_current: number
          rou_asset_initial: number
          status?: string
          term_months: number
          updated_at?: string
        }
        Update: {
          accumulated_depreciation?: number | null
          accumulated_depreciation_account_id?: string | null
          accumulated_interest?: number | null
          asset_type?: string
          category_id?: string | null
          commencement_date?: string
          commencement_journal_id?: string | null
          created_at?: string
          currency?: string | null
          depreciation_expense_account_id?: string | null
          description?: string | null
          discount_rate?: number
          end_date?: string
          first_payment_date?: string
          grace_period_months?: number | null
          id?: string
          initial_direct_costs?: number | null
          interest_expense_account_id?: string | null
          lease_incentives_received?: number | null
          lease_liability_account_id?: string | null
          lease_liability_current?: number
          lease_liability_initial?: number
          lease_number?: string
          lease_type?: string
          lessor_contact?: string | null
          lessor_name?: string
          name?: string
          notes?: string | null
          organization_id?: string | null
          payment_account_id?: string | null
          payment_amount?: number
          payment_frequency?: string
          payment_timing?: string
          present_value_payments?: number
          purchase_option_price?: number | null
          purchase_option_reasonably_certain?: boolean | null
          rent_expense_account_id?: string | null
          residual_value_guarantee?: number | null
          rou_asset_account_id?: string | null
          rou_asset_current?: number
          rou_asset_initial?: number
          status?: string
          term_months?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leases_accumulated_depreciation_account_id_fkey"
            columns: ["accumulated_depreciation_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "lease_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_commencement_journal_id_fkey"
            columns: ["commencement_journal_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "leases_commencement_journal_id_fkey"
            columns: ["commencement_journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_depreciation_expense_account_id_fkey"
            columns: ["depreciation_expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_interest_expense_account_id_fkey"
            columns: ["interest_expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_lease_liability_account_id_fkey"
            columns: ["lease_liability_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_rent_expense_account_id_fkey"
            columns: ["rent_expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_rou_asset_account_id_fkey"
            columns: ["rou_asset_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          city: string | null
          code: string
          country: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          postal_code: string | null
          province_state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          postal_code?: string | null
          province_state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          postal_code?: string | null
          province_state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_event_queue: {
        Row: {
          attempts: number
          created_at: string
          dispatched_at: string | null
          event_type: string
          id: string
          last_error: string | null
          organization_id: string
          payload: Json
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          dispatched_at?: string | null
          event_type: string
          id?: string
          last_error?: string | null
          organization_id: string
          payload?: Json
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          dispatched_at?: string | null
          event_type?: string
          id?: string
          last_error?: string | null
          organization_id?: string
          payload?: Json
          status?: string
        }
        Relationships: []
      }
      marketplace_integrations: {
        Row: {
          category: string
          config_schema: Json
          created_at: string
          delivery: string
          description: string
          enabled: boolean
          id: string
          name: string
          scopes: string[]
          slug: string
        }
        Insert: {
          category?: string
          config_schema?: Json
          created_at?: string
          delivery?: string
          description?: string
          enabled?: boolean
          id?: string
          name: string
          scopes?: string[]
          slug: string
        }
        Update: {
          category?: string
          config_schema?: Json
          created_at?: string
          delivery?: string
          description?: string
          enabled?: boolean
          id?: string
          name?: string
          scopes?: string[]
          slug?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          channel: Database["public"]["Enums"]["message_channel"]
          conversation_id: string | null
          created_at: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          error_message: string | null
          external_id: string | null
          from_identifier: string
          id: string
          is_read: boolean | null
          media_urls: string[] | null
          organization_id: string | null
          read_at: string | null
          sent_by: string | null
          status: Database["public"]["Enums"]["message_status"] | null
          subject: string | null
          to_identifier: string
          updated_at: string | null
        }
        Insert: {
          body: string
          channel: Database["public"]["Enums"]["message_channel"]
          conversation_id?: string | null
          created_at?: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          error_message?: string | null
          external_id?: string | null
          from_identifier: string
          id?: string
          is_read?: boolean | null
          media_urls?: string[] | null
          organization_id?: string | null
          read_at?: string | null
          sent_by?: string | null
          status?: Database["public"]["Enums"]["message_status"] | null
          subject?: string | null
          to_identifier: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          channel?: Database["public"]["Enums"]["message_channel"]
          conversation_id?: string | null
          created_at?: string | null
          direction?: Database["public"]["Enums"]["message_direction"]
          error_message?: string | null
          external_id?: string | null
          from_identifier?: string
          id?: string
          is_read?: boolean | null
          media_urls?: string[] | null
          organization_id?: string | null
          read_at?: string | null
          sent_by?: string | null
          status?: Database["public"]["Enums"]["message_status"] | null
          subject?: string | null
          to_identifier?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          code: Database["public"]["Enums"]["module_type"]
          created_at: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_core: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          code: Database["public"]["Enums"]["module_type"]
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_core?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: Database["public"]["Enums"]["module_type"]
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_core?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ng_tax_account_mappings: {
        Row: {
          created_at: string
          definition_id: string
          expense_account_id: string | null
          id: string
          organization_id: string
          payable_account_id: string | null
          receivable_account_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          definition_id: string
          expense_account_id?: string | null
          id?: string
          organization_id: string
          payable_account_id?: string | null
          receivable_account_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          definition_id?: string
          expense_account_id?: string | null
          id?: string
          organization_id?: string
          payable_account_id?: string | null
          receivable_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ng_tax_account_mappings_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "ng_tax_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ng_tax_account_mappings_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ng_tax_account_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ng_tax_account_mappings_payable_account_id_fkey"
            columns: ["payable_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ng_tax_account_mappings_receivable_account_id_fkey"
            columns: ["receivable_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ng_tax_definitions: {
        Row: {
          authority_id: string | null
          base_formula: Json | null
          code: string
          created_at: string
          default_credit_account_code: string | null
          default_debit_account_code: string | null
          description: string | null
          filing_frequency: string
          id: string
          is_active: boolean
          jurisdiction_code: string | null
          jurisdiction_level: string
          name: string
          organization_id: string | null
          remittance_due_offset_days: number
          tax_category: string
          updated_at: string
        }
        Insert: {
          authority_id?: string | null
          base_formula?: Json | null
          code: string
          created_at?: string
          default_credit_account_code?: string | null
          default_debit_account_code?: string | null
          description?: string | null
          filing_frequency?: string
          id?: string
          is_active?: boolean
          jurisdiction_code?: string | null
          jurisdiction_level: string
          name: string
          organization_id?: string | null
          remittance_due_offset_days?: number
          tax_category: string
          updated_at?: string
        }
        Update: {
          authority_id?: string | null
          base_formula?: Json | null
          code?: string
          created_at?: string
          default_credit_account_code?: string | null
          default_debit_account_code?: string | null
          description?: string | null
          filing_frequency?: string
          id?: string
          is_active?: boolean
          jurisdiction_code?: string | null
          jurisdiction_level?: string
          name?: string
          organization_id?: string | null
          remittance_due_offset_days?: number
          tax_category?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ng_tax_definitions_authority_id_fkey"
            columns: ["authority_id"]
            isOneToOne: false
            referencedRelation: "tax_authorities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ng_tax_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ng_tax_exemptions: {
        Row: {
          created_at: string
          criteria: Json
          definition_id: string
          effective_from: string
          effective_to: string | null
          id: string
          organization_id: string | null
          reason: string | null
          scope: string
        }
        Insert: {
          created_at?: string
          criteria?: Json
          definition_id: string
          effective_from: string
          effective_to?: string | null
          id?: string
          organization_id?: string | null
          reason?: string | null
          scope: string
        }
        Update: {
          created_at?: string
          criteria?: Json
          definition_id?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          organization_id?: string | null
          reason?: string | null
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "ng_tax_exemptions_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "ng_tax_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ng_tax_exemptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ng_tax_filings: {
        Row: {
          acknowledged_at: string | null
          acknowledgment_reference: string | null
          confirmation_reference: string | null
          created_at: string
          definition_id: string
          filing_period_id: string | null
          form_code: string
          form_data: Json
          id: string
          organization_id: string
          period_end: string
          period_start: string
          rejection_reason: string | null
          status: string
          submission_mode: string | null
          submission_payload: Json | null
          submitted_at: string | null
          submitted_by: string | null
          total_tax: number | null
          total_taxable_base: number | null
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledgment_reference?: string | null
          confirmation_reference?: string | null
          created_at?: string
          definition_id: string
          filing_period_id?: string | null
          form_code: string
          form_data?: Json
          id?: string
          organization_id: string
          period_end: string
          period_start: string
          rejection_reason?: string | null
          status?: string
          submission_mode?: string | null
          submission_payload?: Json | null
          submitted_at?: string | null
          submitted_by?: string | null
          total_tax?: number | null
          total_taxable_base?: number | null
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledgment_reference?: string | null
          confirmation_reference?: string | null
          created_at?: string
          definition_id?: string
          filing_period_id?: string | null
          form_code?: string
          form_data?: Json
          id?: string
          organization_id?: string
          period_end?: string
          period_start?: string
          rejection_reason?: string | null
          status?: string
          submission_mode?: string | null
          submission_payload?: Json | null
          submitted_at?: string | null
          submitted_by?: string | null
          total_tax?: number | null
          total_taxable_base?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ng_tax_filings_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "ng_tax_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ng_tax_filings_filing_period_id_fkey"
            columns: ["filing_period_id"]
            isOneToOne: false
            referencedRelation: "tax_filing_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ng_tax_filings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ng_tax_rate_versions: {
        Row: {
          brackets: Json | null
          calculation_method: string
          created_at: string
          definition_id: string
          effective_from: string
          effective_to: string | null
          formula: Json | null
          id: string
          is_active: boolean
          max_cap: number | null
          min_threshold: number | null
          notes: string | null
          rate: number | null
          source_reference: string | null
          updated_at: string
        }
        Insert: {
          brackets?: Json | null
          calculation_method: string
          created_at?: string
          definition_id: string
          effective_from: string
          effective_to?: string | null
          formula?: Json | null
          id?: string
          is_active?: boolean
          max_cap?: number | null
          min_threshold?: number | null
          notes?: string | null
          rate?: number | null
          source_reference?: string | null
          updated_at?: string
        }
        Update: {
          brackets?: Json | null
          calculation_method?: string
          created_at?: string
          definition_id?: string
          effective_from?: string
          effective_to?: string | null
          formula?: Json | null
          id?: string
          is_active?: boolean
          max_cap?: number | null
          min_threshold?: number | null
          notes?: string | null
          rate?: number | null
          source_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ng_tax_rate_versions_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "ng_tax_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      ng_tax_reliefs: {
        Row: {
          code: string
          created_at: string
          effective_from: string
          effective_to: string | null
          formula: Json
          id: string
          is_active: boolean
          name: string
          organization_id: string | null
          relief_type: string
        }
        Insert: {
          code: string
          created_at?: string
          effective_from: string
          effective_to?: string | null
          formula?: Json
          id?: string
          is_active?: boolean
          name: string
          organization_id?: string | null
          relief_type: string
        }
        Update: {
          code?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          formula?: Json
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string | null
          relief_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ng_tax_reliefs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ng_tax_remittances: {
        Row: {
          amount: number
          bank_account_id: string | null
          confirmation_reference: string | null
          created_at: string
          definition_id: string
          filing_id: string | null
          id: string
          journal_entry_id: string | null
          organization_id: string
          payment_date: string
          receipt_storage_path: string | null
          receipt_uploaded_at: string | null
          reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          confirmation_reference?: string | null
          created_at?: string
          definition_id: string
          filing_id?: string | null
          id?: string
          journal_entry_id?: string | null
          organization_id: string
          payment_date: string
          receipt_storage_path?: string | null
          receipt_uploaded_at?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          confirmation_reference?: string | null
          created_at?: string
          definition_id?: string
          filing_id?: string | null
          id?: string
          journal_entry_id?: string | null
          organization_id?: string
          payment_date?: string
          receipt_storage_path?: string | null
          receipt_uploaded_at?: string | null
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ng_tax_remittances_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ng_tax_remittances_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "ng_tax_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ng_tax_remittances_filing_id_fkey"
            columns: ["filing_id"]
            isOneToOne: false
            referencedRelation: "ng_tax_filings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ng_tax_remittances_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "ng_tax_remittances_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ng_tax_remittances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ng_tax_service_classifications: {
        Row: {
          code: string
          created_at: string
          definition_id: string
          description: string | null
          effective_from: string
          effective_to: string | null
          id: string
          is_active: boolean
          min_threshold: number | null
          name: string
          non_resident_rate: number | null
          organization_id: string | null
          resident_rate: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          definition_id: string
          description?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean
          min_threshold?: number | null
          name: string
          non_resident_rate?: number | null
          organization_id?: string | null
          resident_rate: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          definition_id?: string
          description?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean
          min_threshold?: number | null
          name?: string
          non_resident_rate?: number | null
          organization_id?: string | null
          resident_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ng_tax_service_classifications_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "ng_tax_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ng_tax_service_classifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ng_tax_transaction_ledger: {
        Row: {
          breakdown: Json | null
          computed_at: string
          created_at: string
          created_by: string | null
          currency: string | null
          definition_id: string
          filing_id: string | null
          id: string
          journal_entry_id: string | null
          journal_entry_line_id: string | null
          organization_id: string
          rate_version_id: string | null
          remittance_id: string | null
          service_classification_id: string | null
          source_id: string | null
          source_parent_id: string | null
          source_type: string
          status: string
          tax_amount: number
          tax_rate: number | null
          taxable_base: number
          transaction_date: string
          updated_at: string
        }
        Insert: {
          breakdown?: Json | null
          computed_at?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          definition_id: string
          filing_id?: string | null
          id?: string
          journal_entry_id?: string | null
          journal_entry_line_id?: string | null
          organization_id: string
          rate_version_id?: string | null
          remittance_id?: string | null
          service_classification_id?: string | null
          source_id?: string | null
          source_parent_id?: string | null
          source_type: string
          status?: string
          tax_amount: number
          tax_rate?: number | null
          taxable_base: number
          transaction_date: string
          updated_at?: string
        }
        Update: {
          breakdown?: Json | null
          computed_at?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          definition_id?: string
          filing_id?: string | null
          id?: string
          journal_entry_id?: string | null
          journal_entry_line_id?: string | null
          organization_id?: string
          rate_version_id?: string | null
          remittance_id?: string | null
          service_classification_id?: string | null
          source_id?: string | null
          source_parent_id?: string | null
          source_type?: string
          status?: string
          tax_amount?: number
          tax_rate?: number | null
          taxable_base?: number
          transaction_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ng_tax_transaction_ledger_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "ng_tax_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ng_tax_transaction_ledger_filing_id_fkey"
            columns: ["filing_id"]
            isOneToOne: false
            referencedRelation: "ng_tax_filings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ng_tax_transaction_ledger_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "ng_tax_transaction_ledger_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ng_tax_transaction_ledger_journal_entry_line_id_fkey"
            columns: ["journal_entry_line_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["line_id"]
          },
          {
            foreignKeyName: "ng_tax_transaction_ledger_journal_entry_line_id_fkey"
            columns: ["journal_entry_line_id"]
            isOneToOne: false
            referencedRelation: "journal_entry_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ng_tax_transaction_ledger_journal_entry_line_id_fkey"
            columns: ["journal_entry_line_id"]
            isOneToOne: false
            referencedRelation: "v_je_lines_with_division"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ng_tax_transaction_ledger_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ng_tax_transaction_ledger_rate_version_id_fkey"
            columns: ["rate_version_id"]
            isOneToOne: false
            referencedRelation: "ng_tax_rate_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ng_tax_transaction_ledger_remittance_id_fkey"
            columns: ["remittance_id"]
            isOneToOne: false
            referencedRelation: "ng_tax_remittances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ng_tax_transaction_ledger_service_classification_id_fkey"
            columns: ["service_classification_id"]
            isOneToOne: false
            referencedRelation: "ng_tax_service_classifications"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_tasks: {
        Row: {
          assigned_to: string | null
          completed_date: string | null
          created_at: string
          description: string | null
          due_date: string | null
          employee_id: string
          id: string
          notes: string | null
          sort_order: number | null
          status: Database["public"]["Enums"]["onboarding_status"]
          task_category: string
          task_name: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_date?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["onboarding_status"]
          task_category: string
          task_name: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_date?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["onboarding_status"]
          task_category?: string
          task_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_tasks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      org_integration_installations: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          id: string
          integration_id: string
          last_run_at: string | null
          organization_id: string
          status: string
          updated_at: string
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          integration_id: string
          last_run_at?: string | null
          organization_id: string
          status?: string
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          integration_id?: string
          last_run_at?: string | null
          organization_id?: string
          status?: string
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_integration_installations_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "marketplace_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role?: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_jurisdictions: {
        Row: {
          accounting_standard: string | null
          ai_setup_confidence: number | null
          country_id: string
          created_at: string | null
          employer_account_number: string | null
          fiscal_year_end_month: number | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          organization_id: string
          payroll_registration_number: string | null
          reporting_currency: string | null
          setup_completed_at: string | null
          tax_registration_number: string | null
          updated_at: string | null
        }
        Insert: {
          accounting_standard?: string | null
          ai_setup_confidence?: number | null
          country_id: string
          created_at?: string | null
          employer_account_number?: string | null
          fiscal_year_end_month?: number | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          organization_id: string
          payroll_registration_number?: string | null
          reporting_currency?: string | null
          setup_completed_at?: string | null
          tax_registration_number?: string | null
          updated_at?: string | null
        }
        Update: {
          accounting_standard?: string | null
          ai_setup_confidence?: number | null
          country_id?: string
          created_at?: string | null
          employer_account_number?: string | null
          fiscal_year_end_month?: number | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          organization_id?: string
          payroll_registration_number?: string | null
          reporting_currency?: string | null
          setup_completed_at?: string | null
          tax_registration_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_jurisdictions_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_jurisdictions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          joined_at: string | null
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          joined_at?: string | null
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          joined_at?: string | null
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_modules: {
        Row: {
          created_at: string | null
          disabled_at: string | null
          disabled_by: string | null
          enabled_at: string | null
          enabled_by: string | null
          id: string
          is_enabled: boolean | null
          module_id: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          disabled_at?: string | null
          disabled_by?: string | null
          enabled_at?: string | null
          enabled_by?: string | null
          id?: string
          is_enabled?: boolean | null
          module_id: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          disabled_at?: string | null
          disabled_by?: string | null
          enabled_at?: string | null
          enabled_by?: string | null
          id?: string
          is_enabled?: boolean | null
          module_id?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_modules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_payroll_settings: {
        Row: {
          created_at: string | null
          deduction_type_id: string
          employer_registration_number: string | null
          id: string
          is_enabled: boolean | null
          next_remittance_due: string | null
          organization_id: string
          remittance_frequency: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deduction_type_id: string
          employer_registration_number?: string | null
          id?: string
          is_enabled?: boolean | null
          next_remittance_due?: string | null
          organization_id: string
          remittance_frequency?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deduction_type_id?: string
          employer_registration_number?: string | null
          id?: string
          is_enabled?: boolean | null
          next_remittance_due?: string | null
          organization_id?: string
          remittance_frequency?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_payroll_settings_deduction_type_id_fkey"
            columns: ["deduction_type_id"]
            isOneToOne: false
            referencedRelation: "payroll_deduction_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_payroll_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_tax_settings: {
        Row: {
          created_at: string | null
          id: string
          is_enabled: boolean | null
          is_registered: boolean | null
          next_filing_due: string | null
          organization_id: string
          registration_number: string | null
          reporting_frequency: string | null
          tax_type_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          is_registered?: boolean | null
          next_filing_due?: string | null
          organization_id: string
          registration_number?: string | null
          reporting_frequency?: string | null
          tax_type_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          is_registered?: boolean | null
          next_filing_due?: string | null
          organization_id?: string
          registration_number?: string | null
          reporting_frequency?: string | null
          tax_type_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_tax_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_tax_settings_tax_type_id_fkey"
            columns: ["tax_type_id"]
            isOneToOne: false
            referencedRelation: "tax_types"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          accounting_method: string | null
          accounting_standard: string | null
          address_line1: string | null
          address_line2: string | null
          ai_setup_completed: boolean | null
          ai_setup_completed_at: string | null
          ai_sheets_enabled: boolean
          ai_sheets_preferences: Json
          allow_invoice_deletion: boolean | null
          approval_threshold_amount: number
          audit_logging_enabled: boolean | null
          base_currency_locked_at: string | null
          business_number: string | null
          city: string | null
          country: string | null
          country_id: string | null
          created_at: string
          cta_account_id: string | null
          currency: string | null
          date_format: string | null
          dealer_permit_number: string | null
          default_accounting_framework: string | null
          default_division_id: string | null
          default_tax_exempt: boolean | null
          divisions_required: boolean
          docsign_allow_bulk_send: boolean | null
          docsign_allow_in_person_signing: boolean | null
          docsign_auto_delete_expired: boolean | null
          docsign_default_expiration_days: number | null
          docsign_default_reminder_days: number[] | null
          docsign_email_footer_html: string | null
          docsign_email_header_html: string | null
          docsign_enabled: boolean | null
          docsign_logo_url: string | null
          docsign_primary_color: string | null
          docsign_require_decline_reason: boolean | null
          docsign_retention_days: number | null
          docsign_secondary_color: string | null
          efinconnect_preferences: Json
          email: string | null
          email_enabled: boolean | null
          email_from_address: string | null
          email_from_name: string | null
          executive_signer_name: string | null
          executive_signer_secondary_title: string | null
          executive_signer_title: string | null
          executive_signer_user_id: string | null
          executive_signer2_name: string | null
          executive_signer2_secondary_title: string | null
          executive_signer2_title: string | null
          executive_signer2_user_id: string | null
          fiscal_year_end_month: number | null
          fx_rate_source: string
          fx_rate_sync_frequency: string
          gst_hst_number: string | null
          id: string
          incorporation_jurisdiction: string | null
          industry: string | null
          invoice_accent_style: string | null
          invoice_ach_account_name: string | null
          invoice_ach_account_number: string | null
          invoice_ach_enabled: boolean | null
          invoice_ach_institution: string | null
          invoice_ach_transit_number: string | null
          invoice_auto_payment_link: boolean
          invoice_cc_instructions: string | null
          invoice_cc_payment_url: string | null
          invoice_credit_card_enabled: boolean | null
          invoice_custom_title: string | null
          invoice_date_format: string | null
          invoice_default_notes: string | null
          invoice_default_terms: number | null
          invoice_deletion_allowed_statuses: string[] | null
          invoice_enable_online_payments: boolean | null
          invoice_etransfer_email: string | null
          invoice_font_family: string | null
          invoice_footer: string | null
          invoice_header_alignment: string | null
          invoice_interac_enabled: boolean | null
          invoice_logo_url: string | null
          invoice_next_number: number | null
          invoice_payment_instructions: string | null
          invoice_payment_methods: Json | null
          invoice_prefix: string | null
          invoice_primary_color: string | null
          invoice_secondary_color: string | null
          invoice_show_line_numbers: boolean | null
          invoice_show_logo: boolean | null
          invoice_show_payment_instructions: boolean | null
          invoice_show_quantity_column: boolean | null
          invoice_show_rate_column: boolean | null
          invoice_show_tax_column: boolean | null
          invoice_stripe_account_id: string | null
          invoice_template_style: string | null
          invoice_template_type: string | null
          language: string | null
          legal_name: string | null
          locale: string | null
          localization_synced_at: string | null
          lock_closed_periods: boolean | null
          logo_url: string | null
          multi_currency_enabled: boolean
          name: string
          number_format: string | null
          owner_id: string | null
          payroll_account_number: string | null
          payroll_logo_url: string | null
          payroll_show_logo: boolean | null
          phone: string | null
          postal_code: string | null
          posting_frozen: boolean
          posting_frozen_reason: string | null
          preferred_comm_channel: string | null
          primary_country_id: string | null
          primary_jurisdiction_id: string | null
          principal_activities: string | null
          province: string | null
          pst_number: string | null
          realized_fx_account_id: string | null
          receipt_logo_url: string | null
          receipt_show_logo: boolean | null
          reporting_currency: string | null
          require_adjustment_approval: boolean | null
          session_timeout_minutes: number | null
          show_combined_tax_display: boolean | null
          slug: string | null
          sms_enabled: boolean | null
          statement_logo_url: string | null
          statement_show_logo: boolean | null
          stripe_customer_id: string | null
          tax_exemption_certificate: string | null
          time_format: string | null
          timezone: string | null
          treasury_approval_policy: Json
          two_factor_required: boolean | null
          unrealized_fx_account_id: string | null
          updated_at: string
          voice_enabled: boolean | null
          website: string | null
          whatsapp_enabled: boolean | null
        }
        Insert: {
          accounting_method?: string | null
          accounting_standard?: string | null
          address_line1?: string | null
          address_line2?: string | null
          ai_setup_completed?: boolean | null
          ai_setup_completed_at?: string | null
          ai_sheets_enabled?: boolean
          ai_sheets_preferences?: Json
          allow_invoice_deletion?: boolean | null
          approval_threshold_amount?: number
          audit_logging_enabled?: boolean | null
          base_currency_locked_at?: string | null
          business_number?: string | null
          city?: string | null
          country?: string | null
          country_id?: string | null
          created_at?: string
          cta_account_id?: string | null
          currency?: string | null
          date_format?: string | null
          dealer_permit_number?: string | null
          default_accounting_framework?: string | null
          default_division_id?: string | null
          default_tax_exempt?: boolean | null
          divisions_required?: boolean
          docsign_allow_bulk_send?: boolean | null
          docsign_allow_in_person_signing?: boolean | null
          docsign_auto_delete_expired?: boolean | null
          docsign_default_expiration_days?: number | null
          docsign_default_reminder_days?: number[] | null
          docsign_email_footer_html?: string | null
          docsign_email_header_html?: string | null
          docsign_enabled?: boolean | null
          docsign_logo_url?: string | null
          docsign_primary_color?: string | null
          docsign_require_decline_reason?: boolean | null
          docsign_retention_days?: number | null
          docsign_secondary_color?: string | null
          efinconnect_preferences?: Json
          email?: string | null
          email_enabled?: boolean | null
          email_from_address?: string | null
          email_from_name?: string | null
          executive_signer_name?: string | null
          executive_signer_secondary_title?: string | null
          executive_signer_title?: string | null
          executive_signer_user_id?: string | null
          executive_signer2_name?: string | null
          executive_signer2_secondary_title?: string | null
          executive_signer2_title?: string | null
          executive_signer2_user_id?: string | null
          fiscal_year_end_month?: number | null
          fx_rate_source?: string
          fx_rate_sync_frequency?: string
          gst_hst_number?: string | null
          id?: string
          incorporation_jurisdiction?: string | null
          industry?: string | null
          invoice_accent_style?: string | null
          invoice_ach_account_name?: string | null
          invoice_ach_account_number?: string | null
          invoice_ach_enabled?: boolean | null
          invoice_ach_institution?: string | null
          invoice_ach_transit_number?: string | null
          invoice_auto_payment_link?: boolean
          invoice_cc_instructions?: string | null
          invoice_cc_payment_url?: string | null
          invoice_credit_card_enabled?: boolean | null
          invoice_custom_title?: string | null
          invoice_date_format?: string | null
          invoice_default_notes?: string | null
          invoice_default_terms?: number | null
          invoice_deletion_allowed_statuses?: string[] | null
          invoice_enable_online_payments?: boolean | null
          invoice_etransfer_email?: string | null
          invoice_font_family?: string | null
          invoice_footer?: string | null
          invoice_header_alignment?: string | null
          invoice_interac_enabled?: boolean | null
          invoice_logo_url?: string | null
          invoice_next_number?: number | null
          invoice_payment_instructions?: string | null
          invoice_payment_methods?: Json | null
          invoice_prefix?: string | null
          invoice_primary_color?: string | null
          invoice_secondary_color?: string | null
          invoice_show_line_numbers?: boolean | null
          invoice_show_logo?: boolean | null
          invoice_show_payment_instructions?: boolean | null
          invoice_show_quantity_column?: boolean | null
          invoice_show_rate_column?: boolean | null
          invoice_show_tax_column?: boolean | null
          invoice_stripe_account_id?: string | null
          invoice_template_style?: string | null
          invoice_template_type?: string | null
          language?: string | null
          legal_name?: string | null
          locale?: string | null
          localization_synced_at?: string | null
          lock_closed_periods?: boolean | null
          logo_url?: string | null
          multi_currency_enabled?: boolean
          name: string
          number_format?: string | null
          owner_id?: string | null
          payroll_account_number?: string | null
          payroll_logo_url?: string | null
          payroll_show_logo?: boolean | null
          phone?: string | null
          postal_code?: string | null
          posting_frozen?: boolean
          posting_frozen_reason?: string | null
          preferred_comm_channel?: string | null
          primary_country_id?: string | null
          primary_jurisdiction_id?: string | null
          principal_activities?: string | null
          province?: string | null
          pst_number?: string | null
          realized_fx_account_id?: string | null
          receipt_logo_url?: string | null
          receipt_show_logo?: boolean | null
          reporting_currency?: string | null
          require_adjustment_approval?: boolean | null
          session_timeout_minutes?: number | null
          show_combined_tax_display?: boolean | null
          slug?: string | null
          sms_enabled?: boolean | null
          statement_logo_url?: string | null
          statement_show_logo?: boolean | null
          stripe_customer_id?: string | null
          tax_exemption_certificate?: string | null
          time_format?: string | null
          timezone?: string | null
          treasury_approval_policy?: Json
          two_factor_required?: boolean | null
          unrealized_fx_account_id?: string | null
          updated_at?: string
          voice_enabled?: boolean | null
          website?: string | null
          whatsapp_enabled?: boolean | null
        }
        Update: {
          accounting_method?: string | null
          accounting_standard?: string | null
          address_line1?: string | null
          address_line2?: string | null
          ai_setup_completed?: boolean | null
          ai_setup_completed_at?: string | null
          ai_sheets_enabled?: boolean
          ai_sheets_preferences?: Json
          allow_invoice_deletion?: boolean | null
          approval_threshold_amount?: number
          audit_logging_enabled?: boolean | null
          base_currency_locked_at?: string | null
          business_number?: string | null
          city?: string | null
          country?: string | null
          country_id?: string | null
          created_at?: string
          cta_account_id?: string | null
          currency?: string | null
          date_format?: string | null
          dealer_permit_number?: string | null
          default_accounting_framework?: string | null
          default_division_id?: string | null
          default_tax_exempt?: boolean | null
          divisions_required?: boolean
          docsign_allow_bulk_send?: boolean | null
          docsign_allow_in_person_signing?: boolean | null
          docsign_auto_delete_expired?: boolean | null
          docsign_default_expiration_days?: number | null
          docsign_default_reminder_days?: number[] | null
          docsign_email_footer_html?: string | null
          docsign_email_header_html?: string | null
          docsign_enabled?: boolean | null
          docsign_logo_url?: string | null
          docsign_primary_color?: string | null
          docsign_require_decline_reason?: boolean | null
          docsign_retention_days?: number | null
          docsign_secondary_color?: string | null
          efinconnect_preferences?: Json
          email?: string | null
          email_enabled?: boolean | null
          email_from_address?: string | null
          email_from_name?: string | null
          executive_signer_name?: string | null
          executive_signer_secondary_title?: string | null
          executive_signer_title?: string | null
          executive_signer_user_id?: string | null
          executive_signer2_name?: string | null
          executive_signer2_secondary_title?: string | null
          executive_signer2_title?: string | null
          executive_signer2_user_id?: string | null
          fiscal_year_end_month?: number | null
          fx_rate_source?: string
          fx_rate_sync_frequency?: string
          gst_hst_number?: string | null
          id?: string
          incorporation_jurisdiction?: string | null
          industry?: string | null
          invoice_accent_style?: string | null
          invoice_ach_account_name?: string | null
          invoice_ach_account_number?: string | null
          invoice_ach_enabled?: boolean | null
          invoice_ach_institution?: string | null
          invoice_ach_transit_number?: string | null
          invoice_auto_payment_link?: boolean
          invoice_cc_instructions?: string | null
          invoice_cc_payment_url?: string | null
          invoice_credit_card_enabled?: boolean | null
          invoice_custom_title?: string | null
          invoice_date_format?: string | null
          invoice_default_notes?: string | null
          invoice_default_terms?: number | null
          invoice_deletion_allowed_statuses?: string[] | null
          invoice_enable_online_payments?: boolean | null
          invoice_etransfer_email?: string | null
          invoice_font_family?: string | null
          invoice_footer?: string | null
          invoice_header_alignment?: string | null
          invoice_interac_enabled?: boolean | null
          invoice_logo_url?: string | null
          invoice_next_number?: number | null
          invoice_payment_instructions?: string | null
          invoice_payment_methods?: Json | null
          invoice_prefix?: string | null
          invoice_primary_color?: string | null
          invoice_secondary_color?: string | null
          invoice_show_line_numbers?: boolean | null
          invoice_show_logo?: boolean | null
          invoice_show_payment_instructions?: boolean | null
          invoice_show_quantity_column?: boolean | null
          invoice_show_rate_column?: boolean | null
          invoice_show_tax_column?: boolean | null
          invoice_stripe_account_id?: string | null
          invoice_template_style?: string | null
          invoice_template_type?: string | null
          language?: string | null
          legal_name?: string | null
          locale?: string | null
          localization_synced_at?: string | null
          lock_closed_periods?: boolean | null
          logo_url?: string | null
          multi_currency_enabled?: boolean
          name?: string
          number_format?: string | null
          owner_id?: string | null
          payroll_account_number?: string | null
          payroll_logo_url?: string | null
          payroll_show_logo?: boolean | null
          phone?: string | null
          postal_code?: string | null
          posting_frozen?: boolean
          posting_frozen_reason?: string | null
          preferred_comm_channel?: string | null
          primary_country_id?: string | null
          primary_jurisdiction_id?: string | null
          principal_activities?: string | null
          province?: string | null
          pst_number?: string | null
          realized_fx_account_id?: string | null
          receipt_logo_url?: string | null
          receipt_show_logo?: boolean | null
          reporting_currency?: string | null
          require_adjustment_approval?: boolean | null
          session_timeout_minutes?: number | null
          show_combined_tax_display?: boolean | null
          slug?: string | null
          sms_enabled?: boolean | null
          statement_logo_url?: string | null
          statement_show_logo?: boolean | null
          stripe_customer_id?: string | null
          tax_exemption_certificate?: string | null
          time_format?: string | null
          timezone?: string | null
          treasury_approval_policy?: Json
          two_factor_required?: boolean | null
          unrealized_fx_account_id?: string | null
          updated_at?: string
          voice_enabled?: boolean | null
          website?: string | null
          whatsapp_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_cta_account_id_fkey"
            columns: ["cta_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_default_division_id_fkey"
            columns: ["default_division_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_primary_country_id_fkey"
            columns: ["primary_country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_primary_jurisdiction_id_fkey"
            columns: ["primary_jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "combined_tax_rates"
            referencedColumns: ["jurisdiction_id"]
          },
          {
            foreignKeyName: "organizations_primary_jurisdiction_id_fkey"
            columns: ["primary_jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "jurisdictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_realized_fx_account_id_fkey"
            columns: ["realized_fx_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_unrealized_fx_account_id_fkey"
            columns: ["unrealized_fx_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_verifications: {
        Row: {
          attempts: number | null
          created_at: string
          email: string | null
          expires_at: string
          id: string
          max_attempts: number | null
          otp_code: string
          phone_number: string
          purpose: string | null
          reference_id: string | null
          status: string | null
          twilio_message_sid: string | null
          verified_at: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string
          email?: string | null
          expires_at: string
          id?: string
          max_attempts?: number | null
          otp_code: string
          phone_number: string
          purpose?: string | null
          reference_id?: string | null
          status?: string | null
          twilio_message_sid?: string | null
          verified_at?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          max_attempts?: number | null
          otp_code?: string
          phone_number?: string
          purpose?: string | null
          reference_id?: string | null
          status?: string | null
          twilio_message_sid?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      pad_agreements: {
        Row: {
          accepted_at: string
          account_reference: string | null
          agreement_text: string
          bank_account_id: string | null
          cra_pad_number: string | null
          cra_program_account_ids: string[]
          created_at: string
          created_by: string | null
          frequency: string | null
          id: string
          ip_address: string | null
          max_amount_per_debit: number | null
          max_amount_per_period: number | null
          organization_id: string
          payer_email: string | null
          payer_name: string
          payer_title: string | null
          revoked_at: string | null
          revoked_reason: string | null
          scope: string
          signature_data: string | null
          signature_text: string | null
          status: string
          updated_at: string
          verified_bank_account_id: string | null
        }
        Insert: {
          accepted_at?: string
          account_reference?: string | null
          agreement_text: string
          bank_account_id?: string | null
          cra_pad_number?: string | null
          cra_program_account_ids?: string[]
          created_at?: string
          created_by?: string | null
          frequency?: string | null
          id?: string
          ip_address?: string | null
          max_amount_per_debit?: number | null
          max_amount_per_period?: number | null
          organization_id: string
          payer_email?: string | null
          payer_name: string
          payer_title?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          scope?: string
          signature_data?: string | null
          signature_text?: string | null
          status?: string
          updated_at?: string
          verified_bank_account_id?: string | null
        }
        Update: {
          accepted_at?: string
          account_reference?: string | null
          agreement_text?: string
          bank_account_id?: string | null
          cra_pad_number?: string | null
          cra_program_account_ids?: string[]
          created_at?: string
          created_by?: string | null
          frequency?: string | null
          id?: string
          ip_address?: string | null
          max_amount_per_debit?: number | null
          max_amount_per_period?: number | null
          organization_id?: string
          payer_email?: string | null
          payer_name?: string
          payer_title?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          scope?: string
          signature_data?: string | null
          signature_text?: string | null
          status?: string
          updated_at?: string
          verified_bank_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pad_agreements_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pad_agreements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pad_agreements_verified_bank_account_id_fkey"
            columns: ["verified_bank_account_id"]
            isOneToOne: false
            referencedRelation: "verified_bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_runs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          department_id: string | null
          employee_count: number | null
          id: string
          journal_entry_id: string | null
          notes: string | null
          organization_id: string | null
          pay_date: string
          pay_period_end: string
          pay_period_start: string
          status: Database["public"]["Enums"]["pay_run_status"]
          stripe_connected_account_id: string | null
          total_deductions: number | null
          total_employer_contributions: number | null
          total_gross: number | null
          total_net: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          department_id?: string | null
          employee_count?: number | null
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          organization_id?: string | null
          pay_date: string
          pay_period_end: string
          pay_period_start: string
          status?: Database["public"]["Enums"]["pay_run_status"]
          stripe_connected_account_id?: string | null
          total_deductions?: number | null
          total_employer_contributions?: number | null
          total_gross?: number | null
          total_net?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          department_id?: string | null
          employee_count?: number | null
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          organization_id?: string | null
          pay_date?: string
          pay_period_end?: string
          pay_period_start?: string
          status?: Database["public"]["Enums"]["pay_run_status"]
          stripe_connected_account_id?: string | null
          total_deductions?: number | null
          total_employer_contributions?: number | null
          total_gross?: number | null
          total_net?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_runs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_runs_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "pay_runs_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_runs_stripe_connected_account_id_fkey"
            columns: ["stripe_connected_account_id"]
            isOneToOne: false
            referencedRelation: "stripe_connected_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_stubs: {
        Row: {
          bonus: number | null
          commission: number | null
          cpp_contribution: number | null
          cpp_employer: number | null
          created_at: string
          department_id: string | null
          ei_employer: number | null
          ei_premium: number | null
          employee_id: string
          employee_mailing_address_line1: string | null
          employee_mailing_address_line2: string | null
          employee_mailing_city: string | null
          employee_mailing_country: string | null
          employee_mailing_postal_code: string | null
          employee_mailing_region: string | null
          employer_mailing_address_line1: string | null
          employer_mailing_address_line2: string | null
          employer_mailing_city: string | null
          employer_mailing_country: string | null
          employer_mailing_postal_code: string | null
          employer_mailing_region: string | null
          federal_tax: number | null
          gross_pay: number
          id: string
          net_pay: number
          other_deductions: number | null
          other_earnings: number | null
          overtime_earnings: number | null
          overtime_hours: number | null
          pay_run_id: string
          provincial_tax: number | null
          regular_earnings: number | null
          regular_hours: number | null
          sick_hours: number | null
          total_deductions: number
          vacation_hours: number | null
          vacation_pay: number | null
          ytd_cpp: number | null
          ytd_ei: number | null
          ytd_federal_tax: number | null
          ytd_gross: number | null
          ytd_provincial_tax: number | null
        }
        Insert: {
          bonus?: number | null
          commission?: number | null
          cpp_contribution?: number | null
          cpp_employer?: number | null
          created_at?: string
          department_id?: string | null
          ei_employer?: number | null
          ei_premium?: number | null
          employee_id: string
          employee_mailing_address_line1?: string | null
          employee_mailing_address_line2?: string | null
          employee_mailing_city?: string | null
          employee_mailing_country?: string | null
          employee_mailing_postal_code?: string | null
          employee_mailing_region?: string | null
          employer_mailing_address_line1?: string | null
          employer_mailing_address_line2?: string | null
          employer_mailing_city?: string | null
          employer_mailing_country?: string | null
          employer_mailing_postal_code?: string | null
          employer_mailing_region?: string | null
          federal_tax?: number | null
          gross_pay?: number
          id?: string
          net_pay?: number
          other_deductions?: number | null
          other_earnings?: number | null
          overtime_earnings?: number | null
          overtime_hours?: number | null
          pay_run_id: string
          provincial_tax?: number | null
          regular_earnings?: number | null
          regular_hours?: number | null
          sick_hours?: number | null
          total_deductions?: number
          vacation_hours?: number | null
          vacation_pay?: number | null
          ytd_cpp?: number | null
          ytd_ei?: number | null
          ytd_federal_tax?: number | null
          ytd_gross?: number | null
          ytd_provincial_tax?: number | null
        }
        Update: {
          bonus?: number | null
          commission?: number | null
          cpp_contribution?: number | null
          cpp_employer?: number | null
          created_at?: string
          department_id?: string | null
          ei_employer?: number | null
          ei_premium?: number | null
          employee_id?: string
          employee_mailing_address_line1?: string | null
          employee_mailing_address_line2?: string | null
          employee_mailing_city?: string | null
          employee_mailing_country?: string | null
          employee_mailing_postal_code?: string | null
          employee_mailing_region?: string | null
          employer_mailing_address_line1?: string | null
          employer_mailing_address_line2?: string | null
          employer_mailing_city?: string | null
          employer_mailing_country?: string | null
          employer_mailing_postal_code?: string | null
          employer_mailing_region?: string | null
          federal_tax?: number | null
          gross_pay?: number
          id?: string
          net_pay?: number
          other_deductions?: number | null
          other_earnings?: number | null
          overtime_earnings?: number | null
          overtime_hours?: number | null
          pay_run_id?: string
          provincial_tax?: number | null
          regular_earnings?: number | null
          regular_hours?: number | null
          sick_hours?: number | null
          total_deductions?: number
          vacation_hours?: number | null
          vacation_pay?: number | null
          ytd_cpp?: number | null
          ytd_ei?: number | null
          ytd_federal_tax?: number | null
          ytd_gross?: number | null
          ytd_provincial_tax?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pay_stubs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_stubs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_stubs_pay_run_id_fkey"
            columns: ["pay_run_id"]
            isOneToOne: false
            referencedRelation: "pay_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_approval_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["payment_approval_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["payment_approval_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["payment_approval_role"]
          user_id?: string
        }
        Relationships: []
      }
      payment_approvals: {
        Row: {
          assigned_to: string | null
          comment: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision: string
          entity_id: string
          entity_type: string
          id: string
          organization_id: string
          required_role: string | null
          step: string
        }
        Insert: {
          assigned_to?: string | null
          comment?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          entity_id: string
          entity_type: string
          id?: string
          organization_id: string
          required_role?: string | null
          step: string
        }
        Update: {
          assigned_to?: string | null
          comment?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          entity_id?: string
          entity_type?: string
          id?: string
          organization_id?: string
          required_role?: string | null
          step?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_link_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json | null
          payment_link_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
          payment_link_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
          payment_link_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_link_events_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_links: {
        Row: {
          amount: number
          connected_account_id: string | null
          create_invoice_on_payment: boolean
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          deposit_bank_account_id: string | null
          description: string | null
          expires_at: string | null
          hosted_url: string | null
          id: string
          instant_method: string | null
          instant_payment: boolean
          invoice_id: string | null
          metadata: Json | null
          organization_id: string
          paid_at: string | null
          payer_email: string | null
          payer_name: string | null
          payment_method: string
          paysafe_payment_handle_id: string | null
          reference: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          connected_account_id?: string | null
          create_invoice_on_payment?: boolean
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          deposit_bank_account_id?: string | null
          description?: string | null
          expires_at?: string | null
          hosted_url?: string | null
          id?: string
          instant_method?: string | null
          instant_payment?: boolean
          invoice_id?: string | null
          metadata?: Json | null
          organization_id: string
          paid_at?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payment_method?: string
          paysafe_payment_handle_id?: string | null
          reference: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          connected_account_id?: string | null
          create_invoice_on_payment?: boolean
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          deposit_bank_account_id?: string | null
          description?: string | null
          expires_at?: string | null
          hosted_url?: string | null
          id?: string
          instant_method?: string | null
          instant_payment?: boolean
          invoice_id?: string | null
          metadata?: Json | null
          organization_id?: string
          paid_at?: string | null
          payer_email?: string | null
          payer_name?: string | null
          payment_method?: string
          paysafe_payment_handle_id?: string | null
          reference?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_connected_account_id_fkey"
            columns: ["connected_account_id"]
            isOneToOne: false
            referencedRelation: "stripe_connected_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_deposit_bank_account_id_fkey"
            columns: ["deposit_bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_terms: {
        Row: {
          created_at: string
          days_until_due: number
          early_payment_days: number | null
          early_payment_discount_percent: number | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          days_until_due: number
          early_payment_days?: number | null
          early_payment_discount_percent?: number | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          days_until_due?: number
          early_payment_days?: number | null
          early_payment_discount_percent?: number | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_terms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_account_mappings: {
        Row: {
          created_at: string | null
          deduction_type_id: string
          expense_account_id: string | null
          id: string
          is_active: boolean | null
          liability_account_id: string | null
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deduction_type_id: string
          expense_account_id?: string | null
          id?: string
          is_active?: boolean | null
          liability_account_id?: string | null
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deduction_type_id?: string
          expense_account_id?: string | null
          id?: string
          is_active?: boolean | null
          liability_account_id?: string | null
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_account_mappings_deduction_type_id_fkey"
            columns: ["deduction_type_id"]
            isOneToOne: false
            referencedRelation: "payroll_deduction_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_account_mappings_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_account_mappings_liability_account_id_fkey"
            columns: ["liability_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_account_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_deduction_types: {
        Row: {
          calculation_method: string
          code: string
          country_id: string
          created_at: string | null
          deduction_category: string
          exemption_amount: number | null
          id: string
          is_active: boolean | null
          is_employee_deduction: boolean | null
          is_employer_contribution: boolean | null
          is_tax_deductible: boolean | null
          is_taxable_benefit: boolean | null
          max_annual_amount: number | null
          max_pensionable_earnings: number | null
          name: string
          updated_at: string | null
        }
        Insert: {
          calculation_method: string
          code: string
          country_id: string
          created_at?: string | null
          deduction_category: string
          exemption_amount?: number | null
          id?: string
          is_active?: boolean | null
          is_employee_deduction?: boolean | null
          is_employer_contribution?: boolean | null
          is_tax_deductible?: boolean | null
          is_taxable_benefit?: boolean | null
          max_annual_amount?: number | null
          max_pensionable_earnings?: number | null
          name: string
          updated_at?: string | null
        }
        Update: {
          calculation_method?: string
          code?: string
          country_id?: string
          created_at?: string | null
          deduction_category?: string
          exemption_amount?: number | null
          id?: string
          is_active?: boolean | null
          is_employee_deduction?: boolean | null
          is_employer_contribution?: boolean | null
          is_tax_deductible?: boolean | null
          is_taxable_benefit?: boolean | null
          max_annual_amount?: number | null
          max_pensionable_earnings?: number | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_deduction_types_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_payment_batches: {
        Row: {
          approval_state: string
          approved_at: string | null
          approved_by: string | null
          batch_number: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          funding_bank_account_id: string | null
          id: string
          journal_entry_id: string | null
          metadata: Json | null
          notes: string | null
          organization_id: string
          originator_id: string | null
          pay_date: string
          pay_run_id: string
          provider: string
          provider_batch_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          total_net: number
          updated_at: string
        }
        Insert: {
          approval_state?: string
          approved_at?: string | null
          approved_by?: string | null
          batch_number: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          funding_bank_account_id?: string | null
          id?: string
          journal_entry_id?: string | null
          metadata?: Json | null
          notes?: string | null
          organization_id: string
          originator_id?: string | null
          pay_date?: string
          pay_run_id: string
          provider?: string
          provider_batch_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          total_net?: number
          updated_at?: string
        }
        Update: {
          approval_state?: string
          approved_at?: string | null
          approved_by?: string | null
          batch_number?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          funding_bank_account_id?: string | null
          id?: string
          journal_entry_id?: string | null
          metadata?: Json | null
          notes?: string | null
          organization_id?: string
          originator_id?: string | null
          pay_date?: string
          pay_run_id?: string
          provider?: string
          provider_batch_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          total_net?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_payment_batches_funding_bank_account_id_fkey"
            columns: ["funding_bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_payment_batches_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "payroll_payment_batches_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_payment_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_payment_batches_pay_run_id_fkey"
            columns: ["pay_run_id"]
            isOneToOne: false
            referencedRelation: "pay_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_payment_items: {
        Row: {
          amount: number
          batch_id: string
          created_at: string
          currency: string
          department_id: string | null
          destination_account_masked: string | null
          destination_institution: string | null
          destination_transit: string | null
          employee_id: string | null
          failure_reason: string | null
          id: string
          journal_entry_id: string | null
          metadata: Json | null
          pay_stub_id: string | null
          provider_transfer_id: string | null
          rail: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          batch_id: string
          created_at?: string
          currency?: string
          department_id?: string | null
          destination_account_masked?: string | null
          destination_institution?: string | null
          destination_transit?: string | null
          employee_id?: string | null
          failure_reason?: string | null
          id?: string
          journal_entry_id?: string | null
          metadata?: Json | null
          pay_stub_id?: string | null
          provider_transfer_id?: string | null
          rail?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          batch_id?: string
          created_at?: string
          currency?: string
          department_id?: string | null
          destination_account_masked?: string | null
          destination_institution?: string | null
          destination_transit?: string | null
          employee_id?: string | null
          failure_reason?: string | null
          id?: string
          journal_entry_id?: string | null
          metadata?: Json | null
          pay_stub_id?: string | null
          provider_transfer_id?: string | null
          rail?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_payment_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "payroll_payment_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_payment_items_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_payment_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_payment_items_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "payroll_payment_items_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_payment_items_pay_stub_id_fkey"
            columns: ["pay_stub_id"]
            isOneToOne: false
            referencedRelation: "pay_stubs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_rate_brackets: {
        Row: {
          bracket_max: number | null
          bracket_min: number
          created_at: string | null
          deduction_type_id: string
          effective_from: string
          effective_to: string | null
          employer_rate: number | null
          id: string
          is_active: boolean | null
          jurisdiction_id: string | null
          rate: number
          updated_at: string | null
        }
        Insert: {
          bracket_max?: number | null
          bracket_min?: number
          created_at?: string | null
          deduction_type_id: string
          effective_from?: string
          effective_to?: string | null
          employer_rate?: number | null
          id?: string
          is_active?: boolean | null
          jurisdiction_id?: string | null
          rate: number
          updated_at?: string | null
        }
        Update: {
          bracket_max?: number | null
          bracket_min?: number
          created_at?: string | null
          deduction_type_id?: string
          effective_from?: string
          effective_to?: string | null
          employer_rate?: number | null
          id?: string
          is_active?: boolean | null
          jurisdiction_id?: string | null
          rate?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_rate_brackets_deduction_type_id_fkey"
            columns: ["deduction_type_id"]
            isOneToOne: false
            referencedRelation: "payroll_deduction_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_rate_brackets_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "combined_tax_rates"
            referencedColumns: ["jurisdiction_id"]
          },
          {
            foreignKeyName: "payroll_rate_brackets_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "jurisdictions"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          permission_code: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          permission_code: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          permission_code?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          category: string
          created_at: string
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      pm_ai_insights: {
        Row: {
          created_at: string | null
          description: string | null
          dismissed_at: string | null
          dismissed_by: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          insight_type: string
          is_dismissed: boolean | null
          organization_id: string
          recommended_action: string | null
          severity: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          dismissed_at?: string | null
          dismissed_by?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          insight_type: string
          is_dismissed?: boolean | null
          organization_id: string
          recommended_action?: string | null
          severity?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          dismissed_at?: string | null
          dismissed_by?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          insight_type?: string
          is_dismissed?: boolean | null
          organization_id?: string
          recommended_action?: string | null
          severity?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_ai_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_client_organizations: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          linked_org_id: string | null
          relationship_type: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          linked_org_id?: string | null
          relationship_type?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          linked_org_id?: string | null
          relationship_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pm_client_organizations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "pm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_client_organizations_linked_org_id_fkey"
            columns: ["linked_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_clients: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          aml_verified_at: string | null
          city: string | null
          client_type: string | null
          country: string
          created_at: string | null
          created_by: string | null
          id: string
          industry: string | null
          kyc_verified_at: string | null
          legal_name: string
          notes: string | null
          onboarded_at: string | null
          organization_id: string
          postal_code: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          province: string | null
          risk_rating: Database["public"]["Enums"]["client_risk_rating"] | null
          status: Database["public"]["Enums"]["client_status"] | null
          tax_id: string | null
          trading_name: string | null
          updated_at: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          aml_verified_at?: string | null
          city?: string | null
          client_type?: string | null
          country?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          industry?: string | null
          kyc_verified_at?: string | null
          legal_name: string
          notes?: string | null
          onboarded_at?: string | null
          organization_id: string
          postal_code?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          province?: string | null
          risk_rating?: Database["public"]["Enums"]["client_risk_rating"] | null
          status?: Database["public"]["Enums"]["client_status"] | null
          tax_id?: string | null
          trading_name?: string | null
          updated_at?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          aml_verified_at?: string | null
          city?: string | null
          client_type?: string | null
          country?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          industry?: string | null
          kyc_verified_at?: string | null
          legal_name?: string
          notes?: string | null
          onboarded_at?: string | null
          organization_id?: string
          postal_code?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          province?: string | null
          risk_rating?: Database["public"]["Enums"]["client_risk_rating"] | null
          status?: Database["public"]["Enums"]["client_status"] | null
          tax_id?: string | null
          trading_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pm_clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_compliance_deadlines: {
        Row: {
          client_id: string
          confirmation_number: string | null
          country: string
          created_at: string | null
          due_date: string
          engagement_id: string | null
          extended_due_date: string | null
          filed_at: string | null
          filing_type: string
          fiscal_year: number | null
          id: string
          jurisdiction: string | null
          notes: string | null
          organization_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          client_id: string
          confirmation_number?: string | null
          country?: string
          created_at?: string | null
          due_date: string
          engagement_id?: string | null
          extended_due_date?: string | null
          filed_at?: string | null
          filing_type: string
          fiscal_year?: number | null
          id?: string
          jurisdiction?: string | null
          notes?: string | null
          organization_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          confirmation_number?: string | null
          country?: string
          created_at?: string | null
          due_date?: string
          engagement_id?: string | null
          extended_due_date?: string | null
          filed_at?: string | null
          filing_type?: string
          fiscal_year?: number | null
          id?: string
          jurisdiction?: string | null
          notes?: string | null
          organization_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pm_compliance_deadlines_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "pm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_compliance_deadlines_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "pm_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_compliance_deadlines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_engagement_staff: {
        Row: {
          actual_hours: number | null
          billing_rate: number | null
          budgeted_hours: number | null
          created_at: string
          created_by: string | null
          end_date: string | null
          engagement_id: string
          id: string
          is_active: boolean | null
          notes: string | null
          organization_id: string
          profile_id: string | null
          role: Database["public"]["Enums"]["pm_staff_role"]
          staff_email: string | null
          staff_name: string
          start_date: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          actual_hours?: number | null
          billing_rate?: number | null
          budgeted_hours?: number | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          engagement_id: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          organization_id: string
          profile_id?: string | null
          role?: Database["public"]["Enums"]["pm_staff_role"]
          staff_email?: string | null
          staff_name: string
          start_date?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          actual_hours?: number | null
          billing_rate?: number | null
          budgeted_hours?: number | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          engagement_id?: string
          id?: string
          is_active?: boolean | null
          notes?: string | null
          organization_id?: string
          profile_id?: string | null
          role?: Database["public"]["Enums"]["pm_staff_role"]
          staff_email?: string | null
          staff_name?: string
          start_date?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pm_engagement_staff_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "pm_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_engagement_staff_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_engagement_staff_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_engagement_staff_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_engagements: {
        Row: {
          billing_type: Database["public"]["Enums"]["billing_type"] | null
          budget_hours: number | null
          client_id: string
          country: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string | null
          engagement_letter_signed_at: string | null
          engagement_letter_url: string | null
          engagement_number: string
          fiscal_year: number | null
          fixed_fee: number | null
          hourly_rate: number | null
          id: string
          manager_id: string | null
          name: string
          notes: string | null
          organization_id: string
          partner_id: string | null
          retainer_amount: number | null
          service_id: string | null
          service_type: string
          start_date: string
          status: Database["public"]["Enums"]["engagement_status"] | null
          updated_at: string | null
        }
        Insert: {
          billing_type?: Database["public"]["Enums"]["billing_type"] | null
          budget_hours?: number | null
          client_id: string
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          engagement_letter_signed_at?: string | null
          engagement_letter_url?: string | null
          engagement_number: string
          fiscal_year?: number | null
          fixed_fee?: number | null
          hourly_rate?: number | null
          id?: string
          manager_id?: string | null
          name: string
          notes?: string | null
          organization_id: string
          partner_id?: string | null
          retainer_amount?: number | null
          service_id?: string | null
          service_type: string
          start_date: string
          status?: Database["public"]["Enums"]["engagement_status"] | null
          updated_at?: string | null
        }
        Update: {
          billing_type?: Database["public"]["Enums"]["billing_type"] | null
          budget_hours?: number | null
          client_id?: string
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          engagement_letter_signed_at?: string | null
          engagement_letter_url?: string | null
          engagement_number?: string
          fiscal_year?: number | null
          fixed_fee?: number | null
          hourly_rate?: number | null
          id?: string
          manager_id?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          partner_id?: string | null
          retainer_amount?: number | null
          service_id?: string | null
          service_type?: string
          start_date?: string
          status?: Database["public"]["Enums"]["engagement_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pm_engagements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "pm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_engagements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_engagements_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "pm_services"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_invoice_lines: {
        Row: {
          amount: number
          created_at: string | null
          description: string
          id: string
          invoice_id: string
          line_order: number | null
          quantity: number | null
          rate: number
          time_entry_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          description: string
          id?: string
          invoice_id: string
          line_order?: number | null
          quantity?: number | null
          rate: number
          time_entry_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string
          id?: string
          invoice_id?: string
          line_order?: number | null
          quantity?: number | null
          rate?: number
          time_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pm_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "pm_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_invoice_lines_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "pm_time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_invoices: {
        Row: {
          amount_paid: number | null
          balance_due: number
          client_id: string
          created_at: string | null
          created_by: string | null
          currency: string | null
          due_date: string
          engagement_id: string | null
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          organization_id: string
          paid_at: string | null
          period_end: string | null
          period_start: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["pm_invoice_status"] | null
          subtotal: number
          tax_amount: number | null
          total: number
          updated_at: string | null
        }
        Insert: {
          amount_paid?: number | null
          balance_due?: number
          client_id: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          due_date: string
          engagement_id?: string | null
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["pm_invoice_status"] | null
          subtotal?: number
          tax_amount?: number | null
          total?: number
          updated_at?: string | null
        }
        Update: {
          amount_paid?: number | null
          balance_due?: number
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          due_date?: string
          engagement_id?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          period_end?: string | null
          period_start?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["pm_invoice_status"] | null
          subtotal?: number
          tax_amount?: number | null
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pm_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "pm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_invoices_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "pm_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_services: {
        Row: {
          category: string | null
          country: string | null
          created_at: string | null
          default_billing_type:
            | Database["public"]["Enums"]["billing_type"]
            | null
          default_rate: number | null
          description: string | null
          estimated_hours: number | null
          id: string
          is_active: boolean | null
          is_recurring: boolean | null
          jurisdiction: string | null
          name: string
          organization_id: string
          recurrence_pattern: string | null
          sla_days: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          country?: string | null
          created_at?: string | null
          default_billing_type?:
            | Database["public"]["Enums"]["billing_type"]
            | null
          default_rate?: number | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          is_active?: boolean | null
          is_recurring?: boolean | null
          jurisdiction?: string | null
          name: string
          organization_id: string
          recurrence_pattern?: string | null
          sla_days?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          country?: string | null
          created_at?: string | null
          default_billing_type?:
            | Database["public"]["Enums"]["billing_type"]
            | null
          default_rate?: number | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          is_active?: boolean | null
          is_recurring?: boolean | null
          jurisdiction?: string | null
          name?: string
          organization_id?: string
          recurrence_pattern?: string | null
          sla_days?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pm_services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_task_templates: {
        Row: {
          country: string | null
          created_at: string | null
          dependency_template_id: string | null
          description: string | null
          estimated_hours: number | null
          id: string
          is_active: boolean | null
          name: string
          order_index: number | null
          organization_id: string
          priority: Database["public"]["Enums"]["task_priority"] | null
          service_id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          dependency_template_id?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          order_index?: number | null
          organization_id: string
          priority?: Database["public"]["Enums"]["task_priority"] | null
          service_id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          dependency_template_id?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          order_index?: number | null
          organization_id?: string
          priority?: Database["public"]["Enums"]["task_priority"] | null
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pm_task_templates_dependency_template_id_fkey"
            columns: ["dependency_template_id"]
            isOneToOne: false
            referencedRelation: "pm_task_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_task_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_task_templates_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "pm_services"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_tasks: {
        Row: {
          actual_hours: number | null
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          dependency_task_id: string | null
          description: string | null
          due_date: string | null
          engagement_id: string
          estimated_hours: number | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          priority: Database["public"]["Enums"]["task_priority"] | null
          status: Database["public"]["Enums"]["task_status"] | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          actual_hours?: number | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          dependency_task_id?: string | null
          description?: string | null
          due_date?: string | null
          engagement_id: string
          estimated_hours?: number | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          priority?: Database["public"]["Enums"]["task_priority"] | null
          status?: Database["public"]["Enums"]["task_status"] | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_hours?: number | null
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          dependency_task_id?: string | null
          description?: string | null
          due_date?: string | null
          engagement_id?: string
          estimated_hours?: number | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          priority?: Database["public"]["Enums"]["task_priority"] | null
          status?: Database["public"]["Enums"]["task_status"] | null
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pm_tasks_dependency_task_id_fkey"
            columns: ["dependency_task_id"]
            isOneToOne: false
            referencedRelation: "pm_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_tasks_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "pm_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "pm_task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_time_entries: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          billed_invoice_id: string | null
          billing_rate: number | null
          created_at: string | null
          description: string | null
          engagement_id: string
          entry_date: string
          hours: number
          id: string
          invoice_id: string | null
          is_billable: boolean | null
          is_billed: boolean | null
          organization_id: string
          status: Database["public"]["Enums"]["time_entry_status"] | null
          task_id: string | null
          timer_started_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          billed_invoice_id?: string | null
          billing_rate?: number | null
          created_at?: string | null
          description?: string | null
          engagement_id: string
          entry_date: string
          hours: number
          id?: string
          invoice_id?: string | null
          is_billable?: boolean | null
          is_billed?: boolean | null
          organization_id: string
          status?: Database["public"]["Enums"]["time_entry_status"] | null
          task_id?: string | null
          timer_started_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          billed_invoice_id?: string | null
          billing_rate?: number | null
          created_at?: string | null
          description?: string | null
          engagement_id?: string
          entry_date?: string
          hours?: number
          id?: string
          invoice_id?: string | null
          is_billable?: boolean | null
          is_billed?: boolean | null
          organization_id?: string
          status?: Database["public"]["Enums"]["time_entry_status"] | null
          task_id?: string | null
          timer_started_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_time_entries_billed_invoice_id_fkey"
            columns: ["billed_invoice_id"]
            isOneToOne: false
            referencedRelation: "pm_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_time_entries_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "pm_engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_time_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_plans: {
        Row: {
          country_id: string | null
          created_at: string
          currency: string
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          max_employees: number | null
          max_users: number | null
          name: string
          price_monthly: number
          price_yearly: number
          sort_order: number | null
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          stripe_product_id: string | null
          tier: string | null
          updated_at: string
        }
        Insert: {
          country_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_employees?: number | null
          max_users?: number | null
          name: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number | null
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          tier?: string | null
          updated_at?: string
        }
        Update: {
          country_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_employees?: number | null
          max_users?: number | null
          name?: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number | null
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          tier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_plans_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      print_audit_log: {
        Row: {
          action_type: Database["public"]["Enums"]["print_action_type"]
          archive_document_id: string | null
          country_id: string | null
          currency: string | null
          document_reference: string | null
          document_title: string | null
          document_type: Database["public"]["Enums"]["print_document_type"]
          id: string
          ip_address: unknown
          language: string | null
          metadata: Json | null
          organization_id: string
          orientation: string | null
          output_type: string | null
          page_count: number | null
          paper_size: Database["public"]["Enums"]["paper_size"] | null
          performed_at: string
          performed_by: string | null
          source_record_id: string | null
          source_record_type: string | null
          template_id: string | null
          template_version: number | null
          user_agent: string | null
        }
        Insert: {
          action_type: Database["public"]["Enums"]["print_action_type"]
          archive_document_id?: string | null
          country_id?: string | null
          currency?: string | null
          document_reference?: string | null
          document_title?: string | null
          document_type: Database["public"]["Enums"]["print_document_type"]
          id?: string
          ip_address?: unknown
          language?: string | null
          metadata?: Json | null
          organization_id: string
          orientation?: string | null
          output_type?: string | null
          page_count?: number | null
          paper_size?: Database["public"]["Enums"]["paper_size"] | null
          performed_at?: string
          performed_by?: string | null
          source_record_id?: string | null
          source_record_type?: string | null
          template_id?: string | null
          template_version?: number | null
          user_agent?: string | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["print_action_type"]
          archive_document_id?: string | null
          country_id?: string | null
          currency?: string | null
          document_reference?: string | null
          document_title?: string | null
          document_type?: Database["public"]["Enums"]["print_document_type"]
          id?: string
          ip_address?: unknown
          language?: string | null
          metadata?: Json | null
          organization_id?: string
          orientation?: string | null
          output_type?: string | null
          page_count?: number | null
          paper_size?: Database["public"]["Enums"]["paper_size"] | null
          performed_at?: string
          performed_by?: string | null
          source_record_id?: string | null
          source_record_type?: string | null
          template_id?: string | null
          template_version?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_audit_log_archive_document_id_fkey"
            columns: ["archive_document_id"]
            isOneToOne: false
            referencedRelation: "print_document_archive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_audit_log_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_audit_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "print_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      print_brand_profiles: {
        Row: {
          authorized_signature_url: string | null
          confidential_watermark_text: string | null
          created_at: string
          draft_watermark_text: string | null
          font_family: string | null
          footer_style: Json | null
          footer_text: string | null
          header_style: Json | null
          id: string
          logo_position: string | null
          logo_url: string | null
          logo_width: number | null
          organization_id: string
          page_number_format: string | null
          primary_color: string | null
          secondary_color: string | null
          show_address: boolean | null
          show_contact: boolean | null
          show_page_numbers: boolean | null
          show_website: boolean | null
          signature_name: string | null
          signature_title: string | null
          updated_at: string
          watermark_opacity: number | null
        }
        Insert: {
          authorized_signature_url?: string | null
          confidential_watermark_text?: string | null
          created_at?: string
          draft_watermark_text?: string | null
          font_family?: string | null
          footer_style?: Json | null
          footer_text?: string | null
          header_style?: Json | null
          id?: string
          logo_position?: string | null
          logo_url?: string | null
          logo_width?: number | null
          organization_id: string
          page_number_format?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          show_address?: boolean | null
          show_contact?: boolean | null
          show_page_numbers?: boolean | null
          show_website?: boolean | null
          signature_name?: string | null
          signature_title?: string | null
          updated_at?: string
          watermark_opacity?: number | null
        }
        Update: {
          authorized_signature_url?: string | null
          confidential_watermark_text?: string | null
          created_at?: string
          draft_watermark_text?: string | null
          font_family?: string | null
          footer_style?: Json | null
          footer_text?: string | null
          header_style?: Json | null
          id?: string
          logo_position?: string | null
          logo_url?: string | null
          logo_width?: number | null
          organization_id?: string
          page_number_format?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          show_address?: boolean | null
          show_contact?: boolean | null
          show_page_numbers?: boolean | null
          show_website?: boolean | null
          signature_name?: string | null
          signature_title?: string | null
          updated_at?: string
          watermark_opacity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "print_brand_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      print_document_archive: {
        Row: {
          checksum: string | null
          country_id: string | null
          currency: string | null
          document_reference: string | null
          document_title: string
          document_type: Database["public"]["Enums"]["print_document_type"]
          expires_at: string | null
          file_size_bytes: number | null
          fiscal_year: number | null
          generated_at: string
          generated_by: string | null
          id: string
          is_confidential: boolean | null
          is_draft: boolean | null
          is_final: boolean | null
          language: string | null
          metadata: Json | null
          organization_id: string
          reporting_period_end: string | null
          reporting_period_start: string | null
          source_record_id: string | null
          source_record_type: string | null
          storage_path: string | null
          tags: string[] | null
          template_id: string | null
          template_version: number | null
        }
        Insert: {
          checksum?: string | null
          country_id?: string | null
          currency?: string | null
          document_reference?: string | null
          document_title: string
          document_type: Database["public"]["Enums"]["print_document_type"]
          expires_at?: string | null
          file_size_bytes?: number | null
          fiscal_year?: number | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          is_confidential?: boolean | null
          is_draft?: boolean | null
          is_final?: boolean | null
          language?: string | null
          metadata?: Json | null
          organization_id: string
          reporting_period_end?: string | null
          reporting_period_start?: string | null
          source_record_id?: string | null
          source_record_type?: string | null
          storage_path?: string | null
          tags?: string[] | null
          template_id?: string | null
          template_version?: number | null
        }
        Update: {
          checksum?: string | null
          country_id?: string | null
          currency?: string | null
          document_reference?: string | null
          document_title?: string
          document_type?: Database["public"]["Enums"]["print_document_type"]
          expires_at?: string | null
          file_size_bytes?: number | null
          fiscal_year?: number | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          is_confidential?: boolean | null
          is_draft?: boolean | null
          is_final?: boolean | null
          language?: string | null
          metadata?: Json | null
          organization_id?: string
          reporting_period_end?: string | null
          reporting_period_start?: string | null
          source_record_id?: string | null
          source_record_type?: string | null
          storage_path?: string | null
          tags?: string[] | null
          template_id?: string | null
          template_version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "print_document_archive_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_document_archive_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_document_archive_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "print_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      print_template_versions: {
        Row: {
          change_notes: string | null
          content_snapshot: Json
          created_at: string
          created_by: string | null
          effective_date: string
          id: string
          locked_at: string | null
          locked_by: string | null
          regulatory_version: string | null
          template_id: string
          version: number
        }
        Insert: {
          change_notes?: string | null
          content_snapshot: Json
          created_at?: string
          created_by?: string | null
          effective_date: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          regulatory_version?: string | null
          template_id: string
          version: number
        }
        Update: {
          change_notes?: string | null
          content_snapshot?: Json
          created_at?: string
          created_by?: string | null
          effective_date?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          regulatory_version?: string | null
          template_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "print_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "print_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      print_templates: {
        Row: {
          body_template: Json | null
          code: string
          country_id: string | null
          created_at: string
          created_by: string | null
          date_format: string | null
          default_language: string | null
          description: string | null
          document_type: Database["public"]["Enums"]["print_document_type"]
          effective_date: string | null
          footer_template: Json | null
          header_template: Json | null
          id: string
          legal_disclosures: Json | null
          margins: Json | null
          name: string
          number_format: Json | null
          organization_id: string | null
          orientation: string | null
          paper_size: Database["public"]["Enums"]["paper_size"] | null
          parent_template_id: string | null
          registration_fields: Json | null
          required_footnotes: Json | null
          status: Database["public"]["Enums"]["template_status"] | null
          styles: Json | null
          updated_at: string
          version: number
        }
        Insert: {
          body_template?: Json | null
          code: string
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          date_format?: string | null
          default_language?: string | null
          description?: string | null
          document_type: Database["public"]["Enums"]["print_document_type"]
          effective_date?: string | null
          footer_template?: Json | null
          header_template?: Json | null
          id?: string
          legal_disclosures?: Json | null
          margins?: Json | null
          name: string
          number_format?: Json | null
          organization_id?: string | null
          orientation?: string | null
          paper_size?: Database["public"]["Enums"]["paper_size"] | null
          parent_template_id?: string | null
          registration_fields?: Json | null
          required_footnotes?: Json | null
          status?: Database["public"]["Enums"]["template_status"] | null
          styles?: Json | null
          updated_at?: string
          version?: number
        }
        Update: {
          body_template?: Json | null
          code?: string
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          date_format?: string | null
          default_language?: string | null
          description?: string | null
          document_type?: Database["public"]["Enums"]["print_document_type"]
          effective_date?: string | null
          footer_template?: Json | null
          header_template?: Json | null
          id?: string
          legal_disclosures?: Json | null
          margins?: Json | null
          name?: string
          number_format?: Json | null
          organization_id?: string | null
          orientation?: string | null
          paper_size?: Database["public"]["Enums"]["paper_size"] | null
          parent_template_id?: string | null
          registration_fields?: Json | null
          required_footnotes?: Json | null
          status?: Database["public"]["Enums"]["template_status"] | null
          styles?: Json | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "print_templates_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_templates_parent_template_id_fkey"
            columns: ["parent_template_id"]
            isOneToOne: false
            referencedRelation: "print_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      processor_accounts: {
        Row: {
          api_credential_secret_name: string | null
          auto_approve_threshold: number
          auto_match_enabled: boolean
          auto_match_schedule: string
          auto_sync: boolean
          chargebacks_gl_account_id: string | null
          clearing_gl_account_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          date_window_days: number
          default_writeoff_account_id: string | null
          display_name: string
          dual_approval_threshold: number
          enable_aggregate: boolean
          enable_fuzzy_matching: boolean
          enable_split: boolean
          expected_bank_account_id: string | null
          external_account_id: string | null
          fees_gl_account_id: string | null
          fuzzy_min_similarity: number
          id: string
          is_active: boolean
          last_auto_match_at: string | null
          last_matched_at: string | null
          last_sync_at: string | null
          last_sync_cursor: string | null
          organization_id: string
          processor: Database["public"]["Enums"]["settlement_processor"]
          require_dual_approval: boolean
          revaluation_enabled: boolean
          review_threshold: number
          unrealized_fx_gain_account_id: string | null
          unrealized_fx_loss_account_id: string | null
          updated_at: string
        }
        Insert: {
          api_credential_secret_name?: string | null
          auto_approve_threshold?: number
          auto_match_enabled?: boolean
          auto_match_schedule?: string
          auto_sync?: boolean
          chargebacks_gl_account_id?: string | null
          clearing_gl_account_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          date_window_days?: number
          default_writeoff_account_id?: string | null
          display_name: string
          dual_approval_threshold?: number
          enable_aggregate?: boolean
          enable_fuzzy_matching?: boolean
          enable_split?: boolean
          expected_bank_account_id?: string | null
          external_account_id?: string | null
          fees_gl_account_id?: string | null
          fuzzy_min_similarity?: number
          id?: string
          is_active?: boolean
          last_auto_match_at?: string | null
          last_matched_at?: string | null
          last_sync_at?: string | null
          last_sync_cursor?: string | null
          organization_id: string
          processor: Database["public"]["Enums"]["settlement_processor"]
          require_dual_approval?: boolean
          revaluation_enabled?: boolean
          review_threshold?: number
          unrealized_fx_gain_account_id?: string | null
          unrealized_fx_loss_account_id?: string | null
          updated_at?: string
        }
        Update: {
          api_credential_secret_name?: string | null
          auto_approve_threshold?: number
          auto_match_enabled?: boolean
          auto_match_schedule?: string
          auto_sync?: boolean
          chargebacks_gl_account_id?: string | null
          clearing_gl_account_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          date_window_days?: number
          default_writeoff_account_id?: string | null
          display_name?: string
          dual_approval_threshold?: number
          enable_aggregate?: boolean
          enable_fuzzy_matching?: boolean
          enable_split?: boolean
          expected_bank_account_id?: string | null
          external_account_id?: string | null
          fees_gl_account_id?: string | null
          fuzzy_min_similarity?: number
          id?: string
          is_active?: boolean
          last_auto_match_at?: string | null
          last_matched_at?: string | null
          last_sync_at?: string | null
          last_sync_cursor?: string | null
          organization_id?: string
          processor?: Database["public"]["Enums"]["settlement_processor"]
          require_dual_approval?: boolean
          revaluation_enabled?: boolean
          review_threshold?: number
          unrealized_fx_gain_account_id?: string | null
          unrealized_fx_loss_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processor_accounts_chargebacks_gl_account_id_fkey"
            columns: ["chargebacks_gl_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processor_accounts_clearing_gl_account_id_fkey"
            columns: ["clearing_gl_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processor_accounts_default_writeoff_account_id_fkey"
            columns: ["default_writeoff_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processor_accounts_expected_bank_account_id_fkey"
            columns: ["expected_bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processor_accounts_fees_gl_account_id_fkey"
            columns: ["fees_gl_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processor_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processor_accounts_unrealized_fx_gain_account_id_fkey"
            columns: ["unrealized_fx_gain_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processor_accounts_unrealized_fx_loss_account_id_fkey"
            columns: ["unrealized_fx_loss_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      processor_api_credentials: {
        Row: {
          connected_by: string | null
          created_at: string
          credential_secret_name: string | null
          id: string
          last_error: string | null
          last_sync_at: string | null
          mode: Database["public"]["Enums"]["processor_api_mode"]
          organization_id: string
          processor_account_id: string
          provider: Database["public"]["Enums"]["processor_api_provider"]
          sync_cursor: string | null
          sync_status: Database["public"]["Enums"]["processor_api_sync_status"]
          updated_at: string
          webhook_endpoint_id: string | null
          webhook_secret_name: string | null
        }
        Insert: {
          connected_by?: string | null
          created_at?: string
          credential_secret_name?: string | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          mode?: Database["public"]["Enums"]["processor_api_mode"]
          organization_id: string
          processor_account_id: string
          provider?: Database["public"]["Enums"]["processor_api_provider"]
          sync_cursor?: string | null
          sync_status?: Database["public"]["Enums"]["processor_api_sync_status"]
          updated_at?: string
          webhook_endpoint_id?: string | null
          webhook_secret_name?: string | null
        }
        Update: {
          connected_by?: string | null
          created_at?: string
          credential_secret_name?: string | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          mode?: Database["public"]["Enums"]["processor_api_mode"]
          organization_id?: string
          processor_account_id?: string
          provider?: Database["public"]["Enums"]["processor_api_provider"]
          sync_cursor?: string | null
          sync_status?: Database["public"]["Enums"]["processor_api_sync_status"]
          updated_at?: string
          webhook_endpoint_id?: string | null
          webhook_secret_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processor_api_credentials_processor_account_id_fkey"
            columns: ["processor_account_id"]
            isOneToOne: true
            referencedRelation: "processor_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_price: number
          old_price: number | null
          price_type: string
          product_service_id: string | null
          reason: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_price: number
          old_price?: number | null
          price_type: string
          product_service_id?: string | null
          reason?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_price?: number
          old_price?: number | null
          price_type?: string
          product_service_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_product_service_id_fkey"
            columns: ["product_service_id"]
            isOneToOne: false
            referencedRelation: "products_services"
            referencedColumns: ["id"]
          },
        ]
      }
      production_bom_items: {
        Row: {
          bom_id: string
          created_at: string
          id: string
          inventory_item_id: string | null
          item_code: string | null
          item_name: string
          item_type: string
          lead_time_days: number | null
          notes: string | null
          quantity_per_unit: number
          scrap_percentage: number | null
          standard_cost: number | null
          supplier_id: string | null
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          bom_id: string
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          item_code?: string | null
          item_name: string
          item_type: string
          lead_time_days?: number | null
          notes?: string | null
          quantity_per_unit: number
          scrap_percentage?: number | null
          standard_cost?: number | null
          supplier_id?: string | null
          unit_of_measure: string
          updated_at?: string
        }
        Update: {
          bom_id?: string
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          item_code?: string | null
          item_name?: string
          item_type?: string
          lead_time_days?: number | null
          notes?: string | null
          quantity_per_unit?: number
          scrap_percentage?: number | null
          standard_cost?: number | null
          supplier_id?: string | null
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_bom_items_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "production_boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_bom_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      production_boms: {
        Row: {
          bom_code: string
          bom_name: string
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          organization_id: string | null
          product_service_id: string | null
          standard_batch_size: number | null
          updated_at: string
          version: string | null
          yield_percentage: number | null
        }
        Insert: {
          bom_code: string
          bom_name: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          organization_id?: string | null
          product_service_id?: string | null
          standard_batch_size?: number | null
          updated_at?: string
          version?: string | null
          yield_percentage?: number | null
        }
        Update: {
          bom_code?: string
          bom_name?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          organization_id?: string | null
          product_service_id?: string | null
          standard_batch_size?: number | null
          updated_at?: string
          version?: string | null
          yield_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "production_boms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_boms_product_service_id_fkey"
            columns: ["product_service_id"]
            isOneToOne: false
            referencedRelation: "products_services"
            referencedColumns: ["id"]
          },
        ]
      }
      production_capacity: {
        Row: {
          available_capacity: number
          capacity_type: string
          created_at: string
          facility_name: string
          id: string
          is_active: boolean | null
          organization_id: string | null
          period_end: string
          period_start: string
          production_line: string | null
          shift_pattern: string | null
          updated_at: string
          utilization_percentage: number | null
          utilized_capacity: number | null
          work_center: string | null
        }
        Insert: {
          available_capacity: number
          capacity_type: string
          created_at?: string
          facility_name: string
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          period_end: string
          period_start: string
          production_line?: string | null
          shift_pattern?: string | null
          updated_at?: string
          utilization_percentage?: number | null
          utilized_capacity?: number | null
          work_center?: string | null
        }
        Update: {
          available_capacity?: number
          capacity_type?: string
          created_at?: string
          facility_name?: string
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          period_end?: string
          period_start?: string
          production_line?: string | null
          shift_pattern?: string | null
          updated_at?: string
          utilization_percentage?: number | null
          utilized_capacity?: number | null
          work_center?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_capacity_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      production_routing_steps: {
        Row: {
          created_at: string
          description: string | null
          id: string
          labor_rate: number | null
          machine_hours: number | null
          overhead_rate: number | null
          routing_id: string
          setup_hours: number | null
          skill_level: string | null
          standard_hours: number
          step_name: string
          step_number: number
          updated_at: string
          work_center: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          labor_rate?: number | null
          machine_hours?: number | null
          overhead_rate?: number | null
          routing_id: string
          setup_hours?: number | null
          skill_level?: string | null
          standard_hours: number
          step_name: string
          step_number: number
          updated_at?: string
          work_center?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          labor_rate?: number | null
          machine_hours?: number | null
          overhead_rate?: number | null
          routing_id?: string
          setup_hours?: number | null
          skill_level?: string | null
          standard_hours?: number
          step_name?: string
          step_number?: number
          updated_at?: string
          work_center?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_routing_steps_routing_id_fkey"
            columns: ["routing_id"]
            isOneToOne: false
            referencedRelation: "production_routings"
            referencedColumns: ["id"]
          },
        ]
      }
      production_routings: {
        Row: {
          bom_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          organization_id: string | null
          routing_code: string
          routing_name: string
          updated_at: string
        }
        Insert: {
          bom_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          routing_code: string
          routing_name: string
          updated_at?: string
        }
        Update: {
          bom_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          routing_code?: string
          routing_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_routings_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "production_boms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_routings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      products_services: {
        Row: {
          average_cost: number | null
          billable_rate: number | null
          category: string | null
          commission_percent: number | null
          cost_method: string | null
          cost_price: number | null
          created_at: string
          currency: string | null
          description: string | null
          expense_account_id: string | null
          id: string
          income_account_id: string | null
          internal_rate: number | null
          inventory_item_id: string | null
          is_active: boolean | null
          is_taxable: boolean | null
          labor_cost: number | null
          last_cost: number | null
          margin_percent: number | null
          markup_percent: number | null
          material_cost: number | null
          max_discount_percent: number | null
          min_selling_price: number | null
          name: string
          organization_id: string | null
          overhead_cost: number | null
          pricing_tier: string | null
          selling_price: number
          sku: string | null
          standard_cost: number | null
          tax_rate: number | null
          type: string
          unit_of_measure: string | null
          updated_at: string
        }
        Insert: {
          average_cost?: number | null
          billable_rate?: number | null
          category?: string | null
          commission_percent?: number | null
          cost_method?: string | null
          cost_price?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          expense_account_id?: string | null
          id?: string
          income_account_id?: string | null
          internal_rate?: number | null
          inventory_item_id?: string | null
          is_active?: boolean | null
          is_taxable?: boolean | null
          labor_cost?: number | null
          last_cost?: number | null
          margin_percent?: number | null
          markup_percent?: number | null
          material_cost?: number | null
          max_discount_percent?: number | null
          min_selling_price?: number | null
          name: string
          organization_id?: string | null
          overhead_cost?: number | null
          pricing_tier?: string | null
          selling_price?: number
          sku?: string | null
          standard_cost?: number | null
          tax_rate?: number | null
          type: string
          unit_of_measure?: string | null
          updated_at?: string
        }
        Update: {
          average_cost?: number | null
          billable_rate?: number | null
          category?: string | null
          commission_percent?: number | null
          cost_method?: string | null
          cost_price?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          expense_account_id?: string | null
          id?: string
          income_account_id?: string | null
          internal_rate?: number | null
          inventory_item_id?: string | null
          is_active?: boolean | null
          is_taxable?: boolean | null
          labor_cost?: number | null
          last_cost?: number | null
          margin_percent?: number | null
          markup_percent?: number | null
          material_cost?: number | null
          max_discount_percent?: number | null
          min_selling_price?: number | null
          name?: string
          organization_id?: string | null
          overhead_cost?: number | null
          pricing_tier?: string | null
          selling_price?: number
          sku?: string | null
          standard_cost?: number | null
          tax_rate?: number | null
          type?: string
          unit_of_measure?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_services_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_services_income_account_id_fkey"
            columns: ["income_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_services_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          budget_amount: number | null
          code: string
          created_at: string
          customer_id: string | null
          description: string | null
          end_date: string | null
          id: string
          is_active: boolean
          is_billable: boolean
          name: string
          organization_id: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          budget_amount?: number | null
          code: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          is_billable?: boolean
          name: string
          organization_id: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget_amount?: number | null
          code?: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          is_billable?: boolean
          name?: string
          organization_id?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      provincial_payee_accounts: {
        Row: {
          account_label: string | null
          account_number: string
          authority_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          organization_id: string
          period_type: string
          program_code: string
          updated_at: string
        }
        Insert: {
          account_label?: string | null
          account_number: string
          authority_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          period_type?: string
          program_code: string
          updated_at?: string
        }
        Update: {
          account_label?: string | null
          account_number?: string
          authority_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          period_type?: string
          program_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provincial_payee_accounts_authority_id_fkey"
            columns: ["authority_id"]
            isOneToOne: false
            referencedRelation: "provincial_tax_authorities"
            referencedColumns: ["id"]
          },
        ]
      }
      provincial_tax_authorities: {
        Row: {
          code: string
          created_at: string
          id: string
          jurisdiction: string
          name: string
          programs: Json
          website_url: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          jurisdiction: string
          name: string
          programs?: Json
          website_url?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          jurisdiction?: string
          name?: string
          programs?: Json
          website_url?: string | null
        }
        Relationships: []
      }
      purchase_attachments: {
        Row: {
          created_at: string
          description: string | null
          entity_id: string
          entity_type: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          organization_id: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          entity_id: string
          entity_type: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          organization_id: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          organization_id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      purchase_order_lines: {
        Row: {
          amount: number
          created_at: string
          department_id: string | null
          description: string
          discount_percent: number | null
          id: string
          inventory_item_id: string | null
          line_order: number
          product_service_id: string | null
          purchase_order_id: string
          quantity_ordered: number
          quantity_received: number
          tax_amount: number | null
          tax_rate: number | null
          unit_price: number
        }
        Insert: {
          amount?: number
          created_at?: string
          department_id?: string | null
          description: string
          discount_percent?: number | null
          id?: string
          inventory_item_id?: string | null
          line_order?: number
          product_service_id?: string | null
          purchase_order_id: string
          quantity_ordered?: number
          quantity_received?: number
          tax_amount?: number | null
          tax_rate?: number | null
          unit_price?: number
        }
        Update: {
          amount?: number
          created_at?: string
          department_id?: string | null
          description?: string
          discount_percent?: number | null
          id?: string
          inventory_item_id?: string | null
          line_order?: number
          product_service_id?: string | null
          purchase_order_id?: string
          quantity_ordered?: number
          quantity_received?: number
          tax_amount?: number | null
          tax_rate?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_product_service_id_fkey"
            columns: ["product_service_id"]
            isOneToOne: false
            referencedRelation: "products_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          currency: string
          department_id: string | null
          discount_amount: number | null
          discount_type: string | null
          discount_value: number | null
          expected_date: string | null
          id: string
          internal_notes: string | null
          notes: string | null
          organization_id: string | null
          po_date: string
          po_number: string
          received_at: string | null
          sent_at: string | null
          shipping_address: string | null
          status: string
          subtotal: number
          tax_amount: number
          terms: string | null
          total: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          currency?: string
          department_id?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          expected_date?: string | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          organization_id?: string | null
          po_date?: string
          po_number: string
          received_at?: string | null
          sent_at?: string | null
          shipping_address?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          terms?: string | null
          total?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          currency?: string
          department_id?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          expected_date?: string | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          organization_id?: string | null
          po_date?: string
          po_number?: string
          received_at?: string | null
          sent_at?: string | null
          shipping_address?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          terms?: string | null
          total?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_lines: {
        Row: {
          amount: number
          created_at: string
          department_id: string | null
          description: string
          discount_percent: number | null
          id: string
          line_order: number
          product_service_id: string | null
          quantity: number
          quote_id: string
          tax_amount: number | null
          tax_rate: number | null
          unit_price: number
        }
        Insert: {
          amount?: number
          created_at?: string
          department_id?: string | null
          description: string
          discount_percent?: number | null
          id?: string
          line_order?: number
          product_service_id?: string | null
          quantity?: number
          quote_id: string
          tax_amount?: number | null
          tax_rate?: number | null
          unit_price?: number
        }
        Update: {
          amount?: number
          created_at?: string
          department_id?: string | null
          description?: string
          discount_percent?: number | null
          id?: string
          line_order?: number
          product_service_id?: string | null
          quantity?: number
          quote_id?: string
          tax_amount?: number | null
          tax_rate?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_lines_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_product_service_id_fkey"
            columns: ["product_service_id"]
            isOneToOne: false
            referencedRelation: "products_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          converted_at: string | null
          converted_invoice_id: string | null
          created_at: string
          currency: string
          customer_id: string
          department_id: string | null
          discount_amount: number | null
          discount_type: string | null
          discount_value: number | null
          expiry_date: string
          id: string
          internal_notes: string | null
          notes: string | null
          organization_id: string | null
          quote_date: string
          quote_number: string
          sent_at: string | null
          status: string
          subtotal: number
          tax_amount: number
          terms: string | null
          total: number
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          converted_at?: string | null
          converted_invoice_id?: string | null
          created_at?: string
          currency?: string
          customer_id: string
          department_id?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          expiry_date: string
          id?: string
          internal_notes?: string | null
          notes?: string | null
          organization_id?: string | null
          quote_date?: string
          quote_number: string
          sent_at?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          terms?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          converted_at?: string | null
          converted_invoice_id?: string | null
          created_at?: string
          currency?: string
          customer_id?: string
          department_id?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          expiry_date?: string
          id?: string
          internal_notes?: string | null
          notes?: string | null
          organization_id?: string | null
          quote_date?: string
          quote_number?: string
          sent_at?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          terms?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_converted_invoice_id_fkey"
            columns: ["converted_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_update_logs: {
        Row: {
          ai_confidence: number | null
          ai_source: string | null
          applied_at: string | null
          applied_by: string | null
          changes_applied: Json | null
          changes_detected: Json | null
          country_id: string | null
          created_at: string | null
          effective_date: string
          error_message: string | null
          id: string
          organization_id: string | null
          status: string
          triggered_by: string | null
          update_type: string
          updated_at: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_source?: string | null
          applied_at?: string | null
          applied_by?: string | null
          changes_applied?: Json | null
          changes_detected?: Json | null
          country_id?: string | null
          created_at?: string | null
          effective_date: string
          error_message?: string | null
          id?: string
          organization_id?: string | null
          status?: string
          triggered_by?: string | null
          update_type: string
          updated_at?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_source?: string | null
          applied_at?: string | null
          applied_by?: string | null
          changes_applied?: Json | null
          changes_detected?: Json | null
          country_id?: string | null
          created_at?: string | null
          effective_date?: string
          error_message?: string | null
          id?: string
          organization_id?: string | null
          status?: string
          triggered_by?: string | null
          update_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_update_logs_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_update_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_review_queue: {
        Row: {
          bank_transaction_id: string | null
          candidates: Json
          created_at: string
          id: string
          organization_id: string
          reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          tax_payment_id: string | null
        }
        Insert: {
          bank_transaction_id?: string | null
          candidates?: Json
          created_at?: string
          id?: string
          organization_id: string
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          tax_payment_id?: string | null
        }
        Update: {
          bank_transaction_id?: string | null
          candidates?: Json
          created_at?: string
          id?: string
          organization_id?: string
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          tax_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_review_queue_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_review_queue_tax_payment_id_fkey"
            columns: ["tax_payment_id"]
            isOneToOne: false
            referencedRelation: "tax_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_bill_lines: {
        Row: {
          amount: number
          created_at: string
          department_id: string | null
          description: string
          expense_account_id: string | null
          id: string
          line_order: number
          quantity: number
          recurring_bill_id: string
          tax_amount: number | null
          tax_rate: number | null
          unit_price: number
        }
        Insert: {
          amount?: number
          created_at?: string
          department_id?: string | null
          description: string
          expense_account_id?: string | null
          id?: string
          line_order?: number
          quantity?: number
          recurring_bill_id: string
          tax_amount?: number | null
          tax_rate?: number | null
          unit_price?: number
        }
        Update: {
          amount?: number
          created_at?: string
          department_id?: string | null
          description?: string
          expense_account_id?: string | null
          id?: string
          line_order?: number
          quantity?: number
          recurring_bill_id?: string
          tax_amount?: number | null
          tax_rate?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_bill_lines_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_bill_lines_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_bill_lines_recurring_bill_id_fkey"
            columns: ["recurring_bill_id"]
            isOneToOne: false
            referencedRelation: "recurring_bills"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_bills: {
        Row: {
          bills_generated: number
          created_at: string
          currency: string
          days_until_due: number
          department_id: string | null
          end_date: string | null
          frequency: string
          id: string
          last_generated_at: string | null
          next_bill_date: string
          notes: string | null
          organization_id: string | null
          start_date: string
          status: string
          subtotal: number
          tax_amount: number
          template_name: string
          terms: string | null
          total: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          bills_generated?: number
          created_at?: string
          currency?: string
          days_until_due?: number
          department_id?: string | null
          end_date?: string | null
          frequency: string
          id?: string
          last_generated_at?: string | null
          next_bill_date: string
          notes?: string | null
          organization_id?: string | null
          start_date: string
          status?: string
          subtotal?: number
          tax_amount?: number
          template_name: string
          terms?: string | null
          total?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          bills_generated?: number
          created_at?: string
          currency?: string
          days_until_due?: number
          department_id?: string | null
          end_date?: string | null
          frequency?: string
          id?: string
          last_generated_at?: string | null
          next_bill_date?: string
          notes?: string | null
          organization_id?: string | null
          start_date?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          template_name?: string
          terms?: string | null
          total?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_bills_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_bills_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_bills_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_invoice_lines: {
        Row: {
          amount: number
          created_at: string
          department_id: string | null
          description: string
          id: string
          line_order: number
          product_service_id: string | null
          quantity: number
          recurring_invoice_id: string
          tax_amount: number | null
          tax_rate: number | null
          unit_price: number
        }
        Insert: {
          amount?: number
          created_at?: string
          department_id?: string | null
          description: string
          id?: string
          line_order?: number
          product_service_id?: string | null
          quantity?: number
          recurring_invoice_id: string
          tax_amount?: number | null
          tax_rate?: number | null
          unit_price?: number
        }
        Update: {
          amount?: number
          created_at?: string
          department_id?: string | null
          description?: string
          id?: string
          line_order?: number
          product_service_id?: string | null
          quantity?: number
          recurring_invoice_id?: string
          tax_amount?: number | null
          tax_rate?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_invoice_lines_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_invoice_lines_product_service_id_fkey"
            columns: ["product_service_id"]
            isOneToOne: false
            referencedRelation: "products_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_invoice_lines_recurring_invoice_id_fkey"
            columns: ["recurring_invoice_id"]
            isOneToOne: false
            referencedRelation: "recurring_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_invoices: {
        Row: {
          auto_send: boolean
          created_at: string
          currency: string
          customer_id: string
          days_until_due: number
          department_id: string | null
          end_date: string | null
          frequency: string
          id: string
          invoices_generated: number
          last_generated_at: string | null
          next_invoice_date: string
          notes: string | null
          organization_id: string | null
          start_date: string
          status: string
          subtotal: number
          tax_amount: number
          template_name: string
          terms: string | null
          total: number
          updated_at: string
        }
        Insert: {
          auto_send?: boolean
          created_at?: string
          currency?: string
          customer_id: string
          days_until_due?: number
          department_id?: string | null
          end_date?: string | null
          frequency: string
          id?: string
          invoices_generated?: number
          last_generated_at?: string | null
          next_invoice_date: string
          notes?: string | null
          organization_id?: string | null
          start_date: string
          status?: string
          subtotal?: number
          tax_amount?: number
          template_name: string
          terms?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          auto_send?: boolean
          created_at?: string
          currency?: string
          customer_id?: string
          days_until_due?: number
          department_id?: string | null
          end_date?: string | null
          frequency?: string
          id?: string
          invoices_generated?: number
          last_generated_at?: string | null
          next_invoice_date?: string
          notes?: string | null
          organization_id?: string | null
          start_date?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          template_name?: string
          terms?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_invoices_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      remittance_fx_rates: {
        Row: {
          base_currency: string
          created_at: string
          id: string
          quote_currency: string
          rate: number
          rate_date: string
          rate_type: string
          source: string
        }
        Insert: {
          base_currency: string
          created_at?: string
          id?: string
          quote_currency: string
          rate: number
          rate_date: string
          rate_type?: string
          source?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          id?: string
          quote_currency?: string
          rate?: number
          rate_date?: string
          rate_type?: string
          source?: string
        }
        Relationships: []
      }
      remittances: {
        Row: {
          confirmation_number: string | null
          created_at: string
          due_date: string
          id: string
          notes: string | null
          organization_id: string | null
          paid_date: string | null
          remittance_period: string
          status: string | null
          total_amount: number
          total_cpp_employee: number | null
          total_cpp_employer: number | null
          total_ei_employee: number | null
          total_ei_employer: number | null
          total_federal_tax: number | null
          total_provincial_tax: number | null
          updated_at: string
        }
        Insert: {
          confirmation_number?: string | null
          created_at?: string
          due_date: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          paid_date?: string | null
          remittance_period: string
          status?: string | null
          total_amount?: number
          total_cpp_employee?: number | null
          total_cpp_employer?: number | null
          total_ei_employee?: number | null
          total_ei_employer?: number | null
          total_federal_tax?: number | null
          total_provincial_tax?: number | null
          updated_at?: string
        }
        Update: {
          confirmation_number?: string | null
          created_at?: string
          due_date?: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          paid_date?: string | null
          remittance_period?: string
          status?: string | null
          total_amount?: number
          total_cpp_employee?: number | null
          total_cpp_employer?: number | null
          total_ei_employee?: number | null
          total_ei_employer?: number | null
          total_federal_tax?: number | null
          total_provincial_tax?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      retained_earnings_rollforward: {
        Row: {
          closing_balance: number
          created_at: string
          created_by: string | null
          dividends: number
          fiscal_year: number
          fiscal_year_close_id: string | null
          fiscal_year_end: string
          fiscal_year_start: string
          id: string
          net_income: number
          opening_balance: number
          organization_id: string
          prior_period_adjustments: number
          retained_earnings_account_id: string
          updated_at: string
        }
        Insert: {
          closing_balance?: number
          created_at?: string
          created_by?: string | null
          dividends?: number
          fiscal_year: number
          fiscal_year_close_id?: string | null
          fiscal_year_end: string
          fiscal_year_start: string
          id?: string
          net_income?: number
          opening_balance?: number
          organization_id: string
          prior_period_adjustments?: number
          retained_earnings_account_id: string
          updated_at?: string
        }
        Update: {
          closing_balance?: number
          created_at?: string
          created_by?: string | null
          dividends?: number
          fiscal_year?: number
          fiscal_year_close_id?: string | null
          fiscal_year_end?: string
          fiscal_year_start?: string
          id?: string
          net_income?: number
          opening_balance?: number
          organization_id?: string
          prior_period_adjustments?: number
          retained_earnings_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retained_earnings_rollforward_fiscal_year_close_id_fkey"
            columns: ["fiscal_year_close_id"]
            isOneToOne: false
            referencedRelation: "fiscal_year_closes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retained_earnings_rollforward_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retained_earnings_rollforward_retained_earnings_account_id_fkey"
            columns: ["retained_earnings_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      retained_earnings_statement: {
        Row: {
          closing_balance: number | null
          country_code: string | null
          created_at: string
          created_by: string | null
          currency_code: string | null
          dividends_declared: number
          fiscal_year: number
          fiscal_year_close_id: string | null
          fiscal_year_end: string
          fiscal_year_start: string
          id: string
          net_income_loss: number
          opening_balance: number
          organization_id: string
          other_additions: number
          other_deductions: number
          updated_at: string
        }
        Insert: {
          closing_balance?: number | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string | null
          dividends_declared?: number
          fiscal_year: number
          fiscal_year_close_id?: string | null
          fiscal_year_end: string
          fiscal_year_start: string
          id?: string
          net_income_loss?: number
          opening_balance?: number
          organization_id: string
          other_additions?: number
          other_deductions?: number
          updated_at?: string
        }
        Update: {
          closing_balance?: number | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string | null
          dividends_declared?: number
          fiscal_year?: number
          fiscal_year_close_id?: string | null
          fiscal_year_end?: string
          fiscal_year_start?: string
          id?: string
          net_income_loss?: number
          opening_balance?: number
          organization_id?: string
          other_additions?: number
          other_deductions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retained_earnings_statement_fiscal_year_close_id_fkey"
            columns: ["fiscal_year_close_id"]
            isOneToOne: false
            referencedRelation: "fiscal_year_closes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retained_earnings_statement_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      roe_records: {
        Row: {
          comments: string | null
          created_at: string
          employee_id: string
          final_pay_period_end: string | null
          first_day_worked: string
          id: string
          insurable_earnings_by_period: Json | null
          last_day_paid: string
          other_monies: Json | null
          pay_period_type: Database["public"]["Enums"]["pay_frequency"]
          reason_code: Database["public"]["Enums"]["roe_reason"]
          recall_code: string | null
          recall_date: string | null
          roe_serial: string | null
          status: string | null
          statutory_holiday_pay: number | null
          submitted_at: string | null
          total_insurable_earnings: number
          total_insurable_hours: number
          updated_at: string
          vacation_pay: number | null
        }
        Insert: {
          comments?: string | null
          created_at?: string
          employee_id: string
          final_pay_period_end?: string | null
          first_day_worked: string
          id?: string
          insurable_earnings_by_period?: Json | null
          last_day_paid: string
          other_monies?: Json | null
          pay_period_type: Database["public"]["Enums"]["pay_frequency"]
          reason_code: Database["public"]["Enums"]["roe_reason"]
          recall_code?: string | null
          recall_date?: string | null
          roe_serial?: string | null
          status?: string | null
          statutory_holiday_pay?: number | null
          submitted_at?: string | null
          total_insurable_earnings: number
          total_insurable_hours: number
          updated_at?: string
          vacation_pay?: number | null
        }
        Update: {
          comments?: string | null
          created_at?: string
          employee_id?: string
          final_pay_period_end?: string | null
          first_day_worked?: string
          id?: string
          insurable_earnings_by_period?: Json | null
          last_day_paid?: string
          other_monies?: Json | null
          pay_period_type?: Database["public"]["Enums"]["pay_frequency"]
          reason_code?: Database["public"]["Enums"]["roe_reason"]
          recall_code?: string | null
          recall_date?: string | null
          roe_serial?: string | null
          status?: string | null
          statutory_holiday_pay?: number | null
          submitted_at?: string | null
          total_insurable_earnings?: number
          total_insurable_hours?: number
          updated_at?: string
          vacation_pay?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "roe_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          org_role: string
          permission_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_role: string
          permission_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_role?: string
          permission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      rpaa_attestations: {
        Row: {
          attestation_pdf_url: string | null
          attested_at: string
          attestor_role: string | null
          attestor_user_id: string
          id: string
          notes: string | null
          organization_id: string
          period_month: number
          period_year: number
          snapshot_hash: string
        }
        Insert: {
          attestation_pdf_url?: string | null
          attested_at?: string
          attestor_role?: string | null
          attestor_user_id: string
          id?: string
          notes?: string | null
          organization_id: string
          period_month: number
          period_year: number
          snapshot_hash: string
        }
        Update: {
          attestation_pdf_url?: string | null
          attested_at?: string
          attestor_role?: string | null
          attestor_user_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          period_month?: number
          period_year?: number
          snapshot_hash?: string
        }
        Relationships: []
      }
      rpaa_incidents: {
        Row: {
          affected_amount: number | null
          affected_users_count: number | null
          boc_notice_due_at: string | null
          boc_notified_at: string | null
          boc_reference: string | null
          created_at: string
          currency: string | null
          description: string
          detected_at: string
          id: string
          incident_type: string
          occurred_at: string
          organization_id: string
          reported_by: string | null
          resolution_notes: string | null
          resolved_at: string | null
          severity: string
          updated_at: string
        }
        Insert: {
          affected_amount?: number | null
          affected_users_count?: number | null
          boc_notice_due_at?: string | null
          boc_notified_at?: string | null
          boc_reference?: string | null
          created_at?: string
          currency?: string | null
          description: string
          detected_at?: string
          id?: string
          incident_type: string
          occurred_at: string
          organization_id: string
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: string
          updated_at?: string
        }
        Update: {
          affected_amount?: number | null
          affected_users_count?: number | null
          boc_notice_due_at?: string | null
          boc_notified_at?: string | null
          boc_reference?: string | null
          created_at?: string
          currency?: string | null
          description?: string
          detected_at?: string
          id?: string
          incident_type?: string
          occurred_at?: string
          organization_id?: string
          reported_by?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: string
          updated_at?: string
        }
        Relationships: []
      }
      rpaa_safeguarding_snapshots: {
        Row: {
          breach: boolean
          breakdown: Json
          created_at: string
          currency: string
          end_user_liability: number
          id: string
          organization_id: string
          safeguarded_balance: number
          snapshot_date: string
          variance: number
        }
        Insert: {
          breach?: boolean
          breakdown?: Json
          created_at?: string
          currency?: string
          end_user_liability: number
          id?: string
          organization_id: string
          safeguarded_balance: number
          snapshot_date: string
          variance: number
        }
        Update: {
          breach?: boolean
          breakdown?: Json
          created_at?: string
          currency?: string
          end_user_liability?: number
          id?: string
          organization_id?: string
          safeguarded_balance?: number
          snapshot_date?: string
          variance?: number
        }
        Relationships: []
      }
      rpaa_settings: {
        Row: {
          compliance_officer_user_id: string | null
          created_at: string
          id: string
          insurance_expires_on: string | null
          insurance_policy_number: string | null
          insurance_provider: string | null
          is_registered: boolean
          notes: string | null
          operating_account_id: string | null
          organization_id: string
          registration_date: string | null
          registration_number: string | null
          safeguarding_account_id: string | null
          safeguarding_method: string | null
          updated_at: string
          variance_tolerance_cad: number
        }
        Insert: {
          compliance_officer_user_id?: string | null
          created_at?: string
          id?: string
          insurance_expires_on?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          is_registered?: boolean
          notes?: string | null
          operating_account_id?: string | null
          organization_id: string
          registration_date?: string | null
          registration_number?: string | null
          safeguarding_account_id?: string | null
          safeguarding_method?: string | null
          updated_at?: string
          variance_tolerance_cad?: number
        }
        Update: {
          compliance_officer_user_id?: string | null
          created_at?: string
          id?: string
          insurance_expires_on?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          is_registered?: boolean
          notes?: string | null
          operating_account_id?: string | null
          organization_id?: string
          registration_date?: string | null
          registration_number?: string | null
          safeguarding_account_id?: string | null
          safeguarding_method?: string | null
          updated_at?: string
          variance_tolerance_cad?: number
        }
        Relationships: []
      }
      sales_tax_jurisdictions: {
        Row: {
          city: string | null
          country: string
          county: string | null
          created_at: string
          economic_nexus_revenue: number
          economic_nexus_transactions: number
          id: string
          last_checked_at: string | null
          nexus_status: string
          organization_id: string
          registered: boolean
          registration_number: string | null
          state_code: string
          updated_at: string
          ytd_revenue: number
          ytd_transactions: number
        }
        Insert: {
          city?: string | null
          country?: string
          county?: string | null
          created_at?: string
          economic_nexus_revenue?: number
          economic_nexus_transactions?: number
          id?: string
          last_checked_at?: string | null
          nexus_status?: string
          organization_id: string
          registered?: boolean
          registration_number?: string | null
          state_code: string
          updated_at?: string
          ytd_revenue?: number
          ytd_transactions?: number
        }
        Update: {
          city?: string | null
          country?: string
          county?: string | null
          created_at?: string
          economic_nexus_revenue?: number
          economic_nexus_transactions?: number
          id?: string
          last_checked_at?: string | null
          nexus_status?: string
          organization_id?: string
          registered?: boolean
          registration_number?: string | null
          state_code?: string
          updated_at?: string
          ytd_revenue?: number
          ytd_transactions?: number
        }
        Relationships: []
      }
      sales_tax_settings: {
        Row: {
          collect_gst: boolean | null
          collect_hst: boolean | null
          collect_pst: boolean | null
          collect_sales_tax: boolean | null
          collect_vat: boolean | null
          created_at: string
          default_tax_code: string | null
          filing_frequency: string
          gst_collected_account_id: string | null
          gst_number: string | null
          gst_paid_account_id: string | null
          gst_rate: number | null
          hst_number: string | null
          hst_rate: number | null
          id: string
          organization_id: string | null
          province: string | null
          pst_collected_account_id: string | null
          pst_number: string | null
          pst_paid_account_id: string | null
          pst_rate: number | null
          qst_number: string | null
          sales_tax_number: string | null
          sales_tax_rate: number | null
          updated_at: string
          vat_number: string | null
          vat_rate: number | null
        }
        Insert: {
          collect_gst?: boolean | null
          collect_hst?: boolean | null
          collect_pst?: boolean | null
          collect_sales_tax?: boolean | null
          collect_vat?: boolean | null
          created_at?: string
          default_tax_code?: string | null
          filing_frequency?: string
          gst_collected_account_id?: string | null
          gst_number?: string | null
          gst_paid_account_id?: string | null
          gst_rate?: number | null
          hst_number?: string | null
          hst_rate?: number | null
          id?: string
          organization_id?: string | null
          province?: string | null
          pst_collected_account_id?: string | null
          pst_number?: string | null
          pst_paid_account_id?: string | null
          pst_rate?: number | null
          qst_number?: string | null
          sales_tax_number?: string | null
          sales_tax_rate?: number | null
          updated_at?: string
          vat_number?: string | null
          vat_rate?: number | null
        }
        Update: {
          collect_gst?: boolean | null
          collect_hst?: boolean | null
          collect_pst?: boolean | null
          collect_sales_tax?: boolean | null
          collect_vat?: boolean | null
          created_at?: string
          default_tax_code?: string | null
          filing_frequency?: string
          gst_collected_account_id?: string | null
          gst_number?: string | null
          gst_paid_account_id?: string | null
          gst_rate?: number | null
          hst_number?: string | null
          hst_rate?: number | null
          id?: string
          organization_id?: string | null
          province?: string | null
          pst_collected_account_id?: string | null
          pst_number?: string | null
          pst_paid_account_id?: string | null
          pst_rate?: number | null
          qst_number?: string | null
          sales_tax_number?: string | null
          sales_tax_rate?: number | null
          updated_at?: string
          vat_number?: string | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_tax_settings_gst_collected_account_id_fkey"
            columns: ["gst_collected_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tax_settings_gst_paid_account_id_fkey"
            columns: ["gst_paid_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tax_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tax_settings_pst_collected_account_id_fkey"
            columns: ["pst_collected_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tax_settings_pst_paid_account_id_fkey"
            columns: ["pst_paid_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_payments: {
        Row: {
          amount: number | null
          auto_submit: boolean
          cra_account_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          end_date: string | null
          frequency: string
          funding_bank_account_id: string | null
          id: string
          is_active: boolean
          last_run_at: string | null
          last_status: string | null
          metadata: Json
          next_run_date: string
          organization_id: string
          payment_kind: string
          requires_approval: boolean
          source_ref: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          auto_submit?: boolean
          cra_account_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          end_date?: string | null
          frequency?: string
          funding_bank_account_id?: string | null
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_status?: string | null
          metadata?: Json
          next_run_date: string
          organization_id: string
          payment_kind: string
          requires_approval?: boolean
          source_ref?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          auto_submit?: boolean
          cra_account_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          end_date?: string | null
          frequency?: string
          funding_bank_account_id?: string | null
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          last_status?: string | null
          metadata?: Json
          next_run_date?: string
          organization_id?: string
          payment_kind?: string
          requires_approval?: boolean
          source_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_payments_cra_account_id_fkey"
            columns: ["cra_account_id"]
            isOneToOne: false
            referencedRelation: "cra_program_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_rate_updates: {
        Row: {
          country_id: string
          created_at: string | null
          effective_date: string
          id: string
          is_verified: boolean | null
          new_value: Json | null
          old_value: Json | null
          rate_type_id: string | null
          source_description: string | null
          source_url: string | null
          update_type: string
          updated_at: string | null
        }
        Insert: {
          country_id: string
          created_at?: string | null
          effective_date: string
          id?: string
          is_verified?: boolean | null
          new_value?: Json | null
          old_value?: Json | null
          rate_type_id?: string | null
          source_description?: string | null
          source_url?: string | null
          update_type: string
          updated_at?: string | null
        }
        Update: {
          country_id?: string
          created_at?: string | null
          effective_date?: string
          id?: string
          is_verified?: boolean | null
          new_value?: Json | null
          old_value?: Json | null
          rate_type_id?: string | null
          source_description?: string | null
          source_url?: string | null
          update_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_rate_updates_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      segments: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          segment_type: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          segment_type: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          segment_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "segments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_approval_steps: {
        Row: {
          approver_user_id: string
          created_at: string
          decided_at: string
          decision: string
          id: string
          match_group_id: string | null
          match_id: string | null
          notes: string | null
          organization_id: string
          step_number: number
        }
        Insert: {
          approver_user_id: string
          created_at?: string
          decided_at?: string
          decision: string
          id?: string
          match_group_id?: string | null
          match_id?: string | null
          notes?: string | null
          organization_id: string
          step_number: number
        }
        Update: {
          approver_user_id?: string
          created_at?: string
          decided_at?: string
          decision?: string
          id?: string
          match_group_id?: string | null
          match_id?: string | null
          notes?: string | null
          organization_id?: string
          step_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "settlement_approval_steps_match_group_id_fkey"
            columns: ["match_group_id"]
            isOneToOne: false
            referencedRelation: "settlement_match_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_approval_steps_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "settlement_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_audit_log: {
        Row: {
          action: string
          after: Json | null
          before: Json | null
          comment: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          organization_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          comment?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          organization_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          comment?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          organization_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settlement_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_auditor_packages: {
        Row: {
          bundle_sha256: string | null
          bundle_storage_path: string | null
          created_at: string
          delivered_at: string | null
          delivered_to_email: string | null
          error_message: string | null
          exception_count: number
          fx_revaluation_count: number
          generated_by: string | null
          id: string
          match_count: number
          organization_id: string
          period_end: string
          period_start: string
          status: string
          updated_at: string
          writeoff_count: number
        }
        Insert: {
          bundle_sha256?: string | null
          bundle_storage_path?: string | null
          created_at?: string
          delivered_at?: string | null
          delivered_to_email?: string | null
          error_message?: string | null
          exception_count?: number
          fx_revaluation_count?: number
          generated_by?: string | null
          id?: string
          match_count?: number
          organization_id: string
          period_end: string
          period_start: string
          status?: string
          updated_at?: string
          writeoff_count?: number
        }
        Update: {
          bundle_sha256?: string | null
          bundle_storage_path?: string | null
          created_at?: string
          delivered_at?: string | null
          delivered_to_email?: string | null
          error_message?: string | null
          exception_count?: number
          fx_revaluation_count?: number
          generated_by?: string | null
          id?: string
          match_count?: number
          organization_id?: string
          period_end?: string
          period_start?: string
          status?: string
          updated_at?: string
          writeoff_count?: number
        }
        Relationships: []
      }
      settlement_dispute_evidence: {
        Row: {
          created_at: string
          dispute_id: string
          file_name: string | null
          file_size_bytes: number | null
          id: string
          kind: string
          mime_type: string | null
          narrative: string | null
          organization_id: string
          storage_path: string | null
          submitted_at: string | null
          submitted_by: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dispute_id: string
          file_name?: string | null
          file_size_bytes?: number | null
          id?: string
          kind?: string
          mime_type?: string | null
          narrative?: string | null
          organization_id: string
          storage_path?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dispute_id?: string
          file_name?: string | null
          file_size_bytes?: number | null
          id?: string
          kind?: string
          mime_type?: string | null
          narrative?: string | null
          organization_id?: string
          storage_path?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_dispute_evidence_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "settlement_disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_disputes: {
        Row: {
          assigned_to: string | null
          connected_account_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          disputed_amount: number
          evidence_due_at: string | null
          evidence_due_by: string | null
          fees: number
          id: string
          journal_entry_id: string | null
          kind: Database["public"]["Enums"]["settlement_dispute_kind"]
          network_reason: string | null
          notes: string | null
          organization_id: string
          original_transaction_id: string | null
          outcome_amount: number | null
          processor_account_id: string
          processor_dispute_id: string
          reason_code: string | null
          resolution_journal_entry_id: string | null
          resolved_at: string | null
          responded_at: string | null
          settlement_id: string | null
          status: Database["public"]["Enums"]["settlement_dispute_status"]
          stripe_dispute_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          connected_account_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          disputed_amount?: number
          evidence_due_at?: string | null
          evidence_due_by?: string | null
          fees?: number
          id?: string
          journal_entry_id?: string | null
          kind?: Database["public"]["Enums"]["settlement_dispute_kind"]
          network_reason?: string | null
          notes?: string | null
          organization_id: string
          original_transaction_id?: string | null
          outcome_amount?: number | null
          processor_account_id: string
          processor_dispute_id: string
          reason_code?: string | null
          resolution_journal_entry_id?: string | null
          resolved_at?: string | null
          responded_at?: string | null
          settlement_id?: string | null
          status?: Database["public"]["Enums"]["settlement_dispute_status"]
          stripe_dispute_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          connected_account_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          disputed_amount?: number
          evidence_due_at?: string | null
          evidence_due_by?: string | null
          fees?: number
          id?: string
          journal_entry_id?: string | null
          kind?: Database["public"]["Enums"]["settlement_dispute_kind"]
          network_reason?: string | null
          notes?: string | null
          organization_id?: string
          original_transaction_id?: string | null
          outcome_amount?: number | null
          processor_account_id?: string
          processor_dispute_id?: string
          reason_code?: string | null
          resolution_journal_entry_id?: string | null
          resolved_at?: string | null
          responded_at?: string | null
          settlement_id?: string | null
          status?: Database["public"]["Enums"]["settlement_dispute_status"]
          stripe_dispute_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_disputes_connected_account_id_fkey"
            columns: ["connected_account_id"]
            isOneToOne: false
            referencedRelation: "stripe_connected_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_disputes_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "settlement_disputes_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_disputes_processor_account_id_fkey"
            columns: ["processor_account_id"]
            isOneToOne: false
            referencedRelation: "processor_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_disputes_resolution_journal_entry_id_fkey"
            columns: ["resolution_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "settlement_disputes_resolution_journal_entry_id_fkey"
            columns: ["resolution_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_disputes_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_fuzzy_candidates: {
        Row: {
          amount_delta: number
          bank_transaction_id: string
          breakdown: Json | null
          computed_at: string
          created_at: string
          date_delta_days: number
          id: string
          organization_id: string
          settlement_id: string
          similarity_score: number
          total_score: number
        }
        Insert: {
          amount_delta?: number
          bank_transaction_id: string
          breakdown?: Json | null
          computed_at?: string
          created_at?: string
          date_delta_days?: number
          id?: string
          organization_id: string
          settlement_id: string
          similarity_score?: number
          total_score?: number
        }
        Update: {
          amount_delta?: number
          bank_transaction_id?: string
          breakdown?: Json | null
          computed_at?: string
          created_at?: string
          date_delta_days?: number
          id?: string
          organization_id?: string
          settlement_id?: string
          similarity_score?: number
          total_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "settlement_fuzzy_candidates_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_fuzzy_candidates_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_fx_revaluations: {
        Row: {
          created_at: string
          created_by: string | null
          functional_currency: string
          id: string
          journal_entry_id: string | null
          organization_id: string
          original_amount: number
          original_currency: string
          original_rate: number
          period_end_date: string
          period_end_rate: number
          revaluation_amount: number
          reversal_journal_entry_id: string | null
          reversed_at: string | null
          settlement_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          functional_currency: string
          id?: string
          journal_entry_id?: string | null
          organization_id: string
          original_amount: number
          original_currency: string
          original_rate: number
          period_end_date: string
          period_end_rate: number
          revaluation_amount: number
          reversal_journal_entry_id?: string | null
          reversed_at?: string | null
          settlement_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          functional_currency?: string
          id?: string
          journal_entry_id?: string | null
          organization_id?: string
          original_amount?: number
          original_currency?: string
          original_rate?: number
          period_end_date?: string
          period_end_rate?: number
          revaluation_amount?: number
          reversal_journal_entry_id?: string | null
          reversed_at?: string | null
          settlement_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_fx_revaluations_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "settlement_fx_revaluations_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_fx_revaluations_reversal_journal_entry_id_fkey"
            columns: ["reversal_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "settlement_fx_revaluations_reversal_journal_entry_id_fkey"
            columns: ["reversal_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_fx_revaluations_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_import_batches: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_count: number
          errors: Json | null
          file_name: string | null
          id: string
          imported_count: number
          organization_id: string
          processor_account_id: string | null
          skipped_count: number
          source: Database["public"]["Enums"]["settlement_source"]
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_count?: number
          errors?: Json | null
          file_name?: string | null
          id?: string
          imported_count?: number
          organization_id: string
          processor_account_id?: string | null
          skipped_count?: number
          source: Database["public"]["Enums"]["settlement_source"]
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_count?: number
          errors?: Json | null
          file_name?: string | null
          id?: string
          imported_count?: number
          organization_id?: string
          processor_account_id?: string | null
          skipped_count?: number
          source?: Database["public"]["Enums"]["settlement_source"]
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_import_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_import_batches_processor_account_id_fkey"
            columns: ["processor_account_id"]
            isOneToOne: false
            referencedRelation: "processor_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_match_group_members: {
        Row: {
          amount: number
          bank_transaction_id: string | null
          created_at: string
          group_id: string
          id: string
          organization_id: string
          sequence: number
          settlement_id: string | null
        }
        Insert: {
          amount?: number
          bank_transaction_id?: string | null
          created_at?: string
          group_id: string
          id?: string
          organization_id: string
          sequence?: number
          settlement_id?: string | null
        }
        Update: {
          amount?: number
          bank_transaction_id?: string | null
          created_at?: string
          group_id?: string
          id?: string
          organization_id?: string
          sequence?: number
          settlement_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settlement_match_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "settlement_match_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_match_groups: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          auto_approved: boolean
          bank_transaction_id: string | null
          confidence_score: number
          created_at: string
          group_type: string
          id: string
          member_count: number
          notes: string | null
          organization_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          settlement_id: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          auto_approved?: boolean
          bank_transaction_id?: string | null
          confidence_score?: number
          created_at?: string
          group_type: string
          id?: string
          member_count?: number
          notes?: string | null
          organization_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          settlement_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          auto_approved?: boolean
          bank_transaction_id?: string | null
          confidence_score?: number
          created_at?: string
          group_type?: string
          id?: string
          member_count?: number
          notes?: string | null
          organization_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          settlement_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      settlement_matches: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approver_user_id: string | null
          auto_approved: boolean
          bank_transaction_id: string
          confidence_score: number
          created_at: string
          created_by: string | null
          department_id: string | null
          dispute_id: string | null
          id: string
          journal_entry_id: string | null
          match_group_id: string | null
          match_type: Database["public"]["Enums"]["settlement_match_type"]
          matched_amount: number | null
          notes: string | null
          organization_id: string
          preparer_user_id: string | null
          requires_second_approval: boolean
          reversal_reason: string | null
          reversed_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          score_breakdown: Json | null
          settlement_id: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approver_user_id?: string | null
          auto_approved?: boolean
          bank_transaction_id: string
          confidence_score?: number
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          dispute_id?: string | null
          id?: string
          journal_entry_id?: string | null
          match_group_id?: string | null
          match_type: Database["public"]["Enums"]["settlement_match_type"]
          matched_amount?: number | null
          notes?: string | null
          organization_id: string
          preparer_user_id?: string | null
          requires_second_approval?: boolean
          reversal_reason?: string | null
          reversed_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score_breakdown?: Json | null
          settlement_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approver_user_id?: string | null
          auto_approved?: boolean
          bank_transaction_id?: string
          confidence_score?: number
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          dispute_id?: string | null
          id?: string
          journal_entry_id?: string | null
          match_group_id?: string | null
          match_type?: Database["public"]["Enums"]["settlement_match_type"]
          matched_amount?: number | null
          notes?: string | null
          organization_id?: string
          preparer_user_id?: string | null
          requires_second_approval?: boolean
          reversal_reason?: string | null
          reversed_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score_breakdown?: Json | null
          settlement_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_matches_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_matches_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_matches_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "settlement_disputes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_matches_group_fk"
            columns: ["match_group_id"]
            isOneToOne: false
            referencedRelation: "settlement_match_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_matches_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "settlement_matches_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_matches_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_processor_metrics_daily: {
        Row: {
          avg_days_to_match: number | null
          chargeback_total: number
          count_exception: number
          count_matched: number
          count_total: number
          count_written_off: number
          created_at: string
          exception_rate: number | null
          fee_total: number
          gross_volume: number
          id: string
          match_rate: number | null
          metric_date: string
          net_volume: number
          organization_id: string
          processor_account_id: string
          refreshed_at: string
          refund_total: number
          updated_at: string
        }
        Insert: {
          avg_days_to_match?: number | null
          chargeback_total?: number
          count_exception?: number
          count_matched?: number
          count_total?: number
          count_written_off?: number
          created_at?: string
          exception_rate?: number | null
          fee_total?: number
          gross_volume?: number
          id?: string
          match_rate?: number | null
          metric_date: string
          net_volume?: number
          organization_id: string
          processor_account_id: string
          refreshed_at?: string
          refund_total?: number
          updated_at?: string
        }
        Update: {
          avg_days_to_match?: number | null
          chargeback_total?: number
          count_exception?: number
          count_matched?: number
          count_total?: number
          count_written_off?: number
          created_at?: string
          exception_rate?: number | null
          fee_total?: number
          gross_volume?: number
          id?: string
          match_rate?: number | null
          metric_date?: string
          net_volume?: number
          organization_id?: string
          processor_account_id?: string
          refreshed_at?: string
          refund_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_processor_metrics_daily_processor_account_id_fkey"
            columns: ["processor_account_id"]
            isOneToOne: false
            referencedRelation: "processor_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_reserve_movements: {
        Row: {
          created_at: string
          created_by: string | null
          delta_amount: number
          id: string
          journal_entry_id: string | null
          movement_date: string
          organization_id: string
          reason: string | null
          reserve_id: string
          running_balance: number
          source: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delta_amount?: number
          id?: string
          journal_entry_id?: string | null
          movement_date?: string
          organization_id: string
          reason?: string | null
          reserve_id: string
          running_balance?: number
          source?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delta_amount?: number
          id?: string
          journal_entry_id?: string | null
          movement_date?: string
          organization_id?: string
          reason?: string | null
          reserve_id?: string
          running_balance?: number
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settlement_reserve_movements_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "settlement_reserve_movements_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_reserve_movements_reserve_id_fkey"
            columns: ["reserve_id"]
            isOneToOne: false
            referencedRelation: "settlement_reserves"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_reserves: {
        Row: {
          created_at: string
          currency: string
          current_balance: number
          gl_account_id: string | null
          id: string
          last_snapshot_at: string | null
          notes: string | null
          opening_balance: number
          organization_id: string
          processor_account_id: string
          release_schedule: Json
          reserve_type: Database["public"]["Enums"]["settlement_reserve_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          current_balance?: number
          gl_account_id?: string | null
          id?: string
          last_snapshot_at?: string | null
          notes?: string | null
          opening_balance?: number
          organization_id: string
          processor_account_id: string
          release_schedule?: Json
          reserve_type?: Database["public"]["Enums"]["settlement_reserve_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          current_balance?: number
          gl_account_id?: string | null
          id?: string
          last_snapshot_at?: string | null
          notes?: string | null
          opening_balance?: number
          organization_id?: string
          processor_account_id?: string
          release_schedule?: Json
          reserve_type?: Database["public"]["Enums"]["settlement_reserve_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_reserves_gl_account_id_fkey"
            columns: ["gl_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_reserves_processor_account_id_fkey"
            columns: ["processor_account_id"]
            isOneToOne: false
            referencedRelation: "processor_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_scoring_rules: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          organization_id: string | null
          rule_key: string
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string | null
          rule_key: string
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string | null
          rule_key?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      settlement_writeoffs: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          journal_entry_id: string | null
          organization_id: string
          reason: string | null
          reversal_journal_entry_id: string | null
          reversed_at: string | null
          settlement_id: string
          updated_at: string
          writeoff_account_id: string
          written_off_at: string
          written_off_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          journal_entry_id?: string | null
          organization_id: string
          reason?: string | null
          reversal_journal_entry_id?: string | null
          reversed_at?: string | null
          settlement_id: string
          updated_at?: string
          writeoff_account_id: string
          written_off_at?: string
          written_off_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          journal_entry_id?: string | null
          organization_id?: string
          reason?: string | null
          reversal_journal_entry_id?: string | null
          reversed_at?: string | null
          settlement_id?: string
          updated_at?: string
          writeoff_account_id?: string
          written_off_at?: string
          written_off_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settlement_writeoffs_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "settlement_writeoffs_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_writeoffs_reversal_journal_entry_id_fkey"
            columns: ["reversal_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "settlement_writeoffs_reversal_journal_entry_id_fkey"
            columns: ["reversal_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_writeoffs_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: true
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_writeoffs_writeoff_account_id_fkey"
            columns: ["writeoff_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          aging_bucket: string | null
          bank_account_id: string | null
          chargebacks: number
          created_at: string
          currency: string
          department_id: string | null
          exception_reason: string | null
          expected_deposit_date: string | null
          fees: number
          functional_amount: number | null
          functional_rate: number | null
          gross_amount: number
          id: string
          import_batch_id: string | null
          imported_at: string
          last_match_attempt_at: string | null
          last_revalued_at: string | null
          net_amount: number
          normalized_ref: string | null
          organization_id: string
          payee_name: string | null
          payer_name: string | null
          payout_ref: string | null
          processor_account_id: string
          raw_payload: Json | null
          refunds: number
          reserves: number
          settlement_date: string
          settlement_ref: string
          source: Database["public"]["Enums"]["settlement_source"]
          status: Database["public"]["Enums"]["settlement_status"]
          updated_at: string
          writeoff_id: string | null
        }
        Insert: {
          aging_bucket?: string | null
          bank_account_id?: string | null
          chargebacks?: number
          created_at?: string
          currency?: string
          department_id?: string | null
          exception_reason?: string | null
          expected_deposit_date?: string | null
          fees?: number
          functional_amount?: number | null
          functional_rate?: number | null
          gross_amount?: number
          id?: string
          import_batch_id?: string | null
          imported_at?: string
          last_match_attempt_at?: string | null
          last_revalued_at?: string | null
          net_amount: number
          normalized_ref?: string | null
          organization_id: string
          payee_name?: string | null
          payer_name?: string | null
          payout_ref?: string | null
          processor_account_id: string
          raw_payload?: Json | null
          refunds?: number
          reserves?: number
          settlement_date: string
          settlement_ref: string
          source?: Database["public"]["Enums"]["settlement_source"]
          status?: Database["public"]["Enums"]["settlement_status"]
          updated_at?: string
          writeoff_id?: string | null
        }
        Update: {
          aging_bucket?: string | null
          bank_account_id?: string | null
          chargebacks?: number
          created_at?: string
          currency?: string
          department_id?: string | null
          exception_reason?: string | null
          expected_deposit_date?: string | null
          fees?: number
          functional_amount?: number | null
          functional_rate?: number | null
          gross_amount?: number
          id?: string
          import_batch_id?: string | null
          imported_at?: string
          last_match_attempt_at?: string | null
          last_revalued_at?: string | null
          net_amount?: number
          normalized_ref?: string | null
          organization_id?: string
          payee_name?: string | null
          payer_name?: string | null
          payout_ref?: string | null
          processor_account_id?: string
          raw_payload?: Json | null
          refunds?: number
          reserves?: number
          settlement_date?: string
          settlement_ref?: string
          source?: Database["public"]["Enums"]["settlement_source"]
          status?: Database["public"]["Enums"]["settlement_status"]
          updated_at?: string
          writeoff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settlements_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_processor_account_id_fkey"
            columns: ["processor_account_id"]
            isOneToOne: false
            referencedRelation: "processor_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_writeoff_id_fkey"
            columns: ["writeoff_id"]
            isOneToOne: false
            referencedRelation: "settlement_writeoffs"
            referencedColumns: ["id"]
          },
        ]
      }
      signed_filing_requests: {
        Row: {
          created_at: string
          created_by: string | null
          document_url: string | null
          filed_at: string | null
          filed_reference: string | null
          filing_payload: Json | null
          filing_reference: string | null
          filing_type: string
          id: string
          organization_id: string
          period_end: string | null
          signer_email: string
          signer_name: string
          signer_title: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          filed_at?: string | null
          filed_reference?: string | null
          filing_payload?: Json | null
          filing_reference?: string | null
          filing_type: string
          id?: string
          organization_id: string
          period_end?: string | null
          signer_email: string
          signer_name: string
          signer_title?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          filed_at?: string | null
          filed_reference?: string | null
          filing_payload?: Json | null
          filing_reference?: string | null
          filing_type?: string
          id?: string
          organization_id?: string
          period_end?: string | null
          signer_email?: string
          signer_name?: string
          signer_title?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      signed_filing_signatures: {
        Row: {
          id: string
          ip_address: string | null
          organization_id: string
          request_id: string
          signature_data: string
          signed_at: string
          signer_name: string
          user_agent: string | null
        }
        Insert: {
          id?: string
          ip_address?: string | null
          organization_id: string
          request_id: string
          signature_data: string
          signed_at?: string
          signer_name: string
          user_agent?: string | null
        }
        Update: {
          id?: string
          ip_address?: string | null
          organization_id?: string
          request_id?: string
          signature_data?: string
          signed_at?: string
          signer_name?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signed_filing_signatures_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "signed_filing_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      signing_reminders: {
        Row: {
          created_at: string
          document_id: string
          frequency_hours: number | null
          id: string
          is_active: boolean | null
          last_reminder_at: string | null
          max_reminders: number | null
          next_reminder_at: string | null
          reminder_type: string | null
          reminders_sent: number | null
          signer_id: string | null
        }
        Insert: {
          created_at?: string
          document_id: string
          frequency_hours?: number | null
          id?: string
          is_active?: boolean | null
          last_reminder_at?: string | null
          max_reminders?: number | null
          next_reminder_at?: string | null
          reminder_type?: string | null
          reminders_sent?: number | null
          signer_id?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string
          frequency_hours?: number | null
          id?: string
          is_active?: boolean | null
          last_reminder_at?: string | null
          max_reminders?: number | null
          next_reminder_at?: string | null
          reminder_type?: string | null
          reminders_sent?: number | null
          signer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signing_reminders_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signing_reminders_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "document_signers"
            referencedColumns: ["id"]
          },
        ]
      }
      signing_workflows: {
        Row: {
          conditions: Json | null
          created_at: string
          current_step: number | null
          document_id: string
          id: string
          status: string | null
          total_steps: number | null
          updated_at: string
          workflow_type: string | null
        }
        Insert: {
          conditions?: Json | null
          created_at?: string
          current_step?: number | null
          document_id: string
          id?: string
          status?: string | null
          total_steps?: number | null
          updated_at?: string
          workflow_type?: string | null
        }
        Update: {
          conditions?: Json | null
          created_at?: string
          current_step?: number | null
          document_id?: string
          id?: string
          status?: string | null
          total_steps?: number | null
          updated_at?: string
          workflow_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signing_workflows_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      statement_mapping_templates: {
        Row: {
          account_name: string | null
          bank_name: string | null
          created_at: string
          created_by: string | null
          date_format: string
          id: string
          invert_sign: boolean
          is_default: boolean
          mappings: Json
          name: string
          number_format: string
          organization_id: string | null
          statement_type: string
          treat_brackets_as_negative: boolean
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          date_format?: string
          id?: string
          invert_sign?: boolean
          is_default?: boolean
          mappings?: Json
          name: string
          number_format?: string
          organization_id?: string | null
          statement_type: string
          treat_brackets_as_negative?: boolean
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          date_format?: string
          id?: string
          invert_sign?: boolean
          is_default?: boolean
          mappings?: Json
          name?: string
          number_format?: string
          organization_id?: string | null
          statement_type?: string
          treat_brackets_as_negative?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "statement_mapping_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_1099k_filings: {
        Row: {
          connected_account_id: string | null
          created_at: string
          filed_at: string | null
          filing_reference: string | null
          filing_status: string
          gross_amount: number
          id: string
          org_id: string
          raw: Json | null
          tax_year: number
          transaction_count: number
          updated_at: string
        }
        Insert: {
          connected_account_id?: string | null
          created_at?: string
          filed_at?: string | null
          filing_reference?: string | null
          filing_status?: string
          gross_amount?: number
          id?: string
          org_id: string
          raw?: Json | null
          tax_year: number
          transaction_count?: number
          updated_at?: string
        }
        Update: {
          connected_account_id?: string | null
          created_at?: string
          filed_at?: string | null
          filing_reference?: string | null
          filing_status?: string
          gross_amount?: number
          id?: string
          org_id?: string
          raw?: Json | null
          tax_year?: number
          transaction_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_1099k_filings_connected_account_id_fkey"
            columns: ["connected_account_id"]
            isOneToOne: false
            referencedRelation: "stripe_connected_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_application_fee_refunds: {
        Row: {
          amount: number
          application_fee_id: string | null
          created_at: string
          currency: string
          id: string
          metadata: Json | null
          organization_id: string
          stripe_refund_id: string
        }
        Insert: {
          amount: number
          application_fee_id?: string | null
          created_at?: string
          currency: string
          id?: string
          metadata?: Json | null
          organization_id: string
          stripe_refund_id: string
        }
        Update: {
          amount?: number
          application_fee_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          stripe_refund_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_application_fee_refunds_application_fee_id_fkey"
            columns: ["application_fee_id"]
            isOneToOne: false
            referencedRelation: "stripe_application_fees"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_application_fees: {
        Row: {
          account_stripe_id: string | null
          amount: number
          amount_refunded: number | null
          charge_id: string | null
          connected_account_id: string | null
          created_at: string
          currency: string
          fiscal_period_id: string | null
          id: string
          journal_entry_id: string | null
          metadata: Json | null
          organization_id: string
          stripe_fee_id: string
          updated_at: string
        }
        Insert: {
          account_stripe_id?: string | null
          amount: number
          amount_refunded?: number | null
          charge_id?: string | null
          connected_account_id?: string | null
          created_at?: string
          currency: string
          fiscal_period_id?: string | null
          id?: string
          journal_entry_id?: string | null
          metadata?: Json | null
          organization_id: string
          stripe_fee_id: string
          updated_at?: string
        }
        Update: {
          account_stripe_id?: string | null
          amount?: number
          amount_refunded?: number | null
          charge_id?: string | null
          connected_account_id?: string | null
          created_at?: string
          currency?: string
          fiscal_period_id?: string | null
          id?: string
          journal_entry_id?: string | null
          metadata?: Json | null
          organization_id?: string
          stripe_fee_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_application_fees_connected_account_id_fkey"
            columns: ["connected_account_id"]
            isOneToOne: false
            referencedRelation: "stripe_connected_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_balance_transaction_cache: {
        Row: {
          amount: number | null
          available_on: string | null
          connected_account_id: string | null
          created_at: string
          created_on: string | null
          currency: string | null
          fee: number | null
          id: string
          net: number | null
          org_id: string
          processed_at: string | null
          raw: Json | null
          source: string | null
          stripe_bt_id: string
          type: string | null
        }
        Insert: {
          amount?: number | null
          available_on?: string | null
          connected_account_id?: string | null
          created_at?: string
          created_on?: string | null
          currency?: string | null
          fee?: number | null
          id?: string
          net?: number | null
          org_id: string
          processed_at?: string | null
          raw?: Json | null
          source?: string | null
          stripe_bt_id: string
          type?: string | null
        }
        Update: {
          amount?: number | null
          available_on?: string | null
          connected_account_id?: string | null
          created_at?: string
          created_on?: string | null
          currency?: string | null
          fee?: number | null
          id?: string
          net?: number | null
          org_id?: string
          processed_at?: string | null
          raw?: Json | null
          source?: string | null
          stripe_bt_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_balance_transaction_cache_connected_account_id_fkey"
            columns: ["connected_account_id"]
            isOneToOne: false
            referencedRelation: "stripe_connected_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_connect_topups: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          id: string
          metadata: Json | null
          organization_id: string
          source: Json | null
          status: string | null
          stripe_topup_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          description?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          source?: Json | null
          status?: string | null
          stripe_topup_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          source?: Json | null
          status?: string | null
          stripe_topup_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      stripe_connect_transfers: {
        Row: {
          amount: number
          connected_account_id: string | null
          created_at: string
          currency: string
          description: string | null
          destination_account_id: string | null
          id: string
          metadata: Json | null
          organization_id: string
          purpose: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          source_transaction: string | null
          status: string | null
          stripe_transfer_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          connected_account_id?: string | null
          created_at?: string
          currency: string
          description?: string | null
          destination_account_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          purpose?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          source_transaction?: string | null
          status?: string | null
          stripe_transfer_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          connected_account_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          destination_account_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          purpose?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          source_transaction?: string | null
          status?: string | null
          stripe_transfer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_connect_transfers_connected_account_id_fkey"
            columns: ["connected_account_id"]
            isOneToOne: false
            referencedRelation: "stripe_connected_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_connected_account_balances: {
        Row: {
          as_of: string
          available_amount: number
          connected_account_id: string
          created_at: string
          currency: string
          id: string
          organization_id: string
          pending_amount: number
          raw: Json | null
          reserved_amount: number
          updated_at: string
        }
        Insert: {
          as_of?: string
          available_amount?: number
          connected_account_id: string
          created_at?: string
          currency: string
          id?: string
          organization_id: string
          pending_amount?: number
          raw?: Json | null
          reserved_amount?: number
          updated_at?: string
        }
        Update: {
          as_of?: string
          available_amount?: number
          connected_account_id?: string
          created_at?: string
          currency?: string
          id?: string
          organization_id?: string
          pending_amount?: number
          raw?: Json | null
          reserved_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_connected_account_balances_connected_account_id_fkey"
            columns: ["connected_account_id"]
            isOneToOne: false
            referencedRelation: "stripe_connected_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_connected_account_persons: {
        Row: {
          connected_account_id: string
          created_at: string
          id: string
          relationship: Json | null
          requirements: Json | null
          stripe_person_id: string
          updated_at: string
          verification: Json | null
        }
        Insert: {
          connected_account_id: string
          created_at?: string
          id?: string
          relationship?: Json | null
          requirements?: Json | null
          stripe_person_id: string
          updated_at?: string
          verification?: Json | null
        }
        Update: {
          connected_account_id?: string
          created_at?: string
          id?: string
          relationship?: Json | null
          requirements?: Json | null
          stripe_person_id?: string
          updated_at?: string
          verification?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_connected_account_persons_connected_account_id_fkey"
            columns: ["connected_account_id"]
            isOneToOne: false
            referencedRelation: "stripe_connected_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_connected_accounts: {
        Row: {
          account_type: string
          business_profile: Json | null
          capabilities: Json | null
          charges_enabled: boolean | null
          country: string | null
          created_at: string
          default_currency: string | null
          details_submitted: boolean | null
          disabled_reason: string | null
          email: string | null
          id: string
          last_synced_at: string | null
          metadata: Json | null
          organization_id: string
          payouts_enabled: boolean | null
          requirements: Json | null
          stripe_account_id: string
          updated_at: string
        }
        Insert: {
          account_type?: string
          business_profile?: Json | null
          capabilities?: Json | null
          charges_enabled?: boolean | null
          country?: string | null
          created_at?: string
          default_currency?: string | null
          details_submitted?: boolean | null
          disabled_reason?: string | null
          email?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json | null
          organization_id: string
          payouts_enabled?: boolean | null
          requirements?: Json | null
          stripe_account_id: string
          updated_at?: string
        }
        Update: {
          account_type?: string
          business_profile?: Json | null
          capabilities?: Json | null
          charges_enabled?: boolean | null
          country?: string | null
          created_at?: string
          default_currency?: string | null
          details_submitted?: boolean | null
          disabled_reason?: string | null
          email?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json | null
          organization_id?: string
          payouts_enabled?: boolean | null
          requirements?: Json | null
          stripe_account_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      stripe_kyc_requirements_log: {
        Row: {
          connected_account_id: string | null
          created_at: string
          currently_due: Json | null
          disabled_reason: string | null
          eventually_due: Json | null
          id: string
          org_id: string
          past_due: Json | null
          raw: Json | null
          snapshot_at: string
        }
        Insert: {
          connected_account_id?: string | null
          created_at?: string
          currently_due?: Json | null
          disabled_reason?: string | null
          eventually_due?: Json | null
          id?: string
          org_id: string
          past_due?: Json | null
          raw?: Json | null
          snapshot_at?: string
        }
        Update: {
          connected_account_id?: string | null
          created_at?: string
          currently_due?: Json | null
          disabled_reason?: string | null
          eventually_due?: Json | null
          id?: string
          org_id?: string
          past_due?: Json | null
          raw?: Json | null
          snapshot_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_kyc_requirements_log_connected_account_id_fkey"
            columns: ["connected_account_id"]
            isOneToOne: false
            referencedRelation: "stripe_connected_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_payout_ledger: {
        Row: {
          arrival_date: string | null
          bank_transaction_id: string | null
          connected_account_id: string | null
          created_at: string
          currency: string
          destination_bank_account_id: string | null
          fees: number
          gross_amount: number
          id: string
          journal_entry_id: string | null
          net_amount: number
          org_id: string
          raw: Json | null
          reconciled_at: string | null
          status: string
          stripe_payout_id: string
          updated_at: string
        }
        Insert: {
          arrival_date?: string | null
          bank_transaction_id?: string | null
          connected_account_id?: string | null
          created_at?: string
          currency?: string
          destination_bank_account_id?: string | null
          fees?: number
          gross_amount?: number
          id?: string
          journal_entry_id?: string | null
          net_amount?: number
          org_id: string
          raw?: Json | null
          reconciled_at?: string | null
          status?: string
          stripe_payout_id: string
          updated_at?: string
        }
        Update: {
          arrival_date?: string | null
          bank_transaction_id?: string | null
          connected_account_id?: string | null
          created_at?: string
          currency?: string
          destination_bank_account_id?: string | null
          fees?: number
          gross_amount?: number
          id?: string
          journal_entry_id?: string | null
          net_amount?: number
          org_id?: string
          raw?: Json | null
          reconciled_at?: string | null
          status?: string
          stripe_payout_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_payout_ledger_connected_account_id_fkey"
            columns: ["connected_account_id"]
            isOneToOne: false
            referencedRelation: "stripe_connected_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_payout_ledger_destination_bank_account_id_fkey"
            columns: ["destination_bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_payouts_to_vendor: {
        Row: {
          amount: number
          connected_account_id: string | null
          created_at: string
          currency: string
          employee_id: string | null
          failure_reason: string | null
          id: string
          initiated_by: string | null
          journal_entry_id: string | null
          metadata: Json | null
          org_id: string
          source_id: string
          source_type: string
          status: string
          stripe_payout_id: string | null
          stripe_transfer_id: string | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          amount: number
          connected_account_id?: string | null
          created_at?: string
          currency?: string
          employee_id?: string | null
          failure_reason?: string | null
          id?: string
          initiated_by?: string | null
          journal_entry_id?: string | null
          metadata?: Json | null
          org_id: string
          source_id: string
          source_type: string
          status?: string
          stripe_payout_id?: string | null
          stripe_transfer_id?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          connected_account_id?: string | null
          created_at?: string
          currency?: string
          employee_id?: string | null
          failure_reason?: string | null
          id?: string
          initiated_by?: string | null
          journal_entry_id?: string | null
          metadata?: Json | null
          org_id?: string
          source_id?: string
          source_type?: string
          status?: string
          stripe_payout_id?: string | null
          stripe_transfer_id?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_payouts_to_vendor_connected_account_id_fkey"
            columns: ["connected_account_id"]
            isOneToOne: false
            referencedRelation: "stripe_connected_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_platform_settings: {
        Row: {
          application_fee_bps: number | null
          created_at: string
          default_currency: string | null
          default_payout_interval: string | null
          default_payout_schedule: string | null
          id: string
          negative_balance_handling: string | null
          org_id: string
          statement_descriptor: string | null
          updated_at: string
        }
        Insert: {
          application_fee_bps?: number | null
          created_at?: string
          default_currency?: string | null
          default_payout_interval?: string | null
          default_payout_schedule?: string | null
          id?: string
          negative_balance_handling?: string | null
          org_id: string
          statement_descriptor?: string | null
          updated_at?: string
        }
        Update: {
          application_fee_bps?: number | null
          created_at?: string
          default_currency?: string | null
          default_payout_interval?: string | null
          default_payout_schedule?: string | null
          id?: string
          negative_balance_handling?: string | null
          org_id?: string
          statement_descriptor?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          error: string | null
          event_id: string
          event_type: string
          payload: Json | null
          processed_at: string | null
          received_at: string
          status: string
        }
        Insert: {
          error?: string | null
          event_id: string
          event_type: string
          payload?: Json | null
          processed_at?: string | null
          received_at?: string
          status?: string
        }
        Update: {
          error?: string | null
          event_id?: string
          event_type?: string
          payload?: Json | null
          processed_at?: string | null
          received_at?: string
          status?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          admin_notes: string | null
          billing_cycle: string | null
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          custom_price: number | null
          discount_expires_at: string | null
          discount_percent: number | null
          id: string
          organization_id: string
          payment_method: string | null
          plan_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_coupon_id: string | null
          stripe_subscription_id: string | null
          trial_extended_at: string | null
          trial_extended_by: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          billing_cycle?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          custom_price?: number | null
          discount_expires_at?: string | null
          discount_percent?: number | null
          id?: string
          organization_id: string
          payment_method?: string | null
          plan_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_coupon_id?: string | null
          stripe_subscription_id?: string | null
          trial_extended_at?: string | null
          trial_extended_by?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          billing_cycle?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          custom_price?: number | null
          discount_expires_at?: string | null
          discount_percent?: number | null
          id?: string
          organization_id?: string
          payment_method?: string | null
          plan_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_coupon_id?: string | null
          stripe_subscription_id?: string | null
          trial_extended_at?: string | null
          trial_extended_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "pricing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_account_mappings: {
        Row: {
          collected_account_id: string | null
          created_at: string | null
          expense_account_id: string | null
          id: string
          is_active: boolean | null
          organization_id: string
          paid_account_id: string | null
          tax_type_id: string
          updated_at: string | null
        }
        Insert: {
          collected_account_id?: string | null
          created_at?: string | null
          expense_account_id?: string | null
          id?: string
          is_active?: boolean | null
          organization_id: string
          paid_account_id?: string | null
          tax_type_id: string
          updated_at?: string | null
        }
        Update: {
          collected_account_id?: string | null
          created_at?: string | null
          expense_account_id?: string | null
          id?: string
          is_active?: boolean | null
          organization_id?: string
          paid_account_id?: string | null
          tax_type_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_account_mappings_collected_account_id_fkey"
            columns: ["collected_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_account_mappings_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_account_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_account_mappings_paid_account_id_fkey"
            columns: ["paid_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_account_mappings_tax_type_id_fkey"
            columns: ["tax_type_id"]
            isOneToOne: false
            referencedRelation: "tax_types"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_address_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          id: string
          jurisdictions: Json | null
          organization_id: string
          provider: string
          request_payload: Json
          response_payload: Json
          total_rate: number | null
          total_tax_cents: number | null
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at: string
          id?: string
          jurisdictions?: Json | null
          organization_id: string
          provider: string
          request_payload: Json
          response_payload: Json
          total_rate?: number | null
          total_tax_cents?: number | null
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          id?: string
          jurisdictions?: Json | null
          organization_id?: string
          provider?: string
          request_payload?: Json
          response_payload?: Json
          total_rate?: number | null
          total_tax_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_address_cache_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after_value: Json | null
          before_value: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          organization_id: string
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          organization_id: string
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          organization_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_authorities: {
        Row: {
          country_id: string | null
          created_at: string
          efile_url: string | null
          filing_frequency: string
          id: string
          is_active: boolean
          name: string
          next_due_date: string | null
          organization_id: string
          region: string | null
          registration_number: string | null
          reporting_currency: string
          updated_at: string
        }
        Insert: {
          country_id?: string | null
          created_at?: string
          efile_url?: string | null
          filing_frequency?: string
          id?: string
          is_active?: boolean
          name: string
          next_due_date?: string | null
          organization_id: string
          region?: string | null
          registration_number?: string | null
          reporting_currency?: string
          updated_at?: string
        }
        Update: {
          country_id?: string | null
          created_at?: string
          efile_url?: string | null
          filing_frequency?: string
          id?: string
          is_active?: boolean
          name?: string
          next_due_date?: string | null
          organization_id?: string
          region?: string | null
          registration_number?: string | null
          reporting_currency?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_authorities_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_authorities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_authority_credentials: {
        Row: {
          access_token: string | null
          account_reference: string | null
          authority_id: string
          business_number: string | null
          created_at: string
          credential_type: string
          id: string
          is_active: boolean
          last_used_at: string | null
          organization_id: string
          payload: Json
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
          vrn: string | null
        }
        Insert: {
          access_token?: string | null
          account_reference?: string | null
          authority_id: string
          business_number?: string | null
          created_at?: string
          credential_type: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          organization_id: string
          payload?: Json
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          vrn?: string | null
        }
        Update: {
          access_token?: string | null
          account_reference?: string | null
          authority_id?: string
          business_number?: string | null
          created_at?: string
          credential_type?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          organization_id?: string
          payload?: Json
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          vrn?: string | null
        }
        Relationships: []
      }
      tax_codes: {
        Row: {
          code: string
          component_tax_codes: Json | null
          created_at: string
          effective_date: string | null
          expiry_date: string | null
          gl_collected_account_id: string | null
          gl_paid_account_id: string | null
          id: string
          is_active: boolean | null
          is_combined: boolean | null
          is_compound: boolean | null
          is_exempt: boolean
          is_recoverable: boolean | null
          is_zero_rated: boolean
          jurisdiction: string | null
          name: string
          organization_id: string | null
          rate: number
          show_combined_display: boolean | null
          tax_authority_id: string | null
          tax_type: string
          updated_at: string
        }
        Insert: {
          code: string
          component_tax_codes?: Json | null
          created_at?: string
          effective_date?: string | null
          expiry_date?: string | null
          gl_collected_account_id?: string | null
          gl_paid_account_id?: string | null
          id?: string
          is_active?: boolean | null
          is_combined?: boolean | null
          is_compound?: boolean | null
          is_exempt?: boolean
          is_recoverable?: boolean | null
          is_zero_rated?: boolean
          jurisdiction?: string | null
          name: string
          organization_id?: string | null
          rate?: number
          show_combined_display?: boolean | null
          tax_authority_id?: string | null
          tax_type?: string
          updated_at?: string
        }
        Update: {
          code?: string
          component_tax_codes?: Json | null
          created_at?: string
          effective_date?: string | null
          expiry_date?: string | null
          gl_collected_account_id?: string | null
          gl_paid_account_id?: string | null
          id?: string
          is_active?: boolean | null
          is_combined?: boolean | null
          is_compound?: boolean | null
          is_exempt?: boolean
          is_recoverable?: boolean | null
          is_zero_rated?: boolean
          jurisdiction?: string | null
          name?: string
          organization_id?: string | null
          rate?: number
          show_combined_display?: boolean | null
          tax_authority_id?: string | null
          tax_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_codes_gl_collected_account_id_fkey"
            columns: ["gl_collected_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_codes_gl_paid_account_id_fkey"
            columns: ["gl_paid_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_codes_tax_authority_id_fkey"
            columns: ["tax_authority_id"]
            isOneToOne: false
            referencedRelation: "tax_authorities"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_economic_nexus_tracker: {
        Row: {
          country_code: string
          id: string
          last_recalculated_at: string
          organization_id: string
          period_end: string
          period_start: string
          region_code: string
          sales_amount: number
          threshold_amount: number | null
          threshold_crossed: boolean
          threshold_crossed_at: string | null
          threshold_transactions: number | null
          transaction_count: number
        }
        Insert: {
          country_code?: string
          id?: string
          last_recalculated_at?: string
          organization_id: string
          period_end: string
          period_start: string
          region_code: string
          sales_amount?: number
          threshold_amount?: number | null
          threshold_crossed?: boolean
          threshold_crossed_at?: string | null
          threshold_transactions?: number | null
          transaction_count?: number
        }
        Update: {
          country_code?: string
          id?: string
          last_recalculated_at?: string
          organization_id?: string
          period_end?: string
          period_start?: string
          region_code?: string
          sales_amount?: number
          threshold_amount?: number | null
          threshold_crossed?: boolean
          threshold_crossed_at?: string | null
          threshold_transactions?: number | null
          transaction_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "tax_economic_nexus_tracker_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_etr_reconciliation_lines: {
        Row: {
          amount_cents: number
          created_at: string
          description: string
          id: string
          line_order: number
          line_type: string
          organization_id: string
          provision_period_id: string
          rate_pct: number
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          description: string
          id?: string
          line_order?: number
          line_type?: string
          organization_id: string
          provision_period_id: string
          rate_pct?: number
        }
        Update: {
          amount_cents?: number
          created_at?: string
          description?: string
          id?: string
          line_order?: number
          line_type?: string
          organization_id?: string
          provision_period_id?: string
          rate_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "tax_etr_reconciliation_lines_provision_period_id_fkey"
            columns: ["provision_period_id"]
            isOneToOne: false
            referencedRelation: "tax_provision_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_exemption_certificates: {
        Row: {
          certificate_number: string
          country_code: string | null
          created_at: string
          customer_id: string | null
          document_url: string | null
          exemption_reason: string
          exemption_type: string | null
          expiry_date: string | null
          id: string
          is_active: boolean
          issued_date: string | null
          notes: string | null
          organization_id: string
          region_code: string | null
          updated_at: string
        }
        Insert: {
          certificate_number: string
          country_code?: string | null
          created_at?: string
          customer_id?: string | null
          document_url?: string | null
          exemption_reason: string
          exemption_type?: string | null
          expiry_date?: string | null
          id?: string
          is_active?: boolean
          issued_date?: string | null
          notes?: string | null
          organization_id: string
          region_code?: string | null
          updated_at?: string
        }
        Update: {
          certificate_number?: string
          country_code?: string | null
          created_at?: string
          customer_id?: string | null
          document_url?: string | null
          exemption_reason?: string
          exemption_type?: string | null
          expiry_date?: string | null
          id?: string
          is_active?: boolean
          issued_date?: string | null
          notes?: string | null
          organization_id?: string
          region_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_exemption_certificates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_filing_periods: {
        Row: {
          created_at: string
          due_date: string
          filed_at: string | null
          filed_by: string | null
          id: string
          notes: string | null
          organization_id: string
          paid_at: string | null
          period_end: string
          period_start: string
          status: string
          tax_authority_id: string
          tax_return_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_date: string
          filed_at?: string | null
          filed_by?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: string
          tax_authority_id: string
          tax_return_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_date?: string
          filed_at?: string | null
          filed_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: string
          tax_authority_id?: string
          tax_return_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_filing_periods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_filing_periods_tax_authority_id_fkey"
            columns: ["tax_authority_id"]
            isOneToOne: false
            referencedRelation: "tax_authorities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_filing_periods_tax_return_id_fkey"
            columns: ["tax_return_id"]
            isOneToOne: false
            referencedRelation: "tax_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_jurisdiction_rates: {
        Row: {
          country_code: string
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          is_primary: boolean
          jurisdiction_name: string
          jurisdiction_type: string
          organization_id: string
          region_code: string | null
          statutory_rate: number
          updated_at: string
        }
        Insert: {
          country_code: string
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id?: string
          is_primary?: boolean
          jurisdiction_name: string
          jurisdiction_type: string
          organization_id: string
          region_code?: string | null
          statutory_rate: number
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_primary?: boolean
          jurisdiction_name?: string
          jurisdiction_type?: string
          organization_id?: string
          region_code?: string | null
          statutory_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      tax_nexus_registrations: {
        Row: {
          country_code: string
          created_at: string
          economic_nexus_threshold_amount: number | null
          economic_nexus_threshold_transactions: number | null
          effective_date: string
          expiry_date: string | null
          filing_frequency: string | null
          id: string
          is_active: boolean
          notes: string | null
          organization_id: string
          region_code: string
          registration_number: string | null
          updated_at: string
        }
        Insert: {
          country_code?: string
          created_at?: string
          economic_nexus_threshold_amount?: number | null
          economic_nexus_threshold_transactions?: number | null
          effective_date: string
          expiry_date?: string | null
          filing_frequency?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          organization_id: string
          region_code: string
          registration_number?: string | null
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          economic_nexus_threshold_amount?: number | null
          economic_nexus_threshold_transactions?: number | null
          effective_date?: string
          expiry_date?: string | null
          filing_frequency?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          organization_id?: string
          region_code?: string
          registration_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_nexus_registrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_nol_carryforwards: {
        Row: {
          created_at: string
          expiry_date: string | null
          id: string
          is_indefinite: boolean
          notes: string | null
          organization_id: string
          origin_jurisdiction: string
          origin_year: number
          original_amount_cents: number
          remaining_amount_cents: number
          updated_at: string
          utilized_amount_cents: number
          valuation_allowance_pct: number
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          is_indefinite?: boolean
          notes?: string | null
          organization_id: string
          origin_jurisdiction: string
          origin_year: number
          original_amount_cents: number
          remaining_amount_cents: number
          updated_at?: string
          utilized_amount_cents?: number
          valuation_allowance_pct?: number
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          is_indefinite?: boolean
          notes?: string | null
          organization_id?: string
          origin_jurisdiction?: string
          origin_year?: number
          original_amount_cents?: number
          remaining_amount_cents?: number
          updated_at?: string
          utilized_amount_cents?: number
          valuation_allowance_pct?: number
        }
        Relationships: []
      }
      tax_payment_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          organization_id: string
          payload: Json
          recipient: string | null
          tax_payment_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          organization_id: string
          payload?: Json
          recipient?: string | null
          tax_payment_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          organization_id?: string
          payload?: Json
          recipient?: string | null
          tax_payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_payment_events_tax_payment_id_fkey"
            columns: ["tax_payment_id"]
            isOneToOne: false
            referencedRelation: "tax_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_payments: {
        Row: {
          amount: number
          approval_state: string
          approved_by: string | null
          authority_id: string | null
          bank_account_id: string | null
          card_brand: string | null
          card_last4: string | null
          confirmation_number: string | null
          confirmation_pdf_url: string | null
          cpp_employee: number | null
          cpp_employer: number | null
          cra_account_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          eft_provider: string | null
          ei_employee: number | null
          ei_employer: number | null
          filing_period_label: string | null
          gross_payroll: number | null
          id: string
          income_tax: number | null
          initiated_by: string | null
          journal_entry_id: string | null
          metadata: Json | null
          notes: string | null
          number_of_employees: number | null
          organization_id: string
          originator_id: string | null
          paid_at: string | null
          payment_method: string
          payment_rail: string | null
          payment_type: string
          period_end: string | null
          period_start: string | null
          provider_transfer_id: string | null
          rail: string | null
          rail_payment_id: string | null
          reconciliation_source: string | null
          reference: string
          remittance_id: string | null
          requires_mfa: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          scheduled_for: string | null
          scheduled_payment_id: string | null
          settled_at: string | null
          settlement_reference: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          tax_filing_period_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          approval_state?: string
          approved_by?: string | null
          authority_id?: string | null
          bank_account_id?: string | null
          card_brand?: string | null
          card_last4?: string | null
          confirmation_number?: string | null
          confirmation_pdf_url?: string | null
          cpp_employee?: number | null
          cpp_employer?: number | null
          cra_account_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          eft_provider?: string | null
          ei_employee?: number | null
          ei_employer?: number | null
          filing_period_label?: string | null
          gross_payroll?: number | null
          id?: string
          income_tax?: number | null
          initiated_by?: string | null
          journal_entry_id?: string | null
          metadata?: Json | null
          notes?: string | null
          number_of_employees?: number | null
          organization_id: string
          originator_id?: string | null
          paid_at?: string | null
          payment_method?: string
          payment_rail?: string | null
          payment_type: string
          period_end?: string | null
          period_start?: string | null
          provider_transfer_id?: string | null
          rail?: string | null
          rail_payment_id?: string | null
          reconciliation_source?: string | null
          reference: string
          remittance_id?: string | null
          requires_mfa?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_for?: string | null
          scheduled_payment_id?: string | null
          settled_at?: string | null
          settlement_reference?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          tax_filing_period_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          approval_state?: string
          approved_by?: string | null
          authority_id?: string | null
          bank_account_id?: string | null
          card_brand?: string | null
          card_last4?: string | null
          confirmation_number?: string | null
          confirmation_pdf_url?: string | null
          cpp_employee?: number | null
          cpp_employer?: number | null
          cra_account_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          eft_provider?: string | null
          ei_employee?: number | null
          ei_employer?: number | null
          filing_period_label?: string | null
          gross_payroll?: number | null
          id?: string
          income_tax?: number | null
          initiated_by?: string | null
          journal_entry_id?: string | null
          metadata?: Json | null
          notes?: string | null
          number_of_employees?: number | null
          organization_id?: string
          originator_id?: string | null
          paid_at?: string | null
          payment_method?: string
          payment_rail?: string | null
          payment_type?: string
          period_end?: string | null
          period_start?: string | null
          provider_transfer_id?: string | null
          rail?: string | null
          rail_payment_id?: string | null
          reconciliation_source?: string | null
          reference?: string
          remittance_id?: string | null
          requires_mfa?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          scheduled_for?: string | null
          scheduled_payment_id?: string | null
          settled_at?: string | null
          settlement_reference?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          tax_filing_period_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_payments_authority_id_fkey"
            columns: ["authority_id"]
            isOneToOne: false
            referencedRelation: "tax_authorities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_payments_cra_account_id_fkey"
            columns: ["cra_account_id"]
            isOneToOne: false
            referencedRelation: "cra_program_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_payments_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "tax_payments_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_payments_remittance_id_fkey"
            columns: ["remittance_id"]
            isOneToOne: false
            referencedRelation: "remittances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_payments_scheduled_payment_id_fkey"
            columns: ["scheduled_payment_id"]
            isOneToOne: false
            referencedRelation: "scheduled_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_payments_tax_filing_period_id_fkey"
            columns: ["tax_filing_period_id"]
            isOneToOne: false
            referencedRelation: "tax_filing_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_period_locks: {
        Row: {
          created_at: string
          filing_period_id: string | null
          id: string
          is_active: boolean
          lock_end: string
          lock_start: string
          locked_at: string
          locked_by: string | null
          organization_id: string
          override_reason: string | null
          tax_authority_id: string | null
        }
        Insert: {
          created_at?: string
          filing_period_id?: string | null
          id?: string
          is_active?: boolean
          lock_end: string
          lock_start: string
          locked_at?: string
          locked_by?: string | null
          organization_id: string
          override_reason?: string | null
          tax_authority_id?: string | null
        }
        Update: {
          created_at?: string
          filing_period_id?: string | null
          id?: string
          is_active?: boolean
          lock_end?: string
          lock_start?: string
          locked_at?: string
          locked_by?: string | null
          organization_id?: string
          override_reason?: string | null
          tax_authority_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_period_locks_filing_period_id_fkey"
            columns: ["filing_period_id"]
            isOneToOne: false
            referencedRelation: "tax_filing_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_period_locks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_period_locks_tax_authority_id_fkey"
            columns: ["tax_authority_id"]
            isOneToOne: false
            referencedRelation: "tax_authorities"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_provider_settings: {
        Row: {
          auto_calculate_on_invoice: boolean
          auto_validate_addresses: boolean
          company_code: string | null
          created_at: string
          default_origin_address: Json | null
          environment: string
          id: string
          organization_id: string
          provider: string
          updated_at: string
        }
        Insert: {
          auto_calculate_on_invoice?: boolean
          auto_validate_addresses?: boolean
          company_code?: string | null
          created_at?: string
          default_origin_address?: Json | null
          environment?: string
          id?: string
          organization_id: string
          provider?: string
          updated_at?: string
        }
        Update: {
          auto_calculate_on_invoice?: boolean
          auto_validate_addresses?: boolean
          company_code?: string | null
          created_at?: string
          default_origin_address?: Json | null
          environment?: string
          id?: string
          organization_id?: string
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_provider_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_provision_adjustments: {
        Row: {
          adjustment_type: string
          amount_cents: number
          applied_rate: number | null
          created_at: string
          description: string
          id: string
          organization_id: string
          provision_period_id: string
          tax_impact_cents: number
          updated_at: string
        }
        Insert: {
          adjustment_type: string
          amount_cents?: number
          applied_rate?: number | null
          created_at?: string
          description: string
          id?: string
          organization_id: string
          provision_period_id: string
          tax_impact_cents?: number
          updated_at?: string
        }
        Update: {
          adjustment_type?: string
          amount_cents?: number
          applied_rate?: number | null
          created_at?: string
          description?: string
          id?: string
          organization_id?: string
          provision_period_id?: string
          tax_impact_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_provision_adjustments_provision_period_id_fkey"
            columns: ["provision_period_id"]
            isOneToOne: false
            referencedRelation: "tax_provision_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_provision_periods: {
        Row: {
          created_at: string
          created_by: string | null
          current_tax_expense_cents: number
          deferred_tax_expense_cents: number
          effective_tax_rate: number
          id: string
          notes: string | null
          organization_id: string
          period_end: string
          period_label: string
          period_start: string
          period_type: string
          pretax_book_income_cents: number
          reporting_framework: string
          status: string
          total_tax_provision_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_tax_expense_cents?: number
          deferred_tax_expense_cents?: number
          effective_tax_rate?: number
          id?: string
          notes?: string | null
          organization_id: string
          period_end: string
          period_label: string
          period_start: string
          period_type?: string
          pretax_book_income_cents?: number
          reporting_framework?: string
          status?: string
          total_tax_provision_cents?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_tax_expense_cents?: number
          deferred_tax_expense_cents?: number
          effective_tax_rate?: number
          id?: string
          notes?: string | null
          organization_id?: string
          period_end?: string
          period_label?: string
          period_start?: string
          period_type?: string
          pretax_book_income_cents?: number
          reporting_framework?: string
          status?: string
          total_tax_provision_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      tax_rates: {
        Row: {
          created_at: string | null
          effective_from: string
          effective_to: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          jurisdiction_id: string | null
          rate: number
          rate_name: string | null
          tax_type_id: string
          threshold_max: number | null
          threshold_min: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          jurisdiction_id?: string | null
          rate?: number
          rate_name?: string | null
          tax_type_id: string
          threshold_max?: number | null
          threshold_min?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          jurisdiction_id?: string | null
          rate?: number
          rate_name?: string | null
          tax_type_id?: string
          threshold_max?: number | null
          threshold_min?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_rates_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "combined_tax_rates"
            referencedColumns: ["jurisdiction_id"]
          },
          {
            foreignKeyName: "tax_rates_jurisdiction_id_fkey"
            columns: ["jurisdiction_id"]
            isOneToOne: false
            referencedRelation: "jurisdictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_rates_tax_type_id_fkey"
            columns: ["tax_type_id"]
            isOneToOne: false
            referencedRelation: "tax_types"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_returns: {
        Row: {
          adjustments: number | null
          created_at: string
          due_date: string
          filed_at: string | null
          filed_by: string | null
          id: string
          journal_entry_id: string | null
          net_payable: number | null
          notes: string | null
          organization_id: string | null
          paid_at: string | null
          payment_reference: string | null
          period_end: string
          period_name: string
          period_start: string
          status: string
          tax_collected: number | null
          tax_paid: number | null
          updated_at: string
        }
        Insert: {
          adjustments?: number | null
          created_at?: string
          due_date: string
          filed_at?: string | null
          filed_by?: string | null
          id?: string
          journal_entry_id?: string | null
          net_payable?: number | null
          notes?: string | null
          organization_id?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          period_end: string
          period_name: string
          period_start: string
          status?: string
          tax_collected?: number | null
          tax_paid?: number | null
          updated_at?: string
        }
        Update: {
          adjustments?: number | null
          created_at?: string
          due_date?: string
          filed_at?: string | null
          filed_by?: string | null
          id?: string
          journal_entry_id?: string | null
          net_payable?: number | null
          notes?: string | null
          organization_id?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          period_end?: string
          period_name?: string
          period_start?: string
          status?: string
          tax_collected?: number | null
          tax_paid?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_returns_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "tax_returns_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_returns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_slips: {
        Row: {
          box_14_employment_income: number | null
          box_16_cpp_contributions: number | null
          box_16a_cpp2_contributions: number | null
          box_17_cpp2_contributions: number | null
          box_17a_qpp2_contributions: number | null
          box_18_ei_premiums: number | null
          box_20_rpp_contributions: number | null
          box_22_income_tax_deducted: number | null
          box_24_ei_insurable_earnings: number | null
          box_26_cpp_pensionable_earnings: number | null
          box_44_union_dues: number | null
          box_46_charitable_donations: number | null
          box_52_pension_adjustment: number | null
          box_55_ppip_premiums: number | null
          box_56_ppip_insurable_earnings: number | null
          created_at: string
          dental_benefits_code: string | null
          employee_id: string
          employer_account_number: string | null
          employer_address: string | null
          employer_bn: string | null
          employer_name: string | null
          employment_code: string | null
          exempt_cpp: boolean | null
          exempt_ei: boolean | null
          exempt_ppip: boolean | null
          id: string
          issued_date: string | null
          notes: string | null
          other_info: Json | null
          province_of_employment: string | null
          slip_type: string
          status: string | null
          tax_year: number
          updated_at: string
        }
        Insert: {
          box_14_employment_income?: number | null
          box_16_cpp_contributions?: number | null
          box_16a_cpp2_contributions?: number | null
          box_17_cpp2_contributions?: number | null
          box_17a_qpp2_contributions?: number | null
          box_18_ei_premiums?: number | null
          box_20_rpp_contributions?: number | null
          box_22_income_tax_deducted?: number | null
          box_24_ei_insurable_earnings?: number | null
          box_26_cpp_pensionable_earnings?: number | null
          box_44_union_dues?: number | null
          box_46_charitable_donations?: number | null
          box_52_pension_adjustment?: number | null
          box_55_ppip_premiums?: number | null
          box_56_ppip_insurable_earnings?: number | null
          created_at?: string
          dental_benefits_code?: string | null
          employee_id: string
          employer_account_number?: string | null
          employer_address?: string | null
          employer_bn?: string | null
          employer_name?: string | null
          employment_code?: string | null
          exempt_cpp?: boolean | null
          exempt_ei?: boolean | null
          exempt_ppip?: boolean | null
          id?: string
          issued_date?: string | null
          notes?: string | null
          other_info?: Json | null
          province_of_employment?: string | null
          slip_type?: string
          status?: string | null
          tax_year: number
          updated_at?: string
        }
        Update: {
          box_14_employment_income?: number | null
          box_16_cpp_contributions?: number | null
          box_16a_cpp2_contributions?: number | null
          box_17_cpp2_contributions?: number | null
          box_17a_qpp2_contributions?: number | null
          box_18_ei_premiums?: number | null
          box_20_rpp_contributions?: number | null
          box_22_income_tax_deducted?: number | null
          box_24_ei_insurable_earnings?: number | null
          box_26_cpp_pensionable_earnings?: number | null
          box_44_union_dues?: number | null
          box_46_charitable_donations?: number | null
          box_52_pension_adjustment?: number | null
          box_55_ppip_premiums?: number | null
          box_56_ppip_insurable_earnings?: number | null
          created_at?: string
          dental_benefits_code?: string | null
          employee_id?: string
          employer_account_number?: string | null
          employer_address?: string | null
          employer_bn?: string | null
          employer_name?: string | null
          employment_code?: string | null
          exempt_cpp?: boolean | null
          exempt_ei?: boolean | null
          exempt_ppip?: boolean | null
          id?: string
          issued_date?: string | null
          notes?: string | null
          other_info?: Json | null
          province_of_employment?: string | null
          slip_type?: string
          status?: string | null
          tax_year?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_slips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_submissions: {
        Row: {
          acknowledged_at: string | null
          authority_id: string | null
          authority_response: Json | null
          channel: string
          confirmation_number: string | null
          created_at: string
          currency: string | null
          error_message: string | null
          filing_period_id: string | null
          form_code: string | null
          id: string
          net_payable: number | null
          organization_id: string
          payload: Json | null
          payload_format: string | null
          period_end: string | null
          period_start: string | null
          retry_count: number
          status: string
          submitted_by: string | null
          tax_return_id: string | null
          transmitted_at: string | null
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          authority_id?: string | null
          authority_response?: Json | null
          channel: string
          confirmation_number?: string | null
          created_at?: string
          currency?: string | null
          error_message?: string | null
          filing_period_id?: string | null
          form_code?: string | null
          id?: string
          net_payable?: number | null
          organization_id: string
          payload?: Json | null
          payload_format?: string | null
          period_end?: string | null
          period_start?: string | null
          retry_count?: number
          status?: string
          submitted_by?: string | null
          tax_return_id?: string | null
          transmitted_at?: string | null
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          authority_id?: string | null
          authority_response?: Json | null
          channel?: string
          confirmation_number?: string | null
          created_at?: string
          currency?: string | null
          error_message?: string | null
          filing_period_id?: string | null
          form_code?: string | null
          id?: string
          net_payable?: number | null
          organization_id?: string
          payload?: Json | null
          payload_format?: string | null
          period_end?: string | null
          period_start?: string | null
          retry_count?: number
          status?: string
          submitted_by?: string | null
          tax_return_id?: string | null
          transmitted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tax_temp_diff_movements: {
        Row: {
          applied_rate: number
          closing_balance_cents: number
          created_at: string
          deferred_tax_balance_cents: number
          deferred_tax_movement_cents: number
          id: string
          notes: string | null
          opening_balance_cents: number
          organization_id: string
          originating_cents: number
          provision_period_id: string
          reversing_cents: number
          temp_diff_id: string
          updated_at: string
        }
        Insert: {
          applied_rate?: number
          closing_balance_cents?: number
          created_at?: string
          deferred_tax_balance_cents?: number
          deferred_tax_movement_cents?: number
          id?: string
          notes?: string | null
          opening_balance_cents?: number
          organization_id: string
          originating_cents?: number
          provision_period_id: string
          reversing_cents?: number
          temp_diff_id: string
          updated_at?: string
        }
        Update: {
          applied_rate?: number
          closing_balance_cents?: number
          created_at?: string
          deferred_tax_balance_cents?: number
          deferred_tax_movement_cents?: number
          id?: string
          notes?: string | null
          opening_balance_cents?: number
          organization_id?: string
          originating_cents?: number
          provision_period_id?: string
          reversing_cents?: number
          temp_diff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_temp_diff_movements_provision_period_id_fkey"
            columns: ["provision_period_id"]
            isOneToOne: false
            referencedRelation: "tax_provision_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_temp_diff_movements_temp_diff_id_fkey"
            columns: ["temp_diff_id"]
            isOneToOne: false
            referencedRelation: "tax_temporary_differences"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_temporary_differences: {
        Row: {
          category: string
          created_at: string
          description: string | null
          difference_type: string
          gl_account_id: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          difference_type: string
          gl_account_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          difference_type?: string
          gl_account_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tax_types: {
        Row: {
          applies_to: string | null
          calculation_method: string | null
          code: string
          country_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_compound: boolean | null
          is_recoverable: boolean | null
          name: string
          tax_authority: string | null
          tax_category: string
          updated_at: string | null
        }
        Insert: {
          applies_to?: string | null
          calculation_method?: string | null
          code: string
          country_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_compound?: boolean | null
          is_recoverable?: boolean | null
          name: string
          tax_authority?: string | null
          tax_category: string
          updated_at?: string | null
        }
        Update: {
          applies_to?: string | null
          calculation_method?: string | null
          code?: string
          country_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_compound?: boolean | null
          is_recoverable?: boolean | null
          name?: string
          tax_authority?: string | null
          tax_category?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_types_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_approval_rules: {
        Row: {
          approval_method: Database["public"]["Enums"]["approval_method"]
          auto_approve_after_hours: number | null
          created_at: string
          id: string
          is_active: boolean | null
          organization_id: string | null
          overtime_requires_approval: boolean | null
          require_hr_approval: boolean | null
          require_manager_approval: boolean | null
          updated_at: string
        }
        Insert: {
          approval_method?: Database["public"]["Enums"]["approval_method"]
          auto_approve_after_hours?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          overtime_requires_approval?: boolean | null
          require_hr_approval?: boolean | null
          require_manager_approval?: boolean | null
          updated_at?: string
        }
        Update: {
          approval_method?: Database["public"]["Enums"]["approval_method"]
          auto_approve_after_hours?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          overtime_requires_approval?: boolean | null
          require_hr_approval?: boolean | null
          require_manager_approval?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_approval_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_entries: {
        Row: {
          break_duration: number | null
          created_at: string
          end_time: string | null
          id: string
          notes: string | null
          overtime_hours: number | null
          project_id: string | null
          regular_hours: number
          start_time: string | null
          task_description: string | null
          timesheet_id: string
          updated_at: string
          work_date: string
        }
        Insert: {
          break_duration?: number | null
          created_at?: string
          end_time?: string | null
          id?: string
          notes?: string | null
          overtime_hours?: number | null
          project_id?: string | null
          regular_hours?: number
          start_time?: string | null
          task_description?: string | null
          timesheet_id: string
          updated_at?: string
          work_date: string
        }
        Update: {
          break_duration?: number | null
          created_at?: string
          end_time?: string | null
          id?: string
          notes?: string | null
          overtime_hours?: number | null
          project_id?: string | null
          regular_hours?: number
          start_time?: string | null
          task_description?: string | null
          timesheet_id?: string
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_entries_timesheet_id_fkey"
            columns: ["timesheet_id"]
            isOneToOne: false
            referencedRelation: "employee_timesheets"
            referencedColumns: ["id"]
          },
        ]
      }
      tin_match_batch_results: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          match_code: string | null
          match_status: string
          notes: string | null
          organization_id: string
          tin_last4: string | null
          vendor_profile_id: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          match_code?: string | null
          match_status: string
          notes?: string | null
          organization_id: string
          tin_last4?: string | null
          vendor_profile_id?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          match_code?: string | null
          match_status?: string
          notes?: string | null
          organization_id?: string
          tin_last4?: string | null
          vendor_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tin_match_batch_results_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "tin_match_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      tin_match_batches: {
        Row: {
          batch_reference: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          irs_response: Json | null
          matched_count: number
          mismatched_count: number
          organization_id: string
          status: string
          submitted_at: string | null
          updated_at: string
          vendor_count: number
        }
        Insert: {
          batch_reference: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          irs_response?: Json | null
          matched_count?: number
          mismatched_count?: number
          organization_id: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          vendor_count?: number
        }
        Update: {
          batch_reference?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          irs_response?: Json | null
          matched_count?: number
          mismatched_count?: number
          organization_id?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          vendor_count?: number
        }
        Relationships: []
      }
      transaction_rules: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          last_matched_at: string | null
          logic_operator: string
          matches_count: number
          name: string
          organization_id: string | null
          priority: number
          set_department_id: string | null
          updated_at: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_matched_at?: string | null
          logic_operator?: string
          matches_count?: number
          name: string
          organization_id?: string | null
          priority?: number
          set_department_id?: string | null
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_matched_at?: string | null
          logic_operator?: string
          matches_count?: number
          name?: string
          organization_id?: string | null
          priority?: number
          set_department_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_rules_set_department_id_fkey"
            columns: ["set_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_alerts: {
        Row: {
          ack_at: string | null
          ack_by: string | null
          body: string | null
          category: string
          created_at: string
          id: string
          organization_id: string
          payload: Json | null
          severity: string
          title: string
        }
        Insert: {
          ack_at?: string | null
          ack_by?: string | null
          body?: string | null
          category: string
          created_at?: string
          id?: string
          organization_id: string
          payload?: Json | null
          severity?: string
          title: string
        }
        Update: {
          ack_at?: string | null
          ack_by?: string | null
          body?: string | null
          category?: string
          created_at?: string
          id?: string
          organization_id?: string
          payload?: Json | null
          severity?: string
          title?: string
        }
        Relationships: []
      }
      treasury_anomalies: {
        Row: {
          assignee_user_id: string | null
          authority: string | null
          category: string
          created_at: string
          fingerprint: string
          id: string
          organization_id: string
          payload: Json
          program_code: string | null
          related_tax_payment_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          assignee_user_id?: string | null
          authority?: string | null
          category: string
          created_at?: string
          fingerprint: string
          id?: string
          organization_id: string
          payload?: Json
          program_code?: string | null
          related_tax_payment_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assignee_user_id?: string | null
          authority?: string | null
          category?: string
          created_at?: string
          fingerprint?: string
          id?: string
          organization_id?: string
          payload?: Json
          program_code?: string | null
          related_tax_payment_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      treasury_forecast_lines: {
        Row: {
          authority: string
          bucket_end: string
          bucket_start: string
          bucket_type: string
          confidence: number
          created_at: string
          details: Json
          funding_gap: number
          id: string
          organization_id: string
          program_code: string | null
          projected_funding: number
          projected_liability: number
          run_id: string
        }
        Insert: {
          authority: string
          bucket_end: string
          bucket_start: string
          bucket_type: string
          confidence?: number
          created_at?: string
          details?: Json
          funding_gap?: number
          id?: string
          organization_id: string
          program_code?: string | null
          projected_funding?: number
          projected_liability?: number
          run_id: string
        }
        Update: {
          authority?: string
          bucket_end?: string
          bucket_start?: string
          bucket_type?: string
          confidence?: number
          created_at?: string
          details?: Json
          funding_gap?: number
          id?: string
          organization_id?: string
          program_code?: string | null
          projected_funding?: number
          projected_liability?: number
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treasury_forecast_lines_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "treasury_forecast_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_forecast_runs: {
        Row: {
          created_at: string
          created_by: string | null
          horizon_months: number
          horizon_weeks: number
          id: string
          inputs: Json
          organization_id: string
          summary: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          horizon_months?: number
          horizon_weeks?: number
          id?: string
          inputs?: Json
          organization_id: string
          summary?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          horizon_months?: number
          horizon_weeks?: number
          id?: string
          inputs?: Json
          organization_id?: string
          summary?: Json
        }
        Relationships: []
      }
      treasury_job_runs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error: string | null
          finished_at: string | null
          id: string
          job_name: string
          organization_id: string | null
          payload: Json | null
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          job_name: string
          organization_id?: string | null
          payload?: Json | null
          started_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          job_name?: string
          organization_id?: string | null
          payload?: Json | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      treasury_payment_audit: {
        Row: {
          action: string
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
          organization_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: string | null
          organization_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "treasury_payment_audit_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      treasury_period_close: {
        Row: {
          authority: string
          closed_at: string | null
          closed_by: string | null
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          period_end: string
          period_start: string
          program_code: string | null
          related_filing_id: string | null
          related_tax_payment_id: string | null
          status: string
          statutory_due_date: string | null
          updated_at: string
        }
        Insert: {
          authority: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          period_end: string
          period_start: string
          program_code?: string | null
          related_filing_id?: string | null
          related_tax_payment_id?: string | null
          status?: string
          statutory_due_date?: string | null
          updated_at?: string
        }
        Update: {
          authority?: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          period_end?: string
          period_start?: string
          program_code?: string | null
          related_filing_id?: string | null
          related_tax_payment_id?: string | null
          status?: string
          statutory_due_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      treasury_webhook_events: {
        Row: {
          event_type: string | null
          payload: Json
          processed_at: string
          provider: string
          provider_event_id: string
        }
        Insert: {
          event_type?: string | null
          payload: Json
          processed_at?: string
          provider?: string
          provider_event_id: string
        }
        Update: {
          event_type?: string | null
          payload?: Json
          processed_at?: string
          provider?: string
          provider_event_id?: string
        }
        Relationships: []
      }
      us_payment_rail_submissions: {
        Row: {
          ack: Json | null
          batch_reference: string | null
          created_by: string | null
          file_hash: string | null
          id: string
          organization_id: string
          rail_id: string
          status: string
          submission_type: string
          submitted_at: string
        }
        Insert: {
          ack?: Json | null
          batch_reference?: string | null
          created_by?: string | null
          file_hash?: string | null
          id?: string
          organization_id: string
          rail_id: string
          status?: string
          submission_type: string
          submitted_at?: string
        }
        Update: {
          ack?: Json | null
          batch_reference?: string | null
          created_by?: string | null
          file_hash?: string | null
          id?: string
          organization_id?: string
          rail_id?: string
          status?: string
          submission_type?: string
          submitted_at?: string
        }
        Relationships: []
      }
      us_payment_rails: {
        Row: {
          account_number_encrypted: string | null
          account_number_last4: string | null
          bank_name: string | null
          created_at: string
          created_by: string | null
          eftps_pin_encrypted: string | null
          eftps_taxpayer_id: string | null
          id: string
          is_active: boolean
          is_default: boolean
          nickname: string
          organization_id: string
          rail_type: string
          routing_number: string | null
          updated_at: string
        }
        Insert: {
          account_number_encrypted?: string | null
          account_number_last4?: string | null
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          eftps_pin_encrypted?: string | null
          eftps_taxpayer_id?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          nickname: string
          organization_id: string
          rail_type: string
          routing_number?: string | null
          updated_at?: string
        }
        Update: {
          account_number_encrypted?: string | null
          account_number_last4?: string | null
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          eftps_pin_encrypted?: string | null
          eftps_taxpayer_id?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          nickname?: string
          organization_id?: string
          rail_type?: string
          routing_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      us_payroll_tax_rates: {
        Row: {
          created_at: string
          employee_rate: number
          employer_rate: number
          id: string
          jurisdiction: string
          notes: string | null
          state_code: string | null
          tax_type: string
          tax_year: number
          wage_base: number | null
        }
        Insert: {
          created_at?: string
          employee_rate?: number
          employer_rate?: number
          id?: string
          jurisdiction: string
          notes?: string | null
          state_code?: string | null
          tax_type: string
          tax_year: number
          wage_base?: number | null
        }
        Update: {
          created_at?: string
          employee_rate?: number
          employer_rate?: number
          id?: string
          jurisdiction?: string
          notes?: string | null
          state_code?: string | null
          tax_type?: string
          tax_year?: number
          wage_base?: number | null
        }
        Relationships: []
      }
      user_division_access: {
        Row: {
          access_level: string
          created_at: string
          department_id: string
          id: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_level?: string
          created_at?: string
          department_id: string
          id?: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_level?: string
          created_at?: string
          department_id?: string
          id?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_division_access_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_division_access_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          date_format: string
          default_report_period: string
          due_date_reminders: boolean
          email_notifications: boolean
          id: string
          negative_format: string
          number_format: string
          organization_id: string | null
          reconciliation_alerts: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_format?: string
          default_report_period?: string
          due_date_reminders?: boolean
          email_notifications?: boolean
          id?: string
          negative_format?: string
          number_format?: string
          organization_id?: string | null
          reconciliation_alerts?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_format?: string
          default_report_period?: string
          due_date_reminders?: boolean
          email_notifications?: boolean
          id?: string
          negative_format?: string
          number_format?: string
          organization_id?: string | null
          reconciliation_alerts?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_organization_id_fkey"
            columns: ["organization_id"]
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
          role?: Database["public"]["Enums"]["app_role"]
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
      user_signatures: {
        Row: {
          created_at: string
          font_family: string | null
          id: string
          is_default: boolean | null
          signature_data: string
          signature_type: string | null
          signer_email: string | null
          storage_url: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          font_family?: string | null
          id?: string
          is_default?: boolean | null
          signature_data: string
          signature_type?: string | null
          signer_email?: string | null
          storage_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          font_family?: string | null
          id?: string
          is_default?: boolean | null
          signature_data?: string
          signature_type?: string | null
          signer_email?: string | null
          storage_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      vendor_banking_profiles: {
        Row: {
          account_number: string | null
          created_at: string
          currency: string
          id: string
          institution_number: string | null
          is_active: boolean
          metadata: Json
          organization_id: string
          payment_method: string
          remittance_email: string | null
          transit_number: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          account_number?: string | null
          created_at?: string
          currency?: string
          id?: string
          institution_number?: string | null
          is_active?: boolean
          metadata?: Json
          organization_id: string
          payment_method?: string
          remittance_email?: string | null
          transit_number?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          account_number?: string | null
          created_at?: string
          currency?: string
          id?: string
          institution_number?: string | null
          is_active?: boolean
          metadata?: Json
          organization_id?: string
          payment_method?: string
          remittance_email?: string | null
          transit_number?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: []
      }
      vendor_credit_lines: {
        Row: {
          amount: number
          created_at: string
          department_id: string | null
          description: string
          expense_account_id: string | null
          id: string
          line_order: number
          quantity: number
          tax_amount: number | null
          tax_rate: number | null
          unit_price: number
          vendor_credit_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          department_id?: string | null
          description: string
          expense_account_id?: string | null
          id?: string
          line_order?: number
          quantity?: number
          tax_amount?: number | null
          tax_rate?: number | null
          unit_price?: number
          vendor_credit_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          department_id?: string | null
          description?: string
          expense_account_id?: string | null
          id?: string
          line_order?: number
          quantity?: number
          tax_amount?: number | null
          tax_rate?: number | null
          unit_price?: number
          vendor_credit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_credit_lines_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_credit_lines_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_credit_lines_vendor_credit_id_fkey"
            columns: ["vendor_credit_id"]
            isOneToOne: false
            referencedRelation: "vendor_credits"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_credits: {
        Row: {
          amount_applied: number
          balance_remaining: number
          bill_id: string | null
          created_at: string
          credit_date: string
          credit_number: string
          currency: string
          department_id: string | null
          id: string
          issued_at: string | null
          journal_entry_id: string | null
          notes: string | null
          organization_id: string | null
          reason: string | null
          status: string
          subtotal: number
          tax_amount: number
          total: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          amount_applied?: number
          balance_remaining?: number
          bill_id?: string | null
          created_at?: string
          credit_date?: string
          credit_number: string
          currency?: string
          department_id?: string | null
          id?: string
          issued_at?: string | null
          journal_entry_id?: string | null
          notes?: string | null
          organization_id?: string | null
          reason?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          amount_applied?: number
          balance_remaining?: number
          bill_id?: string | null
          created_at?: string
          credit_date?: string
          credit_number?: string
          currency?: string
          department_id?: string | null
          id?: string
          issued_at?: string | null
          journal_entry_id?: string | null
          notes?: string | null
          organization_id?: string | null
          reason?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_credits_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_credits_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_credits_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "vendor_credits_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_credits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_credits_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_payments: {
        Row: {
          amount: number
          bank_account_id: string | null
          bank_transaction_id: string | null
          bill_id: string | null
          created_at: string
          department_id: string | null
          id: string
          journal_entry_id: string | null
          notes: string | null
          organization_id: string | null
          payment_date: string
          payment_method: string | null
          reference: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          bank_transaction_id?: string | null
          bill_id?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          organization_id?: string | null
          payment_date?: string
          payment_method?: string | null
          reference?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          bank_transaction_id?: string | null
          bill_id?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          organization_id?: string | null
          payment_date?: string
          payment_method?: string | null
          reference?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_payments_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: false
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_payments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_payments_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "vendor_payments_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_stripe_connect: {
        Row: {
          connected_account_id: string
          created_at: string
          default_payout_method: string | null
          id: string
          organization_id: string
          vendor_id: string
        }
        Insert: {
          connected_account_id: string
          created_at?: string
          default_payout_method?: string | null
          id?: string
          organization_id: string
          vendor_id: string
        }
        Update: {
          connected_account_id?: string
          created_at?: string
          default_payout_method?: string | null
          id?: string
          organization_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_stripe_connect_connected_account_id_fkey"
            columns: ["connected_account_id"]
            isOneToOne: false
            referencedRelation: "stripe_connected_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_tax_profiles: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          business_number: string | null
          city: string | null
          country: string
          created_at: string
          ein: string | null
          id: string
          legal_name: string | null
          organization_id: string
          postal_code: string | null
          sin: string | null
          slip_type_override: string | null
          state_province: string | null
          td1_on_file: boolean
          tin: string | null
          tin_match_checked_at: string | null
          tin_match_notes: string | null
          tin_match_status: string
          updated_at: string
          vendor_id: string
          w_form_type: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          business_number?: string | null
          city?: string | null
          country?: string
          created_at?: string
          ein?: string | null
          id?: string
          legal_name?: string | null
          organization_id: string
          postal_code?: string | null
          sin?: string | null
          slip_type_override?: string | null
          state_province?: string | null
          td1_on_file?: boolean
          tin?: string | null
          tin_match_checked_at?: string | null
          tin_match_notes?: string | null
          tin_match_status?: string
          updated_at?: string
          vendor_id: string
          w_form_type?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          business_number?: string | null
          city?: string | null
          country?: string
          created_at?: string
          ein?: string | null
          id?: string
          legal_name?: string | null
          organization_id?: string
          postal_code?: string | null
          sin?: string | null
          slip_type_override?: string | null
          state_province?: string | null
          td1_on_file?: boolean
          tin?: string | null
          tin_match_checked_at?: string | null
          tin_match_notes?: string | null
          tin_match_status?: string
          updated_at?: string
          vendor_id?: string
          w_form_type?: string | null
        }
        Relationships: []
      }
      vendor_tax_slip_lines: {
        Row: {
          amount: number
          bill_id: string | null
          box_code: string
          created_at: string
          description: string | null
          id: string
          organization_id: string
          payment_date: string
          payment_id: string | null
          slip_id: string
        }
        Insert: {
          amount: number
          bill_id?: string | null
          box_code: string
          created_at?: string
          description?: string | null
          id?: string
          organization_id: string
          payment_date: string
          payment_id?: string | null
          slip_id: string
        }
        Update: {
          amount?: number
          bill_id?: string | null
          box_code?: string
          created_at?: string
          description?: string | null
          id?: string
          organization_id?: string
          payment_date?: string
          payment_id?: string | null
          slip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_tax_slip_lines_slip_id_fkey"
            columns: ["slip_id"]
            isOneToOne: false
            referencedRelation: "vendor_tax_slips"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_tax_slips: {
        Row: {
          amended_from: string | null
          box_totals: Json
          created_at: string
          currency: string
          id: string
          issued_at: string | null
          notes: string | null
          organization_id: string
          pdf_url: string | null
          slip_number: string | null
          slip_type: string
          status: string
          tax_year: number
          total_amount: number
          updated_at: string
          vendor_id: string
          xml_url: string | null
        }
        Insert: {
          amended_from?: string | null
          box_totals?: Json
          created_at?: string
          currency?: string
          id?: string
          issued_at?: string | null
          notes?: string | null
          organization_id: string
          pdf_url?: string | null
          slip_number?: string | null
          slip_type: string
          status?: string
          tax_year: number
          total_amount?: number
          updated_at?: string
          vendor_id: string
          xml_url?: string | null
        }
        Update: {
          amended_from?: string | null
          box_totals?: Json
          created_at?: string
          currency?: string
          id?: string
          issued_at?: string | null
          notes?: string | null
          organization_id?: string
          pdf_url?: string | null
          slip_number?: string | null
          slip_type?: string
          status?: string
          tax_year?: number
          total_amount?: number
          updated_at?: string
          vendor_id?: string
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_tax_slips_amended_from_fkey"
            columns: ["amended_from"]
            isOneToOne: false
            referencedRelation: "vendor_tax_slips"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          created_at: string
          default_currency: string | null
          default_tax_code_id: string | null
          email: string | null
          first_name: string | null
          id: string
          is_active: boolean
          is_contractor: boolean | null
          last_name: string | null
          name: string
          notes: string | null
          organization_id: string | null
          payment_terms: number | null
          phone: string | null
          postal_code: string | null
          province: string | null
          sin_last_four: string | null
          t4a_required: boolean | null
          tax_exempt: boolean
          tax_exempt_certificate_no: string | null
          tax_number: string | null
          updated_at: string
          vendor_type: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          default_currency?: string | null
          default_tax_code_id?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean
          is_contractor?: boolean | null
          last_name?: string | null
          name: string
          notes?: string | null
          organization_id?: string | null
          payment_terms?: number | null
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          sin_last_four?: string | null
          t4a_required?: boolean | null
          tax_exempt?: boolean
          tax_exempt_certificate_no?: string | null
          tax_number?: string | null
          updated_at?: string
          vendor_type?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          default_currency?: string | null
          default_tax_code_id?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean
          is_contractor?: boolean | null
          last_name?: string | null
          name?: string
          notes?: string | null
          organization_id?: string | null
          payment_terms?: number | null
          phone?: string | null
          postal_code?: string | null
          province?: string | null
          sin_last_four?: string | null
          t4a_required?: boolean | null
          tax_exempt?: boolean
          tax_exempt_certificate_no?: string | null
          tax_number?: string | null
          updated_at?: string
          vendor_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_default_tax_code_id_fkey"
            columns: ["default_tax_code_id"]
            isOneToOne: false
            referencedRelation: "tax_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      verified_bank_accounts: {
        Row: {
          account_mask: string | null
          account_subtype: string | null
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          id: string
          institution_name: string | null
          metadata: Json
          organization_id: string
          plaid_account_id: string | null
          plaid_item_id: string | null
          status: string
          updated_at: string
          verified_at: string
        }
        Insert: {
          account_mask?: string | null
          account_subtype?: string | null
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          institution_name?: string | null
          metadata?: Json
          organization_id: string
          plaid_account_id?: string | null
          plaid_item_id?: string | null
          status?: string
          updated_at?: string
          verified_at?: string
        }
        Update: {
          account_mask?: string | null
          account_subtype?: string | null
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          institution_name?: string | null
          metadata?: Json
          organization_id?: string
          plaid_account_id?: string | null
          plaid_item_id?: string | null
          status?: string
          updated_at?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verified_bank_accounts_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verified_bank_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_account_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          narration: string | null
          occurred_at: string
          organization_id: string
          provider_tx_id: string | null
          raw_payload: Json | null
          sender_account: string | null
          sender_bank: string | null
          sender_name: string | null
          status: string
          type: string
          updated_at: string
          virtual_account_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          id?: string
          narration?: string | null
          occurred_at?: string
          organization_id: string
          provider_tx_id?: string | null
          raw_payload?: Json | null
          sender_account?: string | null
          sender_bank?: string | null
          sender_name?: string | null
          status?: string
          type: string
          updated_at?: string
          virtual_account_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          narration?: string | null
          occurred_at?: string
          organization_id?: string
          provider_tx_id?: string | null
          raw_payload?: Json | null
          sender_account?: string | null
          sender_bank?: string | null
          sender_name?: string | null
          status?: string
          type?: string
          updated_at?: string
          virtual_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "virtual_account_transactions_virtual_account_id_fkey"
            columns: ["virtual_account_id"]
            isOneToOne: false
            referencedRelation: "virtual_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_accounts: {
        Row: {
          account_name: string | null
          account_number: string | null
          balance: number
          bank_name: string | null
          bvn_or_nin: string | null
          created_at: string
          created_by: string | null
          currency: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          organization_id: string
          provider: string
          provider_account_id: string | null
          raw_response: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          balance?: number
          bank_name?: string | null
          bvn_or_nin?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          organization_id: string
          provider?: string
          provider_account_id?: string | null
          raw_response?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          balance?: number
          bank_name?: string | null
          bvn_or_nin?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          organization_id?: string
          provider?: string
          provider_account_id?: string | null
          raw_response?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      voice_call_events: {
        Row: {
          event_data: Json | null
          event_type: string
          id: string
          occurred_at: string | null
          provider_event_id: string | null
          provider_id: string | null
          session_id: string
        }
        Insert: {
          event_data?: Json | null
          event_type: string
          id?: string
          occurred_at?: string | null
          provider_event_id?: string | null
          provider_id?: string | null
          session_id: string
        }
        Update: {
          event_data?: Json | null
          event_type?: string
          id?: string
          occurred_at?: string | null
          provider_event_id?: string | null
          provider_id?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_call_events_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "voice_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_call_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "voice_call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_call_rates: {
        Row: {
          billing_increment_seconds: number | null
          connection_fee: number | null
          country_code: string
          created_at: string | null
          currency: string | null
          effective_from: string
          effective_to: string | null
          id: string
          is_active: boolean | null
          provider_id: string
          rate_per_minute: number
          updated_at: string | null
        }
        Insert: {
          billing_increment_seconds?: number | null
          connection_fee?: number | null
          country_code: string
          created_at?: string | null
          currency?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          provider_id: string
          rate_per_minute: number
          updated_at?: string | null
        }
        Update: {
          billing_increment_seconds?: number | null
          connection_fee?: number | null
          country_code?: string
          created_at?: string | null
          currency?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          provider_id?: string
          rate_per_minute?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_call_rates_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "voice_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_call_sessions: {
        Row: {
          billable_seconds: number | null
          billing_increment_seconds: number | null
          bridged_at: string | null
          call_direction: string | null
          call_status: string | null
          conference_sid: string | null
          created_at: string | null
          currency: string | null
          destination_country_code: string | null
          destination_number: string
          duration_seconds: number | null
          ended_at: string | null
          estimated_cost: number | null
          exchange_rate_locked: number | null
          failover_attempts: number | null
          failure_reason: string | null
          final_cost: number | null
          id: string
          initiated_at: string | null
          leg_a_answered_at: string | null
          leg_a_call_sid: string | null
          leg_a_provider_id: string | null
          leg_b_answered_at: string | null
          leg_b_call_sid: string | null
          leg_b_provider_id: string | null
          margin_amount: number | null
          metadata: Json | null
          organization_id: string
          provider_cost: number | null
          rate_applied: number | null
          recording_enabled: boolean | null
          recording_sid: string | null
          recording_url: string | null
          source_country_code: string | null
          source_number: string
          updated_at: string | null
          user_id: string | null
          wallet_transaction_id: string | null
        }
        Insert: {
          billable_seconds?: number | null
          billing_increment_seconds?: number | null
          bridged_at?: string | null
          call_direction?: string | null
          call_status?: string | null
          conference_sid?: string | null
          created_at?: string | null
          currency?: string | null
          destination_country_code?: string | null
          destination_number: string
          duration_seconds?: number | null
          ended_at?: string | null
          estimated_cost?: number | null
          exchange_rate_locked?: number | null
          failover_attempts?: number | null
          failure_reason?: string | null
          final_cost?: number | null
          id?: string
          initiated_at?: string | null
          leg_a_answered_at?: string | null
          leg_a_call_sid?: string | null
          leg_a_provider_id?: string | null
          leg_b_answered_at?: string | null
          leg_b_call_sid?: string | null
          leg_b_provider_id?: string | null
          margin_amount?: number | null
          metadata?: Json | null
          organization_id: string
          provider_cost?: number | null
          rate_applied?: number | null
          recording_enabled?: boolean | null
          recording_sid?: string | null
          recording_url?: string | null
          source_country_code?: string | null
          source_number: string
          updated_at?: string | null
          user_id?: string | null
          wallet_transaction_id?: string | null
        }
        Update: {
          billable_seconds?: number | null
          billing_increment_seconds?: number | null
          bridged_at?: string | null
          call_direction?: string | null
          call_status?: string | null
          conference_sid?: string | null
          created_at?: string | null
          currency?: string | null
          destination_country_code?: string | null
          destination_number?: string
          duration_seconds?: number | null
          ended_at?: string | null
          estimated_cost?: number | null
          exchange_rate_locked?: number | null
          failover_attempts?: number | null
          failure_reason?: string | null
          final_cost?: number | null
          id?: string
          initiated_at?: string | null
          leg_a_answered_at?: string | null
          leg_a_call_sid?: string | null
          leg_a_provider_id?: string | null
          leg_b_answered_at?: string | null
          leg_b_call_sid?: string | null
          leg_b_provider_id?: string | null
          margin_amount?: number | null
          metadata?: Json | null
          organization_id?: string
          provider_cost?: number | null
          rate_applied?: number | null
          recording_enabled?: boolean | null
          recording_sid?: string | null
          recording_url?: string | null
          source_country_code?: string | null
          source_number?: string
          updated_at?: string | null
          user_id?: string | null
          wallet_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_call_sessions_leg_a_provider_id_fkey"
            columns: ["leg_a_provider_id"]
            isOneToOne: false
            referencedRelation: "voice_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_call_sessions_leg_b_provider_id_fkey"
            columns: ["leg_b_provider_id"]
            isOneToOne: false
            referencedRelation: "voice_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_call_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_call_sessions_wallet_transaction_id_fkey"
            columns: ["wallet_transaction_id"]
            isOneToOne: false
            referencedRelation: "voice_wallet_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_country_rates: {
        Row: {
          billing_increment_seconds: number
          country_code: string
          country_name: string
          created_at: string | null
          currency: string
          dialing_code: string
          id: string
          is_active: boolean | null
          margin_percent: number | null
          rate_per_minute: number
          updated_at: string | null
        }
        Insert: {
          billing_increment_seconds?: number
          country_code: string
          country_name: string
          created_at?: string | null
          currency?: string
          dialing_code: string
          id?: string
          is_active?: boolean | null
          margin_percent?: number | null
          rate_per_minute?: number
          updated_at?: string | null
        }
        Update: {
          billing_increment_seconds?: number
          country_code?: string
          country_name?: string
          created_at?: string | null
          currency?: string
          dialing_code?: string
          id?: string
          is_active?: boolean | null
          margin_percent?: number | null
          rate_per_minute?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      voice_provider_routes: {
        Row: {
          country_code: string
          country_name: string
          created_at: string | null
          failover_provider_id: string | null
          id: string
          is_active: boolean | null
          primary_provider_id: string | null
          region: string | null
          routing_strategy: string | null
          secondary_provider_id: string | null
          updated_at: string | null
        }
        Insert: {
          country_code: string
          country_name: string
          created_at?: string | null
          failover_provider_id?: string | null
          id?: string
          is_active?: boolean | null
          primary_provider_id?: string | null
          region?: string | null
          routing_strategy?: string | null
          secondary_provider_id?: string | null
          updated_at?: string | null
        }
        Update: {
          country_code?: string
          country_name?: string
          created_at?: string | null
          failover_provider_id?: string | null
          id?: string
          is_active?: boolean | null
          primary_provider_id?: string | null
          region?: string | null
          routing_strategy?: string | null
          secondary_provider_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_provider_routes_failover_provider_id_fkey"
            columns: ["failover_provider_id"]
            isOneToOne: false
            referencedRelation: "voice_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_provider_routes_primary_provider_id_fkey"
            columns: ["primary_provider_id"]
            isOneToOne: false
            referencedRelation: "voice_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_provider_routes_secondary_provider_id_fkey"
            columns: ["secondary_provider_id"]
            isOneToOne: false
            referencedRelation: "voice_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_providers: {
        Row: {
          api_base_url: string | null
          billing_increment_seconds: number | null
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          priority: number | null
          provider_type: string
          supports_bridging: boolean | null
          supports_recording: boolean | null
          updated_at: string | null
        }
        Insert: {
          api_base_url?: string | null
          billing_increment_seconds?: number | null
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          priority?: number | null
          provider_type: string
          supports_bridging?: boolean | null
          supports_recording?: boolean | null
          updated_at?: string | null
        }
        Update: {
          api_base_url?: string | null
          billing_increment_seconds?: number | null
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          priority?: number | null
          provider_type?: string
          supports_bridging?: boolean | null
          supports_recording?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      voice_wallet_transactions: {
        Row: {
          amount: number
          base_amount: number | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          description: string | null
          exchange_rate: number | null
          id: string
          journal_entry_id: string | null
          reference: string | null
          session_id: string | null
          status: string | null
          transaction_type: string
          wallet_id: string
        }
        Insert: {
          amount: number
          base_amount?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          exchange_rate?: number | null
          id?: string
          journal_entry_id?: string | null
          reference?: string | null
          session_id?: string | null
          status?: string | null
          transaction_type: string
          wallet_id: string
        }
        Update: {
          amount?: number
          base_amount?: number | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          description?: string | null
          exchange_rate?: number | null
          id?: string
          journal_entry_id?: string | null
          reference?: string | null
          session_id?: string | null
          status?: string | null
          transaction_type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_wallet_transactions_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "voice_wallet_transactions_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "voice_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_wallets: {
        Row: {
          auto_recharge_amount: number | null
          auto_recharge_enabled: boolean | null
          auto_recharge_trigger: number | null
          balance: number | null
          created_at: string | null
          currency: string | null
          id: string
          low_balance_threshold: number | null
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          auto_recharge_amount?: number | null
          auto_recharge_enabled?: boolean | null
          auto_recharge_trigger?: number | null
          balance?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          low_balance_threshold?: number | null
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          auto_recharge_amount?: number | null
          auto_recharge_enabled?: boolean | null
          auto_recharge_trigger?: number | null
          balance?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          low_balance_threshold?: number | null
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_wallets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_balances: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          last_synced_at: string | null
          metadata: Json | null
          organization_id: string
          provider: string
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          last_synced_at?: string | null
          metadata?: Json | null
          organization_id: string
          provider: string
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          last_synced_at?: string | null
          metadata?: Json | null
          organization_id?: string
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_balances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wht_regimes: {
        Row: {
          authority: string
          box_code: string | null
          code: string
          country_code: string
          created_at: string
          default_rate: number
          id: string
          is_active: boolean
          name: string
          notes: string | null
          organization_id: string
          slip_type: string
          threshold_cents: number
          updated_at: string
        }
        Insert: {
          authority: string
          box_code?: string | null
          code: string
          country_code: string
          created_at?: string
          default_rate?: number
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          organization_id: string
          slip_type: string
          threshold_cents?: number
          updated_at?: string
        }
        Update: {
          authority?: string
          box_code?: string | null
          code?: string
          country_code?: string
          created_at?: string
          default_rate?: number
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          organization_id?: string
          slip_type?: string
          threshold_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      wht_remittances: {
        Row: {
          created_at: string
          due_date: string
          id: string
          journal_entry_id: string | null
          notes: string | null
          organization_id: string
          period_end: string
          period_start: string
          reference_number: string | null
          regime_id: string | null
          remittance_date: string | null
          remitted_amount_cents: number
          status: string
          total_withheld_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_date: string
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          organization_id: string
          period_end: string
          period_start: string
          reference_number?: string | null
          regime_id?: string | null
          remittance_date?: string | null
          remitted_amount_cents?: number
          status?: string
          total_withheld_cents?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_date?: string
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          organization_id?: string
          period_end?: string
          period_start?: string
          reference_number?: string | null
          regime_id?: string | null
          remittance_date?: string | null
          remitted_amount_cents?: number
          status?: string
          total_withheld_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wht_remittances_regime_id_fkey"
            columns: ["regime_id"]
            isOneToOne: false
            referencedRelation: "wht_regimes"
            referencedColumns: ["id"]
          },
        ]
      }
      wht_slips: {
        Row: {
          box_amounts: Json
          created_at: string
          filed_date: string | null
          filing_reference: string | null
          id: string
          issued_date: string | null
          notes: string | null
          organization_id: string
          recipient_address: Json | null
          recipient_name: string | null
          recipient_tin_last4: string | null
          regime_id: string | null
          slip_number: string | null
          slip_type: string
          status: string
          tax_year: number
          total_paid_cents: number
          total_withheld_cents: number
          updated_at: string
          vendor_id: string
        }
        Insert: {
          box_amounts?: Json
          created_at?: string
          filed_date?: string | null
          filing_reference?: string | null
          id?: string
          issued_date?: string | null
          notes?: string | null
          organization_id: string
          recipient_address?: Json | null
          recipient_name?: string | null
          recipient_tin_last4?: string | null
          regime_id?: string | null
          slip_number?: string | null
          slip_type: string
          status?: string
          tax_year: number
          total_paid_cents?: number
          total_withheld_cents?: number
          updated_at?: string
          vendor_id: string
        }
        Update: {
          box_amounts?: Json
          created_at?: string
          filed_date?: string | null
          filing_reference?: string | null
          id?: string
          issued_date?: string | null
          notes?: string | null
          organization_id?: string
          recipient_address?: Json | null
          recipient_name?: string | null
          recipient_tin_last4?: string | null
          regime_id?: string | null
          slip_number?: string | null
          slip_type?: string
          status?: string
          tax_year?: number
          total_paid_cents?: number
          total_withheld_cents?: number
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wht_slips_regime_id_fkey"
            columns: ["regime_id"]
            isOneToOne: false
            referencedRelation: "wht_regimes"
            referencedColumns: ["id"]
          },
        ]
      }
      wht_transactions: {
        Row: {
          applied_rate: number
          created_at: string
          currency_code: string
          gross_amount_cents: number
          id: string
          journal_entry_id: string | null
          net_amount_cents: number
          notes: string | null
          organization_id: string
          regime_id: string | null
          source_id: string | null
          source_type: string
          status: string
          tax_year: number
          transaction_date: string
          updated_at: string
          vendor_id: string
          withheld_amount_cents: number
        }
        Insert: {
          applied_rate: number
          created_at?: string
          currency_code?: string
          gross_amount_cents: number
          id?: string
          journal_entry_id?: string | null
          net_amount_cents: number
          notes?: string | null
          organization_id: string
          regime_id?: string | null
          source_id?: string | null
          source_type: string
          status?: string
          tax_year: number
          transaction_date: string
          updated_at?: string
          vendor_id: string
          withheld_amount_cents: number
        }
        Update: {
          applied_rate?: number
          created_at?: string
          currency_code?: string
          gross_amount_cents?: number
          id?: string
          journal_entry_id?: string | null
          net_amount_cents?: number
          notes?: string | null
          organization_id?: string
          regime_id?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
          tax_year?: number
          transaction_date?: string
          updated_at?: string
          vendor_id?: string
          withheld_amount_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "wht_transactions_regime_id_fkey"
            columns: ["regime_id"]
            isOneToOne: false
            referencedRelation: "wht_regimes"
            referencedColumns: ["id"]
          },
        ]
      }
      wht_vendor_profiles: {
        Row: {
          created_at: string
          exempt_reason: string | null
          id: string
          is_exempt: boolean
          legal_name: string | null
          notes: string | null
          organization_id: string
          regime_id: string | null
          tax_form_expiry_date: string | null
          tax_form_received_date: string | null
          tax_form_type: string | null
          tin_last4: string | null
          tin_type: string | null
          tin_value_encrypted: string | null
          treaty_country: string | null
          treaty_rate: number | null
          updated_at: string
          vendor_id: string
          ytd_paid_cents: number
          ytd_withheld_cents: number
        }
        Insert: {
          created_at?: string
          exempt_reason?: string | null
          id?: string
          is_exempt?: boolean
          legal_name?: string | null
          notes?: string | null
          organization_id: string
          regime_id?: string | null
          tax_form_expiry_date?: string | null
          tax_form_received_date?: string | null
          tax_form_type?: string | null
          tin_last4?: string | null
          tin_type?: string | null
          tin_value_encrypted?: string | null
          treaty_country?: string | null
          treaty_rate?: number | null
          updated_at?: string
          vendor_id: string
          ytd_paid_cents?: number
          ytd_withheld_cents?: number
        }
        Update: {
          created_at?: string
          exempt_reason?: string | null
          id?: string
          is_exempt?: boolean
          legal_name?: string | null
          notes?: string | null
          organization_id?: string
          regime_id?: string | null
          tax_form_expiry_date?: string | null
          tax_form_received_date?: string | null
          tax_form_type?: string | null
          tin_last4?: string | null
          tin_type?: string | null
          tin_value_encrypted?: string | null
          treaty_country?: string | null
          treaty_rate?: number | null
          updated_at?: string
          vendor_id?: string
          ytd_paid_cents?: number
          ytd_withheld_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "wht_vendor_profiles_regime_id_fkey"
            columns: ["regime_id"]
            isOneToOne: false
            referencedRelation: "wht_regimes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      combined_tax_rates: {
        Row: {
          breakdown_json: Json | null
          combined_rate: number | null
          country_code: string | null
          gst_rate: number | null
          hst_rate: number | null
          jurisdiction_code: string | null
          jurisdiction_id: string | null
          jurisdiction_name: string | null
          pst_rate: number | null
          requires_separate_pst_accounting: boolean | null
          tax_model: string | null
        }
        Relationships: []
      }
      cra_remittance_summary: {
        Row: {
          completed_count: number | null
          last_activity_at: string | null
          last_paid_at: string | null
          organization_id: string | null
          pending_amount: number | null
          pending_count: number | null
          processing_amount: number | null
          processing_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      detailed_ledger_view: {
        Row: {
          account_code: string | null
          account_id: string | null
          account_name: string | null
          account_type: Database["public"]["Enums"]["account_type"] | null
          base_credit: number | null
          base_debit: number | null
          cost_center_code: string | null
          cost_center_id: string | null
          cost_center_name: string | null
          created_at: string | null
          created_by: string | null
          credit: number | null
          currency: string | null
          customer_id: string | null
          customer_name: string | null
          debit: number | null
          department_code: string | null
          department_id: string | null
          department_name: string | null
          entry_description: string | null
          exchange_rate: number | null
          fund_code: string | null
          fund_id: string | null
          fund_name: string | null
          journal_entry_id: string | null
          line_id: string | null
          line_memo: string | null
          location_code: string | null
          location_id: string | null
          location_name: string | null
          net_amount: number | null
          normal_balance: string | null
          organization_id: string | null
          posting_period: string | null
          project_code: string | null
          project_id: string | null
          project_name: string | null
          reference_no: string | null
          source_document_id: string | null
          source_document_type: string | null
          source_module: Database["public"]["Enums"]["journal_type"] | null
          status: Database["public"]["Enums"]["journal_entry_status"] | null
          tax_code: string | null
          tax_code_id: string | null
          tax_rate: number | null
          txn_date: string | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "funds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_tax_code_id_fkey"
            columns: ["tax_code_id"]
            isOneToOne: false
            referencedRelation: "tax_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      ng_tax_compliance_dashboard: {
        Row: {
          accrued_count: number | null
          accrued_tax: number | null
          definition_code: string | null
          definition_id: string | null
          definition_name: string | null
          due_date: string | null
          filed_unremitted_tax: number | null
          filing_frequency: string | null
          organization_id: string | null
          period_end: string | null
          period_month: string | null
          tax_category: string | null
          urgency: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ng_tax_transaction_ledger_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "ng_tax_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ng_tax_transaction_ledger_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ng_tax_ledger_summary: {
        Row: {
          definition_code: string | null
          definition_id: string | null
          definition_name: string | null
          filed_tax: number | null
          organization_id: string | null
          period_month: string | null
          remitted_tax: number | null
          tax_category: string | null
          total_tax: number | null
          total_taxable_base: number | null
          transaction_count: number | null
          unfiled_tax: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ng_tax_transaction_ledger_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "ng_tax_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ng_tax_transaction_ledger_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitation_history: {
        Row: {
          accepted_at: string | null
          email: string | null
          expires_at: string | null
          id: string | null
          invited_at: string | null
          invited_by: string | null
          invited_by_name: string | null
          organization_id: string | null
          organization_name: string | null
          role: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_public: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      v_employee_payment_methods_masked: {
        Row: {
          account_name: string | null
          account_number_last4: string | null
          account_number_masked: string | null
          bank_name: string | null
          created_at: string | null
          currency: string | null
          employee_id: string | null
          iban_masked: string | null
          id: string | null
          institution_number: string | null
          is_primary: boolean | null
          method: string | null
          organization_id: string | null
          routing_number: string | null
          swift: string | null
          transit_number: string | null
          updated_at: string | null
        }
        Insert: {
          account_name?: string | null
          account_number_last4?: string | null
          account_number_masked?: never
          bank_name?: string | null
          created_at?: string | null
          currency?: string | null
          employee_id?: string | null
          iban_masked?: never
          id?: string | null
          institution_number?: string | null
          is_primary?: boolean | null
          method?: string | null
          organization_id?: string | null
          routing_number?: string | null
          swift?: string | null
          transit_number?: string | null
          updated_at?: string | null
        }
        Update: {
          account_name?: string | null
          account_number_last4?: string | null
          account_number_masked?: never
          bank_name?: string | null
          created_at?: string | null
          currency?: string | null
          employee_id?: string | null
          iban_masked?: never
          id?: string | null
          institution_number?: string | null
          is_primary?: boolean | null
          method?: string | null
          organization_id?: string | null
          routing_number?: string | null
          swift?: string | null
          transit_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_payment_methods_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      v_je_lines_with_division: {
        Row: {
          account_id: string | null
          base_currency_credit: number | null
          base_currency_debit: number | null
          cost_center_id: string | null
          created_at: string | null
          credit: number | null
          currency: string | null
          customer_id: string | null
          debit: number | null
          department_id: string | null
          description: string | null
          effective_department_id: string | null
          entry_date: string | null
          exchange_rate: number | null
          fund_id: string | null
          id: string | null
          je_organization_id: string | null
          je_status: Database["public"]["Enums"]["journal_entry_status"] | null
          journal_entry_id: string | null
          line_order: number | null
          location_id: string | null
          project_id: string | null
          segment_id: string | null
          source_document_id: string | null
          source_document_type: string | null
          tax_code_id: string | null
          vendor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_organization_id_fkey"
            columns: ["je_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "funds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "detailed_ledger_view"
            referencedColumns: ["journal_entry_id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_tax_code_id_fkey"
            columns: ["tax_code_id"]
            isOneToOne: false
            referencedRelation: "tax_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      v_lease_liability_current_portion: {
        Row: {
          account_id: string | null
          current_portion: number | null
          lease_id: string | null
          lease_name: string | null
          lease_number: string | null
          lease_type: string | null
          long_term_portion: number | null
          organization_id: string | null
          total_remaining: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leases_lease_liability_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_net_income_by_year: {
        Row: {
          fiscal_year: number | null
          net_income: number | null
          organization_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_opening_retained_earnings: {
        Row: {
          fiscal_year: number | null
          opening_retained_earnings: number | null
          organization_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equity_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_retained_earnings_closing: {
        Row: {
          closing_retained_earnings: number | null
          fiscal_year: number | null
          organization_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equity_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_soce_aspe_comparative: {
        Row: {
          closing_balance: number | null
          contributions: number | null
          distributions: number | null
          equity_category: string | null
          fiscal_year: number | null
          net_income: number | null
          opening_balance: number | null
          organization_id: string | null
          prior_period_adjustments: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equity_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_soce_aspe_detail: {
        Row: {
          account_name: string | null
          amount: number | null
          equity_category: string | null
          fiscal_year: number | null
          movement_type: string | null
          organization_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equity_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      assert_settlement_period_open: {
        Args: { _date: string; _org: string }
        Returns: undefined
      }
      calculate_opening_retained_earnings: {
        Args: { p_fiscal_year: number; p_organization_id: string }
        Returns: number
      }
      calculate_period_net_income: {
        Args: {
          p_end_date: string
          p_organization_id: string
          p_start_date: string
        }
        Returns: number
      }
      calculate_retained_earnings_rollforward: {
        Args: {
          p_fiscal_year: number
          p_fiscal_year_end: string
          p_fiscal_year_start: string
          p_organization_id: string
        }
        Returns: {
          closing_balance: number
          dividends: number
          net_income: number
          opening_balance: number
          prior_period_adjustments: number
        }[]
      }
      calculate_retained_earnings_statement: {
        Args: {
          p_fiscal_year_end: string
          p_fiscal_year_start: string
          p_organization_id: string
        }
        Returns: {
          closing_balance: number
          dividends_declared: number
          net_income_loss: number
          opening_balance: number
          other_additions: number
          other_deductions: number
        }[]
      }
      calculate_split_taxes: {
        Args: {
          p_amount: number
          p_is_inclusive?: boolean
          p_jurisdiction_code: string
        }
        Returns: Json
      }
      calculate_total_assets: {
        Args: { p_as_of_date: string; p_organization_id: string }
        Returns: number
      }
      calculate_total_equity: {
        Args: { p_as_of_date: string; p_organization_id: string }
        Returns: number
      }
      calculate_total_liabilities: {
        Args: { p_as_of_date: string; p_organization_id: string }
        Returns: number
      }
      calculate_voice_call_cost: {
        Args: {
          p_billing_increment_seconds?: number
          p_connection_fee?: number
          p_duration_seconds: number
          p_rate_per_minute: number
        }
        Returns: {
          base_cost: number
          billable_seconds: number
          billable_units: number
          connection_fee: number
          total_cost: number
        }[]
      }
      close_fiscal_year: {
        Args: {
          p_fiscal_year: number
          p_fiscal_year_end: string
          p_fiscal_year_start: string
          p_notes?: string
          p_organization_id: string
        }
        Returns: {
          closing_entry_id: string
          fiscal_year_close_id: string
          message: string
          net_income: number
          success: boolean
        }[]
      }
      copilot_org_snapshot: { Args: { _org_id: string }; Returns: Json }
      cra_remittance_can_proceed: {
        Args: { _payment_id: string }
        Returns: boolean
      }
      cra_required_approvals: { Args: { _amount: number }; Returns: number }
      delete_organization_cascade: {
        Args: { _actor: string; _org_id: string }
        Returns: undefined
      }
      finalize_voice_billing: {
        Args: { p_final_cost: number; p_session_id: string }
        Returns: undefined
      }
      finalize_voice_billing_with_accounting: {
        Args: {
          p_create_journal_entry?: boolean
          p_duration_seconds: number
          p_session_id: string
        }
        Returns: {
          billable_seconds: number
          final_cost: number
          journal_entry_id: string
        }[]
      }
      generate_tax_filing_periods: {
        Args: {
          p_organization_id: string
          p_tax_authority_id: string
          p_year: number
        }
        Returns: number
      }
      get_account_running_balance: {
        Args: {
          p_account_id: string
          p_end_date?: string
          p_organization_id: string
          p_start_date?: string
        }
        Returns: {
          credit: number
          debit: number
          description: string
          journal_entry_id: string
          net_amount: number
          reference_no: string
          running_balance: number
          txn_date: string
        }[]
      }
      get_balance_sheet_data: {
        Args: {
          p_as_of_date: string
          p_fiscal_year_start: string
          p_organization_id: string
        }
        Returns: {
          is_balanced: boolean
          net_income: number
          total_assets: number
          total_equity: number
          total_liabilities: number
          total_liabilities_and_equity: number
          total_shareholders_equity: number
        }[]
      }
      get_best_voice_rate: {
        Args: { p_destination_country: string; p_routing_strategy?: string }
        Returns: {
          billing_increment_seconds: number
          currency: string
          provider_code: string
          provider_id: string
          rate_per_minute: number
        }[]
      }
      get_equity_breakdown: {
        Args: {
          p_as_of_date: string
          p_fiscal_year_start: string
          p_organization_id: string
        }
        Returns: {
          current_year_earnings: number
          dividends: number
          other_equity: number
          retained_earnings_opening: number
          share_capital: number
          total_equity: number
        }[]
      }
      get_exchange_rate: {
        Args: { _date?: string; _from: string; _org: string; _to: string }
        Returns: number
      }
      get_invitation_by_token: {
        Args: { p_token: string }
        Returns: {
          email: string
          expires_at: string
          id: string
          organization_id: string
          organization_name: string
          role: string
          status: string
        }[]
      }
      get_nearest_fx_rate: {
        Args: { p_date: string; p_from: string; p_org: string; p_to: string }
        Returns: number
      }
      get_org_member_details: {
        Args: { p_organization_id: string }
        Returns: {
          avatar_url: string
          created_at: string
          display_name: string
          email: string
          full_name: string
          joined_at: string
          member_id: string
          role: string
          user_id: string
        }[]
      }
      get_org_member_profiles: {
        Args: { p_organization_id: string }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          user_id: string
        }[]
      }
      get_period_revenue_total: {
        Args: { p_end_date: string; p_org_id: string; p_start_date: string }
        Returns: number
      }
      get_public_payment_link: {
        Args: { p_id: string }
        Returns: {
          amount: number
          currency: string
          description: string
          expires_at: string
          hosted_url: string
          id: string
          instant_method: string
          instant_payment: boolean
          organization_id: string
          payment_method: string
          reference: string
          status: string
        }[]
      }
      get_retained_earnings_balance: {
        Args: { p_as_of_date: string; p_organization_id: string }
        Returns: number
      }
      get_retained_earnings_rollforward_series: {
        Args: {
          p_end_year?: number
          p_organization_id: string
          p_start_year?: number
        }
        Returns: {
          closing_re: number
          dividends: number
          fiscal_year: number
          net_income: number
          opening_re: number
        }[]
      }
      get_soce_aspe_data: {
        Args: {
          p_end_year: number
          p_organization_id: string
          p_start_year: number
        }
        Returns: {
          closing_balance: number
          contributions: number
          distributions: number
          equity_category: string
          fiscal_year: number
          net_income: number
          opening_balance: number
          prior_period_adjustments: number
        }[]
      }
      get_tax_movements_by_code: {
        Args: { p_end_date: string; p_org_id: string; p_start_date: string }
        Returns: {
          account_code: string
          account_name: string
          authority_id: string
          authority_name: string
          code: string
          gl_account_id: string
          is_recoverable: boolean
          jurisdiction: string
          name: string
          rate: number
          side: string
          tax_amount: number
          tax_code_id: string
          tax_type: string
          taxable_amount: number
        }[]
      }
      get_unclosed_fiscal_years: {
        Args: { p_organization_id: string }
        Returns: {
          fiscal_year: number
          fiscal_year_end: string
          fiscal_year_start: string
          is_closed: boolean
          net_income: number
        }[]
      }
      get_user_org_permissions: {
        Args: { p_organization_id: string; p_user_id: string }
        Returns: {
          category: string
          description: string
          permission_code: string
        }[]
      }
      has_division_access: {
        Args: { _department_id: string; _level?: string; _user_id: string }
        Returns: boolean
      }
      has_module_access: {
        Args: {
          p_module_code: Database["public"]["Enums"]["module_type"]
          p_organization_id: string
        }
        Returns: boolean
      }
      has_org_permission: {
        Args: {
          p_organization_id: string
          p_permission_code: string
          p_user_id: string
        }
        Returns: boolean
      }
      has_payment_approval_role: {
        Args: {
          _org: string
          _role: Database["public"]["Enums"]["payment_approval_role"]
          _user: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_treasury_delegation: {
        Args: { _capability: string; _org_id: string; _user_id: string }
        Returns: boolean
      }
      integrity_check: {
        Args: { p_organization_id: string }
        Returns: {
          check_type: string
          message: string
          payload: Json
          severity: string
        }[]
      }
      is_firm_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_org_admin_or_owner: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      lock_tax_filing_period: {
        Args: { p_filing_period_id: string }
        Returns: string
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_type?: string
          p_new_values?: Json
          p_old_values?: Json
          p_organization_id: string
        }
        Returns: string
      }
      next_ap_batch_number: { Args: { p_org: string }; Returns: string }
      next_payment_link_reference: { Args: { p_org: string }; Returns: string }
      next_tax_payment_reference: { Args: { p_org: string }; Returns: string }
      ng_generate_filing: {
        Args: {
          p_definition_id: string
          p_form_code?: string
          p_organization_id: string
          p_period_end: string
          p_period_start: string
        }
        Returns: string
      }
      ng_get_reconciliation: {
        Args: {
          p_organization_id: string
          p_period_end: string
          p_period_start: string
        }
        Returns: {
          accrued_tax: number
          definition_code: string
          definition_id: string
          filed_tax: number
          filed_variance: number
          period_month: string
          remit_variance: number
          remitted_tax: number
        }[]
      }
      ng_mark_filing_acknowledged: {
        Args: { p_ack_reference?: string; p_filing_id: string }
        Returns: undefined
      }
      ng_mark_filing_rejected: {
        Args: { p_filing_id: string; p_reason: string }
        Returns: undefined
      }
      ng_mark_remittance_paid: {
        Args: {
          _bank_account_id?: string
          _confirmation_reference?: string
          _journal_entry_id?: string
          _remittance_id: string
        }
        Returns: undefined
      }
      ng_post_remittance: {
        Args: {
          p_bank_account_id?: string
          p_filing_id: string
          p_journal_entry_id?: string
          p_payment_date: string
          p_reference?: string
        }
        Returns: string
      }
      ng_submit_filing: {
        Args: { p_confirmation_reference?: string; p_filing_id: string }
        Returns: undefined
      }
      normalize_phone_e164: { Args: { phone: string }; Returns: string }
      populate_equity_movements: {
        Args: { p_fiscal_year: number; p_organization_id: string }
        Returns: undefined
      }
      rebuild_lease_amortization_schedule: {
        Args: { p_lease_id: string }
        Returns: Json
      }
      recalculate_account_balance: {
        Args: { p_account_id: string }
        Returns: number
      }
      recalculate_all_account_balances: {
        Args: { p_organization_id?: string }
        Returns: {
          account_code: string
          account_id: string
          account_name: string
          difference: number
          new_balance: number
          old_balance: number
        }[]
      }
      reclassify_lease_bank_postings: {
        Args: { p_clearing_account_id: string; p_lease_id: string }
        Returns: Json
      }
      recompute_pay_stub_ytd: { Args: { p_org_id: string }; Returns: number }
      record_payment_decision: {
        Args: {
          p_comment?: string
          p_decision: string
          p_entity_id: string
          p_entity_type: string
          p_step: string
        }
        Returns: Json
      }
      record_reserve_movement: {
        Args: {
          _delta: number
          _journal_entry_id?: string
          _org: string
          _reason?: string
          _reserve_id: string
          _source?: string
        }
        Returns: string
      }
      record_retained_earnings_rollforward: {
        Args: {
          p_fiscal_year: number
          p_fiscal_year_close_id?: string
          p_fiscal_year_end: string
          p_fiscal_year_start: string
          p_organization_id: string
        }
        Returns: string
      }
      refresh_processor_metrics_daily: {
        Args: { _from: string; _org: string; _to: string }
        Returns: number
      }
      refresh_settlement_aging: { Args: { _org?: string }; Returns: number }
      relink_organization_tax_codes: {
        Args: { _org_id: string }
        Returns: number
      }
      reserve_voice_wallet: {
        Args: {
          p_amount: number
          p_currency?: string
          p_organization_id: string
          p_session_id: string
        }
        Returns: string
      }
      resolve_communication_identity: {
        Args: {
          p_department_id?: string
          p_organization_id: string
          p_user_id?: string
        }
        Returns: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          department_id: string | null
          display_name: string | null
          email: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          legal_name: string | null
          logo_position: string | null
          logo_url: string | null
          organization_id: string
          phone: string | null
          postal_code: string | null
          priority: number | null
          profile_image_url: string | null
          province: string | null
          signature_html: string | null
          signature_image_url: string | null
          signature_plain_text: string | null
          tagline: string | null
          updated_at: string | null
          updated_by: string | null
          user_id: string | null
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "communication_identity"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_tax_gl_account: {
        Args: { _account_type: string; _org_id: string; _patterns: string[] }
        Returns: string
      }
      rollback_employee_import: {
        Args: { _batch_id: string; _reason: string }
        Returns: undefined
      }
      run_integrity_scan: {
        Args: { p_organization_id: string }
        Returns: {
          check_type: string
          detected_at: string
          id: string
          message: string
          organization_id: string
          payload: Json
          resolved_at: string | null
          resolved_by: string | null
          severity: string
        }[]
        SetofOptions: {
          from: "*"
          to: "integrity_findings"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      safe_recalculate_balances: {
        Args: { p_organization_id: string }
        Returns: {
          corrected_count: number
          total_drift: number
        }[]
      }
      seed_organization_tax_codes: {
        Args: { _org_id: string }
        Returns: number
      }
      settlement_cashflow_projection: {
        Args: { _horizon_days?: number; _org: string }
        Returns: {
          currency: string
          expected_date: string
          expected_inflow: number
          settlement_count: number
        }[]
      }
      subledger_reconciliation: {
        Args: { p_organization_id: string }
        Returns: {
          difference: number
          gl_balance: number
          reference_id: string
          reference_label: string
          subledger: string
          subledger_balance: number
        }[]
      }
      sync_all_organizations_localization: {
        Args: never
        Returns: {
          organization_id: string
          organization_name: string
          sync_result: Json
        }[]
      }
      sync_organization_localization: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      topup_voice_wallet_with_accounting: {
        Args: {
          p_amount: number
          p_currency?: string
          p_organization_id: string
          p_payment_account_id?: string
          p_user_id?: string
        }
        Returns: {
          journal_entry_id: string
          new_balance: number
          transaction_id: string
          wallet_id: string
        }[]
      }
      unlock_tax_filing_period: {
        Args: { p_filing_period_id: string; p_reason: string }
        Returns: boolean
      }
      user_can_access_division: {
        Args: { _dept: string; _user: string }
        Returns: boolean
      }
      validate_balance_sheet_equation: {
        Args: {
          p_as_of_date: string
          p_fiscal_year_start: string
          p_organization_id: string
        }
        Returns: {
          current_year_earnings: number
          difference: number
          is_balanced: boolean
          total_assets: number
          total_equity: number
          total_liabilities: number
          total_liabilities_equity: number
        }[]
      }
      validate_journal_entry_balance: {
        Args: { p_journal_entry_id: string }
        Returns: {
          difference: number
          is_balanced: boolean
          total_credits: number
          total_debits: number
        }[]
      }
      validate_retained_earnings_continuity: {
        Args: { p_organization_id: string }
        Returns: {
          current_opening: number
          fiscal_year: number
          gap: number
          is_continuous: boolean
          prior_closing: number
        }[]
      }
      validate_trial_balance: {
        Args: { p_as_of_date?: string; p_organization_id: string }
        Returns: {
          account_count: number
          checked_at: string
          difference: number
          is_balanced: boolean
          total_credits: number
          total_debits: number
        }[]
      }
      verify_otp_code: {
        Args: { _code: string; _id: string }
        Returns: boolean
      }
      verify_trial_balance_integrity: {
        Args: { p_as_of_date?: string; p_organization_id: string }
        Returns: {
          account_count: number
          difference: number
          is_balanced: boolean
          total_credits: number
          total_debits: number
        }[]
      }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "income" | "expense"
      app_role: "admin" | "moderator" | "subscriber" | "user" | "super_admin"
      approval_method: "manager" | "hr" | "auto"
      billing_type: "fixed" | "hourly" | "retainer" | "hybrid"
      client_risk_rating: "low" | "medium" | "high"
      client_status: "draft" | "active" | "inactive" | "archived"
      contact_source: "manual" | "customer" | "vendor" | "employee"
      donation_status: "draft" | "confirmed" | "cancelled" | "refunded"
      donation_type:
        | "cash"
        | "cheque"
        | "credit_card"
        | "e_transfer"
        | "securities"
        | "in_kind"
        | "payroll_deduction"
        | "wire_transfer"
      donor_type:
        | "individual"
        | "corporation"
        | "foundation"
        | "government"
        | "anonymous"
      employee_status: "active" | "on_leave" | "terminated" | "onboarding"
      employment_type: "full_time" | "part_time" | "contract" | "temporary"
      engagement_status:
        | "draft"
        | "active"
        | "on_hold"
        | "completed"
        | "cancelled"
      equity_type:
        | "share_capital"
        | "retained_earnings"
        | "current_earnings"
        | "dividends"
        | "reserves"
        | "other_equity"
      exec_statement_type:
        | "balance_sheet"
        | "income_statement"
        | "cash_flow"
        | "changes_in_equity"
        | "compilation_report"
      fund_type: "unrestricted" | "restricted" | "endowment" | "designated"
      journal_entry_status: "draft" | "posted" | "reversed"
      journal_type:
        | "manual"
        | "sales"
        | "purchase"
        | "payroll"
        | "bank"
        | "adjustment"
        | "depreciation"
      message_channel: "sms" | "whatsapp" | "email" | "in_app"
      message_direction: "inbound" | "outbound"
      message_status: "pending" | "sent" | "delivered" | "failed" | "received"
      module_type:
        | "general_ledger"
        | "accounts_payable"
        | "accounts_receivable"
        | "payroll"
        | "banking"
        | "fixed_assets"
        | "budgeting"
        | "practice_management"
        | "donations"
        | "inventory"
        | "reporting"
        | "docsign"
        | "communication"
        | "accountant_dashboard"
        | "treasury"
        | "leases"
      onboarding_status: "pending" | "in_progress" | "completed" | "skipped"
      paper_size: "letter" | "a4" | "legal" | "a3"
      pay_frequency: "weekly" | "bi_weekly" | "semi_monthly" | "monthly"
      pay_run_status: "draft" | "processing" | "approved" | "paid" | "cancelled"
      payment_approval_role: "preparer" | "reviewer" | "approver"
      pledge_status:
        | "pending"
        | "partially_fulfilled"
        | "fulfilled"
        | "cancelled"
        | "written_off"
      pm_invoice_status: "draft" | "sent" | "paid" | "overdue" | "cancelled"
      pm_staff_role:
        | "partner"
        | "manager"
        | "senior"
        | "staff"
        | "intern"
        | "contractor"
      print_action_type: "print" | "pdf_generate" | "pdf_download" | "preview"
      print_document_type:
        | "balance_sheet"
        | "income_statement"
        | "cash_flow"
        | "trial_balance"
        | "statement_equity"
        | "general_ledger"
        | "sub_ledger"
        | "detailed_ledger"
        | "invoice"
        | "credit_note"
        | "receipt"
        | "payment"
        | "bill"
        | "bank_reconciliation"
        | "credit_card_reconciliation"
        | "pay_stub"
        | "pay_summary"
        | "t4"
        | "w2"
        | "roe"
        | "tax_filing"
        | "gst_hst_return"
        | "vat_return"
        | "paye_return"
        | "audit_report"
        | "compilation_report"
        | "signed_document"
        | "custom"
      processor_api_mode: "live" | "test"
      processor_api_provider:
        | "stripe"
        | "adyen"
        | "square"
        | "paypal"
        | "braintree"
        | "manual"
      processor_api_sync_status: "active" | "paused" | "error" | "disconnected"
      province_code:
        | "AB"
        | "BC"
        | "MB"
        | "NB"
        | "NL"
        | "NS"
        | "NT"
        | "NU"
        | "ON"
        | "PE"
        | "QC"
        | "SK"
        | "YT"
      receipt_status: "draft" | "issued" | "cancelled" | "replaced"
      roe_reason:
        | "A"
        | "B"
        | "D"
        | "E"
        | "F"
        | "G"
        | "H"
        | "J"
        | "K"
        | "M"
        | "N"
        | "P"
        | "Z"
      settlement_dispute_kind:
        | "chargeback"
        | "inquiry"
        | "retrieval"
        | "refund_dispute"
      settlement_dispute_status:
        | "needs_response"
        | "under_review"
        | "won"
        | "lost"
        | "withdrawn"
        | "expired"
      settlement_match_type:
        | "exact_ref"
        | "exact_amount_date"
        | "aggregate"
        | "split"
        | "fuzzy"
        | "manual"
      settlement_processor:
        | "stripe"
        | "adyen"
        | "paysafe"
        | "square"
        | "paypal"
        | "generic"
      settlement_reserve_type: "rolling" | "fixed" | "ad_hoc"
      settlement_source:
        | "stripe_api"
        | "adyen_api"
        | "paysafe_api"
        | "csv"
        | "manual"
      settlement_status:
        | "pending"
        | "matched"
        | "partially_matched"
        | "exception"
        | "written_off"
      subscription_status:
        | "active"
        | "canceled"
        | "past_due"
        | "trialing"
        | "incomplete"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status:
        | "pending"
        | "in_progress"
        | "review"
        | "completed"
        | "cancelled"
      tax_model_type: "GST_ONLY" | "GST_PST" | "HST"
      template_status: "draft" | "active" | "archived"
      time_entry_status: "draft" | "submitted" | "approved" | "billed"
      timesheet_entry_type: "daily" | "weekly" | "project"
      timesheet_status:
        | "draft"
        | "submitted"
        | "approved"
        | "rejected"
        | "processed"
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
      account_type: ["asset", "liability", "equity", "income", "expense"],
      app_role: ["admin", "moderator", "subscriber", "user", "super_admin"],
      approval_method: ["manager", "hr", "auto"],
      billing_type: ["fixed", "hourly", "retainer", "hybrid"],
      client_risk_rating: ["low", "medium", "high"],
      client_status: ["draft", "active", "inactive", "archived"],
      contact_source: ["manual", "customer", "vendor", "employee"],
      donation_status: ["draft", "confirmed", "cancelled", "refunded"],
      donation_type: [
        "cash",
        "cheque",
        "credit_card",
        "e_transfer",
        "securities",
        "in_kind",
        "payroll_deduction",
        "wire_transfer",
      ],
      donor_type: [
        "individual",
        "corporation",
        "foundation",
        "government",
        "anonymous",
      ],
      employee_status: ["active", "on_leave", "terminated", "onboarding"],
      employment_type: ["full_time", "part_time", "contract", "temporary"],
      engagement_status: [
        "draft",
        "active",
        "on_hold",
        "completed",
        "cancelled",
      ],
      equity_type: [
        "share_capital",
        "retained_earnings",
        "current_earnings",
        "dividends",
        "reserves",
        "other_equity",
      ],
      exec_statement_type: [
        "balance_sheet",
        "income_statement",
        "cash_flow",
        "changes_in_equity",
        "compilation_report",
      ],
      fund_type: ["unrestricted", "restricted", "endowment", "designated"],
      journal_entry_status: ["draft", "posted", "reversed"],
      journal_type: [
        "manual",
        "sales",
        "purchase",
        "payroll",
        "bank",
        "adjustment",
        "depreciation",
      ],
      message_channel: ["sms", "whatsapp", "email", "in_app"],
      message_direction: ["inbound", "outbound"],
      message_status: ["pending", "sent", "delivered", "failed", "received"],
      module_type: [
        "general_ledger",
        "accounts_payable",
        "accounts_receivable",
        "payroll",
        "banking",
        "fixed_assets",
        "budgeting",
        "practice_management",
        "donations",
        "inventory",
        "reporting",
        "docsign",
        "communication",
        "accountant_dashboard",
        "treasury",
        "leases",
      ],
      onboarding_status: ["pending", "in_progress", "completed", "skipped"],
      paper_size: ["letter", "a4", "legal", "a3"],
      pay_frequency: ["weekly", "bi_weekly", "semi_monthly", "monthly"],
      pay_run_status: ["draft", "processing", "approved", "paid", "cancelled"],
      payment_approval_role: ["preparer", "reviewer", "approver"],
      pledge_status: [
        "pending",
        "partially_fulfilled",
        "fulfilled",
        "cancelled",
        "written_off",
      ],
      pm_invoice_status: ["draft", "sent", "paid", "overdue", "cancelled"],
      pm_staff_role: [
        "partner",
        "manager",
        "senior",
        "staff",
        "intern",
        "contractor",
      ],
      print_action_type: ["print", "pdf_generate", "pdf_download", "preview"],
      print_document_type: [
        "balance_sheet",
        "income_statement",
        "cash_flow",
        "trial_balance",
        "statement_equity",
        "general_ledger",
        "sub_ledger",
        "detailed_ledger",
        "invoice",
        "credit_note",
        "receipt",
        "payment",
        "bill",
        "bank_reconciliation",
        "credit_card_reconciliation",
        "pay_stub",
        "pay_summary",
        "t4",
        "w2",
        "roe",
        "tax_filing",
        "gst_hst_return",
        "vat_return",
        "paye_return",
        "audit_report",
        "compilation_report",
        "signed_document",
        "custom",
      ],
      processor_api_mode: ["live", "test"],
      processor_api_provider: [
        "stripe",
        "adyen",
        "square",
        "paypal",
        "braintree",
        "manual",
      ],
      processor_api_sync_status: ["active", "paused", "error", "disconnected"],
      province_code: [
        "AB",
        "BC",
        "MB",
        "NB",
        "NL",
        "NS",
        "NT",
        "NU",
        "ON",
        "PE",
        "QC",
        "SK",
        "YT",
      ],
      receipt_status: ["draft", "issued", "cancelled", "replaced"],
      roe_reason: [
        "A",
        "B",
        "D",
        "E",
        "F",
        "G",
        "H",
        "J",
        "K",
        "M",
        "N",
        "P",
        "Z",
      ],
      settlement_dispute_kind: [
        "chargeback",
        "inquiry",
        "retrieval",
        "refund_dispute",
      ],
      settlement_dispute_status: [
        "needs_response",
        "under_review",
        "won",
        "lost",
        "withdrawn",
        "expired",
      ],
      settlement_match_type: [
        "exact_ref",
        "exact_amount_date",
        "aggregate",
        "split",
        "fuzzy",
        "manual",
      ],
      settlement_processor: [
        "stripe",
        "adyen",
        "paysafe",
        "square",
        "paypal",
        "generic",
      ],
      settlement_reserve_type: ["rolling", "fixed", "ad_hoc"],
      settlement_source: [
        "stripe_api",
        "adyen_api",
        "paysafe_api",
        "csv",
        "manual",
      ],
      settlement_status: [
        "pending",
        "matched",
        "partially_matched",
        "exception",
        "written_off",
      ],
      subscription_status: [
        "active",
        "canceled",
        "past_due",
        "trialing",
        "incomplete",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: [
        "pending",
        "in_progress",
        "review",
        "completed",
        "cancelled",
      ],
      tax_model_type: ["GST_ONLY", "GST_PST", "HST"],
      template_status: ["draft", "active", "archived"],
      time_entry_status: ["draft", "submitted", "approved", "billed"],
      timesheet_entry_type: ["daily", "weekly", "project"],
      timesheet_status: [
        "draft",
        "submitted",
        "approved",
        "rejected",
        "processed",
      ],
    },
  },
} as const
