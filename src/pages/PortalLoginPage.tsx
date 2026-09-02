import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { portalSupabase } from '../lib/portalSupabaseClient';

export function PortalLoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState('');
  const [uhid, setUhid] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    if (uhid.trim()) {
      const { data, error: checkError } = await portalSupabase.functions.invoke('portal-claim', { body: { mode: 'check', uhid: uhid.trim(), email: email.trim() } });
      if (checkError || !data?.ok) {
        setLoading(false);
        setError(data?.error ?? checkError?.message ?? 'Could not verify your details.');
        return;
      }
    }

    const { error: otpError } = await portalSupabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setLoading(false);
    if (otpError) { setError(otpError.message); return; }
    setStep('verify');
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    const { data, error: verifyError } = await portalSupabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    if (verifyError || !data.session) {
      setLoading(false);
      setError(verifyError?.message ?? 'Invalid or expired code.');
      return;
    }

    if (uhid.trim()) {
      const { data: linkData, error: linkError } = await portalSupabase.functions.invoke('portal-claim', {
        body: { mode: 'link', uhid: uhid.trim() },
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      if (linkError || !linkData?.ok) {
        setLoading(false);
        setError(linkData?.error ?? linkError?.message ?? 'Signed in, but could not link your patient record — contact the hospital.');
        return;
      }
    }

    setLoading(false);
    navigate('/portal');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--color-bg)', padding: 'var(--space-4)' }}>
      <form onSubmit={step === 'request' ? requestCode : verifyCode} className="card blueprint elev-md" style={{ width: 'min(380px, 100%)', padding: 'var(--space-6)' }}>
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 24, marginBottom: 2 }}>NETRA HIMS</div>
        <div className="text-muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-4)' }}>
          Patient Portal
        </div>

        {step === 'request' ? (
          <>
            <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
              <label htmlFor="email">Email</label>
              <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
              <label htmlFor="uhid">UHID <span className="text-muted">(first time only)</span></label>
              <input id="uhid" className="input" value={uhid} onChange={(e) => setUhid(e.target.value)} placeholder="e.g. NH-0001 — leave blank if you've signed in before" />
            </div>
            {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}
            <button className="btn btn-primary btn-block" type="submit" disabled={loading}>{loading ? 'Sending…' : 'Send code'}</button>
          </>
        ) : (
          <>
            <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>We sent a 6-digit code to {email}.</p>
            <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
              <label htmlFor="code">Code</label>
              <input id="code" className="input" value={code} onChange={(e) => setCode(e.target.value)} required autoFocus />
            </div>
            {error && <div style={{ color: '#b64545', fontSize: 13, marginBottom: 'var(--space-3)' }}>{error}</div>}
            <button className="btn btn-primary btn-block" type="submit" disabled={loading}>{loading ? 'Verifying…' : 'Verify & sign in'}</button>
            <button className="btn btn-ghost btn-block" type="button" style={{ marginTop: 8 }} onClick={() => setStep('request')}>Use a different email</button>
          </>
        )}

        <p className="text-muted" style={{ fontSize: 12, marginTop: 'var(--space-4)' }}>
          Hospital staff? <Link to="/login">Sign in here</Link>
        </p>
      </form>
    </div>
  );
}
