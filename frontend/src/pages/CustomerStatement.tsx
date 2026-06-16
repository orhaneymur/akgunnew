import { useEffect, useState } from 'react';
import axios from 'axios';
import { Download, FileText } from 'lucide-react';
import {
  API_BASE,
  LIST_PAGE_SIZE,
  ensureArray,
  formatDate,
  formatMoney,
  type PaginatedListResponse,
} from '../lib/api';

type Customer = {
  id: number;
  code: string;
  name: string;
  balance: number;
  creditLimit: number;
};

type StatementLine = {
  date: string;
  kind: 'invoice' | 'payment';
  description: string;
  debit: number;
  credit: number;
};

export default function CustomerStatement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios
      .get<PaginatedListResponse<Customer>>(`${API_BASE}/api/customers`, {
        params: { page: 1, limit: LIST_PAGE_SIZE },
      })
      .then((res) => {
        if (res.data.success) {
          const list = ensureArray(res.data.data);
          setCustomers(list);
          if (list.length > 0) setCustomerId(list[0].id);
        }
      });
  }, []);

  useEffect(() => {
    if (customerId === '') return;
    setLoading(true);
    axios
      .get<{
        success: boolean;
        data: { customer: Customer; lines: StatementLine[] };
      }>(`${API_BASE}/api/reports/customer-statement`, {
        params: { customerId },
      })
      .then((res) => {
        if (res.data.success) {
          setCustomer(res.data.data.customer);
          setLines(res.data.data.lines);
        }
      })
      .finally(() => setLoading(false));
  }, [customerId]);

  const downloadCsv = () => {
    if (customerId === '') return;
    fetch(`${API_BASE}/api/reports/customer-statement?customerId=${customerId}`, {
      headers: { Accept: 'text/csv' },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ekstre-${customer?.code ?? customerId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-600 p-2.5 text-white">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="page-title">Müşteri Ekstre</h1>
            <p className="text-sm text-slate-500">Cari hesap hareketleri</p>
          </div>
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          disabled={customerId === ''}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          CSV İndir
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="mb-1 block text-sm font-medium text-slate-700">Müşteri</label>
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : '')}
          className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
        {customer && (
          <p className="mt-2 text-sm text-slate-600">
            Güncel bakiye:{' '}
            <strong className={customer.balance >= 0 ? 'text-emerald-700' : 'text-red-600'}>
              {formatMoney(customer.balance)}
            </strong>
          </p>
        )}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="py-12 text-center text-slate-400">Yükleniyor...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Tarih
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                    Açıklama
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                    Borç
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                    Alacak
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line, idx) => (
                  <tr key={`${line.date}-${idx}`} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatDate(line.date)}
                    </td>
                    <td className="px-4 py-3 text-sm">{line.description}</td>
                    <td className="px-4 py-3 text-right text-sm text-red-600">
                      {line.debit > 0 ? formatMoney(line.debit) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-emerald-700">
                      {line.credit > 0 ? formatMoney(line.credit) : '—'}
                    </td>
                  </tr>
                ))}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-400">
                      Hareket yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
