import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import {
  API_BASE,
  balanceStyles,
  formatMoney,
  type Customer,
  type PaginatedListResponse,
  type Safe,
} from '../lib/api';

type CustomerPaymentProps = {
  onNotify?: (type: 'success' | 'error', message: string) => void;
  onDataChange?: () => void;
};

export default function CustomerPayment({
  onNotify,
  onDataChange,
}: CustomerPaymentProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [safes, setSafes] = useState<Safe[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<number | ''>('');
  const [selectedSafe, setSelectedSafe] = useState<number | ''>('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [customersRes, initRes] = await Promise.all([
        axios.get<PaginatedListResponse<Customer>>(
          `${API_BASE}/api/customers`,
          { params: { page: 1, limit: 200 } }
        ),
        axios.get<{ success: boolean; data: { safes: Safe[] } }>(
          `${API_BASE}/api/sales/init`
        ),
      ]);

      if (customersRes.data.success) {
        setCustomers(customersRes.data.data);
        if (customersRes.data.data.length > 0) {
          setSelectedCustomer((prev) =>
            prev === '' ? customersRes.data.data[0].id : prev
          );
        }
      }

      if (initRes.data.success) {
        setSafes(initRes.data.data.safes);
        if (initRes.data.data.safes.length > 0) {
          setSelectedSafe((prev) =>
            prev === '' ? initRes.data.data.safes[0].id : prev
          );
        }
      }
    } catch {
      onNotify?.('error', 'Müşteri ve kasa verileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedCustomerData = customers.find((c) => c.id === selectedCustomer);
  const selectedSafeData = safes.find((s) => s.id === selectedSafe);

  const handlePayment = async (type: 'GIRIS' | 'CIKIS') => {
    const parsedAmount = Number(amount);

    if (selectedCustomer === '' || selectedSafe === '') {
      onNotify?.('error', 'Lütfen müşteri ve kasa seçin.');
      return;
    }

    if (!parsedAmount || parsedAmount <= 0) {
      onNotify?.('error', 'Geçerli bir tutar girin.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await axios.post(`${API_BASE}/api/customers/payment`, {
        customerId: Number(selectedCustomer),
        safeId: Number(selectedSafe),
        amount: parsedAmount,
        type,
        description: description.trim() || undefined,
      });

      if (response.data.success) {
        const label = type === 'GIRIS' ? 'Tahsilat' : 'Ödeme';
        onNotify?.('success', `${label} başarıyla kaydedildi.`);
        setAmount('');
        setDescription('');
        await loadData();
        onDataChange?.();
      }
    } catch (error) {
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? String(error.response.data.message)
          : 'İşlem kaydedilemedi.';
      onNotify?.('error', message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Yükleniyor...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-emerald-600 text-white">
          <Wallet className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Müşteri Ödeme İşlemleri
          </h1>
          <p className="text-sm text-slate-500">
            Cari tahsilat ve ödeme kayıtları
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Müşteri
              </label>
              <select
                value={selectedCustomer}
                onChange={(e) =>
                  setSelectedCustomer(
                    e.target.value ? Number(e.target.value) : ''
                  )
                }
                className="w-full rounded-xl border-slate-300 text-sm px-3 py-2.5 border focus:border-emerald-500 focus:ring-emerald-500"
              >
                <option value="">Müşteri seçin</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.code} — {customer.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Kasa
              </label>
              <select
                value={selectedSafe}
                onChange={(e) =>
                  setSelectedSafe(e.target.value ? Number(e.target.value) : '')
                }
                className="w-full rounded-xl border-slate-300 text-sm px-3 py-2.5 border focus:border-emerald-500 focus:ring-emerald-500"
              >
                <option value="">Kasa seçin</option>
                {safes.map((safe) => (
                  <option key={safe.id} value={safe.id}>
                    {safe.name} ({formatMoney(safe.balance, safe.currency)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tutar (TL)
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-xl border-slate-300 text-sm px-3 py-2.5 border focus:border-emerald-500 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Açıklama
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="İşlem açıklaması (opsiyonel)"
              className="w-full rounded-xl border-slate-300 text-sm px-3 py-2.5 border focus:border-emerald-500 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handlePayment('GIRIS')}
              className="flex-1 min-w-[200px] flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-400 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
            >
              <ArrowDownLeft className="w-5 h-5" />
              {submitting ? 'Kaydediliyor...' : 'Tahsilat Al (Giriş)'}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handlePayment('CIKIS')}
              className="flex-1 min-w-[200px] flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-400 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-rose-600/20 transition-all"
            >
              <ArrowUpRight className="w-5 h-5" />
              {submitting ? 'Kaydediliyor...' : 'Ödeme Yap (Çıkış)'}
            </button>
          </div>
        </section>

        <aside className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4 sticky top-6 h-fit">
          <h2 className="font-semibold text-slate-800">Anlık Durum</h2>

          {selectedCustomerData && (
            <div className="rounded-xl border border-slate-100 p-4 space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Seçili Müşteri
              </p>
              <p className="text-sm font-semibold text-slate-900">
                {selectedCustomerData.name}
              </p>
              <p className="text-xs text-slate-400">{selectedCustomerData.code}</p>
              <div className="pt-2 flex items-center justify-between">
                <span className="text-sm text-slate-600">Cari Bakiye</span>
                <span
                  className={`text-sm font-bold ${balanceStyles(selectedCustomerData.balance).text}`}
                >
                  {formatMoney(selectedCustomerData.balance)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Limit</span>
                <span className="text-sm text-slate-700">
                  {formatMoney(selectedCustomerData.creditLimit)}
                </span>
              </div>
            </div>
          )}

          {selectedSafeData && (
            <div className="rounded-xl border border-slate-100 p-4 space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Seçili Kasa
              </p>
              <p className="text-sm font-semibold text-slate-900">
                {selectedSafeData.name}
              </p>
              <div className="pt-2 flex items-center justify-between">
                <span className="text-sm text-slate-600">Kasa Bakiyesi</span>
                <span className="text-sm font-bold text-emerald-700">
                  {formatMoney(
                    selectedSafeData.balance,
                    selectedSafeData.currency
                  )}
                </span>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
