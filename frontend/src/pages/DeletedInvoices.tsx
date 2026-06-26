import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, Trash2 } from 'lucide-react';
import CustomerNameLink from '../components/CustomerNameLink';
import {
  API_BASE,
  formatDate,
  formatMoney,
  invoiceAmountUsd,
  invoiceTypeLabel,
  invoiceTypeStyles,
} from '../lib/api';

type DeletedInvoice = {
  id: number;
  invoiceNo: string;
  type: string;
  totalAmountTl: number;
  totalAmountUsd?: number;
  exchangeRate?: number;
  createdAt: string;
  deletedAt: string | null;
  customer: { id: number; code: string; name: string };
  branch: { id: number; name: string };
};

type DeletedInvoicesProps = {
  onNotify?: (type: 'success' | 'error', message: string) => void;
  onDataChange?: () => void;
};

export default function DeletedInvoices({
  onNotify,
  onDataChange,
}: DeletedInvoicesProps) {
  const [invoices, setInvoices] = useState<DeletedInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const notify = useCallback(
    (type: 'success' | 'error', message: string) => onNotify?.(type, message),
    [onNotify]
  );

  const loadDeleted = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get<{ success: boolean; data: DeletedInvoice[] }>(
        `${API_BASE}/api/sales/invoices/trash`
      );
      if (response.data.success) {
        setInvoices(response.data.data);
      }
    } catch {
      setInvoices([]);
      notify('error', 'Silinen işlemler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void loadDeleted();
  }, [loadDeleted]);

  const permanentDelete = async (inv: DeletedInvoice) => {
    const confirmed = window.confirm(
      `"${inv.invoiceNo}" fişini KALICI olarak silmek istiyor musunuz?\n\nBu işlem geri alınamaz.`
    );
    if (!confirmed) return;

    setDeletingId(inv.id);
    try {
      const response = await axios.delete<{
        success: boolean;
        message?: string;
      }>(`${API_BASE}/api/sales/invoices/${inv.id}/permanent`);
      if (!response.data.success) {
        throw new Error(response.data.message ?? 'Kalıcı silme başarısız.');
      }
      notify('success', `${inv.invoiceNo} kalıcı olarak silindi.`);
      await loadDeleted();
      onDataChange?.();
    } catch (error) {
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? String(error.response.data.message)
          : 'Kalıcı silme başarısız.';
      notify('error', message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 rounded-xl bg-red-600 p-2.5 text-white">
            <Trash2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">
              Silinen İşlemler
            </h1>
            <p className="text-sm text-slate-500">
              Yanlış fişler önce buraya taşınır; buradan kalıcı silinir
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <div className="flex gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Fatura listesinden <strong>Fişi Sil</strong> ile taşınan kayıtlar burada görünür.
            Stok ve cari etkileri silme anında geri alınmıştır. Kalıcı silme yalnızca bu
            ekrandan yapılır.
          </p>
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
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                  Tutar ($)
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                  Silinme
                </th>
                <th className="w-36 px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                  İşlem
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                    Yükleniyor...
                  </td>
                </tr>
              )}
              {!loading && invoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                    Silinen işlem yok.
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
                        className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${invoiceTypeStyles(inv.type)}`}
                      >
                        {invoiceTypeLabel(inv.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <CustomerNameLink customerId={inv.customer.id}>
                        {inv.customer.name}
                      </CustomerNameLink>
                      <p className="text-xs text-slate-400">{inv.customer.code}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold">
                      {formatMoney(invoiceAmountUsd(inv))}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-500">
                      {inv.deletedAt ? formatDate(inv.deletedAt) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void permanentDelete(inv)}
                        disabled={deletingId === inv.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deletingId === inv.id ? 'Siliniyor...' : 'Kalıcı Sil'}
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
