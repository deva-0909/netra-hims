import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';

export function InvestigationsPanel({ visitId, isDoctor }: { visitId: string; isDoctor: boolean }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [testName, setTestName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: orders } = useQuery({
    queryKey: ['ipd-investigation-orders', visitId],
    queryFn: async () => {
      const { data, error } = await supabase.from('investigation_orders').select('*').eq('visit_id', visitId).order('ordered_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const submit = async () => {
    if (!testName.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('investigation_orders').insert({
      visit_id: visitId, test_name: testName, status: 'ordered', ordered_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setTestName('');
    setShowForm(false);
    qc.invalidateQueries({ queryKey: ['ipd-investigation-orders', visitId] });
  };

  return (
    <div style={{ marginTop: 8 }}>
      {isDoctor && !showForm && <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setShowForm(true)}>+ Order investigation</button>}
      {showForm && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
          <input className="input" style={{ flex: '1 1 200px' }} placeholder="Test name (e.g. CBC, RBS, HbA1c)" value={testName} onChange={(e) => setTestName(e.target.value)} />
          <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Ordering…' : 'Order'}</button>
          <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
        </div>
      )}
      {error && <div style={{ color: '#b64545', fontSize: 11, marginTop: 4 }}>{error}</div>}
      {orders && orders.length > 0 && (
        <div className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
          {orders.map((o: any) => (
            <div key={o.id}>{o.test_name} — <span className="tag tag-outline" style={{ fontSize: 10 }}>{o.status}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}
