-- Phase 3 of the paperless-hospital roadmap: procurement/stores (Domain G)
-- and CSSD/housekeeping/biomedical waste (Domain F) both land under one
-- new single-purpose desk, same pattern as hr_manager/biomedical_engineer.
alter type staff_role add value 'store_keeper';
