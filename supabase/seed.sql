-- =====================================================================
-- Battery ERP — DEMO SEED DATA (fictional)
--
-- Every business, person, GSTIN, phone number and bank detail below is
-- invented. GST rates are UNVERIFIED SAMPLE configuration and must be
-- reviewed by the client's accountant before any real use.
--
-- Idempotent: fixed IDs + ON CONFLICT for master data, idempotency keys
-- and status checks for transactions. Running it twice changes nothing.
-- Transactions are created through the same posting functions the app
-- uses, so the seeded ledger is consistent by construction.
--
-- Demo sign-ins (password for all: Demo@12345)
--   admin@voltaxis-demo.test       Owner / Admin
--   accounts@voltaxis-demo.test    Accounts / Billing
--   sales@voltaxis-demo.test       Sales
--   inventory@voltaxis-demo.test   Inventory
--   production@voltaxis-demo.test  Production
-- =====================================================================

-- ---------------------------------------------------------------------
-- Company, location, users
-- ---------------------------------------------------------------------
insert into public.companies (
  id, name, legal_name, gstin, state_code, address_line1, address_line2, city, pincode, phone, email,
  bank_name, bank_account_number, bank_ifsc, invoice_terms, invoice_footer, is_demo_configuration
) values (
  '00000000-0000-4000-8000-000000000001',
  'Voltaxis Power Systems',
  'Voltaxis Power Systems Pvt. Ltd. (DEMO)',
  '27AABCV1234F1Z5',
  '27',
  'Plot 14, Demo Industrial Estate',
  'Bhosari MIDC',
  'Pune',
  '411026',
  '+91 20 0000 0000',
  'accounts@voltaxis-demo.test',
  'Demo Bank (sample)',
  '000000000000',
  'DEMO0000001',
  E'Goods once sold will be replaced only under the manufacturer''s warranty terms.\nPayment due as per the terms stated on this invoice.',
  'This is a demonstration invoice generated from sample data.',
  true
) on conflict (id) do nothing;

insert into public.locations (id, company_id, name, is_default)
values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Main Warehouse', true)
on conflict (id) do nothing;

do $$
declare
  u record;
begin
  for u in select * from (values
    ('00000000-0000-4000-8100-000000000001'::uuid, 'admin@voltaxis-demo.test',      'Aarav Deshpande (Owner)', 'admin'::public.app_role, false),
    ('00000000-0000-4000-8100-000000000002'::uuid, 'accounts@voltaxis-demo.test',   'Neha Joshi (Accounts)',   'accounts', false),
    ('00000000-0000-4000-8100-000000000003'::uuid, 'sales@voltaxis-demo.test',      'Vikram Patil (Sales)',    'sales', true),
    ('00000000-0000-4000-8100-000000000004'::uuid, 'inventory@voltaxis-demo.test',  'Sanjay Kale (Stores)',    'inventory', false),
    ('00000000-0000-4000-8100-000000000005'::uuid, 'production@voltaxis-demo.test', 'Meera Pawar (Production)','production', false)
  ) as t(id, email, full_name, role, receipts)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('Demo@12345', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', u.full_name), now(), now(), '', '', '', ''
    ) on conflict (id) do nothing;

    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            'email', now(), now(), now())
    on conflict (provider_id, provider) do nothing;

    insert into public.profiles (id, full_name, email) values (u.id, u.full_name, u.email)
    on conflict (id) do update set full_name = excluded.full_name;

    insert into public.company_memberships (company_id, user_id, role, can_record_receipts)
    values ('00000000-0000-4000-8000-000000000001', u.id, u.role, u.receipts)
    on conflict (company_id, user_id) do nothing;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Tax configuration — SAMPLE ONLY, not verified for these products.
-- ---------------------------------------------------------------------
insert into public.gst_rates (id, company_id, code, description, rate, effective_from, is_sample)
select ('00000000-0000-4000-8200-0000000000' || lpad(n::text, 2, '0'))::uuid,
       '00000000-0000-4000-8000-000000000001', code, descr, rate, date '2025-04-01', true
from (values
  (1, 'GST0',  'Nil rated (sample)', 0),
  (2, 'GST5',  '5% slab (sample)',   5),
  (3, 'GST12', '12% slab (sample)',  12),
  (4, 'GST18', '18% slab (sample)',  18),
  (5, 'GST28', '28% slab (sample)',  28)
) as t(n, code, descr, rate)
on conflict (company_id, code, effective_from) do nothing;

