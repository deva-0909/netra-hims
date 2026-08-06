-- ============================================================
-- NETRA HIMS — OPD audit fix 6: communication send + log
--
-- communication_templates only ever managed template text — there was no
-- SMS/WhatsApp/email gateway integrated (that's a real third-party
-- integration decision, not something to fake), so "sending" a template was
-- a dead end. This adds an audit trail for the compose+copy/deep-link flow
-- built in SendCommunicationPanel.tsx: staff render a template (or write a
-- custom message), send it via their own phone/email through a WhatsApp/SMS/
-- mailto deep link, and log that it went out.
-- ============================================================

create table communication_log (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  template_id uuid references communication_templates(id) on delete set null,
  channel text not null check (channel in ('sms', 'whatsapp', 'email')),
  recipient text not null,
  subject text,
  body text not null,
  sent_by uuid references profiles(id),
  sent_at timestamptz not null default now()
);
create index idx_communication_log_patient on communication_log(patient_id);

alter table communication_log enable row level security;
create policy communication_log_select on communication_log for select using (is_staff());
create policy communication_log_insert on communication_log for insert with check (is_staff() and sent_by = auth.uid());
