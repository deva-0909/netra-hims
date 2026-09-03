import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

/** Self-service TOTP MFA enrollment — entirely client-SDK driven, no
 * schema of our own (Supabase Auth owns auth.mfa_factors). Deliberately
 * optional/self-service rather than enforced: this app's DEMO_MODE
 * auto-signs every visitor into one shared demo account, and forcing
 * AAL2 on that account would lock the public demo out of itself. A real
 * deployment with DEMO_MODE off can still require it per-account by
 * enrolling here. */
export function SecuritySettingsPage() {
  const qc = useQueryClient();
  const [enrolling, setEnrolling] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: factors, isLoading } = useQuery({
    queryKey: ['mfa-factors'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data.totp;
    },
  });

  const startEnroll = async () => {
    setError(null);
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (enrollError) { setError(enrollError.message); return; }
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setEnrolling(true);
  };

  const cancelEnroll = async () => {
    if (factorId) await supabase.auth.mfa.unenroll({ factorId });
    setEnrolling(false); setFactorId(null); setQrCode(null); setSecret(null); setCode('');
  };

  const confirmEnroll = async () => {
    if (!factorId || !code.trim()) return;
    setSaving(true);
    setError(null);
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) { setSaving(false); setError(challengeError.message); return; }
    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: code.trim() });
    setSaving(false);
    if (verifyError) { setError(verifyError.message); return; }
    setEnrolling(false); setFactorId(null); setQrCode(null); setSecret(null); setCode('');
    qc.invalidateQueries({ queryKey: ['mfa-factors'] });
  };

  const removeFactor = async (id: string) => {
    setError(null);
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (unenrollError) { setError(unenrollError.message); return; }
    qc.invalidateQueries({ queryKey: ['mfa-factors'] });
  };

  return (
    <div style={{ maxWidth: 520 }}>
      <h2>Security Settings</h2>
      <p className="text-muted" style={{ fontSize: 13, marginTop: -8 }}>
        Add an authenticator app (Google Authenticator, Authy, 1Password, etc.) as a second factor for your account.
      </p>

      {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}

      <div className="card blueprint elev-sm" style={{ padding: 'var(--space-4)' }}>
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        <h4 style={{ marginTop: 0 }}>Two-factor authentication</h4>

        {isLoading ? <p className="text-muted">Loading…</p> : (
          <>
            {factors && factors.length > 0 && (
              <div style={{ marginBottom: 'var(--space-3)' }}>
                {factors.map((f: any) => (
                  <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--color-divider)' }}>
                    <span style={{ fontSize: 13 }}>Authenticator app <span className="text-muted">— added {new Date(f.created_at).toLocaleDateString()}</span></span>
                    <button className="btn btn-ghost" onClick={() => removeFactor(f.id)}>Remove</button>
                  </div>
                ))}
              </div>
            )}

            {enrolling ? (
              <div>
                <p style={{ fontSize: 13 }}>Scan this QR code with your authenticator app, then enter the 6-digit code it shows.</p>
                {qrCode && <img src={qrCode} alt="MFA QR code" style={{ width: 180, height: 180, display: 'block', margin: '0 auto 8px' }} />}
                {secret && <p className="text-muted" style={{ fontSize: 11, textAlign: 'center', wordBreak: 'break-all' }}>Can't scan? Enter manually: {secret}</p>}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input className="input" style={{ flex: '1 1 140px' }} value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" maxLength={6} />
                  <button className="btn btn-primary" onClick={confirmEnroll} disabled={saving}>{saving ? 'Verifying…' : 'Confirm'}</button>
                  <button className="btn btn-ghost" onClick={cancelEnroll}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="btn btn-primary" onClick={startEnroll}>+ Add authenticator app</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
