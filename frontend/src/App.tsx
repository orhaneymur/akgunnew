import { useCallback, useEffect, useMemo, useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import { AUTH_STORAGE_KEY, AUTH_TOKEN_KEY, formatMoney } from './lib/api';
import { useExchangeRates } from './hooks/useExchangeRates';
import {
  buildPageUrl,
  getCategoryForPage,
  menuCategories,
  parsePageFromUrl,
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
import StockTransfer from './pages/StockTransfer';
import StockMovements from './pages/StockMovements';
import StockValueReport from './pages/StockValueReport';
import CashFlowReport from './pages/CashFlowReport';
import CustomerStatement from './pages/CustomerStatement';
import AnalyticsReport from './pages/AnalyticsReport';
import Login from './pages/Login';

const F2_ENABLED_PAGES: PageId[] = [
  'sales',
  'invoice-purchase',
  'sales-return',
  'customer-payments',
];

const initialOpenMenus = menuCategories.reduce(
  (acc, cat) => {
    acc[cat.id] = false;
    return acc;
  },
  {} as Record<MenuCategoryId, boolean>
);

function App() {
  const initialUrl = parsePageFromUrl();
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => localStorage.getItem(AUTH_STORAGE_KEY) === 'true'
  );
  const [activePage, setActivePage] = useState<PageId>(initialUrl.page);
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>(initialUrl.invoiceFilter);
  const [preOrderOnly, setPreOrderOnly] = useState(initialUrl.preOrderOnly);
  const [openMenus, setOpenMenus] =
    useState<Record<MenuCategoryId, boolean>>(() => {
      const menus = { ...initialOpenMenus };
      const category = getCategoryForPage(initialUrl.page === 'pre-orders' ? 'sales' : initialUrl.page);
      if (category) menus[category] = true;
      return menus;
    });
  const [f2Trigger, setF2Trigger] = useState(0);
  const [embeddedSalesEditorOpen, setEmbeddedSalesEditorOpen] = useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [usdInput, setUsdInput] = useState('');
  const [eurInput, setEurInput] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { rates: exchangeRates } = useExchangeRates();

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
    return value * exchangeRates.usd;
  }, [usdInput, exchangeRates.usd]);

  const eurTlAmount = useMemo(() => {
    const trimmed = eurInput.trim();
    if (!trimmed) return null;
    const value = Number(trimmed.replace(',', '.'));
    if (!Number.isFinite(value)) return null;
    return value * exchangeRates.eur;
  }, [eurInput, exchangeRates.eur]);

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
      setPreOrderOnly(false);
    } else if (page === 'pre-orders') {
      setPreOrderOnly(true);
      setInvoiceFilter('SATIS');
    } else {
      setPreOrderOnly(options?.preOrderOnly ?? false);
    }

    const category = getCategoryForPage(page === 'pre-orders' ? 'sales' : page);
    if (category) {
      setOpenMenus((prev) => ({ ...prev, [category]: true }));
    }

    window.history.replaceState(
      null,
      '',
      buildPageUrl(page, {
        invoiceFilter: options?.invoiceFilter,
        preOrderOnly: page === 'pre-orders' || options?.preOrderOnly,
      })
    );
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
        if (!F2_ENABLED_PAGES.includes(activePage) && !embeddedSalesEditorOpen) {
          showNotification(
            'error',
            'F2 yalnızca Satış, Alış Faturası, Satış İade ve Tahsilat/Ödeme ekranlarında çalışır.'
          );
          return;
        }
        setF2Trigger((prev) => prev + 1);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isLoggedIn, activePage, embeddedSalesEditorOpen, showNotification]);

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
        return (
          <Dashboard
            refreshKey={dashboardRefreshKey}
            f2Trigger={f2Trigger}
            onNavigate={navigateTo}
            onNotify={showNotification}
            onDataChange={handleDataChange}
            onF2ContextActive={setEmbeddedSalesEditorOpen}
          />
        );
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
            f2Trigger={f2Trigger}
            onNotify={showNotification}
            onDataChange={handleDataChange}
          />
        );
      case 'product-create':
        return <ProductCreate onNotify={showNotification} />;
      case 'invoice-purchase':
        return (
          <PurchaseCreate
            f2Trigger={f2Trigger}
            onNotify={showNotification}
            onDataChange={handleDataChange}
          />
        );
      case 'invoices':
        return (
          <Invoices
            key={`${invoiceFilter}-${preOrderOnly}-${dashboardRefreshKey}`}
            refreshKey={dashboardRefreshKey}
            initialFilter={invoiceFilter}
            preOrderOnly={preOrderOnly}
            f2Trigger={f2Trigger}
            title={preOrderOnly ? 'Ön Siparişler' : 'Fatura Listesi'}
            description={
              preOrderOnly
                ? 'Stok düşümü yapılmamış bekleyen satış siparişleri'
                : 'Satış, alış ve iade faturaları — görüntüle ve düzenle'
            }
            onNotify={showNotification}
            onDataChange={handleDataChange}
            onF2ContextActive={setEmbeddedSalesEditorOpen}
          />
        );
      case 'pre-orders':
        return (
          <Invoices
            key={`pre-orders-${dashboardRefreshKey}`}
            refreshKey={dashboardRefreshKey}
            preOrderOnly
            f2Trigger={f2Trigger}
            initialFilter="SATIS"
            title="Ön Siparişler"
            description="Stok düşümü yapılmamış bekleyen satış siparişleri"
            onNotify={showNotification}
            onDataChange={handleDataChange}
            onF2ContextActive={setEmbeddedSalesEditorOpen}
          />
        );
      case 'stock-list':
        return <StockList onNotify={showNotification} />;
      case 'stock-transfer':
        return (
          <StockTransfer
            onNotify={showNotification}
            onDataChange={handleDataChange}
          />
        );
      case 'stock-movements':
        return <StockMovements />;
      case 'barcode-label':
        return <BarcodePrint />;
      case 'customer-list':
        return <CustomerList onNotify={showNotification} />;
      case 'customer-payments':
        return (
          <CustomerPayment
            f2Trigger={f2Trigger}
            onNotify={showNotification}
            onDataChange={handleDataChange}
          />
        );
      case 'customer-balance':
        return <CustomerBalances />;
      case 'report-sales':
        return <ProfitReport />;
      case 'report-analytics':
        return <AnalyticsReport />;
      case 'report-stock-value':
        return <StockValueReport />;
      case 'report-cash-flow':
        return <CashFlowReport />;
      case 'report-customer-statement':
        return <CustomerStatement />;
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
    preOrderOnly,
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
                  <span className="block text-[0.625rem] font-medium text-emerald-600 sm:text-xs">
                    USD
                  </span>
                  <span className="text-xs font-bold text-emerald-700 sm:text-sm">
                    {exchangeRates.usd.toFixed(4)}
                  </span>
                  <span className="block text-[0.5625rem] text-emerald-500/80 truncate max-w-[3.15rem]">
                    {exchangeRates.source}
                  </span>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-center sm:px-4 sm:py-2">
                  <span className="block text-[0.625rem] font-medium text-blue-600 sm:text-xs">
                    EUR
                  </span>
                  <span className="text-xs font-bold text-blue-700 sm:text-sm">
                    {exchangeRates.eur.toFixed(4)}
                  </span>
                </div>
              </div>
            </div>

            <div className="hidden items-end gap-2 sm:flex">
              <div className="flex min-w-[3.15rem] flex-col items-center">
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
                  <span className="mt-1 whitespace-nowrap text-[0.625rem] leading-none text-slate-400">
                    {formatMoney(usdTlAmount)}
                  </span>
                )}
              </div>

              <div className="flex min-w-[3.15rem] flex-col items-center">
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
                  <span className="mt-1 whitespace-nowrap text-[0.625rem] leading-none text-slate-400">
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
