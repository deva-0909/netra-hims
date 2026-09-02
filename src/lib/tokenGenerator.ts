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
 * adds one — good enough for a single-hospital demo; a high-concurrency real
 * deployment would want this as a DB sequence/RPC instead of a client-side count.
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
