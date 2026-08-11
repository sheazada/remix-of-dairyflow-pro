-- ============================================================
-- DairyFlow Pro — FULL SETUP (001-009 consolidated, idempotent)
-- Safe to run on a fresh OR existing project database.
-- ============================================================

-- ------------------------------------------------------------
-- FROM 001_schema.sql
-- ------------------------------------------------------------

-- ============================================================
-- ENUM TYPES
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM (
      'admin',
      'manager',
      'salesperson',
      'driver',
      'helper',
      'retailer'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


DO $$ BEGIN
  CREATE TYPE public.notification_channel AS ENUM (
      'email',
      'sms',
      'whatsapp'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


DO $$ BEGIN
  CREATE TYPE public.notification_status AS ENUM (
      'queued',
      'sending',
      'sent',
      'failed',
      'suppressed',
      'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notification_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    channel public.notification_channel NOT NULL,
    status public.notification_status DEFAULT 'queued'::public.notification_status NOT NULL,
    recipient text NOT NULL,
    recipient_name text,
    subject text,
    body text,
    template text,
    template_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    customer_id uuid,
    invoice_id uuid,
    delivery_id uuid,
    idempotency_key text,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    last_error text,
    provider text,
    provider_message_id text,
    last_attempt_at timestamp with time zone,
    next_retry_at timestamp with time zone,
    sent_at timestamp with time zone,
    triggered_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS public.access_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    user_id uuid,
    user_email text,
    user_roles text[],
    required_roles text[],
    route_path text,
    ip_address text,
    user_agent text,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    device_type text,
    os text,
    browser text,
    device_model text,
    is_new_device boolean DEFAULT false,
    login_status text,
    failure_reason text,
    CONSTRAINT access_audit_logs_event_type_check CHECK ((event_type = ANY (ARRAY['login_success'::text, 'login_failure'::text, 'logout'::text, 'access_denied'::text])))
);


CREATE TABLE IF NOT EXISTS public.app_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now()
);


CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    distributor_id uuid NOT NULL,
    user_id uuid,
    action text NOT NULL,
    entity_type text,
    entity_id uuid,
    old_value jsonb,
    new_value jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


CREATE TABLE IF NOT EXISTS public.collection_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    driver_collection_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    invoice_id uuid,
    allocated_amount numeric(12,2) DEFAULT 0 NOT NULL,
    payment_mode text DEFAULT 'cash'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT collection_allocations_payment_mode_check CHECK ((payment_mode = ANY (ARRAY['cash'::text, 'upi'::text, 'bank'::text, 'mixed'::text])))
);


CREATE TABLE IF NOT EXISTS public.crate_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    crate_type_id uuid NOT NULL,
    retailer_id uuid NOT NULL,
    delivery_id uuid,
    route_id uuid,
    transaction_type text NOT NULL,
    quantity integer NOT NULL,
    transaction_date date DEFAULT CURRENT_DATE NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT crate_transactions_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT crate_transactions_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['issue'::text, 'return'::text, 'damaged'::text, 'lost'::text, 'issue_correction'::text, 'return_correction'::text])))
);


CREATE TABLE IF NOT EXISTS public.crate_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    shop_name text,
    address text,
    mobile text,
    gstin text,
    credit_limit numeric(12,2) DEFAULT 0 NOT NULL,
    outstanding numeric(12,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    email text,
    latitude double precision,
    longitude double precision,
    notify_email boolean DEFAULT true NOT NULL,
    notify_sms boolean DEFAULT true NOT NULL,
    notify_whatsapp boolean DEFAULT true NOT NULL,
    whatsapp text,
    user_id uuid,
    retailer_code text,
    area text,
    assigned_route_id uuid,
    distributor_id uuid
);


CREATE TABLE IF NOT EXISTS public.invoice_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    product_id uuid NOT NULL,
    product_name text NOT NULL,
    hsn text,
    quantity numeric(12,2) NOT NULL,
    rate numeric(12,2) NOT NULL,
    discount numeric(12,2) DEFAULT 0 NOT NULL,
    gst_rate numeric(5,2) DEFAULT 0 NOT NULL,
    taxable numeric(12,2) NOT NULL,
    tax_amount numeric(12,2) NOT NULL,
    amount numeric(12,2) NOT NULL,
    ordered_quantity numeric(12,2),
    delivered_quantity numeric(12,2)
);


CREATE TABLE IF NOT EXISTS public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_no text NOT NULL,
    customer_id uuid NOT NULL,
    order_id uuid,
    invoice_date date DEFAULT CURRENT_DATE NOT NULL,
    due_date date,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    discount numeric(12,2) DEFAULT 0 NOT NULL,
    cgst numeric(12,2) DEFAULT 0 NOT NULL,
    sgst numeric(12,2) DEFAULT 0 NOT NULL,
    igst numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    paid numeric(12,2) DEFAULT 0 NOT NULL,
    balance numeric(12,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'unpaid'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    revision_count integer DEFAULT 0 NOT NULL,
    superseded_by uuid,
    is_revised boolean DEFAULT false NOT NULL
);


CREATE TABLE IF NOT EXISTS public.purchase_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_id uuid NOT NULL,
    product_id uuid NOT NULL,
    product_name text NOT NULL,
    quantity numeric(12,2) NOT NULL,
    rate numeric(12,2) NOT NULL,
    gst_rate numeric(5,2) DEFAULT 0 NOT NULL,
    amount numeric(12,2) NOT NULL,
    ordered_qty numeric(12,2),
    variance_type text,
    variance_qty numeric(12,2),
    variance_notes text,
    CONSTRAINT purchase_items_variance_type_check CHECK (((variance_type IS NULL) OR (variance_type = ANY (ARRAY['ok'::text, 'short'::text, 'extra'::text, 'damaged'::text, 'rejected'::text]))))
);


CREATE TABLE IF NOT EXISTS public.purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bill_no text NOT NULL,
    supplier_id uuid NOT NULL,
    purchase_date date DEFAULT CURRENT_DATE NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    gst numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    paid numeric(12,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'received'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    challan_url text,
    delivery_cycle_id uuid
);


CREATE TABLE IF NOT EXISTS public.deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid,
    order_id uuid,
    assigned_to text,
    route text,
    status text DEFAULT 'pending'::text NOT NULL,
    delivered_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    route_id uuid,
    received_by text,
    pod_photo_url text,
    pod_signature text,
    collected_amount numeric,
    collected_mode text,
    scheduled_date date,
    pod_latitude numeric,
    pod_longitude numeric,
    pod_accuracy_m numeric,
    pod_captured_at timestamp with time zone
);


CREATE TABLE IF NOT EXISTS public.delivery_cycles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cycle_code text NOT NULL,
    order_date date NOT NULL,
    delivery_date date NOT NULL,
    delivery_shift text DEFAULT 'morning'::text NOT NULL,
    cutoff_at timestamp with time zone NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT delivery_cycles_delivery_shift_check CHECK ((delivery_shift = ANY (ARRAY['morning'::text, 'evening'::text]))),
    CONSTRAINT delivery_cycles_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text, 'planned'::text, 'dispatched'::text, 'completed'::text])))
);


CREATE TABLE IF NOT EXISTS public.delivery_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    route_id uuid NOT NULL,
    run_date date DEFAULT CURRENT_DATE NOT NULL,
    driver_name text,
    helper_name text,
    vehicle_number text,
    vehicle_type text,
    odometer_start numeric,
    odometer_end numeric,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    status text DEFAULT 'scheduled'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    start_latitude numeric,
    start_longitude numeric,
    start_accuracy_m numeric,
    end_latitude numeric,
    end_longitude numeric,
    end_accuracy_m numeric,
    pickup_confirmed_at timestamp with time zone,
    delivery_status text DEFAULT 'planned'::text NOT NULL
);


CREATE TABLE IF NOT EXISTS public.demand_consolidation_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    demand_consolidation_id uuid NOT NULL,
    product_id uuid,
    product_name text NOT NULL,
    total_ordered_qty numeric(12,2) DEFAULT 0 NOT NULL,
    buffer_qty numeric(12,2) DEFAULT 0 NOT NULL,
    final_procurement_qty numeric(12,2) DEFAULT 0 NOT NULL,
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    total_value numeric(14,2) DEFAULT 0 NOT NULL,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS public.demand_consolidations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    consolidation_no text NOT NULL,
    delivery_cycle_id uuid NOT NULL,
    consolidation_date date NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    notes text,
    created_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT demand_consolidations_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'reviewed'::text, 'approved'::text, 'po_generated'::text])))
);


CREATE TABLE IF NOT EXISTS public.demand_source_orders (
    demand_consolidation_id uuid NOT NULL,
    order_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS public.distributors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_name text NOT NULL,
    legal_name text,
    gstin text,
    pan text,
    fssai text,
    address text,
    mobile text,
    email text,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    phone text,
    city text,
    state text,
    pincode text,
    logo_url text,
    invoice_prefix text DEFAULT 'INV'::text,
    financial_year_start date DEFAULT '2024-04-01'::date,
    currency text DEFAULT 'INR'::text
);


CREATE TABLE IF NOT EXISTS public.driver_collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collection_no text NOT NULL,
    driver_name text,
    route_id uuid,
    delivery_date date DEFAULT CURRENT_DATE NOT NULL,
    expected_amount numeric(12,2) DEFAULT 0 NOT NULL,
    collected_amount numeric(12,2) DEFAULT 0 NOT NULL,
    mismatch_amount numeric(12,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    notes text,
    reconciled_by uuid,
    reconciled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT driver_collections_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'reconciled'::text, 'investigating'::text])))
);


CREATE TABLE IF NOT EXISTS public.edit_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    record_type text NOT NULL,
    record_id uuid NOT NULL,
    route_id uuid,
    run_id uuid,
    delivery_id uuid,
    action text NOT NULL,
    field text,
    old_value text,
    new_value text,
    changed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    CONSTRAINT email_verification_tokens_expires_check CHECK ((expires_at > created_at))
);


CREATE TABLE IF NOT EXISTS public.expense_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#2563eb'::text NOT NULL,
    icon text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    description text,
    expense_date date DEFAULT CURRENT_DATE NOT NULL,
    payment_mode text DEFAULT 'cash'::text NOT NULL,
    reference_no text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS public.gps_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    success boolean NOT NULL,
    latitude double precision,
    longitude double precision,
    accuracy double precision,
    error_code text,
    error_message text,
    run_id uuid,
    delivery_id uuid,
    customer_id uuid,
    route_id uuid,
    invoice_id uuid,
    user_id uuid,
    user_agent text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    movement_type text NOT NULL,
    quantity numeric(12,2) NOT NULL,
    ref_type text,
    ref_id uuid,
    note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS public.invoice_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    revision_number integer DEFAULT 1 NOT NULL,
    original_invoice_id uuid,
    revised_by uuid,
    revision_reason text NOT NULL,
    changes_json jsonb NOT NULL,
    original_total numeric(12,2) NOT NULL,
    revised_total numeric(12,2) NOT NULL,
    revised_invoice_no text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS public.login_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    distributor_id uuid NOT NULL,
    login_at timestamp with time zone DEFAULT now() NOT NULL,
    logout_at timestamp with time zone,
    ip_address text,
    user_agent text,
    browser text,
    os text,
    device_type text,
    status text DEFAULT 'success'::text NOT NULL,
    failure_reason text,
    CONSTRAINT login_history_status_check CHECK ((status = ANY (ARRAY['success'::text, 'failed'::text, 'locked'::text])))
);


CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text DEFAULT 'general'::text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    product_name text NOT NULL,
    quantity numeric(12,2) NOT NULL,
    rate numeric(12,2) NOT NULL,
    amount numeric(12,2) NOT NULL
);


CREATE TABLE IF NOT EXISTS public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_no text NOT NULL,
    customer_id uuid NOT NULL,
    order_date date DEFAULT CURRENT_DATE NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    CONSTRAINT password_reset_tokens_expires_check CHECK ((expires_at > created_at))
);


CREATE TABLE IF NOT EXISTS public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_no text NOT NULL,
    customer_id uuid NOT NULL,
    invoice_id uuid,
    amount numeric(12,2) NOT NULL,
    mode text DEFAULT 'cash'::text NOT NULL,
    reference text,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    label text NOT NULL,
    description text,
    category text DEFAULT 'general'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS public.product_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    batch_no text,
    mfg_date date,
    expiry_date date,
    quantity numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    warehouse_id uuid,
    supplier_id uuid,
    cost_price numeric(12,2) DEFAULT 0,
    available_qty numeric(12,2) DEFAULT 0,
    reserved_qty numeric(12,2) DEFAULT 0,
    damaged_qty numeric(12,2) DEFAULT 0,
    status text DEFAULT 'active'::text,
    CONSTRAINT product_batches_status_check CHECK ((status = ANY (ARRAY['active'::text, 'blocked'::text, 'expired'::text, 'consumed'::text])))
);


CREATE TABLE IF NOT EXISTS public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    brand text,
    category text,
    unit text DEFAULT 'pcs'::text NOT NULL,
    hsn text,
    barcode text,
    mrp numeric(12,2) DEFAULT 0 NOT NULL,
    selling_price numeric(12,2) DEFAULT 0 NOT NULL,
    purchase_price numeric(12,2) DEFAULT 0 NOT NULL,
    gst_rate numeric(5,2) DEFAULT 0 NOT NULL,
    current_stock numeric(12,2) DEFAULT 0 NOT NULL,
    min_stock numeric(12,2) DEFAULT 0 NOT NULL,
    image_url text,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL,
    full_name text,
    email text,
    phone text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    account_status text DEFAULT 'active'::text NOT NULL,
    distributor_id uuid,
    CONSTRAINT profiles_account_status_check CHECK ((account_status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text, 'pending'::text, 'blocked'::text])))
);


CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS public.reminder_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    invoice_id uuid,
    template_id uuid,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    channel text NOT NULL,
    status text DEFAULT 'sent'::text NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reminder_logs_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'failed'::text])))
);


CREATE TABLE IF NOT EXISTS public.reminder_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    days_overdue integer NOT NULL,
    channel text NOT NULL,
    subject text,
    body text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reminder_templates_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'sms'::text, 'whatsapp'::text])))
);


CREATE TABLE IF NOT EXISTS public.retailer_ledger_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    retailer_id uuid NOT NULL,
    invoice_id uuid,
    entry_date date DEFAULT CURRENT_DATE NOT NULL,
    transaction_type text NOT NULL,
    debit_amount numeric DEFAULT 0 NOT NULL,
    credit_amount numeric DEFAULT 0 NOT NULL,
    running_balance numeric DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT retailer_ledger_entries_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['opening_balance'::text, 'invoice'::text, 'payment'::text, 'credit_note'::text, 'adjustment'::text])))
);


CREATE TABLE IF NOT EXISTS public.role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role text NOT NULL,
    permission_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS public.route_stops (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    route_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    sequence integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS public.routes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    area text,
    driver_name text,
    helper_name text,
    active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    capacity_units numeric,
    capacity_label text,
    vehicle_number text,
    vehicle_type text,
    start_latitude double precision,
    start_longitude double precision,
    max_stops integer
);


CREATE TABLE IF NOT EXISTS public.share_activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid,
    invoice_no text,
    customer_id uuid,
    channel text NOT NULL,
    recipient text,
    user_id uuid,
    user_email text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.share_activity_logs FORCE ROW LEVEL SECURITY;


CREATE TABLE IF NOT EXISTS public.stock_adjustment_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    adjustment_id uuid NOT NULL,
    product_id uuid NOT NULL,
    batch_id uuid,
    system_qty numeric(12,2) DEFAULT 0 NOT NULL,
    physical_qty numeric(12,2) DEFAULT 0 NOT NULL,
    diff_qty numeric(12,2) DEFAULT 0 NOT NULL,
    unit_cost numeric(12,2) DEFAULT 0,
    reason_detail text,
    created_at timestamp with time zone DEFAULT now()
);


CREATE TABLE IF NOT EXISTS public.stock_adjustments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    adjustment_no text NOT NULL,
    adjustment_date date DEFAULT CURRENT_DATE NOT NULL,
    reason text,
    status text DEFAULT 'draft'::text NOT NULL,
    warehouse_id uuid,
    notes text,
    requested_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT stock_adjustments_reason_check CHECK ((reason = ANY (ARRAY['physical_count'::text, 'damage'::text, 'expiry'::text, 'manual_correction'::text, 'return_from_retailer'::text, 'supplier_return'::text]))),
    CONSTRAINT stock_adjustments_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending'::text, 'approved'::text, 'rejected'::text, 'posted'::text])))
);


CREATE TABLE IF NOT EXISTS public.stock_reconciliation_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recon_id uuid NOT NULL,
    product_id uuid NOT NULL,
    batch_id uuid,
    system_qty numeric(12,2) DEFAULT 0 NOT NULL,
    physical_qty numeric(12,2) DEFAULT 0 NOT NULL,
    diff_qty numeric(12,2) DEFAULT 0 NOT NULL,
    variance_reason text,
    created_at timestamp with time zone DEFAULT now()
);


CREATE TABLE IF NOT EXISTS public.stock_reconciliations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recon_no text NOT NULL,
    recon_date date DEFAULT CURRENT_DATE NOT NULL,
    warehouse_id uuid,
    conducted_by uuid,
    notes text,
    status text DEFAULT 'in_progress'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    CONSTRAINT stock_reconciliations_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'completed'::text, 'cancelled'::text])))
);


CREATE TABLE IF NOT EXISTS public.sudha_claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    claim_no text NOT NULL,
    purchase_id uuid,
    purchase_item_id uuid,
    claim_date date DEFAULT CURRENT_DATE NOT NULL,
    claim_type text NOT NULL,
    product_id uuid,
    product_name text NOT NULL,
    quantity numeric(12,2) DEFAULT 0 NOT NULL,
    claim_amount numeric(12,2) DEFAULT 0 NOT NULL,
    reason text NOT NULL,
    evidence_url text,
    status text DEFAULT 'pending'::text NOT NULL,
    submitted_to_sudha_at timestamp with time zone,
    sudha_response text,
    credited_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sudha_claims_claim_type_check CHECK ((claim_type = ANY (ARRAY['short_supply'::text, 'damaged'::text, 'quality'::text, 'packaging'::text, 'expired_early'::text]))),
    CONSTRAINT sudha_claims_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'submitted'::text, 'approved'::text, 'rejected'::text, 'credited'::text])))
);


CREATE TABLE IF NOT EXISTS public.supplier_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_no text NOT NULL,
    supplier_id uuid NOT NULL,
    purchase_id uuid,
    amount numeric DEFAULT 0 NOT NULL,
    mode text DEFAULT 'cash'::text NOT NULL,
    reference text,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    company text,
    mobile text,
    gstin text,
    address text,
    outstanding numeric(12,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL
);


CREATE TABLE IF NOT EXISTS public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    distributor_id uuid NOT NULL,
    email text,
    mobile text,
    password_hash text NOT NULL,
    full_name text NOT NULL,
    employee_id text,
    retailer_id text,
    role text NOT NULL,
    branch_id uuid,
    status text DEFAULT 'pending_verification'::text NOT NULL,
    email_verified boolean DEFAULT false,
    mobile_verified boolean DEFAULT false,
    last_login_at timestamp with time zone,
    last_login_ip text,
    failed_login_attempts integer DEFAULT 0,
    locked_until timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT users_email_or_mobile CHECK (((email IS NOT NULL) OR (mobile IS NOT NULL))),
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['distributor'::text, 'manager'::text, 'accountant'::text, 'warehouse'::text, 'salesman'::text, 'delivery_boy'::text, 'retailer'::text]))),
    CONSTRAINT users_status_check CHECK ((status = ANY (ARRAY['pending_verification'::text, 'active'::text, 'inactive'::text, 'suspended'::text, 'blocked'::text])))
);


CREATE TABLE IF NOT EXISTS public.warehouses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    location text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


-- ============================================================
-- VIEWS
-- ============================================================

