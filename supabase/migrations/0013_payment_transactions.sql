create table payment_transactions (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references bills(id) on delete cascade,
  amount numeric(10,2) not null,
  method text,
  transaction_type text not null default 'payment' check (transaction_type in ('payment', 'refund')),
  recorded_by uuid references profiles(id),
  recorded_at timestamptz not null default now()
);

alter table payment_transactions enable row level security;
create policy "payment_transactions_select" on payment_transactions for select to authenticated using (is_staff());
create policy "payment_transactions_insert" on payment_transactions for insert to authenticated with check (has_role('billing'::staff_role));
create policy "payment_transactions_delete" on payment_transactions for delete to authenticated using (has_role(variadic array[]::staff_role[]));
