import { supabase } from './supabaseClient';

/** Keeps equipment_assets.status honest about whether an instrument is
 * actually mid-repair — starting/completing/cancelling a work order
 * previously never touched the equipment's own status, so it kept showing
 * "active" while genuinely down for repair. Only ever moves between
 * 'active' and 'under_maintenance'; never touches a status the biomedical
 * engineer set manually for another reason (decommissioned, disposed). */
export async function syncEquipmentMaintenanceStatus(equipmentId: string): Promise<void> {
  const { data: equipment } = await supabase.from('equipment_assets').select('status').eq('id', equipmentId).maybeSingle();
  if (!equipment) return;

  const { count } = await supabase
    .from('maintenance_work_orders')
    .select('id', { count: 'exact', head: true })
    .eq('equipment_id', equipmentId)
    .in('status', ['open', 'in_progress']);

  const hasActiveWork = (count ?? 0) > 0;

  if (hasActiveWork && equipment.status === 'active') {
    await supabase.from('equipment_assets').update({ status: 'under_maintenance' }).eq('id', equipmentId);
  } else if (!hasActiveWork && equipment.status === 'under_maintenance') {
    await supabase.from('equipment_assets').update({ status: 'active' }).eq('id', equipmentId);
  }
}
