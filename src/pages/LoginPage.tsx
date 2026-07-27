import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password, fullName, role);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      navigate('/');
    }
  };

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
      </form>
    </div>
  );
}
