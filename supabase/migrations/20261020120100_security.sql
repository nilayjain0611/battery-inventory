-- =====================================================================
-- Battery ERP — access control, immutability guards and auditing
--
-- Design:
--   * Every signed-in user belongs to exactly one company through
--     company_memberships, with one role.
--   * All members can READ their company's records (RLS).
--   * Master data (products, parties, settings) is written directly
--     under role-checked RLS policies.
--   * Stock, purchases, production, invoices and payments are written
--     ONLY through the posting functions in the next migration. Those are
--     SECURITY DEFINER, owned by the migration owner, pinned to an empty
--     search_path, and each one checks the caller's role first.
--   * Internal helpers live in the `private` schema, which the API does
--     not expose.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Caller context helpers
-- SECURITY DEFINER so RLS policies can read memberships without
-- recursing into the memberships table's own policy.
-- ---------------------------------------------------------------------
create function private.current_company_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.company_id
  from public.company_memberships m
  where m.user_id = auth.uid() and m.is_active
  order by m.created_at
  limit 1
$$;

create function private.current_app_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select m.role
  from public.company_memberships m
  where m.user_id = auth.uid() and m.is_active
  order by m.created_at
  limit 1
$$;

create function private.has_role(roles public.app_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.current_app_role() = any(roles), false)
$$;

-- Raises unless the caller is an active member with one of `roles`.
-- Returns the caller's company id.
create function private.require_role(roles public.app_role[]) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_company uuid;
  v_role public.app_role;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select m.company_id, m.role into v_company, v_role
  from public.company_memberships m
  where m.user_id = auth.uid() and m.is_active
  order by m.created_at
  limit 1;
  if v_company is null then
    raise exception 'Your account is not linked to a company' using errcode = '42501';
  end if;
  if not (v_role = any(roles)) then
    raise exception 'Your role (%) is not allowed to perform this action', v_role using errcode = '42501';
  end if;
  return v_company;
end;
$$;

-- Sales users may record receipts only when explicitly granted.
create function private.can_record_receipts() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select m.role in ('admin', 'accounts') or (m.role = 'sales' and m.can_record_receipts)
    from public.company_memberships m
    where m.user_id = auth.uid() and m.is_active
    order by m.created_at
    limit 1
  ), false)
$$;

grant usage on schema private to authenticated;
grant execute on function private.current_company_id() to authenticated;
grant execute on function private.current_app_role() to authenticated;
grant execute on function private.has_role(public.app_role[]) to authenticated;
grant execute on function private.is_valid_gstin(text) to authenticated;

-- ---------------------------------------------------------------------
-- Audit log writer (used by triggers and posting functions)
-- ---------------------------------------------------------------------
create function private.write_audit(
  p_company uuid, p_action text, p_entity_type text, p_entity_id uuid, p_details jsonb
) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_logs (company_id, actor_id, action, entity_type, entity_id, details)
  values (p_company, auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb))
$$;

-- Generic row-change audit for master data and settings.
create function private.audit_row_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_changes jsonb := '{}'::jsonb;
  k text;
begin
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(v_new) loop
      if k not in ('updated_at', 'search_text') and v_new -> k is distinct from v_old -> k then
        v_changes := v_changes || jsonb_build_object(k, jsonb_build_object('from', v_old -> k, 'to', v_new -> k));
      end if;
    end loop;
    if v_changes = '{}'::jsonb then
      return new;
    end if;
  end if;
  perform private.write_audit(
    coalesce((v_new ->> 'company_id')::uuid, (v_old ->> 'company_id')::uuid,
             case when tg_table_name = 'companies' then coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid) end),
    lower(tg_op),
    tg_table_name,
    coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid),
    case tg_op when 'UPDATE' then jsonb_build_object('changes', v_changes)
               when 'INSERT' then jsonb_build_object('values', v_new)
               else jsonb_build_object('values', v_old) end
  );
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['companies', 'products', 'customers', 'suppliers', 'gst_rates',
                           'company_memberships', 'document_sequences', 'boms', 'bom_lines',
                           'categories', 'brands'] loop
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$I
                    for each row execute function private.audit_row_change()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------
