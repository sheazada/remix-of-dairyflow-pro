
-- ============================================================
-- INDEXES
-- ============================================================

CREATE UNIQUE INDEX customers_retailer_code_key ON public.customers USING btree (retailer_code) WHERE (retailer_code IS NOT NULL);


CREATE UNIQUE INDEX customers_user_id_key ON public.customers USING btree (user_id) WHERE (user_id IS NOT NULL);


CREATE INDEX delivery_runs_route_date_idx ON public.delivery_runs USING btree (route_id, run_date DESC);


CREATE INDEX edit_audit_delivery_idx ON public.edit_audit_logs USING btree (delivery_id);


CREATE INDEX edit_audit_route_created_idx ON public.edit_audit_logs USING btree (route_id, created_at);


CREATE INDEX edit_audit_run_idx ON public.edit_audit_logs USING btree (run_id);


CREATE INDEX gps_audit_logs_created_idx ON public.gps_audit_logs USING btree (created_at DESC);


CREATE INDEX gps_audit_logs_delivery_idx ON public.gps_audit_logs USING btree (delivery_id, created_at DESC);


CREATE INDEX gps_audit_logs_run_idx ON public.gps_audit_logs USING btree (run_id, created_at DESC);


CREATE INDEX idx_access_audit_event ON public.access_audit_logs USING btree (event_type, created_at DESC);


CREATE INDEX idx_access_audit_route ON public.access_audit_logs USING btree (route_path, created_at DESC);


CREATE INDEX idx_access_audit_time ON public.access_audit_logs USING btree (created_at DESC);


CREATE INDEX idx_access_audit_user ON public.access_audit_logs USING btree (user_id, created_at DESC);


CREATE INDEX idx_adjustment_items_adj ON public.stock_adjustment_items USING btree (adjustment_id);


CREATE INDEX idx_app_settings_key ON public.app_settings USING btree (key);


CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


CREATE INDEX idx_audit_logs_distributor_id ON public.audit_logs USING btree (distributor_id);


CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


CREATE INDEX idx_batches_expiry ON public.product_batches USING btree (expiry_date);


CREATE INDEX idx_collection_allocations_collection ON public.collection_allocations USING btree (driver_collection_id);


CREATE INDEX idx_collection_allocations_invoice ON public.collection_allocations USING btree (invoice_id);


CREATE INDEX idx_crate_tx_date ON public.crate_transactions USING btree (transaction_date);


CREATE INDEX idx_crate_tx_retailer ON public.crate_transactions USING btree (retailer_id);


CREATE INDEX idx_crate_tx_type ON public.crate_transactions USING btree (crate_type_id);


CREATE UNIQUE INDEX idx_customers_retailer_code ON public.customers USING btree (retailer_code) WHERE (retailer_code IS NOT NULL);


CREATE INDEX idx_customers_retailer_code_lookup ON public.customers USING btree (retailer_code);


CREATE INDEX idx_customers_status ON public.customers USING btree (status) WHERE (status = 'active'::text);


CREATE INDEX idx_customers_user_id ON public.customers USING btree (user_id);


CREATE UNIQUE INDEX idx_customers_user_id_unique ON public.customers USING btree (user_id) WHERE (user_id IS NOT NULL);


CREATE INDEX idx_deliveries_invoice ON public.deliveries USING btree (invoice_id);


CREATE INDEX idx_deliveries_order ON public.deliveries USING btree (order_id);


CREATE INDEX idx_deliveries_route ON public.deliveries USING btree (route_id);


CREATE INDEX idx_deliveries_scheduled_date ON public.deliveries USING btree (scheduled_date);


CREATE INDEX idx_delivery_cycles_delivery_date ON public.delivery_cycles USING btree (delivery_date, delivery_shift);


CREATE INDEX idx_demand_consolidation_items_consolidation ON public.demand_consolidation_items USING btree (demand_consolidation_id);


CREATE INDEX idx_demand_consolidations_cycle ON public.demand_consolidations USING btree (delivery_cycle_id, status);


CREATE INDEX idx_driver_collections_date ON public.driver_collections USING btree (delivery_date DESC);


CREATE INDEX idx_driver_collections_status ON public.driver_collections USING btree (status);


