import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { FileText, RotateCcw, Save } from 'lucide-react';
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
type SalesInvoice = {
  id: number;
  invoiceNo: string;
  type: string;
  totalAmountTl: number;
  createdAt: string;
  customer: { id: number; code: string; name: string };
};
type InvoiceLine = {
  id: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  returnedQty: number;
  returnableQty: number;
  product: {
    id: number;
    sku: string;
    name: string;
    barcode: string | null;
  };
};
type InvoiceDetail = {
  id: number;
  invoiceNo: string;
  exchangeRate: number;
  customer: Customer;
  items: InvoiceLine[];
};
type ReturnDraft = {
  sourceInvoiceItemId: number;
  returnQty: number;
  isChinaReturn: boolean;
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
  const [salesInvoices, setSalesInvoices] = useState<SalesInvoice[]>([]);
  const [invoiceDetail, setInvoiceDetail] = useState<InvoiceDetail | null>(null);
  const [returnDrafts, setReturnDrafts] = useState<ReturnDraft[]>([]);

  const [selectedCustomer, setSelectedCustomer] = useState<number | ''>('');
  const [selectedBranch, setSelectedBranch] = useState<number | ''>('');
  const [selectedSafe, setSelectedSafe] = useState<number | ''>('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | ''>('');

  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchModal, setSearchModal] = useState(false);
  const [pendingReturnItemId, setPendingReturnItemId] = useState<number | null>(null);

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

  const selectedLines = useMemo(
    () => returnDrafts.filter((row) => row.returnQty > 0),
    [returnDrafts]
  );

  const totalTl = useMemo(() => {
    if (!invoiceDetail) return 0;
    return selectedLines.reduce((sum, row) => {
      const line = invoiceDetail.items.find((i) => i.id === row.sourceInvoiceItemId);
      if (!line) return sum;
      return sum + row.returnQty * line.unitPrice;
    }, 0);
  }, [invoiceDetail, selectedLines]);

  const chinaReturnCount = selectedLines.filter((r) => r.isChinaReturn).length;
  const stockReturnCount = selectedLines.length - chinaReturnCount;

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
    if (selectedCustomer === '') {
      setSalesInvoices([]);
      setSelectedInvoiceId('');
      setInvoiceDetail(null);
      setReturnDrafts([]);
      return;
    }

    setLoadingInvoices(true);
    axios
      .get<{ success: boolean; data: SalesInvoice[] }>(
        `${API_BASE}/api/sales/invoices`,
        { params: { customerId: selectedCustomer, type: 'SATIS' } }
      )
      .then((res) => {
        if (res.data.success) {
          setSalesInvoices(res.data.data);
        }
      })
      .catch(() => notify('error', 'Satış faturaları yüklenemedi.'))
      .finally(() => setLoadingInvoices(false));

    setSelectedInvoiceId('');
    setInvoiceDetail(null);
    setReturnDrafts([]);
  }, [selectedCustomer, notify]);

  useEffect(() => {
    if (selectedInvoiceId === '') {
      setInvoiceDetail(null);
      setReturnDrafts([]);
      return;
    }

    setLoadingDetail(true);
    axios
      .get<{ success: boolean; data: InvoiceDetail }>(
        `${API_BASE}/api/sales/invoices/${selectedInvoiceId}`
      )
      .then((res) => {
        if (res.data.success) {
          const detail = res.data.data;
          setInvoiceDetail(detail);
          setReturnDrafts(
            detail.items.map((line) => ({
              sourceInvoiceItemId: line.id,
              returnQty: 0,
              isChinaReturn: false,
            }))
          );
        }
      })
      .catch(() => notify('error', 'Fatura detayı yüklenemedi.'))
      .finally(() => setLoadingDetail(false));
  }, [selectedInvoiceId, notify]);

  const closeSearchModal = useCallback(() => {
    setSearchModal(false);
  }, []);

  useEffect(() => {
    if (f2Trigger > 0) {
      setSearchModal(true);
    }
  }, [f2Trigger]);

  useEffect(() => {
    if (!pendingReturnItemId || !invoiceDetail) return;

    const line = invoiceDetail.items.find((item) => item.id === pendingReturnItemId);
    if (!line || line.returnableQty <= 0) {
      setPendingReturnItemId(null);
      return;
    }

    setReturnDrafts((prev) =>
      prev.map((row) =>
        row.sourceInvoiceItemId === pendingReturnItemId
          ? { ...row, returnQty: Math.min(1, line.returnableQty) }
          : row
      )
    );
    setPendingReturnItemId(null);
    notify('success', `${line.product.name} faturaya eklendi.`);
  }, [invoiceDetail, pendingReturnItemId, notify]);

  const pickProductForReturn = useCallback(
    async (product: F2Product) => {
      if (selectedCustomer === '') {
        notify('error', 'Önce müşteri seçin.');
        return;
      }

      try {
        const response = await axios.get<{
          success: boolean;
          data: {
            invoiceId: number;
            invoiceNo: string;
            sourceInvoiceItemId: number;
            returnableQty: number;
          };
        }>(`${API_BASE}/api/sales/returnable-item`, {
          params: {
            customerId: selectedCustomer,
            productId: product.id,
          },
        });

        if (!response.data.success) return;

        const match = response.data.data;
        closeSearchModal();

        if (
          selectedInvoiceId === match.invoiceId &&
          invoiceDetail?.id === match.invoiceId
        ) {
          const line = invoiceDetail.items.find(
            (item) => item.id === match.sourceInvoiceItemId
          );
          if (!line || line.returnableQty <= 0) {
            notify('error', 'Bu satır için iade alınamaz.');
            return;
          }
          setReturnDrafts((prev) =>
            prev.map((row) =>
              row.sourceInvoiceItemId === match.sourceInvoiceItemId
                ? {
                    ...row,
                    returnQty: Math.min(
                      row.returnQty > 0 ? row.returnQty : 1,
                      line.returnableQty
                    ),
                  }
                : row
            )
          );
          notify('success', `${line.product.name} faturaya eklendi.`);
          return;
        }

        setPendingReturnItemId(match.sourceInvoiceItemId);
        setSelectedInvoiceId(match.invoiceId);
      } catch (error) {
        const message =
          axios.isAxiosError(error) && error.response?.data?.message
            ? String(error.response.data.message)
            : 'Bu ürün için iade alınabilecek satış bulunamadı.';
        notify('error', message);
      }
    },
    [selectedCustomer, selectedInvoiceId, invoiceDetail, closeSearchModal, notify]
  );

  const handleSearchKeyDown = useF2KeyboardNav({
    open: searchModal,
    results: f2.results,
    focusedIndex: f2.focusedIndex,
    navigateFocus: f2.navigateFocus,
    onSelect: (product) => void pickProductForReturn(product),
    onClose: closeSearchModal,
  });

  const handleSubmit = async () => {
    if (
      selectedCustomer === '' ||
      selectedBranch === '' ||
      selectedSafe === '' ||
      selectedInvoiceId === '' ||
      !invoiceDetail
    ) {
      notify('error', 'Müşteri, fatura ve kasa seçimlerini tamamlayın.');
      return;
    }

    if (selectedLines.length === 0) {
      notify('error', 'İade için en az bir satırda miktar girin.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await axios.post(`${API_BASE}/api/sales/return`, {
        customerId: Number(selectedCustomer),
        branchId: Number(selectedBranch),
        safeId: Number(selectedSafe),
        originalInvoiceId: Number(selectedInvoiceId),
        exchangeRate: invoiceDetail.exchangeRate || rates.usd,
        items: selectedLines.map((row) => ({
          sourceInvoiceItemId: row.sourceInvoiceItemId,
          productId: invoiceDetail.items.find((i) => i.id === row.sourceInvoiceItemId)
            ?.productId,
          quantity: row.returnQty,
          unitPrice: invoiceDetail.items.find((i) => i.id === row.sourceInvoiceItemId)
            ?.unitPrice,
          isChinaReturn: row.isChinaReturn,
        })),
      });

      if (response.data.success) {
        const parts: string[] = [];
        if (stockReturnCount > 0) {
          parts.push(`${stockReturnCount} kalem ${depotLabel('MERKEZ_DEPO')}`);
        }
        if (chinaReturnCount > 0) {
          parts.push(`${chinaReturnCount} kalem ${depotLabel('CIN_IADE_DEPO')}`);
        }
        notify(
          'success',
          `İade kaydedildi (${invoiceDetail.invoiceNo}) · ${parts.join(' · ')} · ${response.data.data?.invoiceNo ?? ''}`
        );
        setSelectedInvoiceId('');
        setInvoiceDetail(null);
        setReturnDrafts([]);
        onDataChange?.();
        const invRes = await axios.get<{ success: boolean; data: SalesInvoice[] }>(
          `${API_BASE}/api/sales/invoices`,
          { params: { customerId: selectedCustomer, type: 'SATIS' } }
        );
        if (invRes.data.success) setSalesInvoices(invRes.data.data);
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
            Müşterinin satış faturasından ürün seçerek iade alın — F2 ile hızlı ürün bul
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
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
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
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

            {selectedCustomer !== '' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Kaynak Satış Faturası
                </label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) =>
                    setSelectedInvoiceId(e.target.value ? Number(e.target.value) : '')
                  }
                  disabled={loadingInvoices}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">
                    {loadingInvoices ? 'Faturalar yükleniyor...' : 'Fatura seçin...'}
                  </option>
                  {salesInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNo} · {formatMoney(inv.totalAmountTl)} ·{' '}
                      {formatDate(inv.createdAt)}
                    </option>
                  ))}
                </select>
                {!loadingInvoices && salesInvoices.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Bu müşteriye ait satış faturası bulunamadı.
                  </p>
                )}
              </div>
            )}
          </section>

          {selectedInvoiceId !== '' && (
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" />
                <div>
                  <h2 className="font-semibold text-slate-800">Fatura Kalemleri</h2>
                  {invoiceDetail && (
                    <p className="text-xs text-slate-500">
                      {invoiceDetail.invoiceNo} · {invoiceDetail.customer.name}
                    </p>
                  )}
                </div>
              </div>

              {loadingDetail ? (
                <p className="px-5 py-12 text-center text-slate-400 text-sm">
                  Yükleniyor...
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                          Ürün
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase w-20">
                          Satılan
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase w-20">
                          İade Edildi
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase w-20">
                          Kalan
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase w-24">
                          İade Adet
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase w-24">
                          Çin İade
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase w-28">
                          Birim Fiyat
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoiceDetail?.items.map((line) => {
                        const draft = returnDrafts.find(
                          (d) => d.sourceInvoiceItemId === line.id
                        );
                        const returnQty = draft?.returnQty ?? 0;
                        const isChinaReturn = draft?.isChinaReturn ?? false;
                        const disabled = line.returnableQty <= 0;

                        return (
                          <tr
                            key={line.id}
                            className={
                              disabled
                                ? 'bg-slate-50 text-slate-400'
                                : isChinaReturn
                                  ? 'bg-orange-50/50'
                                  : undefined
                            }
                          >
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-slate-900">
                                {line.product.name}
                              </p>
                              <p className="text-xs text-slate-500">{line.product.sku}</p>
                            </td>
                            <td className="px-4 py-3 text-right text-sm">{line.quantity}</td>
                            <td className="px-4 py-3 text-right text-sm">
                              {line.returnedQty}
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-700">
                              {line.returnableQty}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <input
                                type="number"
                                min="0"
                                max={line.returnableQty}
                                step="0.01"
                                disabled={disabled}
                                value={returnQty || ''}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setReturnDrafts((prev) =>
                                    prev.map((row) =>
                                      row.sourceInvoiceItemId === line.id
                                        ? {
                                            ...row,
                                            returnQty: Math.min(
                                              Math.max(0, val),
                                              line.returnableQty
                                            ),
                                          }
                                        : row
                                    )
                                  );
                                }}
                                className="w-20 text-right rounded-md border border-slate-300 text-sm px-2 py-1 disabled:bg-slate-100"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                disabled={disabled || returnQty <= 0}
                                checked={isChinaReturn}
                                onChange={(e) =>
                                  setReturnDrafts((prev) =>
                                    prev.map((row) =>
                                      row.sourceInvoiceItemId === line.id
                                        ? { ...row, isChinaReturn: e.target.checked }
                                        : row
                                    )
                                  )
                                }
                                className="w-4 h-4 rounded border-slate-300 text-orange-600"
                              />
                            </td>
                            <td className="px-4 py-3 text-right text-sm">
                              {formatMoney(line.unitPrice)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 sticky top-6 space-y-4 h-fit">
          <h2 className="font-semibold text-slate-800">İade Özeti</h2>
          <div className="text-2xl font-bold text-slate-900">{formatMoney(totalTl)}</div>
          {invoiceDetail && (
            <p className="text-xs text-slate-500">
              Kaynak: <strong>{invoiceDetail.invoiceNo}</strong>
            </p>
          )}
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
            disabled={submitting || selectedLines.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-400 text-white font-bold py-4 rounded-xl"
          >
            <Save className="w-5 h-5" />
            {submitting ? 'Kaydediliyor...' : 'İADEYİ KAYDET'}
          </button>
        </aside>
      </div>

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
