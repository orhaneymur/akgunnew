import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, Package, RotateCcw, Save, Search, X } from 'lucide-react';
import ProductSearchPopover from '../components/ProductSearchPopover';
import F2ProductList from '../components/F2ProductList';
import { useF2ProductSearch, type F2Product } from '../hooks/useF2ProductSearch';
import { useF2KeyboardNav } from '../hooks/useF2KeyboardNav';
import { useExchangeRates } from '../hooks/useExchangeRates';
import { depotLabel } from '../lib/depots';
import {
  API_BASE,
  ensureArray,
  formatDate,
  formatMoney,
  formatUsd,
  roundPrice,
  type PaginatedListResponse,
} from '../lib/api';
import SalesCreate from './SalesCreate';

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

type ReturnableLookup =
  | {
      status: 'ok';
      invoiceId: number;
      invoiceNo: string;
      soldAt: string;
      exchangeRate: number;
      sourceInvoiceItemId: number;
      unitPrice: number;
      returnableQty: number;
      product: { id: number; sku: string; barcode: string | null; name: string };
    }
  | { status: 'never_purchased' }
  | { status: 'too_old'; lastPurchaseDate: string }
  | { status: 'fully_returned'; lastPurchaseDate: string };

type ReturnCartLine = {
  rowId: string;
  productId: number;
  productName: string;
  productSku: string;
  sourceInvoiceItemId: number;
  invoiceId: number;
  invoiceNo: string;
  unitPriceTl: number;
  exchangeRate: number;
  returnQty: number;
  maxReturnable: number;
  isChinaReturn: boolean;
};

type WarningState = {
  title: string;
  message: string;
};

type SalesReturnProps = {
  f2Trigger?: number;
  onNotify?: (type: 'success' | 'error', message: string) => void;
  onDataChange?: () => void;
};