create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['companies', 'profiles', 'company_memberships', 'document_sequences',
                           'products', 'suppliers', 'customers', 'sales_invoices'] loop
    execute format('create trigger touch_%1$s before update on public.%1$I
                    for each row execute function private.touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Immutability guards. These apply to everyone, including the posting
-- functions, so a bug cannot silently rewrite history.
-- ---------------------------------------------------------------------
create function private.forbid_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception '% records are immutable; record a compensating entry instead', tg_table_name
    using errcode = '42501';
end;
$$;

create trigger stock_movements_immutable before update or delete on public.stock_movements
  for each row execute function private.forbid_change();
create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function private.forbid_change();
create trigger payments_immutable before update or delete on public.payments
  for each row execute function private.forbid_change();
create trigger payment_allocations_immutable before update or delete on public.payment_allocations
  for each row execute function private.forbid_change();
create trigger purchase_lines_immutable before update or delete on public.purchase_lines
  for each row execute function private.forbid_change();

-- Rates are versioned: add a new effective-dated row instead of editing.
create function private.guard_gst_rates() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE'
     or new.rate is distinct from old.rate
     or new.code is distinct from old.code
     or new.effective_from is distinct from old.effective_from
     or new.company_id is distinct from old.company_id then
    raise exception 'GST rate versions cannot be changed or deleted; add a new version with a later effective date'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger gst_rates_versioned before update or delete on public.gst_rates
  for each row execute function private.guard_gst_rates();

create function private.guard_sequence() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.next_number < old.next_number then
    raise exception 'Document numbers cannot be moved backwards' using errcode = '42501';
  end if;
  if new.doc_type is distinct from old.doc_type or new.fiscal_year is distinct from old.fiscal_year
     or new.company_id is distinct from old.company_id then
    raise exception 'Only prefix and padding can be edited on a document sequence' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger document_sequences_guard before update on public.document_sequences
  for each row execute function private.guard_sequence();

-- Posted/cancelled invoices: only payment progress and cancellation may change.
create function private.guard_sales_invoice() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_mutable text[] := array['amount_paid', 'status', 'cancelled_at', 'cancelled_by', 'cancel_reason', 'updated_at'];
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Posted invoices cannot be deleted; cancel them instead' using errcode = '42501';
    end if;
    return old;
  end if;
  if old.status = 'draft' then
    return new;
  end if;
  if old.status = 'cancelled' then
    raise exception 'Cancelled invoices cannot be changed' using errcode = '42501';
  end if;
  -- old.status = 'posted'
  if new.status not in ('posted', 'cancelled') then
    raise exception 'A posted invoice cannot return to draft' using errcode = '42501';
  end if;
  if (to_jsonb(new) - v_mutable) <> (to_jsonb(old) - v_mutable) then
    raise exception 'Posted invoices are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger sales_invoices_guard before update or delete on public.sales_invoices
  for each row execute function private.guard_sales_invoice();

create function private.guard_sales_line() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_status public.document_status;
begin
  select status into v_status from public.sales_invoices
  where id = coalesce(new.invoice_id, old.invoice_id);
  if v_status is distinct from 'draft' then
    raise exception 'Lines of a posted invoice cannot be changed' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger sales_lines_guard before insert or update or delete on public.sales_lines
  for each row execute function private.guard_sales_line();

create function private.guard_purchase() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_mutable text[] := array['amount_paid', 'status', 'cancelled_at', 'cancelled_by', 'cancel_reason'];
begin
  if tg_op = 'DELETE' then
    raise exception 'Purchases cannot be deleted; cancel them instead' using errcode = '42501';
  end if;
  if old.status = 'cancelled' then
    raise exception 'Cancelled purchases cannot be changed' using errcode = '42501';
  end if;
  if (to_jsonb(new) - v_mutable) <> (to_jsonb(old) - v_mutable) then
    raise exception 'Posted purchases are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger purchases_guard before update or delete on public.purchases
  for each row execute function private.guard_purchase();

create function private.guard_production_order() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Production orders cannot be deleted; cancel drafts instead' using errcode = '42501';
  end if;
  if old.status <> 'draft' then
    raise exception 'A % production order cannot be changed', old.status using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger production_orders_guard before update or delete on public.production_orders
  for each row execute function private.guard_production_order();

create function private.guard_production_material() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_status public.production_status;
begin
  select status into v_status from public.production_orders
  where id = coalesce(new.production_order_id, old.production_order_id);
  if v_status is distinct from 'draft' then
    raise exception 'Materials of a completed or cancelled production order cannot be changed' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger production_materials_guard before insert or update or delete on public.production_materials
  for each row execute function private.guard_production_material();

-- ---------------------------------------------------------------------
-- New auth users get a profile (company membership is assigned by an admin).
-- ---------------------------------------------------------------------
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'gst_states', 'companies', 'profiles', 'company_memberships', 'document_sequences', 'audit_logs',
    'gst_rates', 'categories', 'brands', 'locations', 'products', 'stock_movements', 'stock_balances',
    'suppliers', 'customers', 'purchases', 'purchase_lines', 'boms', 'bom_lines', 'production_orders',
    'production_materials', 'sales_invoices', 'sales_lines', 'payments', 'payment_allocations'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- Reference data
create policy gst_states_read on public.gst_states for select to authenticated using (true);

-- Company
create policy companies_read on public.companies for select to authenticated
  using (id = (select private.current_company_id()));
create policy companies_admin_update on public.companies for update to authenticated
  using (id = (select private.current_company_id()) and (select private.has_role('{admin}')))
  with check (id = (select private.current_company_id()));

-- Profiles: self, plus colleagues in the same company
create policy profiles_read on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.company_memberships m
      where m.user_id = profiles.id and m.company_id = (select private.current_company_id())
    )
  );
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy memberships_read on public.company_memberships for select to authenticated
  using (company_id = (select private.current_company_id()));
