import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Printer, Save, Search, ShoppingCart, X } from 'lucide-react';
import ProductSearchPopover from '../components/ProductSearchPopover';
import F2ProductList, { resolveSalesUnitPriceTl } from '../components/F2ProductList';
import { useF2ProductSearch, type F2Product } from '../hooks/useF2ProductSearch';
import { useF2KeyboardNav } from '../hooks/useF2KeyboardNav';
import {
  API_BASE,
  DEFAULT_USD,
  fetchExchangeRates,
  ensureArray,
  formatMoney,
  type Customer,
  type PaginatedListResponse,
} from '../lib/api';

type Branch = {
  id: number;
  name: string;
  type: string;
};

type Safe = {
  id: number;
  branchId: number;
  name: string;
  currency: string;
  balance: number;
  branch?: Pick<Branch, 'id' | 'name' | 'type'>;
};

type Personnel = {
  id: number;
  name: string;
};

type Product = {
  id: number;
  sku: string;
  barcode: string | null;
  name: string;
  costPrice: number;
  costUsd?: number;
  priceTl: number;
  priceUsd: number;
  lastSoldPrice?: number | null;
  lastSoldPriceUsd?: number | null;
};

type CartItem = {
  rowId: string;
  product: Product;
  quantity: number;
  unitPriceTl: number;
  discountPercent: number;
  costPrice: number;
};

type InitData = {
  branches: Branch[];
  safes: Safe[];
  personnels: Personnel[];
  nextInvoiceNo: string;
};

type PaymentMethod = 'Nakit' | 'EFT/Havale' | 'Kart' | 'Cari';
type PaymentType = 'Peşin' | 'Vadeli';
type DeliveryType = 'Mağazadan Teslim' | 'Kargo';

type SalesCreateProps = {
  f2Trigger?: number;
  onNotify?: (type: 'success' | 'error', message: string) => void;
  onDataChange?: () => void;
};

function calcLineTotalTl(item: Pick<CartItem, 'quantity' | 'unitPriceTl' | 'discountPercent'>) {
  const base = item.quantity * item.unitPriceTl;
  return base * (1 - item.discountPercent / 100);
}

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

function formatUsd(value: number) {
  return `$${value.toFixed(2)}`;
}

