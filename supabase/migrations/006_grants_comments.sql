
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