CREATE OR REPLACE VIEW public.daily_reconciliation WITH (security_invoker='on') AS
 SELECT p.purchase_date AS date,
    p.bill_no AS challan_no,
    pi.product_name,
    pi.ordered_qty AS ordered_from_sudha,
    pi.quantity AS received_from_sudha,
    COALESCE(d.distributed_qty, (0)::numeric) AS distributed_to_retailers,
    (pi.quantity - COALESCE(d.distributed_qty, (0)::numeric)) AS leftover,
    pi.variance_type,
    pi.variance_qty AS variance_amount
   FROM ((public.purchases p
     JOIN public.purchase_items pi ON ((pi.purchase_id = p.id)))
     LEFT JOIN LATERAL ( SELECT sum(ii.quantity) AS distributed_qty
           FROM (public.invoices i
             JOIN public.invoice_items ii ON ((ii.invoice_id = i.id)))
          WHERE ((i.invoice_date = p.purchase_date) AND (ii.product_name = pi.product_name) AND (i.status <> 'void'::text))) d ON (true))
  WHERE (p.delivery_cycle_id IS NOT NULL);


-- ------------------------------------------------------------
-- FROM 002_functions.sql
-- ------------------------------------------------------------

-- ============================================================
-- FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.apply_delivery_quantities(_invoice_id uuid, _items jsonb) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  rec jsonb;
  v_item_id uuid;
  v_qty numeric;
  v_rate numeric;
  v_discount numeric;
  v_gst numeric;
  v_taxable numeric;
  v_tax numeric;
  v_ordered numeric;
  v_all_full boolean := true;
  v_all_zero boolean := true;
  v_row_count int := 0;
BEGIN
  FOR rec IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_item_id := (rec->>'id')::uuid;
    v_qty := GREATEST(COALESCE((rec->>'delivered')::numeric, 0), 0);
    SELECT rate, discount, gst_rate, COALESCE(ordered_quantity, quantity)
      INTO v_rate, v_discount, v_gst, v_ordered
      FROM public.invoice_items
      WHERE id = v_item_id AND invoice_id = _invoice_id;
    IF NOT FOUND THEN CONTINUE; END IF;
    v_qty := LEAST(v_qty, v_ordered);
    v_taxable := GREATEST(v_qty * v_rate - COALESCE(v_discount, 0), 0);
    v_tax := v_taxable * COALESCE(v_gst, 0) / 100;
    UPDATE public.invoice_items SET
      ordered_quantity = v_ordered,
      delivered_quantity = v_qty,
      quantity = v_qty,
      taxable = v_taxable,
      tax_amount = v_tax,
      amount = v_taxable + v_tax
    WHERE id = v_item_id;
    v_row_count := v_row_count + 1;
    IF v_qty < v_ordered THEN v_all_full := false; END IF;
    IF v_qty > 0 THEN v_all_zero := false; END IF;
  END LOOP;

  IF v_row_count = 0 THEN RETURN 'delivered'; END IF;
  IF v_all_zero THEN RETURN 'failed'; END IF;
  IF v_all_full THEN RETURN 'delivered'; END IF;
  RETURN 'partially_delivered';
END;
$$;


CREATE OR REPLACE FUNCTION public.can_manage_finance(_uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN ('admin','manager'))
$$;


CREATE OR REPLACE FUNCTION public.can_manage_sales(_uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN ('admin','manager','salesperson'))
$$;


