import { supabase } from './supabaseClient';

function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

/** Aggregate camp-level report — screened/referred counts and an age/gender
 * breakdown, the summary outreach coordinators hand to NGOs/donors, as
 * distinct from the per-person referral slip handed to the patient. */
export async function printCampSummary(camp: any) {
  const { data: hospital } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();
  const { data: screenings } = await supabase.from('camp_screenings').select('*').eq('camp_id', camp.id).order('created_at', { ascending: true });
  const rows = screenings ?? [];

  const totalScreened = rows.length;
  const totalReferred = rows.filter((s: any) => s.referred_to_hospital).length;
  const genderCounts: Record<string, number> = { male: 0, female: 0, other: 0, unspecified: 0 };
  rows.forEach((s: any) => { genderCounts[s.gender ?? 'unspecified']++; });

  const win = window.open('', '_blank', 'width=700,height=900');
  if (!win) return;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Camp Summary — ${esc(camp.camp_name)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 700px; margin: 30px auto; padding: 0 20px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .muted { color: #666; font-size: 13px; }
  .stats { display: flex; gap: 16px; margin: 20px 0; }
  .stat { border: 1px solid #ccc; border-radius: 8px; padding: 12px 16px; text-align: center; flex: 1; }
  .stat .n { font-size: 22px; font-weight: 600; }
  .stat .l { font-size: 12px; color: #666; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  th { background: #f4f4f4; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>${esc(hospital?.hospital_name ?? 'Netra Eye Hospital')} — Outreach Camp Summary</h1>
  <div class="muted">${esc(hospital?.address)} ${hospital?.phone ? '· ' + esc(hospital.phone) : ''}</div>
  <div class="muted" style="margin-top:6px;">Camp: ${esc(camp.camp_name)} · ${esc(camp.location)} · ${camp.camp_date ? new Date(camp.camp_date).toLocaleDateString() : '—'} · Organized by ${esc(camp.organized_by)}</div>

  <div class="stats">
    <div class="stat"><div class="n">${totalScreened}</div><div class="l">Screened</div></div>
    <div class="stat"><div class="n">${totalReferred}</div><div class="l">Referred to hospital</div></div>
    <div class="stat"><div class="n">${genderCounts.male}</div><div class="l">Male</div></div>
    <div class="stat"><div class="n">${genderCounts.female}</div><div class="l">Female</div></div>
    <div class="stat"><div class="n">${genderCounts.other + genderCounts.unspecified}</div><div class="l">Other / unspecified</div></div>
  </div>

  <table>
    <thead><tr><th>Name</th><th>Age/Gender</th><th>Village</th><th>Findings</th><th>Referred</th></tr></thead>
    <tbody>
      ${rows.map((s: any) => `<tr><td>${esc(s.person_name)}</td><td>${esc(s.age)} / ${esc(s.gender)}</td><td>${esc(s.village_or_area)}</td><td>${esc(s.screening_findings)}</td><td>${s.referred_to_hospital ? 'Yes' : 'No'}</td></tr>`).join('')}
    </tbody>
  </table>

  <button onclick="window.print()" style="margin-top:24px;padding:8px 16px;">Print</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}
