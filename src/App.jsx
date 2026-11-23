import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Fuel, LayoutDashboard, Receipt, Settings as SettingsIcon, TrendingUp, Wallet } from 'lucide-react';
import { Toasts } from './components/ui.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Earnings from './pages/Earnings.jsx';
import Expenses from './pages/Expenses.jsx';
import Fuel_ from './pages/Fuel.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';

const ROUTES = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, Page: Dashboard },
  { id: 'earnings', label: 'Ganhos', icon: TrendingUp, Page: Earnings },
  { id: 'expenses', label: 'Despesas', icon: Receipt, Page: Expenses },
  { id: 'fuel', label: 'Combustível', icon: Fuel, Page: Fuel_ },
  { id: 'reports', label: 'Relatórios', icon: BarChart3, Page: Reports },
  { id: 'settings', label: 'Ajustes', icon: SettingsIcon, Page: Settings },
];

const fromHash = () => {
  const id = window.location.hash.replace(/^#\/?/, '');
  return ROUTES.some((r) => r.id === id) ? id : 'dashboard';
};

export default function App() {
  const [route, setRoute] = useState(fromHash);

  useEffect(() => {
    const onHash = () => {
      setRoute(fromHash());
      window.scrollTo?.(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((id) => {
    window.location.hash = `#/${id}`;
  }, []);

  const current = ROUTES.find((r) => r.id === route) || ROUTES[0];
  const { Page } = current;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <Wallet size={22} />
          <span>Meu Controle<br />Financeiro</span>
        </div>
        <nav aria-label="Principal">
          {ROUTES.map(({ id, label, icon: Icon }) => (
            <a key={id} href={`#/${id}`} className={`nav-link ${route === id ? 'active' : ''}`} aria-current={route === id ? 'page' : undefined}>
              <Icon size={18} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
      </aside>
      <main className="content" id="main">
        <Page navigate={navigate} />
      </main>
      <nav className="tabbar" aria-label="Principal (celular)">
        {ROUTES.map(({ id, label, icon: Icon }) => (
          <a key={id} href={`#/${id}`} className={`tab ${route === id ? 'active' : ''}`} aria-current={route === id ? 'page' : undefined}>
            <Icon size={20} />
            <span>{label}</span>
          </a>
        ))}
      </nav>
      <Toasts />
    </div>
  );
}