-- ---------------------------------------------------------------------
-- Product master
-- ---------------------------------------------------------------------
insert into public.categories (id, company_id, name) values
  ('00000000-0000-4000-8300-000000000001', '00000000-0000-4000-8000-000000000001', 'Raw Materials'),
  ('00000000-0000-4000-8300-000000000002', '00000000-0000-4000-8000-000000000001', 'Automotive Batteries'),
  ('00000000-0000-4000-8300-000000000003', '00000000-0000-4000-8000-000000000001', 'Inverter Batteries'),
  ('00000000-0000-4000-8300-000000000004', '00000000-0000-4000-8000-000000000001', 'Two-Wheeler Batteries')
on conflict (id) do nothing;

insert into public.brands (id, company_id, name, is_own_brand) values
  ('00000000-0000-4000-8400-000000000001', '00000000-0000-4000-8000-000000000001', 'Voltaxis', true),
  ('00000000-0000-4000-8400-000000000002', '00000000-0000-4000-8000-000000000001', 'Krona', false),
  ('00000000-0000-4000-8400-000000000003', '00000000-0000-4000-8000-000000000001', 'Sunvolt', false),
  ('00000000-0000-4000-8400-000000000004', '00000000-0000-4000-8000-000000000001', 'Ampriva', false),
  ('00000000-0000-4000-8400-000000000005', '00000000-0000-4000-8000-000000000001', 'Generic Supply', false)
on conflict (id) do nothing;

insert into public.products (
  id, company_id, sku, name, description, brand_id, category_id, stock_type, uom, hsn_code, gst_rate_code,
  purchase_price, retail_price, wholesale_price, reorder_level
) values
  -- Raw materials
  ('00000000-0000-4000-8500-000000000001', '00000000-0000-4000-8000-000000000001', 'RM-LEAD-ALLOY', 'Lead Alloy Ingot',
   'Antimonial lead alloy for grid casting', '00000000-0000-4000-8400-000000000005', '00000000-0000-4000-8300-000000000001',
   'raw_material', 'KG', '7801', 'GST18', 205.00, 0, 0, 400),
  ('00000000-0000-4000-8500-000000000002', '00000000-0000-4000-8000-000000000001', 'RM-ACID', 'Battery Grade Sulphuric Acid',
   'Diluted electrolyte, 1.24 SG', '00000000-0000-4000-8400-000000000005', '00000000-0000-4000-8300-000000000001',
   'raw_material', 'LTR', '2807', 'GST18', 30.00, 0, 0, 200),
  ('00000000-0000-4000-8500-000000000003', '00000000-0000-4000-8000-000000000001', 'RM-CONTAINER', 'Battery Container with Lid',
   'Polypropylene 12V container and vent lid', '00000000-0000-4000-8400-000000000005', '00000000-0000-4000-8300-000000000001',
   'raw_material', 'PCS', '3926', 'GST18', 360.00, 0, 0, 40),
  ('00000000-0000-4000-8500-000000000004', '00000000-0000-4000-8000-000000000001', 'RM-SEPARATOR', 'PE Separator Sheet',
   'Polyethylene envelope separator', '00000000-0000-4000-8400-000000000005', '00000000-0000-4000-8300-000000000001',
   'raw_material', 'PCS', '3921', 'GST18', 6.00, 0, 0, 600),
  -- Own brand (manufactured)
  ('00000000-0000-4000-8500-000000000011', '00000000-0000-4000-8000-000000000001', 'VX-AUTO-35', 'Voltaxis Auto 35Ah',
   '12V 35Ah car battery, 24-month warranty', '00000000-0000-4000-8400-000000000001', '00000000-0000-4000-8300-000000000002',
   'manufactured', 'PCS', '8507', 'GST18', 0, 4499.00, 3350.00, 15),
  ('00000000-0000-4000-8500-000000000012', '00000000-0000-4000-8000-000000000001', 'VX-AUTO-65', 'Voltaxis Auto 65Ah',
   '12V 65Ah SUV battery, 36-month warranty', '00000000-0000-4000-8400-000000000001', '00000000-0000-4000-8300-000000000002',
   'manufactured', 'PCS', '8507', 'GST18', 0, 7299.00, 5450.00, 10),
  ('00000000-0000-4000-8500-000000000013', '00000000-0000-4000-8000-000000000001', 'VX-INV-150', 'Voltaxis Tubular Inverter 150Ah',
   'Tall tubular inverter battery, 48-month warranty', '00000000-0000-4000-8400-000000000001', '00000000-0000-4000-8300-000000000003',
   'manufactured', 'PCS', '8507', 'GST18', 0, 13999.00, 10450.00, 8),
  ('00000000-0000-4000-8500-000000000014', '00000000-0000-4000-8000-000000000001', 'VX-2W-7', 'Voltaxis Two-Wheeler 7Ah',
   '12V 7Ah VRLA bike battery', '00000000-0000-4000-8400-000000000001', '00000000-0000-4000-8300-000000000004',
   'manufactured', 'PCS', '8507', 'GST18', 0, 1499.00, 1080.00, 20),
  -- Third-party (trading)
  ('00000000-0000-4000-8500-000000000021', '00000000-0000-4000-8000-000000000001', 'KR-AUTO-45', 'Krona Auto 45Ah',
   'Third-party 12V 45Ah car battery', '00000000-0000-4000-8400-000000000002', '00000000-0000-4000-8300-000000000002',
   'trading', 'PCS', '8507', 'GST18', 4100.00, 5899.00, 4650.00, 6),
  ('00000000-0000-4000-8500-000000000022', '00000000-0000-4000-8000-000000000001', 'SV-INV-120', 'Sunvolt Inverter 120Ah',
   'Third-party flat-plate inverter battery', '00000000-0000-4000-8400-000000000003', '00000000-0000-4000-8300-000000000003',
   'trading', 'PCS', '8507', 'GST18', 7600.00, 10999.00, 8650.00, 5),
  ('00000000-0000-4000-8500-000000000023', '00000000-0000-4000-8000-000000000001', 'SV-INV-200', 'Sunvolt Tall Tubular 200Ah',
   'Third-party tall tubular inverter battery', '00000000-0000-4000-8400-000000000003', '00000000-0000-4000-8300-000000000003',
   'trading', 'PCS', '8507', 'GST18', 12200.00, 17499.00, 13900.00, 4),
  ('00000000-0000-4000-8500-000000000024', '00000000-0000-4000-8000-000000000001', 'AP-2W-9', 'Ampriva Bike 9Ah',
   'Third-party 12V 9Ah two-wheeler battery', '00000000-0000-4000-8400-000000000004', '00000000-0000-4000-8300-000000000004',
   'trading', 'PCS', '8507', 'GST18', 1150.00, 1799.00, 1350.00, 10)
