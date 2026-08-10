
-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER customers_guard_user_id BEFORE INSERT OR UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.tg_customers_guard_user_id();


CREATE TRIGGER customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TRIGGER deliveries_recalc_run_status AFTER INSERT OR DELETE OR UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.tg_deliveries_recalc_run_status();


CREATE TRIGGER deliveries_updated BEFORE UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TRIGGER delivery_runs_enqueue_notifications AFTER UPDATE OF delivery_status ON public.delivery_runs FOR EACH ROW EXECUTE FUNCTION public.tg_runs_enqueue_status_notifications();


CREATE TRIGGER delivery_runs_recalc_status AFTER INSERT OR UPDATE OF status, run_date, route_id ON public.delivery_runs FOR EACH ROW EXECUTE FUNCTION public.tg_runs_recalc_delivery_status();


CREATE TRIGGER delivery_runs_updated BEFORE UPDATE ON public.delivery_runs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TRIGGER invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TRIGGER orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TRIGGER products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TRIGGER purchases_updated BEFORE UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TRIGGER route_stops_updated BEFORE UPDATE ON public.route_stops FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TRIGGER routes_updated BEFORE UPDATE ON public.routes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TRIGGER set_updated_at_retailer_ledger_entries BEFORE UPDATE ON public.retailer_ledger_entries FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TRIGGER suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TRIGGER trg_delivery_cycles_updated_at BEFORE UPDATE ON public.delivery_cycles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TRIGGER trg_demand_consolidation_items_updated_at BEFORE UPDATE ON public.demand_consolidation_items FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TRIGGER trg_demand_consolidations_updated_at BEFORE UPDATE ON public.demand_consolidations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TRIGGER trg_distributors_updated_at BEFORE UPDATE ON public.distributors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TRIGGER trg_driver_collections_updated_at BEFORE UPDATE ON public.driver_collections FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TRIGGER trg_expense_categories_updated_at BEFORE UPDATE ON public.expense_categories FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TRIGGER trg_generate_employee_id BEFORE INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.generate_employee_id();


CREATE TRIGGER trg_generate_retailer_code BEFORE INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.generate_retailer_code();


CREATE TRIGGER trg_invoice_items_recalc AFTER INSERT OR DELETE OR UPDATE ON public.invoice_items FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_items_recalc();


CREATE TRIGGER trg_invoices_customer_outstanding AFTER INSERT OR DELETE OR UPDATE OF balance, status, customer_id, total ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tg_invoices_customer_outstanding();


CREATE TRIGGER trg_log_delivery_changes AFTER UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.log_delivery_changes();


CREATE TRIGGER trg_log_delivery_run_changes AFTER INSERT OR UPDATE ON public.delivery_runs FOR EACH ROW EXECUTE FUNCTION public.log_delivery_run_changes();


CREATE TRIGGER trg_notif_logs_updated_at BEFORE UPDATE ON public.notification_logs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TRIGGER trg_payments_recalc AFTER INSERT OR DELETE OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.tg_payments_recalc();


CREATE TRIGGER trg_purchases_supplier_outstanding AFTER INSERT OR DELETE OR UPDATE OF total, paid, status, supplier_id ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.tg_purchases_supplier_outstanding();


CREATE TRIGGER trg_push_subscriptions_updated_at BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TRIGGER trg_reminder_templates_updated_at BEFORE UPDATE ON public.reminder_templates FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TRIGGER trg_sudha_claims_updated_at BEFORE UPDATE ON public.sudha_claims FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


CREATE TRIGGER trg_supplier_payments_recalc AFTER INSERT OR DELETE OR UPDATE ON public.supplier_payments FOR EACH ROW EXECUTE FUNCTION public.tg_supplier_payments_recalc();


CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

