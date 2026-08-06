export type StaffRole =
  | 'admin' | 'reception' | 'optometrist' | 'doctor' | 'nurse'
  | 'pharmacist' | 'optical' | 'billing' | 'insurance_desk' | 'ot_staff' | 'mrd' | 'eye_bank'
  | 'hr_manager' | 'biomedical_engineer' | 'store_keeper' | 'quality_manager';

export interface Profile {
  id: string;
  full_name: string;
  role: StaffRole;
  department: string | null;
  phone: string | null;
  active: boolean;
  is_demo_account: boolean;
  created_at: string;
}

export type ClinicModule = 'general' | 'retina' | 'glaucoma' | 'lasik' | 'pediatric';

export interface Patient {
  id: string;
  uhid: string;
  full_name: string;
  date_of_birth: string | null;
  gender: 'male' | 'female' | 'other' | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  guardian_name: string | null;
  guardian_relation: string | null;
  abha_id: string | null;
  abha_verified: boolean;
  golden_card_id: string | null;
  golden_card_verified: boolean;
  insurance_provider: string | null;
  insurance_policy_no: string | null;
  insurance_verified: boolean;
  blood_group: string | null;
  known_allergies: string | null;
  notes: string | null;
  created_at: string;
}

export type AppointmentStatus =
  | 'scheduled' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  clinic_module: ClinicModule;
  scheduled_at: string;
  status: AppointmentStatus;
  reason: string | null;
  is_walk_in: boolean;
  token_number: string | null;
  created_at: string;
}

export type VisitStage =
  | 'registration' | 'waiting' | 'vision_test' | 'preliminary_assessment' | 'refraction'
  | 'iop' | 'imaging' | 'consultation' | 'investigation' | 'pharmacy' | 'optical'
  | 'surgery_recommended' | 'insurance_approval' | 'admission' | 'ot' | 'recovery'
  | 'billing' | 'feedback' | 'follow_up' | 'completed' | 'cancelled';

export interface Visit {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  clinic_module: ClinicModule;
  attending_doctor_id: string | null;
  stage: VisitStage;
  token_number: string | null;
  checked_in_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
