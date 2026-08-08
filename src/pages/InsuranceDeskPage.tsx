import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { fetchClaimFileData } from '../lib/fetchClaimFileData';
import { printClaimFile } from '../lib/printClaimFile';

const STATUSES = ['eligibility_check', 'pre_auth_requested', 'approved', 'rejected', 'settled'];
type StatusFilter = 'active' | 'all' | (typeof STATUSES)[number];

function ClaimRow({ c, onStatusChange }: { c: any; onStatusChange: (id: string, status: string) => void }) {
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

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
        {c.visit_id ? (
          <button className="btn btn-ghost" onClick={generateFile} disabled={generating}>{generating ? 'Preparing…' : 'Generate claim file'}</button>
        ) : <span className="text-muted" style={{ fontSize: 11 }}>No visit linked</span>}
        {genError && <div style={{ color: '#b64545', fontSize: 11, marginTop: 4 }}>{genError}</div>}
      </td>
    </tr>
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
            {filtered.map((c: any) => <ClaimRow key={c.id} c={c} onStatusChange={updateStatus} />)}
            {filtered.length === 0 && <tr><td colSpan={7} className="text-muted">No claims match.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
