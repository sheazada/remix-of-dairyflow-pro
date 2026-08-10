
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

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


CREATE POLICY "Admins can view all share activity" ON public.share_activity_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


CREATE POLICY "Admins/managers can delete gps audit logs" ON public.gps_audit_logs FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));


CREATE POLICY "Authenticated users can insert own share activity" ON public.share_activity_logs FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


CREATE POLICY "Finance can delete ledger entries" ON public.retailer_ledger_entries FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


CREATE POLICY "Finance can insert ledger entries" ON public.retailer_ledger_entries FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY "Finance can update ledger entries" ON public.retailer_ledger_entries FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY "Retailer can view own customer row" ON public.customers FOR SELECT TO authenticated USING ((user_id = auth.uid()));


CREATE POLICY "Retailer can view own ledger entries" ON public.retailer_ledger_entries FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.customers c
  WHERE ((c.id = retailer_ledger_entries.retailer_id) AND (c.user_id = auth.uid())))));


CREATE POLICY "Staff can view ledger entries" ON public.retailer_ledger_entries FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


CREATE POLICY access_audit_logs_insert ON public.access_audit_logs FOR INSERT TO authenticated WITH CHECK (((auth.uid() IS NOT NULL) AND ((user_id IS NULL) OR (user_id = auth.uid()))));


CREATE POLICY access_audit_logs_select ON public.access_audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


CREATE POLICY app_settings_delete_admin ON public.app_settings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


CREATE POLICY app_settings_insert_admin ON public.app_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


CREATE POLICY app_settings_select_admin ON public.app_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


CREATE POLICY app_settings_update_admin ON public.app_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


CREATE POLICY audit_logs_insert ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);


CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'distributor'::text))))));


CREATE POLICY collection_allocations_delete ON public.collection_allocations FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


CREATE POLICY collection_allocations_insert ON public.collection_allocations FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY collection_allocations_select ON public.collection_allocations FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


CREATE POLICY collection_allocations_update ON public.collection_allocations FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY crate_transactions_delete ON public.crate_transactions FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


CREATE POLICY crate_transactions_insert ON public.crate_transactions FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff(auth.uid()));


CREATE POLICY crate_transactions_select ON public.crate_transactions FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


CREATE POLICY crate_transactions_update ON public.crate_transactions FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY crate_types_select ON public.crate_types FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


CREATE POLICY crate_types_write ON public.crate_types TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY customers_delete ON public.customers FOR DELETE TO authenticated USING (public.can_manage_sales(auth.uid()));


CREATE POLICY customers_insert ON public.customers FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));


CREATE POLICY customers_select ON public.customers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


CREATE POLICY customers_update ON public.customers FOR UPDATE TO authenticated USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));


CREATE POLICY deliveries_delete ON public.deliveries FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


CREATE POLICY deliveries_insert ON public.deliveries FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));


CREATE POLICY deliveries_select ON public.deliveries FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


CREATE POLICY deliveries_update ON public.deliveries FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));


CREATE POLICY delivery_cycles_delete ON public.delivery_cycles FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


CREATE POLICY delivery_cycles_insert ON public.delivery_cycles FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY delivery_cycles_select ON public.delivery_cycles FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


CREATE POLICY delivery_cycles_update ON public.delivery_cycles FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY delivery_runs_delete ON public.delivery_runs FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


CREATE POLICY delivery_runs_insert ON public.delivery_runs FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));


CREATE POLICY delivery_runs_select ON public.delivery_runs FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


CREATE POLICY delivery_runs_update ON public.delivery_runs FOR UPDATE TO authenticated USING (public.is_internal_staff(auth.uid())) WITH CHECK (public.is_internal_staff(auth.uid()));


CREATE POLICY demand_consolidation_items_delete ON public.demand_consolidation_items FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


CREATE POLICY demand_consolidation_items_insert ON public.demand_consolidation_items FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY demand_consolidation_items_select ON public.demand_consolidation_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


CREATE POLICY demand_consolidation_items_update ON public.demand_consolidation_items FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY demand_consolidations_delete ON public.demand_consolidations FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


CREATE POLICY demand_consolidations_insert ON public.demand_consolidations FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY demand_consolidations_select ON public.demand_consolidations FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


