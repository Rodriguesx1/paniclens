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
      analysis_results: {
        Row: {
          bench_notes: string | null
          case_id: string
          confidence_label: Database["public"]["Enums"]["confidence_label"]
          confidence_score: number
          created_at: string
          engine_version: string
          executive_summary: string
          full_payload: Json
          id: string
          likely_board_repair_chance: number
          likely_repair_tier: Database["public"]["Enums"]["repair_tier"]
          likely_simple_swap_chance: number
          org_id: string
          panic_log_id: string
          parsed_log_id: string
          primary_category: Database["public"]["Enums"]["diagnostic_category"]
          probable_subsystem: string | null
          recommended_test_sequence: Json
          risk_of_misdiagnosis: number
          ruleset_version: string
          severity: Database["public"]["Enums"]["severity_level"]
          suspected_components: Json
          technical_alerts: Json
        }
        Insert: {
          bench_notes?: string | null
          case_id: string
          confidence_label: Database["public"]["Enums"]["confidence_label"]
          confidence_score: number
          created_at?: string
          engine_version: string
          executive_summary: string
          full_payload?: Json
          id?: string
          likely_board_repair_chance: number
          likely_repair_tier: Database["public"]["Enums"]["repair_tier"]
          likely_simple_swap_chance: number
          org_id: string
          panic_log_id: string
          parsed_log_id: string
          primary_category: Database["public"]["Enums"]["diagnostic_category"]
          probable_subsystem?: string | null
          recommended_test_sequence?: Json
          risk_of_misdiagnosis: number
          ruleset_version: string
          severity: Database["public"]["Enums"]["severity_level"]
          suspected_components?: Json
          technical_alerts?: Json
        }
        Update: {
          bench_notes?: string | null
          case_id?: string
          confidence_label?: Database["public"]["Enums"]["confidence_label"]
          confidence_score?: number
          created_at?: string
          engine_version?: string
          executive_summary?: string
          full_payload?: Json
          id?: string
          likely_board_repair_chance?: number
          likely_repair_tier?: Database["public"]["Enums"]["repair_tier"]
          likely_simple_swap_chance?: number
          org_id?: string
          panic_log_id?: string
          parsed_log_id?: string
          primary_category?: Database["public"]["Enums"]["diagnostic_category"]
          probable_subsystem?: string | null
          recommended_test_sequence?: Json
          risk_of_misdiagnosis?: number
          ruleset_version?: string
          severity?: Database["public"]["Enums"]["severity_level"]
          suspected_components?: Json
          technical_alerts?: Json
        }
        Relationships: [
          {
            foreignKeyName: "analysis_results_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_results_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_results_panic_log_id_fkey"
            columns: ["panic_log_id"]
            isOneToOne: false
            referencedRelation: "panic_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_results_parsed_log_id_fkey"
            columns: ["parsed_log_id"]
            isOneToOne: false
            referencedRelation: "parsed_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          org_id: string | null
          payload: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          org_id?: string | null
          payload?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          org_id?: string | null
          payload?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          created_at: string
          customer_id: string | null
          device_id: string | null
          estimated_cost: number | null
          final_cost: number | null
          id: string
          initial_notes: string | null
          org_id: string
          outcome: string | null
          perceived_symptoms: string | null
          reported_defect: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["case_status"]
          technician_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          device_id?: string | null
          estimated_cost?: number | null
          final_cost?: number | null
          id?: string
          initial_notes?: string | null
          org_id: string
          outcome?: string | null
          perceived_symptoms?: string | null
          reported_defect?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          technician_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          device_id?: string | null
          estimated_cost?: number | null
          final_cost?: number | null
          id?: string
          initial_notes?: string | null
          org_id?: string
          outcome?: string | null
          perceived_symptoms?: string | null
          reported_defect?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          technician_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          org_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          commercial_model: string | null
          created_at: string
          customer_id: string | null
          id: string
          imei: string | null
          ios_version: string | null
          org_id: string
          serial: string | null
          technical_identifier: string | null
          updated_at: string
        }
        Insert: {
          commercial_model?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          imei?: string | null
          ios_version?: string | null
          org_id: string
          serial?: string | null
          technical_identifier?: string | null
          updated_at?: string
        }
        Update: {
          commercial_model?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          imei?: string | null
          ios_version?: string | null
          org_id?: string
          serial?: string | null
          technical_identifier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_evidences: {
        Row: {
          analysis_id: string
          category: Database["public"]["Enums"]["diagnostic_category"]
          context: string | null
          created_at: string
          evidence_key: string
          id: string
          is_conflicting: boolean
          matched_text: string
          org_id: string
          weight: number
        }
        Insert: {
          analysis_id: string
          category: Database["public"]["Enums"]["diagnostic_category"]
          context?: string | null
          created_at?: string
          evidence_key: string
          id?: string
          is_conflicting?: boolean
          matched_text: string
          org_id: string
          weight?: number
        }
        Update: {
          analysis_id?: string
          category?: Database["public"]["Enums"]["diagnostic_category"]
          context?: string | null
          created_at?: string
          evidence_key?: string
          id?: string
          is_conflicting?: boolean
          matched_text?: string
          org_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_evidences_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analysis_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_evidences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_hypotheses: {
        Row: {
          analysis_id: string
          category: Database["public"]["Enums"]["diagnostic_category"]
          confidence_score: number
          created_at: string
          explanation: string
          id: string
          is_primary: boolean
          org_id: string
          rank: number
          rule_id: string
          rule_version: string
          suspected_components: Json
          title: string
        }
        Insert: {
          analysis_id: string
          category: Database["public"]["Enums"]["diagnostic_category"]
          confidence_score: number
          created_at?: string
          explanation: string
          id?: string
          is_primary?: boolean
          org_id: string
          rank?: number
          rule_id: string
          rule_version: string
          suspected_components?: Json
          title: string
        }
        Update: {
          analysis_id?: string
          category?: Database["public"]["Enums"]["diagnostic_category"]
          confidence_score?: number
          created_at?: string
          explanation?: string
          id?: string
          is_primary?: boolean
          org_id?: string
          rank?: number
          rule_id?: string
          rule_version?: string
          suspected_components?: Json
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_hypotheses_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analysis_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_hypotheses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_articles: {
        Row: {
          affected_models: Json
          author: string | null
          category: Database["public"]["Enums"]["diagnostic_category"]
          content_md: string
          created_at: string
          id: string
          key_symptoms: Json
          keywords: Json
          recommended_tests: Json
          related_components: Json
          slug: string
          status: string
          summary: string
          title: string
          typical_severity: Database["public"]["Enums"]["severity_level"] | null
          updated_at: string
          version: number
        }
        Insert: {
          affected_models?: Json
          author?: string | null
          category: Database["public"]["Enums"]["diagnostic_category"]
          content_md: string
          created_at?: string
          id?: string
          key_symptoms?: Json
          keywords?: Json
          recommended_tests?: Json
          related_components?: Json
          slug: string
          status?: string
          summary: string
          title: string
          typical_severity?:
            | Database["public"]["Enums"]["severity_level"]
            | null
          updated_at?: string
          version?: number
        }
        Update: {
          affected_models?: Json
          author?: string | null
          category?: Database["public"]["Enums"]["diagnostic_category"]
          content_md?: string
          created_at?: string
          id?: string
          key_symptoms?: Json
          keywords?: Json
          recommended_tests?: Json
          related_components?: Json
          slug?: string
          status?: string
          summary?: string
          title?: string
          typical_severity?:
            | Database["public"]["Enums"]["severity_level"]
            | null
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      memberships: {
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
            foreignKeyName: "memberships_org_id_fkey"
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
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      panic_logs: {
        Row: {
          byte_size: number | null
          case_id: string
          created_at: string
          filename: string | null
          id: string
          mime_type: string | null
          org_id: string
          raw_content: string
          source: string
          storage_path: string | null
          uploaded_by: string | null
        }
        Insert: {
          byte_size?: number | null
          case_id: string
          created_at?: string
          filename?: string | null
          id?: string
          mime_type?: string | null
          org_id: string
          raw_content: string
          source?: string
          storage_path?: string | null
          uploaded_by?: string | null
        }
        Update: {
          byte_size?: number | null
          case_id?: string
          created_at?: string
          filename?: string | null
          id?: string
          mime_type?: string | null
          org_id?: string
          raw_content?: string
          source?: string
          storage_path?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "panic_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "panic_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      parsed_logs: {
        Row: {
          created_at: string
          detected_categories: Json
          id: string
          metadata: Json
          org_id: string
          panic_log_id: string
          parser_version: string
          raw_evidences: Json
        }
        Insert: {
          created_at?: string
          detected_categories?: Json
          id?: string
          metadata?: Json
          org_id: string
          panic_log_id: string
          parser_version: string
          raw_evidences?: Json
        }
        Update: {
          created_at?: string
          detected_categories?: Json
          id?: string
          metadata?: Json
          org_id?: string
          panic_log_id?: string
          parser_version?: string
          raw_evidences?: Json
        }
        Relationships: [
          {
            foreignKeyName: "parsed_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parsed_logs_panic_log_id_fkey"
            columns: ["panic_log_id"]
            isOneToOne: false
            referencedRelation: "panic_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          default_org_id: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_org_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_org_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_org_id_fkey"
            columns: ["default_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_suggestions: {
        Row: {
          action_title: string
          action_type: string
          analysis_id: string
          created_at: string
          difficulty: string
          estimated_cost: string | null
          estimated_time: string | null
          expected_resolution_chance: number
          id: string
          org_id: string
          priority: number
          technical_risk: string
          when_to_escalate: string | null
          why_this_action: string
        }
        Insert: {
          action_title: string
          action_type: string
          analysis_id: string
          created_at?: string
          difficulty: string
          estimated_cost?: string | null
          estimated_time?: string | null
          expected_resolution_chance: number
          id?: string
          org_id: string
          priority?: number
          technical_risk: string
          when_to_escalate?: string | null
          why_this_action: string
        }
        Update: {
          action_title?: string
          action_type?: string
          analysis_id?: string
          created_at?: string
          difficulty?: string
          estimated_cost?: string | null
          estimated_time?: string | null
          expected_resolution_chance?: number
          id?: string
          org_id?: string
          priority?: number
          technical_risk?: string
          when_to_escalate?: string | null
          why_this_action?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_suggestions_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analysis_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_suggestions_org_id_fkey"
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
      has_role_in_org: {
        Args: {
          _org: string
          _role: Database["public"]["Enums"]["app_role"]
          _user: string
        }
        Returns: boolean
      }
      is_member_of: { Args: { _org: string; _user: string }; Returns: boolean }
      is_super_admin: { Args: { _user: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "org_admin"
        | "premium_technician"
        | "technician"
      case_status:
        | "open"
        | "analyzed"
        | "in_repair"
        | "resolved"
        | "escalated"
        | "closed"
      confidence_label: "low" | "moderate" | "high" | "very_high"
      diagnostic_category:
        | "thermal"
        | "sensors"
        | "watchdog"
        | "battery"
        | "charging"
        | "dock_flex"
        | "front_flex"
        | "proximity"
        | "face_id"
        | "camera"
        | "audio"
        | "codec"
        | "baseband"
        | "modem"
        | "nand"
        | "storage"
        | "power"
        | "rail"
        | "i2c"
        | "cpu_memory"
        | "peripheral_communication"
        | "unknown"
      repair_tier:
        | "simple_swap"
        | "peripheral_diagnosis"
        | "connector_or_line_check"
        | "advanced_board_diagnosis"
        | "high_risk_board_repair"
      severity_level: "low" | "moderate" | "high" | "critical"
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
      app_role: [
        "super_admin",
        "org_admin",
        "premium_technician",
        "technician",
      ],
      case_status: [
        "open",
        "analyzed",
        "in_repair",
        "resolved",
        "escalated",
        "closed",
      ],
      confidence_label: ["low", "moderate", "high", "very_high"],
      diagnostic_category: [
        "thermal",
        "sensors",
        "watchdog",
        "battery",
        "charging",
        "dock_flex",
        "front_flex",
        "proximity",
        "face_id",
        "camera",
        "audio",
        "codec",
        "baseband",
        "modem",
        "nand",
        "storage",
        "power",
        "rail",
        "i2c",
        "cpu_memory",
        "peripheral_communication",
        "unknown",
      ],
      repair_tier: [
        "simple_swap",
        "peripheral_diagnosis",
        "connector_or_line_check",
        "advanced_board_diagnosis",
        "high_risk_board_repair",
      ],
      severity_level: ["low", "moderate", "high", "critical"],
    },
  },
} as const
