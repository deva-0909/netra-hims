import type { ConsultationReportData } from './fetchConsultationReportData';

function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

const DIAGRAM_LABELS: Record<string, string> = {
  fundus: 'Fundus (clock-hour)',
  optic_disc: 'Optic Disc & Cup',
  anterior_segment: 'Anterior Segment',
  ocular_motility: 'Ocular Motility',
};

export function printConsultationReport(data: ConsultationReportData) {
  const win = window.open('', '_blank', 'width=850,height=1000');
  if (!win) return;

  const { patient, visit, hospital, moduleLabel, findings, diagrams, images } = data;

  const findingsHtml = findings.length
    ? findings.map((section) => `
        <h3 style="font-size:14px;margin:16px 0 6px;">${esc(section.label)} <span style="color:#999;font-weight:400;font-size:11px;">${new Date(section.recordedAt).toLocaleString()}</span></h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          ${section.rows.map((r) => `<tr><td style="padding:4px 8px;color:#666;width:220px;">${esc(r.label)}</td><td style="padding:4px 8px;">${esc(r.value)}</td></tr>`).join('')}
        </table>
      `).join('')
    : '<p style="color:#999;font-size:13px;">No exam findings recorded for this visit yet.</p>';

  const diagramsHtml = diagrams.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:8px;">
        ${diagrams.map((d) => `
          <div style="width:220px;">
            <img src="${esc(d.imageUrl)}" style="width:100%;border:1px solid #ccc;border-radius:4px;" />
            <div style="font-size:12px;margin-top:4px;">${esc(DIAGRAM_LABELS[d.diagramType] ?? d.diagramType)} — ${esc(d.eye.toUpperCase())}</div>
            <div style="font-size:11px;color:#999;">${new Date(d.createdAt).toLocaleDateString()}</div>
            ${d.notes ? `<div style="font-size:12px;margin-top:2px;">${esc(d.notes)}</div>` : ''}
          </div>
        `).join('')}
      </div>`
    : '<p style="color:#999;font-size:13px;">No diagrams marked for this visit.</p>';

  const imagesHtml = images.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:8px;">
        ${images.map((im) => `
          <div style="width:220px;">
            <img src="${esc(im.url)}" style="width:100%;border:1px solid #ccc;border-radius:4px;" />
            <div style="font-size:12px;margin-top:4px;">${esc(im.label)}</div>
          </div>
        `).join('')}
      </div>`
    : '';

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Consultation Report — ${esc(patient.full_name)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 800px; margin: 30px auto; padding: 0 20px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  h2 { font-size: 15px; margin: 20px 0 4px; border-bottom: 2px solid #333; padding-bottom: 4px; }
  h3 { color: #2f6f62; }
  .muted { color: #666; font-size: 13px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 13px; margin-top: 6px; }
  .grid div span.k { color: #666; }
  img { max-width: 100%; }
  @media print { button { display: none; } img { break-inside: avoid; } div { break-inside: avoid; } }
</style>
</head>
<body>
  <h1>${esc(hospital?.hospital_name ?? 'Netra Eye Hospital')}</h1>
  <div class="muted">${esc(hospital?.address)} ${hospital?.phone ? '· ' + esc(hospital.phone) : ''}</div>
  <div class="muted" style="margin-top:6px;">Consultation Report — ${esc(moduleLabel)} — generated ${new Date().toLocaleString()}</div>

  <h2>Patient Details</h2>
  <div class="grid">
    <div><span class="k">Name:</span> ${esc(patient.full_name)}</div>
    <div><span class="k">UHID:</span> ${esc(patient.uhid)}</div>
    <div><span class="k">DOB / Gender:</span> ${esc(patient.date_of_birth)} / ${esc(patient.gender)}</div>
    <div><span class="k">Phone:</span> ${esc(patient.phone)}</div>
    <div><span class="k">Known Allergies:</span> ${esc(patient.known_allergies)}</div>
    <div><span class="k">Blood Group:</span> ${esc(patient.blood_group)}</div>
  </div>

  <h2>Visit Details</h2>
  <div class="grid">
    <div><span class="k">Department:</span> ${esc(visit.clinic_module)}</div>
    <div><span class="k">Visit Date:</span> ${new Date(visit.created_at).toLocaleDateString()}</div>
    <div><span class="k">Token:</span> ${esc(visit.token_number)}</div>
    <div><span class="k">Stage:</span> ${esc(visit.stage)}</div>
  </div>

  <h2>Examination Findings</h2>
  ${findingsHtml}

  <h2>Clinical Diagrams</h2>
  ${diagramsHtml}

  ${images.length ? `<h2>Scans &amp; Images</h2>${imagesHtml}` : ''}

  <button onclick="window.print()" style="margin-top:24px;padding:8px 16px;">Print / Save as PDF</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}
