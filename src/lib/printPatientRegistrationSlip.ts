import { supabase } from './supabaseClient';

function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

/** Prints the patient's UHID registration slip — the card a walk-in patient
 * carries out of registration and back in on every future visit. */
export async function printPatientRegistrationSlip(patient: any) {
  const { data: hospital } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();

  const win = window.open('', '_blank', 'width=500,height=650');
  if (!win) return;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Registration Slip — ${esc(patient.full_name)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 400px; margin: 30px auto; padding: 0 20px; }
  h1 { font-size: 18px; margin-bottom: 2px; }
  .muted { color: #666; font-size: 12px; }
  .card { border: 2px solid #2f6f62; border-radius: 10px; padding: 16px; margin-top: 16px; }
  .uhid { font-size: 26px; font-weight: 700; color: #2f6f62; letter-spacing: 1px; }
  .grid { display: grid; grid-template-columns: 1fr; gap: 4px; font-size: 13px; margin-top: 10px; }
  .grid div span.k { color: #666; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>${esc(hospital?.hospital_name ?? 'Netra Eye Hospital')}</h1>
  <div class="muted">${esc(hospital?.address)} ${hospital?.phone ? '· ' + esc(hospital.phone) : ''}</div>

  <div class="card">
    <div class="uhid">${esc(patient.uhid)}</div>
    <div class="grid">
      <div><span class="k">Name:</span> ${esc(patient.full_name)}</div>
      <div><span class="k">DOB:</span> ${patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : '—'} · <span class="k">Gender:</span> ${esc(patient.gender)}</div>
      <div><span class="k">Phone:</span> ${esc(patient.phone)}</div>
      <div><span class="k">Registered:</span> ${new Date(patient.created_at ?? Date.now()).toLocaleDateString()}</div>
    </div>
  </div>

  <div class="muted" style="margin-top:14px;">Please bring this slip (or quote your UHID) on every future visit.</div>

  <button onclick="window.print()" style="margin-top:20px;padding:8px 16px;">Print</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}
