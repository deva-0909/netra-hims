import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';
import { updateOpticalOrderStatus } from '../../lib/dispenseOpticalOrder';
import { FramePicker } from '../../components/FramePicker';
import { SelectOrOtherInput } from '../../components/SelectOrOtherInput';
import { LENS_COATINGS } from '../commonOptions';
import { advanceVisitStageTo } from '../../lib/advanceVisitStage';
import { printOpticalOrderSlip } from '../../lib/printOpticalOrderSlip';
import type { VisitStage } from '../../lib/types';

const LENS_TYPES = ['single_vision', 'bifocal', 'progressive', 'contact'];
const STATUSES = ['ordered', 'in_fabrication', 'ready', 'dispensed', 'cancelled'];

function genOrderNumber() {
  return `OPT-${Date.now().toString(36).toUpperCase().slice(-8)}`;
}

const emptyForm = {
  frameItemId: null as string | null, frame_brand: '', frame_model: '', frame_price: '',
  lens_type: 'single_vision', lens_coating: '', lens_price: '',
  rx_sphere_od: '', rx_cylinder_od: '', rx_axis_od: '',
  rx_sphere_os: '', rx_cylinder_os: '', rx_axis_os: '',
  eta_date: '',
};

export function OpticalStage({ visitId, patientId, stageOrder }: { visitId: string; patientId: string; stageOrder: VisitStage[] }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const set = (k: keyof typeof emptyForm, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const framePrice = Number(form.frame_price) || 0;
  const lensPrice = Number(form.lens_price) || 0;
  const total = framePrice + lensPrice;

  const { data: orders } = useQuery({
    queryKey: ['optical-orders-for-visit', visitId],
    queryFn: async () => {
      const { data, error } = await supabase.from('optical_orders').select('*').eq('visit_id', visitId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveOrder = async () => {
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('optical_orders').insert({
      visit_id: visitId,
      patient_id: patientId,
      order_number: genOrderNumber(),
      frame_item_id: form.frameItemId,
      frame_brand: form.frame_brand || null,
      frame_model: form.frame_model || null,
      frame_price: framePrice,
      lens_type: form.lens_type,
      lens_coating: form.lens_coating || null,
      lens_price: lensPrice,
      rx_sphere_od: form.rx_sphere_od ? Number(form.rx_sphere_od) : null,
      rx_cylinder_od: form.rx_cylinder_od ? Number(form.rx_cylinder_od) : null,
      rx_axis_od: form.rx_axis_od ? Number(form.rx_axis_od) : null,
      rx_sphere_os: form.rx_sphere_os ? Number(form.rx_sphere_os) : null,
      rx_cylinder_os: form.rx_cylinder_os ? Number(form.rx_cylinder_os) : null,
      rx_axis_os: form.rx_axis_os ? Number(form.rx_axis_os) : null,
      total_amount: total,
      eta_date: form.eta_date || null,
      created_by: profile?.id,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setForm(emptyForm);
    qc.invalidateQueries({ queryKey: ['optical-orders-for-visit', visitId] });
    qc.invalidateQueries({ queryKey: ['optical-orders'] }); // keep the shop-wide queue page fresh too
    await advanceVisitStageTo(visitId, 'optical', stageOrder);
    qc.invalidateQueries({ queryKey: ['visit', visitId] });
  };

  const updateStatus = async (order: any, status: string) => {
    setStatusError(null);
    setUpdatingId(order.id);
    const { error } = await updateOpticalOrderStatus(order.id, status, order.frame_item_id);
    setUpdatingId(null);
    if (error) {
      setStatusError(error);
      return;
    }
    qc.invalidateQueries({ queryKey: ['optical-orders-for-visit', visitId] });
    qc.invalidateQueries({ queryKey: ['optical-orders'] });
    qc.invalidateQueries({ queryKey: ['eyewear-items'] });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <h4 style={{ marginTop: 0 }}>New optical order</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <FramePicker
            category="frame"
            value={{ itemId: form.frameItemId, brand: form.frame_brand, model: form.frame_model }}
            onChange={(v) => setForm((prev) => ({ ...prev, frameItemId: v.itemId, frame_brand: v.brand, frame_model: v.model, frame_price: v.unitPrice != null ? String(v.unitPrice) : prev.frame_price }))}
          />
          <div className="field" style={{ flex: '1 1 140px' }}>
            <label>Frame price (₹)</label>
            <input className="input" type="number" value={form.frame_price} onChange={(e) => set('frame_price', e.target.value)} />
          </div>

          <div className="field" style={{ flex: '1 1 160px' }}>
            <label>Lens type</label>
            <select className="input" value={form.lens_type} onChange={(e) => set('lens_type', e.target.value)}>
              {LENS_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 160px' }}>
            <label>Lens coating</label>
            <SelectOrOtherInput value={form.lens_coating} options={LENS_COATINGS} onChange={(v) => set('lens_coating', v)} />
          </div>
          <div className="field" style={{ flex: '1 1 140px' }}>
            <label>Lens price (₹)</label>
            <input className="input" type="number" value={form.lens_price} onChange={(e) => set('lens_price', e.target.value)} />
          </div>

          <div className="field" style={{ flex: '1 1 110px' }}>
            <label>Rx Sphere OD</label>
            <input className="input" type="number" value={form.rx_sphere_od} onChange={(e) => set('rx_sphere_od', e.target.value)} />
          </div>
          <div className="field" style={{ flex: '1 1 110px' }}>
            <label>Rx Cylinder OD</label>
            <input className="input" type="number" value={form.rx_cylinder_od} onChange={(e) => set('rx_cylinder_od', e.target.value)} />
          </div>
          <div className="field" style={{ flex: '1 1 110px' }}>
            <label>Rx Axis OD</label>
            <input className="input" type="number" value={form.rx_axis_od} onChange={(e) => set('rx_axis_od', e.target.value)} />
          </div>
          <div className="field" style={{ flex: '1 1 110px' }}>
            <label>Rx Sphere OS</label>
            <input className="input" type="number" value={form.rx_sphere_os} onChange={(e) => set('rx_sphere_os', e.target.value)} />
          </div>
          <div className="field" style={{ flex: '1 1 110px' }}>
            <label>Rx Cylinder OS</label>
            <input className="input" type="number" value={form.rx_cylinder_os} onChange={(e) => set('rx_cylinder_os', e.target.value)} />
          </div>
          <div className="field" style={{ flex: '1 1 110px' }}>
            <label>Rx Axis OS</label>
            <input className="input" type="number" value={form.rx_axis_os} onChange={(e) => set('rx_axis_os', e.target.value)} />
          </div>

          <div className="field" style={{ flex: '1 1 160px' }}>
            <label>Estimated ready date</label>
            <input className="input" type="date" value={form.eta_date} onChange={(e) => set('eta_date', e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: 'var(--space-3)', fontFamily: 'var(--font-heading)', fontSize: 20 }}>
          Total: ₹{total.toFixed(2)}
          <span className="text-muted" style={{ fontSize: 12, fontFamily: 'var(--font-body)', marginLeft: 8 }}>
            (frame ₹{framePrice.toFixed(2)} + lens ₹{lensPrice.toFixed(2)}, calculated automatically)
          </span>
        </div>

        <button className="btn btn-primary" style={{ marginTop: 'var(--space-2)' }} onClick={saveOrder} disabled={saving}>
          {saving ? 'Saving…' : 'Place optical order'}
        </button>
        {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      </div>

      <div>
        <h4>Order history</h4>
        {statusError && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-2)' }}>{statusError}</div>}
        {orders?.length ? orders.map((o: any) => (
          <div key={o.id} className="card blueprint elev-sm" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <strong>{o.order_number}</strong> · {o.frame_brand} {o.frame_model} · {o.lens_type?.replace(/_/g, ' ')} · ₹{Number(o.total_amount).toFixed(2)}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select className="input" style={{ width: 150 }} value={o.status} onChange={(e) => updateStatus(o, e.target.value)} disabled={updatingId === o.id}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
                <button className="btn btn-ghost" onClick={() => printOpticalOrderSlip(o)}>Print slip</button>
              </div>
            </div>
          </div>
        )) : <p className="text-muted">No optical orders yet for this visit.</p>}
      </div>
    </div>
  );
}