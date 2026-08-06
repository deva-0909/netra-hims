import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import type { Patient } from '../lib/types';

/** Admin-only: reconciles a genuine duplicate into this (canonical) patient
 * record. Even with the phone-based duplicate warning at registration,
 * staff can still create one — different phone number, a relative
 * registering on the patient's behalf — and once it exists there was no
 * way to fix it, permanently fragmenting that patient's history across two
 * UHIDs. Reassigns every table with a patient_id via the merge_patients()
 * DB function (atomic, admin-gated regardless of caller's own RLS) and
 * tags the absorbed record with merged_into rather than deleting it. */
export function MergePatientPanel({ patient, onDone }: { patient: Patient; onDone: () => void }) {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [selected, setSelected] = useState<Patient | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: matches } = useQuery({
    queryKey: ['merge-patient-search', debouncedQuery],
    enabled: debouncedQuery.length > 1 && !selected,
    queryFn: async () => {
      const { data, error } = await supabase.from('patients').select('*')
        .or(`full_name.ilike.%${debouncedQuery}%,uhid.ilike.%${debouncedQuery}%,phone.ilike.%${debouncedQuery}%`)
        .is('merged_into', null).neq('id', patient.id).limit(8);
      if (error) throw error;
      return data as Patient[];
    },
  });

  const confirm = async () => {
    if (!selected) return;
    setMerging(true);
    setError(null);
    const { error: mergeError } = await supabase.rpc('merge_patients', { p_source_id: selected.id, p_target_id: patient.id });
    setMerging(false);
    if (mergeError) { setError(mergeError.message); return; }
    qc.invalidateQueries({ queryKey: ['patient', patient.id] });
    qc.invalidateQueries({ queryKey: ['visits', patient.id] });
    qc.invalidateQueries({ queryKey: ['patients'] });
    onDone();
  };

  return (
    <div className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>Merge a duplicate into {patient.full_name}</h4>
      <p className="text-muted" style={{ fontSize: 12, marginTop: -6 }}>
        This record ({patient.uhid}) stays canonical. The duplicate's visits, bills, appointments and every other
        record move here, and the duplicate is tagged as merged, not deleted. This cannot be undone.
      </p>

      {!confirming ? (
        <>
          <div className="field" style={{ maxWidth: 320, position: 'relative' }}>
            <label>Find the duplicate patient</label>
            <input className="input" value={selected ? `${selected.full_name} (${selected.uhid})` : query}
              onChange={(e) => { setSelected(null); setQuery(e.target.value); }} placeholder="Search name, UHID or phone" />
            {!selected && matches && matches.length > 0 && (
              <div className="card elev-md" style={{ position: 'absolute', zIndex: 10, width: '100%', maxHeight: 200, overflowY: 'auto', padding: 4 }}>
                {matches.map((p) => (
                  <div key={p.id} style={{ padding: 6, cursor: 'pointer' }} onClick={() => setSelected(p)}>{p.full_name} — {p.uhid} {p.phone ? `· ${p.phone}` : ''}</div>
                ))}
              </div>
            )}
          </div>
          <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" disabled={!selected} onClick={() => setConfirming(true)}>Continue</button>
            <button className="btn btn-secondary" onClick={onDone}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <div className="card" style={{ padding: 'var(--space-3)', background: '#fdf3d8', borderColor: '#e0c060' }}>
            <strong>Merge {selected?.full_name} ({selected?.uhid}) into {patient.full_name} ({patient.uhid})?</strong>
            <p style={{ fontSize: 13, margin: '6px 0 0' }}>
              Every appointment, bill, visit, insurance claim, follow-up and other record belonging to {selected?.full_name} will move to this patient.
            </p>
          </div>
          {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
          <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={confirm} disabled={merging}>{merging ? 'Merging…' : 'Confirm merge'}</button>
            <button className="btn btn-secondary" onClick={() => setConfirming(false)} disabled={merging}>Back</button>
          </div>
        </>
      )}
    </div>
  );
}
