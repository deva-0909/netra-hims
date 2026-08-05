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
