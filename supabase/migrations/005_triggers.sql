
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