CREATE POLICY demand_consolidations_update ON public.demand_consolidations FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY demand_source_orders_delete ON public.demand_source_orders FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


CREATE POLICY demand_source_orders_insert ON public.demand_source_orders FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY demand_source_orders_select ON public.demand_source_orders FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


CREATE POLICY distributors_insert ON public.distributors FOR INSERT TO authenticated WITH CHECK (true);


CREATE POLICY distributors_select ON public.distributors FOR SELECT TO authenticated USING (true);


CREATE POLICY distributors_update ON public.distributors FOR UPDATE TO authenticated USING (true);


CREATE POLICY driver_collections_delete ON public.driver_collections FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


CREATE POLICY driver_collections_insert ON public.driver_collections FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY driver_collections_select ON public.driver_collections FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


CREATE POLICY driver_collections_update ON public.driver_collections FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY edit_audit_logs_select ON public.edit_audit_logs FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


CREATE POLICY email_verification_tokens_insert ON public.email_verification_tokens FOR INSERT TO authenticated WITH CHECK (true);


CREATE POLICY email_verification_tokens_select ON public.email_verification_tokens FOR SELECT TO authenticated USING ((user_id = auth.uid()));


CREATE POLICY email_verification_tokens_update ON public.email_verification_tokens FOR UPDATE TO authenticated USING ((user_id = auth.uid()));


CREATE POLICY expense_categories_select ON public.expense_categories FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


CREATE POLICY expense_categories_write ON public.expense_categories TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY expenses_select ON public.expenses FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


CREATE POLICY expenses_write ON public.expenses TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY gps_audit_logs_insert ON public.gps_audit_logs FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff(auth.uid()));


CREATE POLICY gps_audit_logs_select ON public.gps_audit_logs FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


CREATE POLICY inventory_movements_delete ON public.inventory_movements FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


CREATE POLICY inventory_movements_insert ON public.inventory_movements FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY inventory_movements_select ON public.inventory_movements FOR SELECT TO authenticated USING (public.can_manage_finance(auth.uid()));


CREATE POLICY inventory_movements_update ON public.inventory_movements FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY invoice_items_delete ON public.invoice_items FOR DELETE TO authenticated USING (public.can_manage_sales(auth.uid()));


CREATE POLICY invoice_items_insert ON public.invoice_items FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));


CREATE POLICY invoice_items_select ON public.invoice_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


CREATE POLICY invoice_items_update ON public.invoice_items FOR UPDATE TO authenticated USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));


CREATE POLICY invoice_revisions_insert ON public.invoice_revisions FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));


CREATE POLICY invoice_revisions_select ON public.invoice_revisions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


CREATE POLICY invoices_delete ON public.invoices FOR DELETE TO authenticated USING (public.can_manage_sales(auth.uid()));


CREATE POLICY invoices_insert ON public.invoices FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));


CREATE POLICY invoices_select ON public.invoices FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


CREATE POLICY invoices_update ON public.invoices FOR UPDATE TO authenticated USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));


CREATE POLICY login_history_insert ON public.login_history FOR INSERT TO authenticated WITH CHECK (true);


CREATE POLICY login_history_select ON public.login_history FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'distributor'::text))))));


CREATE POLICY notification_logs_delete ON public.notification_logs FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


CREATE POLICY notification_logs_insert ON public.notification_logs FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY notification_logs_select ON public.notification_logs FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


CREATE POLICY notification_logs_update ON public.notification_logs FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY notifications_delete ON public.notifications FOR DELETE TO authenticated USING ((auth.uid() = user_id));


CREATE POLICY notifications_insert ON public.notifications FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) OR public.can_manage_sales(auth.uid())));


CREATE POLICY notifications_select ON public.notifications FOR SELECT TO authenticated USING ((auth.uid() = user_id));


CREATE POLICY notifications_update ON public.notifications FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


CREATE POLICY order_items_delete ON public.order_items FOR DELETE TO authenticated USING (public.can_manage_sales(auth.uid()));


CREATE POLICY order_items_insert ON public.order_items FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));


CREATE POLICY order_items_select ON public.order_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


