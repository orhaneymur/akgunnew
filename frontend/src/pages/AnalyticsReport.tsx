import { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart3, TrendingUp } from 'lucide-react';
import {
  API_BASE,
  ensureArray,
  formatMoney,
} from '../lib/api';
import SimpleBarChart from '../components/SimpleBarChart';

type StaffTurnover = {
  userId: number;
  userName: string;
  daily: number;
  monthly: number;
  yearly: number;
};

type AnalyticsData = {
  staffTurnover: StaffTurnover[];
  charts: {
    dailySales: { label: string; total: number }[];
    monthlySales: { label: string; total: number }[];
    topProducts: { name: string; quantity: number }[];
    staffComparison: { name: string; monthly: number }[];
  };
  lowStock: { id: number; sku: string; name: string; quantity: number }[];
};

export default function AnalyticsReport() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get<{ success: boolean; data: AnalyticsData }>(
        `${API_BASE}/api/reports/analytics`
      )
      .then((res) => {
        if (res.data.success) {
          const payload = res.data.data;
          setData({
            staffTurnover: ensureArray(payload.staffTurnover),
            charts: payload.charts,
            lowStock: ensureArray(payload.lowStock),
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <p className="py-16 text-center text-sm text-slate-400">Yükleniyor...</p>
    );
  }

  if (!data) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
        Rapor yüklenemedi.
      </p>
    );
  }

  const totalStaffMonthly = data.staffTurnover.reduce(
    (sum, s) => sum + s.monthly,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-indigo-600 p-2.5 text-white">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">İşletme Özeti</h1>
          <p className="text-sm text-slate-500">
            Ciro grafikleri, personel performansı ve stok uyarıları
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Personel Aylık Ciro</p>
          <p className="text-2xl font-bold text-indigo-700">
            {formatMoney(totalStaffMonthly)}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs text-amber-700">Kritik Stok (≤5 adet)</p>
          <p className="text-2xl font-bold text-amber-900">
            {data.lowStock.length} ürün
          </p>
        </div>
      </div>

      {data.lowStock.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
          <h2 className="mb-3 font-semibold text-amber-900">Kritik Stok Listesi</h2>
          <div className="flex flex-wrap gap-2">
            {data.lowStock.map((item) => (
              <span
                key={item.id}
                className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs text-amber-900"
              >
                {item.sku} · {item.quantity} adet
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-800">Son 7 Gün Ciro</h2>
          <SimpleBarChart
            items={data.charts.dailySales.map((d) => ({
              label: d.label,
              value: d.total,
              color: 'bg-emerald-500',
            }))}
            valueFormatter={(v) => formatMoney(v)}
          />
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-800">Aylık Ciro (6 Ay)</h2>
          <SimpleBarChart
            items={data.charts.monthlySales.map((d) => ({
              label: d.label,
              value: d.total,
              color: 'bg-indigo-500',
            }))}
            valueFormatter={(v) => formatMoney(v)}
          />
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-800">
            En Çok Satan 10 Ürün (30 gün)
          </h2>
          <SimpleBarChart
            items={data.charts.topProducts.map((p) => ({
              label: p.name.length > 18 ? `${p.name.slice(0, 18)}…` : p.name,
              value: p.quantity,
              color: 'bg-violet-500',
            }))}
            valueFormatter={(v) => `${Math.round(v)} adet`}
          />
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-800">Personel Ciroları (Aylık)</h2>
          <SimpleBarChart
            items={data.charts.staffComparison.map((s) => ({
              label: s.name.split(' ')[0],
              value: s.monthly,
              color: 'bg-sky-500',
            }))}
            valueFormatter={(v) => formatMoney(v)}
          />
        </section>
      </div>

      {data.staffTurnover.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <TrendingUp className="h-4 w-4 text-indigo-600" />
            <h2 className="font-semibold text-slate-800">Personel Ciroları Detay</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Personel
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                    Günlük
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                    Aylık
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                    Yıllık
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.staffTurnover.map((staff) => (
                  <tr key={staff.userId} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-sm font-medium">{staff.userName}</td>
                    <td className="px-4 py-3 text-right text-sm">
                      {formatMoney(staff.daily)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-700">
                      {formatMoney(staff.monthly)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {formatMoney(staff.yearly)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
