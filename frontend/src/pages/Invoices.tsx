import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Eye, FileText, Filter, Pencil, Save, Search, X } from 'lucide-react';
import {
  API_BASE,
  formatDate,
  formatMoney,
  invoiceTypeLabel,
  invoiceTypeStyles,
  type InvoiceType,
} from '../lib/api';
import ExcelActions from '../components/ExcelActions';

type Invoice = {
  id: number;
  invoiceNo: string;
  type: string;
  isPreOrder?: boolean;
  paymentMethod: string;
  paymentType: string | null;
  processedBy: string | null;
  orderNotes: string | null;
  deliveryType: string;
  totalAmountTl: number;
  totalAmountUsd: number;
  createdAt: string;
  customer: { id: number; code: string; name: string };
  user: { id: number; name: string } | null;
  branch: { id: number; name: string };
  originalInvoice?: { id: number; invoiceNo: string; type: string } | null;
};

type InvoiceLine = {
  id: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  returnedQty?: number;
  returnableQty?: number;
  product: { sku: string; name: string };
};

type InvoiceDetail = Invoice & {
  items: InvoiceLine[];
};

type FilterType = 'ALL' | InvoiceType;

type InvoicesProps = {
  initialFilter?: FilterType;
  preOrderOnly?: boolean;
  title?: string;
  description?: string;
  onNotify?: (type: 'success' | 'error', message: string) => void;
};

