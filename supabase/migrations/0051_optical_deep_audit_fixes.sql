-- ============================================================
-- NETRA HIMS — Optical / Optical Inventory deep-dive audit fixes
--
-- Frames don't expire, but the contact_lens category genuinely does —
-- disposable lenses, lens care solutions — and there was no expiry_date
-- column anywhere in eyewear_items/eyewear_stock_receipts to track it,
-- unlike drugs which already have this via stock_receipts.expiry_date.
-- ============================================================

alter table eyewear_stock_receipts add column expiry_date date;
