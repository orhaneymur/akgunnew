import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Banknote, Plus, Wallet, X } from 'lucide-react';
import { API_BASE, formatMoney } from '../lib/api';

type Branch = {
  id: number;
  name: string;
  type: string;
};

type SafeItem = {
  id: number;
  branchId: number;
  name: string;
  currency: string;
  balance: number;
  branch: Branch;
};

export default function SafeManager() {
  const [safes, setSafes] = useState<SafeItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    branchId: '',
    name: '',
    currency: 'USD',
    balance: '0',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [safeRes, branchRes] = await Promise.all([
        axios.get<{ success: boolean; data: SafeItem[] }>(
          `${API_BASE}/api/settings/safes`
        ),
        axios.get<{ success: boolean; data: Branch[] }>(
          `${API_BASE}/api/settings/branches`
        ),
      ]);
      if (safeRes.data.success) setSafes(safeRes.data.data);
      if (branchRes.data.success) {
        setBranches(branchRes.data.data);
        setForm((f) =>
          f.branchId === '' && branchRes.data.data.length > 0
            ? { ...f, branchId: String(branchRes.data.data[0].id) }
            : f
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.branchId) return;

    setSubmitting(true);
    try {
      await axios.post(`${API_BASE}/api/settings/safe`, {
        branchId: Number(form.branchId),
        name: form.name.trim(),
        currency: form.currency,
        balance: Number(form.balance) || 0,
      });
      setForm({ branchId: form.branchId, name: '', currency: 'TRY', balance: '0' });
      setShowForm(false);
      await loadData();
    } catch {
      alert('Kasa eklenemedi.');
    } finally {
      setSubmitting(false);
    }
  };

  const currencyStyle = (currency: string) => {
    switch (currency) {
      case 'USD':
        return 'from-emerald-500 to-teal-600 shadow-emerald-500/20';
      case 'EUR':
        return 'from-blue-500 to-indigo-600 shadow-blue-500/20';
      default:
        return 'from-indigo-500 to-violet-600 shadow-indigo-500/20';
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-600 text-white">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="page-title">Kasa Tanımları</h1>
            <p className="text-sm text-slate-500">
              Nakit kasalar ve banka hesapları
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-md"
        >
          <Plus className="w-4 h-4" />
          Yeni Kasa / Banka Hesabı Ekle
        </button>
      </div>

      {showForm && (
        <section className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Yeni Kasa</h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Şube
              </label>
              <select
                value={form.branchId}
                onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                className="w-full rounded-xl border-slate-300 text-sm px-3 py-2 border"
                required
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Kasa Adı
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Örn: Kasa USD"
                className="w-full rounded-xl border-slate-300 text-sm px-3 py-2 border"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Para Birimi
              </label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full rounded-xl border-slate-300 text-sm px-3 py-2 border"
              >
                <option value="USD">USD — Amerikan Doları</option>
                <option value="TRY">TRY — Türk Lirası (eski)</option>
                <option value="EUR">EUR — Euro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Açılış Bakiyesi
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.balance}
                onChange={(e) => setForm({ ...form, balance: e.target.value })}
                className="w-full rounded-xl border-slate-300 text-sm px-3 py-2 border"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-400 text-white text-sm font-semibold rounded-xl"
              >
                {submitting ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {safes.map((safe) => (
          <div
            key={safe.id}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${currencyStyle(safe.currency)} p-5 text-white shadow-lg`}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative">
              <div className="flex items-center gap-2 text-white/80 text-xs mb-2">
                <Banknote className="w-4 h-4" />
                {safe.branch.name}
              </div>
              <h3 className="text-lg font-bold">{safe.name}</h3>
              <p className="text-2xl font-bold mt-3 tracking-tight">
                {formatMoney(safe.balance, safe.currency)}
              </p>
              <span className="inline-flex mt-2 px-2 py-0.5 rounded-md bg-white/20 text-xs font-medium">
                {safe.currency}
              </span>
            </div>
          </div>
        ))}
        {safes.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400 text-sm">
            Henüz kasa tanımı yok.
          </div>
        )}
      </div>
    </div>
  );
}
