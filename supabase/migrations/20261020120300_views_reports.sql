-- =====================================================================
-- Battery ERP — read models, dashboard and reports
-- Views run with the caller's privileges (security_invoker) so RLS
-- applies; report functions are SECURITY INVOKER for the same reason.
-- =====================================================================

create view public.v_product_stock with (security_invoker = true) as
select
  p.id, p.company_id, p.sku, p.name, p.description, p.stock_type, p.uom, p.hsn_code, p.gst_rate_code,
  p.purchase_price, p.retail_price, p.wholesale_price, p.reorder_level, p.is_active, p.search_text,
  p.brand_id, b.name as brand_name, coalesce(b.is_own_brand, false) as is_own_brand,
  p.category_id, c.name as category_name,
  coalesce(sb.quantity, 0)::numeric(14,3) as quantity,
  coalesce(sb.avg_cost, 0)::numeric(14,4) as avg_cost,
  round(coalesce(sb.quantity, 0) * coalesce(sb.avg_cost, 0), 2)::numeric(14,2) as stock_value,
  (p.is_active and coalesce(sb.quantity, 0) <= p.reorder_level) as is_low_stock,
  p.created_at, p.updated_at
from public.products p
left join public.brands b on b.id = p.brand_id
left join public.categories c on c.id = p.category_id
left join public.stock_balances sb on sb.product_id = p.id;

-- The balance projection must always equal the sum of the ledger.
create view public.v_stock_reconciliation with (security_invoker = true) as
select
  p.id as product_id, p.company_id, p.sku, p.name,
  coalesce(sb.quantity, 0) as balance_quantity,
  coalesce(l.ledger_quantity, 0) as ledger_quantity,
  coalesce(sb.quantity, 0) - coalesce(l.ledger_quantity, 0) as difference
from public.products p
left join public.stock_balances sb on sb.product_id = p.id
left join (
  select product_id, sum(quantity) as ledger_quantity from public.stock_movements group by product_id
) l on l.product_id = p.id;

create view public.v_stock_movements with (security_invoker = true) as
select
  m.id, m.company_id, m.product_id, p.sku, p.name as product_name, p.stock_type, p.uom,
  m.movement_type, m.quantity, m.unit_cost, round(abs(m.quantity) * m.unit_cost, 2) as value,
  m.movement_date, m.source_type, m.source_id, m.reference, m.note,
  m.created_by, pr.full_name as created_by_name, m.created_at
from public.stock_movements m
join public.products p on p.id = m.product_id
left join public.profiles pr on pr.id = m.created_by;

create view public.v_sales_invoices with (security_invoker = true) as
select
  i.id, i.company_id, i.invoice_number, i.status, i.sale_type, i.customer_id, i.customer_name,
  i.customer_gstin, i.invoice_date, i.due_date, i.place_of_supply, i.supply_type, i.prices_include_tax,
  i.subtotal, i.discount_total, i.cgst_total, i.sgst_total, i.igst_total, i.tax_total, i.round_off,
  i.grand_total, i.amount_paid,
  case when i.status = 'posted' then i.grand_total - i.amount_paid else 0 end as balance_due,
  case
    when i.status <> 'posted' then i.status::text
    when i.amount_paid >= i.grand_total then 'paid'
    when i.due_date < (now() at time zone 'Asia/Kolkata')::date then 'overdue'
    when i.amount_paid > 0 then 'partial'
    else 'unpaid'
  end as payment_status,
  (select count(*) from public.sales_lines l where l.invoice_id = i.id) as line_count,
  i.created_by, i.created_at, i.posted_at
from public.sales_invoices i;

