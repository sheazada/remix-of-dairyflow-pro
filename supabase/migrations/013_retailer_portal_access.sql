-- Retailer portal RLS: retailers (customers.user_id = auth.uid()) can view
-- their own orders/invoices/ledger, place orders, and browse the product
-- catalog. Staff policies are untouched (policies OR together).

CREATE OR REPLACE FUNCTION public.my_customer_id(_uid uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.customers WHERE user_id = _uid LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.my_customer_id(uuid)
  TO anon, authenticated, service_role;

-- ---------- orders ----------
DROP POLICY IF EXISTS orders_select_retailer ON public.orders;
CREATE POLICY orders_select_retailer ON public.orders
  FOR SELECT TO authenticated
  USING (customer_id = public.my_customer_id(auth.uid()));

DROP POLICY IF EXISTS orders_insert_retailer ON public.orders;
CREATE POLICY orders_insert_retailer ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = public.my_customer_id(auth.uid()));

-- ---------- order items (through own orders) ----------
DROP POLICY IF EXISTS order_items_select_retailer ON public.order_items;
CREATE POLICY order_items_select_retailer ON public.order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.customer_id = public.my_customer_id(auth.uid())
  ));

DROP POLICY IF EXISTS order_items_insert_retailer ON public.order_items;
CREATE POLICY order_items_insert_retailer ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.customer_id = public.my_customer_id(auth.uid())
  ));

-- ---------- invoices (own) ----------
DROP POLICY IF EXISTS invoices_select_retailer ON public.invoices;
CREATE POLICY invoices_select_retailer ON public.invoices
  FOR SELECT TO authenticated
  USING (customer_id = public.my_customer_id(auth.uid()));

-- ---------- product catalog readable by any logged-in user ----------
DROP POLICY IF EXISTS products_select_authenticated ON public.products;
CREATE POLICY products_select_authenticated ON public.products
  FOR SELECT TO authenticated
  USING (true);
