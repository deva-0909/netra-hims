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

const STAGE_ORDER: VisitStage[] = [
  'registration', 'waiting', 'vision_test', 'preliminary_assessment', 'refraction', 'iop', 'imaging',
  'consultation', 'investigation', 'pharmacy', 'optical', 'surgery_recommended', 'insurance_approval',
  'admission', 'ot', 'recovery', 'billing', 'feedback', 'follow_up', 'completed',
];

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
  const activeStage = moduleConfig?.stages.find((s) => s.key === activeStageKey) ?? moduleConfig?.stages[0];

  const advanceStage = async (newStage: VisitStage) => {
    if (!visit) return;
    await supabase.from('visits').update({ stage: newStage }).eq('id', visit.id);
    qc.invalidateQueries({ queryKey: ['visit', id] });
  };

  if (!visit || !patient || !moduleConfig) return <p className="text-muted">Loading visit…</p>;

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
            {STAGE_ORDER.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      </div>

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
              {!activeStage.custom && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <RecordForm
                    stage={activeStage}
                    extraValues={
                      activeStage.table === 'optical_orders'
                        ? { visit_id: visit.id, patient_id: patient.id, order_number: `OPT-${Date.now().toString(36).toUpperCase().slice(-8)}` }
                        : activeStage.table === 'insurance_claims' || activeStage.table === 'feedback' || activeStage.table === 'follow_ups'
                        ? { visit_id: visit.id, patient_id: patient.id }
                        : { visit_id: visit.id }
                    }
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
