import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Eye, FileText, Filter, Package, Search, User } from 'lucide-react';
import {
  API_BASE,
  formatDate,
  formatMoney,
  invoiceTypeLabel,
  invoiceTypeStyles,
  type InvoiceType,
} from '../lib/api';
import ExcelActions from '../components/ExcelActions';
import CustomerNameLink from '../components/CustomerNameLink';
import SalesCreate from './SalesCreate';
import PurchaseCreate from './PurchaseCreate';
import SalesReturn from './SalesReturn';

type Invoice = {
  id: number;
  invoiceNo: string;
  type: string;
  isPreOrder?: boolean;
  totalAmountTl: number;
  createdAt: string;
  customer: { id: number; code: string; name: string };
  branch: { id: number; name: string };
};

type FilterType = 'ALL' | InvoiceType;

type InvoicesProps = {
  initialFilter?: FilterType;
  preOrderOnly?: boolean;
  refreshKey?: number;
  f2Trigger?: number;
  title?: string;
  description?: string;
  onNotify?: (type: 'success' | 'error', message: string) => void;
  onDataChange?: () => void;
  onF2ContextActive?: (active: boolean) => void;
};

export default function Invoices({
  initialFilter = 'ALL',
  preOrderOnly = false,
  refreshKey = 0,
  f2Trigger = 0,
  title = 'Fatura Listesi',
  description = 'Satış, alış ve iade faturaları — görüntüle ve düzenle',
  onNotify,
  onDataChange,
  onF2ContextActive,
}: InvoicesProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [appliedCustomerSearch, setAppliedCustomerSearch] = useState('');
  const [appliedProductSearch, setAppliedProductSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingInvoice, setEditingInvoice] = useState<{
    id: number;
    type: string;
  } | null>(null);

  const notify = useCallback(
    (type: 'success' | 'error', message: string) => onNotify?.(type, message),
    [onNotify]
  );

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (preOrderOnly) {
        params.preOrder = 'true';
      } else if (filter !== 'ALL') {
        params.type = filter;
      }
      if (appliedCustomerSearch.trim()) {
        params.customerSearch = appliedCustomerSearch.trim();
      }
      if (appliedProductSearch.trim()) {
        params.productSearch = appliedProductSearch.trim();
      }
      const response = await axios.get<{ success: boolean; data: Invoice[] }>(
        `${API_BASE}/api/sales/invoices`,
        { params }
      );
      if (response.data.success) {
        setInvoices(response.data.data);
      }
    } catch {
      setInvoices([]);
      notify('error', 'Fatura listesi yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [filter, preOrderOnly, appliedCustomerSearch, appliedProductSearch, notify, refreshKey]);

  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const runSearch = () => {
    setAppliedCustomerSearch(customerSearch);
    setAppliedProductSearch(productSearch);
  };

  const clearSearch = () => {
    setCustomerSearch('');
    setProductSearch('');
    setAppliedCustomerSearch('');
    setAppliedProductSearch('');
  };

  const hasActiveSearch = Boolean(appliedCustomerSearch.trim() || appliedProductSearch.trim());

  const openEditor = useCallback((inv: Invoice) => {
    if (!['SATIS', 'ALIS', 'IADE'].includes(inv.type)) {
      notify('error', 'Bu fatura türü düzenlenemez.');
      return;
    }
    setEditingInvoice({ id: inv.id, type: inv.type });
  }, [notify]);

  const closeEditor = useCallback(() => {
    setEditingInvoice(null);
  }, []);

  const handleSaved = useCallback(() => {
    setEditingInvoice(null);
    loadInvoices();
    onDataChange?.();
  }, [loadInvoices, onDataChange]);

  const filters: { value: FilterType; label: string }[] = [
    { value: 'ALL', label: 'Tümü' },
    { value: 'SATIS', label: 'Satış' },
    { value: 'ALIS', label: 'Alış' },
    { value: 'IADE', label: 'İade' },
  ];

  if (editingInvoice) {
    if (editingInvoice.type === 'ALIS') {
      return (
        <PurchaseCreate
          key={editingInvoice.id}
          editInvoiceId={editingInvoice.id}
          f2Trigger={f2Trigger}
          onNotify={onNotify}
          onDataChange={onDataChange}
          onCancelEdit={closeEditor}
          onSaved={handleSaved}
        />
      );
    }
    if (editingInvoice.type === 'IADE') {
      return (
        <SalesReturn
          key={editingInvoice.id}
          editInvoiceId={editingInvoice.id}
          f2Trigger={f2Trigger}
          onNotify={onNotify}
          onDataChange={onDataChange}
          onCancelEdit={closeEditor}
          onSaved={handleSaved}
        />
      );
    }
    return (
      <SalesCreate
        key={editingInvoice.id}
        editInvoiceId={editingInvoice.id}
        f2Trigger={f2Trigger}
        onNotify={onNotify}
        onDataChange={onDataChange}
        onCancelEdit={closeEditor}
        onSaved={handleSaved}
        onF2ContextActive={onF2ContextActive}
      />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 rounded-xl bg-violet-600 p-2.5 text-white">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">{title}</h1>
            <p className="text-sm text-slate-500">{description}</p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
          {!preOrderOnly && (
            <ExcelActions
              exportPath="/api/sales/invoices/export/excel"
              importPath="/api/sales/invoices/import/excel"
              exportFilename="faturalar.xlsx"
              exportQuery={filter !== 'ALL' ? { type: filter } : undefined}
              onImported={loadInvoices}
              onNotify={notify}
              hint="Yüklemede yalnızca mevcut faturaların üst bilgisi güncellenir."
            />
          )}
          {!preOrderOnly && (
            <div className="flex w-full items-center gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:w-auto">
              <Filter className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
              {filters.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    filter === item.value
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <section className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/80 to-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-violet-800">
          <Search className="h-4 w-4" />
          <h2 className="text-sm font-bold">Fatura Ara</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">
              <User className="h-3.5 w-3.5" /> Müşteri
            </label>
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder="Cari adı veya kodu..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600">
              <Package className="h-3.5 w-3.5" /> Ürün
            </label>
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder="Stok kodu, barkod veya ürün adı..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runSearch}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
          >
            Ara
          </button>
          {hasActiveSearch && (
            <button
              type="button"
              onClick={clearSearch}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Temizle
            </button>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Fatura No
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Tip
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Müşteri
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Şube
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                  Tutar (TL)
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                  Tarih
                </th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                    Yükleniyor...
                  </td>
                </tr>
              )}
              {!loading && invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                    {hasActiveSearch
                      ? 'Arama kriterine uygun fatura bulunamadı.'
                      : 'Kayıt bulunamadı.'}
                  </td>
                </tr>
              )}
              {!loading &&
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      <button
                        type="button"
                        onClick={() => openEditor(inv)}
                        className={`text-left hover:underline ${
                          inv.type === 'SATIS'
                            ? 'text-violet-700 hover:text-violet-900'
                            : inv.type === 'ALIS'
                              ? 'text-rose-700 hover:text-rose-900'
                              : 'text-amber-700 hover:text-amber-900'
                        }`}
                      >
                        {inv.invoiceNo}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${invoiceTypeStyles(inv.type)}`}
                      >
                        {invoiceTypeLabel(inv.type)}
                      </span>
                      {inv.isPreOrder && (
                        <span className="ml-2 inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-caption font-semibold text-amber-800">
                          Ön Sipariş
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <CustomerNameLink customerId={inv.customer.id}>
                        {inv.customer.name}
                      </CustomerNameLink>
                      <p className="text-xs text-slate-400">{inv.customer.code}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{inv.branch.name}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold">
                      {formatMoney(inv.totalAmountTl)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-500">
                      {formatDate(inv.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEditor(inv)}
                        className={`rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 ${
                          inv.type === 'SATIS'
                            ? 'hover:text-violet-600'
                            : inv.type === 'ALIS'
                              ? 'hover:text-rose-600'
                              : 'hover:text-amber-600'
                        }`}
                        title="Düzenle"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
