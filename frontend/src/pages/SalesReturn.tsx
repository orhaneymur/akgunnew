import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { RotateCcw, Save, Search, ShoppingCart, X } from 'lucide-react';
import {
  API_BASE,
  EXCHANGE_RATE,
  ensureArray,
  formatMoney,
  type PaginatedListResponse,
} from '../lib/api';

type Branch = { id: number; name: string; type: string };
type Safe = {
  id: number;
  branchId: number;
  name: string;
  currency: string;
  balance: number;
};
type Customer = {
  id: number;
  code: string;
  name: string;
  creditLimit: number;
  balance: number;
};
type Product = {
  id: number;
  sku: string;
  barcode: string | null;
  name: string;
  costPrice: number;
  priceTl: number;
  priceUsd: number;
  lastSoldPrice?: number | null;
};
type CartItem = {
  rowId: string;
  product: Product;
  quantity: number;
  unitPrice: number;
};
type InitData = {
  branches: Branch[];
  safes: Safe[];
  customers: Customer[];
};

type SalesReturnProps = {
  onNotify?: (type: 'success' | 'error', message: string) => void;
  onDataChange?: () => void;
};

export default function SalesReturn({ onNotify, onDataChange }: SalesReturnProps) {
  const [initData, setInitData] = useState<InitData>({
    branches: [],
    safes: [],
    customers: [],
  });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<number | ''>('');
  const [selectedBranch, setSelectedBranch] = useState<number | ''>('');
  const [selectedSafe, setSelectedSafe] = useState<number | ''>('');
  const [isDefective, setIsDefective] = useState(false);
  const [searchModal, setSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [searchLoading, setSearchLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const exchangeRate = EXCHANGE_RATE;

  const branchSafes = useMemo(
    () =>
      initData.safes.filter(
        (safe) => selectedBranch !== '' && safe.branchId === selectedBranch
      ),
    [initData.safes, selectedBranch]
  );

  const totalTl = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [cart]
  );

  const notify = useCallback(
    (type: 'success' | 'error', message: string) => {
      onNotify?.(type, message);
    },
    [onNotify]
  );

  const loadInitData = useCallback(async () => {
    try {
      const [initRes, customersRes] = await Promise.all([
        axios.get<{
          success: boolean;
          data: { branches: Branch[]; safes: Safe[] };
        }>(`${API_BASE}/api/sales/init`),
        axios.get<PaginatedListResponse<Customer>>(
          `${API_BASE}/api/customers`,
          { params: { page: 1, limit: 200 } }
        ),
      ]);

      if (initRes.data.success) {
        const branches = ensureArray(initRes.data.data.branches);
        const safes = ensureArray(initRes.data.data.safes);
        const customers = customersRes.data.success
          ? ensureArray(customersRes.data.data)
          : [];

        setInitData({ branches, safes, customers });

        if (branches.length > 0) {
          setSelectedBranch(branches[0].id);
          const safe = safes.find((s) => s.branchId === branches[0].id);
          if (safe) setSelectedSafe(safe.id);
        }
        if (customers.length > 0) {
          setSelectedCustomer(customers[0].id);
        }
      }
    } catch {
      notify('error', 'Başlangıç verileri yüklenemedi.');
    }
  }, [notify]);

  useEffect(() => {
    loadInitData();
  }, [loadInitData]);

  useEffect(() => {
    if (!searchModal) return;
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setFocusedIndex(-1);
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const params: Record<string, string> = { search: query };
        if (selectedCustomer !== '') {
          params.customerId = String(selectedCustomer);
        }
        const response = await axios.get<{ success: boolean; data: Product[] }>(
          `${API_BASE}/api/sales/products`,
          { params }
        );
        if (response.data.success) {
          setSearchResults(response.data.data);
          setFocusedIndex(response.data.data.length > 0 ? 0 : -1);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, searchModal, selectedCustomer]);

  useEffect(() => {
    if (searchModal) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchModal]);

  const addProductToCart = (product: Product) => {
    const unitPrice =
      product.lastSoldPrice != null ? product.lastSoldPrice : product.priceTl;

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          rowId: `row-${product.id}-${Date.now()}`,
          product,
          quantity: 1,
          unitPrice,
        },
      ];
    });
    setSearchModal(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSubmit = async () => {
    if (selectedCustomer === '' || selectedBranch === '' || selectedSafe === '') {
      notify('error', 'Müşteri, şube ve kasa seçin.');
      return;
    }
    if (cart.length === 0) {
      notify('error', 'İade için en az bir ürün ekleyin.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await axios.post(`${API_BASE}/api/sales/return`, {
        customerId: Number(selectedCustomer),
        branchId: Number(selectedBranch),
        safeId: Number(selectedSafe),
        exchangeRate,
        isDefective,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      });

      if (response.data.success) {
        notify(
          'success',
          `İade kaydedildi! ${isDefective ? 'ARIZALI_DEPO' : 'MERKEZ_DEPO'} · ${response.data.data?.invoiceNo ?? ''}`
        );
        setCart([]);
        onDataChange?.();
        await loadInitData();
      }
    } catch (error) {
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? String(error.response.data.message)
          : 'İade kaydedilemedi.';
      notify('error', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 rounded-xl bg-amber-600 text-white">
          <RotateCcw className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Satış İade</h1>
          <p className="text-sm text-slate-500">
            Arızalı ürünler ARIZALI_DEPO · sağlam ürünler MERKEZ_DEPO
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Şube
                </label>
                <select
                  value={selectedBranch}
                  onChange={(e) =>
                    setSelectedBranch(e.target.value ? Number(e.target.value) : '')
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {initData.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
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
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {initData.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
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
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {branchSafes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
              <input
                id="isDefective"
                type="checkbox"
                checked={isDefective}
                onChange={(e) => setIsDefective(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="isDefective" className="text-sm text-slate-700">
                <span className="font-semibold">Arızalı iade</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  İşaretli ise stok ARIZALI_DEPO&apos;ya, değilse MERKEZ_DEPO&apos;ya
                  eklenir. Müşteri carisinden tutar düşülür.
                </span>
              </label>
            </div>
          </section>

          <button
            type="button"
            onClick={() => setSearchModal(true)}
            className="w-full flex items-center justify-center gap-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl py-4 px-6 font-semibold"
          >
            <Search className="w-5 h-5" />
            İade Edilecek Ürünü Bul
          </button>

          <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-amber-600" />
              <h2 className="font-semibold text-slate-800">İade Sepeti</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                      Ürün
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase w-24">
                      Adet
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase w-32">
                      Birim Fiyat
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase w-32">
                      Toplam
                    </th>
                    <th className="px-4 py-3 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cart.map((item) => (
                    <tr key={item.rowId}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-900">
                          {item.product.name}
                        </p>
                        <p className="text-xs text-slate-500">{item.product.sku}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) =>
                            setCart((prev) =>
                              prev.map((row) =>
                                row.rowId === item.rowId
                                  ? { ...row, quantity: Number(e.target.value) }
                                  : row
                              )
                            )
                          }
                          className="w-20 text-right rounded-md border border-slate-300 text-sm px-2 py-1"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) =>
                            setCart((prev) =>
                              prev.map((row) =>
                                row.rowId === item.rowId
                                  ? { ...row, unitPrice: Number(e.target.value) }
                                  : row
                              )
                            )
                          }
                          className="w-28 text-right rounded-md border border-slate-300 text-sm px-2 py-1"
                        />
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold">
                        {formatMoney(item.quantity * item.unitPrice)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setCart((prev) =>
                              prev.filter((row) => row.rowId !== item.rowId)
                            )
                          }
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {cart.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-slate-400 text-sm">
                        İade sepeti boş.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 sticky top-6 space-y-4 h-fit">
          <h2 className="font-semibold text-slate-800">İade Özeti</h2>
          <div className="text-2xl font-bold text-slate-900">{formatMoney(totalTl)}</div>
          <p className="text-xs text-slate-500">
            Hedef depo:{' '}
            <span className="font-medium text-slate-700">
              {isDefective ? 'ARIZALI_DEPO' : 'MERKEZ_DEPO'}
            </span>
          </p>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || cart.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-400 text-white font-bold py-4 rounded-xl"
          >
            <Save className="w-5 h-5" />
            {submitting ? 'Kaydediliyor...' : 'İADEYİ KAYDET'}
          </button>
        </aside>
      </div>

      {searchModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
          <div
            className="fixed inset-0 bg-slate-900/60"
            onClick={() => setSearchModal(false)}
          />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-amber-600 px-5 py-4 text-white flex justify-between items-center">
              <h3 className="font-semibold">Ürün Ara</h3>
              <button type="button" onClick={() => setSearchModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="SKU, barkod veya ürün adı..."
                className="w-full rounded-lg border border-slate-300 px-4 py-3"
              />
            </div>
            <div className="max-h-72 overflow-y-auto">
              {searchLoading && (
                <p className="py-8 text-center text-slate-400 text-sm">Aranıyor...</p>
              )}
              {!searchLoading &&
                searchResults.map((product, index) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProductToCart(product)}
                    onMouseEnter={() => setFocusedIndex(index)}
                    className={`w-full text-left px-4 py-3 flex justify-between border-b border-slate-100 ${
                      focusedIndex === index ? 'bg-amber-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-slate-500">{product.sku}</p>
                    </div>
                    <span className="text-sm font-bold">{formatMoney(product.priceTl)}</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
