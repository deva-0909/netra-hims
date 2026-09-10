import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--color-bg)', padding: 'var(--space-4)' }}>
      <div className="card blueprint elev-md" style={{ width: 'min(420px, 100%)', padding: 'var(--space-6)', textAlign: 'center' }}>
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 24, marginBottom: 2 }}>404</div>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, marginBottom: 8 }}>Page not found</div>
        <p className="text-muted">The page you're looking for doesn't exist or may have moved.</p>
        <Link className="btn btn-primary" style={{ marginTop: 12, display: 'inline-block' }} to="/">Back to home</Link>
      </div>
    </div>
  );
}