export default function Invoices({
  initialFilter = 'ALL',
  preOrderOnly = false,
  title = 'Fatura Listesi',
  description = 'Satış, alış ve iade faturaları — görüntüle ve düzenle',
  onNotify,
}: InvoicesProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    paymentMethod: '',
    processedBy: '',
    orderNotes: '',
    deliveryType: '',
  });

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
      const response = await axios.get<{ success: boolean; data: Invoice[] }>(
        `${API_BASE}/api/sales/invoices`,
        { params }
      );
      if (response.data.success) {
        setInvoices(response.data.data);
      }
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [filter, preOrderOnly]);

  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('tr-TR');
    if (!query) return invoices;

    return invoices.filter((inv) => {
      const haystack = [
        inv.invoiceNo,
        inv.customer.code,
        inv.customer.name,
        inv.paymentMethod,
        inv.processedBy ?? '',
        inv.orderNotes ?? '',
      ]
        .join(' ')
        .toLocaleLowerCase('tr-TR');
      return haystack.includes(query);
    });
  }, [invoices, search]);

  const openDetail = async (inv: Invoice) => {
    setDetailLoading(true);
    setEditing(false);
    try {
      const res = await axios.get<{ success: boolean; data: InvoiceDetail }>(
        `${API_BASE}/api/sales/invoices/${inv.id}`
      );
      if (res.data.success) {
        const data = res.data.data;
        setDetail(data);
        setForm({
          paymentMethod: data.paymentMethod,
          processedBy: data.processedBy ?? '',
          orderNotes: data.orderNotes ?? '',
          deliveryType: data.deliveryType,
        });
      }
    } catch {
      notify('error', 'Fatura detayı yüklenemedi.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setSubmitting(true);
    try {
      await axios.put(`${API_BASE}/api/sales/invoices/${detail.id}`, {
        paymentMethod: form.paymentMethod,
        processedBy: form.processedBy || null,
        orderNotes: form.orderNotes || null,
        deliveryType: form.deliveryType,
      });
      notify('success', 'Fatura güncellendi.');
      setEditing(false);
      await loadInvoices();
      await openDetail(detail);
    } catch {
      notify('error', 'Güncelleme başarısız.');
    } finally {
      setSubmitting(false);
    }
  };

  const filters: { value: FilterType; label: string }[] = [
    { value: 'ALL', label: 'Tümü' },
    { value: 'SATIS', label: 'Satış' },
    { value: 'ALIS', label: 'Alış' },
    { value: 'IADE', label: 'İade' },
  ];

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
                  ? item.value === 'ALIS'
                    ? 'bg-red-100 text-red-700'
                    : item.value === 'SATIS'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-indigo-100 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        )}
        </div>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Fatura no, müşteri adı veya kodu ile ara..."
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:border-violet-500 focus:ring-violet-500"
        />
      </div>

      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                  Fatura No
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                  Tip
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                  Müşteri
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                  Şube
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                  Tutar (TL)
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                  Tarih
                </th>
                <th className="px-4 py-3 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-sm">
                    Yükleniyor...
                  </td>
                </tr>
              )}
              {!loading && filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-sm">
                    {search.trim() ? 'Arama kriterine uygun fatura bulunamadı.' : 'Kayıt bulunamadı.'}
                  </td>
                </tr>
              )}
              {!loading &&
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      {inv.invoiceNo}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold ring-1 ring-inset ${invoiceTypeStyles(inv.type)}`}
                      >
                        {invoiceTypeLabel(inv.type)}
                      </span>
                      {inv.isPreOrder && (
                        <span className="ml-2 inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                          Ön Sipariş
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-800">{inv.customer.name}</p>
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
                        onClick={() => openDetail(inv)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50"
                        title="Detay"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60"
            onClick={() => !detailLoading && setDetail(null)}
          />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
            {detailLoading && !detail ? (
              <p className="p-8 text-center text-slate-400">Yükleniyor...</p>
            ) : detail ? (
              <>
                <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">{detail.invoiceNo}</h3>
                    <p className="text-xs text-slate-500">
                      {invoiceTypeLabel(detail.type)} · {detail.customer.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!editing && (
                      <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-violet-600 hover:bg-violet-50"
                      >
                        <Pencil className="w-4 h-4" />
                        Düzenle
                      </button>
                    )}
                    <button type="button" onClick={() => setDetail(null)}>
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>
                </div>

                {editing ? (
                  <form onSubmit={handleSave} className="p-5 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600">Ödeme</label>
                      <input
                        value={form.paymentMethod}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, paymentMethod: e.target.value }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Personel</label>
                      <input
                        value={form.processedBy}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, processedBy: e.target.value }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Teslimat</label>
                      <input
                        value={form.deliveryType}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, deliveryType: e.target.value }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Açıklama</label>
                      <textarea
                        rows={3}
                        value={form.orderNotes}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, orderNotes: e.target.value }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditing(false)}
                        className="rounded-lg px-4 py-2 text-sm text-slate-600"
                      >
                        İptal
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        Kaydet
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-slate-500">Tutar</span>
                        <p className="font-semibold">{formatMoney(detail.totalAmountTl)}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Tarih</span>
                        <p>{formatDate(detail.createdAt)}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Ödeme</span>
                        <p>{detail.paymentMethod}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Şube</span>
                        <p>{detail.branch.name}</p>
                      </div>
                    </div>
                    {detail.originalInvoice && (
                      <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                        Kaynak fatura: <strong>{detail.originalInvoice.invoiceNo}</strong>
                      </p>
                    )}
                    {detail.orderNotes && (
                      <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                        {detail.orderNotes}
                      </p>
                    )}
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-left text-xs text-slate-500 uppercase">
                          <th className="py-2">Ürün</th>
                          <th className="py-2 text-right">Adet</th>
                          <th className="py-2 text-right">Fiyat</th>
                          <th className="py-2 text-right">Toplam</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.items.map((line) => (
                          <tr key={line.id} className="border-b border-slate-50">
                            <td className="py-2">
                              <p className="font-medium">{line.product.name}</p>
                              <p className="text-xs text-slate-400">{line.product.sku}</p>
                            </td>
                            <td className="py-2 text-right">
                              {line.quantity}
                              {line.returnableQty != null && detail.type === 'SATIS' && (
                                <span className="block text-[10px] text-emerald-600">
                                  iade: {line.returnableQty}
                                </span>
                              )}
                            </td>
                            <td className="py-2 text-right">{formatMoney(line.unitPrice)}</td>
                            <td className="py-2 text-right font-medium">
                              {formatMoney(line.totalPrice)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
