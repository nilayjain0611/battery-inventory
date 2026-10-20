-- =====================================================================
-- Battery ERP — posting functions
--
-- Every function that changes stock or financial documents lives here.
-- Each public function:
--   1. checks the caller's role (private.require_role) before anything else,
--   2. recalculates all values on the server (client totals are ignored),
--   3. runs in a single transaction (a PostgreSQL function call is atomic:
--      any exception rolls back every change it made),
--   4. is idempotent via an idempotency key or a status check,
--   5. writes an audit record.
--
-- They are SECURITY DEFINER because members have no direct write access to
-- these tables. Ownership: the migration role. search_path is pinned to ''
-- and every object is schema-qualified.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Small helpers
-- ---------------------------------------------------------------------
create function private.company_today(p_company uuid) returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone c.timezone)::date from public.companies c where c.id = p_company
$$;

-- Indian fiscal year (April–March), e.g. 2026-10-20 -> '2026-27'.
create function private.fiscal_year(d date) returns text
language sql immutable set search_path = '' as $$
  select case when extract(month from d) >= 4
    then extract(year from d)::int::text || '-' || lpad(((extract(year from d)::int + 1) % 100)::text, 2, '0')
    else (extract(year from d)::int - 1)::text || '-' || lpad((extract(year from d)::int % 100)::text, 2, '0')
  end
$$;

-- Gap-free per company/type/fiscal year: the sequence row is locked by the
-- UPDATE until the surrounding transaction commits or rolls back.
create function private.next_document_number(p_company uuid, p_doc_type text, p_date date) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_fy text := private.fiscal_year(p_date);
  v_prefix text;
  v_n integer;
  v_pad smallint;
begin
  insert into public.document_sequences (company_id, doc_type, prefix, fiscal_year)
  values (p_company, p_doc_type,
          case p_doc_type
            when 'sales_invoice' then 'INV' when 'purchase' then 'PUR'
            when 'production_order' then 'PRD' when 'payment_receipt' then 'RCT'
            when 'payment_made' then 'PAY' else 'ADJ' end,
          v_fy)
  on conflict (company_id, doc_type, fiscal_year) do nothing;

  update public.document_sequences s
     set next_number = s.next_number + 1, updated_at = now()
   where s.company_id = p_company and s.doc_type = p_doc_type and s.fiscal_year = v_fy
  returning s.prefix, s.next_number - 1, s.padding into v_prefix, v_n, v_pad;

  return v_prefix || '/' || v_fy || '/' || lpad(v_n::text, v_pad, '0');
end;
$$;

-- Rate version effective on a date.
create function private.gst_rate_for(p_company uuid, p_code text, p_date date) returns numeric
language plpgsql stable security definer set search_path = '' as $$
declare
  v_rate numeric;
begin
  select r.rate into v_rate
  from public.gst_rates r
  where r.company_id = p_company and r.code = p_code and r.effective_from <= p_date
  order by r.effective_from desc
  limit 1;
  if v_rate is null then
    raise exception 'No GST rate "%" is configured for %', p_code, p_date;
  end if;
  return v_rate;
end;
$$;

