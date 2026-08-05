import { supabase } from './supabaseClient';

function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

/** Prints a staff ID card — the physical badge HR hands over on joining, or
 * reprints on request. Two copies side by side, meant to be cut and folded/laminated. */
export async function printEmployeeIdCard(emp: any) {
  const { data: hospital } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();

  const win = window.open('', '_blank', 'width=500,height=650');
  if (!win) return;

  const card = `
    <div class="card">
      <div class="hospital">${esc(hospital?.hospital_name ?? 'Netra Eye Hospital')}</div>
      <div class="role">${esc(emp.designation) || esc(emp.profiles?.role?.replace(/_/g, ' '))}</div>
      <div class="name">${esc(emp.profiles?.full_name)}</div>
      <div class="code">${esc(emp.employee_code)}</div>
      <div class="grid">
        <div><span class="k">DOJ:</span> ${emp.date_of_joining ? new Date(emp.date_of_joining).toLocaleDateString() : '—'}</div>
        <div><span class="k">Emergency contact:</span> ${esc(emp.emergency_contact_name)} ${emp.emergency_contact_phone ? `(${esc(emp.emergency_contact_phone)})` : ''}</div>
      </div>
    </div>`;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>ID Card — ${esc(emp.profiles?.full_name)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; margin: 30px auto; padding: 0 20px; }
  .card { width: 340px; border: 2px solid #2f6f62; border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; }
  .hospital { font-size: 13px; font-weight: 700; color: #2f6f62; text-transform: uppercase; letter-spacing: 0.5px; }
  .role { font-size: 11px; color: #666; margin-top: 6px; text-transform: uppercase; }
  .name { font-size: 19px; font-weight: 700; margin-top: 2px; }
  .code { font-size: 13px; color: #444; margin-top: 2px; font-family: monospace; }
  .grid { margin-top: 10px; font-size: 11px; display: flex; flex-direction: column; gap: 2px; }
  .grid span.k { color: #888; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  ${card}
  ${card}
  <button onclick="window.print()" style="margin-top:10px;padding:8px 16px;">Print</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}
