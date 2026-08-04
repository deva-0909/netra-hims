import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const CLINICS = [
  { value: 'general', label: 'General Eye Checkup' },
  { value: 'retina', label: 'Retina Clinic' },
  { value: 'glaucoma', label: 'Glaucoma Clinic' },
  { value: 'lasik', label: 'LASIK / Refractive Surgery' },
  { value: 'pediatric', label: 'Pediatric Eye Care' },
];

export function RequestAppointmentPage() {
  const [form, setForm] = useState({ full_name: '', phone: '', preferred_clinic_module: 'general', preferred_date: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.phone.trim()) return;
    setSaving(true);
    setError(null);
    // Deliberately not chaining .select() here: an unauthenticated visitor
    // has no read access to this table (by design — see 0036 migration), and
    // reading the row back after insert would fail Postgres's RETURNING
    // visibility check even though the insert itself succeeds.
    const { error: insertError } = await supabase.from('appointment_requests').insert({
      full_name: form.full_name, phone: form.phone, preferred_clinic_module: form.preferred_clinic_module,
      preferred_date: form.preferred_date || null, reason: form.reason || null,
    });
    setSaving(false);
    if (insertError) { setError("Something went wrong — please call the hospital directly instead."); return; }
    setDone(true);
  };

  if (done) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--color-bg)', padding: 'var(--space-4)' }}>
        <div className="card blueprint elev-md" style={{ width: 'min(420px, 100%)', padding: 'var(--space-6)', textAlign: 'center' }}>
          <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 20, marginBottom: 8 }}>Request received</div>
          <p className="text-muted">Thank you, {form.full_name.split(' ')[0]}. Our front desk will call you at {form.phone} to confirm your appointment.</p>
          <Link className="btn btn-secondary" style={{ marginTop: 12, display: 'inline-block' }} to="/">Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--color-bg)', padding: 'var(--space-4)' }}>
      <form onSubmit={submit} className="card blueprint elev-md" style={{ width: 'min(440px, 100%)', padding: 'var(--space-6)' }}>
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 24, marginBottom: 2 }}>NETRA HIMS</div>
        <div className="text-muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-4)' }}>
          Request an Appointment
        </div>
        <p className="text-muted" style={{ fontSize: 13, marginTop: -8, marginBottom: 'var(--space-4)' }}>
          Tell us a bit about your visit and our front desk will call you back to confirm.
        </p>

        <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
          <label htmlFor="full_name">Your name *</label>
          <input id="full_name" className="input" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} required />
        </div>
        <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
          <label htmlFor="phone">Phone number *</label>
          <input id="phone" className="input" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} required />
        </div>
        <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
          <label htmlFor="clinic">What do you need?</label>
          <select id="clinic" className="input" value={form.preferred_clinic_module} onChange={(e) => set('preferred_clinic_module', e.target.value)}>
            {CLINICS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
          <label htmlFor="preferred_date">Preferred date</label>
          <input id="preferred_date" className="input" type="date" value={form.preferred_date} onChange={(e) => set('preferred_date', e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
          <label htmlFor="reason">Anything we should know?</label>
          <textarea id="reason" className="input" value={form.reason} onChange={(e) => set('reason', e.target.value)} placeholder="Optional" />
        </div>

        {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}

        <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
          {saving ? 'Sending…' : 'Request appointment'}
        </button>

        <p className="text-muted" style={{ fontSize: 11, marginTop: 'var(--space-3)' }}>
          For staff sign-in, go to <Link to="/login">the staff login</Link>.
        </p>
      </form>
    </div>
  );
}
