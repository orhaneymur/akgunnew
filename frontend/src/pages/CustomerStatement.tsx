import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Download, FileText } from 'lucide-react';
import CustomerNameLink from '../components/CustomerNameLink';
import CustomerSearchPanel from '../components/CustomerSearchPanel';
import {
  API_BASE,
  balanceStyles,
  formatDate,
  formatMoney,
  type Customer,
} from '../lib/api';

type StatementLine = {
  date: string;
  kind: 'invoice' | 'payment';
  description: string;
  debit: number;
  credit: number;
};

export default function CustomerStatement({
  initialCustomerId,
}: {
  initialCustomerId?: number;
} = {}) {
  const [customerId, setCustomerId] = useState<number | ''>(
    initialCustomerId && initialCustomerId > 0 ? initialCustomerId : ''
  );
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);

  const selectCustomer = useCallback((picked: Customer) => {
    setCustomerId(picked.id);
    setCustomer(picked);
  }, []);

  useEffect(() => {
    if (!initialCustomerId || initialCustomerId <= 0) return;

    let cancelled = false;
    const loadInitial = async () => {
      try {
        const response = await axios.get<{ success: boolean; data: Customer }>(
          `${API_BASE}/api/customers/${initialCustomerId}`
        );
        if (!cancelled && response.data.success) {
          selectCustomer(response.data.data);
        }
      } catch {
        /* müşteri yüklenemedi */
      }
    };

    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, [initialCustomerId, selectCustomer]);

  useEffect(() => {
    if (customerId === '') {
      setCustomer(null);
      setLines([]);
      return;
    }

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
            <p className="text-sm text-slate-500">
              Soldan müşteri seçin · kod veya isimle filtreleyin · ekstre sağda görünür
            </p>
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-4">
          <CustomerSearchPanel
            selectedCustomerId={customerId}
            onSelect={selectCustomer}
            accentClass="blue"
          />
          {customer && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-slate-700">
              <p className="font-medium text-slate-900">
                {customer.code} — {customer.name}
              </p>
              <p className="mt-1">
                Güncel bakiye:{' '}
                <strong className={balanceStyles(customer.balance).text}>
                  {formatMoney(customer.balance)}
                </strong>
              </p>
              <CustomerNameLink customerId={customer.id} className="mt-2 inline-block text-sm">
                Müşteri kartını aç
              </CustomerNameLink>
            </div>
          )}
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-8">
          {loading ? (
            <p className="py-12 text-center text-slate-400">Yükleniyor...</p>
          ) : customerId === '' ? (
            <p className="py-12 text-center text-sm text-slate-400">
              Ekstre görmek için soldan bir müşteri seçin.
            </p>
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
    </div>
  );
}