CREATE INDEX idx_email_verification_tokens_token ON public.email_verification_tokens USING btree (token);


CREATE INDEX idx_email_verification_tokens_user_id ON public.email_verification_tokens USING btree (user_id);


CREATE INDEX idx_expenses_category ON public.expenses USING btree (category_id);


CREATE INDEX idx_expenses_date ON public.expenses USING btree (expense_date DESC);


CREATE INDEX idx_inventory_movements_product ON public.inventory_movements USING btree (product_id);


CREATE INDEX idx_inventory_movements_ref ON public.inventory_movements USING btree (ref_type, ref_id);


CREATE INDEX idx_invoice_items_invoice ON public.invoice_items USING btree (invoice_id);


CREATE INDEX idx_invoice_revisions_invoice ON public.invoice_revisions USING btree (invoice_id);


CREATE INDEX idx_invoice_revisions_original ON public.invoice_revisions USING btree (original_invoice_id);


CREATE INDEX idx_invoices_customer ON public.invoices USING btree (customer_id);


CREATE INDEX idx_invoices_customer_date ON public.invoices USING btree (customer_id, invoice_date DESC);


CREATE INDEX idx_invoices_date ON public.invoices USING btree (invoice_date DESC);


CREATE INDEX idx_invoices_invoice_date ON public.invoices USING btree (invoice_date DESC);


CREATE INDEX idx_login_history_distributor_id ON public.login_history USING btree (distributor_id);


CREATE INDEX idx_login_history_login_at ON public.login_history USING btree (login_at DESC);


CREATE INDEX idx_login_history_user_id ON public.login_history USING btree (user_id);


CREATE INDEX idx_movements_product ON public.inventory_movements USING btree (product_id, created_at DESC);


CREATE INDEX idx_notif_logs_created ON public.notification_logs USING btree (created_at DESC);


CREATE INDEX idx_notif_logs_customer ON public.notification_logs USING btree (customer_id);


CREATE INDEX idx_notif_logs_delivery ON public.notification_logs USING btree (delivery_id);


CREATE INDEX idx_notif_logs_invoice ON public.notification_logs USING btree (invoice_id);


CREATE INDEX idx_notif_logs_status_retry ON public.notification_logs USING btree (status, next_retry_at) WHERE (status = ANY (ARRAY['queued'::public.notification_status, 'failed'::public.notification_status]));


CREATE INDEX idx_notification_logs_status ON public.notification_logs USING btree (status) WHERE (status = ANY (ARRAY['queued'::public.notification_status, 'failed'::public.notification_status]));


CREATE INDEX idx_notifications_created ON public.notifications USING btree (created_at DESC);


CREATE INDEX idx_notifications_read ON public.notifications USING btree (read_at);


CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);


CREATE INDEX idx_orders_date ON public.orders USING btree (order_date DESC);


CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens USING btree (token);


CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);


CREATE INDEX idx_payments_customer ON public.payments USING btree (customer_id);


CREATE INDEX idx_payments_customer_date ON public.payments USING btree (customer_id, payment_date DESC);


CREATE INDEX idx_payments_date ON public.payments USING btree (payment_date DESC);


CREATE INDEX idx_payments_invoice ON public.payments USING btree (invoice_id);


CREATE INDEX idx_payments_payment_date ON public.payments USING btree (payment_date DESC);


CREATE INDEX idx_permissions_category ON public.permissions USING btree (category);


CREATE INDEX idx_permissions_name ON public.permissions USING btree (name);


CREATE INDEX idx_product_batches_expiry ON public.product_batches USING btree (expiry_date) WHERE (status = 'active'::text);


CREATE INDEX idx_product_batches_product ON public.product_batches USING btree (product_id);


CREATE INDEX idx_products_status ON public.products USING btree (status) WHERE (status = 'active'::text);


CREATE INDEX idx_products_stock ON public.products USING btree (current_stock);


CREATE INDEX idx_profiles_account_status ON public.profiles USING btree (account_status);


CREATE INDEX idx_purchase_items_purchase ON public.purchase_items USING btree (purchase_id);


CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions USING btree (user_id);


CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions USING btree (user_id);


CREATE INDEX idx_reminder_logs_invoice_template ON public.reminder_logs USING btree (invoice_id, template_id);


CREATE INDEX idx_role_permissions_permission ON public.role_permissions USING btree (permission_id);


CREATE INDEX idx_role_permissions_role ON public.role_permissions USING btree (role);


CREATE INDEX idx_route_stops_customer ON public.route_stops USING btree (customer_id);


CREATE INDEX idx_route_stops_route ON public.route_stops USING btree (route_id, sequence);


CREATE INDEX idx_routes_active ON public.routes USING btree (active) WHERE (active = true);


CREATE INDEX idx_share_activity_logs_created ON public.share_activity_logs USING btree (created_at DESC);


CREATE INDEX idx_share_activity_logs_invoice ON public.share_activity_logs USING btree (invoice_id, created_at DESC);


CREATE INDEX idx_share_activity_logs_user ON public.share_activity_logs USING btree (user_id, created_at DESC);


CREATE INDEX idx_stock_adjustments_date ON public.stock_adjustments USING btree (adjustment_date DESC);


CREATE INDEX idx_stock_adjustments_status ON public.stock_adjustments USING btree (status);


CREATE INDEX idx_sudha_claims_date ON public.sudha_claims USING btree (claim_date DESC);


CREATE INDEX idx_sudha_claims_status ON public.sudha_claims USING btree (status);


CREATE INDEX idx_supplier_payments_purchase ON public.supplier_payments USING btree (purchase_id);


CREATE INDEX idx_supplier_payments_supplier ON public.supplier_payments USING btree (supplier_id);


CREATE INDEX idx_users_distributor_id ON public.users USING btree (distributor_id);


CREATE INDEX idx_users_email ON public.users USING btree (email) WHERE (email IS NOT NULL);


CREATE INDEX idx_users_mobile ON public.users USING btree (mobile) WHERE (mobile IS NOT NULL);


CREATE INDEX idx_users_retailer_id ON public.users USING btree (retailer_id) WHERE (retailer_id IS NOT NULL);


CREATE INDEX idx_users_role ON public.users USING btree (role);


CREATE INDEX idx_users_status ON public.users USING btree (status);


CREATE INDEX retailer_ledger_entries_retailer_idx ON public.retailer_ledger_entries USING btree (retailer_id, entry_date DESC);


-- ============================================================
-- CONSTRAINTS
-- ============================================================

ALTER TABLE ONLY public.access_audit_logs
    ADD CONSTRAINT access_audit_logs_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_key_key UNIQUE (key);


ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.collection_allocations
    ADD CONSTRAINT collection_allocations_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.crate_transactions
    ADD CONSTRAINT crate_transactions_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.crate_types
    ADD CONSTRAINT crate_types_name_key UNIQUE (name);


ALTER TABLE ONLY public.crate_types
    ADD CONSTRAINT crate_types_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.delivery_cycles
    ADD CONSTRAINT delivery_cycles_cycle_code_key UNIQUE (cycle_code);


ALTER TABLE ONLY public.delivery_cycles
    ADD CONSTRAINT delivery_cycles_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.delivery_runs
    ADD CONSTRAINT delivery_runs_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.demand_consolidation_items
    ADD CONSTRAINT demand_consolidation_items_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.demand_consolidations
    ADD CONSTRAINT demand_consolidations_consolidation_no_key UNIQUE (consolidation_no);


ALTER TABLE ONLY public.demand_consolidations
    ADD CONSTRAINT demand_consolidations_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.demand_source_orders
    ADD CONSTRAINT demand_source_orders_pkey PRIMARY KEY (demand_consolidation_id, order_id);


ALTER TABLE ONLY public.distributors
    ADD CONSTRAINT distributors_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.driver_collections
    ADD CONSTRAINT driver_collections_collection_no_key UNIQUE (collection_no);


