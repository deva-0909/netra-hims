import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabaseClient';
import type { StaffRole } from '../lib/types';

const ROLES: StaffRole[] = [
  'admin', 'reception', 'optometrist', 'doctor', 'nurse',
  'pharmacist', 'optical', 'billing', 'insurance_desk', 'ot_staff', 'mrd', 'eye_bank',
];

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<StaffRole>('reception');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mfaChallenge, setMfaChallenge] = useState<{ factorId: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password, fullName, role);
    if (result.error) {
      setLoading(false);
      setError(result.error);
      return;
    }
    // signInWithPassword always establishes an AAL1 session even when the
    // account has an enrolled TOTP factor — AAL2 is a separate step we
    // gate on here before letting the user into the app.
    const { data: levels } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setLoading(false);
    if (levels && levels.nextLevel === 'aal2' && levels.currentLevel !== 'aal2') {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const factor = factorsData?.totp?.[0];
      if (factor) { setMfaChallenge({ factorId: factor.id }); return; }
    }
    navigate('/');
  };

  const submitMfaCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallenge || !mfaCode.trim()) return;
    setLoading(true);
    setError(null);
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: mfaChallenge.factorId });
    if (challengeError) { setLoading(false); setError(challengeError.message); return; }
    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: mfaChallenge.factorId, challengeId: challenge.id, code: mfaCode.trim() });
    setLoading(false);
    if (verifyError) { setError(verifyError.message); return; }
    navigate('/');
  };

  if (mfaChallenge) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--color-bg)', padding: 'var(--space-4)' }}>
        <form onSubmit={submitMfaCode} className="card blueprint elev-md" style={{ width: 'min(380px, 100%)', padding: 'var(--space-6)' }}>
          <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 20, marginBottom: 'var(--space-4)' }}>Enter your authenticator code</div>
          <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
            <label htmlFor="mfaCode">6-digit code</label>
            <input id="mfaCode" className="input" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} maxLength={6} autoFocus required />
          </div>
          {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>{loading ? 'Verifying…' : 'Verify'}</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--color-bg)', padding: 'var(--space-4)' }}>
      <form onSubmit={handleSubmit} className="card blueprint elev-md" style={{ width: 'min(380px, 100%)', padding: 'var(--space-6)' }}>
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 24, marginBottom: 2 }}>NETRA HIMS</div>
        <div className="text-muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-4)' }}>
          360&deg; Eye Hospital — Staff Access
        </div>

        <div className="seg" style={{ marginBottom: 'var(--space-4)' }}>
          <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
            <input type="radio" checked={mode === 'signin'} onChange={() => setMode('signin')} />
            Sign in
          </label>
          <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
            <input type="radio" checked={mode === 'signup'} onChange={() => setMode('signup')} />
            Register staff
          </label>
        </div>

        {mode === 'signup' && (
          <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
            <label htmlFor="fullName">Full name</label>
            <input id="fullName" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
        )}

        <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </div>

        {mode === 'signup' && (
          <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
            <label htmlFor="role">Role</label>
            <select id="role" className="input" value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
              {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        )}

        {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}

        <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>

        {mode === 'signup' && (
          <p className="text-muted" style={{ fontSize: 12, marginTop: 'var(--space-3)' }}>
            The first registered account should choose "admin" so it can manage other staff afterwards.
          </p>
        )}

        <p className="text-muted" style={{ fontSize: 12, marginTop: 'var(--space-3)' }}>
          Patient? <Link to="/request-appointment">Request an appointment</Link> — no login needed, or <Link to="/portal/login">sign in to your patient portal</Link>.
        </p>
      </form>
    </div>
  );
}
