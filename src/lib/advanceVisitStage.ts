import { supabase } from './supabaseClient';
import type { VisitStage } from './types';

// Only stages whose key maps unambiguously onto a single VisitStage enum value
// are auto-advanced. Custom multi-step stages (admission/OT/recovery) are
// handled directly by AdmissionStage instead, since one tab covers three
// different real-world stages.
const STAGE_KEY_TO_ENUM: Record<string, VisitStage> = {
  vision_test: 'vision_test',
  preliminary_assessment: 'preliminary_assessment',
  refraction: 'refraction',
  iop: 'iop',
  imaging: 'imaging',
  consultation: 'consultation',
  investigation: 'investigation',
  pharmacy: 'pharmacy',
  optical: 'optical',
  surgery_recommendation: 'surgery_recommended',
  insurance_approval: 'insurance_approval',
  billing: 'billing',
  feedback: 'feedback',
  follow_up: 'follow_up',
  // Specialty clinics (retina/glaucoma/lasik/pediatric) have no separate
  // pre-testing bucket in the shared visit_stage enum — SPECIALTY_STAGE_ORDER
  // jumps straight from 'waiting' to 'consultation'. Without these, saving
  // any of these stage-specific forms left visits.stage stuck at 'waiting'
  // forever, so a doctor-facing "ready for consultation" queue had no signal
  // to filter on for these clinics.
  retina_exam: 'consultation',
  retina_treatment: 'consultation',
  injection: 'consultation',
  gonioscopy: 'consultation',
  visual_field: 'consultation',
  oct_rnfl: 'consultation',
  glaucoma_plan: 'consultation',
  topography: 'consultation',
  dry_eye: 'consultation',
  eligibility: 'consultation',
  consent: 'consultation',
  procedure: 'consultation',
  post_procedure: 'consultation',
  vision_screening: 'consultation',
  squint: 'consultation',
  cycloplegic_refraction: 'consultation',
  diagnosis: 'consultation',
  parent_followup: 'consultation',
};

/**
 * Advances visits.stage to match a completed tab — but only forward. Re-saving
 * an earlier tab (e.g. adding a second refraction reading) never regresses
 * progress that's already ahead of it.
 */
export async function advanceVisitStageForStageKey(visitId: string, stageKey: string, stageOrder: VisitStage[]) {
  const target = STAGE_KEY_TO_ENUM[stageKey];
  if (!target) return;
  await advanceVisitStageTo(visitId, target, stageOrder);
}

export async function advanceVisitStageTo(visitId: string, target: VisitStage, stageOrder: VisitStage[]) {
  const { data: visit } = await supabase.from('visits').select('stage').eq('id', visitId).single();
  if (!visit) return;
  const currentIdx = stageOrder.indexOf(visit.stage as VisitStage);
  const targetIdx = stageOrder.indexOf(target);
  if (targetIdx === -1 || targetIdx <= currentIdx) return;
  await supabase.from('visits').update({ stage: target }).eq('id', visitId);
}
