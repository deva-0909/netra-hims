import type { ModuleConfig, StageConfig } from './fieldTypes';
import {
  VA_OPTIONS, IOL_FORMULAS, INSURANCE_SCHEMES, CYCLOPLEGIC_AGENTS,
  INVESTIGATION_TESTS, SURGERY_PROCEDURES, SYMPTOM_DURATIONS, COMMON_DIAGNOSES, ICD10_CODES,
  RETINA_DRUGS, INJECTION_DOSES, ANGLE_GRADES, VF_TEST_PATTERNS, VF_RELIABILITY,
  LASIK_COMPLICATIONS, BINOCULAR_VISION_STATUS, STEREOPSIS_LEVELS, PEDIATRIC_DIAGNOSES,
} from './commonOptions';

// Shared across every clinic â€” the operational back-half of a visit (order
// tests, prescribe, dispense glasses, recommend surgery, handle insurance,
// admit/operate/recover, bill, collect feedback, schedule follow-up) is the
// same regardless of which clinic saw the patient. Previously only the
// General OPD module had these tabs, which meant a retina/glaucoma/LASIK/
// pediatric visit had no way to prescribe, bill, or get insurance approval
// at all â€” a real gap, not just a cosmetic one.
const SHARED_SUPPORT_STAGES: StageConfig[] = [
  {
    key: 'investigation', label: 'Investigation Order', table: 'investigation_orders', staffField: 'ordered_by',
    fields: [
      { name: 'test_name', label: 'Test Name', type: 'select_or_other', options: INVESTIGATION_TESTS },
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
      { name: 'scheme', label: 'Scheme', type: 'select_or_other', options: INSURANCE_SCHEMES, half: true },
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
        { name: 'uncorrected_va_od', label: 'Uncorrected VA â€” OD', type: 'select_or_other', options: VA_OPTIONS, half: true },
        { name: 'uncorrected_va_os', label: 'Uncorrected VA â€” OS', type: 'select_or_other', options: VA_OPTIONS, half: true },
        { name: 'corrected_va_od', label: 'Corrected VA â€” OD', type: 'select_or_other', options: VA_OPTIONS, half: true },
        { name: 'corrected_va_os', label: 'Corrected VA â€” OS', type: 'select_or_other', options: VA_OPTIONS, half: true },
        { name: 'pinhole_va_od', label: 'Pinhole VA â€” OD', type: 'select_or_other', options: VA_OPTIONS, half: true },
        { name: 'pinhole_va_os', label: 'Pinhole VA â€” OS', type: 'select_or_other', options: VA_OPTIONS, half: true },
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
        { name: 'sphere_od', label: 'Sphere â€” OD', type: 'number', half: true },
        { name: 'sphere_os', label: 'Sphere â€” OS', type: 'number', half: true },
        { name: 'cylinder_od', label: 'Cylinder â€” OD', type: 'number', half: true },
        { name: 'cylinder_os', label: 'Cylinder â€” OS', type: 'number', half: true },
        { name: 'axis_od', label: 'Axis â€” OD', type: 'number', half: true },
        { name: 'axis_os', label: 'Axis â€” OS', type: 'number', half: true },
        { name: 'add_od', label: 'Add â€” OD', type: 'number', half: true },
        { name: 'add_os', label: 'Add â€” OS', type: 'number', half: true },
        { name: 'final_va_od', label: 'Final VA â€” OD', type: 'select_or_other', options: VA_OPTIONS, half: true },
        { name: 'final_va_os', label: 'Final VA â€” OS', type: 'select_or_other', options: VA_OPTIONS, half: true },
      ],
    },
    {
      key: 'iop', label: 'Eye Pressure (IOP)', table: 'iop_readings', staffField: 'performed_by',
      fields: [
        { name: 'iop_od', label: 'IOP â€” OD (mmHg)', type: 'number', half: true },
        { name: 'iop_os', label: 'IOP â€” OS (mmHg)', type: 'number', half: true },
        { name: 'method', label: 'Method', type: 'select', options: ['noncontact_tonometer', 'goldmann_applanation', 'icare'] },
      ],
    },
    {
      key: 'imaging', label: 'Imaging â€” Biometry & IOL', table: 'imaging_records', staffField: 'performed_by',
      fields: [
        { name: 'imaging_type', label: 'Imaging Type', type: 'select', options: ['biometry', 'oct', 'fundus_photo', 'topography', 'pachymetry', 'visual_field', 'gonioscopy'] },
        { name: 'eye', label: 'Eye', type: 'select', options: ['od', 'os', 'both'] },
        { name: 'axial_length_od', label: 'Axial Length â€” OD', type: 'number', half: true },
        { name: 'axial_length_os', label: 'Axial Length â€” OS', type: 'number', half: true },
        { name: 'k1_od', label: 'K1 â€” OD', type: 'number', half: true },
        { name: 'k1_os', label: 'K1 â€” OS', type: 'number', half: true },
        { name: 'k2_od', label: 'K2 â€” OD', type: 'number', half: true },
        { name: 'k2_os', label: 'K2 â€” OS', type: 'number', half: true },
        { name: 'iol_power_od', label: 'IOL Power â€” OD', type: 'number', half: true },
        { name: 'iol_power_os', label: 'IOL Power â€” OS', type: 'number', half: true },
        { name: 'iol_formula', label: 'IOL Formula', type: 'select_or_other', options: IOL_FORMULAS },
        { name: 'findings', label: 'Findings', type: 'textarea' },
        { name: 'file_url', label: 'Scan / Image', type: 'file' },
      ],
    },
    {
      key: 'consultation', label: 'Doctor Consultation', table: 'consultations', staffField: 'doctor_id',
      fields: [
        { name: 'anterior_segment_od', label: 'Anterior Segment â€” OD', type: 'textarea', half: true },
        { name: 'anterior_segment_os', label: 'Anterior Segment â€” OS', type: 'textarea', half: true },
        { name: 'posterior_segment_od', label: 'Posterior Segment â€” OD', type: 'textarea', half: true },
        { name: 'posterior_segment_os', label: 'Posterior Segment â€” OS', type: 'textarea', half: true },
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
        { name: 'dr_grade_od', label: 'DR Grade â€” OD', type: 'select', options: ['no_dr', 'mild_npdr', 'moderate_npdr', 'severe_npdr', 'pdr'], half: true },
        { name: 'dr_grade_os', label: 'DR Grade â€” OS', type: 'select', options: ['no_dr', 'mild_npdr', 'moderate_npdr', 'severe_npdr', 'pdr'], half: true },
        { name: 'csme_od', label: 'CSME â€” OD', type: 'checkbox', half: true },
        { name: 'csme_os', label: 'CSME â€” OS', type: 'checkbox', half: true },
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
        { name: 'angle_grade_od', label: 'Angle Grade â€” OD', type: 'select_or_other', options: ANGLE_GRADES, half: true },
        { name: 'angle_grade_os', label: 'Angle Grade â€” OS', type: 'select_or_other', options: ANGLE_GRADES, half: true },
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
        { name: 'target_iop_od', label: 'Target IOP â€” OD', type: 'number', half: true },
        { name: 'target_iop_os', label: 'Target IOP â€” OS', type: 'number', half: true },
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
        { name: 'k1_od', label: 'K1 â€” OD', type: 'number', half: true },
        { name: 'k1_os', label: 'K1 â€” OS', type: 'number', half: true },
        { name: 'k2_od', label: 'K2 â€” OD', type: 'number', half: true },
        { name: 'k2_os', label: 'K2 â€” OS', type: 'number', half: true },
        { name: 'pachymetry_od', label: 'Pachymetry â€” OD', type: 'number', half: true },
        { name: 'pachymetry_os', label: 'Pachymetry â€” OS', type: 'number', half: true },
        { name: 'corneal_map_notes', label: 'Corneal Map Notes', type: 'textarea' },
        { name: 'file_url', label: 'Topography Report', type: 'file' },
      ],
    },
    {
      key: 'dry_eye', label: 'Dry Eye Assessment', table: 'dry_eye_assessments', staffField: 'performed_by',
      fields: [
        { name: 'tbut_od', label: 'TBUT â€” OD (s)', type: 'number', half: true },
        { name: 'tbut_os', label: 'TBUT â€” OS (s)', type: 'number', half: true },
        { name: 'schirmer_od', label: 'Schirmer â€” OD', type: 'number', half: true },
        { name: 'schirmer_os', label: 'Schirmer â€” OS', type: 'number', half: true },
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
      key: 'consent', label: 'Informed Consent â€” LASIK', table: 'lasik_consents', staffField: 'witnessed_by',
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
        { name: 'uncorrected_va_od', label: 'Uncorrected VA â€” OD', type: 'select_or_other', options: VA_OPTIONS, half: true },
        { name: 'uncorrected_va_os', label: 'Uncorrected VA â€” OS', type: 'select_or_other', options: VA_OPTIONS, half: true },
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
        { name: 'sphere_od', label: 'Sphere â€” OD', type: 'number', half: true },
        { name: 'sphere_os', label: 'Sphere â€” OS', type: 'number', half: true },
        { name: 'cylinder_od', label: 'Cylinder â€” OD', type: 'number', half: true },
        { name: 'cylinder_os', label: 'Cylinder â€” OS', type: 'number', half: true },
        { name: 'axis_od', label: 'Axis â€” OD', type: 'number', half: true },
        { name: 'axis_os', label: 'Axis â€” OS', type: 'number', half: true },
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