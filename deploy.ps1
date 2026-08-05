Write-Host 'Writing files...'
New-Item -ItemType Directory -Force -Path "" | Out-Null
Set-Content -Path "src\lib\deductDrugStock.ts" -Encoding UTF8 -NoNewline -Value @'
import { supabase } from './supabaseClient';

/**
 * Decrements real stock for a catalog drug. No-ops silently if drugId is
 * null (free-text / not-in-catalog items don't affect inventory). Not a
 * real DB transaction — fine for a single-pharmacy deployment, a
 * high-concurrency one should move this into a Postgres RPC.
 */
export async function deductDrugStock(drugId: string | null, quantity: number): Promise<{ error: string | null }> {
  if (!drugId) return { error: null };

  const { data: drug, error: drugError } = await supabase.from('drugs').select('stock_qty').eq('id', drugId).single();
  if (drugError) return { error: `Couldn't check stock: ${drugError.message}` };

  const newStock = Math.max(0, (drug?.stock_qty ?? 0) - quantity);
  const { error: stockError } = await supabase.from('drugs').update({ stock_qty: newStock }).eq('id', drugId);
  if (stockError) return { error: `Couldn't update stock: ${stockError.message}` };
  return { error: null };
}

'@
Write-Host 'wrote src\lib\deductDrugStock.ts'
New-Item -ItemType Directory -Force -Path "" | Out-Null
Set-Content -Path "src\lib\dispensePrescription.ts" -Encoding UTF8 -NoNewline -Value @'
import { supabase } from './supabaseClient';
import { deductDrugStock } from './deductDrugStock';

/**
 * Marks a pharmacy_dispenses row dispensed AND decrements real stock for every
 * line item that's linked to a catalog drug (drug_id set). Free-text items
 * (drug_id null — prescribed but not in the catalog) don't affect inventory.
 *
 * Runs as a sequence of REST calls, not a real DB transaction, so under heavy
 * concurrent dispensing there's a small race window on stock_qty — fine for a
 * single-pharmacy demo; a production deployment should move this into a
 * Postgres function called via RPC for atomicity.
 */
export async function dispensePrescription(
  dispenseId: string,
  prescriptionId: string,
  dispensedBy: string | undefined
): Promise<{ error: string | null }> {
  const { data: items, error: itemsError } = await supabase
    .from('prescription_items')
    .select('drug_id, quantity')
    .eq('prescription_id', prescriptionId);

  if (itemsError) return { error: itemsError.message };

  for (const item of items ?? []) {
    const { error: deductError } = await deductDrugStock(item.drug_id, item.quantity ?? 1);
    if (deductError) return { error: deductError };
  }

  const { error: dispenseError } = await supabase
    .from('pharmacy_dispenses')
    .update({ status: 'dispensed', dispensed_at: new Date().toISOString(), dispensed_by: dispensedBy })
    .eq('id', dispenseId);

  if (dispenseError) return { error: dispenseError.message };
  return { error: null };
}

'@
Write-Host 'wrote src\lib\dispensePrescription.ts'
New-Item -ItemType Directory -Force -Path "" | Out-Null
Set-Content -Path "src\modules\fieldTypes.ts" -Encoding UTF8 -NoNewline -Value @'
export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'select_or_other' | 'db_select_or_other' | 'checkbox' | 'date' | 'datetime' | 'file' | 'static_text';

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  options?: string[]; // for select / select_or_other
  dbTable?: string;   // for db_select_or_other — table to fetch active options from
  dbColumn?: string;  // for db_select_or_other — column holding the display value
  half?: boolean; // render at half width (paired fields like OD/OS)
  placeholder?: string;
  content?: string; // for static_text — read-only text rendered above the field, not persisted to the row
}

export interface StageConfig {
  key: string;           // unique key within the module
  label: string;         // shown in the step list
  table: string;         // supabase table this stage writes to
  fields: FieldConfig[];
  staffField?: string;   // column to auto-fill with current profile id, e.g. 'performed_by'
  linkColumn?: 'visit_id' | 'admission_id' | 'ot_record_id' | 'retina_treatment_id' | 'prescription_id';
  description?: string;
  custom?: 'pharmacy' | 'admission' | 'billing' | 'optical' | 'diagrams' | 'injection'; // rendered by a bespoke component instead of the generic form
}

export interface ModuleConfig {
  key: string;
  label: string;
  stages: StageConfig[];
}

'@
Write-Host 'wrote src\modules\fieldTypes.ts'
New-Item -ItemType Directory -Force -Path "" | Out-Null
Set-Content -Path "src\modules\moduleConfig.ts" -Encoding UTF8 -NoNewline -Value @'
import type { ModuleConfig, StageConfig } from './fieldTypes';
import {
  VA_OPTIONS, IOL_FORMULAS, CYCLOPLEGIC_AGENTS,
  SURGERY_PROCEDURES, SYMPTOM_DURATIONS, COMMON_DIAGNOSES, ICD10_CODES,
  ANGLE_GRADES, VF_TEST_PATTERNS, VF_RELIABILITY,
  LASIK_COMPLICATIONS, BINOCULAR_VISION_STATUS, STEREOPSIS_LEVELS, PEDIATRIC_DIAGNOSES,
  PEDIATRIC_SCREENING_METHODS, COOPERATION_LEVELS,
} from './commonOptions';

const LASIK_CONSENT_TEXT = `INFORMED CONSENT FOR LASIK / REFRACTIVE SURGERY

I understand that LASIK (or the alternative refractive procedure recommended to me) is an elective surgery to reduce my dependence on glasses or contact lenses, and that no surgery can guarantee a perfect visual outcome.

I have been informed of, and understand, the following:
1. Alternatives to surgery include continued use of glasses or contact lenses.
2. Possible risks include but are not limited to: dry eyes, glare, halos, under- or over-correction, need for re-treatment, flap complications, infection, and in rare cases, loss of best corrected vision.
3. Results vary between individuals and between the two eyes.
4. I must attend all scheduled post-operative reviews for my safety.
5. I may withdraw consent at any point before the procedure begins.

I confirm that my questions have been answered to my satisfaction and I voluntarily consent to undergo the procedure recommended for me.`;

export const ADMISSION_CONSENT_TEXT = `CONSENT FOR ADMISSION, ANAESTHESIA & SURGICAL PROCEDURE

I hereby consent to admission to this hospital and to the surgical/procedural treatment recommended for my eye condition, including the administration of local or general anaesthesia as deemed necessary by the treating team.

I understand that:
1. The nature, purpose, risks, and expected benefits of the procedure have been explained to me.
2. No guarantee has been made regarding the outcome of the procedure.
3. Unforeseen conditions may require additional or different procedures than planned, and I authorize the surgical team to act in my best interest in such an event.
4. I may ask further questions at any time before the procedure.

I voluntarily consent to the admission, anaesthesia, and procedure described to me.`;

