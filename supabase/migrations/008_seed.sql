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
