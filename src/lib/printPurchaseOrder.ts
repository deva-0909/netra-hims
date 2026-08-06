import { supabase } from './supabaseClient';

function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

/** Prints a formal purchase order document — what procurement actually sends
 * to (or hands) a vendor, rather than just tracking the PO internally. */
export async function printPurchaseOrder(po: any) {
  const { data: vendor } = await supabase.from('vendors').select('*').eq('id', po.vendor_id).maybeSingle();
  const { data: items } = await supabase.from('purchase_order_items').select('*').eq('po_id', po.id);
  const { data: hospital } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();

  const win = window.open('', '_blank', 'width=700,height=850');
  if (!win) return;

  const lineTotal = (it: any) => (it.unit_price ? Number(it.unit_price) * Number(it.quantity) * (1 + Number(it.tax_percent ?? 0) / 100) : null);

  const rowsHtml = (items ?? [])
    .map((it: any) => {
      const amount = lineTotal(it);
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${esc(it.item_description)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${esc(it.quantity)} ${esc(it.unit)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${it.unit_price ? `₹${Number(it.unit_price).toFixed(2)}` : '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${Number(it.tax_percent ?? 0) > 0 ? `${it.tax_percent}%` : '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${amount != null ? `₹${amount.toFixed(2)}` : '—'}</td>
      </tr>`;
    })
    .join('');

  const total = (items ?? []).reduce((sum: number, it: any) => sum + (lineTotal(it) ?? 0), 0);

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Purchase Order — ${esc(po.po_number)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 680px; margin: 30px auto; padding: 0 20px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .muted { color: #666; font-size: 13px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 13px; margin-top: 16px; }
  .grid div span.k { color: #666; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th { text-align: left; padding: 6px 8px; border-bottom: 2px solid #333; font-size: 11px; text-transform: uppercase; }
  .total { margin-top: 12px; font-size: 18px; font-weight: 700; text-align: right; }
  .sign { margin-top: 60px; display: flex; justify-content: space-between; font-size: 12px; }
  .sign div { border-top: 1px solid #999; padding-top: 4px; width: 200px; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>${esc(hospital?.hospital_name ?? 'Netra Eye Hospital')}</h1>
  <div class="muted">${esc(hospital?.address)} ${hospital?.phone ? '· ' + esc(hospital.phone) : ''}</div>
  <h2 style="margin-top:16px;font-size:16px;">Purchase Order ${esc(po.po_number)}</h2>

  <div class="grid">
    <div><span class="k">Vendor:</span> ${esc(vendor?.name)}</div>
    <div><span class="k">GSTIN:</span> ${esc(vendor?.gstin)}</div>
    <div><span class="k">Vendor contact:</span> ${esc(vendor?.contact_person)} ${vendor?.phone ? `(${esc(vendor.phone)})` : ''}</div>
    <div><span class="k">Vendor email:</span> ${esc(vendor?.email)}</div>
    <div><span class="k">Order date:</span> ${po.order_date ? new Date(po.order_date).toLocaleDateString() : '—'}</div>
    <div><span class="k">Expected delivery:</span> ${po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString() : '—'}</div>
  </div>

  <table>
    <thead><tr><th>Item</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Unit price</th><th style="text-align:right;">GST</th><th style="text-align:right;">Amount</th></tr></thead>
    <tbody>${rowsHtml || '<tr><td colspan="5" style="padding:8px;color:#999;">No items</td></tr>'}</tbody>
  </table>
  <div class="total">Total: ₹${total.toFixed(2)}</div>

  ${po.notes ? `<div class="muted" style="margin-top:10px;">Notes: ${esc(po.notes)}</div>` : ''}

  <div class="sign">
    <div>Authorized signatory</div>
    <div>Vendor acknowledgement</div>
  </div>

  <button onclick="window.print()" style="margin-top:24px;padding:8px 16px;">Print</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}
