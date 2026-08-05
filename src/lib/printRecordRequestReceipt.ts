import { supabase } from './supabaseClient';

function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

/** Prints an acknowledgement receipt for a logged medical-record disclosure
 * request — proof for the requestor that the request was received/issued,
 * and a paper trail for MRD's own register. */
export async function printRecordRequestReceipt(request: any) {
  const { data: hospital } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();
  const { data: authorizer } = request.authorized_by
    ? await supabase.from('profiles').select('full_name').eq('id', request.authorized_by).maybeSingle()
    : { data: null };

  const win = window.open('', '_blank', 'width=650,height=850');
  if (!win) return;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Record Request Receipt — ${esc(request.patients?.full_name)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 620px; margin: 30px auto; padding: 0 20px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .muted { color: #666; font-size: 13px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 13px; margin-top: 16px; }
  .grid div span.k { color: #666; }
  .sign { margin-top: 60px; display: flex; justify-content: space-between; font-size: 12px; }
  .sign div { border-top: 1px solid #999; padding-top: 4px; width: 200px; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>${esc(hospital?.hospital_name ?? 'Netra Eye Hospital')} — Medical Records Department</h1>
  <div class="muted">${esc(hospital?.address)} ${hospital?.phone ? '· ' + esc(hospital.phone) : ''}</div>
  <div class="muted" style="margin-top:6px;">Record Request Receipt · Logged ${new Date(request.created_at).toLocaleString()}</div>

  <div class="grid">
    <div><span class="k">Patient:</span> ${esc(request.patients?.full_name)} (${esc(request.patients?.uhid)})</div>
    <div><span class="k">Status:</span> ${esc(request.status)}</div>
    <div><span class="k">Requestor type:</span> ${esc(String(request.requestor_type).replace(/_/g, ' '))}</div>
    <div><span class="k">Requestor name:</span> ${esc(request.requestor_name)}</div>
    <div style="grid-column: span 2;"><span class="k">Purpose:</span> ${esc(request.purpose)}</div>
    <div><span class="k">Authorized by:</span> ${esc(authorizer?.full_name)}</div>
    <div><span class="k">Issued at:</span> ${request.issued_at ? new Date(request.issued_at).toLocaleString() : '—'}</div>
  </div>

  <div class="sign">
    <div>Requestor signature</div>
    <div>MRD staff signature</div>
  </div>

  <button onclick="window.print()" style="margin-top:24px;padding:8px 16px;">Print</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}