on conflict (id) do nothing;

-- Bills of materials (per 1 finished battery)
insert into public.boms (id, company_id, product_id, name, output_quantity, notes) values
  ('00000000-0000-4000-8600-000000000001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8500-000000000011', 'BOM VX-AUTO-35 v1', 1, 'Sample recipe for demo'),
  ('00000000-0000-4000-8600-000000000002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8500-000000000012', 'BOM VX-AUTO-65 v1', 1, 'Sample recipe for demo'),
  ('00000000-0000-4000-8600-000000000003', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8500-000000000013', 'BOM VX-INV-150 v1', 1, 'Sample recipe for demo'),
  ('00000000-0000-4000-8600-000000000004', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8500-000000000014', 'BOM VX-2W-7 v1', 1, 'Sample recipe for demo')
on conflict (id) do nothing;

insert into public.bom_lines (company_id, bom_id, component_product_id, quantity)
select '00000000-0000-4000-8000-000000000001', b::uuid, c::uuid, q
from (values
  ('00000000-0000-4000-8600-000000000001', '00000000-0000-4000-8500-000000000001', 5.2),
  ('00000000-0000-4000-8600-000000000001', '00000000-0000-4000-8500-000000000002', 2.6),
  ('00000000-0000-4000-8600-000000000001', '00000000-0000-4000-8500-000000000003', 1),
  ('00000000-0000-4000-8600-000000000001', '00000000-0000-4000-8500-000000000004', 8),
  ('00000000-0000-4000-8600-000000000002', '00000000-0000-4000-8500-000000000001', 9.4),
  ('00000000-0000-4000-8600-000000000002', '00000000-0000-4000-8500-000000000002', 4.5),
  ('00000000-0000-4000-8600-000000000002', '00000000-0000-4000-8500-000000000003', 1),
  ('00000000-0000-4000-8600-000000000002', '00000000-0000-4000-8500-000000000004', 12),
  ('00000000-0000-4000-8600-000000000003', '00000000-0000-4000-8500-000000000001', 22.5),
  ('00000000-0000-4000-8600-000000000003', '00000000-0000-4000-8500-000000000002', 11),
  ('00000000-0000-4000-8600-000000000003', '00000000-0000-4000-8500-000000000003', 1),
  ('00000000-0000-4000-8600-000000000003', '00000000-0000-4000-8500-000000000004', 20),
  ('00000000-0000-4000-8600-000000000004', '00000000-0000-4000-8500-000000000001', 1.3),
  ('00000000-0000-4000-8600-000000000004', '00000000-0000-4000-8500-000000000002', 0.6),
  ('00000000-0000-4000-8600-000000000004', '00000000-0000-4000-8500-000000000003', 1),
  ('00000000-0000-4000-8600-000000000004', '00000000-0000-4000-8500-000000000004', 4)
) as t(b, c, q)
on conflict (bom_id, component_product_id) do nothing;

-- ---------------------------------------------------------------------
-- Parties (fictional)
-- ---------------------------------------------------------------------
insert into public.customers (id, company_id, name, customer_type, is_walk_in, contact_person, gstin, state_code,
                              phone, email, billing_address, shipping_address, credit_days) values
  ('00000000-0000-4000-8700-000000000001', '00000000-0000-4000-8000-000000000001', 'Walk-in Customer', 'retail', true,
   null, null, '27', null, null, 'Counter sale', null, 0),
  ('00000000-0000-4000-8700-000000000002', '00000000-0000-4000-8000-000000000001', 'Sharma Auto Electricals', 'wholesale', false,
   'Rakesh Sharma', '27AAKFS5521M1Z2', '27', '+91 98000 00001', 'orders@sharma-auto.test',
   'Shop 7, Demo Auto Market, Pimpri, Pune 411018', null, 30),
  ('00000000-0000-4000-8700-000000000003', '00000000-0000-4000-8000-000000000001', 'Deccan Power Solutions', 'wholesale', false,
   'Kiran Rao', '29AAGCD7781Q1Z9', '29', '+91 98000 00002', 'purchase@deccanpower.test',
   '22 Sample Road, Peenya Industrial Area, Bengaluru 560058', '22 Sample Road, Peenya Industrial Area, Bengaluru 560058', 45),
  ('00000000-0000-4000-8700-000000000004', '00000000-0000-4000-8000-000000000001', 'Shree Ganesh Inverters', 'wholesale', false,
   'Mahesh Gaikwad', '27ABOFS3390K1Z4', '27', '+91 98000 00003', null,
   'Near Demo Chowk, Kothrud, Pune 411038', null, 15),
  ('00000000-0000-4000-8700-000000000005', '00000000-0000-4000-8000-000000000001', 'Rohan Mehta', 'retail', false,
   null, null, '27', '+91 98000 00004', null, 'Flat 12, Sample Residency, Baner, Pune 411045', null, 0),
  ('00000000-0000-4000-8700-000000000006', '00000000-0000-4000-8000-000000000001', 'Anita Kulkarni', 'retail', false,
   null, null, '27', '+91 98000 00005', null, 'Demo Lane, Aundh, Pune 411007', null, 0)
on conflict (id) do nothing;

insert into public.suppliers (id, company_id, name, contact_person, gstin, state_code, phone, email, address) values
  ('00000000-0000-4000-8800-000000000001', '00000000-0000-4000-8000-000000000001', 'Metalcore Alloys', 'Suresh Iyer',
   '27AADCM4410P1Z8', '27', '+91 97000 00001', 'sales@metalcore.test', 'Gat 101, Demo Industrial Zone, Chakan, Pune 410501'),
  ('00000000-0000-4000-8800-000000000002', '00000000-0000-4000-8000-000000000001', 'Western Chemicals', 'Hetal Shah',
   '24AAECW2208R1Z3', '24', '+91 97000 00002', 'dispatch@westernchem.test', 'Plot 5, Sample GIDC, Ankleshwar, Gujarat 393002'),
  ('00000000-0000-4000-8800-000000000003', '00000000-0000-4000-8000-000000000001', 'PolyMould Plastics', 'Imran Shaikh',
   '27AAJFP6619L1Z7', '27', '+91 97000 00003', null, 'Unit 3, Demo Estate, Bhosari, Pune 411026'),
  ('00000000-0000-4000-8800-000000000004', '00000000-0000-4000-8000-000000000001', 'Sunvolt & Krona Distribution', 'Ajay Verma',
   '27AAHCS8875D1Z1', '27', '+91 97000 00004', 'trade@sk-distribution.test', 'Warehouse 9, Sample Logistics Park, Wagholi, Pune 412207')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Transaction history, posted through the application's own functions
-- (dates are relative to today so the dashboard always has recent data).
-- ---------------------------------------------------------------------
do $$
declare
  v_admin constant uuid := '00000000-0000-4000-8100-000000000001';
  d date := (now() at time zone 'Asia/Kolkata')::date;
  r jsonb;
  v_inv uuid;
  v_po uuid;
  v_pur uuid;
  k text;
begin
  -- Act as the demo admin so role checks and audit attribution work.
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  -- Opening stock (60 days ago), once per product.
  for k, r in select * from (values
    ('00000000-0000-4000-8500-000000000001', '{"q": 600, "c": 198}'),
    ('00000000-0000-4000-8500-000000000002', '{"q": 300, "c": 29}'),
    ('00000000-0000-4000-8500-000000000003', '{"q": 60, "c": 350}'),
    ('00000000-0000-4000-8500-000000000004', '{"q": 900, "c": 5.8}'),
    ('00000000-0000-4000-8500-000000000011', '{"q": 18, "c": 2420}'),
    ('00000000-0000-4000-8500-000000000014', '{"q": 25, "c": 690}'),
    ('00000000-0000-4000-8500-000000000021', '{"q": 6, "c": 4050}'),
    ('00000000-0000-4000-8500-000000000024', '{"q": 14, "c": 1120}')
  ) as t(pid, v)
  loop
    if not exists (select 1 from public.stock_movements where product_id = k::uuid) then
      perform public.record_opening_stock(k::uuid, (r ->> 'q')::numeric, (r ->> 'c')::numeric, d - 60);
    end if;
  end loop;

  -- Purchases
  perform public.create_purchase(jsonb_build_object(
    'idempotency_key', '00000000-0000-4000-9000-000000000001', 'supplier_id', '00000000-0000-4000-8800-000000000001',
    'supplier_invoice_number', 'MCA/2627/0412', 'purchase_date', d - 45, 'on_credit', true,
    'lines', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-4000-8500-000000000001', 'quantity', 1000, 'unit_price', 205))));
  perform public.create_purchase(jsonb_build_object(
    'idempotency_key', '00000000-0000-4000-9000-000000000002', 'supplier_id', '00000000-0000-4000-8800-000000000002',
    'supplier_invoice_number', 'WC-88213', 'purchase_date', d - 40, 'on_credit', true,
    'lines', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-4000-8500-000000000002', 'quantity', 500, 'unit_price', 30))));
  perform public.create_purchase(jsonb_build_object(
    'idempotency_key', '00000000-0000-4000-9000-000000000003', 'supplier_id', '00000000-0000-4000-8800-000000000003',
    'supplier_invoice_number', 'PMP/219', 'purchase_date', d - 38, 'on_credit', false, 'payment_method', 'bank_transfer',
    'payment_reference', 'NEFT DEMO001',
    'lines', jsonb_build_array(
      jsonb_build_object('product_id', '00000000-0000-4000-8500-000000000003', 'quantity', 80, 'unit_price', 360),
      jsonb_build_object('product_id', '00000000-0000-4000-8500-000000000004', 'quantity', 1500, 'unit_price', 6, 'discount_amount', 300))));
  perform public.create_purchase(jsonb_build_object(
    'idempotency_key', '00000000-0000-4000-9000-000000000004', 'supplier_id', '00000000-0000-4000-8800-000000000004',
    'supplier_invoice_number', 'SKD/5521', 'purchase_date', d - 30, 'on_credit', false, 'payment_method', 'cheque',
    'payment_reference', 'CHQ 000451',
    'lines', jsonb_build_array(
      jsonb_build_object('product_id', '00000000-0000-4000-8500-000000000022', 'quantity', 8, 'unit_price', 7600),
      jsonb_build_object('product_id', '00000000-0000-4000-8500-000000000023', 'quantity', 4, 'unit_price', 12200))));
  r := public.create_purchase(jsonb_build_object(
    'idempotency_key', '00000000-0000-4000-9000-000000000005', 'supplier_id', '00000000-0000-4000-8800-000000000004',
    'supplier_invoice_number', 'SKD/5690', 'purchase_date', d - 12, 'on_credit', true,
    'lines', jsonb_build_array(
      jsonb_build_object('product_id', '00000000-0000-4000-8500-000000000021', 'quantity', 10, 'unit_price', 4100),
      jsonb_build_object('product_id', '00000000-0000-4000-8500-000000000024', 'quantity', 20, 'unit_price', 1150))));
  v_pur := (r ->> 'id')::uuid;

  -- Production
  r := public.create_production_order(jsonb_build_object(
    'idempotency_key', '00000000-0000-4000-9100-000000000001', 'bom_id', '00000000-0000-4000-8600-000000000002',
    'planned_quantity', 40, 'production_date', d - 35, 'notes', 'Monthly SUV battery batch'));
  v_po := (r ->> 'id')::uuid;
  if (select status from public.production_orders where id = v_po) = 'draft' then
    perform public.complete_production_order(v_po, jsonb_build_object('produced_quantity', 40, 'materials', '[]'::jsonb));
  end if;

  r := public.create_production_order(jsonb_build_object(
    'idempotency_key', '00000000-0000-4000-9100-000000000002', 'bom_id', '00000000-0000-4000-8600-000000000003',
    'planned_quantity', 30, 'production_date', d - 20, 'notes', 'Inverter season batch'));
  v_po := (r ->> 'id')::uuid;
  if (select status from public.production_orders where id = v_po) = 'draft' then
    perform public.complete_production_order(v_po, jsonb_build_object(
      'produced_quantity', 29,
      'materials', jsonb_build_array(
        jsonb_build_object('product_id', '00000000-0000-4000-8500-000000000001', 'actual_quantity', 690),
        jsonb_build_object('product_id', '00000000-0000-4000-8500-000000000004', 'actual_quantity', 604)),
      'wastage_notes', 'One unit failed formation charge; extra lead used on rework.'));
  end if;

  -- A draft order left open for the live demo.
  perform public.create_production_order(jsonb_build_object(
    'idempotency_key', '00000000-0000-4000-9100-000000000003', 'bom_id', '00000000-0000-4000-8600-000000000001',
    'planned_quantity', 20, 'production_date', d - 1, 'notes', 'Car battery top-up batch'));

  -- Sales invoices (posted unless noted)
  for k, r in select * from (values
    ('01', jsonb_build_object('customer_id', '00000000-0000-4000-8700-000000000002', 'sale_type', 'wholesale', 'invoice_date', d - 28,
       'lines', jsonb_build_array(
         jsonb_build_object('product_id', '00000000-0000-4000-8500-000000000012', 'quantity', 10, 'unit_price', 5450),
         jsonb_build_object('product_id', '00000000-0000-4000-8500-000000000011', 'quantity', 6, 'unit_price', 3350, 'discount_type', 'percent', 'discount_value', 2)))),
    ('02', jsonb_build_object('customer_id', '00000000-0000-4000-8700-000000000001', 'sale_type', 'retail', 'invoice_date', d - 26,
       'lines', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-4000-8500-000000000014', 'quantity', 2, 'unit_price', 1499)))),
    ('03', jsonb_build_object('customer_id', '00000000-0000-4000-8700-000000000003', 'sale_type', 'wholesale', 'invoice_date', d - 18,
       'lines', jsonb_build_array(
         jsonb_build_object('product_id', '00000000-0000-4000-8500-000000000013', 'quantity', 12, 'unit_price', 10450),
         jsonb_build_object('product_id', '00000000-0000-4000-8500-000000000022', 'quantity', 4, 'unit_price', 8650)))),
    ('04', jsonb_build_object('customer_id', '00000000-0000-4000-8700-000000000005', 'sale_type', 'retail', 'invoice_date', d - 15,
       'lines', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-4000-8500-000000000013', 'quantity', 1, 'unit_price', 13999, 'discount_type', 'amount', 'discount_value', 500)))),
    ('05', jsonb_build_object('customer_id', '00000000-0000-4000-8700-000000000004', 'sale_type', 'wholesale', 'invoice_date', d - 11,
       'lines', jsonb_build_array(
         jsonb_build_object('product_id', '00000000-0000-4000-8500-000000000013', 'quantity', 5, 'unit_price', 10450),
         jsonb_build_object('product_id', '00000000-0000-4000-8500-000000000023', 'quantity', 2, 'unit_price', 13900)))),
    ('06', jsonb_build_object('customer_id', '00000000-0000-4000-8700-000000000001', 'sale_type', 'retail', 'invoice_date', d - 8,
       'lines', jsonb_build_array(
         jsonb_build_object('product_id', '00000000-0000-4000-8500-000000000021', 'quantity', 1, 'unit_price', 5899),
         jsonb_build_object('product_id', '00000000-0000-4000-8500-000000000024', 'quantity', 2, 'unit_price', 1799)))),
    ('07', jsonb_build_object('customer_id', '00000000-0000-4000-8700-000000000002', 'sale_type', 'wholesale', 'invoice_date', d - 5,
       'lines', jsonb_build_array(
         jsonb_build_object('product_id', '00000000-0000-4000-8500-000000000012', 'quantity', 8, 'unit_price', 5450),
         jsonb_build_object('product_id', '00000000-0000-4000-8500-000000000021', 'quantity', 4, 'unit_price', 4650)))),
    ('08', jsonb_build_object('customer_id', '00000000-0000-4000-8700-000000000006', 'sale_type', 'retail', 'invoice_date', d - 2,
       'lines', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-4000-8500-000000000012', 'quantity', 1, 'unit_price', 7299)))),
    ('09', jsonb_build_object('customer_id', '00000000-0000-4000-8700-000000000001', 'sale_type', 'retail', 'invoice_date', d,
       'lines', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-4000-8500-000000000011', 'quantity', 1, 'unit_price', 4499))))
  ) as t(n, v)
  loop
    perform public.create_sales_invoice(r || jsonb_build_object('idempotency_key', '00000000-0000-4000-9200-0000000000' || k), true);
  end loop;

  -- One draft for the demo (editable, not yet posted).
  perform public.create_sales_invoice(jsonb_build_object(
    'idempotency_key', '00000000-0000-4000-9200-000000000099', 'customer_id', '00000000-0000-4000-8700-000000000004',
    'sale_type', 'wholesale', 'invoice_date', d,
    'lines', jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-4000-8500-000000000014', 'quantity', 10, 'unit_price', 1080))), false);

  -- Customer receipts: invoice 01 paid in full, 03 part-paid, 02/04/06/08 paid at the counter.
  for k in select unnest(array['01', '02', '04', '06', '08']) loop
    select id into v_inv from public.sales_invoices
    where idempotency_key = ('00000000-0000-4000-9200-0000000000' || k)::uuid;
    perform public.record_payment(jsonb_build_object(
      'idempotency_key', '00000000-0000-4000-9300-0000000000' || k, 'direction', 'receipt',
      'customer_id', (select customer_id from public.sales_invoices where id = v_inv),
      'payment_date', (select invoice_date from public.sales_invoices where id = v_inv) + case when k = '01' then 20 else 0 end,
      'method', case when k = '01' then 'bank_transfer' when k in ('04', '08') then 'upi' else 'cash' end,
      'reference', case when k = '01' then 'NEFT DEMO7781' when k in ('04', '08') then 'UPI DEMO' || k end,
      'allocations', jsonb_build_array(jsonb_build_object('document_id', v_inv,
        'amount', (select grand_total - amount_paid from public.sales_invoices where id = v_inv)))));
  end loop;
  select id into v_inv from public.sales_invoices where idempotency_key = '00000000-0000-4000-9200-000000000003';
  perform public.record_payment(jsonb_build_object(
    'idempotency_key', '00000000-0000-4000-9300-000000000003', 'direction', 'receipt',
    'customer_id', '00000000-0000-4000-8700-000000000003', 'payment_date', d - 4, 'method', 'bank_transfer',
    'reference', 'RTGS DEMO3301', 'allocations', jsonb_build_array(jsonb_build_object('document_id', v_inv, 'amount', 100000))));

  -- Supplier payment: part of the lead purchase.
  select id into v_pur from public.purchases where idempotency_key = '00000000-0000-4000-9000-000000000001';
  perform public.record_payment(jsonb_build_object(
    'idempotency_key', '00000000-0000-4000-9300-000000000101', 'direction', 'payment',
    'supplier_id', '00000000-0000-4000-8800-000000000001', 'payment_date', d - 25, 'method', 'bank_transfer',
    'reference', 'NEFT DEMO4410', 'allocations', jsonb_build_array(jsonb_build_object('document_id', v_pur, 'amount', 150000))));
end $$;
