import { supabase } from './supabaseClient';

function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

/** Prints a referral slip for a community-camp screening flagged for
 * hospital follow-up — the paper the field team hands the person to bring
 * to the hospital, since they won't have a UHID yet. */
export async function printOutreachReferralSlip(screening: any, campName: string) {
  const { data: hospital } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();

  const win = window.open('', '_blank', 'width=650,height=850');
  if (!win) return;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Referral Slip — ${esc(screening.person_name)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 600px; margin: 30px auto; padding: 0 20px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .muted { color: #666; font-size: 13px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 13px; margin-top: 16px; }
  .grid div span.k { color: #666; }
  .box { border: 1px dashed #999; border-radius: 8px; padding: 12px; margin-top: 16px; font-size: 13px; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>${esc(hospital?.hospital_name ?? 'Netra Eye Hospital')} — Outreach Referral</h1>
  <div class="muted">${esc(hospital?.address)} ${hospital?.phone ? '· ' + esc(hospital.phone) : ''}</div>
  <div class="muted" style="margin-top:6px;">Camp: ${esc(campName)} · Screened ${new Date(screening.created_at).toLocaleDateString()}</div>

  <div class="grid">
    <div><span class="k">Name:</span> ${esc(screening.person_name)}</div>
    <div><span class="k">Age / Gender:</span> ${esc(screening.age)} / ${esc(screening.gender)}</div>
    <div><span class="k">Phone:</span> ${esc(screening.contact_phone)}</div>
    <div><span class="k">Village / area:</span> ${esc(screening.village_or_area)}</div>
  </div>

  <div class="box">
    <strong>Screening findings:</strong><br />
    ${esc(screening.screening_findings)}
  </div>

  <div class="muted" style="margin-top:20px;">Please bring this slip to the hospital registration desk for a full consultation.</div>

  <button onclick="window.print()" style="margin-top:24px;padding:8px 16px;">Print</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}
