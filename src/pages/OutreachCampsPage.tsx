import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { sanitizeSearchTerm } from '../lib/sanitizeSearchTerm';
import { printOutreachReferralSlip } from '../lib/printOutreachReferralSlip';

function NewCampForm({ onDone, editing }: { onDone: () => void; editing?: any }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState(editing
    ? { camp_name: editing.camp_name ?? '', location: editing.location ?? '', camp_date: editing.camp_date ?? '', organized_by: editing.organized_by ?? '', notes: editing.notes ?? '' }
    : { camp_name: '', location: '', camp_date: '', organized_by: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.camp_name.trim()) return;
    setSaving(true);
    setError(null);
    const { error: saveError } = editing
      ? await supabase.from('outreach_camps').update(form).eq('id', editing.id)
      : await supabase.from('outreach_camps').insert({ ...form, created_by: profile?.id });
    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    qc.invalidateQueries({ queryKey: ['outreach-camps'] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      <h4 style={{ marginTop: 0 }}>{editing ? 'Edit camp' : 'Schedule camp'}</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="field" style={{ flex: '1 1 220px' }}><label>Camp name *</label><input className="input" value={form.camp_name} onChange={(e) => set('camp_name', e.target.value)} required /></div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Location</label><input className="input" value={form.location} onChange={(e) => set('location', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 160px' }}><label>Camp date</label><input className="input" type="date" value={form.camp_date} onChange={(e) => set('camp_date', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 200px' }}><label>Organized by</label><input className="input" value={form.organized_by} onChange={(e) => set('organized_by', e.target.value)} /></div>
        <div className="field" style={{ flex: '1 1 100%' }}><label>Notes</label><textarea className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 13, marginTop: 'var(--space-2)' }}>{error}</div>}
      <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Schedule camp'}</button>
        <button className="btn btn-secondary" type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  );
}

function NewScreeningForm({ campId, onDone }: { campId: string; onDone: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ person_name: '', age: '', gender: '', contact_phone: '', village_or_area: '', screening_findings: '' });
  const [referred, setReferred] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.person_name.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('camp_screenings').insert({
      camp_id: campId,
      person_name: form.person_name,
      age: form.age ? Number(form.age) : null,
      gender: form.gender || null,
      contact_phone: form.contact_phone || null,
      village_or_area: form.village_or_area || null,
      screening_findings: form.screening_findings || null,
      referred_to_hospital: referred,
      recorded_by: profile?.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    qc.invalidateQueries({ queryKey: ['camp-screenings', campId] });
    setForm({ person_name: '', age: '', gender: '', contact_phone: '', village_or_area: '', screening_findings: '' });
    setReferred(false);
    onDone();
  };

  return (
    <form onSubmit={submit} className="card" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <input className="input" style={{ flex: '1 1 160px' }} placeholder="Name *" value={form.person_name} onChange={(e) => set('person_name', e.target.value)} required />
        <input className="input" style={{ flex: '0 1 80px' }} type="number" placeholder="Age" value={form.age} onChange={(e) => set('age', e.target.value)} />
        <select className="input" style={{ flex: '0 1 120px' }} value={form.gender} onChange={(e) => set('gender', e.target.value)}>
          <option value="">Gender</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
        </select>
        <input className="input" style={{ flex: '1 1 140px' }} placeholder="Phone" value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} />
        <input className="input" style={{ flex: '1 1 160px' }} placeholder="Village / area" value={form.village_or_area} onChange={(e) => set('village_or_area', e.target.value)} />
        <input className="input" style={{ flex: '1 1 100%' }} placeholder="Screening findings" value={form.screening_findings} onChange={(e) => set('screening_findings', e.target.value)} />
        <label className="radio">
          <input type="checkbox" checked={referred} onChange={(e) => setReferred(e.target.checked)} />
          <span className="dot" style={{ borderRadius: 'var(--radius-sm)' }} /> Referred to hospital
        </label>
        <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : '+ Add screening'}</button>
      </div>
      {error && <div style={{ color: '#b64545', fontSize: 12, marginTop: 6 }}>{error}</div>}
    </form>
  );
}

