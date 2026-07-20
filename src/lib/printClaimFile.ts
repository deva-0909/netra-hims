import type { ClaimFileData } from './fetchClaimFileData';

function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

function kvRows(rows: Record<string, any>): string {
  return Object.entries(rows)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `<tr><td style="padding:4px 8px;color:#666;width:180px;">${esc(k)}</td><td style="padding:4px 8px;">${esc(typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v)}</td></tr>`)
    .join('');
}

export function printClaimFile(data: ClaimFileData) {
  const win = window.open('', '_blank', 'width=850,height=1000');
  if (!win) return;

  const { patient, visit, hospital, clinicalSummary, surgery, investigations, bill, claim, documents } = data;

  const clinicalHtml = clinicalSummary.length
    ? clinicalSummary.map((section) => `
        <h3 style="font-size:14px;margin:16px 0 6px;">${esc(section.label)}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">${kvRows(section.rows)}</table>
      `).join('')
    : '<p style="color:#999;font-size:13px;">No clinical records found for this visit.</p>';

  const surgeryHtml = surgery.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px;">
        <tr><th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ccc;">Procedure</th><th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ccc;">Eye</th><th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ccc;">Urgency</th></tr>
        ${surgery.map((s: any) => `<tr><td style="padding:4px 8px;">${esc(s.procedure_name)}</td><td style="padding:4px 8px;">${esc(s.eye)}</td><td style="padding:4px 8px;">${esc(s.urgency)}</td></tr>`).join('')}
      </table>`
    : '';

  const investigationsHtml = investigations.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px;">
        <tr><th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ccc;">Test</th><th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ccc;">Status</th><th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ccc;">Result</th></tr>
        ${investigations.map((i: any) => `<tr><td style="padding:4px 8px;">${esc(i.test_name)}</td><td style="padding:4px 8px;">${esc(i.status)}</td><td style="padding:4px 8px;">${esc(i.result)}</td></tr>`).join('')}
      </table>`
    : '<p style="color:#999;font-size:13px;">None on record.</p>';

  const billItemsHtml = bill?.bill_items?.length
    ? bill.bill_items.map((it: any) => `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;">${esc(it.description)}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${it.quantity}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">₹${Number(it.unit_price).toFixed(2)}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">₹${Number(it.amount).toFixed(2)}</td></tr>`).join('')
    : '';

  const documentsHtml = documents.length
    ? `<ul style="font-size:13px;">${documents.map((d) => `<li><a href="${esc(d.url)}">${esc(d.label)}</a></li>`).join('')}</ul>`
    : '<p style="color:#999;font-size:13px;">No supporting documents attached to this visit.</p>';

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Insurance Claim File — ${esc(patient.full_name)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 760px; margin: 30px auto; padding: 0 20px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  h2 { font-size: 15px; margin: 20px 0 4px; border-bottom: 2px solid #333; padding-bottom: 4px; }
  h3 { color: #2f6f62; }
  .muted { color: #666; font-size: 13px; }
  table th { font-size: 11px; text-transform: uppercase; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 13px; margin-top: 6px; }
  .grid div span.k { color: #666; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>${esc(hospital?.hospital_name ?? 'Netra Eye Hospital')}</h1>
  <div class="muted">${esc(hospital?.address)} ${hospital?.phone ? '· ' + esc(hospital.phone) : ''}</div>
  <div class="muted" style="margin-top:6px;">Insurance Claim File — generated ${new Date().toLocaleString()}</div>

  <h2>Patient & Policy Details</h2>
  <div class="grid">
    <div><span class="k">Name:</span> ${esc(patient.full_name)}</div>
    <div><span class="k">UHID:</span> ${esc(patient.uhid)}</div>
    <div><span class="k">DOB / Gender:</span> ${esc(patient.date_of_birth)} / ${esc(patient.gender)}</div>
    <div><span class="k">Phone:</span> ${esc(patient.phone)}</div>
    <div><span class="k">ABHA ID:</span> ${esc(patient.abha_id)}</div>
    <div><span class="k">Golden Card ID:</span> ${esc(patient.golden_card_id)}</div>
    <div><span class="k">Insurance Provider:</span> ${esc(claim?.scheme ?? patient.insurance_provider)}</div>
    <div><span class="k">Policy / Card No.:</span> ${esc(claim?.policy_or_card_no ?? patient.insurance_policy_no)}</div>
  </div>

  <h2>Visit Details</h2>
  <div class="grid">
    <div><span class="k">Department:</span> ${esc(visit.clinic_module)}</div>
    <div><span class="k">Visit Date:</span> ${new Date(visit.created_at).toLocaleDateString()}</div>
    <div><span class="k">Token:</span> ${esc(visit.token_number)}</div>
    <div><span class="k">Stage:</span> ${esc(visit.stage)}</div>
  </div>

  <h2>Clinical Summary</h2>
  ${clinicalHtml}

  ${surgery.length ? `<h2>Surgery / Procedure Recommended</h2>${surgeryHtml}` : ''}

  <h2>Investigations</h2>
  ${investigationsHtml}

  <h2>Billing Summary</h2>
  ${bill ? `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr><th style="text-align:left;padding:4px 8px;border-bottom:1px solid #333;">Description</th><th style="text-align:right;padding:4px 8px;border-bottom:1px solid #333;">Qty</th><th style="text-align:right;padding:4px 8px;border-bottom:1px solid #333;">Unit Price</th><th style="text-align:right;padding:4px 8px;border-bottom:1px solid #333;">Amount</th></tr>
      ${billItemsHtml}
    </table>
    <div class="grid" style="margin-top:8px;">
      <div><span class="k">Bill No.:</span> ${esc(bill.bill_number)}</div>
      <div><span class="k">Total Amount:</span> ₹${Number(bill.total_amount).toFixed(2)}</div>
      <div><span class="k">Insurance Covered:</span> ₹${Number(bill.insurance_covered).toFixed(2)}</div>
      <div><span class="k">Payment Status:</span> ${esc(bill.payment_status)}</div>
    </div>
  ` : '<p style="color:#999;font-size:13px;">No bill generated for this visit yet.</p>'}

  <h2>Insurance Claim Status</h2>
  ${claim ? `
    <div class="grid">
      <div><span class="k">Scheme:</span> ${esc(claim.scheme)}</div>
      <div><span class="k">Package:</span> ${esc(claim.package_selected)}</div>
      <div><span class="k">Claim Amount:</span> ₹${Number(claim.claim_amount ?? 0).toFixed(2)}</div>
      <div><span class="k">Approved Amount:</span> ₹${Number(claim.approved_amount ?? 0).toFixed(2)}</div>
      <div><span class="k">Status:</span> ${esc(claim.status)}</div>
      <div><span class="k">Pre-auth Reference:</span> ${esc(claim.pre_auth_reference)}</div>
    </div>
    ${claim.notes ? `<p style="font-size:13px;margin-top:8px;"><span class="k" style="color:#666;">Notes:</span> ${esc(claim.notes)}</p>` : ''}
  ` : '<p style="color:#999;font-size:13px;">No insurance claim record for this visit.</p>'}

  <h2>Supporting Documents</h2>
  ${documentsHtml}

  <button onclick="window.print()" style="margin-top:24px;padding:8px 16px;">Print / Save as PDF</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}
