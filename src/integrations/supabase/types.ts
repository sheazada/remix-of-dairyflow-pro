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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      access_audit_logs: {
        Row: {
          browser: string | null
          created_at: string | null
          device_model: string | null
          device_type: string | null
          event_type: string
          failure_reason: string | null
          id: string
          ip_address: string | null
          is_new_device: boolean | null
          login_status: string | null
          os: string | null
          reason: string | null
          required_roles: string[] | null
          route_path: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_roles: string[] | null
        }
        Insert: {
          browser?: string | null
          created_at?: string | null
          device_model?: string | null
          device_type?: string | null
          event_type: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          is_new_device?: boolean | null
          login_status?: string | null
          os?: string | null
          reason?: string | null
          required_roles?: string[] | null
          route_path?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_roles?: string[] | null
        }
        Update: {
          browser?: string | null
          created_at?: string | null
          device_model?: string | null
          device_type?: string | null
          event_type?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          is_new_device?: boolean | null
          login_status?: string | null
          os?: string | null
          reason?: string | null
          required_roles?: string[] | null
          route_path?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_roles?: string[] | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          distributor_id: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          new_value: Json | null
          old_value: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          distributor_id: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          distributor_id?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_allocations: {
        Row: {
          allocated_amount: number
          created_at: string | null
          customer_id: string
          driver_collection_id: string
          id: string
          invoice_id: string | null
          notes: string | null
          payment_mode: string | null
        }
        Insert: {
          allocated_amount?: number
          created_at?: string | null
          customer_id: string
          driver_collection_id: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_mode?: string | null
        }
        Update: {
          allocated_amount?: number
          created_at?: string | null
          customer_id?: string
          driver_collection_id?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_allocations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_allocations_driver_collection_id_fkey"
            columns: ["driver_collection_id"]
            isOneToOne: false
            referencedRelation: "driver_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      crate_transactions: {
        Row: {
          crate_type_id: string
          created_at: string | null
          created_by: string | null
          delivery_id: string | null
          id: string
          notes: string | null
          quantity: number
          retailer_id: string | null
          route_id: string | null
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          crate_type_id: string
          created_at?: string | null
          created_by?: string | null
          delivery_id?: string | null
          id?: string
          notes?: string | null
          quantity: number
          retailer_id?: string | null
          route_id?: string | null
          transaction_date?: string
          transaction_type: string
        }
        Update: {
          crate_type_id?: string
          created_at?: string | null
          created_by?: string | null
          delivery_id?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          retailer_id?: string | null
          route_id?: string | null
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crate_transactions_crate_type_id_fkey"
            columns: ["crate_type_id"]
            isOneToOne: false
            referencedRelation: "crate_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crate_transactions_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crate_transactions_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crate_transactions_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      crate_types: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          area: string | null
          assigned_route_id: string | null
          created_at: string
          credit_limit: number
          distributor_id: string | null
          email: string | null
          gstin: string | null
          id: string
          latitude: number | null
          longitude: number | null
          mobile: string | null
          name: string
          notes: string | null
          notify_email: boolean
          notify_sms: boolean
          notify_whatsapp: boolean
          outstanding: number
          retailer_code: string | null
          shop_name: string | null
          status: string
          updated_at: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          area?: string | null
          assigned_route_id?: string | null
          created_at?: string
          credit_limit?: number
          distributor_id?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          mobile?: string | null
          name: string
          notes?: string | null
          notify_email?: boolean
          notify_sms?: boolean
          notify_whatsapp?: boolean
          outstanding?: number
          retailer_code?: string | null
          shop_name?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          area?: string | null
          assigned_route_id?: string | null
          created_at?: string
          credit_limit?: number
          distributor_id?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          mobile?: string | null
          name?: string
          notes?: string | null
          notify_email?: boolean
          notify_sms?: boolean
          notify_whatsapp?: boolean
          outstanding?: number
          retailer_code?: string | null
          shop_name?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_assigned_route_id_fkey"
            columns: ["assigned_route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          assigned_to: string | null
          collected_amount: number | null
          collected_mode: string | null
          created_at: string
          delivered_at: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          order_id: string | null
          pod_accuracy_m: number | null
          pod_captured_at: string | null
          pod_latitude: number | null
          pod_longitude: number | null
          pod_photo_url: string | null
          pod_signature: string | null
          received_by: string | null
          route: string | null
          route_id: string | null
          scheduled_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          collected_amount?: number | null
          collected_mode?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          order_id?: string | null
          pod_accuracy_m?: number | null
          pod_captured_at?: string | null
          pod_latitude?: number | null
          pod_longitude?: number | null
          pod_photo_url?: string | null
          pod_signature?: string | null
          received_by?: string | null
          route?: string | null
          route_id?: string | null
          scheduled_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          collected_amount?: number | null
          collected_mode?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          order_id?: string | null
          pod_accuracy_m?: number | null
          pod_captured_at?: string | null
          pod_latitude?: number | null
          pod_longitude?: number | null
          pod_photo_url?: string | null
          pod_signature?: string | null
          received_by?: string | null
          route?: string | null
          route_id?: string | null
          scheduled_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_cycles: {
        Row: {
          created_at: string | null
          cutoff_at: string
          cycle_code: string
          delivery_date: string
          delivery_shift: string
          id: string
          notes: string | null
          order_date: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          cutoff_at: string
          cycle_code: string
          delivery_date: string
          delivery_shift?: string
          id?: string
          notes?: string | null
          order_date: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          cutoff_at?: string
          cycle_code?: string
          delivery_date?: string
          delivery_shift?: string
          id?: string
          notes?: string | null
          order_date?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      delivery_runs: {
        Row: {
          created_at: string
          delivery_status: string
          driver_name: string | null
          end_accuracy_m: number | null
          end_latitude: number | null
          end_longitude: number | null
          ended_at: string | null
          helper_name: string | null
          id: string
          notes: string | null
          odometer_end: number | null
          odometer_start: number | null
          pickup_confirmed_at: string | null
          route_id: string
          run_date: string
          start_accuracy_m: number | null
          start_latitude: number | null
          start_longitude: number | null
          started_at: string | null
          status: string
          updated_at: string
          vehicle_number: string | null
          vehicle_type: string | null
        }
        Insert: {
          created_at?: string
          delivery_status?: string
          driver_name?: string | null
          end_accuracy_m?: number | null
          end_latitude?: number | null
          end_longitude?: number | null
          ended_at?: string | null
          helper_name?: string | null
          id?: string
          notes?: string | null
          odometer_end?: number | null
          odometer_start?: number | null
          pickup_confirmed_at?: string | null
          route_id: string
          run_date?: string
          start_accuracy_m?: number | null
          start_latitude?: number | null
          start_longitude?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Update: {
          created_at?: string
          delivery_status?: string
          driver_name?: string | null
          end_accuracy_m?: number | null
          end_latitude?: number | null
          end_longitude?: number | null
          ended_at?: string | null
          helper_name?: string | null
          id?: string
          notes?: string | null
          odometer_end?: number | null
          odometer_start?: number | null
          pickup_confirmed_at?: string | null
          route_id?: string
          run_date?: string
          start_accuracy_m?: number | null
          start_latitude?: number | null
          start_longitude?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_runs_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_consolidation_items: {
        Row: {
          buffer_qty: number
          created_at: string | null
          demand_consolidation_id: string
          final_procurement_qty: number
          id: string
          product_id: string | null
          product_name: string
          remarks: string | null
          total_ordered_qty: number
          total_value: number
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          buffer_qty?: number
          created_at?: string | null
          demand_consolidation_id: string
          final_procurement_qty?: number
          id?: string
          product_id?: string | null
          product_name: string
          remarks?: string | null
          total_ordered_qty?: number
          total_value?: number
          unit_price?: number
          updated_at?: string | null
        }
        Update: {
          buffer_qty?: number
          created_at?: string | null
          demand_consolidation_id?: string
          final_procurement_qty?: number
          id?: string
          product_id?: string | null
          product_name?: string
          remarks?: string | null
          total_ordered_qty?: number
          total_value?: number
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demand_consolidation_items_demand_consolidation_id_fkey"
            columns: ["demand_consolidation_id"]
            isOneToOne: false
            referencedRelation: "demand_consolidations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_consolidation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_consolidations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          consolidation_date: string
          consolidation_no: string
          created_at: string | null
          created_by: string | null
          delivery_cycle_id: string
          id: string
          notes: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          consolidation_date: string
          consolidation_no: string
          created_at?: string | null
          created_by?: string | null
          delivery_cycle_id: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          consolidation_date?: string
          consolidation_no?: string
          created_at?: string | null
          created_by?: string | null
          delivery_cycle_id?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demand_consolidations_delivery_cycle_id_fkey"
            columns: ["delivery_cycle_id"]
            isOneToOne: false
            referencedRelation: "delivery_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_source_orders: {
        Row: {
          created_at: string | null
          demand_consolidation_id: string
          order_id: string
        }
        Insert: {
          created_at?: string | null
          demand_consolidation_id: string
          order_id: string
        }
        Update: {
          created_at?: string | null
          demand_consolidation_id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_source_orders_demand_consolidation_id_fkey"
            columns: ["demand_consolidation_id"]
            isOneToOne: false
            referencedRelation: "demand_consolidations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_source_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      distributors: {
        Row: {
          address: string | null
          business_name: string
          city: string | null
          created_at: string
          currency: string | null
          email: string | null
          financial_year_start: string | null
          fssai: string | null
          gstin: string | null
          id: string
          invoice_prefix: string | null
          legal_name: string | null
          logo_url: string | null
          mobile: string | null
          pan: string | null
          phone: string | null
          pincode: string | null
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_name: string
          city?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          financial_year_start?: string | null
          fssai?: string | null
          gstin?: string | null
          id?: string
          invoice_prefix?: string | null
          legal_name?: string | null
          logo_url?: string | null
          mobile?: string | null
          pan?: string | null
          phone?: string | null
          pincode?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_name?: string
          city?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          financial_year_start?: string | null
          fssai?: string | null
          gstin?: string | null
          id?: string
          invoice_prefix?: string | null
          legal_name?: string | null
          logo_url?: string | null
          mobile?: string | null
          pan?: string | null
          phone?: string | null
          pincode?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      driver_collections: {
        Row: {
          collected_amount: number
          collection_no: string
          created_at: string | null
          delivery_date: string
          driver_name: string | null
          expected_amount: number
          id: string
          mismatch_amount: number | null
          notes: string | null
          reconciled_at: string | null
          reconciled_by: string | null
          route_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          collected_amount?: number
          collection_no: string
          created_at?: string | null
          delivery_date?: string
          driver_name?: string | null
          expected_amount?: number
          id?: string
          mismatch_amount?: number | null
          notes?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          route_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          collected_amount?: number
          collection_no?: string
          created_at?: string | null
          delivery_date?: string
          driver_name?: string | null
          expected_amount?: number
          id?: string
          mismatch_amount?: number | null
          notes?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          route_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_collections_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      edit_audit_logs: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string
          delivery_id: string | null
          field: string | null
          id: string
          new_value: string | null
          old_value: string | null
          record_id: string
          record_type: string
          route_id: string | null
          run_id: string | null
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string
          delivery_id?: string | null
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          record_id: string
          record_type: string
          route_id?: string | null
          run_id?: string | null
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string
          delivery_id?: string | null
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          record_id?: string
          record_type?: string
          route_id?: string | null
          run_id?: string | null
        }
        Relationships: []
      }
      email_verification_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_verification_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          expense_date: string
          id: string
          notes: string | null
          payment_mode: string | null
          receipt_url: string | null
          reference_no: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          payment_mode?: string | null
          receipt_url?: string | null
          reference_no?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          payment_mode?: string | null
          receipt_url?: string | null
          reference_no?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      gps_audit_logs: {
        Row: {
          accuracy: number | null
          created_at: string
          customer_id: string | null
          delivery_id: string | null
          error_code: string | null
          error_message: string | null
          event_type: string
          id: string
          invoice_id: string | null
          latitude: number | null
          longitude: number | null
          metadata: Json | null
          route_id: string | null
          run_id: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          customer_id?: string | null
          delivery_id?: string | null
          error_code?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          invoice_id?: string | null
          latitude?: number | null
          longitude?: number | null
          metadata?: Json | null
          route_id?: string | null
          run_id?: string | null
          success: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          customer_id?: string | null
          delivery_id?: string | null
          error_code?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          invoice_id?: string | null
          latitude?: number | null
          longitude?: number | null
          metadata?: Json | null
          route_id?: string | null
          run_id?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gps_audit_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_audit_logs_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_audit_logs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_audit_logs_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_audit_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "delivery_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          note: string | null
          product_id: string
          quantity: number
          ref_id: string | null
          ref_type: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          note?: string | null
          product_id: string
          quantity: number
          ref_id?: string | null
          ref_type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          note?: string | null
          product_id?: string
          quantity?: number
          ref_id?: string | null
          ref_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount: number
          delivered_quantity: number | null
          discount: number
          gst_rate: number
          hsn: string | null
          id: string
          invoice_id: string
          ordered_quantity: number | null
          product_id: string
          product_name: string
          quantity: number
          rate: number
          tax_amount: number
          taxable: number
        }
        Insert: {
          amount: number
          delivered_quantity?: number | null
          discount?: number
          gst_rate?: number
          hsn?: string | null
          id?: string
          invoice_id: string
          ordered_quantity?: number | null
          product_id: string
          product_name: string
          quantity: number
          rate: number
          tax_amount: number
          taxable: number
        }
        Update: {
          amount?: number
          delivered_quantity?: number | null
          discount?: number
          gst_rate?: number
          hsn?: string | null
          id?: string
          invoice_id?: string
          ordered_quantity?: number | null
          product_id?: string
          product_name?: string
          quantity?: number
          rate?: number
          tax_amount?: number
          taxable?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_revisions: {
        Row: {
          changes_json: Json
          created_at: string | null
          id: string
          invoice_id: string
          original_invoice_id: string | null
          original_total: number
          revised_by: string | null
          revised_invoice_no: string | null
          revised_total: number
          revision_number: number
          revision_reason: string
        }
        Insert: {
          changes_json: Json
          created_at?: string | null
          id?: string
          invoice_id: string
          original_invoice_id?: string | null
          original_total: number
          revised_by?: string | null
          revised_invoice_no?: string | null
          revised_total: number
          revision_number?: number
          revision_reason: string
        }
        Update: {
          changes_json?: Json
          created_at?: string | null
          id?: string
          invoice_id?: string
          original_invoice_id?: string | null
          original_total?: number
          revised_by?: string | null
          revised_invoice_no?: string | null
          revised_total?: number
          revision_number?: number
          revision_reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_revisions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_revisions_original_invoice_id_fkey"
            columns: ["original_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          balance: number
          cgst: number
          created_at: string
          customer_id: string
          discount: number
          due_date: string | null
          id: string
          igst: number
          invoice_date: string
          invoice_no: string
          is_revised: boolean | null
          notes: string | null
          order_id: string | null
          paid: number
          revision_count: number | null
          sgst: number
          status: string
          subtotal: number
          superseded_by: string | null
          total: number
          updated_at: string
        }
        Insert: {
          balance?: number
          cgst?: number
          created_at?: string
          customer_id: string
          discount?: number
          due_date?: string | null
          id?: string
          igst?: number
          invoice_date?: string
          invoice_no: string
          is_revised?: boolean | null
          notes?: string | null
          order_id?: string | null
          paid?: number
          revision_count?: number | null
          sgst?: number
          status?: string
          subtotal?: number
          superseded_by?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          cgst?: number
          created_at?: string
          customer_id?: string
          discount?: number
          due_date?: string | null
          id?: string
          igst?: number
          invoice_date?: string
          invoice_no?: string
          is_revised?: boolean | null
          notes?: string | null
          order_id?: string | null
          paid?: number
          revision_count?: number | null
          sgst?: number
          status?: string
          subtotal?: number
          superseded_by?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      login_history: {
        Row: {
          browser: string | null
          device_type: string | null
          distributor_id: string
          failure_reason: string | null
          id: string
          ip_address: string | null
          login_at: string
          logout_at: string | null
          os: string | null
          status: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          device_type?: string | null
          distributor_id: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          login_at?: string
          logout_at?: string | null
          os?: string | null
          status?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          device_type?: string | null
          distributor_id?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          login_at?: string
          logout_at?: string | null
          os?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_history_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "login_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          attempts: number
          body: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          customer_id: string | null
          delivery_id: string | null
          id: string
          idempotency_key: string | null
          invoice_id: string | null
          last_attempt_at: string | null
          last_error: string | null
          max_attempts: number
          next_retry_at: string | null
          provider: string | null
          provider_message_id: string | null
          recipient: string
          recipient_name: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          subject: string | null
          template: string | null
          template_data: Json
          triggered_by: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          body?: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          customer_id?: string | null
          delivery_id?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_id?: string | null
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          provider?: string | null
          provider_message_id?: string | null
          recipient: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          subject?: string | null
          template?: string | null
          template_data?: Json
          triggered_by?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          customer_id?: string | null
          delivery_id?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_id?: string | null
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          provider?: string | null
          provider_message_id?: string | null
          recipient?: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          subject?: string | null
          template?: string | null
          template_data?: Json
          triggered_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string | null
          data: Json | null
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          data?: Json | null
          id?: string
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          amount: number
          id: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          rate: number
        }
        Insert: {
          amount: number
          id?: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          rate: number
        }
        Update: {
          amount?: number
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          order_date: string
          order_no: string
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          order_date?: string
          order_no: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          order_date?: string
          order_no?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "password_reset_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          id: string
          invoice_id: string | null
          mode: string
          notes: string | null
          payment_date: string
          payment_no: string
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          id?: string
          invoice_id?: string | null
          mode?: string
          notes?: string | null
          payment_date?: string
          payment_no: string
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          id?: string
          invoice_id?: string | null
          mode?: string
          notes?: string | null
          payment_date?: string
          payment_no?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
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
          label: string
          name: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          label: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          name?: string
        }
        Relationships: []
      }
      product_batches: {
        Row: {
          available_qty: number | null
          batch_no: string | null
          cost_price: number | null
          created_at: string
          damaged_qty: number | null
          expiry_date: string | null
          id: string
          mfg_date: string | null
          product_id: string
          quantity: number
          reserved_qty: number | null
          status: string | null
          supplier_id: string | null
          warehouse_id: string | null
        }
        Insert: {
          available_qty?: number | null
          batch_no?: string | null
          cost_price?: number | null
          created_at?: string
          damaged_qty?: number | null
          expiry_date?: string | null
          id?: string
          mfg_date?: string | null
          product_id: string
          quantity?: number
          reserved_qty?: number | null
          status?: string | null
          supplier_id?: string | null
          warehouse_id?: string | null
        }
        Update: {
          available_qty?: number | null
          batch_no?: string | null
          cost_price?: number | null
          created_at?: string
          damaged_qty?: number | null
          expiry_date?: string | null
          id?: string
          mfg_date?: string | null
          product_id?: string
          quantity?: number
          reserved_qty?: number | null
          status?: string | null
          supplier_id?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          brand: string | null
          category: string | null
          created_at: string
          current_stock: number
          gst_rate: number
          hsn: string | null
          id: string
          image_url: string | null
          min_stock: number
          mrp: number
          name: string
          purchase_price: number
          selling_price: number
          status: string
          unit: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          category?: string | null
          created_at?: string
          current_stock?: number
          gst_rate?: number
          hsn?: string | null
          id?: string
          image_url?: string | null
          min_stock?: number
          mrp?: number
          name: string
          purchase_price?: number
          selling_price?: number
          status?: string
          unit?: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          category?: string | null
          created_at?: string
          current_stock?: number
          gst_rate?: number
          hsn?: string | null
          id?: string
          image_url?: string | null
          min_stock?: number
          mrp?: number
          name?: string
          purchase_price?: number
          selling_price?: number
          status?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string
          created_at: string
          distributor_id: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          account_status?: string
          created_at?: string
          distributor_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          account_status?: string
          created_at?: string
          distributor_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          amount: number
          gst_rate: number
          id: string
          ordered_qty: number | null
          product_id: string
          product_name: string
          purchase_id: string
          quantity: number
          rate: number
          variance_notes: string | null
          variance_qty: number | null
          variance_type: string | null
        }
        Insert: {
          amount: number
          gst_rate?: number
          id?: string
          ordered_qty?: number | null
          product_id: string
          product_name: string
          purchase_id: string
          quantity: number
          rate: number
          variance_notes?: string | null
          variance_qty?: number | null
          variance_type?: string | null
        }
        Update: {
          amount?: number
          gst_rate?: number
          id?: string
          ordered_qty?: number | null
          product_id?: string
          product_name?: string
          purchase_id?: string
          quantity?: number
          rate?: number
          variance_notes?: string | null
          variance_qty?: number | null
          variance_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          bill_no: string
          challan_url: string | null
          created_at: string
          delivery_cycle_id: string | null
          gst: number
          id: string
          notes: string | null
          paid: number
          purchase_date: string
          status: string
          subtotal: number
          supplier_id: string
          total: number
          updated_at: string
        }
        Insert: {
          bill_no: string
          challan_url?: string | null
          created_at?: string
          delivery_cycle_id?: string | null
          gst?: number
          id?: string
          notes?: string | null
          paid?: number
          purchase_date?: string
          status?: string
          subtotal?: number
          supplier_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          bill_no?: string
          challan_url?: string | null
          created_at?: string
          delivery_cycle_id?: string | null
          gst?: number
          id?: string
          notes?: string | null
          paid?: number
          purchase_date?: string
          status?: string
          subtotal?: number
          supplier_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_delivery_cycle_id_fkey"
            columns: ["delivery_cycle_id"]
            isOneToOne: false
            referencedRelation: "delivery_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reminder_logs: {
        Row: {
          channel: string
          created_at: string | null
          customer_id: string
          error_message: string | null
          id: string
          invoice_id: string | null
          sent_at: string | null
          status: string
          template_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string | null
          customer_id: string
          error_message?: string | null
          id?: string
          invoice_id?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          customer_id?: string
          error_message?: string | null
          id?: string
          invoice_id?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_logs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "reminder_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_templates: {
        Row: {
          body: string
          channel: string
          created_at: string | null
          days_overdue: number
          id: string
          is_active: boolean | null
          name: string
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          body: string
          channel: string
          created_at?: string | null
          days_overdue: number
          id?: string
          is_active?: boolean | null
          name: string
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string | null
          days_overdue?: number
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      retailer_ledger_entries: {
        Row: {
          created_at: string
          credit_amount: number
          debit_amount: number
          entry_date: string
          id: string
          invoice_id: string | null
          notes: string | null
          retailer_id: string
          running_balance: number
          transaction_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credit_amount?: number
          debit_amount?: number
          entry_date?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          retailer_id: string
          running_balance?: number
          transaction_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credit_amount?: number
          debit_amount?: number
          entry_date?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          retailer_id?: string
          running_balance?: number
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "retailer_ledger_entries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retailer_ledger_entries_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role?: string
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
      route_stops: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          route_id: string
          sequence: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          route_id: string
          sequence?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          route_id?: string
          sequence?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          active: boolean
          area: string | null
          capacity_label: string | null
          capacity_units: number | null
          created_at: string
          driver_name: string | null
          helper_name: string | null
          id: string
          max_stops: number | null
          name: string
          notes: string | null
          start_latitude: number | null
          start_longitude: number | null
          updated_at: string
          vehicle_number: string | null
          vehicle_type: string | null
        }
        Insert: {
          active?: boolean
          area?: string | null
          capacity_label?: string | null
          capacity_units?: number | null
          created_at?: string
          driver_name?: string | null
          helper_name?: string | null
          id?: string
          max_stops?: number | null
          name: string
          notes?: string | null
          start_latitude?: number | null
          start_longitude?: number | null
          updated_at?: string
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Update: {
          active?: boolean
          area?: string | null
          capacity_label?: string | null
          capacity_units?: number | null
          created_at?: string
          driver_name?: string | null
          helper_name?: string | null
          id?: string
          max_stops?: number | null
          name?: string
          notes?: string | null
          start_latitude?: number | null
          start_longitude?: number | null
          updated_at?: string
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Relationships: []
      }
      share_activity_logs: {
        Row: {
          channel: string
          created_at: string
          customer_id: string | null
          id: string
          invoice_id: string | null
          invoice_no: string | null
          recipient: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          invoice_no?: string | null
          recipient?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          invoice_no?: string | null
          recipient?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "share_activity_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_activity_logs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustment_items: {
        Row: {
          adjustment_id: string
          batch_id: string | null
          created_at: string | null
          diff_qty: number
          id: string
          physical_qty: number
          product_id: string
          reason_detail: string | null
          system_qty: number
          unit_cost: number | null
        }
        Insert: {
          adjustment_id: string
          batch_id?: string | null
          created_at?: string | null
          diff_qty?: number
          id?: string
          physical_qty?: number
          product_id: string
          reason_detail?: string | null
          system_qty?: number
          unit_cost?: number | null
        }
        Update: {
          adjustment_id?: string
          batch_id?: string | null
          created_at?: string | null
          diff_qty?: number
          id?: string
          physical_qty?: number
          product_id?: string
          reason_detail?: string | null
          system_qty?: number
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustment_items_adjustment_id_fkey"
            columns: ["adjustment_id"]
            isOneToOne: false
            referencedRelation: "stock_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "product_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustments: {
        Row: {
          adjustment_date: string
          adjustment_no: string
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          id: string
          notes: string | null
          reason: string | null
          requested_by: string | null
          status: string
          updated_at: string | null
          warehouse_id: string | null
        }
        Insert: {
          adjustment_date?: string
          adjustment_no: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Update: {
          adjustment_date?: string
          adjustment_no?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reconciliation_items: {
        Row: {
          batch_id: string | null
          created_at: string | null
          diff_qty: number
          id: string
          physical_qty: number
          product_id: string
          recon_id: string
          system_qty: number
          variance_reason: string | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string | null
          diff_qty?: number
          id?: string
          physical_qty?: number
          product_id: string
          recon_id: string
          system_qty?: number
          variance_reason?: string | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string | null
          diff_qty?: number
          id?: string
          physical_qty?: number
          product_id?: string
          recon_id?: string
          system_qty?: number
          variance_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_reconciliation_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "product_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reconciliation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reconciliation_items_recon_id_fkey"
            columns: ["recon_id"]
            isOneToOne: false
            referencedRelation: "stock_reconciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reconciliations: {
        Row: {
          completed_at: string | null
          conducted_by: string | null
          created_at: string | null
          id: string
          notes: string | null
          recon_date: string
          recon_no: string
          status: string
          warehouse_id: string | null
        }
        Insert: {
          completed_at?: string | null
          conducted_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          recon_date?: string
          recon_no: string
          status?: string
          warehouse_id?: string | null
        }
        Update: {
          completed_at?: string | null
          conducted_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          recon_date?: string
          recon_no?: string
          status?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_reconciliations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sudha_claims: {
        Row: {
          claim_amount: number | null
          claim_date: string
          claim_no: string
          claim_type: string
          created_at: string | null
          created_by: string | null
          credited_at: string | null
          evidence_url: string | null
          id: string
          product_id: string | null
          product_name: string
          purchase_id: string | null
          purchase_item_id: string | null
          quantity: number
          reason: string
          status: string
          submitted_to_sudha_at: string | null
          sudha_response: string | null
          updated_at: string | null
        }
        Insert: {
          claim_amount?: number | null
          claim_date?: string
          claim_no: string
          claim_type: string
          created_at?: string | null
          created_by?: string | null
          credited_at?: string | null
          evidence_url?: string | null
          id?: string
          product_id?: string | null
          product_name: string
          purchase_id?: string | null
          purchase_item_id?: string | null
          quantity?: number
          reason: string
          status?: string
          submitted_to_sudha_at?: string | null
          sudha_response?: string | null
          updated_at?: string | null
        }
        Update: {
          claim_amount?: number | null
          claim_date?: string
          claim_no?: string
          claim_type?: string
          created_at?: string | null
          created_by?: string | null
          credited_at?: string | null
          evidence_url?: string | null
          id?: string
          product_id?: string | null
          product_name?: string
          purchase_id?: string | null
          purchase_item_id?: string | null
          quantity?: number
          reason?: string
          status?: string
          submitted_to_sudha_at?: string | null
          sudha_response?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sudha_claims_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sudha_claims_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sudha_claims_purchase_item_id_fkey"
            columns: ["purchase_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_items"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          mode: string
          notes: string | null
          payment_date: string
          payment_no: string
          purchase_id: string | null
          reference: string | null
          supplier_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          mode?: string
          notes?: string | null
          payment_date?: string
          payment_no: string
          purchase_id?: string | null
          reference?: string | null
          supplier_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          mode?: string
          notes?: string | null
          payment_date?: string
          payment_no?: string
          purchase_id?: string | null
          reference?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          company: string | null
          created_at: string
          gstin: string | null
          id: string
          mobile: string | null
          name: string
          outstanding: number
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          company?: string | null
          created_at?: string
          gstin?: string | null
          id?: string
          mobile?: string | null
          name: string
          outstanding?: number
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          company?: string | null
          created_at?: string
          gstin?: string | null
          id?: string
          mobile?: string | null
          name?: string
          outstanding?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          distributor_id: string
          email: string | null
          email_verified: boolean | null
          employee_id: string | null
          failed_login_attempts: number | null
          full_name: string
          id: string
          last_login_at: string | null
          last_login_ip: string | null
          locked_until: string | null
          mobile: string | null
          mobile_verified: boolean | null
          password_hash: string
          retailer_id: string | null
          role: string
          status: string
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          distributor_id: string
          email?: string | null
          email_verified?: boolean | null
          employee_id?: string | null
          failed_login_attempts?: number | null
          full_name: string
          id?: string
          last_login_at?: string | null
          last_login_ip?: string | null
          locked_until?: string | null
          mobile?: string | null
          mobile_verified?: boolean | null
          password_hash: string
          retailer_id?: string | null
          role: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          distributor_id?: string
          email?: string | null
          email_verified?: boolean | null
          employee_id?: string | null
          failed_login_attempts?: number | null
          full_name?: string
          id?: string
          last_login_at?: string | null
          last_login_ip?: string | null
          locked_until?: string | null
          mobile?: string | null
          mobile_verified?: boolean | null
          password_hash?: string
          retailer_id?: string | null
          role?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          location: string | null
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      daily_reconciliation: {
        Row: {
          challan_no: string | null
          date: string | null
          distributed_to_retailers: number | null
          leftover: number | null
          ordered_from_sudha: number | null
          product_name: string | null
          received_from_sudha: number | null
          variance_amount: number | null
          variance_type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_delivery_quantities: {
        Args: { _invoice_id: string; _items: Json }
        Returns: string
      }
      calculate_crate_balance: {
        Args: { p_crate_type_id?: string; p_retailer_id: string }
        Returns: number
      }
      can_manage_finance: { Args: { _uid: string }; Returns: boolean }
      can_manage_sales: { Args: { _uid: string }; Returns: boolean }
      create_demand_consolidation: {
        Args: { p_delivery_cycle_id: string }
        Returns: string
      }
      create_notification: {
        Args: {
          _body: string
          _data?: Json
          _title: string
          _type: string
          _user_id: string
        }
        Returns: string
      }
      enqueue_delivery_notifications: {
        Args: { _delivery_id: string }
        Returns: number
      }
      enqueue_run_en_route_notifications: {
        Args: { _run_id: string }
        Returns: number
      }
      ensure_delivery_cycle: {
        Args: { p_delivery_date: string; p_shift?: string }
        Returns: string
      }
      expense_total: { Args: { _from: string; _to: string }; Returns: number }
      expense_totals_by_category: {
        Args: { _from: string; _to: string }
        Returns: {
          category_id: string
          category_name: string
          total_amount: number
        }[]
      }
      generate_adjustment_no: { Args: never; Returns: string }
      generate_claim_no: { Args: never; Returns: string }
      generate_collection_no: { Args: never; Returns: string }
      generate_consolidation_no: { Args: { p_date: string }; Returns: string }
      generate_cycle_code: {
        Args: { p_order_date: string; p_shift: string }
        Returns: string
      }
      generate_recon_no: { Args: never; Returns: string }
      get_account_status: { Args: { _user_id: string }; Returns: string }
      get_app_setting: { Args: { _key: string }; Returns: string }
      get_crate_balance_as_of:
        | {
            Args: { as_of_date?: string }
            Returns: {
              balance: number
              crate_type_id: string
              crate_type_name: string
              retailer_id: string
              retailer_name: string
              shop_name: string
            }[]
          }
        | {
            Args: { p_as_of_date?: string; p_crate_type_id?: string }
            Returns: {
              balance: number
              crate_type_id: string
              crate_type_name: string
              retailer_id: string
              retailer_name: string
              shop_name: string
            }[]
          }
      get_customer_by_user_email: { Args: { _email: string }; Returns: string }
      get_near_expiry_stock: {
        Args: { _days?: number }
        Returns: {
          available_qty: number
          batch_no: string
          days_remaining: number
          expiry_date: string
          product_name: string
        }[]
      }
      get_next_revision_no: { Args: { _invoice_id: string }; Returns: number }
      get_permission_id: { Args: { _name: string }; Returns: string }
      get_retailer_code: { Args: { _user_id: string }; Returns: string }
      get_stock_valuation: {
        Args: never
        Returns: {
          available_qty: number
          avg_cost: number
          damaged_qty: number
          product_id: string
          product_name: string
          total_qty: number
          total_value: number
        }[]
      }
      get_unread_notification_count: {
        Args: { _user_id: string }
        Returns: number
      }
      get_user_permissions: {
        Args: { _user_id: string }
        Returns: {
          category: string
          permission_label: string
          permission_name: string
        }[]
      }
      has_permission: {
        Args: { _permission_name: string; _user_id: string }
        Returns: boolean
      }
      has_reminder_been_sent: {
        Args: { _invoice_id: string; _template_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_account_active: { Args: { _user_id: string }; Returns: boolean }
      is_distributor: { Args: { _uid: string }; Returns: boolean }
      is_internal_staff: { Args: { _uid: string }; Returns: boolean }
      is_staff: { Args: { _uid: string }; Returns: boolean }
      link_customer_to_user: {
        Args: { _customer_id: string; _email: string }
        Returns: string
      }
      log_access_event: {
        Args: {
          _event_type: string
          _ip_address: string
          _reason: string
          _required_roles: string[]
          _route_path: string
          _user_agent: string
          _user_email: string
          _user_id: string
          _user_roles: string[]
        }
        Returns: undefined
      }
      post_stock_adjustment: {
        Args: { _adjustment_id: string }
        Returns: undefined
      }
      recalc_customer_outstanding: {
        Args: { _customer_id: string }
        Returns: undefined
      }
      recalc_invoice: { Args: { _invoice_id: string }; Returns: undefined }
      recalc_purchase: { Args: { _purchase_id: string }; Returns: undefined }
      recalc_run_delivery_status: {
        Args: { _run_id: string }
        Returns: undefined
      }
      recalc_supplier_outstanding: {
        Args: { _supplier_id: string }
        Returns: undefined
      }
      reconcile_collection: {
        Args: { _collection_id: string }
        Returns: undefined
      }
      record_notification_attempt: {
        Args: {
          _error?: string
          _id: string
          _provider?: string
          _provider_msg?: string
          _success: boolean
          _suppressed?: boolean
        }
        Returns: {
          attempts: number
          body: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          customer_id: string | null
          delivery_id: string | null
          id: string
          idempotency_key: string | null
          invoice_id: string | null
          last_attempt_at: string | null
          last_error: string | null
          max_attempts: number
          next_retry_at: string | null
          provider: string | null
          provider_message_id: string | null
          recipient: string
          recipient_name: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          subject: string | null
          template: string | null
          template_data: Json
          triggered_by: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "notification_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revise_invoice: {
        Args: {
          _invoice_id: string
          _revised_by: string
          _revised_items: Json
          _revision_reason: string
        }
        Returns: Json
      }
      role_has_permission: {
        Args: { _permission_name: string; _role: string }
        Returns: boolean
      }
      send_notification: {
        Args: {
          _body: string
          _data?: Json
          _title: string
          _type: string
          _user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "manager"
        | "salesperson"
        | "driver"
        | "helper"
        | "retailer"
      notification_channel: "email" | "sms" | "whatsapp"
      notification_status:
        | "queued"
        | "sending"
        | "sent"
        | "failed"
        | "suppressed"
        | "cancelled"
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
        "admin",
        "manager",
        "salesperson",
        "driver",
        "helper",
        "retailer",
      ],
      notification_channel: ["email", "sms", "whatsapp"],
      notification_status: [
        "queued",
        "sending",
        "sent",
        "failed",
        "suppressed",
        "cancelled",
      ],
    },
  },
} as const
