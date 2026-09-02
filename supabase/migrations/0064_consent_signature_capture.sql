-- E-signature capture — new for the ERP-completeness audit. Consents were
-- tracked as a boolean "signed" flag (plus an optional scanned-document
-- upload) rather than an actual captured signature — not equivalent to a
-- wet-ink signature for a legally significant document. Adds a
-- signature_url column alongside the existing consent_signed/
-- consent_file_url columns (captured signature is additive, not a
-- replacement for the option to upload a physically-signed scan).

alter table surgical_consents add column if not exists signature_url text;
alter table lasik_consents add column if not exists signature_url text;
