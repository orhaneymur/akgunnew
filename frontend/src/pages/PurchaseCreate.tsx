import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { FileInput, Save, Search, ShoppingCart, X } from 'lucide-react';
import ProductSearchPopover from '../components/ProductSearchPopover';
import F2ProductList, {
  resolvePurchaseUnitPriceUsd,
} from '../components/F2ProductList';
import { useF2ProductSearch, type F2Product } from '../hooks/useF2ProductSearch';
import { useF2KeyboardNav } from '../hooks/useF2KeyboardNav';
import { useExchangeRates } from '../hooks/useExchangeRates';
import {
  API_BASE,
  ensureArray,
  formatMoney,
  formatUsd,
  roundPrice,
  type Customer,
  type PaginatedListResponse,
} from '../lib/api';

type Branch = { id: number; name: string; type: string };
type Safe = {
  id: number;
  branchId: number;
  name: string;
  currency: string;
  balance: number;
  branch?: Pick<Branch, 'id' | 'name' | 'type'>;
};
type Personnel = { id: number; name: string };
type Product = {
  id: number;
  sku: string;
  barcode: string | null;
  name: string;
  costPrice: number;
  priceTl: number;
  priceUsd: number;
};
type CartItem = {
  rowId: string;
  product: Product;
  quantity: number;
  unitPriceUsd: number;
};
type InitData = {
  branches: Branch[];
  safes: Safe[];
  personnels: Personnel[];
  nextInvoiceNo: string;
};

type PaymentMethod = 'Nakit' | 'EFT/Havale' | 'Kart' | 'Cari';
type PaymentType = 'Peşin' | 'Vadeli';

type PurchaseCreateProps = {
  f2Trigger?: number;
  onNotify?: (type: 'success' | 'error', message: string) => void;
  onDataChange?: () => void;
};

