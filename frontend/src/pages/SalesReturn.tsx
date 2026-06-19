import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, ArrowLeft, Copy, Package, RotateCcw, Save, Search, X } from 'lucide-react';
import ProductSearchPopover from '../components/ProductSearchPopover';
import F2ProductList from '../components/F2ProductList';
import { useF2ProductSearch, type F2Product } from '../hooks/useF2ProductSearch';
import { useF2KeyboardNav } from '../hooks/useF2KeyboardNav';
import { useHoldKeyReveal } from '../hooks/useHoldKeyReveal';
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
import { recordF2ProductSelection } from '../lib/f2LastProduct';
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
  costUsd: number;
  isChinaReturn: boolean;
  manualOverride?: boolean;
};

function productCostUsd(product: F2Product, exchangeRate: number): number {
  if (product.costUsd != null && product.costUsd > 0) {
    return roundPrice(product.costUsd);
  }
  if (product.costPrice > 0 && exchangeRate > 0) {
    return roundPrice(product.costPrice / exchangeRate);
  }
  return roundPrice(product.priceUsd);
}

function newRowId(prefix: string, productId: number) {
  return `${prefix}-${productId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

type WarningState = {
  title: string;
  message: string;
  product?: F2Product;
  allowForce?: boolean;
};

type SalesReturnProps = {
  f2Trigger?: number;
  editInvoiceId?: number | null;
  onNotify?: (type: 'success' | 'error', message: string) => void;
  onDataChange?: () => void;
  onCancelEdit?: () => void;
  onSaved?: () => void;
};

type EditReturnLine = {
  rowId: string;
  invoiceItemId: number;
  productId: number;
  productName: string;
  productSku: string;
  quantity: number;
  unitPriceTl: number;
};

export default function SalesReturn({
  f2Trigger = 0,
  editInvoiceId = null,
  onNotify,
  onDataChange,
  onCancelEdit,
  onSaved,
}: SalesReturnProps) {
  const isEditMode = editInvoiceId != null && editInvoiceId > 0;
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
  const [editLoading, setEditLoading] = useState(false);
  const [displayInvoiceNo, setDisplayInvoiceNo] = useState('');
  const [editLines, setEditLines] = useState<EditReturnLine[]>([]);
  const [removedItemIds, setRemovedItemIds] = useState<number[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [editProcessedBy, setEditProcessedBy] = useState('');
  const [editInvoiceDate, setEditInvoiceDate] = useState('');
  const [editCustomerLabel, setEditCustomerLabel] = useState('');
  const [editCustomerId, setEditCustomerId] = useState<number | ''>('');
  const [editExchangeRate, setEditExchangeRate] = useState(1);

  const { rates } = useExchangeRates();
  const showCosts = useHoldKeyReveal('F8');

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

  const closeInvoiceView = useCallback(() => {
    setViewingInvoiceId(null);
  }, []);

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
        if (!isEditMode && branchList.length > 0) {
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
  }, [notify, isEditMode]);

  useEffect(() => {
    if (!isEditMode || !editInvoiceId) return;

    let cancelled = false;
    const loadInvoice = async () => {
      setEditLoading(true);
      try {
        const invRes = await axios.get<{
          success: boolean;
          data: {
            id: number;
            invoiceNo: string;
            type: string;
            processedBy: string | null;
            orderNotes: string | null;
            exchangeRate: number;
            createdAt: string;
            customer: { id: number; code: string; name: string };
            items: Array<{
              id: number;
              quantity: number;
              unitPrice: number;
              product: { id: number; sku: string; name: string };
            }>;
          };
        }>(`${API_BASE}/api/sales/invoices/${editInvoiceId}`);

        if (!invRes.data.success || cancelled) return;
        const data = invRes.data.data;

        if (data.type !== 'IADE') {
          notify('error', 'Yalnızca iade faturaları düzenlenebilir.');
          onCancelEdit?.();
          return;
        }

        setDisplayInvoiceNo(data.invoiceNo);
        setEditCustomerId(data.customer.id);
        setEditCustomerLabel(`${data.customer.code} — ${data.customer.name}`);
        setEditProcessedBy(data.processedBy ?? '');
        setEditNotes(data.orderNotes ?? '');
        setEditInvoiceDate(data.createdAt.slice(0, 10));
        setEditExchangeRate(data.exchangeRate > 0 ? data.exchangeRate : rates.usd);
        setRemovedItemIds([]);
        setEditLines(
          data.items.map((line) => ({
            rowId: `inv-${line.id}`,
            invoiceItemId: line.id,
            productId: line.product.id,
            productName: line.product.name,
            productSku: line.product.sku,
            quantity: line.quantity,
            unitPriceTl: roundPrice(line.unitPrice),
          }))
        );
      } catch {
        if (!cancelled) {
          notify('error', 'İade faturası yüklenemedi.');
          onCancelEdit?.();
        }
      } finally {
        if (!cancelled) setEditLoading(false);
      }
    };

    void loadInvoice();
    return () => {
      cancelled = true;
    };
  }, [editInvoiceId, isEditMode, notify, onCancelEdit, rates.usd]);

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

  const showLookupWarning = (data: ReturnableLookup, product: F2Product) => {
    if (data.status === 'never_purchased') {
      setWarning({
        title: 'Satın alma kaydı yok',
        message:
          'Bu müşteri bu ürünü sistemde satın almamış görünüyor. Eski kayıtlar için yine de iade alabilirsiniz.',
        product,
        allowForce: true,
      });
      return;
    }
    if (data.status === 'too_old') {
      setWarning({
        title: '6 aylık iade süresi doldu',
        message: `Son alım ${formatDate(data.lastPurchaseDate)} (6 aydan eski). Yine de sepete ekleyebilirsiniz.`,
        product,
        allowForce: true,
      });
      return;
    }
    if (data.status === 'fully_returned') {
      setWarning({
        title: 'Kayıtlı iade limiti dolmuş',
        message: `Son alım ${formatDate(data.lastPurchaseDate)}. Yine de sepete ekleyebilirsiniz.`,
        product,
        allowForce: true,
      });
    }
  };

  const addManualReturnLine = useCallback(
    (product: F2Product) => {
      if (selectedCustomer !== '') {
        recordF2ProductSelection('return', product.id, Number(selectedCustomer));
      }
      const unitPriceTl = roundPrice(product.priceUsd * rates.usd);
      setCart((prev) => [
        ...prev,
        {
          rowId: newRowId('manual', product.id),
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          sourceInvoiceItemId: 0,
          invoiceId: 0,
          invoiceNo: '—',
          unitPriceTl: unitPriceTl > 0 ? unitPriceTl : 0,
          exchangeRate: rates.usd,
          returnQty: 1,
          costUsd: productCostUsd(product, rates.usd),
          isChinaReturn: false,
          manualOverride: true,
        },
      ]);
      notify('success', `${product.name} sepete eklendi — fiyatı satırda düzenleyebilirsiniz.`);
      setWarning(null);
    },
    [notify, rates.usd, selectedCustomer]
  );

  const duplicateReturnLine = useCallback(
    (line: ReturnCartLine) => {
      setCart((prev) => [
        ...prev,
        {
          ...line,
          rowId: newRowId('dup', line.productId),
          returnQty: 1,
          isChinaReturn: false,
        },
      ]);
      notify('success', 'Ayrı kalem eklendi — Çin iade tikini satır satır işaretleyin.');
    },
    [notify]
  );

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
          showLookupWarning(data, product);
          return;
        }

        recordF2ProductSelection('return', product.id, Number(selectedCustomer));

        setCart((prev) => [
          ...prev,
          {
            rowId: newRowId('ret', data.product.id),
            productId: data.product.id,
            productName: data.product.name,
            productSku: data.product.sku,
            sourceInvoiceItemId: data.sourceInvoiceItemId,
            invoiceId: data.invoiceId,
            invoiceNo: data.invoiceNo,
            unitPriceTl: data.unitPrice,
            exchangeRate: data.exchangeRate,
            returnQty: 1,
            costUsd: productCostUsd(product, data.exchangeRate),
            isChinaReturn: false,
          },
        ]);

        notify(
          'success',
          `${data.product.name} yeni satır olarak eklendi (adet: 1) — ${formatUsd(
            roundPrice(data.unitPrice / data.exchangeRate)
          )} · ${data.invoiceNo}`
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

  const removeEditLine = (rowId: string) => {
    const row = editLines.find((line) => line.rowId === rowId);
    if (row) {
      setRemovedItemIds((prev) =>
        prev.includes(row.invoiceItemId) ? prev : [...prev, row.invoiceItemId]
      );
    }
    setEditLines((prev) => prev.filter((line) => line.rowId !== rowId));
  };

  const handleEditSave = async () => {
    if (!editInvoiceId || editCustomerId === '') return;
    if (editLines.length === 0) {
      notify('error', 'En az bir kalem olmalı.');
      return;
    }

    setSubmitting(true);
    try {
      await axios.put(`${API_BASE}/api/sales/invoices/${editInvoiceId}`, {
        customerId: Number(editCustomerId),
        processedBy: editProcessedBy || null,
        orderNotes: editNotes || undefined,
        invoiceDate: editInvoiceDate,
        exchangeRate: editExchangeRate,
        ...(removedItemIds.length > 0 ? { removeItemIds: removedItemIds } : {}),
        items: editLines.map((line) => ({
          id: line.invoiceItemId,
          quantity: line.quantity,
          unitPrice: line.unitPriceTl,
          discountPercent: 0,
        })),
      });
      notify('success', `İade faturası güncellendi: ${displayInvoiceNo}`);
      onDataChange?.();
      onSaved?.();
    } catch (error) {
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? String(error.response.data.message)
          : 'İade faturası güncellenemedi.';
      notify('error', message);
    } finally {
      setSubmitting(false);
    }
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

    const manualLines = activeLines.filter((line) => line.manualOverride);
    const standardLines = activeLines.filter((line) => !line.manualOverride);

    const byInvoice = new Map<number, ReturnCartLine[]>();
    for (const line of standardLines) {
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

      if (manualLines.length > 0) {
        const response = await axios.post(`${API_BASE}/api/sales/return-discretionary`, {
          customerId: Number(selectedCustomer),
          branchId: Number(selectedBranch),
          safeId: Number(selectedSafe),
          exchangeRate: rates.usd,
          note: 'Kayıt dışı iade',
          items: manualLines.map((row) => ({
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

  if (isEditMode) {
    if (editLoading) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
          Fatura yükleniyor...
        </div>
      );
    }

    const editTotalTl = editLines.reduce(
      (sum, line) => sum + line.quantity * line.unitPriceTl,
      0
    );

    return (
      <div className="space-y-4">
        <div className="mb-2 flex items-center gap-3">
          {onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
              title="Listeye dön"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div className="rounded-xl bg-amber-600 p-2.5 text-white">
            <RotateCcw className="h-5 w-5" />
          </div>
          <div>
            <h1 className="page-title">İade Faturası Düzenle</h1>
            <p className="text-sm text-slate-500">
              {displayInvoiceNo} · {editCustomerLabel}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Fatura Tarihi</label>
            <input
              type="date"
              value={editInvoiceDate}
              onChange={(e) => setEditInvoiceDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">İşlemi Yapan</label>
            <input
              type="text"
              value={editProcessedBy}
              onChange={(e) => setEditProcessedBy(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Döviz Kuru</label>
            <input
              type="number"
              min="0.0001"
              step="0.0001"
              value={editExchangeRate}
              onChange={(e) => setEditExchangeRate(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Not</label>
          <textarea
            rows={2}
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    SKU
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Ürün
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                    Adet
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                    Birim (₺)
                  </th>
                  <th className="w-12 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {editLines.map((line) => (
                  <tr key={line.rowId} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono font-semibold">{line.productSku}</td>
                    <td className="px-4 py-3">{line.productName}</td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={line.quantity}
                        onChange={(e) => {
                          const qty = Number(e.target.value);
                          setEditLines((prev) =>
                            prev.map((row) =>
                              row.rowId === line.rowId
                                ? { ...row, quantity: qty > 0 ? qty : row.quantity }
                                : row
                            )
                          );
                        }}
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitPriceTl}
                        onChange={(e) => {
                          const price = Number(e.target.value);
                          setEditLines((prev) =>
                            prev.map((row) =>
                              row.rowId === line.rowId
                                ? {
                                    ...row,
                                    unitPriceTl: price >= 0 ? roundPrice(price) : row.unitPriceTl,
                                  }
                                : row
                            )
                          );
                        }}
                        className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeEditLine(line.rowId)}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {editLines.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                      Kalem yok
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-700">
            Toplam: {formatMoney(editTotalTl)}
          </p>
          <button
            type="button"
            onClick={handleEditSave}
            disabled={submitting}
            className="btn btn-lg btn-primary inline-flex items-center gap-2"
          >
            <Save className="h-5 w-5" />
            {submitting ? 'Kaydediliyor...' : 'DEĞİŞİKLİKLERİ KAYDET'}
          </button>
        </div>
      </div>
    );
  }

  if (viewingInvoiceId !== null) {
    return (
      <SalesCreate
        key={viewingInvoiceId}
        editInvoiceId={viewingInvoiceId}
        f2Trigger={f2Trigger}
        onNotify={onNotify}
        onDataChange={onDataChange}
        onCancelEdit={closeInvoiceView}
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
          <h1 className="page-title">Satış İade</h1>
          <p className="text-sm text-slate-500">
            Müşteri seçin, F2 ile ürün ekleyin — her F2 seçimi ayrı satır (adet 1). F8 basılı tutunca maliyet görünür
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
                      {showCosts && (
                        <th className="w-24 px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                          Maliyet ($)
                        </th>
                      )}
                      <th className="w-28 px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                        Birim ($)
                      </th>
                      <th className="w-28 px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                        Toplam ($)
                      </th>
                      <th className="w-20 px-4 py-3" />
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
                          </td>
                          <td className="px-4 py-3">
                            {line.manualOverride || line.invoiceId <= 0 ? (
                              <span className="text-sm text-slate-400">{line.invoiceNo}</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setViewingInvoiceId(line.invoiceId)}
                                className="text-sm font-semibold text-violet-700 hover:text-violet-900 hover:underline"
                                title="Faturayı görüntüle"
                              >
                                {line.invoiceNo}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.returnQty || ''}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setCart((prev) =>
                                  prev.map((row) =>
                                    row.rowId === line.rowId
                                      ? {
                                          ...row,
                                          returnQty: Math.max(0, val),
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
                              title={
                                line.isChinaReturn
                                  ? depotLabel('CIN_IADE_DEPO')
                                  : depotLabel('MERKEZ_DEPO')
                              }
                              className="h-4 w-4 rounded border-slate-300 text-orange-600"
                            />
                          </td>
                          {showCosts && (
                            <td className="px-4 py-3 text-right text-sm text-slate-500 tabular-nums">
                              {formatUsd(line.costUsd)}
                            </td>
                          )}
                          <td className="px-4 py-3 text-right text-sm">
                            {line.manualOverride ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={roundPrice(line.unitPriceTl / line.exchangeRate) || ''}
                                onChange={(e) => {
                                  const usd = Number(e.target.value);
                                  setCart((prev) =>
                                    prev.map((row) =>
                                      row.rowId === line.rowId
                                        ? {
                                            ...row,
                                            unitPriceTl: roundPrice(
                                              usd * row.exchangeRate
                                            ),
                                          }
                                        : row
                                    )
                                  );
                                }}
                                className="w-20 rounded-md border border-violet-200 px-2 py-1 text-right text-sm"
                                title="Birim fiyat USD"
                              />
                            ) : (
                              formatUsd(unitUsd)
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold">
                            {formatUsd(lineTotalUsd)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <button
                                type="button"
                                onClick={() => duplicateReturnLine(line)}
                                className="rounded p-1 text-slate-400 hover:bg-amber-50 hover:text-amber-700"
                                title="Aynı üründen ayrı kalem ekle (farklı depo için)"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeLine(line.rowId)}
                                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                title="Satırı kaldır"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
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
          <div className="page-title">{formatUsd(totalUsd)}</div>
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
            className="btn btn-lg btn-amber btn-block sm:w-auto"
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
            <div className="flex flex-col gap-2 sm:flex-row">
              {warning.allowForce && warning.product && (
                <button
                  type="button"
                  onClick={() => addManualReturnLine(warning.product!)}
                  className="flex-1 rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white hover:bg-amber-500"
                >
                  Yine de Sepete Ekle
                </button>
              )}
              <button
                type="button"
                onClick={() => setWarning(null)}
                className={`rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 ${
                  warning.allowForce ? 'flex-1' : 'w-full'
                }`}
              >
                {warning.allowForce ? 'Vazgeç' : 'Tamam'}
              </button>
            </div>
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
            showCost={showCosts}
          />
        )}
      </ProductSearchPopover>
    </div>
  );
}
