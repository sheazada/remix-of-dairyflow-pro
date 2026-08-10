
-- ============================================================
-- FUNCTIONS
-- ============================================================

CREATE FUNCTION public.apply_delivery_quantities(_invoice_id uuid, _items jsonb) RETURNS text
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


CREATE FUNCTION public.can_manage_finance(_uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN ('admin','manager'))
$$;


CREATE FUNCTION public.can_manage_sales(_uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN ('admin','manager','salesperson'))
$$;


CREATE FUNCTION public.create_demand_consolidation(p_delivery_cycle_id uuid) RETURNS uuid
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


CREATE FUNCTION public.create_notification(_user_id uuid, _type text, _title text, _body text, _data jsonb DEFAULT '{}'::jsonb) RETURNS uuid
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


CREATE FUNCTION public.enqueue_delivery_notifications(_delivery_id uuid) RETURNS integer
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


CREATE FUNCTION public.enqueue_run_en_route_notifications(_run_id uuid) RETURNS integer
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


CREATE FUNCTION public.ensure_delivery_cycle(p_delivery_date date, p_shift text DEFAULT 'morning'::text) RETURNS uuid
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


CREATE FUNCTION public.generate_adjustment_no() RETURNS text
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


CREATE FUNCTION public.generate_claim_no() RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM public.sudha_claims WHERE claim_date = CURRENT_DATE;
  RETURN 'CLM-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((n+1)::TEXT, 3, '0');
END; $$;


CREATE FUNCTION public.generate_collection_no() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM public.driver_collections WHERE delivery_date = CURRENT_DATE;
  RETURN 'COL-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD((n+1)::TEXT, 3, '0');
END; $$;


CREATE FUNCTION public.generate_consolidation_no(p_date date) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.demand_consolidations WHERE consolidation_date = p_date;
  RETURN 'DC-' || TO_CHAR(p_date, 'YYYYMMDD') || '-' || LPAD((v_count + 1)::TEXT, 3, '0');
END; $$;


