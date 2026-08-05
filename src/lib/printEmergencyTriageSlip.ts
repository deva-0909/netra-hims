import { supabase } from './supabaseClient';

function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

const PRIORITY_LABEL: Record<string, string> = {
  critical: 'CRITICAL — immediate attention',
  urgent: 'URGENT — within the hour',
  semi_urgent: 'Semi-urgent — same day',
};

/** Prints a priority triage card for an emergency visit — the physical
 * handoff between the triage desk and the clinic, and a record for the
 * patient/attendant to carry. */
export async function printEmergencyTriageSlip(patient: any, visit: any, note: { chief_complaint: string; onset_description: string | null; priority: string }) {
  const { data: hospital } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();

  const win = window.open('', '_blank', 'width=600,height=750');
  if (!win) return;

  const isCritical = note.priority === 'critical';

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Emergency Triage — ${esc(patient.full_name)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 600px; margin: 30px auto; padding: 0 20px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .muted { color: #666; font-size: 13px; }
  .priority { display: inline-block; padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 15px; margin-top: 12px; ${isCritical ? 'background:#f6dede;color:#8a2c2c;' : 'background:#faf0d8;color:#8a662c;'} }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 13px; margin-top: 16px; }
  .grid div span.k { color: #666; }
  .box { border: 1px dashed #999; border-radius: 8px; padding: 12px; margin-top: 16px; font-size: 13px; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>${esc(hospital?.hospital_name ?? 'Netra Eye Hospital')} — Emergency Triage</h1>
  <div class="muted">${esc(hospital?.address)} ${hospital?.phone ? '· ' + esc(hospital.phone) : ''}</div>
  <div class="priority">${esc(PRIORITY_LABEL[note.priority] ?? note.priority)}</div>

  <div class="grid">
    <div><span class="k">Patient:</span> ${esc(patient.full_name)} (${esc(patient.uhid)})</div>
    <div><span class="k">Token:</span> ${esc(visit.token_number)}</div>
    <div><span class="k">DOB / Gender:</span> ${esc(patient.date_of_birth)} / ${esc(patient.gender)}</div>
    <div><span class="k">Triaged:</span> ${new Date().toLocaleString()}</div>
  </div>

  <div class="box">
    <strong>Chief complaint:</strong><br />${esc(note.chief_complaint)}
    ${note.onset_description ? `<br /><br /><strong>Onset / details:</strong><br />${esc(note.onset_description)}` : ''}
  </div>

  <button onclick="window.print()" style="margin-top:24px;padding:8px 16px;">Print</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}