CREATE OR REPLACE FUNCTION public.create_demand_consolidation(p_delivery_cycle_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_cycle RECORD; v_consolidation_id UUID; v_consolidation_no TEXT; v_user_id UUID;
BEGIN
  IF NOT public.can_manage_sales(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v_cycle FROM public.delivery_cycles WHERE id = p_delivery_cycle_id;
  IF v_cycle IS NULL THEN RAISE EXCEPTION 'Delivery cycle not found'; END IF;
  v_user_id := auth.uid();
  v_consolidation_no := public.generate_consolidation_no(v_cycle.delivery_date);
  INSERT INTO public.demand_consolidations (consolidation_no, delivery_cycle_id, consolidation_date, created_by)
  VALUES (v_consolidation_no, p_delivery_cycle_id, v_cycle.delivery_date, v_user_id)
  RETURNING id INTO v_consolidation_id;

  WITH order_items_agg AS (
    SELECT oi.product_id, oi.product_name, SUM(oi.quantity) AS total_qty, AVG(oi.rate) AS avg_price
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.order_date = v_cycle.order_date AND o.status NOT IN ('cancelled', 'delivered')
    GROUP BY oi.product_id, oi.product_name
  )
  INSERT INTO public.demand_consolidation_items (
    demand_consolidation_id, product_id, product_name, total_ordered_qty, buffer_qty, final_procurement_qty, unit_price, total_value)
  SELECT v_consolidation_id, product_id, product_name, total_qty, 0, total_qty, avg_price, total_qty * avg_price
  FROM order_items_agg;

  INSERT INTO public.demand_source_orders (demand_consolidation_id, order_id)
  SELECT v_consolidation_id, o.id FROM public.orders o
  WHERE o.order_date = v_cycle.order_date AND o.status NOT IN ('cancelled', 'delivered');

  UPDATE public.delivery_cycles SET status = 'planned' WHERE id = p_delivery_cycle_id;
  RETURN v_consolidation_id;
END; $$;


CREATE OR REPLACE FUNCTION public.create_notification(_user_id uuid, _type text, _title text, _body text, _data jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF auth.uid() <> _user_id AND NOT public.can_manage_sales(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (_user_id, COALESCE(_type,'general'), _title, _body, COALESCE(_data,'{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;


CREATE OR REPLACE FUNCTION public.enqueue_delivery_notifications(_delivery_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  d record;
  c record;
  inv record;
  items_json jsonb;
  payload jsonb;
  subject text;
  body text;
  inserted int := 0;
  status_label text;
  ikey text;
  phone_e164 text;
  wa_e164 text;
BEGIN
  SELECT * INTO d FROM public.deliveries WHERE id = _delivery_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF d.status IS NULL OR d.status IN ('planned','en_route') THEN
    -- only enqueue on terminal delivery outcomes
    RETURN 0;
  END IF;

  SELECT * INTO inv FROM public.invoices WHERE id = d.invoice_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT * INTO c FROM public.customers WHERE id = inv.customer_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'name', product_name,
      'ordered', COALESCE(ordered_quantity, quantity),
      'delivered', COALESCE(delivered_quantity, quantity),
      'rate', rate,
      'amount', amount
    ) ORDER BY product_name), '[]'::jsonb)
    INTO items_json
    FROM public.invoice_items WHERE invoice_id = inv.id;

  status_label := CASE d.status
    WHEN 'delivered' THEN 'Delivered'
    WHEN 'partially_delivered' THEN 'Partially delivered'
    WHEN 'failed' THEN 'Delivery failed'
    ELSE initcap(replace(d.status::text,'_',' '))
  END;

  payload := jsonb_build_object(
    'shop_name', COALESCE(c.shop_name, c.name),
    'customer_name', c.name,
    'invoice_no', inv.invoice_no,
    'invoice_total', inv.total,
    'invoice_balance', inv.balance,
    'outstanding', c.outstanding,
    'status', d.status,
    'status_label', status_label,
    'delivered_at', d.delivered_at,
    'collected_amount', COALESCE(d.collected_amount, 0),
    'collected_mode', d.collected_mode,
    'received_by', d.received_by,
    'items', items_json
  );

  subject := format('%s · Invoice %s', status_label, inv.invoice_no);

  body := format(
    E'Hi %s,\n\n%s for invoice %s (₹%s).\nCollected: ₹%s%s.\nOutstanding balance: ₹%s.\n\nThank you.',
    COALESCE(c.shop_name, c.name),
    status_label,
    inv.invoice_no,
    to_char(COALESCE(inv.total,0), 'FM999999990.00'),
    to_char(COALESCE(d.collected_amount,0), 'FM999999990.00'),
    CASE WHEN d.collected_mode IS NOT NULL THEN ' ('||d.collected_mode||')' ELSE '' END,
    to_char(COALESCE(c.outstanding,0), 'FM999999990.00')
  );

  -- Idempotency: one row per delivery+status+channel. Re-saves that change status enqueue a fresh row.
  -- EMAIL
  IF COALESCE(c.notify_email, true) AND c.email IS NOT NULL AND c.email <> '' THEN
    ikey := format('delivery:%s:%s:email', d.id, d.status);
    INSERT INTO public.notification_logs(
      channel, recipient, recipient_name, subject, body,
      template, template_data, customer_id, invoice_id, delivery_id, idempotency_key
    ) VALUES (
      'email', c.email, COALESCE(c.shop_name, c.name), subject, body,
      'delivery-status', payload, c.id, inv.id, d.id, ikey
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
    IF FOUND THEN inserted := inserted + 1; END IF;
  END IF;

  -- SMS
  phone_e164 := NULLIF(regexp_replace(COALESCE(c.phone,''), '\s|-', '', 'g'), '');
  IF COALESCE(c.notify_sms, true) AND phone_e164 IS NOT NULL THEN
    ikey := format('delivery:%s:%s:sms', d.id, d.status);
    INSERT INTO public.notification_logs(
      channel, recipient, recipient_name, subject, body,
      template, template_data, customer_id, invoice_id, delivery_id, idempotency_key
    ) VALUES (
      'sms', phone_e164, COALESCE(c.shop_name, c.name), subject, body,
      'delivery-status', payload, c.id, inv.id, d.id, ikey
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
    IF FOUND THEN inserted := inserted + 1; END IF;
  END IF;

  -- WHATSAPP
  wa_e164 := NULLIF(regexp_replace(COALESCE(c.whatsapp, c.phone,''), '\s|-', '', 'g'), '');
  IF COALESCE(c.notify_whatsapp, true) AND wa_e164 IS NOT NULL THEN
    ikey := format('delivery:%s:%s:whatsapp', d.id, d.status);
    INSERT INTO public.notification_logs(
      channel, recipient, recipient_name, subject, body,
      template, template_data, customer_id, invoice_id, delivery_id, idempotency_key
    ) VALUES (
      'whatsapp', wa_e164, COALESCE(c.shop_name, c.name), subject, body,
      'delivery-status', payload, c.id, inv.id, d.id, ikey
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
    IF FOUND THEN inserted := inserted + 1; END IF;
  END IF;

  RETURN inserted;
END;
$$;


CREATE OR REPLACE FUNCTION public.enqueue_run_en_route_notifications(_run_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  r record;
  d record;
  c record;
  inv record;
  payload jsonb;
  subject text;
  body text;
  ikey text;
  phone_e164 text;
  wa_e164 text;
  inserted int := 0;
BEGIN
  SELECT id, route_id, run_date, driver_name, vehicle_number
    INTO r FROM public.delivery_runs WHERE id = _run_id;
  IF NOT FOUND OR r.route_id IS NULL THEN RETURN 0; END IF;

  FOR d IN
    SELECT * FROM public.deliveries
     WHERE route_id = r.route_id
       AND COALESCE(scheduled_date, delivered_at::date, created_at::date) = r.run_date
  LOOP
    SELECT * INTO inv FROM public.invoices WHERE id = d.invoice_id;
    IF NOT FOUND THEN CONTINUE; END IF;
    SELECT * INTO c FROM public.customers WHERE id = inv.customer_id;
    IF NOT FOUND THEN CONTINUE; END IF;

    payload := jsonb_build_object(
      'shop_name', COALESCE(c.shop_name, c.name),
      'customer_name', c.name,
      'invoice_no', inv.invoice_no,
      'invoice_total', inv.total,
      'invoice_balance', inv.balance,
      'outstanding', c.outstanding,
      'status', 'en_route',
      'status_label', 'Out for delivery',
      'driver_name', r.driver_name,
      'vehicle_number', r.vehicle_number,
      'run_date', r.run_date
    );
    subject := format('Out for delivery · Invoice %s', inv.invoice_no);
    body := format(
      E'Hi %s,\nYour order (invoice %s, ₹%s) is out for delivery today%s.\nThank you.',
      COALESCE(c.shop_name, c.name),
      inv.invoice_no,
      to_char(COALESCE(inv.total,0), 'FM999999990.00'),
      CASE WHEN r.driver_name IS NOT NULL THEN ' with '||r.driver_name ELSE '' END
    );

    IF COALESCE(c.notify_email, true) AND c.email IS NOT NULL AND c.email <> '' THEN
      ikey := format('run:%s:en_route:%s:email', r.id, d.id);
      INSERT INTO public.notification_logs(
        channel, recipient, recipient_name, subject, body,
        template, template_data, customer_id, invoice_id, delivery_id, idempotency_key
      ) VALUES (
        'email', c.email, COALESCE(c.shop_name, c.name), subject, body,
        'delivery-en-route', payload, c.id, inv.id, d.id, ikey
      ) ON CONFLICT (idempotency_key) DO NOTHING;
      IF FOUND THEN inserted := inserted + 1; END IF;
    END IF;

    phone_e164 := NULLIF(regexp_replace(COALESCE(c.phone,''), '\s|-', '', 'g'), '');
    IF COALESCE(c.notify_sms, true) AND phone_e164 IS NOT NULL THEN
      ikey := format('run:%s:en_route:%s:sms', r.id, d.id);
      INSERT INTO public.notification_logs(
        channel, recipient, recipient_name, subject, body,
        template, template_data, customer_id, invoice_id, delivery_id, idempotency_key
      ) VALUES (
        'sms', phone_e164, COALESCE(c.shop_name, c.name), subject, body,
        'delivery-en-route', payload, c.id, inv.id, d.id, ikey
      ) ON CONFLICT (idempotency_key) DO NOTHING;
      IF FOUND THEN inserted := inserted + 1; END IF;
    END IF;

    wa_e164 := NULLIF(regexp_replace(COALESCE(c.whatsapp, c.phone,''), '\s|-', '', 'g'), '');
    IF COALESCE(c.notify_whatsapp, true) AND wa_e164 IS NOT NULL THEN
      ikey := format('run:%s:en_route:%s:whatsapp', r.id, d.id);
      INSERT INTO public.notification_logs(
        channel, recipient, recipient_name, subject, body,
        template, template_data, customer_id, invoice_id, delivery_id, idempotency_key
      ) VALUES (
        'whatsapp', wa_e164, COALESCE(c.shop_name, c.name), subject, body,
        'delivery-en-route', payload, c.id, inv.id, d.id, ikey
      ) ON CONFLICT (idempotency_key) DO NOTHING;
      IF FOUND THEN inserted := inserted + 1; END IF;
    END IF;
  END LOOP;
  RETURN inserted;
END;
$$;


CREATE OR REPLACE FUNCTION public.ensure_delivery_cycle(p_delivery_date date, p_shift text DEFAULT 'morning'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_cycle_id UUID; v_order_date DATE; v_cutoff TIMESTAMPTZ;
BEGIN
  IF NOT public.can_manage_sales(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  v_order_date := p_delivery_date - INTERVAL '1 day';
  v_cutoff := (p_delivery_date::TIMESTAMP - INTERVAL '9 hours')::TIMESTAMPTZ;
  SELECT id INTO v_cycle_id FROM public.delivery_cycles WHERE delivery_date = p_delivery_date AND delivery_shift = p_shift LIMIT 1;
  IF v_cycle_id IS NULL THEN
    INSERT INTO public.delivery_cycles (cycle_code, order_date, delivery_date, delivery_shift, cutoff_at)
    VALUES (public.generate_cycle_code(v_order_date, p_shift), v_order_date, p_delivery_date, p_shift, v_cutoff)
    RETURNING id INTO v_cycle_id;
  END IF;
  RETURN v_cycle_id;
END; $$;


CREATE OR REPLACE FUNCTION public.generate_adjustment_no() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v TEXT; n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM public.stock_adjustments WHERE adjustment_date = CURRENT_DATE;
  v := 'ADJ-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((n+1)::TEXT, 3, '0');
  RETURN v;
END;
$$;


CREATE OR REPLACE FUNCTION public.generate_claim_no() RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM public.sudha_claims WHERE claim_date = CURRENT_DATE;
  RETURN 'CLM-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((n+1)::TEXT, 3, '0');
END; $$;


CREATE OR REPLACE FUNCTION public.generate_collection_no() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM public.driver_collections WHERE delivery_date = CURRENT_DATE;
  RETURN 'COL-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((n+1)::TEXT, 3, '0');
END; $$;


CREATE OR REPLACE FUNCTION public.generate_consolidation_no(p_date date) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.demand_consolidations WHERE consolidation_date = p_date;
  RETURN 'DC-' || TO_CHAR(p_date, 'YYYYMMDD') || '-' || LPAD((v_count + 1)::TEXT, 3, '0');
END; $$;


CREATE OR REPLACE FUNCTION public.generate_cycle_code(p_order_date date, p_shift text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.delivery_cycles WHERE order_date = p_order_date AND delivery_shift = p_shift;
  RETURN 'CYC-' || TO_CHAR(p_order_date, 'YYYYMMDD') || '-' || UPPER(LEFT(p_shift, 1)) || '-' || LPAD((v_count + 1)::TEXT, 3, '0');
END; $$;


CREATE OR REPLACE FUNCTION public.generate_employee_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.employee_id IS NULL AND NEW.role != 'retailer' THEN
    NEW.employee_id := 'EMP-' || LPAD(
      (SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id FROM 5) AS INTEGER)), 0) + 1
       FROM public.users
       WHERE employee_id IS NOT NULL AND role != 'retailer')::TEXT,
      6, '0'
    );
  END IF;
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.generate_recon_no() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v TEXT; n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM public.stock_reconciliations WHERE recon_date = CURRENT_DATE;
  v := 'REC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((n+1)::TEXT, 3, '0');
  RETURN v;
END;
$$;


CREATE OR REPLACE FUNCTION public.generate_retailer_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.retailer_id IS NULL AND NEW.role = 'retailer' THEN
    NEW.retailer_id := 'RET-' || LPAD(
      (SELECT COALESCE(MAX(CAST(SUBSTRING(retailer_id FROM 5) AS INTEGER)), 0) + 1
       FROM public.users
       WHERE retailer_id IS NOT NULL AND role = 'retailer')::TEXT,
      6, '0'
    );
  END IF;
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.get_account_status(_user_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT COALESCE(
    (SELECT account_status FROM public.profiles WHERE id = _user_id),
    'active'
  );
$$;


CREATE OR REPLACE FUNCTION public.get_app_setting(_key text) RETURNS text
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT value FROM public.app_settings WHERE key = _key LIMIT 1;
$$;


CREATE OR REPLACE FUNCTION public.get_crate_balance_as_of(p_as_of_date date DEFAULT CURRENT_DATE, p_crate_type_id uuid DEFAULT NULL::uuid) RETURNS TABLE(retailer_id uuid, retailer_name text, shop_name text, crate_type_id uuid, crate_type_name text, balance bigint)
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.name, c.shop_name, ct.id, ct.name,
    COALESCE(SUM(
      CASE
        WHEN t.transaction_type IN ('issue','issue_correction') THEN t.quantity
        WHEN t.transaction_type IN ('return','return_correction','damaged','lost') THEN -t.quantity
        ELSE 0
      END
    ), 0)::BIGINT
  FROM public.crate_transactions t
  JOIN public.customers c ON c.id = t.retailer_id
  JOIN public.crate_types ct ON ct.id = t.crate_type_id
  WHERE t.transaction_date <= p_as_of_date
    AND (p_crate_type_id IS NULL OR ct.id = p_crate_type_id)
  GROUP BY c.id, c.name, c.shop_name, ct.id, ct.name;
END; $$;


CREATE OR REPLACE FUNCTION public.get_customer_by_user_email(_email text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
  v_customer_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = _email LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT id INTO v_customer_id FROM public.customers WHERE user_id = v_user_id LIMIT 1;
  RETURN v_customer_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.get_near_expiry_stock(_days integer DEFAULT 30) RETURNS TABLE(product_name text, batch_no text, expiry_date date, available_qty numeric, days_remaining integer)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT p.name, pb.batch_no, pb.expiry_date::DATE, pb.available_qty,
    (pb.expiry_date::DATE - CURRENT_DATE)::INT
  FROM public.product_batches pb
  JOIN public.products p ON p.id = pb.product_id
  WHERE pb.expiry_date IS NOT NULL
    AND pb.expiry_date > CURRENT_DATE
    AND pb.expiry_date <= CURRENT_DATE + (_days || ' days')::INTERVAL
    AND pb.available_qty > 0
    AND pb.status = 'active'
  ORDER BY pb.expiry_date ASC;
END; $$;


CREATE OR REPLACE FUNCTION public.get_next_revision_no(_invoice_id uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(MAX(revision_number), 0) + 1 FROM public.invoice_revisions WHERE invoice_id = _invoice_id;
$$;


CREATE OR REPLACE FUNCTION public.get_permission_id(_name text) RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT id FROM public.permissions WHERE name = _name LIMIT 1;
$$;


CREATE OR REPLACE FUNCTION public.get_retailer_code(_user_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT retailer_code FROM public.customers WHERE user_id = _user_id LIMIT 1;
$$;


CREATE OR REPLACE FUNCTION public.get_stock_valuation() RETURNS TABLE(product_id uuid, product_name text, total_qty numeric, available_qty numeric, damaged_qty numeric, avg_cost numeric, total_value numeric)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name,
    COALESCE(SUM(pb.quantity), 0),
    COALESCE(SUM(pb.available_qty), 0),
    COALESCE(SUM(pb.damaged_qty), 0),
    COALESCE(AVG(NULLIF(pb.cost_price, 0)), p.purchase_price),
    COALESCE(SUM(pb.available_qty * NULLIF(pb.cost_price, 0)), 0)
  FROM public.products p
  LEFT JOIN public.product_batches pb ON pb.product_id = p.id AND pb.status = 'active'
  WHERE p.status = 'active'
  GROUP BY p.id, p.name, p.purchase_price
  HAVING COALESCE(SUM(pb.quantity), 0) > 0
  ORDER BY p.name;
END; $$;


CREATE OR REPLACE FUNCTION public.get_unread_notification_count(_user_id uuid) RETURNS integer
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  SELECT COUNT(*)::INTEGER
    FROM public.notifications
   WHERE user_id = auth.uid()
     AND (_user_id IS NULL OR _user_id = auth.uid())
     AND read_at IS NULL;
$$;


CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid) RETURNS TABLE(permission_name text, permission_label text, category text)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT DISTINCT p.name, p.label, p.category
  FROM public.permissions p
  JOIN public.role_permissions rp ON rp.permission_id = p.id
  JOIN public.users u ON u.role = rp.role
  WHERE u.id = _user_id;
$$;


CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  SELECT COUNT(*) INTO v_count FROM public.user_roles;
  IF v_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'salesperson');
  END IF;
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_name text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.users u ON u.role = rp.role
    WHERE u.id = _user_id
      AND rp.permission_id = (SELECT id FROM public.permissions WHERE name = _permission_name)
  );
$$;


CREATE OR REPLACE FUNCTION public.has_reminder_been_sent(_invoice_id uuid, _template_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.reminder_logs WHERE invoice_id = _invoice_id AND template_id = _template_id AND status = 'sent');
$$;


CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;


CREATE OR REPLACE FUNCTION public.is_account_active(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT COALESCE(
    (SELECT account_status FROM public.profiles WHERE id = _user_id),
    'active'
  ) = 'active';
$$;


CREATE OR REPLACE FUNCTION public.is_internal_staff(_uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role IN ('admin','manager','salesperson','driver','helper')
  )
$$;


CREATE OR REPLACE FUNCTION public.is_staff(_uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid)
$$;


CREATE OR REPLACE FUNCTION public.link_customer_to_user(_customer_id uuid, _email text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can link customers to users';
  END IF;
  SELECT id INTO v_user_id FROM auth.users WHERE email = _email LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth user found with email: %', _email;
  END IF;
  UPDATE public.customers SET user_id = NULL WHERE user_id = v_user_id AND id <> _customer_id;
  UPDATE public.customers SET user_id = v_user_id WHERE id = _customer_id;
  RETURN _customer_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.log_access_event(_event_type text, _user_id uuid, _user_email text, _user_roles text[], _required_roles text[], _route_path text, _ip_address text, _user_agent text, _reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.access_audit_logs (
    event_type, user_id, user_email, user_roles, required_roles,
    route_path, ip_address, user_agent, reason
  ) VALUES (
    _event_type, _user_id, _user_email, _user_roles, _required_roles,
    _route_path, _ip_address, _user_agent, _reason
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.log_delivery_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  f text; old_v text; new_v text; uid uuid;
  fields text[] := ARRAY['status','delivered_at','received_by','collected_amount',
    'collected_mode','route_id','assigned_to','notes','scheduled_date',
    'pod_photo_url','pod_signature'];
BEGIN
  uid := auth.uid();
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;
  FOREACH f IN ARRAY fields LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', f, f) INTO old_v, new_v USING OLD, NEW;
    IF old_v IS DISTINCT FROM new_v THEN
      INSERT INTO public.edit_audit_logs(record_type, record_id, route_id, delivery_id, action, field, old_value, new_value, changed_by)
      VALUES ('delivery', NEW.id, NEW.route_id, NEW.id, 'updated', f, old_v, new_v, uid);
    END IF;
  END LOOP;
  RETURN NEW;
END $_$;


CREATE OR REPLACE FUNCTION public.log_delivery_run_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  f text; old_v text; new_v text; uid uuid;
  fields text[] := ARRAY['driver_name','helper_name','vehicle_number','vehicle_type',
    'odometer_start','odometer_end','started_at','ended_at','pickup_confirmed_at',
    'status','delivery_status','notes'];
BEGIN
  uid := auth.uid();
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.edit_audit_logs(record_type, record_id, route_id, run_id, action, changed_by)
    VALUES ('delivery_run', NEW.id, NEW.route_id, NEW.id, 'created', uid);
    RETURN NEW;
  END IF;
  FOREACH f IN ARRAY fields LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', f, f) INTO old_v, new_v USING OLD, NEW;
    IF old_v IS DISTINCT FROM new_v THEN
      INSERT INTO public.edit_audit_logs(record_type, record_id, route_id, run_id, action, field, old_value, new_value, changed_by)
      VALUES ('delivery_run', NEW.id, NEW.route_id, NEW.id, 'updated', f, old_v, new_v, uid);
    END IF;
  END LOOP;
  RETURN NEW;
END $_$;


CREATE OR REPLACE FUNCTION public.post_stock_adjustment(_adjustment_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  item RECORD;
  batch RECORD;
  signed NUMERIC;
BEGIN
  SELECT * INTO STRICT item FROM public.stock_adjustments WHERE id = _adjustment_id;
  IF item.status != 'pending' THEN
    RAISE EXCEPTION 'Adjustment must be in pending status to post';
  END IF;

  FOR batch IN
    SELECT sai.*, p.name as product_name
    FROM public.stock_adjustment_items sai
    JOIN public.products p ON p.id = sai.product_id
    WHERE sai.adjustment_id = _adjustment_id
  LOOP
    signed := batch.physical_qty - batch.system_qty;

    UPDATE public.products
    SET current_stock = current_stock + signed,
        updated_at = NOW()
    WHERE id = batch.product_id;

    IF batch.batch_id IS NOT NULL THEN
      UPDATE public.product_batches
      SET available_qty = available_qty + signed,
          quantity = quantity + signed,
          damaged_qty = CASE WHEN batch.reason_detail = 'damaged' THEN damaged_qty + ABS(signed) ELSE damaged_qty END,
          updated_at = NOW()
      WHERE id = batch.batch_id;
    END IF;

    INSERT INTO public.inventory_movements (
      product_id, movement_type, quantity, note, created_by, ref_id, ref_type
    ) VALUES (
      batch.product_id,
      CASE
        WHEN batch.reason_detail = 'damaged' THEN 'damaged'
        WHEN batch.reason_detail = 'expired' THEN 'expired'
        WHEN signed > 0 THEN 'in'
        ELSE 'out'
      END,
      ABS(signed),
      'Adjustment: ' || item.adjustment_no || ' - ' || COALESCE(batch.reason_detail, item.reason),
      item.approved_by,
      _adjustment_id,
      'stock_adjustment'
    );
  END LOOP;

  UPDATE public.stock_adjustments
  SET status = 'posted', approved_at = NOW(), updated_at = NOW()
  WHERE id = _adjustment_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.recalc_customer_outstanding(_customer_id uuid) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  UPDATE public.customers c
     SET outstanding = COALESCE((
       SELECT SUM(balance) FROM public.invoices
        WHERE customer_id = _customer_id AND status <> 'void'
     ), 0)
   WHERE c.id = _customer_id;
$$;


CREATE OR REPLACE FUNCTION public.recalc_invoice(_invoice_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_tax      numeric := 0;
  v_paid     numeric := 0;
  v_inter    boolean;
  v_total    numeric;
  v_balance  numeric;
  v_status   text;
  v_cur_status text;
BEGIN
  SELECT COALESCE(SUM(taxable),0), COALESCE(SUM(discount),0), COALESCE(SUM(tax_amount),0)
    INTO v_subtotal, v_discount, v_tax
    FROM public.invoice_items WHERE invoice_id = _invoice_id;

  SELECT COALESCE(SUM(amount),0) INTO v_paid
    FROM public.payments WHERE invoice_id = _invoice_id;

  SELECT (igst > 0), status INTO v_inter, v_cur_status
    FROM public.invoices WHERE id = _invoice_id;

  v_total := v_subtotal + v_tax;
  v_balance := GREATEST(v_total - v_paid, 0);

  IF v_cur_status = 'void' THEN
    v_status := 'void';
  ELSIF v_paid <= 0 THEN
    v_status := 'pending';
  ELSIF v_paid < v_total THEN
    v_status := 'partial';
  ELSE
    v_status := 'paid';
  END IF;

  UPDATE public.invoices
     SET subtotal = v_subtotal,
         discount = v_discount,
         cgst = CASE WHEN COALESCE(v_inter,false) THEN 0 ELSE v_tax/2 END,
         sgst = CASE WHEN COALESCE(v_inter,false) THEN 0 ELSE v_tax/2 END,
         igst = CASE WHEN COALESCE(v_inter,false) THEN v_tax ELSE 0 END,
         total = v_total,
         paid = v_paid,
         balance = CASE WHEN v_cur_status = 'void' THEN 0 ELSE v_balance END,
         status = v_status
   WHERE id = _invoice_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.recalc_purchase(_purchase_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_paid numeric := 0;
  v_total numeric;
  v_status text;
  v_cur text;
BEGIN
  SELECT COALESCE(SUM(amount),0) INTO v_paid FROM public.supplier_payments WHERE purchase_id = _purchase_id;
  SELECT total, status INTO v_total, v_cur FROM public.purchases WHERE id = _purchase_id;
  IF v_cur = 'void' THEN
    v_status := 'void';
  ELSIF v_paid <= 0 THEN
    v_status := 'pending';
  ELSIF v_paid < v_total THEN
    v_status := 'partial';
  ELSE
    v_status := 'paid';
  END IF;
  UPDATE public.purchases SET paid = v_paid, status = v_status WHERE id = _purchase_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.recalc_run_delivery_status(_run_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_route uuid;
  v_date  date;
  v_run_status text;
  v_total int := 0;
  v_delivered int := 0;
  v_partial int := 0;
  v_failed int := 0;
  v_en_route int := 0;
  v_status text;
BEGIN
  SELECT route_id, run_date, status INTO v_route, v_date, v_run_status
    FROM public.delivery_runs WHERE id = _run_id;
  IF v_route IS NULL THEN RETURN; END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'delivered'),
    COUNT(*) FILTER (WHERE status = 'partially_delivered'),
    COUNT(*) FILTER (WHERE status = 'failed'),
    COUNT(*) FILTER (WHERE status = 'en_route')
  INTO v_total, v_delivered, v_partial, v_failed, v_en_route
  FROM public.deliveries
  WHERE route_id = v_route
    AND COALESCE(scheduled_date, delivered_at::date, created_at::date) = v_date;

  IF v_total = 0 THEN
    v_status := CASE WHEN v_run_status = 'in_progress' THEN 'en_route'
                     WHEN v_run_status = 'completed' THEN 'delivered'
                     ELSE 'planned' END;
  ELSIF v_delivered = v_total THEN
    v_status := 'delivered';
  ELSIF (v_delivered + v_partial + v_failed) = v_total THEN
    v_status := CASE WHEN v_failed = v_total THEN 'failed' ELSE 'partially_delivered' END;
  ELSIF v_en_route > 0 OR v_delivered > 0 OR v_partial > 0 OR v_failed > 0 OR v_run_status = 'in_progress' THEN
    v_status := 'en_route';
  ELSE
    v_status := 'planned';
  END IF;

  UPDATE public.delivery_runs SET delivery_status = v_status WHERE id = _run_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.recalc_supplier_outstanding(_supplier_id uuid) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  UPDATE public.suppliers s
     SET outstanding = GREATEST(COALESCE((
       SELECT SUM(total - paid) FROM public.purchases
        WHERE supplier_id = _supplier_id AND status <> 'void'
     ), 0) - COALESCE((
       SELECT SUM(amount) FROM public.supplier_payments
        WHERE supplier_id = _supplier_id AND purchase_id IS NULL
     ), 0), 0)
   WHERE s.id = _supplier_id;
$$;


CREATE OR REPLACE FUNCTION public.reconcile_collection(_collection_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE alloc RECORD;
BEGIN
  IF NOT public.can_manage_finance(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  FOR alloc IN SELECT * FROM public.collection_allocations WHERE driver_collection_id = _collection_id LOOP
    INSERT INTO public.payments (customer_id, invoice_id, amount, mode, payment_date, notes)
    VALUES (
      alloc.customer_id, alloc.invoice_id, alloc.allocated_amount, alloc.payment_mode, CURRENT_DATE,
      'Driver collection: ' || _collection_id::text
    );
  END LOOP;

  UPDATE public.driver_collections
     SET status = 'reconciled', reconciled_at = NOW(), reconciled_by = auth.uid()
   WHERE id = _collection_id;
END; $$;


CREATE OR REPLACE FUNCTION public.record_notification_attempt(_id uuid, _success boolean, _error text DEFAULT NULL::text, _provider text DEFAULT NULL::text, _provider_msg text DEFAULT NULL::text, _suppressed boolean DEFAULT false) RETURNS public.notification_logs
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row public.notification_logs;
  v_attempts int;
  v_next_status public.notification_status;
  v_next_retry timestamptz;
  v_backoff interval;
BEGIN
  SELECT * INTO v_row FROM public.notification_logs WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'notification_logs % not found', _id; END IF;

  v_attempts := v_row.attempts + 1;

  IF _suppressed THEN
    v_next_status := 'suppressed';
    v_next_retry  := NULL;
  ELSIF _success THEN
    v_next_status := 'sent';
    v_next_retry  := NULL;
  ELSIF v_attempts >= v_row.max_attempts THEN
    v_next_status := 'failed';
    v_next_retry  := NULL;
  ELSE
    v_next_status := 'failed';
    -- exponential backoff: 1m, 5m, 15m, 1h, 6h
    v_backoff := (CASE v_attempts
                    WHEN 1 THEN interval '1 minute'
                    WHEN 2 THEN interval '5 minutes'
                    WHEN 3 THEN interval '15 minutes'
                    WHEN 4 THEN interval '1 hour'
                    ELSE      interval '6 hours'
                  END);
    v_next_retry := now() + v_backoff;
  END IF;

  UPDATE public.notification_logs
     SET attempts            = v_attempts,
         status              = v_next_status,
         last_error          = CASE WHEN _success THEN NULL ELSE _error END,
         provider            = COALESCE(_provider, provider),
         provider_message_id = COALESCE(_provider_msg, provider_message_id),
         last_attempt_at     = now(),
         next_retry_at       = v_next_retry,
         sent_at             = CASE WHEN _success THEN now() ELSE sent_at END
   WHERE id = _id
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;


CREATE OR REPLACE FUNCTION public.revise_invoice(_invoice_id uuid, _revision_reason text, _revised_items jsonb, _revised_by uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_orig RECORD;
  v_new_id UUID;
  v_rev_no INT;
  v_revised_total NUMERIC(12,2) := 0;
  v_changes JSONB := '[]'::JSONB;
  v_new_no TEXT;
  v_item JSONB;
  v_oi RECORD;
BEGIN
  IF NOT public.can_manage_sales(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_orig FROM public.invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  v_rev_no := public.get_next_revision_no(_invoice_id);
  v_new_no := v_orig.invoice_no || '-R' || v_rev_no;

  INSERT INTO public.invoices (
    invoice_no, customer_id, invoice_date, due_date, notes,
    revision_count, superseded_by, is_revised, status
  ) VALUES (
    v_new_no, v_orig.customer_id, v_orig.invoice_date, v_orig.due_date,
    COALESCE(v_orig.notes, '') || ' (Revised)', v_rev_no, _invoice_id, TRUE, 'pending'
  ) RETURNING id INTO v_new_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_revised_items) LOOP
    SELECT * INTO v_oi FROM public.invoice_items
     WHERE invoice_id = _invoice_id AND product_id = (v_item->>'product_id')::UUID
     LIMIT 1;
    IF NOT FOUND THEN CONTINUE; END IF;

    v_changes := v_changes || jsonb_build_object(
      'product_id', v_item->>'product_id',
      'product_name', v_oi.product_name,
      'original_qty', v_oi.quantity,
      'revised_qty', (v_item->>'qty')::NUMERIC,
      'original_amount', v_oi.amount,
      'revised_amount', (v_item->>'amount')::NUMERIC
    );
    v_revised_total := v_revised_total + (v_item->>'amount')::NUMERIC;

    INSERT INTO public.invoice_items (
      invoice_id, product_id, product_name, hsn_code, unit,
      quantity, rate, discount, gst_rate, taxable, tax_amount, amount
    ) VALUES (
      v_new_id, v_oi.product_id, v_oi.product_name, v_oi.hsn_code, v_oi.unit,
      (v_item->>'qty')::NUMERIC,
      COALESCE((v_item->>'rate')::NUMERIC, v_oi.rate),
      0, v_oi.gst_rate,
      GREATEST((v_item->>'qty')::NUMERIC * COALESCE((v_item->>'rate')::NUMERIC, v_oi.rate), 0),
      GREATEST((v_item->>'qty')::NUMERIC * COALESCE((v_item->>'rate')::NUMERIC, v_oi.rate), 0) * COALESCE(v_oi.gst_rate,0) / 100,
      (v_item->>'amount')::NUMERIC
    );
  END LOOP;

  UPDATE public.invoices
     SET superseded_by = v_new_id, is_revised = TRUE, revision_count = v_rev_no
   WHERE id = _invoice_id;

  INSERT INTO public.invoice_revisions (
    invoice_id, revision_number, original_invoice_id, revised_by,
    revision_reason, changes_json, original_total, revised_total, revised_invoice_no
  ) VALUES (
    _invoice_id, v_rev_no, _invoice_id, COALESCE(_revised_by, auth.uid()),
    _revision_reason, v_changes, v_orig.total, v_revised_total, v_new_no
  );

  RETURN jsonb_build_object(
    'revised_invoice_id', v_new_id,
    'revised_invoice_no', v_new_no,
    'revision_number', v_rev_no
  );
END; $$;


CREATE OR REPLACE FUNCTION public.role_has_permission(_role text, _permission_name text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE rp.role = _role AND p.name = _permission_name
  );
$$;


CREATE OR REPLACE FUNCTION public.send_notification(_user_id uuid, _type text, _title text, _body text, _data jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (_user_id, _type, _title, _body, _data) RETURNING id INTO v_notification_id;
  RETURN v_notification_id;
END; $$;


CREATE OR REPLACE FUNCTION public.tg_customers_guard_user_id() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id IS NOT NULL
       AND auth.uid() IS NOT NULL
       AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'Only admins can link a customer record to a login account';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can change the login account linked to a customer record';
  END IF;
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.tg_deliveries_recalc_run_status() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  r record;
  run_id uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT route_id, COALESCE(scheduled_date, delivered_at::date, created_at::date) AS d
    FROM (
      SELECT (CASE WHEN TG_OP = 'DELETE' THEN OLD.route_id ELSE NEW.route_id END) AS route_id,
             (CASE WHEN TG_OP = 'DELETE' THEN OLD.scheduled_date ELSE NEW.scheduled_date END) AS scheduled_date,
             (CASE WHEN TG_OP = 'DELETE' THEN OLD.delivered_at ELSE NEW.delivered_at END) AS delivered_at,
             (CASE WHEN TG_OP = 'DELETE' THEN OLD.created_at ELSE NEW.created_at END) AS created_at
      UNION ALL
      SELECT OLD.route_id, OLD.scheduled_date, OLD.delivered_at, OLD.created_at
      WHERE TG_OP = 'UPDATE'
    ) x
    WHERE route_id IS NOT NULL
  LOOP
    SELECT id INTO run_id FROM public.delivery_runs
      WHERE route_id = r.route_id AND run_date = r.d
      ORDER BY created_at DESC LIMIT 1;
    IF run_id IS NOT NULL THEN
      PERFORM public.recalc_run_delivery_status(run_id);
    END IF;
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$$;


CREATE OR REPLACE FUNCTION public.tg_invoice_items_recalc() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_invoice(OLD.invoice_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_invoice(NEW.invoice_id);
    IF TG_OP = 'UPDATE' AND OLD.invoice_id <> NEW.invoice_id THEN
      PERFORM public.recalc_invoice(OLD.invoice_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;


CREATE OR REPLACE FUNCTION public.tg_invoices_customer_outstanding() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_customer_outstanding(OLD.customer_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_customer_outstanding(NEW.customer_id);
    IF TG_OP = 'UPDATE' AND OLD.customer_id IS DISTINCT FROM NEW.customer_id THEN
      PERFORM public.recalc_customer_outstanding(OLD.customer_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;


CREATE OR REPLACE FUNCTION public.tg_payments_recalc() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.invoice_id IS NOT NULL THEN PERFORM public.recalc_invoice(OLD.invoice_id); END IF;
    RETURN OLD;
  ELSE
    IF NEW.invoice_id IS NOT NULL THEN PERFORM public.recalc_invoice(NEW.invoice_id); END IF;
    IF TG_OP = 'UPDATE' AND OLD.invoice_id IS DISTINCT FROM NEW.invoice_id AND OLD.invoice_id IS NOT NULL THEN
      PERFORM public.recalc_invoice(OLD.invoice_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;


CREATE OR REPLACE FUNCTION public.tg_purchases_supplier_outstanding() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_supplier_outstanding(OLD.supplier_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_supplier_outstanding(NEW.supplier_id);
    IF TG_OP = 'UPDATE' AND OLD.supplier_id <> NEW.supplier_id THEN
      PERFORM public.recalc_supplier_outstanding(OLD.supplier_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;


CREATE OR REPLACE FUNCTION public.tg_runs_enqueue_status_notifications() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  d record;
BEGIN
  IF NEW.delivery_status IS NULL
     OR NEW.delivery_status = 'planned'
     OR OLD.delivery_status IS NOT DISTINCT FROM NEW.delivery_status THEN
    RETURN NEW;
  END IF;

  IF NEW.delivery_status = 'en_route' THEN
    PERFORM public.enqueue_run_en_route_notifications(NEW.id);
  ELSIF NEW.delivery_status IN ('delivered','partially_delivered','failed') THEN
    -- Per-delivery notifications; enqueue_delivery_notifications() itself
    -- only enqueues rows for deliveries in terminal states and uses
    -- delivery:{id}:{status}:{channel} idempotency keys.
    FOR d IN
      SELECT id FROM public.deliveries
       WHERE route_id = NEW.route_id
         AND COALESCE(scheduled_date, delivered_at::date, created_at::date) = NEW.run_date
    LOOP
      PERFORM public.enqueue_delivery_notifications(d.id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.tg_runs_recalc_delivery_status() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.recalc_run_delivery_status(NEW.id);
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;


CREATE OR REPLACE FUNCTION public.tg_supplier_payments_recalc() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.purchase_id IS NOT NULL THEN PERFORM public.recalc_purchase(OLD.purchase_id); END IF;
    PERFORM public.recalc_supplier_outstanding(OLD.supplier_id);
    RETURN OLD;
  ELSE
    IF NEW.purchase_id IS NOT NULL THEN PERFORM public.recalc_purchase(NEW.purchase_id); END IF;
    IF TG_OP = 'UPDATE' AND OLD.purchase_id IS DISTINCT FROM NEW.purchase_id AND OLD.purchase_id IS NOT NULL THEN
      PERFORM public.recalc_purchase(OLD.purchase_id);
    END IF;
    PERFORM public.recalc_supplier_outstanding(NEW.supplier_id);
    IF TG_OP = 'UPDATE' AND OLD.supplier_id <> NEW.supplier_id THEN
      PERFORM public.recalc_supplier_outstanding(OLD.supplier_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;


CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ------------------------------------------------------------
-- FROM 003_row_security.sql
-- ------------------------------------------------------------

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.access_audit_logs ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.collection_allocations ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.crate_transactions ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.crate_types ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.delivery_cycles ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.delivery_runs ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.demand_consolidation_items ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.demand_consolidations ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.demand_source_orders ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.distributors ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.driver_collections ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.edit_audit_logs ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.gps_audit_logs ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.invoice_revisions ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.reminder_templates ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.retailer_ledger_entries ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.share_activity_logs ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.stock_adjustment_items ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.stock_reconciliation_items ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.stock_reconciliations ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.sudha_claims ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


DROP POLICY IF EXISTS "Admins can view all share activity" ON public.share_activity_logs;
CREATE POLICY "Admins can view all share activity" ON public.share_activity_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


DROP POLICY IF EXISTS "Admins/managers can delete gps audit logs" ON public.gps_audit_logs;
CREATE POLICY "Admins/managers can delete gps audit logs" ON public.gps_audit_logs FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


DROP POLICY IF EXISTS "Authenticated users can insert own share activity" ON public.share_activity_logs;
CREATE POLICY "Authenticated users can insert own share activity" ON public.share_activity_logs FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


DROP POLICY IF EXISTS "Finance can delete ledger entries" ON public.retailer_ledger_entries;
CREATE POLICY "Finance can delete ledger entries" ON public.retailer_ledger_entries FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS "Finance can insert ledger entries" ON public.retailer_ledger_entries;
CREATE POLICY "Finance can insert ledger entries" ON public.retailer_ledger_entries FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS "Finance can update ledger entries" ON public.retailer_ledger_entries;
CREATE POLICY "Finance can update ledger entries" ON public.retailer_ledger_entries FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS "Retailer can view own customer row" ON public.customers;
CREATE POLICY "Retailer can view own customer row" ON public.customers FOR SELECT TO authenticated USING ((user_id = auth.uid()));


DROP POLICY IF EXISTS "Retailer can view own ledger entries" ON public.retailer_ledger_entries;
CREATE POLICY "Retailer can view own ledger entries" ON public.retailer_ledger_entries FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.customers c
  WHERE ((c.id = retailer_ledger_entries.retailer_id) AND (c.user_id = auth.uid())))));


DROP POLICY IF EXISTS "Staff can view ledger entries" ON public.retailer_ledger_entries;
CREATE POLICY "Staff can view ledger entries" ON public.retailer_ledger_entries FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


DROP POLICY IF EXISTS access_audit_logs_insert ON public.access_audit_logs;
CREATE POLICY access_audit_logs_insert ON public.access_audit_logs FOR INSERT TO authenticated WITH CHECK (((auth.uid() IS NOT NULL) AND ((user_id IS NULL) OR (user_id = auth.uid()))));


DROP POLICY IF EXISTS access_audit_logs_select ON public.access_audit_logs;
CREATE POLICY access_audit_logs_select ON public.access_audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


DROP POLICY IF EXISTS app_settings_delete_admin ON public.app_settings;
CREATE POLICY app_settings_delete_admin ON public.app_settings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


DROP POLICY IF EXISTS app_settings_insert_admin ON public.app_settings;
CREATE POLICY app_settings_insert_admin ON public.app_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


DROP POLICY IF EXISTS app_settings_select_admin ON public.app_settings;
CREATE POLICY app_settings_select_admin ON public.app_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


DROP POLICY IF EXISTS app_settings_update_admin ON public.app_settings;
CREATE POLICY app_settings_update_admin ON public.app_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
CREATE POLICY audit_logs_insert ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);


DROP POLICY IF EXISTS audit_logs_select ON public.audit_logs;
CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'distributor'::text))))));


DROP POLICY IF EXISTS collection_allocations_delete ON public.collection_allocations;
CREATE POLICY collection_allocations_delete ON public.collection_allocations FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS collection_allocations_insert ON public.collection_allocations;
CREATE POLICY collection_allocations_insert ON public.collection_allocations FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS collection_allocations_select ON public.collection_allocations;
CREATE POLICY collection_allocations_select ON public.collection_allocations FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


DROP POLICY IF EXISTS collection_allocations_update ON public.collection_allocations;
CREATE POLICY collection_allocations_update ON public.collection_allocations FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS crate_transactions_delete ON public.crate_transactions;
CREATE POLICY crate_transactions_delete ON public.crate_transactions FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS crate_transactions_insert ON public.crate_transactions;
CREATE POLICY crate_transactions_insert ON public.crate_transactions FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff(auth.uid()));


DROP POLICY IF EXISTS crate_transactions_select ON public.crate_transactions;
CREATE POLICY crate_transactions_select ON public.crate_transactions FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


DROP POLICY IF EXISTS crate_transactions_update ON public.crate_transactions;
CREATE POLICY crate_transactions_update ON public.crate_transactions FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS crate_types_select ON public.crate_types;
CREATE POLICY crate_types_select ON public.crate_types FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


DROP POLICY IF EXISTS crate_types_write ON public.crate_types;
CREATE POLICY crate_types_write ON public.crate_types TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS customers_delete ON public.customers;
CREATE POLICY customers_delete ON public.customers FOR DELETE TO authenticated USING (public.can_manage_sales(auth.uid()));


DROP POLICY IF EXISTS customers_insert ON public.customers;
CREATE POLICY customers_insert ON public.customers FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));


DROP POLICY IF EXISTS customers_select ON public.customers;
CREATE POLICY customers_select ON public.customers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


DROP POLICY IF EXISTS customers_update ON public.customers;
CREATE POLICY customers_update ON public.customers FOR UPDATE TO authenticated USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));


DROP POLICY IF EXISTS deliveries_delete ON public.deliveries;
CREATE POLICY deliveries_delete ON public.deliveries FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS deliveries_insert ON public.deliveries;
CREATE POLICY deliveries_insert ON public.deliveries FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));


DROP POLICY IF EXISTS deliveries_select ON public.deliveries;
CREATE POLICY deliveries_select ON public.deliveries FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


DROP POLICY IF EXISTS deliveries_update ON public.deliveries;
CREATE POLICY deliveries_update ON public.deliveries FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));


DROP POLICY IF EXISTS delivery_cycles_delete ON public.delivery_cycles;
CREATE POLICY delivery_cycles_delete ON public.delivery_cycles FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS delivery_cycles_insert ON public.delivery_cycles;
CREATE POLICY delivery_cycles_insert ON public.delivery_cycles FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS delivery_cycles_select ON public.delivery_cycles;
CREATE POLICY delivery_cycles_select ON public.delivery_cycles FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


DROP POLICY IF EXISTS delivery_cycles_update ON public.delivery_cycles;
CREATE POLICY delivery_cycles_update ON public.delivery_cycles FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS delivery_runs_delete ON public.delivery_runs;
CREATE POLICY delivery_runs_delete ON public.delivery_runs FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS delivery_runs_insert ON public.delivery_runs;
CREATE POLICY delivery_runs_insert ON public.delivery_runs FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));


DROP POLICY IF EXISTS delivery_runs_select ON public.delivery_runs;
CREATE POLICY delivery_runs_select ON public.delivery_runs FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


DROP POLICY IF EXISTS delivery_runs_update ON public.delivery_runs;
CREATE POLICY delivery_runs_update ON public.delivery_runs FOR UPDATE TO authenticated USING (public.is_internal_staff(auth.uid())) WITH CHECK (public.is_internal_staff(auth.uid()));


DROP POLICY IF EXISTS demand_consolidation_items_delete ON public.demand_consolidation_items;
CREATE POLICY demand_consolidation_items_delete ON public.demand_consolidation_items FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS demand_consolidation_items_insert ON public.demand_consolidation_items;
CREATE POLICY demand_consolidation_items_insert ON public.demand_consolidation_items FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS demand_consolidation_items_select ON public.demand_consolidation_items;
CREATE POLICY demand_consolidation_items_select ON public.demand_consolidation_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


DROP POLICY IF EXISTS demand_consolidation_items_update ON public.demand_consolidation_items;
CREATE POLICY demand_consolidation_items_update ON public.demand_consolidation_items FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS demand_consolidations_delete ON public.demand_consolidations;
CREATE POLICY demand_consolidations_delete ON public.demand_consolidations FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS demand_consolidations_insert ON public.demand_consolidations;
CREATE POLICY demand_consolidations_insert ON public.demand_consolidations FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS demand_consolidations_select ON public.demand_consolidations;
CREATE POLICY demand_consolidations_select ON public.demand_consolidations FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


DROP POLICY IF EXISTS demand_consolidations_update ON public.demand_consolidations;
CREATE POLICY demand_consolidations_update ON public.demand_consolidations FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS demand_source_orders_delete ON public.demand_source_orders;
CREATE POLICY demand_source_orders_delete ON public.demand_source_orders FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS demand_source_orders_insert ON public.demand_source_orders;
CREATE POLICY demand_source_orders_insert ON public.demand_source_orders FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS demand_source_orders_select ON public.demand_source_orders;
CREATE POLICY demand_source_orders_select ON public.demand_source_orders FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


DROP POLICY IF EXISTS distributors_insert ON public.distributors;
CREATE POLICY distributors_insert ON public.distributors FOR INSERT TO authenticated WITH CHECK (true);


DROP POLICY IF EXISTS distributors_select ON public.distributors;
CREATE POLICY distributors_select ON public.distributors FOR SELECT TO authenticated USING (true);


DROP POLICY IF EXISTS distributors_update ON public.distributors;
CREATE POLICY distributors_update ON public.distributors FOR UPDATE TO authenticated USING (true);


DROP POLICY IF EXISTS driver_collections_delete ON public.driver_collections;
CREATE POLICY driver_collections_delete ON public.driver_collections FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS driver_collections_insert ON public.driver_collections;
CREATE POLICY driver_collections_insert ON public.driver_collections FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS driver_collections_select ON public.driver_collections;
CREATE POLICY driver_collections_select ON public.driver_collections FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


DROP POLICY IF EXISTS driver_collections_update ON public.driver_collections;
CREATE POLICY driver_collections_update ON public.driver_collections FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS edit_audit_logs_select ON public.edit_audit_logs;
CREATE POLICY edit_audit_logs_select ON public.edit_audit_logs FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


DROP POLICY IF EXISTS email_verification_tokens_insert ON public.email_verification_tokens;
CREATE POLICY email_verification_tokens_insert ON public.email_verification_tokens FOR INSERT TO authenticated WITH CHECK (true);


DROP POLICY IF EXISTS email_verification_tokens_select ON public.email_verification_tokens;
CREATE POLICY email_verification_tokens_select ON public.email_verification_tokens FOR SELECT TO authenticated USING ((user_id = auth.uid()));


DROP POLICY IF EXISTS email_verification_tokens_update ON public.email_verification_tokens;
CREATE POLICY email_verification_tokens_update ON public.email_verification_tokens FOR UPDATE TO authenticated USING ((user_id = auth.uid()));


DROP POLICY IF EXISTS expense_categories_select ON public.expense_categories;
CREATE POLICY expense_categories_select ON public.expense_categories FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


DROP POLICY IF EXISTS expense_categories_write ON public.expense_categories;
CREATE POLICY expense_categories_write ON public.expense_categories TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS expenses_select ON public.expenses;
CREATE POLICY expenses_select ON public.expenses FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


DROP POLICY IF EXISTS expenses_write ON public.expenses;
CREATE POLICY expenses_write ON public.expenses TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS gps_audit_logs_insert ON public.gps_audit_logs;
CREATE POLICY gps_audit_logs_insert ON public.gps_audit_logs FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff(auth.uid()));


DROP POLICY IF EXISTS gps_audit_logs_select ON public.gps_audit_logs;
CREATE POLICY gps_audit_logs_select ON public.gps_audit_logs FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


DROP POLICY IF EXISTS inventory_movements_delete ON public.inventory_movements;
CREATE POLICY inventory_movements_delete ON public.inventory_movements FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS inventory_movements_insert ON public.inventory_movements;
CREATE POLICY inventory_movements_insert ON public.inventory_movements FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS inventory_movements_select ON public.inventory_movements;
CREATE POLICY inventory_movements_select ON public.inventory_movements FOR SELECT TO authenticated USING (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS inventory_movements_update ON public.inventory_movements;
CREATE POLICY inventory_movements_update ON public.inventory_movements FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS invoice_items_delete ON public.invoice_items;
CREATE POLICY invoice_items_delete ON public.invoice_items FOR DELETE TO authenticated USING (public.can_manage_sales(auth.uid()));


DROP POLICY IF EXISTS invoice_items_insert ON public.invoice_items;
CREATE POLICY invoice_items_insert ON public.invoice_items FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));


DROP POLICY IF EXISTS invoice_items_select ON public.invoice_items;
CREATE POLICY invoice_items_select ON public.invoice_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


DROP POLICY IF EXISTS invoice_items_update ON public.invoice_items;
CREATE POLICY invoice_items_update ON public.invoice_items FOR UPDATE TO authenticated USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));


DROP POLICY IF EXISTS invoice_revisions_insert ON public.invoice_revisions;
CREATE POLICY invoice_revisions_insert ON public.invoice_revisions FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));


DROP POLICY IF EXISTS invoice_revisions_select ON public.invoice_revisions;
CREATE POLICY invoice_revisions_select ON public.invoice_revisions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


DROP POLICY IF EXISTS invoices_delete ON public.invoices;
CREATE POLICY invoices_delete ON public.invoices FOR DELETE TO authenticated USING (public.can_manage_sales(auth.uid()));


DROP POLICY IF EXISTS invoices_insert ON public.invoices;
CREATE POLICY invoices_insert ON public.invoices FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));


