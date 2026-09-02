import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { fetchClaimFileData } from '../lib/fetchClaimFileData';
import { printClaimFile } from '../lib/printClaimFile';

const STATUSES = ['eligibility_check', 'pre_auth_requested', 'query_raised', 'resubmitted', 'approved', 'rejected', 'settled'];
type StatusFilter = 'active' | 'all' | (typeof STATUSES)[number];

/** TPA queries — a claim can go back and forth several rounds, so each
 * query is its own row (query_text + resubmission_notes) rather than
 * overwriting a single notes field every time. */
function ClaimQueriesPanel({ claimId }: { claimId: string }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [newQuery, setNewQuery] = useState('');
  const [resubmitDrafts, setResubmitDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: queries } = useQuery({
    queryKey: ['insurance-claim-queries', claimId],
    queryFn: async () => {
      const { data, error } = await supabase.from('insurance_claim_queries').select('*').eq('claim_id', claimId).order('raised_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const logQuery = async () => {
    if (!newQuery.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('insurance_claim_queries').insert({ claim_id: claimId, query_text: newQuery.trim(), logged_by: profile?.id });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setNewQuery('');
    qc.invalidateQueries({ queryKey: ['insurance-claim-queries', claimId] });
  };

  const markResubmitted = async (queryId: string) => {
    const notes = resubmitDrafts[queryId] ?? '';
    const { error: updateError } = await supabase.from('insurance_claim_queries').update({
      resubmission_notes: notes || null, resubmitted_at: new Date().toISOString(), resolved: true,
    }).eq('id', queryId);
    if (updateError) { setError(updateError.message); return; }
    setResubmitDrafts((prev) => { const next = { ...prev }; delete next[queryId]; return next; });
    qc.invalidateQueries({ queryKey: ['insurance-claim-queries', claimId] });
  };

  return (
    <div style={{ marginTop: 8 }}>
      <strong style={{ fontSize: 12 }}>TPA queries</strong>
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <input className="input" style={{ flex: '1 1 300px' }} value={newQuery} onChange={(e) => setNewQuery(e.target.value)} placeholder="Query raised by the TPA…" />
        <button className="btn btn-secondary" onClick={logQuery} disabled={saving}>Log query</button>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 11, marginTop: 4 }}>{error}</div>}
      {queries?.map((q: any) => (
        <div key={q.id} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--color-divider)' }}>
          <div><strong>Query</strong> ({new Date(q.raised_at).toLocaleDateString()}): {q.query_text}</div>
          {q.resolved ? (
            <div className="text-muted">Resubmitted {q.resubmitted_at ? new Date(q.resubmitted_at).toLocaleDateString() : ''}{q.resubmission_notes ? ` — ${q.resubmission_notes}` : ''}</div>
          ) : (
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <input className="input" style={{ flex: '1 1 200px' }} placeholder="Resubmission notes" value={resubmitDrafts[q.id] ?? ''} onChange={(e) => setResubmitDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))} />
              <button className="btn btn-ghost" onClick={() => markResubmitted(q.id)}>Mark resubmitted</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ClaimDetails({ c, onSaved }: { c: any; onSaved: () => void }) {
  const [policyOrCardNo, setPolicyOrCardNo] = useState(c.policy_or_card_no ?? '');
  const [preAuthReference, setPreAuthReference] = useState(c.pre_auth_reference ?? '');
  const [notes, setNotes] = useState(c.notes ?? '');
  const [sumInsured, setSumInsured] = useState(c.sum_insured != null ? String(c.sum_insured) : '');
  const [roomRentLimit, setRoomRentLimit] = useState(c.room_rent_limit != null ? String(c.room_rent_limit) : '');
  const [coPayPercent, setCoPayPercent] = useState(c.co_pay_percent != null ? String(c.co_pay_percent) : '');
  const [eligibilityVerified, setEligibilityVerified] = useState(c.eligibility_verified ?? false);
  const [settledAmount, setSettledAmount] = useState(c.settled_amount != null ? String(c.settled_amount) : '');
  const [deductionAmount, setDeductionAmount] = useState(c.deduction_amount != null ? String(c.deduction_amount) : '');
  const [deductionReason, setDeductionReason] = useState(c.deduction_reason ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    const payload: Record<string, any> = {
      policy_or_card_no: policyOrCardNo || null,
      pre_auth_reference: preAuthReference || null,
      notes: notes || null,
      sum_insured: sumInsured ? Number(sumInsured) : null,
      room_rent_limit: roomRentLimit ? Number(roomRentLimit) : null,
      co_pay_percent: coPayPercent ? Number(coPayPercent) : null,
      settled_amount: settledAmount ? Number(settledAmount) : null,
      deduction_amount: deductionAmount ? Number(deductionAmount) : null,
      deduction_reason: deductionReason || null,
    };
    if (eligibilityVerified && !c.eligibility_verified) { payload.eligibility_verified = true; payload.eligibility_verified_at = new Date().toISOString(); }
    else if (!eligibilityVerified) { payload.eligibility_verified = false; payload.eligibility_verified_at = null; }
    if (settledAmount && !c.settled_at) payload.settled_at = new Date().toISOString();
    const { error: updateError } = await supabase.from('insurance_claims').update(payload).eq('id', c.id);
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    onSaved();
  };

  const variance = settledAmount && c.approved_amount != null ? Number(settledAmount) - Number(c.approved_amount) : null;

  return (
    <tr>
      <td colSpan={7} style={{ background: 'var(--color-accent-100)' }}>
        <div style={{ padding: '8px 4px' }}>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: '1 1 200px', marginBottom: 0 }}>
              <label style={{ fontSize: 11 }}>Policy / Card No.</label>
              <input className="input" value={policyOrCardNo} onChange={(e) => setPolicyOrCardNo(e.target.value)} />
            </div>
            <div className="field" style={{ flex: '1 1 200px', marginBottom: 0 }}>
              <label style={{ fontSize: 11 }}>Pre-auth reference</label>
              <input className="input" value={preAuthReference} onChange={(e) => setPreAuthReference(e.target.value)} />
            </div>
            <div className="field" style={{ flex: '2 1 260px', marginBottom: 0 }}>
              <label style={{ fontSize: 11 }}>Notes</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 8 }}>
            <div className="field" style={{ flex: '0 1 140px', marginBottom: 0 }}>
              <label style={{ fontSize: 11 }}>Sum insured</label>
              <input className="input" type="number" value={sumInsured} onChange={(e) => setSumInsured(e.target.value)} />
            </div>
            <div className="field" style={{ flex: '0 1 140px', marginBottom: 0 }}>
              <label style={{ fontSize: 11 }}>Room rent limit</label>
              <input className="input" type="number" value={roomRentLimit} onChange={(e) => setRoomRentLimit(e.target.value)} />
            </div>
            <div className="field" style={{ flex: '0 1 120px', marginBottom: 0 }}>
              <label style={{ fontSize: 11 }}>Co-pay %</label>
              <input className="input" type="number" value={coPayPercent} onChange={(e) => setCoPayPercent(e.target.value)} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <input type="checkbox" checked={eligibilityVerified} onChange={(e) => setEligibilityVerified(e.target.checked)} /> Eligibility verified
            </label>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 8 }}>
            <div className="field" style={{ flex: '0 1 140px', marginBottom: 0 }}>
              <label style={{ fontSize: 11 }}>Settled amount received</label>
              <input className="input" type="number" value={settledAmount} onChange={(e) => setSettledAmount(e.target.value)} />
            </div>
            <div className="field" style={{ flex: '0 1 140px', marginBottom: 0 }}>
              <label style={{ fontSize: 11 }}>Deduction amount</label>
              <input className="input" type="number" value={deductionAmount} onChange={(e) => setDeductionAmount(e.target.value)} />
            </div>
            <div className="field" style={{ flex: '1 1 220px', marginBottom: 0 }}>
              <label style={{ fontSize: 11 }}>Deduction reason</label>
              <input className="input" value={deductionReason} onChange={(e) => setDeductionReason(e.target.value)} />
            </div>
            {variance != null && (
              <span style={{ fontSize: 12, color: variance === 0 ? undefined : '#8a662c' }}>
                Variance vs approved: {variance >= 0 ? '+' : ''}₹{variance.toFixed(2)}
              </span>
            )}
          </div>

          <div style={{ marginTop: 8 }}>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            {error && <span style={{ color: '#b64545', fontSize: 11, marginLeft: 8 }}>{error}</span>}
          </div>

          <ClaimQueriesPanel claimId={c.id} />
        </div>
      </td>
    </tr>
  );
}