// Shared across every clinic — the operational back-half of a visit (order
// tests, prescribe, dispense glasses, recommend surgery, handle insurance,
// admit/operate/recover, bill, collect feedback, schedule follow-up) is the
// same regardless of which clinic saw the patient. Previously only the
// General OPD module had these tabs, which meant a retina/glaucoma/LASIK/
// pediatric visit had no way to prescribe, bill, or get insurance approval
// at all — a real gap, not just a cosmetic one.
const SHARED_SUPPORT_STAGES: StageConfig[] = [
  { key: 'diagrams', label: 'Clinical Diagrams', table: 'clinical_diagrams', custom: 'diagrams', fields: [] },
  {
    key: 'investigation', label: 'Investigation Order', table: 'investigation_orders', staffField: 'ordered_by',
    fields: [
      { name: 'test_name', label: 'Test Name', type: 'db_select_or_other', dbTable: 'investigation_masters', dbColumn: 'test_name' },
      { name: 'status', label: 'Status', type: 'select', options: ['ordered', 'in_progress', 'completed', 'cancelled'] },
      { name: 'result', label: 'Result', type: 'textarea' },
      { name: 'result_file_url', label: 'Investigation Result File', type: 'file' },
    ],
  },
  { key: 'pharmacy', label: 'Pharmacy', table: 'prescriptions', custom: 'pharmacy', fields: [] },
  { key: 'optical', label: 'Optical', table: 'optical_orders', custom: 'optical', fields: [] },
  {
    key: 'surgery_recommendation', label: 'Surgery Recommendation', table: 'surgery_recommendations', staffField: 'recommended_by',
    fields: [
      { name: 'procedure_name', label: 'Procedure', type: 'select_or_other', options: SURGERY_PROCEDURES },
      { name: 'eye', label: 'Eye', type: 'select', options: ['od', 'os', 'both'] },
      { name: 'urgency', label: 'Urgency', type: 'select', options: ['elective', 'urgent', 'emergency'] },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
  {
    key: 'insurance_approval', label: 'Insurance Approval', table: 'insurance_claims', staffField: 'handled_by',
    fields: [
      { name: 'scheme', label: 'Scheme', type: 'db_select_or_other', dbTable: 'insurance_masters', dbColumn: 'scheme_name', half: true },
      { name: 'policy_or_card_no', label: 'Policy / Card No.', type: 'text', half: true },
      { name: 'package_selected', label: 'Package Selected', type: 'text' },
      { name: 'claim_amount', label: 'Claim Amount', type: 'number', half: true },
      { name: 'approved_amount', label: 'Approved Amount', type: 'number', half: true },
      { name: 'status', label: 'Status', type: 'select', options: ['eligibility_check', 'pre_auth_requested', 'approved', 'rejected', 'settled'] },
      { name: 'pre_auth_reference', label: 'Pre-auth Reference', type: 'text' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
      { name: 'document_url', label: 'Pre-auth / Approval Document', type: 'file' },
    ],
  },
  { key: 'admission_ot', label: 'Admission, OT & Recovery', table: 'admissions', custom: 'admission', fields: [] },
  { key: 'billing', label: 'Billing', table: 'bills', custom: 'billing', fields: [] },
  {
    key: 'feedback', label: 'Feedback', table: 'feedback',
    fields: [
      { name: 'rating', label: 'Rating (1-5)', type: 'number' },
      { name: 'comments', label: 'Comments', type: 'textarea' },
    ],
  },
  {
    key: 'follow_up', label: 'Follow-up', table: 'follow_ups',
    fields: [
      { name: 'due_date', label: 'Due Date', type: 'date', half: true },
      { name: 'status', label: 'Status', type: 'select', options: ['pending', 'scheduled', 'completed', 'missed'], half: true },
      { name: 'reason', label: 'Reason', type: 'textarea' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },
];

export const GENERAL_MODULE: ModuleConfig = {
  key: 'general',
  label: 'General OPD Journey',
  stages: [
    {
      key: 'vision_test', label: 'Vision Test', table: 'vision_tests', staffField: 'performed_by',
      fields: [
        { name: 'uncorrected_va_od', label: 'Uncorrected VA — OD', type: 'select_or_other', options: VA_OPTIONS, half: true },
        { name: 'uncorrected_va_os', label: 'Uncorrected VA — OS', type: 'select_or_other', options: VA_OPTIONS, half: true },
        { name: 'corrected_va_od', label: 'Corrected VA — OD', type: 'select_or_other', options: VA_OPTIONS, half: true },
        { name: 'corrected_va_os', label: 'Corrected VA — OS', type: 'select_or_other', options: VA_OPTIONS, half: true },
        { name: 'pinhole_va_od', label: 'Pinhole VA — OD', type: 'select_or_other', options: VA_OPTIONS, half: true },
        { name: 'pinhole_va_os', label: 'Pinhole VA — OS', type: 'select_or_other', options: VA_OPTIONS, half: true },
      ],
    },
    {
      key: 'preliminary_assessment', label: 'Preliminary Assessment', table: 'preliminary_assessments', staffField: 'performed_by',
      fields: [
        { name: 'chief_complaint', label: 'Chief Complaint', type: 'textarea' },
        { name: 'duration_of_symptoms', label: 'Duration of Symptoms', type: 'select_or_other', options: SYMPTOM_DURATIONS },
        { name: 'history_present_illness', label: 'History of Present Illness', type: 'textarea' },
        { name: 'past_ocular_history', label: 'Past Ocular History', type: 'textarea' },
        { name: 'systemic_history', label: 'Systemic History', type: 'textarea' },
        { name: 'medication_history', label: 'Medication History', type: 'textarea' },
        { name: 'vitals_bp', label: 'Blood Pressure', type: 'text', half: true, placeholder: 'e.g. 120/80' },
        { name: 'vitals_pulse', label: 'Pulse (bpm)', type: 'number', half: true },
        { name: 'vitals_blood_sugar', label: 'Blood Sugar (mg/dL)', type: 'number', half: true },
      ],
    },
    {
      key: 'refraction', label: 'Refraction', table: 'refractions', staffField: 'performed_by',
      fields: [
        { name: 'method', label: 'Method', type: 'select', options: ['subjective', 'autorefractor', 'cycloplegic'] },
        { name: 'sphere_od', label: 'Sphere — OD', type: 'number', half: true },
        { name: 'sphere_os', label: 'Sphere — OS', type: 'number', half: true },
        { name: 'cylinder_od', label: 'Cylinder — OD', type: 'number', half: true },
        { name: 'cylinder_os', label: 'Cylinder — OS', type: 'number', half: true },
        { name: 'axis_od', label: 'Axis — OD', type: 'number', half: true },
        { name: 'axis_os', label: 'Axis — OS', type: 'number', half: true },
        { name: 'add_od', label: 'Add — OD', type: 'number', half: true },
        { name: 'add_os', label: 'Add — OS', type: 'number', half: true },
        { name: 'final_va_od', label: 'Final VA — OD', type: 'select_or_other', options: VA_OPTIONS, half: true },
        { name: 'final_va_os', label: 'Final VA — OS', type: 'select_or_other', options: VA_OPTIONS, half: true },
      ],
    },
    {
      key: 'iop', label: 'Eye Pressure (IOP)', table: 'iop_readings', staffField: 'performed_by',
      fields: [
        { name: 'iop_od', label: 'IOP — OD (mmHg)', type: 'number', half: true },
        { name: 'iop_os', label: 'IOP — OS (mmHg)', type: 'number', half: true },
        { name: 'method', label: 'Method', type: 'select', options: ['noncontact_tonometer', 'goldmann_applanation', 'icare'] },
      ],
    },
    {
      key: 'imaging', label: 'Imaging — Biometry & IOL', table: 'imaging_records', staffField: 'performed_by',
      fields: [
        { name: 'imaging_type', label: 'Imaging Type', type: 'select', options: ['biometry', 'oct', 'fundus_photo', 'topography', 'pachymetry', 'visual_field', 'gonioscopy'] },
        { name: 'eye', label: 'Eye', type: 'select', options: ['od', 'os', 'both'] },
        { name: 'axial_length_od', label: 'Axial Length — OD', type: 'number', half: true },
        { name: 'axial_length_os', label: 'Axial Length — OS', type: 'number', half: true },
        { name: 'k1_od', label: 'K1 — OD', type: 'number', half: true },
        { name: 'k1_os', label: 'K1 — OS', type: 'number', half: true },
        { name: 'k2_od', label: 'K2 — OD', type: 'number', half: true },
        { name: 'k2_os', label: 'K2 — OS', type: 'number', half: true },
        { name: 'iol_power_od', label: 'IOL Power — OD', type: 'number', half: true },
        { name: 'iol_power_os', label: 'IOL Power — OS', type: 'number', half: true },
        { name: 'iol_formula', label: 'IOL Formula', type: 'select_or_other', options: IOL_FORMULAS },
        { name: 'findings', label: 'Findings', type: 'textarea' },
        { name: 'file_url', label: 'Scan / Image', type: 'file' },
      ],
    },
    {
      key: 'consultation', label: 'Doctor Consultation', table: 'consultations', staffField: 'doctor_id',
      fields: [
        { name: 'anterior_segment_od', label: 'Anterior Segment — OD', type: 'textarea', half: true },
        { name: 'anterior_segment_os', label: 'Anterior Segment — OS', type: 'textarea', half: true },
        { name: 'posterior_segment_od', label: 'Posterior Segment — OD', type: 'textarea', half: true },
        { name: 'posterior_segment_os', label: 'Posterior Segment — OS', type: 'textarea', half: true },
        { name: 'diagnosis', label: 'Diagnosis', type: 'select_or_other', options: COMMON_DIAGNOSES, half: true },
        { name: 'icd10_code', label: 'ICD-10 Code', type: 'select_or_other', options: ICD10_CODES, half: true },
        { name: 'clinical_notes', label: 'Clinical Notes', type: 'textarea' },
        { name: 'plan', label: 'Plan', type: 'textarea' },
        { name: 'needs_surgery', label: 'Needs Surgery', type: 'checkbox', half: true },
        { name: 'needs_investigation', label: 'Needs Investigation', type: 'checkbox', half: true },
        { name: 'needs_pharmacy', label: 'Needs Pharmacy', type: 'checkbox', half: true },
        { name: 'needs_optical', label: 'Needs Optical', type: 'checkbox', half: true },
        { name: 'follow_up_days', label: 'Follow-up (days)', type: 'number' },
      ],
    },
    ...SHARED_SUPPORT_STAGES,
  ],
};

export const RETINA_MODULE: ModuleConfig = {
  key: 'retina',
  label: 'Retina Clinic',
  stages: [
    {
      key: 'retina_exam', label: 'Retina Exam & DR Grading', table: 'retina_exams', staffField: 'examined_by',
      fields: [
        { name: 'dr_grade_od', label: 'DR Grade — OD', type: 'select', options: ['no_dr', 'mild_npdr', 'moderate_npdr', 'severe_npdr', 'pdr'], half: true },
        { name: 'dr_grade_os', label: 'DR Grade — OS', type: 'select', options: ['no_dr', 'mild_npdr', 'moderate_npdr', 'severe_npdr', 'pdr'], half: true },
        { name: 'csme_od', label: 'CSME — OD', type: 'checkbox', half: true },
        { name: 'csme_os', label: 'CSME — OS', type: 'checkbox', half: true },
        { name: 'fundus_findings', label: 'Fundus Findings', type: 'textarea' },
        { name: 'oct_findings', label: 'OCT Findings', type: 'textarea' },
      ],
    },
    {
      key: 'retina_treatment', label: 'Treatment Selection', table: 'retina_treatments', staffField: 'performed_by',
      fields: [
        { name: 'eye', label: 'Eye', type: 'select', options: ['od', 'os', 'both'] },
        { name: 'treatment_type', label: 'Treatment Type', type: 'select', options: ['intravitreal_injection', 'laser_photocoagulation', 'vitrectomy', 'observation'] },
        { name: 'drug_name', label: 'Drug Name', type: 'db_select_or_other', dbTable: 'drugs', dbColumn: 'name' },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ],
    },
    { key: 'injection', label: 'Intravitreal Injection Record', table: 'injection_records', custom: 'injection', fields: [] },
    ...SHARED_SUPPORT_STAGES,
  ],
};

export const GLAUCOMA_MODULE: ModuleConfig = {
  key: 'glaucoma',
  label: 'Glaucoma Clinic',
  stages: [
    {
      key: 'gonioscopy', label: 'IOP & Gonioscopy', table: 'gonioscopy_records', staffField: 'performed_by',
      fields: [
        { name: 'angle_grade_od', label: 'Angle Grade — OD', type: 'select_or_other', options: ANGLE_GRADES, half: true },
        { name: 'angle_grade_os', label: 'Angle Grade — OS', type: 'select_or_other', options: ANGLE_GRADES, half: true },
        { name: 'findings', label: 'Findings', type: 'textarea' },
      ],
    },
    {
      key: 'visual_field', label: 'Visual Field Test (24-2)', table: 'visual_field_tests', staffField: 'performed_by',
      fields: [
        { name: 'eye', label: 'Eye', type: 'select', options: ['od', 'os'], half: true },
        { name: 'test_pattern', label: 'Test Pattern', type: 'select_or_other', options: VF_TEST_PATTERNS, half: true },
        { name: 'md_value', label: 'MD Value', type: 'number', half: true },
        { name: 'psd_value', label: 'PSD Value', type: 'number', half: true },
        { name: 'reliability', label: 'Reliability', type: 'select_or_other', options: VF_RELIABILITY },
        { name: 'file_url', label: 'Visual Field Printout/Image', type: 'file' },
      ],
    },
    {
      key: 'oct_rnfl', label: 'OCT RNFL & Progression', table: 'oct_rnfl_records', staffField: 'performed_by',
      fields: [
        { name: 'eye', label: 'Eye', type: 'select', options: ['od', 'os'], half: true },
        { name: 'rnfl_avg_thickness', label: 'RNFL Avg Thickness', type: 'number', half: true },
        { name: 'progression_notes', label: 'Progression Notes', type: 'textarea' },
        { name: 'file_url', label: 'OCT RNFL Report', type: 'file' },
      ],
    },
    {
      key: 'glaucoma_plan', label: 'Plan & Next Review', table: 'glaucoma_plans', staffField: 'planned_by',
      fields: [
        { name: 'target_iop_od', label: 'Target IOP — OD', type: 'number', half: true },
        { name: 'target_iop_os', label: 'Target IOP — OS', type: 'number', half: true },
        { name: 'management', label: 'Management', type: 'select', options: ['medical', 'laser', 'surgical'] },
        { name: 'next_review_date', label: 'Next Review Date', type: 'date' },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ],
    },
    ...SHARED_SUPPORT_STAGES,
  ],
};

export const LASIK_MODULE: ModuleConfig = {
  key: 'lasik',
  label: 'LASIK / Refractive Clinic',
  stages: [
    {
      key: 'topography', label: 'Corneal Topography & Pachymetry', table: 'corneal_topography', staffField: 'performed_by',
      fields: [
        { name: 'k1_od', label: 'K1 — OD', type: 'number', half: true },
        { name: 'k1_os', label: 'K1 — OS', type: 'number', half: true },
        { name: 'k2_od', label: 'K2 — OD', type: 'number', half: true },
        { name: 'k2_os', label: 'K2 — OS', type: 'number', half: true },
        { name: 'pachymetry_od', label: 'Pachymetry — OD', type: 'number', half: true },
        { name: 'pachymetry_os', label: 'Pachymetry — OS', type: 'number', half: true },
        { name: 'corneal_map_notes', label: 'Corneal Map Notes', type: 'textarea' },
        { name: 'file_url', label: 'Topography Report', type: 'file' },
      ],
    },
    {
      key: 'dry_eye', label: 'Dry Eye Assessment', table: 'dry_eye_assessments', staffField: 'performed_by',
      fields: [
        { name: 'tbut_od', label: 'TBUT — OD (s)', type: 'number', half: true },
        { name: 'tbut_os', label: 'TBUT — OS (s)', type: 'number', half: true },
        { name: 'schirmer_od', label: 'Schirmer — OD', type: 'number', half: true },
        { name: 'schirmer_os', label: 'Schirmer — OS', type: 'number', half: true },
        { name: 'osdi_score', label: 'OSDI Score', type: 'number' },
        { name: 'findings', label: 'Findings', type: 'textarea' },
      ],
    },
    {
      key: 'eligibility', label: 'Eligibility Assessment', table: 'lasik_eligibility', staffField: 'assessed_by',
      fields: [
        { name: 'eligible', label: 'Eligible', type: 'checkbox' },
        { name: 'procedure_recommended', label: 'Procedure Recommended', type: 'select', options: ['lasik', 'prk', 'smile', 'not_eligible'] },
        { name: 'reason', label: 'Reason', type: 'textarea' },
      ],
    },
    {
      key: 'consent', label: 'Informed Consent — LASIK', table: 'lasik_consents', staffField: 'witnessed_by',
      fields: [
        { name: '_consent_text', label: '', type: 'static_text', content: LASIK_CONSENT_TEXT },
        { name: 'consent_signed', label: 'Consent Signed', type: 'checkbox', half: true },
        { name: 'consent_file_url', label: 'Signed Consent Document', type: 'file', half: true },
      ],
    },
    {
      key: 'procedure', label: 'Procedure Record', table: 'lasik_procedure_records', staffField: 'surgeon_id',
      fields: [
        { name: 'eye', label: 'Eye', type: 'select', options: ['od', 'os', 'both'], half: true },
        { name: 'procedure_type', label: 'Procedure Type', type: 'select', options: ['lasik', 'prk', 'smile'], half: true },
        { name: 'flap_parameters', label: 'Flap Parameters', type: 'textarea' },
        { name: 'ablation_parameters', label: 'Ablation Parameters', type: 'textarea' },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ],
    },
    {
      key: 'post_procedure', label: 'Post-procedure Review', table: 'post_procedure_reviews', staffField: 'reviewed_by',
      fields: [
        { name: 'review_day', label: 'Review Day', type: 'number', half: true },
        { name: 'uncorrected_va_od', label: 'Uncorrected VA — OD', type: 'select_or_other', options: VA_OPTIONS, half: true },
        { name: 'uncorrected_va_os', label: 'Uncorrected VA — OS', type: 'select_or_other', options: VA_OPTIONS, half: true },
        { name: 'complications', label: 'Complications', type: 'select_or_other', options: LASIK_COMPLICATIONS },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ],
    },
    ...SHARED_SUPPORT_STAGES,
  ],
};

export const PEDIATRIC_MODULE: ModuleConfig = {
  key: 'pediatric',
  label: 'Pediatric Ophthalmology',
  stages: [
    {
      key: 'vision_screening', label: 'Vision Screening', table: 'pediatric_vision_screenings', staffField: 'performed_by',
      fields: [
        { name: 'method', label: 'Screening Method', type: 'select', options: PEDIATRIC_SCREENING_METHODS, half: true },
        { name: 'cooperation_level', label: 'Cooperation Level', type: 'select', options: COOPERATION_LEVELS, half: true },
        { name: 'uncorrected_va_od', label: 'Uncorrected VA — OD', type: 'select_or_other', options: VA_OPTIONS, half: true },
        { name: 'uncorrected_va_os', label: 'Uncorrected VA — OS', type: 'select_or_other', options: VA_OPTIONS, half: true },
        { name: 'red_reflex_normal', label: 'Red Reflex Normal', type: 'checkbox' },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ],
    },
    {
      key: 'squint', label: 'Squint & Binocular Assessment', table: 'squint_assessments', staffField: 'performed_by',
      fields: [
        { name: 'deviation_type', label: 'Deviation Type', type: 'select', options: ['esotropia', 'exotropia', 'hypertropia', 'hypotropia', 'none'] },
        { name: 'deviation_angle', label: 'Deviation Angle', type: 'text', placeholder: 'e.g. 20 PD at near, 15 PD at distance' },
        { name: 'binocular_vision_status', label: 'Binocular Vision Status', type: 'select_or_other', options: BINOCULAR_VISION_STATUS },
        { name: 'stereopsis', label: 'Stereopsis', type: 'select_or_other', options: STEREOPSIS_LEVELS },
      ],
    },
    {
      key: 'cycloplegic_refraction', label: 'Cycloplegic Refraction', table: 'cycloplegic_refractions', staffField: 'performed_by',
      fields: [
        { name: 'cycloplegic_agent', label: 'Cycloplegic Agent', type: 'select_or_other', options: CYCLOPLEGIC_AGENTS },
        { name: 'sphere_od', label: 'Sphere — OD', type: 'number', half: true },
        { name: 'sphere_os', label: 'Sphere — OS', type: 'number', half: true },
        { name: 'cylinder_od', label: 'Cylinder — OD', type: 'number', half: true },
        { name: 'cylinder_os', label: 'Cylinder — OS', type: 'number', half: true },
        { name: 'axis_od', label: 'Axis — OD', type: 'number', half: true },
        { name: 'axis_os', label: 'Axis — OS', type: 'number', half: true },
      ],
    },
    {
      key: 'diagnosis', label: 'Diagnosis & Plan', table: 'pediatric_diagnoses', staffField: 'diagnosed_by',
      fields: [
        { name: 'diagnosis', label: 'Diagnosis', type: 'select_or_other', options: PEDIATRIC_DIAGNOSES },
        { name: 'plan', label: 'Plan', type: 'textarea' },
        { name: 'patching_prescribed', label: 'Patching Prescribed', type: 'checkbox', half: true },
        { name: 'patching_hours_per_day', label: 'Patching Hours / Day', type: 'number', half: true },
        { name: 'glasses_prescribed', label: 'Glasses Prescribed', type: 'checkbox' },
      ],
    },
    {
      key: 'parent_followup', label: 'Parent Follow-up & Compliance', table: 'parent_followups', staffField: 'recorded_by',
      fields: [
        { name: 'compliance_notes', label: 'Compliance Notes', type: 'textarea' },
        { name: 'next_review_date', label: 'Next Review Date', type: 'date' },
      ],
    },
    ...SHARED_SUPPORT_STAGES,
  ],
};

export const MODULES: Record<string, ModuleConfig> = {
  general: GENERAL_MODULE,
  retina: RETINA_MODULE,
  glaucoma: GLAUCOMA_MODULE,
  lasik: LASIK_MODULE,
  pediatric: PEDIATRIC_MODULE,
};

'@
Write-Host 'wrote src\modules\moduleConfig.ts'
New-Item -ItemType Directory -Force -Path "" | Out-Null
Set-Content -Path "src\components\RecordForm.tsx" -Encoding UTF8 -NoNewline -Value @'
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import type { StageConfig } from '../modules/fieldTypes';
import { FieldInput } from './FieldInput';

interface Props {
  stage: StageConfig;
  extraValues: Record<string, any>; // e.g. { visit_id }
  onSaved?: () => void;
  editingRecord?: Record<string, any> | null; // when set, the form edits this row instead of inserting a new one
  onCancelEdit?: () => void;
}

export function RecordForm({ stage, extraValues, onSaved, editingRecord, onCancelEdit }: Props) {
  const { profile } = useAuth();
  const [values, setValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  // Re-seed the form whenever a different record is picked to edit (or when
  // leaving edit mode, back to a blank form for a new entry).
  const persistedFields = stage.fields.filter((f) => f.type !== 'static_text');

  useEffect(() => {
    setValues(editingRecord ? Object.fromEntries(persistedFields.map((f) => [f.name, editingRecord[f.name] ?? null])) : {});
    setError(null);
    setSavedOk(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingRecord?.id, stage.key]);

  const handleChange = (name: string, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedOk(false);

    if (editingRecord) {
      const payload: Record<string, any> = { ...values };
      Object.keys(payload).forEach((k) => {
        if (payload[k] === '') payload[k] = null;
      });
      const { error: updateError } = await supabase.from(stage.table).update(payload).eq('id', editingRecord.id);
      setSaving(false);
      if (updateError) {
        setError(updateError.message);
      } else {
        setSavedOk(true);
        onSaved?.();
      }
      return;
    }

    const payload: Record<string, any> = { ...values, ...extraValues };
    if (stage.staffField && profile) payload[stage.staffField] = profile.id;

    // strip empty strings on optional fields to avoid type coercion issues
    Object.keys(payload).forEach((k) => {
      if (payload[k] === '') payload[k] = null;
    });

    const { error: insertError } = await supabase.from(stage.table).insert(payload);
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
    } else {
      setSavedOk(true);
      setValues({});
      onSaved?.();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: 'var(--space-4)' }}>
      {editingRecord && (
        <div className="text-muted" style={{ fontSize: 12, marginBottom: 'var(--space-2)' }}>
          Editing the entry from {new Date(editingRecord.created_at).toLocaleString()}.
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        {stage.fields.map((field) =>
          field.type === 'static_text' ? (
            <div key={field.name} style={{ flex: '1 1 100%' }}>
              <FieldInput field={field} value={undefined} onChange={() => {}} />
            </div>
          ) : (
            <div
              className="field"
              key={field.name}
              style={{ flex: field.half ? '1 1 220px' : '1 1 100%' }}
            >
              <label htmlFor={field.name}>{field.label}</label>
              <FieldInput field={field} value={values[field.name]} onChange={handleChange} folder={stage.table} />
            </div>
          )
        )}
      </div>

      {error && (
        <div style={{ color: '#b64545', fontSize: 13 }}>{error}</div>
      )}
      {savedOk && (
        <div style={{ color: 'var(--color-accent-700)', fontSize: 13 }}>Saved.</div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : editingRecord ? 'Save changes' : 'Save record'}
        </button>
        {editingRecord && (
          <button className="btn btn-secondary" type="button" onClick={onCancelEdit}>Cancel</button>
        )}
      </div>
    </form>
  );
}

'@
Write-Host 'wrote src\components\RecordForm.tsx'
New-Item -ItemType Directory -Force -Path "" | Out-Null
Set-Content -Path "src\components\FieldInput.tsx" -Encoding UTF8 -NoNewline -Value @'
import type { FieldConfig } from '../modules/fieldTypes';
import { FileUploadField } from './FileUploadField';
import { SelectOrOtherInput } from './SelectOrOtherInput';
import { DbSelectOrOtherInput } from './DbSelectOrOtherInput';

interface Props {
  field: FieldConfig;
  value: any;
  onChange: (name: string, value: any) => void;
  folder?: string; // storage namespace, defaults to field name
}

export function FieldInput({ field, value, onChange, folder }: Props) {
  const common = {
    id: field.name,
    className: 'input',
  };

  if (field.type === 'static_text') {
    return (
      <div className="card" style={{ padding: 'var(--space-3)', background: 'color-mix(in srgb, var(--color-accent) 5%, transparent)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
        {field.content}
      </div>
    );
  }

  if (field.type === 'file') {
    return (
      <FileUploadField
        value={value}
        onChange={(url) => onChange(field.name, url)}
        folder={folder ?? field.name}
      />
    );
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        {...common}
        placeholder={field.placeholder}
        value={value ?? ''}
        onChange={(e) => onChange(field.name, e.target.value)}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <select
        {...common}
        value={value ?? ''}
        onChange={(e) => onChange(field.name, e.target.value)}
      >
        <option value="">—</option>
        {field.options?.map((opt) => (
          <option key={opt} value={opt}>
            {opt.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'db_select_or_other') {
    return (
      <DbSelectOrOtherInput
        value={value}
        dbTable={field.dbTable!}
        dbColumn={field.dbColumn!}
        onChange={(v) => onChange(field.name, v)}
        placeholder={field.placeholder}
      />
    );
  }

  if (field.type === 'select_or_other') {
    return (
      <SelectOrOtherInput
        value={value}
        options={field.options ?? []}
        onChange={(v) => onChange(field.name, v)}
        placeholder={field.placeholder}
      />
    );
  }

  if (field.type === 'checkbox') {
    return (
      <label className="radio">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(field.name, e.target.checked)}
        />
        <span className="dot" style={{ borderRadius: 'var(--radius-sm)' }} />
        {value ? 'Yes' : 'No'}
      </label>
    );
  }

  if (field.type === 'number') {
    return (
      <input
        {...common}
        type="number"
        step="any"
        placeholder={field.placeholder}
        value={value ?? ''}
        onChange={(e) => onChange(field.name, e.target.value === '' ? null : Number(e.target.value))}
      />
    );
  }

  if (field.type === 'date') {
    return (
      <input
        {...common}
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(field.name, e.target.value)}
      />
    );
  }

  if (field.type === 'datetime') {
    return (
      <input
        {...common}
        type="datetime-local"
        value={value ?? ''}
        onChange={(e) => onChange(field.name, e.target.value)}
      />
    );
  }

  return (
    <input
      {...common}
      type="text"
      placeholder={field.placeholder}
      value={value ?? ''}
      onChange={(e) => onChange(field.name, e.target.value)}
    />
  );
}
'@
Write-Host 'wrote src\components\FieldInput.tsx'
New-Item -ItemType Directory -Force -Path "" | Out-Null
Set-Content -Path "src\modules\custom\AdmissionStage.tsx" -Encoding UTF8 -NoNewline -Value @'
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { FileUploadField } from '../../components/FileUploadField';
import { SelectOrOtherInput } from '../../components/SelectOrOtherInput';
import { OT_ROOMS } from '../commonOptions';
import { advanceVisitStageTo } from '../../lib/advanceVisitStage';
import { printDischargeSummary } from '../../lib/printDischargeSummary';
import { ADMISSION_CONSENT_TEXT } from '../moduleConfig';
import type { VisitStage } from '../../lib/types';

export function AdmissionStage({ visitId, stageOrder }: { visitId: string; stageOrder: VisitStage[] }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [bedId, setBedId] = useState('');
  const [consentSigned, setConsentSigned] = useState(false);
  const [consentFileUrl, setConsentFileUrl] = useState<string | null>(null);
  const [otForm, setOtForm] = useState({ procedure_name: '', eye: 'od', ot_room: '' });
  const [vitalsForm, setVitalsForm] = useState({ blood_pressure: '', pulse: '', temperature: '', spo2: '', notes: '' });
  const [recoveryForm, setRecoveryForm] = useState({ vitals_notes: '', pain_score: '0', discharge_instructions: '' });
  const [saving, setSaving] = useState(false);
  const [admitError, setAdmitError] = useState<string | null>(null);
  const [otError, setOtError] = useState<string | null>(null);
  const [vitalsError, setVitalsError] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [dischargeError, setDischargeError] = useState<string | null>(null);

  const { data: admission } = useQuery({
    queryKey: ['admission', visitId],
    queryFn: async () => {
      const { data, error } = await supabase.from('admissions').select('*, beds(bed_number, ward), ot_records(*, recovery_records(*)), ward_vitals(*)').eq('visit_id', visitId).order('admitted_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: availableBeds } = useQuery({
    queryKey: ['available-beds'],
    enabled: !admission,
    queryFn: async () => {
      const { data, error } = await supabase.from('beds').select('*').eq('status', 'available').order('bed_number');
      if (error) throw error;
      return data;
    },
  });

  const admitPatient = async () => {
    setSaving(true);
    setAdmitError(null);
    const { error } = await supabase.from('admissions').insert({
      visit_id: visitId,
      bed_id: bedId || null,
      consent_signed: consentSigned,
      consent_file_url: consentFileUrl,
      admitted_by: profile?.id,
    });
    if (error) {
      setSaving(false);
      setAdmitError(error.message);
      return;
    }
    if (bedId) {
      await supabase.from('beds').update({ status: 'occupied' }).eq('id', bedId);
      qc.invalidateQueries({ queryKey: ['available-beds'] });
    }
    setSaving(false);
    qc.invalidateQueries({ queryKey: ['admission', visitId] });
    await advanceVisitStageTo(visitId, 'admission', stageOrder);
    qc.invalidateQueries({ queryKey: ['visit', visitId] });
  };

  const addVitals = async () => {
    if (!admission) return;
    setSaving(true);
    setVitalsError(null);
    const { error } = await supabase.from('ward_vitals').insert({
      admission_id: admission.id,
      blood_pressure: vitalsForm.blood_pressure || null,
      pulse: vitalsForm.pulse || null,
      temperature: vitalsForm.temperature || null,
      spo2: vitalsForm.spo2 || null,
      notes: vitalsForm.notes || null,
      recorded_by: profile?.id,
    });
    setSaving(false);
    if (error) {
      setVitalsError(error.message);
      return;
    }
    setVitalsForm({ blood_pressure: '', pulse: '', temperature: '', spo2: '', notes: '' });
    qc.invalidateQueries({ queryKey: ['admission', visitId] });
  };

  const addOt = async () => {
    if (!admission || !otForm.procedure_name.trim()) return;
    setSaving(true);
    setOtError(null);
    const { error } = await supabase.from('ot_records').insert({
      admission_id: admission.id,
      procedure_name: otForm.procedure_name,
      eye: otForm.eye,
      ot_room: otForm.ot_room || null,
      surgeon_id: profile?.id,
      status: 'completed',
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
    });
    if (error) {
      setSaving(false);
      setOtError(error.message);
      return;
    }
    setSaving(false);
    setOtForm({ procedure_name: '', eye: 'od', ot_room: '' });
    qc.invalidateQueries({ queryKey: ['admission', visitId] });
    await advanceVisitStageTo(visitId, 'ot', stageOrder);
    qc.invalidateQueries({ queryKey: ['visit', visitId] });
  };

  const latestOt = admission?.ot_records?.[admission.ot_records.length - 1];

  const addRecovery = async () => {
    if (!latestOt) return;
    setSaving(true);
    setRecoveryError(null);
    const { error } = await supabase.from('recovery_records').insert({
      ot_record_id: latestOt.id,
      vitals_notes: recoveryForm.vitals_notes || null,
      pain_score: Number(recoveryForm.pain_score) || 0,
      discharge_instructions: recoveryForm.discharge_instructions || null,
      monitored_by: profile?.id,
    });
    if (error) {
      setSaving(false);
      setRecoveryError(error.message);
      return;
    }
    setSaving(false);
    setRecoveryForm({ vitals_notes: '', pain_score: '0', discharge_instructions: '' });
    qc.invalidateQueries({ queryKey: ['admission', visitId] });
    await advanceVisitStageTo(visitId, 'recovery', stageOrder);
    qc.invalidateQueries({ queryKey: ['visit', visitId] });
  };

  const dischargePatient = async () => {
    if (!admission) return;
    setSaving(true);
    setDischargeError(null);
    const { error } = await supabase.from('admissions').update({ discharged_at: new Date().toISOString() }).eq('id', admission.id);
    if (error) {
      setSaving(false);
      setDischargeError(error.message);
      return;
    }
    if (admission.bed_id) {
      await supabase.from('beds').update({ status: 'available' }).eq('id', admission.bed_id);
    }
    setSaving(false);
    qc.invalidateQueries({ queryKey: ['admission', visitId] });
    qc.invalidateQueries({ queryKey: ['available-beds'] });
    await advanceVisitStageTo(visitId, 'completed', stageOrder);
    qc.invalidateQueries({ queryKey: ['visit', visitId] });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <h4 style={{ marginTop: 0 }}>Admission &amp; Digital Consent</h4>
        {admission ? (
          <div style={{ fontSize: 14 }}>
            Admitted {new Date(admission.admitted_at).toLocaleString()} · Bed {admission.beds?.bed_number ?? admission.bed_number ?? '—'} {admission.beds?.ward ? `(${admission.beds.ward})` : ''} ·{' '}
            <span className={`tag ${admission.consent_signed ? 'tag-accent' : 'tag-outline'}`}>
              consent {admission.consent_signed ? 'signed' : 'pending'}
            </span>
            {admission.consent_file_url && (
              <>
                {' '}
                <a href={admission.consent_file_url} target="_blank" rel="noreferrer">View consent document</a>
              </>
            )}
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {admission.discharged_at ? (
                <span className="tag tag-accent">Discharged {new Date(admission.discharged_at).toLocaleString()}</span>
              ) : (
                <button className="btn btn-primary" onClick={dischargePatient} disabled={saving}>
                  {saving ? 'Discharging…' : 'Discharge patient'}
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => printDischargeSummary(visitId, admission)}>Print discharge summary</button>
              {dischargeError && <div style={{ color: '#b64545', fontSize: 13 }}>{dischargeError}</div>}
            </div>
          </div>
        ) : (
          <>
            <div className="card" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-3)', background: 'color-mix(in srgb, var(--color-accent) 5%, transparent)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {ADMISSION_CONSENT_TEXT}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 'var(--space-3)' }}>
              <div className="field">
                <label>Bed</label>
                <select className="input" value={bedId} onChange={(e) => setBedId(e.target.value)}>
                  <option value="">— unassigned —</option>
                  {availableBeds?.map((b: any) => <option key={b.id} value={b.id}>{b.bed_number} {b.ward ? `(${b.ward})` : ''}</option>)}
                </select>
                {availableBeds?.length === 0 && <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>No beds currently available</div>}
              </div>
              <label className="radio">
                <input type="checkbox" checked={consentSigned} onChange={(e) => setConsentSigned(e.target.checked)} />
                <span className="dot" style={{ borderRadius: 'var(--radius-sm)' }} /> Consent signed
              </label>
              <button className="btn btn-primary" onClick={admitPatient} disabled={saving}>Admit patient</button>
            </div>
            <div className="field" style={{ maxWidth: 320 }}>
              <label>Signed consent document</label>
              <FileUploadField value={consentFileUrl} onChange={setConsentFileUrl} folder="admissions" />
            </div>
            {admitError && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{admitError}</div>}
          </>
        )}
      </div>

      {admission && !admission.discharged_at && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <h4 style={{ marginTop: 0 }}>Ward vitals</h4>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
            <input className="input" style={{ flex: '0 1 120px' }} placeholder="BP (e.g. 120/80)" value={vitalsForm.blood_pressure} onChange={(e) => setVitalsForm((p) => ({ ...p, blood_pressure: e.target.value }))} />
            <input className="input" type="number" style={{ flex: '0 1 100px' }} placeholder="Pulse" value={vitalsForm.pulse} onChange={(e) => setVitalsForm((p) => ({ ...p, pulse: e.target.value }))} />
            <input className="input" type="number" step="0.1" style={{ flex: '0 1 100px' }} placeholder="Temp (°F)" value={vitalsForm.temperature} onChange={(e) => setVitalsForm((p) => ({ ...p, temperature: e.target.value }))} />
            <input className="input" type="number" style={{ flex: '0 1 100px' }} placeholder="SpO2 (%)" value={vitalsForm.spo2} onChange={(e) => setVitalsForm((p) => ({ ...p, spo2: e.target.value }))} />
            <input className="input" style={{ flex: '1 1 160px' }} placeholder="Notes" value={vitalsForm.notes} onChange={(e) => setVitalsForm((p) => ({ ...p, notes: e.target.value }))} />
            <button className="btn btn-secondary" onClick={addVitals} disabled={saving}>+ Record vitals</button>
          </div>
          {vitalsError && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-2)' }}>{vitalsError}</div>}
          {admission.ward_vitals?.length ? (
            <ul style={{ paddingLeft: 18, fontSize: 13 }}>
              {[...admission.ward_vitals].reverse().map((v: any) => (
                <li key={v.id}>BP {v.blood_pressure || '—'} · Pulse {v.pulse || '—'} · Temp {v.temperature || '—'} · SpO2 {v.spo2 || '—'} — {new Date(v.recorded_at).toLocaleString()}</li>
              ))}
            </ul>
          ) : <p className="text-muted">No ward vitals recorded yet.</p>}
        </div>
      )}

      {admission && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <h4 style={{ marginTop: 0 }}>OT record</h4>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
            <input className="input" style={{ flex: '1 1 200px' }} placeholder="Procedure name" value={otForm.procedure_name} onChange={(e) => setOtForm((p) => ({ ...p, procedure_name: e.target.value }))} />
            <select className="input" style={{ flex: '0 1 100px' }} value={otForm.eye} onChange={(e) => setOtForm((p) => ({ ...p, eye: e.target.value }))}>
              <option value="od">OD</option><option value="os">OS</option><option value="both">Both</option>
            </select>
            <div style={{ flex: '0 1 170px' }}><SelectOrOtherInput value={otForm.ot_room} options={OT_ROOMS} onChange={(v) => setOtForm((p) => ({ ...p, ot_room: v }))} placeholder="OT room" /></div>
            <button className="btn btn-secondary" onClick={addOt} disabled={saving}>+ Record OT</button>
          </div>
          {otError && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-2)' }}>{otError}</div>}
          {admission.ot_records?.length ? (
            <ul style={{ paddingLeft: 18, fontSize: 13 }}>
              {admission.ot_records.map((ot: any) => (
                <li key={ot.id}>{ot.procedure_name} ({ot.eye}) — {ot.status}</li>
              ))}
            </ul>
          ) : <p className="text-muted">No OT records yet.</p>}
        </div>
      )}

      {latestOt && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <h4 style={{ marginTop: 0 }}>Recovery</h4>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
            <input className="input" style={{ flex: '1 1 200px' }} placeholder="Vitals notes" value={recoveryForm.vitals_notes} onChange={(e) => setRecoveryForm((p) => ({ ...p, vitals_notes: e.target.value }))} />
            <input className="input" style={{ flex: '0 1 100px' }} type="number" min={0} max={10} placeholder="Pain 0-10" value={recoveryForm.pain_score} onChange={(e) => setRecoveryForm((p) => ({ ...p, pain_score: e.target.value }))} />
            <input className="input" style={{ flex: '1 1 200px' }} placeholder="Discharge instructions" value={recoveryForm.discharge_instructions} onChange={(e) => setRecoveryForm((p) => ({ ...p, discharge_instructions: e.target.value }))} />
            <button className="btn btn-secondary" onClick={addRecovery} disabled={saving}>+ Record recovery</button>
          </div>
          {recoveryError && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-2)' }}>{recoveryError}</div>}
          {latestOt.recovery_records?.length ? (
            <ul style={{ paddingLeft: 18, fontSize: 13 }}>
              {latestOt.recovery_records.map((r: any) => (
                <li key={r.id}>Pain {r.pain_score}/10 — {r.vitals_notes || 'no notes'} ({new Date(r.recorded_at).toLocaleString()})</li>
              ))}
            </ul>
          ) : <p className="text-muted">No recovery entries yet.</p>}
        </div>
      )}
    </div>
  );
}
'@
Write-Host 'wrote src\modules\custom\AdmissionStage.tsx'
New-Item -ItemType Directory -Force -Path "" | Out-Null
Set-Content -Path "src\modules\custom\InjectionStage.tsx" -Encoding UTF8 -NoNewline -Value @'
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { DrugPicker } from '../../components/DrugPicker';
import { SelectOrOtherInput } from '../../components/SelectOrOtherInput';
import { INJECTION_DOSES } from '../commonOptions';
import { deductDrugStock } from '../../lib/deductDrugStock';

const emptyForm = { eye: 'od', batch_number: '', dose: '', next_dose_due: '' };

/** Intravitreal injection record — a custom stage (not the generic RecordForm)
 * because it needs a catalog-linked drug_id to deduct real pharmacy stock on
 * save, the same way PharmacyStage dispensing does. */
export function InjectionStage({ visitId }: { visitId: string; stageOrder: unknown }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [drug, setDrug] = useState<{ drugId: string | null; name: string }>({ drugId: null, name: '' });
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof emptyForm, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const { data: records } = useQuery({
    queryKey: ['injection-records', visitId],
    queryFn: async () => {
      const { data, error } = await supabase.from('injection_records').select('*').eq('visit_id', visitId).order('injected_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const save = async () => {
    if (!drug.name.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('injection_records').insert({
      visit_id: visitId,
      eye: form.eye,
      drug_id: drug.drugId,
      drug_name: drug.name,
      batch_number: form.batch_number || null,
      dose: form.dose || null,
      next_dose_due: form.next_dose_due || null,
      injected_by: profile?.id,
    });
    if (insertError) {
      setSaving(false);
      setError(insertError.message);
      return;
    }
    const { error: stockError } = await deductDrugStock(drug.drugId, 1);
    setSaving(false);
    if (stockError) {
      setError(`Injection recorded, but stock wasn't updated: ${stockError}`);
    }
    setDrug({ drugId: null, name: '' });
    setForm(emptyForm);
    qc.invalidateQueries({ queryKey: ['injection-records', visitId] });
    qc.invalidateQueries({ queryKey: ['drugs'] });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <h4 style={{ marginTop: 0 }}>New injection record</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div className="field" style={{ flex: '0 1 110px' }}>
            <label>Eye</label>
            <select className="input" value={form.eye} onChange={(e) => set('eye', e.target.value)}>
              <option value="od">OD</option><option value="os">OS</option>
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 220px' }}>
            <label>Drug</label>
            <DrugPicker value={drug} onChange={setDrug} />
          </div>
          <div className="field" style={{ flex: '1 1 160px' }}>
            <label>Batch number</label>
            <input className="input" value={form.batch_number} onChange={(e) => set('batch_number', e.target.value)} />
          </div>
          <div className="field" style={{ flex: '1 1 140px' }}>
            <label>Dose</label>
            <SelectOrOtherInput value={form.dose} options={INJECTION_DOSES} onChange={(v) => set('dose', v)} />
          </div>
          <div className="field" style={{ flex: '1 1 160px' }}>
            <label>Next dose due</label>
            <input className="input" type="date" value={form.next_dose_due} onChange={(e) => set('next_dose_due', e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 'var(--space-3)' }} onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Record injection'}
        </button>
        {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      </div>

      <div>
        <h4>Injection history</h4>
        {records?.length ? records.map((r: any) => (
          <div key={r.id} className="card blueprint elev-sm" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
            <div className="card-meta">{new Date(r.injected_at).toLocaleString()}</div>
            <div style={{ fontSize: 13 }}>
              {r.eye.toUpperCase()} · {r.drug_name} {r.batch_number ? `(batch ${r.batch_number})` : ''} {r.dose ? `· ${r.dose}` : ''}
              {!r.drug_id && <span className="text-muted"> (not in catalog — stock unaffected)</span>}
              {r.next_dose_due && <div className="text-muted">Next dose due: {new Date(r.next_dose_due).toLocaleDateString()}</div>}
            </div>
          </div>
        )) : <p className="text-muted">No injections recorded yet for this visit.</p>}
      </div>
    </div>
  );
}

'@
Write-Host 'wrote src\modules\custom\InjectionStage.tsx'
New-Item -ItemType Directory -Force -Path "" | Out-Null
Set-Content -Path "src\pages\VisitWorkspacePage.tsx" -Encoding UTF8 -NoNewline -Value @'
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { Patient, Visit, VisitStage } from '../lib/types';
import { MODULES } from '../modules/moduleConfig';
import { RecordForm } from '../components/RecordForm';
import { RecordHistory } from '../components/RecordHistory';
import { PharmacyStage } from '../modules/custom/PharmacyStage';
import { BillingStage } from '../modules/custom/BillingStage';
import { AdmissionStage } from '../modules/custom/AdmissionStage';
import { OpticalStage } from '../modules/custom/OpticalStage';
import { DiagramStage } from '../modules/custom/DiagramStage';
import { InjectionStage } from '../modules/custom/InjectionStage';
import { PatientChartSummary } from '../components/PatientChartSummary';
import { GenerateClaimFileButton } from '../components/GenerateClaimFileButton';
import { PrintConsultationReportButton } from '../components/PrintConsultationReportButton';
import { printInvestigationRequisition } from '../lib/printInvestigationRequisition';
import { advanceVisitStageForStageKey } from '../lib/advanceVisitStage';
import { generateToken } from '../lib/tokenGenerator';
import { useIsMobile } from '../lib/useIsMobile';

// General OPD is the only module that tracks pre-testing steps (vision test,
// refraction, IOP, imaging) through the shared `visits.stage` enum — the
// specialty clinics track their equivalent steps through their own tables
// (visible as tabs below) instead, so their status dropdown only offers the
// stages that are actually meaningful for them.
const GENERAL_STAGE_ORDER: VisitStage[] = [
  'registration', 'waiting', 'vision_test', 'preliminary_assessment', 'refraction', 'iop', 'imaging',
  'consultation', 'investigation', 'pharmacy', 'optical', 'surgery_recommended', 'insurance_approval',
  'admission', 'ot', 'recovery', 'billing', 'feedback', 'follow_up', 'completed', 'cancelled',
];
const SPECIALTY_STAGE_ORDER: VisitStage[] = [
  'registration', 'waiting', 'consultation', 'investigation', 'pharmacy', 'optical',
  'surgery_recommended', 'insurance_approval', 'admission', 'ot', 'recovery',
  'billing', 'feedback', 'follow_up', 'completed', 'cancelled',
];

// Tables whose schema requires patient_id (NOT NULL), on top of visit_id —
// relevant only to stages still using the generic RecordForm (optical_orders
// and bills are handled by their own bespoke stage components instead).
const PATIENT_ID_REQUIRED_TABLES = new Set(['insurance_claims', 'feedback', 'follow_ups', 'parent_followups']);

function ReferralPanel({ patientId, currentModule }: { patientId: string; currentModule: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [targetModule, setTargetModule] = useState(Object.keys(MODULES).find((k) => k !== currentModule) ?? 'general');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refer = async () => {
    setCreating(true);
    setError(null);
    const token = await generateToken(targetModule);
    const { data, error: insertError } = await supabase
      .from('visits')
      .insert({ patient_id: patientId, clinic_module: targetModule, stage: 'waiting', token_number: token })
      .select()
      .single();
    setCreating(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    if (data) navigate(`/visits/${data.id}`);
  };

  if (!open) {
    return <button className="btn btn-secondary" onClick={() => setOpen(true)}>Refer to another clinic</button>;
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <select className="input" style={{ width: 180 }} value={targetModule} onChange={(e) => setTargetModule(e.target.value)}>
        {Object.values(MODULES).filter((m) => m.key !== currentModule).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
      </select>
      <button className="btn btn-primary" onClick={refer} disabled={creating}>{creating ? 'Starting…' : 'Start referral visit'}</button>
      <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      {error && <div style={{ color: '#b64545', fontSize: 12 }}>{error}</div>}
    </div>
  );
}

export function VisitWorkspacePage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [refreshTick, setRefreshTick] = useState(0);
  const isMobile = useIsMobile();

  const { data: visit } = useQuery({
    queryKey: ['visit', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('visits').select('*').eq('id', id).single();
      if (error) throw error;
      return data as Visit;
    },
  });

  const { data: patient } = useQuery({
    queryKey: ['patient', visit?.patient_id],
    enabled: !!visit,
    queryFn: async () => {
      const { data, error } = await supabase.from('patients').select('*').eq('id', visit!.patient_id).single();
      if (error) throw error;
      return data as Patient;
    },
  });

  const moduleConfig = visit ? MODULES[visit.clinic_module] : undefined;
  const [activeStageKey, setActiveStageKey] = useState<string | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<Record<string, any> | null>(null);
  const activeStage = moduleConfig?.stages.find((s) => s.key === activeStageKey) ?? moduleConfig?.stages[0];
  const stageOrder = visit?.clinic_module === 'general' ? GENERAL_STAGE_ORDER : SPECIALTY_STAGE_ORDER;

  const advanceStage = async (newStage: VisitStage) => {
    if (!visit) return;
    setStageError(null);
    const { error: updateError } = await supabase.from('visits').update({ stage: newStage }).eq('id', visit.id);
    if (updateError) {
      setStageError(updateError.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ['visit', id] });
  };

  if (!visit || !patient || !moduleConfig) return <p className="text-muted">Loading visit…</p>;

  const buildExtraValues = () => {
    if (activeStage && PATIENT_ID_REQUIRED_TABLES.has(activeStage.table)) {
      return { visit_id: visit.id, patient_id: patient.id };
    }
    return { visit_id: visit.id };
  };

  const handleGenericSaved = async () => {
    setRefreshTick((t) => t + 1);
    // Editing a past entry corrects it in place — it shouldn't re-trigger the
    // "first save of this stage advances the visit" logic that a brand-new
    // record does.
    const wasEditing = !!editingRecord;
    setEditingRecord(null);
    if (activeStage && !wasEditing) {
      await advanceVisitStageForStageKey(visit.id, activeStage.key, stageOrder);
      qc.invalidateQueries({ queryKey: ['visit', id] });
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <div>
          <Link to={`/patients/${patient.id}`} className="text-muted" style={{ fontSize: 12 }}>&larr; {patient.uhid}</Link>
          <h2 style={{ margin: '2px 0 0' }}>{patient.full_name} <span className="text-muted" style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 400 }}>· {moduleConfig.label}</span></h2>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="tag tag-accent">Token {visit.token_number ?? '—'}</span>
          <select className="input" value={visit.stage} onChange={(e) => advanceStage(e.target.value as VisitStage)} style={{ width: 200 }}>
            {stageOrder.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <PrintConsultationReportButton visitId={visit.id} moduleConfig={moduleConfig} />
          <GenerateClaimFileButton visitId={visit.id} />
          <ReferralPanel patientId={patient.id} currentModule={visit.clinic_module} />
        </div>
      </div>
      {stageError && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{stageError}</div>}

      <PatientChartSummary visitId={visit.id} moduleConfig={moduleConfig} excludeStageKey={activeStage?.key} />

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 'var(--space-6)', alignItems: 'flex-start' }}>
        <div
          style={
            isMobile
              ? { display: 'flex', gap: 6, overflowX: 'auto', width: '100%', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }
              : { width: 220, flex: 'none', display: 'flex', flexDirection: 'column', gap: 4 }
          }
        >
          {moduleConfig.stages.map((s) => (
            <button
              key={s.key}
              className="btn"
              style={{
                justifyContent: 'flex-start',
                border: 'none',
                flex: isMobile ? '0 0 auto' : undefined,
                whiteSpace: isMobile ? 'nowrap' : undefined,
                background: activeStage?.key === s.key ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent',
                color: activeStage?.key === s.key ? 'var(--color-accent-700)' : 'var(--color-text)',
                fontWeight: activeStage?.key === s.key ? 600 : 400,
              }}
              onClick={() => { setActiveStageKey(s.key); setEditingRecord(null); }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
          {activeStage && (
            <>
              <h3 style={{ marginTop: 0 }}>{activeStage.label}</h3>
              {activeStage.custom === 'pharmacy' && <PharmacyStage visitId={visit.id} stageOrder={stageOrder} />}
              {activeStage.custom === 'billing' && <BillingStage visitId={visit.id} patientId={patient.id} stageOrder={stageOrder} />}
              {activeStage.custom === 'admission' && <AdmissionStage visitId={visit.id} stageOrder={stageOrder} />}
              {activeStage.custom === 'optical' && <OpticalStage visitId={visit.id} patientId={patient.id} stageOrder={stageOrder} />}
              {activeStage.custom === 'diagrams' && <DiagramStage visitId={visit.id} patientId={patient.id} />}
              {activeStage.custom === 'injection' && <InjectionStage visitId={visit.id} stageOrder={stageOrder} />}
              {!activeStage.custom && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <RecordForm
                    stage={activeStage}
                    extraValues={buildExtraValues()}
                    onSaved={handleGenericSaved}
                    editingRecord={editingRecord}
                    onCancelEdit={() => setEditingRecord(null)}
                  />
                  <RecordHistory
                    stage={activeStage}
                    filterColumn="visit_id"
                    filterValue={visit.id}
                    refreshKey={refreshTick}
                    onEdit={setEditingRecord}
                    editingId={editingRecord?.id ?? null}
                    onPrint={activeStage.table === 'investigation_orders' ? (row) => printInvestigationRequisition(visit.id, row) : undefined}
                    printLabel="Print requisition"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

'@
Write-Host 'wrote src\pages\VisitWorkspacePage.tsx'
New-Item -ItemType Directory -Force -Path "" | Out-Null
Set-Content -Path "src\lib\printInvestigationRequisition.ts" -Encoding UTF8 -NoNewline -Value @'
import { supabase } from './supabaseClient';

function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

/** Prints a requisition slip for one ordered investigation — what the patient
 * carries to the diagnostics counter (OCT, visual field, imaging, labs). */
export async function printInvestigationRequisition(visitId: string, order: any) {
  const { data: visit } = await supabase.from('visits').select('patient_id').eq('id', visitId).single();
  const { data: patient } = await supabase.from('patients').select('*').eq('id', visit!.patient_id).single();
  const { data: hospital } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();
  const { data: orderedBy } = order.ordered_by
    ? await supabase.from('profiles').select('full_name').eq('id', order.ordered_by).maybeSingle()
    : { data: null };

  const win = window.open('', '_blank', 'width=650,height=850');
  if (!win) return;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Investigation Requisition — ${esc(patient?.full_name)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 620px; margin: 30px auto; padding: 0 20px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .muted { color: #666; font-size: 13px; }
  .box { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-top: 18px; }
  .box .label { font-size: 11px; text-transform: uppercase; color: #888; }
  .box .value { font-size: 18px; font-weight: 600; margin-top: 2px; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>${esc(hospital?.hospital_name ?? 'Netra Eye Hospital')}</h1>
  <div class="muted">${esc(hospital?.address)} ${hospital?.phone ? '· ' + esc(hospital.phone) : ''}</div>
  <div class="muted" style="margin-top:6px;">Ordered by ${esc(orderedBy?.full_name)} · ${new Date(order.created_at).toLocaleString()}</div>

  <div class="muted" style="margin-top:14px;">Patient: ${esc(patient?.full_name)} (${esc(patient?.uhid)})</div>
  <div class="muted">${esc(patient?.date_of_birth)} · ${esc(patient?.gender)} · ${esc(patient?.phone)}</div>

  <div class="box">
    <div class="label">Investigation requested</div>
    <div class="value">${esc(order.test_name)}</div>
  </div>
  <div class="muted" style="margin-top:10px;">Status: ${esc(order.status)}</div>

  <button onclick="window.print()" style="margin-top:24px;padding:8px 16px;">Print</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}

'@
Write-Host 'wrote src\lib\printInvestigationRequisition.ts'
New-Item -ItemType Directory -Force -Path "" | Out-Null
Set-Content -Path "src\components\RecordHistory.tsx" -Encoding UTF8 -NoNewline -Value @'
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { StageConfig } from '../modules/fieldTypes';

interface Props {
  stage: StageConfig;
  filterColumn: string;
  filterValue: string;
  refreshKey?: number;
  onEdit?: (row: any) => void;
  editingId?: string | null;
  onPrint?: (row: any) => void;
  printLabel?: string;
}

export function RecordHistory({ stage, filterColumn, filterValue, refreshKey, onEdit, editingId, onPrint, printLabel }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['history', stage.table, filterColumn, filterValue, refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(stage.table)
        .select('*')
        .eq(filterColumn, filterValue)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <p className="text-muted">Loading history…</p>;
  if (!data || data.length === 0) return <p className="text-muted">No records yet for this stage.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {data.map((row: any) => (
        <div key={row.id} className="card blueprint elev-sm" style={{ padding: 'var(--space-3)', outline: editingId === row.id ? '2px solid var(--color-accent)' : undefined }}>
          <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="card-meta">{new Date(row.created_at).toLocaleString()}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {onPrint && (
                <button type="button" className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => onPrint(row)}>
                  {printLabel ?? 'Print'}
                </button>
              )}
              {onEdit && (
                <button type="button" className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => onEdit(row)}>
                  {editingId === row.id ? 'Editing…' : 'Edit'}
                </button>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '4px 16px', fontSize: 13 }}>
            {stage.fields.map((f) => {
              const v = row[f.name];
              if (v === null || v === undefined || v === '') return null;
              return (
                <div key={f.name}>
                  <span className="text-muted">{f.label}: </span>
                  {f.type === 'file' ? (
                    <a href={String(v)} target="_blank" rel="noreferrer">View file</a>
                  ) : (
                    <span>{typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
'@
Write-Host 'wrote src\components\RecordHistory.tsx'
New-Item -ItemType Directory -Force -Path "" | Out-Null
Set-Content -Path "src\lib\printBillingEstimate.ts" -Encoding UTF8 -NoNewline -Value @'
function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

interface EstimateItem { description: string; category: string; quantity: string; unit_price: string; }
interface EstimateInput {
  patientName: string;
  patientUhid: string;
  hospitalName?: string;
  hospitalAddress?: string;
  hospitalPhone?: string;
  items: EstimateItem[];
  discount: number;
  tax: number;
  insuranceCovered: number;
}

/** Prints a non-binding cost estimate/quote for a proposed set of billing
 * line items — used to give a patient a figure before treatment is finalized
 * and a real bill is generated. Not persisted to the database. */
export function printBillingEstimate(input: EstimateInput) {
  const win = window.open('', '_blank', 'width=650,height=850');
  if (!win) return;

  const valid = input.items.filter((it) => it.description.trim());
  const subtotal = valid.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
  const total = Math.max(0, subtotal - input.discount + input.tax - input.insuranceCovered);

  const rowsHtml = valid
    .map((it) => {
      const amount = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${esc(it.description)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${esc(it.category)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${esc(it.quantity)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">₹${(Number(it.unit_price) || 0).toFixed(2)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">₹${amount.toFixed(2)}</td>
      </tr>`;
    })
    .join('');

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Cost Estimate — ${esc(input.patientName)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 640px; margin: 30px auto; padding: 0 20px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .muted { color: #666; font-size: 13px; }
  .watermark { display: inline-block; background: #fdf0d5; color: #8a5a1c; border-radius: 6px; padding: 2px 10px; font-size: 12px; font-weight: 600; margin-top: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th { text-align: left; padding: 6px 8px; border-bottom: 2px solid #333; font-size: 11px; text-transform: uppercase; }
  .totals { margin-top: 12px; font-size: 13px; }
  .totals div { display: flex; justify-content: space-between; max-width: 260px; margin-left: auto; padding: 2px 0; }
  .totals .grand { font-size: 18px; font-weight: 700; border-top: 1px solid #333; margin-top: 6px; padding-top: 6px; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>${esc(input.hospitalName ?? 'Netra Eye Hospital')}</h1>
  <div class="muted">${esc(input.hospitalAddress)} ${input.hospitalPhone ? '· ' + esc(input.hospitalPhone) : ''}</div>
  <div class="watermark">ESTIMATE — NOT A BILL</div>

  <div class="muted" style="margin-top:14px;">Patient: ${esc(input.patientName)} (${esc(input.patientUhid)})</div>
  <div class="muted">Generated ${new Date().toLocaleString()}</div>

  <table>
    <thead><tr><th>Description</th><th>Category</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Unit price</th><th style="text-align:right;">Amount</th></tr></thead>
    <tbody>${rowsHtml || '<tr><td colspan="5" style="padding:8px;color:#999;">No items</td></tr>'}</tbody>
  </table>

  <div class="totals">
    <div><span>Subtotal</span><span>₹${subtotal.toFixed(2)}</span></div>
    <div><span>Discount</span><span>-₹${input.discount.toFixed(2)}</span></div>
    <div><span>Tax / GST</span><span>₹${input.tax.toFixed(2)}</span></div>
    <div><span>Insurance covered</span><span>-₹${input.insuranceCovered.toFixed(2)}</span></div>
    <div class="grand"><span>Estimated total</span><span>₹${total.toFixed(2)}</span></div>
  </div>

  <div class="muted" style="margin-top:20px;font-size:11px;">This is a non-binding estimate. Final charges may vary based on actual treatment provided.</div>

  <button onclick="window.print()" style="margin-top:16px;padding:8px 16px;">Print</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}

'@
Write-Host 'wrote src\lib\printBillingEstimate.ts'
New-Item -ItemType Directory -Force -Path "" | Out-Null
Set-Content -Path "src\modules\custom\BillingStage.tsx" -Encoding UTF8 -NoNewline -Value @'
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { BillPaymentControls } from '../../components/BillPaymentControls';
import { SelectOrOtherInput } from '../../components/SelectOrOtherInput';
import { BILLING_LINE_ITEMS } from '../commonOptions';
import { advanceVisitStageTo } from '../../lib/advanceVisitStage';
import { printBillingEstimate } from '../../lib/printBillingEstimate';
import type { VisitStage } from '../../lib/types';

interface ItemDraft { description: string; category: string; quantity: string; unit_price: string; }
const emptyItem: ItemDraft = { description: '', category: 'consultation', quantity: '1', unit_price: '' };

function genBillNumber() {
  return `BILL-${Date.now().toString(36).toUpperCase().slice(-8)}`;
}

export function BillingStage({ visitId, patientId, stageOrder }: { visitId: string; patientId: string; stageOrder: VisitStage[] }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [items, setItems] = useState<ItemDraft[]>([{ ...emptyItem }]);
  const [discount, setDiscount] = useState('0');
  const [tax, setTax] = useState('0');
  const [insuranceCovered, setInsuranceCovered] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: async () => {
      const { data, error } = await supabase.from('patients').select('full_name, uhid').eq('id', patientId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: hospital } = useQuery({
    queryKey: ['hospital-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: bills } = useQuery({
    queryKey: ['bills', visitId],
    queryFn: async () => {
      const { data, error } = await supabase.from('bills').select('*, bill_items(*)').eq('visit_id', visitId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Cross-reference with Insurance Desk instead of billing staff re-typing the same
  // number — pull the most recent approved/settled claim for this visit, if any.
  const { data: approvedClaim } = useQuery({
    queryKey: ['approved-claim', visitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insurance_claims')
        .select('*')
        .eq('visit_id', visitId)
        .in('status', ['approved', 'settled'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const subtotal = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
  const total = Math.max(0, subtotal - Number(discount || 0) + Number(tax || 0) - Number(insuranceCovered || 0));

  const updateItem = (i: number, key: keyof ItemDraft, value: string) => {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));
  };

  const saveBill = async () => {
    const valid = items.filter((it) => it.description.trim());
    if (valid.length === 0) return;
    setSaving(true);
    setError(null);
    const { data: bill, error: billError } = await supabase.from('bills').insert({
      visit_id: visitId,
      patient_id: patientId,
      bill_number: genBillNumber(),
      subtotal,
      discount: Number(discount) || 0,
      tax: Number(tax) || 0,
      insurance_covered: Number(insuranceCovered) || 0,
      total_amount: total,
      payment_method: paymentMethod,
      generated_by: profile?.id,
    }).select().single();
    if (billError || !bill) {
      setSaving(false);
      setError(billError?.message ?? 'Could not create bill.');
      return;
    }
    const itemRows = valid.map((it) => ({
      bill_id: bill.id,
      description: it.description,
      category: it.category,
      quantity: Number(it.quantity) || 1,
      unit_price: Number(it.unit_price) || 0,
      amount: (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    }));
    const { error: itemsError } = await supabase.from('bill_items').insert(itemRows);
    setSaving(false);
    if (itemsError) {
      setError(`Bill created, but line items failed to save: ${itemsError.message}`);
      qc.invalidateQueries({ queryKey: ['bills', visitId] });
      return;
    }
    setItems([{ ...emptyItem }]);
    setDiscount('0'); setTax('0'); setInsuranceCovered('0');
    qc.invalidateQueries({ queryKey: ['bills', visitId] });
    await advanceVisitStageTo(visitId, 'billing', stageOrder);
    qc.invalidateQueries({ queryKey: ['visit', visitId] });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <h4 style={{ marginTop: 0 }}>Generate bill</h4>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <div style={{ flex: '2 1 200px' }}><SelectOrOtherInput value={it.description} options={BILLING_LINE_ITEMS} onChange={(v) => updateItem(i, 'description', v)} placeholder="Description" /></div>
            <select className="input" style={{ flex: '1 1 140px' }} value={it.category} onChange={(e) => updateItem(i, 'category', e.target.value)}>
              {['consultation', 'investigation', 'pharmacy', 'optical', 'surgery', 'admission', 'other'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input className="input" style={{ flex: '0 1 80px' }} type="number" placeholder="Qty" value={it.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} />
            <input className="input" style={{ flex: '0 1 120px' }} type="number" placeholder="Unit price" value={it.unit_price} onChange={(e) => updateItem(i, 'unit_price', e.target.value)} />
          </div>
        ))}
        <button type="button" className="btn btn-secondary" onClick={() => setItems((prev) => [...prev, { ...emptyItem }])}>+ Add line item</button>

        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="field">
            <label>Discount</label>
            <input className="input" type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </div>
          <div className="field">
            <label>Tax / GST</label>
            <input className="input" type="number" value={tax} onChange={(e) => setTax(e.target.value)} />
          </div>
          <div className="field">
            <label>Insurance covered</label>
            <input className="input" type="number" value={insuranceCovered} onChange={(e) => setInsuranceCovered(e.target.value)} />
          </div>
          <div className="field">
            <label>Payment method</label>
            <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {['cash', 'card', 'upi', 'insurance', 'other'].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {approvedClaim && Number(approvedClaim.approved_amount) !== Number(insuranceCovered) && (
          <div className="card" style={{ padding: 'var(--space-2) var(--space-3)', marginTop: 'var(--space-2)', background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>Insurance Desk approved ₹{Number(approvedClaim.approved_amount).toFixed(2)} ({approvedClaim.scheme ?? 'claim'}, status {approvedClaim.status}).</span>
            <button type="button" className="btn btn-ghost" onClick={() => setInsuranceCovered(String(approvedClaim.approved_amount))}>Use this amount</button>
          </div>
        )}

        <div style={{ marginTop: 'var(--space-3)', fontFamily: 'var(--font-heading)', fontSize: 20 }}>
          Total: ₹{total.toFixed(2)} <span className="text-muted" style={{ fontSize: 13, fontFamily: 'var(--font-body)' }}>(subtotal ₹{subtotal.toFixed(2)})</span>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-2)' }}>
          <button className="btn btn-primary" onClick={saveBill} disabled={saving}>{saving ? 'Saving…' : 'Generate bill'}</button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => printBillingEstimate({
              patientName: patient?.full_name ?? '', patientUhid: patient?.uhid ?? '',
              hospitalName: hospital?.hospital_name, hospitalAddress: hospital?.address, hospitalPhone: hospital?.phone,
              items, discount: Number(discount) || 0, tax: Number(tax) || 0, insuranceCovered: Number(insuranceCovered) || 0,
            })}
          >
            Print estimate
          </button>
        </div>
        {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      </div>

      <div>
        <h4>Bill history</h4>
        {bills?.length ? bills.map((b: any) => (
          <div key={b.id} className="card blueprint elev-sm" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <strong>{b.bill_number} · ₹{Number(b.total_amount).toFixed(2)}</strong>
              <BillPaymentControls bill={b} patient={patient ?? undefined} onChanged={() => qc.invalidateQueries({ queryKey: ['bills', visitId] })} />
            </div>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
              {b.bill_items?.map((it: any) => <li key={it.id}>{it.description} × {it.quantity} — ₹{Number(it.amount).toFixed(2)}</li>)}
            </ul>
          </div>
        )) : <p className="text-muted">No bills yet.</p>}
      </div>
    </div>
  );
}
'@
Write-Host 'wrote src\modules\custom\BillingStage.tsx'
New-Item -ItemType Directory -Force -Path "" | Out-Null
Set-Content -Path "src\lib\printRecordRequestReceipt.ts" -Encoding UTF8 -NoNewline -Value @'
import { supabase } from './supabaseClient';

function esc(s: any): string {
  if (s === null || s === undefined || s === '') return '—';
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

/** Prints an acknowledgement receipt for a logged medical-record disclosure
 * request — proof for the requestor that the request was received/issued,
 * and a paper trail for MRD's own register. */
export async function printRecordRequestReceipt(request: any) {
  const { data: hospital } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();
  const { data: authorizer } = request.authorized_by
    ? await supabase.from('profiles').select('full_name').eq('id', request.authorized_by).maybeSingle()
    : { data: null };

  const win = window.open('', '_blank', 'width=650,height=850');
  if (!win) return;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Record Request Receipt — ${esc(request.patients?.full_name)}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; max-width: 620px; margin: 30px auto; padding: 0 20px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .muted { color: #666; font-size: 13px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 13px; margin-top: 16px; }
  .grid div span.k { color: #666; }
  .sign { margin-top: 60px; display: flex; justify-content: space-between; font-size: 12px; }
  .sign div { border-top: 1px solid #999; padding-top: 4px; width: 200px; }
  @media print { button { display: none; } }
</style>
</head>
<body>
  <h1>${esc(hospital?.hospital_name ?? 'Netra Eye Hospital')} — Medical Records Department</h1>
  <div class="muted">${esc(hospital?.address)} ${hospital?.phone ? '· ' + esc(hospital.phone) : ''}</div>
  <div class="muted" style="margin-top:6px;">Record Request Receipt · Logged ${new Date(request.created_at).toLocaleString()}</div>

  <div class="grid">
    <div><span class="k">Patient:</span> ${esc(request.patients?.full_name)} (${esc(request.patients?.uhid)})</div>
    <div><span class="k">Status:</span> ${esc(request.status)}</div>
    <div><span class="k">Requestor type:</span> ${esc(String(request.requestor_type).replace(/_/g, ' '))}</div>
    <div><span class="k">Requestor name:</span> ${esc(request.requestor_name)}</div>
    <div style="grid-column: span 2;"><span class="k">Purpose:</span> ${esc(request.purpose)}</div>
    <div><span class="k">Authorized by:</span> ${esc(authorizer?.full_name)}</div>
    <div><span class="k">Issued at:</span> ${request.issued_at ? new Date(request.issued_at).toLocaleString() : '—'}</div>
  </div>

  <div class="sign">
    <div>Requestor signature</div>
    <div>MRD staff signature</div>
  </div>

  <button onclick="window.print()" style="margin-top:24px;padding:8px 16px;">Print</button>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
}

'@
Write-Host 'wrote src\lib\printRecordRequestReceipt.ts'
New-Item -ItemType Directory -Force -Path "" | Out-Null
Set-Content -Path "src\pages\MrdRecordRequestsPage.tsx" -Encoding UTF8 -NoNewline -Value @'
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { sanitizeSearchTerm } from '../lib/sanitizeSearchTerm';
import { printRecordRequestReceipt } from '../lib/printRecordRequestReceipt';

const REQUESTOR_TYPES = ['patient', 'insurance', 'legal', 'referring_doctor', 'other'];
const STATUSES = ['requested', 'approved', 'issued', 'rejected'];

function NewRequestForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [patientQuery, setPatientQuery] = useState('');
  const debouncedQuery = useDebouncedValue(patientQuery, 300);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [form, setForm] = useState({ requestor_type: 'patient', requestor_name: '', purpose: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: matches } = useQuery({
    queryKey: ['mrd-patient-search', debouncedQuery],
    enabled: debouncedQuery.length > 1,
    queryFn: async () => {
      const { data, error } = await supabase.from('patients').select('*').or(`full_name.ilike.%${sanitizeSearchTerm(debouncedQuery)}%,uhid.ilike.%${sanitizeSearchTerm(debouncedQuery)}%`).limit(8);
      if (error) throw error;
      return data;
    },
  });

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('record_requests').insert({
      patient_id: selectedPatient.id,
      requestor_type: form.requestor_type,
      requestor_name: form.requestor_name || null,
      purpose: form.purpose || null,
      notes: form.notes || null,
      authorized_by: profile?.id,
      created_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['record-requests'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Log record request</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 240px', position: 'relative' }}>
          <label>Patient *</label>
          <input className="input" value={selectedPatient ? `${selectedPatient.full_name} (${selectedPatient.uhid})` : patientQuery}
            onChange={(e) => { setSelectedPatient(null); setPatientQuery(e.target.value); }} placeholder="Search name or UHID" />
          {!selectedPatient && matches && matches.length > 0 && (
            <div className="card elev-md" style={{ position: 'absolute', zIndex: 10, width: '100%', maxHeight: 200, overflowY: 'auto', padding: 4 }}>
              {matches.map((p: any) => <div key={p.id} style={{ padding: 6, cursor: 'pointer' }} onClick={() => setSelectedPatient(p)}>{p.full_name} — {p.uhid}</div>)}
            </div>
          )}
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label>Requestor type</label>
          <select className="input" value={form.requestor_type} onChange={(e) => set('requestor_type', e.target.value)}>
            {REQUESTOR_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Requestor name</label><input className="input" value={form.requestor_name} onChange={(e) => set('requestor_name', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Purpose</label><input className="input" value={form.purpose} onChange={(e) => set('purpose', e.target.value)} placeholder="e.g. insurance claim, legal proceeding, referral" /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Notes</label><textarea className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving || !selectedPatient}>{saving ? 'Saving…' : 'Log request'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

export function MrdRecordRequestsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: requests, isLoading } = useQuery({
    queryKey: ['record-requests'],
    queryFn: async () => {
      const { data, error } = await supabase.from('record_requests').select('*, patients(full_name, uhid)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = async (id: string, status: string) => {
    setError(null);
    const payload: Record<string, any> = { status };
    if (status === 'issued') payload.issued_at = new Date().toISOString();
    const { error: updateError } = await supabase.from('record_requests').update(payload).eq('id', id);
    if (updateError) { setError(updateError.message); return; }
    qc.invalidateQueries({ queryKey: ['record-requests'] });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>Record Request Register</h2>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Log request</button>}
      </div>
      <p className="text-muted" style={{ fontSize: 13, marginTop: -8 }}>Every disclosure of a patient's record outside the hospital — to the patient, an insurer, a legal request, or a referring doctor — logged with who authorized it.</p>

      {showForm && <NewRequestForm onDone={() => setShowForm(false)} />}
      {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}

      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Patient</th><th>Requestor</th><th>Purpose</th><th>Logged</th><th>Status</th><th /></tr></thead>
          <tbody>
            {requests?.map((r: any) => (
              <tr key={r.id}>
                <td>{r.patients?.full_name} <span className="text-muted">({r.patients?.uhid})</span></td>
                <td>{r.requestor_type.replace(/_/g, ' ')}{r.requestor_name ? ` — ${r.requestor_name}` : ''}</td>
                <td>{r.purpose ?? '—'}</td>
                <td>{new Date(r.created_at).toLocaleDateString()}</td>
                <td>
                  <select className="input" value={r.status} onChange={(e) => updateStatus(r.id, e.target.value)} style={{ width: 150 }}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td><button className="btn btn-ghost" onClick={() => printRecordRequestReceipt(r)}>Print receipt</button></td>
              </tr>
            ))}
            {requests?.length === 0 && <tr><td colSpan={6} className="text-muted">No record requests logged yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

'@
Write-Host 'wrote src\pages\MrdRecordRequestsPage.tsx'
New-Item -ItemType Directory -Force -Path "" | Out-Null
Set-Content -Path "src\lib\printOutreachReferralSlip.ts" -Encoding UTF8 -NoNewline -Value @'
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

'@
Write-Host 'wrote src\lib\printOutreachReferralSlip.ts'
New-Item -ItemType Directory -Force -Path "" | Out-Null
Set-Content -Path "src\pages\OutreachCampsPage.tsx" -Encoding UTF8 -NoNewline -Value @'
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { sanitizeSearchTerm } from '../lib/sanitizeSearchTerm';
import { printOutreachReferralSlip } from '../lib/printOutreachReferralSlip';

function NewCampForm({ onDone, editing }: { onDone: () => void; editing?: any }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState(editing
    ? { camp_name: editing.camp_name ?? '', location: editing.location ?? '', camp_date: editing.camp_date ?? '', organized_by: editing.organized_by ?? '', notes: editing.notes ?? '' }
    : { camp_name: '', location: '', camp_date: '', organized_by: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.camp_name.trim()) return;
    setSaving(true);
    setError(null);
    const { error: saveError } = editing
      ? await supabase.from('outreach_camps').update(form).eq('id', editing.id)
      : await supabase.from('outreach_camps').insert({ ...form, created_by: profile?.id });
    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    qc.invalidateQueries({ queryKey: ['outreach-camps'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>{editing ? 'Edit camp' : 'Schedule camp'}</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 220px' }}><label>Camp name *</label><input className="input" value={form.camp_name} onChange={(e) => set('camp_name', e.target.value)} required /></div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Location</label><input className="input" value={form.location} onChange={(e) => set('location', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Camp date</label><input className="input" type="date" value={form.camp_date} onChange={(e) => set('camp_date', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Organized by</label><input className="input" value={form.organized_by} onChange={(e) => set('organized_by', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Notes</label><textarea className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Schedule camp'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function NewScreeningForm({ campId, onDone }: { campId: string; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ person_name: '', age: '', gender: '', contact_phone: '', village_or_area: '', screening_findings: '' });
  const [referred, setReferred] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.person_name.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('camp_screenings').insert({
      camp_id: campId,
      person_name: form.person_name,
      age: form.age ? Number(form.age) : null,
      gender: form.gender || null,
      contact_phone: form.contact_phone || null,
      village_or_area: form.village_or_area || null,
      screening_findings: form.screening_findings || null,
      referred_to_hospital: referred,
      recorded_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['camp-screenings', campId] });
    setForm({ person_name: '', age: '', gender: '', contact_phone: '', village_or_area: '', screening_findings: '' });
    setReferred(false);
    onDone();
  };

  return (
    <form onSubmit={submit} className="card" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <input className="input" style={{ flex: '1 1 160px' }} placeholder="Name *" value={form.person_name} onChange={(e) => set('person_name', e.target.value)} required />
        <input className="input" style={{ flex: '0 1 80px' }} type="number" placeholder="Age" value={form.age} onChange={(e) => set('age', e.target.value)} />
        <select className="input" style={{ flex: '0 1 120px' }} value={form.gender} onChange={(e) => set('gender', e.target.value)}>
          <option value="">Gender</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
        </select>
        <input className="input" style={{ flex: '1 1 140px' }} placeholder="Phone" value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} />
        <input className="input" style={{ flex: '1 1 160px' }} placeholder="Village / area" value={form.village_or_area} onChange={(e) => set('village_or_area', e.target.value)} />
        <input className="input" style={{ flex: '1 1 100%' }} placeholder="Screening findings" value={form.screening_findings} onChange={(e) => set('screening_findings', e.target.value)} />
        <label className="radio">
          <input type="checkbox" checked={referred} onChange={(e) => setReferred(e.target.checked)} />
          <span className="dot" style={{ borderRadius: 'var(--radius-sm)' }} /> Referred to hospital
        </label>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : '+ Add screening'}</button>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 12, marginTop: 6 }}>{error}</div>}
    </form>
  );
}

function CampDetail({ camp, onClose }: { camp: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [linkQuery, setLinkQuery] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingCamp, setEditingCamp] = useState(false);
  const debouncedLinkQuery = useDebouncedValue(linkQuery ?? '', 300);

  const { data: screenings } = useQuery({
    queryKey: ['camp-screenings', camp.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('camp_screenings').select('*, patients(full_name, uhid)').eq('camp_id', camp.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: patientMatches } = useQuery({
    queryKey: ['camp-link-patient-search', debouncedLinkQuery],
    enabled: !!linkQuery && debouncedLinkQuery.length > 1,
    queryFn: async () => {
      const term = sanitizeSearchTerm(debouncedLinkQuery);
      const { data, error } = await supabase.from('patients').select('*').or(`full_name.ilike.%${term}%,uhid.ilike.%${term}%`).limit(6);
      if (error) throw error;
      return data;
    },
  });

  const linkPatient = async (screeningId: string, patientId: string) => {
    setError(null);
    const { error: updateError } = await supabase.from('camp_screenings').update({ linked_patient_id: patientId }).eq('id', screeningId);
    if (updateError) { setError(updateError.message); return; }
    setLinkQuery(null);
    qc.invalidateQueries({ queryKey: ['camp-screenings', camp.id] });
  };

  return (
    <div className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      {editingCamp ? (
        <NewCampForm editing={camp} onDone={() => setEditingCamp(false)} />
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h4 style={{ margin: 0 }}>{camp.camp_name}</h4>
            <div className="text-muted" style={{ fontSize: 13 }}>{camp.location} · {camp.camp_date ? new Date(camp.camp_date).toLocaleDateString() : '—'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => setEditingCamp(true)}>Edit camp</button>
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      )}

      <NewScreeningForm campId={camp.id} onDone={() => {}} />
      {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 8 }}>{error}</div>}

      <table className="table">
        <thead><tr><th>Name</th><th>Age/Gender</th><th>Village</th><th>Findings</th><th>Referred</th><th>Linked Patient</th><th /></tr></thead>
        <tbody>
          {screenings?.map((s: any) => (
            <tr key={s.id}>
              <td>{s.person_name}</td>
              <td>{s.age ?? '—'} / {s.gender ?? '—'}</td>
              <td>{s.village_or_area ?? '—'}</td>
              <td className="text-muted">{s.screening_findings ?? '—'}</td>
              <td>{s.referred_to_hospital ? <span className="tag tag-accent">Yes</span> : <span className="text-muted">No</span>}</td>
              <td>
                {s.referred_to_hospital && (
                  <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => printOutreachReferralSlip(s, camp.camp_name)}>Print referral</button>
                )}
              </td>
              <td>
                {s.patients ? (
                  <span className="tag tag-outline">{s.patients.full_name} ({s.patients.uhid})</span>
                ) : linkQuery !== null && linkQuery === s.id ? (
                  <div style={{ position: 'relative' }}>
                    <input className="input" style={{ width: 160 }} placeholder="Search patient…" autoFocus
                      onChange={(e) => setLinkQuery(e.target.value || s.id)} />
                    {patientMatches && patientMatches.length > 0 && (
                      <div className="card elev-md" style={{ position: 'absolute', zIndex: 10, width: 220, maxHeight: 160, overflowY: 'auto', padding: 4 }}>
                        {patientMatches.map((p: any) => (
                          <div key={p.id} style={{ padding: 6, cursor: 'pointer', fontSize: 12 }} onClick={() => linkPatient(s.id, p.id)}>{p.full_name} — {p.uhid}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <button className="btn btn-ghost" onClick={() => setLinkQuery(s.id)}>Link to patient</button>
                )}
              </td>
            </tr>
          ))}
          {screenings?.length === 0 && <tr><td colSpan={7} className="text-muted">No screenings logged for this camp yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function OutreachCampsPage() {
  const [showForm, setShowForm] = useState(false);
  const [openCampId, setOpenCampId] = useState<string | null>(null);

  const { data: camps, isLoading } = useQuery({
    queryKey: ['outreach-camps'],
    queryFn: async () => {
      const { data, error } = await supabase.from('outreach_camps').select('*, camp_screenings(id, referred_to_hospital)').order('camp_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const openCamp = camps?.find((c: any) => c.id === openCampId);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>Outreach & Community Camps</h2>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Schedule camp</button>}
      </div>

      {showForm && <NewCampForm onDone={() => setShowForm(false)} />}
      {openCamp && <CampDetail camp={openCamp} onClose={() => setOpenCampId(null)} />}

      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Camp</th><th>Location</th><th>Date</th><th>Status</th><th>Screened</th><th>Referred</th><th></th></tr></thead>
          <tbody>
            {camps?.map((c: any) => (
              <tr key={c.id}>
                <td>{c.camp_name}</td>
                <td>{c.location ?? '—'}</td>
                <td>{c.camp_date ? new Date(c.camp_date).toLocaleDateString() : '—'}</td>
                <td><span className="tag tag-neutral">{c.status}</span></td>
                <td>{c.camp_screenings?.length ?? 0}</td>
                <td>{c.camp_screenings?.filter((s: any) => s.referred_to_hospital).length ?? 0}</td>
                <td><button className="btn btn-ghost" onClick={() => setOpenCampId(c.id)}>Open</button></td>
              </tr>
            ))}
            {camps?.length === 0 && <tr><td colSpan={7} className="text-muted">No camps scheduled yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

'@
Write-Host 'wrote src\pages\OutreachCampsPage.tsx'
New-Item -ItemType Directory -Force -Path "" | Out-Null
Set-Content -Path "src\pages\EyeBankDonorsPage.tsx" -Encoding UTF8 -NoNewline -Value @'
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { FileUploadField } from '../components/FileUploadField';

function NewDonorForm({ onDone, editing }: { onDone: () => void; editing?: any }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState(editing
    ? { donor_name: editing.donor_name ?? '', age: editing.age != null ? String(editing.age) : '', gender: editing.gender ?? '', cause_of_death: editing.cause_of_death ?? '', date_of_death: editing.date_of_death ?? '', next_of_kin_name: editing.next_of_kin_name ?? '', next_of_kin_contact: editing.next_of_kin_contact ?? '' }
    : { donor_name: '', age: '', gender: '', cause_of_death: '', date_of_death: '', next_of_kin_name: '', next_of_kin_contact: '' });
  const [consentObtained, setConsentObtained] = useState(editing?.consent_obtained ?? false);
  const [consentDocUrl, setConsentDocUrl] = useState<string | null>(editing?.consent_document_url ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.donor_name.trim()) return;
    setSaving(true);
    setError(null);
    const payload = {
      donor_name: form.donor_name,
      age: form.age ? Number(form.age) : null,
      gender: form.gender || null,
      cause_of_death: form.cause_of_death || null,
      date_of_death: form.date_of_death || null,
      next_of_kin_name: form.next_of_kin_name || null,
      next_of_kin_contact: form.next_of_kin_contact || null,
      consent_obtained: consentObtained,
      consent_document_url: consentDocUrl,
    };
    const { error: saveError } = editing
      ? await supabase.from('eye_bank_donors').update(payload).eq('id', editing.id)
      : await supabase.from('eye_bank_donors').insert({ ...payload, registered_by: profile?.id });
    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    qc.invalidateQueries({ queryKey: ['eye-bank-donors'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>{editing ? 'Edit donor' : 'Register donor'}</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 220px' }}><label>Donor name *</label><input className="input" value={form.donor_name} onChange={(e) => set('donor_name', e.target.value)} required /></div>
        <div className="field" style={{ flex: '1 1 100px' }}><label>Age</label><input className="input" type="number" value={form.age} onChange={(e) => set('age', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 140px' }}>
          <label>Gender</label>
          <select className="input" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
            <option value="">—</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 220px' }}><label>Cause of death</label><input className="input" value={form.cause_of_death} onChange={(e) => set('cause_of_death', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Date of death</label><input className="input" type="datetime-local" value={form.date_of_death} onChange={(e) => set('date_of_death', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Next of kin name</label><input className="input" value={form.next_of_kin_name} onChange={(e) => set('next_of_kin_name', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Next of kin contact</label><input className="input" value={form.next_of_kin_contact} onChange={(e) => set('next_of_kin_contact', e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
        <label className="radio">
          <input type="checkbox" checked={consentObtained} onChange={(e) => setConsentObtained(e.target.checked)} />
          <span className="dot" style={{ borderRadius: 'var(--radius-sm)' }} /> Consent obtained from next of kin
        </label>
        <div className="field" style={{ maxWidth: 300 }}>
          <label>Signed consent document</label>
          <FileUploadField value={consentDocUrl} onChange={setConsentDocUrl} folder="eye_bank" />
        </div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving\u2026' : editing ? 'Save changes' : 'Register donor'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

export function EyeBankDonorsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingDonor, setEditingDonor] = useState<any>(null);
  const { data: donors, isLoading } = useQuery({
    queryKey: ['eye-bank-donors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('eye_bank_donors').select('*, eye_bank_tissues(id)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>Eye Bank — Donors</h2>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Register donor</button>}
      </div>
      <p className="text-muted" style={{ fontSize: 13, marginTop: -8 }}>Donor identity and consent records. Tissue harvesting, serology, and allocation are tracked separately under Eye Bank — Tissues.</p>

      {showForm && <NewDonorForm onDone={() => setShowForm(false)} />}
      {editingDonor && <NewDonorForm editing={editingDonor} onDone={() => setEditingDonor(null)} />}

      {isLoading ? <p className="text-muted">Loading\u2026</p> : (
        <table className="table">
          <thead><tr><th>Donor</th><th>Age / Gender</th><th>Cause of Death</th><th>Consent</th><th>Tissues Logged</th><th /></tr></thead>
          <tbody>
            {donors?.map((d: any) => (
              <tr key={d.id}>
                <td>{d.donor_name}</td>
                <td>{d.age ?? '\u2014'} / {d.gender ?? '\u2014'}</td>
                <td className="text-muted">{d.cause_of_death ?? '\u2014'}</td>
                <td><span className={`tag ${d.consent_obtained ? 'tag-accent' : 'tag-outline'}`}>{d.consent_obtained ? 'Obtained' : 'Pending'}</span></td>
                <td>{d.eye_bank_tissues?.length ?? 0}</td>
                <td><button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setEditingDonor(d)}>Edit</button></td>
              </tr>
            ))}
            {donors?.length === 0 && <tr><td colSpan={6} className="text-muted">No donors registered yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

'@
Write-Host 'wrote src\pages\EyeBankDonorsPage.tsx'
New-Item -ItemType Directory -Force -Path "" | Out-Null
Set-Content -Path "src\pages\EyeBankTissuesPage.tsx" -Encoding UTF8 -NoNewline -Value @'
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

const PRESERVATION_METHODS = ['mccarey_kaufman', 'optisol_gs', 'cryopreservation', 'other'];
const SEROLOGY_STATUSES = ['pending', 'non_reactive', 'reactive'];
const STATUSES = ['available', 'allocated', 'used', 'discarded', 'expired'];

function genTissueNumber() {
  return `EB-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function NewTissueForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [donorId, setDonorId] = useState('');
  const [form, setForm] = useState({ eye: 'od', retrieval_datetime: '', preservation_method: 'optisol_gs', tissue_quality_grade: '', expiry_date: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: donors } = useQuery({
    queryKey: ['eye-bank-donors-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('eye_bank_donors').select('id, donor_name').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!donorId) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('eye_bank_tissues').insert({
      donor_id: donorId,
      tissue_number: genTissueNumber(),
      eye: form.eye,
      retrieval_datetime: form.retrieval_datetime || null,
      retrieved_by: profile?.id,
      preservation_method: form.preservation_method,
      tissue_quality_grade: form.tissue_quality_grade || null,
      expiry_date: form.expiry_date || null,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['eye-bank-tissues'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Log harvested tissue</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 220px' }}>
          <label>Donor *</label>
          <select className="input" value={donorId} onChange={(e) => setDonorId(e.target.value)} required>
            <option value="">— select donor —</option>
            {donors?.map((d: any) => <option key={d.id} value={d.id}>{d.donor_name}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 120px' }}>
          <label>Eye</label>
          <select className="input" value={form.eye} onChange={(e) => set('eye', e.target.value)}>
            <option value="od">OD</option><option value="os">OS</option><option value="both">Both</option>
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Retrieval date/time</label><input className="input" type="datetime-local" value={form.retrieval_datetime} onChange={(e) => set('retrieval_datetime', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 180px' }}>
          <label>Preservation method</label>
          <select className="input" value={form.preservation_method} onChange={(e) => set('preservation_method', e.target.value)}>
            {PRESERVATION_METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Tissue quality grade</label><input className="input" value={form.tissue_quality_grade} onChange={(e) => set('tissue_quality_grade', e.target.value)} placeholder="e.g. ECD 2400/mm²" /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Expiry date</label><input className="input" type="date" value={form.expiry_date} onChange={(e) => set('expiry_date', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Log tissue'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function TissueRow({ tissue }: { tissue: any }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const expiryDays = tissue.expiry_date ? daysUntil(tissue.expiry_date) : null;
  const expiringSoon = expiryDays !== null && expiryDays <= 3;

  const updateField = async (field: string, value: string) => {
    setError(null);
    const { error: updateError } = await supabase.from('eye_bank_tissues').update({ [field]: value }).eq('id', tissue.id);
    if (updateError) { setError(updateError.message); return; }
    qc.invalidateQueries({ queryKey: ['eye-bank-tissues'] });
  };

  return (
    <tr>
      <td>{tissue.tissue_number}</td>
      <td>{tissue.eye_bank_donors?.donor_name}</td>
      <td>{tissue.eye.toUpperCase()}</td>
      <td>
        <select className="input" value={tissue.preservation_method} onChange={(e) => updateField('preservation_method', e.target.value)} style={{ width: 150 }}>
          {PRESERVATION_METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
        </select>
      </td>
      <td>
        <select className="input" value={tissue.serology_hiv} onChange={(e) => updateField('serology_hiv', e.target.value)} style={{ width: 120 }}>
          {SEROLOGY_STATUSES.map((s) => <option key={s} value={s}>HIV: {s.replace(/_/g, ' ')}</option>)}
        </select>
      </td>
      <td>
        <select className="input" value={tissue.serology_hbsag} onChange={(e) => updateField('serology_hbsag', e.target.value)} style={{ width: 130 }}>
          {SEROLOGY_STATUSES.map((s) => <option key={s} value={s}>HBsAg: {s.replace(/_/g, ' ')}</option>)}
        </select>
      </td>
      <td>
        <select className="input" value={tissue.serology_hcv} onChange={(e) => updateField('serology_hcv', e.target.value)} style={{ width: 120 }}>
          {SEROLOGY_STATUSES.map((s) => <option key={s} value={s}>HCV: {s.replace(/_/g, ' ')}</option>)}
        </select>
      </td>
      <td>
        <input className="input" type="date" style={{ width: 130, ...(expiringSoon ? { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' } : {}) }} value={tissue.expiry_date ?? ''} onChange={(e) => updateField('expiry_date', e.target.value)} />
        {expiringSoon && <div style={{ fontSize: 11, color: '#8a2c2c' }}>{expiryDays}d left</div>}
      </td>
      <td>
        <select className="input" value={tissue.status} onChange={(e) => updateField('status', e.target.value)} style={{ width: 130 }}>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      {error && <td style={{ color: '#b64545', fontSize: 11 }}>{error}</td>}
    </tr>
  );
}

export function EyeBankTissuesPage() {
  const [showForm, setShowForm] = useState(false);
  const { data: tissues, isLoading } = useQuery({
    queryKey: ['eye-bank-tissues'],
    queryFn: async () => {
      const { data, error } = await supabase.from('eye_bank_tissues').select('*, eye_bank_donors(donor_name)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const expiringSoonCount = (tissues ?? []).filter((t: any) => t.expiry_date && t.status === 'available' && daysUntil(t.expiry_date) <= 3).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>Eye Bank — Tissues</h2>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Log tissue</button>}
      </div>
      {expiringSoonCount > 0 && (
        <div className="card" style={{ padding: 'var(--space-2) var(--space-3)', marginBottom: 'var(--space-4)', background: '#f6dede' }}>
          <span style={{ color: '#8a2c2c', fontSize: 13 }}>{expiringSoonCount} tissue(s) expiring within 3 days and still marked available.</span>
        </div>
      )}

      {showForm && <NewTissueForm onDone={() => setShowForm(false)} />}

      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Tissue #</th><th>Donor</th><th>Eye</th><th>Preservation</th><th>HIV</th><th>HBsAg</th><th>HCV</th><th>Expiry</th><th>Status</th></tr></thead>
          <tbody>
            {tissues?.map((t: any) => <TissueRow key={t.id} tissue={t} />)}
            {tissues?.length === 0 && <tr><td colSpan={9} className="text-muted">No tissue records yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

'@
Write-Host 'wrote src\pages\EyeBankTissuesPage.tsx'
Write-Host 'All 19 files written.'
git add -A
git status