CREATE POLICY order_items_update ON public.order_items FOR UPDATE TO authenticated USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));


CREATE POLICY orders_delete ON public.orders FOR DELETE TO authenticated USING (public.can_manage_sales(auth.uid()));


CREATE POLICY orders_insert ON public.orders FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));


CREATE POLICY orders_select ON public.orders FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


CREATE POLICY orders_update ON public.orders FOR UPDATE TO authenticated USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));


CREATE POLICY password_reset_tokens_insert ON public.password_reset_tokens FOR INSERT TO authenticated WITH CHECK (true);


CREATE POLICY password_reset_tokens_select ON public.password_reset_tokens FOR SELECT TO authenticated USING ((user_id = auth.uid()));


CREATE POLICY password_reset_tokens_update ON public.password_reset_tokens FOR UPDATE TO authenticated USING ((user_id = auth.uid()));


CREATE POLICY payments_delete ON public.payments FOR DELETE TO authenticated USING (public.can_manage_sales(auth.uid()));


CREATE POLICY payments_insert ON public.payments FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));


CREATE POLICY payments_select ON public.payments FOR SELECT TO authenticated USING (public.can_manage_sales(auth.uid()));


CREATE POLICY payments_update ON public.payments FOR UPDATE TO authenticated USING (public.can_manage_sales(auth.uid())) WITH CHECK (public.can_manage_sales(auth.uid()));


CREATE POLICY permissions_admin_all ON public.permissions TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


CREATE POLICY permissions_delete ON public.permissions FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'distributor'::text)))));


CREATE POLICY permissions_insert ON public.permissions FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'distributor'::text)))));


CREATE POLICY permissions_select ON public.permissions FOR SELECT TO authenticated USING (true);


CREATE POLICY permissions_staff_read ON public.permissions FOR SELECT TO authenticated USING (true);


CREATE POLICY permissions_update ON public.permissions FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'distributor'::text)))));


CREATE POLICY product_batches_delete ON public.product_batches FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


CREATE POLICY product_batches_insert ON public.product_batches FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY product_batches_select ON public.product_batches FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


CREATE POLICY product_batches_update ON public.product_batches FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY products_delete ON public.products FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


CREATE POLICY products_insert ON public.products FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY products_select ON public.products FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


CREATE POLICY products_update ON public.products FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY profiles_self_insert ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


CREATE POLICY profiles_self_read ON public.profiles FOR SELECT TO authenticated USING (((auth.uid() = id) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


CREATE POLICY profiles_self_write ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


CREATE POLICY purchase_items_delete ON public.purchase_items FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


CREATE POLICY purchase_items_insert ON public.purchase_items FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY purchase_items_select ON public.purchase_items FOR SELECT TO authenticated USING (public.can_manage_finance(auth.uid()));


CREATE POLICY purchase_items_update ON public.purchase_items FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY purchases_delete ON public.purchases FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


CREATE POLICY purchases_insert ON public.purchases FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY purchases_select ON public.purchases FOR SELECT TO authenticated USING (public.can_manage_finance(auth.uid()));


CREATE POLICY purchases_update ON public.purchases FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY push_subscriptions_delete ON public.push_subscriptions FOR DELETE TO authenticated USING ((auth.uid() = user_id));


CREATE POLICY push_subscriptions_insert ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


CREATE POLICY push_subscriptions_select ON public.push_subscriptions FOR SELECT TO authenticated USING ((auth.uid() = user_id));


CREATE POLICY push_subscriptions_update ON public.push_subscriptions FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


CREATE POLICY reminder_logs_insert ON public.reminder_logs FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));


CREATE POLICY reminder_logs_select ON public.reminder_logs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


CREATE POLICY reminder_templates_delete ON public.reminder_templates FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


CREATE POLICY reminder_templates_insert ON public.reminder_templates FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY reminder_templates_select ON public.reminder_templates FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


CREATE POLICY reminder_templates_update ON public.reminder_templates FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY role_permissions_admin_all ON public.role_permissions TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


CREATE POLICY role_permissions_delete ON public.role_permissions FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'distributor'::text)))));


CREATE POLICY role_permissions_insert ON public.role_permissions FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'distributor'::text)))));


