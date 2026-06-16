import { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, Scale, Users, Wallet } from 'lucide-react';
import { API_BASE, balanceStyles, ensureArray, formatMoney } from '../lib/api';

type BalanceCustomer = {
  id: number;
  code: string;
  name: string;
  creditLimit: number;
  balance: number;
};

type BalancesReport = {
  totalReceivable: number;
  riskyTotalBalance: number;
  debtorCount: number;
  customers: BalanceCustomer[];
};

export default function CustomerBalances() {
  const [data, setData] = useState<BalancesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get<{
          success: boolean;
          data: BalancesReport;
        }>(`${API_BASE}/api/reports/balances`);
        if (response.data.success) {
          const payload = response.data.data;
          setData({
            totalReceivable: payload.totalReceivable ?? 0,
            riskyTotalBalance: payload.riskyTotalBalance ?? 0,
            debtorCount: payload.debtorCount ?? 0,
            customers: ensureArray(payload.customers),
          });
        }
      } catch {
        setError('Bakiye raporu yüklenemedi.');
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

  const debtors = data.customers.filter((c) => c.balance > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-rose-600 text-white">
          <Scale className="w-5 h-5" />
        </div>
        <div>
          <h1 className="page-title">
            Müşteri Borç / Alacak
          </h1>
          <p className="text-sm text-slate-500">
            Cari hesap özeti ve dışarıdaki alacaklar
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white shadow-lg shadow-emerald-500/25">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="flex items-center gap-2 text-emerald-100 text-sm font-medium mb-2">
              <Wallet className="w-4 h-4" />
              Toplam Alacağımız (Cari)
            </div>
            <p className="text-3xl font-bold tracking-tight">
              {formatMoney(data.totalReceivable)}
            </p>
            <p className="text-emerald-100 text-xs mt-2">
              {data.debtorCount} borçlu müşteri
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-white shadow-lg shadow-amber-500/25">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="flex items-center gap-2 text-amber-100 text-sm font-medium mb-2">
              <AlertTriangle className="w-4 h-4" />
              Riskli Toplam Bakiye
            </div>
            <p className="text-3xl font-bold tracking-tight">
              {formatMoney(data.riskyTotalBalance)}
            </p>
            <p className="text-amber-100 text-xs mt-2">
              Kredi limitini aşan cari hesaplar
            </p>
          </div>
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-800">Borçlu Müşteriler</h2>
          </div>
          <span className="text-xs text-slate-400">
            En yüksek borçtan sıralı
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                  Kod
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                  Müşteri
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                  Kredi Limiti
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                  Bakiye
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">
                  Durum
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {debtors.map((customer) => {
                const styles = balanceStyles(customer.balance);
                const isRisky = customer.balance > customer.creditLimit;
                return (
                  <tr
                    key={customer.id}
                    className={`hover:bg-slate-50/60 ${isRisky ? 'bg-amber-50/40' : ''}`}
                  >
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      {customer.code}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-800">
                      {customer.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-slate-600">
                      {formatMoney(customer.creditLimit)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-lg text-sm font-bold ring-1 ring-inset ${styles.bg} ${styles.text}`}
                      >
                        {formatMoney(customer.balance)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isRisky ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-100 text-amber-800">
                          <AlertTriangle className="w-3 h-3" />
                          Limit Aşımı
                        </span>
                      ) : (
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${styles.bg} ${styles.text}`}
                        >
                          {styles.label}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {debtors.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-slate-400 text-sm"
                  >
                    Borçlu müşteri bulunmuyor. Cari hesaplar dengede.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
