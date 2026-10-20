-- =====================================================================
-- Battery ERP — core schema
-- Money: numeric(14,2). Quantities: numeric(14,3). Costs: numeric(14,4).
-- All business tables are company-scoped. Posted records are never
-- hard-deleted; corrections are compensating records.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Internal schema: helper functions that the API must not expose.
create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------
create type public.app_role as enum ('admin', 'accounts', 'sales', 'inventory', 'production');
create type public.stock_type as enum ('raw_material', 'manufactured', 'trading');
create type public.movement_type as enum (
  'opening_balance',
  'purchase_receipt',
  'sale',
  'production_consumption',
  'production_output',
  'sales_return',
  'purchase_return',
  'stock_adjustment',
  'sale_cancellation',
  'purchase_cancellation'
);
create type public.document_status as enum ('draft', 'posted', 'cancelled');
create type public.production_status as enum ('draft', 'completed', 'cancelled');
create type public.customer_type as enum ('retail', 'wholesale');
create type public.supply_type as enum ('intra_state', 'inter_state');
create type public.discount_type as enum ('percent', 'amount');
create type public.payment_method as enum ('cash', 'upi', 'bank_transfer', 'cheque', 'card', 'other');
create type public.payment_direction as enum ('receipt', 'payment');

-- ---------------------------------------------------------------------
-- Reference data: GST state codes
-- ---------------------------------------------------------------------
create table public.gst_states (
  code char(2) primary key check (code ~ '^[0-9]{2}$'),
  name text not null unique
);

insert into public.gst_states (code, name) values
  ('01', 'Jammu and Kashmir'), ('02', 'Himachal Pradesh'), ('03', 'Punjab'),
  ('04', 'Chandigarh'), ('05', 'Uttarakhand'), ('06', 'Haryana'), ('07', 'Delhi'),
  ('08', 'Rajasthan'), ('09', 'Uttar Pradesh'), ('10', 'Bihar'), ('11', 'Sikkim'),
  ('12', 'Arunachal Pradesh'), ('13', 'Nagaland'), ('14', 'Manipur'), ('15', 'Mizoram'),
  ('16', 'Tripura'), ('17', 'Meghalaya'), ('18', 'Assam'), ('19', 'West Bengal'),
  ('20', 'Jharkhand'), ('21', 'Odisha'), ('22', 'Chhattisgarh'), ('23', 'Madhya Pradesh'),
  ('24', 'Gujarat'), ('26', 'Dadra and Nagar Haveli and Daman and Diu'), ('27', 'Maharashtra'),
  ('29', 'Karnataka'), ('30', 'Goa'), ('31', 'Lakshadweep'), ('32', 'Kerala'),
  ('33', 'Tamil Nadu'), ('34', 'Puducherry'), ('35', 'Andaman and Nicobar Islands'),
  ('36', 'Telangana'), ('37', 'Andhra Pradesh'), ('38', 'Ladakh'), ('97', 'Other Territory');

-- GSTIN shape check (format only; checksum is not verified).
create function private.is_valid_gstin(v text) returns boolean
language sql immutable set search_path = '' as $$
  select v ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
$$;

-- ---------------------------------------------------------------------
-- Company and access
-- ---------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  legal_name text not null check (length(trim(legal_name)) > 0),
  gstin text check (gstin is null or private.is_valid_gstin(gstin)),
  state_code char(2) not null references public.gst_states(code),
  address_line1 text,
  address_line2 text,
  city text,
  pincode text check (pincode is null or pincode ~ '^[1-9][0-9]{5}$'),
  phone text,
  email text,
  bank_name text,
  bank_account_number text,
  bank_ifsc text check (bank_ifsc is null or bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  invoice_terms text,
  invoice_footer text,
  timezone text not null default 'Asia/Kolkata',
  -- Labour/overhead per produced unit. NULL means "not configured"; the UI
  -- then shows material cost only, with an explicit estimate label.
  overhead_per_unit_estimate numeric(14,2) check (overhead_per_unit_estimate is null or overhead_per_unit_estimate >= 0),
  -- True until an accountant has approved company details and tax settings.
  is_demo_configuration boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_gstin_state check (gstin is null or substr(gstin, 1, 2) = state_code)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  -- Sales users record customer receipts only when this is granted.
  can_record_receipts boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);
create index company_memberships_user_idx on public.company_memberships (user_id) where is_active;

