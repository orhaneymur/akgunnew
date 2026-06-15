import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ArrowDownLeft, ArrowUpRight, Search, Wallet } from 'lucide-react';
import F2CustomerList from '../components/F2CustomerList';
import ProductSearchPopover from '../components/ProductSearchPopover';
import { useF2CustomerSearch } from '../hooks/useF2CustomerSearch';
import { useF2KeyboardNav } from '../hooks/useF2KeyboardNav';
import {
  API_BASE,
  balanceStyles,
  ensureArray,
  formatMoney,
  type Customer,
  type PaginatedListResponse,
  type Safe,
} from '../lib/api';

type CustomerPaymentProps = {
  f2Trigger?: number;
  onNotify?: (type: 'success' | 'error', message: string) => void;
  onDataChange?: () => void;
};

function pickCustomerFromSearch(query: string, results: Customer[]): Customer | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const codePart = trimmed.split(/[—\-]/)[0].trim().toLocaleLowerCase('tr-TR');
  const exactByCode = results.find(
    (customer) => customer.code.toLocaleLowerCase('tr-TR') === codePart
  );
  if (exactByCode) return exactByCode;

  const lower = trimmed.toLocaleLowerCase('tr-TR');
  return (
    results.find((customer) => customer.name.toLocaleLowerCase('tr-TR') === lower) ?? null
  );
}