export default function PurchaseCreate({
  f2Trigger = 0,
  onNotify,
  onDataChange,
}: PurchaseCreateProps) {
  const { rates } = useExchangeRates();
  const [initData, setInitData] = useState<InitData>({
    branches: [],
    safes: [],
    personnels: [],
    nextInvoiceNo: '',
  });
  const [selectedSupplier, setSelectedSupplier] = useState<Customer | null>(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierResults, setSupplierResults] = useState<Customer[]>([]);
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);
  const [supplierSearchLoading, setSupplierSearchLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<number | ''>('');
  const [selectedSafe, setSelectedSafe] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('EFT/Havale');
  const [paymentType, setPaymentType] = useState<PaymentType>('Peşin');
  const [invoiceDate, setInvoiceDate] = useState(() =>
    new Date().toISOString().split('T')[0]
  );
  const [dueDate, setDueDate] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [processedBy, setProcessedBy] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchModal, setSearchModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const supplierSearchRef = useRef<HTMLInputElement>(null);
  const supplierDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const f2 = useF2ProductSearch({
    open: searchModal,
    f2Trigger,
    context: 'purchase',
    partyId: selectedSupplier?.id ?? null,
    exchangeRate: rates.usd,
  });

  const storeBranch = useMemo(
    () =>
      initData.branches.find((b) => b.type === 'STORE') ??
      initData.branches.find((b) => !b.name.includes('DEPO')) ??
      initData.branches[0] ??
      null,
    [initData.branches]
  );

  const branchSafes = useMemo(
    () =>
      initData.safes.filter(
        (safe) => selectedBranch !== '' && safe.branchId === selectedBranch
      ),
    [initData.safes, selectedBranch]
  );

  const totalUsd = useMemo(
    () => roundPrice(cart.reduce((sum, item) => sum + item.quantity * item.unitPriceUsd, 0)),
    [cart]
  );

  const totalTl = useMemo(
    () => Math.round(totalUsd * (rates.usd > 0 ? rates.usd : 1) * 100) / 100,
    [totalUsd, rates.usd]
  );

  const notify = useCallback(
    (type: 'success' | 'error', message: string) => {
      onNotify?.(type, message);
    },
    [onNotify]
  );

  const loadInitData = useCallback(async () => {
    try {
      const response = await axios.get<{ success: boolean; data: InitData }>(
        `${API_BASE}/api/purchases/init`
      );
      if (response.data.success) {
        const data = response.data.data;
        const branches = ensureArray(data.branches);
        const safes = ensureArray(data.safes);
        const personnels = ensureArray(data.personnels);

        setInitData({
          branches,
          safes,
          personnels,
          nextInvoiceNo: data.nextInvoiceNo ?? '',
        });

        const branch =
          branches.find((b) => b.type === 'STORE') ??
          branches.find((b) => !b.name.includes('DEPO')) ??
          branches[0];

        if (branch) {
          setSelectedBranch(branch.id);
          const branchSafe = safes.find((s) => s.branchId === branch.id);
          if (branchSafe) setSelectedSafe(branchSafe.id);
        }

        if (personnels.length > 0 && !processedBy) {
          setProcessedBy(personnels[0].name);
        }
      }
    } catch {
      notify('error', 'Başlangıç verileri yüklenemedi.');
    }
  }, [notify, processedBy]);

  useEffect(() => {
    loadInitData();
  }, [loadInitData]);

  useEffect(() => {
    const query = supplierSearch.trim();
    if (!supplierDropdownOpen) return;

    if (supplierDebounceRef.current) clearTimeout(supplierDebounceRef.current);

    if (!query) {
      setSupplierResults([]);
      setSupplierSearchLoading(false);
      return;
    }

    setSupplierSearchLoading(true);
    supplierDebounceRef.current = setTimeout(async () => {
      try {
        const response = await axios.get<PaginatedListResponse<Customer>>(
          `${API_BASE}/api/customers`,
          { params: { search: query, page: 1, limit: 20 } }
        );
        if (response.data.success) {
          setSupplierResults(ensureArray(response.data.data));
        }
      } catch {
        setSupplierResults([]);
      } finally {
        setSupplierSearchLoading(false);
      }
    }, 300);

    return () => {
      if (supplierDebounceRef.current) clearTimeout(supplierDebounceRef.current);
    };
  }, [supplierSearch, supplierDropdownOpen]);

  const openSearchModal = useCallback(() => {
    setSearchModal(true);
  }, []);

  const closeSearchModal = useCallback(() => {
    setSearchModal(false);
  }, []);

  useEffect(() => {
    if (f2Trigger > 0) {
      setSearchModal(true);
    }
  }, [f2Trigger]);

  useEffect(() => {
    if (selectedBranch === '') return;
    const safeInBranch = initData.safes.find((s) => s.branchId === selectedBranch);
    if (safeInBranch) setSelectedSafe(safeInBranch.id);
  }, [selectedBranch, initData.safes]);

  const selectSupplier = (customer: Customer) => {
    setSelectedSupplier(customer);
    setSupplierSearch(`${customer.code} — ${customer.name}`);
    setSupplierDropdownOpen(false);
  };

  const addProductToCart = (product: F2Product | Product) => {
    const unitPriceUsd = resolvePurchaseUnitPriceUsd(
      product as F2Product,
      Boolean(selectedSupplier),
      rates.usd
    );
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
          product: product as Product,
          quantity: 1,
          unitPriceUsd,
        },
      ];
    });
    closeSearchModal();
  };

  const handleModalKeyDown = useF2KeyboardNav({
    open: searchModal,
    results: f2.results,
    focusedIndex: f2.focusedIndex,
    navigateFocus: f2.navigateFocus,
    onSelect: addProductToCart,
    onClose: closeSearchModal,
  });

  const handleSubmit = async () => {
    if (!selectedSupplier) {
      notify('error', 'Lütfen tedarikçi seçin.');
      return;
    }

    if (!storeBranch && selectedBranch === '') {
      notify('error', 'Geçerli bir şube bulunamadı.');
      return;
    }

    const branchId =
      selectedBranch !== '' ? Number(selectedBranch) : storeBranch!.id;

    if (paymentMethod !== 'Cari' && selectedSafe === '') {
      notify('error', 'Ödeme için kasa/banka seçin.');
      return;
    }

    if (cart.length === 0) {
      notify('error', 'Sepete en az bir ürün ekleyin.');
      return;
    }

    const safeId =
      paymentMethod === 'Cari'
        ? (branchSafes[0]?.id ?? Number(selectedSafe))
        : Number(selectedSafe);

    if (!safeId) {
      notify('error', 'Geçerli bir kasa bulunamadı.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await axios.post(`${API_BASE}/api/purchases/store`, {
        customerId: selectedSupplier.id,
        branchId,
        safeId,
        paymentMethod,
        paymentType,
        exchangeRate: rates.usd,
        dueDate: dueDate || undefined,
        invoiceDate,
        processedBy: processedBy || undefined,
        orderNotes: orderNotes || undefined,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice:
            Math.round(item.unitPriceUsd * (rates.usd > 0 ? rates.usd : 1) * 100) / 100,
        })),
      });

      if (response.data.success) {
        notify(
          'success',
          `Alış faturası kaydedildi! ${response.data.data?.invoiceNo ?? ''} · MERKEZ_DEPO stok güncellendi`
        );
        setCart([]);
        setOrderNotes('');
        setDueDate('');
        onDataChange?.();
        await loadInitData();
      }
    } catch (error) {
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? String(error.response.data.message)
          : 'Alış faturası kaydedilemedi.';
      notify('error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 text-sm px-3 py-2 bg-white';
  const labelClass =
    'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-rose-600 text-white">
          <FileInput className="w-5 h-5" />
        </div>
        <div>
          <h1 className="page-title">Alış Faturası</h1>
          <p className="text-sm text-slate-500">
            Tedarikçiden mal kabul · Fiyatlar $ (USD) · MERKEZ_DEPO stok artışı
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
          <h2 className="text-sm font-bold text-rose-700 border-b border-rose-100 pb-2">
            Evrak Bilgileri
          </h2>
          <div>
            <label className={labelClass}>Alış Fatura No</label>
            <input
              type="text"
              readOnly
              value={initData.nextInvoiceNo || 'AF...'}
              className={`${inputClass} bg-slate-50 font-mono font-bold text-rose-700`}
            />
          </div>
          <div>
            <label className={labelClass}>Fatura Tarihi</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Vade Tarihi</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3 relative">
          <h2 className="text-sm font-bold text-rose-700 border-b border-rose-100 pb-2">
            Tedarikçi
          </h2>
          <div>
            <label className={labelClass}>Tedarikçi Seçimi</label>
            <input
              ref={supplierSearchRef}
              type="text"
              value={supplierSearch}
              onChange={(e) => {
                setSupplierSearch(e.target.value);
                setSupplierDropdownOpen(true);
                if (!e.target.value.trim()) setSelectedSupplier(null);
              }}
              onFocus={() => setSupplierDropdownOpen(true)}
              placeholder="Kod veya ünvan ile ara..."
              className={inputClass}
              autoComplete="off"
            />
            {supplierDropdownOpen &&
              (supplierSearch.trim() || supplierResults.length > 0) && (
                <ul className="absolute z-20 left-4 right-4 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg divide-y divide-slate-100">
                  {supplierSearchLoading && (
                    <li className="px-3 py-2 text-sm text-slate-400">Aranıyor...</li>
                  )}
                  {!supplierSearchLoading &&
                    supplierResults.map((customer) => (
                      <li
                        key={customer.id}
                        onMouseDown={() => selectSupplier(customer)}
                        className="px-3 py-2 text-sm cursor-pointer hover:bg-rose-50"
                      >
                        <span className="font-medium">{customer.code}</span>
                        <span className="text-slate-500"> — {customer.name}</span>
                      </li>
                    ))}
                </ul>
              )}
          </div>
          <div>
            <label className={labelClass}>Cari Bakiye</label>
            <div
              className={`rounded-lg border px-3 py-2 text-sm font-bold ${
                selectedSupplier && selectedSupplier.balance < 0
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              {selectedSupplier ? formatMoney(selectedSupplier.balance) : '—'}
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
          <h2 className="text-sm font-bold text-rose-700 border-b border-rose-100 pb-2">
            Ödeme
          </h2>
          <div>
            <label className={labelClass}>Ödeme Yöntemi</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className={inputClass}
            >
              <option value="EFT/Havale">EFT / Havale</option>
              <option value="Nakit">Nakit</option>
              <option value="Kart">Kredi Kartı</option>
              <option value="Cari">Cari (Veresiye)</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Ödeme Şekli</label>
            <select
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as PaymentType)}
              className={inputClass}
            >
              <option value="Peşin">Peşin</option>
              <option value="Vadeli">Vadeli</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Kasa / Banka</label>
            <select
              value={selectedSafe}
              onChange={(e) =>
                setSelectedSafe(e.target.value ? Number(e.target.value) : '')
              }
              disabled={paymentMethod === 'Cari'}
              className={`${inputClass} disabled:bg-slate-100`}
            >
              {branchSafes.map((safe) => (
                <option key={safe.id} value={safe.id}>
                  {safe.name} ({safe.currency})
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
          <h2 className="text-sm font-bold text-rose-700 border-b border-rose-100 pb-2">
            Diğer
          </h2>
          <div>
            <label className={labelClass}>Şube</label>
            <select
              value={selectedBranch}
              onChange={(e) =>
                setSelectedBranch(e.target.value ? Number(e.target.value) : '')
              }
              className={inputClass}
            >
              {initData.branches
                .filter((b) => b.type === 'STORE')
                .map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>İşlemi Yapan</label>
            <select
              value={processedBy}
              onChange={(e) => setProcessedBy(e.target.value)}
              className={inputClass}
            >
              <option value="">Seçin</option>
              {initData.personnels.map((person) => (
                <option key={person.id} value={person.name}>
                  {person.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Not</label>
            <textarea
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              rows={2}
              className={inputClass}
              placeholder="İrsaliye no, açıklama..."
            />
          </div>
        </section>
      </div>

      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-rose-600" />
            <h2 className="font-semibold text-slate-800">Mal Kabul Sepeti</h2>
            <span className="text-xs text-slate-400">{cart.length} kalem</span>
          </div>
          <button
            type="button"
            onClick={openSearchModal}
            className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            <Search className="w-4 h-4" />
            Ürün Ekle
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                  SKU
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                  Ürün
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                  Miktar
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                  Birim Maliyet ($)
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                  Satır Toplam
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {cart.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-sm">
                    Sepet boş — &quot;Ürün Ekle&quot; ile stok kartı arayın
                  </td>
                </tr>
              )}
              {cart.map((item) => (
                <tr key={item.rowId} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 text-sm font-mono font-semibold text-slate-900">
                    {item.product.sku}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-800 max-w-[240px] truncate">
                    {item.product.name}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => {
                        const qty = Number(e.target.value);
                        setCart((prev) =>
                          prev.map((row) =>
                            row.rowId === item.rowId
                              ? { ...row, quantity: qty > 0 ? qty : row.quantity }
                              : row
                          )
                        );
                      }}
                      className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm text-right"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPriceUsd}
                      onChange={(e) => {
                        const price = Number(e.target.value);
                        setCart((prev) =>
                          prev.map((row) =>
                            row.rowId === item.rowId
                              ? {
                                  ...row,
                                  unitPriceUsd:
                                    price >= 0 ? roundPrice(price) : row.unitPriceUsd,
                                }
                              : row
                          )
                        );
                      }}
                      className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm text-right"
                    />
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-rose-700">
                    {formatUsd(item.quantity * item.unitPriceUsd)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setCart((prev) => prev.filter((row) => row.rowId !== item.rowId))
                      }
                      className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 border-t border-slate-100 bg-slate-50/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Kayıt sonrası{' '}
            <span className="font-semibold text-slate-800">MERKEZ_DEPO</span> stokları
            artırılır ve ürün{' '}
            <span className="font-semibold text-slate-800">costPrice</span> güncellenir.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <p className="text-lg font-bold text-rose-700">
              Toplam: {formatUsd(totalUsd)}
              <span className="text-slate-400 font-normal ml-2">
                ({formatMoney(totalTl)} TL)
              </span>
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || cart.length === 0}
              className="btn btn-lg btn-danger uppercase tracking-wide sm:w-auto"
            >
              <Save className="w-5 h-5" />
              {submitting ? 'Kaydediliyor...' : 'Alışı Kaydet'}
            </button>
          </div>
        </div>
      </section>

      <ProductSearchPopover
        open={searchModal}
        onClose={closeSearchModal}
        title="Alış Ürün Ara"
        headerClassName="bg-rose-600"
        searchQuery={f2.searchQuery}
        onSearchChange={f2.setSearchQuery}
        searchInputRef={f2.searchInputRef}
        listRef={f2.listRef}
        onListScroll={f2.handleListScroll}
        onKeyDown={handleModalKeyDown}
        searchLoading={f2.loading}
        loadingMore={f2.loadingMore}
        footer={`${f2.results.length.toLocaleString('tr-TR')} / ${f2.totalCount.toLocaleString('tr-TR')} ürün`}
        showEmpty={!f2.loading && f2.results.length === 0}
        emptyHint={f2.searchQuery ? 'Sonuç bulunamadı.' : 'Ürün bulunamadı.'}
      >
        {!f2.loading && f2.results.length > 0 && (
          <F2ProductList
            products={f2.results}
            focusedIndex={f2.focusedIndex}
            onFocusIndex={f2.setFocusedIndex}
            onSelect={addProductToCart}
            partySelected={Boolean(selectedSupplier)}
            priceMode="usd"
            accentClass="rose"
          />
        )}
      </ProductSearchPopover>
    </div>
  );
}