create table public.document_sequences (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  doc_type text not null check (doc_type in ('sales_invoice', 'purchase', 'production_order', 'payment_receipt', 'payment_made', 'stock_adjustment')),
  prefix text not null check (prefix ~ '^[A-Z0-9/-]{1,12}$'),
  fiscal_year text not null check (fiscal_year ~ '^[0-9]{4}-[0-9]{2}$'),
  next_number integer not null default 1 check (next_number > 0),
  padding smallint not null default 4 check (padding between 1 and 8),
  updated_at timestamptz not null default now(),
  unique (company_id, doc_type, fiscal_year)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  company_id uuid references public.companies(id),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_company_created_idx on public.audit_logs (company_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

-- ---------------------------------------------------------------------
-- Tax configuration (versioned by effective date)
-- A product references a rate *code*; the rate applied is the version
-- effective on the document date. Rates are never edited in place.
-- ---------------------------------------------------------------------
create table public.gst_rates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  code text not null check (code ~ '^[A-Z0-9_]{2,20}$'),
  description text not null,
  rate numeric(5,2) not null check (rate >= 0 and rate <= 40),
  effective_from date not null,
  is_sample boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (company_id, code, effective_from)
);
create index gst_rates_lookup_idx on public.gst_rates (company_id, code, effective_from desc);

-- ---------------------------------------------------------------------
-- Product master
-- ---------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  name text not null check (length(trim(name)) > 0),
  is_own_brand boolean not null default false,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);
create unique index locations_one_default_idx on public.locations (company_id) where is_default;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  sku text not null check (sku ~ '^[A-Z0-9][A-Z0-9_-]{1,39}$'),
  name text not null check (length(trim(name)) between 1 and 200),
  description text,
  brand_id uuid references public.brands(id),
  category_id uuid references public.categories(id),
  stock_type public.stock_type not null,
  uom text not null default 'PCS' check (uom ~ '^[A-Z]{2,5}$'),
  hsn_code text check (hsn_code is null or hsn_code ~ '^[0-9]{4}([0-9]{2}){0,2}$'),
  gst_rate_code text not null,
  purchase_price numeric(14,2) not null default 0 check (purchase_price >= 0),
  -- Retail price is GST-inclusive (shelf price); wholesale is GST-exclusive.
  retail_price numeric(14,2) not null default 0 check (retail_price >= 0),
  wholesale_price numeric(14,2) not null default 0 check (wholesale_price >= 0),
  reorder_level numeric(14,3) not null default 0 check (reorder_level >= 0),
  is_active boolean not null default true,
  search_text text generated always as (lower(sku || ' ' || name || ' ' || coalesce(hsn_code, '') || ' ' || coalesce(description, ''))) stored,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, sku)
);
create index products_company_type_idx on public.products (company_id, stock_type) where is_active;
create index products_search_idx on public.products using gin (search_text extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- Inventory: the movement ledger is the source of truth.
-- stock_balances is a projection maintained only by posting functions
-- and reconcilable against the ledger (see v_stock_reconciliation).
-- ---------------------------------------------------------------------
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  product_id uuid not null references public.products(id),
  location_id uuid not null references public.locations(id),
  movement_type public.movement_type not null,
  quantity numeric(14,3) not null check (quantity <> 0),
  unit_cost numeric(14,4) not null default 0 check (unit_cost >= 0),
  movement_date date not null,
  source_type text not null check (source_type in ('opening', 'purchase', 'sales_invoice', 'production_order', 'stock_adjustment')),
  source_id uuid,
  source_line_id uuid,
  reference text,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint stock_movements_sign check (
    (movement_type in ('opening_balance', 'purchase_receipt', 'production_output', 'sales_return', 'sale_cancellation') and quantity > 0)
    or (movement_type in ('sale', 'production_consumption', 'purchase_return', 'purchase_cancellation') and quantity < 0)
    or movement_type = 'stock_adjustment'
  )
);
create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);
create index stock_movements_company_date_idx on public.stock_movements (company_id, movement_date desc, created_at desc);
create index stock_movements_source_idx on public.stock_movements (source_type, source_id);

create table public.stock_balances (
  company_id uuid not null references public.companies(id),
  product_id uuid not null references public.products(id),
  location_id uuid not null references public.locations(id),
  quantity numeric(14,3) not null default 0,
  avg_cost numeric(14,4) not null default 0 check (avg_cost >= 0),
  updated_at timestamptz not null default now(),
  primary key (product_id, location_id),
  constraint stock_balances_non_negative check (quantity >= 0)
);
create index stock_balances_company_idx on public.stock_balances (company_id);

