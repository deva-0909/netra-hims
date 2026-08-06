import { supabase } from './supabaseClient';

function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

interface DailyReportArgs {
  admission: { id: string; admitted_at: string; beds?: { bed_number?: string; ward?: string } };
  patient: { full_name?: string; uhid?: string; date_of_birth?: string; gender?: string; known_allergies?: string };
  doctorName: string | null;
  dateKey: string;        // yyyy-mm-dd, the calendar day this report covers
  dayNumber: number;      // 1-based day of stay
  vitalsForDay: any[];    // ward_vitals rows recorded on dateKey, any order
  staffNames: Record<string, string>; // profile id -> full_name, for "recorded by"
}

/** One admitted patient, one calendar day — the actual "daily monitoring
 * report" a ward nurse hands over at shift change or a doctor reviews on
 * rounds. Distinct from the discharge summary (whole-stay, generated once
 * at the end): this is generated on demand for any single day of the stay,
 * so it works mid-admission too. */
export async function printDailyMonitoringReport({ admission, patient, doctorName, dateKey, dayNumber, vitalsForDay, staffNames }: DailyReportArgs) {
  const { data: hospital } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();

  const win = window.open('', '_blank', 'width=850,height=1000');
  if (!win) return;

  const sorted = [...vitalsForDay].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

  const vitalsHtml = sorted.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:6px;">
        <tr>
          <th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ccc;">Time</th>
          <th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ccc;">BP</th>
          <th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ccc;">Pulse</th>
          <th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ccc;">Temp</th>
          <th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ccc;">SpO2</th>
          <th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ccc;">Notes</th>
          <th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ccc;">Recorded by</th>
        </tr>
        ${sorted.map((v: any) => `
          <tr>
            <td style="padding:4px 8px;">${new Date(v.recorded_at).toLocaleTimeString()}</td>
            <td style="padding:4px 8px;">${esc(v.blood_pressure)}</td>
            <td style="padding:4px 8px;">${esc(v.pulse)}</td>
            <td style="padding:4px 8px;">${esc(v.temperature)}</td>
            <td style="padding:4px 8px;">${esc(v.spo2)}</td>
            <td style="padding:4px 8px;">${esc(v.notes)}</td>
            <td style="padding:4px 8px;">${esc(staffNames[v.recorded_by] ?? '—')}</td>
          </tr>
        `).join('')}
      </table>`
    : '<p style="color:#999;font-size:13px;">No vitals recorded on this day.</p>';

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Daily Monitoring Report — ${esc(patient.full_name)} — Day ${dayNumber}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 800px; margin: 30px auto; padding: 0 20px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  h2 { font-size: 15px; margin: 20px 0 4px; border-bottom: 2px solid #333; padding-bottom: 4px; }
  .muted { color: #666; font-size: 13px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 13px; margin-top: 6px; }
  .grid div span.k { color: #666; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>${esc(hospital?.hospital_name ?? 'Netra Eye Hospital')}</h1>
  <div class="muted">${esc(hospital?.address)} ${hospital?.phone ? '· ' + esc(hospital.phone) : ''}</div>
  <div class="muted" style="margin-top:6px;">Daily Monitoring Report — Day ${dayNumber} of admission (${new Date(dateKey).toLocaleDateString()}) — generated ${new Date().toLocaleString()}</div>

  <h2>Patient Details</h2>
  <div class="grid">
    <div><span class="k">Name:</span> ${esc(patient.full_name)}</div>
    <div><span class="k">UHID:</span> ${esc(patient.uhid)}</div>
    <div><span class="k">DOB / Gender:</span> ${esc(patient.date_of_birth)} / ${esc(patient.gender)}</div>
    <div><span class="k">Known Allergies:</span> ${esc(patient.known_allergies)}</div>
  </div>

  <h2>Admission Details</h2>
  <div class="grid">
    <div><span class="k">Bed / Ward:</span> ${esc(admission.beds?.bed_number)} ${admission.beds?.ward ? `(${esc(admission.beds.ward)})` : ''}</div>
    <div><span class="k">Admitted:</span> ${new Date(admission.admitted_at).toLocaleString()}</div>
    <div><span class="k">Attending doctor:</span> ${esc(doctorName)}</div>
    <div><span class="k">Report covers:</span> Day ${dayNumber}</div>
  </div>

  <h2>Vitals &amp; Nursing Observations</h2>
  ${vitalsHtml}

  <div style="margin-top:40px;display:flex;justify-content:space-between;font-size:13px;">
    <div>Nurse's signature: _______________________</div>
    <div>Doctor's signature: _______________________</div>
  </div>

  <button onclick="window.print()" style="margin-top:24px;padding:8px 16px;">Print / Save as PDF</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}
