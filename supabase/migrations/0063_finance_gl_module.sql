-- Financial Accounting / General Ledger module — new for the ERP-
-- completeness audit. Patient billing and vendor payments existed, but
-- there was no chart of accounts, no journal, no expense tracking, and no
-- P&L/balance sheet — statutory accounting had nowhere to live in the
-- system, meaning it was presumably still done outside it (Tally/Excel).
--
-- Deliberately scoped to a correct, standalone double-entry ledger fed by
-- manual journal entries and the new expense-recording flow (which posts
-- its own balanced entry automatically, since expenses are entered fresh
-- rather than derived from an already-mutable table). Auto-posting from
-- `bills`/`po_payments` is NOT built here — those tables can be corrected
-- after the fact (see BillingStage's EditBillForm), and a trigger-based
-- sync that doesn't handle every correction/refund path risks silently
-- wrong financial statements, which is worse than no automation at all.
-- That's a well-defined, separate follow-up once this ledger is in use.

create table chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  account_code text not null unique,
  account_name text not null,
  account_type text not null check (account_type in ('asset', 'liability', 'equity', 'income', 'expense')),
  parent_account_id uuid references chart_of_accounts(id),
  is_system boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  reference text,
  description text not null,
  source_type text not null default 'manual' check (source_type in ('manual', 'expense', 'billing', 'vendor_payment', 'payroll')),
  source_id uuid,
  posted boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references journal_entries(id) on delete cascade,
  account_id uuid not null references chart_of_accounts(id),
  debit numeric not null default 0 check (debit >= 0),
  credit numeric not null default 0 check (credit >= 0),
  description text,
  check (not (debit > 0 and credit > 0))
);

