import { supabase } from './supabaseClient';

function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

/** Prints the optical counter/patient copy of a spectacle order — frame,
 * lens spec and prescription, the same slip a patient would traditionally
 * carry between the eye clinic and the optical shop. */
export async function printOpticalOrderSlip(order: any) {
  const { data: patient } = await supabase.from('patients').select('full_name, uhid, phone').eq('id', order.patient_id).single();
  const { data: hospital } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();

  const win = window.open('', '_blank', 'width=650,height=850');
  if (!win) return;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Optical Order — ${esc(order.order_number)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 620px; margin: 30px auto; padding: 0 20px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .muted { color: #666; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #eee; text-align: center; }
  th:first-child, td:first-child { text-align: left; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 13px; margin-top: 8px; }
  .grid div span.k { color: #666; }
  .total { margin-top: 14px; font-size: 18px; font-weight: 700; text-align: right; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>${esc(hospital?.hospital_name ?? 'Netra Eye Hospital')} — Optical</h1>
  <div class="muted">${esc(hospital?.address)} ${hospital?.phone ? '· ' + esc(hospital.phone) : ''}</div>
  <div class="muted" style="margin-top:6px;">Order ${esc(order.order_number)} · ${new Date(order.created_at).toLocaleString()}</div>

  <div class="grid">
    <div><span class="k">Patient:</span> ${esc(patient?.full_name)} (${esc(patient?.uhid)})</div>
    <div><span class="k">Phone:</span> ${esc(patient?.phone)}</div>
    <div><span class="k">Frame:</span> ${esc(order.frame_brand)} ${esc(order.frame_model)}</div>
    <div><span class="k">Lens:</span> ${esc(order.lens_type?.replace(/_/g, ' '))} ${order.lens_coating ? `(${esc(order.lens_coating)})` : ''}</div>
    <div><span class="k">Estimated ready:</span> ${order.eta_date ? new Date(order.eta_date).toLocaleDateString() : '—'}</div>
    <div><span class="k">Status:</span> ${esc(order.status)}</div>
  </div>

  <table>
    <thead><tr><th>Eye</th><th>Sphere</th><th>Cylinder</th><th>Axis</th></tr></thead>
    <tbody>
      <tr><td>OD</td><td>${esc(order.rx_sphere_od)}</td><td>${esc(order.rx_cylinder_od)}</td><td>${esc(order.rx_axis_od)}</td></tr>
      <tr><td>OS</td><td>${esc(order.rx_sphere_os)}</td><td>${esc(order.rx_cylinder_os)}</td><td>${esc(order.rx_axis_os)}</td></tr>
    </tbody>
  </table>

  <div class="total">Total: ₹${Number(order.total_amount ?? 0).toFixed(2)}</div>

  <button onclick="window.print()" style="margin-top:24px;padding:8px 16px;">Print</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}