DROP POLICY IF EXISTS invoices_select ON public.invoices;
CREATE POLICY invoices_select ON public.invoices FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


DROP POLICY IF EXISTS invoices_update ON public.invoices;
CREATE POLICY invoices_update ON public.invoices FOR UPDATE TO authenticated USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));


DROP POLICY IF EXISTS login_history_insert ON public.login_history;
CREATE POLICY login_history_insert ON public.login_history FOR INSERT TO authenticated WITH CHECK (true);


DROP POLICY IF EXISTS login_history_select ON public.login_history;
CREATE POLICY login_history_select ON public.login_history FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'distributor'::text))))));


DROP POLICY IF EXISTS notification_logs_delete ON public.notification_logs;
CREATE POLICY notification_logs_delete ON public.notification_logs FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS notification_logs_insert ON public.notification_logs;
CREATE POLICY notification_logs_insert ON public.notification_logs FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS notification_logs_select ON public.notification_logs;
CREATE POLICY notification_logs_select ON public.notification_logs FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


DROP POLICY IF EXISTS notification_logs_update ON public.notification_logs;
CREATE POLICY notification_logs_update ON public.notification_logs FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS notifications_delete ON public.notifications;
CREATE POLICY notifications_delete ON public.notifications FOR DELETE TO authenticated USING ((auth.uid() = user_id));


DROP POLICY IF EXISTS notifications_insert ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) OR public.can_manage_sales(auth.uid())));


DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications FOR SELECT TO authenticated USING ((auth.uid() = user_id));


DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY notifications_update ON public.notifications FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


