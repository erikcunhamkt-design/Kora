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
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          email: string | null
          id: string
          is_decision_maker: boolean | null
          is_financial: boolean | null
          is_primary: boolean | null
          name: string
          notes: string | null
          phone: string | null
          role: string | null
          updated_at: string
          whatsapp: string | null
          workspace_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_decision_maker?: boolean | null
          is_financial?: boolean | null
          is_primary?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          whatsapp?: string | null
          workspace_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_decision_maker?: boolean | null
          is_financial?: boolean | null
          is_primary?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          whatsapp?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_signup_requests: {
        Row: {
          company: string | null
          consent: boolean
          converted_client_id: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          message: string | null
          name: string
          owner_id: string
          phone: string | null
          project_interest: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          company?: string | null
          consent?: boolean
          converted_client_id?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          message?: string | null
          name: string
          owner_id: string
          phone?: string | null
          project_interest?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          company?: string | null
          consent?: boolean
          converted_client_id?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          message?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          project_interest?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_technical_sheets: {
        Row: {
          branding: Json | null
          briefing: Json | null
          client_id: string
          created_at: string
          editorial: Json | null
          id: string
          materials: Json | null
          persona: Json | null
          raw_payload: Json | null
          social_links: Json | null
          typography: Json | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          branding?: Json | null
          briefing?: Json | null
          client_id: string
          created_at?: string
          editorial?: Json | null
          id?: string
          materials?: Json | null
          persona?: Json | null
          raw_payload?: Json | null
          social_links?: Json | null
          typography?: Json | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          branding?: Json | null
          briefing?: Json | null
          client_id?: string
          created_at?: string
          editorial?: Json | null
          id?: string
          materials?: Json | null
          persona?: Json | null
          raw_payload?: Json | null
          social_links?: Json | null
          typography?: Json | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_technical_sheets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_technical_sheets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          archived: boolean | null
          city: string | null
          company: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          instagram: string | null
          is_demo: boolean | null
          name: string
          next_action: string | null
          next_action_date: string | null
          notes: string | null
          phone: string | null
          potential_value: number | null
          source: string | null
          state: string | null
          status: string | null
          tags: string[] | null
          temperature: string | null
          total_revenue: number | null
          type: string | null
          updated_at: string
          website: string | null
          whatsapp: string | null
          workspace_id: string
        }
        Insert: {
          address?: string | null
          archived?: boolean | null
          city?: string | null
          company?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          is_demo?: boolean | null
          name: string
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          phone?: string | null
          potential_value?: number | null
          source?: string | null
          state?: string | null
          status?: string | null
          tags?: string[] | null
          temperature?: string | null
          total_revenue?: number | null
          type?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
          workspace_id: string
        }
        Update: {
          address?: string | null
          archived?: boolean | null
          city?: string | null
          company?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          is_demo?: boolean | null
          name?: string
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          phone?: string | null
          potential_value?: number | null
          source?: string | null
          state?: string | null
          status?: string | null
          tags?: string[] | null
          temperature?: string | null
          total_revenue?: number | null
          type?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_opportunities: {
        Row: {
          archived: boolean | null
          client_id: string | null
          company: string | null
          contact_name: string | null
          converted_client_id: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          email: string | null
          expected_close_date: string | null
          id: string
          is_demo: boolean | null
          lost_at: string | null
          lost_reason: string | null
          next_action: string | null
          next_action_date: string | null
          notes: string | null
          phone: string | null
          potential_value: number | null
          priority: string | null
          probability: number | null
          quote_id: string | null
          quote_title: string | null
          source: string | null
          stage: string
          status: string | null
          temperature: string | null
          title: string
          updated_at: string | null
          whatsapp: string | null
          won_at: string | null
          workspace_id: string
        }
        Insert: {
          archived?: boolean | null
          client_id?: string | null
          company?: string | null
          contact_name?: string | null
          converted_client_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          email?: string | null
          expected_close_date?: string | null
          id?: string
          is_demo?: boolean | null
          lost_at?: string | null
          lost_reason?: string | null
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          phone?: string | null
          potential_value?: number | null
          priority?: string | null
          probability?: number | null
          quote_id?: string | null
          quote_title?: string | null
          source?: string | null
          stage?: string
          status?: string | null
          temperature?: string | null
          title: string
          updated_at?: string | null
          whatsapp?: string | null
          won_at?: string | null
          workspace_id: string
        }
        Update: {
          archived?: boolean | null
          client_id?: string | null
          company?: string | null
          contact_name?: string | null
          converted_client_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          email?: string | null
          expected_close_date?: string | null
          id?: string
          is_demo?: boolean | null
          lost_at?: string | null
          lost_reason?: string | null
          next_action?: string | null
          next_action_date?: string | null
          notes?: string | null
          phone?: string | null
          potential_value?: number | null
          priority?: string | null
          probability?: number | null
          quote_id?: string | null
          quote_title?: string | null
          source?: string | null
          stage?: string
          status?: string | null
          temperature?: string | null
          title?: string
          updated_at?: string | null
          whatsapp?: string | null
          won_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount: number
          archived: boolean | null
          client_id: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          is_demo: boolean | null
          opportunity_id: string | null
          paid_at: string | null
          quote_id: string | null
          source: string | null
          status: string
          title: string
          type: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          amount?: number
          archived?: boolean | null
          client_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_demo?: boolean | null
          opportunity_id?: string | null
          paid_at?: string | null
          quote_id?: string | null
          source?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number
          archived?: boolean | null
          client_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_demo?: boolean | null
          opportunity_id?: string | null
          paid_at?: string | null
          quote_id?: string | null
          source?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string | null
          features: Json | null
          id: number
          is_active: boolean | null
          monthly_credits: number | null
          name: string
          price_annually: number | null
          price_monthly: number | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          features?: Json | null
          id?: never
          is_active?: boolean | null
          monthly_credits?: number | null
          name: string
          price_annually?: number | null
          price_monthly?: number | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          features?: Json | null
          id?: never
          is_active?: boolean | null
          monthly_credits?: number | null
          name?: string
          price_annually?: number | null
          price_monthly?: number | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          plan: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          plan?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          plan?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          archived: boolean | null
          budget: number | null
          client_id: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          is_demo: boolean | null
          opportunity_id: string | null
          quote_id: string | null
          source: string | null
          start_date: string | null
          status: string
          title: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          archived?: boolean | null
          budget?: number | null
          client_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_demo?: boolean | null
          opportunity_id?: string | null
          quote_id?: string | null
          source?: string | null
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          archived?: boolean | null
          budget?: number | null
          client_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_demo?: boolean | null
          opportunity_id?: string | null
          quote_id?: string | null
          source?: string | null
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          created_at: string | null
          id: string
          name: string
          quantity: number
          quote_id: string
          service_id: string | null
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          quantity: number
          quote_id: string
          service_id?: string | null
          unit_price: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          quantity?: number
          quote_id?: string
          service_id?: string | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          approved_at: string | null
          archived: boolean | null
          client_email: string | null
          client_name: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          description: string | null
          discount: number | null
          id: string
          rejected_at: string | null
          status: string | null
          subtotal: number | null
          title: string
          total: number | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          approved_at?: string | null
          archived?: boolean | null
          client_email?: string | null
          client_name?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          description?: string | null
          discount?: number | null
          id?: string
          rejected_at?: string | null
          status?: string | null
          subtotal?: number | null
          title: string
          total?: number | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          approved_at?: string | null
          archived?: boolean | null
          client_email?: string | null
          client_name?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          description?: string | null
          discount?: number | null
          id?: string
          rejected_at?: string | null
          status?: string | null
          subtotal?: number | null
          title?: string
          total?: number | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          archived: boolean
          client_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          is_demo: boolean
          opportunity_id: string | null
          priority: string
          project_id: string | null
          quote_id: string | null
          sort_order: number
          source: string
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived?: boolean
          client_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_demo?: boolean
          opportunity_id?: string | null
          priority?: string
          project_id?: string | null
          quote_id?: string | null
          sort_order?: number
          source?: string
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived?: boolean
          client_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_demo?: boolean
          opportunity_id?: string | null
          priority?: string
          project_id?: string | null
          quote_id?: string | null
          sort_order?: number
          source?: string
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_plan: {
        Row: {
          billing_cycle_end: string | null
          billing_cycle_start: string | null
          cancelled_at: string | null
          created_at: string | null
          credits_allocated: number | null
          credits_used: number | null
          id: number
          is_trial: boolean | null
          plan_id: number | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          billing_cycle_end?: string | null
          billing_cycle_start?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          credits_allocated?: number | null
          credits_used?: number | null
          id?: never
          is_trial?: boolean | null
          plan_id?: number | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          billing_cycle_end?: string | null
          billing_cycle_start?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          credits_allocated?: number | null
          credits_used?: number | null
          id?: never
          is_trial?: boolean | null
          plan_id?: number | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_plan_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_audience_contacts: {
        Row: {
          audience_id: string
          blocked: boolean | null
          company: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          has_opt_in: boolean | null
          id: string
          is_duplicate: boolean | null
          is_valid: boolean | null
          matched_client_id: string | null
          matched_conversation_id: string | null
          name: string | null
          normalized_phone: string
          notes: string | null
          opt_in_at: string | null
          opt_in_source: string | null
          opt_out: boolean | null
          origin: string | null
          phone: string
          tag: string | null
          updated_at: string
          validation_reason: string | null
          workspace_id: string
        }
        Insert: {
          audience_id: string
          blocked?: boolean | null
          company?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          has_opt_in?: boolean | null
          id?: string
          is_duplicate?: boolean | null
          is_valid?: boolean | null
          matched_client_id?: string | null
          matched_conversation_id?: string | null
          name?: string | null
          normalized_phone: string
          notes?: string | null
          opt_in_at?: string | null
          opt_in_source?: string | null
          opt_out?: boolean | null
          origin?: string | null
          phone: string
          tag?: string | null
          updated_at?: string
          validation_reason?: string | null
          workspace_id: string
        }
        Update: {
          audience_id?: string
          blocked?: boolean | null
          company?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          has_opt_in?: boolean | null
          id?: string
          is_duplicate?: boolean | null
          is_valid?: boolean | null
          matched_client_id?: string | null
          matched_conversation_id?: string | null
          name?: string | null
          normalized_phone?: string
          notes?: string | null
          opt_in_at?: string | null
          opt_in_source?: string | null
          opt_out?: boolean | null
          origin?: string | null
          phone?: string
          tag?: string | null
          updated_at?: string
          validation_reason?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_audience_contacts_audience_id_fkey"
            columns: ["audience_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_audiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_audience_contacts_matched_client_id_fkey"
            columns: ["matched_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_audience_contacts_matched_conversation_id_fkey"
            columns: ["matched_conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_audience_contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_audiences: {
        Row: {
          archived: boolean | null
          created_at: string
          deleted_at: string | null
          description: string | null
          duplicate_contacts: number | null
          id: string
          invalid_contacts: number | null
          name: string
          source: string | null
          status: string | null
          tags: string[] | null
          total_contacts: number | null
          updated_at: string
          valid_contacts: number | null
          workspace_id: string
        }
        Insert: {
          archived?: boolean | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          duplicate_contacts?: number | null
          id?: string
          invalid_contacts?: number | null
          name: string
          source?: string | null
          status?: string | null
          tags?: string[] | null
          total_contacts?: number | null
          updated_at?: string
          valid_contacts?: number | null
          workspace_id: string
        }
        Update: {
          archived?: boolean | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          duplicate_contacts?: number | null
          id?: string
          invalid_contacts?: number | null
          name?: string
          source?: string | null
          status?: string | null
          tags?: string[] | null
          total_contacts?: number | null
          updated_at?: string
          valid_contacts?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_audiences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_bot_settings: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          model_name: string | null
          system_instruction: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          model_name?: string | null
          system_instruction?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          model_name?: string | null
          system_instruction?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      whatsapp_campaign_recipients: {
        Row: {
          audience_contact_id: string | null
          campaign_id: string
          created_at: string
          deleted_at: string | null
          delivered_at: string | null
          error_message: string | null
          id: string
          name: string | null
          normalized_phone: string
          phone: string
          provider_message_id: string | null
          read_at: string | null
          replied_at: string | null
          sent_at: string | null
          skip_reason: string | null
          status: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          audience_contact_id?: string | null
          campaign_id: string
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          name?: string | null
          normalized_phone: string
          phone: string
          provider_message_id?: string | null
          read_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          skip_reason?: string | null
          status?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          audience_contact_id?: string | null
          campaign_id?: string
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          name?: string | null
          normalized_phone?: string
          phone?: string
          provider_message_id?: string | null
          read_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          skip_reason?: string | null
          status?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campaign_recipients_audience_contact_id_fkey"
            columns: ["audience_contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_audience_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_campaigns_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_campaign_recipients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_campaign_send_logs: {
        Row: {
          campaign_id: string
          created_at: string
          error_message: string | null
          event: string
          id: string
          message: string | null
          phone: string | null
          provider_message_id: string | null
          recipient_id: string | null
          workspace_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          error_message?: string | null
          event: string
          id?: string
          message?: string | null
          phone?: string | null
          provider_message_id?: string | null
          recipient_id?: string | null
          workspace_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          error_message?: string | null
          event?: string
          id?: string
          message?: string | null
          phone?: string | null
          provider_message_id?: string | null
          recipient_id?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      whatsapp_campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          failed_contacts: number
          id: string
          message_template: string
          sent_contacts: number
          status: string
          title: string
          total_contacts: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          failed_contacts?: number
          id?: string
          message_template: string
          sent_contacts?: number
          status?: string
          title: string
          total_contacts?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          failed_contacts?: number
          id?: string
          message_template?: string
          sent_contacts?: number
          status?: string
          title?: string
          total_contacts?: number
          workspace_id?: string
        }
        Relationships: []
      }
      whatsapp_campaigns_v2: {
        Row: {
          audience_id: string | null
          created_at: string
          deleted_at: string | null
          delivered_count: number | null
          failed_count: number | null
          id: string
          mode: string | null
          name: string
          objective: string | null
          read_count: number | null
          replied_count: number | null
          scheduled_at: string | null
          sent_count: number | null
          status: string | null
          template_id: string | null
          total_recipients: number | null
          updated_at: string
          valid_recipients: number | null
          workspace_id: string
        }
        Insert: {
          audience_id?: string | null
          created_at?: string
          deleted_at?: string | null
          delivered_count?: number | null
          failed_count?: number | null
          id?: string
          mode?: string | null
          name: string
          objective?: string | null
          read_count?: number | null
          replied_count?: number | null
          scheduled_at?: string | null
          sent_count?: number | null
          status?: string | null
          template_id?: string | null
          total_recipients?: number | null
          updated_at?: string
          valid_recipients?: number | null
          workspace_id: string
        }
        Update: {
          audience_id?: string | null
          created_at?: string
          deleted_at?: string | null
          delivered_count?: number | null
          failed_count?: number | null
          id?: string
          mode?: string | null
          name?: string
          objective?: string | null
          read_count?: number | null
          replied_count?: number | null
          scheduled_at?: string | null
          sent_count?: number | null
          status?: string | null
          template_id?: string | null
          total_recipients?: number | null
          updated_at?: string
          valid_recipients?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campaigns_v2_audience_id_fkey"
            columns: ["audience_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_audiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_campaigns_v2_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_campaigns_v2_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          assigned_to: string | null
          avatar_url: string | null
          client_id: string | null
          contact_name: string | null
          contact_phone: string
          created_at: string
          id: string
          instance_id: string
          last_message: string | null
          last_message_at: string | null
          opportunity_id: string | null
          status: string
          tags: string[] | null
          unread_count: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          avatar_url?: string | null
          client_id?: string | null
          contact_name?: string | null
          contact_phone: string
          created_at?: string
          id?: string
          instance_id: string
          last_message?: string | null
          last_message_at?: string | null
          opportunity_id?: string | null
          status?: string
          tags?: string[] | null
          unread_count?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          avatar_url?: string | null
          client_id?: string | null
          contact_name?: string | null
          contact_phone?: string
          created_at?: string
          id?: string
          instance_id?: string
          last_message?: string | null
          last_message_at?: string | null
          opportunity_id?: string | null
          status?: string
          tags?: string[] | null
          unread_count?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      whatsapp_favorite_stickers: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          mime_type: string | null
          sticker_url: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          mime_type?: string | null
          sticker_url: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          mime_type?: string | null
          sticker_url?: string
          workspace_id?: string
        }
        Relationships: []
      }
      whatsapp_instances: {
        Row: {
          connected_at: string | null
          created_at: string
          created_by: string | null
          id: string
          instance_name: string | null
          instance_token: string
          last_status_at: string | null
          phone: string | null
          phone_name: string | null
          qr_code: string | null
          status: string
          subdomain: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          instance_name?: string | null
          instance_token: string
          last_status_at?: string | null
          phone?: string | null
          phone_name?: string | null
          qr_code?: string | null
          status?: string
          subdomain: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          instance_name?: string | null
          instance_token?: string
          last_status_at?: string | null
          phone?: string | null
          phone_name?: string | null
          qr_code?: string | null
          status?: string
          subdomain?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      whatsapp_internal_notes: {
        Row: {
          author_id: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          author_id?: string | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          author_id?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      whatsapp_message_media: {
        Row: {
          created_at: string
          deleted_at: string | null
          file_name: string | null
          file_size: number | null
          id: string
          media_id: string | null
          message_id: string
          mime_type: string | null
          sha256: string | null
          storage_path: string | null
          temporary_url: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          media_id?: string | null
          message_id: string
          mime_type?: string | null
          sha256?: string | null
          storage_path?: string | null
          temporary_url?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          media_id?: string | null
          message_id?: string
          mime_type?: string | null
          sha256?: string | null
          storage_path?: string | null
          temporary_url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_media_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_media_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string | null
          content: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          direction: string
          error: string | null
          id: string
          instance_id: string
          media_url: string | null
          pinned_at: string | null
          raw_payload: Json | null
          reactions: Json
          reply_to_message_id: string | null
          sender_id: string | null
          status: string
          timestamp: string | null
          type: string
          wa_message_id: string | null
          workspace_id: string
        }
        Insert: {
          body?: string | null
          content?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          direction: string
          error?: string | null
          id?: string
          instance_id: string
          media_url?: string | null
          pinned_at?: string | null
          raw_payload?: Json | null
          reactions?: Json
          reply_to_message_id?: string | null
          sender_id?: string | null
          status?: string
          timestamp?: string | null
          type?: string
          wa_message_id?: string | null
          workspace_id: string
        }
        Update: {
          body?: string | null
          content?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          direction?: string
          error?: string | null
          id?: string
          instance_id?: string
          media_url?: string | null
          pinned_at?: string | null
          raw_payload?: Json | null
          reactions?: Json
          reply_to_message_id?: string | null
          sender_id?: string | null
          status?: string
          timestamp?: string | null
          type?: string
          wa_message_id?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      whatsapp_opt_outs: {
        Row: {
          created_at: string
          id: string
          normalized_phone: string
          phone: string
          reason: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          normalized_phone: string
          phone: string
          reason?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          normalized_phone?: string
          phone?: string
          reason?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_opt_outs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_queue: {
        Row: {
          campaign_id: string | null
          created_at: string
          error_message: string | null
          id: string
          phone: string
          recipient_name: string | null
          scheduled_at: string
          sent_at: string | null
          status: string
          variables: Json | null
          workspace_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          phone: string
          recipient_name?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          variables?: Json | null
          workspace_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          phone?: string
          recipient_name?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          variables?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_quick_replies: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          shortcut: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          shortcut: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          shortcut?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          body: string
          category: string
          created_at: string
          deleted_at: string | null
          id: string
          internal_name: string | null
          language: string | null
          last_used_at: string | null
          name: string
          provider_template_id: string | null
          rejection_reason: string | null
          sample_values: Json | null
          status: string | null
          updated_at: string
          variables: Json | null
          workspace_id: string
        }
        Insert: {
          body: string
          category: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          internal_name?: string | null
          language?: string | null
          last_used_at?: string | null
          name: string
          provider_template_id?: string | null
          rejection_reason?: string | null
          sample_values?: Json | null
          status?: string | null
          updated_at?: string
          variables?: Json | null
          workspace_id: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          internal_name?: string | null
          language?: string | null
          last_used_at?: string | null
          name?: string
          provider_template_id?: string | null
          rejection_reason?: string | null
          sample_values?: Json | null
          status?: string | null
          updated_at?: string
          variables?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_ai_credentials: {
        Row: {
          created_at: string
          credentials_client_email: string | null
          credentials_json: Json
          credentials_project_id: string | null
          default_model: string
          id: string
          is_active: boolean
          location: string
          provider: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          credentials_client_email?: string | null
          credentials_json: Json
          credentials_project_id?: string | null
          default_model?: string
          id?: string
          is_active?: boolean
          location?: string
          provider?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          credentials_client_email?: string | null
          credentials_json?: Json
          credentials_project_id?: string | null
          default_model?: string
          id?: string
          is_active?: boolean
          location?: string
          provider?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_ai_credentials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
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
          role: string
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
            foreignKeyName: "workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_workspace_admin: { Args: { w_id: string }; Returns: boolean }
      is_workspace_member: { Args: { w_id: string }; Returns: boolean }
      workspace_id_from_realtime_topic: {
        Args: { topic: string }
        Returns: string
      }
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
