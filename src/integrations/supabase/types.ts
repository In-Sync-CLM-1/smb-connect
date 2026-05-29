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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          is_hidden: boolean | null
          is_super_admin: boolean | null
          permissions: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_hidden?: boolean | null
          is_super_admin?: boolean | null
          permissions?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_hidden?: boolean | null
          is_super_admin?: boolean | null
          permissions?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          company_id: string | null
          created_at: string | null
          data: Json | null
          event_type: string
          id: string
          ip_address: string | null
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          data?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          data?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      association_managers: {
        Row: {
          association_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          permissions: Json | null
          role: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          association_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          permissions?: Json | null
          role?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          association_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          permissions?: Json | null
          role?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "association_managers_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      association_requests: {
        Row: {
          address: string | null
          admin_notes: string | null
          city: string | null
          contact_email: string
          contact_phone: string | null
          country: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          postal_code: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          state: string | null
          status: string | null
          updated_at: string | null
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          admin_notes?: string | null
          city?: string | null
          contact_email: string
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          postal_code?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          admin_notes?: string | null
          city?: string | null
          contact_email?: string
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          postal_code?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      associations: {
        Row: {
          address: string | null
          city: string | null
          contact_email: string
          contact_phone: string | null
          country: string | null
          cover_image: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          founded_year: number | null
          id: string
          industry: string | null
          is_active: boolean | null
          keywords: string[] | null
          logo: string | null
          name: string
          postal_code: string | null
          social_links: Json | null
          state: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_email: string
          contact_phone?: string | null
          country?: string | null
          cover_image?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          founded_year?: number | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          keywords?: string[] | null
          logo?: string | null
          name: string
          postal_code?: string | null
          social_links?: Json | null
          state?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_email?: string
          contact_phone?: string | null
          country?: string | null
          cover_image?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          founded_year?: number | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          keywords?: string[] | null
          logo?: string | null
          name?: string
          postal_code?: string | null
          social_links?: Json | null
          state?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          changes: Json | null
          created_at: string | null
          id: string
          ip_address: string | null
          is_hidden_admin_action: boolean | null
          resource: string
          resource_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          is_hidden_admin_action?: boolean | null
          resource: string
          resource_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          is_hidden_admin_action?: boolean | null
          resource?: string
          resource_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      certifications: {
        Row: {
          certificate_file_url: string | null
          created_at: string | null
          credential_id: string | null
          credential_url: string | null
          display_order: number | null
          expiration_date: string | null
          id: string
          issue_date: string | null
          issuing_organization: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          certificate_file_url?: string | null
          created_at?: string | null
          credential_id?: string | null
          credential_url?: string | null
          display_order?: number | null
          expiration_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_organization: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          certificate_file_url?: string | null
          created_at?: string | null
          credential_id?: string | null
          credential_url?: string | null
          display_order?: number | null
          expiration_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_organization?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_participants: {
        Row: {
          chat_id: string
          id: string
          is_muted: boolean | null
          joined_at: string | null
          last_read_at: string | null
          member_id: string
        }
        Insert: {
          chat_id: string
          id?: string
          is_muted?: boolean | null
          joined_at?: string | null
          last_read_at?: string | null
          member_id: string
        }
        Update: {
          chat_id?: string
          id?: string
          is_muted?: boolean | null
          joined_at?: string | null
          last_read_at?: string | null
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_participants_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          created_at: string | null
          id: string
          last_message_at: string | null
          name: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          name?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          name?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          annual_turnover: number | null
          association_id: string
          business_type: string | null
          city: string | null
          country: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          email: string
          employee_count: number | null
          gst_number: string | null
          id: string
          industry_type: string | null
          is_active: boolean | null
          is_default: boolean | null
          is_verified: boolean | null
          logo: string | null
          name: string
          pan_number: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          subscription_tier: string | null
          updated_at: string | null
          verified_at: string | null
          website: string | null
          year_established: number | null
        }
        Insert: {
          address?: string | null
          annual_turnover?: number | null
          association_id: string
          business_type?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          email: string
          employee_count?: number | null
          gst_number?: string | null
          id?: string
          industry_type?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_verified?: boolean | null
          logo?: string | null
          name: string
          pan_number?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
          verified_at?: string | null
          website?: string | null
          year_established?: number | null
        }
        Update: {
          address?: string | null
          annual_turnover?: number | null
          association_id?: string
          business_type?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          email?: string
          employee_count?: number | null
          gst_number?: string | null
          id?: string
          industry_type?: string | null
          is_active?: boolean | null
          is_default?: boolean | null
          is_verified?: boolean | null
          logo?: string | null
          name?: string
          pan_number?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          subscription_tier?: string | null
          updated_at?: string | null
          verified_at?: string | null
          website?: string | null
          year_established?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_admins: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_admins_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_admins_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      company_invitations: {
        Row: {
          accepted_at: string | null
          association_id: string
          company_name: string
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          status: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          association_id: string
          company_name: string
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          status?: string | null
          token: string
        }
        Update: {
          accepted_at?: string | null
          association_id?: string
          company_name?: string
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          status?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_invitations_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_requests: {
        Row: {
          address: string | null
          admin_notes: string | null
          annual_turnover: number | null
          association_id: string | null
          business_type: string | null
          city: string | null
          country: string | null
          created_at: string | null
          description: string | null
          email: string
          employee_count: number | null
          gst_number: string | null
          id: string
          industry_type: string | null
          name: string
          pan_number: string | null
          phone: string | null
          postal_code: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          state: string | null
          status: string | null
          updated_at: string | null
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          admin_notes?: string | null
          annual_turnover?: number | null
          association_id?: string | null
          business_type?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          email: string
          employee_count?: number | null
          gst_number?: string | null
          id?: string
          industry_type?: string | null
          name: string
          pan_number?: string | null
          phone?: string | null
          postal_code?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          admin_notes?: string | null
          annual_turnover?: number | null
          association_id?: string | null
          business_type?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          email?: string
          employee_count?: number | null
          gst_number?: string | null
          id?: string
          industry_type?: string | null
          name?: string
          pan_number?: string | null
          phone?: string | null
          postal_code?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_requests_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          receiver_id: string
          responded_at: string | null
          sender_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          receiver_id: string
          responded_at?: string | null
          sender_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          receiver_id?: string
          responded_at?: string | null
          sender_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connections_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      education: {
        Row: {
          created_at: string | null
          degree: string | null
          description: string | null
          display_order: number | null
          end_date: string | null
          field_of_study: string | null
          grade: string | null
          id: string
          school: string
          start_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          degree?: string | null
          description?: string | null
          display_order?: number | null
          end_date?: string | null
          field_of_study?: string | null
          grade?: string | null
          id?: string
          school: string
          start_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          degree?: string | null
          description?: string | null
          display_order?: number | null
          end_date?: string | null
          field_of_study?: string | null
          grade?: string | null
          id?: string
          school?: string
          start_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_campaign_events: {
        Row: {
          campaign_id: string
          created_at: string | null
          event_data: Json | null
          event_type: string
          external_message_id: string | null
          id: string
          ip_address: string | null
          occurred_at: string
          recipient_email: string
          recipient_id: string | null
          user_agent: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          external_message_id?: string | null
          id?: string
          ip_address?: string | null
          occurred_at?: string
          recipient_email: string
          recipient_id?: string | null
          user_agent?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          external_message_id?: string | null
          id?: string
          ip_address?: string | null
          occurred_at?: string
          recipient_email?: string
          recipient_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "email_campaign_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_recipients: {
        Row: {
          bounced: boolean | null
          bounced_at: string | null
          campaign_id: string
          click_count: number | null
          clicked: boolean | null
          complained: boolean | null
          created_at: string | null
          delivered: boolean | null
          delivered_at: string | null
          email: string
          external_message_id: string | null
          first_clicked_at: string | null
          first_opened_at: string | null
          id: string
          last_clicked_at: string | null
          last_opened_at: string | null
          name: string | null
          open_count: number | null
          opened: boolean | null
          sent: boolean | null
          sent_at: string | null
          unsubscribed: boolean | null
          updated_at: string | null
        }
        Insert: {
          bounced?: boolean | null
          bounced_at?: string | null
          campaign_id: string
          click_count?: number | null
          clicked?: boolean | null
          complained?: boolean | null
          created_at?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          email: string
          external_message_id?: string | null
          first_clicked_at?: string | null
          first_opened_at?: string | null
          id?: string
          last_clicked_at?: string | null
          last_opened_at?: string | null
          name?: string | null
          open_count?: number | null
          opened?: boolean | null
          sent?: boolean | null
          sent_at?: string | null
          unsubscribed?: boolean | null
          updated_at?: string | null
        }
        Update: {
          bounced?: boolean | null
          bounced_at?: string | null
          campaign_id?: string
          click_count?: number | null
          clicked?: boolean | null
          complained?: boolean | null
          created_at?: string | null
          delivered?: boolean | null
          delivered_at?: string | null
          email?: string
          external_message_id?: string | null
          first_clicked_at?: string | null
          first_opened_at?: string | null
          id?: string
          last_clicked_at?: string | null
          last_opened_at?: string | null
          name?: string | null
          open_count?: number | null
          opened?: boolean | null
          sent?: boolean | null
          sent_at?: string | null
          unsubscribed?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          association_id: string | null
          bounce_rate: number | null
          click_rate: number | null
          company_id: string | null
          created_at: string | null
          created_by: string
          external_campaign_id: string | null
          id: string
          list_id: string
          open_rate: number | null
          sender_email: string
          sender_name: string
          sent_at: string
          subject: string
          total_bounced: number
          total_clicked: number
          total_complained: number
          total_delivered: number
          total_opened: number
          total_recipients: number
          total_sent: number
          total_unsubscribed: number
          updated_at: string | null
        }
        Insert: {
          association_id?: string | null
          bounce_rate?: number | null
          click_rate?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by: string
          external_campaign_id?: string | null
          id?: string
          list_id: string
          open_rate?: number | null
          sender_email: string
          sender_name: string
          sent_at?: string
          subject: string
          total_bounced?: number
          total_clicked?: number
          total_complained?: number
          total_delivered?: number
          total_opened?: number
          total_recipients?: number
          total_sent?: number
          total_unsubscribed?: number
          updated_at?: string | null
        }
        Update: {
          association_id?: string | null
          bounce_rate?: number | null
          click_rate?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string
          external_campaign_id?: string | null
          id?: string
          list_id?: string
          open_rate?: number | null
          sender_email?: string
          sender_name?: string
          sent_at?: string
          subject?: string
          total_bounced?: number
          total_clicked?: number
          total_complained?: number
          total_delivered?: number
          total_opened?: number
          total_recipients?: number
          total_sent?: number
          total_unsubscribed?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "email_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      email_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          recipient_id: string
          recipient_type: string
          sender_id: string
          sender_type: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          recipient_id: string
          recipient_type: string
          sender_id: string
          sender_type: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          recipient_id?: string
          recipient_type?: string
          sender_id?: string
          sender_type?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_list_recipients: {
        Row: {
          created_at: string
          email: string
          id: string
          list_id: string
          metadata: Json | null
          name: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          list_id: string
          metadata?: Json | null
          name?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          list_id?: string
          metadata?: Json | null
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_list_recipients_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "email_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      email_lists: {
        Row: {
          association_id: string | null
          company_id: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          total_recipients: number
          updated_at: string
        }
        Insert: {
          association_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          total_recipients?: number
          updated_at?: string
        }
        Update: {
          association_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          total_recipients?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_lists_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_lists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_lists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      email_messages: {
        Row: {
          body_html: string
          body_text: string | null
          conversation_id: string
          created_at: string
          direction: string
          external_message_id: string | null
          id: string
          is_read: boolean
          recipient_email: string
          sender_email: string
          sender_name: string | null
          sent_at: string
          subject: string
        }
        Insert: {
          body_html: string
          body_text?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          external_message_id?: string | null
          id?: string
          is_read?: boolean
          recipient_email: string
          sender_email: string
          sender_name?: string | null
          sent_at?: string
          subject: string
        }
        Update: {
          body_html?: string
          body_text?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          external_message_id?: string | null
          id?: string
          is_read?: boolean
          recipient_email?: string
          sender_email?: string
          sender_name?: string | null
          sent_at?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "email_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          association_id: string | null
          body_html: string
          body_text: string | null
          company_id: string | null
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          name: string
          subject: string
          template_type: string
          updated_at: string
        }
        Insert: {
          association_id?: string | null
          body_html: string
          body_text?: string | null
          company_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          name: string
          subject: string
          template_type: string
          updated_at?: string
        }
        Update: {
          association_id?: string | null
          body_html?: string
          body_text?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          name?: string
          subject?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_coupon_usages: {
        Row: {
          coupon_id: string
          discount_applied: number
          email: string
          id: string
          registration_id: string
          used_at: string
        }
        Insert: {
          coupon_id: string
          discount_applied: number
          email: string
          id?: string
          registration_id: string
          used_at?: string
        }
        Update: {
          coupon_id?: string
          discount_applied?: number
          email?: string
          id?: string
          registration_id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_coupon_usages_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "event_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_coupon_usages_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_coupons: {
        Row: {
          code: string
          created_at: string
          created_by: string
          current_uses: number
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          landing_page_id: string | null
          max_uses: number | null
          max_uses_per_user: number
          name: string
          updated_at: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          current_uses?: number
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean
          landing_page_id?: string | null
          max_uses?: number | null
          max_uses_per_user?: number
          name: string
          updated_at?: string
          valid_from?: string
          valid_until: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          current_uses?: number
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          landing_page_id?: string | null
          max_uses?: number | null
          max_uses_per_user?: number
          name?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_coupons_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "event_landing_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      event_landing_page_pages: {
        Row: {
          created_at: string
          html_content: string
          id: string
          is_default: boolean
          landing_page_id: string
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          html_content: string
          id?: string
          is_default?: boolean
          landing_page_id: string
          slug?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          html_content?: string
          id?: string
          is_default?: boolean
          landing_page_id?: string
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_landing_page_pages_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "event_landing_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      event_landing_pages: {
        Row: {
          association_id: string
          created_at: string
          created_by: string
          css_content: string | null
          default_utm_campaign: string | null
          default_utm_medium: string | null
          default_utm_source: string | null
          event_date: string | null
          event_id: string | null
          event_time: string | null
          event_venue: string | null
          html_content: string
          id: string
          is_active: boolean
          registration_enabled: boolean
          registration_fee: number | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          association_id: string
          created_at?: string
          created_by: string
          css_content?: string | null
          default_utm_campaign?: string | null
          default_utm_medium?: string | null
          default_utm_source?: string | null
          event_date?: string | null
          event_id?: string | null
          event_time?: string | null
          event_venue?: string | null
          html_content: string
          id?: string
          is_active?: boolean
          registration_enabled?: boolean
          registration_fee?: number | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          association_id?: string
          created_at?: string
          created_by?: string
          css_content?: string | null
          default_utm_campaign?: string | null
          default_utm_medium?: string | null
          default_utm_source?: string | null
          event_date?: string | null
          event_id?: string | null
          event_time?: string | null
          event_venue?: string | null
          html_content?: string
          id?: string
          is_active?: boolean
          registration_enabled?: boolean
          registration_fee?: number | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_landing_pages_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_landing_pages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          coupon_id: string | null
          created_at: string
          discount_amount: number | null
          email: string
          final_amount: number | null
          first_name: string
          id: string
          landing_page_id: string
          last_name: string
          original_amount: number | null
          phone: string | null
          registration_data: Json | null
          status: string
          user_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          coupon_id?: string | null
          created_at?: string
          discount_amount?: number | null
          email: string
          final_amount?: number | null
          first_name: string
          id?: string
          landing_page_id: string
          last_name: string
          original_amount?: number | null
          phone?: string | null
          registration_data?: Json | null
          status?: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          coupon_id?: string | null
          created_at?: string
          discount_amount?: number | null
          email?: string
          final_amount?: number | null
          first_name?: string
          id?: string
          landing_page_id?: string
          last_name?: string
          original_amount?: number | null
          phone?: string | null
          registration_data?: Json | null
          status?: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "event_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "event_landing_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      event_requisitions: {
        Row: {
          admin_notes: string | null
          association_id: string | null
          budget_estimate: number | null
          company_id: string | null
          created_at: string | null
          event_date: string | null
          event_description: string | null
          event_location: string | null
          event_name: string
          event_type: string | null
          expected_attendees: number | null
          id: string
          requester_id: string
          requester_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          association_id?: string | null
          budget_estimate?: number | null
          company_id?: string | null
          created_at?: string | null
          event_date?: string | null
          event_description?: string | null
          event_location?: string | null
          event_name: string
          event_type?: string | null
          expected_attendees?: number | null
          id?: string
          requester_id: string
          requester_type: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          association_id?: string | null
          budget_estimate?: number | null
          company_id?: string | null
          created_at?: string | null
          event_date?: string | null
          event_description?: string | null
          event_location?: string | null
          event_name?: string
          event_type?: string | null
          expected_attendees?: number | null
          id?: string
          requester_id?: string
          requester_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_requisitions_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_requisitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_requisitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_date: string
          event_link: string | null
          event_type: string | null
          id: string
          link_preview_description: string | null
          link_preview_image: string | null
          link_preview_title: string | null
          location: string | null
          start_date: string
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_date: string
          event_link?: string | null
          event_type?: string | null
          id?: string
          link_preview_description?: string | null
          link_preview_image?: string | null
          link_preview_title?: string | null
          location?: string | null
          start_date: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string
          event_link?: string | null
          event_type?: string | null
          id?: string
          link_preview_description?: string | null
          link_preview_image?: string | null
          link_preview_title?: string | null
          location?: string | null
          start_date?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      key_functionaries: {
        Row: {
          association_id: string
          bio: string | null
          created_at: string | null
          designation: string
          display_order: number | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          photo: string | null
          updated_at: string | null
        }
        Insert: {
          association_id: string
          bio?: string | null
          created_at?: string | null
          designation: string
          display_order?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          photo?: string | null
          updated_at?: string | null
        }
        Update: {
          association_id?: string
          bio?: string | null
          created_at?: string | null
          designation?: string
          display_order?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          photo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "key_functionaries_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      member_invitation_audit: {
        Row: {
          action: string
          created_at: string
          id: string
          invitation_id: string
          ip_address: string | null
          performed_by: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          invitation_id: string
          ip_address?: string | null
          performed_by?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          invitation_id?: string
          ip_address?: string | null
          performed_by?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_invitation_audit_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "member_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      member_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          department: string | null
          designation: string | null
          email: string
          expires_at: string
          first_name: string
          id: string
          invited_by: string
          last_name: string
          organization_id: string
          organization_type: string
          revoked_at: string | null
          revoked_by: string | null
          role: string
          status: string
          token: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          department?: string | null
          designation?: string | null
          email: string
          expires_at: string
          first_name: string
          id?: string
          invited_by: string
          last_name: string
          organization_id: string
          organization_type: string
          revoked_at?: string | null
          revoked_by?: string | null
          role: string
          status?: string
          token: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          department?: string | null
          designation?: string | null
          email?: string
          expires_at?: string
          first_name?: string
          id?: string
          invited_by?: string
          last_name?: string
          organization_id?: string
          organization_type?: string
          revoked_at?: string | null
          revoked_by?: string | null
          role?: string
          status?: string
          token?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          department: string | null
          designation: string | null
          id: string
          is_active: boolean | null
          joined_at: string | null
          permissions: Json | null
          role: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          designation?: string | null
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          permissions?: Json | null
          role?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          designation?: string | null
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          permissions?: Json | null
          role?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json | null
          chat_id: string
          content: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          is_deleted: boolean | null
          is_edited: boolean | null
          message_type: string | null
          metadata: Json | null
          sender_id: string
          sent_at: string | null
          updated_at: string | null
        }
        Insert: {
          attachments?: Json | null
          chat_id: string
          content?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          message_type?: string | null
          metadata?: Json | null
          sender_id: string
          sent_at?: string | null
          updated_at?: string | null
        }
        Update: {
          attachments?: Json | null
          chat_id?: string
          content?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          message_type?: string | null
          metadata?: Json | null
          sender_id?: string
          sent_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          category: string
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      password_reset_otps: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          otp_code: string
          used: boolean
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          otp_code: string
          used?: boolean
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          otp_code?: string
          used?: boolean
          used_at?: string | null
        }
        Relationships: []
      }
      post_bookmarks: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_bookmarks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          post_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          post_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          post_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_mentions: {
        Row: {
          created_at: string
          id: string
          mentioned_association_id: string | null
          mentioned_user_id: string | null
          post_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mentioned_association_id?: string | null
          mentioned_user_id?: string | null
          post_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mentioned_association_id?: string | null
          mentioned_user_id?: string | null
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_mentions_mentioned_association_id_fkey"
            columns: ["mentioned_association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_mentions_mentioned_user_id_fkey"
            columns: ["mentioned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_mentions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_shares: {
        Row: {
          created_at: string | null
          id: string
          platform: string
          post_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          platform: string
          post_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          platform?: string
          post_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          comments_count: number | null
          content: string
          created_at: string | null
          document_url: string | null
          id: string
          image_url: string | null
          likes_count: number | null
          organization_id: string | null
          original_author_id: string | null
          original_post_id: string | null
          post_context: string | null
          reposts_count: number | null
          shares_count: number | null
          updated_at: string | null
          user_id: string
          video_url: string | null
        }
        Insert: {
          comments_count?: number | null
          content: string
          created_at?: string | null
          document_url?: string | null
          id?: string
          image_url?: string | null
          likes_count?: number | null
          organization_id?: string | null
          original_author_id?: string | null
          original_post_id?: string | null
          post_context?: string | null
          reposts_count?: number | null
          shares_count?: number | null
          updated_at?: string | null
          user_id: string
          video_url?: string | null
        }
        Update: {
          comments_count?: number | null
          content?: string
          created_at?: string | null
          document_url?: string | null
          id?: string
          image_url?: string | null
          likes_count?: number | null
          organization_id?: string | null
          original_author_id?: string | null
          original_post_id?: string | null
          post_context?: string | null
          reposts_count?: number | null
          shares_count?: number | null
          updated_at?: string | null
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_original_author_id_fkey"
            columns: ["original_author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_original_post_id_fkey"
            columns: ["original_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar: string | null
          bio: string | null
          cover_image: string | null
          created_at: string | null
          current_context: string | null
          email: string | null
          employment_status: string | null
          first_name: string
          headline: string | null
          id: string
          last_name: string
          linkedin_url: string | null
          location: string | null
          open_to_work: boolean | null
          phone: string | null
          twitter_url: string | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          avatar?: string | null
          bio?: string | null
          cover_image?: string | null
          created_at?: string | null
          current_context?: string | null
          email?: string | null
          employment_status?: string | null
          first_name: string
          headline?: string | null
          id: string
          last_name: string
          linkedin_url?: string | null
          location?: string | null
          open_to_work?: boolean | null
          phone?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          avatar?: string | null
          bio?: string | null
          cover_image?: string | null
          created_at?: string | null
          current_context?: string | null
          email?: string | null
          employment_status?: string | null
          first_name?: string
          headline?: string | null
          id?: string
          last_name?: string
          linkedin_url?: string | null
          location?: string | null
          open_to_work?: boolean | null
          phone?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      skills: {
        Row: {
          created_at: string | null
          display_order: number | null
          endorsements_count: number | null
          id: string
          skill_name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          endorsements_count?: number | null
          id?: string
          skill_name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          endorsements_count?: number | null
          id?: string
          skill_name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_onboarding: {
        Row: {
          completed_at: string | null
          completed_steps: Json | null
          created_at: string | null
          id: string
          is_completed: boolean | null
          onboarding_version: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_steps?: Json | null
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          onboarding_version?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_steps?: Json | null
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          onboarding_version?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          recipient_id: string
          recipient_type: string
          sender_id: string
          sender_type: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          recipient_id: string
          recipient_type: string
          sender_id: string
          sender_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          recipient_id?: string
          recipient_type?: string
          sender_id?: string
          sender_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_list_recipients: {
        Row: {
          created_at: string
          id: string
          list_id: string
          metadata: Json | null
          name: string | null
          phone: string
        }
        Insert: {
          created_at?: string
          id?: string
          list_id: string
          metadata?: Json | null
          name?: string | null
          phone: string
        }
        Update: {
          created_at?: string
          id?: string
          list_id?: string
          metadata?: Json | null
          name?: string | null
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_list_recipients_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_lists: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          total_recipients: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          total_recipients?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          total_recipients?: number
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          body_text: string
          conversation_id: string
          created_at: string
          direction: string
          external_message_id: string | null
          id: string
          is_read: boolean
          recipient_phone: string
          sender_name: string | null
          sender_phone: string
          sent_at: string
        }
        Insert: {
          body_text: string
          conversation_id: string
          created_at?: string
          direction: string
          external_message_id?: string | null
          id?: string
          is_read?: boolean
          recipient_phone: string
          sender_name?: string | null
          sender_phone: string
          sent_at?: string
        }
        Update: {
          body_text?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          external_message_id?: string | null
          id?: string
          is_read?: boolean
          recipient_phone?: string
          sender_name?: string | null
          sender_phone?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          association_id: string | null
          body_text: string
          company_id: string | null
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          name: string
          template_type: string
          updated_at: string
        }
        Insert: {
          association_id?: string | null
          body_text: string
          company_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          name: string
          template_type: string
          updated_at?: string
        }
        Update: {
          association_id?: string | null
          body_text?: string
          company_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          name?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      work_experience: {
        Row: {
          company: string
          created_at: string | null
          description: string | null
          display_order: number | null
          end_date: string | null
          id: string
          is_current: boolean | null
          location: string | null
          start_date: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          location?: string | null
          start_date: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          location?: string | null
          start_date?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      companies_public: {
        Row: {
          association_id: string | null
          business_type: string | null
          city: string | null
          country: string | null
          created_at: string | null
          description: string | null
          employee_count: number | null
          id: string | null
          industry_type: string | null
          is_active: boolean | null
          logo: string | null
          name: string | null
          state: string | null
          website: string | null
          year_established: number | null
        }
        Insert: {
          association_id?: string | null
          business_type?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          employee_count?: number | null
          id?: string | null
          industry_type?: string | null
          is_active?: boolean | null
          logo?: string | null
          name?: string | null
          state?: string | null
          website?: string | null
          year_established?: number | null
        }
        Update: {
          association_id?: string | null
          business_type?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          employee_count?: number | null
          id?: string | null
          industry_type?: string | null
          is_active?: boolean | null
          logo?: string | null
          name?: string | null
          state?: string | null
          website?: string | null
          year_established?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      duplicate_companies_monitor: {
        Row: {
          association_id: string | null
          company_ids: string[] | null
          duplicate_count: number | null
          first_created: string | null
          last_created: string | null
          name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      key_functionaries_public: {
        Row: {
          association_id: string | null
          bio: string | null
          designation: string | null
          display_order: number | null
          id: string | null
          is_active: boolean | null
          name: string | null
          photo: string | null
        }
        Insert: {
          association_id?: string | null
          bio?: string | null
          designation?: string | null
          display_order?: number | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          photo?: string | null
        }
        Update: {
          association_id?: string | null
          bio?: string | null
          designation?: string | null
          display_order?: number | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          photo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "key_functionaries_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_send_emails: { Args: { check_user_id: string }; Returns: boolean }
      can_view_company_details: {
        Args: { target_company_id: string; viewer_id: string }
        Returns: boolean
      }
      can_view_profile_as_association_manager: {
        Args: { profile_user_id: string; viewer_id: string }
        Returns: boolean
      }
      can_view_profile_as_company_admin: {
        Args: { profile_user_id: string; viewer_id: string }
        Returns: boolean
      }
      check_company_admin_for_member: {
        Args: { member_company_id: string }
        Returns: boolean
      }
      get_user_email: { Args: { check_user_id: string }; Returns: string }
      get_user_role_context: {
        Args: { check_user_id: string }
        Returns: string
      }
      is_admin: { Args: { check_user_id: string }; Returns: boolean }
      is_admin_safe: { Args: { check_user_id: string }; Returns: boolean }
      is_association_manager: {
        Args: { check_association_id: string; check_user_id: string }
        Returns: boolean
      }
      is_association_manager_of_user: {
        Args: { manager_user_id: string; target_user_id: string }
        Returns: boolean
      }
      is_association_network_manager: {
        Args: { check_company_id: string; check_user_id: string }
        Returns: boolean
      }
      is_company_admin: {
        Args: { check_company_id: string; check_user_id: string }
        Returns: boolean
      }
      is_company_admin_of_user: {
        Args: { admin_user_id: string; target_user_id: string }
        Returns: boolean
      }
      is_company_admin_role: {
        Args: { check_company_id: string; check_user_id: string }
        Returns: boolean
      }
      is_company_admin_safe: {
        Args: { check_company_id: string; check_user_id: string }
        Returns: boolean
      }
      is_company_member_admin: {
        Args: { check_company_id: string; check_user_id: string }
        Returns: boolean
      }
      is_connected_to: {
        Args: { target_user_id: string; viewer_id: string }
        Returns: boolean
      }
      is_hidden_admin: { Args: { check_user_id: string }; Returns: boolean }
      is_member_of_association: {
        Args: { target_association_id: string; viewer_id: string }
        Returns: boolean
      }
      is_same_company: {
        Args: { check_user_id: string; target_user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { check_user_id: string }; Returns: boolean }
      is_user_association_manager: {
        Args: { _association_id: string; _user_id: string }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
