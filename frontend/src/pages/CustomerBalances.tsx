import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
  AlertTriangle,
  HandCoins,
  Pencil,
  Scale,
  Save,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import CustomerNameLink from '../components/CustomerNameLink';
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
  totalPayable: number;
  creditorCount: number;
  customers: BalanceCustomer[];
};

function summarize(customers: BalanceCustomer[]) {
  const totalReceivable = customers
    .filter((c) => c.balance > 0)
    .reduce((sum, c) => sum + c.balance, 0);
  const riskyTotalBalance = customers
    .filter((c) => c.balance > c.creditLimit)
    .reduce((sum, c) => sum + c.balance, 0);
  const debtorCount = customers.filter((c) => c.balance > 0).length;
  const totalPayable = customers
    .filter((c) => c.balance < 0)
    .reduce((sum, c) => sum + Math.abs(c.balance), 0);
  const creditorCount = customers.filter((c) => c.balance < 0).length;
  return {
    totalReceivable,
    riskyTotalBalance,
    debtorCount,
    totalPayable,
    creditorCount,
  };
}

type BalanceTableProps = {
  customers: BalanceCustomer[];
  variant: 'debtor' | 'creditor';
  emptyMessage: string;
  onEdit: (customer: BalanceCustomer) => void;
};

function BalanceTable({ customers, variant, emptyMessage, onEdit }: BalanceTableProps) {
  const isDebtor = variant === 'debtor';

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="bg-slate-50/80">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
              Kod
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
              Müşteri
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
              Kredi Limiti
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
              Bakiye
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500">
              Durum
            </th>
            <th className="w-12 px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {customers.map((customer) => {
            const styles = balanceStyles(customer.balance);
            const isRisky = isDebtor && customer.balance > customer.creditLimit;
            return (
              <tr
                key={customer.id}
                className={`hover:bg-slate-50/60 ${isRisky ? 'bg-amber-50/40' : ''}`}
              >
                <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                  <CustomerNameLink customerId={customer.id}>{customer.code}</CustomerNameLink>
                </td>
                <td className="px-4 py-3 text-sm text-slate-800">
                  <CustomerNameLink customerId={customer.id}>{customer.name}</CustomerNameLink>
                </td>
                <td className="px-4 py-3 text-right text-sm text-slate-600">
                  {formatMoney(customer.creditLimit)}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`inline-flex rounded-lg px-2.5 py-1 text-sm font-bold ring-1 ring-inset ${styles.bg} ${styles.text}`}
                  >
                    {formatMoney(customer.balance)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {isRisky ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      <AlertTriangle className="h-3 w-3" />
                      Limit Aşımı
                    </span>
                  ) : (
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${styles.bg} ${styles.text}`}
                    >
                      {styles.label}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onEdit(customer)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    title="Limit ve bakiye düzenle"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
          {customers.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function CustomerBalances() {
  const [data, setData] = useState<BalancesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<BalanceCustomer | null>(null);
  const [creditLimitInput, setCreditLimitInput] = useState('');
  const [balanceInput, setBalanceInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<{
        success: boolean;
        data: BalancesReport;
      }>(`${API_BASE}/api/reports/balances`);
      if (response.data.success) {
        const payload = response.data.data;
        const customers = ensureArray(payload.customers);
        const summary = summarize(customers);
        setData({
          totalReceivable: payload.totalReceivable ?? summary.totalReceivable,
          riskyTotalBalance: payload.riskyTotalBalance ?? summary.riskyTotalBalance,
          debtorCount: payload.debtorCount ?? summary.debtorCount,
          totalPayable: payload.totalPayable ?? summary.totalPayable,
          creditorCount: payload.creditorCount ?? summary.creditorCount,
          customers,
        });
      }
    } catch {
      setError('Bakiye raporu yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openEdit = (customer: BalanceCustomer) => {
    setEditing(customer);
    setCreditLimitInput(String(customer.creditLimit));
    setBalanceInput(String(customer.balance));
    setSaveError(null);
  };

  const closeEdit = () => {
    setEditing(null);
    setSaveError(null);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;

    setSaving(true);
    setSaveError(null);
    try {
      const creditLimit = Number(creditLimitInput.replace(',', '.'));
      const balance = Number(balanceInput.replace(',', '.'));
      if (!Number.isFinite(creditLimit) || creditLimit < 0) {
        setSaveError('Geçerli bir kredi limiti girin.');
        setSaving(false);
        return;
      }
      if (!Number.isFinite(balance)) {
        setSaveError('Geçerli bir bakiye girin.');
        setSaving(false);
        return;
      }

      await axios.put(`${API_BASE}/api/customers/${editing.id}`, {
        creditLimit,
        balance,
      });

      setData((prev) => {
        if (!prev) return prev;
        const customers = prev.customers.map((c) =>
          c.id === editing.id ? { ...c, creditLimit, balance } : c
        );
        const summary = summarize(customers);
        return { ...prev, customers, ...summary };
      });
      closeEdit();
    } catch (err) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.message
          ? String(err.response.data.message)
          : 'Güncelleme başarısız.';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        Yükleniyor...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
        {error ?? 'Veri bulunamadı.'}
      </div>
    );
  }

  const debtors = data.customers.filter((c) => c.balance > 0);
  const creditors = [...data.customers.filter((c) => c.balance < 0)].sort(
    (a, b) => a.balance - b.balance
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-rose-600 p-2.5 text-white">
          <Scale className="h-5 w-5" />
        </div>
        <div>
          <h1 className="page-title">Müşteri Borç / Alacak</h1>
          <p className="text-sm text-slate-500">
            Borçlu ve alacaklı müşteriler ayrı listelenir — satırda düzenle ile limit ve bakiye
            güncellenir
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white shadow-lg shadow-emerald-500/25">
          <div className="absolute top-0 right-0 h-32 w-32 -translate-y-1/2 translate-x-1/2 rounded-full bg-white/10" />
          <div className="relative">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-100">
              <Wallet className="h-4 w-4" />
              Toplam Alacağımız (Cari)
            </div>
            <p className="text-3xl font-bold tracking-tight">
              {formatMoney(data.totalReceivable)}
            </p>
            <p className="mt-2 text-xs text-emerald-100">{data.debtorCount} borçlu müşteri</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 p-6 text-white shadow-lg shadow-sky-500/25">
          <div className="absolute top-0 right-0 h-32 w-32 -translate-y-1/2 translate-x-1/2 rounded-full bg-white/10" />
          <div className="relative">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-sky-100">
              <HandCoins className="h-4 w-4" />
              Toplam Borcumuz (Müşteriye Alacaklı)
            </div>
            <p className="text-3xl font-bold tracking-tight">{formatMoney(data.totalPayable)}</p>
            <p className="mt-2 text-xs text-sky-100">{data.creditorCount} alacaklı müşteri</p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-white shadow-lg shadow-amber-500/25 sm:col-span-2 lg:col-span-1">
          <div className="absolute top-0 right-0 h-32 w-32 -translate-y-1/2 translate-x-1/2 rounded-full bg-white/10" />
          <div className="relative">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-100">
              <AlertTriangle className="h-4 w-4" />
              Riskli Toplam Bakiye
            </div>
            <p className="text-3xl font-bold tracking-tight">
              {formatMoney(data.riskyTotalBalance)}
            </p>
            <p className="mt-2 text-xs text-amber-100">Kredi limitini aşan cari hesaplar</p>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-rose-500" />
            <h2 className="font-semibold text-slate-800">Borçlu Müşteriler</h2>
          </div>
          <span className="text-xs text-slate-400">En yüksek borçtan sıralı</span>
        </div>
        <BalanceTable
          customers={debtors}
          variant="debtor"
          emptyMessage="Borçlu müşteri bulunmuyor."
          onEdit={openEdit}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <HandCoins className="h-4 w-4 text-sky-500" />
            <h2 className="font-semibold text-slate-800">Alacaklı Müşteriler</h2>
          </div>
          <span className="text-xs text-slate-400">
            Bizde bakiye tutanlar — en yüksek alacaktan sıralı
          </span>
        </div>
        <BalanceTable
          customers={creditors}
          variant="creditor"
          emptyMessage="Alacaklı müşteri bulunmuyor."
          onEdit={openEdit}
        />
      </section>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50" onClick={closeEdit} />
          <form
            onSubmit={handleSave}
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Cari Düzenle</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {editing.code} — {editing.name}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Kapat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Kredi Limiti ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={creditLimitInput}
                  onChange={(e) => setCreditLimitInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Bakiye ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={balanceInput}
                  onChange={(e) => setBalanceInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  required
                />
                <p className="mt-1 text-xs text-slate-400">
                  Pozitif: müşteri borçlu · Negatif: müşteriye alacaklısınız (bizde bakiye)
                </p>
              </div>
              {saveError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</p>
              )}
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={closeEdit}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-rose flex flex-1 items-center justify-center gap-2"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
