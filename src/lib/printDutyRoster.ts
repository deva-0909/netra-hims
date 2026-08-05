import { supabase } from './supabaseClient';

function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

/** Prints the upcoming duty roster as a notice-board sheet — what actually
 * goes up on the staff room wall instead of everyone checking the app. */
export async function printDutyRoster(rows: any[]) {
  const { data: hospital } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();

  const win = window.open('', '_blank', 'width=800,height=900');
  if (!win) return;

  const byDate = new Map<string, any[]>();
  for (const r of rows) {
    const list = byDate.get(r.roster_date) ?? [];
    list.push(r);
    byDate.set(r.roster_date, list);
  }

  const sectionsHtml = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, entries]) => `
      <h3>${new Date(date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
      <table>
        <thead><tr><th>Employee</th><th>Shift</th><th>Department</th></tr></thead>
        <tbody>
          ${entries.map((r) => `<tr>
            <td>${esc(r.employees?.profiles?.full_name)}</td>
            <td>${r.shift_templates ? `${esc(r.shift_templates.name)} (${esc(r.shift_templates.start_time)}–${esc(r.shift_templates.end_time)})` : '—'}</td>
            <td>${esc(r.department)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    `)
    .join('');

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Duty Roster</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 720px; margin: 30px auto; padding: 0 20px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .muted { color: #666; font-size: 13px; }
  h3 { font-size: 14px; margin-top: 20px; margin-bottom: 4px; border-bottom: 2px solid #333; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 6px 8px; font-size: 11px; text-transform: uppercase; color: #666; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>${esc(hospital?.hospital_name ?? 'Netra Eye Hospital')} — Duty Roster</h1>
  <div class="muted">Generated ${new Date().toLocaleString()}</div>

  ${sectionsHtml || '<p style="color:#999;">Nothing scheduled.</p>'}

  <button onclick="window.print()" style="margin-top:24px;padding:8px 16px;">Print</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}
