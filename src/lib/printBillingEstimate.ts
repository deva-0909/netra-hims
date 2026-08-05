function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

interface EstimateItem { description: string; category: string; quantity: string; unit_price: string; }
interface EstimateInput {
  patientName: string;
  patientUhid: string;
  hospitalName?: string;
  hospitalAddress?: string;
  hospitalPhone?: string;
  items: EstimateItem[];
  discount: number;
  tax: number;
  insuranceCovered: number;
}

/** Prints a non-binding cost estimate/quote for a proposed set of billing
 * line items — used to give a patient a figure before treatment is finalized
 * and a real bill is generated. Not persisted to the database. */
export function printBillingEstimate(input: EstimateInput) {
  const win = window.open('', '_blank', 'width=650,height=850');
  if (!win) return;

  const valid = input.items.filter((it) => it.description.trim());
  const subtotal = valid.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
  const total = Math.max(0, subtotal - input.discount + input.tax - input.insuranceCovered);

  const rowsHtml = valid
    .map((it) => {
      const amount = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${esc(it.description)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${esc(it.category)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${esc(it.quantity)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">₹${(Number(it.unit_price) || 0).toFixed(2)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">₹${amount.toFixed(2)}</td>
      </tr>`;
    })
    .join('');

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Cost Estimate — ${esc(input.patientName)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 640px; margin: 30px auto; padding: 0 20px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .muted { color: #666; font-size: 13px; }
  .watermark { display: inline-block; background: #fdf0d5; color: #8a5a1c; border-radius: 6px; padding: 2px 10px; font-size: 12px; font-weight: 600; margin-top: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th { text-align: left; padding: 6px 8px; border-bottom: 2px solid #333; font-size: 11px; text-transform: uppercase; }
  .totals { margin-top: 12px; font-size: 13px; }
  .totals div { display: flex; justify-content: space-between; max-width: 260px; margin-left: auto; padding: 2px 0; }
  .totals .grand { font-size: 18px; font-weight: 700; border-top: 1px solid #333; margin-top: 6px; padding-top: 6px; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>${esc(input.hospitalName ?? 'Netra Eye Hospital')}</h1>
  <div class="muted">${esc(input.hospitalAddress)} ${input.hospitalPhone ? '· ' + esc(input.hospitalPhone) : ''}</div>
  <div class="watermark">ESTIMATE — NOT A BILL</div>

  <div class="muted" style="margin-top:14px;">Patient: ${esc(input.patientName)} (${esc(input.patientUhid)})</div>
  <div class="muted">Generated ${new Date().toLocaleString()}</div>

  <table>
    <thead><tr><th>Description</th><th>Category</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Unit price</th><th style="text-align:right;">Amount</th></tr></thead>
    <tbody>${rowsHtml || '<tr><td colspan="5" style="padding:8px;color:#999;">No items</td></tr>'}</tbody>
  </table>

  <div class="totals">
    <div><span>Subtotal</span><span>₹${subtotal.toFixed(2)}</span></div>
    <div><span>Discount</span><span>-₹${input.discount.toFixed(2)}</span></div>
    <div><span>Tax / GST</span><span>₹${input.tax.toFixed(2)}</span></div>
    <div><span>Insurance covered</span><span>-₹${input.insuranceCovered.toFixed(2)}</span></div>
    <div class="grand"><span>Estimated total</span><span>₹${total.toFixed(2)}</span></div>
  </div>

  <div class="muted" style="margin-top:20px;font-size:11px;">This is a non-binding estimate. Final charges may vary based on actual treatment provided.</div>

  <button onclick="window.print()" style="margin-top:16px;padding:8px 16px;">Print</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}