-- ---------------------------------------------------------------------
-- Parties
-- ---------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  name text not null check (length(trim(name)) > 0),
  contact_person text,
  gstin text check (gstin is null or private.is_valid_gstin(gstin)),
  state_code char(2) not null references public.gst_states(code),
  phone text,
  email text,
  address text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_gstin_state check (gstin is null or substr(gstin, 1, 2) = state_code),
  unique (company_id, name)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  name text not null check (length(trim(name)) > 0),
  customer_type public.customer_type not null default 'retail',
  is_walk_in boolean not null default false,
  contact_person text,
  gstin text check (gstin is null or private.is_valid_gstin(gstin)),
  state_code char(2) not null references public.gst_states(code),
  phone text,
  email text,
  billing_address text,
  shipping_address text,
  credit_days integer not null default 0 check (credit_days between 0 and 365),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_gstin_state check (gstin is null or substr(gstin, 1, 2) = state_code),
  unique (company_id, name)
);
create unique index customers_one_walk_in_idx on public.customers (company_id) where is_walk_in;

-- ---------------------------------------------------------------------
-- Purchasing (MVP: one confirmed purchase = goods receipt + supplier bill).
-- Purchase orders and separate goods receipts are P1 and can be added
-- as new tables referencing purchases without changing this design.
-- ---------------------------------------------------------------------
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  purchase_number text not null,
  status public.document_status not null default 'posted' check (status in ('posted', 'cancelled')),
  supplier_id uuid not null references public.suppliers(id),
  supplier_invoice_number text,
  purchase_date date not null,
  supply_type public.supply_type not null,
  on_credit boolean not null default true,
  subtotal numeric(14,2) not null check (subtotal >= 0),
  cgst_total numeric(14,2) not null default 0 check (cgst_total >= 0),
  sgst_total numeric(14,2) not null default 0 check (sgst_total >= 0),
  igst_total numeric(14,2) not null default 0 check (igst_total >= 0),
  tax_total numeric(14,2) not null check (tax_total >= 0),
  round_off numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null check (grand_total >= 0),
  amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0),
  notes text,
  idempotency_key uuid not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  cancel_reason text,
  unique (company_id, purchase_number),
  unique (company_id, idempotency_key),
  constraint purchases_paid_le_total check (amount_paid <= grand_total)
);
create index purchases_company_date_idx on public.purchases (company_id, purchase_date desc);
create index purchases_supplier_idx on public.purchases (supplier_id);

create table public.purchase_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  purchase_id uuid not null references public.purchases(id),
  line_no smallint not null check (line_no > 0),
  product_id uuid not null references public.products(id),
  product_name text not null,
  sku text not null,
  hsn_code text,
  uom text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  taxable_value numeric(14,2) not null check (taxable_value >= 0),
  gst_rate numeric(5,2) not null check (gst_rate >= 0),
  cgst_amount numeric(14,2) not null default 0,
  sgst_amount numeric(14,2) not null default 0,
  igst_amount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null check (line_total >= 0),
  unique (purchase_id, line_no)
);
create index purchase_lines_product_idx on public.purchase_lines (product_id);

-- ---------------------------------------------------------------------
-- Manufacturing
-- ---------------------------------------------------------------------
create table public.boms (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  product_id uuid not null references public.products(id),
  name text not null,
  output_quantity numeric(14,3) not null default 1 check (output_quantity > 0),
  is_active boolean not null default true,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (company_id, name)
);
create index boms_product_idx on public.boms (product_id);

create table public.bom_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  bom_id uuid not null references public.boms(id),
  component_product_id uuid not null references public.products(id),
  quantity numeric(14,3) not null check (quantity > 0),
  unique (bom_id, component_product_id)
);

create table public.production_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  order_number text not null,
  status public.production_status not null default 'draft',
  product_id uuid not null references public.products(id),
  bom_id uuid not null references public.boms(id),
  planned_quantity numeric(14,3) not null check (planned_quantity > 0),
  produced_quantity numeric(14,3) check (produced_quantity is null or produced_quantity > 0),
  production_date date not null,
  material_cost numeric(14,2),
  unit_material_cost numeric(14,4),
  overhead_estimate_per_unit numeric(14,2),
  notes text,
  wastage_notes text,
  idempotency_key uuid not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  unique (company_id, order_number),
  unique (company_id, idempotency_key),
  constraint production_completed_fields check (
    status <> 'completed' or (produced_quantity is not null and material_cost is not null and completed_at is not null)
  )
);
create index production_orders_company_date_idx on public.production_orders (company_id, production_date desc);