create function private.default_location(p_company uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select l.id from public.locations l where l.company_id = p_company and l.is_default
$$;

-- ---------------------------------------------------------------------
-- Tax engine for one line. Mirrors src/lib/domain/tax.ts.
--   Exclusive prices: taxable = gross - discount; tax added on top.
--   Inclusive prices: taxable is extracted from (gross - discount), so the
--   line total equals the shelf price the customer saw.
--   Intra-state: CGST + SGST (half each). Inter-state: IGST.
-- Amounts round half away from zero to 2 decimals.
-- ---------------------------------------------------------------------
create function private.calc_line(
  p_quantity numeric,
  p_unit_price numeric,
  p_discount_type public.discount_type,
  p_discount_value numeric,
  p_rate numeric,
  p_prices_include_tax boolean,
  p_supply_type public.supply_type,
  out gross_amount numeric,
  out discount_amount numeric,
  out taxable_value numeric,
  out cgst_amount numeric,
  out sgst_amount numeric,
  out igst_amount numeric,
  out line_total numeric
)
language plpgsql immutable set search_path = '' as $$
declare
  v_net numeric;
  v_tax numeric;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;
  if p_unit_price is null or p_unit_price < 0 then
    raise exception 'Price cannot be negative';
  end if;
  if coalesce(p_discount_value, 0) < 0 then
    raise exception 'Discount cannot be negative';
  end if;

  gross_amount := round(p_quantity * p_unit_price, 2);
  discount_amount := case
    when p_discount_type = 'percent' then
      case when p_discount_value > 100 then null else round(gross_amount * p_discount_value / 100, 2) end
    when p_discount_type = 'amount' then round(coalesce(p_discount_value, 0), 2)
    else 0 end;
  if discount_amount is null then
    raise exception 'Discount percentage cannot exceed 100';
  end if;
  if discount_amount > gross_amount then
    raise exception 'Discount (%) exceeds the line value (%)', discount_amount, gross_amount;
  end if;

  v_net := gross_amount - discount_amount;

  if p_prices_include_tax then
    taxable_value := round(v_net * 100 / (100 + p_rate), 2);
    v_tax := v_net - taxable_value;
    if p_supply_type = 'intra_state' then
      cgst_amount := round(v_tax / 2, 2);
      sgst_amount := v_tax - cgst_amount;
      igst_amount := 0;
    else
      cgst_amount := 0; sgst_amount := 0; igst_amount := v_tax;
    end if;
    line_total := v_net;
  else
    taxable_value := v_net;
    if p_supply_type = 'intra_state' then
      cgst_amount := round(taxable_value * p_rate / 200, 2);
      sgst_amount := cgst_amount;
      igst_amount := 0;
    else
      cgst_amount := 0; sgst_amount := 0;
      igst_amount := round(taxable_value * p_rate / 100, 2);
    end if;
    line_total := taxable_value + cgst_amount + sgst_amount + igst_amount;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Ledger writer: the ONLY code path that changes stock.
-- Inserts the movement and updates the balance projection under a row
-- lock, maintaining weighted-average cost. Rejects negative stock.
-- Returns the unit cost recorded on the movement.
-- ---------------------------------------------------------------------
create function private.apply_movement(
  p_company uuid,
  p_product uuid,
  p_type public.movement_type,
  p_quantity numeric,
  p_unit_cost numeric,
  p_date date,
  p_source_type text,
  p_source_id uuid,
  p_source_line_id uuid,
  p_reference text,
  p_note text
) returns numeric
language plpgsql security definer set search_path = '' as $$
declare
  v_location uuid := private.default_location(p_company);
  v_bal public.stock_balances%rowtype;
  v_cost numeric;
  v_new_qty numeric;
  v_sku text;
begin
  if p_quantity = 0 then
    raise exception 'Stock movement quantity cannot be zero';
  end if;

  insert into public.stock_balances (company_id, product_id, location_id, quantity, avg_cost)
  values (p_company, p_product, v_location, 0, 0)
  on conflict (product_id, location_id) do nothing;

  select * into v_bal from public.stock_balances
  where product_id = p_product and location_id = v_location
  for update;

  v_new_qty := v_bal.quantity + p_quantity;

  if v_new_qty < 0 then
    select sku into v_sku from public.products where id = p_product;
    raise exception 'Insufficient stock for %: available %, required %',
      v_sku, trim(to_char(v_bal.quantity, 'FM999999990.###')), trim(to_char(-p_quantity, 'FM999999990.###'))
      using errcode = 'P0001', hint = 'insufficient_stock';
  end if;

  if p_quantity > 0 and p_unit_cost is not null then
    v_cost := p_unit_cost;
    update public.stock_balances
       set quantity = v_new_qty,
           avg_cost = case when v_bal.quantity <= 0 then p_unit_cost
                           else round((v_bal.quantity * v_bal.avg_cost + p_quantity * p_unit_cost) / v_new_qty, 4) end,
           updated_at = now()
     where product_id = p_product and location_id = v_location;
  else
    v_cost := v_bal.avg_cost;
    update public.stock_balances
       set quantity = v_new_qty, updated_at = now()
     where product_id = p_product and location_id = v_location;
  end if;

  insert into public.stock_movements (
    company_id, product_id, location_id, movement_type, quantity, unit_cost, movement_date,
    source_type, source_id, source_line_id, reference, note, created_by
  ) values (
    p_company, p_product, v_location, p_type, p_quantity, round(v_cost, 4), p_date,
    p_source_type, p_source_id, p_source_line_id, p_reference, p_note, auth.uid()
  );

  return round(v_cost, 4);
end;
$$;

-- Shared validation for document dates.
create function private.check_document_date(p_company uuid, p_date date, p_label text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_date is null then
    raise exception '% date is required', p_label;
  end if;
  if p_date > private.company_today(p_company) then
    raise exception '% date cannot be in the future', p_label;
  end if;
  if p_date < private.company_today(p_company) - 730 then
    raise exception '% date is more than two years in the past', p_label;
  end if;
end;
$$;

-- =====================================================================
-- PURCHASES (goods received against a supplier bill)
-- =====================================================================
create function public.create_purchase(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_company uuid := private.require_role('{admin,inventory,accounts}');
  v_key uuid := (p ->> 'idempotency_key')::uuid;
  v_existing public.purchases%rowtype;
  v_supplier public.suppliers%rowtype;
  v_company_state char(2);
  v_date date := (p ->> 'purchase_date')::date;
  v_supply public.supply_type;
  v_on_credit boolean := coalesce((p ->> 'on_credit')::boolean, true);
  v_id uuid := gen_random_uuid();
  v_number text;
  v_line jsonb;
  v_product public.products%rowtype;
  v_calc record;
  v_rate numeric;
  v_line_no int := 0;
  v_lines jsonb := '[]'::jsonb;
  v_subtotal numeric := 0; v_cgst numeric := 0; v_sgst numeric := 0; v_igst numeric := 0; v_total numeric := 0;
  v_line_id uuid;
  v_payment_id uuid;
begin
  if v_key is null then
    raise exception 'Missing idempotency key';
  end if;
  select * into v_existing from public.purchases where company_id = v_company and idempotency_key = v_key;
  if found then
    return jsonb_build_object('id', v_existing.id, 'number', v_existing.purchase_number, 'duplicate', true);
  end if;

  select * into v_supplier from public.suppliers
  where id = (p ->> 'supplier_id')::uuid and company_id = v_company;
  if not found then
    raise exception 'Supplier not found';
  end if;
  if not v_supplier.is_active then
    raise exception 'Supplier % is inactive', v_supplier.name;
  end if;
  perform private.check_document_date(v_company, v_date, 'Purchase');

  select state_code into v_company_state from public.companies where id = v_company;
  v_supply := case when v_supplier.state_code = v_company_state then 'intra_state' else 'inter_state' end;

  if jsonb_typeof(p -> 'lines') is distinct from 'array' or jsonb_array_length(p -> 'lines') = 0 then
    raise exception 'Add at least one product line';
  end if;
  if jsonb_array_length(p -> 'lines') > 100 then
    raise exception 'A purchase can have at most 100 lines';
  end if;
  if (select count(distinct l ->> 'product_id') from jsonb_array_elements(p -> 'lines') l)
     <> jsonb_array_length(p -> 'lines') then
    raise exception 'Each product can appear only once; combine the quantities into one line';
  end if;

  -- Compute every line first (no writes yet).
  for v_line in select * from jsonb_array_elements(p -> 'lines') loop
    select * into v_product from public.products
    where id = (v_line ->> 'product_id')::uuid and company_id = v_company;
    if not found then
      raise exception 'Product not found';
    end if;
    if not v_product.is_active then
      raise exception 'Product % is inactive', v_product.sku;
    end if;
    v_rate := private.gst_rate_for(v_company, v_product.gst_rate_code, v_date);
    select * into v_calc from private.calc_line(
      (v_line ->> 'quantity')::numeric, (v_line ->> 'unit_price')::numeric,
      'amount', coalesce((v_line ->> 'discount_amount')::numeric, 0),
      v_rate, false, v_supply);
    v_line_no := v_line_no + 1;
    v_lines := v_lines || jsonb_build_object(
      'line_no', v_line_no, 'product_id', v_product.id, 'product_name', v_product.name,
      'sku', v_product.sku, 'hsn_code', v_product.hsn_code, 'uom', v_product.uom,
      'quantity', (v_line ->> 'quantity')::numeric, 'unit_price', (v_line ->> 'unit_price')::numeric,
      'discount_amount', v_calc.discount_amount, 'taxable_value', v_calc.taxable_value, 'gst_rate', v_rate,
      'cgst', v_calc.cgst_amount, 'sgst', v_calc.sgst_amount, 'igst', v_calc.igst_amount,
      'line_total', v_calc.line_total);
    v_subtotal := v_subtotal + v_calc.taxable_value;
    v_cgst := v_cgst + v_calc.cgst_amount;
    v_sgst := v_sgst + v_calc.sgst_amount;
    v_igst := v_igst + v_calc.igst_amount;
    v_total := v_total + v_calc.line_total;
  end loop;

  v_number := private.next_document_number(v_company, 'purchase', v_date);

  insert into public.purchases (
    id, company_id, purchase_number, status, supplier_id, supplier_invoice_number, purchase_date,
    supply_type, on_credit, subtotal, cgst_total, sgst_total, igst_total, tax_total, round_off,
    grand_total, amount_paid, notes, idempotency_key, created_by
  ) values (
    v_id, v_company, v_number, 'posted', v_supplier.id, nullif(trim(p ->> 'supplier_invoice_number'), ''), v_date,
    v_supply, v_on_credit, v_subtotal, v_cgst, v_sgst, v_igst, v_cgst + v_sgst + v_igst, 0,
    v_total, 0, nullif(trim(p ->> 'notes'), ''), v_key, auth.uid()
  );

  -- Lines and stock, in product order so concurrent postings lock rows consistently.
  for v_line in select * from jsonb_array_elements(v_lines) e order by e ->> 'product_id' loop
    v_line_id := gen_random_uuid();
    insert into public.purchase_lines (
      id, company_id, purchase_id, line_no, product_id, product_name, sku, hsn_code, uom, quantity,
      unit_price, discount_amount, taxable_value, gst_rate, cgst_amount, sgst_amount, igst_amount, line_total
    ) values (
      v_line_id, v_company, v_id, (v_line ->> 'line_no')::int, (v_line ->> 'product_id')::uuid,
      v_line ->> 'product_name', v_line ->> 'sku', v_line ->> 'hsn_code', v_line ->> 'uom',
      (v_line ->> 'quantity')::numeric, (v_line ->> 'unit_price')::numeric, (v_line ->> 'discount_amount')::numeric,
      (v_line ->> 'taxable_value')::numeric, (v_line ->> 'gst_rate')::numeric, (v_line ->> 'cgst')::numeric,
      (v_line ->> 'sgst')::numeric, (v_line ->> 'igst')::numeric, (v_line ->> 'line_total')::numeric
    );
    -- Stock is valued at the taxable (net) cost; GST paid is input credit.
    perform private.apply_movement(
      v_company, (v_line ->> 'product_id')::uuid, 'purchase_receipt', (v_line ->> 'quantity')::numeric,
      round((v_line ->> 'taxable_value')::numeric / (v_line ->> 'quantity')::numeric, 4),
      v_date, 'purchase', v_id, v_line_id, v_number, null);
  end loop;

  -- Paid on the spot: record the outgoing payment against this bill.
  if not v_on_credit then
    v_payment_id := gen_random_uuid();
    insert into public.payments (id, company_id, payment_number, direction, supplier_id, payment_date,
                                 method, reference, amount, notes, idempotency_key, created_by)
    values (v_payment_id, v_company, private.next_document_number(v_company, 'payment_made', v_date), 'payment',
            v_supplier.id, v_date, coalesce((p ->> 'payment_method')::public.payment_method, 'cash'),
            nullif(trim(p ->> 'payment_reference'), ''), v_total, 'Paid at purchase ' || v_number,
            gen_random_uuid(), auth.uid());
    insert into public.payment_allocations (company_id, payment_id, purchase_id, amount)
    values (v_company, v_payment_id, v_id, v_total);
    update public.purchases set amount_paid = v_total where id = v_id;
  end if;

  perform private.write_audit(v_company, 'post', 'purchase', v_id,
    jsonb_build_object('number', v_number, 'grand_total', v_total, 'lines', jsonb_array_length(v_lines)));

  return jsonb_build_object('id', v_id, 'number', v_number, 'duplicate', false);
end;
$$;

create function public.cancel_purchase(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_company uuid := private.require_role('{admin,accounts}');
  v_purchase public.purchases%rowtype;
  v_line public.purchase_lines%rowtype;
begin
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Give a reason for the cancellation';
  end if;
  select * into v_purchase from public.purchases where id = p_id and company_id = v_company for update;
  if not found then
    raise exception 'Purchase not found';
  end if;
  if v_purchase.status = 'cancelled' then
    return jsonb_build_object('id', p_id, 'number', v_purchase.purchase_number, 'duplicate', true);
  end if;
  if v_purchase.amount_paid > 0 then
    raise exception 'Purchase % has payments recorded against it and cannot be cancelled', v_purchase.purchase_number;
  end if;

  for v_line in select * from public.purchase_lines where purchase_id = p_id order by product_id loop
    perform private.apply_movement(
      v_company, v_line.product_id, 'purchase_cancellation', -v_line.quantity, null,
      private.company_today(v_company), 'purchase', p_id, v_line.id, v_purchase.purchase_number,
      'Cancellation: ' || trim(p_reason));
  end loop;

  update public.purchases
     set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = trim(p_reason)
   where id = p_id;

  perform private.write_audit(v_company, 'cancel', 'purchase', p_id,
    jsonb_build_object('number', v_purchase.purchase_number, 'reason', trim(p_reason)));
  return jsonb_build_object('id', p_id, 'number', v_purchase.purchase_number, 'duplicate', false);
end;
$$;

-- =====================================================================
-- SALES INVOICES
-- =====================================================================

-- Writes header fields and lines of a DRAFT invoice from a payload.
-- All values are recomputed here; nothing monetary is taken from the client.
create function private.write_invoice_draft(p_company uuid, p_id uuid, p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_customer public.customers%rowtype;
  v_company public.companies%rowtype;
  v_date date := (p ->> 'invoice_date')::date;
  v_pos char(2);
  v_supply public.supply_type;
  v_inclusive boolean;
  v_sale_type public.customer_type;
  v_line jsonb;
  v_product public.products%rowtype;
  v_rate numeric;
  v_calc record;
  v_line_no int := 0;
  v_subtotal numeric := 0; v_disc numeric := 0;
  v_cgst numeric := 0; v_sgst numeric := 0; v_igst numeric := 0; v_total numeric := 0;
  v_grand numeric;
  v_due date;
begin
  select * into v_company from public.companies where id = p_company;
  select * into v_customer from public.customers
  where id = (p ->> 'customer_id')::uuid and company_id = p_company;
  if not found then
    raise exception 'Customer not found';
  end if;
  if not v_customer.is_active then
    raise exception 'Customer % is inactive', v_customer.name;
  end if;
  perform private.check_document_date(p_company, v_date, 'Invoice');

  v_sale_type := coalesce((p ->> 'sale_type')::public.customer_type, v_customer.customer_type);
  if v_customer.is_walk_in and v_sale_type = 'wholesale' then
    raise exception 'Wholesale invoices need a registered customer, not the walk-in account';
  end if;

  -- Place of supply: walk-in (unregistered, over the counter) = seller's state.
  v_pos := case when v_customer.is_walk_in then v_company.state_code
                else coalesce(nullif(p ->> 'place_of_supply', ''), v_customer.state_code) end;
  if not exists (select 1 from public.gst_states s where s.code = v_pos) then
    raise exception 'Unknown place of supply %', v_pos;
  end if;
  v_supply := case when v_pos = v_company.state_code then 'intra_state' else 'inter_state' end;
  v_inclusive := coalesce((p ->> 'prices_include_tax')::boolean, v_sale_type = 'retail');

  if jsonb_typeof(p -> 'lines') is distinct from 'array' or jsonb_array_length(p -> 'lines') = 0 then
    raise exception 'Add at least one product line';
  end if;
  if jsonb_array_length(p -> 'lines') > 100 then
    raise exception 'An invoice can have at most 100 lines';
  end if;
  if (select count(distinct l ->> 'product_id') from jsonb_array_elements(p -> 'lines') l)
     <> jsonb_array_length(p -> 'lines') then
    raise exception 'Each product can appear only once; combine the quantities into one line';
  end if;

  delete from public.sales_lines where invoice_id = p_id;

  for v_line in select * from jsonb_array_elements(p -> 'lines') loop
    select * into v_product from public.products
    where id = (v_line ->> 'product_id')::uuid and company_id = p_company;
    if not found then
      raise exception 'Product not found';
    end if;
    if not v_product.is_active then
      raise exception 'Product % is inactive', v_product.sku;
    end if;
    if v_product.stock_type = 'raw_material' then
      raise exception '% is a raw material and cannot be invoiced', v_product.sku;
    end if;
    v_rate := private.gst_rate_for(p_company, v_product.gst_rate_code, v_date);
    select * into v_calc from private.calc_line(
      (v_line ->> 'quantity')::numeric, (v_line ->> 'unit_price')::numeric,
      nullif(v_line ->> 'discount_type', '')::public.discount_type,
      coalesce((v_line ->> 'discount_value')::numeric, 0),
      v_rate, v_inclusive, v_supply);
    v_line_no := v_line_no + 1;
    insert into public.sales_lines (
      company_id, invoice_id, line_no, product_id, product_name, sku, hsn_code, uom, stock_type,
      quantity, unit_price, discount_type, discount_value, gross_amount, discount_amount, taxable_value,
      gst_rate, cgst_amount, sgst_amount, igst_amount, line_total
    ) values (
      p_company, p_id, v_line_no, v_product.id, v_product.name, v_product.sku, v_product.hsn_code,
      v_product.uom, v_product.stock_type, (v_line ->> 'quantity')::numeric, (v_line ->> 'unit_price')::numeric,
      nullif(v_line ->> 'discount_type', '')::public.discount_type, coalesce((v_line ->> 'discount_value')::numeric, 0),
      v_calc.gross_amount, v_calc.discount_amount, v_calc.taxable_value, v_rate,
      v_calc.cgst_amount, v_calc.sgst_amount, v_calc.igst_amount, v_calc.line_total
    );
    v_subtotal := v_subtotal + v_calc.taxable_value;
    v_disc := v_disc + v_calc.discount_amount;
    v_cgst := v_cgst + v_calc.cgst_amount;
    v_sgst := v_sgst + v_calc.sgst_amount;
    v_igst := v_igst + v_calc.igst_amount;
    v_total := v_total + v_calc.line_total;
  end loop;

  v_grand := round(v_total, 0);
  v_due := coalesce((p ->> 'due_date')::date, v_date + v_customer.credit_days);
  if v_due < v_date then
    raise exception 'Due date cannot be before the invoice date';
  end if;

  update public.sales_invoices set
    sale_type = v_sale_type,
    customer_id = v_customer.id,
    customer_name = v_customer.name,
    customer_gstin = v_customer.gstin,
    customer_phone = v_customer.phone,
    billing_address = coalesce(nullif(trim(p ->> 'billing_address'), ''), v_customer.billing_address),
    shipping_address = coalesce(nullif(trim(p ->> 'shipping_address'), ''), v_customer.shipping_address, v_customer.billing_address),
    invoice_date = v_date,
    due_date = v_due,
    place_of_supply = v_pos,
    supply_type = v_supply,
    prices_include_tax = v_inclusive,
    payment_terms = nullif(trim(p ->> 'payment_terms'), ''),
    notes = nullif(trim(p ->> 'notes'), ''),
    subtotal = v_subtotal,
    discount_total = v_disc,
    cgst_total = v_cgst,
    sgst_total = v_sgst,
    igst_total = v_igst,
    tax_total = v_cgst + v_sgst + v_igst,
    round_off = v_grand - v_total,
    grand_total = v_grand
  where id = p_id;
end;
$$;

-- Posts a draft: re-derives every line from current tax config, consumes
-- stock under row locks, allocates the number, freezes the snapshot.
create function private.post_invoice(p_company uuid, p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.sales_invoices%rowtype;
  v_line public.sales_lines%rowtype;
  v_number text;
  v_cost numeric;
  v_seller jsonb;
begin
  select * into v_inv from public.sales_invoices where id = p_id and company_id = p_company for update;
  if not found then
    raise exception 'Invoice not found';
  end if;
  if v_inv.status = 'posted' then
    return jsonb_build_object('id', v_inv.id, 'number', v_inv.invoice_number, 'status', 'posted', 'duplicate', true);
  end if;
  if v_inv.status = 'cancelled' then
    raise exception 'A cancelled invoice cannot be posted';
  end if;
  perform private.check_document_date(p_company, v_inv.invoice_date, 'Invoice');

  -- Recompute from stored inputs so posting never trusts earlier figures.
  perform private.write_invoice_draft(p_company, p_id, jsonb_build_object(
    'customer_id', v_inv.customer_id, 'sale_type', v_inv.sale_type, 'invoice_date', v_inv.invoice_date,
    'due_date', v_inv.due_date, 'place_of_supply', v_inv.place_of_supply,
    'prices_include_tax', v_inv.prices_include_tax, 'payment_terms', v_inv.payment_terms,
    'notes', v_inv.notes, 'billing_address', v_inv.billing_address, 'shipping_address', v_inv.shipping_address,
    'lines', (select jsonb_agg(jsonb_build_object(
                'product_id', l.product_id, 'quantity', l.quantity, 'unit_price', l.unit_price,
                'discount_type', l.discount_type, 'discount_value', l.discount_value) order by l.line_no)
              from public.sales_lines l where l.invoice_id = p_id)));

  v_number := private.next_document_number(p_company, 'sales_invoice', v_inv.invoice_date);

  -- Stock: lock balances in product order (consistent order avoids deadlocks).
  for v_line in select * from public.sales_lines where invoice_id = p_id order by product_id loop
    v_cost := private.apply_movement(
      p_company, v_line.product_id, 'sale', -v_line.quantity, null, v_inv.invoice_date,
      'sales_invoice', p_id, v_line.id, v_number, null);
    update public.sales_lines set unit_cost = v_cost where id = v_line.id;
  end loop;

  select jsonb_build_object(
    'name', c.name, 'legal_name', c.legal_name, 'gstin', c.gstin, 'state_code', c.state_code,
    'state_name', s.name, 'address_line1', c.address_line1, 'address_line2', c.address_line2,
    'city', c.city, 'pincode', c.pincode, 'phone', c.phone, 'email', c.email,
    'bank_name', c.bank_name, 'bank_account_number', c.bank_account_number, 'bank_ifsc', c.bank_ifsc,
    'invoice_terms', c.invoice_terms, 'invoice_footer', c.invoice_footer,
    'is_demo_configuration', c.is_demo_configuration,
    'gst_rates_sample', exists (select 1 from public.gst_rates r where r.company_id = c.id and r.is_sample))
  into v_seller
  from public.companies c join public.gst_states s on s.code = c.state_code
  where c.id = p_company;

  update public.sales_invoices
     set status = 'posted', invoice_number = v_number, posted_at = now(), posted_by = auth.uid(),
         seller_snapshot = v_seller
   where id = p_id;

  perform private.write_audit(p_company, 'post', 'sales_invoice', p_id,
    jsonb_build_object('number', v_number,
                       'grand_total', (select grand_total from public.sales_invoices where id = p_id)));

  return jsonb_build_object('id', p_id, 'number', v_number, 'status', 'posted', 'duplicate', false);
end;
$$;

create function public.create_sales_invoice(p jsonb, p_post boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_company uuid := private.require_role('{admin,sales,accounts}');
  v_key uuid := (p ->> 'idempotency_key')::uuid;
  v_existing public.sales_invoices%rowtype;
  v_id uuid := gen_random_uuid();
begin
  if v_key is null then
    raise exception 'Missing idempotency key';
  end if;
  select * into v_existing from public.sales_invoices where company_id = v_company and idempotency_key = v_key;
  if found then
    -- A retried "save & post" of a draft that was saved but not posted.
    if p_post and v_existing.status = 'draft' then
      return private.post_invoice(v_company, v_existing.id);
    end if;
    return jsonb_build_object('id', v_existing.id, 'number', v_existing.invoice_number,
                              'status', v_existing.status, 'duplicate', true);
  end if;

  insert into public.sales_invoices (
    id, company_id, status, sale_type, customer_id, customer_name, invoice_date, place_of_supply,
    supply_type, prices_include_tax, idempotency_key, created_by
  )
  select v_id, v_company, 'draft', c.customer_type, c.id, c.name, coalesce((p ->> 'invoice_date')::date, current_date),
         c.state_code, 'intra_state', true, v_key, auth.uid()
  from public.customers c
  where c.id = (p ->> 'customer_id')::uuid and c.company_id = v_company;
  if not found then
    raise exception 'Customer not found';
  end if;

  perform private.write_invoice_draft(v_company, v_id, p);

  if p_post then
    return private.post_invoice(v_company, v_id);
  end if;

  perform private.write_audit(v_company, 'create_draft', 'sales_invoice', v_id, '{}'::jsonb);
  return jsonb_build_object('id', v_id, 'number', null, 'status', 'draft', 'duplicate', false);
end;
$$;

create function public.update_sales_invoice_draft(p_id uuid, p jsonb, p_post boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_company uuid := private.require_role('{admin,sales,accounts}');
  v_status public.document_status;
begin
  select status into v_status from public.sales_invoices where id = p_id and company_id = v_company for update;
  if not found then
    raise exception 'Invoice not found';
  end if;
  if v_status <> 'draft' then
    raise exception 'Only draft invoices can be edited';
  end if;
  perform private.write_invoice_draft(v_company, p_id, p);
  if p_post then
    return private.post_invoice(v_company, p_id);
  end if;
  return jsonb_build_object('id', p_id, 'number', null, 'status', 'draft', 'duplicate', false);
end;
$$;

create function public.post_sales_invoice(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_company uuid := private.require_role('{admin,sales,accounts}');
begin
  return private.post_invoice(v_company, p_id);
end;
$$;

-- Cancels a draft, or reverses a posted invoice that has no payments.
create function public.cancel_sales_invoice(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_company uuid := private.require_role('{admin,accounts,sales}');
  v_inv public.sales_invoices%rowtype;
  v_line public.sales_lines%rowtype;
begin
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Give a reason for the cancellation';
  end if;
  select * into v_inv from public.sales_invoices where id = p_id and company_id = v_company for update;
  if not found then
    raise exception 'Invoice not found';
  end if;
  if v_inv.status = 'cancelled' then
    return jsonb_build_object('id', p_id, 'number', v_inv.invoice_number, 'status', 'cancelled', 'duplicate', true);
  end if;
  -- Sales users may discard their drafts; reversing a posted invoice needs accounts/admin.
  if v_inv.status = 'posted' and not private.has_role('{admin,accounts}') then
    raise exception 'Only admin or accounts users can cancel a posted invoice' using errcode = '42501';
  end if;
  if v_inv.status = 'posted' and v_inv.amount_paid > 0 then
    raise exception 'Invoice % has payments allocated and cannot be cancelled', v_inv.invoice_number;
  end if;

  if v_inv.status = 'posted' then
    for v_line in select * from public.sales_lines where invoice_id = p_id order by product_id loop
      perform private.apply_movement(
        v_company, v_line.product_id, 'sale_cancellation', v_line.quantity, v_line.unit_cost,
        private.company_today(v_company), 'sales_invoice', p_id, v_line.id, v_inv.invoice_number,
        'Cancellation: ' || trim(p_reason));
    end loop;
  end if;

  update public.sales_invoices
     set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = trim(p_reason)
   where id = p_id;

  perform private.write_audit(v_company, 'cancel', 'sales_invoice', p_id,
    jsonb_build_object('number', v_inv.invoice_number, 'was', v_inv.status, 'reason', trim(p_reason)));
  return jsonb_build_object('id', p_id, 'number', v_inv.invoice_number, 'status', 'cancelled', 'duplicate', false);
end;
$$;

-- =====================================================================
-- MANUFACTURING
-- =====================================================================
create function public.create_production_order(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_company uuid := private.require_role('{admin,production}');
  v_key uuid := (p ->> 'idempotency_key')::uuid;
  v_existing public.production_orders%rowtype;
  v_bom public.boms%rowtype;
  v_product public.products%rowtype;
  v_planned numeric := (p ->> 'planned_quantity')::numeric;
  v_date date := (p ->> 'production_date')::date;
  v_id uuid := gen_random_uuid();
  v_number text;
begin
  if v_key is null then
    raise exception 'Missing idempotency key';
  end if;
  select * into v_existing from public.production_orders where company_id = v_company and idempotency_key = v_key;
  if found then
    return jsonb_build_object('id', v_existing.id, 'number', v_existing.order_number, 'duplicate', true);
  end if;
  if v_planned is null or v_planned <= 0 then
    raise exception 'Planned quantity must be greater than zero';
  end if;
  perform private.check_document_date(v_company, v_date, 'Production');

  select * into v_bom from public.boms where id = (p ->> 'bom_id')::uuid and company_id = v_company;
  if not found or not v_bom.is_active then
    raise exception 'Active bill of materials not found';
  end if;
  select * into v_product from public.products where id = v_bom.product_id;
  if v_product.stock_type <> 'manufactured' then
    raise exception 'Only own-brand manufactured products can be produced';
  end if;
  if not exists (select 1 from public.bom_lines where bom_id = v_bom.id) then
    raise exception 'The bill of materials has no components';
  end if;

  v_number := private.next_document_number(v_company, 'production_order', v_date);
  insert into public.production_orders (
    id, company_id, order_number, status, product_id, bom_id, planned_quantity, production_date,
    notes, idempotency_key, created_by
  ) values (
    v_id, v_company, v_number, 'draft', v_product.id, v_bom.id, v_planned, v_date,
    nullif(trim(p ->> 'notes'), ''), v_key, auth.uid()
  );
  insert into public.production_materials (company_id, production_order_id, product_id, expected_quantity, actual_quantity)
  select v_company, v_id, bl.component_product_id,
         round(bl.quantity * v_planned / v_bom.output_quantity, 3),
         round(bl.quantity * v_planned / v_bom.output_quantity, 3)
  from public.bom_lines bl where bl.bom_id = v_bom.id;

  perform private.write_audit(v_company, 'create', 'production_order', v_id, jsonb_build_object('number', v_number));
  return jsonb_build_object('id', v_id, 'number', v_number, 'duplicate', false);
end;
$$;

-- p: { produced_quantity, materials: [{product_id, actual_quantity}], wastage_notes }
create function public.complete_production_order(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_company uuid := private.require_role('{admin,production}');
  v_order public.production_orders%rowtype;
  v_produced numeric := (p ->> 'produced_quantity')::numeric;
  v_mat public.production_materials%rowtype;
  v_actual numeric;
  v_entry jsonb;
  v_cost numeric;
  v_total_cost numeric := 0;
  v_unit_cost numeric;
  v_overhead numeric;
begin
  select * into v_order from public.production_orders where id = p_id and company_id = v_company for update;
  if not found then
    raise exception 'Production order not found';
  end if;
  if v_order.status = 'completed' then
    raise exception 'Production order % is already completed', v_order.order_number;
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'Production order % is cancelled', v_order.order_number;
  end if;
  if v_produced is null or v_produced <= 0 then
    raise exception 'Produced quantity must be greater than zero';
  end if;
  if v_produced > v_order.planned_quantity * 2 then
    raise exception 'Produced quantity is more than double the plan; check the figure';
  end if;
  if jsonb_typeof(p -> 'materials') is distinct from 'array' then
    raise exception 'Material consumption is required';
  end if;
  -- Every submitted material must belong to this order.
  for v_entry in select * from jsonb_array_elements(p -> 'materials') loop
    if not exists (select 1 from public.production_materials m
                   where m.production_order_id = p_id and m.product_id = (v_entry ->> 'product_id')::uuid) then
      raise exception 'A submitted material is not part of this production order';
    end if;
    if (v_entry ->> 'actual_quantity')::numeric < 0 then
      raise exception 'Consumed quantity cannot be negative';
    end if;
  end loop;

  -- Consume components (product order for consistent locking).
  for v_mat in select * from public.production_materials where production_order_id = p_id order by product_id loop
    select (e ->> 'actual_quantity')::numeric into v_actual
    from jsonb_array_elements(p -> 'materials') e
    where (e ->> 'product_id')::uuid = v_mat.product_id;
    v_actual := coalesce(v_actual, v_mat.expected_quantity);
    if v_actual > 0 then
      v_cost := private.apply_movement(
        v_company, v_mat.product_id, 'production_consumption', -v_actual, null, v_order.production_date,
        'production_order', p_id, v_mat.id, v_order.order_number, null);
    else
      select coalesce(avg_cost, 0) into v_cost from public.stock_balances where product_id = v_mat.product_id;
      v_cost := coalesce(v_cost, 0);
    end if;
    update public.production_materials
       set actual_quantity = v_actual, unit_cost = v_cost, total_cost = round(v_actual * v_cost, 2)
     where id = v_mat.id;
    v_total_cost := v_total_cost + round(v_actual * v_cost, 2);
  end loop;

  v_unit_cost := round(v_total_cost / v_produced, 4);
  perform private.apply_movement(
    v_company, v_order.product_id, 'production_output', v_produced, v_unit_cost, v_order.production_date,
    'production_order', p_id, null, v_order.order_number, null);

  select overhead_per_unit_estimate into v_overhead from public.companies where id = v_company;

  update public.production_orders
     set status = 'completed', produced_quantity = v_produced, material_cost = v_total_cost,
         unit_material_cost = v_unit_cost, overhead_estimate_per_unit = v_overhead,
         wastage_notes = nullif(trim(p ->> 'wastage_notes'), ''),
         completed_at = now(), completed_by = auth.uid()
   where id = p_id;

  perform private.write_audit(v_company, 'complete', 'production_order', p_id,
    jsonb_build_object('number', v_order.order_number, 'produced', v_produced, 'material_cost', v_total_cost));
  return jsonb_build_object('id', p_id, 'number', v_order.order_number, 'material_cost', v_total_cost,
                            'unit_material_cost', v_unit_cost);
end;
$$;

create function public.cancel_production_order(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_company uuid := private.require_role('{admin,production}');
  v_order public.production_orders%rowtype;
begin
  select * into v_order from public.production_orders where id = p_id and company_id = v_company for update;
  if not found then
    raise exception 'Production order not found';
  end if;
  if v_order.status <> 'draft' then
    raise exception 'Only draft production orders can be cancelled';
  end if;
  update public.production_orders
     set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
         notes = concat_ws(E'\n', v_order.notes, 'Cancelled: ' || nullif(trim(p_reason), ''))
   where id = p_id;
  perform private.write_audit(v_company, 'cancel', 'production_order', p_id,
    jsonb_build_object('number', v_order.order_number, 'reason', p_reason));
  return jsonb_build_object('id', p_id, 'number', v_order.order_number);
end;
$$;

-- =====================================================================
-- PAYMENTS
-- p: { idempotency_key, direction: 'receipt'|'payment', customer_id | supplier_id,
--      payment_date, method, reference, notes,
--      allocations: [{ document_id, amount }] }   -- must sum to the amount
-- =====================================================================
create function public.record_payment(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_company uuid;
  v_key uuid := (p ->> 'idempotency_key')::uuid;
  v_direction public.payment_direction := (p ->> 'direction')::public.payment_direction;
  v_existing public.payments%rowtype;
  v_date date := (p ->> 'payment_date')::date;
  v_alloc jsonb;
  v_amount numeric;
  v_total numeric := 0;
  v_id uuid := gen_random_uuid();
  v_number text;
  v_inv public.sales_invoices%rowtype;
  v_pur public.purchases%rowtype;
  v_party uuid;
begin
  if v_direction = 'receipt' then
    v_company := private.require_role('{admin,accounts,sales}');
    if not private.can_record_receipts() then
      raise exception 'You do not have permission to record customer receipts' using errcode = '42501';
    end if;
    v_party := (p ->> 'customer_id')::uuid;
    if not exists (select 1 from public.customers where id = v_party and company_id = v_company) then
      raise exception 'Customer not found';
    end if;
  elsif v_direction = 'payment' then
    v_company := private.require_role('{admin,accounts}');
    v_party := (p ->> 'supplier_id')::uuid;
    if not exists (select 1 from public.suppliers where id = v_party and company_id = v_company) then
      raise exception 'Supplier not found';
    end if;
  else
    raise exception 'Unknown payment direction';
  end if;

  if v_key is null then
    raise exception 'Missing idempotency key';
  end if;
  select * into v_existing from public.payments where company_id = v_company and idempotency_key = v_key;
  if found then
    return jsonb_build_object('id', v_existing.id, 'number', v_existing.payment_number, 'duplicate', true);
  end if;

  perform private.check_document_date(v_company, v_date, 'Payment');
  if jsonb_typeof(p -> 'allocations') is distinct from 'array' or jsonb_array_length(p -> 'allocations') = 0 then
    raise exception 'Allocate the payment to at least one %', case when v_direction = 'receipt' then 'invoice' else 'purchase' end;
  end if;
  if (select count(distinct a ->> 'document_id') from jsonb_array_elements(p -> 'allocations') a)
     <> jsonb_array_length(p -> 'allocations') then
    raise exception 'Each document can be allocated only once per payment';
  end if;
  for v_alloc in select * from jsonb_array_elements(p -> 'allocations') loop
    v_amount := (v_alloc ->> 'amount')::numeric;
    if v_amount is null or v_amount <= 0 then
      raise exception 'Allocated amounts must be greater than zero';
    end if;
    if v_amount <> round(v_amount, 2) then
      raise exception 'Amounts can have at most two decimal places';
    end if;
    v_total := v_total + v_amount;
  end loop;
  if (p ->> 'amount') is not null and (p ->> 'amount')::numeric <> v_total then
    raise exception 'The payment amount (%) must equal the total allocated (%)', (p ->> 'amount')::numeric, v_total;
  end if;

  v_number := private.next_document_number(v_company,
    case when v_direction = 'receipt' then 'payment_receipt' else 'payment_made' end, v_date);
  insert into public.payments (id, company_id, payment_number, direction, customer_id, supplier_id, payment_date,
                               method, reference, amount, notes, idempotency_key, created_by)
  values (v_id, v_company, v_number, v_direction,
          case when v_direction = 'receipt' then v_party end,
          case when v_direction = 'payment' then v_party end,
          v_date, (p ->> 'method')::public.payment_method, nullif(trim(p ->> 'reference'), ''),
          v_total, nullif(trim(p ->> 'notes'), ''), v_key, auth.uid());

  -- Lock documents in id order; reject over-allocation.
  for v_alloc in select * from jsonb_array_elements(p -> 'allocations') a order by a ->> 'document_id' loop
    v_amount := (v_alloc ->> 'amount')::numeric;
    if v_direction = 'receipt' then
      select * into v_inv from public.sales_invoices
      where id = (v_alloc ->> 'document_id')::uuid and company_id = v_company for update;
      if not found then
        raise exception 'Invoice not found';
      end if;
      if v_inv.customer_id <> v_party then
        raise exception 'Invoice % belongs to a different customer', v_inv.invoice_number;
      end if;
      if v_inv.status <> 'posted' then
        raise exception 'Payments can only be allocated to posted invoices';
      end if;
      if v_amount > v_inv.grand_total - v_inv.amount_paid then
        raise exception 'Invoice % has only % outstanding', v_inv.invoice_number, v_inv.grand_total - v_inv.amount_paid;
      end if;
      insert into public.payment_allocations (company_id, payment_id, sales_invoice_id, amount)
      values (v_company, v_id, v_inv.id, v_amount);
      update public.sales_invoices set amount_paid = amount_paid + v_amount where id = v_inv.id;
    else
      select * into v_pur from public.purchases
      where id = (v_alloc ->> 'document_id')::uuid and company_id = v_company for update;
      if not found then
        raise exception 'Purchase not found';
      end if;
      if v_pur.supplier_id <> v_party then
        raise exception 'Purchase % belongs to a different supplier', v_pur.purchase_number;
      end if;
      if v_pur.status <> 'posted' then
        raise exception 'Payments can only be allocated to posted purchases';
      end if;
      if v_amount > v_pur.grand_total - v_pur.amount_paid then
        raise exception 'Purchase % has only % outstanding', v_pur.purchase_number, v_pur.grand_total - v_pur.amount_paid;
      end if;
      insert into public.payment_allocations (company_id, payment_id, purchase_id, amount)
      values (v_company, v_id, v_pur.id, v_amount);
      update public.purchases set amount_paid = amount_paid + v_amount where id = v_pur.id;
    end if;
  end loop;

  perform private.write_audit(v_company, 'record', 'payment', v_id,
    jsonb_build_object('number', v_number, 'direction', v_direction, 'amount', v_total));
  return jsonb_build_object('id', v_id, 'number', v_number, 'amount', v_total, 'duplicate', false);
end;
$$;

-- =====================================================================
-- STOCK ADJUSTMENTS AND OPENING STOCK
-- =====================================================================
-- p: { idempotency_key, product_id, quantity_delta, unit_cost?, reason, adjustment_date }
create function public.post_stock_adjustment(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_company uuid := private.require_role('{admin,inventory}');
  v_key uuid := (p ->> 'idempotency_key')::uuid;
  v_product public.products%rowtype;
  v_delta numeric := (p ->> 'quantity_delta')::numeric;
  v_reason text := trim(coalesce(p ->> 'reason', ''));
  v_date date := coalesce((p ->> 'adjustment_date')::date, private.company_today(v_company));
  v_number text;
  v_existing record;
begin
  if v_key is null then
    raise exception 'Missing idempotency key';
  end if;
  select reference, id into v_existing from public.stock_movements
  where company_id = v_company and source_type = 'stock_adjustment' and source_id = v_key limit 1;
  if found then
    return jsonb_build_object('number', v_existing.reference, 'duplicate', true);
  end if;
  if v_delta is null or v_delta = 0 then
    raise exception 'Adjustment quantity cannot be zero';
  end if;
  if length(v_reason) < 3 then
    raise exception 'A reason is required for every stock adjustment';
  end if;
  perform private.check_document_date(v_company, v_date, 'Adjustment');
  select * into v_product from public.products where id = (p ->> 'product_id')::uuid and company_id = v_company;
  if not found then
    raise exception 'Product not found';
  end if;

  v_number := private.next_document_number(v_company, 'stock_adjustment', v_date);
  perform private.apply_movement(
    v_company, v_product.id, 'stock_adjustment', v_delta,
    case when v_delta > 0 then (p ->> 'unit_cost')::numeric end,
    v_date, 'stock_adjustment', v_key, null, v_number, v_reason);

  perform private.write_audit(v_company, 'adjust', 'product', v_product.id,
    jsonb_build_object('number', v_number, 'sku', v_product.sku, 'delta', v_delta, 'reason', v_reason));
  return jsonb_build_object('number', v_number, 'duplicate', false);
end;
$$;

-- Opening stock may be recorded once, before any other movement.
create function public.record_opening_stock(p_product uuid, p_quantity numeric, p_unit_cost numeric, p_date date default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_company uuid := private.require_role('{admin,inventory}');
  v_product public.products%rowtype;
  v_date date := coalesce(p_date, private.company_today(v_company));
begin
  select * into v_product from public.products where id = p_product and company_id = v_company for update;
  if not found then
    raise exception 'Product not found';
  end if;
  if exists (select 1 from public.stock_movements where product_id = p_product) then
    raise exception 'Opening stock can only be recorded before any other movement; use a stock adjustment';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Opening quantity must be greater than zero';
  end if;
  if p_unit_cost is null or p_unit_cost < 0 then
    raise exception 'Opening unit cost is required';
  end if;
  perform private.apply_movement(v_company, p_product, 'opening_balance', p_quantity, p_unit_cost, v_date,
                                 'opening', p_product, null, 'OPENING', null);
  perform private.write_audit(v_company, 'opening_stock', 'product', p_product,
    jsonb_build_object('sku', v_product.sku, 'quantity', p_quantity, 'unit_cost', p_unit_cost));
  return jsonb_build_object('product_id', p_product, 'quantity', p_quantity);
end;
$$;

-- ---------------------------------------------------------------------
-- Function privileges: only signed-in users may call the public RPCs;
-- nobody outside the owner may call private helpers that write.
-- ---------------------------------------------------------------------
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.current_company_id() to authenticated;
grant execute on function private.current_app_role() to authenticated;
grant execute on function private.has_role(public.app_role[]) to authenticated;
grant execute on function private.is_valid_gstin(text) to authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'public.create_purchase(jsonb)', 'public.cancel_purchase(uuid, text)',
    'public.create_sales_invoice(jsonb, boolean)', 'public.update_sales_invoice_draft(uuid, jsonb, boolean)',
    'public.post_sales_invoice(uuid)', 'public.cancel_sales_invoice(uuid, text)',
    'public.create_production_order(jsonb)', 'public.complete_production_order(uuid, jsonb)',
    'public.cancel_production_order(uuid, text)', 'public.record_payment(jsonb)',
    'public.post_stock_adjustment(jsonb)', 'public.record_opening_stock(uuid, numeric, numeric, date)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
