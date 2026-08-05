import { supabase } from './supabaseClient';

function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

/** Fetches patient/hospital/prescriber context and renders a printable
 * takeaway slip for one prescription — what the patient actually walks out
 * of pharmacy with, or takes to an outside pharmacy if a drug is unavailable. */
export async function printPrescriptionSlip(visitId: string, rx: any) {
  const { data: visit } = await supabase.from('visits').select('patient_id').eq('id', visitId).single();
  const { data: patient } = await supabase.from('patients').select('*').eq('id', visit!.patient_id).single();
  const { data: hospital } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();
  const { data: prescriber } = rx.prescribed_by
    ? await supabase.from('profiles').select('full_name').eq('id', rx.prescribed_by).maybeSingle()
    : { data: null };

  const win = window.open('', '_blank', 'width=650,height=850');
  if (!win) return;

  const itemsHtml = (rx.prescription_items ?? [])
    .map((it: any) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${esc(it.drugs?.name ?? it.drug_name_freetext)}${!it.drug_id ? ' <span style="color:#999;font-size:11px;">(not in catalog)</span>' : ''}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${esc(it.quantity)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${esc(it.dosage)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${esc(it.frequency)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${it.duration_days ? `${it.duration_days} days` : '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${it.eye && it.eye !== 'n/a' ? esc(it.eye).toUpperCase() : '—'}</td>
      </tr>
      ${it.instructions ? `<tr><td colspan="6" style="padding:0 8px 6px;color:#666;font-size:12px;">↳ ${esc(it.instructions)}</td></tr>` : ''}
    `)
    .join('');

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Prescription — ${esc(patient?.full_name)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 640px; margin: 30px auto; padding: 0 20px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .muted { color: #666; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th { text-align: left; padding: 6px 8px; border-bottom: 2px solid #333; font-size: 11px; text-transform: uppercase; }
  .rx-mark { font-size: 28px; font-weight: 700; color: #2f6f62; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>${esc(hospital?.hospital_name ?? 'Netra Eye Hospital')}</h1>
  <div class="muted">${esc(hospital?.address)} ${hospital?.phone ? '· ' + esc(hospital.phone) : ''}</div>
  <div class="muted" style="margin-top:6px;">Prescribed by ${esc(prescriber?.full_name)} · ${new Date(rx.created_at).toLocaleString()}</div>

  <div class="muted" style="margin-top:14px;">Patient: ${esc(patient?.full_name)} (${esc(patient?.uhid)})</div>
  <div class="muted">${esc(patient?.date_of_birth)} · ${esc(patient?.gender)} ${patient?.known_allergies ? `· Allergies: ${esc(patient.known_allergies)}` : ''}</div>

  <div class="rx-mark" style="margin-top:16px;">℞</div>
  <table>
    <thead><tr><th>Drug</th><th style="text-align:right;">Qty</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Eye</th></tr></thead>
    <tbody>${itemsHtml || '<tr><td colspan="6" style="padding:8px;color:#999;">No items</td></tr>'}</tbody>
  </table>

  <button onclick="window.print()" style="margin-top:24px;padding:8px 16px;">Print</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}
