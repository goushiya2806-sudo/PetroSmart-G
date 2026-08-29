// frontend/src/pages/Dashboard.jsx
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the dropdown when clicking outside it
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const displayName = user?.full_name || 'User';
  const displayRole = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1) + ' Account'
    : 'Account';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="bg-background text-on-background font-body-md h-screen flex overflow-hidden">
      {/* SideNavBar */}
      <aside className="bg-surface dark:bg-inverse-surface w-[260px] h-screen fixed left-0 top-0 border-r border-outline-variant dark:border-outline flex flex-col h-full py-6 z-20">
        <div className="px-6 mb-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center text-on-secondary shrink-0">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>local_gas_station</span>
          </div>
          <div>
            <h1 className="font-headline-md text-headline-md font-bold text-on-surface dark:text-inverse-on-surface leading-none">PetroSmart</h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider mt-1 text-[10px]">MANAGEMENT HUB</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <a className="flex items-center gap-3 bg-secondary-container text-on-secondary-container rounded-lg px-4 py-3 border-l-4 border-secondary hover:bg-surface-container-low dark:hover:bg-surface-container-highest transition-colors scale-[0.98] transition-transform duration-200" href="#">
            <span className="material-symbols-outlined">dashboard</span>
            <span className="font-label-md text-label-md">Dashboard</span>
          </a>
          <a className="flex items-center gap-3 text-on-surface-variant hover:text-on-surface px-4 py-3 hover:bg-surface-container-low dark:hover:bg-surface-container-highest transition-colors" href="#">
            <span className="material-symbols-outlined">shopping_cart</span>
            <span className="font-label-md text-label-md">Purchases</span>
          </a>
          <a className="flex items-center gap-3 text-on-surface-variant hover:text-on-surface px-4 py-3 hover:bg-surface-container-low dark:hover:bg-surface-container-highest transition-colors" href="#">
            <span className="material-symbols-outlined">inventory_2</span>
            <span className="font-label-md text-label-md">Stocks</span>
          </a>
          <a className="flex items-center gap-3 text-on-surface-variant hover:text-on-surface px-4 py-3 hover:bg-surface-container-low dark:hover:bg-surface-container-highest transition-colors" href="#">
            <span className="material-symbols-outlined">group</span>
            <span className="font-label-md text-label-md">Suppliers</span>
          </a>
          <a className="flex items-center gap-3 text-on-surface-variant hover:text-on-surface px-4 py-3 hover:bg-surface-container-low dark:hover:bg-surface-container-highest transition-colors" href="#">
            <span className="material-symbols-outlined">analytics</span>
            <span className="font-label-md text-label-md">Reports</span>
          </a>
        </nav>

        {/* Footer / User Profile — now dynamic, with working logout dropdown */}
        <div className="px-4 mt-auto relative" ref={menuRef}>
          {menuOpen && (
            <div
              style={{
                position: 'absolute', bottom: '100%', left: 16, right: 16,
                marginBottom: 8, background: '#fff', border: '1px solid #c6c6cd',
                borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', overflow: 'hidden', zIndex: 30,
              }}
            >
              <button
                onClick={handleLogout}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 14px', background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#ba1a1a', textAlign: 'left',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
                Logout
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 text-on-surface-variant px-4 py-3 border-t border-outline-variant pt-4 rounded-lg">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-secondary shrink-0 flex items-center justify-center text-on-secondary font-label-md text-label-md">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-label-md text-label-md truncate text-on-surface">{displayName}</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{displayRole}</p>
            </div>
            <button onClick={() => setMenuOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <span className="material-symbols-outlined text-on-surface-variant">more_vert</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="ml-[260px] flex-1 flex flex-col h-screen relative bg-[#F8FAFC]">
        <header className="bg-surface dark:bg-inverse-surface border-b border-outline-variant dark:border-outline flex justify-between items-center px-8 h-16 w-full shrink-0 z-10 sticky top-0">
          <div className="flex items-center gap-8 flex-1">
            <h2 className="font-headline-md text-headline-md text-on-surface truncate">Dashboard</h2>
            <div className="relative w-96 hidden lg:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
              <input
                className="w-full bg-[#F1F5F9] border-none rounded-lg pl-10 pr-4 py-2 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:ring-2 focus:ring-secondary focus:bg-white transition-all"
                placeholder="Search invoices, suppliers..."
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <button className="p-2 text-on-surface-variant hover:text-secondary hover:bg-surface-container-low rounded-full transition-colors relative">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full"></span>
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="p-2 text-on-surface-variant hover:text-secondary hover:bg-surface-container-low rounded-full transition-colors"
            >
              <span className="material-symbols-outlined">settings</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8 flex items-center justify-center">
          <div className="max-w-md w-full bg-surface-container-lowest rounded-xl border border-outline-variant p-10 flex flex-col items-center text-center shadow-[0_10px_15px_-3px_rgba(15,23,42,0.08)]">
            <div className="w-32 h-32 bg-surface-container-highest rounded-full flex items-center justify-center mb-6 relative">
              <span className="material-symbols-outlined text-[64px] text-secondary absolute z-10" style={{ fontVariationSettings: "'FILL' 1" }}>monitoring</span>
              <div className="absolute inset-0 border-[3px] border-secondary-fixed rounded-full animate-ping opacity-20"></div>
              <div className="absolute -inset-4 border border-secondary-fixed-dim rounded-full"></div>
            </div>
            <h3 className="font-headline-lg text-headline-lg text-on-surface mb-3">Dashboard Coming Soon</h3>
            <p className="font-body-lg text-body-lg text-on-surface-variant mb-8 leading-relaxed">
              We are currently building your analytics view. Check back soon for real-time insights, purchasing trends, and supplier performance metrics.
            </p>
            <button className="bg-secondary text-on-secondary font-label-md text-label-md px-6 py-3 rounded-lg hover:bg-on-secondary-fixed-variant transition-colors flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">refresh</span>
              Refresh Status
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}