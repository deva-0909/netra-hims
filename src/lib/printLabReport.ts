import { supabase } from './supabaseClient';

function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

const FLAG_LABEL: Record<string, string> = { normal: 'Normal', low: 'Low', high: 'High', critical: 'CRITICAL' };

/** Prints a lab report — the document a patient walks out with, or that
 * gets filed as the paper record of what the lab found, instead of the
 * result only existing inside the app. */
export async function printLabReport(order: any, items: any[], patient: any) {
  const { data: hospital } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();

  const win = window.open('', '_blank', 'width=650,height=850');
  if (!win) return;

  const rows = items.map((it) => {
    const t = it.lab_test_catalog;
    const range = t?.result_type === 'qualitative'
      ? esc(t?.reference_text)
      : [t?.reference_low, t?.reference_high].every((v) => v != null) ? `${t.reference_low}–${t.reference_high}` : '—';
    const flagStyle = it.result_flag === 'critical' ? 'color:#8a2c2c;font-weight:700;' : it.result_flag && it.result_flag !== 'normal' ? 'color:#8a662c;font-weight:600;' : '';
    return `<tr>
      <td>${esc(t?.test_name)}</td>
      <td>${it.status === 'verified' || it.status === 'resulted' ? esc(it.result_value ?? it.result_numeric) : 'Pending'}</td>
      <td>${esc(t?.unit)}</td>
      <td>${range}</td>
      <td style="${flagStyle}">${it.result_flag ? FLAG_LABEL[it.result_flag] ?? it.result_flag : ''}</td>
    </tr>`;
  }).join('');

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Lab Report — ${esc(patient?.full_name)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 650px; margin: 30px auto; padding: 0 20px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .muted { color: #666; font-size: 13px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 13px; margin: 16px 0; }
  .grid div span.k { color: #666; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 12px; }
  th, td { border-bottom: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  th { background: #f5f5f5; }
  .note { margin-top: 16px; font-size: 12px; color: #666; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>${esc(hospital?.hospital_name ?? 'Netra Eye Hospital')} — Laboratory Report</h1>
  <div class="muted">${esc(hospital?.address)} ${hospital?.phone ? '· ' + esc(hospital.phone) : ''}</div>

  <div class="grid">
    <div><span class="k">Patient:</span> ${esc(patient?.full_name)} (${esc(patient?.uhid)})</div>
    <div><span class="k">Age/Sex:</span> ${esc(patient?.date_of_birth)} · ${esc(patient?.gender)}</div>
    <div><span class="k">Order date:</span> ${new Date(order.order_date).toLocaleString()}</div>
    <div><span class="k">Priority:</span> ${esc(order.priority)}</div>
  </div>

  <table>
    <thead><tr><th>Test</th><th>Result</th><th>Unit</th><th>Reference range</th><th>Flag</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  ${order.clinical_notes ? `<div class="note"><strong>Clinical notes:</strong> ${esc(order.clinical_notes)}</div>` : ''}
  <div class="note">This report is system-generated. Values outside the reference range should be correlated clinically.</div>

  <button onclick="window.print()" style="margin-top:24px;padding:8px 16px;">Print</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}