ALTER TABLE ONLY public.driver_collections
    ADD CONSTRAINT driver_collections_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.edit_audit_logs
    ADD CONSTRAINT edit_audit_logs_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_token_key UNIQUE (token);


ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_name_key UNIQUE (name);


ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.gps_audit_logs
    ADD CONSTRAINT gps_audit_logs_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.invoice_revisions
    ADD CONSTRAINT invoice_revisions_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_no_key UNIQUE (invoice_no);


ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.login_history
    ADD CONSTRAINT login_history_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.notification_logs
    ADD CONSTRAINT notification_logs_idempotency_key_key UNIQUE (idempotency_key);


ALTER TABLE ONLY public.notification_logs
    ADD CONSTRAINT notification_logs_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_no_key UNIQUE (order_no);


ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);


ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_payment_no_key UNIQUE (payment_no);


ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_key UNIQUE (name);


ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.product_batches
    ADD CONSTRAINT product_batches_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.reminder_logs
    ADD CONSTRAINT reminder_logs_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.reminder_templates
    ADD CONSTRAINT reminder_templates_days_overdue_key UNIQUE (days_overdue);


ALTER TABLE ONLY public.reminder_templates
    ADD CONSTRAINT reminder_templates_name_key UNIQUE (name);


ALTER TABLE ONLY public.reminder_templates
    ADD CONSTRAINT reminder_templates_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.retailer_ledger_entries
    ADD CONSTRAINT retailer_ledger_entries_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_permission_id_key UNIQUE (role, permission_id);


ALTER TABLE ONLY public.route_stops
    ADD CONSTRAINT route_stops_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.route_stops
    ADD CONSTRAINT route_stops_route_id_customer_id_key UNIQUE (route_id, customer_id);


ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.share_activity_logs
    ADD CONSTRAINT share_activity_logs_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.stock_adjustment_items
    ADD CONSTRAINT stock_adjustment_items_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_adjustment_no_key UNIQUE (adjustment_no);


ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.stock_reconciliation_items
    ADD CONSTRAINT stock_reconciliation_items_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.stock_reconciliations
    ADD CONSTRAINT stock_reconciliations_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.stock_reconciliations
    ADD CONSTRAINT stock_reconciliations_recon_no_key UNIQUE (recon_no);


ALTER TABLE ONLY public.sudha_claims
    ADD CONSTRAINT sudha_claims_claim_no_key UNIQUE (claim_no);


