import { supabase } from './supabaseClient';

export interface ClaimFileData {
  patient: any;
  visit: any;
  hospital: any;
  clinicalSummary: { label: string; rows: Record<string, any> }[];
  surgery: any[];
  investigations: any[];
  bill: any | null;
  claim: any | null;
  documents: { label: string; url: string }[];
}

/** Pulls together everything an insurer/TPA needs for a claim: patient +
 * policy details, the clinic-appropriate clinical summary (different tables
 * depending which of the 5 clinics saw the patient), surgery/procedure
 * records, investigations, the bill, the claim status, and links to every
 * supporting document/scan attached to this specific visit. */
export async function fetchClaimFileData(visitId: string): Promise<ClaimFileData> {
  const { data: visit } = await supabase.from('visits').select('*').eq('id', visitId).single();
  const { data: patient } = await supabase.from('patients').select('*').eq('id', visit.patient_id).single();
  const { data: hospital } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();

  const clinicalSummary: { label: string; rows: Record<string, any> }[] = [];
  const documents: { label: string; url: string }[] = [];

  const pushDoc = (label: string, url: string | null | undefined) => {
    if (url) documents.push({ label, url });
  };

  if (visit.clinic_module === 'general') {
    const { data } = await supabase.from('consultations').select('*').eq('visit_id', visitId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (data) clinicalSummary.push({ label: 'Doctor Consultation', rows: { Diagnosis: data.diagnosis, 'ICD-10': data.icd10_code, 'Clinical Notes': data.clinical_notes, Plan: data.plan } });
    const { data: imaging } = await supabase.from('imaging_records').select('*').eq('visit_id', visitId);
    (imaging ?? []).forEach((r: any) => pushDoc(`Imaging — ${r.imaging_type}`, r.file_url));
  } else if (visit.clinic_module === 'retina') {
    const { data: exam } = await supabase.from('retina_exams').select('*').eq('visit_id', visitId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (exam) clinicalSummary.push({ label: 'Retina Exam & DR Grading', rows: { 'DR Grade OD': exam.dr_grade_od, 'DR Grade OS': exam.dr_grade_os, 'Fundus Findings': exam.fundus_findings, 'OCT Findings': exam.oct_findings } });
    const { data: tx } = await supabase.from('retina_treatments').select('*').eq('visit_id', visitId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (tx) clinicalSummary.push({ label: 'Treatment Plan', rows: { Eye: tx.eye, Treatment: tx.treatment_type, Drug: tx.drug_name, Notes: tx.notes } });
  } else if (visit.clinic_module === 'glaucoma') {
    const { data: plan } = await supabase.from('glaucoma_plans').select('*').eq('visit_id', visitId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (plan) clinicalSummary.push({ label: 'Glaucoma Management Plan', rows: { 'Target IOP OD': plan.target_iop_od, 'Target IOP OS': plan.target_iop_os, Management: plan.management, Notes: plan.notes } });
  } else if (visit.clinic_module === 'lasik') {
    const { data: elig } = await supabase.from('lasik_eligibility').select('*').eq('visit_id', visitId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (elig) clinicalSummary.push({ label: 'Eligibility Assessment', rows: { Eligible: elig.eligible, 'Procedure Recommended': elig.procedure_recommended, Reason: elig.reason } });
    const { data: proc } = await supabase.from('lasik_procedure_records').select('*').eq('visit_id', visitId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (proc) clinicalSummary.push({ label: 'Procedure Record', rows: { Eye: proc.eye, Type: proc.procedure_type, Notes: proc.notes } });
  } else if (visit.clinic_module === 'pediatric') {
    const { data: diag } = await supabase.from('pediatric_diagnoses').select('*').eq('visit_id', visitId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (diag) clinicalSummary.push({ label: 'Diagnosis & Plan', rows: { Diagnosis: diag.diagnosis, Plan: diag.plan, 'Patching Prescribed': diag.patching_prescribed, 'Glasses Prescribed': diag.glasses_prescribed } });
  }

  const { data: surgery } = await supabase.from('surgery_recommendations').select('*').eq('visit_id', visitId);
  const { data: admission } = await supabase.from('admissions').select('*, ot_records(*)').eq('visit_id', visitId).order('admitted_at', { ascending: false }).limit(1).maybeSingle();
  if (admission) {
    pushDoc('Admission Consent', admission.consent_file_url);
    (admission.ot_records ?? []).forEach((ot: any) => {
      clinicalSummary.push({ label: `OT Record — ${ot.procedure_name}`, rows: { Eye: ot.eye, 'OT Room': ot.ot_room, Status: ot.status, 'Intra-op Notes': ot.intra_op_notes, Complications: ot.complications } });
    });
  }

  const { data: investigations } = await supabase.from('investigation_orders').select('*').eq('visit_id', visitId);
  (investigations ?? []).forEach((inv: any) => pushDoc(`Investigation — ${inv.test_name}`, inv.result_file_url));

  const { data: bill } = await supabase.from('bills').select('*, bill_items(*)').eq('visit_id', visitId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const { data: claim } = await supabase.from('insurance_claims').select('*').eq('visit_id', visitId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (claim) pushDoc('Insurance Pre-auth / Approval Document', claim.document_url);

  return {
    patient, visit, hospital,
    clinicalSummary,
    surgery: surgery ?? [],
    investigations: investigations ?? [],
    bill: bill ?? null,
    claim: claim ?? null,
    documents,
  };
}