export default function SalesReturn({
  f2Trigger = 0,
  onNotify,
  onDataChange,
}: SalesReturnProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [safes, setSafes] = useState<Safe[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<ReturnCartLine[]>([]);

  const [selectedCustomer, setSelectedCustomer] = useState<number | ''>('');
  const [selectedBranch, setSelectedBranch] = useState<number | ''>('');
  const [selectedSafe, setSelectedSafe] = useState<number | ''>('');

  const [submitting, setSubmitting] = useState(false);
  const [searchModal, setSearchModal] = useState(false);
  const [warning, setWarning] = useState<WarningState | null>(null);
  const [viewingInvoiceId, setViewingInvoiceId] = useState<number | null>(null);
  const [pickingProduct, setPickingProduct] = useState(false);

  const { rates } = useExchangeRates();

  const f2 = useF2ProductSearch({
    open: searchModal,
    f2Trigger,
    context: 'return',
    partyId: selectedCustomer !== '' ? Number(selectedCustomer) : null,
    exchangeRate: rates.usd,
  });

  const branchSafes = useMemo(
    () =>
      safes.filter(
        (safe) => selectedBranch !== '' && safe.branchId === selectedBranch
      ),
    [safes, selectedBranch]
  );

  const activeLines = useMemo(() => cart.filter((row) => row.returnQty > 0), [cart]);

  const totalTl = useMemo(
    () => activeLines.reduce((sum, row) => sum + row.returnQty * row.unitPriceTl, 0),
    [activeLines]
  );

  const totalUsd = useMemo(() => {
    if (activeLines.length === 0) return 0;
    const weighted = activeLines.reduce(
      (sum, row) => sum + row.returnQty * row.unitPriceTl,
      0
    );
    const avgRate =
      activeLines.reduce((sum, row) => sum + row.exchangeRate, 0) / activeLines.length;
    return avgRate > 0 ? roundPrice(weighted / avgRate) : 0;
  }, [activeLines]);

  const chinaReturnCount = activeLines.filter((r) => r.isChinaReturn).length;
  const stockReturnCount = activeLines.length - chinaReturnCount;

  const notify = useCallback(
    (type: 'success' | 'error', message: string) => onNotify?.(type, message),
    [onNotify]
  );

  const loadInit = useCallback(async () => {
    try {
      const [initRes, customersRes] = await Promise.all([
        axios.get<{
          success: boolean;
          data: { branches: Branch[]; safes: Safe[] };
        }>(`${API_BASE}/api/sales/init`),
        axios.get<PaginatedListResponse<Customer>>(
          `${API_BASE}/api/customers`,
          { params: { page: 1, limit: 500 } }
        ),
      ]);

      if (initRes.data.success) {
        const branchList = ensureArray(initRes.data.data.branches);
        const safeList = ensureArray(initRes.data.data.safes);
        setBranches(branchList);
        setSafes(safeList);
        if (branchList.length > 0) {
          setSelectedBranch(branchList[0].id);
          const safe = safeList.find((s) => s.branchId === branchList[0].id);
          if (safe) setSelectedSafe(safe.id);
        }
      }

      if (customersRes.data.success) {
        setCustomers(ensureArray(customersRes.data.data));
      }
    } catch {
      notify('error', 'Başlangıç verileri yüklenemedi.');
    }
  }, [notify]);

  useEffect(() => {
    loadInit();
  }, [loadInit]);

  useEffect(() => {
    setCart([]);
  }, [selectedCustomer]);

  const closeSearchModal = useCallback(() => {
    setSearchModal(false);
  }, []);

  const openSearchModal = useCallback(() => {
    if (selectedCustomer === '') {
      notify('error', 'Önce müşteri seçin.');
      return;
    }
    setSearchModal(true);
  }, [selectedCustomer, notify]);

  useEffect(() => {
    if (f2Trigger > 0) {
      openSearchModal();
    }
  }, [f2Trigger, openSearchModal]);

  const showLookupWarning = (data: ReturnableLookup) => {
    if (data.status === 'never_purchased') {
      setWarning({
        title: 'Satın alma kaydı yok',
        message:
          'Bu müşteri bu ürünü daha önce hiç satın almamış. İade alınamaz.',
      });
      return;
    }
    if (data.status === 'too_old') {
      setWarning({
        title: '6 aylık iade süresi doldu',
        message: `Bu ürünün son alımı ${formatDate(data.lastPurchaseDate)} tarihinde yapılmış (6 aydan eski). İade alınamaz.`,
      });
      return;
    }
    if (data.status === 'fully_returned') {
      setWarning({
        title: 'İade edilebilir miktar yok',
        message: `Son alım ${formatDate(data.lastPurchaseDate)} tarihinde; ancak bu ürün için iade alınabilecek miktar kalmamış.`,
      });
    }
  };

  const pickProductForReturn = useCallback(
    async (product: F2Product) => {
      if (selectedCustomer === '') {
        notify('error', 'Önce müşteri seçin.');
        return;
      }

      setPickingProduct(true);
      try {
        const response = await axios.get<{
          success: boolean;
          data: ReturnableLookup;
        }>(`${API_BASE}/api/sales/returnable-item`, {
          params: {
            customerId: selectedCustomer,
            productId: product.id,
          },
        });

        if (!response.data.success) return;

        const data = response.data.data;
        closeSearchModal();

        if (data.status !== 'ok') {
          showLookupWarning(data);
          return;
        }

        setCart((prev) => {
          const existing = prev.find(
            (row) => row.sourceInvoiceItemId === data.sourceInvoiceItemId
          );
          if (existing) {
            return prev.map((row) =>
              row.sourceInvoiceItemId === data.sourceInvoiceItemId
                ? {
                    ...row,
                    returnQty: Math.min(row.returnQty + 1, row.maxReturnable),
                  }
                : row
            );
          }
          return [
            ...prev,
            {
              rowId: `ret-${data.sourceInvoiceItemId}`,
              productId: data.product.id,
              productName: data.product.name,
              productSku: data.product.sku,
              sourceInvoiceItemId: data.sourceInvoiceItemId,
              invoiceId: data.invoiceId,
              invoiceNo: data.invoiceNo,
              unitPriceTl: data.unitPrice,
              exchangeRate: data.exchangeRate,
              returnQty: 1,
              maxReturnable: data.returnableQty,
              isChinaReturn: false,
            },
          ];
        });

        notify(
          'success',
          `${data.product.name} sepete eklendi — son fiyat ${formatUsd(
            roundPrice(data.unitPrice / data.exchangeRate)
          )} (${data.invoiceNo})`
        );
      } catch (error) {
        const message =
          axios.isAxiosError(error) && error.response?.data?.message
            ? String(error.response.data.message)
            : 'Ürün iade kontrolü yapılamadı.';
        notify('error', message);
      } finally {
        setPickingProduct(false);
      }
    },
    [selectedCustomer, closeSearchModal, notify]
  );

  const handleSearchKeyDown = useF2KeyboardNav({
    open: searchModal,
    results: f2.results,
    focusedIndex: f2.focusedIndex,
    navigateFocus: f2.navigateFocus,
    onSelect: (product) => void pickProductForReturn(product),
    onClose: closeSearchModal,
  });

  const removeLine = (rowId: string) => {
    setCart((prev) => prev.filter((row) => row.rowId !== rowId));
  };

  const handleSubmit = async () => {
    if (selectedCustomer === '' || selectedBranch === '' || selectedSafe === '') {
      notify('error', 'Müşteri, şube ve kasa seçimlerini tamamlayın.');
      return;
    }

    if (activeLines.length === 0) {
      notify('error', 'İade için en az bir ürün ekleyin.');
      return;
    }

    const byInvoice = new Map<number, ReturnCartLine[]>();
    for (const line of activeLines) {
      const group = byInvoice.get(line.invoiceId) ?? [];
      group.push(line);
      byInvoice.set(line.invoiceId, group);
    }

    setSubmitting(true);
    try {
      const createdNos: string[] = [];

      for (const [invoiceId, lines] of byInvoice) {
        const exchangeRate = lines[0].exchangeRate || rates.usd;
        const response = await axios.post(`${API_BASE}/api/sales/return`, {
          customerId: Number(selectedCustomer),
          branchId: Number(selectedBranch),
          safeId: Number(selectedSafe),
          originalInvoiceId: invoiceId,
          exchangeRate,
          items: lines.map((row) => ({
            sourceInvoiceItemId: row.sourceInvoiceItemId,
            productId: row.productId,
            quantity: row.returnQty,
            unitPrice: row.unitPriceTl,
            isChinaReturn: row.isChinaReturn,
          })),
        });

        if (response.data.success) {
          const no = response.data.data?.invoiceNo;
          if (no) createdNos.push(no);
        }
      }

      const parts: string[] = [];
      if (stockReturnCount > 0) {
        parts.push(`${stockReturnCount} kalem ${depotLabel('MERKEZ_DEPO')}`);
      }
      if (chinaReturnCount > 0) {
        parts.push(`${chinaReturnCount} kalem ${depotLabel('CIN_IADE_DEPO')}`);
      }

      notify(
        'success',
        `İade kaydedildi · ${parts.join(' · ')} · ${createdNos.join(', ')}`
      );
      setCart([]);
      onDataChange?.();
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

  if (viewingInvoiceId !== null) {
    return (
      <SalesCreate
        key={viewingInvoiceId}
        editInvoiceId={viewingInvoiceId}
        f2Trigger={f2Trigger}
        onNotify={onNotify}
        onDataChange={onDataChange}
        onCancelEdit={() => setViewingInvoiceId(null)}
      />
    );
  }

  const tlToUsd = (tl: number, rate: number) =>
    roundPrice(rate > 0 ? tl / rate : 0);

  return (
    <div className="space-y-4">
      <div className="mb-2 flex items-center gap-3">
        <div className="rounded-xl bg-amber-600 p-2.5 text-white">
          <RotateCcw className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Satış İade</h1>
          <p className="text-sm text-slate-500">
            Müşteri seçin, F2 ile ürün ekleyin — son 6 ay içindeki alımlar iade edilebilir
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Müşteri
                </label>
                <select
                  value={selectedCustomer}
                  onChange={(e) =>
                    setSelectedCustomer(e.target.value ? Number(e.target.value) : '')
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Müşteri seçin...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Şube
                </label>
                <select
                  value={selectedBranch}
                  onChange={(e) =>
                    setSelectedBranch(e.target.value ? Number(e.target.value) : '')
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
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

            <button
              type="button"
              onClick={openSearchModal}
              disabled={selectedCustomer === '' || pickingProduct}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 py-4 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-6"
            >
              <Search className="h-4 w-4" />
              {pickingProduct ? 'Kontrol ediliyor...' : 'Ürün Ara (F2)'}
            </button>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
              <Package className="h-5 w-5 text-amber-600" />
              <h2 className="font-semibold text-slate-800">İade Sepeti</h2>
            </div>

            {cart.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-slate-400">
                Henüz ürün eklenmedi. Müşteri seçip{' '}
                <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">F2</kbd> ile ürün
                arayın.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        Ürün
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                        Fatura
                      </th>
                      <th className="w-24 px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                        İade Adet
                      </th>
                      <th className="w-20 px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500">
                        Çin İade
                      </th>
                      <th className="w-28 px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                        Birim ($)
                      </th>
                      <th className="w-28 px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                        Toplam ($)
                      </th>
                      <th className="w-10 px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cart.map((line) => {
                      const unitUsd = tlToUsd(line.unitPriceTl, line.exchangeRate);
                      const lineTotalUsd = roundPrice(unitUsd * line.returnQty);

                      return (
                        <tr
                          key={line.rowId}
                          className={line.isChinaReturn ? 'bg-orange-50/50' : undefined}
                        >
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-slate-900">
                              {line.productName}
                            </p>
                            <p className="text-xs text-slate-500">{line.productSku}</p>
                            <p className="text-[0.625rem] text-slate-400">
                              Max {line.maxReturnable} adet
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setViewingInvoiceId(line.invoiceId)}
                              className="text-sm font-semibold text-violet-700 hover:text-violet-900 hover:underline"
                              title="Faturayı görüntüle"
                            >
                              {line.invoiceNo}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              min="0"
                              max={line.maxReturnable}
                              step="0.01"
                              value={line.returnQty || ''}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setCart((prev) =>
                                  prev.map((row) =>
                                    row.rowId === line.rowId
                                      ? {
                                          ...row,
                                          returnQty: Math.min(
                                            Math.max(0, val),
                                            row.maxReturnable
                                          ),
                                        }
                                      : row
                                  )
                                );
                              }}
                              className="w-20 rounded-md border border-slate-300 px-2 py-1 text-right text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              disabled={line.returnQty <= 0}
                              checked={line.isChinaReturn}
                              onChange={(e) =>
                                setCart((prev) =>
                                  prev.map((row) =>
                                    row.rowId === line.rowId
                                      ? { ...row, isChinaReturn: e.target.checked }
                                      : row
                                  )
                                )
                              }
                              className="h-4 w-4 rounded border-slate-300 text-orange-600"
                            />
                          </td>
                          <td className="px-4 py-3 text-right text-sm">
                            {formatUsd(unitUsd)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold">
                            {formatUsd(lineTotalUsd)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => removeLine(line.rowId)}
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              title="Satırı kaldır"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="sticky top-6 h-fit space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800">İade Özeti</h2>
          <div className="text-2xl font-bold text-slate-900">{formatUsd(totalUsd)}</div>
          <p className="text-xs text-slate-400">{formatMoney(totalTl)} TL</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>{depotLabel('MERKEZ_DEPO')}</span>
              <span className="font-medium text-emerald-700">{stockReturnCount} kalem</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>{depotLabel('CIN_IADE_DEPO')}</span>
              <span className="font-medium text-orange-700">{chinaReturnCount} kalem</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || activeLines.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-4 font-bold text-white hover:bg-amber-500 disabled:bg-slate-400"
          >
            <Save className="h-5 w-5" />
            {submitting ? 'Kaydediliyor...' : 'İADEYİ KAYDET'}
          </button>
        </aside>
      </div>

      {warning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            role="alertdialog"
            aria-labelledby="return-warning-title"
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-full bg-amber-100 p-2 text-amber-700">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3
                  id="return-warning-title"
                  className="text-lg font-bold text-slate-900"
                >
                  {warning.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600">{warning.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setWarning(null)}
              className="w-full rounded-xl bg-slate-800 py-3 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Tamam
            </button>
          </div>
        </div>
      )}

      <ProductSearchPopover
        open={searchModal}
        onClose={closeSearchModal}
        title="İade Ürün Ara"
        hint="↑↓ · Enter · Esc"
        headerClassName="bg-amber-600"
        searchQuery={f2.searchQuery}
        onSearchChange={f2.setSearchQuery}
        searchInputRef={f2.searchInputRef}
        listRef={f2.listRef}
        onListScroll={f2.handleListScroll}
        onKeyDown={handleSearchKeyDown}
        searchLoading={f2.loading || pickingProduct}
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
            onSelect={(product) => void pickProductForReturn(product)}
            partySelected={selectedCustomer !== ''}
            priceMode="tl"
            accentClass="amber"
          />
        )}
      </ProductSearchPopover>
    </div>
  );
}
