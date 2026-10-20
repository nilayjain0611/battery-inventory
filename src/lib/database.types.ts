// Generated from the database schema (supabase/migrations). Do not edit by hand.
// Regenerate with: npx supabase gen types typescript --linked > src/lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          id: number
          company_id: string | null
          actor_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          details: Json
          created_at: string
        }
        Insert: {
          id?: number
          company_id?: string | null
          actor_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          details?: Json
          created_at?: string
        }
        Update: {
          id?: number
          company_id?: string | null
          actor_id?: string | null
          action?: string
          entity_type?: string
          entity_id?: string | null
          details?: Json
          created_at?: string
        }
        Relationships: []
      }
      bom_lines: {
        Row: {
          id: string
          company_id: string
          bom_id: string
          component_product_id: string
          quantity: number
        }
        Insert: {
          id?: string
          company_id: string
          bom_id: string
          component_product_id: string
          quantity: number
        }
        Update: {
          id?: string
          company_id?: string
          bom_id?: string
          component_product_id?: string
          quantity?: number
        }
        Relationships: []
      }
      boms: {
        Row: {
          id: string
          company_id: string
          product_id: string
          name: string
          output_quantity: number
          is_active: boolean
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          product_id: string
          name: string
          output_quantity?: number
          is_active?: boolean
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          product_id?: string
          name?: string
          output_quantity?: number
          is_active?: boolean
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      brands: {
        Row: {
          id: string
          company_id: string
          name: string
          is_own_brand: boolean
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          is_own_brand?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          is_own_brand?: boolean
          created_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          company_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          created_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          id: string
          name: string
          legal_name: string
          gstin: string | null
          state_code: string
          address_line1: string | null
          address_line2: string | null
          city: string | null
          pincode: string | null
          phone: string | null
          email: string | null
          bank_name: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          invoice_terms: string | null
          invoice_footer: string | null
          timezone: string
          overhead_per_unit_estimate: number | null
          is_demo_configuration: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          legal_name: string
          gstin?: string | null
          state_code: string
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          pincode?: string | null
          phone?: string | null
          email?: string | null
          bank_name?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          invoice_terms?: string | null
          invoice_footer?: string | null
          timezone?: string
          overhead_per_unit_estimate?: number | null
          is_demo_configuration?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          legal_name?: string
          gstin?: string | null
          state_code?: string
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          pincode?: string | null
          phone?: string | null
          email?: string | null
          bank_name?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          invoice_terms?: string | null
          invoice_footer?: string | null
          timezone?: string
          overhead_per_unit_estimate?: number | null
          is_demo_configuration?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_memberships: {
        Row: {
          id: string
          company_id: string
          user_id: string
          role: Database["public"]["Enums"]["app_role"]
          can_record_receipts: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          user_id: string
          role: Database["public"]["Enums"]["app_role"]
          can_record_receipts?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          user_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          can_record_receipts?: boolean
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          id: string
          company_id: string
          name: string
          customer_type: Database["public"]["Enums"]["customer_type"]
          is_walk_in: boolean
          contact_person: string | null
          gstin: string | null
          state_code: string
          phone: string | null
          email: string | null
          billing_address: string | null
          shipping_address: string | null
          credit_days: number
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          customer_type?: Database["public"]["Enums"]["customer_type"]
          is_walk_in?: boolean
          contact_person?: string | null
          gstin?: string | null
          state_code: string
          phone?: string | null
          email?: string | null
          billing_address?: string | null
          shipping_address?: string | null
          credit_days?: number
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          customer_type?: Database["public"]["Enums"]["customer_type"]
          is_walk_in?: boolean
          contact_person?: string | null
          gstin?: string | null
          state_code?: string
          phone?: string | null
          email?: string | null
          billing_address?: string | null
          shipping_address?: string | null
          credit_days?: number
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_sequences: {
        Row: {
          id: string
          company_id: string
          doc_type: string
          prefix: string
          fiscal_year: string
          next_number: number
          padding: number
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          doc_type: string
          prefix: string
          fiscal_year: string
          next_number?: number
          padding?: number
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          doc_type?: string
          prefix?: string
          fiscal_year?: string
          next_number?: number
          padding?: number
          updated_at?: string
        }
        Relationships: []
      }
      gst_rates: {
        Row: {
          id: string
          company_id: string
          code: string
          description: string
          rate: number
          effective_from: string
          is_sample: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          code: string
          description: string
          rate: number
          effective_from: string
          is_sample?: boolean
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          code?: string
          description?: string
          rate?: number
          effective_from?: string
          is_sample?: boolean
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      gst_states: {
        Row: {
          code: string
          name: string
        }
        Insert: {
          code: string
          name: string
        }
        Update: {
          code?: string
          name?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          id: string
          company_id: string
          name: string
          is_default: boolean
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          is_default?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          is_default?: boolean
          created_at?: string
        }
        Relationships: []
      }
      payment_allocations: {
        Row: {
          id: string
          company_id: string
          payment_id: string
          sales_invoice_id: string | null
          purchase_id: string | null
          amount: number
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          payment_id: string
          sales_invoice_id?: string | null
          purchase_id?: string | null
          amount: number
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          payment_id?: string
          sales_invoice_id?: string | null
          purchase_id?: string | null
          amount?: number
          created_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          company_id: string
          payment_number: string
          direction: Database["public"]["Enums"]["payment_direction"]
          customer_id: string | null
          supplier_id: string | null
          payment_date: string
          method: Database["public"]["Enums"]["payment_method"]
          reference: string | null
          amount: number
          notes: string | null
          idempotency_key: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          payment_number: string
          direction: Database["public"]["Enums"]["payment_direction"]
          customer_id?: string | null
          supplier_id?: string | null
          payment_date: string
          method: Database["public"]["Enums"]["payment_method"]
          reference?: string | null
          amount: number
          notes?: string | null
          idempotency_key: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          payment_number?: string
          direction?: Database["public"]["Enums"]["payment_direction"]
          customer_id?: string | null
          supplier_id?: string | null
          payment_date?: string
          method?: Database["public"]["Enums"]["payment_method"]
          reference?: string | null
          amount?: number
          notes?: string | null
          idempotency_key?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      production_materials: {
        Row: {
          id: string
          company_id: string
          production_order_id: string
          product_id: string
          expected_quantity: number
          actual_quantity: number | null
          unit_cost: number | null
          total_cost: number | null
        }
        Insert: {
          id?: string
          company_id: string
          production_order_id: string
          product_id: string
          expected_quantity: number
          actual_quantity?: number | null
          unit_cost?: number | null
          total_cost?: number | null
        }
        Update: {
          id?: string
          company_id?: string
          production_order_id?: string
          product_id?: string
          expected_quantity?: number
          actual_quantity?: number | null
          unit_cost?: number | null
          total_cost?: number | null
        }
        Relationships: []
      }
      production_orders: {
        Row: {
          id: string
          company_id: string
          order_number: string
          status: Database["public"]["Enums"]["production_status"]
          product_id: string
          bom_id: string
          planned_quantity: number
          produced_quantity: number | null
          production_date: string
          material_cost: number | null
          unit_material_cost: number | null
          overhead_estimate_per_unit: number | null
          notes: string | null
          wastage_notes: string | null
          idempotency_key: string
          created_by: string | null
          created_at: string
          completed_at: string | null
          completed_by: string | null
          cancelled_at: string | null
          cancelled_by: string | null
        }
        Insert: {
          id?: string
          company_id: string
          order_number: string
          status?: Database["public"]["Enums"]["production_status"]
          product_id: string
          bom_id: string
          planned_quantity: number
          produced_quantity?: number | null
          production_date: string
          material_cost?: number | null
          unit_material_cost?: number | null
          overhead_estimate_per_unit?: number | null
          notes?: string | null
          wastage_notes?: string | null
          idempotency_key: string
          created_by?: string | null
          created_at?: string
          completed_at?: string | null
          completed_by?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          order_number?: string
          status?: Database["public"]["Enums"]["production_status"]
          product_id?: string
          bom_id?: string
          planned_quantity?: number
          produced_quantity?: number | null
          production_date?: string
          material_cost?: number | null
          unit_material_cost?: number | null
          overhead_estimate_per_unit?: number | null
          notes?: string | null
          wastage_notes?: string | null
          idempotency_key?: string
          created_by?: string | null
          created_at?: string
          completed_at?: string | null
          completed_by?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          company_id: string
          sku: string
          name: string
          description: string | null
          brand_id: string | null
          category_id: string | null
          stock_type: Database["public"]["Enums"]["stock_type"]
          uom: string
          hsn_code: string | null
          gst_rate_code: string
          purchase_price: number
          retail_price: number
          wholesale_price: number
          reorder_level: number
          is_active: boolean
          search_text: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          sku: string
          name: string
          description?: string | null
          brand_id?: string | null
          category_id?: string | null
          stock_type: Database["public"]["Enums"]["stock_type"]
          uom?: string
          hsn_code?: string | null
          gst_rate_code: string
          purchase_price?: number
          retail_price?: number
          wholesale_price?: number
          reorder_level?: number
          is_active?: boolean
          search_text?: never
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          sku?: string
          name?: string
          description?: string | null
          brand_id?: string | null
          category_id?: string | null
          stock_type?: Database["public"]["Enums"]["stock_type"]
          uom?: string
          hsn_code?: string | null
          gst_rate_code?: string
          purchase_price?: number
          retail_price?: number
          wholesale_price?: number
          reorder_level?: number
          is_active?: boolean
          search_text?: never
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_lines: {
        Row: {
          id: string
          company_id: string
          purchase_id: string
          line_no: number
          product_id: string
          product_name: string
          sku: string
          hsn_code: string | null
          uom: string
          quantity: number
          unit_price: number
          discount_amount: number
          taxable_value: number
          gst_rate: number
          cgst_amount: number
          sgst_amount: number
          igst_amount: number
          line_total: number
        }
        Insert: {
          id?: string
          company_id: string
          purchase_id: string
          line_no: number
          product_id: string
          product_name: string
          sku: string
          hsn_code?: string | null
          uom: string
          quantity: number
          unit_price: number
          discount_amount?: number
          taxable_value: number
          gst_rate: number
          cgst_amount?: number
          sgst_amount?: number
          igst_amount?: number
          line_total: number
        }
        Update: {
          id?: string
          company_id?: string
          purchase_id?: string
          line_no?: number
          product_id?: string
          product_name?: string
          sku?: string
          hsn_code?: string | null
          uom?: string
          quantity?: number
          unit_price?: number
          discount_amount?: number
          taxable_value?: number
          gst_rate?: number
          cgst_amount?: number
          sgst_amount?: number
          igst_amount?: number
          line_total?: number
        }
        Relationships: []
      }
      purchases: {
        Row: {
          id: string
          company_id: string
          purchase_number: string
          status: Database["public"]["Enums"]["document_status"]
          supplier_id: string
          supplier_invoice_number: string | null
          purchase_date: string
          supply_type: Database["public"]["Enums"]["supply_type"]
          on_credit: boolean
          subtotal: number
          cgst_total: number
          sgst_total: number
          igst_total: number
          tax_total: number
          round_off: number
          grand_total: number
          amount_paid: number
          notes: string | null
          idempotency_key: string
          created_by: string | null
          created_at: string
          cancelled_at: string | null
          cancelled_by: string | null
          cancel_reason: string | null
        }
        Insert: {
          id?: string
          company_id: string
          purchase_number: string
          status?: Database["public"]["Enums"]["document_status"]
          supplier_id: string
          supplier_invoice_number?: string | null
          purchase_date: string
          supply_type: Database["public"]["Enums"]["supply_type"]
          on_credit?: boolean
          subtotal: number
          cgst_total?: number
          sgst_total?: number
          igst_total?: number
          tax_total: number
          round_off?: number
          grand_total: number
          amount_paid?: number
          notes?: string | null
          idempotency_key: string
          created_by?: string | null
          created_at?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancel_reason?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          purchase_number?: string
          status?: Database["public"]["Enums"]["document_status"]
          supplier_id?: string
          supplier_invoice_number?: string | null
          purchase_date?: string
          supply_type?: Database["public"]["Enums"]["supply_type"]
          on_credit?: boolean
          subtotal?: number
          cgst_total?: number
          sgst_total?: number
          igst_total?: number
          tax_total?: number
          round_off?: number
          grand_total?: number
          amount_paid?: number
          notes?: string | null
          idempotency_key?: string
          created_by?: string | null
          created_at?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancel_reason?: string | null
        }
        Relationships: []
      }
      sales_invoices: {
        Row: {
          id: string
          company_id: string
          invoice_number: string | null
          status: Database["public"]["Enums"]["document_status"]
          sale_type: Database["public"]["Enums"]["customer_type"]
          customer_id: string
          customer_name: string
          customer_gstin: string | null
          customer_phone: string | null
          billing_address: string | null
          shipping_address: string | null
          invoice_date: string
          due_date: string | null
          place_of_supply: string
          supply_type: Database["public"]["Enums"]["supply_type"]
          prices_include_tax: boolean
          payment_terms: string | null
          subtotal: number
          discount_total: number
          cgst_total: number
          sgst_total: number
          igst_total: number
          tax_total: number
          round_off: number
          grand_total: number
          amount_paid: number
          notes: string | null
          seller_snapshot: Json | null
          idempotency_key: string
          created_by: string | null
          created_at: string
          updated_at: string
          posted_at: string | null
          posted_by: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancel_reason: string | null
        }
        Insert: {
          id?: string
          company_id: string
          invoice_number?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          sale_type: Database["public"]["Enums"]["customer_type"]
          customer_id: string
          customer_name: string
          customer_gstin?: string | null
          customer_phone?: string | null
          billing_address?: string | null
          shipping_address?: string | null
          invoice_date: string
          due_date?: string | null
          place_of_supply: string
          supply_type: Database["public"]["Enums"]["supply_type"]
          prices_include_tax: boolean
          payment_terms?: string | null
          subtotal?: number
          discount_total?: number
          cgst_total?: number
          sgst_total?: number
          igst_total?: number
          tax_total?: number
          round_off?: number
          grand_total?: number
          amount_paid?: number
          notes?: string | null
          seller_snapshot?: Json | null
          idempotency_key: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
          posted_at?: string | null
          posted_by?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancel_reason?: string | null
        }
        Update: {
          id?: string
          company_id?: string
          invoice_number?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          sale_type?: Database["public"]["Enums"]["customer_type"]
          customer_id?: string
          customer_name?: string
          customer_gstin?: string | null
          customer_phone?: string | null
          billing_address?: string | null
          shipping_address?: string | null
          invoice_date?: string
          due_date?: string | null
          place_of_supply?: string
          supply_type?: Database["public"]["Enums"]["supply_type"]
          prices_include_tax?: boolean
          payment_terms?: string | null
          subtotal?: number
          discount_total?: number
          cgst_total?: number
          sgst_total?: number
          igst_total?: number
          tax_total?: number
          round_off?: number
          grand_total?: number
          amount_paid?: number
          notes?: string | null
          seller_snapshot?: Json | null
          idempotency_key?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
          posted_at?: string | null
          posted_by?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancel_reason?: string | null
        }
        Relationships: []
      }
      sales_lines: {
        Row: {
          id: string
          company_id: string
          invoice_id: string
          line_no: number
          product_id: string
          product_name: string
          sku: string
          hsn_code: string | null
          uom: string
          stock_type: Database["public"]["Enums"]["stock_type"]
          quantity: number
          unit_price: number
          discount_type: Database["public"]["Enums"]["discount_type"] | null
          discount_value: number
          gross_amount: number
          discount_amount: number
          taxable_value: number
          gst_rate: number
          cgst_amount: number
          sgst_amount: number
          igst_amount: number
          line_total: number
          unit_cost: number | null
        }
        Insert: {
          id?: string
          company_id: string
          invoice_id: string
          line_no: number
          product_id: string
          product_name: string
          sku: string
          hsn_code?: string | null
          uom: string
          stock_type: Database["public"]["Enums"]["stock_type"]
          quantity: number
          unit_price: number
          discount_type?: Database["public"]["Enums"]["discount_type"] | null
          discount_value?: number
          gross_amount: number
          discount_amount?: number
          taxable_value: number
          gst_rate: number
          cgst_amount?: number
          sgst_amount?: number
          igst_amount?: number
          line_total: number
          unit_cost?: number | null
        }
        Update: {
          id?: string
          company_id?: string
          invoice_id?: string
          line_no?: number
          product_id?: string
          product_name?: string
          sku?: string
          hsn_code?: string | null
          uom?: string
          stock_type?: Database["public"]["Enums"]["stock_type"]
          quantity?: number
          unit_price?: number
          discount_type?: Database["public"]["Enums"]["discount_type"] | null
          discount_value?: number
          gross_amount?: number
          discount_amount?: number
          taxable_value?: number
          gst_rate?: number
          cgst_amount?: number
          sgst_amount?: number
          igst_amount?: number
          line_total?: number
          unit_cost?: number | null
        }
        Relationships: []
      }
      stock_balances: {
        Row: {
          company_id: string
          product_id: string
          location_id: string
          quantity: number
          avg_cost: number
          updated_at: string
        }
        Insert: {
          company_id: string
          product_id: string
          location_id: string
          quantity?: number
          avg_cost?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          product_id?: string
          location_id?: string
          quantity?: number
          avg_cost?: number
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          id: string
          company_id: string
          product_id: string
          location_id: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          quantity: number
          unit_cost: number
          movement_date: string
          source_type: string
          source_id: string | null
          source_line_id: string | null
          reference: string | null
          note: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          product_id: string
          location_id: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          quantity: number
          unit_cost?: number
          movement_date: string
          source_type: string
          source_id?: string | null
          source_line_id?: string | null
          reference?: string | null
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          product_id?: string
          location_id?: string
          movement_type?: Database["public"]["Enums"]["movement_type"]
          quantity?: number
          unit_cost?: number
          movement_date?: string
          source_type?: string
          source_id?: string | null
          source_line_id?: string | null
          reference?: string | null
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          id: string
          company_id: string
          name: string
          contact_person: string | null
          gstin: string | null
          state_code: string
          phone: string | null
          email: string | null
          address: string | null
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          contact_person?: string | null
          gstin?: string | null
          state_code: string
          phone?: string | null
          email?: string | null
          address?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          contact_person?: string | null
          gstin?: string | null
          state_code?: string
          phone?: string | null
          email?: string | null
          address?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_customer_balances: {
        Row: {
          id: string | null
          company_id: string | null
          name: string | null
          customer_type: Database["public"]["Enums"]["customer_type"] | null
          is_walk_in: boolean | null
          gstin: string | null
          state_code: string | null
          phone: string | null
          email: string | null
          billing_address: string | null
          shipping_address: string | null
          credit_days: number | null
          is_active: boolean | null
          contact_person: string | null
          total_invoiced: number | null
          total_paid: number | null
          outstanding: number | null
          overdue: number | null
          invoice_count: number | null
          last_invoice_date: string | null
        }
        Relationships: []
      }
      v_payments: {
        Row: {
          id: string | null
          company_id: string | null
          payment_number: string | null
          direction: Database["public"]["Enums"]["payment_direction"] | null
          customer_id: string | null
          supplier_id: string | null
          party_name: string | null
          payment_date: string | null
          method: Database["public"]["Enums"]["payment_method"] | null
          reference: string | null
          amount: number | null
          notes: string | null
          created_at: string | null
          created_by_name: string | null
          allocated_to: string | null
        }
        Relationships: []
      }
      v_product_stock: {
        Row: {
          id: string | null
          company_id: string | null
          sku: string | null
          name: string | null
          description: string | null
          stock_type: Database["public"]["Enums"]["stock_type"] | null
          uom: string | null
          hsn_code: string | null
          gst_rate_code: string | null
          purchase_price: number | null
          retail_price: number | null
          wholesale_price: number | null
          reorder_level: number | null
          is_active: boolean | null
          search_text: string | null
          brand_id: string | null
          brand_name: string | null
          is_own_brand: boolean | null
          category_id: string | null
          category_name: string | null
          quantity: number | null
          avg_cost: number | null
          stock_value: number | null
          is_low_stock: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      v_production_orders: {
        Row: {
          id: string | null
          company_id: string | null
          order_number: string | null
          status: Database["public"]["Enums"]["production_status"] | null
          product_id: string | null
          sku: string | null
          product_name: string | null
          bom_id: string | null
          bom_name: string | null
          planned_quantity: number | null
          produced_quantity: number | null
          production_date: string | null
          material_cost: number | null
          unit_material_cost: number | null
          overhead_estimate_per_unit: number | null
          notes: string | null
          wastage_notes: string | null
          created_at: string | null
          completed_at: string | null
        }
        Relationships: []
      }
      v_purchases: {
        Row: {
          id: string | null
          company_id: string | null
          purchase_number: string | null
          status: Database["public"]["Enums"]["document_status"] | null
          supplier_id: string | null
          supplier_name: string | null
          supplier_invoice_number: string | null
          purchase_date: string | null
          supply_type: Database["public"]["Enums"]["supply_type"] | null
          on_credit: boolean | null
          subtotal: number | null
          cgst_total: number | null
          sgst_total: number | null
          igst_total: number | null
          tax_total: number | null
          grand_total: number | null
          amount_paid: number | null
          balance_due: number | null
          line_count: number | null
          created_at: string | null
          notes: string | null
        }
        Relationships: []
      }
      v_sales_invoices: {
        Row: {
          id: string | null
          company_id: string | null
          invoice_number: string | null
          status: Database["public"]["Enums"]["document_status"] | null
          sale_type: Database["public"]["Enums"]["customer_type"] | null
          customer_id: string | null
          customer_name: string | null
          customer_gstin: string | null
          invoice_date: string | null
          due_date: string | null
          place_of_supply: string | null
          supply_type: Database["public"]["Enums"]["supply_type"] | null
          prices_include_tax: boolean | null
          subtotal: number | null
          discount_total: number | null
          cgst_total: number | null
          sgst_total: number | null
          igst_total: number | null
          tax_total: number | null
          round_off: number | null
          grand_total: number | null
          amount_paid: number | null
          balance_due: number | null
          payment_status: string | null
          line_count: number | null
          created_by: string | null
          created_at: string | null
          posted_at: string | null
        }
        Relationships: []
      }
      v_stock_movements: {
        Row: {
          id: string | null
          company_id: string | null
          product_id: string | null
          sku: string | null
          product_name: string | null
          stock_type: Database["public"]["Enums"]["stock_type"] | null
          uom: string | null
          movement_type: Database["public"]["Enums"]["movement_type"] | null
          quantity: number | null
          unit_cost: number | null
          value: number | null
          movement_date: string | null
          source_type: string | null
          source_id: string | null
          reference: string | null
          note: string | null
          created_by: string | null
          created_by_name: string | null
          created_at: string | null
        }
        Relationships: []
      }
      v_stock_reconciliation: {
        Row: {
          product_id: string | null
          company_id: string | null
          sku: string | null
          name: string | null
          balance_quantity: number | null
          ledger_quantity: number | null
          difference: number | null
        }
        Relationships: []
      }
      v_supplier_balances: {
        Row: {
          id: string | null
          company_id: string | null
          name: string | null
          contact_person: string | null
          gstin: string | null
          state_code: string | null
          phone: string | null
          email: string | null
          address: string | null
          is_active: boolean | null
          total_purchased: number | null
          total_paid: number | null
          outstanding: number | null
          purchase_count: number | null
          last_purchase_date: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cancel_production_order: {
        Args: {
          p_id: string
          p_reason: string
        }
        Returns: Json
      }
      cancel_purchase: {
        Args: {
          p_id: string
          p_reason: string
        }
        Returns: Json
      }
      cancel_sales_invoice: {
        Args: {
          p_id: string
          p_reason: string
        }
        Returns: Json
      }
      complete_production_order: {
        Args: {
          p_id: string
          p: Json
        }
        Returns: Json
      }
      create_production_order: {
        Args: {
          p: Json
        }
        Returns: Json
      }
      create_purchase: {
        Args: {
          p: Json
        }
        Returns: Json
      }
      create_sales_invoice: {
        Args: {
          p: Json
          p_post?: boolean
        }
        Returns: Json
      }
      dashboard_metrics: {
        Args: never
        Returns: Json
      }
      post_sales_invoice: {
        Args: {
          p_id: string
        }
        Returns: Json
      }
      post_stock_adjustment: {
        Args: {
          p: Json
        }
        Returns: Json
      }
      record_opening_stock: {
        Args: {
          p_product: string
          p_quantity: number
          p_unit_cost: number
          p_date?: string
        }
        Returns: Json
      }
      record_payment: {
        Args: {
          p: Json
        }
        Returns: Json
      }
      report_gst_summary: {
        Args: {
          p_from: string
          p_to: string
        }
        Returns: { direction: string; supply_type: Database["public"]["Enums"]["supply_type"]; gst_rate: number; taxable: number; cgst: number; sgst: number; igst: number; total_tax: number }[]
      }
      report_purchase_summary: {
        Args: {
          p_from: string
          p_to: string
        }
        Returns: { supplier_id: string; supplier_name: string; purchase_count: number; taxable: number; tax: number; total: number; paid: number; outstanding: number }[]
      }
      report_sales_by_date: {
        Args: {
          p_from: string
          p_to: string
        }
        Returns: { invoice_date: string; invoice_count: number; taxable: number; tax: number; total: number }[]
      }
      report_sales_by_product: {
        Args: {
          p_from: string
          p_to: string
        }
        Returns: { product_id: string; sku: string; product_name: string; stock_type: Database["public"]["Enums"]["stock_type"]; quantity: number; taxable: number; total: number; cost: number; margin: number }[]
      }
      update_sales_invoice_draft: {
        Args: {
          p_id: string
          p: Json
          p_post?: boolean
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "accounts" | "sales" | "inventory" | "production"
      customer_type: "retail" | "wholesale"
      discount_type: "percent" | "amount"
      document_status: "draft" | "posted" | "cancelled"
      movement_type: "opening_balance" | "purchase_receipt" | "sale" | "production_consumption" | "production_output" | "sales_return" | "purchase_return" | "stock_adjustment" | "sale_cancellation" | "purchase_cancellation"
      payment_direction: "receipt" | "payment"
      payment_method: "cash" | "upi" | "bank_transfer" | "cheque" | "card" | "other"
      production_status: "draft" | "completed" | "cancelled"
      stock_type: "raw_material" | "manufactured" | "trading"
      supply_type: "intra_state" | "inter_state"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
