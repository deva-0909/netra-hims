import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { updateOpticalOrderStatus } from '../lib/dispenseOpticalOrder';

const STATUSES = ['ordered', 'in_fabrication', 'ready', 'dispensed', 'cancelled'];

export function OpticalQueuePage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['optical-orders'],
    queryFn: async () => {
      const { data, error } = await supabase.from('optical_orders').select('*, patients(full_name, uhid)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = async (order: any, status: string) => {
    setError(null);
    setUpdatingId(order.id);
    const { error } = await updateOpticalOrderStatus(order.id, status, order.frame_item_id);
    setUpdatingId(null);
    if (error) {
      setError(error);
      return;
    }
    qc.invalidateQueries({ queryKey: ['optical-orders'] });
    qc.invalidateQueries({ queryKey: ['eyewear-items'] });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>Optical Shop â€” Order Tracking</h2>
        <Link className="btn btn-secondary" to="/optical/inventory">Inventory & stock</Link>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}
      {isLoading ? <p className="text-muted">Loadingâ€¦</p> : (
        <table className="table">
          <thead><tr><th>Order #</th><th>Patient</th><th>Frame</th><th>Lens</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            {orders?.map((o: any) => (
              <tr key={o.id}>
                <td>{o.order_number}</td>
                <td>{o.patients?.full_name} <span className="text-muted">({o.patients?.uhid})</span></td>
                <td>{o.frame_brand} {o.frame_model}</td>
                <td>{o.lens_type}</td>
                <td>â‚¹{Number(o.total_amount ?? 0).toFixed(2)}</td>
                <td>
                  <select className="input" value={o.status} onChange={(e) => updateStatus(o, e.target.value)} disabled={updatingId === o.id} style={{ width: 160 }}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {orders?.length === 0 && <tr><td colSpan={6} className="text-muted">No optical orders yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}