DROP POLICY IF EXISTS order_items_delete ON public.order_items;
CREATE POLICY order_items_delete ON public.order_items FOR DELETE TO authenticated USING (public.can_manage_sales(auth.uid()));


DROP POLICY IF EXISTS order_items_insert ON public.order_items;
CREATE POLICY order_items_insert ON public.order_items FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));


DROP POLICY IF EXISTS order_items_select ON public.order_items;
CREATE POLICY order_items_select ON public.order_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


DROP POLICY IF EXISTS order_items_update ON public.order_items;
CREATE POLICY order_items_update ON public.order_items FOR UPDATE TO authenticated USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));


DROP POLICY IF EXISTS orders_delete ON public.orders;
CREATE POLICY orders_delete ON public.orders FOR DELETE TO authenticated USING (public.can_manage_sales(auth.uid()));


DROP POLICY IF EXISTS orders_insert ON public.orders;
CREATE POLICY orders_insert ON public.orders FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));


DROP POLICY IF EXISTS orders_select ON public.orders;
CREATE POLICY orders_select ON public.orders FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


DROP POLICY IF EXISTS orders_update ON public.orders;
CREATE POLICY orders_update ON public.orders FOR UPDATE TO authenticated USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));


DROP POLICY IF EXISTS password_reset_tokens_insert ON public.password_reset_tokens;
CREATE POLICY password_reset_tokens_insert ON public.password_reset_tokens FOR INSERT TO authenticated WITH CHECK (true);


DROP POLICY IF EXISTS password_reset_tokens_select ON public.password_reset_tokens;
CREATE POLICY password_reset_tokens_select ON public.password_reset_tokens FOR SELECT TO authenticated USING ((user_id = auth.uid()));


DROP POLICY IF EXISTS password_reset_tokens_update ON public.password_reset_tokens;
CREATE POLICY password_reset_tokens_update ON public.password_reset_tokens FOR UPDATE TO authenticated USING ((user_id = auth.uid()));


DROP POLICY IF EXISTS payments_delete ON public.payments;
CREATE POLICY payments_delete ON public.payments FOR DELETE TO authenticated USING (public.can_manage_sales(auth.uid()));


DROP POLICY IF EXISTS payments_insert ON public.payments;
CREATE POLICY payments_insert ON public.payments FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));


DROP POLICY IF EXISTS payments_select ON public.payments;
CREATE POLICY payments_select ON public.payments FOR SELECT TO authenticated USING (public.can_manage_sales(auth.uid()));


DROP POLICY IF EXISTS payments_update ON public.payments;
CREATE POLICY payments_update ON public.payments FOR UPDATE TO authenticated USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));


DROP POLICY IF EXISTS permissions_admin_all ON public.permissions;
CREATE POLICY permissions_admin_all ON public.permissions TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


DROP POLICY IF EXISTS permissions_delete ON public.permissions;
CREATE POLICY permissions_delete ON public.permissions FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'distributor'::text)))));


DROP POLICY IF EXISTS permissions_insert ON public.permissions;
CREATE POLICY permissions_insert ON public.permissions FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'distributor'::text)))));


DROP POLICY IF EXISTS permissions_select ON public.permissions;
CREATE POLICY permissions_select ON public.permissions FOR SELECT TO authenticated USING (true);


DROP POLICY IF EXISTS permissions_staff_read ON public.permissions;
CREATE POLICY permissions_staff_read ON public.permissions FOR SELECT TO authenticated USING (true);


DROP POLICY IF EXISTS permissions_update ON public.permissions;
CREATE POLICY permissions_update ON public.permissions FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'distributor'::text)))));


DROP POLICY IF EXISTS product_batches_delete ON public.product_batches;
CREATE POLICY product_batches_delete ON public.product_batches FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS product_batches_insert ON public.product_batches;
CREATE POLICY product_batches_insert ON public.product_batches FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS product_batches_select ON public.product_batches;
CREATE POLICY product_batches_select ON public.product_batches FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


DROP POLICY IF EXISTS product_batches_update ON public.product_batches;
CREATE POLICY product_batches_update ON public.product_batches FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS products_delete ON public.products;
CREATE POLICY products_delete ON public.products FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS products_insert ON public.products;
CREATE POLICY products_insert ON public.products FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS products_select ON public.products;
CREATE POLICY products_select ON public.products FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


DROP POLICY IF EXISTS products_update ON public.products;
CREATE POLICY products_update ON public.products FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS profiles_self_insert ON public.profiles;
CREATE POLICY profiles_self_insert ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


DROP POLICY IF EXISTS profiles_self_read ON public.profiles;
CREATE POLICY profiles_self_read ON public.profiles FOR SELECT TO authenticated USING (((auth.uid() = id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


DROP POLICY IF EXISTS profiles_self_write ON public.profiles;
CREATE POLICY profiles_self_write ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


DROP POLICY IF EXISTS purchase_items_delete ON public.purchase_items;
CREATE POLICY purchase_items_delete ON public.purchase_items FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS purchase_items_insert ON public.purchase_items;
CREATE POLICY purchase_items_insert ON public.purchase_items FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS purchase_items_select ON public.purchase_items;
CREATE POLICY purchase_items_select ON public.purchase_items FOR SELECT TO authenticated USING (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS purchase_items_update ON public.purchase_items;
CREATE POLICY purchase_items_update ON public.purchase_items FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS purchases_delete ON public.purchases;
CREATE POLICY purchases_delete ON public.purchases FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS purchases_insert ON public.purchases;
CREATE POLICY purchases_insert ON public.purchases FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS purchases_select ON public.purchases;
CREATE POLICY purchases_select ON public.purchases FOR SELECT TO authenticated USING (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS purchases_update ON public.purchases;
CREATE POLICY purchases_update ON public.purchases FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS push_subscriptions_delete ON public.push_subscriptions;
CREATE POLICY push_subscriptions_delete ON public.push_subscriptions FOR DELETE TO authenticated USING ((auth.uid() = user_id));


DROP POLICY IF EXISTS push_subscriptions_insert ON public.push_subscriptions;
CREATE POLICY push_subscriptions_insert ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


DROP POLICY IF EXISTS push_subscriptions_select ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select ON public.push_subscriptions FOR SELECT TO authenticated USING ((auth.uid() = user_id));


DROP POLICY IF EXISTS push_subscriptions_update ON public.push_subscriptions;
CREATE POLICY push_subscriptions_update ON public.push_subscriptions FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


DROP POLICY IF EXISTS reminder_logs_insert ON public.reminder_logs;
CREATE POLICY reminder_logs_insert ON public.reminder_logs FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));


DROP POLICY IF EXISTS reminder_logs_select ON public.reminder_logs;
CREATE POLICY reminder_logs_select ON public.reminder_logs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


DROP POLICY IF EXISTS reminder_templates_delete ON public.reminder_templates;
CREATE POLICY reminder_templates_delete ON public.reminder_templates FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS reminder_templates_insert ON public.reminder_templates;
CREATE POLICY reminder_templates_insert ON public.reminder_templates FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS reminder_templates_select ON public.reminder_templates;
CREATE POLICY reminder_templates_select ON public.reminder_templates FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


DROP POLICY IF EXISTS reminder_templates_update ON public.reminder_templates;
CREATE POLICY reminder_templates_update ON public.reminder_templates FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS role_permissions_admin_all ON public.role_permissions;
CREATE POLICY role_permissions_admin_all ON public.role_permissions TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


DROP POLICY IF EXISTS role_permissions_delete ON public.role_permissions;
CREATE POLICY role_permissions_delete ON public.role_permissions FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'distributor'::text)))));


DROP POLICY IF EXISTS role_permissions_insert ON public.role_permissions;
CREATE POLICY role_permissions_insert ON public.role_permissions FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'distributor'::text)))));


DROP POLICY IF EXISTS role_permissions_select ON public.role_permissions;
CREATE POLICY role_permissions_select ON public.role_permissions FOR SELECT TO authenticated USING (true);


DROP POLICY IF EXISTS role_permissions_staff_read ON public.role_permissions;
CREATE POLICY role_permissions_staff_read ON public.role_permissions FOR SELECT TO authenticated USING (true);


DROP POLICY IF EXISTS role_permissions_update ON public.role_permissions;
CREATE POLICY role_permissions_update ON public.role_permissions FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'distributor'::text)))));


DROP POLICY IF EXISTS roles_admin_delete ON public.user_roles;
CREATE POLICY roles_admin_delete ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


DROP POLICY IF EXISTS roles_admin_update ON public.user_roles;
CREATE POLICY roles_admin_update ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


DROP POLICY IF EXISTS roles_admin_write ON public.user_roles;
CREATE POLICY roles_admin_write ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


DROP POLICY IF EXISTS roles_read_self ON public.user_roles;
CREATE POLICY roles_read_self ON public.user_roles FOR SELECT TO authenticated USING ((user_id = auth.uid()));


DROP POLICY IF EXISTS route_stops_select ON public.route_stops;
CREATE POLICY route_stops_select ON public.route_stops FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


DROP POLICY IF EXISTS route_stops_write ON public.route_stops;
CREATE POLICY route_stops_write ON public.route_stops TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS routes_select ON public.routes;
CREATE POLICY routes_select ON public.routes FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


DROP POLICY IF EXISTS routes_write ON public.routes;
CREATE POLICY routes_write ON public.routes TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS stock_adjustment_items_insert ON public.stock_adjustment_items;
CREATE POLICY stock_adjustment_items_insert ON public.stock_adjustment_items FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS stock_adjustment_items_select ON public.stock_adjustment_items;
CREATE POLICY stock_adjustment_items_select ON public.stock_adjustment_items FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


DROP POLICY IF EXISTS stock_adjustment_items_update ON public.stock_adjustment_items;
CREATE POLICY stock_adjustment_items_update ON public.stock_adjustment_items FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS stock_adjustments_insert ON public.stock_adjustments;
CREATE POLICY stock_adjustments_insert ON public.stock_adjustments FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS stock_adjustments_select ON public.stock_adjustments;
CREATE POLICY stock_adjustments_select ON public.stock_adjustments FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


DROP POLICY IF EXISTS stock_adjustments_update ON public.stock_adjustments;
CREATE POLICY stock_adjustments_update ON public.stock_adjustments FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS stock_reconciliation_items_insert ON public.stock_reconciliation_items;
CREATE POLICY stock_reconciliation_items_insert ON public.stock_reconciliation_items FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS stock_reconciliation_items_select ON public.stock_reconciliation_items;
CREATE POLICY stock_reconciliation_items_select ON public.stock_reconciliation_items FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


DROP POLICY IF EXISTS stock_reconciliation_items_update ON public.stock_reconciliation_items;
CREATE POLICY stock_reconciliation_items_update ON public.stock_reconciliation_items FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS stock_reconciliations_insert ON public.stock_reconciliations;
CREATE POLICY stock_reconciliations_insert ON public.stock_reconciliations FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS stock_reconciliations_select ON public.stock_reconciliations;
CREATE POLICY stock_reconciliations_select ON public.stock_reconciliations FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


DROP POLICY IF EXISTS stock_reconciliations_update ON public.stock_reconciliations;
CREATE POLICY stock_reconciliations_update ON public.stock_reconciliations FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS sudha_claims_delete ON public.sudha_claims;
CREATE POLICY sudha_claims_delete ON public.sudha_claims FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS sudha_claims_insert ON public.sudha_claims;
CREATE POLICY sudha_claims_insert ON public.sudha_claims FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));


DROP POLICY IF EXISTS sudha_claims_select ON public.sudha_claims;
CREATE POLICY sudha_claims_select ON public.sudha_claims FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


DROP POLICY IF EXISTS sudha_claims_update ON public.sudha_claims;
CREATE POLICY sudha_claims_update ON public.sudha_claims FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS supplier_payments_select ON public.supplier_payments;
CREATE POLICY supplier_payments_select ON public.supplier_payments FOR SELECT TO authenticated USING (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS supplier_payments_write ON public.supplier_payments;
CREATE POLICY supplier_payments_write ON public.supplier_payments TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS suppliers_delete ON public.suppliers;
CREATE POLICY suppliers_delete ON public.suppliers FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS suppliers_insert ON public.suppliers;
CREATE POLICY suppliers_insert ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS suppliers_select ON public.suppliers;
CREATE POLICY suppliers_select ON public.suppliers FOR SELECT TO authenticated USING (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS suppliers_update ON public.suppliers;
CREATE POLICY suppliers_update ON public.suppliers FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS users_insert ON public.users;
CREATE POLICY users_insert ON public.users FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users users_1
  WHERE ((users_1.id = auth.uid()) AND (users_1.role = 'distributor'::text)))));


DROP POLICY IF EXISTS users_select_admin ON public.users;
CREATE POLICY users_select_admin ON public.users FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users users_1
  WHERE ((users_1.id = auth.uid()) AND (users_1.role = 'distributor'::text)))));


DROP POLICY IF EXISTS users_select_self ON public.users;
CREATE POLICY users_select_self ON public.users FOR SELECT TO authenticated USING ((id = auth.uid()));


DROP POLICY IF EXISTS users_update ON public.users;
CREATE POLICY users_update ON public.users FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users users_1
  WHERE ((users_1.id = auth.uid()) AND (users_1.role = 'distributor'::text)))));


DROP POLICY IF EXISTS warehouses_insert ON public.warehouses;
CREATE POLICY warehouses_insert ON public.warehouses FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


DROP POLICY IF EXISTS warehouses_select ON public.warehouses;
CREATE POLICY warehouses_select ON public.warehouses FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


DROP POLICY IF EXISTS warehouses_update ON public.warehouses;
CREATE POLICY warehouses_update ON public.warehouses FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


-- FIX: the login page queries public.users BEFORE authentication
-- (email/mobile lookup). The original schema had no anon policy, so login
-- could never see the user row. Allow anon read; bcrypt hashes are salted
-- and the anon key is not public for this private ERP.
DROP POLICY IF EXISTS users_select_anon_login ON public.users;
CREATE POLICY users_select_anon_login ON public.users FOR SELECT TO anon USING (true);


-- FIX: the /verify-email page looks up the token while the user is still
-- signed out. Allow anon read (the token itself is the secret).
DROP POLICY IF EXISTS email_verification_tokens_select_anon ON public.email_verification_tokens;
CREATE POLICY email_verification_tokens_select_anon ON public.email_verification_tokens FOR SELECT TO anon USING (true);


-- ------------------------------------------------------------
-- FROM 004_indexes_constraints.sql
-- ------------------------------------------------------------

-- ============================================================
-- INDEXES
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS customers_retailer_code_key ON public.customers USING btree (retailer_code) WHERE (retailer_code IS NOT NULL);


CREATE UNIQUE INDEX IF NOT EXISTS customers_user_id_key ON public.customers USING btree (user_id) WHERE (user_id IS NOT NULL);


CREATE INDEX IF NOT EXISTS delivery_runs_route_date_idx ON public.delivery_runs USING btree (route_id, run_date DESC);


CREATE INDEX IF NOT EXISTS edit_audit_delivery_idx ON public.edit_audit_logs USING btree (delivery_id);


CREATE INDEX IF NOT EXISTS edit_audit_route_created_idx ON public.edit_audit_logs USING btree (route_id, created_at);


CREATE INDEX IF NOT EXISTS edit_audit_run_idx ON public.edit_audit_logs USING btree (run_id);


CREATE INDEX IF NOT EXISTS gps_audit_logs_created_idx ON public.gps_audit_logs USING btree (created_at DESC);


CREATE INDEX IF NOT EXISTS gps_audit_logs_delivery_idx ON public.gps_audit_logs USING btree (delivery_id, created_at DESC);


CREATE INDEX IF NOT EXISTS gps_audit_logs_run_idx ON public.gps_audit_logs USING btree (run_id, created_at DESC);


CREATE INDEX IF NOT EXISTS idx_access_audit_event ON public.access_audit_logs USING btree (event_type, created_at DESC);


CREATE INDEX IF NOT EXISTS idx_access_audit_route ON public.access_audit_logs USING btree (route_path, created_at DESC);


CREATE INDEX IF NOT EXISTS idx_access_audit_time ON public.access_audit_logs USING btree (created_at DESC);


CREATE INDEX IF NOT EXISTS idx_access_audit_user ON public.access_audit_logs USING btree (user_id, created_at DESC);


CREATE INDEX IF NOT EXISTS idx_adjustment_items_adj ON public.stock_adjustment_items USING btree (adjustment_id);


CREATE INDEX IF NOT EXISTS idx_app_settings_key ON public.app_settings USING btree (key);


CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs USING btree (action);


CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


CREATE INDEX IF NOT EXISTS idx_audit_logs_distributor_id ON public.audit_logs USING btree (distributor_id);


CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


CREATE INDEX IF NOT EXISTS idx_batches_expiry ON public.product_batches USING btree (expiry_date);


CREATE INDEX IF NOT EXISTS idx_collection_allocations_collection ON public.collection_allocations USING btree (driver_collection_id);


CREATE INDEX IF NOT EXISTS idx_collection_allocations_invoice ON public.collection_allocations USING btree (invoice_id);


CREATE INDEX IF NOT EXISTS idx_crate_tx_date ON public.crate_transactions USING btree (transaction_date);


CREATE INDEX IF NOT EXISTS idx_crate_tx_retailer ON public.crate_transactions USING btree (retailer_id);


CREATE INDEX IF NOT EXISTS idx_crate_tx_type ON public.crate_transactions USING btree (crate_type_id);


CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_retailer_code ON public.customers USING btree (retailer_code) WHERE (retailer_code IS NOT NULL);


CREATE INDEX IF NOT EXISTS idx_customers_retailer_code_lookup ON public.customers USING btree (retailer_code);


CREATE INDEX IF NOT EXISTS idx_customers_status ON public.customers USING btree (status) WHERE (status = 'active'::text);


CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers USING btree (user_id);


CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_user_id_unique ON public.customers USING btree (user_id) WHERE (user_id IS NOT NULL);


CREATE INDEX IF NOT EXISTS idx_deliveries_invoice ON public.deliveries USING btree (invoice_id);


CREATE INDEX IF NOT EXISTS idx_deliveries_order ON public.deliveries USING btree (order_id);


CREATE INDEX IF NOT EXISTS idx_deliveries_route ON public.deliveries USING btree (route_id);


CREATE INDEX IF NOT EXISTS idx_deliveries_scheduled_date ON public.deliveries USING btree (scheduled_date);


CREATE INDEX IF NOT EXISTS idx_delivery_cycles_delivery_date ON public.delivery_cycles USING btree (delivery_date, delivery_shift);


CREATE INDEX IF NOT EXISTS idx_demand_consolidation_items_consolidation ON public.demand_consolidation_items USING btree (demand_consolidation_id);


CREATE INDEX IF NOT EXISTS idx_demand_consolidations_cycle ON public.demand_consolidations USING btree (delivery_cycle_id, status);


CREATE INDEX IF NOT EXISTS idx_driver_collections_date ON public.driver_collections USING btree (delivery_date DESC);


CREATE INDEX IF NOT EXISTS idx_driver_collections_status ON public.driver_collections USING btree (status);


CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON public.email_verification_tokens USING btree (token);


CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON public.email_verification_tokens USING btree (user_id);


CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses USING btree (category_id);


CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses USING btree (expense_date DESC);


CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON public.inventory_movements USING btree (product_id);


CREATE INDEX IF NOT EXISTS idx_inventory_movements_ref ON public.inventory_movements USING btree (ref_type, ref_id);


CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items USING btree (invoice_id);


CREATE INDEX IF NOT EXISTS idx_invoice_revisions_invoice ON public.invoice_revisions USING btree (invoice_id);


CREATE INDEX IF NOT EXISTS idx_invoice_revisions_original ON public.invoice_revisions USING btree (original_invoice_id);


CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices USING btree (customer_id);


CREATE INDEX IF NOT EXISTS idx_invoices_customer_date ON public.invoices USING btree (customer_id, invoice_date DESC);


CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices USING btree (invoice_date DESC);


CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON public.invoices USING btree (invoice_date DESC);


CREATE INDEX IF NOT EXISTS idx_login_history_distributor_id ON public.login_history USING btree (distributor_id);


