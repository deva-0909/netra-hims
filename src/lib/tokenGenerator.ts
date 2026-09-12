import { supabase } from './supabaseClient';

const MODULE_PREFIX: Record<string, string> = {
  general: 'G',
  retina: 'R',
  glaucoma: 'GL',
  lasik: 'L',
  cornea: 'CO',
  oculoplasty: 'OP',
  uveitis: 'UV',
  low_vision: 'LV',
  pediatric: 'P',
};

/**
 * Generates the next sequential token for a clinic module, scoped to today
 * (e.g. "G-103"). Counts today's visits already created for that module and
 * adds one — a check-then-act race between two concurrent callers for the
 * same module. insertVisitWithToken() below is what actually guards against
 * a collision reaching the queue; call this directly only where the
 * resulting token isn't about to be inserted against the unique constraint
 * it protects against.
 */
export async function generateToken(clinicModule: string): Promise<string> {
  const prefix = MODULE_PREFIX[clinicModule] ?? clinicModule.slice(0, 2).toUpperCase();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('visits')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_module', clinicModule)
    .gte('created_at', startOfDay.toISOString());

  const next = (count ?? 0) + 1;
  return `${prefix}-${String(100 + next)}`;
}

const MAX_TOKEN_ATTEMPTS = 5;

/**
 * Inserts a new visit with a freshly generated token, retrying with a newly
 * recomputed token if a concurrent insert already claimed the one this call
 * generated. generateToken()'s count-based approach can hand out the same
 * token to two concurrent check-ins for the same clinic module — a
 * unique index on (clinic_module, token_number, day) turns that race into a
 * clean, catchable insert failure (Postgres 23505 / unique_violation)
 * instead of two patients silently sharing the same queue token, and this
 * retries past it rather than surfacing a raw constraint-violation error.
 * Each retry recomputes the count fresh, which by then reflects whichever
 * concurrent insert already committed, so it naturally advances past the
 * collision instead of generating the same losing token again.
 */
export async function insertVisitWithToken(
  clinicModule: string,
  visitFields: Record<string, unknown>
): Promise<{ data: any; error: string | null }> {
  for (let attempt = 0; attempt < MAX_TOKEN_ATTEMPTS; attempt++) {
    const token = await generateToken(clinicModule);
    const { data, error } = await supabase
      .from('visits')
      .insert({ ...visitFields, clinic_module: clinicModule, token_number: token })
      .select()
      .single();
    if (!error) return { data, error: null };
    if (error.code === '23505' && attempt < MAX_TOKEN_ATTEMPTS - 1) continue;
    return { data: null, error: error.message };
  }
  return { data: null, error: 'Could not generate a unique token — please try again.' };
}