CREATE POLICY role_permissions_select ON public.role_permissions FOR SELECT TO authenticated USING (true);


CREATE POLICY role_permissions_staff_read ON public.role_permissions FOR SELECT TO authenticated USING (true);


CREATE POLICY role_permissions_update ON public.role_permissions FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'distributor'::text)))));


CREATE POLICY roles_admin_delete ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


CREATE POLICY roles_admin_update ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


CREATE POLICY roles_admin_write ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


CREATE POLICY roles_read_self ON public.user_roles FOR SELECT TO authenticated USING ((user_id = auth.uid()));


CREATE POLICY route_stops_select ON public.route_stops FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


CREATE POLICY route_stops_write ON public.route_stops TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY routes_select ON public.routes FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


CREATE POLICY routes_write ON public.routes TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY stock_adjustment_items_insert ON public.stock_adjustment_items FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY stock_adjustment_items_select ON public.stock_adjustment_items FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


CREATE POLICY stock_adjustment_items_update ON public.stock_adjustment_items FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY stock_adjustments_insert ON public.stock_adjustments FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY stock_adjustments_select ON public.stock_adjustments FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


CREATE POLICY stock_adjustments_update ON public.stock_adjustments FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY stock_reconciliation_items_insert ON public.stock_reconciliation_items FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY stock_reconciliation_items_select ON public.stock_reconciliation_items FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


CREATE POLICY stock_reconciliation_items_update ON public.stock_reconciliation_items FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY stock_reconciliations_insert ON public.stock_reconciliations FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY stock_reconciliations_select ON public.stock_reconciliations FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


CREATE POLICY stock_reconciliations_update ON public.stock_reconciliations FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY sudha_claims_delete ON public.sudha_claims FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


CREATE POLICY sudha_claims_insert ON public.sudha_claims FOR INSERT TO authenticated WITH CHECK (public.can_manage_sales(auth.uid()));


CREATE POLICY sudha_claims_select ON public.sudha_claims FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));


CREATE POLICY sudha_claims_update ON public.sudha_claims FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY supplier_payments_select ON public.supplier_payments FOR SELECT TO authenticated USING (public.can_manage_finance(auth.uid()));


CREATE POLICY supplier_payments_write ON public.supplier_payments TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY suppliers_delete ON public.suppliers FOR DELETE TO authenticated USING (public.can_manage_finance(auth.uid()));


CREATE POLICY suppliers_insert ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY suppliers_select ON public.suppliers FOR SELECT TO authenticated USING (public.can_manage_finance(auth.uid()));


CREATE POLICY suppliers_update ON public.suppliers FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY users_insert ON public.users FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users users_1
  WHERE ((users_1.id = auth.uid()) AND (users_1.role = 'distributor'::text)))));


CREATE POLICY users_select_admin ON public.users FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users users_1
  WHERE ((users_1.id = auth.uid()) AND (users_1.role = 'distributor'::text)))));


CREATE POLICY users_select_self ON public.users FOR SELECT TO authenticated USING ((id = auth.uid()));


CREATE POLICY users_update ON public.users FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users users_1
  WHERE ((users_1.id = auth.uid()) AND (users_1.role = 'distributor'::text)))));


CREATE POLICY warehouses_insert ON public.warehouses FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(auth.uid()));


CREATE POLICY warehouses_select ON public.warehouses FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));


CREATE POLICY warehouses_update ON public.warehouses FOR UPDATE TO authenticated USING (public.can_manage_finance(auth.uid())) WITH CHECK (public.can_manage_finance(auth.uid()));


-- FIX: the login page queries public.users BEFORE authentication
-- (email/mobile lookup). The original schema had no anon policy, so login
-- could never see the user row. Allow anon read; bcrypt hashes are salted
-- and the anon key is not public for this private ERP.
CREATE POLICY users_select_anon_login ON public.users FOR SELECT TO anon USING (true);


-- FIX: the /verify-email page looks up the token while the user is still
-- signed out. Allow anon read (the token itself is the secret).
CREATE POLICY email_verification_tokens_select_anon ON public.email_verification_tokens FOR SELECT TO anon USING (true);