create view public.v_customer_balances with (security_invoker = true) as
select
  c.id, c.company_id, c.name, c.customer_type, c.is_walk_in, c.gstin, c.state_code, c.phone, c.email,
  c.billing_address, c.shipping_address, c.credit_days, c.is_active, c.contact_person,
  coalesce(sum(i.grand_total) filter (where i.status = 'posted'), 0)::numeric(14,2) as total_invoiced,
  coalesce(sum(i.amount_paid) filter (where i.status = 'posted'), 0)::numeric(14,2) as total_paid,
  coalesce(sum(i.grand_total - i.amount_paid) filter (where i.status = 'posted'), 0)::numeric(14,2) as outstanding,
  coalesce(sum(i.grand_total - i.amount_paid) filter (
    where i.status = 'posted' and i.due_date < (now() at time zone 'Asia/Kolkata')::date), 0)::numeric(14,2) as overdue,
  count(i.id) filter (where i.status = 'posted') as invoice_count,
  max(i.invoice_date) filter (where i.status = 'posted') as last_invoice_date
from public.customers c
left join public.sales_invoices i on i.customer_id = c.id
group by c.id;

create view public.v_supplier_balances with (security_invoker = true) as
select
  s.id, s.company_id, s.name, s.contact_person, s.gstin, s.state_code, s.phone, s.email, s.address, s.is_active,
  coalesce(sum(pu.grand_total) filter (where pu.status = 'posted'), 0)::numeric(14,2) as total_purchased,
  coalesce(sum(pu.amount_paid) filter (where pu.status = 'posted'), 0)::numeric(14,2) as total_paid,
  coalesce(sum(pu.grand_total - pu.amount_paid) filter (where pu.status = 'posted'), 0)::numeric(14,2) as outstanding,
  count(pu.id) filter (where pu.status = 'posted') as purchase_count,
  max(pu.purchase_date) filter (where pu.status = 'posted') as last_purchase_date
from public.suppliers s
left join public.purchases pu on pu.supplier_id = s.id
group by s.id;

create view public.v_payments with (security_invoker = true) as
select
  pm.id, pm.company_id, pm.payment_number, pm.direction, pm.customer_id, pm.supplier_id,
  coalesce(c.name, s.name) as party_name, pm.payment_date, pm.method, pm.reference, pm.amount, pm.notes,
  pm.created_at, pr.full_name as created_by_name,
  (select string_agg(coalesce(i.invoice_number, pu.purchase_number), ', ' order by coalesce(i.invoice_number, pu.purchase_number))
     from public.payment_allocations a
     left join public.sales_invoices i on i.id = a.sales_invoice_id
     left join public.purchases pu on pu.id = a.purchase_id
    where a.payment_id = pm.id) as allocated_to
from public.payments pm
left join public.customers c on c.id = pm.customer_id
left join public.suppliers s on s.id = pm.supplier_id
left join public.profiles pr on pr.id = pm.created_by;

create view public.v_purchases with (security_invoker = true) as
select
  pu.id, pu.company_id, pu.purchase_number, pu.status, pu.supplier_id, s.name as supplier_name,
  pu.supplier_invoice_number, pu.purchase_date, pu.supply_type, pu.on_credit, pu.subtotal, pu.cgst_total,
  pu.sgst_total, pu.igst_total, pu.tax_total, pu.grand_total, pu.amount_paid,
  case when pu.status = 'posted' then pu.grand_total - pu.amount_paid else 0 end as balance_due,
  (select count(*) from public.purchase_lines l where l.purchase_id = pu.id) as line_count,
  pu.created_at, pu.notes
from public.purchases pu
join public.suppliers s on s.id = pu.supplier_id;

create view public.v_production_orders with (security_invoker = true) as
select
  po.id, po.company_id, po.order_number, po.status, po.product_id, p.sku, p.name as product_name,
  po.bom_id, b.name as bom_name, po.planned_quantity, po.produced_quantity, po.production_date,
  po.material_cost, po.unit_material_cost, po.overhead_estimate_per_unit, po.notes, po.wastage_notes,
  po.created_at, po.completed_at
from public.production_orders po
join public.products p on p.id = po.product_id
join public.boms b on b.id = po.bom_id;

