import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  FileInput,
  FileOutput,
  PlusCircle,
  RotateCcw,
  ShoppingCart,
  Wallet,
} from 'lucide-react';
import {
  API_BASE,
  ensureArray,
  formatDate,
  formatMoney,
  invoiceTypeLabel,
  invoiceTypeStyles,
} from '../lib/api';
import type { NavigateFn } from '../lib/navigation';
import SalesCreate from './SalesCreate';

type SafeBalance = {
  id: number;
  name: string;
  currency: string;
  balance: number;
  branch: { id: number; name: string };
};

type RecentInvoice = {
  id: number;
  invoiceNo: string;
  type: string;
  isPreOrder?: boolean;
  totalAmountTl: number;
  createdAt: string;
  customer: { code: string; name: string };
};

type DashboardProps = {
  refreshKey?: number;
  f2Trigger?: number;
  onNavigate?: NavigateFn;
  onNotify?: (type: 'success' | 'error', message: string) => void;
  onDataChange?: () => void;
  onF2ContextActive?: (active: boolean) => void;
};

type RecentPayment = {
  id: number;
  type: 'GIRIS' | 'CIKIS';
  amount: number;
  description: string;
  createdAt: string;
  safe: { name: string; currency: string };
};

type DashboardData = {
  safeBalances: SafeBalance[];
  recentInvoices: RecentInvoice[];
  recentPayments: RecentPayment[];
};

export default function Dashboard({
  refreshKey = 0,
  f2Trigger = 0,
  onNavigate,
  onNotify,
  onDataChange,
  onF2ContextActive,
}: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null);

  const notify = useCallback(
    (type: 'success' | 'error', message: string) => onNotify?.(type, message),
    [onNotify]
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<{
        success: boolean;
        data: DashboardData;
      }>(`${API_BASE}/api/sales/dashboard`);
      if (response.data.success) {
        const payload = response.data.data;
        setData({
          safeBalances: ensureArray(payload.safeBalances),
          recentInvoices: ensureArray(payload.recentInvoices).slice(0, 5),
          recentPayments: ensureArray(payload.recentPayments).slice(0, 5),
        });
      }
    } catch {
      setError('Ana sayfa verileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (editingInvoiceId === null) {
      void loadDashboard();
    }
  }, [refreshKey, editingInvoiceId, loadDashboard]);

  const openEditor = useCallback(
    (inv: RecentInvoice) => {
      if (inv.type !== 'SATIS') {
        notify('error', 'Alış ve iade faturaları bu ekrandan düzenlenemez.');
        return;
      }
      setEditingInvoiceId(inv.id);
    },
    [notify]
  );

  const closeEditor = useCallback(() => {
    setEditingInvoiceId(null);
  }, []);

  const handleSaved = useCallback(() => {
    setEditingInvoiceId(null);
    onDataChange?.();
  }, [onDataChange]);

  const quickActions = [
    { id: 'sales' as const, label: 'Satış Yap', icon: ShoppingCart, color: 'bg-emerald-600' },
    { id: 'invoice-purchase' as const, label: 'Alış Yap', icon: FileInput, color: 'bg-rose-600' },
    { id: 'sales-return' as const, label: 'İade Al', icon: RotateCcw, color: 'bg-amber-600' },
    { id: 'product-create' as const, label: 'Stok Kartı', icon: PlusCircle, color: 'bg-indigo-600' },
    {
      id: 'invoices' as const,
      label: 'Faturalar',
      icon: FileOutput,
      color: 'bg-sky-600',
      invoiceFilter: 'ALL' as const,
    },
  ];

  if (loading && editingInvoiceId === null) {
    return (
      <div className="flex h-48 items-center justify-center">
        <p className="text-sm text-slate-400">Yükleniyor...</p>
      </div>
    );
  }

  if (editingInvoiceId !== null) {
    return (
      <SalesCreate
        key={editingInvoiceId}
        editInvoiceId={editingInvoiceId}
        f2Trigger={f2Trigger}
        onNotify={onNotify}
        onDataChange={onDataChange}
        onCancelEdit={closeEditor}
        onSaved={handleSaved}
        onF2ContextActive={onF2ContextActive}
      />
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
        {error ?? 'Veri bulunamadı.'}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="page-title">Ana Sayfa</h1>
        <p className="page-subtitle mt-1">Hızlı işlemler ve son hareketler</p>
      </div>

      {onNavigate && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() =>
                  onNavigate(
                    action.id,
                    'invoiceFilter' in action
                      ? { invoiceFilter: action.invoiceFilter }
                      : undefined
                  )
                }
                className={`flex flex-col items-center gap-1.5 rounded-xl ${action.color} p-3 text-white shadow-md transition hover:opacity-90`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-center text-xs font-semibold leading-tight">
                  {action.label}
                </span>
              </button>
            );
          })}
        </section>
      )}

      <section className="flex gap-3 overflow-x-auto pb-1">
        {data.safeBalances.map((safe) => (
          <div
            key={safe.id}
            className="min-w-[140px] shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <div className="flex items-center gap-1.5 text-slate-500">
              <Wallet className="h-3.5 w-3.5" />
              <span className="truncate text-xs">{safe.name}</span>
            </div>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {formatMoney(safe.balance, safe.currency)}
            </p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Son Faturalar</h2>
          </div>
          <ul className="divide-y divide-slate-50">
            {data.recentInvoices.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50/80"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-caption font-semibold ring-1 ring-inset ${invoiceTypeStyles(inv.type)}`}
                    >
                      {invoiceTypeLabel(inv.type)}
                    </span>
                    {inv.isPreOrder && (
                      <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-caption font-semibold text-amber-800">
                        Ön Sipariş
                      </span>
                    )}
                    {inv.type === 'SATIS' ? (
                      <button
                        type="button"
                        onClick={() => openEditor(inv)}
                        className="truncate text-sm font-medium text-violet-700 hover:text-violet-900 hover:underline"
                      >
                        {inv.invoiceNo}
                      </button>
                    ) : (
                      <span className="truncate text-sm font-medium text-slate-800">
                        {inv.invoiceNo}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-400">
                    {inv.customer.name} · {formatDate(inv.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">
                    {formatMoney(inv.totalAmountTl)}
                  </span>
                  {inv.type === 'SATIS' && (
                    <button
                      type="button"
                      onClick={() => openEditor(inv)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-violet-50 hover:text-violet-600"
                      title="Düzenle"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
            {data.recentInvoices.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-slate-400">Kayıt yok</li>
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Son Kasa Hareketleri</h2>
          </div>
          <ul className="divide-y divide-slate-50">
            {data.recentPayments.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`shrink-0 rounded p-1 ${
                      payment.type === 'GIRIS'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {payment.type === 'GIRIS' ? (
                      <ArrowDownLeft className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-800">{payment.description}</p>
                    <p className="text-xs text-slate-400">
                      {payment.safe.name} · {formatDate(payment.createdAt)}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold ${
                    payment.type === 'GIRIS' ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {payment.type === 'GIRIS' ? '+' : '-'}
                  {formatMoney(payment.amount, payment.safe.currency)}
                </span>
              </li>
            ))}
            {data.recentPayments.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-slate-400">Kayıt yok</li>
            )}
          </ul>
        </section>
      </div>

      {onNavigate && (
        <p className="text-center text-xs text-slate-400">
          Grafikler ve detaylı analiz için{' '}
          <button
            type="button"
            onClick={() => onNavigate('report-analytics')}
            className="font-medium text-indigo-600 hover:underline"
          >
            Raporlar → İşletme Özeti
          </button>
        </p>
      )}
    </div>
  );
}
