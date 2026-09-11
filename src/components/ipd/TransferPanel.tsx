import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';

export function TransferPanel({ admission, availableBeds, canManage, onChanged }: { admission: any; availableBeds: any[]; canManage: boolean; onChanged: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [toBedId, setToBedId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingTransferId, setPendingTransferId] = useState<string | null>(null);

  const { data: history } = useQuery({
    queryKey: ['ipd-bed-transfers', admission.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bed_transfers')
        .select('*, from_bed:beds!bed_transfers_from_bed_id_fkey(bed_number,ward), to_bed:beds!bed_transfers_to_bed_id_fkey(bed_number,ward)')
        .eq('admission_id', admission.id)
        .order('transferred_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const submit = async () => {
    if (!toBedId) return;
    setSaving(true);
    setError(null);
    const fromBedId = admission.bed_id;

    let transferId = pendingTransferId;
    if (!transferId) {
      const { data: transfer, error: transferError } = await supabase.from('bed_transfers').insert({
        admission_id: admission.id, from_bed_id: fromBedId, to_bed_id: toBedId, reason: reason || null, transferred_by: profile?.id,
      }).select().single();
      if (transferError || !transfer) { setSaving(false); setError(transferError?.message ?? 'Could not record the transfer.'); return; }
      transferId = transfer.id;
      setPendingTransferId(transferId);
    }

    const { error: admissionError } = await supabase.from('admissions').update({ bed_id: toBedId }).eq('id', admission.id);
    if (admissionError) { setSaving(false); setError(admissionError.message); return; }

    // Both bed-status writes are checked (rather than fire-and-forget) — a
    // silently-failed "mark new bed occupied" would leave it looking free
    // for another admission while this patient is actually in it.
    if (fromBedId) {
      const { error: fromBedError } = await supabase.from('beds').update({ status: 'available' }).eq('id', fromBedId);
      if (fromBedError) { setSaving(false); setError(`Transfer recorded, but releasing the old bed failed: ${fromBedError.message}`); return; }
    }
    const { error: toBedError } = await supabase.from('beds').update({ status: 'occupied' }).eq('id', toBedId);
    if (toBedError) { setSaving(false); setError(`Transfer recorded, but marking the new bed occupied failed: ${toBedError.message}`); return; }

    setPendingTransferId(null);
    setSaving(false);
    setReason('');
    setToBedId('');
    setShowForm(false);
    qc.invalidateQueries({ queryKey: ['ipd-bed-transfers', admission.id] });
    onChanged();
  };

  return (
    <div style={{ marginTop: 8 }}>
      {canManage && !showForm && <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setShowForm(true)}>Transfer bed</button>}
      {showForm && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
          <select className="input" style={{ width: 170 }} value={toBedId} onChange={(e) => setToBedId(e.target.value)}>
            <option value="">Select new bed</option>
            {availableBeds.map((b: any) => <option key={b.id} value={b.id}>{b.bed_number} {b.ward ? `(${b.ward})` : ''}</option>)}
          </select>
          <input className="input" style={{ flex: '1 1 160px' }} placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="btn btn-primary" onClick={submit} disabled={saving || !toBedId}>{saving ? 'Transferring…' : 'Confirm transfer'}</button>
          <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
        </div>
      )}
      {error && <div style={{ color: '#b64545', fontSize: 11, marginTop: 4 }}>{error}</div>}
      {history && history.length > 0 && (
        <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
          {history.map((t: any) => (
            <div key={t.id}>{new Date(t.transferred_at).toLocaleString()}: {t.from_bed?.bed_number ?? '—'} &rarr; {t.to_bed?.bed_number}{t.reason ? ` — ${t.reason}` : ''}</div>
          ))}
        </div>
      )}
    </div>
  );
}
