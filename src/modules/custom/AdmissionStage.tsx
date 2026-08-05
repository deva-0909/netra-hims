import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { FileUploadField } from '../../components/FileUploadField';
import { SelectOrOtherInput } from '../../components/SelectOrOtherInput';
import { OT_ROOMS } from '../commonOptions';
import { advanceVisitStageTo } from '../../lib/advanceVisitStage';
import { printDischargeSummary } from '../../lib/printDischargeSummary';
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