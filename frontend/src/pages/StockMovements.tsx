import { useEffect, useState } from 'react';
import axios from 'axios';
import { History } from 'lucide-react';
import PaginationBar from '../components/PaginationBar';
import {
  API_BASE,
  LIST_PAGE_SIZE,
  ensureArray,
  formatDate,
  invoiceTypeLabel,
  type PaginatedListResponse,
} from '../lib/api';

type MovementRow = {
  id: number;
  product: { id: number; sku: string; name: string };
  quantity: number;
  direction: 'IN' | 'OUT';
  depot: string;
  invoiceNo: string;
  invoiceType: string;
  customer: { code: string; name: string };
  createdAt: string;
};

export default function StockMovements() {
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await axios.get<PaginatedListResponse<MovementRow>>(
          `${API_BASE}/api/reports/stock-history`,
          { params: { page, limit: LIST_PAGE_SIZE } }
        );
        if (res.data.success) {
          setRows(ensureArray(res.data.data));
          setTotalCount(res.data.totalCount);
        }
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [page]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-cyan-600 p-2.5 text-white">
          <History className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Stok Hareketleri</h1>
          <p className="text-sm text-slate-500">Satış, alış ve iade kaynaklı hareketler</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Tarih
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Ürün
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                  Fatura
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-slate-500">
                  Yön
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                  Miktar
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                    Yükleniyor...
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">{row.product.name}</p>
                      <p className="text-xs text-slate-400">{row.product.sku}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <p className="font-medium">{row.invoiceNo}</p>
                      <p className="text-xs text-slate-400">
                        {invoiceTypeLabel(row.invoiceType)} · {row.customer.code}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${
                          row.direction === 'IN'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {row.direction === 'IN' ? 'Giriş' : 'Çıkış'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold">
                      {row.quantity}
                    </td>
                  </tr>
                ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                    Hareket bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar
          page={page}
          totalCount={totalCount}
          limit={LIST_PAGE_SIZE}
          onPageChange={setPage}
        />
      </section>
    </div>
  );
}
