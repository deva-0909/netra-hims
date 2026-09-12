-- ============================================================
-- NETRA HIMS — enforce queue-token uniqueness per clinic module per day
--
-- generateToken() (src/lib/tokenGenerator.ts) computes the next token by
-- counting today's visits already created for a clinic module and adding
-- one — a classic check-then-act race. Two concurrent check-ins for the
-- same clinic module (two receptionists, or a normal appointment check-in
-- landing at the same moment as an emergency triage registration, or a
-- clinic referral) can both read the same count before either insert
-- commits, issuing the IDENTICAL token to two different patients in the
-- same live queue — a real operational collision (misdirected calling,
-- confusion at the display board), not just a theoretical demo caveat.
-- Nothing in the schema previously prevented this.
--
-- This unique index gives the database the final say: a duplicate insert
-- now fails outright (23505) instead of silently succeeding, so
-- insertVisitWithToken() can catch the conflict and retry with a freshly
-- recomputed token instead of a collision ever reaching the queue.
--
-- Scoped by clinic_module + the calendar day of created_at (in whatever
-- timezone the database session runs in) + token_number, so the same
-- token can be reused on a different day or in a different clinic module.
-- Only applies where a token was actually assigned (most rows always are,
-- but this guards against ever conflicting on null token_number values).
-- ============================================================

create unique index visits_token_number_per_day_module
  on visits (clinic_module, token_number, (created_at::date))
  where token_number is not null;
