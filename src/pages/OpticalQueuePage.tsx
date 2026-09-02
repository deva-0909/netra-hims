import { useState, Fragment } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { updateOpticalOrderStatus } from '../lib/dispenseOpticalOrder';

const STATUSES = ['ordered', 'in_fabrication', 'ready', 'dispensed', 'cancelled'];
const JOB_CARD_STAGES = ['cutting', 'fitting', 'quality_check', 'ready_for_delivery', 'delivered'] as const;
const JOB_CARD_LABELS: Record<string, string> = { cutting: 'Cutting', fitting: 'Fitting', quality_check: 'Quality Check', ready_for_delivery: 'Ready for Delivery', delivered: 'Delivered' };
const REPAIR_STATUSES = ['reported', 'in_repair', 'repaired', 'replaced', 'not_covered'];

/** The lab-floor checklist — distinct from optical_orders.status, which is
 * the coarse business-flow field billing/dispensing gate on. A stage can
 * only be completed once the previous one is (mirrors the WHO safety
 * checklist's phase-gating pattern), and re-marking corrects the same row
 * rather than creating a duplicate (unique on order+stage). */
function JobCardChecklist({ orderId }: { orderId: string }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);

  const { data: stages } = useQuery({
    queryKey: ['optical-job-card', orderId],
    queryFn: async () => {
      const { data, error } = await supabase.from('optical_job_card_stages').select('*, profiles(full_name)').eq('optical_order_id', orderId);
      if (error) throw error;
      return data;
    },
  });

  const byStage = new Map((stages ?? []).map((s: any) => [s.stage, s]));

  const complete = async (stage: string) => {
    setSaving(stage);
    await supabase.from('optical_job_card_stages').upsert(
      { optical_order_id: orderId, stage, completed_by: profile?.id, completed_at: new Date().toISOString() },
      { onConflict: 'optical_order_id,stage' }
    );
    setSaving(null);
    qc.invalidateQueries({ queryKey: ['optical-job-card', orderId] });
  };

  return (
    <div>
      <strong style={{ fontSize: 12 }}>Job card</strong>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        {JOB_CARD_STAGES.map((stage, i) => {
          const done = byStage.get(stage);
          const prevDone = i === 0 || byStage.has(JOB_CARD_STAGES[i - 1]);
          return (
            <div key={stage} style={{ fontSize: 12, opacity: prevDone ? 1 : 0.5 }}>
              {done ? (
                <span className="tag tag-accent">{JOB_CARD_LABELS[stage]} ✓ {done.profiles?.full_name ?? ''} ({new Date(done.completed_at).toLocaleDateString()})</span>
              ) : (
                <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} disabled={!prevDone || saving === stage} onClick={() => complete(stage)}>
                  {saving === stage ? 'Saving…' : `Mark ${JOB_CARD_LABELS[stage]}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RepairsSection({ orderId }: { orderId: string }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [issue, setIssue] = useState('');
  const [warrantyCovered, setWarrantyCovered] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: repairs } = useQuery({
    queryKey: ['optical-repairs', orderId],
    queryFn: async () => {
      const { data, error } = await supabase.from('optical_repairs').select('*').eq('optical_order_id', orderId).order('reported_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const report = async () => {
    if (!issue.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('optical_repairs').insert({
      optical_order_id: orderId, issue_description: issue.trim(), warranty_covered: warrantyCovered, handled_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setIssue(''); setWarrantyCovered(false); setShowForm(false);
    qc.invalidateQueries({ queryKey: ['optical-repairs', orderId] });
  };

  const updateStatus = async (repairId: string, status: string) => {
    const patch: Record<string, any> = { repair_status: status };
    if (status === 'repaired' || status === 'replaced' || status === 'not_covered') patch.resolved_at = new Date().toISOString();
    await supabase.from('optical_repairs').update(patch).eq('id', repairId);
    qc.invalidateQueries({ queryKey: ['optical-repairs', orderId] });
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 12 }}>Repairs / warranty claims</strong>
        {!showForm && <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => setShowForm(true)}>+ Report issue</button>}
      </div>
      {showForm && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4, alignItems: 'center' }}>
          <input className="input" style={{ flex: '1 1 240px' }} placeholder="Issue description" value={issue} onChange={(e) => setIssue(e.target.value)} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <input type="checkbox" checked={warrantyCovered} onChange={(e) => setWarrantyCovered(e.target.checked)} /> Warranty covered
          </label>
          <button className="btn btn-primary" onClick={report} disabled={saving}>{saving ? 'Saving…' : 'Report'}</button>
          <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
        </div>
      )}
      {error && <div style={{ color: '#b64545', fontSize: 11, marginTop: 4 }}>{error}</div>}
      {repairs?.map((r: any) => (
        <div key={r.id} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--color-divider)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <span>{r.issue_description} {r.warranty_covered && <span className="tag tag-outline" style={{ fontSize: 10 }}>warranty</span>} — {new Date(r.reported_at).toLocaleDateString()}</span>
          <select className="input" style={{ width: 130 }} value={r.repair_status} onChange={(e) => updateStatus(r.id, e.target.value)}>
            {REPAIR_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      ))}
      {repairs?.length === 0 && <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>No repairs reported.</p>}
    </div>
  );
}

export function OpticalQueuePage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['optical-orders'],
    queryFn: async () => {
      const { data, error } = await supabase.from('optical_orders').select('*, patients(full_name, uhid), eyewear_items(stock_qty)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = async (order: any, status: string) => {
    setError(null);
    setUpdatingId(order.id);
    const { error } = await updateOpticalOrderStatus(order.id, status, order.frame_item_id, profile?.id);
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
        <h2 style={{ margin: 0 }}>Optical Shop — Order Tracking</h2>
        <Link className="btn btn-secondary" to="/optical/inventory">Inventory & stock</Link>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Order #</th><th>Patient</th><th>Frame</th><th>Lens</th><th>Amount</th><th>Status</th><th /></tr></thead>
          <tbody>
            {orders?.map((o: any) => {
              const short = o.status !== 'dispensed' && o.eyewear_items && o.eyewear_items.stock_qty < 1;
              const expanded = expandedId === o.id;
              return (
                <Fragment key={o.id}>
                  <tr>
                    <td>{o.order_number}</td>
                    <td>{o.patients?.full_name} <span className="text-muted">({o.patients?.uhid})</span></td>
                    <td style={short ? { color: '#b64545' } : undefined}>
                      {o.frame_brand} {o.frame_model}
                      {short && <span className="text-muted"> (out of stock)</span>}
                    </td>
                    <td>{o.lens_type}</td>
                    <td>₹{Number(o.total_amount ?? 0).toFixed(2)}</td>
                    <td>
                      <select className="input" value={o.status} onChange={(e) => updateStatus(o, e.target.value)} disabled={updatingId === o.id} style={{ width: 160 }}>
                        {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                      </select>
                    </td>
                    <td><button className="btn btn-ghost" onClick={() => setExpandedId(expanded ? null : o.id)}>{expanded ? 'Hide' : 'Job card'}</button></td>
                  </tr>
                  {expanded && (
                    <tr>
                      <td colSpan={7} style={{ background: 'color-mix(in srgb, var(--color-text) 3%, transparent)' }}>
                        <div style={{ padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <JobCardChecklist orderId={o.id} />
                          <RepairsSection orderId={o.id} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {orders?.length === 0 && <tr><td colSpan={7} className="text-muted">No optical orders yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}