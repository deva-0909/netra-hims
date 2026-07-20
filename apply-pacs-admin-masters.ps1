# Netra HIMS — apply-pacs-admin-masters.ps1
# Run once from your project root (E:\netra-hims-app\netra-hims-app)
$root = Get-Location
Write-Host "Writing files under: $root"

$dest = Join-Path $root "src\modules\commonOptions.ts"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
// Centralized option lists so every dropdown pulls from one source of truth
// instead of each form inventing its own list (and drifting out of sync).

export const VA_OPTIONS = [
  '6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60',
  '5/60', '4/60', '3/60', '2/60', '1/60',
  'CF 1m', 'CF 2m', 'CF 3m', 'HM', 'PL+', 'PL-', 'NPL',
];

export const IOL_FORMULAS = ['SRK/T', 'SRK II', 'Holladay 1', 'Holladay 2', 'Hoffer Q', 'Haigis', 'Barrett Universal II'];

export const INSURANCE_SCHEMES = [
  'Star Health', 'HDFC Ergo', 'ICICI Lombard', 'Bajaj Allianz', 'Care Health',
  'Niva Bupa', 'Ayushman Bharat / PMJAY', 'State Government Scheme', 'Self-pay / No insurance',
];

export const GUARDIAN_RELATIONS = ['Mother', 'Father', 'Spouse', 'Son', 'Daughter', 'Sibling', 'Guardian'];

export const CYCLOPLEGIC_AGENTS = ['Cyclopentolate 1%', 'Atropine 1%', 'Tropicamide 0.8% + Phenylephrine 5%', 'Homatropine 2%'];

export const OT_ROOMS = ['OT-1', 'OT-2', 'OT-3', 'Minor OT / Procedure Room'];

export const LENS_COATINGS = ['Anti-reflective', 'UV Protection', 'Blue Light Filter', 'Scratch Resistant', 'Photochromic', 'None'];

export const INVESTIGATION_TESTS = [
  'Fasting Blood Sugar', 'HbA1c', 'ECG', 'CBC', 'Serum Creatinine',
  'Chest X-Ray', 'Urine Routine', 'Coagulation Profile', 'Liver Function Test',
];

export const SURGERY_PROCEDURES = [
  'Phacoemulsification with foldable IOL', 'ECCE with PCIOL', 'Trabeculectomy',
  'Vitrectomy', 'LASIK', 'PRK', 'SMILE', 'Pterygium Excision',
  'DCR (Dacryocystorhinostomy)', 'Squint Surgery',
];

export const SYMPTOM_DURATIONS = ['Less than 1 day', '1–7 days', '1–4 weeks', '1–6 months', 'More than 6 months', 'Chronic / longstanding'];

export const APPOINTMENT_REASONS = [
  'Routine eye check', 'Follow-up', 'Vision complaint', 'Eye pain or redness',
  'Pre-surgery evaluation', 'Post-surgery review', 'Referral from another clinic',
];

export const MEDICATION_FREQUENCIES = [
  'OD (once daily)', 'BD (twice daily)', 'TDS (thrice daily)', 'QID (four times daily)',
  'STAT (immediately)', 'HS (at bedtime)', 'PRN (as needed)', 'QOD (every other day)',
];

export const COMMON_DOSAGES = ['1 drop', '2 drops', '1 tablet', '2 tablets', '5 ml', '10 ml'];

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const BILLING_LINE_ITEMS = [
  'Consultation Fee', 'Vision Test', 'Refraction', 'IOP Measurement', 'Biometry',
  'OCT Scan', 'Fundus Photography', 'Visual Field Test', 'Cataract Surgery Package',
  'LASIK Procedure', 'Intravitreal Injection', 'Eyewear — Frame & Lens',
  'Follow-up Consultation', 'Room Charges (per day)', 'Nursing Charges',
];

export const COMMON_DIAGNOSES = [
  'Senile Cataract', 'Refractive Error — Myopia', 'Refractive Error — Hyperopia', 'Astigmatism',
  'Primary Open Angle Glaucoma', 'Diabetic Retinopathy', 'Dry Eye Disease', 'Conjunctivitis',
  'Pterygium', 'Retinal Detachment', 'Age-related Macular Degeneration',
];

// Paired 1:1 with COMMON_DIAGNOSES above so a doctor picking a diagnosis can
// also quickly pick the matching code — kept as its own select-or-other
// field rather than auto-linked, since the same diagnosis can map to more
// than one valid code depending on laterality/severity.
export const ICD10_CODES = ['H25.9', 'H52.1', 'H52.0', 'H52.2', 'H40.9', 'E11.3', 'H04.12', 'H10.9', 'H11.0', 'H33.0', 'H35.3'];

export const RETINA_DRUGS = ['Ranibizumab', 'Bevacizumab', 'Aflibercept', 'Brolucizumab', 'Triamcinolone Acetonide', 'Dexamethasone Implant'];
export const INJECTION_DOSES = ['0.5 mg / 0.05 mL', '1.25 mg / 0.05 mL', '2.0 mg / 0.05 mL', '4 mg / 0.1 mL'];
export const ANGLE_GRADES = ['Grade IV (wide open)', 'Grade III (open)', 'Grade II (moderately narrow)', 'Grade I (very narrow)', 'Grade 0 (closed)'];
export const VF_TEST_PATTERNS = ['24-2', '30-2', '10-2', '60-4'];
export const VF_RELIABILITY = ['Good, low fixation losses', 'Unreliable — high fixation losses', 'Unreliable — high false positives', 'Unreliable — high false negatives'];
export const LASIK_COMPLICATIONS = ['None', 'Dry eyes', 'Glare / halos', 'Undercorrection', 'Overcorrection', 'Flap complication', 'Infection'];
export const BINOCULAR_VISION_STATUS = ['Normal', 'Suppression', 'Diplopia', 'Amblyopia'];
export const STEREOPSIS_LEVELS = ['Normal (40 arcsec)', 'Reduced', 'Absent'];
export const PEDIATRIC_DIAGNOSES = [
  'Refractive Amblyopia', 'Strabismic Amblyopia', 'Accommodative Esotropia', 'Congenital Esotropia',
  'Intermittent Exotropia', 'Congenital Cataract', 'Retinopathy of Prematurity',
];

export const PEDIATRIC_SCREENING_METHODS = ['fix_and_follow', 'allen_cards', 'lea_symbols', 'snellen', 'teller_acuity_cards', 'other'];
export const COOPERATION_LEVELS = ['good', 'fair', 'poor'];
'@
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\modules\commonOptions.ts"

