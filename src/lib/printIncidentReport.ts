import { supabase } from './supabaseClient';

function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

/** Prints a formal incident report — the document quality/compliance files
 * for internal RCA review or hands to a regulator/accreditation body on
 * request, instead of the record only existing inside the app. */
export async function printIncidentReport(incident: any) {
  const { data: hospital } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();
  const { data: reporter } = incident.reported_by
    ? await supabase.from('profiles').select('full_name').eq('id', incident.reported_by).maybeSingle()
    : { data: null };
  const { data: reviewer } = incident.reviewed_by
    ? await supabase.from('profiles').select('full_name').eq('id', incident.reviewed_by).maybeSingle()
    : { data: null };

  const win = window.open('', '_blank', 'width=650,height=850');
  if (!win) return;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Incident Report — ${esc(incident.incident_type)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 620px; margin: 30px auto; padding: 0 20px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .muted { color: #666; font-size: 13px; }
  .severity { display: inline-block; padding: 4px 12px; border-radius: 6px; font-weight: 700; font-size: 13px; margin-top: 10px; background: #f6dede; color: #8a2c2c; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 13px; margin-top: 16px; }
  .grid div span.k { color: #666; }
  .box { border: 1px dashed #999; border-radius: 8px; padding: 12px; margin-top: 16px; font-size: 13px; }
  .sign { margin-top: 60px; display: flex; justify-content: space-between; font-size: 12px; }
  .sign div { border-top: 1px solid #999; padding-top: 4px; width: 200px; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>${esc(hospital?.hospital_name ?? 'Netra Eye Hospital')} — Incident Report</h1>
  <div class="muted">${esc(hospital?.address)} ${hospital?.phone ? '· ' + esc(hospital.phone) : ''}</div>
  <div class="severity">${esc(String(incident.incident_type).replace(/_/g, ' '))} — ${esc(incident.severity)} severity</div>

  <div class="grid">
    <div><span class="k">Date:</span> ${new Date(incident.incident_date).toLocaleString()}</div>
    <div><span class="k">Department:</span> ${esc(incident.department)}</div>
    <div><span class="k">Reported by:</span> ${esc(reporter?.full_name)}</div>
    <div><span class="k">Status:</span> ${esc(String(incident.status).replace(/_/g, ' '))}</div>
  </div>

  <div class="box">
    <strong>What happened:</strong><br />${esc(incident.description)}
  </div>
  ${incident.immediate_action_taken ? `<div class="box"><strong>Immediate action taken:</strong><br />${esc(incident.immediate_action_taken)}</div>` : ''}
  ${incident.review_notes ? `<div class="box"><strong>Review notes (${esc(reviewer?.full_name)}):</strong><br />${esc(incident.review_notes)}</div>` : ''}

  <div class="sign">
    <div>Reported by</div>
    <div>Quality Manager / reviewer</div>
  </div>

  <button onclick="window.print()" style="margin-top:24px;padding:8px 16px;">Print</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}
