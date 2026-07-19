import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth, DEMO_MODE } from '../lib/AuthContext';
import { MODULES } from '../modules/moduleConfig';
import { ROLE_NAV } from '../modules/roleNav';
import { RoleSwitcher } from './RoleSwitcher';

const SUPPORT_META: Record<string, { to: string; label: string }> = {
  pharmacy: { to: '/pharmacy', label: 'Pharmacy' },
  pharmacy_inventory: { to: '/pharmacy/inventory', label: 'Pharmacy Inventory' },
  optical: { to: '/optical', label: 'Optical' },
  optical_inventory: { to: '/optical/inventory', label: 'Optical Inventory' },
  billing: { to: '/billing', label: 'Billing' },
  insurance: { to: '/insurance', label: 'Insurance Desk' },
};

const adminLinks = [
  { to: '/admin/staff', label: 'Staff' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/audit-log', label: 'Audit Log' },
];

function NavSection({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  if (links.length === 0) return null;
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

const topLinkStyle = ({ isActive }: { isActive: boolean }) => ({
  display: 'block',
  padding: '8px 6.8px',
  fontSize: 14,
  fontWeight: 600,
  color: isActive ? 'var(--color-accent-700)' : 'var(--color-text)',
});

export function Layout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  // Fall back to showing nothing extra if role is somehow unrecognized —
  // Dashboard is always available so the app never looks fully empty.
  const nav = (profile && ROLE_NAV[profile.role]) ?? { patients: false, appointments: false, waitingBoard: false, journeys: [], support: [] };

  const journeyLinks = nav.journeys
    .map((key) => MODULES[key])
    .filter(Boolean)
    .map((m) => ({ to: `/journeys/${m.key}`, label: m.label }));

  const supportLinks = nav.support.map((key) => SUPPORT_META[key]).filter(Boolean);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)', overflow: 'hidden' }}>
      <div style={{ width: 236, flex: 'none', borderRight: '1px solid var(--color-divider)', display: 'flex', flexDirection: 'column', padding: '20.4px 13.6px', overflowY: 'auto' }}>
        <div style={{ padding: '0 6.8px 20.4px' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 20, letterSpacing: '-0.01em' }}>NETRA HIMS</div>
          <div style={{ fontSize: 11, color: 'color-mix(in srgb, var(--color-text) 55%, transparent)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>
            360&deg; Eye Hospital
          </div>
        </div>

        <NavLink to="/" style={topLinkStyle}>Dashboard</NavLink>
        {nav.patients && <NavLink to="/patients" style={topLinkStyle}>Patients</NavLink>}
        {nav.appointments && <NavLink to="/appointments" style={topLinkStyle}>Appointments</NavLink>}
        {nav.waitingBoard && <NavLink to="/waiting-room" style={topLinkStyle}>Waiting Room</NavLink>}

        <NavSection title="Patient Journeys" links={journeyLinks} />
        <NavSection title="Support Modules" links={supportLinks} />
        {profile?.role === 'admin' && <NavSection title="Administration" links={adminLinks} />}

        <div style={{ marginTop: 'auto', paddingTop: '13.6px', borderTop: '1px solid var(--color-divider)' }}>
          <div style={{ fontSize: 12, marginBottom: 8 }}>{profile?.full_name}</div>
          <RoleSwitcher />
          {!DEMO_MODE && (
            <button
              className="btn btn-secondary btn-block"
              onClick={async () => {
                await signOut();
                navigate('/login');
              }}
            >
              Sign out
            </button>
          )}
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