$dest = Join-Path $root "src\modules\moduleConfig.ts"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
import type { ModuleConfig, StageConfig } from './fieldTypes';
import {
  VA_OPTIONS, IOL_FORMULAS, CYCLOPLEGIC_AGENTS,
  SURGERY_PROCEDURES, SYMPTOM_DURATIONS, COMMON_DIAGNOSES, ICD10_CODES,
  RETINA_DRUGS, INJECTION_DOSES, ANGLE_GRADES, VF_TEST_PATTERNS, VF_RELIABILITY,
  LASIK_COMPLICATIONS, BINOCULAR_VISION_STATUS, STEREOPSIS_LEVELS, PEDIATRIC_DIAGNOSES,
  PEDIATRIC_SCREENING_METHODS, COOPERATION_LEVELS,
} from './commonOptions';

// Shared across every clinic — the operational back-half of a visit (order
// tests, prescribe, dispense glasses, recommend surgery, handle insurance,
// admit/operate/recover, bill, collect feedback, schedule follow-up) is the
// same regardless of which clinic saw the patient. Previously only the
// General OPD module had these tabs, which meant a retina/glaucoma/LASIK/
// pediatric visit had no way to prescribe, bill, or get insurance approval
// at all — a real gap, not just a cosmetic one.
const SHARED_SUPPORT_STAGES: StageConfig[] = [
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
        { name: 'drug_name', label: 'Drug Name', type: 'select_or_other', options: RETINA_DRUGS },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ],
    },
    {
      key: 'injection', label: 'Intravitreal Injection Record', table: 'injection_records', staffField: 'injected_by',
      fields: [
        { name: 'eye', label: 'Eye', type: 'select', options: ['od', 'os'], half: true },
        { name: 'drug_name', label: 'Drug Name', type: 'select_or_other', options: RETINA_DRUGS, half: true },
        { name: 'batch_number', label: 'Batch Number', type: 'text', half: true },
        { name: 'dose', label: 'Dose', type: 'select_or_other', options: INJECTION_DOSES, half: true },
        { name: 'next_dose_due', label: 'Next Dose Due', type: 'date' },
      ],
    },
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
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\modules\moduleConfig.ts"

$dest = Join-Path $root "src\modules\fieldTypes.ts"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'select_or_other' | 'db_select_or_other' | 'checkbox' | 'date' | 'datetime' | 'file';

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  options?: string[]; // for select / select_or_other
  dbTable?: string;   // for db_select_or_other — table to fetch active options from
  dbColumn?: string;  // for db_select_or_other — column holding the display value
  half?: boolean; // render at half width (paired fields like OD/OS)
  placeholder?: string;
}

export interface StageConfig {
  key: string;           // unique key within the module
  label: string;         // shown in the step list
  table: string;         // supabase table this stage writes to
  fields: FieldConfig[];
  staffField?: string;   // column to auto-fill with current profile id, e.g. 'performed_by'
  linkColumn?: 'visit_id' | 'admission_id' | 'ot_record_id' | 'retina_treatment_id' | 'prescription_id';
  description?: string;
  custom?: 'pharmacy' | 'admission' | 'billing' | 'optical'; // rendered by a bespoke component instead of the generic form
}

export interface ModuleConfig {
  key: string;
  label: string;
  stages: StageConfig[];
}
'@
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\modules\fieldTypes.ts"

$dest = Join-Path $root "src\components\FieldInput.tsx"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
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
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\components\FieldInput.tsx"

$dest = Join-Path $root "src\components\DbSelectOrOtherInput.tsx"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { SelectOrOtherInput } from './SelectOrOtherInput';

interface Props {
  value: string | null | undefined;
  onChange: (value: string) => void;
  dbTable: string;
  dbColumn: string;
  placeholder?: string;
}

/** Same UX as SelectOrOtherInput, but the option list is admin-managed data
 * (Insurance Masters, Investigation Masters, etc.) instead of a hardcoded
 * list — so changes made in Administration → Masters show up here live. */
export function DbSelectOrOtherInput({ value, onChange, dbTable, dbColumn, placeholder }: Props) {
  const { data: options } = useQuery({
    queryKey: ['master-options', dbTable, dbColumn],
    queryFn: async () => {
      const { data, error } = await supabase.from(dbTable).select(dbColumn).eq('active', true).order(dbColumn);
      if (error) throw error;
      return (data ?? []).map((row: any) => row[dbColumn] as string);
    },
  });

  return <SelectOrOtherInput value={value} options={options ?? []} onChange={onChange} placeholder={placeholder} />;
}
'@
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\components\DbSelectOrOtherInput.tsx"

$dest = Join-Path $root "src\components\Layout.tsx"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, DEMO_MODE } from '../lib/AuthContext';
import { MODULES } from '../modules/moduleConfig';
import { ROLE_NAV } from '../modules/roleNav';
import { RoleSwitcher } from './RoleSwitcher';
import { useIsMobile } from '../lib/useIsMobile';

const SUPPORT_META: Record<string, { to: string; label: string }> = {
  pharmacy: { to: '/pharmacy', label: 'Pharmacy' },
  pharmacy_inventory: { to: '/pharmacy/inventory', label: 'Pharmacy Inventory' },
  optical: { to: '/optical', label: 'Optical' },
  optical_inventory: { to: '/optical/inventory', label: 'Optical Inventory' },
  billing: { to: '/billing', label: 'Billing' },
  insurance: { to: '/insurance', label: 'Insurance Desk' },
};

const adminLinks = [
  { to: '/admin/staff', label: 'Staff & Roles' },
  { to: '/admin/departments', label: 'Doctors & Departments' },
  { to: '/admin/settings', label: 'Hospital Settings' },
  { to: '/admin/masters', label: 'Insurance & Investigation Masters' },
  { to: '/admin/templates', label: 'Communication Templates' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/audit-log', label: 'Audit Log' },
];

function NavSection({ title, links, onNavigate }: { title: string; links: { to: string; label: string }[]; onNavigate: () => void }) {
  if (links.length === 0) return null;
  return (
    <>
      <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-accent-700)', padding: '13.6px 6.8px 4px' }}>
        {title}
      </div>
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          onClick={onNavigate}
          style={({ isActive }) => ({
            display: 'block',
            padding: '10px 6.8px',
            fontSize: 14,
            color: isActive ? 'var(--color-accent-700)' : 'var(--color-text)',
            background: isActive ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'transparent',
            borderRadius: 'var(--radius-md)',
          })}
        >
          {l.label}
        </NavLink>
      ))}
    </>
  );
}

const topLinkStyle = ({ isActive }: { isActive: boolean }) => ({
  display: 'block',
  padding: '10px 6.8px',
  fontSize: 14,
  fontWeight: 600,
  color: isActive ? 'var(--color-accent-700)' : 'var(--color-text)',
});