ALTER TABLE ONLY public.sudha_claims
    ADD CONSTRAINT sudha_claims_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT supplier_payments_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_mobile_key UNIQUE (mobile);


ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_name_key UNIQUE (name);


ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);


ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_distributor_id_fkey FOREIGN KEY (distributor_id) REFERENCES public.distributors(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.collection_allocations
    ADD CONSTRAINT collection_allocations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


ALTER TABLE ONLY public.collection_allocations
    ADD CONSTRAINT collection_allocations_driver_collection_id_fkey FOREIGN KEY (driver_collection_id) REFERENCES public.driver_collections(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.collection_allocations
    ADD CONSTRAINT collection_allocations_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.crate_transactions
    ADD CONSTRAINT crate_transactions_crate_type_id_fkey FOREIGN KEY (crate_type_id) REFERENCES public.crate_types(id) ON DELETE RESTRICT;


ALTER TABLE ONLY public.crate_transactions
    ADD CONSTRAINT crate_transactions_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.deliveries(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.crate_transactions
    ADD CONSTRAINT crate_transactions_retailer_id_fkey FOREIGN KEY (retailer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.crate_transactions
    ADD CONSTRAINT crate_transactions_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_assigned_route_id_fkey FOREIGN KEY (assigned_route_id) REFERENCES public.routes(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.delivery_runs
    ADD CONSTRAINT delivery_runs_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.demand_consolidation_items
    ADD CONSTRAINT demand_consolidation_items_demand_consolidation_id_fkey FOREIGN KEY (demand_consolidation_id) REFERENCES public.demand_consolidations(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.demand_consolidation_items
    ADD CONSTRAINT demand_consolidation_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.demand_consolidations
    ADD CONSTRAINT demand_consolidations_delivery_cycle_id_fkey FOREIGN KEY (delivery_cycle_id) REFERENCES public.delivery_cycles(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.demand_source_orders
    ADD CONSTRAINT demand_source_orders_demand_consolidation_id_fkey FOREIGN KEY (demand_consolidation_id) REFERENCES public.demand_consolidations(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.demand_source_orders
    ADD CONSTRAINT demand_source_orders_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.driver_collections
    ADD CONSTRAINT driver_collections_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.expense_categories(id) ON DELETE RESTRICT;


ALTER TABLE ONLY public.gps_audit_logs
    ADD CONSTRAINT gps_audit_logs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.gps_audit_logs
    ADD CONSTRAINT gps_audit_logs_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.deliveries(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.gps_audit_logs
    ADD CONSTRAINT gps_audit_logs_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.gps_audit_logs
    ADD CONSTRAINT gps_audit_logs_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.gps_audit_logs
    ADD CONSTRAINT gps_audit_logs_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.delivery_runs(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.gps_audit_logs
    ADD CONSTRAINT gps_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


ALTER TABLE ONLY public.invoice_revisions
    ADD CONSTRAINT invoice_revisions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.invoice_revisions
    ADD CONSTRAINT invoice_revisions_original_invoice_id_fkey FOREIGN KEY (original_invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES public.invoices(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.login_history
    ADD CONSTRAINT login_history_distributor_id_fkey FOREIGN KEY (distributor_id) REFERENCES public.distributors(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.login_history
    ADD CONSTRAINT login_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.notification_logs
    ADD CONSTRAINT notification_logs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.notification_logs
    ADD CONSTRAINT notification_logs_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.deliveries(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.notification_logs
    ADD CONSTRAINT notification_logs_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


ALTER TABLE ONLY public.product_batches
    ADD CONSTRAINT product_batches_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.product_batches
    ADD CONSTRAINT product_batches_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.product_batches
    ADD CONSTRAINT product_batches_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_delivery_cycle_id_fkey FOREIGN KEY (delivery_cycle_id) REFERENCES public.delivery_cycles(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.reminder_logs
    ADD CONSTRAINT reminder_logs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.reminder_logs
    ADD CONSTRAINT reminder_logs_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.reminder_logs
    ADD CONSTRAINT reminder_logs_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.reminder_templates(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.retailer_ledger_entries
    ADD CONSTRAINT retailer_ledger_entries_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.retailer_ledger_entries
    ADD CONSTRAINT retailer_ledger_entries_retailer_id_fkey FOREIGN KEY (retailer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.route_stops
    ADD CONSTRAINT route_stops_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.route_stops
    ADD CONSTRAINT route_stops_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.share_activity_logs
    ADD CONSTRAINT share_activity_logs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.share_activity_logs
    ADD CONSTRAINT share_activity_logs_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.share_activity_logs
    ADD CONSTRAINT share_activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.stock_adjustment_items
    ADD CONSTRAINT stock_adjustment_items_adjustment_id_fkey FOREIGN KEY (adjustment_id) REFERENCES public.stock_adjustments(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.stock_adjustment_items
    ADD CONSTRAINT stock_adjustment_items_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.product_batches(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.stock_adjustment_items
    ADD CONSTRAINT stock_adjustment_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.stock_reconciliation_items
    ADD CONSTRAINT stock_reconciliation_items_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.product_batches(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.stock_reconciliation_items
    ADD CONSTRAINT stock_reconciliation_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


ALTER TABLE ONLY public.stock_reconciliation_items
    ADD CONSTRAINT stock_reconciliation_items_recon_id_fkey FOREIGN KEY (recon_id) REFERENCES public.stock_reconciliations(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.stock_reconciliations
    ADD CONSTRAINT stock_reconciliations_conducted_by_fkey FOREIGN KEY (conducted_by) REFERENCES auth.users(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.stock_reconciliations
    ADD CONSTRAINT stock_reconciliations_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.sudha_claims
    ADD CONSTRAINT sudha_claims_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


ALTER TABLE ONLY public.sudha_claims
    ADD CONSTRAINT sudha_claims_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.sudha_claims
    ADD CONSTRAINT sudha_claims_purchase_item_id_fkey FOREIGN KEY (purchase_item_id) REFERENCES public.purchase_items(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT supplier_payments_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE SET NULL;


ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT supplier_payments_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_distributor_id_fkey FOREIGN KEY (distributor_id) REFERENCES public.distributors(id) ON DELETE CASCADE;

