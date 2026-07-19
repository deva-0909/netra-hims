import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { MODULES } from '../modules/moduleConfig';

const journeyLinks = Object.values(MODULES).map((m) => ({ to: `/journeys/${m.key}`, label: m.label }));

const supportLinks = [
  { to: '/pharmacy', label: 'Pharmacy' },
  { to: '/optical', label: 'Optical' },
  { to: '/billing', label: 'Billing' },
  { to: '/insurance', label: 'Insurance Desk' },
];

const adminLinks = [{ to: '/admin/staff', label: 'Staff' }];

function NavSection({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <>
      <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-accent-700)', padding: '13.6px 6.8px 4px' }}>
        {title}
      </div>
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          style={({ isActive }) => ({
            display: 'block',
            padding: '8px 6.8px',
            fontSize: 14,
            color: isActive ? 'var(--color-accent-700)' : 'var(--color-text)',
            background: isActive ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'transparent',
            borderRadius: 'var(--radius-md)',
          })}
        >
          {l.label}
        </NavLink>
      ))}
    </>
  );
}

export function Layout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)', overflow: 'hidden' }}>
      <div style={{ width: 236, flex: 'none', borderRight: '1px solid var(--color-divider)', display: 'flex', flexDirection: 'column', padding: '20.4px 13.6px', overflowY: 'auto' }}>
        <div style={{ padding: '0 6.8px 20.4px' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 20, letterSpacing: '-0.01em' }}>NETRA HIMS</div>
          <div style={{ fontSize: 11, color: 'color-mix(in srgb, var(--color-text) 55%, transparent)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>
            360&deg; Eye Hospital
          </div>
        </div>

        <NavLink to="/" style={({ isActive }) => ({ display: 'block', padding: '8px 6.8px', fontSize: 14, fontWeight: 600, color: isActive ? 'var(--color-accent-700)' : 'var(--color-text)' })}>
          Dashboard
        </NavLink>
        <NavLink to="/patients" style={({ isActive }) => ({ display: 'block', padding: '8px 6.8px', fontSize: 14, fontWeight: 600, color: isActive ? 'var(--color-accent-700)' : 'var(--color-text)' })}>
          Patients
        </NavLink>
        <NavLink to="/appointments" style={({ isActive }) => ({ display: 'block', padding: '8px 6.8px', fontSize: 14, fontWeight: 600, color: isActive ? 'var(--color-accent-700)' : 'var(--color-text)' })}>
          Appointments
        </NavLink>

        <NavSection title="Patient Journeys" links={journeyLinks} />
        <NavSection title="Support Modules" links={supportLinks} />
        {profile?.role === 'admin' && <NavSection title="Administration" links={adminLinks} />}

        <div style={{ marginTop: 'auto', paddingTop: '13.6px', borderTop: '1px solid var(--color-divider)' }}>
          <div style={{ fontSize: 12, marginBottom: 6 }}>{profile?.full_name}</div>
          <div style={{ fontSize: 11, color: 'var(--color-accent-700)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            {profile?.role?.replace(/_/g, ' ')}
          </div>
          <button
            className="btn btn-secondary btn-block"
            onClick={async () => {
              await signOut();
              navigate('/login');
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
        <div style={{ padding: 'var(--space-6)' }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
