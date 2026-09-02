-- Master Patient Index enhancements — closes remaining gaps from the audit
-- report (section 4.1). Duplicate detection (by phone, with a confirm
-- gate), UHID merge/consolidation, and name/UHID/mobile search already
-- existed. What was missing: a photo, an emergency contact distinct from
-- the guardian, referral source, and a communication opt-out.

alter table patients add column if not exists photo_url text;
alter table patients add column if not exists emergency_contact_name text;
alter table patients add column if not exists emergency_contact_phone text;
alter table patients add column if not exists referral_source text;
alter table patients add column if not exists communication_opt_out boolean not null default false;