function CampDetail({ camp, onClose }: { camp: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [linkQuery, setLinkQuery] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingCamp, setEditingCamp] = useState(false);
  const debouncedLinkQuery = useDebouncedValue(linkQuery ?? '', 300);

  const { data: screenings } = useQuery({
    queryKey: ['camp-screenings', camp.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('camp_screenings').select('*, patients(full_name, uhid)').eq('camp_id', camp.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: patientMatches } = useQuery({
    queryKey: ['camp-link-patient-search', debouncedLinkQuery],
    enabled: !!linkQuery && debouncedLinkQuery.length > 1,
    queryFn: async () => {
      const term = sanitizeSearchTerm(debouncedLinkQuery);
      const { data, error } = await supabase.from('patients').select('*').or(`full_name.ilike.%${term}%,uhid.ilike.%${term}%`).limit(6);
      if (error) throw error;
      return data;
    },
  });

  const linkPatient = async (screeningId: string, patientId: string) => {
    setError(null);
    const { error: updateError } = await supabase.from('camp_screenings').update({ linked_patient_id: patientId }).eq('id', screeningId);
    if (updateError) { setError(updateError.message); return; }
    setLinkQuery(null);
    qc.invalidateQueries({ queryKey: ['camp-screenings', camp.id] });
  };

  return (
    <div className="card blueprint elev-md" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
      <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
      {editingCamp ? (
        <NewCampForm editing={camp} onDone={() => setEditingCamp(false)} />
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h4 style={{ margin: 0 }}>{camp.camp_name}</h4>
            <div className="text-muted" style={{ fontSize: 13 }}>{camp.location} · {camp.camp_date ? new Date(camp.camp_date).toLocaleDateString() : '—'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => setEditingCamp(true)}>Edit camp</button>
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      )}

      <NewScreeningForm campId={camp.id} onDone={() => {}} />
      {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 8 }}>{error}</div>}

      <table className="table">
        <thead><tr><th>Name</th><th>Age/Gender</th><th>Village</th><th>Findings</th><th>Referred</th><th>Linked Patient</th><th /></tr></thead>
        <tbody>
          {screenings?.map((s: any) => (
            <tr key={s.id}>
              <td>{s.person_name}</td>
              <td>{s.age ?? '—'} / {s.gender ?? '—'}</td>
              <td>{s.village_or_area ?? '—'}</td>
              <td className="text-muted">{s.screening_findings ?? '—'}</td>
              <td>{s.referred_to_hospital ? <span className="tag tag-accent">Yes</span> : <span className="text-muted">No</span>}</td>
              <td>
                {s.referred_to_hospital && (
                  <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 12 }} onClick={() => printOutreachReferralSlip(s, camp.camp_name)}>Print referral</button>
                )}
              </td>
              <td>
                {s.patients ? (
                  <span className="tag tag-outline">{s.patients.full_name} ({s.patients.uhid})</span>
                ) : linkQuery !== null && linkQuery === s.id ? (
                  <div style={{ position: 'relative' }}>
                    <input className="input" style={{ width: 160 }} placeholder="Search patient…" autoFocus
                      onChange={(e) => setLinkQuery(e.target.value || s.id)} />
                    {patientMatches && patientMatches.length > 0 && (
                      <div className="card elev-md" style={{ position: 'absolute', zIndex: 10, width: 220, maxHeight: 160, overflowY: 'auto', padding: 4 }}>
                        {patientMatches.map((p: any) => (
                          <div key={p.id} style={{ padding: 6, cursor: 'pointer', fontSize: 12 }} onClick={() => linkPatient(s.id, p.id)}>{p.full_name} — {p.uhid}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <button className="btn btn-ghost" onClick={() => setLinkQuery(s.id)}>Link to patient</button>
                )}
              </td>
            </tr>
          ))}
          {screenings?.length === 0 && <tr><td colSpan={7} className="text-muted">No screenings logged for this camp yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function OutreachCampsPage() {
  const [showForm, setShowForm] = useState(false);
  const [openCampId, setOpenCampId] = useState<string | null>(null);

  const { data: camps, isLoading } = useQuery({
    queryKey: ['outreach-camps'],
    queryFn: async () => {
      const { data, error } = await supabase.from('outreach_camps').select('*, camp_screenings(id, referred_to_hospital)').order('camp_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const openCamp = camps?.find((c: any) => c.id === openCampId);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ margin: 0 }}>Outreach & Community Camps</h2>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Schedule camp</button>}
      </div>

      {showForm && <NewCampForm onDone={() => setShowForm(false)} />}
      {openCamp && <CampDetail camp={openCamp} onClose={() => setOpenCampId(null)} />}

      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Camp</th><th>Location</th><th>Date</th><th>Status</th><th>Screened</th><th>Referred</th><th></th></tr></thead>
          <tbody>
            {camps?.map((c: any) => (
              <tr key={c.id}>
                <td>{c.camp_name}</td>
                <td>{c.location ?? '—'}</td>
                <td>{c.camp_date ? new Date(c.camp_date).toLocaleDateString() : '—'}</td>
                <td><span className="tag tag-neutral">{c.status}</span></td>
                <td>{c.camp_screenings?.length ?? 0}</td>
                <td>{c.camp_screenings?.filter((s: any) => s.referred_to_hospital).length ?? 0}</td>
                <td><button className="btn btn-ghost" onClick={() => setOpenCampId(c.id)}>Open</button></td>
              </tr>
            ))}
            {camps?.length === 0 && <tr><td colSpan={7} className="text-muted">No camps scheduled yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