function ClaimRow({ c, onStatusChange, onSaved }: { c: any; onStatusChange: (id: string, status: string) => void; onSaved: () => void }) {
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const generateFile = async () => {
    if (!c.visit_id) return;
    setGenerating(true);
    setGenError(null);
    try {
      const data = await fetchClaimFileData(c.visit_id);
      printClaimFile(data, 'Insurance Claim File');
    } catch (e: any) {
      setGenError(e.message ?? 'Could not generate the claim file.');
    }
    setGenerating(false);
  };

  return (
    <>
      <tr>
        <td style={{ cursor: 'pointer' }} onClick={() => navigate(`/patients/${c.patient_id}`)}>
          {c.patients?.full_name} <span className="text-muted">({c.patients?.uhid})</span>
        </td>
        <td>{c.scheme ?? '—'}</td>
        <td>{c.package_selected ?? '—'}</td>
        <td>₹{Number(c.claim_amount ?? 0).toFixed(0)} / ₹{Number(c.approved_amount ?? 0).toFixed(0)}</td>
        <td>{c.document_url ? <a href={c.document_url} target="_blank" rel="noreferrer">View</a> : <span className="text-muted">—</span>}</td>
        <td>
          <select className="input" value={c.status} onChange={(e) => onStatusChange(c.id, e.target.value)} style={{ width: 160 }}>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </td>
        <td>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={() => setExpanded((s) => !s)}>{expanded ? 'Hide details' : 'Pre-auth & notes'}</button>
            {c.visit_id ? (
              <button className="btn btn-ghost" onClick={generateFile} disabled={generating}>{generating ? 'Preparing…' : 'Generate claim file'}</button>
            ) : <span className="text-muted" style={{ fontSize: 11 }}>No visit linked</span>}
          </div>
          {genError && <div style={{ color: '#b64545', fontSize: 11, marginTop: 4 }}>{genError}</div>}
        </td>
      </tr>
      {expanded && <ClaimDetails c={c} onSaved={() => { setExpanded(false); onSaved(); }} />}
    </>
  );
}

