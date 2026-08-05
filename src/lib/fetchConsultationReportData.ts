import { supabase } from './supabaseClient';
import type { ModuleConfig } from '../modules/fieldTypes';

export interface ConsultationReportData {
  patient: any;
  visit: any;
  hospital: any;
  moduleLabel: string;
  findings: { label: string; recordedAt: string; rows: { label: string; value: string }[] }[];
  diagrams: { diagramType: string; eye: string; imageUrl: string; notes: string | null; createdAt: string }[];
  images: { label: string; url: string }[];
}

/** Pulls together everything that belongs in a doctor's printed consultation
 * report for one visit: the clinic-appropriate exam findings (whichever
 * stages this module actually has data for, same "latest row per stage"
 * approach as PatientChartSummary), every clinical diagram/annotated photo
 * saved on this visit, and any other scan/image files attached along the way. */
export async function fetchConsultationReportData(visitId: string, moduleConfig: ModuleConfig): Promise<ConsultationReportData> {
  const { data: visit } = await supabase.from('visits').select('*').eq('id', visitId).single();
  const { data: patient } = await supabase.from('patients').select('*').eq('id', visit.patient_id).single();
  const { data: hospital } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();

  const fielded = moduleConfig.stages.filter((s) => !s.custom && s.fields.length > 0);
  const findings: ConsultationReportData['findings'] = [];
  const images: ConsultationReportData['images'] = [];

  await Promise.all(
    fielded.map(async (stage) => {
      const { data: row } = await supabase.from(stage.table).select('*').eq('visit_id', visitId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!row) return;
      const rows = stage.fields
        .filter((f) => f.type !== 'file' && row[f.name] !== null && row[f.name] !== undefined && row[f.name] !== '')
        .map((f) => ({ label: f.label, value: typeof row[f.name] === 'boolean' ? (row[f.name] ? 'Yes' : 'No') : String(row[f.name]) }));
      stage.fields.filter((f) => f.type === 'file' && row[f.name]).forEach((f) => images.push({ label: `${stage.label} — ${f.label}`, url: row[f.name] }));
      if (rows.length > 0) findings.push({ label: stage.label, recordedAt: row.created_at, rows });
    }),
  );
  // Keep the report in the same order the clinic actually works through the stages.
  findings.sort((a, b) => fielded.findIndex((s) => s.label === a.label) - fielded.findIndex((s) => s.label === b.label));

  const { data: diagramRows } = await supabase.from('clinical_diagrams').select('*').eq('visit_id', visitId).order('created_at', { ascending: true });
  const diagrams = (diagramRows ?? []).map((d: any) => ({ diagramType: d.diagram_type, eye: d.eye, imageUrl: d.image_url, notes: d.notes, createdAt: d.created_at }));

  return { patient, visit, hospital, moduleLabel: moduleConfig.label, findings, diagrams, images };
}
