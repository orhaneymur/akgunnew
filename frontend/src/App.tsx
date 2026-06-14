import { useCallback, useEffect, useMemo, useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import { EUR_RATE, EXCHANGE_RATE, AUTH_STORAGE_KEY, AUTH_TOKEN_KEY, formatMoney } from './lib/api';
import {
  getCategoryForPage,
  menuCategories,
  type InvoiceFilter,
  type MenuCategoryId,
  type NavigateFn,
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
import CategoryManager from './pages/CategoryManager';
import SafeManager from './pages/SafeManager';
import PersonnelManager from './pages/PersonnelManager';
import ProductCreate from './pages/ProductCreate';
import SalesReturn from './pages/SalesReturn';
import PurchaseCreate from './pages/PurchaseCreate';
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
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>('ALL');
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const formattedDateLong = useMemo(
    () =>
      new Intl.DateTimeFormat('tr-TR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date()),
    []
  );

  const formattedDateShort = useMemo(
    () =>
      new Intl.DateTimeFormat('tr-TR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date()),
    []
  );

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

  const navigateTo: NavigateFn = useCallback((page, options) => {
    setActivePage(page);
    setMobileNavOpen(false);

    if (page === 'invoices') {
      setInvoiceFilter(options?.invoiceFilter ?? 'ALL');
    }

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
        setMobileNavOpen(false);
        setOpenMenus((prev) => ({ ...prev, sales: true }));
        setF2Trigger((prev) => prev + 1);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isLoggedIn]);

  useEffect(() => {
    if (!mobileNavOpen) {
      document.body.style.overflow = '';
      return;
    }

    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileNavOpen]);

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
      case 'invoice-purchase':
        return (
          <PurchaseCreate
            onNotify={showNotification}
            onDataChange={handleDataChange}
          />
        );
      case 'invoices':
        return (
          <Invoices
            key={invoiceFilter}
            initialFilter={invoiceFilter}
            title="Fatura Listesi"
            description="Satış, alış ve iade faturaları — filtreli görünüm"
          />
        );
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
      case 'def-products':
        return <CategoryManager />;
      case 'def-safes':
        return <SafeManager />;
      case 'def-users':
        return <PersonnelManager />;
      default:
        return null;
    }
  }, [
    activePage,
    f2Trigger,
    showNotification,
    dashboardRefreshKey,
    handleDataChange,
    navigateTo,
    invoiceFilter,
  ]);

  if (!isLoggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex min-h-[100dvh] overflow-x-hidden bg-slate-100 text-slate-900">
      {notification && (
        <div
          className={`fixed z-[60] px-4 py-3 text-sm font-medium text-white shadow-lg sm:text-base ${
            notification.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          } bottom-4 left-4 right-4 rounded-lg sm:bottom-auto sm:left-auto sm:right-4 sm:top-4 sm:max-w-md`}
        >
          {notification.message}
        </div>
      )}

      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-[2px] lg:hidden"
          aria-label="Menüyü kapat"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <Sidebar
        activePage={activePage}
        openMenus={openMenus}
        mobileOpen={mobileNavOpen}
        onToggleMenu={toggleMenu}
        onNavigate={navigateTo}
        onLogout={handleLogout}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 px-3 py-2.5 sm:px-6 sm:py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(true)}
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
                  aria-label="Menüyü aç"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <p className="truncate text-xs text-slate-500 sm:hidden">
                  {formattedDateShort}
                </p>
                <p className="hidden truncate text-sm text-slate-500 sm:block">
                  {formattedDateLong}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-center sm:px-4 sm:py-2">
                  <span className="block text-[10px] font-medium text-emerald-600 sm:text-xs">
                    USD
                  </span>
                  <span className="text-xs font-bold text-emerald-700 sm:text-sm">
                    {EXCHANGE_RATE.toFixed(2)}
                  </span>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-center sm:px-4 sm:py-2">
                  <span className="block text-[10px] font-medium text-blue-600 sm:text-xs">
                    EUR
                  </span>
                  <span className="text-xs font-bold text-blue-700 sm:text-sm">
                    {EUR_RATE.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="hidden items-end gap-2 sm:flex">
              <div className="flex min-w-[72px] flex-col items-center">
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
                    className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-6 pr-2 text-sm font-medium text-slate-800 shadow-sm outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                  />
                </div>
                {usdTlAmount != null && (
                  <span className="mt-1 whitespace-nowrap text-[10px] leading-none text-slate-400">
                    {formatMoney(usdTlAmount)}
                  </span>
                )}
              </div>

              <div className="flex min-w-[72px] flex-col items-center">
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
                    className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-6 pr-2 text-sm font-medium text-slate-800 shadow-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                {eurTlAmount != null && (
                  <span className="mt-1 whitespace-nowrap text-[10px] leading-none text-slate-400">
                    {formatMoney(eurTlAmount)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden p-3 sm:p-4 lg:p-6">{pageContent}</main>
      </div>
    </div>
  );
}

export default App;
