import {
  BellRing,
  Camera,
  ChevronLeft,
  LayoutDashboard,
  Menu,
  Radio,
  ScanLine,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useUiStore } from '../store/ui.store';
import { Button } from './ui';

const navigation = [
  { to: '/', label: 'Ringkasan', icon: LayoutDashboard, end: true },
  { to: '/monitoring', label: 'Live monitoring', icon: Radio },
  { to: '/cameras', label: 'Kamera & zona', icon: Camera },
  { to: '/events', label: 'Kejadian', icon: ScanLine },
  { to: '/telegram', label: 'Telegram', icon: BellRing },
];

export function AppShell() {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const setCollapsed = useUiStore((state) => state.setSidebarCollapsed);

  return (
    <div className={`app-shell ${collapsed ? 'app-shell--collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__mark">
            <ScanLine size={19} />
          </span>
          {!collapsed && (
            <div>
              <strong>Sentinel</strong>
              <small>Zone intelligence</small>
            </div>
          )}
        </div>
        <nav className="nav-list" aria-label="Navigasi utama">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}
              title={collapsed ? label : undefined}
            >
              <Icon size={19} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__footer">
          {!collapsed && (
            <div className="system-note">
              <span className="status-dot status-dot--green" />
              Platform tersedia
            </div>
          )}
          <Button
            variant="ghost"
            onClick={() => setCollapsed(!collapsed)}
            aria-label="Ubah ukuran sidebar"
          >
            {collapsed ? (
              <Menu size={19} />
            ) : (
              <>
                <ChevronLeft size={18} /> Ringkas
              </>
            )}
          </Button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
