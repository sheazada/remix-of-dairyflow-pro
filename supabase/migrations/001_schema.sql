
-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'manager',
    'salesperson',
    'driver',
    'helper',
    'retailer'
);


CREATE TYPE public.notification_channel AS ENUM (
    'email',
    'sms',
    'whatsapp'
);


CREATE TYPE public.notification_status AS ENUM (
    'queued',
    'sending',
    'sent',
    'failed',
    'suppressed',
    'cancelled'
);


-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE public.notification_logs (
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


CREATE TABLE public.access_audit_logs (
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


CREATE TABLE public.app_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now()
);


CREATE TABLE public.audit_logs (
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


CREATE TABLE public.collection_allocations (
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


CREATE TABLE public.crate_transactions (
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


CREATE TABLE public.crate_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE public.customers (
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


CREATE TABLE public.invoice_items (
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


CREATE TABLE public.invoices (
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


CREATE TABLE public.purchase_items (
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


CREATE TABLE public.purchases (
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


CREATE TABLE public.deliveries (
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


CREATE TABLE public.delivery_cycles (
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


CREATE TABLE public.delivery_runs (
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


CREATE TABLE public.demand_consolidation_items (
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


CREATE TABLE public.demand_consolidations (
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


CREATE TABLE public.demand_source_orders (
    demand_consolidation_id uuid NOT NULL,
    order_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE public.distributors (
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


CREATE TABLE public.driver_collections (
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


CREATE TABLE public.edit_audit_logs (
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


CREATE TABLE public.email_verification_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    CONSTRAINT email_verification_tokens_expires_check CHECK ((expires_at > created_at))
);


CREATE TABLE public.expense_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#2563eb'::text NOT NULL,
    icon text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE public.expenses (
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


CREATE TABLE public.gps_audit_logs (
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


CREATE TABLE public.inventory_movements (
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


CREATE TABLE public.invoice_revisions (
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


CREATE TABLE public.login_history (
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


CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text DEFAULT 'general'::text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    product_name text NOT NULL,
    quantity numeric(12,2) NOT NULL,
    rate numeric(12,2) NOT NULL,
    amount numeric(12,2) NOT NULL
);


CREATE TABLE public.orders (
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


CREATE TABLE public.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    CONSTRAINT password_reset_tokens_expires_check CHECK ((expires_at > created_at))
);


CREATE TABLE public.payments (
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


CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    label text NOT NULL,
    description text,
    category text DEFAULT 'general'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE public.product_batches (
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


CREATE TABLE public.products (
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


CREATE TABLE public.profiles (
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


CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE public.reminder_logs (
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


CREATE TABLE public.reminder_templates (
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


CREATE TABLE public.retailer_ledger_entries (
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


CREATE TABLE public.role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role text NOT NULL,
    permission_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE public.route_stops (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    route_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    sequence integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


CREATE TABLE public.routes (
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


CREATE TABLE public.share_activity_logs (
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


CREATE TABLE public.stock_adjustment_items (
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


CREATE TABLE public.stock_adjustments (
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


CREATE TABLE public.stock_reconciliation_items (
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


CREATE TABLE public.stock_reconciliations (
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


CREATE TABLE public.sudha_claims (
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


CREATE TABLE public.supplier_payments (
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


CREATE TABLE public.suppliers (
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


CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL
);


CREATE TABLE public.users (
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


CREATE TABLE public.warehouses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    location text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


-- ============================================================
-- VIEWS
-- ============================================================

CREATE VIEW public.daily_reconciliation WITH (security_invoker='on') AS
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