-- ---------------------------------------------------------------------
-- Dashboard: one round trip, every figure from live tables.
-- ---------------------------------------------------------------------
create function public.dashboard_metrics() returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_company uuid := private.current_company_id();
  v_today date;
  v_month_start date;
  v_result jsonb;
begin
  if v_company is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select (now() at time zone c.timezone)::date into v_today from public.companies c where c.id = v_company;
  v_month_start := date_trunc('month', v_today)::date;

  select jsonb_build_object(
    'today', v_today,
    'sales_today', (select coalesce(sum(grand_total), 0) from public.sales_invoices
                    where status = 'posted' and invoice_date = v_today),
    'invoices_today', (select count(*) from public.sales_invoices where status = 'posted' and invoice_date = v_today),
    'sales_month', (select coalesce(sum(grand_total), 0) from public.sales_invoices
                    where status = 'posted' and invoice_date >= v_month_start and invoice_date <= v_today),
    'invoices_month', (select count(*) from public.sales_invoices
                       where status = 'posted' and invoice_date >= v_month_start and invoice_date <= v_today),
    'total_products', (select count(*) from public.products where is_active),
    'products_by_type', (select coalesce(jsonb_object_agg(stock_type, n), '{}'::jsonb)
                         from (select stock_type, count(*) n from public.products where is_active group by stock_type) t),
    'stock_quantity', (select coalesce(sum(quantity), 0) from public.v_product_stock where is_active),
    'finished_goods_quantity', (select coalesce(sum(quantity), 0) from public.v_product_stock
                                where is_active and stock_type <> 'raw_material'),
    'inventory_value', (select coalesce(sum(stock_value), 0) from public.v_product_stock),
    'low_stock_count', (select count(*) from public.v_product_stock where is_low_stock),
    'receivables', (select coalesce(sum(grand_total - amount_paid), 0) from public.sales_invoices where status = 'posted'),
    'overdue_receivables', (select coalesce(sum(grand_total - amount_paid), 0) from public.sales_invoices
                            where status = 'posted' and due_date < v_today),
    'payables', (select coalesce(sum(grand_total - amount_paid), 0) from public.purchases where status = 'posted'),
    'production_month_orders', (select count(*) from public.production_orders
                                where status = 'completed' and production_date >= v_month_start),
    'production_month_quantity', (select coalesce(sum(produced_quantity), 0) from public.production_orders
                                  where status = 'completed' and production_date >= v_month_start),
    'sales_trend', (select coalesce(jsonb_agg(jsonb_build_object('date', d, 'total', coalesce(t.total, 0)) order by d), '[]'::jsonb)
                    from generate_series(v_today - 29, v_today, interval '1 day') d
                    left join (select invoice_date, sum(grand_total) total from public.sales_invoices
                               where status = 'posted' and invoice_date > v_today - 30 group by invoice_date) t
                      on t.invoice_date = d::date),
    'recent_sales', (select coalesce(jsonb_agg(r), '[]'::jsonb) from (
                       select id, invoice_number, customer_name, invoice_date, grand_total, payment_status, sale_type
                       from public.v_sales_invoices where status = 'posted'
                       order by posted_at desc nulls last limit 6) r),
    'recent_movements', (select coalesce(jsonb_agg(r), '[]'::jsonb) from (
                       select id, sku, product_name, movement_type, quantity, reference, created_at
                       from public.v_stock_movements order by created_at desc limit 8) r),
    'low_stock', (select coalesce(jsonb_agg(r), '[]'::jsonb) from (
                       select id, sku, name, stock_type, quantity, reorder_level, uom
                       from public.v_product_stock where is_low_stock
                       order by (quantity / nullif(reorder_level, 0)) nulls first, sku limit 6) r)
  ) into v_result;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- Reports (date range inclusive)