CREATE INDEX IF NOT EXISTS idx_login_history_login_at ON public.login_history USING btree (login_at DESC);


CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON public.login_history USING btree (user_id);


CREATE INDEX IF NOT EXISTS idx_movements_product ON public.inventory_movements USING btree (product_id, created_at DESC);


CREATE INDEX IF NOT EXISTS idx_notif_logs_created ON public.notification_logs USING btree (created_at DESC);


CREATE INDEX IF NOT EXISTS idx_notif_logs_customer ON public.notification_logs USING btree (customer_id);


CREATE INDEX IF NOT EXISTS idx_notif_logs_delivery ON public.notification_logs USING btree (delivery_id);


CREATE INDEX IF NOT EXISTS idx_notif_logs_invoice ON public.notification_logs USING btree (invoice_id);


CREATE INDEX IF NOT EXISTS idx_notif_logs_status_retry ON public.notification_logs USING btree (status, next_retry_at) WHERE (status = ANY (ARRAY['queued'::public.notification_status, 'failed'::public.notification_status]));


CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON public.notification_logs USING btree (status) WHERE (status = ANY (ARRAY['queued'::public.notification_status, 'failed'::public.notification_status]));


CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications USING btree (created_at DESC);


CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications USING btree (read_at);


CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications USING btree (user_id);


CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items USING btree (order_id);


CREATE INDEX IF NOT EXISTS idx_orders_date ON public.orders USING btree (order_date DESC);


CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON public.password_reset_tokens USING btree (token);


CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);


CREATE INDEX IF NOT EXISTS idx_payments_customer ON public.payments USING btree (customer_id);


CREATE INDEX IF NOT EXISTS idx_payments_customer_date ON public.payments USING btree (customer_id, payment_date DESC);


CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments USING btree (payment_date DESC);


CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments USING btree (invoice_id);


CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON public.payments USING btree (payment_date DESC);


CREATE INDEX IF NOT EXISTS idx_permissions_category ON public.permissions USING btree (category);


CREATE INDEX IF NOT EXISTS idx_permissions_name ON public.permissions USING btree (name);


CREATE INDEX IF NOT EXISTS idx_product_batches_expiry ON public.product_batches USING btree (expiry_date) WHERE (status = 'active'::text);


CREATE INDEX IF NOT EXISTS idx_product_batches_product ON public.product_batches USING btree (product_id);


CREATE INDEX IF NOT EXISTS idx_products_status ON public.products USING btree (status) WHERE (status = 'active'::text);


CREATE INDEX IF NOT EXISTS idx_products_stock ON public.products USING btree (current_stock);


CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles USING btree (account_status);


CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON public.purchase_items USING btree (purchase_id);


CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions USING btree (user_id);


CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions USING btree (user_id);


CREATE INDEX IF NOT EXISTS idx_reminder_logs_invoice_template ON public.reminder_logs USING btree (invoice_id, template_id);


CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON public.role_permissions USING btree (permission_id);


CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions USING btree (role);


CREATE INDEX IF NOT EXISTS idx_route_stops_customer ON public.route_stops USING btree (customer_id);


CREATE INDEX IF NOT EXISTS idx_route_stops_route ON public.route_stops USING btree (route_id, sequence);


CREATE INDEX IF NOT EXISTS idx_routes_active ON public.routes USING btree (active) WHERE (active = true);


CREATE INDEX IF NOT EXISTS idx_share_activity_logs_created ON public.share_activity_logs USING btree (created_at DESC);


CREATE INDEX IF NOT EXISTS idx_share_activity_logs_invoice ON public.share_activity_logs USING btree (invoice_id, created_at DESC);


CREATE INDEX IF NOT EXISTS idx_share_activity_logs_user ON public.share_activity_logs USING btree (user_id, created_at DESC);


CREATE INDEX IF NOT EXISTS idx_stock_adjustments_date ON public.stock_adjustments USING btree (adjustment_date DESC);


CREATE INDEX IF NOT EXISTS idx_stock_adjustments_status ON public.stock_adjustments USING btree (status);


CREATE INDEX IF NOT EXISTS idx_sudha_claims_date ON public.sudha_claims USING btree (claim_date DESC);


CREATE INDEX IF NOT EXISTS idx_sudha_claims_status ON public.sudha_claims USING btree (status);


CREATE INDEX IF NOT EXISTS idx_supplier_payments_purchase ON public.supplier_payments USING btree (purchase_id);


CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON public.supplier_payments USING btree (supplier_id);


CREATE INDEX IF NOT EXISTS idx_users_distributor_id ON public.users USING btree (distributor_id);


CREATE INDEX IF NOT EXISTS idx_users_email ON public.users USING btree (email) WHERE (email IS NOT NULL);


CREATE INDEX IF NOT EXISTS idx_users_mobile ON public.users USING btree (mobile) WHERE (mobile IS NOT NULL);


CREATE INDEX IF NOT EXISTS idx_users_retailer_id ON public.users USING btree (retailer_id) WHERE (retailer_id IS NOT NULL);


CREATE INDEX IF NOT EXISTS idx_users_role ON public.users USING btree (role);


CREATE INDEX IF NOT EXISTS idx_users_status ON public.users USING btree (status);


CREATE INDEX IF NOT EXISTS retailer_ledger_entries_retailer_idx ON public.retailer_ledger_entries USING btree (retailer_id, entry_date DESC);


-- ============================================================
-- CONSTRAINTS
-- ============================================================