export function Layout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Fall back to showing nothing extra if role is somehow unrecognized —
  // Dashboard is always available so the app never looks fully empty.
  const nav = (profile && ROLE_NAV[profile.role]) ?? { patients: false, appointments: false, waitingBoard: false, journeys: [], support: [] };

  const journeyLinks = nav.journeys
    .map((key) => MODULES[key])
    .filter(Boolean)
    .map((m) => ({ to: `/journeys/${m.key}`, label: m.label }));

  const supportLinks = nav.support.map((key) => SUPPORT_META[key]).filter(Boolean);

  // Close the drawer automatically whenever the route changes (mobile only).
  const closeDrawer = () => setDrawerOpen(false);

  const sidebarContent = (
    <>
      <div style={{ padding: '0 6.8px 20.4px' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 20, letterSpacing: '-0.01em' }}>NETRA HIMS</div>
        <div style={{ fontSize: 11, color: 'color-mix(in srgb, var(--color-text) 55%, transparent)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>
          360&deg; Eye Hospital
        </div>
      </div>

      <NavLink to="/" onClick={closeDrawer} style={topLinkStyle}>Dashboard</NavLink>
      {nav.patients && <NavLink to="/patients" onClick={closeDrawer} style={topLinkStyle}>Patients</NavLink>}
      {nav.appointments && <NavLink to="/appointments" onClick={closeDrawer} style={topLinkStyle}>Appointments</NavLink>}
      {nav.waitingBoard && <NavLink to="/waiting-room" onClick={closeDrawer} style={topLinkStyle}>Waiting Room</NavLink>}

      <NavSection title="Patient Journeys" links={journeyLinks} onNavigate={closeDrawer} />
      <NavSection title="Support Modules" links={supportLinks} onNavigate={closeDrawer} />
      {profile?.role === 'admin' && <NavSection title="Administration" links={adminLinks} onNavigate={closeDrawer} />}

      <div style={{ marginTop: 'auto', paddingTop: '13.6px', borderTop: '1px solid var(--color-divider)' }}>
        <div style={{ fontSize: 12, marginBottom: 8 }}>{profile?.full_name}</div>
        <RoleSwitcher />
        {!DEMO_MODE && (
          <button
            className="btn btn-secondary btn-block"
            onClick={async () => {
              await signOut();
              navigate('/login');
            }}
          >
            Sign out
          </button>
        )}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--color-divider)', flex: 'none' }}>
          <button
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            style={{ background: 'none', border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-md)', width: 40, height: 40, fontSize: 18, cursor: 'pointer' }}
          >
            &#9776;
          </button>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 17 }}>NETRA HIMS</div>
        </div>

        {drawerOpen && (
          <div
            onClick={closeDrawer}
            style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, var(--color-neutral-900, #111) 45%, transparent)', zIndex: 40 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed', top: 0, left: 0, bottom: 0, width: 'min(80vw, 280px)',
                background: 'var(--color-bg)', borderRight: '1px solid var(--color-divider)',
                display: 'flex', flexDirection: 'column', padding: '20.4px 13.6px', overflowY: 'auto', zIndex: 41,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <button aria-label="Close menu" onClick={closeDrawer} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>&times;</button>
              </div>
              {sidebarContent}
            </div>
          </div>
        )}

        <div key={location.pathname} style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          <div style={{ padding: 'var(--space-4)' }}>
            <Outlet />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)', overflow: 'hidden' }}>
      <div style={{ width: 236, flex: 'none', borderRight: '1px solid var(--color-divider)', display: 'flex', flexDirection: 'column', padding: '20.4px 13.6px', overflowY: 'auto' }}>
        {sidebarContent}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto', overflowX: 'auto' }}>
        <div style={{ padding: 'var(--space-6)' }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
'@
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\components\Layout.tsx"

$dest = Join-Path $root "src\pages\AdminHospitalSettingsPage.tsx"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

export function AdminHospitalSettingsPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ hospital_name: '', tagline: '', address: '', phone: '', email: '', working_hours: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['hospital-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('hospital_settings').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings) {
      setForm({
        hospital_name: settings.hospital_name ?? '',
        tagline: settings.tagline ?? '',
        address: settings.address ?? '',
        phone: settings.phone ?? '',
        email: settings.email ?? '',
        working_hours: settings.working_hours ?? '',
      });
    }
  }, [settings]);

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSavedOk(false);
    const { error: updateError } = await supabase.from('hospital_settings').update({ ...form, updated_by: profile?.id }).eq('id', settings.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSavedOk(true);
    qc.invalidateQueries({ queryKey: ['hospital-settings'] });
  };

  if (!settings) return <p className="text-muted">Loading…</p>;

  return (
    <div>
      <h2>Hospital Settings</h2>
      <form onSubmit={submit} className="card" style={{ padding: 'var(--space-4)', maxWidth: 640 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div className="field" style={{ flex: '1 1 260px' }}><label>Hospital name</label><input className="input" value={form.hospital_name} onChange={(e) => set('hospital_name', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 260px' }}><label>Tagline</label><input className="input" value={form.tagline} onChange={(e) => set('tagline', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 100%' }}><label>Address</label><input className="input" value={form.address} onChange={(e) => set('address', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 200px' }}><label>Phone</label><input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 200px' }}><label>Email</label><input className="input" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
          <div className="field" style={{ flex: '1 1 260px' }}><label>Working hours</label><input className="input" value={form.working_hours} onChange={(e) => set('working_hours', e.target.value)} placeholder="e.g. Mon–Sat, 9 AM – 7 PM" /></div>
        </div>
        {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
        {savedOk && <div style={{ color: 'var(--color-accent-700)', fontSize: 13, marginTop: 'var(--space-2)' }}>Saved.</div>}
        <button className="btn btn-primary" type="submit" disabled={saving} style={{ marginTop: 'var(--space-3)' }}>{saving ? 'Saving…' : 'Save settings'}</button>
      </form>
    </div>
  );
}
'@
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\pages\AdminHospitalSettingsPage.tsx"

$dest = Join-Path $root "src\pages\AdminDepartmentsPage.tsx"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

export function AdminDepartmentsPage() {
  const qc = useQueryClient();
  const [newDept, setNewDept] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('departments').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: staff } = useQuery({
    queryKey: ['staff-with-departments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*, departments(name)').order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const addDepartment = async () => {
    if (!newDept.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('departments').insert({ name: newDept });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setNewDept('');
    qc.invalidateQueries({ queryKey: ['departments'] });
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('departments').update({ active: !active }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['departments'] });
  };

  const assignDepartment = async (staffId: string, departmentId: string) => {
    await supabase.from('profiles').update({ department_id: departmentId || null }).eq('id', staffId);
    qc.invalidateQueries({ queryKey: ['staff-with-departments'] });
  };

  return (
    <div>
      <h2>Doctors & Departments</h2>

      <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)', maxWidth: 480 }}>
        <h4 style={{ marginTop: 0 }}>Add department</h4>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="Department name" />
          <button className="btn btn-primary" onClick={addDepartment} disabled={saving}>Add</button>
        </div>
        {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 6 }}>{error}</div>}
      </div>

      <h4>Departments</h4>
      <table className="table" style={{ marginBottom: 'var(--space-6)' }}>
        <thead><tr><th>Name</th><th>Description</th><th>Status</th></tr></thead>
        <tbody>
          {departments?.map((d: any) => (
            <tr key={d.id}>
              <td>{d.name}</td>
              <td className="text-muted">{d.description ?? '—'}</td>
              <td><button className={`btn ${d.active ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggleActive(d.id, d.active)}>{d.active ? 'Active' : 'Inactive'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>Staff → department assignment</h4>
      <table className="table">
        <thead><tr><th>Staff</th><th>Role</th><th>Department</th></tr></thead>
        <tbody>
          {staff?.map((s: any) => (
            <tr key={s.id}>
              <td>{s.full_name}</td>
              <td>{s.role.replace(/_/g, ' ')}</td>
              <td>
                <select className="input" value={s.department_id ?? ''} onChange={(e) => assignDepartment(s.id, e.target.value)} style={{ width: 200 }}>
                  <option value="">— none —</option>
                  {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
'@
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\pages\AdminDepartmentsPage.tsx"

$dest = Join-Path $root "src\pages\AdminMastersPage.tsx"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

function InsuranceMastersTab() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState('private');
  const [error, setError] = useState<string | null>(null);

  const { data: schemes } = useQuery({
    queryKey: ['insurance-masters'],
    queryFn: async () => {
      const { data, error } = await supabase.from('insurance_masters').select('*').order('scheme_name');
      if (error) throw error;
      return data;
    },
  });

  const add = async () => {
    if (!name.trim()) return;
    setError(null);
    const { error: insertError } = await supabase.from('insurance_masters').insert({ scheme_name: name, scheme_type: type });
    if (insertError) { setError(insertError.message); return; }
    setName('');
    qc.invalidateQueries({ queryKey: ['insurance-masters'] });
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('insurance_masters').update({ active: !active }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['insurance-masters'] });
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: '1 1 220px' }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Scheme name (e.g. Ayushman Bharat / PMJAY)" />
        <select className="input" style={{ width: 160 }} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="private">Private</option><option value="government">Government</option><option value="corporate">Corporate</option>
        </select>
        <button className="btn btn-primary" onClick={add}>Add scheme</button>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 8 }}>{error}</div>}
      <table className="table">
        <thead><tr><th>Scheme</th><th>Type</th><th>Status</th></tr></thead>
        <tbody>
          {schemes?.map((s: any) => (
            <tr key={s.id}>
              <td>{s.scheme_name}</td>
              <td className="text-muted">{s.scheme_type}</td>
              <td><button className={`btn ${s.active ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggleActive(s.id, s.active)}>{s.active ? 'Active' : 'Inactive'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvestigationMastersTab() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('lab');
  const [error, setError] = useState<string | null>(null);

  const { data: tests } = useQuery({
    queryKey: ['investigation-masters'],
    queryFn: async () => {
      const { data, error } = await supabase.from('investigation_masters').select('*').order('test_name');
      if (error) throw error;
      return data;
    },
  });

  const add = async () => {
    if (!name.trim()) return;
    setError(null);
    const { error: insertError } = await supabase.from('investigation_masters').insert({ test_name: name, category });
    if (insertError) { setError(insertError.message); return; }
    setName('');
    qc.invalidateQueries({ queryKey: ['investigation-masters'] });
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('investigation_masters').update({ active: !active }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['investigation-masters'] });
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: '1 1 220px' }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Test name" />
        <select className="input" style={{ width: 160 }} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="lab">Lab</option><option value="imaging">Imaging</option><option value="cardiac">Cardiac</option><option value="other">Other</option>
        </select>
        <button className="btn btn-primary" onClick={add}>Add test</button>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 8 }}>{error}</div>}
      <table className="table">
        <thead><tr><th>Test</th><th>Category</th><th>Status</th></tr></thead>
        <tbody>
          {tests?.map((t: any) => (
            <tr key={t.id}>
              <td>{t.test_name}</td>
              <td className="text-muted">{t.category}</td>
              <td><button className={`btn ${t.active ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggleActive(t.id, t.active)}>{t.active ? 'Active' : 'Inactive'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminMastersPage() {
  const [tab, setTab] = useState<'insurance' | 'investigation'>('insurance');

  return (
    <div>
      <h2>Insurance, PMJAY & Investigation Masters</h2>
      <p className="text-muted" style={{ fontSize: 13 }}>
        These lists feed the dropdowns used across Insurance Approval and Investigation Order screens hospital-wide.
      </p>
      <div className="seg" style={{ maxWidth: 360, marginBottom: 'var(--space-4)' }}>
        <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
          <input type="radio" checked={tab === 'insurance'} onChange={() => setTab('insurance')} /> Insurance / PMJAY schemes
        </label>
        <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
          <input type="radio" checked={tab === 'investigation'} onChange={() => setTab('investigation')} /> Investigation tests
        </label>
      </div>
      {tab === 'insurance' ? <InsuranceMastersTab /> : <InvestigationMastersTab />}
    </div>
  );
}
'@
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\pages\AdminMastersPage.tsx"

$dest = Join-Path $root "src\pages\AdminCommunicationTemplatesPage.tsx"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

const CHANNELS = ['sms', 'whatsapp', 'email'];

export function AdminCommunicationTemplatesPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', channel: 'sms', subject: '', body: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: templates } = useQuery({
    queryKey: ['communication-templates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('communication_templates').select('*').order('channel').order('name');
      if (error) throw error;
      return data;
    },
  });

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.body.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('communication_templates').insert({
      name: form.name, channel: form.channel, subject: form.subject || null, body: form.body, updated_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setForm({ name: '', channel: 'sms', subject: '', body: '' });
    setShowForm(false);
    qc.invalidateQueries({ queryKey: ['communication-templates'] });
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('communication_templates').update({ active: !active, updated_by: profile?.id }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['communication-templates'] });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>SMS, WhatsApp & Email Templates</h2>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New template</button>}
      </div>
      <p className="text-muted" style={{ fontSize: 13, marginTop: -8 }}>
        Manages template text only. Actually sending messages requires connecting a real SMS/WhatsApp/email provider (e.g. Twilio, Gupshup), which is a separate integration.
      </p>

      {showForm && (
        <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)', maxWidth: 560 }}>
          <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div className="field" style={{ flex: '1 1 200px' }}><label>Name</label><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
            <div className="field" style={{ flex: '1 1 140px' }}>
              <label>Channel</label>
              <select className="input" value={form.channel} onChange={(e) => set('channel', e.target.value)}>
                {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {form.channel === 'email' && <div className="field" style={{ flex: '1 1 100%' }}><label>Subject</label><input className="input" value={form.subject} onChange={(e) => set('subject', e.target.value)} /></div>}
            <div className="field" style={{ flex: '1 1 100%' }}>
              <label>Body (use {'{patient_name}'}, {'{appointment_date}'}, {'{token_number}'}, {'{bill_number}'}, {'{total_amount}'} as placeholders)</label>
              <textarea className="input" value={form.body} onChange={(e) => set('body', e.target.value)} rows={4} />
            </div>
          </div>
          {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 8 }}>{error}</div>}
          <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save template'}</button>
            <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {templates?.map((t: any) => (
        <div key={t.id} className="card" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong>{t.name} <span className="tag tag-neutral" style={{ marginLeft: 6 }}>{t.channel}</span></strong>
            <button className={`btn ${t.active ? 'btn-secondary' : 'btn-primary'}`} onClick={() => toggleActive(t.id, t.active)}>{t.active ? 'Active' : 'Inactive'}</button>
          </div>
          {t.subject && <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>Subject: {t.subject}</div>}
          <p style={{ fontSize: 13, marginTop: 6, whiteSpace: 'pre-wrap' }}>{t.body}</p>
        </div>
      ))}
    </div>
  );
}
'@
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\pages\AdminCommunicationTemplatesPage.tsx"

$dest = Join-Path $root "src\pages\PacsViewerPage.tsx"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

interface ScanItem {
  id: string;
  sourceLabel: string;
  date: string;
  fileUrl: string;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;

// Aggregates every uploaded scan/report for a patient into one archive —
// this is the "PACS Viewer" from the design spec: a single place to browse
// and compare a patient's imaging history, rather than hunting through each
// visit's individual stage tabs one at a time.
async function fetchPatientScans(patientId: string): Promise<ScanItem[]> {
  const { data: visits } = await supabase.from('visits').select('id').eq('patient_id', patientId);
  const visitIds = (visits ?? []).map((v) => v.id);
  if (visitIds.length === 0) return [];

  const [imaging, vf, oct, topo, investigations] = await Promise.all([
    supabase.from('imaging_records').select('id, file_url, created_at, imaging_type').in('visit_id', visitIds).not('file_url', 'is', null),
    supabase.from('visual_field_tests').select('id, file_url, created_at').in('visit_id', visitIds).not('file_url', 'is', null),
    supabase.from('oct_rnfl_records').select('id, file_url, created_at').in('visit_id', visitIds).not('file_url', 'is', null),
    supabase.from('corneal_topography').select('id, file_url, created_at').in('visit_id', visitIds).not('file_url', 'is', null),
    supabase.from('investigation_orders').select('id, result_file_url, ordered_at, test_name').in('visit_id', visitIds).not('result_file_url', 'is', null),
  ]);

  const items: ScanItem[] = [
    ...(imaging.data ?? []).map((r: any) => ({ id: r.id, sourceLabel: `Imaging — ${r.imaging_type?.replace(/_/g, ' ')}`, date: r.created_at, fileUrl: r.file_url })),
    ...(vf.data ?? []).map((r: any) => ({ id: r.id, sourceLabel: 'Visual Field Test', date: r.created_at, fileUrl: r.file_url })),
    ...(oct.data ?? []).map((r: any) => ({ id: r.id, sourceLabel: 'OCT RNFL', date: r.created_at, fileUrl: r.file_url })),
    ...(topo.data ?? []).map((r: any) => ({ id: r.id, sourceLabel: 'Corneal Topography', date: r.created_at, fileUrl: r.file_url })),
    ...(investigations.data ?? []).map((r: any) => ({ id: r.id, sourceLabel: `Investigation — ${r.test_name}`, date: r.ordered_at, fileUrl: r.result_file_url })),
  ];

  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function ScanFrame({ scan }: { scan: ScanItem | null }) {
  if (!scan) return <div className="text-muted" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>No scan selected.</div>;
  const isImage = IMAGE_EXT.test(scan.fileUrl);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ background: '#111', borderRadius: 'var(--radius-md)', minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {isImage ? (
          <img src={scan.fileUrl} alt={scan.sourceLabel} style={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain' }} />
        ) : (
          <a href={scan.fileUrl} target="_blank" rel="noreferrer" style={{ color: '#fff' }}>Open file (non-image document) →</a>
        )}
      </div>
      <div style={{ fontSize: 13 }}>
        <strong>{scan.sourceLabel}</strong>
        <span className="text-muted"> — {new Date(scan.date).toLocaleString()}</span>
      </div>
    </div>
  );
}

export function PacsViewerPage() {
  const { id: patientId } = useParams();
  const [activeIndex, setActiveIndex] = useState(0);
  const [compareIndex, setCompareIndex] = useState<number | null>(null);
  const [compareMode, setCompareMode] = useState(false);

  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: async () => {
      const { data, error } = await supabase.from('patients').select('full_name, uhid').eq('id', patientId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: scans, isLoading } = useQuery({
    queryKey: ['patient-scans', patientId],
    queryFn: () => fetchPatientScans(patientId!),
    enabled: !!patientId,
  });

  const active = scans?.[activeIndex] ?? null;
  const compare = compareIndex !== null ? scans?.[compareIndex] ?? null : null;

  return (
    <div>
      <Link to={`/patients/${patientId}`} className="text-muted" style={{ fontSize: 12 }}>&larr; {patient?.uhid}</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: '2px 0 12px' }}>Imaging Archive — {patient?.full_name}</h2>
        {scans && scans.length > 1 && (
          <button
            className="btn"
            style={compareMode ? { borderColor: 'var(--color-accent)', color: 'var(--color-accent-700)' } : undefined}
            onClick={() => { setCompareMode((c) => !c); if (!compareMode && compareIndex === null) setCompareIndex(Math.min(activeIndex + 1, scans.length - 1)); }}
          >
            {compareMode ? 'Exit compare' : 'Compare with prior'}
          </button>
        )}
      </div>

      {isLoading ? <p className="text-muted">Loading…</p> : scans && scans.length > 0 ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: compareMode ? '1fr 1fr' : '1fr', gap: 'var(--space-4)' }}>
            <ScanFrame scan={active} />
            {compareMode && <ScanFrame scan={compare} />}
          </div>

          <h4 style={{ marginTop: 'var(--space-5)' }}>All scans ({scans.length})</h4>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
            {scans.map((s, i) => (
              <div key={s.id} style={{ flex: 'none', width: 140 }}>
                <button
                  onClick={() => (compareMode ? setCompareIndex(i) : setActiveIndex(i))}
                  className="card"
                  style={{
                    width: '100%', padding: 6, cursor: 'pointer', textAlign: 'left', border: '2px solid',
                    borderColor: i === activeIndex ? 'var(--color-accent)' : (compareMode && i === compareIndex ? 'var(--color-accent-700)' : 'var(--color-divider)'),
                  }}
                >
                  {IMAGE_EXT.test(s.fileUrl) ? (
                    <img src={s.fileUrl} alt={s.sourceLabel} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 4 }} />
                  ) : (
                    <div style={{ width: '100%', height: 80, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, borderRadius: 4 }}>Document</div>
                  )}
                  <div style={{ fontSize: 11, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.sourceLabel}</div>
                  <div className="text-muted" style={{ fontSize: 10 }}>{new Date(s.date).toLocaleDateString()}</div>
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-muted">No scans or reports uploaded for this patient yet — images uploaded on Imaging, Visual Field, OCT RNFL, Corneal Topography, or Investigation tabs will appear here automatically.</p>
      )}
    </div>
  );
}
'@
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\pages\PacsViewerPage.tsx"

$dest = Join-Path $root "src\pages\PatientDetailPage.tsx"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import type { Patient, Visit, ClinicModule } from '../lib/types';
import { MODULES } from '../modules/moduleConfig';
import { generateToken } from '../lib/tokenGenerator';
import { SelectOrOtherInput } from '../components/SelectOrOtherInput';
import { DbSelectOrOtherInput } from '../components/DbSelectOrOtherInput';
import { GUARDIAN_RELATIONS, BLOOD_GROUPS } from '../modules/commonOptions';

const EDIT_FIELDS: { key: keyof Patient; label: string; type: 'text' | 'date' | 'select' | 'select_or_other' | 'db_select_or_other'; options?: string[]; dbTable?: string; dbColumn?: string }[] = [
  { key: 'full_name', label: 'Full name', type: 'text' },
  { key: 'date_of_birth', label: 'Date of birth', type: 'date' },
  { key: 'gender', label: 'Gender', type: 'select', options: ['male', 'female', 'other'] },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'address', label: 'Address', type: 'text' },
  { key: 'guardian_name', label: 'Guardian name', type: 'text' },
  { key: 'guardian_relation', label: 'Guardian relation', type: 'select_or_other', options: GUARDIAN_RELATIONS },
  { key: 'abha_id', label: 'ABHA ID', type: 'text' },
  { key: 'golden_card_id', label: 'Golden Card ID', type: 'text' },
  { key: 'insurance_provider', label: 'Insurance provider', type: 'db_select_or_other', dbTable: 'insurance_masters', dbColumn: 'scheme_name' },
  { key: 'insurance_policy_no', label: 'Insurance policy no.', type: 'text' },
  { key: 'blood_group', label: 'Blood group', type: 'select', options: BLOOD_GROUPS },
  { key: 'known_allergies', label: 'Known allergies (free text — safety-critical, not list-constrained)', type: 'text' },
];

function EditPatientForm({ patient, onDone }: { patient: Patient; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(EDIT_FIELDS.map((f) => [f.key, (patient[f.key] as string) ?? '']))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: Record<string, string | null> = { ...form };
    Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });
    const { error: updateError } = await supabase.from('patients').update(payload).eq('id', patient.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ['patient', patient.id] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Edit patient details</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        {EDIT_FIELDS.map((f) => (
          <div className="field" key={f.key} style={{ flex: '1 1 220px' }}>
            <label>{f.label}</label>
            {f.type === 'select' ? (
              <select className="input" value={form[f.key]} onChange={(e) => set(f.key, e.target.value)}>
                <option value="">—</option>
                {f.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : f.type === 'select_or_other' ? (
              <SelectOrOtherInput value={form[f.key]} options={f.options ?? []} onChange={(v) => set(f.key, v)} />
            ) : f.type === 'db_select_or_other' ? (
              <DbSelectOrOtherInput value={form[f.key]} dbTable={f.dbTable!} dbColumn={f.dbColumn!} onChange={(v) => set(f.key, v)} />
            ) : (
              <input className="input" type={f.type} value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} />
            )}
          </div>
        ))}
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)' }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

export function PatientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [newVisitModule, setNewVisitModule] = useState<ClinicModule>('general');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const { data: patient } = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('patients').select('*').eq('id', id).single();
      if (error) throw error;
      return data as Patient;
    },
  });

  const { data: visits } = useQuery({
    queryKey: ['visits', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('visits').select('*').eq('patient_id', id).order('created_at', { ascending: false });
      if (error) throw error;
      return data as Visit[];
    },
  });

  const toggleVerify = async (field: 'abha_verified' | 'golden_card_verified' | 'insurance_verified') => {
    if (!patient) return;
    setError(null);
    const { error: updateError } = await supabase.from('patients').update({ [field]: !patient[field] }).eq('id', patient.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ['patient', id] });
  };

  const startVisit = async () => {
    setCreating(true);
    setError(null);
    const token = await generateToken(newVisitModule);
    const { data, error: insertError } = await supabase
      .from('visits')
      .insert({ patient_id: id, clinic_module: newVisitModule, stage: 'waiting', token_number: token })
      .select()
      .single();
    setCreating(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    if (data) {
      // Record this as a walk-in appointment too, so it shows up in Appointments'
      // history/stats instead of only existing as a visit with no paper trail.
      // Non-blocking: the visit itself already succeeded, so a failure here
      // shouldn't stop the user from proceeding — just note it.
      const { error: aptError } = await supabase.from('appointments').insert({
        patient_id: id,
        clinic_module: newVisitModule,
        scheduled_at: new Date().toISOString(),
        status: 'checked_in',
        is_walk_in: true,
        token_number: token,
      });
      if (aptError) {
        console.warn('Walk-in appointment record failed to save:', aptError.message);
      }
      navigate(`/visits/${data.id}`);
    }
  };

  if (!patient) return <p className="text-muted">Loading patient…</p>;

  return (
    <div>
      <div className="card blueprint elev-sm" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h2 style={{ margin: 0 }}>{patient.full_name}</h2>
            <div className="text-muted" style={{ fontSize: 13 }}>
              {patient.uhid} · {patient.gender ?? '—'} · {patient.phone ?? 'no phone'} · DOB {patient.date_of_birth ?? '—'}
            </div>
            {patient.known_allergies && (
              <div style={{ marginTop: 6 }}><span className="tag" style={{ background: '#f6dede', color: '#8a2c2c' }}>Allergies: {patient.known_allergies}</span></div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <span className={`tag ${patient.abha_verified ? 'tag-accent' : 'tag-outline'}`} style={{ cursor: 'pointer' }} onClick={() => toggleVerify('abha_verified')}>
              ABHA {patient.abha_verified ? 'verified' : 'unverified'}
            </span>
            <span className={`tag ${patient.golden_card_verified ? 'tag-accent' : 'tag-outline'}`} style={{ cursor: 'pointer' }} onClick={() => toggleVerify('golden_card_verified')}>
              Golden Card {patient.golden_card_verified ? 'verified' : 'unverified'}
            </span>
            <span className={`tag ${patient.insurance_verified ? 'tag-accent' : 'tag-outline'}`} style={{ cursor: 'pointer' }} onClick={() => toggleVerify('insurance_verified')}>
              Insurance {patient.insurance_verified ? 'verified' : 'unverified'}
            </span>
            {!editing && <button className="btn btn-ghost" onClick={() => setEditing(true)}>Edit details</button>}
            <Link className="btn btn-ghost" to={`/patients/${patient.id}/pacs`}>Imaging archive</Link>
          </div>
        </div>
      </div>

      {editing && <EditPatientForm patient={patient} onDone={() => setEditing(false)} />}

      <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
        <h4 style={{ marginTop: 0 }}>Start a new visit</h4>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field">
            <label>Clinic module</label>
            <select className="input" value={newVisitModule} onChange={(e) => setNewVisitModule(e.target.value as ClinicModule)}>
              {Object.values(MODULES).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={startVisit} disabled={creating}>
            {creating ? 'Starting…' : 'Generate token & start visit'}
          </button>
        </div>
        {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      </div>

      <h4>Visit history</h4>
      <table className="table">
        <thead><tr><th>Date</th><th>Module</th><th>Stage</th><th>Token</th><th /></tr></thead>
        <tbody>
          {visits?.map((v) => (
            <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/visits/${v.id}`)}>
              <td>{new Date(v.created_at).toLocaleString()}</td>
              <td>{MODULES[v.clinic_module]?.label ?? v.clinic_module}</td>
              <td><span className="tag tag-neutral">{v.stage.replace(/_/g, ' ')}</span></td>
              <td>{v.token_number ?? '—'}</td>
              <td><button className="btn btn-ghost">Open</button></td>
            </tr>
          ))}
          {visits?.length === 0 && <tr><td colSpan={5} className="text-muted">No visits yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
'@
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\pages\PatientDetailPage.tsx"

$dest = Join-Path $root "src\pages\PatientsPage.tsx"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { SelectOrOtherInput } from '../components/SelectOrOtherInput';
import { DbSelectOrOtherInput } from '../components/DbSelectOrOtherInput';
import { GUARDIAN_RELATIONS, BLOOD_GROUPS } from '../modules/commonOptions';
import type { Patient } from '../lib/types';

function generateUhid() {
  const suffix = Date.now().toString(36).toUpperCase().slice(-6);
  return `NH-${suffix}`;
}

function PatientForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: '', date_of_birth: '', gender: '', phone: '', email: '', address: '',
    guardian_name: '', guardian_relation: '', abha_id: '', golden_card_id: '',
    insurance_provider: '', insurance_policy_no: '', blood_group: '', known_allergies: '',
  });

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) return;
    setSaving(true);
    setError(null);
    const payload: any = { ...form, uhid: generateUhid(), created_by: profile?.id };
    Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });
    const { error: insertError } = await supabase.from('patients').insert(payload);
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['patients'] });
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Register patient — Walk-in / New</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 260px' }}>
          <label>Full name *</label>
          <input className="input" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} required />
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label>Date of birth</label>
          <input type="date" className="input" value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} />
        </div>
        <div className="field" style={{ flex: '1 1 140px' }}>
          <label>Gender</label>
          <select className="input" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 180px' }}>
          <label>Phone</label>
          <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>
        <div className="field" style={{ flex: '1 1 220px' }}>
          <label>Email</label>
          <input type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </div>
        <div className="field" style={{ flex: '1 1 100%' }}>
          <label>Address</label>
          <input className="input" value={form.address} onChange={(e) => set('address', e.target.value)} />
        </div>

        <div className="field" style={{ flex: '1 1 220px' }}>
          <label>Guardian name (if minor / guardian-assisted)</label>
          <input className="input" value={form.guardian_name} onChange={(e) => set('guardian_name', e.target.value)} />
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label>Guardian relation</label>
          <SelectOrOtherInput value={form.guardian_relation} options={GUARDIAN_RELATIONS} onChange={(v) => set('guardian_relation', v)} />
        </div>

        <div className="field" style={{ flex: '1 1 200px' }}>
          <label>ABHA ID</label>
          <input className="input" value={form.abha_id} onChange={(e) => set('abha_id', e.target.value)} />
        </div>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label>Golden Card ID</label>
          <input className="input" value={form.golden_card_id} onChange={(e) => set('golden_card_id', e.target.value)} />
        </div>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label>Insurance provider</label>
          <DbSelectOrOtherInput value={form.insurance_provider} dbTable="insurance_masters" dbColumn="scheme_name" onChange={(v) => set('insurance_provider', v)} />
        </div>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label>Insurance policy no.</label>
          <input className="input" value={form.insurance_policy_no} onChange={(e) => set('insurance_policy_no', e.target.value)} />
        </div>

        <div className="field" style={{ flex: '1 1 140px' }}>
          <label>Blood group</label>
          <select className="input" value={form.blood_group} onChange={(e) => set('blood_group', e.target.value)}>
            <option value="">—</option>
            {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 100%' }}>
          <label>Known allergies</label>
          <input className="input" value={form.known_allergies} onChange={(e) => set('known_allergies', e.target.value)} placeholder="Free text — allergy details are safety-critical, not constrained to a list" />
        </div>
      </div>

      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}

      <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)' }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Register patient'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