-- ---------------------------------------------------------------------
create function public.report_sales_by_date(p_from date, p_to date)
returns table (invoice_date date, invoice_count bigint, taxable numeric, tax numeric, total numeric)
language sql stable security invoker set search_path = '' as $$
  select i.invoice_date, count(*), sum(i.subtotal), sum(i.tax_total), sum(i.grand_total)
  from public.sales_invoices i
  where i.status = 'posted' and i.invoice_date between p_from and p_to
  group by i.invoice_date
  order by i.invoice_date desc
$$;

create function public.report_sales_by_product(p_from date, p_to date)
returns table (product_id uuid, sku text, product_name text, stock_type public.stock_type,
               quantity numeric, taxable numeric, total numeric, cost numeric, margin numeric)
language sql stable security invoker set search_path = '' as $$
  select l.product_id, l.sku, max(l.product_name), max(l.stock_type::text)::public.stock_type,
         sum(l.quantity), sum(l.taxable_value), sum(l.line_total),
         round(sum(l.quantity * coalesce(l.unit_cost, 0)), 2),
         sum(l.taxable_value) - round(sum(l.quantity * coalesce(l.unit_cost, 0)), 2)
  from public.sales_lines l
  join public.sales_invoices i on i.id = l.invoice_id
  where i.status = 'posted' and i.invoice_date between p_from and p_to
  group by l.product_id, l.sku
  order by sum(l.taxable_value) desc
$$;

create function public.report_gst_summary(p_from date, p_to date)
returns table (direction text, supply_type public.supply_type, gst_rate numeric, taxable numeric,
               cgst numeric, sgst numeric, igst numeric, total_tax numeric)
language sql stable security invoker set search_path = '' as $$
  select 'output (sales)', i.supply_type, l.gst_rate, sum(l.taxable_value), sum(l.cgst_amount),
         sum(l.sgst_amount), sum(l.igst_amount), sum(l.cgst_amount + l.sgst_amount + l.igst_amount)
  from public.sales_lines l join public.sales_invoices i on i.id = l.invoice_id
  where i.status = 'posted' and i.invoice_date between p_from and p_to
  group by i.supply_type, l.gst_rate
  union all
  select 'input (purchases)', pu.supply_type, l.gst_rate, sum(l.taxable_value), sum(l.cgst_amount),
         sum(l.sgst_amount), sum(l.igst_amount), sum(l.cgst_amount + l.sgst_amount + l.igst_amount)
  from public.purchase_lines l join public.purchases pu on pu.id = l.purchase_id
  where pu.status = 'posted' and pu.purchase_date between p_from and p_to
  group by pu.supply_type, l.gst_rate
  order by 1 desc, 2, 3
$$;

create function public.report_purchase_summary(p_from date, p_to date)
returns table (supplier_id uuid, supplier_name text, purchase_count bigint, taxable numeric,
               tax numeric, total numeric, paid numeric, outstanding numeric)
language sql stable security invoker set search_path = '' as $$
  select s.id, s.name, count(pu.id), sum(pu.subtotal), sum(pu.tax_total), sum(pu.grand_total),
         sum(pu.amount_paid), sum(pu.grand_total - pu.amount_paid)
  from public.purchases pu join public.suppliers s on s.id = pu.supplier_id
  where pu.status = 'posted' and pu.purchase_date between p_from and p_to
  group by s.id, s.name
  order by sum(pu.grand_total) desc
$$;

revoke all on public.v_product_stock, public.v_stock_reconciliation, public.v_stock_movements,
  public.v_sales_invoices, public.v_customer_balances, public.v_supplier_balances, public.v_payments,
  public.v_purchases, public.v_production_orders from anon;
grant select on public.v_product_stock, public.v_stock_reconciliation, public.v_stock_movements,
  public.v_sales_invoices, public.v_customer_balances, public.v_supplier_balances, public.v_payments,
  public.v_purchases, public.v_production_orders to authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'public.dashboard_metrics()', 'public.report_sales_by_date(date, date)',
    'public.report_sales_by_product(date, date)', 'public.report_gst_summary(date, date)',
    'public.report_purchase_summary(date, date)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
