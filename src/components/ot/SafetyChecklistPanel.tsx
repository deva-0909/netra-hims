import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';

type Phase = 'sign_in' | 'time_out' | 'sign_out';

const PHASE_ITEMS: Record<Phase, { key: string; label: string }[]> = {
  sign_in: [
    { key: 'sign_in_identity_site_procedure_confirmed', label: 'Patient identity, site & procedure confirmed' },
    { key: 'sign_in_consent_confirmed', label: 'Surgical consent confirmed' },
    { key: 'sign_in_site_marked', label: 'Surgical site marked (if applicable)' },
  ],
  time_out: [
    { key: 'time_out_team_introduced', label: 'Team members introduced by name and role' },
    { key: 'time_out_site_procedure_reconfirmed', label: 'Patient, site & procedure reconfirmed aloud' },
    { key: 'time_out_critical_events_reviewed', label: 'Anticipated critical events reviewed' },
  ],
  sign_out: [
    { key: 'sign_out_counts_correct', label: 'Instrument/sponge/needle counts correct' },
    { key: 'sign_out_specimen_labeled', label: 'Specimen labeled (if applicable)' },
    { key: 'sign_out_equipment_issues_noted', label: 'Equipment problems noted, if any' },
  ],
};

const PHASE_LABEL: Record<Phase, string> = { sign_in: 'Sign In — before anaesthesia', time_out: 'Time Out — before incision', sign_out: 'Sign Out — before leaving OT' };

/** WHO Surgical Safety Checklist — the highest-risk moment in the hospital
 * previously had no structured check at all. Sign-In gates starting the
 * case (status -> in_progress) and Sign-Out gates completing it, enforced
 * at the DB via trg_enforce_ot_safety_checklist, not just this UI. */
export function SafetyChecklistPanel({ otRecordId, canManage }: { otRecordId: string; canManage: boolean }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: checklist } = useQuery({
    queryKey: ['ot-safety-checklist', otRecordId],
    queryFn: async () => {
      const { data, error } = await supabase.from('ot_safety_checklists').select('*').eq('ot_record_id', otRecordId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const ensureRow = async () => {
    if (checklist) return checklist.id;
    const { data, error } = await supabase.from('ot_safety_checklists').insert({ ot_record_id: otRecordId }).select().single();
    if (error) { setError(error.message); return null; }
    qc.invalidateQueries({ queryKey: ['ot-safety-checklist', otRecordId] });
    return data.id;
  };

  const toggle = (key: string, current: boolean) => setDraft((d) => ({ ...d, [key]: d[key] === undefined ? !current : !d[key] }));

  const confirmPhase = async (phase: Phase) => {
    setSaving(true);
    setError(null);
    const id = await ensureRow();
    if (!id) { setSaving(false); return; }
    const patch: Record<string, any> = {};
    for (const item of PHASE_ITEMS[phase]) patch[item.key] = draft[item.key] ?? (checklist?.[item.key] ?? false);
    patch[`${phase}_by`] = profile?.id;
    patch[`${phase}_at`] = new Date().toISOString();
    const { error: updateError } = await supabase.from('ot_safety_checklists').update(patch).eq('id', id);
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    setDraft({});
    qc.invalidateQueries({ queryKey: ['ot-safety-checklist', otRecordId] });
  };

  const renderPhase = (phase: Phase, unlocked: boolean) => {
    const confirmedAt = checklist?.[`${phase}_at`];
    const allChecked = PHASE_ITEMS[phase].every((item) => draft[item.key] ?? (checklist?.[item.key] ?? false));

    return (
      <div key={phase} style={{ marginTop: 8, opacity: unlocked ? 1 : 0.5 }}>
        <strong style={{ fontSize: 12 }}>{PHASE_LABEL[phase]}</strong>
        {confirmedAt ? (
          <span className="tag tag-accent" style={{ marginLeft: 6, fontSize: 10 }}>confirmed {new Date(confirmedAt).toLocaleString()}</span>
        ) : !unlocked ? (
          <span className="tag tag-outline" style={{ marginLeft: 6, fontSize: 10 }}>complete the previous phase first</span>
        ) : null}
        <div style={{ marginTop: 2 }}>
          {PHASE_ITEMS[phase].map((item) => (
            <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginTop: 2 }}>
              <input
                type="checkbox"
                disabled={!canManage || !unlocked || !!confirmedAt}
                checked={draft[item.key] ?? (checklist?.[item.key] ?? false)}
                onChange={() => toggle(item.key, checklist?.[item.key] ?? false)}
              />
              {item.label}
            </label>
          ))}
        </div>
        {canManage && unlocked && !confirmedAt && (
          <button className="btn btn-ghost" style={{ padding: '1px 6px', fontSize: 11, marginTop: 4 }} onClick={() => confirmPhase(phase)} disabled={saving || !allChecked}>
            {saving ? 'Confirming…' : `Confirm ${PHASE_LABEL[phase].split(' — ')[0]}`}
          </button>
        )}
      </div>
    );
  };

  return (
    <div style={{ marginTop: 8, padding: 8, border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-md)' }}>
      <strong style={{ fontSize: 13 }}>WHO Surgical Safety Checklist</strong>
      {error && <div style={{ color: '#b64545', fontSize: 11, marginTop: 4 }}>{error}</div>}
      {renderPhase('sign_in', true)}
      {renderPhase('time_out', !!checklist?.sign_in_at)}
      {renderPhase('sign_out', !!checklist?.time_out_at)}
    </div>
  );
}
