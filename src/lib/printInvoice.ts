interface InvoiceBill {
  bill_number: string;
  subtotal: number;
  discount: number;
  tax: number;
  insurance_covered: number;
  total_amount: number;
  amount_paid: number;
  payment_status: string;
  created_at: string;
  bill_items?: { description: string; quantity: number; unit_price: number; amount: number }[];
}

interface InvoicePatient {
  full_name: string;
  uhid: string;
}

export function printInvoice(bill: InvoiceBill, patient: InvoicePatient) {
  const win = window.open('', '_blank', 'width=700,height=900');
  if (!win) return;

  const rows = (bill.bill_items ?? [])
    .map(
      (it) => `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${escapeHtml(it.description)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;text-align:right;">${it.quantity}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;text-align:right;">₹${Number(it.unit_price).toFixed(2)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;text-align:right;">₹${Number(it.amount).toFixed(2)}</td>
      </tr>`
    )
    .join('');

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Invoice ${escapeHtml(bill.bill_number)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 640px; margin: 40px auto; padding: 0 20px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .muted { color: #666; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th { text-align: left; padding: 6px 8px; border-bottom: 2px solid #333; font-size: 12px; text-transform: uppercase; }
  th:not(:first-child), td:not(:first-child) { text-align: right; }
  .totals { margin-top: 16px; margin-left: auto; width: 260px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; }
  .totals .grand { font-weight: 700; font-size: 16px; border-top: 1px solid #333; margin-top: 6px; padding-top: 8px; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>Netra HIMS — 360° Eye Hospital</h1>
  <div class="muted">Invoice ${escapeHtml(bill.bill_number)} · ${new Date(bill.created_at).toLocaleDateString()}</div>
  <div class="muted">Patient: ${escapeHtml(patient.full_name)} (${escapeHtml(patient.uhid)})</div>

  <table>
    <thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4" style="padding:8px;color:#999;">No line items</td></tr>'}</tbody>
  </table>

  <div class="totals">
    <div><span>Subtotal</span><span>₹${Number(bill.subtotal).toFixed(2)}</span></div>
    <div><span>Discount</span><span>-₹${Number(bill.discount).toFixed(2)}</span></div>
    <div><span>Tax</span><span>+₹${Number(bill.tax).toFixed(2)}</span></div>
    <div><span>Insurance covered</span><span>-₹${Number(bill.insurance_covered).toFixed(2)}</span></div>
    <div class="grand"><span>Total</span><span>₹${Number(bill.total_amount).toFixed(2)}</span></div>
    <div><span>Paid</span><span>₹${Number(bill.amount_paid).toFixed(2)}</span></div>
    <div><span>Status</span><span>${escapeHtml(bill.payment_status.replace(/_/g, ' '))}</span></div>
  </div>

  <button onclick="window.print()" style="margin-top:24px;padding:8px 16px;">Print</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}
