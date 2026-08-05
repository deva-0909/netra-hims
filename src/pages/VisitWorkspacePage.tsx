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
import { PatientChartSummary } from '../components/PatientChartSummary';
import { GenerateClaimFileButton } from '../components/GenerateClaimFileButton';
import { PrintConsultationReportButton } from '../components/PrintConsultationReportButton';
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