CREATE FUNCTION public.generate_cycle_code(p_order_date date, p_shift text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.delivery_cycles WHERE order_date = p_order_date AND delivery_shift = p_shift;
  RETURN 'CYC-' || TO_CHAR(p_order_date, 'YYYYMMDD') || '-' || UPPER(LEFT(p_shift, 1)) || '-' || LPAD((v_count + 1)::TEXT, 3, '0');
END; $$;


CREATE FUNCTION public.generate_employee_id() RETURNS trigger
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


CREATE FUNCTION public.generate_recon_no() RETURNS text
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


CREATE FUNCTION public.generate_retailer_code() RETURNS trigger
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


CREATE FUNCTION public.get_account_status(_user_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT COALESCE(
    (SELECT account_status FROM public.profiles WHERE id = _user_id),
    'active'
  );
$$;


CREATE FUNCTION public.get_app_setting(_key text) RETURNS text
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT value FROM public.app_settings WHERE key = _key LIMIT 1;
$$;


CREATE FUNCTION public.get_crate_balance_as_of(p_as_of_date date DEFAULT CURRENT_DATE, p_crate_type_id uuid DEFAULT NULL::uuid) RETURNS TABLE(retailer_id uuid, retailer_name text, shop_name text, crate_type_id uuid, crate_type_name text, balance bigint)
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


CREATE FUNCTION public.get_customer_by_user_email(_email text) RETURNS uuid
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


CREATE FUNCTION public.get_near_expiry_stock(_days integer DEFAULT 30) RETURNS TABLE(product_name text, batch_no text, expiry_date date, available_qty numeric, days_remaining integer)
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


CREATE FUNCTION public.get_next_revision_no(_invoice_id uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(MAX(revision_number), 0) + 1 FROM public.invoice_revisions WHERE invoice_id = _invoice_id;
$$;


CREATE FUNCTION public.get_permission_id(_name text) RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT id FROM public.permissions WHERE name = _name LIMIT 1;
$$;


CREATE FUNCTION public.get_retailer_code(_user_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT retailer_code FROM public.customers WHERE user_id = _user_id LIMIT 1;
$$;


CREATE FUNCTION public.get_stock_valuation() RETURNS TABLE(product_id uuid, product_name text, total_qty numeric, available_qty numeric, damaged_qty numeric, avg_cost numeric, total_value numeric)
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


CREATE FUNCTION public.get_unread_notification_count(_user_id uuid) RETURNS integer
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  SELECT COUNT(*)::INTEGER
    FROM public.notifications
   WHERE user_id = auth.uid()
     AND (_user_id IS NULL OR _user_id = auth.uid())
     AND read_at IS NULL;
$$;


CREATE FUNCTION public.get_user_permissions(_user_id uuid) RETURNS TABLE(permission_name text, permission_label text, category text)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT DISTINCT p.name, p.label, p.category
  FROM public.permissions p
  JOIN public.role_permissions rp ON rp.permission_id = p.id
  JOIN public.users u ON u.role = rp.role
  WHERE u.id = _user_id;
$$;


CREATE FUNCTION public.handle_new_user() RETURNS trigger
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


CREATE FUNCTION public.has_permission(_user_id uuid, _permission_name text) RETURNS boolean
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


CREATE FUNCTION public.has_reminder_been_sent(_invoice_id uuid, _template_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.reminder_logs WHERE invoice_id = _invoice_id AND template_id = _template_id AND status = 'sent');
$$;


CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;


CREATE FUNCTION public.is_account_active(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT COALESCE(
    (SELECT account_status FROM public.profiles WHERE id = _user_id),
    'active'
  ) = 'active';
$$;


CREATE FUNCTION public.is_internal_staff(_uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role IN ('admin','manager','salesperson','driver','helper')
  )
$$;


CREATE FUNCTION public.is_staff(_uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid)
$$;


CREATE FUNCTION public.link_customer_to_user(_customer_id uuid, _email text) RETURNS uuid
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


CREATE FUNCTION public.log_access_event(_event_type text, _user_id uuid, _user_email text, _user_roles text[], _required_roles text[], _route_path text, _ip_address text, _user_agent text, _reason text) RETURNS void
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


CREATE FUNCTION public.log_delivery_changes() RETURNS trigger
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


CREATE FUNCTION public.log_delivery_run_changes() RETURNS trigger
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


CREATE FUNCTION public.post_stock_adjustment(_adjustment_id uuid) RETURNS void
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


CREATE FUNCTION public.recalc_customer_outstanding(_customer_id uuid) RETURNS void
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


CREATE FUNCTION public.recalc_invoice(_invoice_id uuid) RETURNS void
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


CREATE FUNCTION public.recalc_purchase(_purchase_id uuid) RETURNS void
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


CREATE FUNCTION public.recalc_run_delivery_status(_run_id uuid) RETURNS void
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


CREATE FUNCTION public.recalc_supplier_outstanding(_supplier_id uuid) RETURNS void
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


CREATE FUNCTION public.reconcile_collection(_collection_id uuid) RETURNS void
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


CREATE FUNCTION public.record_notification_attempt(_id uuid, _success boolean, _error text DEFAULT NULL::text, _provider text DEFAULT NULL::text, _provider_msg text DEFAULT NULL::text, _suppressed boolean DEFAULT false) RETURNS public.notification_logs
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


CREATE FUNCTION public.revise_invoice(_invoice_id uuid, _revision_reason text, _revised_items jsonb, _revised_by uuid) RETURNS jsonb
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


CREATE FUNCTION public.role_has_permission(_role text, _permission_name text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE rp.role = _role AND p.name = _permission_name
  );
$$;


CREATE FUNCTION public.send_notification(_user_id uuid, _type text, _title text, _body text, _data jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (_user_id, _type, _title, _body, _data) RETURNING id INTO v_notification_id;
  RETURN v_notification_id;
END; $$;


CREATE FUNCTION public.tg_customers_guard_user_id() RETURNS trigger
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


CREATE FUNCTION public.tg_deliveries_recalc_run_status() RETURNS trigger
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


CREATE FUNCTION public.tg_invoice_items_recalc() RETURNS trigger
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


CREATE FUNCTION public.tg_invoices_customer_outstanding() RETURNS trigger
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


CREATE FUNCTION public.tg_payments_recalc() RETURNS trigger
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


CREATE FUNCTION public.tg_purchases_supplier_outstanding() RETURNS trigger
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


CREATE FUNCTION public.tg_runs_enqueue_status_notifications() RETURNS trigger
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


CREATE FUNCTION public.tg_runs_recalc_delivery_status() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.recalc_run_delivery_status(NEW.id);
  RETURN NEW;
END;
$$;


CREATE FUNCTION public.tg_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;


CREATE FUNCTION public.tg_supplier_payments_recalc() RETURNS trigger
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


CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

