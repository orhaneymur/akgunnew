import { useEffect, useState } from 'react';
import axios from 'axios';
import { FileText, Filter } from 'lucide-react';
import {
  API_BASE,
  formatDate,
  formatMoney,
  invoiceTypeLabel,
  invoiceTypeStyles,
  type InvoiceType,
} from '../lib/api';

type Invoice = {
  id: number;
  invoiceNo: string;
  type: string;
  paymentMethod: string;
  totalAmountTl: number;
  totalAmountUsd: number;
  createdAt: string;
  customer: { id: number; code: string; name: string };
  user: { id: number; name: string } | null;
  branch: { id: number; name: string };
};

type FilterType = 'ALL' | InvoiceType;

type InvoicesProps = {
  initialFilter?: FilterType;
  title?: string;
  description?: string;
};

export default function Invoices({
  initialFilter = 'ALL',
  title = 'Fatura Listesi',
  description = 'Satış, alış ve iade faturaları — filtreli görünüm',
}: InvoicesProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = filter !== 'ALL' ? { type: filter } : {};
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
    };
    load();
  }, [filter]);

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
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                  Personel
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                  Ödeme
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                  Tutar (TL)
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">
                  Tarih
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-sm">
                    Yükleniyor...
                  </td>
                </tr>
              )}
              {!loading &&
                invoices.map((inv) => (
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
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-800">{inv.customer.name}</p>
                      <p className="text-xs text-slate-400">{inv.customer.code}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {inv.branch.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {inv.user?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {inv.paymentMethod}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`text-sm font-semibold ${
                          inv.type === 'ALIS'
                            ? 'text-red-600 bg-red-50 px-2 py-0.5 rounded'
                            : inv.type === 'SATIS'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                        }`}
                      >
                        {formatMoney(inv.totalAmountTl)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-500">
                      {formatDate(inv.createdAt)}
                    </td>
                  </tr>
                ))}
              {!loading && invoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-sm">
                    Bu filtreye uygun fatura bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
