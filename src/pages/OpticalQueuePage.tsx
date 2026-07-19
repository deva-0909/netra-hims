import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

const STATUSES = ['ordered', 'in_fabrication', 'ready', 'dispensed', 'cancelled'];

export function OpticalQueuePage() {
  const qc = useQueryClient();
  const { data: orders, isLoading } = useQuery({
    queryKey: ['optical-orders'],
    queryFn: async () => {
      const { data, error } = await supabase.from('optical_orders').select('*, patients(full_name, uhid)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('optical_orders').update({ status }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['optical-orders'] });
  };

  return (
    <div>
      <h2>Optical Shop — Order Tracking</h2>
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Order #</th><th>Patient</th><th>Frame</th><th>Lens</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            {orders?.map((o: any) => (
              <tr key={o.id}>
                <td>{o.order_number}</td>
                <td>{o.patients?.full_name} <span className="text-muted">({o.patients?.uhid})</span></td>
                <td>{o.frame_brand} {o.frame_model}</td>
                <td>{o.lens_type}</td>
                <td>₹{Number(o.total_amount ?? 0).toFixed(2)}</td>
                <td>
                  <select className="input" value={o.status} onChange={(e) => updateStatus(o.id, e.target.value)} style={{ width: 160 }}>
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