export function InsuranceDeskPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  const { data: claims, isLoading } = useQuery({
    queryKey: ['insurance-claims'],
    queryFn: async () => {
      const { data, error } = await supabase.from('insurance_claims').select('*, patients(full_name, uhid)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = async (id: string, status: string) => {
    setError(null);
    const { error: updateError } = await supabase.from('insurance_claims').update({ status }).eq('id', id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ['insurance-claims'] });
  };

  const term = search.trim().toLowerCase();
  const filtered = (claims ?? []).filter((c: any) => {
    if (statusFilter === 'active' && (c.status === 'settled' || c.status === 'rejected')) return false;
    if (statusFilter !== 'active' && statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (!term) return true;
    return c.patients?.full_name?.toLowerCase().includes(term) || c.patients?.uhid?.toLowerCase().includes(term) || c.scheme?.toLowerCase().includes(term);
  });

  return (
    <div>
      <h2>Insurance Desk</h2>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}

      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div className="field" style={{ maxWidth: 300 }}>
          <label>Search</label>
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Patient name, UHID or scheme" />
        </div>
        <div className="seg" style={{ maxWidth: 560 }}>
          {(['active', 'all', ...STATUSES] as StatusFilter[]).map((f) => (
            <label key={f} className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
              <input type="radio" checked={statusFilter === f} onChange={() => setStatusFilter(f)} /> {f.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
      </div>

      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Patient</th><th>Scheme</th><th>Package</th><th>Claim / Approved</th><th>Document</th><th>Status</th><th /></tr></thead>
          <tbody>
            {filtered.map((c: any) => <ClaimRow key={c.id} c={c} onStatusChange={updateStatus} onSaved={() => qc.invalidateQueries({ queryKey: ['insurance-claims'] })} />)}
            {filtered.length === 0 && <tr><td colSpan={7} className="text-muted">No claims match.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
