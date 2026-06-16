import { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart3, Percent, TrendingUp, Trophy } from 'lucide-react';
import { API_BASE, ensureArray, formatMoney } from '../lib/api';

type PeriodStats = {
  totalRevenue: number;
  totalProfit: number;
  profitMarginPercent: number;
  itemCount: number;
};

type ProductProfit = {
  productId: number;
  sku: string;
  name: string;
  quantitySold: number;
  revenue: number;
  profit: number;
  profitMarginPercent: number;
};

type ProfitReport = {
  thisMonth: PeriodStats;
  allTime: PeriodStats;
  topProducts: ProductProfit[];
};

export default function ProfitReport() {
  const [data, setData] = useState<ProfitReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get<{
          success: boolean;
          data: ProfitReport;
        }>(`${API_BASE}/api/reports/profit`);
        if (response.data.success) {
          const payload = response.data.data;
          setData({
            thisMonth: payload.thisMonth,
            allTime: payload.allTime,
            topProducts: ensureArray(payload.topProducts),
          });
        }
      } catch {
        setError('Kâr raporu yüklenemedi.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Yükleniyor...
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

  const { thisMonth, topProducts = [] } = data;
  const monthLabel = new Intl.DateTimeFormat('tr-TR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-emerald-600 text-white">
          <BarChart3 className="w-5 h-5" />
        </div>
        <div>
          <h1 className="page-title">Kâr-Zarar Raporu</h1>
          <p className="text-sm text-slate-500">
            {monthLabel} satış analizi ve ürün bazlı kârlılık
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
            <TrendingUp className="w-4 h-4" />
            Bu Ay Ciro
          </div>
          <p className="page-title">
            {formatMoney(thisMonth.totalRevenue)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {thisMonth.itemCount} satış kalemi
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 p-5 text-white shadow-lg shadow-emerald-500/30">
          <div className="flex items-center gap-2 text-emerald-100 text-sm mb-2">
            <Trophy className="w-4 h-4" />
            Net Kâr (Bu Ay)
          </div>
          <p className="text-3xl font-bold tracking-tight">
            {formatMoney(thisMonth.totalProfit)}
          </p>
          <p className="text-emerald-100 text-xs mt-1">
            Satış fiyatı − maliyet tabanı
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-emerald-200 shadow-sm p-5 ring-1 ring-emerald-100">
          <div className="flex items-center gap-2 text-emerald-600 text-sm mb-2">
            <Percent className="w-4 h-4" />
            Kâr Marjı
          </div>
          <p className="text-3xl font-bold text-emerald-700">
            %{thisMonth.profitMarginPercent.toFixed(1)}
          </p>
          <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{
                width: `${Math.min(Math.max(thisMonth.profitMarginPercent, 0), 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">
            En Çok Kâr Getiren Ürünler
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Bu ay — birim satış fiyatı ile liste maliyeti farkına göre
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                  Ürün
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                  Adet
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                  Ciro
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                  Net Kâr
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                  Marj
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {topProducts.map((product, index) => (
                <tr key={product.productId} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 text-sm text-slate-400 font-medium">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-900">
                      {product.name}
                    </p>
                    <p className="text-xs text-slate-500 font-mono">
                      {product.sku}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-slate-700">
                    {product.quantitySold}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-slate-700">
                    {formatMoney(product.revenue)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-lg text-sm font-bold ${
                        product.profit >= 0
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                          : 'bg-red-50 text-red-700 ring-1 ring-red-200'
                      }`}
                    >
                      {formatMoney(product.profit)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-emerald-700">
                    %{product.profitMarginPercent.toFixed(1)}
                  </td>
                </tr>
              ))}
              {topProducts.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-slate-400 text-sm"
                  >
                    Bu ay henüz satış kaydı yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-500">
        Tüm zamanlar: {formatMoney(data.allTime.totalRevenue)} ciro ·{' '}
        {formatMoney(data.allTime.totalProfit)} net kâr · %
        {data.allTime.profitMarginPercent.toFixed(1)} marj
      </div>
    </div>
  );
}
