import { supabase } from './supabaseClient';

function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

/** Renders the police intimation letter for a Medico-Legal Case — the
 * physical/PDF document a hospital is required to hand or send to the
 * jurisdictional police station, not just an internal register entry. */
export async function printMlcIntimation(mlcCase: any) {
  const { data: hospital } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();

  const win = window.open('', '_blank', 'width=700,height=900');
  if (!win) return;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>MLC Intimation — ${esc(mlcCase.mlc_number)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 650px; margin: 40px auto; padding: 0 20px; line-height: 1.6; }
  h1 { font-size: 18px; margin-bottom: 2px; }
  .muted { color: #666; font-size: 13px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 13px; margin: 16px 0; }
  .grid div span.k { color: #666; }
  .box { border: 1px solid #ccc; padding: 12px; margin-top: 12px; font-size: 13px; }
  .sig { margin-top: 60px; display: flex; justify-content: space-between; font-size: 13px; }
  .sig div { border-top: 1px solid #333; padding-top: 4px; width: 220px; text-align: center; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>${esc(hospital?.hospital_name ?? 'Netra Eye Hospital')}</h1>
  <div class="muted">${esc(hospital?.address)} ${hospital?.phone ? '· ' + esc(hospital.phone) : ''}</div>

  <p style="margin-top:24px;">To,<br/>The Station House Officer,<br/>${esc(mlcCase.police_station) === '—' ? '_______________ Police Station' : esc(mlcCase.police_station) + ' Police Station'}</p>

  <p><strong>Subject: Medico-Legal Case Intimation — ${esc(mlcCase.mlc_number)}</strong></p>

  <p>This is to inform you that a patient with a suspected medico-legal case, as per details below, was examined/treated at this hospital.</p>

  <div class="grid">
    <div><span class="k">MLC Number:</span> ${esc(mlcCase.mlc_number)}</div>
    <div><span class="k">Reported on:</span> ${new Date(mlcCase.created_at).toLocaleString()}</div>
    <div><span class="k">Patient Name:</span> ${esc(mlcCase.patients?.full_name)}</div>
    <div><span class="k">UHID:</span> ${esc(mlcCase.patients?.uhid)}</div>
    <div><span class="k">Case Type:</span> ${esc(mlcCase.case_type?.replace(/_/g, ' '))}</div>
    <div><span class="k">Incident Date:</span> ${mlcCase.incident_date ? new Date(mlcCase.incident_date).toLocaleDateString() : '—'}</div>
    <div><span class="k">Intimation Reference:</span> ${esc(mlcCase.intimation_reference)}</div>
    <div><span class="k">Case Status:</span> ${esc(mlcCase.status?.replace(/_/g, ' '))}</div>
  </div>

  <div class="box">
    <strong>Incident details:</strong><br/>
    ${esc(mlcCase.incident_details)}
  </div>

  <p style="margin-top:16px;">Kindly acknowledge receipt of this intimation and take necessary action as per procedure.</p>

  <div class="sig">
    <div>Reporting Doctor / MRD Officer</div>
    <div>Date &amp; Hospital Seal</div>
  </div>

  <button onclick="window.print()" style="margin-top:24px;padding:8px 16px;">Print</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}