create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_account_id uuid references chart_of_accounts(id),
  active boolean not null default true
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references expense_categories(id),
  vendor_id uuid references vendors(id),
  amount numeric not null check (amount > 0),
  expense_date date not null default current_date,
  description text,
  payment_method text not null default 'cash' check (payment_method in ('cash', 'bank_transfer', 'cheque', 'card', 'upi', 'other')),
  journal_entry_id uuid references journal_entries(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index journal_entry_lines_journal_entry_id_idx on journal_entry_lines(journal_entry_id);
create index journal_entry_lines_account_id_idx on journal_entry_lines(account_id);
create index journal_entries_entry_date_idx on journal_entries(entry_date);

-- A journal entry can only be posted once its lines actually balance, and
-- once posted it (and its lines) become immutable — standard double-entry
-- bookkeeping practice, mirrored here the same way this app gates other
-- "don't let a workflow finish half-done" transitions with a trigger.
create or replace function enforce_balanced_journal_entry()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  total_debit numeric;
  total_credit numeric;
begin
  if new.posted = true and (old is null or old.posted is distinct from true) then
    select coalesce(sum(debit), 0), coalesce(sum(credit), 0) into total_debit, total_credit
    from journal_entry_lines where journal_entry_id = new.id;
    if total_debit = 0 and total_credit = 0 then
      raise exception 'A journal entry needs at least one line before it can be posted.';
    end if;
    if total_debit != total_credit then
      raise exception 'Journal entry does not balance: debits % vs credits %.', total_debit, total_credit;
    end if;
  end if;
  return new;
end;
$function$;

create trigger trg_enforce_balanced_journal_entry
before update on journal_entries
for each row execute function enforce_balanced_journal_entry();

create or replace function prevent_posted_journal_entry_changes()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  entry_posted boolean;
begin
  select posted into entry_posted from journal_entries where id = coalesce(new.journal_entry_id, old.journal_entry_id);
  if entry_posted then
    raise exception 'This journal entry is posted and its lines can no longer be changed — reverse it with a new entry instead.';
  end if;
  return coalesce(new, old);
end;
$function$;

create trigger trg_prevent_posted_journal_entry_line_changes
before update or delete on journal_entry_lines
for each row execute function prevent_posted_journal_entry_changes();

create or replace function prevent_posted_journal_entry_header_changes()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if old.posted = true and new.posted = true then
    if new.entry_date is distinct from old.entry_date or new.description is distinct from old.description then
      raise exception 'A posted journal entry cannot be edited — reverse it with a new entry instead.';
    end if;
  end if;
  return new;
end;
$function$;

create trigger trg_prevent_posted_journal_entry_header_changes
before update on journal_entries
for each row execute function prevent_posted_journal_entry_header_changes();

create or replace function prevent_posted_journal_entry_delete()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if old.posted = true then
    raise exception 'A posted journal entry cannot be deleted — reverse it with a new entry instead.';
  end if;
  return old;
end;
$function$;

create trigger trg_prevent_posted_journal_entry_delete
before delete on journal_entries
for each row execute function prevent_posted_journal_entry_delete();

alter table chart_of_accounts enable row level security;
alter table journal_entries enable row level security;
alter table journal_entry_lines enable row level security;
alter table expense_categories enable row level security;
alter table expenses enable row level security;

create policy "chart_of_accounts_select" on chart_of_accounts for select to authenticated using (has_role('accountant'::staff_role));
create policy "chart_of_accounts_insert" on chart_of_accounts for insert to authenticated with check (has_role('accountant'::staff_role));
create policy "chart_of_accounts_update" on chart_of_accounts for update to authenticated using (has_role('accountant'::staff_role)) with check (has_role('accountant'::staff_role));
create policy "chart_of_accounts_delete" on chart_of_accounts for delete to authenticated using (has_role(variadic array[]::staff_role[]));

create policy "journal_entries_select" on journal_entries for select to authenticated using (has_role('accountant'::staff_role));
create policy "journal_entries_insert" on journal_entries for insert to authenticated with check (has_role('accountant'::staff_role));
create policy "journal_entries_update" on journal_entries for update to authenticated using (has_role('accountant'::staff_role)) with check (has_role('accountant'::staff_role));
create policy "journal_entries_delete" on journal_entries for delete to authenticated using (has_role('accountant'::staff_role));

create policy "journal_entry_lines_select" on journal_entry_lines for select to authenticated using (has_role('accountant'::staff_role));
create policy "journal_entry_lines_insert" on journal_entry_lines for insert to authenticated with check (has_role('accountant'::staff_role));
create policy "journal_entry_lines_update" on journal_entry_lines for update to authenticated using (has_role('accountant'::staff_role)) with check (has_role('accountant'::staff_role));
create policy "journal_entry_lines_delete" on journal_entry_lines for delete to authenticated using (has_role('accountant'::staff_role));

create policy "expense_categories_select" on expense_categories for select to authenticated using (has_role('accountant'::staff_role));
create policy "expense_categories_insert" on expense_categories for insert to authenticated with check (has_role('accountant'::staff_role));
create policy "expense_categories_update" on expense_categories for update to authenticated using (has_role('accountant'::staff_role)) with check (has_role('accountant'::staff_role));

create policy "expenses_select" on expenses for select to authenticated using (has_role('accountant'::staff_role));
create policy "expenses_insert" on expenses for insert to authenticated with check (has_role('accountant'::staff_role));
create policy "expenses_update" on expenses for update to authenticated using (has_role('accountant'::staff_role)) with check (has_role('accountant'::staff_role));

create trigger audit_journal_entries after insert or update or delete on journal_entries for each row execute function log_audit_event();
create trigger audit_expenses after insert or update or delete on expenses for each row execute function log_audit_event();

insert into chart_of_accounts (account_code, account_name, account_type, is_system) values
  ('1000', 'Cash', 'asset', true),
  ('1010', 'Bank', 'asset', true),
  ('1100', 'Accounts Receivable', 'asset', true),
  ('1200', 'Inventory', 'asset', false),
  ('2000', 'Accounts Payable', 'liability', true),
  ('2100', 'GST Payable', 'liability', false),
  ('3000', 'Owner''s Equity', 'equity', false),
  ('3100', 'Retained Earnings', 'equity', false),
  ('4000', 'Patient Billing Income', 'income', true),
  ('4100', 'Other Income', 'income', false),
  ('5000', 'Salaries & Wages', 'expense', false),
  ('5100', 'Rent', 'expense', false),
  ('5200', 'Utilities', 'expense', false),
  ('5300', 'Medical Supplies', 'expense', false),
  ('5400', 'Equipment Maintenance', 'expense', false),
  ('5500', 'Marketing', 'expense', false),
  ('5600', 'Administrative', 'expense', false),
  ('5900', 'Other Expenses', 'expense', false);

insert into expense_categories (name, default_account_id) values
  ('Salaries & Wages', (select id from chart_of_accounts where account_code = '5000')),
  ('Rent', (select id from chart_of_accounts where account_code = '5100')),
  ('Utilities', (select id from chart_of_accounts where account_code = '5200')),
  ('Medical Supplies', (select id from chart_of_accounts where account_code = '5300')),
  ('Equipment Maintenance', (select id from chart_of_accounts where account_code = '5400')),
  ('Marketing', (select id from chart_of_accounts where account_code = '5500')),
  ('Administrative', (select id from chart_of_accounts where account_code = '5600')),
  ('Other', (select id from chart_of_accounts where account_code = '5900'));
