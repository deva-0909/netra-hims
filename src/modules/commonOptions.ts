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

export const PUPIL_FINDINGS = ['normal, reactive', 'sluggish', 'irregular', 'fixed and dilated', 'miotic (pinpoint)'];
export const EOM_FINDINGS = ['full and free', 'restricted', 'painful on movement', 'nystagmus'];
export const COLOR_VISION_FINDINGS = ['normal', 'defective — red-green', 'defective — blue-yellow', 'not tested'];
export const LACRIMAL_FINDINGS = ['normal', 'watering (epiphora)', 'discharge on regurgitation', 'punctal stenosis', 'not tested'];

export const REFERRAL_SOURCES = ['self / walk-in', 'referring doctor', 'outreach camp', 'insurance/TPA', 'word of mouth', 'online / website', 'other hospital'];

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
  'Ptosis Correction', 'Entropion/Ectropion Repair', 'Eyelid Tumor Excision',
  'Orbital Decompression', 'Enucleation/Evisceration',
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

// Amsler-Krumeich staging — the standard keratoconus severity classification.
export const KERATOCONUS_STAGES = ['stage_1', 'stage_2', 'stage_3', 'stage_4'];
export const KERATOCONUS_MANAGEMENT_PLANS = ['observation', 'corneal_cross_linking', 'ick_ring_segments', 'contact_lens', 'keratoplasty_referral'];
export const CONTACT_LENS_TYPES = ['soft_spherical', 'soft_toric', 'rgp', 'scleral', 'hybrid', 'orthokeratology'];
export const CONTACT_LENS_FITTING_STATUSES = ['trial', 'dispensed', 'follow_up_needed', 'discontinued'];

export const EYELID_POSITIONS = ['normal', 'ptosis', 'entropion', 'ectropion', 'lid_retraction', 'lagophthalmos'];
export const UVEITIS_ANATOMICAL_TYPES = ['anterior', 'intermediate', 'posterior', 'panuveitis'];
export const UVEITIS_ETIOLOGIES = ['idiopathic', 'infectious', 'autoimmune', 'traumatic', 'post_surgical', 'other'];
export const LOW_VISION_DEVICE_TYPES = ['magnifier', 'telescope', 'electronic_video_magnifier', 'prism', 'large_print', 'screen_reader', 'other'];
// SUN (Standardization of Uveitis Nomenclature) working group grading scales.
export const UVEITIS_CELL_GRADES = ['0', '0.5+', '1+', '2+', '3+', '4+'];
export const UVEITIS_TREATMENT_TYPES = ['topical_steroids', 'periocular_injection', 'systemic_steroids', 'immunosuppressant', 'biologic', 'observation'];