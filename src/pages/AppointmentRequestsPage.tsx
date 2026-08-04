import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  pending: { background: '#faf0d8', color: '#8a662c', borderColor: '#e0c9a3' },
  contacted: { background: '#e3efe0', color: '#2e6b49', borderColor: '#b7d9ae' },
  declined: { background: '#f6dede', color: '#8a2c2c', borderColor: '#e0a3a3' },
};

function RequestRow({ req }: { req: any }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState(req.staff_notes ?? '');

  const decide = async (status: string) => {
    await supabase.from('appointment_requests').update({ status, staff_notes: notes || null }).eq('id', req.id);
    qc.invalidateQueries({ queryKey: ['appointment-requests'] });
  };

  return (
    <tr>
      <td>{new Date(req.created_at).toLocaleString()}</td>
      <td>{req.full_name}</td>
      <td>{req.phone}</td>
      <td>{req.preferred_clinic_module}</td>
      <td>{req.preferred_date ?? '—'}</td>
      <td className="text-muted" style={{ maxWidth: 200 }}>{req.reason ?? '—'}</td>
      <td><span className="tag tag-outline" style={STATUS_STYLE[req.status]}>{req.status}</span></td>
      <td>
        {req.status === 'pending' && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="input" style={{ width: 120 }} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <button className="btn btn-ghost" onClick={() => decide('contacted')}>Contacted</button>
            <button className="btn btn-ghost" onClick={() => decide('declined')}>Decline</button>
          </div>
        )}
      </td>
    </tr>
  );
}

export function AppointmentRequestsPage() {
  const { data: requests, isLoading } = useQuery({
    queryKey: ['appointment-requests'],
    queryFn: async () => {
      const { data, error } = await supabase.from('appointment_requests').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Appointment Requests</h2>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 'var(--space-4)' }}>
        Submitted from the public request form. Call back, then register the patient and book the visit as usual from{' '}
        <Link to="/patients">Patients</Link> — nothing here creates a patient record automatically.
      </p>
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Submitted</th><th>Name</th><th>Phone</th><th>Clinic</th><th>Preferred date</th><th>Reason</th><th>Status</th><th /></tr></thead>
          <tbody>
            {requests?.map((r: any) => <RequestRow key={r.id} req={r} />)}
            {requests?.length === 0 && <tr><td colSpan={8} className="text-muted">No requests yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
