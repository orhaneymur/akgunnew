import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  ArrowDownLeft,
  ArrowUpRight,
  FileInput,
  FileOutput,
  LayoutDashboard,
  PlusCircle,
  RotateCcw,
  ShoppingCart,
  TrendingUp,
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
  totalAmountTl: number;
  paymentMethod: string;
  createdAt: string;
  customer: { id: number; code: string; name: string };
  user: { id: number; name: string } | null;
};

type RecentPayment = {
  id: number;
  type: 'GIRIS' | 'CIKIS';
  amount: number;
  description: string;
  createdAt: string;
  safe: { id: number; name: string; currency: string };
  customer: { id: number; code: string; name: string } | null;
};

type StaffTurnover = {
  userId: number;
  userName: string;
  daily: number;
  monthly: number;
  yearly: number;
};

type DashboardData = {
  safeBalances: SafeBalance[];
  recentInvoices: RecentInvoice[];
  recentPayments: RecentPayment[];
  staffTurnover: StaffTurnover[];
};

export default function Dashboard({
  refreshKey = 0,
  onNavigate,
}: {
  refreshKey?: number;
  onNavigate?: NavigateFn;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
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
            recentInvoices: ensureArray(payload.recentInvoices),
            recentPayments: ensureArray(payload.recentPayments),
            staffTurnover: ensureArray(payload.staffTurnover),
          });
        }
      } catch {
        setError('Dashboard verileri yüklenemedi.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400 text-sm">Yükleniyor...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-5 py-4 text-sm">
        {error ?? 'Veri bulunamadı.'}
      </div>
    );
  }

  const totalStaffMonthly = data.staffTurnover.reduce(
    (sum, s) => sum + s.monthly,
    0
  );

  const quickActions = [
    {
      id: 'sales' as const,
      label: 'Satış Yap',
      description: 'F2 hızlı satış ekranı',
      icon: ShoppingCart,
      gradient: 'from-emerald-500 to-teal-600',
    },
    {
      id: 'invoice-purchase' as const,
      label: 'Alış Yap',
      description: 'Tedarikçi alış faturası',
      icon: FileInput,
      gradient: 'from-rose-500 to-red-600',
    },
    {
      id: 'sales-return' as const,
      label: 'İade Al',
      description: 'Arızalı / sağlam iade',
      icon: RotateCcw,
      gradient: 'from-amber-500 to-orange-600',
    },
    {
      id: 'product-create' as const,
      label: 'Stok Kartı',
      description: 'Maliyet ve fiyat tanımı',
      icon: PlusCircle,
      gradient: 'from-indigo-500 to-violet-600',
    },
    {
      id: 'invoices' as const,
      label: 'Fatura Listesi',
      description: 'Satış / alış / iade',
      icon: FileOutput,
      gradient: 'from-sky-500 to-blue-600',
      invoiceFilter: 'ALL' as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-indigo-600 text-white">
          <LayoutDashboard className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Ana Sayfa</h1>
          <p className="text-sm text-slate-500">Günlük özet ve son hareketler</p>
        </div>
      </div>

      {onNavigate && (
        <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
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
                className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${action.gradient} p-4 sm:p-5 text-left text-white shadow-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-xl min-h-[100px] sm:min-h-[120px] flex flex-col justify-between`}
              >
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <Icon className="w-7 h-7 opacity-90 group-hover:scale-110 transition-transform" />
                <div>
                  <p className="font-bold text-sm leading-tight">{action.label}</p>
                  <p className="text-[11px] text-white/75 mt-1 leading-snug">
                    {action.description}
                  </p>
                </div>
              </button>
            );
          })}
        </section>
      )}

      {/* Özet Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {data.safeBalances.map((safe) => (
          <div
            key={safe.id}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {safe.branch.name}
                </p>
                <h3 className="text-base font-semibold text-slate-800 mt-1">
                  {safe.name}
                </h3>
              </div>
              <div
                className={`p-2 rounded-lg ${
                  safe.currency === 'USD'
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-indigo-50 text-indigo-600'
                }`}
              >
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-4">
              {formatMoney(safe.balance, safe.currency)}
            </p>
          </div>
        ))}

        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl shadow-lg p-5 text-white sm:col-span-2 xl:col-span-1">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-indigo-200 uppercase tracking-wide">
                Personel Ciroları
              </p>
              <h3 className="text-base font-semibold mt-1">Aylık Toplam</h3>
            </div>
            <div className="p-2 rounded-lg bg-white/15">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-4">{formatMoney(totalStaffMonthly)}</p>
          <div className="mt-3 space-y-1">
            {data.staffTurnover.slice(0, 3).map((staff) => (
              <div
                key={staff.userId}
                className="flex justify-between text-xs text-indigo-100"
              >
                <span>{staff.userName}</span>
                <span>{formatMoney(staff.monthly)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Personel Ciroları Detay */}
      {data.staffTurnover.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Personel Ciroları</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Personel
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                    Günlük
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                    Aylık
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                    Yıllık
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.staffTurnover.map((staff) => (
                  <tr key={staff.userId} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {staff.userName}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-slate-700">
                      {formatMoney(staff.daily)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-emerald-700">
                      {formatMoney(staff.monthly)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-slate-700">
                      {formatMoney(staff.yearly)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* İki Kolon: Son İşlemler + Son Ödemeler */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Son İşlemler</h2>
            <p className="text-xs text-slate-500 mt-0.5">Son 10 fatura</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Fatura
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Müşteri
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                    Tutar
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.recentInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold ring-1 ring-inset ${invoiceTypeStyles(inv.type)}`}
                        >
                          {invoiceTypeLabel(inv.type)}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {inv.invoiceNo}
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatDate(inv.createdAt)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-800 truncate max-w-[160px]">
                        {inv.customer.name}
                      </p>
                      <p className="text-xs text-slate-400">{inv.customer.code}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p
                        className={`text-sm font-semibold ${
                          inv.type === 'ALIS' ? 'text-red-600' : 'text-emerald-700'
                        }`}
                      >
                        {formatMoney(inv.totalAmountTl)}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Son Ödemeler</h2>
            <p className="text-xs text-slate-500 mt-0.5">Kasa hareketleri</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Açıklama
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Kasa
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                    Tutar
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.recentPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`p-1 rounded-md ${
                            payment.type === 'GIRIS'
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-red-50 text-red-600'
                          }`}
                        >
                          {payment.type === 'GIRIS' ? (
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          )}
                        </span>
                        <div>
                          <p className="text-sm text-slate-800 truncate max-w-[180px]">
                            {payment.description}
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatDate(payment.createdAt)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {payment.safe.name}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p
                        className={`text-sm font-semibold ${
                          payment.type === 'GIRIS'
                            ? 'text-emerald-700'
                            : 'text-red-600'
                        }`}
                      >
                        {payment.type === 'GIRIS' ? '+' : '-'}
                        {formatMoney(payment.amount, payment.safe.currency)}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
