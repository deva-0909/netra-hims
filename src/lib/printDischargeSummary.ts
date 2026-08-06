import { supabase } from './supabaseClient';

function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

/** Fetches everything about an admission itself — the single most
 * traditionally paper document in a hospital, so this is what a paperless
 * admission flow has to produce. Only needs the admission id: called the
 * same way from the Ward Census and from a visit's Admission/OT/Recovery
 * tab, so both surfaces produce an identical, complete summary. */
export async function printDischargeSummary(admissionId: string) {
  const { data: admission } = await supabase.from('admissions').select('*, beds(bed_number, ward)').eq('id', admissionId).single();
  if (!admission) return;
  const { data: visit } = await supabase.from('visits').select('patient_id').eq('id', admission.visit_id).single();
  const { data: patient } = await supabase.from('patients').select('*').eq('id', visit!.patient_id).single();
  const { data: hospital } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();
  const { data: otRecords } = await supabase.from('ot_records').select('*, recovery_records(*)').eq('admission_id', admissionId).order('start_time', { ascending: true });
  const { data: wardVitals } = await supabase.from('ward_vitals').select('*').eq('admission_id', admissionId).order('recorded_at', { ascending: true });
  const { data: progressNotes } = await supabase.from('ipd_progress_notes').select('*, profiles(full_name)').eq('admission_id', admissionId).order('created_at', { ascending: true });

  const surgeonIds = [...new Set((otRecords ?? []).map((o: any) => o.surgeon_id).filter(Boolean))];
  const { data: surgeons } = surgeonIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', surgeonIds)
    : { data: [] };
  const surgeonName = (id: string) => surgeons?.find((s: any) => s.id === id)?.full_name ?? '—';

  const win = window.open('', '_blank', 'width=850,height=1000');
  if (!win) return;

  const otHtml = (otRecords ?? []).length
    ? otRecords!.map((ot: any) => `
        <h3 style="font-size:14px;margin:14px 0 4px;">${esc(ot.procedure_name)} — ${esc(ot.eye?.toUpperCase())}</h3>
        <div class="grid">
          <div><span class="k">Surgeon:</span> ${esc(surgeonName(ot.surgeon_id))}</div>
          <div><span class="k">OT room:</span> ${esc(ot.ot_room)}</div>
          <div><span class="k">Status:</span> ${esc(ot.status)}</div>
          <div><span class="k">Complications:</span> ${esc(ot.complications)}</div>
        </div>
        ${ot.intra_op_notes ? `<p style="font-size:13px;margin-top:4px;"><span class="k">Intra-op notes:</span> ${esc(ot.intra_op_notes)}</p>` : ''}
        ${(ot.recovery_records ?? []).map((r: any) => `
          <p style="font-size:13px;margin-top:4px;">Recovery — pain ${esc(r.pain_score)}/10${r.vitals_notes ? `, ${esc(r.vitals_notes)}` : ''} (${new Date(r.recorded_at).toLocaleString()})</p>
          ${r.discharge_instructions ? `<div style="background:#f6f8f7;border:1px solid #dde5e1;border-radius:4px;padding:10px;margin-top:6px;"><strong>Discharge instructions:</strong> ${esc(r.discharge_instructions)}</div>` : ''}
        `).join('')}
      `).join('')
    : '<p style="color:#999;font-size:13px;">No OT record on this admission.</p>';

  const vitalsHtml = (wardVitals ?? []).length
    ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:6px;">
        <tr><th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ccc;">Time</th><th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ccc;">BP</th><th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ccc;">Pulse</th><th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ccc;">Temp</th><th style="text-align:left;padding:4px 8px;border-bottom:1px solid #ccc;">SpO2</th></tr>
        ${wardVitals!.map((v: any) => `<tr><td style="padding:4px 8px;">${new Date(v.recorded_at).toLocaleString()}</td><td style="padding:4px 8px;">${esc(v.blood_pressure)}</td><td style="padding:4px 8px;">${esc(v.pulse)}</td><td style="padding:4px 8px;">${esc(v.temperature)}</td><td style="padding:4px 8px;">${esc(v.spo2)}</td></tr>`).join('')}
      </table>`
    : '<p style="color:#999;font-size:13px;">No ward vitals recorded.</p>';

  const progressNotesHtml = (progressNotes ?? []).length
    ? progressNotes!.map((n: any) => `
        <div style="margin-top:8px;">
          <div class="muted" style="font-size:12px;">${new Date(n.created_at).toLocaleString()} — Dr. ${esc(n.profiles?.full_name)}</div>
          <p style="font-size:13px;margin:2px 0;">${esc(n.clinical_notes)}</p>
          ${n.plan ? `<p style="font-size:13px;margin:2px 0;"><span class="k">Plan:</span> ${esc(n.plan)}</p>` : ''}
        </div>
      `).join('')
    : '<p style="color:#999;font-size:13px;">No progress notes recorded.</p>';

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Discharge Summary — ${esc(patient?.full_name)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 800px; margin: 30px auto; padding: 0 20px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  h2 { font-size: 15px; margin: 20px 0 4px; border-bottom: 2px solid #333; padding-bottom: 4px; }
  h3 { color: #2f6f62; }
  .muted { color: #666; font-size: 13px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 13px; margin-top: 6px; }
  .grid div span.k { color: #666; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>${esc(hospital?.hospital_name ?? 'Netra Eye Hospital')}</h1>
  <div class="muted">${esc(hospital?.address)} ${hospital?.phone ? '· ' + esc(hospital.phone) : ''}</div>
  <div class="muted" style="margin-top:6px;">Discharge Summary — generated ${new Date().toLocaleString()}</div>

  <h2>Patient Details</h2>
  <div class="grid">
    <div><span class="k">Name:</span> ${esc(patient?.full_name)}</div>
    <div><span class="k">UHID:</span> ${esc(patient?.uhid)}</div>
    <div><span class="k">DOB / Gender:</span> ${esc(patient?.date_of_birth)} / ${esc(patient?.gender)}</div>
    <div><span class="k">Known Allergies:</span> ${esc(patient?.known_allergies)}</div>
  </div>

  <h2>Admission Details</h2>
  <div class="grid">
    <div><span class="k">Bed / Ward:</span> ${esc(admission.beds?.bed_number)} ${admission.beds?.ward ? `(${esc(admission.beds.ward)})` : ''}</div>
    <div><span class="k">Admitted:</span> ${new Date(admission.admitted_at).toLocaleString()}</div>
    <div><span class="k">Discharged:</span> ${admission.discharged_at ? new Date(admission.discharged_at).toLocaleString() : 'Not yet discharged'}</div>
    <div><span class="k">Consent:</span> ${admission.consent_signed ? 'Signed' : 'Pending'}</div>
  </div>

  <h2>Procedure &amp; Recovery</h2>
  ${otHtml}

  <h2>Doctor's Progress Notes</h2>
  ${progressNotesHtml}

  <h2>Ward Vitals</h2>
  ${vitalsHtml}

  <button onclick="window.print()" style="margin-top:24px;padding:8px 16px;">Print / Save as PDF</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}
