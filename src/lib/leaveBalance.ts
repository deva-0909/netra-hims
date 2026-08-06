import { supabase } from './supabaseClient';

export interface LeaveBalance { allocated_days: number; used_days: number }

/** Reads an employee's leave balance for one type/year, if HR has provisioned
 * one yet. Returns null when nothing exists — callers should fall back to
 * the leave type's default_annual_days as the assumed full entitlement. */
export async function getLeaveBalance(employeeId: string, leaveTypeId: string, year: number): Promise<LeaveBalance | null> {
  const { data } = await supabase.from('leave_balances').select('allocated_days, used_days')
    .eq('employee_id', employeeId).eq('leave_type_id', leaveTypeId).eq('year', year).maybeSingle();
  return data ?? null;
}

/** Deducts approved leave from the employee's balance for that type/year,
 * provisioning the balance row (seeded from the leave type's default
 * annual entitlement) the first time it's needed — only ever called from
 * the HR approval step, since leave_balances INSERT is HR-only by RLS. */
export async function deductLeaveBalance(
  employeeId: string,
  leaveTypeId: string,
  defaultAnnualDays: number,
  totalDays: number,
  year: number
): Promise<{ error: string | null }> {
  const { data: existing, error: fetchError } = await supabase.from('leave_balances').select('id, allocated_days, used_days')
    .eq('employee_id', employeeId).eq('leave_type_id', leaveTypeId).eq('year', year).maybeSingle();
  if (fetchError) return { error: fetchError.message };

  if (existing) {
    const { error } = await supabase.from('leave_balances').update({ used_days: Number(existing.used_days) + totalDays }).eq('id', existing.id);
    return { error: error?.message ?? null };
  }

  const { error } = await supabase.from('leave_balances').insert({
    employee_id: employeeId, leave_type_id: leaveTypeId, year, allocated_days: defaultAnnualDays, used_days: totalDays,
  });
  return { error: error?.message ?? null };
}
