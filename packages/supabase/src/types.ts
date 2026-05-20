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
      account_currencies: {
        Row: {
          account_id: string
          created_at: string
          currency_code: string
          id: string
          initial_balance: number
          initial_balance_date: string
          is_active: boolean
        }
        Insert: {
          account_id: string
          created_at?: string
          currency_code: string
          id?: string
          initial_balance?: number
          initial_balance_date?: string
          is_active?: boolean
        }
        Update: {
          account_id?: string
          created_at?: string
          currency_code?: string
          id?: string
          initial_balance?: number
          initial_balance_date?: string
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "account_currencies_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_currencies_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      accounts: {
        Row: {
          created_at: string
          credit_limit: number | null
          id: string
          institution_id: string | null
          is_active: boolean
          name: string
          network_id: string | null
          other_network_name: string | null
          type: Database["public"]["Enums"]["account_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          credit_limit?: number | null
          id?: string
          institution_id?: string | null
          is_active?: boolean
          name: string
          network_id?: string | null
          other_network_name?: string | null
          type: Database["public"]["Enums"]["account_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          credit_limit?: number | null
          id?: string
          institution_id?: string | null
          is_active?: boolean
          name?: string
          network_id?: string | null
          other_network_name?: string | null
          type?: Database["public"]["Enums"]["account_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "card_networks"
            referencedColumns: ["id"]
          },
        ]
      }
      card_networks: {
        Row: {
          brand_color: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          brand_color?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          brand_color?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      card_periods: {
        Row: {
          account_id: string
          created_at: string
          due_date: string
          end_date: string
          id: string
          is_estimated: boolean
          start_date: string
        }
        Insert: {
          account_id: string
          created_at?: string
          due_date: string
          end_date: string
          id?: string
          is_estimated?: boolean
          start_date: string
        }
        Update: {
          account_id?: string
          created_at?: string
          due_date?: string
          end_date?: string
          id?: string
          is_estimated?: boolean
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_periods_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          canonical_name: string
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          type: string
          user_id: string | null
        }
        Insert: {
          canonical_name: string
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          type: string
          user_id?: string | null
        }
        Update: {
          canonical_name?: string
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      currencies: {
        Row: {
          code: string
          is_active: boolean
          name: string
          symbol: string
        }
        Insert: {
          code: string
          is_active?: boolean
          name: string
          symbol: string
        }
        Update: {
          code?: string
          is_active?: boolean
          name?: string
          symbol?: string
        }
        Relationships: []
      }
      institutions: {
        Row: {
          brand_color: string | null
          country: string
          icon_type: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          brand_color?: string | null
          country?: string
          icon_type?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          brand_color?: string | null
          country?: string
          icon_type?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      period_payments: {
        Row: {
          created_at: string
          id: string
          period_id: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          period_id: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          id?: string
          period_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "period_payments_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: true
            referencedRelation: "card_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "period_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          financial_timezone: string
          full_name: string
          id: string
          mode: string
          onboarding_completed_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          financial_timezone?: string
          full_name: string
          id: string
          mode?: string
          onboarding_completed_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          financial_timezone?: string
          full_name?: string
          id?: string
          mode?: string
          onboarding_completed_at?: string | null
        }
        Relationships: []
      }
      recurrence_instances: {
        Row: {
          account_id: string
          amount: number
          category_id: string | null
          confirmed_transaction_id: string | null
          created_at: string
          currency_code: string
          description: string | null
          id: string
          recurrence_id: string
          resolved_at: string | null
          scheduled_date: string
          status: string
          subcategory_id: string | null
          transfer_destination_account_id: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category_id?: string | null
          confirmed_transaction_id?: string | null
          created_at?: string
          currency_code: string
          description?: string | null
          id?: string
          recurrence_id: string
          resolved_at?: string | null
          scheduled_date: string
          status?: string
          subcategory_id?: string | null
          transfer_destination_account_id?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string | null
          confirmed_transaction_id?: string | null
          created_at?: string
          currency_code?: string
          description?: string | null
          id?: string
          recurrence_id?: string
          resolved_at?: string | null
          scheduled_date?: string
          status?: string
          subcategory_id?: string | null
          transfer_destination_account_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurrence_instances_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrence_instances_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrence_instances_confirmed_transaction_id_fkey"
            columns: ["confirmed_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrence_instances_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "recurrence_instances_recurrence_id_fkey"
            columns: ["recurrence_id"]
            isOneToOne: false
            referencedRelation: "recurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrence_instances_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrence_instances_transfer_destination_account_id_fkey"
            columns: ["transfer_destination_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      recurrence_suggestion_dismissals: {
        Row: {
          created_at: string
          fingerprint: string
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          fingerprint: string
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          fingerprint?: string
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recurrences: {
        Row: {
          account_id: string
          amount: number
          category_id: string | null
          created_at: string
          created_from_transaction_id: string | null
          currency_code: string
          description: string | null
          end_date: string | null
          frequency: string
          id: string
          last_generated_date: string | null
          movement_type: string
          start_date: string
          status: string
          subcategory_id: string | null
          transfer_destination_account_id: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category_id?: string | null
          created_at?: string
          created_from_transaction_id?: string | null
          currency_code: string
          description?: string | null
          end_date?: string | null
          frequency: string
          id?: string
          last_generated_date?: string | null
          movement_type: string
          start_date: string
          status?: string
          subcategory_id?: string | null
          transfer_destination_account_id?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string | null
          created_at?: string
          created_from_transaction_id?: string | null
          currency_code?: string
          description?: string | null
          end_date?: string | null
          frequency?: string
          id?: string
          last_generated_date?: string | null
          movement_type?: string
          start_date?: string
          status?: string
          subcategory_id?: string | null
          transfer_destination_account_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurrences_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrences_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrences_created_from_transaction_id_fkey"
            columns: ["created_from_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrences_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "recurrences_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurrences_transfer_destination_account_id_fkey"
            columns: ["transfer_destination_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategories: {
        Row: {
          canonical_name: string
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          user_id: string | null
        }
        Insert: {
          canonical_name: string
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          user_id?: string | null
        }
        Update: {
          canonical_name?: string
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          card_period_id: string | null
          category_id: string | null
          created_at: string
          currency_code: string
          date: string
          description: string | null
          due_date: string | null
          fx_rate_to_ars: number | null
          id: string
          installment_n: number | null
          installments_total: number | null
          is_parent: boolean
          is_verified: boolean
          parent_id: string | null
          status: string | null
          subcategory_id: string | null
          transfer_destination_account_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          card_period_id?: string | null
          category_id?: string | null
          created_at?: string
          currency_code: string
          date: string
          description?: string | null
          due_date?: string | null
          fx_rate_to_ars?: number | null
          id?: string
          installment_n?: number | null
          installments_total?: number | null
          is_parent?: boolean
          is_verified?: boolean
          parent_id?: string | null
          status?: string | null
          subcategory_id?: string | null
          transfer_destination_account_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          card_period_id?: string | null
          category_id?: string | null
          created_at?: string
          currency_code?: string
          date?: string
          description?: string | null
          due_date?: string | null
          fx_rate_to_ars?: number | null
          id?: string
          installment_n?: number | null
          installments_total?: number | null
          is_parent?: boolean
          is_verified?: boolean
          parent_id?: string | null
          status?: string | null
          subcategory_id?: string | null
          transfer_destination_account_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_card_period_id_fkey"
            columns: ["card_period_id"]
            isOneToOne: false
            referencedRelation: "card_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "transactions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_transfer_destination_account_id_fkey"
            columns: ["transfer_destination_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      account_type: "cash" | "bank" | "credit"
      transaction_type: "income" | "expense" | "transfer" | "adjustment"
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
      account_type: ["cash", "bank", "credit"],
      transaction_type: ["income", "expense", "transfer", "adjustment"],
    },
  },
} as const
