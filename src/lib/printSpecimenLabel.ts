import { generateQrDataUrl } from './generateQrDataUrl';

function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

/** Prints a small specimen label — sticks on the tube/sample at collection,
 * scannable back in at result entry (or by an interfaced analyzer that reads
 * the QR instead of an operator retyping the patient/test by hand). */
export async function printSpecimenLabel(specimenId: string, patientName: string, patientUhid: string, testName: string) {
  const qrDataUrl = await generateQrDataUrl(`${patientUhid}|${specimenId}`);

  const win = window.open('', '_blank', 'width=350,height=300');
  if (!win) return;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Specimen Label — ${esc(specimenId)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; margin: 12px; }
  .label { width: 260px; border: 1px solid #999; border-radius: 6px; padding: 8px; display: flex; gap: 8px; align-items: center; }
  .meta { font-size: 11px; line-height: 1.4; }
  .meta strong { font-size: 13px; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <div class="label">
    <img src="${qrDataUrl}" width="70" height="70" alt="Specimen QR" />
    <div class="meta">
      <strong>${esc(patientName)}</strong><br />
      UHID: ${esc(patientUhid)}<br />
      Test: ${esc(testName)}<br />
      Specimen: ${esc(specimenId)}
    </div>
  </div>
  <button onclick="window.print()" style="margin-top:14px;padding:8px 16px;">Print</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}