create policy memberships_admin_insert on public.company_memberships for insert to authenticated
  with check (company_id = (select private.current_company_id()) and (select private.has_role('{admin}')));
create policy memberships_admin_update on public.company_memberships for update to authenticated
  using (company_id = (select private.current_company_id()) and (select private.has_role('{admin}')))
  with check (company_id = (select private.current_company_id()));

create policy sequences_read on public.document_sequences for select to authenticated
  using (company_id = (select private.current_company_id()));
create policy sequences_admin_update on public.document_sequences for update to authenticated
  using (company_id = (select private.current_company_id()) and (select private.has_role('{admin}')))
  with check (company_id = (select private.current_company_id()));

create policy audit_admin_read on public.audit_logs for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.has_role('{admin}')));

create policy gst_rates_read on public.gst_rates for select to authenticated
  using (company_id = (select private.current_company_id()));
create policy gst_rates_admin_insert on public.gst_rates for insert to authenticated
  with check (company_id = (select private.current_company_id()) and (select private.has_role('{admin}')));

-- Master data: read for members, write for the listed roles.
do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      ('categories', '{admin,inventory}'),
      ('brands',     '{admin,inventory}'),
      ('products',   '{admin,inventory}'),
      ('suppliers',  '{admin,accounts,inventory}'),
      ('customers',  '{admin,accounts,sales}'),
      ('boms',       '{admin,production}'),
      ('bom_lines',  '{admin,production}')
    ) as v(tbl, roles)
  loop
    execute format('create policy %1$s_read on public.%1$I for select to authenticated
                    using (company_id = (select private.current_company_id()))', spec.tbl);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated
                    with check (company_id = (select private.current_company_id()) and (select private.has_role(%2$L)))',
                   spec.tbl, spec.roles);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated
                    using (company_id = (select private.current_company_id()) and (select private.has_role(%2$L)))
                    with check (company_id = (select private.current_company_id()))',
                   spec.tbl, spec.roles);
  end loop;
end $$;

-- Transactional tables: read-only through the API; written by posting functions.
do $$
declare t text;
begin
  foreach t in array array['locations', 'stock_movements', 'stock_balances', 'purchases', 'purchase_lines',
                           'production_orders', 'production_materials', 'sales_invoices', 'sales_lines',
                           'payments', 'payment_allocations'] loop
    execute format('create policy %1$s_read on public.%1$I for select to authenticated
                    using (company_id = (select private.current_company_id()))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Table privileges (defence in depth on top of RLS)
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;
-- audit_logs is readable only by admins (RLS policy above).

grant insert, update on public.categories, public.brands, public.products, public.suppliers,
  public.customers, public.boms, public.bom_lines to authenticated;
grant update on public.companies, public.document_sequences to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant insert on public.gst_rates to authenticated;
grant update (description, is_sample) on public.gst_rates to authenticated;
grant insert, update on public.company_memberships to authenticated;
-- company_id cannot be moved: every UPDATE policy re-checks it in WITH CHECK.