export function PatientsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const showForm = params.get('new') === '1';

  const { data: patients, isLoading } = useQuery({
    queryKey: ['patients', debouncedSearch],
    queryFn: async () => {
      let q = supabase.from('patients').select('*').order('created_at', { ascending: false }).limit(50);
      if (debouncedSearch.trim()) {
        q = q.or(`full_name.ilike.%${debouncedSearch}%,uhid.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as Patient[];
    },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>Patients</h2>
        {!showForm && (
          <button className="btn btn-primary" onClick={() => setParams({ new: '1' })}>+ Register patient</button>
        )}
      </div>

      {showForm && <PatientForm onDone={() => setParams({})} />}

      <div className="field" style={{ maxWidth: 360, marginBottom: 'var(--space-4)' }}>
        <label>Search by name, UHID or phone</label>
        <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Existing Patient Search" />
      </div>

      {isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <table className="table">
          <thead>
            <tr><th>UHID</th><th>Name</th><th>Phone</th><th>Gender</th><th>Registered</th><th /></tr>
          </thead>
          <tbody>
            {patients?.map((p) => (
              <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/patients/${p.id}`)}>
                <td>{p.uhid}</td>
                <td>{p.full_name}</td>
                <td>{p.phone ?? '—'}</td>
                <td>{p.gender ?? '—'}</td>
                <td>{new Date(p.created_at).toLocaleDateString()}</td>
                <td><Link className="btn btn-ghost" to={`/patients/${p.id}`} onClick={(e) => e.stopPropagation()}>Open</Link></td>
              </tr>
            ))}
            {patients?.length === 0 && (
              <tr><td colSpan={6} className="text-muted">No patients found.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
'@
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\pages\PatientsPage.tsx"

$dest = Join-Path $root "src\App.tsx"
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
$content = @'
import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';

// Route-level code splitting: each page only downloads when a user actually
// navigates to it, so e.g. a pharmacist's browser never fetches the LASIK or
// retina clinic bundles. Login and Dashboard stay eager since they're on the
// critical path for first paint.
const PatientsPage = lazy(() => import('./pages/PatientsPage').then((m) => ({ default: m.PatientsPage })));
const PatientDetailPage = lazy(() => import('./pages/PatientDetailPage').then((m) => ({ default: m.PatientDetailPage })));
const VisitWorkspacePage = lazy(() => import('./pages/VisitWorkspacePage').then((m) => ({ default: m.VisitWorkspacePage })));
const JourneyQueuePage = lazy(() => import('./pages/JourneyQueuePage').then((m) => ({ default: m.JourneyQueuePage })));
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage').then((m) => ({ default: m.AppointmentsPage })));
const WaitingBoardPage = lazy(() => import('./pages/WaitingBoardPage').then((m) => ({ default: m.WaitingBoardPage })));
const PharmacyQueuePage = lazy(() => import('./pages/PharmacyQueuePage').then((m) => ({ default: m.PharmacyQueuePage })));
const PharmacyInventoryPage = lazy(() => import('./pages/PharmacyInventoryPage').then((m) => ({ default: m.PharmacyInventoryPage })));
const OpticalQueuePage = lazy(() => import('./pages/OpticalQueuePage').then((m) => ({ default: m.OpticalQueuePage })));
const OpticalInventoryPage = lazy(() => import('./pages/OpticalInventoryPage').then((m) => ({ default: m.OpticalInventoryPage })));
const BillingQueuePage = lazy(() => import('./pages/BillingQueuePage').then((m) => ({ default: m.BillingQueuePage })));
const CollectionsReportPage = lazy(() => import('./pages/CollectionsReportPage').then((m) => ({ default: m.CollectionsReportPage })));
const InsuranceDeskPage = lazy(() => import('./pages/InsuranceDeskPage').then((m) => ({ default: m.InsuranceDeskPage })));
const AdminStaffPage = lazy(() => import('./pages/AdminStaffPage').then((m) => ({ default: m.AdminStaffPage })));
const AdminReportsPage = lazy(() => import('./pages/AdminReportsPage').then((m) => ({ default: m.AdminReportsPage })));
const AdminAuditLogPage = lazy(() => import('./pages/AdminAuditLogPage').then((m) => ({ default: m.AdminAuditLogPage })));
const AdminDepartmentsPage = lazy(() => import('./pages/AdminDepartmentsPage').then((m) => ({ default: m.AdminDepartmentsPage })));
const AdminHospitalSettingsPage = lazy(() => import('./pages/AdminHospitalSettingsPage').then((m) => ({ default: m.AdminHospitalSettingsPage })));
const AdminMastersPage = lazy(() => import('./pages/AdminMastersPage').then((m) => ({ default: m.AdminMastersPage })));
const AdminCommunicationTemplatesPage = lazy(() => import('./pages/AdminCommunicationTemplatesPage').then((m) => ({ default: m.AdminCommunicationTemplatesPage })));
const PacsViewerPage = lazy(() => import('./pages/PacsViewerPage').then((m) => ({ default: m.PacsViewerPage })));

function PageLoading() {
  return <div className="text-muted" style={{ padding: 'var(--space-6)' }}>Loading…</div>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireProfile({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (!profile) {
    return (
      <div style={{ padding: 40, maxWidth: 480 }}>
        <h3>Account pending setup</h3>
        <p className="text-muted">
          Your login succeeded but no active staff profile was found. Ask an admin to activate your account
          from Administration, Staff section.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <RequireProfile>
              <Layout />
            </RequireProfile>
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="patients" element={<Suspense fallback={<PageLoading />}><PatientsPage /></Suspense>} />
        <Route path="patients/:id" element={<Suspense fallback={<PageLoading />}><PatientDetailPage /></Suspense>} />
        <Route path="patients/:id/pacs" element={<Suspense fallback={<PageLoading />}><PacsViewerPage /></Suspense>} />
        <Route path="visits/:id" element={<Suspense fallback={<PageLoading />}><VisitWorkspacePage /></Suspense>} />
        <Route path="journeys/:module" element={<Suspense fallback={<PageLoading />}><JourneyQueuePage /></Suspense>} />
        <Route path="appointments" element={<Suspense fallback={<PageLoading />}><AppointmentsPage /></Suspense>} />
        <Route path="waiting-room" element={<Suspense fallback={<PageLoading />}><WaitingBoardPage /></Suspense>} />
        <Route path="pharmacy" element={<Suspense fallback={<PageLoading />}><PharmacyQueuePage /></Suspense>} />
        <Route path="pharmacy/inventory" element={<Suspense fallback={<PageLoading />}><PharmacyInventoryPage /></Suspense>} />
        <Route path="optical" element={<Suspense fallback={<PageLoading />}><OpticalQueuePage /></Suspense>} />
        <Route path="optical/inventory" element={<Suspense fallback={<PageLoading />}><OpticalInventoryPage /></Suspense>} />
        <Route path="billing" element={<Suspense fallback={<PageLoading />}><BillingQueuePage /></Suspense>} />
        <Route path="billing/collections" element={<Suspense fallback={<PageLoading />}><CollectionsReportPage /></Suspense>} />
        <Route path="insurance" element={<Suspense fallback={<PageLoading />}><InsuranceDeskPage /></Suspense>} />
        <Route path="admin/staff" element={<Suspense fallback={<PageLoading />}><AdminStaffPage /></Suspense>} />
        <Route path="admin/departments" element={<Suspense fallback={<PageLoading />}><AdminDepartmentsPage /></Suspense>} />
        <Route path="admin/settings" element={<Suspense fallback={<PageLoading />}><AdminHospitalSettingsPage /></Suspense>} />
        <Route path="admin/masters" element={<Suspense fallback={<PageLoading />}><AdminMastersPage /></Suspense>} />
        <Route path="admin/templates" element={<Suspense fallback={<PageLoading />}><AdminCommunicationTemplatesPage /></Suspense>} />
        <Route path="admin/reports" element={<Suspense fallback={<PageLoading />}><AdminReportsPage /></Suspense>} />
        <Route path="admin/audit-log" element={<Suspense fallback={<PageLoading />}><AdminAuditLogPage /></Suspense>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
'@
Set-Content -Path $dest -Value $content -NoNewline -Encoding UTF8
Write-Host "  wrote src\App.tsx"

Write-Host ""
Write-Host "Done. Now run: npm run build" -ForegroundColor Green