DO $$ BEGIN
  ALTER TABLE ONLY public.access_audit_logs
      ADD CONSTRAINT access_audit_logs_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.app_settings
      ADD CONSTRAINT app_settings_key_key UNIQUE (key);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.app_settings
      ADD CONSTRAINT app_settings_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.audit_logs
      ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.collection_allocations
      ADD CONSTRAINT collection_allocations_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.crate_transactions
      ADD CONSTRAINT crate_transactions_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.crate_types
      ADD CONSTRAINT crate_types_name_key UNIQUE (name);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.crate_types
      ADD CONSTRAINT crate_types_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.customers
      ADD CONSTRAINT customers_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.deliveries
      ADD CONSTRAINT deliveries_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.delivery_cycles
      ADD CONSTRAINT delivery_cycles_cycle_code_key UNIQUE (cycle_code);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.delivery_cycles
      ADD CONSTRAINT delivery_cycles_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.delivery_runs
      ADD CONSTRAINT delivery_runs_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.demand_consolidation_items
      ADD CONSTRAINT demand_consolidation_items_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.demand_consolidations
      ADD CONSTRAINT demand_consolidations_consolidation_no_key UNIQUE (consolidation_no);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.demand_consolidations
      ADD CONSTRAINT demand_consolidations_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.demand_source_orders
      ADD CONSTRAINT demand_source_orders_pkey PRIMARY KEY (demand_consolidation_id, order_id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.distributors
      ADD CONSTRAINT distributors_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.driver_collections
      ADD CONSTRAINT driver_collections_collection_no_key UNIQUE (collection_no);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.driver_collections
      ADD CONSTRAINT driver_collections_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.edit_audit_logs
      ADD CONSTRAINT edit_audit_logs_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.email_verification_tokens
      ADD CONSTRAINT email_verification_tokens_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.email_verification_tokens
      ADD CONSTRAINT email_verification_tokens_token_key UNIQUE (token);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.expense_categories
      ADD CONSTRAINT expense_categories_name_key UNIQUE (name);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.expense_categories
      ADD CONSTRAINT expense_categories_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.expenses
      ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.gps_audit_logs
      ADD CONSTRAINT gps_audit_logs_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.inventory_movements
      ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.invoice_items
      ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.invoice_revisions
      ADD CONSTRAINT invoice_revisions_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.invoices
      ADD CONSTRAINT invoices_invoice_no_key UNIQUE (invoice_no);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.invoices
      ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.login_history
      ADD CONSTRAINT login_history_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.notification_logs
      ADD CONSTRAINT notification_logs_idempotency_key_key UNIQUE (idempotency_key);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.notification_logs
      ADD CONSTRAINT notification_logs_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.notifications
      ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.order_items
      ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.orders
      ADD CONSTRAINT orders_order_no_key UNIQUE (order_no);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.orders
      ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.password_reset_tokens
      ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.password_reset_tokens
      ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.payments
      ADD CONSTRAINT payments_payment_no_key UNIQUE (payment_no);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.payments
      ADD CONSTRAINT payments_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.permissions
      ADD CONSTRAINT permissions_name_key UNIQUE (name);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.permissions
      ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.product_batches
      ADD CONSTRAINT product_batches_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.products
      ADD CONSTRAINT products_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.profiles
      ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.purchase_items
      ADD CONSTRAINT purchase_items_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.purchases
      ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.push_subscriptions
      ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.push_subscriptions
      ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.reminder_logs
      ADD CONSTRAINT reminder_logs_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.reminder_templates
      ADD CONSTRAINT reminder_templates_days_overdue_key UNIQUE (days_overdue);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.reminder_templates
      ADD CONSTRAINT reminder_templates_name_key UNIQUE (name);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.reminder_templates
      ADD CONSTRAINT reminder_templates_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.retailer_ledger_entries
      ADD CONSTRAINT retailer_ledger_entries_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.role_permissions
      ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.role_permissions
      ADD CONSTRAINT role_permissions_role_permission_id_key UNIQUE (role, permission_id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.route_stops
      ADD CONSTRAINT route_stops_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.route_stops
      ADD CONSTRAINT route_stops_route_id_customer_id_key UNIQUE (route_id, customer_id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.routes
      ADD CONSTRAINT routes_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.share_activity_logs
      ADD CONSTRAINT share_activity_logs_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.stock_adjustment_items
      ADD CONSTRAINT stock_adjustment_items_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.stock_adjustments
      ADD CONSTRAINT stock_adjustments_adjustment_no_key UNIQUE (adjustment_no);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.stock_adjustments
      ADD CONSTRAINT stock_adjustments_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.stock_reconciliation_items
      ADD CONSTRAINT stock_reconciliation_items_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.stock_reconciliations
      ADD CONSTRAINT stock_reconciliations_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.stock_reconciliations
      ADD CONSTRAINT stock_reconciliations_recon_no_key UNIQUE (recon_no);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.sudha_claims
      ADD CONSTRAINT sudha_claims_claim_no_key UNIQUE (claim_no);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.sudha_claims
      ADD CONSTRAINT sudha_claims_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.supplier_payments
      ADD CONSTRAINT supplier_payments_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.suppliers
      ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.user_roles
      ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.user_roles
      ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.users
      ADD CONSTRAINT users_email_key UNIQUE (email);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.users
      ADD CONSTRAINT users_mobile_key UNIQUE (mobile);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.users
      ADD CONSTRAINT users_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.warehouses
      ADD CONSTRAINT warehouses_name_key UNIQUE (name);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.warehouses
      ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.audit_logs
      ADD CONSTRAINT audit_logs_distributor_id_fkey FOREIGN KEY (distributor_id) REFERENCES public.distributors(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.audit_logs
      ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.collection_allocations
      ADD CONSTRAINT collection_allocations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.collection_allocations
      ADD CONSTRAINT collection_allocations_driver_collection_id_fkey FOREIGN KEY (driver_collection_id) REFERENCES public.driver_collections(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.collection_allocations
      ADD CONSTRAINT collection_allocations_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.crate_transactions
      ADD CONSTRAINT crate_transactions_crate_type_id_fkey FOREIGN KEY (crate_type_id) REFERENCES public.crate_types(id) ON DELETE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.crate_transactions
      ADD CONSTRAINT crate_transactions_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.deliveries(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.crate_transactions
      ADD CONSTRAINT crate_transactions_retailer_id_fkey FOREIGN KEY (retailer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.crate_transactions
      ADD CONSTRAINT crate_transactions_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.customers
      ADD CONSTRAINT customers_assigned_route_id_fkey FOREIGN KEY (assigned_route_id) REFERENCES public.routes(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.customers
      ADD CONSTRAINT customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.deliveries
      ADD CONSTRAINT deliveries_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.deliveries
      ADD CONSTRAINT deliveries_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.deliveries
      ADD CONSTRAINT deliveries_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.delivery_runs
      ADD CONSTRAINT delivery_runs_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.demand_consolidation_items
      ADD CONSTRAINT demand_consolidation_items_demand_consolidation_id_fkey FOREIGN KEY (demand_consolidation_id) REFERENCES public.demand_consolidations(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.demand_consolidation_items
      ADD CONSTRAINT demand_consolidation_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.demand_consolidations
      ADD CONSTRAINT demand_consolidations_delivery_cycle_id_fkey FOREIGN KEY (delivery_cycle_id) REFERENCES public.delivery_cycles(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.demand_source_orders
      ADD CONSTRAINT demand_source_orders_demand_consolidation_id_fkey FOREIGN KEY (demand_consolidation_id) REFERENCES public.demand_consolidations(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.demand_source_orders
      ADD CONSTRAINT demand_source_orders_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.driver_collections
      ADD CONSTRAINT driver_collections_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.email_verification_tokens
      ADD CONSTRAINT email_verification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.expenses
      ADD CONSTRAINT expenses_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.expense_categories(id) ON DELETE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.gps_audit_logs
      ADD CONSTRAINT gps_audit_logs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.gps_audit_logs
      ADD CONSTRAINT gps_audit_logs_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.deliveries(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.gps_audit_logs
      ADD CONSTRAINT gps_audit_logs_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.gps_audit_logs
      ADD CONSTRAINT gps_audit_logs_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.gps_audit_logs
      ADD CONSTRAINT gps_audit_logs_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.delivery_runs(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.gps_audit_logs
      ADD CONSTRAINT gps_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.inventory_movements
      ADD CONSTRAINT inventory_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.inventory_movements
      ADD CONSTRAINT inventory_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.invoice_items
      ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.invoice_items
      ADD CONSTRAINT invoice_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.invoice_revisions
      ADD CONSTRAINT invoice_revisions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.invoice_revisions
      ADD CONSTRAINT invoice_revisions_original_invoice_id_fkey FOREIGN KEY (original_invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.invoices
      ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.invoices
      ADD CONSTRAINT invoices_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.invoices
      ADD CONSTRAINT invoices_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES public.invoices(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.login_history
      ADD CONSTRAINT login_history_distributor_id_fkey FOREIGN KEY (distributor_id) REFERENCES public.distributors(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.login_history
      ADD CONSTRAINT login_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.notification_logs
      ADD CONSTRAINT notification_logs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.notification_logs
      ADD CONSTRAINT notification_logs_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.deliveries(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.notification_logs
      ADD CONSTRAINT notification_logs_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.notifications
      ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.order_items
      ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.order_items
      ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.orders
      ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.password_reset_tokens
      ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.payments
      ADD CONSTRAINT payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.payments
      ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.product_batches
      ADD CONSTRAINT product_batches_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.product_batches
      ADD CONSTRAINT product_batches_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.product_batches
      ADD CONSTRAINT product_batches_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.profiles
      ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.purchase_items
      ADD CONSTRAINT purchase_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.purchase_items
      ADD CONSTRAINT purchase_items_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.purchases
      ADD CONSTRAINT purchases_delivery_cycle_id_fkey FOREIGN KEY (delivery_cycle_id) REFERENCES public.delivery_cycles(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.purchases
      ADD CONSTRAINT purchases_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.push_subscriptions
      ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.reminder_logs
      ADD CONSTRAINT reminder_logs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.reminder_logs
      ADD CONSTRAINT reminder_logs_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.reminder_logs
      ADD CONSTRAINT reminder_logs_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.reminder_templates(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.retailer_ledger_entries
      ADD CONSTRAINT retailer_ledger_entries_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.retailer_ledger_entries
      ADD CONSTRAINT retailer_ledger_entries_retailer_id_fkey FOREIGN KEY (retailer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.role_permissions
      ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.route_stops
      ADD CONSTRAINT route_stops_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.route_stops
      ADD CONSTRAINT route_stops_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.share_activity_logs
      ADD CONSTRAINT share_activity_logs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.share_activity_logs
      ADD CONSTRAINT share_activity_logs_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.share_activity_logs
      ADD CONSTRAINT share_activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.stock_adjustment_items
      ADD CONSTRAINT stock_adjustment_items_adjustment_id_fkey FOREIGN KEY (adjustment_id) REFERENCES public.stock_adjustments(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.stock_adjustment_items
      ADD CONSTRAINT stock_adjustment_items_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.product_batches(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.stock_adjustment_items
      ADD CONSTRAINT stock_adjustment_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.stock_adjustments
      ADD CONSTRAINT stock_adjustments_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.stock_adjustments
      ADD CONSTRAINT stock_adjustments_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.stock_adjustments
      ADD CONSTRAINT stock_adjustments_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.stock_reconciliation_items
      ADD CONSTRAINT stock_reconciliation_items_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.product_batches(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.stock_reconciliation_items
      ADD CONSTRAINT stock_reconciliation_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.stock_reconciliation_items
      ADD CONSTRAINT stock_reconciliation_items_recon_id_fkey FOREIGN KEY (recon_id) REFERENCES public.stock_reconciliations(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.stock_reconciliations
      ADD CONSTRAINT stock_reconciliations_conducted_by_fkey FOREIGN KEY (conducted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.stock_reconciliations
      ADD CONSTRAINT stock_reconciliations_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.sudha_claims
      ADD CONSTRAINT sudha_claims_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.sudha_claims
      ADD CONSTRAINT sudha_claims_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.sudha_claims
      ADD CONSTRAINT sudha_claims_purchase_item_id_fkey FOREIGN KEY (purchase_item_id) REFERENCES public.purchase_items(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.supplier_payments
      ADD CONSTRAINT supplier_payments_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.supplier_payments
      ADD CONSTRAINT supplier_payments_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.user_roles
      ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.users
      ADD CONSTRAINT users_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


DO $$ BEGIN
  ALTER TABLE ONLY public.users
      ADD CONSTRAINT users_distributor_id_fkey FOREIGN KEY (distributor_id) REFERENCES public.distributors(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN invalid_table_definition THEN NULL;
END $$;


-- ------------------------------------------------------------
-- FROM 005_triggers.sql
-- ------------------------------------------------------------

-- ============================================================
-- TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS customers_guard_user_id ON public.customers;
CREATE TRIGGER customers_guard_user_id BEFORE INSERT OR UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.tg_customers_guard_user_id();


DROP TRIGGER IF EXISTS customers_updated ON public.customers;
CREATE TRIGGER customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


DROP TRIGGER IF EXISTS deliveries_recalc_run_status ON public.deliveries;
CREATE TRIGGER deliveries_recalc_run_status AFTER INSERT OR DELETE OR UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.tg_deliveries_recalc_run_status();


DROP TRIGGER IF EXISTS deliveries_updated ON public.deliveries;
CREATE TRIGGER deliveries_updated BEFORE UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


DROP TRIGGER IF EXISTS delivery_runs_enqueue_notifications ON public.delivery_runs;
CREATE TRIGGER delivery_runs_enqueue_notifications AFTER UPDATE OF delivery_status ON public.delivery_runs FOR EACH ROW EXECUTE FUNCTION public.tg_runs_enqueue_status_notifications();


DROP TRIGGER IF EXISTS delivery_runs_recalc_status ON public.delivery_runs;
CREATE TRIGGER delivery_runs_recalc_status AFTER INSERT OR UPDATE OF status, run_date, route_id ON public.delivery_runs FOR EACH ROW EXECUTE FUNCTION public.tg_runs_recalc_delivery_status();


DROP TRIGGER IF EXISTS delivery_runs_updated ON public.delivery_runs;
CREATE TRIGGER delivery_runs_updated BEFORE UPDATE ON public.delivery_runs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


DROP TRIGGER IF EXISTS invoices_updated ON public.invoices;
CREATE TRIGGER invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


DROP TRIGGER IF EXISTS orders_updated ON public.orders;
CREATE TRIGGER orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


DROP TRIGGER IF EXISTS products_updated ON public.products;
CREATE TRIGGER products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


DROP TRIGGER IF EXISTS purchases_updated ON public.purchases;
CREATE TRIGGER purchases_updated BEFORE UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


DROP TRIGGER IF EXISTS route_stops_updated ON public.route_stops;
CREATE TRIGGER route_stops_updated BEFORE UPDATE ON public.route_stops FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


DROP TRIGGER IF EXISTS routes_updated ON public.routes;
CREATE TRIGGER routes_updated BEFORE UPDATE ON public.routes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


DROP TRIGGER IF EXISTS set_updated_at_retailer_ledger_entries ON public.retailer_ledger_entries;
CREATE TRIGGER set_updated_at_retailer_ledger_entries BEFORE UPDATE ON public.retailer_ledger_entries FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


DROP TRIGGER IF EXISTS suppliers_updated ON public.suppliers;
CREATE TRIGGER suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


DROP TRIGGER IF EXISTS trg_delivery_cycles_updated_at ON public.delivery_cycles;
CREATE TRIGGER trg_delivery_cycles_updated_at BEFORE UPDATE ON public.delivery_cycles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


DROP TRIGGER IF EXISTS trg_demand_consolidation_items_updated_at ON public.demand_consolidation_items;
CREATE TRIGGER trg_demand_consolidation_items_updated_at BEFORE UPDATE ON public.demand_consolidation_items FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


DROP TRIGGER IF EXISTS trg_demand_consolidations_updated_at ON public.demand_consolidations;
CREATE TRIGGER trg_demand_consolidations_updated_at BEFORE UPDATE ON public.demand_consolidations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


DROP TRIGGER IF EXISTS trg_distributors_updated_at ON public.distributors;
CREATE TRIGGER trg_distributors_updated_at BEFORE UPDATE ON public.distributors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


DROP TRIGGER IF EXISTS trg_driver_collections_updated_at ON public.driver_collections;
CREATE TRIGGER trg_driver_collections_updated_at BEFORE UPDATE ON public.driver_collections FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


DROP TRIGGER IF EXISTS trg_expense_categories_updated_at ON public.expense_categories;
CREATE TRIGGER trg_expense_categories_updated_at BEFORE UPDATE ON public.expense_categories FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


DROP TRIGGER IF EXISTS trg_expenses_updated_at ON public.expenses;
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


DROP TRIGGER IF EXISTS trg_generate_employee_id ON public.users;
CREATE TRIGGER trg_generate_employee_id BEFORE INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.generate_employee_id();


DROP TRIGGER IF EXISTS trg_generate_retailer_code ON public.users;
CREATE TRIGGER trg_generate_retailer_code BEFORE INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.generate_retailer_code();


DROP TRIGGER IF EXISTS trg_invoice_items_recalc ON public.invoice_items;
CREATE TRIGGER trg_invoice_items_recalc AFTER INSERT OR DELETE OR UPDATE ON public.invoice_items FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_items_recalc();


DROP TRIGGER IF EXISTS trg_invoices_customer_outstanding ON public.invoices;
CREATE TRIGGER trg_invoices_customer_outstanding AFTER INSERT OR DELETE OR UPDATE OF balance, status, customer_id, total ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tg_invoices_customer_outstanding();


DROP TRIGGER IF EXISTS trg_log_delivery_changes ON public.deliveries;
CREATE TRIGGER trg_log_delivery_changes AFTER UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.log_delivery_changes();


DROP TRIGGER IF EXISTS trg_log_delivery_run_changes ON public.delivery_runs;
CREATE TRIGGER trg_log_delivery_run_changes AFTER INSERT OR UPDATE ON public.delivery_runs FOR EACH ROW EXECUTE FUNCTION public.log_delivery_run_changes();


DROP TRIGGER IF EXISTS trg_notif_logs_updated_at ON public.notification_logs;
CREATE TRIGGER trg_notif_logs_updated_at BEFORE UPDATE ON public.notification_logs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


DROP TRIGGER IF EXISTS trg_payments_recalc ON public.payments;
CREATE TRIGGER trg_payments_recalc AFTER INSERT OR DELETE OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.tg_payments_recalc();


DROP TRIGGER IF EXISTS trg_purchases_supplier_outstanding ON public.purchases;
CREATE TRIGGER trg_purchases_supplier_outstanding AFTER INSERT OR DELETE OR UPDATE OF total, paid, status, supplier_id ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.tg_purchases_supplier_outstanding();


DROP TRIGGER IF EXISTS trg_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_updated_at BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


DROP TRIGGER IF EXISTS trg_reminder_templates_updated_at ON public.reminder_templates;
CREATE TRIGGER trg_reminder_templates_updated_at BEFORE UPDATE ON public.reminder_templates FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


DROP TRIGGER IF EXISTS trg_sudha_claims_updated_at ON public.sudha_claims;
CREATE TRIGGER trg_sudha_claims_updated_at BEFORE UPDATE ON public.sudha_claims FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


DROP TRIGGER IF EXISTS trg_supplier_payments_recalc ON public.supplier_payments;
CREATE TRIGGER trg_supplier_payments_recalc AFTER INSERT OR DELETE OR UPDATE ON public.supplier_payments FOR EACH ROW EXECUTE FUNCTION public.tg_supplier_payments_recalc();


DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ------------------------------------------------------------
-- FROM 006_grants_comments.sql
-- ------------------------------------------------------------

-- ============================================================
-- GRANTS (anon / authenticated / service_role)
-- ============================================================

GRANT ALL ON FUNCTION public.apply_delivery_quantities(_invoice_id uuid, _items jsonb) TO anon;
GRANT ALL ON FUNCTION public.apply_delivery_quantities(_invoice_id uuid, _items jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.apply_delivery_quantities(_invoice_id uuid, _items jsonb) TO service_role;


REVOKE ALL ON FUNCTION public.can_manage_finance(_uid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_manage_finance(_uid uuid) TO service_role;


REVOKE ALL ON FUNCTION public.can_manage_sales(_uid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.can_manage_sales(_uid uuid) TO service_role;


REVOKE ALL ON FUNCTION public.create_demand_consolidation(p_delivery_cycle_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_demand_consolidation(p_delivery_cycle_id uuid) TO service_role;


REVOKE ALL ON FUNCTION public.create_notification(_user_id uuid, _type text, _title text, _body text, _data jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_notification(_user_id uuid, _type text, _title text, _body text, _data jsonb) TO service_role;


REVOKE ALL ON FUNCTION public.enqueue_delivery_notifications(_delivery_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.enqueue_delivery_notifications(_delivery_id uuid) TO service_role;


REVOKE ALL ON FUNCTION public.enqueue_run_en_route_notifications(_run_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.enqueue_run_en_route_notifications(_run_id uuid) TO service_role;


REVOKE ALL ON FUNCTION public.ensure_delivery_cycle(p_delivery_date date, p_shift text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ensure_delivery_cycle(p_delivery_date date, p_shift text) TO service_role;


REVOKE ALL ON FUNCTION public.generate_adjustment_no() FROM PUBLIC;
GRANT ALL ON FUNCTION public.generate_adjustment_no() TO service_role;


REVOKE ALL ON FUNCTION public.generate_claim_no() FROM PUBLIC;
GRANT ALL ON FUNCTION public.generate_claim_no() TO authenticated;
GRANT ALL ON FUNCTION public.generate_claim_no() TO service_role;


REVOKE ALL ON FUNCTION public.generate_collection_no() FROM PUBLIC;
GRANT ALL ON FUNCTION public.generate_collection_no() TO service_role;


REVOKE ALL ON FUNCTION public.generate_consolidation_no(p_date date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.generate_consolidation_no(p_date date) TO service_role;


REVOKE ALL ON FUNCTION public.generate_cycle_code(p_order_date date, p_shift text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.generate_cycle_code(p_order_date date, p_shift text) TO service_role;


GRANT ALL ON FUNCTION public.generate_employee_id() TO anon;
GRANT ALL ON FUNCTION public.generate_employee_id() TO authenticated;
GRANT ALL ON FUNCTION public.generate_employee_id() TO service_role;


REVOKE ALL ON FUNCTION public.generate_recon_no() FROM PUBLIC;
GRANT ALL ON FUNCTION public.generate_recon_no() TO service_role;


GRANT ALL ON FUNCTION public.generate_retailer_code() TO anon;
GRANT ALL ON FUNCTION public.generate_retailer_code() TO authenticated;
GRANT ALL ON FUNCTION public.generate_retailer_code() TO service_role;


GRANT ALL ON FUNCTION public.get_account_status(_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_account_status(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_account_status(_user_id uuid) TO service_role;


REVOKE ALL ON FUNCTION public.get_app_setting(_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_app_setting(_key text) TO service_role;


REVOKE ALL ON FUNCTION public.get_crate_balance_as_of(p_as_of_date date, p_crate_type_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_crate_balance_as_of(p_as_of_date date, p_crate_type_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_crate_balance_as_of(p_as_of_date date, p_crate_type_id uuid) TO service_role;


REVOKE ALL ON FUNCTION public.get_customer_by_user_email(_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_customer_by_user_email(_email text) TO service_role;


REVOKE ALL ON FUNCTION public.get_near_expiry_stock(_days integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_near_expiry_stock(_days integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_near_expiry_stock(_days integer) TO service_role;


REVOKE ALL ON FUNCTION public.get_next_revision_no(_invoice_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_next_revision_no(_invoice_id uuid) TO service_role;


GRANT ALL ON FUNCTION public.get_permission_id(_name text) TO anon;
GRANT ALL ON FUNCTION public.get_permission_id(_name text) TO authenticated;
GRANT ALL ON FUNCTION public.get_permission_id(_name text) TO service_role;


GRANT ALL ON FUNCTION public.get_retailer_code(_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_retailer_code(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_retailer_code(_user_id uuid) TO service_role;


REVOKE ALL ON FUNCTION public.get_stock_valuation() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_stock_valuation() TO authenticated;
GRANT ALL ON FUNCTION public.get_stock_valuation() TO service_role;


REVOKE ALL ON FUNCTION public.get_unread_notification_count(_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_unread_notification_count(_user_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.get_unread_notification_count(_user_id uuid) TO authenticated;


GRANT ALL ON FUNCTION public.get_user_permissions(_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_permissions(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_permissions(_user_id uuid) TO service_role;


REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


GRANT ALL ON FUNCTION public.has_permission(_user_id uuid, _permission_name text) TO anon;
GRANT ALL ON FUNCTION public.has_permission(_user_id uuid, _permission_name text) TO authenticated;
GRANT ALL ON FUNCTION public.has_permission(_user_id uuid, _permission_name text) TO service_role;


REVOKE ALL ON FUNCTION public.has_reminder_been_sent(_invoice_id uuid, _template_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_reminder_been_sent(_invoice_id uuid, _template_id uuid) TO service_role;


REVOKE ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO service_role;


GRANT ALL ON FUNCTION public.is_account_active(_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_account_active(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_account_active(_user_id uuid) TO service_role;


REVOKE ALL ON FUNCTION public.is_internal_staff(_uid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_internal_staff(_uid uuid) TO service_role;


REVOKE ALL ON FUNCTION public.is_staff(_uid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_staff(_uid uuid) TO service_role;


REVOKE ALL ON FUNCTION public.link_customer_to_user(_customer_id uuid, _email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.link_customer_to_user(_customer_id uuid, _email text) TO service_role;


REVOKE ALL ON FUNCTION public.log_access_event(_event_type text, _user_id uuid, _user_email text, _user_roles text[], _required_roles text[], _route_path text, _ip_address text, _user_agent text, _reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.log_access_event(_event_type text, _user_id uuid, _user_email text, _user_roles text[], _required_roles text[], _route_path text, _ip_address text, _user_agent text, _reason text) TO service_role;


REVOKE ALL ON FUNCTION public.log_delivery_changes() FROM PUBLIC;
GRANT ALL ON FUNCTION public.log_delivery_changes() TO service_role;


REVOKE ALL ON FUNCTION public.log_delivery_run_changes() FROM PUBLIC;
GRANT ALL ON FUNCTION public.log_delivery_run_changes() TO service_role;


REVOKE ALL ON FUNCTION public.post_stock_adjustment(_adjustment_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.post_stock_adjustment(_adjustment_id uuid) TO service_role;


GRANT ALL ON FUNCTION public.recalc_customer_outstanding(_customer_id uuid) TO anon;
GRANT ALL ON FUNCTION public.recalc_customer_outstanding(_customer_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.recalc_customer_outstanding(_customer_id uuid) TO service_role;


GRANT ALL ON FUNCTION public.recalc_invoice(_invoice_id uuid) TO anon;
GRANT ALL ON FUNCTION public.recalc_invoice(_invoice_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.recalc_invoice(_invoice_id uuid) TO service_role;


GRANT ALL ON FUNCTION public.recalc_purchase(_purchase_id uuid) TO anon;
GRANT ALL ON FUNCTION public.recalc_purchase(_purchase_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.recalc_purchase(_purchase_id uuid) TO service_role;


GRANT ALL ON FUNCTION public.recalc_run_delivery_status(_run_id uuid) TO anon;
GRANT ALL ON FUNCTION public.recalc_run_delivery_status(_run_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.recalc_run_delivery_status(_run_id uuid) TO service_role;


GRANT ALL ON FUNCTION public.recalc_supplier_outstanding(_supplier_id uuid) TO anon;
GRANT ALL ON FUNCTION public.recalc_supplier_outstanding(_supplier_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.recalc_supplier_outstanding(_supplier_id uuid) TO service_role;


REVOKE ALL ON FUNCTION public.reconcile_collection(_collection_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reconcile_collection(_collection_id uuid) TO service_role;


GRANT ALL ON TABLE public.notification_logs TO anon;
GRANT ALL ON TABLE public.notification_logs TO authenticated;
GRANT ALL ON TABLE public.notification_logs TO service_role;


GRANT ALL ON FUNCTION public.record_notification_attempt(_id uuid, _success boolean, _error text, _provider text, _provider_msg text, _suppressed boolean) TO anon;
GRANT ALL ON FUNCTION public.record_notification_attempt(_id uuid, _success boolean, _error text, _provider text, _provider_msg text, _suppressed boolean) TO authenticated;
GRANT ALL ON FUNCTION public.record_notification_attempt(_id uuid, _success boolean, _error text, _provider text, _provider_msg text, _suppressed boolean) TO service_role;


REVOKE ALL ON FUNCTION public.revise_invoice(_invoice_id uuid, _revision_reason text, _revised_items jsonb, _revised_by uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.revise_invoice(_invoice_id uuid, _revision_reason text, _revised_items jsonb, _revised_by uuid) TO service_role;


GRANT ALL ON FUNCTION public.role_has_permission(_role text, _permission_name text) TO anon;
GRANT ALL ON FUNCTION public.role_has_permission(_role text, _permission_name text) TO authenticated;
GRANT ALL ON FUNCTION public.role_has_permission(_role text, _permission_name text) TO service_role;


REVOKE ALL ON FUNCTION public.send_notification(_user_id uuid, _type text, _title text, _body text, _data jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.send_notification(_user_id uuid, _type text, _title text, _body text, _data jsonb) TO service_role;


REVOKE ALL ON FUNCTION public.tg_customers_guard_user_id() FROM PUBLIC;
GRANT ALL ON FUNCTION public.tg_customers_guard_user_id() TO service_role;


GRANT ALL ON FUNCTION public.tg_deliveries_recalc_run_status() TO anon;
GRANT ALL ON FUNCTION public.tg_deliveries_recalc_run_status() TO authenticated;
GRANT ALL ON FUNCTION public.tg_deliveries_recalc_run_status() TO service_role;


GRANT ALL ON FUNCTION public.tg_invoice_items_recalc() TO anon;
GRANT ALL ON FUNCTION public.tg_invoice_items_recalc() TO authenticated;
GRANT ALL ON FUNCTION public.tg_invoice_items_recalc() TO service_role;


GRANT ALL ON FUNCTION public.tg_invoices_customer_outstanding() TO anon;
GRANT ALL ON FUNCTION public.tg_invoices_customer_outstanding() TO authenticated;
GRANT ALL ON FUNCTION public.tg_invoices_customer_outstanding() TO service_role;


GRANT ALL ON FUNCTION public.tg_payments_recalc() TO anon;
GRANT ALL ON FUNCTION public.tg_payments_recalc() TO authenticated;
GRANT ALL ON FUNCTION public.tg_payments_recalc() TO service_role;


GRANT ALL ON FUNCTION public.tg_purchases_supplier_outstanding() TO anon;
GRANT ALL ON FUNCTION public.tg_purchases_supplier_outstanding() TO authenticated;
GRANT ALL ON FUNCTION public.tg_purchases_supplier_outstanding() TO service_role;


REVOKE ALL ON FUNCTION public.tg_runs_enqueue_status_notifications() FROM PUBLIC;
GRANT ALL ON FUNCTION public.tg_runs_enqueue_status_notifications() TO service_role;


GRANT ALL ON FUNCTION public.tg_runs_recalc_delivery_status() TO anon;
GRANT ALL ON FUNCTION public.tg_runs_recalc_delivery_status() TO authenticated;
GRANT ALL ON FUNCTION public.tg_runs_recalc_delivery_status() TO service_role;


GRANT ALL ON FUNCTION public.tg_set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.tg_set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.tg_set_updated_at() TO service_role;


GRANT ALL ON FUNCTION public.tg_supplier_payments_recalc() TO anon;
GRANT ALL ON FUNCTION public.tg_supplier_payments_recalc() TO authenticated;
GRANT ALL ON FUNCTION public.tg_supplier_payments_recalc() TO service_role;


GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


GRANT ALL ON TABLE public.access_audit_logs TO anon;
GRANT ALL ON TABLE public.access_audit_logs TO authenticated;
GRANT ALL ON TABLE public.access_audit_logs TO service_role;


GRANT ALL ON TABLE public.app_settings TO anon;
GRANT ALL ON TABLE public.app_settings TO authenticated;
GRANT ALL ON TABLE public.app_settings TO service_role;


GRANT ALL ON TABLE public.audit_logs TO anon;
GRANT ALL ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;


GRANT ALL ON TABLE public.collection_allocations TO anon;
GRANT ALL ON TABLE public.collection_allocations TO authenticated;
GRANT ALL ON TABLE public.collection_allocations TO service_role;


GRANT ALL ON TABLE public.crate_transactions TO anon;
GRANT ALL ON TABLE public.crate_transactions TO authenticated;
GRANT ALL ON TABLE public.crate_transactions TO service_role;


GRANT ALL ON TABLE public.crate_types TO anon;
GRANT ALL ON TABLE public.crate_types TO authenticated;
GRANT ALL ON TABLE public.crate_types TO service_role;


GRANT ALL ON TABLE public.customers TO anon;
GRANT ALL ON TABLE public.customers TO authenticated;
GRANT ALL ON TABLE public.customers TO service_role;


GRANT ALL ON TABLE public.invoice_items TO anon;
GRANT ALL ON TABLE public.invoice_items TO authenticated;
GRANT ALL ON TABLE public.invoice_items TO service_role;


GRANT ALL ON TABLE public.invoices TO anon;
GRANT ALL ON TABLE public.invoices TO authenticated;
GRANT ALL ON TABLE public.invoices TO service_role;


GRANT ALL ON TABLE public.purchase_items TO anon;
GRANT ALL ON TABLE public.purchase_items TO authenticated;
GRANT ALL ON TABLE public.purchase_items TO service_role;


GRANT ALL ON TABLE public.purchases TO anon;
GRANT ALL ON TABLE public.purchases TO authenticated;
GRANT ALL ON TABLE public.purchases TO service_role;


GRANT ALL ON TABLE public.daily_reconciliation TO anon;
GRANT ALL ON TABLE public.daily_reconciliation TO authenticated;
GRANT ALL ON TABLE public.daily_reconciliation TO service_role;


GRANT ALL ON TABLE public.deliveries TO anon;
GRANT ALL ON TABLE public.deliveries TO authenticated;
GRANT ALL ON TABLE public.deliveries TO service_role;


GRANT ALL ON TABLE public.delivery_cycles TO anon;
GRANT ALL ON TABLE public.delivery_cycles TO authenticated;
GRANT ALL ON TABLE public.delivery_cycles TO service_role;


GRANT ALL ON TABLE public.delivery_runs TO anon;
GRANT ALL ON TABLE public.delivery_runs TO authenticated;
GRANT ALL ON TABLE public.delivery_runs TO service_role;


GRANT ALL ON TABLE public.demand_consolidation_items TO anon;
GRANT ALL ON TABLE public.demand_consolidation_items TO authenticated;
GRANT ALL ON TABLE public.demand_consolidation_items TO service_role;


GRANT ALL ON TABLE public.demand_consolidations TO anon;
GRANT ALL ON TABLE public.demand_consolidations TO authenticated;
GRANT ALL ON TABLE public.demand_consolidations TO service_role;


GRANT ALL ON TABLE public.demand_source_orders TO anon;
GRANT ALL ON TABLE public.demand_source_orders TO authenticated;
GRANT ALL ON TABLE public.demand_source_orders TO service_role;


GRANT ALL ON TABLE public.distributors TO anon;
GRANT ALL ON TABLE public.distributors TO authenticated;
GRANT ALL ON TABLE public.distributors TO service_role;


GRANT ALL ON TABLE public.driver_collections TO anon;
GRANT ALL ON TABLE public.driver_collections TO authenticated;
GRANT ALL ON TABLE public.driver_collections TO service_role;


GRANT ALL ON TABLE public.edit_audit_logs TO anon;
GRANT ALL ON TABLE public.edit_audit_logs TO authenticated;
GRANT ALL ON TABLE public.edit_audit_logs TO service_role;


GRANT ALL ON TABLE public.email_verification_tokens TO anon;
GRANT ALL ON TABLE public.email_verification_tokens TO authenticated;
GRANT ALL ON TABLE public.email_verification_tokens TO service_role;


GRANT ALL ON TABLE public.expense_categories TO anon;
GRANT ALL ON TABLE public.expense_categories TO authenticated;
GRANT ALL ON TABLE public.expense_categories TO service_role;


GRANT ALL ON TABLE public.expenses TO anon;
GRANT ALL ON TABLE public.expenses TO authenticated;
GRANT ALL ON TABLE public.expenses TO service_role;


GRANT ALL ON TABLE public.gps_audit_logs TO anon;
GRANT ALL ON TABLE public.gps_audit_logs TO authenticated;
GRANT ALL ON TABLE public.gps_audit_logs TO service_role;


GRANT ALL ON TABLE public.inventory_movements TO anon;
GRANT ALL ON TABLE public.inventory_movements TO authenticated;
GRANT ALL ON TABLE public.inventory_movements TO service_role;


GRANT ALL ON TABLE public.invoice_revisions TO anon;
GRANT ALL ON TABLE public.invoice_revisions TO authenticated;
GRANT ALL ON TABLE public.invoice_revisions TO service_role;


GRANT ALL ON TABLE public.login_history TO anon;
GRANT ALL ON TABLE public.login_history TO authenticated;
GRANT ALL ON TABLE public.login_history TO service_role;


GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


GRANT ALL ON TABLE public.order_items TO anon;
GRANT ALL ON TABLE public.order_items TO authenticated;
GRANT ALL ON TABLE public.order_items TO service_role;


GRANT ALL ON TABLE public.orders TO anon;
GRANT ALL ON TABLE public.orders TO authenticated;
GRANT ALL ON TABLE public.orders TO service_role;


GRANT ALL ON TABLE public.password_reset_tokens TO anon;
GRANT ALL ON TABLE public.password_reset_tokens TO authenticated;
GRANT ALL ON TABLE public.password_reset_tokens TO service_role;


GRANT ALL ON TABLE public.payments TO anon;
GRANT ALL ON TABLE public.payments TO authenticated;
GRANT ALL ON TABLE public.payments TO service_role;


GRANT ALL ON TABLE public.permissions TO anon;
GRANT ALL ON TABLE public.permissions TO authenticated;
GRANT ALL ON TABLE public.permissions TO service_role;


GRANT ALL ON TABLE public.product_batches TO anon;
GRANT ALL ON TABLE public.product_batches TO authenticated;
GRANT ALL ON TABLE public.product_batches TO service_role;


GRANT ALL ON TABLE public.products TO anon;
GRANT ALL ON TABLE public.products TO authenticated;
GRANT ALL ON TABLE public.products TO service_role;


GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


GRANT ALL ON TABLE public.push_subscriptions TO anon;
GRANT ALL ON TABLE public.push_subscriptions TO authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;


GRANT ALL ON TABLE public.reminder_logs TO anon;
GRANT ALL ON TABLE public.reminder_logs TO authenticated;
GRANT ALL ON TABLE public.reminder_logs TO service_role;


GRANT ALL ON TABLE public.reminder_templates TO anon;
GRANT ALL ON TABLE public.reminder_templates TO authenticated;
GRANT ALL ON TABLE public.reminder_templates TO service_role;


GRANT ALL ON TABLE public.retailer_ledger_entries TO anon;
GRANT ALL ON TABLE public.retailer_ledger_entries TO authenticated;
GRANT ALL ON TABLE public.retailer_ledger_entries TO service_role;


GRANT ALL ON TABLE public.role_permissions TO anon;
GRANT ALL ON TABLE public.role_permissions TO authenticated;
GRANT ALL ON TABLE public.role_permissions TO service_role;


GRANT ALL ON TABLE public.route_stops TO anon;
GRANT ALL ON TABLE public.route_stops TO authenticated;
GRANT ALL ON TABLE public.route_stops TO service_role;


GRANT ALL ON TABLE public.routes TO anon;
GRANT ALL ON TABLE public.routes TO authenticated;
GRANT ALL ON TABLE public.routes TO service_role;


GRANT ALL ON TABLE public.share_activity_logs TO service_role;
GRANT SELECT,INSERT ON TABLE public.share_activity_logs TO authenticated;


GRANT ALL ON TABLE public.stock_adjustment_items TO anon;
GRANT ALL ON TABLE public.stock_adjustment_items TO authenticated;
GRANT ALL ON TABLE public.stock_adjustment_items TO service_role;


GRANT ALL ON TABLE public.stock_adjustments TO anon;
GRANT ALL ON TABLE public.stock_adjustments TO authenticated;
GRANT ALL ON TABLE public.stock_adjustments TO service_role;


GRANT ALL ON TABLE public.stock_reconciliation_items TO anon;
GRANT ALL ON TABLE public.stock_reconciliation_items TO authenticated;
GRANT ALL ON TABLE public.stock_reconciliation_items TO service_role;


GRANT ALL ON TABLE public.stock_reconciliations TO anon;
GRANT ALL ON TABLE public.stock_reconciliations TO authenticated;
GRANT ALL ON TABLE public.stock_reconciliations TO service_role;


GRANT ALL ON TABLE public.sudha_claims TO anon;
GRANT ALL ON TABLE public.sudha_claims TO authenticated;
GRANT ALL ON TABLE public.sudha_claims TO service_role;


GRANT ALL ON TABLE public.supplier_payments TO anon;
GRANT ALL ON TABLE public.supplier_payments TO authenticated;
GRANT ALL ON TABLE public.supplier_payments TO service_role;


GRANT ALL ON TABLE public.suppliers TO anon;
GRANT ALL ON TABLE public.suppliers TO authenticated;
GRANT ALL ON TABLE public.suppliers TO service_role;


GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;


GRANT ALL ON TABLE public.users TO anon;
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;


GRANT ALL ON TABLE public.warehouses TO anon;
GRANT ALL ON TABLE public.warehouses TO authenticated;
GRANT ALL ON TABLE public.warehouses TO service_role;


-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.audit_logs IS 'Tracks important actions: user creation, status changes, permission updates, etc.';


COMMENT ON TABLE public.distributors IS 'Tenant table. Currently one row (your business). Future: multiple distributors.';


COMMENT ON TABLE public.email_verification_tokens IS 'Secure tokens for email verification. Expires after 24 hours. Single-use.';


COMMENT ON TABLE public.login_history IS 'Audit trail for all login attempts. Tracks success, failures, device info.';


COMMENT ON TABLE public.password_reset_tokens IS 'Secure tokens for password reset. Expires after 1 hour. Single-use.';


COMMENT ON TABLE public.permissions IS 'Master list of all permissions. Admin can configure which roles get which permissions.';


COMMENT ON TABLE public.role_permissions IS 'Maps roles to permissions. Distributor configures this via admin UI.';


COMMENT ON TABLE public.users IS 'Core user table. All employees and retailers. No public signup - distributor creates all accounts.';


-- ------------------------------------------------------------
-- FROM 007_storage.sql
-- ------------------------------------------------------------

-- ============================================================
-- BUCKETS
-- ============================================================

-- Storage buckets used by the app: purchase challans & proof-of-delivery
INSERT INTO storage.buckets (id, name, public)
VALUES ('challans', 'challans', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('pod', 'pod', false)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- STORAGE POLICIES
-- ============================================================

DROP POLICY IF EXISTS "challans finance delete" ON storage.objects;
CREATE POLICY "challans finance delete" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'challans'::text) AND public.can_manage_finance(auth.uid())));


DROP POLICY IF EXISTS "challans finance insert" ON storage.objects;
CREATE POLICY "challans finance insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'challans'::text) AND public.can_manage_finance(auth.uid())));


DROP POLICY IF EXISTS "challans finance read" ON storage.objects;
CREATE POLICY "challans finance read" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'challans'::text) AND public.can_manage_finance(auth.uid())));


DROP POLICY IF EXISTS "challans finance update" ON storage.objects;
CREATE POLICY "challans finance update" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'challans'::text) AND public.can_manage_finance(auth.uid()))) WITH CHECK (((bucket_id = 'challans'::text) AND public.can_manage_finance(auth.uid())));


DROP POLICY IF EXISTS "pod manager delete" ON storage.objects;
CREATE POLICY "pod manager delete" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'pod'::text) AND public.can_manage_sales(auth.uid())));


DROP POLICY IF EXISTS "pod owner or manager update" ON storage.objects;
CREATE POLICY "pod owner or manager update" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'pod'::text) AND ((owner = auth.uid()) OR public.can_manage_sales(auth.uid())))) WITH CHECK (((bucket_id = 'pod'::text) AND ((owner = auth.uid()) OR public.can_manage_sales(auth.uid()))));


DROP POLICY IF EXISTS "pod staff insert" ON storage.objects;
CREATE POLICY "pod staff insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'pod'::text) AND public.is_internal_staff(auth.uid()) AND (owner = auth.uid())));


DROP POLICY IF EXISTS "pod staff read" ON storage.objects;
CREATE POLICY "pod staff read" ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'pod'::text) AND public.is_internal_staff(auth.uid())));


-- ------------------------------------------------------------
-- FROM 008_seed.sql
-- ------------------------------------------------------------
-- ============================================================
-- DairyFlow Pro — Seed data (run AFTER 001-007)
-- Creates: distributor tenant, admin login, permissions catalog,
--          role mappings, expense categories, reminder templates
-- ============================================================

-- ---------- 1. Distributor (tenant) ----------
INSERT INTO public.distributors
  (id, business_name, legal_name, address, mobile, email, city, state, status, invoice_prefix, currency)
VALUES
  ('00000000-0000-4000-8000-000000000d01',
   'DairyFlow Distribution', 'DairyFlow Distribution',
   'Saharsa, Bihar', '+91-9999999999', 'admin@creamroute.com',
   'Saharsa', 'Bihar', 'active', 'INV', 'INR')
ON CONFLICT (id) DO NOTHING;

-- ---------- 2. Admin user ----------
-- Password: Admin@1234  (CHANGE IT after first login!)
-- a) Supabase Auth user (used by signInWithPassword on the login page)
INSERT INTO auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   confirmation_token, recovery_token, email_change_token_new, email_change,
   raw_app_meta_data, raw_user_meta_data,
   created_at, updated_at, phone_change, phone_change_token,
   email_change_token_current, email_change_confirm_status,
   reauthentication_token, is_sso_user, is_anonymous)
VALUES
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'admin@creamroute.com',
   extensions.crypt('Admin@1234', extensions.gen_salt('bf', 10)),
   now(), '', '', '', '',
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Admin User","role":"distributor","mobile":"+91-9999999999"}',
   now(), now(), '', '', '', 0, '', false, false)
ON CONFLICT (id) DO NOTHING;

-- b) Identity row required for signInWithPassword
INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), '00000000-0000-4000-8000-000000000001',
       '00000000-0000-4000-8000-000000000001',
       jsonb_build_object('sub', '00000000-0000-4000-8000-000000000001',
                          'email', 'admin@creamroute.com',
                          'email_verified', true,
                          'provider', 'email'),
       'email', now(), now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities
  WHERE user_id = '00000000-0000-4000-8000-000000000001' AND provider = 'email'
);

-- c) App user row (the login page looks this up by email; bcrypt hash is for
--    the edge-function login path)
INSERT INTO public.users
  (id, distributor_id, email, mobile, password_hash, full_name, role, status,
   email_verified, created_at, updated_at)
VALUES
  ('00000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000d01',
   'admin@creamroute.com', '+91-9999999999',
   extensions.crypt('Admin@1234', extensions.gen_salt('bf', 10)),
   'Admin User', 'distributor', 'active', true, now(), now())
ON CONFLICT (id) DO NOTHING;

-- d) Profile + admin role
INSERT INTO public.profiles (id, full_name, email, account_status, distributor_id)
VALUES ('00000000-0000-4000-8000-000000000001', 'Admin User', 'admin@creamroute.com',
        'active', '00000000-0000-4000-8000-000000000d01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES ('00000000-0000-4000-8000-000000000001', 'admin')
ON CONFLICT DO NOTHING;

-- ---------- 3. Permissions catalog (matches src/lib/permissions.ts) ----------
INSERT INTO public.permissions (name, label, category) VALUES
  ('place_order',       'Place Order',        'orders'),
  ('view_orders',       'View Orders',        'orders'),
  ('edit_orders',       'Edit Orders',        'orders'),
  ('delete_orders',     'Delete Orders',      'orders'),
  ('create_invoice',    'Create Invoice',     'invoices'),
  ('view_invoices',     'View Invoices',      'invoices'),
  ('edit_invoices',     'Edit Invoices',      'invoices'),
  ('delete_invoices',   'Delete Invoices',    'invoices'),
  ('download_invoice',  'Download Invoice',   'invoices'),
  ('revise_invoice',    'Revise Invoice',     'invoices'),
  ('view_customers',    'View Customers',     'customers'),
  ('edit_customers',    'Edit Customers',     'customers'),
  ('delete_customers',  'Delete Customers',   'customers'),
  ('view_ledger',       'View Ledger',        'customers'),
  ('view_inventory',    'View Inventory',     'inventory'),
  ('edit_inventory',    'Edit Inventory',     'inventory'),
  ('view_products',     'View Products',      'inventory'),
  ('edit_products',     'Edit Products',      'inventory'),
  ('record_payment',    'Record Payment',     'payments'),
  ('view_payments',     'View Payments',      'payments'),
  ('reconcile_payments','Reconcile Payments', 'payments'),
  ('view_deliveries',   'View Deliveries',    'deliveries'),
  ('manage_deliveries', 'Manage Deliveries',  'deliveries'),
  ('view_reports',      'View Reports',       'reports'),
  ('export_reports',    'Export Reports',     'reports'),
  ('manage_users',      'Manage Users',       'admin'),
  ('manage_roles',      'Manage Roles',       'admin'),
  ('view_audit_logs',   'View Audit Logs',    'admin'),
  ('manage_settings',   'Manage Settings',    'admin'),
  ('manage_branches',   'Manage Branches',    'admin')
ON CONFLICT DO NOTHING;

-- ---------- 4. Role → permission mappings ----------
-- distributor (owner) gets everything
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'distributor', p.id FROM public.permissions p
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'manager', p.id FROM public.permissions p
WHERE p.name NOT IN ('manage_branches')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'accountant', p.id FROM public.permissions p
WHERE p.name IN ('view_orders','view_invoices','view_customers','view_ledger',
                 'record_payment','view_payments','reconcile_payments',
                 'view_reports','export_reports','view_inventory')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'salesman', p.id FROM public.permissions p
WHERE p.name IN ('place_order','view_orders','edit_orders','create_invoice',
                 'view_invoices','download_invoice','view_customers','view_ledger',
                 'record_payment','view_payments','view_deliveries')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'warehouse', p.id FROM public.permissions p
WHERE p.name IN ('view_inventory','edit_inventory','view_products','view_deliveries')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'delivery_boy', p.id FROM public.permissions p
WHERE p.name IN ('view_deliveries','manage_deliveries','view_customers','record_payment')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'retailer', p.id FROM public.permissions p
WHERE p.name IN ('place_order','view_orders','view_invoices','view_ledger')
ON CONFLICT DO NOTHING;

-- ---------- 5. Expense categories ----------
INSERT INTO public.expense_categories (name, color, icon) VALUES
  ('Fuel & Transport',      '#f59e0b', 'fuel'),
  ('Repairs & Maintenance', '#64748b', 'wrench'),
  ('Salaries & Wages',      '#3b82f6', 'users'),
  ('Packaging & Crates',    '#8b5cf6', 'package'),
  ('Office & Admin',        '#10b981', 'home'),
  ('Electricity & Utilities','#eab308', 'zap'),
  ('Miscellaneous',         '#94a3b8', 'file-text')
ON CONFLICT DO NOTHING;

-- ---------- 6. Payment reminder templates ----------
-- Placeholders supported: {customer_name} {outstanding} {invoice_no} {due_date}
INSERT INTO public.reminder_templates (name, days_overdue, channel, subject, body) VALUES
  ('Gentle reminder (1 day)', 1, 'whatsapp',
   'Payment Reminder: Invoice {invoice_no}',
   E'Hi {customer_name},\n\nThis is a gentle reminder that invoice {invoice_no} (₹{outstanding}) was due on {due_date}.\n\nKindly arrange the payment at your earliest convenience.\n\nThank you!'),
  ('Firm reminder (7 days)', 7, 'whatsapp',
   'Overdue Payment: Invoice {invoice_no}',
   E'Hi {customer_name},\n\nInvoice {invoice_no} for ₹{outstanding} is now 7 days overdue (due date: {due_date}).\n\nPlease clear the outstanding amount today to keep your account in good standing.\n\nThank you.'),
  ('Urgent reminder (15 days)', 15, 'whatsapp',
   'URGENT: Invoice {invoice_no} overdue by 15 days',
   E'Hi {customer_name},\n\nDespite reminders, invoice {invoice_no} (₹{outstanding}) remains unpaid since {due_date}.\n\nPlease pay immediately to avoid suspension of further supplies.\n\nThank you.')
ON CONFLICT DO NOTHING;

-- Done! Login with:  admin@creamroute.com / Admin@1234

-- ------------------------------------------------------------
-- FROM 009_fix_user_policy_recursion.sql
-- ------------------------------------------------------------
-- Fix infinite RLS recursion on public.users.
--
-- The original policies (users_select_admin / users_insert / users_update)
-- contained EXISTS (SELECT 1 FROM public.users ...) — a policy whose USING
-- clause queries its own table. For any authenticated session this causes
-- "infinite recursion detected in policy for relation users" (HTTP 500 from
-- PostgREST), which the app surfaced as "Invalid credentials".
--
-- Replace the self-reference with a SECURITY DEFINER helper (runs as the
-- function owner, bypassing RLS, so no recursion).

CREATE OR REPLACE FUNCTION public.is_distributor(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = _uid AND role = 'distributor'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_distributor(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS users_select_admin ON public.users;
CREATE POLICY users_select_admin ON public.users
  FOR SELECT TO authenticated
  USING (public.is_distributor(auth.uid()));

DROP POLICY IF EXISTS users_insert ON public.users;
CREATE POLICY users_insert ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (public.is_distributor(auth.uid()));

DROP POLICY IF EXISTS users_update ON public.users;
CREATE POLICY users_update ON public.users
  FOR UPDATE TO authenticated
  USING (public.is_distributor(auth.uid()))
  WITH CHECK (public.is_distributor(auth.uid()));
