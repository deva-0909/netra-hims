import { supabase } from './supabaseClient';

function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

interface ReceivedLine { item_description: string; unit: string | null; quantity_received: number }

/** The signed receiving document a "receive shipment" action should always
 * have produced — printed for the specific batch just confirmed, not the
 * PO's lifetime totals, so it works for a partial delivery too. */
export async function printGoodsReceivedNote(po: any, receivedLines: ReceivedLine[], receivedByName: string | null) {
  const { data: vendor } = await supabase.from('vendors').select('name, contact_person, phone').eq('id', po.vendor_id).maybeSingle();
  const { data: hospital } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();

  const win = window.open('', '_blank', 'width=700,height=850');
  if (!win) return;

  const rowsHtml = receivedLines
    .filter((l) => l.quantity_received > 0)
    .map((l) => `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${esc(l.item_description)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${esc(l.quantity_received)} ${esc(l.unit)}</td>
    </tr>`)
    .join('');

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Goods Received Note — ${esc(po.po_number)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 680px; margin: 30px auto; padding: 0 20px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .muted { color: #666; font-size: 13px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 13px; margin-top: 16px; }
  .grid div span.k { color: #666; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th { text-align: left; padding: 6px 8px; border-bottom: 2px solid #333; font-size: 11px; text-transform: uppercase; }
  .sign { margin-top: 60px; display: flex; justify-content: space-between; font-size: 12px; }
  .sign div { border-top: 1px solid #999; padding-top: 4px; width: 200px; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>${esc(hospital?.hospital_name ?? 'Netra Eye Hospital')}</h1>
  <div class="muted">${esc(hospital?.address)} ${hospital?.phone ? '· ' + esc(hospital.phone) : ''}</div>
  <h2 style="margin-top:16px;font-size:16px;">Goods Received Note — ${esc(po.po_number)}</h2>

  <div class="grid">
    <div><span class="k">Vendor:</span> ${esc(vendor?.name)}</div>
    <div><span class="k">Vendor contact:</span> ${esc(vendor?.contact_person)} ${vendor?.phone ? `(${esc(vendor.phone)})` : ''}</div>
    <div><span class="k">Received on:</span> ${new Date().toLocaleString()}</div>
    <div><span class="k">Received by:</span> ${esc(receivedByName)}</div>
  </div>

  <table>
    <thead><tr><th>Item</th><th style="text-align:right;">Quantity received</th></tr></thead>
    <tbody>${rowsHtml || '<tr><td colspan="2" style="padding:8px;color:#999;">Nothing recorded as received in this batch</td></tr>'}</tbody>
  </table>

  <div class="sign">
    <div>Received by (store)</div>
    <div>Vendor / delivery representative</div>
  </div>

  <button onclick="window.print()" style="margin-top:24px;padding:8px 16px;">Print</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}
