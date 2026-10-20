-- =====================================================================
-- Database acceptance tests (PRD §11). Run against a DEMO database that
-- has the migrations and seed applied:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/acceptance_test.sql
--
-- Everything runs inside a transaction that is rolled back at the end,
-- so the demo data is left untouched. Each check raises on failure.
-- Calls run as the `authenticated` API role, so RLS and grants apply.
-- =====================================================================
begin;

create function pg_temp.act_as(p_email text) returns void language plpgsql as $$
declare v uuid;
begin
  reset role;
  select id into v from auth.users where email = p_email;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function pg_temp.expect_error(p_sql text, p_contains text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(lower(p_contains) in lower(sqlerrm)) = 0 then
      raise exception 'Expected error containing "%" but got: %', p_contains, sqlerrm;
    end if;
    return;
  end;
  raise exception 'Expected an error containing "%" but the statement succeeded: %', p_contains, p_sql;
end $$;

create function pg_temp.qty(p_sku text) returns numeric language sql as $$
  select quantity from public.v_product_stock where sku = p_sku
$$;

create temp table t_ctx (k text primary key, v text);
grant all on t_ctx to authenticated;

do $$ begin raise notice '1. Unauthenticated access is rejected'; end $$;
set local role anon;
select pg_temp.expect_error('select * from public.products', 'permission denied');
select pg_temp.expect_error('select public.dashboard_metrics()', 'permission denied');
reset role;

do $$ begin raise notice '2. Purchase receipt increases stock exactly once'; end $$;
select pg_temp.act_as('inventory@voltaxis-demo.test');
insert into t_ctx values ('before', pg_temp.qty('RM-ACID'));
select public.create_purchase(jsonb_build_object(
  'idempotency_key', '11111111-1111-4111-8111-111111111111',
  'supplier_id', (select id from public.suppliers where name = 'Western Chemicals'),
  'purchase_date', current_date, 'on_credit', true,
  'lines', jsonb_build_array(jsonb_build_object(
    'product_id', (select id from public.products where sku = 'RM-ACID'), 'quantity', 100, 'unit_price', 31)))) ;
-- Same submission again (double click / retry) must not add stock again.
select public.create_purchase(jsonb_build_object(
  'idempotency_key', '11111111-1111-4111-8111-111111111111',
  'supplier_id', (select id from public.suppliers where name = 'Western Chemicals'),
  'purchase_date', current_date, 'on_credit', true,
  'lines', jsonb_build_array(jsonb_build_object(
    'product_id', (select id from public.products where sku = 'RM-ACID'), 'quantity', 100, 'unit_price', 31))));
do $$ begin
  if pg_temp.qty('RM-ACID') <> (select v::numeric from t_ctx where k = 'before') + 100 then
    raise exception 'Purchase did not increase stock by exactly 100 (now %)', pg_temp.qty('RM-ACID');
  end if;
  -- Gujarat supplier into Maharashtra: IGST only.
  if not exists (select 1 from public.purchases where idempotency_key = '11111111-1111-4111-8111-111111111111'
                 and igst_total = 558.00 and cgst_total = 0 and grand_total = 3658.00) then
    raise exception 'Inter-state purchase tax is wrong';
  end if;
end $$;

do $$ begin raise notice '3. Production consumes materials and adds finished stock; cannot complete twice'; end $$;
select pg_temp.act_as('production@voltaxis-demo.test');
insert into t_ctx select 'lead_before', pg_temp.qty('RM-LEAD-ALLOY');
insert into t_ctx select 'fg_before', pg_temp.qty('VX-AUTO-35');
insert into t_ctx select 'po', (public.create_production_order(jsonb_build_object(
  'idempotency_key', '22222222-2222-4222-8222-222222222222',
  'bom_id', (select id from public.boms where name = 'BOM VX-AUTO-35 v1'),
  'planned_quantity', 10, 'production_date', current_date)) ->> 'id');
select public.complete_production_order((select v::uuid from t_ctx where k = 'po'),
  jsonb_build_object('produced_quantity', 10, 'materials', '[]'::jsonb));
select pg_temp.expect_error(
  format('select public.complete_production_order(%L, %L)', (select v from t_ctx where k = 'po'),
         '{"produced_quantity": 10, "materials": []}'),
  'already completed');
do $$ begin
  if pg_temp.qty('RM-LEAD-ALLOY') <> (select v::numeric from t_ctx where k = 'lead_before') - 52 then
    raise exception 'Lead not consumed correctly';
  end if;
  if pg_temp.qty('VX-AUTO-35') <> (select v::numeric from t_ctx where k = 'fg_before') + 10 then
    raise exception 'Finished goods not added';
  end if;
  if (select material_cost from public.production_orders where id = (select v::uuid from t_ctx where k = 'po')) <= 0 then
    raise exception 'Material cost not recorded';
  end if;
end $$;

do $$ begin raise notice '4. Production role cannot touch sales; sales role cannot produce'; end $$;
select pg_temp.expect_error($q$select public.create_sales_invoice('{"idempotency_key":"33333333-3333-4333-8333-333333333333"}'::jsonb, true)$q$, 'not allowed');
select pg_temp.act_as('sales@voltaxis-demo.test');
select pg_temp.expect_error($q$select public.create_production_order('{"idempotency_key":"33333333-3333-4333-8333-333333333334"}'::jsonb)$q$, 'not allowed');

do $$ begin raise notice '5. Invoice posting reduces stock atomically; duplicate posting is a no-op'; end $$;
insert into t_ctx select 'fg2_before', pg_temp.qty('VX-AUTO-65');
insert into t_ctx select 'mv_before', (select count(*) from public.stock_movements);
insert into t_ctx select 'inv', (public.create_sales_invoice(jsonb_build_object(
  'idempotency_key', '44444444-4444-4444-8444-444444444444',
  'customer_id', (select id from public.customers where name = 'Sharma Auto Electricals'),
  'invoice_date', current_date,
  'lines', jsonb_build_array(jsonb_build_object(
    'product_id', (select id from public.products where sku = 'VX-AUTO-65'), 'quantity', 3, 'unit_price', 5450))), true) ->> 'id');
-- Retry of the same submission, then an explicit second post.
select public.create_sales_invoice(jsonb_build_object(
  'idempotency_key', '44444444-4444-4444-8444-444444444444',
  'customer_id', (select id from public.customers where name = 'Sharma Auto Electricals'),
  'invoice_date', current_date,
  'lines', jsonb_build_array(jsonb_build_object(
    'product_id', (select id from public.products where sku = 'VX-AUTO-65'), 'quantity', 3, 'unit_price', 5450))), true);
select public.post_sales_invoice((select v::uuid from t_ctx where k = 'inv'));
do $$ begin
  if pg_temp.qty('VX-AUTO-65') <> (select v::numeric from t_ctx where k = 'fg2_before') - 3 then
    raise exception 'Stock not reduced by exactly 3';
  end if;
  if (select count(*) from public.stock_movements) <> (select v::int from t_ctx where k = 'mv_before') + 1 then
    raise exception 'Duplicate posting created extra movements';
  end if;
  if (select count(*) from public.sales_invoices where idempotency_key = '44444444-4444-4444-8444-444444444444') <> 1 then
    raise exception 'Duplicate invoice created';
  end if;
  -- 3 x 5450 = 16350 taxable, 9% + 9% = 1471.50 each, total 19293
  if not exists (select 1 from public.sales_invoices where id = (select v::uuid from t_ctx where k = 'inv')
                 and subtotal = 16350 and cgst_total = 1471.50 and sgst_total = 1471.50 and grand_total = 19293
                 and invoice_number is not null and seller_snapshot is not null) then
    raise exception 'Invoice totals or snapshot wrong';
  end if;
end $$;

do $$ begin raise notice '6. Stock cannot go negative; failed posting rolls back completely'; end $$;
insert into t_ctx select 'inv_count', (select count(*) from public.sales_invoices);
select pg_temp.expect_error(format($q$select public.create_sales_invoice(%L::jsonb, true)$q$, jsonb_build_object(
  'idempotency_key', '55555555-5555-4555-8555-555555555555',
  'customer_id', (select id from public.customers where is_walk_in),
  'invoice_date', current_date,
  'lines', jsonb_build_array(
    jsonb_build_object('product_id', (select id from public.products where sku = 'VX-2W-7'), 'quantity', 1, 'unit_price', 1499),
    jsonb_build_object('product_id', (select id from public.products where sku = 'SV-INV-200'), 'quantity', 999, 'unit_price', 17499)))),
  'insufficient stock');
do $$ begin
  if (select count(*) from public.sales_invoices) <> (select v::int from t_ctx where k = 'inv_count') then
    raise exception 'Failed posting left an invoice behind';
  end if;
end $$;

do $$ begin raise notice '7. Invalid input is rejected'; end $$;
select pg_temp.expect_error(format($q$select public.create_sales_invoice(%L::jsonb, false)$q$, jsonb_build_object(
  'idempotency_key', '66666666-6666-4666-8666-666666666661', 'customer_id', (select id from public.customers where is_walk_in),
  'invoice_date', current_date, 'lines', jsonb_build_array(jsonb_build_object(
    'product_id', (select id from public.products where sku = 'VX-2W-7'), 'quantity', -2, 'unit_price', 1499)))),
  'quantity must be greater than zero');
select pg_temp.expect_error(format($q$select public.create_sales_invoice(%L::jsonb, false)$q$, jsonb_build_object(
  'idempotency_key', '66666666-6666-4666-8666-666666666662', 'customer_id', (select id from public.customers where is_walk_in),
  'invoice_date', current_date, 'lines', jsonb_build_array(jsonb_build_object(
    'product_id', (select id from public.products where sku = 'VX-2W-7'), 'quantity', 1, 'unit_price', -5)))),
  'price cannot be negative');
select pg_temp.expect_error(format($q$select public.create_sales_invoice(%L::jsonb, false)$q$, jsonb_build_object(
  'idempotency_key', '66666666-6666-4666-8666-666666666663', 'customer_id', (select id from public.customers where is_walk_in),
  'invoice_date', current_date, 'lines', '[]'::jsonb)), 'at least one');
select pg_temp.expect_error(format($q$select public.create_sales_invoice(%L::jsonb, false)$q$, jsonb_build_object(
  'idempotency_key', '66666666-6666-4666-8666-666666666664', 'customer_id', (select id from public.customers where is_walk_in),
  'invoice_date', current_date + 5, 'lines', jsonb_build_array(jsonb_build_object(
    'product_id', (select id from public.products where sku = 'VX-2W-7'), 'quantity', 1, 'unit_price', 1499)))),
  'future');
select pg_temp.expect_error(format($q$select public.create_sales_invoice(%L::jsonb, false)$q$, jsonb_build_object(
  'idempotency_key', '66666666-6666-4666-8666-666666666665', 'customer_id', (select id from public.customers where is_walk_in),
  'invoice_date', current_date, 'lines', jsonb_build_array(jsonb_build_object(
    'product_id', (select id from public.products where sku = 'RM-ACID'), 'quantity', 1, 'unit_price', 10)))),
  'raw material');

do $$ begin raise notice '8. Payments: partial, full, over-allocation rejected, idempotent'; end $$;
select pg_temp.act_as('accounts@voltaxis-demo.test');
select public.record_payment(jsonb_build_object(
  'idempotency_key', '77777777-7777-4777-8777-777777777771', 'direction', 'receipt',
  'customer_id', (select id from public.customers where name = 'Sharma Auto Electricals'),
  'payment_date', current_date, 'method', 'upi',
  'allocations', jsonb_build_array(jsonb_build_object('document_id', (select v from t_ctx where k = 'inv'), 'amount', 10000))));
select public.record_payment(jsonb_build_object(
  'idempotency_key', '77777777-7777-4777-8777-777777777771', 'direction', 'receipt',
  'customer_id', (select id from public.customers where name = 'Sharma Auto Electricals'),
  'payment_date', current_date, 'method', 'upi',
  'allocations', jsonb_build_array(jsonb_build_object('document_id', (select v from t_ctx where k = 'inv'), 'amount', 10000))));
select pg_temp.expect_error(format($q$select public.record_payment(%L::jsonb)$q$, jsonb_build_object(
  'idempotency_key', '77777777-7777-4777-8777-777777777772', 'direction', 'receipt',
  'customer_id', (select id from public.customers where name = 'Sharma Auto Electricals'),
  'payment_date', current_date, 'method', 'cash',
  'allocations', jsonb_build_array(jsonb_build_object('document_id', (select v from t_ctx where k = 'inv'), 'amount', 9293.01)))),
  'outstanding');
do $$ begin
  if (select balance_due from public.v_sales_invoices where id = (select v::uuid from t_ctx where k = 'inv')) <> 9293 then
    raise exception 'Outstanding balance wrong after partial payment';
  end if;
end $$;
select public.record_payment(jsonb_build_object(
  'idempotency_key', '77777777-7777-4777-8777-777777777773', 'direction', 'receipt',
  'customer_id', (select id from public.customers where name = 'Sharma Auto Electricals'),
  'payment_date', current_date, 'method', 'cash',
  'allocations', jsonb_build_array(jsonb_build_object('document_id', (select v from t_ctx where k = 'inv'), 'amount', 9293))));
do $$ begin
  if (select payment_status from public.v_sales_invoices where id = (select v::uuid from t_ctx where k = 'inv')) <> 'paid' then
    raise exception 'Invoice not marked paid';
  end if;
end $$;

do $$ begin raise notice '9. Posted records are immutable and cannot be deleted'; end $$;
select pg_temp.expect_error(format('update public.sales_invoices set grand_total = 1 where id = %L', (select v from t_ctx where k = 'inv')), 'permission denied');
select pg_temp.expect_error('delete from public.stock_movements', 'permission denied');
select pg_temp.expect_error($q$insert into public.stock_movements (company_id, product_id, location_id, movement_type, quantity, movement_date, source_type)
  select company_id, id, (select id from public.locations limit 1), 'stock_adjustment', 1000, current_date, 'stock_adjustment' from public.products limit 1$q$, 'permission denied');
select pg_temp.expect_error($q$update public.stock_balances set quantity = 99999$q$, 'permission denied');
reset role;
-- Even the owner cannot rewrite history (trigger guard).
select pg_temp.expect_error('update public.stock_movements set quantity = 1', 'immutable');
select pg_temp.expect_error(format('update public.sales_invoices set grand_total = 1 where id = %L', (select v from t_ctx where k = 'inv')), 'immutable');

do $$ begin raise notice '10. Cancellation is a controlled reversal'; end $$;
select pg_temp.act_as('sales@voltaxis-demo.test');
select pg_temp.expect_error(format($q$select public.cancel_sales_invoice(%L, 'test')$q$,
  (select id from public.sales_invoices where invoice_number = 'INV/2026-27/0009' or (status = 'posted' and amount_paid = 0) order by invoice_date desc limit 1)),
  'only admin or accounts');
select pg_temp.act_as('accounts@voltaxis-demo.test');
insert into t_ctx select 'cancel_inv', id from public.sales_invoices
  where status = 'posted' and amount_paid = 0 order by invoice_date desc limit 1;
insert into t_ctx select 'cancel_sku_qty', (select sum(l.quantity) from public.sales_lines l
  where l.invoice_id = (select v::uuid from t_ctx where k = 'cancel_inv'));
insert into t_ctx select 'total_before', (select sum(quantity) from public.v_product_stock);
select public.cancel_sales_invoice((select v::uuid from t_ctx where k = 'cancel_inv'), 'Customer returned unopened');
do $$ begin
  if (select sum(quantity) from public.v_product_stock) <>
     (select v::numeric from t_ctx where k = 'total_before') + (select v::numeric from t_ctx where k = 'cancel_sku_qty') then
    raise exception 'Cancellation did not restore stock';
  end if;
end $$;
select pg_temp.expect_error(format($q$select public.cancel_sales_invoice(%L, 'again')$q$,
  (select id from public.sales_invoices where status = 'posted' and amount_paid > 0 limit 1)), 'payments allocated');

do $$ begin raise notice '11. Ledger and balances reconcile; dashboard reflects transactions'; end $$;
do $$ begin
  if exists (select 1 from public.v_stock_reconciliation where difference <> 0) then
    raise exception 'Stock balances do not reconcile with the ledger';
  end if;
  if (public.dashboard_metrics() ->> 'sales_today')::numeric < 19293 then
    raise exception 'Dashboard sales_today does not include the new invoice';
  end if;
end $$;

do $$ begin raise notice '12. Admin-only settings and audit trail'; end $$;
select pg_temp.expect_error($q$insert into public.gst_rates (company_id, code, description, rate, effective_from)
  values ((select id from public.companies limit 1), 'GST40', 'x', 40, current_date)$q$, 'row-level security');
do $$ begin
  if (select count(*) from public.audit_logs) <> 0 then
    raise exception 'Non-admin can read audit logs';
  end if;
end $$;
select pg_temp.act_as('admin@voltaxis-demo.test');
do $$ begin
  if (select count(*) from public.audit_logs where action in ('post', 'cancel', 'record', 'complete')) = 0 then
    raise exception 'Critical operations were not audited';
  end if;
end $$;

do $$ begin raise notice 'ALL ACCEPTANCE CHECKS PASSED'; end $$;
rollback;
