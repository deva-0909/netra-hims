import { supabase } from './supabaseClient';

function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

/** Prints a requisition slip for one ordered investigation — what the patient
 * carries to the diagnostics counter (OCT, visual field, imaging, labs). */
export async function printInvestigationRequisition(visitId: string, order: any) {
  const { data: visit } = await supabase.from('visits').select('patient_id').eq('id', visitId).single();
  const { data: patient } = await supabase.from('patients').select('*').eq('id', visit!.patient_id).single();
  const { data: hospital } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();
  const { data: orderedBy } = order.ordered_by
    ? await supabase.from('profiles').select('full_name').eq('id', order.ordered_by).maybeSingle()
    : { data: null };

  const win = window.open('', '_blank', 'width=650,height=850');
  if (!win) return;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Investigation Requisition — ${esc(patient?.full_name)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 620px; margin: 30px auto; padding: 0 20px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .muted { color: #666; font-size: 13px; }
  .box { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-top: 18px; }
  .box .label { font-size: 11px; text-transform: uppercase; color: #888; }
  .box .value { font-size: 18px; font-weight: 600; margin-top: 2px; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>${esc(hospital?.hospital_name ?? 'Netra Eye Hospital')}</h1>
  <div class="muted">${esc(hospital?.address)} ${hospital?.phone ? '· ' + esc(hospital.phone) : ''}</div>
  <div class="muted" style="margin-top:6px;">Ordered by ${esc(orderedBy?.full_name)} · ${new Date(order.created_at).toLocaleString()}</div>

  <div class="muted" style="margin-top:14px;">Patient: ${esc(patient?.full_name)} (${esc(patient?.uhid)})</div>
  <div class="muted">${esc(patient?.date_of_birth)} · ${esc(patient?.gender)} · ${esc(patient?.phone)}</div>

  <div class="box">
    <div class="label">Investigation requested</div>
    <div class="value">${esc(order.test_name)}</div>
  </div>
  <div class="muted" style="margin-top:10px;">Status: ${esc(order.status)}</div>

  <button onclick="window.print()" style="margin-top:24px;padding:8px 16px;">Print</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}
