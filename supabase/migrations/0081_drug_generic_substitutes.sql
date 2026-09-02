-- Substitute/generic drug mapping — closes the last remaining Pharmacy
-- P1 gap from the audit report. Rather than a separate pairwise mapping
-- table (which needs manual curation for every substitute pair, like
-- drug_interactions), two catalog drugs sharing the same generic_name
-- ARE substitutes of each other — no mapping table needed, just a
-- column and a lookup by generic_name.

alter table drugs add column generic_name text;
create index drugs_generic_name_idx on drugs(generic_name) where generic_name is not null;
