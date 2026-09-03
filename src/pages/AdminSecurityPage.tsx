import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

/** Rough device/browser label from the user agent string — good enough
 * to tell "phone" from "desktop" at a glance, not a real device
 * fingerprint. */
function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return '—';
  if (/iPhone|iPad/.test(userAgent)) return 'iOS device';
  if (/Android/.test(userAgent)) return 'Android device';
  if (/Macintosh/.test(userAgent)) return 'Mac';
  if (/Windows/.test(userAgent)) return 'Windows PC';
  if (/Linux/.test(userAgent)) return 'Linux';
  return 'Unknown device';
}

function LoginSessionsTab() {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['login-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('login_sessions').select('*, profiles(full_name, role)').order('signed_in_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <p className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Sign-in visibility only — there's no way to remotely revoke a session from here (that needs a service-role admin action, not available client-side). Use it to spot unfamiliar devices or unexpected sign-in times.
      </p>
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>When</th><th>Staff member</th><th>Role</th><th>Device</th></tr></thead>
          <tbody>
            {sessions?.map((s: any) => (
              <tr key={s.id}>
                <td>{new Date(s.signed_in_at).toLocaleString()}</td>
                <td>{s.profiles?.full_name ?? '—'}</td>
                <td className="text-muted">{s.profiles?.role?.replace(/_/g, ' ') ?? '—'}</td>
                <td className="text-muted">{deviceLabel(s.user_agent)}</td>
              </tr>
            ))}
            {sessions?.length === 0 && <tr><td colSpan={4} className="text-muted">No sign-ins logged yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

function EmergencyAccessTab() {
  const { data: entries, isLoading } = useQuery({
    queryKey: ['emergency-access-log'],
    queryFn: async () => {
      const { data, error } = await supabase.from('emergency_access_log').select('*, patients(full_name, uhid), profiles(full_name, role)').order('accessed_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <p className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Every declared emergency access, with the reason given. Patient records are already staff-wide readable in this app, so this isn't a technical access gate — it's the mandatory-justification audit trail NABH expects for emergency access.
      </p>
      {isLoading ? <p className="text-muted">Loading…</p> : (
        <table className="table">
          <thead><tr><th>When</th><th>Staff member</th><th>Patient</th><th>Reason</th></tr></thead>
          <tbody>
            {entries?.map((e: any) => (
              <tr key={e.id}>
                <td>{new Date(e.accessed_at).toLocaleString()}</td>
                <td>{e.profiles?.full_name ?? '—'} <span className="text-muted">({e.profiles?.role?.replace(/_/g, ' ')})</span></td>
                <td><Link to={`/patients/${e.patient_id}`}>{e.patients?.full_name} ({e.patients?.uhid})</Link></td>
                <td style={{ fontSize: 13 }}>{e.reason}</td>
              </tr>
            ))}
            {entries?.length === 0 && <tr><td colSpan={4} className="text-muted">No emergency access declared yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function AdminSecurityPage() {
  const [tab, setTab] = useState<'sessions' | 'emergency'>('sessions');

  return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Security & Sessions</h2>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 'var(--space-4)' }}>Sign-in visibility and the emergency-access audit trail.</p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
        {[{ key: 'sessions', label: 'Login Sessions' }, { key: 'emergency', label: 'Emergency Access Log' }].map((t) => (
          <button key={t.key} className={`btn ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.key as typeof tab)} style={{ borderRadius: 0, borderBottom: tab === t.key ? '2px solid var(--color-accent)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sessions' && <LoginSessionsTab />}
      {tab === 'emergency' && <EmergencyAccessTab />}
    </div>
  );
}