export default function SalesCreate({ f2Trigger = 0, onNotify, onDataChange }: SalesCreateProps) {
  const [initData, setInitData] = useState<InitData>({
    branches: [],
    safes: [],
    personnels: [],
    nextInvoiceNo: '',
  });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<number | ''>('');
  const [selectedSafe, setSelectedSafe] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Nakit');
  const [paymentType, setPaymentType] = useState<PaymentType>('Peşin');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('Mağazadan Teslim');
  const [invoiceDate, setInvoiceDate] = useState(() =>
    new Date().toISOString().split('T')[0]
  );
  const [dueDate, setDueDate] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [exchangeRate, setExchangeRate] = useState(DEFAULT_USD);
  const [isPreOrder, setIsPreOrder] = useState(false);
  const [shouldPrint, setShouldPrint] = useState(false);
  const [processedBy, setProcessedBy] = useState('');
  const [f2Modal, setF2Modal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const customerSearchRef = useRef<HTMLInputElement>(null);
  const quantityInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const customerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAddedRowId = useRef<string | null>(null);

  const f2 = useF2ProductSearch({
    open: f2Modal,
    f2Trigger,
    context: 'sales',
    partyId: selectedCustomer?.id ?? null,
    exchangeRate,
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

  const totalQuantity = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const totalTl = useMemo(
    () => cart.reduce((sum, item) => sum + calcLineTotalTl(item), 0),
    [cart]
  );

  const totalUsd = useMemo(
    () => totalTl / (exchangeRate > 0 ? exchangeRate : 1),
    [totalTl, exchangeRate]
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
        `${API_BASE}/api/sales/init`
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
      notify('error', 'Başlangıç verileri yüklenemedi. Backend çalışıyor mu?');
    }
  }, [notify, processedBy]);

  useEffect(() => {
    loadInitData();
  }, [loadInitData]);

  useEffect(() => {
    fetchExchangeRates().then((r) => setExchangeRate(r.usd));
  }, []);

  useEffect(() => {
    if (selectedBranch === '') return;
    const safeInBranch = initData.safes.find((s) => s.branchId === selectedBranch);
    if (safeInBranch) {
      setSelectedSafe(safeInBranch.id);
    }
  }, [selectedBranch, initData.safes]);

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
          setCustomerResults(response.data.data);
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

  useEffect(() => {
    if (!selectedCustomer || cart.length === 0) return;

    const refreshCartPrices = async () => {
      try {
        const updated = await Promise.all(
          cart.map(async (item) => {
            const response = await axios.get<{ success: boolean; data: Product[] }>(
              `${API_BASE}/api/sales/products`,
              {
                params: {
                  search: item.product.sku,
                  customerId: String(selectedCustomer.id),
                  exchangeRate: String(exchangeRate),
                },
              }
            );
            const match = response.data.data.find((p) => p.id === item.product.id);
            const unitPriceTl =
              match?.lastSoldPrice != null
                ? match.lastSoldPrice
                : (match?.priceTl ?? item.unitPriceTl);
            const costPrice = match?.costPrice ?? item.costPrice;
            return {
              rowId: item.rowId,
              unitPriceTl,
              costPrice,
              product: match ? { ...item.product, ...match } : item.product,
            };
          })
        );

        setCart((prev) =>
          prev.map((item) => {
            const row = updated.find((u) => u.rowId === item.rowId);
            return row
              ? {
                  ...item,
                  unitPriceTl: row.unitPriceTl,
                  costPrice: row.costPrice,
                  product: row.product,
                }
              : item;
          })
        );
      } catch {
        /* fiyat güncellemesi opsiyonel */
      }
    };

    refreshCartPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer?.id]);

  useEffect(() => {
    if (lastAddedRowId.current) {
      const ref = quantityInputRefs.current[lastAddedRowId.current];
      ref?.focus();
      ref?.select();
      lastAddedRowId.current = null;
    }
  }, [cart]);

  const openF2Modal = useCallback(() => {
    setF2Modal(true);
  }, []);

  const closeF2Modal = useCallback(() => {
    setF2Modal(false);
  }, []);

  useEffect(() => {
    if (f2Trigger > 0) {
      setF2Modal(true);
    }
  }, [f2Trigger]);

  const resolveProductTl = useCallback(
    (product: F2Product | Product) => {
      const unitPriceTl = resolveSalesUnitPriceTl(
        product as F2Product,
        Boolean(selectedCustomer)
      );
      const costPrice = product.costPrice;
      return { unitPriceTl, costPrice };
    },
    [selectedCustomer]
  );

  const addProductToCart = useCallback(
    (product: F2Product | Product) => {
      const { unitPriceTl, costPrice } = resolveProductTl(product);

      setCart((prev) => {
        const existing = prev.find((item) => item.product.id === product.id);
        if (existing) {
          lastAddedRowId.current = existing.rowId;
          return prev.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          );
        }

        const rowId = `row-${product.id}-${Date.now()}`;
        lastAddedRowId.current = rowId;
        return [
          ...prev,
          {
            rowId,
            product,
            quantity: 1,
            unitPriceTl,
            discountPercent: 0,
            costPrice,
          },
        ];
      });

      closeF2Modal();
    },
    [closeF2Modal, resolveProductTl]
  );

  const handleModalKeyDown = useF2KeyboardNav({
    open: f2Modal,
    results: f2.results,
    focusedIndex: f2.focusedIndex,
    navigateFocus: f2.navigateFocus,
    onSelect: addProductToCart,
    onClose: closeF2Modal,
  });

  const updateCartItem = (
    rowId: string,
    field: 'quantity' | 'unitPriceTl' | 'discountPercent',
    value: number
  ) => {
    setCart((prev) =>
      prev.map((item) =>
        item.rowId === rowId ? { ...item, [field]: value } : item
      )
    );
  };

  const removeCartItem = (rowId: string) => {
    setCart((prev) => prev.filter((item) => item.rowId !== rowId));
  };

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch(`${customer.code} — ${customer.name}`);
    setCustomerDropdownOpen(false);
  };

  const handleSubmit = async () => {
    let customer = selectedCustomer;
    if (!customer) {
      customer = pickCustomerFromSearch(customerSearch, customerResults);
      if (customer) {
        setSelectedCustomer(customer);
        setCustomerSearch(`${customer.code} — ${customer.name}`);
      }
    }

    if (!customer) {
      notify('error', 'Lütfen listeden müşteri seçin (koda tıklayın veya Enter).');
      return;
    }

    if (!storeBranch && selectedBranch === '') {
      notify('error', 'Geçerli bir şube bulunamadı.');
      return;
    }

    const branchId = selectedBranch !== '' ? Number(selectedBranch) : storeBranch!.id;

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
      const response = await axios.post(`${API_BASE}/api/sales/store`, {
        customerId: customer.id,
        branchId,
        safeId,
        paymentMethod,
        paymentType,
        exchangeRate,
        deliveryType,
        dueDate: dueDate || undefined,
        invoiceDate,
        isPreOrder,
        processedBy: processedBy || undefined,
        orderNotes: orderNotes || undefined,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.unitPriceTl,
          discountPercent: item.discountPercent,
        })),
      });

      if (response.data.success) {
        const savedCustomer = response.data.data?.customer;
        notify(
          'success',
          `${isPreOrder ? 'Ön sipariş' : 'Satış'} kaydedildi! Fatura: ${response.data.data?.invoiceNo ?? ''}${
            savedCustomer ? ` · ${savedCustomer.name}` : ''
          }`
        );
        setCart([]);
        setOrderNotes('');
        setDueDate('');
        setIsPreOrder(false);
        setSelectedCustomer(null);
        setCustomerSearch('');
        onDataChange?.();
        await loadInitData();

        if (shouldPrint) {
          window.print();
        }
      }
    } catch (error) {
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? String(error.response.data.message)
          : 'Satış kaydedilemedi.';
      notify('error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm px-3 py-2 bg-white';
  const labelClass = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1';

  return (
    <div className="space-y-4 print:space-y-2">
      <div className="flex items-center gap-3 mb-2 print:hidden">
        <div className="p-2.5 rounded-xl bg-emerald-600 text-white">
          <ShoppingCart className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Hızlı Satış Yap</h1>
          <p className="text-sm text-slate-500">
            Esnaf fatura tezgâhı · F2 ile stok ara · Çift para birimi ($ / TL)
          </p>
        </div>
      </div>

      {/* ÜST 4 KUTU */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Kutu 1 — Evrak */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
          <h2 className="text-sm font-bold text-indigo-700 border-b border-indigo-100 pb-2">
            Evrak Bilgileri
          </h2>
          <div>
            <label className={labelClass}>Sipariş Numarası</label>
            <input
              type="text"
              readOnly
              value={initData.nextInvoiceNo || 'SF...'}
              className={`${inputClass} bg-slate-50 font-mono font-bold text-indigo-700`}
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

        {/* Kutu 2 — Müşteri */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3 relative">
          <h2 className="text-sm font-bold text-indigo-700 border-b border-indigo-100 pb-2">
            Müşteri Bilgileri
          </h2>
          <div>
            <label className={labelClass}>Müşteri Seçimi</label>
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
              <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                Seçili: {selectedCustomer.code} — {selectedCustomer.name}
              </p>
            )}
            {customerDropdownOpen && (customerSearch.trim() || customerResults.length > 0) && (
              <ul className="absolute z-20 left-4 right-4 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg divide-y divide-slate-100">
                {customerSearchLoading && (
                  <li className="px-3 py-2 text-sm text-slate-400">Aranıyor...</li>
                )}
                {!customerSearchLoading &&
                  customerResults.map((customer) => (
                    <li
                      key={customer.id}
                      onMouseDown={() => selectCustomer(customer)}
                      className="px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50"
                    >
                      <span className="font-medium">{customer.code}</span>
                      <span className="text-slate-500"> — {customer.name}</span>
                    </li>
                  ))}
                {!customerSearchLoading &&
                  customerSearch.trim() &&
                  customerResults.length === 0 && (
                    <li className="px-3 py-2 text-sm text-slate-400">Sonuç yok</li>
                  )}
              </ul>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Müşteri Limiti</label>
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                {selectedCustomer
                  ? formatMoney(selectedCustomer.creditLimit)
                  : '—'}
              </div>
            </div>
            <div>
              <label className={labelClass}>Müşteri Bakiyesi</label>
              <div
                className={`rounded-lg border px-3 py-2 text-sm font-bold ${
                  selectedCustomer && selectedCustomer.balance > 0
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}
              >
                {selectedCustomer ? formatMoney(selectedCustomer.balance) : '—'}
              </div>
            </div>
          </div>
        </section>

        {/* Kutu 3 — Ödeme */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
          <h2 className="text-sm font-bold text-indigo-700 border-b border-indigo-100 pb-2">
            Ödeme Bilgileri
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
            <label className={labelClass}>Banka / Kasa Seçimi</label>
            <select
              value={selectedSafe}
              onChange={(e) =>
                setSelectedSafe(e.target.value ? Number(e.target.value) : '')
              }
              disabled={paymentMethod === 'Cari'}
              className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-400`}
            >
              <option value="">Seçin</option>
              {branchSafes.map((safe) => (
                <option key={safe.id} value={safe.id}>
                  {safe.name} ({formatMoney(safe.balance, safe.currency)})
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Kutu 4 — Teslimat */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
          <h2 className="text-sm font-bold text-indigo-700 border-b border-indigo-100 pb-2">
            Teslimat & Açıklama
          </h2>
          <div>
            <label className={labelClass}>Ürün Teslimi</label>
            <select
              value={deliveryType}
              onChange={(e) => setDeliveryType(e.target.value as DeliveryType)}
              className={inputClass}
            >
              <option value="Mağazadan Teslim">Mağazadan Teslim</option>
              <option value="Kargo">Kargo</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Sipariş Açıklaması</label>
            <textarea
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              rows={3}
              placeholder="Sipariş notu, kargo talimatı..."
              className={`${inputClass} resize-none`}
            />
          </div>
        </section>
      </div>

      {/* F2 ARAMA BUTONU */}
      <button
        type="button"
        onClick={openF2Modal}
        className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 px-6 shadow-md transition-colors font-semibold print:hidden"
      >
        <Search className="w-5 h-5" />
        Hızlı Stok Kartı Bul (F2)
      </button>

      {/* ORTA + SAĞ GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Sepet Tablosu */}
        <section className="xl:col-span-3 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2 bg-slate-50">
            <ShoppingCart className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold text-slate-800">Akıllı Sepet</h2>
            <span className="text-sm text-slate-500">({cart.length} kalem)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-600 uppercase">
                    Stok Kodu
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-slate-600 uppercase">
                    Stok Adı
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold text-slate-600 uppercase w-20">
                    Ind.%
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold text-slate-600 uppercase w-20">
                    Adet
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold text-slate-600 uppercase w-24">
                    Maliyet (₺)
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold text-slate-600 uppercase w-24">
                    Fiyat (₺)
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold text-slate-600 uppercase w-28">
                    Toplam
                  </th>
                  <th className="px-3 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cart.map((item) => {
                  const lineTotal = calcLineTotalTl(item);
                  return (
                    <tr key={item.rowId} className="hover:bg-slate-50/80">
                      <td className="px-3 py-2 font-mono text-xs text-slate-600">
                        {item.product.sku}
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-900 truncate max-w-[200px]">
                          {item.product.name}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={item.discountPercent}
                          onChange={(e) =>
                            updateCartItem(
                              item.rowId,
                              'discountPercent',
                              Number(e.target.value)
                            )
                          }
                          className="w-16 text-right rounded border-slate-300 text-sm px-1.5 py-1 border focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          ref={(el) => {
                            quantityInputRefs.current[item.rowId] = el;
                          }}
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) =>
                            updateCartItem(
                              item.rowId,
                              'quantity',
                              Number(e.target.value)
                            )
                          }
                          className="w-16 text-right rounded border-slate-300 text-sm px-1.5 py-1 border focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-slate-500 tabular-nums">
                        {formatMoney(item.costPrice)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPriceTl}
                          onChange={(e) =>
                            updateCartItem(
                              item.rowId,
                              'unitPriceTl',
                              Number(e.target.value)
                            )
                          }
                          className="w-20 text-right rounded border-slate-300 text-sm px-1.5 py-1 border focus:border-indigo-500 focus:ring-indigo-500 tabular-nums"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-slate-900 tabular-nums">
                        {formatMoney(lineTotal)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeCartItem(item.rowId)}
                          className="text-red-500 hover:text-red-700 p-1 print:hidden"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {cart.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-16 text-center text-slate-400"
                    >
                      Sepet boş.{' '}
                      <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">
                        F2
                      </kbd>{' '}
                      ile ürün ekleyin.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Fintech Özet Paneli */}
        <aside className="h-fit space-y-4 rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4 shadow-sm sm:p-5 xl:col-span-1 xl:sticky xl:top-4">
          <h2 className="font-bold text-slate-800 text-center border-b border-slate-200 pb-2">
            Fatura Özeti
          </h2>

          <div>
            <label className={labelClass}>Döviz Kuru (USD → TL)</label>
            <input
              type="number"
              min="0.0001"
              step="0.0001"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(Number(e.target.value))}
              className={`${inputClass} font-mono font-bold text-center text-lg`}
            />
          </div>

          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Toplam Ürün Adedi
            </p>
            <p className="text-2xl font-extrabold text-blue-600">
              {totalQuantity} Adet
            </p>
          </div>

          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Net Toplam (₺)
            </p>
            <p className="text-3xl font-black text-red-600 tabular-nums">
              {formatMoney(totalTl)}
            </p>
          </div>

          <div className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 p-4 text-center shadow-lg">
            <p className="text-xs text-emerald-100 uppercase tracking-wide font-semibold">
              Dolar Karşılığı
            </p>
            <p className="text-2xl font-black text-white tabular-nums mt-1">
              {formatUsd(totalUsd)}
            </p>
            <p className="text-[10px] text-emerald-200 mt-1">
              {formatMoney(totalTl)} ÷ {exchangeRate.toFixed(4)}
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPreOrder}
                onChange={(e) => setIsPreOrder(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm font-medium text-slate-700">Ön Sipariş</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={shouldPrint}
                onChange={(e) => setShouldPrint(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-slate-700 flex items-center gap-1">
                <Printer className="w-4 h-4" /> Yazdır
              </span>
            </label>
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

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || cart.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 disabled:from-slate-400 disabled:to-slate-400 text-white font-black uppercase tracking-wide py-4 px-4 sm:py-5 sm:px-6 rounded-2xl shadow-xl shadow-emerald-500/40 transition-all text-sm sm:text-base border-2 border-emerald-400 print:hidden"
          >
            <Save className="w-6 h-6" />
            {submitting ? 'Kaydediliyor...' : 'KAYDET'}
          </button>
        </aside>
      </div>

      {/* F2 — kompakt panel (sayfa arkada kullanılabilir) */}
      <ProductSearchPopover
        open={f2Modal}
        onClose={closeF2Modal}
        title="Hızlı Stok Arama"
        hint="↑↓ gezin · Enter ekle · Esc kapat"
        headerClassName="bg-indigo-600"
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
            partySelected={Boolean(selectedCustomer)}
            priceMode="tl"
            accentClass="indigo"
          />
        )}
      </ProductSearchPopover>
    </div>
  );
}