export default function CustomerPayment({
  f2Trigger = 0,
  onNotify,
  onDataChange,
}: CustomerPaymentProps) {
  const [safes, setSafes] = useState<Safe[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [selectedSafe, setSelectedSafe] = useState<number | ''>('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [f2Modal, setF2Modal] = useState(false);

  const customerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customerSearchRef = useRef<HTMLInputElement>(null);

  const f2 = useF2CustomerSearch({ open: f2Modal, f2Trigger });

  const loadSafes = useCallback(async () => {
    setLoading(true);
    try {
      const initRes = await axios.get<{ success: boolean; data: { safes: Safe[] } }>(
        `${API_BASE}/api/sales/init`
      );

      if (initRes.data.success) {
        const safeList = ensureArray(initRes.data.data.safes);
        setSafes(safeList);
        if (safeList.length > 0) {
          setSelectedSafe((prev) => (prev === '' ? safeList[0].id : prev));
        }
      }
    } catch {
      onNotify?.('error', 'Kasa verileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadSafes();
  }, [loadSafes]);

  useEffect(() => {
    if (f2Trigger > 0) {
      setF2Modal(true);
    }
  }, [f2Trigger]);

  useEffect(() => {
    const query = customerSearch.trim();
    if (!customerDropdownOpen || query.length < 1) {
      setCustomerResults([]);
      return;
    }

    if (customerDebounceRef.current) clearTimeout(customerDebounceRef.current);

    customerDebounceRef.current = setTimeout(async () => {
      setCustomerSearchLoading(true);
      try {
        const response = await axios.get<PaginatedListResponse<Customer>>(
          `${API_BASE}/api/customers`,
          { params: { search: query, limit: 20, page: 1 } }
        );
        if (response.data.success) {
          setCustomerResults(ensureArray(response.data.data));
        }
      } catch {
        setCustomerResults([]);
      } finally {
        setCustomerSearchLoading(false);
      }
    }, 300);

    return () => {
      if (customerDebounceRef.current) clearTimeout(customerDebounceRef.current);
    };
  }, [customerSearch, customerDropdownOpen]);

  const selectCustomer = useCallback((customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch(`${customer.code} — ${customer.name}`);
    setCustomerDropdownOpen(false);
  }, []);

  const refreshSelectedCustomer = useCallback(async (customerId: number) => {
    try {
      const response = await axios.get<{ success: boolean; data: Customer }>(
        `${API_BASE}/api/customers/${customerId}`
      );
      if (response.data.success) {
        const customer = response.data.data;
        setSelectedCustomer(customer);
        setCustomerSearch(`${customer.code} — ${customer.name}`);
      }
    } catch {
      /* bakiye yenileme opsiyonel */
    }
  }, []);

  const openF2Modal = useCallback(() => {
    setF2Modal(true);
  }, []);

  const closeF2Modal = useCallback(() => {
    setF2Modal(false);
  }, []);

  const handleF2Select = useCallback(
    (customer: Customer) => {
      selectCustomer(customer);
      closeF2Modal();
    },
    [closeF2Modal, selectCustomer]
  );

  const handleModalKeyDown = useF2KeyboardNav({
    open: f2Modal,
    results: f2.results,
    focusedIndex: f2.focusedIndex,
    navigateFocus: f2.navigateFocus,
    onSelect: handleF2Select,
    onClose: closeF2Modal,
  });

  const selectedSafeData = safes.find((s) => s.id === selectedSafe);

  const handlePayment = async (type: 'GIRIS' | 'CIKIS') => {
    let customer = selectedCustomer;
    if (!customer) {
      customer = pickCustomerFromSearch(customerSearch, customerResults);
      if (customer) selectCustomer(customer);
    }

    const parsedAmount = Number(amount);

    if (!customer || selectedSafe === '') {
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
        customerId: customer.id,
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
        await Promise.all([refreshSelectedCustomer(customer.id), loadSafes()]);
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

  const inputClass =
    'w-full rounded-xl border-slate-300 text-sm px-3 py-2.5 border focus:border-emerald-500 focus:ring-emerald-500';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-emerald-600 text-white">
          <Wallet className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Müşteri Ödeme İşlemleri</h1>
          <p className="text-sm text-slate-500">
            Cari tahsilat ve ödeme · Kod/isim ile ara veya F2 ile hızlı müşteri bul
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 mb-1">Müşteri</label>
              <input
                ref={customerSearchRef}
                type="text"
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setCustomerDropdownOpen(true);
                  if (!e.target.value.trim()) setSelectedCustomer(null);
                }}
                onFocus={() => setCustomerDropdownOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setCustomerDropdownOpen(false), 150);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const picked = pickCustomerFromSearch(customerSearch, customerResults);
                    if (picked) selectCustomer(picked);
                  }
                }}
                placeholder="Kod veya isim ile ara..."
                className={inputClass}
                autoComplete="off"
              />
              {selectedCustomer && (
                <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                  Seçili: {selectedCustomer.code} — {selectedCustomer.name}
                </p>
              )}
              {customerDropdownOpen && (customerSearch.trim() || customerResults.length > 0) && (
                <ul className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg divide-y divide-slate-100">
                  {customerSearchLoading && (
                    <li className="px-3 py-2 text-sm text-slate-400">Aranıyor...</li>
                  )}
                  {!customerSearchLoading &&
                    customerResults.map((customer) => (
                      <li
                        key={customer.id}
                        onMouseDown={() => selectCustomer(customer)}
                        className="px-3 py-2 text-sm cursor-pointer hover:bg-emerald-50 flex items-center justify-between gap-2"
                      >
                        <span>
                          <span className="font-medium">{customer.code}</span>
                          <span className="text-slate-500"> — {customer.name}</span>
                        </span>
                        <span
                          className={`text-xs font-semibold shrink-0 ${balanceStyles(customer.balance).text}`}
                        >
                          {formatMoney(customer.balance)}
                        </span>
                      </li>
                    ))}
                  {!customerSearchLoading &&
                    customerSearch.trim() &&
                    customerResults.length === 0 && (
                      <li className="px-3 py-2 text-sm text-slate-400">Sonuç yok</li>
                    )}
                </ul>
              )}
              <button
                type="button"
                onClick={openF2Modal}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
              >
                <Search className="w-3.5 h-3.5" />
                Hızlı Müşteri Bul (F2)
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kasa</label>
              <select
                value={selectedSafe}
                onChange={(e) => setSelectedSafe(e.target.value ? Number(e.target.value) : '')}
                className={inputClass}
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Tutar (TL)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="İşlem açıklaması (opsiyonel)"
              className={`${inputClass} resize-none`}
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

          {selectedCustomer && (
            <div className="rounded-xl border border-slate-100 p-4 space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Seçili Müşteri</p>
              <p className="text-sm font-semibold text-slate-900">{selectedCustomer.name}</p>
              <p className="text-xs text-slate-400">{selectedCustomer.code}</p>
              <div className="pt-2 flex items-center justify-between">
                <span className="text-sm text-slate-600">Cari Bakiye</span>
                <span
                  className={`text-sm font-bold ${balanceStyles(selectedCustomer.balance).text}`}
                >
                  {formatMoney(selectedCustomer.balance)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Limit</span>
                <span className="text-sm text-slate-700">
                  {formatMoney(selectedCustomer.creditLimit)}
                </span>
              </div>
            </div>
          )}

          {selectedSafeData && (
            <div className="rounded-xl border border-slate-100 p-4 space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Seçili Kasa</p>
              <p className="text-sm font-semibold text-slate-900">{selectedSafeData.name}</p>
              <div className="pt-2 flex items-center justify-between">
                <span className="text-sm text-slate-600">Kasa Bakiyesi</span>
                <span className="text-sm font-bold text-emerald-700">
                  {formatMoney(selectedSafeData.balance, selectedSafeData.currency)}
                </span>
              </div>
            </div>
          )}
        </aside>
      </div>

      <ProductSearchPopover
        open={f2Modal}
        onClose={closeF2Modal}
        title="Hızlı Müşteri Arama"
        hint="↑↓ · PgUp/Dn · Enter · Esc"
        headerClassName="bg-emerald-600"
        searchQuery={f2.searchQuery}
        onSearchChange={f2.setSearchQuery}
        searchInputRef={f2.searchInputRef}
        listRef={f2.listRef}
        onListScroll={f2.handleListScroll}
        onKeyDown={handleModalKeyDown}
        searchLoading={f2.loading}
        loadingMore={f2.loadingMore}
        footer={
          f2.totalCount > 0
            ? `${f2.results.length} / ${f2.totalCount} müşteri`
            : undefined
        }
        emptyHint="Müşteri kodu veya adı yazın..."
        showEmpty={!f2.loading && f2.results.length === 0}
      >
        <F2CustomerList
          customers={f2.results}
          focusedIndex={f2.focusedIndex}
          onFocusIndex={f2.setFocusedIndex}
          onSelect={handleF2Select}
        />
      </ProductSearchPopover>
    </div>
  );
}
