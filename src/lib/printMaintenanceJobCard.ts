import { supabase } from './supabaseClient';

function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

/** Prints a job card for a maintenance/calibration work order — the paper a
 * biomedical technician or vendor engineer actually carries to the
 * equipment and signs off on, independent of the system. */
export async function printMaintenanceJobCard(equipment: any, wo: any) {
  const { data: hospital } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();
  const { data: reporter } = wo.reported_by
    ? await supabase.from('profiles').select('full_name').eq('id', wo.reported_by).maybeSingle()
    : { data: null };

  const win = window.open('', '_blank', 'width=650,height=850');
  if (!win) return;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Job Card — ${esc(equipment.asset_tag)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 620px; margin: 30px auto; padding: 0 20px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .muted { color: #666; font-size: 13px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 13px; margin-top: 16px; }
  .grid div span.k { color: #666; }
  .box { border: 1px dashed #999; border-radius: 8px; padding: 12px; margin-top: 16px; font-size: 13px; min-height: 60px; }
  .sign { margin-top: 60px; display: flex; justify-content: space-between; font-size: 12px; }
  .sign div { border-top: 1px solid #999; padding-top: 4px; width: 200px; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>${esc(hospital?.hospital_name ?? 'Netra Eye Hospital')} — Maintenance Job Card</h1>
  <div class="muted">${esc(hospital?.address)} ${hospital?.phone ? '· ' + esc(hospital.phone) : ''}</div>

  <div class="grid">
    <div><span class="k">Equipment:</span> ${esc(equipment.name)} (${esc(equipment.asset_tag)})</div>
    <div><span class="k">Location:</span> ${esc(equipment.department)} ${equipment.location ? `· ${esc(equipment.location)}` : ''}</div>
    <div><span class="k">Work type:</span> ${esc(String(wo.work_type).replace(/_/g, ' '))}</div>
    <div><span class="k">Priority:</span> ${esc(wo.priority)}</div>
    <div><span class="k">Reported by:</span> ${esc(reporter?.full_name)}</div>
    <div><span class="k">Reported:</span> ${new Date(wo.created_at).toLocaleString()}</div>
  </div>

  <div class="box">
    <strong>Issue reported:</strong><br />${esc(wo.description)}
  </div>

  <div class="box">
    <strong>Work done / findings:</strong>
  </div>

  <div class="sign">
    <div>Technician signature</div>
    <div>Verified by (hospital staff)</div>
  </div>

  <button onclick="window.print()" style="margin-top:24px;padding:8px 16px;">Print</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}
