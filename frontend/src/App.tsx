import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from './components/Sidebar';
import PageShell from './components/PageShell';
import { EUR_RATE, EXCHANGE_RATE, AUTH_STORAGE_KEY, AUTH_TOKEN_KEY, formatMoney } from './lib/api';
import {
  getCategoryForPage,
  menuCategories,
  pageShellConfigs,
  type MenuCategoryId,
  type PageId,
} from './lib/navigation';
import Dashboard from './pages/Dashboard';
import SalesCreate from './pages/SalesCreate';
import Invoices from './pages/Invoices';
import StockList from './pages/StockList';
import BarcodePrint from './pages/BarcodePrint';
import CustomerList from './pages/CustomerList';
import CustomerPayment from './pages/CustomerPayment';
import CustomerBalances from './pages/CustomerBalances';
import ProfitReport from './pages/ProfitReport';
import Reports from './pages/Reports';
import WarehouseList from './pages/WarehouseList';
import CategoryManager from './pages/CategoryManager';
import SafeManager from './pages/SafeManager';
import PersonnelManager from './pages/PersonnelManager';
import ProductCreate from './pages/ProductCreate';
import SalesReturn from './pages/SalesReturn';
import Login from './pages/Login';

const initialOpenMenus = menuCategories.reduce(
  (acc, cat) => {
    acc[cat.id] = false;
    return acc;
  },
  {} as Record<MenuCategoryId, boolean>
);

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => localStorage.getItem(AUTH_STORAGE_KEY) === 'true'
  );
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [openMenus, setOpenMenus] =
    useState<Record<MenuCategoryId, boolean>>(initialOpenMenus);
  const [f2Trigger, setF2Trigger] = useState(0);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [usdInput, setUsdInput] = useState('');
  const [eurInput, setEurInput] = useState('');

  const usdTlAmount = useMemo(() => {
    const trimmed = usdInput.trim();
    if (!trimmed) return null;
    const value = Number(trimmed.replace(',', '.'));
    if (!Number.isFinite(value)) return null;
    return value * EXCHANGE_RATE;
  }, [usdInput]);

  const eurTlAmount = useMemo(() => {
    const trimmed = eurInput.trim();
    if (!trimmed) return null;
    const value = Number(trimmed.replace(',', '.'));
    if (!Number.isFinite(value)) return null;
    return value * EUR_RATE;
  }, [eurInput]);

  const showNotification = useCallback(
    (type: 'success' | 'error', message: string) => {
      setNotification({ type, message });
      setTimeout(() => setNotification(null), 4000);
    },
    []
  );

  const navigateTo = useCallback((page: PageId) => {
    setActivePage(page);
    const category = getCategoryForPage(page);
    if (category) {
      setOpenMenus((prev) => ({ ...prev, [category]: true }));
    }
  }, []);

  const toggleMenu = useCallback((id: MenuCategoryId) => {
    setOpenMenus((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleLoginSuccess = useCallback(() => {
    localStorage.setItem(AUTH_STORAGE_KEY, 'true');
    setIsLoggedIn(true);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setIsLoggedIn(false);
    setActivePage('dashboard');
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;

    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F2') {
        event.preventDefault();
        setActivePage('sales');
        setOpenMenus((prev) => ({ ...prev, sales: true }));
        setF2Trigger((prev) => prev + 1);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isLoggedIn]);

  const handleDataChange = useCallback(() => {
    setDashboardRefreshKey((prev) => prev + 1);
  }, []);

  const pageContent = useMemo(() => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard refreshKey={dashboardRefreshKey} onNavigate={navigateTo} />;
      case 'sales':
        return (
          <SalesCreate
            f2Trigger={f2Trigger}
            onNotify={showNotification}
            onDataChange={handleDataChange}
          />
        );
      case 'sales-return':
        return (
          <SalesReturn
            onNotify={showNotification}
            onDataChange={handleDataChange}
          />
        );
      case 'product-create':
        return <ProductCreate onNotify={showNotification} />;
      case 'sales-list':
        return (
          <Invoices
            initialFilter="SATIS"
            title="Satış Listesi"
            description="Tamamlanan satış faturaları"
          />
        );
      case 'purchase-list':
        return (
          <Invoices
            initialFilter="ALIS"
            title="Alış Listesi"
            description="Tedarikçi alış faturaları"
          />
        );
      case 'invoices':
        return <Invoices />;
      case 'stock-list':
        return <StockList />;
      case 'barcode-label':
        return <BarcodePrint />;
      case 'customer-list':
        return <CustomerList />;
      case 'customer-payments':
        return (
          <CustomerPayment
            onNotify={showNotification}
            onDataChange={handleDataChange}
          />
        );
      case 'customer-balance':
        return <CustomerBalances />;
      case 'report-sales':
        return <ProfitReport />;
      case 'reports':
        return <Reports />;
      case 'warehouse-list':
        return <WarehouseList />;
      case 'def-products':
        return <CategoryManager />;
      case 'def-safes':
        return <SafeManager />;
      case 'def-users':
        return <PersonnelManager />;
      default: {
        const config =
          pageShellConfigs[activePage as keyof typeof pageShellConfigs];
        return config ? <PageShell {...config} /> : null;
      }
    }
  }, [activePage, f2Trigger, showNotification, dashboardRefreshKey, handleDataChange, navigateTo]);

  if (!isLoggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex">
      {notification && (
        <div
          className={`fixed top-4 right-4 z-[60] px-5 py-3 rounded-lg shadow-lg text-white font-medium ${
            notification.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {notification.message}
        </div>
      )}

      <Sidebar
        activePage={activePage}
        openMenus={openMenus}
        onToggleMenu={toggleMenu}
        onNavigate={navigateTo}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              {new Intl.DateTimeFormat('tr-TR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }).format(new Date())}
            </p>
            <div className="flex items-end gap-3">
              <div className="flex items-end gap-2">
                <div className="flex flex-col items-center min-w-[72px]">
                  <div className="relative w-full">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-emerald-600">
                      $
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={usdInput}
                      onChange={(e) => setUsdInput(e.target.value)}
                      placeholder="..."
                      aria-label="Dolar çevirici"
                      className="w-full pl-6 pr-2 py-1.5 text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-lg shadow-sm focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none"
                    />
                  </div>
                  {usdTlAmount != null && (
                    <span className="text-[10px] text-slate-400 mt-1 leading-none whitespace-nowrap">
                      {formatMoney(usdTlAmount)}
                    </span>
                  )}
                </div>

                <div className="flex flex-col items-center min-w-[72px]">
                  <div className="relative w-full">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-600">
                      €
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={eurInput}
                      onChange={(e) => setEurInput(e.target.value)}
                      placeholder="..."
                      aria-label="Euro çevirici"
                      className="w-full pl-6 pr-2 py-1.5 text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-lg shadow-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
                    />
                  </div>
                  {eurTlAmount != null && (
                    <span className="text-[10px] text-slate-400 mt-1 leading-none whitespace-nowrap">
                      {formatMoney(eurTlAmount)}
                    </span>
                  )}
                </div>
              </div>

              <div className="h-10 w-px bg-slate-200 hidden sm:block" />

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-center">
                <span className="text-xs text-emerald-600 block font-medium">
                  USD
                </span>
                <span className="font-bold text-emerald-700">
                  {EXCHANGE_RATE.toFixed(4)} TL
                </span>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-center">
                <span className="text-xs text-blue-600 block font-medium">
                  EUR
                </span>
                <span className="font-bold text-blue-700">
                  {EUR_RATE.toFixed(4)} TL
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">{pageContent}</main>
      </div>
    </div>
  );
}

export default App;