create table public.production_materials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  production_order_id uuid not null references public.production_orders(id),
  product_id uuid not null references public.products(id),
  expected_quantity numeric(14,3) not null check (expected_quantity >= 0),
  actual_quantity numeric(14,3) check (actual_quantity is null or actual_quantity >= 0),
  unit_cost numeric(14,4),
  total_cost numeric(14,2),
  unique (production_order_id, product_id)
);

-- ---------------------------------------------------------------------
-- Sales
-- ---------------------------------------------------------------------
create table public.sales_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  invoice_number text,
  status public.document_status not null default 'draft',
  sale_type public.customer_type not null,
  customer_id uuid not null references public.customers(id),
  -- Snapshots: later master-data edits must not alter posted invoices.
  customer_name text not null,
  customer_gstin text,
  customer_phone text,
  billing_address text,
  shipping_address text,
  invoice_date date not null,
  due_date date,
  place_of_supply char(2) not null references public.gst_states(code),
  supply_type public.supply_type not null,
  prices_include_tax boolean not null,
  payment_terms text,
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  discount_total numeric(14,2) not null default 0 check (discount_total >= 0),
  cgst_total numeric(14,2) not null default 0 check (cgst_total >= 0),
  sgst_total numeric(14,2) not null default 0 check (sgst_total >= 0),
  igst_total numeric(14,2) not null default 0 check (igst_total >= 0),
  tax_total numeric(14,2) not null default 0 check (tax_total >= 0),
  round_off numeric(14,2) not null default 0 check (abs(round_off) < 1),
  grand_total numeric(14,2) not null default 0 check (grand_total >= 0),
  amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0),
  notes text,
  -- Seller snapshot for the printed invoice.
  seller_snapshot jsonb,
  idempotency_key uuid not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  posted_at timestamptz,
  posted_by uuid references public.profiles(id),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  cancel_reason text,
  unique (company_id, invoice_number),
  unique (company_id, idempotency_key),
  constraint sales_invoices_paid_le_total check (amount_paid <= grand_total),
  constraint sales_invoices_number_when_posted check (status <> 'posted' or invoice_number is not null)
);
create index sales_invoices_company_date_idx on public.sales_invoices (company_id, invoice_date desc);
create index sales_invoices_customer_idx on public.sales_invoices (customer_id);
create index sales_invoices_status_idx on public.sales_invoices (company_id, status);

create table public.sales_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  invoice_id uuid not null references public.sales_invoices(id),
  line_no smallint not null check (line_no > 0),
  product_id uuid not null references public.products(id),
  product_name text not null,
  sku text not null,
  hsn_code text,
  uom text not null,
  stock_type public.stock_type not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  discount_type public.discount_type,
  discount_value numeric(14,2) not null default 0 check (discount_value >= 0),
  gross_amount numeric(14,2) not null check (gross_amount >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  taxable_value numeric(14,2) not null check (taxable_value >= 0),
  gst_rate numeric(5,2) not null check (gst_rate >= 0),
  cgst_amount numeric(14,2) not null default 0,
  sgst_amount numeric(14,2) not null default 0,
  igst_amount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null check (line_total >= 0),
  unit_cost numeric(14,4),
  unique (invoice_id, line_no),
  constraint sales_lines_discount_le_gross check (discount_amount <= gross_amount)
);
create index sales_lines_product_idx on public.sales_lines (product_id);

-- ---------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  payment_number text not null,
  direction public.payment_direction not null,
  customer_id uuid references public.customers(id),
  supplier_id uuid references public.suppliers(id),
  payment_date date not null,
  method public.payment_method not null,
  reference text,
  amount numeric(14,2) not null check (amount > 0),
  notes text,
  idempotency_key uuid not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (company_id, payment_number),
  unique (company_id, idempotency_key),
  constraint payments_party check (
    (direction = 'receipt' and customer_id is not null and supplier_id is null)
    or (direction = 'payment' and supplier_id is not null and customer_id is null)
  )
);
create index payments_company_date_idx on public.payments (company_id, payment_date desc);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  payment_id uuid not null references public.payments(id),
  sales_invoice_id uuid references public.sales_invoices(id),
  purchase_id uuid references public.purchases(id),
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  constraint payment_allocations_target check ((sales_invoice_id is null) <> (purchase_id is null))
);
create index payment_allocations_invoice_idx on public.payment_allocations (sales_invoice_id);
create index payment_allocations_purchase_idx on public.payment_allocations (purchase_id);
create index payment_allocations_payment_idx on public.payment_allocations (payment_id);
