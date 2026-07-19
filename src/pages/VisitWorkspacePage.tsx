import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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
import { PatientChartSummary } from '../components/PatientChartSummary';

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

export function VisitWorkspacePage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [refreshTick, setRefreshTick] = useState(0);

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <div>
          <Link to={`/patients/${patient.id}`} className="text-muted" style={{ fontSize: 12 }}>&larr; {patient.uhid}</Link>
          <h2 style={{ margin: '2px 0 0' }}>{patient.full_name} <span className="text-muted" style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 400 }}>· {moduleConfig.label}</span></h2>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="tag tag-accent">Token {visit.token_number ?? '—'}</span>
          <select className="input" value={visit.stage} onChange={(e) => advanceStage(e.target.value as VisitStage)} style={{ width: 200 }}>
            {stageOrder.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      </div>
      {stageError && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{stageError}</div>}

      <PatientChartSummary visitId={visit.id} moduleConfig={moduleConfig} excludeStageKey={activeStage?.key} />

      <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start' }}>
        <div style={{ width: 220, flex: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {moduleConfig.stages.map((s) => (
            <button
              key={s.key}
              className="btn"
              style={{
                justifyContent: 'flex-start',
                border: 'none',
                background: activeStage?.key === s.key ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent',
                color: activeStage?.key === s.key ? 'var(--color-accent-700)' : 'var(--color-text)',
                fontWeight: activeStage?.key === s.key ? 600 : 400,
              }}
              onClick={() => setActiveStageKey(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {activeStage && (
            <>
              <h3 style={{ marginTop: 0 }}>{activeStage.label}</h3>
              {activeStage.custom === 'pharmacy' && <PharmacyStage visitId={visit.id} />}
              {activeStage.custom === 'billing' && <BillingStage visitId={visit.id} patientId={patient.id} />}
              {activeStage.custom === 'admission' && <AdmissionStage visitId={visit.id} />}
              {activeStage.custom === 'optical' && <OpticalStage visitId={visit.id} patientId={patient.id} />}
              {!activeStage.custom && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <RecordForm
                    stage={activeStage}
                    extraValues={buildExtraValues()}
                    onSaved={() => setRefreshTick((t) => t + 1)}
                  />
                  <RecordHistory stage={activeStage} filterColumn="visit_id" filterValue={visit.id} refreshKey={refreshTick} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
