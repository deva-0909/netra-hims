-- Cashier day-closing / reconciliation — closes a gap from the audit
-- report (section 4.9, Billing & Revenue Cycle). CollectionsReportPage
-- already aggregates payment_transactions by method for a chosen date,
-- but nothing let a cashier actually reconcile and close a day: count
-- physical cash, compare against the system-expected total, and record
-- a variance. One row per closed date; immutable once inserted (no
-- update policy) so a closing can't be silently rewritten later —
-- matches the posted-journal-entry immutability pattern used in Finance.

create table cashier_day_closings (
  id uuid primary key default gen_random_uuid(),
  closing_date date not null unique,
  system_cash numeric(10,2) not null default 0,
  system_card numeric(10,2) not null default 0,
  system_upi numeric(10,2) not null default 0,
  system_insurance numeric(10,2) not null default 0,
  system_other numeric(10,2) not null default 0,
  system_refunds numeric(10,2) not null default 0,
  system_net_total numeric(10,2) not null default 0,
  counted_cash numeric(10,2) not null default 0,
  variance numeric(10,2) not null default 0,
  notes text,
  closed_by uuid references profiles(id),
  closed_at timestamptz not null default now()
);

alter table cashier_day_closings enable row level security;

create policy "cashier_day_closings_select" on cashier_day_closings for select to authenticated using (is_staff());
create policy "cashier_day_closings_insert" on cashier_day_closings for insert to authenticated with check (has_role('billing'::staff_role, 'accountant'::staff_role));
create policy "cashier_day_closings_delete" on cashier_day_closings for delete to authenticated using (has_role(variadic array[]::staff_role[]));

create trigger audit_cashier_day_closings after insert or delete on cashier_day_closings for each row execute function log_audit_event();
