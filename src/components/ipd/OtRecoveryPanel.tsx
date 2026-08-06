import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { SelectOrOtherInput } from '../SelectOrOtherInput';
import { OT_ROOMS } from '../../modules/commonOptions';

/** Previously only reachable from a visit's Admission/OT/Recovery tab —
 * a patient managed day-to-day from the Ward Census had no way to see or
 * record the OT/recovery event against their own admission. Same component
 * now used from both places. */
export function OtRecoveryPanel({ admissionId, canManage }: { admissionId: string; canManage: boolean }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [otForm, setOtForm] = useState({ procedure_name: '', eye: 'od', ot_room: '', anaesthetist_id: '' });
  const [recoveryForm, setRecoveryForm] = useState({ vitals_notes: '', pain_score: '0', discharge_instructions: '' });
  const [showOtForm, setShowOtForm] = useState(false);
  const [showRecoveryForm, setShowRecoveryForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [otError, setOtError] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const { data: otRecords } = useQuery({
    queryKey: ['ipd-ot-records', admissionId],
    queryFn: async () => {
      const { data, error } = await supabase.from('ot_records').select('*, recovery_records(*)').eq('admission_id', admissionId).order('start_time', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: doctors } = useQuery({
    queryKey: ['doctors-for-ot'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name').eq('role', 'doctor').eq('active', true).order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['ipd-ot-records', admissionId] });

  const addOt = async () => {
    if (!otForm.procedure_name.trim()) return;
    setSaving(true);
    setOtError(null);
    const { error } = await supabase.from('ot_records').insert({
      admission_id: admissionId, procedure_name: otForm.procedure_name, eye: otForm.eye, ot_room: otForm.ot_room || null,
      surgeon_id: profile?.id, anaesthetist_id: otForm.anaesthetist_id || null, status: 'completed',
      start_time: new Date().toISOString(), end_time: new Date().toISOString(),
    });
    setSaving(false);
    if (error) { setOtError(error.message); return; }
    setOtForm({ procedure_name: '', eye: 'od', ot_room: '', anaesthetist_id: '' });
    setShowOtForm(false);
    refresh();
  };

  const latestOt = otRecords?.[0];

  const addRecovery = async () => {
    if (!latestOt) return;
    setSaving(true);
    setRecoveryError(null);
    const { error } = await supabase.from('recovery_records').insert({
      ot_record_id: latestOt.id, vitals_notes: recoveryForm.vitals_notes || null, pain_score: Number(recoveryForm.pain_score) || 0,
      discharge_instructions: recoveryForm.discharge_instructions || null, monitored_by: profile?.id,
    });
    setSaving(false);
    if (error) { setRecoveryError(error.message); return; }
    setRecoveryForm({ vitals_notes: '', pain_score: '0', discharge_instructions: '' });
    setShowRecoveryForm(false);
    refresh();
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 13 }}>OT &amp; Recovery</strong>
        {canManage && !showOtForm && <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setShowOtForm(true)}>+ Record OT</button>}
      </div>
      {showOtForm && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, alignItems: 'flex-end' }}>
          <input className="input" style={{ flex: '1 1 180px' }} placeholder="Procedure name" value={otForm.procedure_name} onChange={(e) => setOtForm((p) => ({ ...p, procedure_name: e.target.value }))} />
          <select className="input" style={{ flex: '0 1 90px' }} value={otForm.eye} onChange={(e) => setOtForm((p) => ({ ...p, eye: e.target.value }))}>
            <option value="od">OD</option><option value="os">OS</option><option value="both">Both</option>
          </select>
          <div style={{ flex: '0 1 150px' }}><SelectOrOtherInput value={otForm.ot_room} options={OT_ROOMS} onChange={(v) => setOtForm((p) => ({ ...p, ot_room: v }))} placeholder="OT room" /></div>
          <select className="input" style={{ flex: '0 1 160px' }} value={otForm.anaesthetist_id} onChange={(e) => setOtForm((p) => ({ ...p, anaesthetist_id: e.target.value }))}>
            <option value="">— anaesthetist —</option>
            {doctors?.map((d: any) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={addOt} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button className="btn btn-ghost" onClick={() => setShowOtForm(false)}>Cancel</button>
        </div>
      )}
      {otError && <div style={{ color: '#b64545', fontSize: 11, marginTop: 4 }}>{otError}</div>}
      {otRecords?.length ? (
        <ul style={{ paddingLeft: 18, fontSize: 13, marginTop: 6 }}>
          {otRecords.map((ot: any) => (
            <li key={ot.id}>
              {ot.procedure_name} ({ot.eye}) — {ot.status}{ot.anaesthetist_id ? ` · anaesthetist: ${doctors?.find((d: any) => d.id === ot.anaesthetist_id)?.full_name ?? '—'}` : ''}
              {(ot.recovery_records ?? []).map((r: any) => (
                <div key={r.id} className="text-muted" style={{ fontSize: 12 }}>Recovery — pain {r.pain_score}/10{r.vitals_notes ? `, ${r.vitals_notes}` : ''} ({new Date(r.recorded_at).toLocaleString()})</div>
              ))}
            </li>
          ))}
        </ul>
      ) : <p className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>No OT records yet.</p>}

      {latestOt && canManage && (
        <div style={{ marginTop: 6 }}>
          {!showRecoveryForm && <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setShowRecoveryForm(true)}>+ Record recovery</button>}
          {showRecoveryForm && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, alignItems: 'flex-end' }}>
              <input className="input" style={{ flex: '1 1 180px' }} placeholder="Vitals notes" value={recoveryForm.vitals_notes} onChange={(e) => setRecoveryForm((p) => ({ ...p, vitals_notes: e.target.value }))} />
              <input className="input" style={{ flex: '0 1 90px' }} type="number" min={0} max={10} placeholder="Pain 0-10" value={recoveryForm.pain_score} onChange={(e) => setRecoveryForm((p) => ({ ...p, pain_score: e.target.value }))} />
              <input className="input" style={{ flex: '1 1 180px' }} placeholder="Discharge instructions" value={recoveryForm.discharge_instructions} onChange={(e) => setRecoveryForm((p) => ({ ...p, discharge_instructions: e.target.value }))} />
              <button className="btn btn-primary" onClick={addRecovery} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              <button className="btn btn-ghost" onClick={() => setShowRecoveryForm(false)}>Cancel</button>
            </div>
          )}
          {recoveryError && <div style={{ color: '#b64545', fontSize: 11, marginTop: 4 }}>{recoveryError}</div>}
        </div>
      )}
    </div>
  );
}
