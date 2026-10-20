# Voltaxis ERP — Battery Manufacturing & Trading (demo MVP)

A cloud ERP for a small Indian battery business that manufactures its own batteries and resells third-party brands. It covers inventory, purchasing, simple production, retail and wholesale GST invoicing, invoice PDFs, payments, receivables and reporting. All of it runs on one PostgreSQL database with a stock ledger behind every number.

> **Demo status.** Company details, GSTINs and GST rates in the seed data are **fictional, unverified sample configuration**. Invoices show a "not valid for statutory use" banner until an accountant approves the setup (Settings → Company). PDF generation is **not** GST e-invoicing or portal filing.

## Stack

- Next.js 16.4 (App Router, Cache Components, Server Actions), React 19, TypeScript (strict), Tailwind 4
- Supabase: Postgres, Auth, Row-Level Security
- zod for validation, decimal.js for money, @react-pdf/renderer for invoices

## Setup

Prerequisites: Node.js **22.6+** (needed for `npm test`; the app itself runs on 20.9+) and a Supabase project. Use a **dedicated demo project**, not production.

```bash
npm install
cp .env.example .env.local        # then fill in the values below
```

| Variable | Where to find it | Exposed to browser |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page (anon / publishable key) | yes (safe: RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | same page (service role / secret) | **no**, server only; optional, used only by "Add user" |
| `NEXT_PUBLIC_DEMO_MODE` | `true` shows demo accounts on the login page | yes |

Create the schema and the demo data:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push --include-seed
```

In the Supabase dashboard, turn off public sign-ups: **Authentication → Sign In / Providers → Email → Allow new users to sign up = off**. (Locally, `supabase/config.toml` already disables them.)

Then start the app:

```bash
npm run dev     # http://localhost:3000
```

### Demo accounts (password `Demo@12345`)

| Email | Role |
|---|---|
| admin@voltaxis-demo.test | Owner / Admin |
| accounts@voltaxis-demo.test | Accounts / Billing |
| sales@voltaxis-demo.test | Sales (allowed to record receipts) |
| inventory@voltaxis-demo.test | Inventory |
| production@voltaxis-demo.test | Production |

The seed is idempotent, so running it again changes nothing. Transaction dates are relative to the day you seed, which means the dashboard always has recent data.

## Checks

```bash
npm run lint
npm run typecheck
npm test                 # tax engine and money formatting (Node 22.6+)
npm run build
# Database acceptance tests: run against the DEMO database. Everything runs
# in a transaction that is rolled back, so the data is left unchanged.
psql "<demo database connection string>" -v ON_ERROR_STOP=1 -f supabase/tests/acceptance_test.sql
```

## Demo walkthrough (PRD §1 success criteria)

1. **Log in** as admin, which opens the dashboard with live KPIs.
2. **Search** "auto" in the header search. Raw materials, own-brand (Voltaxis) and third-party (Krona, Sunvolt, Ampriva) batteries appear together.
3. **Purchases → Record purchase**: add 100 L of acid from Western Chemicals (Gujarat, so IGST). Confirm, then check *Stock overview*: acid rises by exactly 100.
4. **Manufacturing**: open the draft order for *Voltaxis Auto 35Ah* and enter the actual consumption. Complete it. Lead, acid, containers and separators go down and finished batteries go up. Material cost per unit is shown.
5. **Sales → New invoice**: choose *Sharma Auto Electricals* (wholesale, GST-exclusive) or the walk-in customer (retail, GST-inclusive shelf price). Add products with a discount and watch the live CGST/SGST split. Choose *Deccan Power Solutions* (Karnataka) to see IGST. Post it.
6. **PDF**: on the invoice, use *Print* or *PDF*.
7. **Record payment**: post a part payment, then the rest. The status moves Unpaid → Part-paid → Paid.
8. **Dashboard** reflects the new sale, receivables and stock value.
9. **Product page → Stock history** shows every movement with its document, user and running balance, so you can explain where each unit came from.
10. **Refresh** any page. Everything is read from the database.

Also worth showing: the same invoice cannot be posted twice; selling more than is in stock is refused; signing in as *production* and trying to invoice is refused by the database; posted invoices cannot be edited, only cancelled with a reason (and the stock is returned).

## Architecture

```
src/
  proxy.ts                    session refresh + route gating (Next 16 "proxy", formerly middleware)
  app/login, app/no-access    public / unlinked-user pages
  app/(app)/...               every business page; data loads inside <Suspense>
  app/(app)/sales/[id]/pdf    server-side PDF route (react-pdf), from the saved snapshot
  app/(app)/reports/export    CSV export
  lib/auth.ts                 data access layer: verified user + company + role
  lib/actions/*               server actions: zod validation, then a DB call
  lib/data/*                  read queries (run as the user, so RLS applies)
  lib/domain/*                money, tax preview, schemas, permissions
supabase/
  migrations/                 schema, security, posting functions, views and reports
  seed.sql                    fictional demo data, created through the posting functions
  tests/acceptance_test.sql   PRD §11 checks at the database level
```

**Stock ledger.** `stock_movements` is the source of truth and is append-only (a trigger blocks UPDATE and DELETE for everyone). `stock_balances` is a projection kept in step by a single internal writer (`private.apply_movement`). That writer uses weighted-average cost, row locks and a negative-stock check. `v_stock_reconciliation` proves that the two agree, and the Stock overview page checks this on every load.

**Posting functions.** `create_purchase`, `create_sales_invoice` / `post_sales_invoice`, `complete_production_order`, `record_payment`, `post_stock_adjustment` and the cancellations are PL/pgSQL functions, and each one runs as a single transaction. Each function:
- checks the caller's role first;
- recomputes every value on the server, because client totals are never accepted;
- locks rows in a consistent order;
- is idempotent through a client-generated key or a status check;
- writes an audit record.

They are `SECURITY DEFINER`, owned by the migration role, with `search_path = ''`. Members have no direct write access to these tables, so these functions are the only way to change them.

**Tax.** GST rates are effective-dated versions in `gst_rates`, and products reference a rate code. The engine decides CGST + SGST or IGST by comparing the seller's state with the place of supply. It supports GST-exclusive prices and GST-inclusive (retail shelf) prices, line discounts and rupee round-off. Invoices store HSN, rate and tax amounts per line, plus a seller snapshot, so later master-data changes never alter a posted invoice. `src/lib/domain/tax.ts` mirrors the SQL engine for the live preview only, and a test keeps the two in step: the two engines agreed on 3,000 random cases.

**Security.** Supabase Auth handles sessions. RLS is enabled and forced on every table and scoped to the user's company. Table grants are minimal (anon has none). There are no hard deletes. The service-role key is used only server-side for "Add user", and only after an admin check.

## Requirement checklist

**P0: implemented**
- [x] Auth, protected routes, role checks in actions and in the database
- [x] Dashboard from live aggregates (sales today/month, products, stock, value, low stock, receivables, payables, production, recent activity, 30-day chart)
- [x] Products, categories, brands; raw / own-brand / third-party, all sellable on one invoice (except raw materials)
- [x] Customers (retail, wholesale, walk-in) and suppliers with balances
- [x] Movement ledger + balance projection + reconciliation
- [x] Purchase receipt (atomic; on credit or paid now)
- [x] BOMs, production orders, actual consumption, material costing, single completion
- [x] Retail and wholesale invoices; draft → post; controlled cancellation
- [x] Versioned GST configuration, labelled as sample data
- [x] A4 invoice PDF from the persisted snapshot
- [x] Full and partial payments, allocation, over-allocation and duplicate protection
- [x] Stock movement history with document links and running balance
- [x] Idempotent seed
- [x] Validation (client + server + database), error boundaries, toasts, confirmations, skeletons, responsive layout

**P1: included**
- [x] Supplier payments
- [x] Low-stock alerts and CSV export of reports
- [x] Audit log viewer (admin)
- [x] User management (roles, receipt permission, deactivate; add user when the service-role key is set)
- [x] Purchase cancellation

**Not done (P1 / out of scope)**
- [ ] Purchase orders and goods receipts as separate documents (the schema leaves room for them)
- [ ] Sales returns and statutory credit notes (cancellation covers the demo)
- [ ] BOM editor in the UI (BOMs are seeded; RLS already allows admin/production to write them)
- [ ] CSV import
- [ ] Multi-warehouse, serial-number warranty, e-invoice/e-way bill, GST portal filing, payment gateways, notifications

## Before production use

1. An accountant verifies HSN codes and GST rates for every product, marks the rates as verified, and approves the company details. Then untick "Demo configuration".
2. Replace the demo company, users and data: start from a fresh project and do not run `seed.sql`.
3. Decide on GST rounding and B2C/B2B invoice formats (e.g., the threshold for listing the place of supply) with the accountant. Add credit notes for returns.
4. If e-invoicing applies to the turnover, integrate the IRP (IRN/QR). It is not implemented here.
5. Add backups and point-in-time recovery, monitoring, rate limits on login, password reset emails (SMTP), and 2FA for admins.
6. Load-test concurrent invoicing. Row locking is in place and was exercised with two parallel sessions, but not at volume.
7. Add a logo upload and bank details, and review invoice layout with real data lengths.
