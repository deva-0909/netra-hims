import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { SelectOrOtherInput } from '../SelectOrOtherInput';
import { OT_ROOMS } from '../../modules/commonOptions';
import { SurgicalConsentPanel } from '../ot/SurgicalConsentPanel';
import { SafetyChecklistPanel } from '../ot/SafetyChecklistPanel';
import { ImplantsPanel } from '../ot/ImplantsPanel';

function toDatetimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ScheduleOtForm({ admissionId, doctors, defaultSurgeonId, onDone }: { admissionId: string; doctors: any[]; defaultSurgeonId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
  const [form, setForm] = useState({ procedure_name: '', eye: 'od', ot_room: '', surgeon_id: defaultSurgeonId, anaesthetist_id: '', scheduled_at: toDatetimeLocal(inOneHour) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.procedure_name.trim() || !form.scheduled_at) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('ot_records').insert({
      admission_id: admissionId,
      procedure_name: form.procedure_name,
      eye: form.eye,
      ot_room: form.ot_room || null,
      surgeon_id: form.surgeon_id || null,
      anaesthetist_id: form.anaesthetist_id || null,
      status: 'scheduled',
      start_time: new Date(form.scheduled_at).toISOString(),
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setForm({ procedure_name: '', eye: 'od', ot_room: '', surgeon_id: defaultSurgeonId, anaesthetist_id: '', scheduled_at: toDatetimeLocal(inOneHour) });
    onDone();
    qc.invalidateQueries({ queryKey: ['ipd-ot-records', admissionId] });
  };

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, alignItems: 'flex-end', padding: 8, background: 'var(--color-accent-100)', borderRadius: 'var(--radius-md)' }}>
      <input className="input" style={{ flex: '1 1 180px' }} placeholder="Procedure name" value={form.procedure_name} onChange={(e) => set('procedure_name', e.target.value)} />
      <select className="input" style={{ flex: '0 1 90px' }} value={form.eye} onChange={(e) => set('eye', e.target.value)}>
        <option value="od">OD</option><option value="os">OS</option><option value="both">Both</option>
      </select>
      <div style={{ flex: '0 1 150px' }}><SelectOrOtherInput value={form.ot_room} options={OT_ROOMS} onChange={(v) => set('ot_room', v)} placeholder="OT room" /></div>
      <select className="input" style={{ flex: '0 1 160px' }} value={form.surgeon_id} onChange={(e) => set('surgeon_id', e.target.value)}>
        <option value="">— surgeon —</option>
        {doctors?.map((d: any) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
      </select>
      <select className="input" style={{ flex: '0 1 160px' }} value={form.anaesthetist_id} onChange={(e) => set('anaesthetist_id', e.target.value)}>
        <option value="">— anaesthetist —</option>
        {doctors?.map((d: any) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
      </select>
      <div className="field" style={{ flex: '0 1 190px', marginBottom: 0 }}>
        <label style={{ fontSize: 11 }}>Scheduled for</label>
        <input className="input" type="datetime-local" value={form.scheduled_at} onChange={(e) => set('scheduled_at', e.target.value)} />
      </div>
      <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Scheduling…' : 'Schedule'}</button>
      <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      {error && <span style={{ color: '#b64545', fontSize: 11 }}>{error}</span>}
    </div>
  );
}

function CompleteOtForm({ ot, onDone, onChanged }: { ot: any; onDone: () => void; onChanged: () => void }) {
  const [form, setForm] = useState({ intra_op_notes: '', complications: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.from('ot_records').update({
      status: 'completed', end_time: new Date().toISOString(),
      intra_op_notes: form.intra_op_notes || null, complications: form.complications || null,
    }).eq('id', ot.id);
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    onChanged();
    onDone();
  };

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, alignItems: 'flex-end' }}>
      <div className="field" style={{ flex: '1 1 220px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>Intra-op notes</label><input className="input" value={form.intra_op_notes} onChange={(e) => setForm((p) => ({ ...p, intra_op_notes: e.target.value }))} /></div>
      <div className="field" style={{ flex: '1 1 180px', marginBottom: 0 }}><label style={{ fontSize: 11 }}>Complications</label><input className="input" value={form.complications} onChange={(e) => setForm((p) => ({ ...p, complications: e.target.value }))} /></div>
      <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Completing…' : 'Mark complete'}</button>
      <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      {error && <div style={{ color: '#b64545', fontSize: 11, width: '100%' }}>{error}</div>}
    </div>
  );
}

function OtRecordCard({ ot, doctors, canManage, onChanged }: { ot: any; doctors: any[]; canManage: boolean; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const start = async () => {
    setActionError(null);
    const isFuture = new Date(ot.start_time).getTime() > Date.now();
    const { error } = await supabase.from('ot_records').update({
      status: 'in_progress', ...(isFuture ? { start_time: new Date().toISOString() } : {}),
    }).eq('id', ot.id);
    if (error) { setActionError(error.message); return; }
    onChanged();
  };

  const cancel = async () => {
    setActionError(null);
    const { error } = await supabase.from('ot_records').update({ status: 'cancelled' }).eq('id', ot.id);
    if (error) { setActionError(error.message); return; }
    onChanged();
  };

  const surgeon = doctors.find((d) => d.id === ot.surgeon_id);
  const anaesthetist = doctors.find((d) => d.id === ot.anaesthetist_id);
  const statusColor = ot.status === 'completed' ? 'tag-accent' : ot.status === 'cancelled' ? 'tag-outline' : ot.status === 'in_progress' ? 'tag-accent-2' : 'tag-outline';

  return (
    <li style={{ marginBottom: 10, listStyle: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <div>
          <button className="btn btn-ghost" style={{ padding: 0, fontWeight: 600 }} onClick={() => setExpanded((s) => !s)}>{expanded ? '▾' : '▸'} {ot.procedure_name} ({ot.eye})</button>
          <span className={`tag ${statusColor}`} style={{ marginLeft: 6 }}>{ot.status.replace(/_/g, ' ')}</span>
          <div className="text-muted" style={{ fontSize: 12 }}>
            {ot.status === 'scheduled' ? 'Scheduled for' : 'Started'} {new Date(ot.start_time).toLocaleString()}
            {ot.ot_room ? ` · ${ot.ot_room}` : ''}{surgeon ? ` · Dr. ${surgeon.full_name}` : ''}{anaesthetist ? ` · anaesthetist: ${anaesthetist.full_name}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {canManage && ot.status === 'scheduled' && <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={start}>Start</button>}
          {canManage && ot.status === 'in_progress' && !showComplete && <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setShowComplete(true)}>Complete</button>}
          {canManage && (ot.status === 'scheduled' || ot.status === 'in_progress') && <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={cancel}>Cancel</button>}
        </div>
      </div>
      {actionError && <div style={{ color: '#b64545', fontSize: 12, marginTop: 4 }}>{actionError}</div>}
      {showComplete && <CompleteOtForm ot={ot} onDone={() => setShowComplete(false)} onChanged={onChanged} />}
      {expanded && (
        <div style={{ marginTop: 6, paddingLeft: 8, borderLeft: '2px solid var(--color-divider)' }}>
          {ot.intra_op_notes && <p style={{ fontSize: 13, margin: '4px 0' }}><span className="text-muted">Intra-op notes:</span> {ot.intra_op_notes}</p>}
          {ot.complications && <p style={{ fontSize: 13, margin: '4px 0' }}><span className="text-muted">Complications:</span> {ot.complications}</p>}
          <SurgicalConsentPanel otRecordId={ot.id} procedureName={ot.procedure_name} eye={ot.eye} surgeonName={surgeon?.full_name ?? null} canManage={canManage} />
          <SafetyChecklistPanel otRecordId={ot.id} canManage={canManage} />
          <ImplantsPanel otRecordId={ot.id} canManage={canManage} />
        </div>
      )}
    </li>
  );
}

/** Previously only reachable from a visit's Admission/OT/Recovery tab —
 * a patient managed day-to-day from the Ward Census had no way to see or
 * record the OT event against their own admission. Same component now used
 * from both places. Also the fix for OT being 100% write-after-the-fact:
 * addOt() used to hardcode status='completed' with start/end both = now();
 * this schedules a real future slot and walks it through
 * scheduled -> in_progress -> completed, gated by the WHO safety checklist. */
export function OtRecoveryPanel({ admissionId, canManage }: { admissionId: string; canManage: boolean }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [recoveryForm, setRecoveryForm] = useState({ vitals_notes: '', pain_score: '0', discharge_instructions: '' });
  const [showRecoveryForm, setShowRecoveryForm] = useState(false);
  const [recoverySaving, setRecoverySaving] = useState(false);
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
  const latestCompletedOt = otRecords?.find((o: any) => o.status === 'completed');

  const addRecovery = async () => {
    if (!latestCompletedOt) return;
    setRecoverySaving(true);
    setRecoveryError(null);
    const { error } = await supabase.from('recovery_records').insert({
      ot_record_id: latestCompletedOt.id, vitals_notes: recoveryForm.vitals_notes || null, pain_score: Number(recoveryForm.pain_score) || 0,
      discharge_instructions: recoveryForm.discharge_instructions || null, monitored_by: profile?.id,
    });
    setRecoverySaving(false);
    if (error) { setRecoveryError(error.message); return; }
    setRecoveryForm({ vitals_notes: '', pain_score: '0', discharge_instructions: '' });
    setShowRecoveryForm(false);
    refresh();
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 13 }}>OT cases</strong>
        {canManage && !showScheduleForm && <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setShowScheduleForm(true)}>+ Schedule OT</button>}
      </div>
      {showScheduleForm && (
        <ScheduleOtForm
          admissionId={admissionId}
          doctors={doctors ?? []}
          defaultSurgeonId={profile?.role === 'doctor' ? profile.id : ''}
          onDone={() => { setShowScheduleForm(false); refresh(); }}
        />
      )}
      {otRecords?.length ? (
        <ul style={{ paddingLeft: 0, marginTop: 8 }}>
          {otRecords.map((ot: any) => <OtRecordCard key={ot.id} ot={ot} doctors={doctors ?? []} canManage={canManage} onChanged={refresh} />)}
        </ul>
      ) : <p className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>No OT cases yet.</p>}

      {latestCompletedOt && canManage && (
        <div style={{ marginTop: 10 }}>
          <strong style={{ fontSize: 13 }}>Recovery — {latestCompletedOt.procedure_name}</strong>
          {!showRecoveryForm && <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12, marginLeft: 8 }} onClick={() => setShowRecoveryForm(true)}>+ Record recovery</button>}
          {showRecoveryForm && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, alignItems: 'flex-end' }}>
              <input className="input" style={{ flex: '1 1 180px' }} placeholder="Vitals notes" value={recoveryForm.vitals_notes} onChange={(e) => setRecoveryForm((p) => ({ ...p, vitals_notes: e.target.value }))} />
              <input className="input" style={{ flex: '0 1 90px' }} type="number" min={0} max={10} placeholder="Pain 0-10" value={recoveryForm.pain_score} onChange={(e) => setRecoveryForm((p) => ({ ...p, pain_score: e.target.value }))} />
              <input className="input" style={{ flex: '1 1 180px' }} placeholder="Discharge instructions" value={recoveryForm.discharge_instructions} onChange={(e) => setRecoveryForm((p) => ({ ...p, discharge_instructions: e.target.value }))} />
              <button className="btn btn-primary" onClick={addRecovery} disabled={recoverySaving}>{recoverySaving ? 'Saving…' : 'Save'}</button>
              <button className="btn btn-ghost" onClick={() => setShowRecoveryForm(false)}>Cancel</button>
            </div>
          )}
          {recoveryError && <div style={{ color: '#b64545', fontSize: 11, marginTop: 4 }}>{recoveryError}</div>}
          {latestCompletedOt.recovery_records?.length ? (
            <ul style={{ paddingLeft: 18, fontSize: 13, marginTop: 4 }}>
              {latestCompletedOt.recovery_records.map((r: any) => (
                <li key={r.id}>Pain {r.pain_score}/10{r.vitals_notes ? `, ${r.vitals_notes}` : ''} ({new Date(r.recorded_at).toLocaleString()})</li>
              ))}
            </ul>
          ) : <p className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>No recovery entries yet.</p>}
        </div>
      )}
    </div>
  );
}
